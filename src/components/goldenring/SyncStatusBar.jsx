// ============================================================
//  OBRIX GoldenRing — SyncStatusBar
//  src/components/goldenring/SyncStatusBar.jsx
//
//  Indicador visual del estado de sincronización.
//  Se integra en el header de cada módulo GoldenRing.
//
//  Estados:
//  🟢 Verde  — Todo sincronizado
//  🟡 Amarillo — N cambios pendientes (sin conexión o en cola)
//  🔴 Rojo   — Conflicto detectado que requiere atención manual
// ============================================================

import { useState } from 'react'
import { RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function SyncStatusBar({
  isOnline,
  syncStatus,
  pendientes,
  conflictos = [],
  onSync,
  onVerConflictos,
}) {
  const [expandido, setExpandido] = useState(false)

  // ── Estado: Conflicto ──────────────────────────────────────
  if (conflictos.length > 0) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div
          onClick={() => setExpandido(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
            background: '#FEF2F2', border: '1.5px solid #FECACA',
            transition: 'opacity 0.15s',
          }}
        >
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#EF4444', flexShrink: 0,
            animation: 'gr-pulse 1.5s infinite',
          }} />
          <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', flex: 1 }}>
            {conflictos.length} conflicto{conflictos.length !== 1 ? 's' : ''} — requiere tu atención
          </span>
          <button
            onClick={e => { e.stopPropagation(); onVerConflictos?.() }}
            style={{
              fontSize: 11, fontWeight: 700, color: '#DC2626',
              border: '1px solid #FECACA', background: '#fff',
              padding: '2px 10px', borderRadius: 20, cursor: 'pointer',
            }}
          >
            Revisar
          </button>
        </div>

        {/* Detalle de conflictos */}
        {expandido && (
          <div style={{
            marginTop: 4, padding: '10px 14px',
            background: '#FFF5F5', border: '1px solid #FECACA',
            borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {conflictos.slice(0, 3).map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.5 }}>
                <strong style={{ textTransform: 'capitalize' }}>{c.modulo}</strong>
                {' · '}{c.detalle ? JSON.parse(c.detalle)?.detalle || c.detalle : 'Conflicto detectado'}
              </div>
            ))}
            {conflictos.length > 3 && (
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                +{conflictos.length - 3} más...
              </p>
            )}
          </div>
        )}

        <Style />
      </div>
    )
  }

  // ── Estado: Pendientes ─────────────────────────────────────
  if (pendientes > 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', borderRadius: 10, marginBottom: 12,
        background: '#FFFBEB', border: '1.5px solid #FDE68A',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#F59E0B', flexShrink: 0,
          animation: 'gr-pulse 2s infinite',
        }} />
        {isOnline
          ? <RefreshCw size={13} color="#B45309" style={{ animation: 'gr-spin 1s linear infinite', flexShrink: 0 }} />
          : <WifiOff size={13} color="#B45309" style={{ flexShrink: 0 }} />
        }
        <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309', flex: 1 }}>
          {pendientes} cambio{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''}
          {isOnline ? ' — sincronizando...' : ' — sin conexión, en cola'}
        </span>
        {isOnline && (
          <button
            onClick={onSync}
            style={{
              fontSize: 11, fontWeight: 600, color: '#B45309',
              border: '1px solid #FDE68A', background: '#fff',
              padding: '2px 10px', borderRadius: 20, cursor: 'pointer',
            }}
          >
            Sincronizar ahora
          </button>
        )}
        <Style />
      </div>
    )
  }

  // ── Estado: Sin conexión (sin pendientes) ──────────────────
  if (!isOnline) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 14px', borderRadius: 10, marginBottom: 12,
        background: '#F9FAFB', border: '1px solid #E5E7EB',
      }}>
        <WifiOff size={13} color="#9CA3AF" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          Sin conexión — los cambios se guardarán localmente y sincronizarán al reconectar
        </span>
        <Style />
      </div>
    )
  }

  // ── Estado: Todo OK ────────────────────────────────────────
  const ultimoSync = syncStatus?.ultimoSync
    ? new Date(syncStatus.ultimoSync).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', borderRadius: 10, marginBottom: 12,
      background: '#F0FDF4', border: '1px solid #A7F3D0',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: '#10B981', flexShrink: 0,
      }} />
      <CheckCircle size={13} color="#059669" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: '#059669', flex: 1 }}>
        Todo sincronizado{ultimoSync ? ` · Último sync: ${ultimoSync}` : ''}
      </span>
      <Wifi size={12} color="#A7F3D0" />
      <Style />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL DE CONFLICTOS (modal)
