// src/components/ui/ConfirmDialog.jsx
import { AlertTriangle } from 'lucide-react'

export const ConfirmDialog = ({
  isOpen,
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  variant = 'danger',   // 'danger' | 'warning'
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null

  const colors = {
    danger:  { bg: '#fef2f2', icon: '#dc2626', btn: '#dc2626', btnHover: '#b91c1c' },
    warning: { bg: '#fffbeb', icon: '#d97706', btn: '#d97706', btnHover: '#b45309' },
  }
  const c = colors[variant] || colors.danger

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 998,
          animation: 'fadeIn 0.2s ease'
        }}
      />

      {/* Diálogo */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999,
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '28px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        animation: 'scaleIn 0.2s ease'
      }}>
        {/* Ícono */}
        <div style={{
          width: '52px',
          height: '52px',
          backgroundColor: c.bg,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <AlertTriangle size={26} style={{ color: c.icon }} />
        </div>

        {/* Texto */}
        <h3 style={{
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 8px'
        }}>
          {title}
        </h3>
        <p style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#6b7280',
          margin: '0 0 24px'
        }}>
          {message}
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontWeight: '500',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: c.btn,
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = c.btnHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = c.btn}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.92) } 
                             to   { opacity: 1; transform: translate(-50%, -50%) scale(1)    } }
      `}</style>
    </>
  )
}