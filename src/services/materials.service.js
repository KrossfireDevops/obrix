import { supabase } from '../config/supabase'

export const getMaterials = async (filters = {}) => {
  let query = supabase.from('materials_catalog').select('*').order('category, subcategory, material_type')
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.subcategory) query = query.eq('subcategory', filters.subcategory)
  if (filters.search) query = query.ilike('material_type', '%' + filters.search + '%')
  return await query
}

export const getMaterialById = async (id) => {
  return await supabase.from('materials_catalog').select('*').eq('id', id).single()
}

export const createMaterial = async (materialData) => {
  return await supabase.from('materials_catalog').insert([materialData]).select().single()
}

export const updateMaterial = async (id, materialData) => {
  return await supabase.from('materials_catalog').update(materialData).eq('id', id).select().single()
}

export const deleteMaterial = async (id) => {
  return await supabase.from('materials_catalog').delete().eq('id', id)
}

export const getCategories = async () => {
  const { data } = await supabase.from('materials_catalog').select('category')
  const categories = [...new Set(data?.map(m => m.category))]
  return categories.filter(Boolean)
}

export const getSubcategories = async (category) => {
  const { data } = await supabase.from('materials_catalog').select('subcategory').eq('category', category)
  const subcategories = [...new Set(data?.map(m => m.subcategory))]
  return subcategories.filter(Boolean)
}