import { supabase } from '../config/supabase'

export const getMovements = async (filters = {}) => {
  let query = supabase
    .from('movements')
    .select(`
      *,
      materials_catalog (
        material_type,
        category,
        subcategory
      ),
      warehouses (
        name,
        projects (
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (filters.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.material_id) {
    query = query.eq('material_id', filters.material_id)
  }

  return await query
}

export const getMovementById = async (id) => {
  return await supabase
    .from('movements')
    .select('*')
    .eq('id', id)
    .single()
}

export const deleteMovement = async (id) => {
  return await supabase
    .from('movements')
    .delete()
    .eq('id', id)
}

export const getMovementStats = async (warehouseId = null) => {
  let query = supabase.from('movements').select('type, quantity, created_at')
  
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }
  
  const { data, error } = await query
  if (error) throw error

  const today = new Date().toISOString().split('T')[0]
  const movementsToday = data?.filter(m => m.created_at.startsWith(today)).length || 0
  const totalEntries = data?.filter(m => m.type === 'ENTRADA').length || 0
  const totalExits = data?.filter(m => ['SALIDA', 'DAÑO', 'DESPERDICIO', 'PERDIDA'].includes(m.type)).length || 0

  return { movementsToday, totalEntries, totalExits }
}