// ============================================================
//  OBRIX ERP — Servicio: Programa de Obra
//  src/services/programaObra.service.js  |  v1.0
//
//  Cubre:
//    · Calendarios laborales (CRUD + días + excepciones)
//    · Asignación de calendario a proyecto
//    · Motor de programación (RPC calcular_programa_obra)
//    · Datos del Gantt (RPC get_gantt_data)
//    · Dependencias entre actividades
//    · Captura de avance real
//    · Asignación de personal a actividades
//    · Cuadrillas planeadas
//    · Alertas y KPIs
// ============================================================

import { supabase } from '../config/supabase'

// ─────────────────────────────────────────────────────────────
// HELPER: contexto del usuario
// ─────────────────────────────────────────────────────────────
async function getCtx() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id, full_name')
    .eq('id', user.id)
    .single()
  return { companyId: data?.company_id, userId: data?.id }
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES UI
// ─────────────────────────────────────────────────────────────

export const DIAS_SEMANA = [
  { dow: 1, label: 'Lunes',     short: 'Lun' },
  { dow: 2, label: 'Martes',    short: 'Mar' },
  { dow: 3, label: 'Miércoles', short: 'Mié' },
  { dow: 4, label: 'Jueves',    short: 'Jue' },
  { dow: 5, label: 'Viernes',   short: 'Vie' },
  { dow: 6, label: 'Sábado',    short: 'Sáb' },
  { dow: 0, label: 'Domingo',   short: 'Dom' },
]

