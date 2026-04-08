import { supabase } from '../config/supabase'

// ─────────────────────────────────────────────────────────────
// PROYECTOS
// ─────────────────────────────────────────────────────────────

export const getProjects = async (filters = {}) => {
  let query = supabase
    .from('projects')
    .select(`
      *,
      warehouses (id, name, type, is_active)
    `)
    .order('code', { ascending: true })

  if (filters.status)    query = query.eq('status', filters.status)
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active)

  return await query
}

export const getProjectById = async (id) => {
  return await supabase
    .from('projects')
    .select(`*, warehouses (*)`)
    .eq('id', id)
    .single()
}

export const generateProjectCode = async () => {
  const { data, error } = await supabase.rpc('generate_project_code')
  if (error) throw error
  return data
}

export const createProject = async (projectData) => {
  return await supabase
    .from('projects')
    .insert([projectData])
    .select(`*, warehouses (id, name)`)
    .single()
}

export const updateProject = async (id, projectData) => {
  return await supabase
    .from('projects')
    .update(projectData)
    .eq('id', id)
    .select()
    .single()
}

// Terminar obra: establece completion_date + status = 'completed' + bloquea almacenes
export const completeProject = async (id, closingNotes = '') => {
  const { error: projError } = await supabase
    .from('projects')
    .update({
      status:          'completed',
      completion_date:  new Date().toISOString().split('T')[0],
      closing_notes:   closingNotes,
      is_active:       false
    })
    .eq('id', id)

  if (projError) throw projError

  // Desactivar todos los almacenes del proyecto
  const { error: whError } = await supabase
    .from('warehouses')
    .update({ is_active: false })
    .eq('project_id', id)

  if (whError) throw whError
  return true
}

// Cancelar proyecto
export const cancelProject = async (id, closingNotes = '') => {
  return await supabase
    .from('projects')
    .update({
      status:        'cancelled',
      closing_notes: closingNotes,
      is_active:     false
    })
    .eq('id', id)
}

// Reactivar proyecto
export const reactivateProject = async (id) => {
  return await supabase
    .from('projects')
    .update({ status: 'active', is_active: true, completion_date: null })
    .eq('id', id)
}

export const deleteProject = async (id) => {
  // Soft delete
  return await supabase
    .from('projects')
    .update({ is_active: false })
    .eq('id', id)
}

// ─────────────────────────────────────────────────────────────
// ALMACENES
// ─────────────────────────────────────────────────────────────

export const getWarehouses = async (projectId = null) => {
  let query = supabase
    .from('warehouses')
    .select(`
      *,
      projects (id, name, code, status)
    `)
    .order('name', { ascending: true })

  if (projectId) query = query.eq('project_id', projectId)

  return await query
}

export const getWarehouseById = async (id) => {
  return await supabase
    .from('warehouses')
    .select(`*, projects (id, name, code)`)
    .eq('id', id)
    .single()
}

export const createWarehouse = async (warehouseData) => {
  return await supabase
    .from('warehouses')
    .insert([warehouseData])
    .select(`*, projects (id, name, code)`)
    .single()
}

export const updateWarehouse = async (id, warehouseData) => {
  return await supabase
    .from('warehouses')
    .update(warehouseData)
    .eq('id', id)
    .select()
    .single()
}

export const deleteWarehouse = async (id) => {
  // Verificar si tiene inventario antes de eliminar
  const { count } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('warehouse_id', id)
    .gt('quantity', 0)

  if (count > 0) {
    throw new Error('No se puede eliminar: el almacén tiene inventario activo')
  }

  return await supabase
    .from('warehouses')
    .update({ is_active: false })
    .eq('id', id)
}

// Stats para el dashboard de proyectos
export const getProjectsStats = async () => {
  const { data: projects } = await supabase
    .from('projects')
    .select('status, is_active')

  const total     = projects?.length || 0
  const activos   = projects?.filter(p => p.status === 'active').length || 0
  const terminados = projects?.filter(p => p.status === 'completed').length || 0
  const cancelados = projects?.filter(p => p.status === 'cancelled').length || 0

  return { total, activos, terminados, cancelados }
}