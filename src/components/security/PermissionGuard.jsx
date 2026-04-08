// src/components/security/PermissionGuard.jsx
// ============================================================================
// 
// ============================================================================
import { Navigate } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { Lock } from 'lucide-react'

// ── Bloqueo de PÁGINA COMPLETA — redirige al dashboard ───────────────────────
export const RequirePermission = ({ module, action = 'view', children }) => {
  const { can } = usePermission()

  if (!can(module, action)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// ── Bloqueo de ELEMENTO UI — oculta o muestra mensaje ────────────────────────
export const PermissionGuard = ({
  module,
  action = 'view',
  children,
  fallback = null,        // Qué mostrar si no tiene permiso (null = ocultar)
  showLock = false,       // Mostrar candado en lugar de ocultar
}) => {
  const { can } = usePermission()

  if (can(module, action)) return children

  if (showLock) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        opacity: 0.4, cursor: 'not-allowed'
      }}>
        <Lock size={14} />
        {children}
      </div>
    )
  }

  return fallback
}

// ── Bloqueo de BOTÓN — lo desactiva con tooltip ──────────────────────────────
export const PermissionButton = ({
  module,
  action,
  children,
  onClick,
  className,
  style,
  ...props
}) => {
  const { can } = usePermission()
  const allowed = can(module, action)

  return (
    <button
      onClick={allowed ? onClick : undefined}
      disabled={!allowed}
      title={!allowed ? 'No tienes permiso para esta acción' : undefined}
      className={className}
      style={{
        ...style,
        opacity: allowed ? 1 : 0.4,
        cursor: allowed ? 'pointer' : 'not-allowed',
      }}
      {...props}
    >
      {children}
    </button>
  )
}