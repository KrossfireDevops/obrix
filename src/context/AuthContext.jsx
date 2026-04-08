import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../config/supabase'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading]         = useState(true)
  const initialized                   = useRef(false)

  // ── Cargar perfil desde users_profiles ──────────────────────────────
const loadUserProfile = async (userId) => {
  if (!userId) { setUserProfile(null); return }
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    console.log('[AuthContext] loadUserProfile result:', { data, error })
    setUserProfile(data || null)
  } catch (err) {
    console.log('[AuthContext] loadUserProfile catch:', err)
    setUserProfile(null)
  }
}

  // ── Login ────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) throw result.error
    return result.data
  }

  // ── Logout ───────────────────────────────────────────────────────────
  const logout = async () => {
    const result = await supabase.auth.signOut()
    if (result.error) throw result.error
    setUser(null)
    setUserProfile(null)
  }

  // ── Inicializar sesión ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      // getSession solo se usa para la carga inicial
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        await loadUserProfile(session.user.id)
      }

      // Marcar como inicializado antes de activar el listener
      initialized.current = true
      setLoading(false)
    }

    initAuth()

    // Listener solo reacciona a cambios POSTERIORES a la inicialización
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initialized.current) return  // Ignorar el evento inicial
        if (!mounted) return

        setUser(session?.user ?? null)
        await loadUserProfile(session?.user?.id ?? null)
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const contextValue = {
    user,
    userProfile,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  }

  // No renderizar hijos hasta que la sesión esté resuelta
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px',
            border: '4px solid #e5e7eb', borderTopColor: '#2563eb',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando Obrix...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}