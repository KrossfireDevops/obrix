import { supabase } from '../config/supabase'

// Obtener inventario por almacén
export const getInventory = async (warehouseId = null) => {
  let query = supabase
    .from('inventory')
    .select(`
      *,
      materials_catalog (
        category,
        subcategory,
        material_type,
        default_unit
      ),
      warehouses (
        name,
        projects (
          name,
          companies (
            name
          )
        )
      )
    `)
    .order('updated_at', { ascending: false })

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  return await query
}

// Registrar movimiento (entrada, salida, daño, etc.)
export const createMovement = async (movementData) => {
  return await supabase
    .from('movements')
    .insert([movementData])
    .select(`
      *,
      materials_catalog (
        material_type,
        category
      ),
      warehouses (
        name
      )
    `)
    .single()
}

// Obtener estadísticas de inventario
export const getInventoryStats = async (warehouseId = null) => {
  let query = supabase
    .from('inventory')
    .select('quantity, material_id, warehouse_id')

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  const { data, error } = await query

  if (error) throw error

  const totalItems = data?.length || 0
  const totalQuantity = data?.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) || 0
  const lowStock = data?.filter(item => parseFloat(item.quantity || 0) < 10).length || 0

  return { totalItems, totalQuantity, lowStock }
}

// Obtener almacenes disponibles
export const getWarehouses = async () => {
  return await supabase
    .from('warehouses')
    .select(`
      *,
      projects (
        name,
        companies (
          name
        )
      )
    `)
    .order('name')
}