// ============================================================
//  OBRIX — Hook: cierre de sesión por inactividad
//  src/hooks/useInactividad.js
//
//  Uso: importar en App.jsx dentro de un componente que
//  solo se monte cuando el usuario está autenticado.
//
//  Comportamiento:
//  · 27 min sin actividad → aviso modal con cuenta regresiva
//  · 30 min sin actividad → cierra sesión y va a /login
//  · Cualquier evento del usuario resetea el contador
// ============================================================
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../config/supabase'

// ─── Configuración (en milisegundos) ────────────────────────
const TIEMPO_INACTIVIDAD   = 30 * 60 * 1000   // 30 minutos → cierre de sesión
const TIEMPO_ADVERTENCIA   =  3 * 60 * 1000   // 3 minutos antes → mostrar aviso
const TIEMPO_AVISO         = TIEMPO_INACTIVIDAD - TIEMPO_ADVERTENCIA

// Eventos que se consideran "actividad del usuario"
const EVENTOS_ACTIVIDAD = [
  'mousedown', 'mousemove', 'keydown',
  'scroll', 'touchstart', 'click', 'focus',
]

export function useInactividad({ onAdvertencia, onCerrarSesion, activo = true }) {
  const timerCierre     = useRef(null)
  const timerAdvertencia = useRef(null)
  const avisandoRef     = useRef(false)

  const limpiarTimers = useCallback(() => {
    if (timerCierre)      clearTimeout(timerCierre.current)
    if (timerAdvertencia) clearTimeout(timerAdvertencia.current)
  }, [])

  const cerrarSesion = useCallback(async () => {
    limpiarTimers()
    await supabase.auth.signOut()
    if (onCerrarSesion) onCerrarSesion()
  }, [limpiarTimers, onCerrarSesion])

  const resetear = useCallback(() => {
    if (!activo) return

    limpiarTimers()
    avisandoRef.current = false

    // Timer de advertencia (27 min)
    timerAdvertencia.current = setTimeout(() => {
      avisandoRef.current = true
      if (onAdvertencia) onAdvertencia()
    }, TIEMPO_AVISO)

    // Timer de cierre (30 min)
    timerCierre.current = setTimeout(() => {
      cerrarSesion()
    }, TIEMPO_INACTIVIDAD)
  }, [activo, limpiarTimers, onAdvertencia, cerrarSesion])

  useEffect(() => {
    if (!activo) return

    // Arrancar timers al montar
    resetear()

    // Escuchar eventos de actividad
    EVENTOS_ACTIVIDAD.forEach(evento =>
      window.addEventListener(evento, resetear, { passive: true })
    )

    return () => {
      limpiarTimers()
      EVENTOS_ACTIVIDAD.forEach(evento =>
        window.removeEventListener(evento, resetear)
      )
    }
  }, [activo, resetear, limpiarTimers])

  // Exponer función para que el modal "Continuar" resetee el timer
  return { resetear, cerrarSesion }
}
