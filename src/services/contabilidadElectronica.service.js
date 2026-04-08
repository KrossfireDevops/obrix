// ============================================================
//  OBRIX ERP — Servicio: Contabilidad Electrónica SAT
//  src/services/contabilidadElectronica.service.js
//  Versión: 1.0 | Marzo 2026
// ============================================================

import { supabase } from '../config/supabase'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buzon-fiscal`

async function getCompanyId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id')
    .eq('id', user.id)
    .single()
  return { companyId: data?.company_id, userId: data?.id }
}

// ============================================================
//  ENTREGAS SAT
// ============================================================

export async function getEntregas(limite = 24) {
  const { companyId } = await getCompanyId()
  const { data, error } = await supabase
    .from('entregas_sat')
    .select(`
      *,
      xmls_generados(id, tipo_xml, nombre_archivo, tamaño_bytes,
        num_cuentas, num_polizas, es_valido)
    `)
    .eq('company_id', companyId)
    .order('periodo_año', { ascending: false })
    .order('periodo_mes', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data ?? []
}

export async function getEntregaDetalle(entregaId) {
  const { data, error } = await supabase
    .from('entregas_sat')
    .select('*, xmls_generados(*)')
    .eq('id', entregaId)
    .single()
  if (error) throw error
  return data
}

// ============================================================
//  GENERACIÓN DE XMLs
// ============================================================

export async function generarEntrega({
  año, mes,
  incluyeCT = false,
  incluyeBC = true,
  incluyePL = false,
  incluyeXC = false,
  incluyeXF = false,
  tipoEnvio = 'normal',
  numRequerimiento = null,
}) {
  const { companyId, userId } = await getCompanyId()
  const { data, error } = await supabase.rpc('generar_entrega_sat', {
    p_company_id:  companyId,
    p_año:         año,
    p_mes:         mes,
    p_incluye_ct:  incluyeCT,
    p_incluye_bc:  incluyeBC,
    p_incluye_pl:  incluyePL,
    p_incluye_xc:  incluyeXC,
    p_incluye_xf:  incluyeXF,
    p_tipo_envio:  tipoEnvio,
    p_num_req:     numRequerimiento,
    p_creado_por:  userId,
  })
  if (error) throw error
  return data
}

// ============================================================
//  DESCARGA DE XMLs
// ============================================================

export async function getContenidoXml(xmlId) {
  const { data, error } = await supabase
    .from('xmls_generados')
    .select('contenido_xml, nombre_archivo, tipo_xml')
    .eq('id', xmlId)
    .single()
  if (error) throw error
  return data
}

export function descargarXml(contenidoXml, nombreArchivo) {
  const blob = new Blob(['\uFEFF' + contenidoXml], { type: 'application/xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nombreArchivo
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export async function descargarTodosComoZip(entregaId) {
  const entrega = await getEntregaDetalle(entregaId)
  if (!entrega?.xmls_generados?.length) throw new Error('No hay XMLs generados en esta entrega.')
  const JSZip = (await import('jszip')).default
  const zip   = new JSZip()
  for (const xml of entrega.xmls_generados) {
    const { data } = await supabase
      .from('xmls_generados')
      .select('contenido_xml, nombre_archivo')
      .eq('id', xml.id)
      .single()
    if (data) zip.file(data.nombre_archivo, data.contenido_xml)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `OBRIX_CE_${entrega.periodo_año}_${String(entrega.periodo_mes).padStart(2,'0')}.zip`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ============================================================
//  ENVÍO AL SAT
// ============================================================

export async function enviarAlSat(entregaId) {
  const { companyId } = await getCompanyId()
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({
      action:     'enviar_contabilidad',
      company_id: companyId,
      entrega_id: entregaId,
    }),
  })
  const json = await res.json()
  if (!res.ok || json.success === false) throw new Error(json.error ?? `Error HTTP ${res.status}`)
  return json
}

export async function marcarEnviadaManual(entregaId) {
  const { userId } = await getCompanyId()
  const { data, error } = await supabase
    .from('entregas_sat')
    .update({
      estatus:      'enviada',
      metodo_envio: 'manual',
      enviada_por:  userId,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', entregaId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
//  VALIDACIÓN PREVIA
// ============================================================

export async function validarPeriodo(año, mes) {
  const { companyId } = await getCompanyId()
  const fechaIni = `${año}-${String(mes).padStart(2,'0')}-01`
  const fechaFin = new Date(año, mes, 0).toISOString().split('T')[0]

  const [
    { count: totalPolizas },
    { count: polizasBorrador },
    { count: cuentasSinSat },
    { data: config },
  ] = await Promise.all([
    supabase.from('polizas').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('fecha', fechaIni).lte('fecha', fechaFin),
    supabase.from('polizas').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('estatus', 'borrador')
      .gte('fecha', fechaIni).lte('fecha', fechaFin),
    supabase.from('cuentas_contables').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('is_active', true)
      .eq('incluir_anexo24', true).is('codigo_sat', null),
    supabase.from('company_settings')
      .select('rfc_emisor, efirma_cer_url, efirma_vencimiento')
      .eq('company_id', companyId).single(),
  ])

  const alertas = []
  const errores = []

  if (!config?.data?.rfc_emisor)   errores.push('RFC emisor no configurado en Configuración → Empresa.')
  if (cuentasSinSat > 0)           alertas.push(`${cuentasSinSat} cuenta(s) sin código SAT.`)
  if (polizasBorrador > 0)         alertas.push(`${polizasBorrador} póliza(s) en borrador — no se incluirán.`)
  if (totalPolizas === 0)          alertas.push('No hay pólizas aplicadas en este período.')
  if (config?.data?.efirma_vencimiento) {
    const venc = new Date(config.data.efirma_vencimiento)
    const dias = Math.floor((venc - new Date()) / 86400000)
    if (dias < 0)  errores.push('La e.firma está vencida. Renuévala antes de enviar al SAT.')
    if (dias < 30) alertas.push(`La e.firma vence en ${dias} días.`)
  }

  return {
    ok:              errores.length === 0,
    errores,
    alertas,
    totalPolizas:    totalPolizas    ?? 0,
    polizasBorrador: polizasBorrador ?? 0,
    cuentasSinSat:   cuentasSinSat  ?? 0,
    tieneEfirma:     !!config?.data?.efirma_cer_url,
    rfcEmisor:       config?.data?.rfc_emisor,
  }
}

// ============================================================
//  UTILIDADES Y CONSTANTES
// ============================================================

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export const ESTATUS_ENTREGA = {
  pendiente:  { label: 'Pendiente',   color: 'bg-gray-100 text-gray-600'     },
  generando:  { label: 'Generando',   color: 'bg-blue-100 text-blue-700'     },
  lista:      { label: 'Lista',       color: 'bg-indigo-100 text-indigo-700' },
  enviando:   { label: 'Enviando',    color: 'bg-yellow-100 text-yellow-700' },
  enviada:    { label: 'Enviada',     color: 'bg-teal-100 text-teal-700'     },
  aceptada:   { label: 'Aceptada ✓', color: 'bg-green-100 text-green-700'   },
  rechazada:  { label: 'Rechazada',   color: 'bg-red-100 text-red-700'       },
  error:      { label: 'Error',       color: 'bg-red-100 text-red-700'       },
}

export const XML_INFO = {
  CT: { label: 'Catálogo de Cuentas',     icon: '📋', desc: 'Se envía 1 vez o cuando cambia el catálogo'  },
  BC: { label: 'Balanza de Comprobación', icon: '⚖️', desc: 'Obligatoria mensual — saldos por cuenta'     },
  PL: { label: 'Pólizas y Asientos',      icon: '📄', desc: 'Solo si el SAT lo solicita (requerimiento)'  },
  XC: { label: 'Auxiliar de Cuentas',     icon: '🔍', desc: 'Solo si el SAT lo solicita (requerimiento)'  },
  XF: { label: 'Auxiliar de Folios CFDI', icon: '🔗', desc: 'Solo si el SAT lo solicita (requerimiento)'  },
}

export function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}