import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Building2, AlertCircle } from 'lucide-react'

export const Login = () => {
  const navigate = useNavigate()
  const { user, loading, login, logout, isAuthenticated } = useAuth()
  
  // 🔍 Debug: ver qué recibimos del contexto
  console.log('[Login] Context values:', {
    user,
    loading,
    login: typeof login,  // Debería decir "function"
    logout: typeof logout,
    isAuthenticated
  })
  
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ email: '', password: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (typeof login !== 'function') {
      console.error('[Login] ERROR: login no es una función!', login)
      setError('Error interno: función de login no disponible')
      return
    }

    try {
      console.log('[Login] Intentando login con:', formData.email)
      await login(formData.email, formData.password)
      console.log('[Login] Login exitoso, redirigiendo...')
      navigate('/dashboard')
    } catch (err) {
      console.error('[Login] Catch error:', err)
      
      if (err?.message?.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos')
      } else if (err?.message?.includes('Email not confirmed')) {
        setError('Confirma tu correo electrónico')
      } else {
        setError('Error: ' + (err?.message || 'Desconocido'))
      }
    }
  }

  // Si está cargando, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Si ya está autenticado, redirigir
  if (isAuthenticated) {
    navigate('/dashboard')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Títulos */}
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Obrix</h1>
        <p className="text-center text-gray-500 mb-8">Control de Inventarios Eléctricos</p>
        
        {/* Mensaje de error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 flex items-start">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="admin@obrix.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}