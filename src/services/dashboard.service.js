import { supabase } from '../config/supabase'

export const getDashboardStats = async () => {
  try {
    const { count: totalMateriales } = await supabase
      .from('materials_catalog')
      .select('*', { count: 'exact', head: true })

    const today = new Date().toISOString().split('T')[0]
    const { count: movimientosHoy } = await supabase
      .from('movements')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity')
    
    const alertasStock = inventory?.filter(i => parseFloat(i.quantity || 0) < 10).length || 0

    const { data: projects } = await supabase
      .from('projects')
      .select('id, warehouses (id)')
    
    const obrasActivas = projects?.filter(p => p.warehouses && p.warehouses.length > 0).length || 0

    return {
      totalMateriales: totalMateriales || 0,
      movimientosHoy: movimientosHoy || 0,
      alertasStock,
      obrasActivas
    }
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    return { totalMateriales: 0, movimientosHoy: 0, alertasStock: 0, obrasActivas: 0 }
  }
}

export const getRecentMovements = async (limit = 5) => {
  const { data, error } = await supabase
    .from('movements')
    .select(`
      *,
      materials_catalog (material_type, category),
      warehouses (name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}