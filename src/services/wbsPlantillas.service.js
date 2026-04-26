// ============================================================
//  OBRIX ERP — Servicio: WBS + Motor de Plantillas
//  src/services/wbsPlantillas.service.js  |  v1.0
//
//  Cubre:
//    · Cargar disciplinas y subdisciplinas del catálogo
//    · Listar plantillas disponibles (sistema + empresa)
//    · Previsualizar árbol WBS antes de crear proyecto
//    · Clonar WBS desde plantilla del sistema
//    · Clonar WBS desde plantilla de empresa
//    · Guardar WBS de proyecto como plantilla de empresa
//    · Versionar plantilla de empresa existente
//    · CRUD básico de project_wbs (avances, % completado)
// ============================================================

import { supabase } from '../config/supabase'

// ─────────────────────────────────────────────────────────────
// 1. CATÁLOGO DE DISCIPLINAS Y SUBDISCIPLINAS
// ─────────────────────────────────────────────────────────────

/**
 * Retorna todas las disciplinas activas del sistema
 * ordenadas por `orden`.
 */
export async function getDisciplinas() {
  const { data, error } = await supabase
    .from('obra_disciplinas')
    .select('*')
    .eq('is_active', true)
    .order('orden', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Retorna todas las subdisciplinas agrupadas por disciplina_id.
 * @returns {Object} { [disciplina_id]: [ ...subdisciplinas ] }
 */
export async function getSubdisciplinas() {
  const { data, error } = await supabase
    .from('obra_subdisciplinas')
    .select('*')
    .eq('is_active', true)
    .order('orden', { ascending: true })

  if (error) throw error

  // Agrupar por disciplina_id para acceso rápido en el wizard
  return data.reduce((acc, sub) => {
    if (!acc[sub.disciplina_id]) acc[sub.disciplina_id] = []
    acc[sub.disciplina_id].push(sub)
    return acc
  }, {})
}

// ─────────────────────────────────────────────────────────────
// 2. PLANTILLAS DISPONIBLES PARA EL WIZARD
// ─────────────────────────────────────────────────────────────

/**
 * Lista todas las fuentes disponibles al crear un proyecto:
 *   - Plantillas del sistema (versión activa por disciplina)
 *   - Plantillas de empresa de la company_id actual
 *
 * Usa la función SQL get_plantillas_disponibles(company_id).
 */
export async function getPlantillasDisponibles(companyId) {
  const { data, error } = await supabase
    .rpc('get_plantillas_disponibles', { p_company_id: companyId })

  if (error) throw error
  return data ?? []
}

/**
 * Carga los nodos de una plantilla de empresa específica
 * para mostrar la vista previa del árbol en el wizard.
 */
export async function getNodosPlantillaEmpresa(plantillaId) {
  const { data, error } = await supabase
    .from('obra_plantilla_empresa_nodos')
    .select(`
      *,
      disciplina:disciplina_id ( codigo, nombre, color, icono )
    `)
    .eq('plantilla_id', plantillaId)
    .eq('is_active', true)
    .order('nivel_profundidad', { ascending: true })
    .order('orden', { ascending: true })

  if (error) throw error
  return buildTree(data)
}

/**
 * Carga los nodos del sistema para una lista de disciplinas
 * (versión activa) para mostrar la vista previa ANTES de
 * crear el proyecto.
 *
 * @param {string[]} disciplinaCodigos  ej: ['CIVIL','ELECT','HIDRO']
 * @param {number}   numNiveles
 * @param {number}   m2
 */
export async function previewNodosSistema(disciplinaCodigos, numNiveles = 1, m2 = 100) {
  // Obtener IDs de disciplinas a partir de códigos
  const { data: discs, error: discErr } = await supabase
    .from('obra_disciplinas')
    .select('id, codigo, nombre, color')
    .in('codigo', disciplinaCodigos)

  if (discErr) throw discErr
  const discIds = discs.map(d => d.id)

  // Obtener nodos de la versión activa
  const { data: nodos, error: nodErr } = await supabase
    .from('obra_template_nodos')
    .select(`
      *,
      disciplina:disciplina_id ( codigo, nombre, color )
    `)
    .in('disciplina_id', discIds)
    .eq('is_active', true)
    .order('nivel_profundidad', { ascending: true })
    .order('orden', { ascending: true })

  if (nodErr) throw nodErr

  // Calcular duración relativa para cada nodo
  const nodosConDuracion = nodos.map(n => ({
    ...n,
    dur_calculada: Math.round(
      (n.dur_base_dias ?? 1) +
      (n.factor_nivel ?? 0) * numNiveles +
      (n.factor_m2 ?? 0) * m2 / 100
    ),
  }))

  return buildTree(nodosConDuracion)
}

// ─────────────────────────────────────────────────────────────
// 3. GENERACIÓN DEL WBS AL CREAR PROYECTO
// ─────────────────────────────────────────────────────────────

/**
 * Genera el WBS del proyecto desde las plantillas del sistema.
 * Llama a clonar_wbs_desde_plantilla(project_id).
 *
 * Debe llamarse DESPUÉS de crear el proyecto y sus niveles.
 */
export async function clonarWbsDesdeSistema(projectId) {
  const { data, error } = await supabase
    .rpc('clonar_wbs_desde_plantilla', { p_project_id: projectId })

  if (error) throw error
  return data?.[0] ?? { nodos_creados: 0, dias_totales: 0 }
}

/**
 * Genera el WBS del proyecto desde una plantilla de empresa.
 * Llama a clonar_desde_plantilla_empresa(project_id, plantilla_id).
 */
export async function clonarWbsDesdeEmpresa(projectId, plantillaId) {
  const { data, error } = await supabase
    .rpc('clonar_desde_plantilla_empresa', {
      p_project_id:   projectId,
      p_plantilla_id: plantillaId,
    })

  if (error) throw error
  return data?.[0] ?? { nodos_creados: 0, dias_totales: 0 }
}

// ─────────────────────────────────────────────────────────────
// 4. GUARDAR / VERSIONAR PLANTILLAS DE EMPRESA
// ─────────────────────────────────────────────────────────────

/**
 * Guarda el WBS actual de un proyecto como plantilla
 * reutilizable de la empresa.
 *
 * @param {string} projectId
 * @param {string} nombre        Nombre descriptivo de la plantilla
 * @param {string} [descripcion]
 * @returns {string} UUID de la nueva plantilla
 */
export async function guardarWbsComoPlantilla(projectId, nombre, descripcion = null) {
  const { data, error } = await supabase
    .rpc('guardar_wbs_como_plantilla', {
      p_project_id:  projectId,
      p_nombre:      nombre,
      p_descripcion: descripcion,
    })

  if (error) throw error
  return data  // UUID de la plantilla creada
}

/**
 * Crea una nueva versión de una plantilla de empresa existente.
 * La versión anterior queda desactivada (is_activa = false).
 *
 * @param {string} plantillaId
 * @param {string} [nombre]      Si omite, se auto-genera "Nombre v2"
 * @param {string} [descripcion]
 * @returns {string} UUID de la nueva versión
 */
export async function versionarPlantillaEmpresa(plantillaId, nombre = null, descripcion = null) {
  const { data, error } = await supabase
    .rpc('versionar_plantilla_empresa', {
      p_plantilla_id: plantillaId,
      p_nombre:       nombre,
      p_descripcion:  descripcion,
    })

  if (error) throw error
  return data  // UUID de la nueva versión
}

/**
 * Lista las plantillas de empresa activas de la company.
 */
export async function getPlantillasEmpresa(companyId) {
  const { data, error } = await supabase
    .from('obra_plantillas_empresa')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_activa', true)
    .order('veces_usada', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Elimina (soft-delete) una plantilla de empresa.
 */
export async function desactivarPlantillaEmpresa(plantillaId) {
  const { error } = await supabase
    .from('obra_plantillas_empresa')
    .update({ is_activa: false, updated_at: new Date().toISOString() })
    .eq('id', plantillaId)

  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// 5. LECTURA Y ACTUALIZACIÓN DEL WBS DE PROYECTO
// ─────────────────────────────────────────────────────────────

/**
 * Retorna el WBS completo de un proyecto como árbol jerárquico.
 */
export async function getWbsProyecto(projectId) {
  const { data, error } = await supabase
    .from('project_wbs')
    .select(`
      *,
      disciplina:disciplina_id ( codigo, nombre, color, icono )
    `)
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('nivel_profundidad', { ascending: true })
    .order('orden', { ascending: true })

  if (error) throw error
  return buildTree(data)
}

/**
 * Actualiza el nombre o la duración estimada de un nodo WBS.
 */
export async function updateNodoWbs(nodoId, cambios) {
  const { data, error } = await supabase
    .from('project_wbs')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', nodoId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Soft-delete de un nodo WBS (y sus hijos en cascada a nivel app).
 * La DB tiene ON DELETE CASCADE, pero lo marcamos is_deleted
 * para auditoría y posible recuperación.
 */
export async function eliminarNodoWbs(nodoId) {
  const { error } = await supabase
    .from('project_wbs')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', nodoId)

  if (error) throw error
}

/**
 * Soft-delete masivo de nodos WBS a partir de sus template_nodo_ids.
 *
 * Se usa después de clonar el WBS desde una plantilla del sistema:
 * los IDs del preview son los de obra_template_nodos, que quedan
 * guardados en project_wbs.template_nodo_id. Con eso podemos
 * localizar y eliminar los nodos que el usuario marcó en la preview.
 *
 * Para plantillas de empresa los nodos no tienen template_nodo_id
 * confiable (pueden ser personalizados), así que en ese caso
 * usamos el nombre del nodo como fallback.
 *
 * @param {string}   projectId         UUID del proyecto recién creado
 * @param {string[]} templateNodoIds   IDs de obra_template_nodos a excluir
 * @param {string[]} [nombresExcluir]  Fallback por nombre (plantillas empresa)
 */
export async function eliminarNodosWbsPorTemplateIds(
  projectId,
  templateNodoIds = [],
  nombresExcluir  = [],
) {
  if (!templateNodoIds.length && !nombresExcluir.length) return

  const ahora = new Date().toISOString()

  // 1. Eliminar por template_nodo_id (plantillas del sistema)
  if (templateNodoIds.length) {
    const { error } = await supabase
      .from('project_wbs')
      .update({ is_deleted: true, updated_at: ahora })
      .eq('project_id', projectId)
      .in('template_nodo_id', templateNodoIds)

    if (error) throw error
  }

  // 2. Eliminar por nombre como fallback (plantillas de empresa
  //    cuyos nodos no tienen template_nodo_id del sistema)
  if (nombresExcluir.length) {
    const { error } = await supabase
      .from('project_wbs')
      .update({ is_deleted: true, updated_at: ahora })
      .eq('project_id', projectId)
      .is('template_nodo_id', null)          // solo nodos sin origen sistema
      .in('nombre', nombresExcluir)

    if (error) throw error
  }
}

/**
 * Agrega un nodo personalizado al WBS de un proyecto.
 */
export async function agregarNodoWbs({
  projectId, companyId, parentId, disciplinaId,
  nombre, orden = 0, nivelProfundidad = 1,
  durEstimadaDias = 1,
}) {
  const { data, error } = await supabase
    .from('project_wbs')
    .insert({
      project_id:        projectId,
      company_id:        companyId,
      parent_id:         parentId ?? null,
      disciplina_id:     disciplinaId ?? null,
      nombre,
      orden,
      nivel_profundidad: nivelProfundidad,
      dur_estimada_dias: durEstimadaDias,
      is_personalizado:  true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Actualiza el porcentaje de avance de un nodo WBS.
 */
export async function updateAvanceNodo(nodoId, pctAvance) {
  const { data, error } = await supabase
    .from('project_wbs')
    .update({
      pct_avance:  Math.min(100, Math.max(0, pctAvance)),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', nodoId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Retorna KPIs de costo integral del proyecto.
 * Usa la función SQL get_costo_integral_proyecto(project_id).
 */
export async function getCostoIntegralProyecto(projectId) {
  const { data, error } = await supabase
    .rpc('get_costo_integral_proyecto', { p_project_id: projectId })

  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// UTILIDAD: buildTree — lista plana → árbol jerárquico
// ─────────────────────────────────────────────────────────────

/**
 * Convierte una lista plana de nodos con parent_id en un
 * árbol jerárquico { ...nodo, children: [...] }.
 *
 * @param  {Object[]} nodos   Lista plana con id y parent_id
 * @returns {Object[]}        Nodos raíz con children anidados
 */
export function buildTree(nodos = []) {
  const map = {}
  const roots = []

  // 1. Crear mapa id → nodo con array children vacío
  nodos.forEach(n => {
    map[n.id] = { ...n, children: [] }
  })

  // 2. Asignar cada nodo a su padre o a roots
  nodos.forEach(n => {
    if (n.parent_id && map[n.parent_id]) {
      map[n.parent_id].children.push(map[n.id])
    } else {
      roots.push(map[n.id])
    }
  })

  return roots
}

/**
 * Aplana un árbol jerárquico de vuelta a lista plana.
 * Útil para operaciones de guardado masivo.
 */
export function flattenTree(nodos = [], resultado = []) {
  nodos.forEach(n => {
    const { children, ...nodo } = n
    resultado.push(nodo)
    if (children?.length) flattenTree(children, resultado)
  })
  return resultado
}