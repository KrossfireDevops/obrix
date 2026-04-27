// src/components/auth/PermissionGuard.jsx
// v2.0 — Abril 2026
// Fix: espera a que cargue el perfil antes de evaluar permisos
// Fix: super_admin nunca es bloqueado

import { Navigate } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { Lock, RefreshCw } from 'lucide-react'

// ── Bloqueo de PÁGINA COMPLETA ────────────────────────────────────────────────
export const RequirePermission = ({ module, action = 'view', children }) => {
  const { can, loading } = usePermission()

  // Mientras carga el perfil → mostrar spinner, NO redirigir
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: '#9CA3AF', gap: 10,
      }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Verificando permisos…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Perfil cargado → evaluar permiso real
  if (!can(module, action)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// ── Bloqueo de ELEMENTO UI ────────────────────────────────────────────────────
export const PermissionGuard = ({
  module,
  action = 'view',
  children,
  fallback = null,
  showLock = false,
}) => {
  const { can, loading } = usePermission()

  // Mientras carga → no mostrar ni ocultar, simplemente null
  if (loading) return null

  if (can(module, action)) return children

  if (showLock) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        opacity: 0.4, cursor: 'not-allowed',
      }}>
        <Lock size={14} />
        {children}
      </div>
    )
  }

  return fallback
}

// ── Bloqueo de BOTÓN ──────────────────────────────────────────────────────────
export const PermissionButton = ({
  module, action, children, onClick,
  className, style, ...props
}) => {
  const { can, loading } = usePermission()
  const allowed = !loading && can(module, action)

  return (
    <button
      onClick={allowed ? onClick : undefined}
      disabled={!allowed}
      title={!allowed && !loading ? 'No tienes permiso para esta acción' : undefined}
      className={className}
      style={{ ...style, opacity: allowed ? 1 : 0.4, cursor: allowed ? 'pointer' : 'not-allowed' }}
      {...props}
    >
      {children}
    </button>
  )
}