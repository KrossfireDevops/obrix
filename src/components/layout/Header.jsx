import { Bell, Search, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const Header = ({ title, onMenuToggle }) => {
  const { user } = useAuth()

  return (
    <header className="bg-white border-b border-gray-200 h-16 sticky top-0 z-30">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Título */}
        <h1 className="text-lg lg:text-xl font-semibold text-gray-900 hidden sm:block">
          {title}
        </h1>

        {/* Acciones */}
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Búsqueda */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 w-48 lg:w-64 border border-gray-300 rounded-lg 
                text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
                outline-none transition-all"
            />
          </div>

          {/* Notificaciones */}
          <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>

          {/* Perfil Mobile */}
          <div className="flex items-center space-x-2 lg:hidden">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-700">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}