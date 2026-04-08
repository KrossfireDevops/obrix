// ============================================================
//  OBRIX ERP — Servicio: Módulo de Gastos
//  src/services/gastos.service.js  |  v1.0
// ============================================================

import { supabase } from '../config/supabase'

const BUCKET_GASTOS = 'gastos-comprobantes'

async function getCtx() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id, full_name, perfil_gasto_id')
    .eq('id', user.id)
    .single()
  return {
    companyId:     data?.company_id,
    userId:        data?.id,
    nombre:        data?.full_name,
    perfilGastoId: data?.perfil_gasto_id,
  }
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES UI
// ─────────────────────────────────────────────────────────────

export const CATEGORIA_CFG = {
  viaticos: {
    label: 'Viáticos',
    emoji: '✈️',
    color:  'bg-blue-100 text-blue-800',
    border: '#BFDBFE',
    bg:     '#EFF6FF',
  },
  operacion_proyecto: {
    label: 'Operación Proyecto',
    emoji: '🔧',
    color:  'bg-orange-100 text-orange-800',
    border: '#FED7AA',
    bg:     '#FFF7ED',
  },
  gastos_generales: {
    label: 'Gastos Generales',
    emoji: '📋',
    color:  'bg-gray-100 text-gray-700',
    border: '#E5E7EB',
    bg:     '#F9FAFB',
  },
  servicios_externos: {
    label: 'Servicios Externos',
    emoji: '🤝',
    color:  'bg-purple-100 text-purple-800',
    border: '#E9D5FF',
    bg:     '#FDF4FF',
  },
}

export const ESTATUS_CFG = {
  borrador:  { label: 'Borrador',    color: 'bg-gray-100 text-gray-600',    dot: '#9CA3AF' },
  pendiente: { label: 'Pendiente',   color: 'bg-amber-100 text-amber-700',  dot: '#F59E0B' },
  aprobado:  { label: 'Aprobado',    color: 'bg-green-100 text-green-700',  dot: '#10B981' },
  rechazado: { label: 'Rechazado',   color: 'bg-red-100 text-red-700',      dot: '#EF4444' },
  pagado:    { label: 'Reembolsado', color: 'bg-teal-100 text-teal-700',    dot: '#14B8A6' },
  cancelado: { label: 'Cancelado',   color: 'bg-gray-100 text-gray-400',    dot: '#D1D5DB' },
}

export const FORMA_PAGO_CFG = {
  caja_chica:          { label: 'Caja chica',         emoji: '💵' },
  tarjeta_corporativa: { label: 'Tarjeta corporativa', emoji: '💳' },
  personal:            { label: 'Gasto personal',      emoji: '👤' },
}

export const DEDUCIBILIDAD_CFG = {
  deducible:             { label: 'Deducible',            color: 'text-green-700', bg: '#F0FDF4' },
  no_deducible:          { label: 'No deducible',         color: 'text-red-700',   bg: '#FEF2F2' },
  parcialmente_deducible:{ label: 'Parcial',              color: 'text-amber-700', bg: '#FFFBEB' },
}

// ─────────────────────────────────────────────────────────────
// 1. PERFIL DE GASTO DEL USUARIO
// ─────────────────────────────────────────────────────────────

