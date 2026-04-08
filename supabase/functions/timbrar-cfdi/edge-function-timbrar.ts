// ============================================================
//  OBRIX — Edge Function: timbrar-cfdi
//  supabase/functions/timbrar-cfdi/index.ts
//
//  Recibe datos del CFDI desde el frontend,
//  genera el XML, lo envía al PAC y guarda el resultado.
//
//  Variables de entorno requeridas en Supabase:
//    SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
//    (Las credenciales del PAC se leen de pac_config en BD)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPacAdapter }  from '../_shared/pac-adapter.ts'
import { generarXmlCfdi } from '../_shared/cfdi-generator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const t0 = Date.now()

  try {
    // ── Auth ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return error('No autorizado', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verificar usuario
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return error('No autorizado', 401)

    // Obtener company_id del usuario
    const { data: perfil } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!perfil) return error('Perfil no encontrado', 404)
    const companyId = perfil.company_id

    // ── Leer body ───────────────────────────────────────────
    const body = await req.json()
    const { cfdi_input, cfdi_id } = body

    if (!cfdi_input || !cfdi_id) return error('Faltan parámetros: cfdi_input, cfdi_id', 400)

    // ── Leer configuración del PAC ──────────────────────────
    const { data: pacCfg, error: pacErr } = await supabase
      .from('pac_config')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (pacErr || !pacCfg) return error('No hay configuración de PAC. Configure en Ajustes → PAC.', 400)
    if (!pacCfg.csd_valido) return error('El CSD no está validado. Suba su certificado en Ajustes → PAC.', 400)

    // ── Marcar CFDI como "por_timbrar" ──────────────────────
    await supabase
      .from('cfdi_documentos')
      .update({ estatus_emision: 'por_timbrar', updated_at: new Date().toISOString() })
      .eq('id', cfdi_id)
      .eq('company_id', companyId)

    // ── Generar XML ─────────────────────────────────────────
    const xml = generarXmlCfdi(cfdi_input)

    // ── Seleccionar PAC y timbrar ────────────────────────────
    // Descifrar credenciales (en producción usar pgsodium o Vault de Supabase)
    const pac = getPacAdapter({
      pac:         pacCfg.pac_activo,
      ambiente:    pacCfg[`${pacCfg.pac_activo.replace('sw_sapien','sw').replace('formas_digitales','fd').replace('digibox','db')}_ambiente`] || 'sandbox',
      sw_usuario:  pacCfg.sw_usuario,
      sw_password: pacCfg.sw_password_enc,  // TODO: descifrar
      fd_api_key:  pacCfg.fd_api_key_enc,   // TODO: descifrar
      db_api_key:  pacCfg.db_api_key_enc,   // TODO: descifrar
      db_api_secret: pacCfg.db_api_secret_enc, // TODO: descifrar
    })

    const resultado = await pac.timbrar(xml)
    const duracion  = Date.now() - t0

    // ── Guardar log del intento ─────────────────────────────
    await supabase.from('cfdi_log').insert({
      cfdi_id,
      company_id:   companyId,
      pac:          pacCfg.pac_activo,
      accion:       'timbrado',
      estatus:      resultado.ok ? 'exito' : 'error',
      response_raw: resultado.raw,
      error_msg:    resultado.error,
      duracion_ms:  duracion,
      created_by:   user.id,
    })

    if (!resultado.ok) {
      // Marcar como error
      await supabase
        .from('cfdi_documentos')
        .update({
          estatus_emision: 'error',
          pac_error_msg:   resultado.error,
          pac_intento_num: (pacCfg.pac_intento_num || 0) + 1,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', cfdi_id)

      return error(`Error del PAC: ${resultado.error}`, 422)
    }

    // ── Extraer datos del XML timbrado ──────────────────────
    const xmlTimbrado = resultado.xml_timbrado!
    const uuid        = resultado.uuid!
    const fechaTimbrado = new Date().toISOString()

    // Extraer sellos del XML (para no depender del PAC)
    const selloSat  = xmlTimbrado.match(/SelloSAT="([^"]+)"/)?.[1] || ''
    const selloCfd  = xmlTimbrado.match(/SelloCFD="([^"]+)"/)?.[1] || ''
    const noCertSat = xmlTimbrado.match(/NoCertificadoSAT="([^"]+)"/)?.[1] || ''

    // ── Guardar XML timbrado en Storage ─────────────────────
    const xmlPath = `${companyId}/cfdi/${uuid}.xml`
    await supabase.storage
      .from('cfdi-documentos')
      .upload(xmlPath, new Blob([xmlTimbrado], { type: 'application/xml' }), {
        upsert: true,
      })

    const { data: { publicUrl: xmlUrl } } = supabase.storage
      .from('cfdi-documentos')
      .getPublicUrl(xmlPath)

    // ── Actualizar CFDI en BD ────────────────────────────────
    await supabase
      .from('cfdi_documentos')
      .update({
        uuid_cfdi:           uuid,
        tfd_uuid:            uuid,
        tfd_fecha_timbrado:  fechaTimbrado,
        tfd_no_certificado_sat: noCertSat,
        tfd_sello_sat:       selloSat,
        tfd_sello_cfd:       selloCfd,
        xml_raw:             xmlTimbrado,
        xml_url:             xmlUrl,
        estatus_emision:     'timbrado',
        estatus_sat:         'vigente',
        pac_proveedor:       pacCfg.pac_activo,
        pac_response_raw:    resultado.raw,
        pac_error_msg:       null,
        timbrado_por:        user.id,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', cfdi_id)

    // ── Crear póliza contable automática ────────────────────
    // (se llama a otra Edge Function o función SQL)
    // await supabase.rpc('crear_poliza_desde_cfdi', { p_cfdi_id: cfdi_id })

    return new Response(
      JSON.stringify({
        ok:          true,
        uuid,
        xml_url:     xmlUrl,
        fecha_timbrado: fechaTimbrado,
        duracion_ms: duracion,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (e) {
    console.error('timbrar-cfdi error:', e)
    return error(`Error interno: ${String(e)}`, 500)
  }
})

function error(msg: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: msg }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
  )
}