// ─────────────────────────────────────────────────────────────

export function ConflictosPanel({ conflictos, onResolver, onCerrar }) {
  if (!conflictos.length) return null

  const iconModulo = { avances: '📈', materiales: '📦', asistencia: '👷', gastos: '💸' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#DC2626" />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#111827' }}>
              Conflictos de sincronización
            </h3>
          </div>
          <button onClick={onCerrar} style={{
            border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Lista de conflictos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
            Estos conflictos fueron detectados al sincronizar desde el modo offline.
            Revisa cada uno y marca como resuelto.
          </p>

          {conflictos.map((c, i) => {
            const detalle = c.detalle ? (() => { try { return JSON.parse(c.detalle) } catch { return { detalle: c.detalle } } })() : {}
            return (
              <div key={i} style={{
                padding: '12px 14px', borderRadius: 11, marginBottom: 8,
                background: '#FEF2F2', border: '1px solid #FECACA',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 16 }}>{iconModulo[c.modulo] || '⚠️'}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                    color: '#DC2626',
                  }}>
                    {c.modulo} · {detalle.tipo || 'Conflicto'}
                  </span>
                  <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>
                    {new Date(c.created_at).toLocaleString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                <p style={{ fontSize: 11, color: '#991B1B', margin: '0 0 8px', lineHeight: 1.5 }}>
                  {detalle.detalle || 'Conflicto detectado durante la sincronización.'}
                </p>

                <button
                  onClick={() => onResolver(c.id)}
                  style={{
                    fontSize: 11, fontWeight: 600, color: '#059669',
                    border: '1px solid #A7F3D0', background: '#F0FDF4',
                    padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                  }}
                >
                  ✓ Marcar como revisado
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #F3F4F6',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button onClick={onCerrar} style={{
            padding: '8px 18px', borderRadius: 9,
            border: '1px solid #E5E7EB', background: '#fff',
            color: '#374151', fontSize: 12, cursor: 'pointer',
          }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BADGE para el ícono del Sidebar o header
// ─────────────────────────────────────────────────────────────

export function SyncBadge({ pendientes, conflictos, onClick }) {
  const tieneConflicto = conflictos > 0
  const tienePendiente = pendientes > 0

  if (!tieneConflicto && !tienePendiente) {
    return (
      <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
        borderRadius: 8, border: 'none', background: '#F0FDF4', cursor: 'pointer',
      }} title="Todo sincronizado">
        <Wifi size={13} color="#10B981" />
        <span style={{ fontSize: 10, fontWeight: 600, color: '#059669' }}>Sync ✓</span>
      </button>
    )
  }

  const color = tieneConflicto ? '#DC2626' : '#D97706'
  const bg    = tieneConflicto ? '#FEF2F2' : '#FFFBEB'
  const count = tieneConflicto ? conflictos : pendientes
  const label = tieneConflicto ? `${count} conflicto${count !== 1 ? 's' : ''}` : `${count} pendiente${count !== 1 ? 's' : ''}`
  const Icon  = tieneConflicto ? AlertTriangle : Clock

  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
      borderRadius: 8, border: `1px solid ${color}44`, background: bg,
      cursor: 'pointer',
    }} title={label}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{label}</span>
      <Style />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// CSS animations (inline, un solo elemento por app)
// ─────────────────────────────────────────────────────────────
function Style() {
  return (
    <style>{`
      @keyframes gr-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
      }
      @keyframes gr-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  )
}
