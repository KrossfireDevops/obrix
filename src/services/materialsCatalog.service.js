// src/services/materialsCatalog.service.js
import { supabase } from '../config/supabase'

// ── Catálogo ──────────────────────────────────────────────────────────────────

export const getMaterials = async (filters = {}) => {
  try {
    let query = supabase
      .from('materials_catalog')
      .select('*, material_unit_conversions(*)')
      .eq('is_active', true)
      .order('material_type', { ascending: true })

    if (filters.category)    query = query.eq('category',    filters.category)
    if (filters.subcategory) query = query.eq('subcategory', filters.subcategory)
    if (filters.search) {
      query = query.or(
        `material_type.ilike.%${filters.search}%,` +
        `material_code.ilike.%${filters.search}%,` +
        `category.ilike.%${filters.search}%,` +
        `subcategory.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting materials:', error)
    return { data: null, error }
  }
}

export const getMaterialById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('materials_catalog')
      .select('*, material_unit_conversions(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const getCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('materials_catalog')
      .select('category, subcategory')
      .eq('is_active', true)
      .order('category')
    if (error) throw error

    const grouped = {}
    data?.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = new Set()
      if (m.subcategory) grouped[m.category].add(m.subcategory)
    })

    return {
      data: Object.entries(grouped).map(([cat, subs]) => ({
        category:      cat,
        subcategories: Array.from(subs).sort()
      })),
      error: null
    }
  } catch (error) {
    return { data: null, error }
  }
}

export const generateMaterialCode = async (subcategory) => {
  try {
    const { data, error } = await supabase
      .rpc('generate_material_code', { p_subcategory: subcategory })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const checkDuplicate = async (materialType, subcategory, companyId, excludeId = null) => {
  try {
    const { data, error } = await supabase
      .rpc('check_material_duplicate', {
        p_material_type: materialType,
        p_subcategory:   subcategory,
        p_company_id:    companyId,
        p_exclude_id:    excludeId
      })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: false, error }
  }
}

export const createMaterial = async (materialData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const { data: isDuplicate } = await checkDuplicate(
      materialData.material_type,
      materialData.subcategory,
      profile.company_id
    )
    if (isDuplicate) {
      return {
        data: null,
        error: { message: `Ya existe "${materialData.material_type}" en "${materialData.subcategory}"` }
      }
    }

    const { data: code } = await generateMaterialCode(materialData.subcategory)

    const { units, ...materialFields } = materialData

    const { data, error } = await supabase
      .from('materials_catalog')
      .insert([{
        ...materialFields,
        material_code: code,
        company_id:    profile.company_id,
        created_by:    user.id,
        is_active:     true,
      }])
      .select()
      .single()

    if (error) throw error

    // Guardar unidades de medida
    if (units?.length > 0) {
      await saveUnitConversions(data.id, units)
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error creating material:', error)
    return { data: null, error }
  }
}

export const updateMaterial = async (id, materialData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const { data: isDuplicate } = await checkDuplicate(
      materialData.material_type,
      materialData.subcategory,
      profile.company_id,
      id
    )
    if (isDuplicate) {
      return {
        data: null,
        error: { message: `Ya existe "${materialData.material_type}" en "${materialData.subcategory}"` }
      }
    }

    const { material_code, units, ...updateFields } = materialData

    const { data, error } = await supabase
      .from('materials_catalog')
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Actualizar unidades
    if (units?.length > 0) {
      await saveUnitConversions(id, units)
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error updating material:', error)
    return { data: null, error }
  }
}

export const deactivateMaterial = async (id) => {
  try {
    const { data, error } = await supabase
      .from('materials_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── Unidades de Medida ────────────────────────────────────────────────────────

export const getUnitConversions = async (materialId) => {
  try {
    const { data, error } = await supabase
      .from('material_unit_conversions')
      .select('*')
      .eq('material_id', materialId)
      .order('sort_order')
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Reemplaza todas las unidades de un material
export const saveUnitConversions = async (materialId, units) => {
  try {
    // Borrar existentes
    await supabase
      .from('material_unit_conversions')
      .delete()
      .eq('material_id', materialId)

    // Insertar nuevas
    const payload = units.map((u, idx) => ({
      material_id:       materialId,
      unit_name:         u.unit_name,
      conversion_factor: parseFloat(u.conversion_factor) || 1,
      max_quantity:      parseFloat(u.max_quantity)       || 9999,
      is_primary:        idx === 0,   // primera siempre es principal
      sort_order:        idx + 1,
    }))

    const { data, error } = await supabase
      .from('material_unit_conversions')
      .insert(payload)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error saving unit conversions:', error)
    return { data: null, error }
  }
}

// ── Precios ───────────────────────────────────────────────────────────────────

export const getPricesByMaterial = async (materialId) => {
  try {
    const { data, error } = await supabase
      .from('material_prices')
      .select('*, projects(id, name)')
      .eq('material_id', materialId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const getPriceHistory = async (materialId) => {
  try {
    const { data, error } = await supabase
      .from('material_price_history')
      .select('*, projects(name)')
      .eq('material_id', materialId)
      .order('changed_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const savePrice = async (priceData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const payload = {
      company_id:          profile.company_id,
      material_id:         priceData.material_id,
      project_id:          priceData.project_id || null,
      purchase_price:      parseFloat(priceData.purchase_price)      || 0,
      management_cost:     parseFloat(priceData.management_cost)     || 0,
      management_cost_pct: parseFloat(priceData.management_cost_pct) / 100 || 0,
      inflation_factor:    parseFloat(priceData.inflation_factor)    / 100 || 0,
      notes:               priceData.notes || null,
      created_by:          user.id,
      is_active:           true,
    }

    const { data, error } = await supabase
      .from('material_prices')
      .upsert(payload, { onConflict: 'material_id,project_id,company_id', ignoreDuplicates: false })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error saving price:', error)
    return { data: null, error }
  }
}