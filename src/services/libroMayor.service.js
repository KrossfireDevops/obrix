// ============================================================
//  OBRIX ERP — Servicio: Libro Mayor / Pólizas
//  Archivo: src/services/libroMayor.service.js
//  Versión: 1.0 | Marzo 2026
// ============================================================

import { supabase } from '../config/supabase'

// ── Helper company_id ────────────────────────────────────────
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
//  CATÁLOGO DE CUENTAS
// ============================================================

export async function getCuentas(soloActivas = true) {
  const { companyId } = await getCompanyId()
  let query = supabase
    .from('cuentas_contables')
    .select('*')
    .eq('company_id', companyId)
    .order('codigo')
  if (soloActivas) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCuentasArbol() {
  const cuentas = await getCuentas()
  // Construir árbol jerárquico
  const mapa = {}
  cuentas.forEach(c => { mapa[c.id] = { ...c, hijos: [] } })
  const raices = []
  cuentas.forEach(c => {
    if (c.cuenta_padre_id && mapa[c.cuenta_padre_id]) {
      mapa[c.cuenta_padre_id].hijos.push(mapa[c.id])
    } else if (!c.cuenta_padre_id) {
      raices.push(mapa[c.id])
    }
  })
  return raices
}

export async function upsertCuenta(cuenta) {
  const { companyId } = await getCompanyId()
  const { data, error } = await supabase
    .from('cuentas_contables')
    .upsert({ ...cuenta, company_id: companyId }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleCuenta(id, isActive) {
  const { error } = await supabase
    .from('cuentas_contables')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw error
}

// ============================================================
//  LIBRO MAYOR — SALDOS
// ============================================================

export async function getSaldosCuentas(fechaDesde, fechaHasta) {
  const { companyId } = await getCompanyId()
  // Traer asientos con sus pólizas en el período
  const { data, error } = await supabase
    .from('asientos')
    .select(`
      tipo_movimiento, monto, deducible,
      cuentas_contables(id, codigo, nombre, tipo, naturaleza, nivel, deducible),
      polizas!inner(fecha, estatus, company_id)
    `)
    .eq('polizas.company_id', companyId)
    .eq('polizas.estatus', 'aplicada')
    .gte('polizas.fecha', fechaDesde)
    .lte('polizas.fecha', fechaHasta)
  if (error) throw error

  // Agrupar por cuenta
  const saldos = {}
  ;(data ?? []).forEach(a => {
    const c = a.cuentas_contables
    if (!c) return
    if (!saldos[c.id]) {
      saldos[c.id] = {
        ...c,
        total_cargos: 0,
        total_abonos: 0,
        saldo: 0,
      }
    }
    if (a.tipo_movimiento === 'cargo')  saldos[c.id].total_cargos += Number(a.monto)
    if (a.tipo_movimiento === 'abono')  saldos[c.id].total_abonos += Number(a.monto)
  })

  // Calcular saldo según naturaleza
  Object.values(saldos).forEach(s => {
    s.saldo = s.naturaleza === 'deudora'
      ? s.total_cargos - s.total_abonos
      : s.total_abonos - s.total_cargos
  })

  return Object.values(saldos).sort((a, b) => a.codigo.localeCompare(b.codigo))
}

export async function getMovimientosCuenta(cuentaId, fechaDesde, fechaHasta) {
  const { companyId } = await getCompanyId()
  const { data, error } = await supabase
    .from('asientos')
    .select(`
      *,
      polizas!inner(id, folio, tipo, fecha, concepto, estatus, company_id,
        terceros(razon_social))
    `)
    .eq('cuenta_id', cuentaId)
    .eq('polizas.company_id', companyId)
    .eq('polizas.estatus', 'aplicada')
    .gte('polizas.fecha', fechaDesde)
    .lte('polizas.fecha', fechaHasta)
    .order('polizas(fecha)', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ============================================================
//  PÓLIZAS
// ============================================================

export async function getPolizas(filtros = {}) {
  const { companyId } = await getCompanyId()
  const {
    tipo, estatus, fecha_desde, fecha_hasta,
    tercero_id, project_id, tiene_no_deducible,
    page = 1, pageSize = 50
  } = filtros

  let query = supabase
    .from('polizas')
    .select(`
      id, folio, tipo, fecha, concepto, estatus,
      total_cargos, total_abonos, diferencia,
      tiene_no_deducible, monto_no_deducible, origen,
      uuid_cfdi, aplicada_at,
      terceros(razon_social, rfc),
      projects(name),
      cfdi_documentos(uuid_cfdi, tipo_comprobante)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .order('fecha', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (tipo)               query = query.eq('tipo', tipo)
  if (estatus)            query = query.eq('estatus', estatus)
  if (fecha_desde)        query = query.gte('fecha', fecha_desde)
  if (fecha_hasta)        query = query.lte('fecha', fecha_hasta)
  if (tercero_id)         query = query.eq('tercero_id', tercero_id)
  if (project_id)         query = query.eq('project_id', project_id)
  if (tiene_no_deducible) query = query.eq('tiene_no_deducible', true)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function getPolizaDetalle(polizaId) {
  const { data, error } = await supabase
    .from('polizas')
    .select(`
      *,
      terceros(id, razon_social, rfc),
      projects(id, name),
      cfdi_documentos(uuid_cfdi, emisor_rfc, emisor_nombre, total, fecha_emision),
      asientos(
        *,
        cuentas_contables(id, codigo, nombre, tipo, naturaleza, deducible)
      )
    `)
    .eq('id', polizaId)
    .single()
  if (error) throw error
  return data
}

export async function crearPoliza(poliza) {
  const { companyId, userId } = await getCompanyId()
  const folio = await generateFolioLocal(companyId, poliza.tipo)
  const { data, error } = await supabase
    .from('polizas')
    .insert({
      ...poliza,
      company_id: companyId,
      folio,
      estatus:    'borrador',
      origen:     'manual',
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarPoliza(id, cambios) {
  const { data, error } = await supabase
    .from('polizas')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function aplicarPoliza(id) {
  const { userId } = await getCompanyId()
  // Verificar que esté cuadrada antes de aplicar
  const { data: pol } = await supabase
    .from('polizas').select('diferencia, total_cargos').eq('id', id).single()
  if (Math.abs(Number(pol?.diferencia ?? 1)) > 0.01) {
    throw new Error(`La póliza no está cuadrada. Diferencia: ${pol?.diferencia}`)
  }
  const { data, error } = await supabase
    .from('polizas')
    .update({ estatus: 'aplicada', aplicada_at: new Date().toISOString(), aplicada_por: userId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelarPoliza(id, motivo) {
  const { userId } = await getCompanyId()
  const { data, error } = await supabase
    .from('polizas')
    .update({
      estatus: 'cancelada',
      cancelada_at: new Date().toISOString(),
      cancelada_por: userId,
      motivo_cancelacion: motivo,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Generar póliza automática desde CFDI (llama a la función SQL)
export async function generarPolizaDesdeCfdi(cfdiId) {
  const { companyId, userId } = await getCompanyId()
  const { data, error } = await supabase.rpc('generar_poliza_desde_cfdi', {
    p_cfdi_id:    cfdiId,
    p_company_id: companyId,
    p_creado_por: userId,
  })
  if (error) throw error
  return data  // Retorna el UUID de la póliza creada
}

// ============================================================
//  ASIENTOS
// ============================================================

export async function upsertAsientos(polizaId, asientos) {
  const { companyId } = await getCompanyId()
  // Borrar asientos existentes y reinsertar
  await supabase.from('asientos').delete().eq('poliza_id', polizaId)
  if (!asientos.length) return []
  const rows = asientos.map((a, i) => ({
    ...a,
    poliza_id:  polizaId,
    company_id: companyId,
    linea:      i + 1,
  }))
  const { data, error } = await supabase.from('asientos').insert(rows).select()
  if (error) throw error
  return data
}

// ============================================================
//  PRESUPUESTOS
// ============================================================

export async function getPresupuestos(año, projectId = null) {
  const { companyId } = await getCompanyId()
  let query = supabase
    .from('presupuestos_contables')
    .select(`
      *,
      cuentas_contables(codigo, nombre, tipo, es_presupuestable),
      projects(name)
    `)
    .eq('company_id', companyId)
    .eq('periodo_año', año)
    .order('periodo_mes')

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function upsertPresupuesto(presupuesto) {
  const { companyId } = await getCompanyId()
  const { data, error } = await supabase
    .from('presupuestos_contables')
    .upsert({
      ...presupuesto,
      company_id: companyId,
    }, { onConflict: 'company_id,cuenta_id,project_id,periodo_año,periodo_mes' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getResumenPresupuestal(año, projectId = null) {
  const { companyId } = await getCompanyId()
  let query = supabase
    .from('presupuestos_contables')
    .select(`
      cuenta_id, periodo_mes,
      monto_presupuestado, monto_ejercido,
      monto_comprometido, monto_disponible,
      porcentaje_ejercido, alerta_pct,
      cuentas_contables(codigo, nombre, tipo)
    `)
    .eq('company_id', companyId)
    .eq('periodo_año', año)

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error

  // Agrupar por cuenta (suma de todos los meses)
  const resumen = {}
  ;(data ?? []).forEach(p => {
    const k = p.cuenta_id
    if (!resumen[k]) {
      resumen[k] = {
        cuenta_id: k,
        cuenta: p.cuentas_contables,
        presupuestado: 0, ejercido: 0, comprometido: 0, disponible: 0,
        pct: 0, alerta: false, meses: {}
      }
    }
    resumen[k].presupuestado += Number(p.monto_presupuestado)
    resumen[k].ejercido      += Number(p.monto_ejercido)
    resumen[k].comprometido  += Number(p.monto_comprometido)
    resumen[k].disponible    += Number(p.monto_disponible)
    if (p.periodo_mes) resumen[k].meses[p.periodo_mes] = p
  })

  Object.values(resumen).forEach(r => {
    r.pct    = r.presupuestado > 0 ? Math.round((r.ejercido / r.presupuestado) * 100) : 0
    r.alerta = r.pct >= (data.find(p => p.cuenta_id === r.cuenta_id)?.alerta_pct ?? 80)
  })

  return Object.values(resumen).sort((a, b) =>
    (a.cuenta?.codigo ?? '').localeCompare(b.cuenta?.codigo ?? '')
  )
}

// ============================================================
//  UTILIDADES
// ============================================================

async function generateFolioLocal(companyId, tipo) {
  // Fallback si la función SQL no está disponible
  const prefijos = { ingreso:'I', egreso:'E', diario:'D', cheque:'C', presupuesto:'P' }
  const año = new Date().getFullYear()
  const { count } = await supabase
    .from('polizas')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('tipo', tipo)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `${prefijos[tipo] ?? 'X'}-${año}-${seq}`
}

export const TIPO_POLIZA_LABEL = {
  ingreso:     'Ingreso',
  egreso:      'Egreso',
  diario:      'Diario',
  cheque:      'Cheque',
  presupuesto: 'Presupuesto',
}

export const TIPO_POLIZA_COLOR = {
  ingreso:     { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   },
  egreso:      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  diario:      { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  cheque:      { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  },
  presupuesto: { bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200'   },
}

export const ESTATUS_POLIZA_COLOR = {
  borrador:  { bg: 'bg-gray-100',   text: 'text-gray-600'   },
  aplicada:  { bg: 'bg-green-100',  text: 'text-green-700'  },
  cancelada: { bg: 'bg-red-100',    text: 'text-red-700'    },
}

export function formatMXN(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2
  }).format(n)
}

export function formatFecha(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function getRango30Dias() {
  const hoy = new Date()
  const ini = new Date(); ini.setDate(hoy.getDate() - 30)
  return {
    desde: ini.toISOString().split('T')[0],
    hasta: hoy.toISOString().split('T')[0],
  }
}

export function getMesActual() {
  const hoy = new Date()
  return {
    desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0],
    hasta: hoy.toISOString().split('T')[0],
    año:   hoy.getFullYear(),
    mes:   hoy.getMonth() + 1,
  }
}
