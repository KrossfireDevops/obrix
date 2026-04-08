// ============================================================
//  OBRIX ERP — HomeRedirect  v1.1
//  src/components/HomeRedirect.jsx
//
//  Lee home_path desde users_profiles en Supabase.
//  localStorage actúa solo como caché para velocidad,
//  pero la fuente de verdad siempre es la BD.
// ============================================================

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../config/supabase'

export default function HomeRedirect() {
  const [homePath, setHomePath] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setHomePath('/dashboard'); return }

        const { data, error } = await supabase
          .from('users_profiles')
          .select('home_path')
          .eq('id', user.id)
          .single()

        if (error || !data?.home_path) {
          // Columna no existe todavía o sin valor → dashboard
          setHomePath('/dashboard')
          return
        }

        // Actualizar caché y redirigir
        localStorage.setItem('obrix_home_path', data.home_path)
        setHomePath(data.home_path)

      } catch {
        setHomePath('/dashboard')
      }
    }

    load()
  }, [])

  // Mientras carga, mostrar nada — ProtectedRoute ya tiene el spinner
  if (!homePath) return null

  return <Navigate to={homePath} replace />
}