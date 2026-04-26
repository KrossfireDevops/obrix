// src/pages/auth/Login.jsx
// v2.0 — Abril 2026
// Cambios:
//   - Logo dinámico: lee 'obrix_empresa_logo' de localStorage
//     (se guarda al hacer login exitoso en AuthContext)
//     Si no existe, muestra el logo de OBRIX como fallback.
//   - Al hacer login exitoso, AuthContext guarda el logo en localStorage
//     para que esté disponible en la próxima visita a esta pantalla.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react'

export const Login = () => {
  const navigate = useNavigate()
  const { user, loading, login, logout, isAuthenticated } = useAuth()

  const [error,      setError]      = useState('')
  const [formData,   setFormData]   = useState({ email: '', password: '' })
  const [showPass,   setShowPass]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Logo dinámico ─────────────────────────────────────────
  // Lee el logo guardado en localStorage del último login.
  // Primera visita → logo OBRIX. Visitas posteriores → logo empresa.
  const [logoSrc, setLogoSrc] = useState(() => {
    try {
      return localStorage.getItem('obrix_empresa_logo') || '/Obrix_V3_web.png'
    } catch {
      return '/Obrix_V3_web.png'
    }
  })
  const [logoError, setLogoError] = useState(false)

  const handleLogoError = () => {
    // Si el logo de la empresa falla (URL expirada, etc.) → fallback a OBRIX
    setLogoSrc('/Obrix_V3_web.png')
    setLogoError(true)
    try { localStorage.removeItem('obrix_empresa_logo') } catch {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (typeof login !== 'function') {
      setError('Error interno: función de login no disponible')
      return
    }

    setSubmitting(true)
    try {
      await login(formData.email, formData.password)
      navigate('/dashboard')
    } catch (err) {
      if (err?.message?.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos')
      } else if (err?.message?.includes('Email not confirmed')) {
        setError('Confirma tu correo electrónico antes de ingresar')
      } else {
        setError(err?.message || 'Error al iniciar sesión')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.fullPage}>
        <div style={styles.spinner} />
      </div>
    )
  }

  if (isAuthenticated) {
    navigate('/dashboard')
    return null
  }

  return (
    <div style={styles.fullPage}>

      <div style={styles.bgPattern} />

      <div style={styles.card}>

        {/* Panel izquierdo — hero */}
        <div style={styles.heroPanel}>
          <div style={styles.heroBadge}>OBRIX ERP</div>
          <h1 style={styles.heroTitle}>Control de obra y finanzas en un solo lugar</h1>
          <p style={styles.heroText}>
            Accede a tu ERP con datos en tiempo real, seguimiento de proyectos y reportes inteligentes.
          </p>

          <div style={styles.heroStats}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>+1.200</span>
              <span style={styles.statLabel}>Proyectos administrados</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>24/7</span>
              <span style={styles.statLabel}>Disponibilidad de datos</span>
            </div>
          </div>

          <div style={styles.heroGraphic}>
            <div style={styles.heroShapeLarge} />
            <div style={styles.heroShapeSmall} />
            <div style={styles.heroShapeCircle} />
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div style={styles.formPanel}>

          {/* ── Logo dinámico ── */}
          <div style={styles.logoWrap}>
            <img
              src={logoSrc}
              srcSet={
                logoSrc === '/Obrix_V3_web.png'
                  ? '/Obrix_V3_web.png 1x, /Obrix_V3.png 2x'
                  : `${logoSrc} 1x, ${logoSrc} 2x`
              }
              alt="OBRIX Construction ERP"
              style={styles.logo}
              onError={handleLogoError}
            />
          </div>

          <div style={styles.header}>
            <p style={styles.subtitulo}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@empresa.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={submitting}
                style={styles.input}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={submitting}
                  style={{ ...styles.input, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = '#2563EB'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={styles.eyeBtn}
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff size={16} color="#9CA3AF" />
                    : <Eye    size={16} color="#9CA3AF" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.submitBtn,
                opacity: submitting ? 0.75 : 1,
                cursor:  submitting ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#1D4ED8' }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#2563EB' }}
            >
              {submitting ? (
                <>
                  <div style={styles.btnSpinner} />
                  Verificando...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Iniciar sesión
                </>
              )}
            </button>
          </form>

          <p style={styles.footer}>
            © {new Date().getFullYear()} OBRIX ERP · DINNOVAC
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Estilos — idénticos a v1.0 ───────────────────────────────
const styles = {
  fullPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      radial-gradient(circle at 15% 20%, rgba(59,130,246,0.18) 0%, transparent 32%),
      radial-gradient(circle at 80% 10%, rgba(129,140,248,0.14) 0%, transparent 30%),
      radial-gradient(circle at 40% 80%, rgba(59,130,246,0.1) 0%, transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))
    `,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 960,
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: 28,
    backgroundColor: 'rgba(255,255,255,0.94)',
    border: '1px solid rgba(229,231,235,0.88)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 20px 60px rgba(15,23,42,0.12)',
    animation: 'fadeUp 0.35s ease',
    overflow: 'hidden',
  },
  heroPanel: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 18,
    padding: '32px 28px',
    borderRadius: 20,
    background: 'linear-gradient(180deg, rgba(59,130,246,0.12) 0%, rgba(255,255,255,0.9) 100%)',
    border: '1px solid rgba(59,130,246,0.12)',
    overflow: 'hidden',
    minHeight: 420,
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 9999,
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    width: 'fit-content',
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 1.08,
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 1.75,
    color: '#475569',
    maxWidth: 420,
    margin: 0,
  },
  heroStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  },
  statCard: {
    padding: '14px 16px',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(226,232,240,0.8)',
    boxShadow: '0 8px 18px rgba(15,23,42,0.06)',
  },
  statValue: {
    display: 'block',
    fontSize: 20,
    fontWeight: 700,
    color: '#1D4ED8',
  },
  statLabel: {
    display: 'block',
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  heroGraphic: {
    position: 'absolute',
    right: -24,
    bottom: -24,
    width: 220,
    height: 220,
    pointerEvents: 'none',
  },
  heroShapeLarge: {
    position: 'absolute',
    right: 0, bottom: 0,
    width: 180, height: 180,
    borderRadius: 28,
    background: 'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.28), rgba(37,99,235,0.06))',
    filter: 'blur(12px)',
  },
  heroShapeSmall: {
    position: 'absolute',
    left: 18, top: 42,
    width: 96, height: 96,
    borderRadius: 24,
    background: 'radial-gradient(circle at 50% 50%, rgba(96,165,250,0.28), rgba(37,99,235,0.08))',
    filter: 'blur(8px)',
  },
  heroShapeCircle: {
    position: 'absolute',
    left: 52, bottom: 18,
    width: 48, height: 48,
    borderRadius: '50%',
    background: 'rgba(59,130,246,0.18)',
  },
  formPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
    padding: '32px 28px',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 18px 50px rgba(15,23,42,0.08)',
    border: '1px solid rgba(229,231,235,0.95)',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 'auto',
    height: 64,
    maxWidth: 220,
    objectFit: 'contain',
    display: 'block',
    imageRendering: 'auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitulo: {
    fontSize: 14,
    color: '#475569',
    margin: 0,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '11px 14px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 20,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '13px',
    marginTop: 4,
    fontSize: 14,
    fontWeight: 700,
    color: '#FFFFFF',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: 12,
    transition: 'background-color 0.15s, transform 0.15s',
    fontFamily: 'inherit',
  },
  btnSpinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.35)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #E5E7EB',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  footer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    margin: '24px 0 0',
  },
}