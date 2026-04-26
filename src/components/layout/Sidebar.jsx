// src/components/layout/Sidebar.jsx
// v3.3 — Abril 2026
// Cambios vs v3.2:
//   - Logo dinámico: lee logo_url desde empresaConfig (AuthContext)
//     Si la empresa tiene logo configurado lo muestra,
//     si no, fallback al logo de OBRIX (Obrix_V3_web.png)

import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Package, FileText, Settings, X,
  FolderOpen, GitBranch, BarChart2, TrendingUp, TrendingDown,
  Users, ChevronDown, ChevronRight, ClipboardList, BookOpen,
  Building2, BadgeCheck, Handshake, Inbox, ReceiptText,
  Scale, List, ShoppingCart, Truck, Store, HardHat, UserCheck,
  CalendarDays, GanttChartSquare, Receipt, BadgeDollarSign,
  PiggyBank, BarChart3, SlidersHorizontal, DollarSign,
  Wallet, GripVertical, Home,
  Landmark, GitMerge, FilePlus2, Stamp,
} from 'lucide-react'
import { ClipboardCheck, Shield, Zap, FileKey2, ShieldCheck } from 'lucide-react'
import UserPreferencesModal from '../UserPreferencesModal'

// ─────────────────────────────────────────────────────────────
// ESTRUCTURA DEL MENÚ
// ─────────────────────────────────────────────────────────────
const MENU_STRUCTURE = [
  {
    type: 'item', name: 'Dashboard', path: '/dashboard',
    icon: LayoutDashboard, module: 'dashboard', standalone: true,
  },

  { type: 'section', name: 'OPERACIÓN DE OBRA', icon: FolderOpen },
  { type: 'item', name: 'Proyectos',        path: '/projects',         icon: FolderOpen,       module: 'projects'     },
  { type: 'item', name: 'Árbol de Proyecto',path: '/project-tree',     icon: GitBranch,        module: 'project_tree' },
  { type: 'item', name: 'Avances de Obra',  path: '/obra/avances',     icon: TrendingUp,       module: 'projects'     },
  { type: 'item', name: 'Calendarios',      path: '/obra/calendarios', icon: CalendarDays,     module: 'projects'     },
  { type: 'item', name: 'Programa de Obra', path: '/obra/programa',    icon: GanttChartSquare, module: 'projects'     },
  { type: 'item', name: 'Asistencia',       path: '/attendance',       icon: ClipboardCheck,   module: 'attendance'   },

  { type: 'section', name: 'PERSONAL', icon: HardHat },
  {
    type: 'group', name: 'Gestión de Personal', icon: HardHat, module: 'personal',
    children: [
      { name: 'Directorio',  path: '/personal',               icon: UserCheck, module: 'personal' },
      { name: 'Pre-Nómina',  path: '/personal?tab=prenomina', icon: FileText,  module: 'personal' },
    ],
  },

  { type: 'section', name: 'MATERIALES', icon: Package },
  { type: 'item', name: 'Inventario', path: '/inventory', icon: Package, module: 'inventory' },
  {
    type: 'group', name: 'Gestión de Materiales', icon: ClipboardList, module: 'movements',
    children: [
      { name: 'Solicitudes de Material', path: '/materials/requests', icon: FileText, module: 'movements' },
      { name: 'Maestro de Materiales',   path: '/materials/catalog',  icon: BookOpen, module: 'materials' },
    ],
  },

  { type: 'section', name: 'COMPRAS', icon: ShoppingCart },
  { type: 'item', name: 'Proveedores', path: '/compras/proveedores', icon: Store, module: 'compras' },
  {
    type: 'group', name: 'Órdenes de Compra', icon: ShoppingCart, module: 'compras',
    children: [
      { name: 'Todas las OC',      path: '/compras/ordenes',                        icon: ClipboardList, module: 'compras' },
      { name: 'Nueva OC Directa',  path: '/compras/ordenes/nueva?origen=directa',   icon: FileText,      module: 'compras' },
      { name: 'Desde Solicitud',   path: '/compras/ordenes/nueva?origen=solicitud', icon: Truck,         module: 'compras' },
    ],
  },

  { type: 'section', name: 'GASTOS', icon: Receipt },
  { type: 'item', name: 'Mis Gastos',   path: '/gastos/mis-gastos',      icon: Receipt,        module: 'gastos' },
  { type: 'item', name: 'Aprobaciones', path: '/gastos/aprobaciones',    icon: BadgeDollarSign, module: 'gastos' },
  { type: 'item', name: 'Reembolsos',   path: '/gastos/reembolsos',      icon: PiggyBank,       module: 'gastos' },
  { type: 'item', name: 'Caja Chica',   path: '/gastos/reposicion-caja', icon: Wallet,          module: 'gastos' },
  { type: 'item', name: 'Consolidado',  path: '/gastos/consolidado',     icon: BarChart3,       module: 'gastos' },

  { type: 'section', name: 'COMERCIAL', icon: TrendingUp },
  { type: 'item', name: 'Pipeline',            path: '/comercial/pipeline',         icon: TrendingUp, module: 'comercial' },
  { type: 'item', name: 'Nueva Cotización',    path: '/comercial/cotizacion/nueva', icon: FileText,   module: 'comercial' },
  { type: 'item', name: 'Nuevo Contrato',      path: '/comercial/contrato/nuevo',   icon: Shield,     module: 'comercial' },
  { type: 'item', name: 'Anticipo / Proyecto', path: '/comercial/anticipo',         icon: Zap,        module: 'comercial' },
  { type: 'item', name: 'Dashboard Comercial', path: '/comercial/dashboard',        icon: BarChart2,  module: 'comercial' },

  { type: 'section', name: 'FACTURACIÓN', icon: Stamp },
  { type: 'item', name: 'Mis Facturas',  path: '/facturacion',       icon: ReceiptText, module: 'facturacion' },
  { type: 'item', name: 'Nueva Factura', path: '/facturacion/nueva', icon: FilePlus2,   module: 'facturacion' },

  { type: 'section', name: 'TESORERÍA', icon: Landmark },
  { type: 'item', name: 'Posición de Caja',   path: '/tesoreria',             icon: Landmark,     module: 'tesoreria' },
  { type: 'item', name: 'Bancos',             path: '/tesoreria/bancos',       icon: Building2,    module: 'tesoreria' },
  { type: 'item', name: 'Conciliación',       path: '/tesoreria/conciliacion', icon: GitMerge,     module: 'tesoreria' },
  { type: 'item', name: 'Cuentas por Cobrar', path: '/tesoreria/cxc',          icon: TrendingUp,   module: 'tesoreria' },
  { type: 'item', name: 'Cuentas por Pagar',  path: '/tesoreria/cxp',          icon: TrendingDown, module: 'tesoreria' },

  { type: 'section', name: 'RELACIONES COMERCIALES', icon: Handshake },
  {
    type: 'group', name: 'Clientes y Proveedores', icon: Handshake, module: 'fiscal',
    children: [
      { name: 'Administrar Terceros', path: '/relaciones/terceros', icon: BadgeCheck, module: 'fiscal' },
    ],
  },

  { type: 'section', name: 'FINANZAS', icon: Scale },
  {
    type: 'group', name: 'Gestión Financiera', icon: Scale, module: 'fiscal',
    children: [
      { name: 'Buzón Fiscal SAT',      path: '/contabilidad/buzon',       icon: Inbox,       module: 'fiscal' },
      { name: 'Libro Mayor',           path: '/contabilidad/libro-mayor', icon: BookOpen,    module: 'fiscal' },
      { name: 'Pólizas',               path: '/contabilidad/polizas',     icon: FileText,    module: 'fiscal' },
      { name: 'Presupuesto',           path: '/contabilidad/presupuesto', icon: TrendingUp,  module: 'fiscal' },
      { name: 'Catálogo de Cuentas',   path: '/contabilidad/cuentas',     icon: List,        module: 'fiscal' },
      { name: 'Cont. Electrónica SAT', path: '/contabilidad/electronica', icon: ReceiptText, module: 'fiscal' },
    ],
  },

  { type: 'section', name: 'ANÁLISIS Y REPORTES', icon: BarChart2 },
  { type: 'item', name: 'Reportes',             path: '/reports',                   icon: BarChart2,  module: 'reports' },
  { type: 'item', name: 'Avance de Proyectos',  path: '/reports/projects-progress', icon: TrendingUp, module: 'reports' },
  { type: 'item', name: 'Avance por Nodo',      path: '/reports/node-progress',     icon: GitBranch,  module: 'reports' },
  { type: 'item', name: 'Reportes Financieros', path: '/reportes/financieros',      icon: DollarSign, module: 'reports' },

  { type: 'section', name: 'ADMINISTRACIÓN', icon: Settings },
  { type: 'item', name: 'Usuarios',       path: '/admin/users',         icon: Users,             module: 'users_admin'  },
  { type: 'item', name: 'Config. Gastos', path: '/admin/gastos-config', icon: SlidersHorizontal, module: 'gastos_admin' },
  {
    type: 'group', name: 'Configuración', icon: Settings, module: 'settings',
    children: [
      { name: 'Empresa', path: '/settings/company', icon: Building2, module: 'settings' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Helper — sección activa según la ruta
// ─────────────────────────────────────────────────────────────
const getSectionOfPath = (pathname) => {
  let currentSection = null
  for (const item of MENU_STRUCTURE) {
    if (item.type === 'section') { currentSection = item.name; continue }
    if (item.standalone) continue
    if (item.type === 'item') {
      const base = item.path.split('?')[0]
      if (pathname.startsWith(base) && base !== '/') return currentSection
    }
    if (item.type === 'group' && item.children) {
      for (const child of item.children) {
        const base = child.path.split('?')[0]
        if (pathname.startsWith(base) && base !== '/') return currentSection
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────
const itemStyle = (isActive) => ({
  display: 'flex', alignItems: 'center',
  padding: '9px 14px', marginBottom: '2px',
  borderRadius: '10px', textDecoration: 'none',
  backgroundColor: isActive ? '#eff6ff' : 'transparent',
  color: isActive ? '#1d4ed8' : '#374151',
  fontWeight: isActive ? '600' : '500',
  fontSize: '13.5px', transition: 'background-color 0.15s',
  border: 'none', width: '100%', cursor: 'pointer',
  textAlign: 'left', boxSizing: 'border-box',
})

const subItemStyle = (isActive) => ({
  display: 'flex', alignItems: 'center',
  padding: '7px 12px 7px 18px', marginBottom: '1px',
  borderRadius: '9px', textDecoration: 'none',
  backgroundColor: isActive ? '#eff6ff' : 'transparent',
  color: isActive ? '#1d4ed8' : '#6b7280',
  fontWeight: isActive ? '600' : '400',
  fontSize: '13px', transition: 'background-color 0.15s',
})

// ─────────────────────────────────────────────────────────────
// MenuGroup
// ─────────────────────────────────────────────────────────────
const MenuGroup = ({ group, canAccess, onClose, openGroup, setOpenGroup, toggleFavorite, favorites }) => {
  const location = useLocation()
  const isAnyChildActive = group.children.some(c => location.pathname.startsWith(c.path.split('?')[0]))
  const open = openGroup === group.name || isAnyChildActive
  const visibleChildren = group.children.filter(c => canAccess(c.module))
  if (visibleChildren.length === 0) return null

  return (
    <div style={{ marginBottom: '2px' }}>
      <button
        onClick={() => setOpenGroup(open && !isAnyChildActive ? null : group.name)}
        style={{ ...itemStyle(isAnyChildActive), justifyContent: 'space-between' }}
        onMouseEnter={e => { if (!isAnyChildActive) e.currentTarget.style.backgroundColor = '#f9fafb' }}
        onMouseLeave={e => { if (!isAnyChildActive) e.currentTarget.style.backgroundColor = isAnyChildActive ? '#eff6ff' : 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <group.icon size={17} style={{ marginRight: '11px', flexShrink: 0 }} />
          {group.name}
        </div>
        <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: '#9ca3af', flexShrink: 0 }} />
      </button>
      <div style={{ overflow: 'hidden', maxHeight: open ? `${visibleChildren.length * 46}px` : '0px', transition: 'max-height 0.25s ease', paddingLeft: '6px' }}>
        <div style={{ borderLeft: '2px solid #e5e7eb', marginLeft: '20px', paddingLeft: '4px' }}>
          {visibleChildren.map(child => {
            const isFav = favorites.some(f => f.path === child.path)
            return (
              <NavLink key={child.path} to={child.path} onClick={onClose}
                style={({ isActive }) => subItemStyle(isActive)}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.backgroundColor = 'transparent' }}>
                <child.icon size={14} style={{ marginRight: '9px', flexShrink: 0 }} />
                {child.name}
                <span onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(child) }}
                  style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: '13px', color: isFav ? '#f59e0b' : '#d1d5db', transition: 'color 0.2s' }}
                  title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
                  {isFav ? '★' : '☆'}
                </span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────
const SectionHeader = ({ name, icon: Icon, isOpen, isActive, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '8px 10px', marginTop: '6px', marginBottom: isOpen ? '4px' : '2px',
      borderRadius: '9px', border: 'none', cursor: 'pointer',
      background: isActive ? '#EFF6FF' : 'transparent', transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb' }}
    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      {Icon && <Icon size={13} style={{ color: isActive ? '#2563EB' : '#9CA3AF', flexShrink: 0 }} />}
      <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', color: isActive ? '#2563EB' : '#9CA3AF' }}>
        {name}
      </span>
    </div>
    {isOpen
      ? <ChevronDown  size={12} style={{ color: isActive ? '#2563EB' : '#C4C9D4' }} />
      : <ChevronRight size={12} style={{ color: '#C4C9D4' }} />}
  </button>
)

// ─────────────────────────────────────────────────────────────
// SIDEBAR PRINCIPAL
// ─────────────────────────────────────────────────────────────
export const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const { canAccess } = usePermission()
  const { empresaConfig } = useAuth()  // ← NUEVO: logo dinámico
  const location = useLocation()
  const [showPrefs, setShowPrefs] = useState(false)

  // Logo dinámico: usa el de la empresa si existe, sino el de OBRIX
  const logoSrc    = empresaConfig?.logo_url || '/Obrix_V3_web.png'
  const logoSrcSet = empresaConfig?.logo_url
    ? `${empresaConfig.logo_url} 1x, ${empresaConfig.logo_url} 2x`
    : '/Obrix_V3_web.png 1x, /Obrix_V3.png 2x'
  const logoAlt    = empresaConfig?.razon_social || 'Obrix'

  const activeSectionName = getSectionOfPath(location.pathname)

  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = localStorage.getItem('obrix_open_sections')
      if (saved) return JSON.parse(saved)
    } catch {}
    return activeSectionName ? { [activeSectionName]: true } : {}
  })

  useEffect(() => {
    if (activeSectionName) {
      setOpenSections(prev => {
        const next = { ...prev, [activeSectionName]: true }
        localStorage.setItem('obrix_open_sections', JSON.stringify(next))
        return next
      })
    }
  }, [activeSectionName])

  const toggleSection = (name) => {
    setOpenSections(prev => {
      const next = { ...prev, [name]: !prev[name] }
      localStorage.setItem('obrix_open_sections', JSON.stringify(next))
      return next
    })
  }

  const [openGroup, setOpenGroup] = useState(null)

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('obrix_favorites')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  const toggleFavorite = (item) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.path === item.path)
      const next   = exists
        ? prev.filter(f => f.path !== item.path)
        : [...prev, { name: item.name, path: item.path, module: item.module }]
      localStorage.setItem('obrix_favorites', JSON.stringify(next.map(f => ({ name: f.name, path: f.path, module: f.module }))))
      return next
    })
  }

  const dragIdx = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const handleDragStart = (idx) => { dragIdx.current = idx }
  const handleDragOver  = (e, idx) => { e.preventDefault(); setDragOver(idx) }
  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) { setDragOver(null); return }
    setFavorites(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(idx, 0, moved)
      localStorage.setItem('obrix_favorites', JSON.stringify(next.map(f => ({ name: f.name, path: f.path, module: f.module }))))
      return next
    })
    dragIdx.current = null; setDragOver(null)
  }
  const handleDragEnd = () => { dragIdx.current = null; setDragOver(null) }

  const [search, setSearch] = useState('')

  const MODULOS_LIBRES = new Set([
    'fiscal','compras','personal','gastos','gastos_admin',
    'comercial','settings','facturacion','tesoreria',
  ])
  const canAccessFiscal = (module) => MODULOS_LIBRES.has(module) ? true : canAccess(module)

  const renderMenu = () => {
    if (search) {
      return MENU_STRUCTURE
        .filter(item => {
          if (item.type === 'section') return false
          if (item.standalone) return item.name.toLowerCase().includes(search.toLowerCase())
          if (item.type === 'item')  return item.name.toLowerCase().includes(search.toLowerCase())
          if (item.type === 'group') return item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.children.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
          return false
        })
        .filter(item => canAccessFiscal(item.module))
        .map((item, idx) => renderItem(item, idx))
    }

    const sections = []
    let currentSection = null
    let sectionItems   = []
    const flush = () => {
      if (currentSection) sections.push({ section: currentSection, items: sectionItems })
      else if (sectionItems.length) sections.push({ section: null, items: sectionItems })
    }
    for (const item of MENU_STRUCTURE) {
      if (item.type === 'section') { flush(); currentSection = item; sectionItems = [] }
      else sectionItems.push(item)
    }
    flush()

    return sections.map(({ section, items }, sIdx) => {
      if (!section) {
        return items.filter(i => canAccessFiscal(i.module)).map((item, idx) => renderItem(item, `standalone-${idx}`))
      }
      const isOpen   = !!openSections[section.name]
      const isActive = activeSectionName === section.name
      const hasAccess = items.some(i =>
        i.type === 'item'  ? canAccessFiscal(i.module) :
        i.type === 'group' ? i.children.some(c => canAccessFiscal(c.module)) : false
      )
      if (!hasAccess) return null
      return (
        <div key={`section-${sIdx}`}>
          <SectionHeader name={section.name} icon={section.icon} isOpen={isOpen} isActive={isActive} onToggle={() => toggleSection(section.name)} />
          <div style={{ overflow: 'hidden', maxHeight: isOpen ? '2000px' : '0px', transition: 'max-height 0.3s ease', paddingLeft: '4px' }}>
            {items.filter(i => canAccessFiscal(i.module)).map((item, idx) => renderItem(item, `${section.name}-${idx}`))}
          </div>
        </div>
      )
    })
  }

  const renderItem = (item, key) => {
    if (item.type === 'group') {
      if (!canAccessFiscal(item.module)) return null
      return <MenuGroup key={`group-${key}`} group={item} canAccess={canAccessFiscal} onClose={onClose} openGroup={openGroup} setOpenGroup={setOpenGroup} toggleFavorite={toggleFavorite} favorites={favorites} />
    }
    const isFav = favorites.some(f => f.path === item.path)
    return (
      <NavLink key={item.path} to={item.path} onClick={onClose}
        style={({ isActive }) => itemStyle(isActive)}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
        onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <item.icon size={17} style={{ marginRight: '11px', flexShrink: 0 }} />
        {item.name}
        <span onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item) }}
          style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: '13px', color: isFav ? '#f59e0b' : '#d1d5db', transition: 'color 0.2s' }}
          title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
          {isFav ? '★' : '☆'}
        </span>
      </NavLink>
    )
  }

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 }} className="lg-hidden" />
      )}

      <div style={{ width: '260px', height: '100vh', position: 'fixed', left: 0, top: 0, backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', zIndex: 50, transition: 'transform 0.3s ease' }}
        className={`sidebar-panel ${isOpen ? 'sidebar-open' : ''}`}
      >
        {/* ── Logo dinámico ── */}
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <img
            src={logoSrc}
            srcSet={logoSrcSet}
            alt={logoAlt}
            style={{ height: '52px', width: 'auto', maxWidth: '180px', objectFit: 'contain', display: 'block' }}
            onError={e => {
              // Fallback al logo de OBRIX si la URL del cliente falla
              e.currentTarget.src    = '/Obrix_V3_web.png'
              e.currentTarget.srcset = '/Obrix_V3_web.png 1x, /Obrix_V3.png 2x'
            }}
          />
          <button onClick={onClose} className="sidebar-close-btn" style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#6b7280', display: 'none' }}>
            <X size={20} />
          </button>
        </div>

        {/* Buscador */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <input type="text" placeholder="🔎 Buscar módulo..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Menú */}
        <nav style={{ flex: 1, padding: '10px 10px 20px', overflowY: 'auto' }}>

          {/* Favoritos */}
          {!search && favorites.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px 4px', fontSize: '10px', fontWeight: '700', color: '#9CA3AF', letterSpacing: '0.08em' }}>
                <span>⭐ FAVORITOS</span>
                <span style={{ fontSize: '9px', color: '#C4C9D4', fontWeight: 400 }}>· arrastra para ordenar</span>
              </div>
              {favorites.map((item, idx) => {
                const original = MENU_STRUCTURE.find(m => m.path === item.path || m.children?.some(c => c.path === item.path))
                  || MENU_STRUCTURE.flatMap(m => m.children || []).find(c => c.path === item.path)
                const IconComp = original?.icon || FileText
                const isDragTarget = dragOver === idx
                return (
                  <div key={item.path} draggable
                    onDragStart={() => handleDragStart(idx)} onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => handleDrop(e, idx)} onDragEnd={handleDragEnd}
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '2px', borderRadius: '10px', border: isDragTarget ? '1.5px dashed #93C5FD' : '1.5px solid transparent', background: isDragTarget ? '#EFF6FF' : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}
                  >
                    <span style={{ cursor: 'grab', padding: '9px 4px 9px 8px', color: '#D1D5DB', flexShrink: 0, display: 'flex', alignItems: 'center' }} title="Arrastra para reordenar">
                      <GripVertical size={13} />
                    </span>
                    <NavLink to={item.path} onClick={onClose}
                      style={({ isActive }) => ({ ...itemStyle(isActive), flex: 1, padding: '8px 8px 8px 4px', marginBottom: 0 })}>
                      <IconComp size={16} style={{ marginRight: '9px', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '13px' }}>{item.name}</span>
                      <span onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item) }}
                        style={{ cursor: 'pointer', fontSize: '13px', color: '#f59e0b', marginLeft: '4px' }} title="Quitar de favoritos">★</span>
                    </NavLink>
                  </div>
                )
              })}
              <div style={{ borderTop: '1px solid #F1F5F9', margin: '8px 0 4px' }} />
            </div>
          )}

          {renderMenu()}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '10px 12px', flexShrink: 0 }}>
          <button onClick={() => setShowPrefs(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
            onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}
          >
            <Home size={15} color="#6B7280" />
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: 0 }}>Pantalla inicial</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                {localStorage.getItem('obrix_home_path')?.replace('/','')?.replace(/-/g,' ') || 'dashboard'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {showPrefs && <UserPreferencesModal onClose={() => setShowPrefs(false)} />}

      <style>{`
        @media (min-width: 1024px) {
          .sidebar-panel     { transform: translateX(0) !important; }
          .sidebar-close-btn { display: none !important; }
          .lg-hidden         { display: none !important; }
        }
        @media (max-width: 1023px) {
          .sidebar-panel              { transform: translateX(-100%); }
          .sidebar-panel.sidebar-open { transform: translateX(0); }
          .sidebar-close-btn          { display: flex !important; }
        }
        nav::-webkit-scrollbar       { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 9999px; }
        nav::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}</style>
    </>
  )
}