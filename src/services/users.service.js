// src/services/users.service.js
// v2.0 — Abril 2026
// Nuevo: createUser, resetPasswordForUser, getPermisos, upsertPermisos

import { supabase } from '../config/supabase'

// ─────────────────────────────────────────────────────────────
// CATÁLOGO DE PUESTOS
// ─────────────────────────────────────────────────────────────
export const PUESTOS = [
  { value: 'director_general',        label: 'Director General'           },
  { value: 'director_operaciones',    label: 'Director de Operaciones'    },
  { value: 'supervisor_obra',         label: 'Supervisor de Obra'         },
  { value: 'jefe_obra',               label: 'Jefe de Obra'               },
  { value: 'residente_obra',          label: 'Residente de Obra'          },
  { value: 'jefe_contabilidad',       label: 'Jefe de Contabilidad'       },
  { value: 'contador',                label: 'Contador'                   },
  { value: 'jefe_ventas',             label: 'Jefe de Ventas'             },
  { value: 'vendedor',                label: 'Vendedor'                   },
  { value: 'auxiliar_administracion', label: 'Auxiliar de Administración' },
  { value: 'almacenista',             label: 'Almacenista'                },
  { value: 'solicitante',             label: 'Solicitante de Materiales'  },
  { value: 'otro',                    label: 'Otro'                       },
]

// ─────────────────────────────────────────────────────────────
// LEER USUARIOS
// ─────────────────────────────────────────────────────────────
export const getUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .select(`
        *,
        companies ( name ),
        auth_user:id (
          email,
          last_sign_in_at,
          created_at
        )
      `)
      .order('full_name', { ascending: true })

    if (error) {
      // Fallback sin join a auth.users si RLS lo impide
      const { data: d2, error: e2 } = await supabase
        .from('users_profiles')
        .select('*, companies(name)')
        .order('full_name', { ascending: true })
      if (e2) throw e2
      return { data: d2, error: null }
    }
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
      .select('*, companies(name)')
      .eq('company_id', companyId)
      .order('full_name', { ascending: true })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// CREAR USUARIO NUEVO
// Usa Edge Function "crear-usuario" para evitar el flujo de
// confirmación de email y tener acceso al service_role key.
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// CREAR USUARIO NUEVO
// ─────────────────────────────────────────────────────────────
export const createUser = async ({ email, password, fullName, role, puesto, companyId, phone }) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    // Guardar sesión del admin ANTES de cualquier operación
    const { data: { session: adminSession } } = await supabase.auth.getSession()
    if (!adminSession) throw new Error('No hay sesión de administrador activa')

    // 1. Crear usuario en Auth via fetch directo (no toca el SDK ni la sesión)
    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        supabaseKey,
      },
      body: JSON.stringify({
        email:    email.trim().toLowerCase(),
        password,
        data: { full_name: fullName, role, company_id: companyId },
      }),
    })

    const authData = await res.json()

    if (!res.ok || authData.error) {
      throw new Error(authData.error?.message ?? authData.msg ?? 'Error al crear usuario en Auth')
    }

    const userId = authData.id ?? authData.user?.id
    if (!userId) throw new Error('No se obtuvo el ID del nuevo usuario')

    // 2. Restaurar sesión del admin inmediatamente
    await supabase.auth.setSession({
      access_token:  adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    })

    // 3. Insertar perfil con la sesión del admin restaurada
    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .upsert({
        id:         userId,
        company_id: companyId,
        full_name:  fullName.trim(),
        role,
        puesto:     puesto || null,
        phone:      phone  || null,
        is_active:  true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profileError) throw profileError
    return { data: profile, error: null }
  } catch (error) {
    console.error('[createUser]', error)
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR PERFIL
// ─────────────────────────────────────────────────────────────
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
    return { data: null, error }
  }
}

export const updateUserRole = async (userId, role) => {
  return updateUserProfile(userId, { role })
}

export const toggleUserActive = async (userId, isActive) => {
  return updateUserProfile(userId, { is_active: isActive })
}

// ─────────────────────────────────────────────────────────────
// RESET DE CONTRASEÑA
// Envía email de restablecimiento desde Supabase Auth
// ─────────────────────────────────────────────────────────────
export const sendPasswordReset = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error sending password reset:', error)
    return { error }
  }
}

// ─────────────────────────────────────────────────────────────
// INVITAR USUARIO (email de invitación Supabase)
// Requiere service_role — usar desde Edge Function en producción
// ─────────────────────────────────────────────────────────────
export const inviteUser = async ({ email, role, companyId, fullName }) => {
  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role, company_id: companyId },
    })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error inviting user:', error)
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// PERMISOS POR MÓDULO
// Lee / guarda en tabla user_module_permissions (si existe)
// Fallback: usa los permisos por defecto del rol
// ─────────────────────────────────────────────────────────────
export const getPermisosUsuario = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_module_permissions')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return { data: data ?? [], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export const upsertPermisoUsuario = async (userId, modulo, acciones) => {
  try {
    const { data, error } = await supabase
      .from('user_module_permissions')
      .upsert({
        user_id:   userId,
        modulo,
        acciones,  // JSONB: { view: true, edit: false, ... }
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,modulo' })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}