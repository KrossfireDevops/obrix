// ============================================================
//  OBRIX ERP — Servicio: Gestión de Personal
//  src/services/gestionPersonal.service.js  |  v1.0
// ============================================================

import { supabase } from '../config/supabase'

const BUCKET = 'expedientes-personal'

async function getCtx() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id, full_name')
    .eq('id', user.id)
    .single()
  return { companyId: data?.company_id, userId: data?.id, nombre: data?.full_name }
}

// ============================================================
//  EXPEDIENTE
// ============================================================

export async function getPersonal(filtros = {}) {
  const { companyId } = await getCtx()
  const { tipo, estatus = 'activo', projectId, search } = filtros

  let q = supabase
    .from('personal_expediente')
    .select(`
      *,
      projects!personal_expediente_project_id_fkey(id, code, name),
      personal_asignaciones(id, project_id, es_actual, fecha_inicio,
        projects!personal_asignaciones_project_id_fkey(code, name))
    `)
    .eq('company_id', companyId)
    .order('apellido_paterno')

  if (estatus)    q = q.eq('estatus', estatus)
  if (tipo)       q = q.eq('tipo_personal', tipo)
  if (projectId)  q = q.eq('project_id', projectId)
  if (search)     q = q.ilike('nombre_completo', `%${search}%`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getTrabajador(id) {
  const { data, error } = await supabase
    .from('personal_expediente')
    .select(`
      *,
      projects!personal_expediente_project_id_fkey(id, code, name),
      personal_documentos(*),
      personal_asignaciones(*, projects!personal_asignaciones_project_id_fkey(code, name))
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function crearTrabajador(payload) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('personal_expediente')
    .insert({ ...payload, company_id: companyId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarTrabajador(id, changes) {
  const { data, error } = await supabase
    .from('personal_expediente')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function darDeBajaTrabajador(id, motivo) {
  const { data, error } = await supabase
    .from('personal_expediente')
    .update({
      estatus:    'baja',
      fecha_baja: new Date().toISOString().split('T')[0],
      motivo_baja: motivo,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPersonalKpis() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .rpc('get_personal_kpis', { p_company_id: companyId })
  if (error) throw error
  return data?.[0] ?? {}
}

// ============================================================
//  ASIGNACIONES
// ============================================================

export async function asignarAProyecto({ trabajadorId, projectId, rol, levelId, fechaInicio }) {
  const { companyId } = await getCtx()

  // Cerrar asignación actual si existe
  await supabase
    .from('personal_asignaciones')
    .update({ es_actual: false, fecha_fin: new Date().toISOString().split('T')[0] })
    .eq('trabajador_id', trabajadorId)
    .eq('es_actual', true)

  // Crear nueva asignación
  const { data, error } = await supabase
    .from('personal_asignaciones')
    .insert({
      trabajador_id: trabajadorId,
      project_id:    projectId,
      company_id:    companyId,
      rol,
      level_id:      levelId ?? null,
      fecha_inicio:  fechaInicio ?? new Date().toISOString().split('T')[0],
      es_actual:     true,
    })
    .select()
    .single()
  if (error) throw error

  // Actualizar project_id en expediente
  await supabase
    .from('personal_expediente')
    .update({ project_id: projectId })
    .eq('id', trabajadorId)

  return data
}

// ============================================================
//  PRE-NÓMINA
// ============================================================

export async function getPrenominas(projectId) {
  const { companyId } = await getCtx()
  let q = supabase
    .from('personal_prenomina')
    .select('*, projects!personal_prenomina_project_id_fkey(code, name)')
    .eq('company_id', companyId)
    .order('fecha_inicio', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getPrenominaDetalle(prenominaId) {
  const { data, error } = await supabase
    .from('personal_prenomina')
    .select(`
      *,
      projects!personal_prenomina_project_id_fkey(code, name),
      personal_prenomina_det(
        *,
        personal_expediente(
          id, nombre, apellido_paterno, apellido_materno,
          tipo_personal, especialidad, esquema_pago, foto_url
        )
      )
    `)
    .eq('id', prenominaId)
    .single()
  if (error) throw error
  return data
}

export async function crearPrenomina({ projectId, periodoNombre, fechaInicio, fechaFin, tipoPeriodo }) {
  const { companyId, userId } = await getCtx()
  const { data, error } = await supabase
    .from('personal_prenomina')
    .insert({
      company_id:     companyId,
      project_id:     projectId ?? null,
      periodo_nombre: periodoNombre,
      fecha_inicio:   fechaInicio,
      fecha_fin:      fechaFin,
      tipo_periodo:   tipoPeriodo ?? 'semanal',
      creado_por:     userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Cargar automáticamente los trabajadores activos del proyecto
export async function cargarTrabajadoresEnPrenomina(prenominaId, projectId) {
  const { companyId } = await getCtx()

  const { data: trabajadores } = await supabase
    .from('personal_expediente')
    .select('id, tarifa_diaria, tarifa_destajo, esquema_pago')
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .eq('estatus', 'activo')

  if (!trabajadores?.length) return []

  const rows = trabajadores.map(t => ({
    prenomina_id:             prenominaId,
    trabajador_id:            t.id,
    company_id:               companyId,
    tarifa_diaria_aplicada:   t.tarifa_diaria,
    tarifa_destajo_aplicada:  t.tarifa_destajo,
  }))

  const { data, error } = await supabase
    .from('personal_prenomina_det')
    .upsert(rows, { onConflict: 'prenomina_id,trabajador_id' })
    .select()
  if (error) throw error
  return data
}

export async function actualizarDetallePrenomina(detId, changes) {
  const { data, error } = await supabase
    .from('personal_prenomina_det')
    .update(changes)
    .eq('id', detId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cambiarEstatusPreNomina(prenominaId, estatus, userId) {
  const updates = { estatus }
  if (estatus === 'aprobada') { updates.aprobado_por = userId; updates.aprobado_at = new Date().toISOString() }
  if (estatus === 'pagada')   { updates.pagado_at = new Date().toISOString() }

  const { data, error } = await supabase
    .from('personal_prenomina')
    .update(updates)
    .eq('id', prenominaId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
//  CONSTANTES UI
// ============================================================

export const TIPO_PERSONAL_CFG = {
  planta:         { label: 'Planta',          color: 'bg-blue-100 text-blue-700',   emoji: '👔' },
  temporal:       { label: 'Temporal',         color: 'bg-amber-100 text-amber-700', emoji: '⏳' },
  subcontratista: { label: 'Subcontratista',   color: 'bg-purple-100 text-purple-700',emoji: '🏗️'},
  honorarios:     { label: 'Honorarios',       color: 'bg-teal-100 text-teal-700',   emoji: '📋' },
}

export const ESQUEMA_PAGO_CFG = {
  jornada:    { label: 'Jornada diaria',    emoji: '📅' },
  destajo:    { label: 'Destajo',           emoji: '🔨' },
  mixto:      { label: 'Mixto',             emoji: '⚖️' },
  honorarios: { label: 'Honorarios',        emoji: '📄' },
}

export const ESTATUS_PRENOMINA_CFG = {
  borrador:  { label: 'Borrador',  color: 'bg-gray-100 text-gray-600'     },
  revisión:  { label: 'En revisión',color: 'bg-amber-100 text-amber-700' },
  aprobada:  { label: 'Aprobada',  color: 'bg-blue-100 text-blue-700'    },
  pagada:    { label: 'Pagada ✓',  color: 'bg-green-100 text-green-700'  },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700'      },
}

export const ESPECIALIDADES = [
  'Albañil','Oficial albañil','Ayudante general',
  'Electricista','Plomero','Herrero / Soldador',
  'Carpintero','Pintor','Acabados / Yesero',
  'Operador de maquinaria','Chofer','Vigilante',
  'Maestro de obras','Supervisor','Residente de obra',
  'Otro',
]