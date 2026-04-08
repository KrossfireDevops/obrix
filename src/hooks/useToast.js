// src/hooks/useToast.js
import { useState, useCallback } from 'react'

let toastId = 0

export const useToast = () => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, type, title, message, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Atajos convenientes
  const toast = {
    success: (message, title = '¡Éxito!')   => addToast({ type: 'success', title, message }),
    error:   (message, title = 'Error')     => addToast({ type: 'error',   title, message }),
    warning: (message, title = 'Atención')  => addToast({ type: 'warning', title, message }),
    info:    (message, title = 'Información') => addToast({ type: 'info',  title, message }),
  }

  return { toasts, toast, removeToast }
}