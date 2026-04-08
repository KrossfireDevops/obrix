// src/services/terceros.service.js
// Módulo 1: Gestión de Terceros
// Arquitectura: base compartida (terceros) + relaciones por empresa (tercero_relaciones)

import { supabase } from '../config/supabase'

// ── Select base ───────────────────────────────────────────────────────────────
const TERCERO_SELECT = `
  *,
  tercero_relaciones!inner (
    id, tipo, score_fiscal, score_semaforo, sello_aprobacion,
    tiene_banderas, banderas_criticas, bloqueado, motivo_bloqueo,
    limite_credito, dias_credito, moneda, score_calculado_at,
    company_id
  )
`

const TERCERO_FULL_SELECT = `
  *,
  tercero_relaciones (
    id, tipo, score_fiscal, score_semaforo, sello_aprobacion,
    tiene_banderas, banderas_criticas, bloqueado, motivo_bloqueo,
    limite_credito, dias_credito, moneda, metodo_pago_default,
    forma_pago_default, score_calculado_at, company_id, is_active
  ),
  tercero_documentos (
    id, tipo_documento, archivo_nombre, archivo_path, fecha_documento,
    fecha_vencimiento, vigente, datos_extraidos, extraccion_ok, created_at
  ),
  tercero_banderas (
    id, tipo_bandera, nivel_urgencia, mensaje, dato_referencia,
    activa, notificado_at, created_at
  )
`

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCompanyId = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  return { userId: user.id, companyId: profile?.company_id }
}

// ── DIRECTORIO ────────────────────────────────────────────────────────────────

