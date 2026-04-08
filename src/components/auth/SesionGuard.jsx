// ============================================================
//  OBRIX — SesionGuard
//  src/components/auth/SesionGuard.jsx
//
//  Envuelve la app autenticada y muestra:
//  · Nada mientras el usuario está activo
//  · Modal de advertencia a los 27 minutos de inactividad
//  · Cierre de sesión automático a los 30 minutos
//
//  Uso en App.jsx:
//  <SesionGuard isAuthenticated={isAuthenticated}>
//    {children}
//  </SesionGuard>
// ============================================================
import { useState, useCallback } from 'react'
import { useNavigate }           from 'react-router-dom'
import { useInactividad }        from '../../hooks/useInactividad'
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react'

// Cuenta regresiva de 3 minutos en segundos
const SEGUNDOS_AVISO = 3 * 60

export default function SesionGuard({ children, isAuthenticated }) {
  const nav = useNavigate()
  const [mostrarAviso, setMostrarAviso] = useState(false)
  const [segundos,     setSegundos]     = useState(SEGUNDOS_AVISO)
  const intervalRef = { current: null }

  // Iniciar cuenta regresiva en el modal
  const iniciarCuentaRegresiva = useCallback(() => {
    setSegundos(SEGUNDOS_AVISO)
    setMostrarAviso(true)

    intervalRef.current = setInterval(() => {
      setSegundos(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const limpiarCuentaRegresiva = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setMostrarAviso(false)
    setSegundos(SEGUNDOS_AVISO)
  }, [])

  const { resetear, cerrarSesion } = useInactividad({
    activo: isAuthenticated,
    onAdvertencia: iniciarCuentaRegresiva,
    onCerrarSesion: () => {
      limpiarCuentaRegresiva()
      nav('/login')
    },
  })

  const handleContinuar = () => {
    limpiarCuentaRegresiva()
    resetear()
  }

  const handleCerrar = async () => {
    limpiarCuentaRegresiva()
    await cerrarSesion()
    nav('/login')
  }

  // Formatear mm:ss
  const minutos = Math.floor(segundos / 60)
  const segs    = segundos % 60
  const tiempoStr = `${minutos}:${segs.toString().padStart(2, '0')}`
  const urgente   = segundos <= 60

  return (
    <>
      {children}

      {/* ── Modal de advertencia de inactividad ──────────── */}
      {mostrarAviso && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          animation: 'fadeIn .2s ease',
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            width: '100%', maxWidth: 400,
            overflow: 'hidden',
            animation: 'slideUp .25s ease',
          }}>

            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #F3F4F6',
              backgroundColor: urgente ? '#FEF2F2' : '#FFFBEB',
              textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                backgroundColor: urgente ? '#FEE2E2' : '#FEF3C7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <AlertTriangle size={26} color={urgente ? '#DC2626' : '#D97706'} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                ¿Sigues ahí?
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                Tu sesión cerrará por inactividad en
              </p>
            </div>

            {/* Cuenta regresiva */}
            <div style={{ padding: '20px 24px', textAlign: 'center' }}>
              <div style={{
                fontSize: 52, fontWeight: 800, fontFamily: 'monospace',
                color: urgente ? '#DC2626' : '#D97706',
                lineHeight: 1, marginBottom: 8,
                animation: urgente ? 'pulso .8s ease-in-out infinite' : 'none',
              }}>
                {tiempoStr}
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
                minutos : segundos
              </p>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCerrar}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '11px', borderRadius: 10,
                    border: '1px solid #E5E7EB', background: '#F9FAFB',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#6B7280',
                  }}
                >
                  <LogOut size={14} /> Cerrar sesión
                </button>
                <button
                  onClick={handleContinuar}
                  style={{
                    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '11px', borderRadius: 10,
                    border: 'none', background: '#111827',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                  }}
                >
                  <RefreshCw size={14} /> Continuar trabajando
                </button>
              </div>

              <p style={{ fontSize: 11, color: '#D1D5DB', margin: '14px 0 0', lineHeight: 1.4 }}>
                Cualquier clic o tecla también reanuda la sesión automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; }                        to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(16px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes pulso   { 0%,100% { opacity: 1; } 50% { opacity: .6; } }
      `}</style>
    </>
  )
}
