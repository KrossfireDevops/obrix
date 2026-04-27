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

/**
 * Clona un calendario existente como base para uno personalizado.
 * Copia días y excepciones. El clon NO es general por defecto.
 */
export async function clonarCalendario(calendarId, nuevoNombre) {
  const { companyId } = await getCtx()

  // Leer calendario original completo
  const { data: original, error: errOrig } = await supabase
    .from('work_calendars')
    .select(`*, work_calendar_days(*), work_calendar_exceptions(*)`)
    .eq('id', calendarId)
    .single()
  if (errOrig) throw errOrig

  // Crear nuevo calendario sin es_general
  const { data: nuevo, error: errNuevo } = await supabase
    .from('work_calendars')
    .insert({
      company_id:  companyId,
      nombre:      nuevoNombre || `${original.nombre} (copia)`,
      descripcion: original.descripcion,
      es_general:  false,
      hora_inicio: original.hora_inicio,
      hora_fin:    original.hora_fin,
    })
    .select()
    .single()
  if (errNuevo) throw errNuevo

  // Copiar días
  if (original.work_calendar_days?.length) {
    const dias = original.work_calendar_days.map(d => ({
      calendar_id: nuevo.id,
      dow:         d.dow,
      es_habil:    d.es_habil,
      hora_inicio: d.hora_inicio,
      hora_fin:    d.hora_fin,
    }))
    await supabase.from('work_calendar_days').insert(dias)
  }

  // Copiar excepciones (sin project_id — aplica al nuevo calendario)
  if (original.work_calendar_exceptions?.length) {
    const excs = original.work_calendar_exceptions.map(e => ({
      calendar_id: nuevo.id,
      company_id:  companyId,
      fecha:       e.fecha,
      tipo:        e.tipo,
      descripcion: e.descripcion,
      es_habil:    e.es_habil,
      hora_inicio: e.hora_inicio,
      hora_fin:    e.hora_fin,
    }))
    await supabase.from('work_calendar_exceptions').insert(excs)
  }

  return nuevo
}

/**
 * Precarga los días festivos oficiales de México (Ley Federal del Trabajo)
 * para el año indicado en el calendario dado.
 * Art. 74 LFT + festivos opcionales de uso común en construcción.
 */
