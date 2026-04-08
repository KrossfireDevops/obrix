// src/services/companySettings.service.js
import { supabase } from '../config/supabase'

export const getSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*, companies(name, id)')
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting company settings:', error)
    return { data: null, error }
  }
}

export const saveSettings = async (settings) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Obtener company_id del perfil
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const payload = {
      company_id:               profile.company_id,
      approval_limit_jefe_obra: parseFloat(settings.approval_limit_jefe_obra),
      currency:                 settings.currency,
      currency_symbol:          settings.currency_symbol,
      default_inflation_factor: parseFloat(settings.default_inflation_factor) / 100,
      default_management_cost:  parseFloat(settings.default_management_cost)  / 100,
      updated_at:               new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error saving company settings:', error)
    return { data: null, error }
  }
}