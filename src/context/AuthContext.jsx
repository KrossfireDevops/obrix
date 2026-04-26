// src/context/AuthContext.jsx
// v2.0 — Abril 2026
// Cambios:
//   - loadUserProfile ahora también carga company_settings
//     para obtener los 3 logos de la empresa
//   - Expone `empresaConfig` en el contexto con:
//       logo_url            → Logo Sistema (Login + Sidebar)
//       logo_documentos_url → Logo PDFs
//       logo_alternativo_url→ Logo especial por formato
//       razon_social, rfc   → Para mostrar en UI

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
  const [empresaConfig, setEmpresaConfig] = useState(null)  // ← NUEVO
  const [loading,       setLoading]       = useState(true)
  const initialized                       = useRef(false)

  // ── Cargar perfil + config de empresa ───────────────────────────────
  const loadUserProfile = async (userId) => {
    if (!userId) {
      setUserProfile(null)
      setEmpresaConfig(null)
      return
    }
    try {
      // 1. Cargar perfil del usuario
      const { data: profile, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      console.log('[AuthContext] loadUserProfile result:', { data: profile, error })
      setUserProfile(profile || null)

      // 2. Cargar config de empresa (logos + datos fiscales básicos)
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

          // Guardar logo en localStorage para que Login.jsx
          // lo muestre en la próxima visita (antes de autenticarse)
          try {
            if (settings?.logo_url) {
              localStorage.setItem('obrix_empresa_logo', settings.logo_url)
            } else {
              localStorage.removeItem('obrix_empresa_logo')
            }
          } catch (_) {}

        } catch (_) {
          // Si falla la carga de logos, no romper la sesión
          setEmpresaConfig(null)
        }
      }
    } catch (err) {
      console.log('[AuthContext] loadUserProfile catch:', err)
      setUserProfile(null)
      setEmpresaConfig(null)
    }
  }

  // ── Función para refrescar solo la config de empresa ────────────────
  // Se llama desde CompanySettings después de guardar logos nuevos
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
    setEmpresaConfig(null)
    // Limpiar logo guardado para que el Login muestre OBRIX
    try { localStorage.removeItem('obrix_empresa_logo') } catch (_) {}
  }

  // ── Inicializar sesión ───────────────────────────────────────────────
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
    empresaConfig,          // ← NUEVO: logos + razon_social + rfc
    refrescarEmpresaConfig, // ← NUEVO: para refrescar tras guardar logos
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