export const SEMAFORO_CFG = {
  verde:     { label: 'En tiempo',   color: '#065F46', bg: '#D1FAE5', border: '#6EE7B7', dot: '#10B981' },
  amber:     { label: 'Atención',    color: '#B45309', bg: '#FEF9C3', border: '#FDE68A', dot: '#F59E0B' },
  rojo:      { label: 'Crítico',     color: '#991B1B', bg: '#FEE2E2', border: '#FECACA', dot: '#EF4444' },
  sin_inicio:{ label: 'Sin iniciar', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', dot: '#9CA3AF' },
}

export const TIPO_DEP_CFG = {
  FS: { label: 'Fin → Inicio',    desc: 'B empieza cuando A termina (más común)' },
  SS: { label: 'Inicio → Inicio', desc: 'B empieza cuando A empieza' },
  FF: { label: 'Fin → Fin',       desc: 'B termina cuando A termina' },
  SF: { label: 'Inicio → Fin',    desc: 'B termina cuando A empieza (raro)' },
}

// ─────────────────────────────────────────────────────────────
// 1. CALENDARIOS LABORALES
// ─────────────────────────────────────────────────────────────

export async function getCalendarios() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('work_calendars')
    .select(`
      *,
      work_calendar_days ( dow, es_habil, hora_inicio, hora_fin ),
      work_calendar_exceptions ( id, fecha, tipo, descripcion, es_habil )
    `)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('es_general', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCalendarioGeneral() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('work_calendars')
    .select(`
      *,
      work_calendar_days ( dow, es_habil, hora_inicio, hora_fin ),
      work_calendar_exceptions ( id, fecha, tipo, descripcion, es_habil )
    `)
    .eq('company_id', companyId)
    .eq('es_general', true)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export async function crearCalendario(datos) {
  const { companyId, userId } = await getCtx()

  // Si se marca como general, quitar el flag a los demás
  if (datos.es_general) {
    await supabase
      .from('work_calendars')
      .update({ es_general: false })
      .eq('company_id', companyId)
  }

  const { data, error } = await supabase
    .from('work_calendars')
    .insert({
      company_id:   companyId,
      nombre:       datos.nombre,
      descripcion:  datos.descripcion  || null,
      es_general:   datos.es_general   ?? false,
      hora_inicio:  datos.hora_inicio  || '08:00',
      hora_fin:     datos.hora_fin     || '17:00',
    })
    .select()
    .single()
  if (error) throw error

  // Insertar días de la semana
  if (datos.dias?.length) {
    const rows = datos.dias.map(d => ({
      calendar_id: data.id,
      dow:         d.dow,
      es_habil:    d.es_habil,
      hora_inicio: d.hora_inicio || null,
      hora_fin:    d.hora_fin    || null,
    }))
    await supabase.from('work_calendar_days').insert(rows)
  } else {
    // Default: Lun-Sáb hábil, Dom inhábil
    const defaultDays = [0,1,2,3,4,5,6].map(dow => ({
      calendar_id: data.id,
      dow,
      es_habil: dow !== 0,
    }))
    await supabase.from('work_calendar_days').insert(defaultDays)
  }

  return data
}

export async function actualizarCalendario(id, cambios) {
  const { companyId } = await getCtx()

  if (cambios.es_general) {
    await supabase
      .from('work_calendars')
      .update({ es_general: false })
      .eq('company_id', companyId)
      .neq('id', id)
  }

  const { data, error } = await supabase
    .from('work_calendars')
    .update({
      nombre:      cambios.nombre,
      descripcion: cambios.descripcion || null,
      es_general:  cambios.es_general  ?? false,
      hora_inicio: cambios.hora_inicio,
      hora_fin:    cambios.hora_fin,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  // Actualizar días si vienen
  if (cambios.dias?.length) {
    await supabase.from('work_calendar_days').delete().eq('calendar_id', id)
    const rows = cambios.dias.map(d => ({
      calendar_id: id,
      dow:         d.dow,
      es_habil:    d.es_habil,
      hora_inicio: d.hora_inicio || null,
      hora_fin:    d.hora_fin    || null,
    }))
    await supabase.from('work_calendar_days').insert(rows)
  }

  return data
}

export async function eliminarCalendario(id) {
  const { error } = await supabase
    .from('work_calendars')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// 2. EXCEPCIONES DEL CALENDARIO
// ─────────────────────────────────────────────────────────────

export async function agregarExcepcion(calendarId, excepcion) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('work_calendar_exceptions')
    .upsert({
      calendar_id:  calendarId,
      company_id:   companyId,
      fecha:        excepcion.fecha,
      tipo:         excepcion.tipo        || 'festivo',
      descripcion:  excepcion.descripcion || null,
      es_habil:     excepcion.es_habil    ?? false,
      hora_inicio:  excepcion.hora_inicio || null,
      hora_fin:     excepcion.hora_fin    || null,
    }, { onConflict: 'calendar_id,fecha' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarExcepcion(excepcionId) {
  const { error } = await supabase
    .from('work_calendar_exceptions')
    .delete()
    .eq('id', excepcionId)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// 3. CALENDARIO DE PROYECTO
// ─────────────────────────────────────────────────────────────

export async function getCalendarioProyecto(projectId) {
  const { data, error } = await supabase
    .from('project_calendars')
    .select('*, work_calendars ( id, nombre, hora_inicio, hora_fin )')
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function asignarCalendarioProyecto(projectId, calendarId) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('project_calendars')
    .upsert({
      project_id:  projectId,
      company_id:  companyId,
      calendar_id: calendarId || null,
    }, { onConflict: 'project_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 4. MOTOR DE PROGRAMACIÓN
// ─────────────────────────────────────────────────────────────

/**
 * Llama al motor SQL que genera fechas para todo el WBS.
 * Retorna el número de nodos procesados.
 */
export async function calcularProgramaObra(projectId, forzar = false) {
  const { data, error } = await supabase
    .rpc('calcular_programa_obra', {
      p_project_id: projectId,
      p_forzar:     forzar,
    })
  if (error) throw error
  return data  // número de nodos procesados
}

/**
 * Recalcula el semáforo de todos los nodos del proyecto.
 * Llamar después de capturar avance real.
 */
export async function recalcularAlertas(projectId) {
  const { data, error } = await supabase
    .rpc('recalcular_alertas_obra', { p_project_id: projectId })
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 5. DATOS DEL GANTT
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene todos los datos necesarios para renderizar el Gantt.
 * Jerarquía WBS + fechas plan/adj + avance + semáforo + cuadrilla.
 */
export async function getGanttData(projectId) {
  const { data, error } = await supabase
    .rpc('get_gantt_data', { p_project_id: projectId })
  if (error) throw error
  return data ?? []
}

/**
 * Ajusta las fechas de un nodo (drag & drop en el Gantt).
 * Guarda en obra_programa.fecha_inicio_adj y fecha_fin_adj.
 */
export async function ajustarFechasNodo(projectId, wbsId, fechaInicio, fechaFin) {
  const { userId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_programa')
    .update({
      fecha_inicio_adj: fechaInicio,
      fecha_fin_adj:    fechaFin,
      duracion_dias_adj: null,  // se recalculará
      ajustado_at:      new Date().toISOString(),
      ajustado_por:     userId,
    })
    .eq('project_id', projectId)
    .eq('wbs_id', wbsId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Resetea los ajustes manuales de un nodo — vuelve al plan calculado.
 */
export async function resetearAjusteNodo(projectId, wbsId) {
  const { data, error } = await supabase
    .from('obra_programa')
    .update({
      fecha_inicio_adj:  null,
      fecha_fin_adj:     null,
      duracion_dias_adj: null,
      ajustado_at:       null,
      ajustado_por:      null,
    })
    .eq('project_id', projectId)
    .eq('wbs_id', wbsId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 6. DEPENDENCIAS ENTRE ACTIVIDADES
// ─────────────────────────────────────────────────────────────

export async function getDependencias(projectId) {
  const { data, error } = await supabase
    .from('obra_dependencias')
    .select(`
      *,
      predecesor:predecesor_id ( id, nombre, codigo ),
      sucesor:sucesor_id       ( id, nombre, codigo )
    `)
    .eq('project_id', projectId)
  if (error) throw error
  return data ?? []
}

export async function crearDependencia(projectId, predId, sucId, tipo = 'FS', lag = 0) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_dependencias')
    .insert({
      project_id:   projectId,
      company_id:   companyId,
      predecesor_id: predId,
      sucesor_id:    sucId,
      tipo,
      lag_dias:      lag,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarDependencia(depId) {
  const { error } = await supabase
    .from('obra_dependencias')
    .delete()
    .eq('id', depId)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// 7. CAPTURA DE AVANCE REAL
// ─────────────────────────────────────────────────────────────

export async function getAvancesReales(projectId, wbsId = null) {
  let q = supabase
    .from('obra_avance_real')
    .select('*, registrado_por:registrado_por ( full_name )')
    .eq('project_id', projectId)
    .order('fecha_corte', { ascending: false })

  if (wbsId) q = q.eq('wbs_id', wbsId)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function registrarAvance(projectId, wbsId, datos) {
  const { companyId, userId } = await getCtx()

  const { data, error } = await supabase
    .from('obra_avance_real')
    .insert({
      project_id:      projectId,
      wbs_id:          wbsId,
      company_id:      companyId,
      fecha_corte:     datos.fecha_corte || new Date().toISOString().split('T')[0],
      pct_avance:      parseFloat(datos.pct_avance),
      pct_avance_plan: datos.pct_avance_plan ? parseFloat(datos.pct_avance_plan) : null,
      unidad_medida:   datos.unidad_medida   || null,
      cantidad_real:   datos.cantidad_real   ? parseFloat(datos.cantidad_real) : null,
      cantidad_plan:   datos.cantidad_plan   ? parseFloat(datos.cantidad_plan) : null,
      personas_dia:    datos.personas_dia    ? parseInt(datos.personas_dia) : null,
      notas:           datos.notas          || null,
      registrado_por:  userId,
    })
    .select()
    .single()

  if (error) throw error

  // Sincronizar pct_avance en project_wbs
  await supabase
    .from('project_wbs')
    .update({ pct_avance: parseFloat(datos.pct_avance), updated_at: new Date().toISOString() })
    .eq('id', wbsId)

  return data
}

// ─────────────────────────────────────────────────────────────
// 8. CUADRILLAS PLANEADAS
// ─────────────────────────────────────────────────────────────

export async function getCuadrilla(projectId, wbsId) {
  const { data, error } = await supabase
    .from('obra_cuadrillas')
    .select('*')
    .eq('project_id', projectId)
    .eq('wbs_id', wbsId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertCuadrilla(projectId, wbsId, datos) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_cuadrillas')
    .upsert({
      project_id:      projectId,
      wbs_id:          wbsId,
      company_id:      companyId,
      disciplina_id:   datos.disciplina_id    || null,
      personas_plan:   parseInt(datos.personas_plan) || 1,
      rendimiento_std: datos.rendimiento_std  ? parseFloat(datos.rendimiento_std) : null,
      unidad_medida:   datos.unidad_medida    || null,
    }, { onConflict: 'project_id,wbs_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 9. ASIGNACIÓN DE PERSONAL A ACTIVIDADES
// ─────────────────────────────────────────────────────────────

export async function getPersonalAsignado(wbsId) {
  const { data, error } = await supabase
    .from('obra_asig_personal')
    .select(`
      *,
      trabajador:trabajador_id (
        id, nombre_completo, tipo_personal, especialidad
      )
    `)
    .eq('wbs_id', wbsId)
    .or('fecha_fin.is.null,fecha_fin.gte.' + new Date().toISOString().split('T')[0])
    .order('es_lider', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function asignarPersonalActividad(projectId, wbsId, trabajadorId, datos = {}) {
  const { companyId, userId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_asig_personal')
    .insert({
      project_id:    projectId,
      wbs_id:        wbsId,
      trabajador_id: trabajadorId,
      company_id:    companyId,
      fecha_inicio:  datos.fecha_inicio || new Date().toISOString().split('T')[0],
      fecha_fin:     datos.fecha_fin    || null,
      es_lider:      datos.es_lider     ?? false,
      rol_actividad: datos.rol_actividad || null,
      notas:         datos.notas        || null,
      asignado_por:  userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function retirarPersonalActividad(asigId, fechaFin = null) {
  const { data, error } = await supabase
    .from('obra_asig_personal')
    .update({
      fecha_fin:  fechaFin || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', asigId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 10. KPIs Y ALERTAS
// ─────────────────────────────────────────────────────────────

export async function getKpisPrograma(projectId) {
  const { data, error } = await supabase
    .rpc('get_kpis_programa', { p_project_id: projectId })
  if (error) throw error
  return data?.[0] ?? {}
}

export async function getAlertasActivas(projectId) {
  const { data, error } = await supabase
    .from('obra_alertas')
    .select(`
      *,
      nodo:wbs_id ( id, nombre, codigo, nivel_profundidad )
    `)
    .eq('project_id', projectId)
    .eq('fecha_calculo', new Date().toISOString().split('T')[0])
    .in('semaforo', ['amber', 'rojo'])
    .order('dias_atraso', { ascending: false })
  if (error) throw error
  return data ?? []
}
