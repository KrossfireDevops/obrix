// src/services/users.service.js
import { supabase } from '../config/supabase'

export const getUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('*, companies(name)')
      .order('full_name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting users:', error)
    return { data: null, error }
  }
}

export const getUsersByCompany = async (companyId) => {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('company_id', companyId)
      .order('full_name', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error getting users by company:', error)
    return { data: null, error }
  }
}

export const updateUserRole = async (userId, role) => {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating user role:', error)
    return { data: null, error }
  }
}

export const updateUserProfile = async (userId, profileData) => {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .update({ ...profileData, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return { data: null, error }
  }
}

export const toggleUserActive = async (userId, isActive) => {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error toggling user active:', error)
    return { data: null, error }
  }
}

export const inviteUser = async ({ email, role, companyId, fullName }) => {
  try {
    // Invitar usuario vía Supabase Auth (envía email de invitación)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role, company_id: companyId }
    })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error inviting user:', error)
    return { data: null, error }
  }
}