export async function precargarFestivosLFT(calendarId, año = new Date().getFullYear()) {
  const { companyId } = await getCtx()

  // ── Festivos obligatorios Art. 74 LFT ──────────────────────
  const festivos = [
    { fecha: `${año}-01-01`, descripcion: 'Año Nuevo',                           tipo: 'festivo' },
    { fecha: `${año}-02-03`, descripcion: 'Día de la Constitución (1er lunes Feb)', tipo: 'festivo' },
    { fecha: `${año}-03-17`, descripcion: 'Natalicio Benito Juárez (3er lunes Mar)', tipo: 'festivo' },
    { fecha: `${año}-05-01`, descripcion: 'Día del Trabajo',                     tipo: 'festivo' },
    { fecha: `${año}-09-16`, descripcion: 'Día de la Independencia',             tipo: 'festivo' },
    { fecha: `${año}-11-17`, descripcion: 'Revolución Mexicana (3er lunes Nov)', tipo: 'festivo' },
    { fecha: `${año}-12-25`, descripcion: 'Navidad',                             tipo: 'festivo' },
    // Elecciones (cada 3 y 6 años — se agrega manualmente cuando aplique)
  ]

  // ── Festivos opcionales comunes en construcción ─────────────
  const optativos = [
    { fecha: `${año}-04-17`, descripcion: 'Jueves Santo (tradicional)',          tipo: 'festivo' },
    { fecha: `${año}-04-18`, descripcion: 'Viernes Santo',                       tipo: 'festivo' },
    { fecha: `${año}-11-01`, descripcion: 'Día de Todos Santos',                 tipo: 'festivo' },
    { fecha: `${año}-11-02`, descripcion: 'Día de Muertos',                     tipo: 'festivo' },
    { fecha: `${año}-12-12`, descripcion: 'Día de la Virgen de Guadalupe',       tipo: 'festivo' },
  ]

  const todos = [...festivos, ...optativos].map(f => ({
    calendar_id:        calendarId,
    company_id:         companyId,
    fecha:              f.fecha,
    tipo:               f.tipo,
    descripcion:        f.descripcion,
    es_habil:           false,
    aplica_todas_obras: true,
  }))

  // Upsert para no duplicar si se llama varias veces
  const { error } = await supabase
    .from('work_calendar_exceptions')
    .upsert(todos, { onConflict: 'calendar_id,fecha', ignoreDuplicates: true })

  if (error) throw error
  return todos.length
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

// ─────────────────────────────────────────────────────────────
// 11. DEPENDENCIAS — CRUD + APLICAR ESTÁNDAR
// ─────────────────────────────────────────────────────────────

/**
 * Aplica las dependencias estándar CIVIL+ELECT a un proyecto nuevo.
 * Se llama desde ProjectWizard después de clonarWbsDesdeSistema.
 */
export async function aplicarDependenciasStd(projectId) {
  const { data, error } = await supabase
    .rpc('aplicar_dependencias_std', { p_project_id: projectId })
  if (error) throw error
  return data ?? 0
}

/**
 * Obtiene todas las dependencias de un proyecto con nombres de nodos.
 */
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

/**
 * Obtiene dependencias de un nodo específico (como predecesor o sucesor).
 */
export async function getDependenciasNodo(projectId, wbsId) {
  const { data, error } = await supabase
    .from('obra_dependencias')
    .select(`
      *,
      predecesor:predecesor_id ( id, nombre, codigo ),
      sucesor:sucesor_id       ( id, nombre, codigo )
    `)
    .eq('project_id', projectId)
    .or(`predecesor_id.eq.${wbsId},sucesor_id.eq.${wbsId}`)
  if (error) throw error
  return data ?? []
}

export async function crearDependencia(projectId, predId, sucId, tipo = 'FS', lag = 0) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_dependencias')
    .insert({
      project_id:    projectId,
      company_id:    companyId,
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

export async function actualizarDependencia(depId, tipo, lag) {
  const { data, error } = await supabase
    .from('obra_dependencias')
    .update({ tipo, lag_dias: lag })
    .eq('id', depId)
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
// 12. MAQUINARIA — CATÁLOGO Y ASIGNACIÓN
// ─────────────────────────────────────────────────────────────

export async function getMaquinariaCatalogo() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_maquinaria_catalogo')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('tipo', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertMaquinariaCatalogo(datos) {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_maquinaria_catalogo')
    .upsert({
      ...datos,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMaquinariaAsignada(projectId, wbsId) {
  const { data, error } = await supabase
    .from('obra_asig_maquinaria')
    .select(`
      *,
      maquinaria:maquinaria_id (
        id, nombre, tipo, costo_hora, unidad_cobro
      )
    `)
    .eq('project_id', projectId)
    .eq('wbs_id', wbsId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function asignarMaquinaria(projectId, wbsId, datos) {
  const { companyId, userId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_asig_maquinaria')
    .insert({
      project_id:          projectId,
      wbs_id:              wbsId,
      company_id:          companyId,
      maquinaria_id:       datos.maquinaria_id,
      fecha_inicio:        datos.fecha_inicio || null,
      fecha_fin:           datos.fecha_fin    || null,
      horas_dia:           parseFloat(datos.horas_dia) || 8,
      cantidad:            parseInt(datos.cantidad)    || 1,
      costo_hora_override: datos.costo_hora_override
                             ? parseFloat(datos.costo_hora_override) : null,
      notas:               datos.notas        || null,
      asignado_por:        userId,
    })
    .select(`*, maquinaria:maquinaria_id(id, nombre, tipo, costo_hora, unidad_cobro)`)
    .single()
  if (error) throw error
  return data
}

export async function retirarMaquinaria(asigId) {
  const { error } = await supabase
    .from('obra_asig_maquinaria')
    .delete()
    .eq('id', asigId)
  if (error) throw error
}

export async function actualizarMaquinariaAsig(asigId, cambios) {
  const { data, error } = await supabase
    .from('obra_asig_maquinaria')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', asigId)
    .select(`*, maquinaria:maquinaria_id(id, nombre, tipo, costo_hora, unidad_cobro)`)
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 13. HERRAMIENTAS ESPECIALES — CATÁLOGO Y ASIGNACIÓN
// ─────────────────────────────────────────────────────────────

export async function getHerramientasCatalogo() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_herramientas_catalogo')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('tipo', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getHerramientasAsignadas(projectId, wbsId) {
  const { data, error } = await supabase
    .from('obra_asig_herramientas')
    .select(`
      *,
      herramienta:herramienta_id (
        id, nombre, tipo, costo_dia, unidad_cobro
      )
    `)
    .eq('project_id', projectId)
    .eq('wbs_id', wbsId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function asignarHerramienta(projectId, wbsId, datos) {
  const { companyId, userId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_asig_herramientas')
    .insert({
      project_id:         projectId,
      wbs_id:             wbsId,
      company_id:         companyId,
      herramienta_id:     datos.herramienta_id,
      fecha_inicio:       datos.fecha_inicio || null,
      fecha_fin:          datos.fecha_fin    || null,
      cantidad:           parseInt(datos.cantidad) || 1,
      costo_dia_override: datos.costo_dia_override
                            ? parseFloat(datos.costo_dia_override) : null,
      notas:              datos.notas        || null,
      asignado_por:       userId,
    })
    .select(`*, herramienta:herramienta_id(id, nombre, tipo, costo_dia, unidad_cobro)`)
    .single()
  if (error) throw error
  return data
}

export async function retirarHerramienta(asigId) {
  const { error } = await supabase
    .from('obra_asig_herramientas')
    .delete()
    .eq('id', asigId)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// 14. PRECIOS POR ACTIVIDAD (Destajo / Fijo)
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene el precio vigente para una actividad en una fecha dada.
 */
export async function getPrecioActividad(wbsId, fecha = null) {
  const hoy = fecha || new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('obra_precios_actividad')
    .select('*')
    .eq('wbs_id', wbsId)
    .lte('fecha_inicio', hoy)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Obtiene historial completo de precios de una actividad.
 */
export async function getHistorialPrecios(wbsId) {
  const { data, error } = await supabase
    .from('obra_precios_actividad')
    .select('*')
    .eq('wbs_id', wbsId)
    .order('fecha_inicio', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function guardarPrecioActividad(wbsId, projectId, datos) {
  const { companyId, userId } = await getCtx()

  // Cerrar precio anterior si existe y no tiene fecha_fin
  if (datos.fecha_inicio) {
    const diaAnterior = new Date(datos.fecha_inicio)
    diaAnterior.setDate(diaAnterior.getDate() - 1)
    await supabase
      .from('obra_precios_actividad')
      .update({ fecha_fin: diaAnterior.toISOString().split('T')[0] })
      .eq('wbs_id', wbsId)
      .is('fecha_fin', null)
      .lt('fecha_inicio', datos.fecha_inicio)
  }

  const { data, error } = await supabase
    .from('obra_precios_actividad')
    .insert({
      project_id:      projectId,
      wbs_id:          wbsId,
      company_id:      companyId,
      tipo_pago:       datos.tipo_pago,
      precio_unitario: datos.precio_unitario
                         ? parseFloat(datos.precio_unitario) : null,
      unidad_medida:   datos.unidad_medida    || null,
      precio_dia:      datos.precio_dia
                         ? parseFloat(datos.precio_dia) : null,
      fecha_inicio:    datos.fecha_inicio || new Date().toISOString().split('T')[0],
      fecha_fin:       datos.fecha_fin    || null,
      notas:           datos.notas        || null,
      configurado_por: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// 15. CIERRES DE ETAPA
// ─────────────────────────────────────────────────────────────

export async function getCierresEtapa(projectId, wbsId = null) {
  let q = supabase
    .from('obra_cierres_etapa')
    .select(`
      *,
      cerrado_por:cerrado_por ( full_name )
    `)
    .eq('project_id', projectId)
    .order('fecha_inicio_periodo', { ascending: false })

  if (wbsId) q = q.eq('wbs_id', wbsId)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function crearCierreEtapa(projectId, wbsId, datos) {
  const { companyId, userId } = await getCtx()

  // Calcular costo MO fijo desde personal asignado si no viene
  let costoMoFijo = parseFloat(datos.costo_mo_fijo) || 0
  let costoMoDestajo = parseFloat(datos.costo_mo_destajo) || 0

  // Usar función SQL de cálculo para enriquecer si no viene calculado
  if (!datos.skip_calculo) {
    try {
      const { data: calc } = await supabase.rpc('calcular_costo_actividad', {
        p_wbs_id:     wbsId,
        p_project_id: projectId,
        p_fecha_ini:  datos.fecha_inicio_periodo,
        p_fecha_fin:  datos.fecha_fin_periodo,
      })
      if (calc?.[0]) {
        costoMoFijo      = costoMoFijo      || parseFloat(calc[0].costo_mo_fijo)      || 0
        costoMoDestajo   = costoMoDestajo   || parseFloat(calc[0].costo_mo_destajo)   || 0
      }
    } catch (_) { /* silenciar — el usuario puede haberlo capturado manualmente */ }
  }

  const { data, error } = await supabase
    .from('obra_cierres_etapa')
    .insert({
      project_id:           projectId,
      wbs_id:               wbsId,
      company_id:           companyId,
      fecha_inicio_periodo: datos.fecha_inicio_periodo,
      fecha_fin_periodo:    datos.fecha_fin_periodo,
      costo_mo_fijo:        costoMoFijo,
      costo_mo_destajo:     costoMoDestajo,
      cantidad_avance:      datos.cantidad_avance
                              ? parseFloat(datos.cantidad_avance) : null,
      unidad_avance:        datos.unidad_avance    || null,
      costo_maquinaria:     parseFloat(datos.costo_maquinaria)    || 0,
      detalle_maquinaria:   datos.detalle_maquinaria   || null,
      costo_herramientas:   parseFloat(datos.costo_herramientas)  || 0,
      detalle_herramientas: datos.detalle_herramientas || null,
      pct_avance_periodo:   datos.pct_avance_periodo
                              ? parseFloat(datos.pct_avance_periodo) : null,
      notas:                datos.notas  || null,
      cerrado_por:          userId,
    })
    .select(`*, cerrado_por:cerrado_por(full_name)`)
    .single()
  if (error) throw error
  return data
}

/**
 * Obtiene resumen de costos de un proyecto agrupado por actividad.
 */
export async function getResumenCostosProyecto(projectId) {
  const { data, error } = await supabase
    .from('obra_cierres_etapa')
    .select(`
      wbs_id,
      nodo:wbs_id ( nombre, codigo, nivel_profundidad ),
      costo_mo_fijo, costo_mo_destajo,
      costo_maquinaria, costo_herramientas, costo_total,
      fecha_inicio_periodo, fecha_fin_periodo
    `)
    .eq('project_id', projectId)
    .order('fecha_inicio_periodo', { ascending: true })
  if (error) throw error
  return data ?? []
}