export async function getMiPerfilGasto() {
  const { perfilGastoId } = await getCtx()
  if (!perfilGastoId) return null

  const { data, error } = await supabase
    .from('gastos_perfiles')
    .select(`
      *,
      gastos_perfiles_tipos (
        *,
        tipo:tipo_id (
          id, categoria, codigo, nombre, icono,
          requiere_factura_desde, requiere_proyecto,
          cuenta_gasto_codigo, es_deducible_por_defecto
        )
      )
    `)
    .eq('id', perfilGastoId)
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 2. CATÁLOGOS
// ─────────────────────────────────────────────────────────────

export async function getTiposGasto(soloActivos = true) {
  const { companyId } = await getCtx()
  let q = supabase
    .from('gastos_tipos_catalogo')
    .select('*')
    .eq('company_id', companyId)
    .order('categoria')
    .order('orden')
  if (soloActivos) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getTiposGastoParaPerfil(perfilId) {
  const { data, error } = await supabase
    .from('gastos_perfiles_tipos')
    .select(`
      *,
      tipo:tipo_id (
        id, categoria, codigo, nombre, icono,
        requiere_factura_desde, requiere_proyecto,
        cuenta_gasto_codigo, es_deducible_por_defecto
      )
    `)
    .eq('perfil_id', perfilId)
    .eq('is_active', true)
  if (error) throw error
  return data ?? []
}

export async function getGastosNoDeducibles() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('gastos_no_deducibles')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────────────────────
// 3. GASTOS — CRUD
// ─────────────────────────────────────────────────────────────

export async function getMisGastos(filtros = {}) {
  const { companyId, userId } = await getCtx()
  const { estatus, desde, hasta, projectId, categoria } = filtros

  let q = supabase
    .from('gastos_registros')
    .select(`
      *,
      tipo:tipo_id ( nombre, emoji:icono, categoria ),
      proyecto:project_id ( code, name ),
      aprobaciones:gastos_aprobaciones ( nivel, estatus, comentario, respondido_at )
    `)
    .eq('company_id', companyId)
    .eq('usuario_id', userId)
    .order('fecha_gasto', { ascending: false })

  if (estatus)   q = q.eq('estatus', estatus)
  if (categoria) q = q.eq('categoria', categoria)
  if (projectId) q = q.eq('project_id', projectId)
  if (desde)     q = q.gte('fecha_gasto', desde)
  if (hasta)     q = q.lte('fecha_gasto', hasta)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getGastoById(id) {
  const { data, error } = await supabase
    .from('gastos_registros')
    .select(`
      *,
      tipo:tipo_id ( * ),
      proyecto:project_id ( id, code, name ),
      usuario:usuario_id ( id, full_name ),
      perfil:perfil_gasto_id ( nombre ),
      caja:caja_chica_id ( nombre, monto_disponible ),
      tarjeta:tarjeta_id ( alias, ultimos_4, banco ),
      comprobantes:gastos_comprobantes ( * ),
      aprobaciones:gastos_aprobaciones (
        nivel, estatus, comentario, respondido_at,
        aprobador:aprobador_id ( full_name )
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Crear un nuevo gasto en borrador.
 * El sistema calcula automáticamente nivel de aprobación,
 * cuenta contable y deducibilidad.
 */
export async function crearGasto(datos) {
  const { companyId, userId, perfilGastoId } = await getCtx()

  // Calcular nivel de aprobación requerido
  const nivelAprobacion = calcularNivelAprobacionLocal(datos.monto_total)

  // Determinar deducibilidad automática
  const deducibilidad = calcularDeducibilidadLocal(datos)

  const { data, error } = await supabase
    .from('gastos_registros')
    .insert({
      company_id:                companyId,
      usuario_id:                userId,
      perfil_gasto_id:           perfilGastoId,
      tipo_id:                   datos.tipo_id,
      categoria:                 datos.categoria,
      project_id:                datos.project_id      || null,
      centro_costo:              datos.centro_costo    || null,
      wbs_id:                    datos.wbs_id          || null,
      fecha_gasto:               datos.fecha_gasto,
      concepto:                  datos.concepto,
      monto_total:               parseFloat(datos.monto_total),
      monto_iva:                 datos.monto_iva ? parseFloat(datos.monto_iva) : 0,
      moneda:                    datos.moneda          || 'MXN',
      tipo_cambio:               datos.tipo_cambio     || 1,
      forma_pago:                datos.forma_pago,
      caja_chica_id:             datos.caja_chica_id   || null,
      tarjeta_id:                datos.tarjeta_id      || null,
      tiene_factura:             datos.tiene_factura   ?? false,
      cfdi_uuid:                 datos.cfdi_uuid       || null,
      rfc_proveedor:             datos.rfc_proveedor   || null,
      nombre_proveedor:          datos.nombre_proveedor|| null,
      uso_cfdi:                  datos.uso_cfdi        || 'G03',
      deducibilidad,
      monto_no_deducible:        deducibilidad === 'no_deducible' ? parseFloat(datos.monto_total) : 0,
      motivo_no_deducible:       datos.motivo_no_deducible || null,
      cuenta_gasto_id:           datos.cuenta_gasto_id || null,
      cuenta_gasto_codigo:       datos.cuenta_gasto_codigo || null,
      notas:                     datos.notas           || null,
      estatus:                   'borrador',
      nivel_aprobacion_requerido: nivelAprobacion,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarGasto(id, cambios) {
  // Solo se puede actualizar en borrador
  const { data, error } = await supabase
    .from('gastos_registros')
    .update({
      ...cambios,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estatus', 'borrador')  // seguridad: solo borradores
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Enviar gasto para aprobación.
 * Si nivel=0 (automático), aprueba directo y genera póliza.
 */
export async function enviarGasto(id) {
  const { userId } = await getCtx()

  // Obtener el gasto
  const gasto = await getGastoById(id)
  if (!gasto) throw new Error('Gasto no encontrado')
  if (gasto.estatus !== 'borrador') throw new Error('Solo se pueden enviar borradores')

  // Si es aprobación automática (nivel 0)
  if (gasto.nivel_aprobacion_requerido === 0) {
    const { data, error } = await supabase
      .rpc('aprobar_gasto', {
        p_gasto_id:     id,
        p_aprobador_id: userId,
        p_nivel:        0,
        p_comentario:   'Aprobación automática por monto',
      })
    if (error) throw error
    return data
  }

  // Crear registro de aprobación pendiente
  await supabase.from('gastos_aprobaciones').insert({
    gasto_id:    id,
    company_id:  gasto.company_id,
    nivel:       1,
    estatus:     'pendiente',
  })

  // Actualizar estatus a pendiente + folio
  const folio = `GAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5,'0')}`

  const { data, error } = await supabase
    .from('gastos_registros')
    .update({
      estatus:      'pendiente',
      folio,
      enviado_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelarGasto(id, motivo) {
  const { data, error } = await supabase
    .from('gastos_registros')
    .update({
      estatus:     'cancelado',
      notas:       motivo || null,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .in('estatus', ['borrador', 'rechazado'])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 4. APROBACIONES
// ─────────────────────────────────────────────────────────────

export async function getGastosPendientesAprobacion(nivel = null) {
  const { companyId, userId } = await getCtx()

  let q = supabase
    .from('gastos_registros')
    .select(`
      *,
      tipo:tipo_id ( nombre, icono ),
      proyecto:project_id ( code, name ),
      usuario:usuario_id ( id, full_name ),
      aprobaciones:gastos_aprobaciones ( nivel, estatus )
    `)
    .eq('company_id', companyId)
    .eq('estatus', 'pendiente')
    .order('enviado_at', { ascending: true })

  if (nivel) q = q.eq('nivel_aprobacion_requerido', nivel)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function aprobarGasto(gastoId, nivel, comentario = null) {
  const { userId } = await getCtx()
  const { data, error } = await supabase
    .rpc('aprobar_gasto', {
      p_gasto_id:     gastoId,
      p_aprobador_id: userId,
      p_nivel:        nivel,
      p_comentario:   comentario,
    })
  if (error) throw error
  return data
}

export async function rechazarGasto(gastoId, nivel, motivo) {
  const { userId } = await getCtx()
  const { error } = await supabase
    .rpc('rechazar_gasto', {
      p_gasto_id:     gastoId,
      p_aprobador_id: userId,
      p_nivel:        nivel,
      p_motivo:       motivo,
    })
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// 5. COMPROBANTES
// ─────────────────────────────────────────────────────────────

export async function subirComprobante(gastoId, archivo, esfactura = false) {
  const { companyId, userId } = await getCtx()

  const ext       = archivo.name.split('.').pop()
  const timestamp = Date.now()
  const path      = `${companyId}/${gastoId}/${timestamp}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_GASTOS)
    .upload(path, archivo, { contentType: archivo.type, upsert: false })

  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('gastos_comprobantes')
    .insert({
      gasto_id:       gastoId,
      company_id:     companyId,
      nombre_archivo: archivo.name,
      storage_path:   path,
      mime_type:      archivo.type,
      tamanio_bytes:  archivo.size,
      es_factura:     esfactura,
      subido_por:     userId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUrlComprobante(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET_GASTOS)
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

/**
 * Vincula manualmente un CFDI del Buzón Fiscal a un gasto.
 * Pre-llena monto y RFC del proveedor.
 */
export async function vincularCFDI(gastoId, cfdiUuid) {
  // Buscar el CFDI en el buzón fiscal
  const { data: cfdi, error: cfdiError } = await supabase
    .from('cfdi_recibidos')  // tabla del Buzón Fiscal existente
    .select('uuid, total, rfc_emisor, nombre_emisor, fecha')
    .eq('uuid', cfdiUuid)
    .single()

  if (cfdiError || !cfdi) throw new Error('CFDI no encontrado en el Buzón Fiscal')

  // Actualizar el gasto con los datos del CFDI
  const { data, error } = await supabase
    .from('gastos_registros')
    .update({
      cfdi_uuid:       cfdi.uuid,
      rfc_proveedor:   cfdi.rfc_emisor,
      nombre_proveedor: cfdi.nombre_emisor,
      tiene_factura:   true,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', gastoId)
    .select()
    .single()

  if (error) throw error
  return { gasto: data, cfdi }
}

/**
 * Busca CFDIs en el Buzón Fiscal que coincidan con el monto del gasto
 * para sugerirlos como comprobante.
 */
export async function buscarCFDIsCoincidentes(monto, tolerancia = 0.05) {
  const { companyId } = await getCtx()
  const montoMin = monto * (1 - tolerancia)
  const montoMax = monto * (1 + tolerancia)

  const { data, error } = await supabase
    .from('cfdi_recibidos')
    .select('uuid, total, rfc_emisor, nombre_emisor, fecha, concepto')
    .eq('company_id', companyId)
    .gte('total', montoMin)
    .lte('total', montoMax)
    .is('vinculado_gasto_id', null)  // sin vincular aún
    .order('fecha', { ascending: false })
    .limit(5)

  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────────────────────
// 6. CAJAS CHICAS
// ─────────────────────────────────────────────────────────────

export async function getMisCajasChicas() {
  const { userId } = await getCtx()
  const { data, error } = await supabase
    .from('cajas_chicas')
    .select(`
      *,
      proyecto:project_id ( code, name ),
      cuenta:cuenta_contable_id ( codigo, nombre )
    `)
    .eq('usuario_id', userId)
    .eq('estatus', 'activa')
  if (error) throw error
  return data ?? []
}

export async function getCajasChicasAdmin() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('cajas_chicas')
    .select(`
      *,
      usuario:usuario_id ( id, full_name ),
      proyecto:project_id ( code, name ),
      cuenta:cuenta_contable_id ( codigo, nombre )
    `)
    .eq('company_id', companyId)
    .order('estatus')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function crearCajaChica(datos) {
  const { companyId, userId } = await getCtx()
  const { data, error } = await supabase
    .from('cajas_chicas')
    .insert({
      company_id:       companyId,
      usuario_id:       datos.usuario_id || userId,
      project_id:       datos.project_id || null,
      nombre:           datos.nombre,
      monto_fondo:      parseFloat(datos.monto_fondo),
      monto_disponible: parseFloat(datos.monto_fondo),  // inicia igual al fondo
      monto_minimo_reposicion: datos.monto_minimo_reposicion
        ? parseFloat(datos.monto_minimo_reposicion) : null,
      cuenta_contable_id: datos.cuenta_contable_id || null,
    })
    .select()
    .single()
  if (error) throw error

  // Registrar movimiento de apertura
  await supabase.from('cajas_chicas_movimientos').insert({
    caja_id:          data.id,
    company_id:       companyId,
    tipo:             'apertura',
    monto:            parseFloat(datos.monto_fondo),
    saldo_anterior:   0,
    saldo_posterior:  parseFloat(datos.monto_fondo),
    concepto:         'Apertura del fondo',
    registrado_por:   userId,
  })

  return data
}

export async function reponerCajaChica(cajaId, montoReposicion, referencia = null) {
  const { companyId, userId } = await getCtx()

  const { data: caja } = await supabase
    .from('cajas_chicas')
    .select('monto_disponible, monto_fondo')
    .eq('id', cajaId)
    .single()

  const nuevoSaldo = Math.min(
    parseFloat(caja.monto_disponible) + parseFloat(montoReposicion),
    parseFloat(caja.monto_fondo)
  )

  await supabase.from('cajas_chicas_movimientos').insert({
    caja_id:         cajaId,
    company_id:      companyId,
    tipo:            'reposicion',
    monto:           parseFloat(montoReposicion),
    saldo_anterior:  parseFloat(caja.monto_disponible),
    saldo_posterior: nuevoSaldo,
    concepto:        'Reposición de fondo',
    referencia:      referencia || null,
    registrado_por:  userId,
  })
}

export async function getMovimientosCaja(cajaId) {
  const { data, error } = await supabase
    .from('cajas_chicas_movimientos')
    .select('*')
    .eq('caja_id', cajaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────────────────────
// 7. TARJETAS CORPORATIVAS
// ─────────────────────────────────────────────────────────────

export async function getMisTarjetas() {
  const { userId } = await getCtx()
  const { data, error } = await supabase
    .from('tarjetas_corporativas')
    .select('*, cuenta:cuenta_contable_id ( codigo, nombre )')
    .eq('usuario_id', userId)
    .eq('is_active', true)
  if (error) throw error
  return data ?? []
}

export async function getTarjetasAdmin() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('tarjetas_corporativas')
    .select(`
      *,
      usuario:usuario_id ( full_name ),
      proyecto:project_id ( code, name ),
      cuenta:cuenta_contable_id ( codigo, nombre )
    `)
    .eq('company_id', companyId)
    .order('is_active', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ─────────────────────────────────────────────────────────────
// 8. KPIs Y REPORTES
// ─────────────────────────────────────────────────────────────

export async function getKpisGastos(projectId = null, mes = null, anio = null) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase.rpc('get_kpis_gastos', {
    p_company_id: companyId,
    p_project_id: projectId || null,
    p_mes:        mes   ? parseInt(mes)  : null,
    p_anio:       anio  ? parseInt(anio) : null,
  })
  if (error) throw error
  return data?.[0] ?? {}
}

export async function getConsolidadoGastos(desde = null, hasta = null, projectId = null) {
  const { companyId } = await getCtx()
  const hoy   = new Date().toISOString().split('T')[0]
  const inicio = desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0]

  const { data, error } = await supabase.rpc('get_gastos_consolidado', {
    p_company_id: companyId,
    p_desde:      inicio,
    p_hasta:      hasta || hoy,
    p_project_id: projectId || null,
  })
  if (error) throw error
  return data ?? []
}

export async function getReembolsosPendientes() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('gastos_registros')
    .select(`
      id, folio, fecha_gasto, concepto, monto_total, enviado_at,
      usuario:usuario_id ( id, full_name ),
      proyecto:project_id ( code, name )
    `)
    .eq('company_id', companyId)
    .eq('forma_pago', 'personal')
    .eq('estatus', 'aprobado')
    .is('reembolso_pagado_at', null)
    .order('enviado_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function marcarReembolsoPagado(gastoId, referencia) {
  const { data, error } = await supabase
    .from('gastos_registros')
    .update({
      estatus:               'pagado',
      reembolso_aprobado:    true,
      reembolso_pagado_at:   new Date().toISOString(),
      reembolso_referencia:  referencia || null,
      updated_at:            new Date().toISOString(),
    })
    .eq('id', gastoId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 9. CONFIGURACIÓN (Admin)
// ─────────────────────────────────────────────────────────────

export async function getPerfilesGasto() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('gastos_perfiles')
    .select(`
      *,
      gastos_perfiles_tipos (
        id, monto_min, monto_max_por_gasto,
        monto_max_diario, monto_max_semanal,
        aprobacion_automatica_hasta,
        tipo:tipo_id ( nombre, categoria, icono )
      )
    `)
    .eq('company_id', companyId)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function crearPerfil(datos) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('gastos_perfiles')
    .insert({ ...datos, company_id: companyId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarPerfil(id, cambios) {
  const { data, error } = await supabase
    .from('gastos_perfiles')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function upsertLimitePerfil(perfilId, tipoId, limites) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('gastos_perfiles_tipos')
    .upsert({
      perfil_id:  perfilId,
      tipo_id:    tipoId,
      company_id: companyId,
      ...limites,
    }, { onConflict: 'perfil_id,tipo_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function asignarPerfilAUsuario(userId, perfilId) {
  const { data, error } = await supabase
    .from('users_profiles')
    .update({ perfil_gasto_id: perfilId })
    .eq('id', userId)
    .select('id, full_name, perfil_gasto_id')
    .single()
  if (error) throw error
  return data
}

export async function crearTipoGasto(datos) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('gastos_tipos_catalogo')
    .insert({ ...datos, company_id: companyId })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// HELPERS LOCALES
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el nivel de aprobación requerido según el monto.
 * Espeja la función SQL get_nivel_aprobacion().
 */
export function calcularNivelAprobacionLocal(monto) {
  const m = parseFloat(monto)
  if (m < 1000)   return 0   // automático
  if (m < 2000)   return 1   // jefe inmediato
  if (m < 10000)  return 2   // admin-operativo
  return 3                   // director
}

/**
 * Determina deducibilidad según monto y si tiene factura.
 * Regla SAT: sin CFDI >= $1,000 → no deducible.
 */
export function calcularDeducibilidadLocal(datos) {
  const monto = parseFloat(datos.monto_total || 0)
  if (monto >= 1000 && !datos.tiene_factura) return 'no_deducible'
  if (datos.motivo_no_deducible)              return 'no_deducible'
  return 'deducible'
}

/**
 * Formatea moneda en pesos mexicanos.
 */
export function fmtMXN(monto) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2
  }).format(monto || 0)
}