// Listar terceros de la empresa con filtros
export const getTerceros = async (filters = {}) => {
  try {
    const { companyId } = await getCompanyId()

    let query = supabase
      .from('terceros')
      .select(TERCERO_SELECT)
      .eq('is_active', true)
      .eq('tercero_relaciones.company_id', companyId)
      .eq('tercero_relaciones.is_active', true)
      .order('razon_social', { ascending: true })

    if (filters.tipo)     query = query.eq('tercero_relaciones.tipo', filters.tipo)
    if (filters.semaforo) query = query.eq('tercero_relaciones.score_semaforo', filters.semaforo)
    if (filters.bloqueado !== undefined)
      query = query.eq('tercero_relaciones.bloqueado', filters.bloqueado)
    if (filters.search) {
      query = query.or(
        `rfc.ilike.%${filters.search}%,razon_social.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('[getTerceros]', error)
    return { data: null, error }
  }
}

// Obtener tercero completo con documentos y banderas
export const getTerceroById = async (terceroId) => {
  try {
    const { companyId } = await getCompanyId()

    const { data, error } = await supabase
      .from('terceros')
      .select(TERCERO_FULL_SELECT)
      .eq('id', terceroId)
      .single()

    if (error) throw error

    // Filtrar relaciones, documentos y banderas de esta empresa
    data.tercero_relaciones = data.tercero_relaciones?.filter(r => r.company_id === companyId)
    data.tercero_documentos = data.tercero_documentos?.filter(d => d.company_id === companyId)
    data.tercero_banderas   = data.tercero_banderas?.filter(b => b.company_id === companyId && b.activa)

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Buscar tercero por RFC (para pre-llenado en alta)
export const getTerceroByRFC = async (rfc) => {
  try {
    const rfcClean = rfc.trim().toUpperCase()
    const { data, error } = await supabase
      .from('terceros')
      .select('*')
      .eq('rfc', rfcClean)
      .maybeSingle()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── ALTA DE TERCERO ───────────────────────────────────────────────────────────

// Crear o actualizar el registro base del tercero (identidad fiscal)
// Si el RFC ya existe, actualiza los datos fiscales y crea solo la relación
export const upsertTercero = async (terceroData) => {
  try {
    const { userId, companyId } = await getCompanyId()

    // FIX 1: Desestructurar TODOS los campos — incluyendo los nuevos de CSF
    const {
      // Identidad fiscal SAT
      rfc, razon_social, regimen_fiscal, uso_cfdi_default, email,
      // Campos nuevos CSF (antes ignorados)
      regimen_capital, nombre_comercial, telefono,
      fecha_inicio_ops, estatus_padron, fecha_ultimo_cambio,
      // Dirección fiscal (CP viene del objeto dirFiscal, pero también puede venir aquí)
      codigo_postal,
      // Relación por empresa
      tipo = 'proveedor',
      limite_credito, dias_credito, moneda = 'MXN',
      metodo_pago_default, forma_pago_default,
      // Control
      csf_parseada, csf_confianza, onboarding_paso = 1,
    } = terceroData

    const rfcClean = rfc?.trim().toUpperCase()
    if (!rfcClean) throw new Error('RFC es requerido')

    // ── 1. Upsert en terceros (identidad compartida entre empresas) ───────
    // FIX 2: Incluir todos los campos — mapeados a los nombres REALES de la BD
    // Nota: fecha_inicio_ops del form → csf_fecha_inicio_ops en la tabla
    const { data: tercero, error: terceroError } = await supabase
      .from('terceros')
      .upsert({
        rfc:                  rfcClean,
        razon_social:         razon_social?.trim(),
        // codigo_postal es NOT NULL en BD — usar vacío como fallback
        codigo_postal:        codigo_postal || '',
        // regimen_fiscal es NOT NULL en BD — usar vacío como fallback
        regimen_fiscal:       regimen_fiscal || '',
        uso_cfdi_default:     uso_cfdi_default || 'G03',
        email:                email?.toLowerCase().trim() || null,
        // Columnas nuevas agregadas en migration_terceros_csf_campos.sql
        regimen_capital:      regimen_capital?.trim()  || null,
        nombre_comercial:     nombre_comercial?.trim() || null,
        telefono:             telefono?.trim()         || null,
        estatus_padron:       estatus_padron           || null,
        fecha_ultimo_cambio:  fecha_ultimo_cambio      || null,
        // Mapeo correcto: fecha_inicio_ops del form → csf_fecha_inicio_ops en BD
        csf_fecha_inicio_ops: fecha_inicio_ops         || null,
        // Metadatos CSF
        csf_parseada:         csf_parseada  ?? false,
        csf_confianza:        csf_confianza ?? 0,
        nivel_completado:     onboarding_paso >= 3 ? 2 : 1,
        onboarding_paso:      onboarding_paso || 1,
        created_by:           userId,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'rfc' })
      .select()
      .single()

    if (terceroError) throw terceroError

    // ── 2. Crear o actualizar relación por empresa ────────────────────────
    const { data: relacion, error: relacionError } = await supabase
      .from('tercero_relaciones')
      .upsert({
        tercero_id:           tercero.id,
        company_id:           companyId,
        tipo,
        limite_credito:       limite_credito || null,
        dias_credito:         dias_credito   || null,
        moneda,
        metodo_pago_default:  metodo_pago_default || null,
        forma_pago_default:   forma_pago_default  || null,
        created_by:           userId,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'tercero_id,company_id' })
      .select()
      .single()

    if (relacionError) throw relacionError

    // ── 3. Calcular score inicial — con try/catch propio ─────────────────
    // FIX 3: El score NO debe bloquear el guardado.
    // Si la función RPC falla (no existe, error de BD), el tercero ya está
    // guardado correctamente — solo registramos el error sin propagarlo.
    // El score se puede recalcular manualmente desde el directorio.
    try {
      await supabase.rpc('calcular_score_fiscal', {
        p_tercero_id: tercero.id,
        p_company_id: companyId,
        p_motivo:     'Alta inicial de tercero',
      })
      // Evaluar banderas después del score
      await supabase.rpc('evaluar_banderas_tercero', {
        p_tercero_id: tercero.id,
        p_company_id: companyId,
      })
    } catch (scoreError) {
      // Score fallido — el tercero está guardado, el score se puede recalcular
      console.warn('[upsertTercero] Score no calculado (se puede recalcular):', scoreError.message)
      // Asignar score mínimo por defecto en la relación para que aparezca en semáforo
      await supabase
        .from('tercero_relaciones')
        .update({
          score_fiscal:   20,
          score_semaforo: 'rojo',
          score_calculado_at: new Date().toISOString(),
        })
        .eq('tercero_id', tercero.id)
        .eq('company_id', companyId)
    }

    return { data: { tercero, relacion }, error: null }
  } catch (error) {
    console.error('[upsertTercero]', error)
    return { data: null, error }
  }
}

// Actualizar Nivel 2 del tercero
export const updateTerceroNivel2 = async (terceroId, nivel2Data) => {
  try {
    const { userId, companyId } = await getCompanyId()

    const {
      csf_fecha_inicio_ops, opinion_32d_estatus, opinion_32d_fecha,
      domicilio_estatus_sat, csd_numero, csd_vencimiento, csd_estatus,
      clabe, clabe_titular, clabe_verificada,
      repse_numero, repse_vencimiento,
    } = nivel2Data

    const { data, error } = await supabase
      .from('terceros')
      .update({
        csf_fecha_inicio_ops,
        opinion_32d_estatus,
        opinion_32d_fecha,
        domicilio_estatus_sat,
        csd_numero,
        csd_vencimiento,
        csd_estatus,
        clabe,
        clabe_titular,
        clabe_verificada,
        repse_numero,
        repse_vencimiento,
        nivel_completado: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', terceroId)
      .select()
      .single()

    if (error) throw error

    // Recalcular score con nuevos datos
    const { data: score } = await supabase.rpc('calcular_score_fiscal', {
      p_tercero_id: terceroId,
      p_company_id: companyId,
      p_motivo:     'Actualización Nivel 2'
    })

    // Evaluar banderas
    await supabase.rpc('evaluar_banderas_tercero', {
      p_tercero_id: terceroId,
      p_company_id: companyId,
    })

    return { data: { tercero: data, score }, error: null }
  } catch (error) {
    console.error('[updateTerceroNivel2]', error)
    return { data: null, error }
  }
}

// ── DOCUMENTOS ────────────────────────────────────────────────────────────────

// Subir documento y registrar en BD
export const uploadDocumento = async (terceroId, tipoDocumento, file, datosExtraidos = null) => {
  try {
    const { userId, companyId } = await getCompanyId()

    const timestamp  = Date.now()
    const extension  = file.name.split('.').pop()
    const storagePath = `fiscal/${companyId}/${terceroId}/${tipoDocumento}_${timestamp}.${extension}`

    // Subir a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('fiscal-documentos')
      .upload(storagePath, file, { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    // Calcular fecha de vencimiento para 32-D (30 días desde emisión)
    let fechaVencimiento = null
    if (tipoDocumento === 'opinion_32d' && datosExtraidos?.fecha_documento) {
      const fecha = new Date(datosExtraidos.fecha_documento)
      fecha.setDate(fecha.getDate() + 30)
      fechaVencimiento = fecha.toISOString().split('T')[0]
    }

    // Registrar en BD
    const { data, error } = await supabase
      .from('tercero_documentos')
      .insert({
        tercero_id:       terceroId,
        company_id:       companyId,
        tipo_documento:   tipoDocumento,
        archivo_path:     storagePath,
        archivo_nombre:   file.name,
        archivo_size:     file.size,
        mime_type:        file.type,
        datos_extraidos:  datosExtraidos,
        extraccion_ok:    !!datosExtraidos,
        fecha_documento:  datosExtraidos?.fecha_documento || null,
        fecha_vencimiento: fechaVencimiento,
        cargado_por:      userId,
      })
      .select()
      .single()

    if (error) throw error

    // Actualizar campos en terceros según tipo de documento
    await actualizarCamposPorDocumento(terceroId, tipoDocumento, datosExtraidos, storagePath)

    return { data: { documento: data, path: storagePath }, error: null }
  } catch (error) {
    console.error('[uploadDocumento]', error)
    return { data: null, error }
  }
}

// Actualiza los campos del tercero según el tipo de documento cargado
const actualizarCamposPorDocumento = async (terceroId, tipo, datos, path) => {
  const updates = {}

  switch (tipo) {
    case 'csf':
      updates.csf_path             = path
      updates.csf_fecha_carga      = new Date().toISOString().split('T')[0]
      if (datos?.fecha_inicio_ops) updates.csf_fecha_inicio_ops = datos.fecha_inicio_ops
      if (datos?.razon_social)     updates.razon_social         = datos.razon_social
      if (datos?.codigo_postal)    updates.codigo_postal        = datos.codigo_postal
      if (datos?.regimen_fiscal)   updates.regimen_fiscal       = datos.regimen_fiscal
      break
    case 'opinion_32d':
      updates.opinion_32d_path    = path
      updates.opinion_32d_estatus = datos?.estatus  || null
      updates.opinion_32d_fecha   = datos?.fecha    || null
      break
    case 'comprobante_domicilio':
      updates.comprobante_dom_path = path
      break
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString()
    await supabase.from('terceros').update(updates).eq('id', terceroId)
  }
}

// Obtener URL pública temporal de un documento
export const getDocumentoUrl = async (storagePath) => {
  try {
    const { data, error } = await supabase.storage
      .from('fiscal-documentos')
      .createSignedUrl(storagePath, 3600) // 1 hora de vigencia
    if (error) throw error
    return { data: data.signedUrl, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── BANDERAS ──────────────────────────────────────────────────────────────────

// Obtener banderas activas de la empresa
export const getBanderas = async (filtros = {}) => {
  try {
    const { companyId } = await getCompanyId()

    let query = supabase
      .from('tercero_banderas')
      .select('*, terceros(rfc, razon_social)')
      .eq('company_id', companyId)
      .eq('activa', true)
      .order('nivel_urgencia', { ascending: true }) // critica primero
      .order('created_at', { ascending: false })

    if (filtros.nivel_urgencia) query = query.eq('nivel_urgencia', filtros.nivel_urgencia)
    if (filtros.tipo_bandera)   query = query.eq('tipo_bandera',   filtros.tipo_bandera)
    if (filtros.tercero_id)     query = query.eq('tercero_id',     filtros.tercero_id)

    const { data, error } = await query
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Resolver una bandera
export const resolverBandera = async (banderaId, observacion = '') => {
  try {
    const { userId } = await getCompanyId()

    const { data, error } = await supabase
      .from('tercero_banderas')
      .update({
        activa:       false,
        resuelta_at:  new Date().toISOString(),
        resuelta_por: userId,
        mensaje:      observacion || undefined,
      })
      .eq('id', banderaId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── SCORING ───────────────────────────────────────────────────────────────────

// Recalcular score manualmente
export const recalcularScore = async (terceroId, motivo = 'Recálculo manual') => {
  try {
    const { companyId } = await getCompanyId()

    const { data, error } = await supabase.rpc('calcular_score_fiscal', {
      p_tercero_id: terceroId,
      p_company_id: companyId,
      p_motivo:     motivo,
    })

    if (error) throw error

    // Evaluar banderas al mismo tiempo
    await supabase.rpc('evaluar_banderas_tercero', {
      p_tercero_id: terceroId,
      p_company_id: companyId,
    })

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Historial de scores de un tercero
export const getHistorialScore = async (terceroId) => {
  try {
    const { companyId } = await getCompanyId()

    const { data, error } = await supabase
      .from('tercero_scoring_log')
      .select('*')
      .eq('tercero_id', terceroId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── BLOQUEOS ──────────────────────────────────────────────────────────────────

export const bloquearTercero = async (terceroId, motivo) => {
  try {
    const { companyId } = await getCompanyId()

    const { data, error } = await supabase
      .from('tercero_relaciones')
      .update({
        bloqueado:     true,
        motivo_bloqueo: motivo,
        bloqueado_at:  new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq('tercero_id', terceroId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const desbloquearTercero = async (terceroId) => {
  try {
    const { companyId } = await getCompanyId()

    const { data, error } = await supabase
      .from('tercero_relaciones')
      .update({
        bloqueado:      false,
        motivo_bloqueo: null,
        bloqueado_at:   null,
        updated_at:     new Date().toISOString(),
      })
      .eq('tercero_id', terceroId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


// ── DIRECCIONES ───────────────────────────────────────────────────────────────

// Crear o actualizar una dirección de un tercero
export const upsertDireccion = async (terceroId, tipoDireccion, datos) => {
  try {
    const { companyId } = await getCompanyId()
    if (!datos || Object.keys(datos).filter(k => datos[k] && k !== 'fuente_csf').length === 0) {
      return { data: null, error: null } // Sin datos — no insertar
    }
    const { data, error } = await supabase
      .from('tercero_direcciones')
      .upsert({
        tercero_id:      terceroId,
        company_id:      companyId,
        tipo:            tipoDireccion,
        codigo_postal:   datos.codigo_postal    || null,
        tipo_vialidad:   datos.tipo_vialidad    || null,
        nombre_vialidad: datos.nombre_vialidad  || null,
        numero_exterior: datos.numero_exterior  || null,
        numero_interior: datos.numero_interior  || null,
        colonia:         datos.colonia          || null,
        localidad:       datos.localidad        || null,
        municipio:       datos.municipio        || null,
        estado:          datos.estado           || null,
        entre_calle:     datos.entre_calle      || null,
        y_calle:         datos.y_calle          || null,
        // Campos compatibilidad hacia atrás (SeccionDireccion antigua)
        calle:           datos.nombre_vialidad  || datos.calle || null,
        fuente_csf:      datos.fuente_csf       ?? false,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'tercero_id,company_id,tipo' })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('[upsertDireccion]', error)
    return { data: null, error }
  }
}

// ── ESTADÍSTICAS DASHBOARD ────────────────────────────────────────────────────

export const getEstadisticasFiscales = async () => {
  try {
    const { companyId } = await getCompanyId()

    const [tercerosRes, banderasRes] = await Promise.all([
      supabase
        .from('tercero_relaciones')
        .select('score_semaforo, tipo, bloqueado, score_fiscal')
        .eq('company_id', companyId)
        .eq('is_active', true),
      supabase
        .from('tercero_banderas')
        .select('nivel_urgencia, tipo_bandera')
        .eq('company_id', companyId)
        .eq('activa', true),
    ])

    const relaciones = tercerosRes.data || []
    const banderas   = banderasRes.data || []

    return {
      data: {
        total:          relaciones.length,
        verdes:         relaciones.filter(r => r.score_semaforo === 'verde').length,
        amarillos:      relaciones.filter(r => r.score_semaforo === 'amarillo').length,
        rojos:          relaciones.filter(r => r.score_semaforo === 'rojo').length,
        bloqueados:     relaciones.filter(r => r.bloqueado).length,
        score_promedio: relaciones.length > 0
          ? Math.round(relaciones.reduce((s, r) => s + (r.score_fiscal || 0), 0) / relaciones.length)
          : 0,
        banderas_criticas: banderas.filter(b => b.nivel_urgencia === 'critica').length,
        banderas_altas:    banderas.filter(b => b.nivel_urgencia === 'alta').length,
        banderas_medias:   banderas.filter(b => b.nivel_urgencia === 'media').length,
        banderas_32d:      banderas.filter(b => b.tipo_bandera.startsWith('32d')).length,
      },
      error: null
    }
  } catch (error) {
    return { data: null, error }
  }
}