// src/components/ui/Toast.jsx
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Configuración por tipo ──
const toastConfig = {
  success: {
    icon: CheckCircle,
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    iconColor: '#16a34a',
    textColor: '#15803d'
  },
  error: {
    icon: XCircle,
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    iconColor: '#dc2626',
    textColor: '#b91c1c'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    iconColor: '#d97706',
    textColor: '#b45309'
  },
  info: {
    icon: Info,
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    iconColor: '#2563eb',
    textColor: '#1d4ed8'
  }
}

// ── Componente individual Toast ──
const ToastItem = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(false)
  const config = toastConfig[toast.type] || toastConfig.info
  const Icon = config.icon

  useEffect(() => {
    // Animar entrada
    setTimeout(() => setVisible(true), 10)

    // Auto-cerrar
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '14px 16px',
      backgroundColor: config.bgColor,
      border: `1px solid ${config.borderColor}`,
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      minWidth: '300px',
      maxWidth: '420px',
      transition: 'all 0.3s ease',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      pointerEvents: 'auto'
    }}>
      <Icon size={20} style={{ color: config.iconColor, flexShrink: 0, marginTop: '1px' }} />
      <div style={{ flex: 1 }}>
        {toast.title && (
          <p style={{ fontWeight: '600', fontSize: '14px', color: config.textColor, margin: '0 0 2px 0' }}>
            {toast.title}
          </p>
        )}
        <p style={{ fontSize: '13px', color: config.textColor, margin: 0, opacity: 0.9 }}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: config.iconColor,
          opacity: 0.6,
          padding: '2px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ── Contenedor de Toasts (esquina inferior derecha) ──
export const ToastContainer = ({ toasts, onRemove }) => {
  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}