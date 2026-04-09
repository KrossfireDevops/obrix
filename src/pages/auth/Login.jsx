// src/pages/auth/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react'

export const Login = () => {
  const navigate = useNavigate()
  const { user, loading, login, logout, isAuthenticated } = useAuth()

  const [error,       setError]       = useState('')
  const [formData,    setFormData]    = useState({ email: '', password: '' })
  const [showPass,    setShowPass]    = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

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

  // Cargando contexto de auth
  if (loading) {
    return (
      <div style={styles.fullPage}>
        <div style={styles.spinner} />
      </div>
    )
  }

  // Ya autenticado
  if (isAuthenticated) {
    navigate('/dashboard')
    return null
  }

  return (
    <div style={styles.fullPage}>

      {/* Fondo con patrón sutil */}
      <div style={styles.bgPattern} />

      {/* Card de login */}
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
              src="/Obrix_V3_web.png"
              srcSet="/Obrix_V3_web.png 1x, /Obrix_V3.png 2x"
              alt="OBRIX Construction ERP"
              style={styles.logo}
            />
        </div>

        {/* Titular */}
        <div style={styles.header}>
          <p style={styles.subtitulo}>
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={styles.form}>

          {/* Email */}
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
              onFocus={e  => e.target.style.borderColor = '#2563EB'}
              onBlur={e   => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Contraseña */}
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

          {/* Botón */}
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

        {/* Footer */}
        <p style={styles.footer}>
          © {new Date().getFullYear()} OBRIX ERP · DINNOVAC
        </p>
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

// ─── Estilos ──────────────────────────────────────────────────
const styles = {
  fullPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },

  // Patrón de fondo sutil
  bgPattern: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 20%, rgba(37,99,235,0.06) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(37,99,235,0.04) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
  },

  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 20,
    padding: '40px 36px 32px',
    boxShadow: '0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    animation: 'fadeUp 0.35s ease',
  },

  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 24,
  },

  logo: {
    width: 'auto',
    height: 80,
    maxWidth: 240,
    objectFit: 'contain',
    display: 'block',
    imageRendering: 'auto',
  },

  header: {
    textAlign: 'center',
    marginBottom: 28,
  },

  titulo: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 6px',
  },

  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
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
    padding: '11px 14px',
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
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
    padding: '12px',
    marginTop: 4,
    fontSize: 14,
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: 10,
    transition: 'background-color 0.15s',
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