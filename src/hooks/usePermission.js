// src/hooks/usePermission.js
// v2.1 — Abril 2026
// Fix definitivo: espera userProfile real antes de evaluar permisos

import { useAuth } from '../context/AuthContext'
import { hasPermission, canAccessModule, ROLES } from '../config/permissions.config'

export const usePermission = () => {
  const { userProfile, loading } = useAuth()

  // Esperar loading=false Y userProfile cargado antes de evaluar
  const isLoading = loading || userProfile === null

  const role = userProfile?.role ?? null
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  const can = (module, action) => {
    if (isLoading)    return false
    if (!role)        return false
    if (isSuperAdmin) return true
    return hasPermission(role, module, action)
  }

  const canAccess = (module) => {
    if (isLoading)    return false
    if (!role)        return false
    if (isSuperAdmin) return true
    return canAccessModule(role, module)
  }

  return {
    can,
    canAccess,
    loading:        isLoading,
    role:           role ?? 'solo_lectura',
    isSuperAdmin,
    isAdminEmpresa: role === 'admin_empresa',
    isJefeObra:     role === 'jefe_obra',
    isAlmacenista:  role === 'almacenista',
    isSolicitante:  role === 'solicitante',
    isSoloLectura:  role === 'solo_lectura',
  }
}