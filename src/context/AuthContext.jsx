// src/context/AuthContext.jsx
// v2.1 — Abril 2026
// Fix: onAuthStateChange ignora eventos TOKEN_REFRESHED durante
//      creación de usuarios para no resetear la sesión del admin

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../config/supabase'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user,          setUser]          = useState(null)
  const [userProfile,   setUserProfile]   = useState(null)
  const [empresaConfig, setEmpresaConfig] = useState(null)
  const [loading,       setLoading]       = useState(true)
  const initialized                       = useRef(false)
  // Guardar el userId del admin para detectar cambios de sesión no deseados
  const currentUserId                     = useRef(null)

  const loadUserProfile = async (userId) => {
    if (!userId) {
      setUserProfile(null)
      setEmpresaConfig(null)
      currentUserId.current = null
      return
    }

    currentUserId.current = userId

    try {
      const { data: profile, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      console.log('[AUTH] userId:', userId)
      console.log('[AUTH] profile:', profile)
      console.log('[AUTH] error:', error)

      // Verificar que el userId no cambió mientras esperábamos
      if (currentUserId.current !== userId) return

      setUserProfile(profile || null)

      if (profile?.company_id) {
        try {
          const { data: settings } = await supabase
            .from('company_settings')
            .select(`
              logo_url,
              logo_documentos_url,
              logo_alternativo_url,
              razon_social,
              rfc
            `)
            .eq('company_id', profile.company_id)
            .maybeSingle()

          setEmpresaConfig(settings || null)

          try {
            if (settings?.logo_url) {
              localStorage.setItem('obrix_empresa_logo', settings.logo_url)
            } else {
              localStorage.removeItem('obrix_empresa_logo')
            }
          } catch (_) {}
        } catch (_) {
          setEmpresaConfig(null)
        }
      }
    } catch (err) {
      console.error('[AuthContext] loadUserProfile error:', err)
      setUserProfile(null)
      setEmpresaConfig(null)
    }
  }

  const refrescarEmpresaConfig = async () => {
    if (!userProfile?.company_id) return
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select(`
          logo_url,
          logo_documentos_url,
          logo_alternativo_url,
          razon_social,
          rfc
        `)
        .eq('company_id', userProfile.company_id)
        .maybeSingle()
      setEmpresaConfig(settings || null)
    } catch (_) {}
  }

  const login = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) throw result.error
    return result.data
  }

  const logout = async () => {
    const result = await supabase.auth.signOut()
    if (result.error) throw result.error
    setUser(null)
    setUserProfile(null)
    setEmpresaConfig(null)
    currentUserId.current = null
    try { localStorage.removeItem('obrix_empresa_logo') } catch (_) {}
  }

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        await loadUserProfile(session.user.id)
      }

      initialized.current = true
      setLoading(false)
    }

    initAuth()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initialized.current) return
        if (!mounted) return

        const incomingUserId = session?.user?.id ?? null

        // PROTECCIÓN: Si el evento es SIGNED_IN con un userId DIFERENTE
        // al admin actual, significa que se creó un nuevo usuario y
        // Supabase generó un token para él — ignorar ese evento
        if (
          event === 'SIGNED_IN' &&
          currentUserId.current &&
          incomingUserId &&
          incomingUserId !== currentUserId.current
        ) {
          console.warn('[AuthContext] Ignorando SIGNED_IN de usuario diferente al admin actual')
          return
        }

        setUser(session?.user ?? null)

        if (incomingUserId) {
          await loadUserProfile(incomingUserId)
        } else {
          setUserProfile(null)
          setEmpresaConfig(null)
        }

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
    empresaConfig,
    refrescarEmpresaConfig,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px',
            border: '4px solid #e5e7eb', borderTopColor: '#2563eb',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando Obrix...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}