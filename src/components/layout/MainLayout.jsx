import { useState, useRef, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Bell, Menu, X, User, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const MainLayout = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { user, userProfile, logout }   = useAuth()
  const dropdownRef                     = useRef(null)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName  = userProfile?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const avatarLetter = displayName[0]?.toUpperCase() || 'U'

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>

      {/* ── Overlay móvil ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40, display: 'none' }}
          className="mobile-overlay"
        />
      )}

      {/* ── Sidebar ── */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Contenido Principal ── */}
      <div className="main-content">

        {/* ── Header ── */}
        <header style={{
          height: '64px', backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', position: 'sticky', top: 0, zIndex: 30
        }}>

          {/* Izquierda: hamburguesa (móvil) + título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hamburger-btn"
              style={{ padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#6b7280', display: 'none' }}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
              {title}
            </h1>
          </div>

          {/* Derecha: campana + avatar con dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Notificaciones */}
            <button style={{
              position: 'relative', padding: '8px', borderRadius: '8px',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#6b7280'
            }}>
              <Bell size={20} />
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '8px', height: '8px', backgroundColor: '#ef4444',
                borderRadius: '50%', border: '2px solid white'
              }} />
            </button>

            {/* Avatar + Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '4px 10px 4px 4px',
                  backgroundColor: dropdownOpen ? '#eff6ff' : 'transparent',
                  border: dropdownOpen ? '1px solid #bfdbfe' : '1px solid transparent',
                  borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { if (!dropdownOpen) e.currentTarget.style.backgroundColor = '#f9fafb' }}
                onMouseLeave={(e) => { if (!dropdownOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                {/* Círculo avatar */}
                <div style={{
                  width: '32px', height: '32px', backgroundColor: '#dbeafe',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: '700', color: '#1d4ed8',
                  fontSize: '14px', flexShrink: 0
                }}>
                  {avatarLetter}
                </div>
                {/* Nombre — oculto en móvil */}
                <span className="avatar-name" style={{
                  fontSize: '14px', fontWeight: '500', color: '#374151',
                  maxWidth: '120px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {displayName}
                </span>
                <ChevronDown size={14} color="#9ca3af" style={{
                  transition: 'transform 0.2s',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                }} />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  backgroundColor: '#ffffff', border: '1px solid #e5e7eb',
                  borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  minWidth: '200px', overflow: 'hidden', zIndex: 100
                }}>
                  {/* Info usuario */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                      {displayName}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email || ''}
                    </p>
                  </div>

                  {/* Mi Perfil */}
                  <button
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 16px', border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', fontSize: '14px', color: '#374151',
                      transition: 'background-color 0.15s', textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <User size={16} color="#6b7280" />
                    Mi Perfil
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#f3f4f6', margin: '0 8px' }} />

                  {/* Cerrar Sesión */}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 16px', border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', fontSize: '14px', color: '#dc2626',
                      transition: 'background-color 0.15s', textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={16} color="#dc2626" />
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main style={{ padding: '24px' }}>
          {children}
        </main>
      </div>

      {/* ── Estilos Responsive ── */}
      <style>{`
        @media (min-width: 1024px) {
          .main-content   { margin-left: 260px; }
          .hamburger-btn  { display: none !important; }
          .mobile-overlay { display: none !important; }
        }
        @media (max-width: 1023px) {
          .main-content              { margin-left: 0; }
          .hamburger-btn             { display: flex !important; }
          .mobile-overlay            { display: block !important; }
          .avatar-name               { display: none; }
        }
      `}</style>
    </div>
  )
}