// src/hooks/usePermission.js
// ============================================================================
// Hook para verificar permisos en cualquier componente
// ============================================================================
import { useAuth } from '../context/AuthContext'
import { hasPermission, canAccessModule } from '../config/permissions.config'

export const usePermission = () => {
  const { userProfile } = useAuth()
  const role = userProfile?.role || 'solo_lectura'

  return {
    // Verificar acción específica: can('inventory', 'create')
    can: (module, action) => hasPermission(role, module, action),

    // Verificar acceso al módulo: canAccess('reports')
    canAccess: (module) => canAccessModule(role, module),

    // Rol actual
    role,

    // Helpers rápidos
    isSuperAdmin:   role === 'super_admin',
    isAdminEmpresa: role === 'admin_empresa',
    isJefeObra:     role === 'jefe_obra',
    isAlmacenista:  role === 'almacenista',
    isSolicitante:  role === 'solicitante',
    isSoloLectura:  role === 'solo_lectura',
  }
}