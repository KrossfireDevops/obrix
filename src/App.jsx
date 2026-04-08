import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './config/supabase'
import { Login } from './pages/auth/Login'
import { MainLayout } from './components/layout/MainLayout'
import { InventoryList } from './pages/inventory/InventoryList'
import { AddMovement } from './pages/inventory/AddMovement'
import { MovementHistory } from './pages/movements/MovementHistory'
import { Reports } from './pages/reports/Reports'
import { ProjectsPage } from './pages/projects/ProjectsPage'
import { ProjectTree } from './pages/projects/ProjectTree'
import { Attendance } from './pages/attendance/Attendance'
import { MaterialCatalog } from './pages/materials/MaterialCatalog'
import { CompanySettings } from './pages/settings/CompanySettings'
import { MaterialRequestsV2 } from './pages/materials/MaterialRequestsV2'
import { UsersAdmin } from './pages/admin/UsersAdmin'
import { ProjectsProgressReport } from './pages/reports/ProjectsProgressReport'
import { NodeProgressReport }      from './pages/reports/NodeProgressReport'
import ReportesFinancieros          from './pages/reports/ReportesFinancieros'

// ── Relaciones Comerciales ────────────────────────────────────
import { TercerosList } from './pages/relaciones/TercerosList'
import { TerceroForm }  from './pages/relaciones/TerceroForm'
import { TerceroDetail } from './pages/relaciones/TerceroDetail'

// ── Buzón Fiscal SAT ──────────────────────────────────────────
import BuzonFiscal from './pages/contabilidad/BuzonFiscal'

// ── Contabilidad ──────────────────────────────────────────────
import LibroMayor      from './pages/contabilidad/LibroMayor'
import Polizas         from './pages/contabilidad/Polizas'
import PolizaForm      from './pages/contabilidad/PolizaForm'
import Presupuesto     from './pages/contabilidad/Presupuesto'
import CatalogoCuentas from './pages/contabilidad/CatalogoCuentas'
import ContabilidadElectronica from './pages/contabilidad/ContabilidadElectronica'

// ── Facturación CFDI 4.0 ──────────────────────────────────────
import FacturacionPage from './pages/facturacion/FacturacionPage'
import NuevaFactura    from './pages/facturacion/NuevaFactura'
import VisorCFDI       from './pages/facturacion/VisorCFDI'

// ── Tesorería ─────────────────────────────────────────────────
import TesoreriaPage       from './pages/tesoreria/TesoreriaPage'
import BancosPage          from './pages/tesoreria/BancosPage'
import ConciliacionPage    from './pages/tesoreria/ConciliacionPage'
import ConciliacionDetalle from './pages/tesoreria/ConciliacionDetalle'
import CxCPage             from './pages/tesoreria/CxCPage'
import CxCDetalle          from './pages/tesoreria/CxCDetalle'
import CxPPage             from './pages/tesoreria/CxPPage'
import CxPDetalle          from './pages/tesoreria/CxPDetalle'

// ── Obra ──────────────────────────────────────────────────────
import AvancesObra      from './pages/obra/AvancesObra'
import CalendariosPage  from './pages/obra/CalendariosPage'
import ProgramaObraPage from './pages/obra/ProgramaObraPage'

// ── Personal ─────────────────────────────────────────────────
import GestionPersonal from './pages/personal/GestionPersonal'

// ── Compras ───────────────────────────────────────────────────
import ProveedoresPage   from './pages/compras/ProveedoresPage'
import OrdenesCompraPage from './pages/compras/OrdenesCompraPage'
import OrdenCompraForm   from './pages/compras/OrdenCompraForm'

// ── Gastos ────────────────────────────────────────────────────
import MisGastosPage           from './pages/gastos/MisGastosPage'
import AprobacionesPage        from './pages/gastos/AprobacionesPage'
import ReembolsosPage          from './pages/gastos/ReembolsosPage'
import ConsolidadoPage         from './pages/gastos/ConsolidadoPage'
import AdminGastosConfigPage   from './pages/gastos/AdminGastosConfigPage'
import ReposicionCajaChicaPage from './pages/gastos/ReposicionCajaChicaPage'

// ── Seguridad de sesión ──────────────────────────────────────────────
import SesionGuard from './components/auth/SesionGuard'

// ── OBRIX Master (panel privado del Owner — no aparece en Sidebar) ─
import ObrixMaster from './pages/master/ObrixMaster'

// ── Comercial ─────────────────────────────────────────────────
import PipelinePage           from './pages/comercial/PipelinePage'
import CotizacionPage         from './pages/comercial/CotizacionPage'
import ContratoPage           from './pages/comercial/ContratoPage'
import AnticipoPagoPage       from './pages/comercial/AnticipoPagoPage'
import DashboardComercialPage from './pages/comercial/DashboardComercialPage'

// ─── Ruta Protegida ──────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando Obrix...</p>
        </div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <SesionGuard isAuthenticated={isAuthenticated}>
      {children}
    </SesionGuard>
  )
}

// ─── HomeRedirect ─────────────────────────────────────────────
const HomeRedirect = () => {
  const [dest, setDest] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setDest('/dashboard'); return }
      supabase.from('users_profiles').select('home_path').eq('id', user.id).single()
        .then(({ data }) => setDest(data?.home_path || '/dashboard'))
        .catch(() => setDest('/dashboard'))
    })
  }, [])
  if (!dest) return null
  return <Navigate to={dest} replace />
}

// ─── Dashboard ────────────────────────────────────────────────
const Dashboard = () => {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('users_profiles').select('company_id, full_name, role').eq('id', user.id).single()
        if (!profile) return
        const cid = profile.company_id
        const [
          { count: totalProyectos },
          { count: totalOportunidades },
          { count: gastosP },
          { count: solicitudesP },
        ] = await Promise.all([
          supabase.from('projects').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'active'),
          supabase.from('oportunidades').select('*', { count: 'exact', head: true }).eq('company_id', cid).not('estatus', 'in', '("perdido","cancelado","proyecto_activo")'),
          supabase.from('gastos_registros').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('estatus', 'pendiente'),
          supabase.from('material_requests').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'pending'),
        ])
        setData({
          nombre: profile.full_name?.split(' ')[0] || 'Usuario',
          totalProyectos:   totalProyectos    || 0,
          oportunidades:    totalOportunidades || 0,
          gastosPendientes: gastosP           || 0,
          solicitudesP:     solicitudesP      || 0,
        })
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const kpis   = data ? [
    { label: 'Proyectos activos',    value: data.totalProyectos,   color: '#2563EB', bg: '#EFF6FF', icon: '🏗️' },
    { label: 'Pipeline comercial',   value: data.oportunidades,    color: '#7C3AED', bg: '#F5F3FF', icon: '📊' },
    { label: 'Gastos por aprobar',   value: data.gastosPendientes, color: '#D97706', bg: '#FFFBEB', icon: '💸' },
    { label: 'Solicitudes material', value: data.solicitudesP,     color: '#059669', bg: '#F0FDF4', icon: '📦' },
  ] : []

  return (
    <MainLayout title="📊 Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ padding: '18px 22px', borderRadius: 14, background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)', color: '#fff' }}>
          <p style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{saludo}{data ? `, ${data.nombre}` : ''} 👋</p>
          <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: 90, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ padding: '16px 18px', borderRadius: 12, background: k.bg, border: `1px solid ${k.color}22`, display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28 }}>{k.icon}</span>
                <div>
                  <p style={{ fontSize: 11, color: k.color, fontWeight: 600, margin: '0 0 2px', opacity: 0.8 }}>{k.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: '16px 18px', borderRadius: 14, background: '#fff', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Accesos rápidos</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8 }}>
            {[
              { label: 'Proyectos',   path: '/projects',           emoji: '🏗️' },
              { label: 'Pipeline',    path: '/comercial/pipeline',  emoji: '📊' },
              { label: 'Avances',     path: '/obra/avances',        emoji: '📈' },
              { label: 'Mis Gastos',  path: '/gastos/mis-gastos',   emoji: '💸' },
              { label: 'Tesorería',   path: '/tesoreria',           emoji: '🏦' },
              { label: 'Facturación', path: '/facturacion',         emoji: '🧾' },
            ].map(a => (
              <a key={a.path} href={a.path}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB', textDecoration: 'none', color: '#374151', fontSize: 12, fontWeight: 500, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}
              >
                <span style={{ fontSize: 18 }}>{a.emoji}</span>{a.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}

const PlaceholderPage = ({ title }) => (
  <MainLayout title={title}>
    <div style={{ backgroundColor: '#ffffff', padding: '48px', borderRadius: '16px', border: '1px solid #e5e7eb', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚙️</div>
      <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 12px 0' }}>{title}</h3>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Esta funcionalidad estará disponible próximamente.</p>
    </div>
  </MainLayout>
)

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* Proyectos */}
        <Route path="/projects"     element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
        <Route path="/project-tree" element={<ProtectedRoute><ProjectTree  /></ProtectedRoute>} />

        {/* Materiales */}
        <Route path="/materials/catalog"  element={<ProtectedRoute><MaterialCatalog    /></ProtectedRoute>} />
        <Route path="/materials/requests" element={<ProtectedRoute><MaterialRequestsV2  /></ProtectedRoute>} />

        {/* Inventario */}
        <Route path="/inventory"     element={<ProtectedRoute><InventoryList /></ProtectedRoute>} />
        <Route path="/inventory/new" element={<ProtectedRoute><AddMovement   /></ProtectedRoute>} />

        {/* Movimientos */}
        <Route path="/movements" element={<ProtectedRoute><MovementHistory /></ProtectedRoute>} />

        {/* Reportes */}
        <Route path="/reports"                   element={<ProtectedRoute><Reports                 /></ProtectedRoute>} />
        <Route path="/reports/projects-progress" element={<ProtectedRoute><ProjectsProgressReport  /></ProtectedRoute>} />
        <Route path="/reports/node-progress"     element={<ProtectedRoute><NodeProgressReport      /></ProtectedRoute>} />
        <Route path="/reportes/financieros"      element={<ProtectedRoute><ReportesFinancieros     /></ProtectedRoute>} />

        {/* Asistencia */}
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />

        {/* Configuración */}
        <Route path="/settings/company" element={<ProtectedRoute><CompanySettings /></ProtectedRoute>} />
        <Route path="/settings"         element={<ProtectedRoute><PlaceholderPage title="⚙️ Configuración" /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/users"        element={<ProtectedRoute><UsersAdmin           /></ProtectedRoute>} />
        <Route path="/admin/gastos-config"element={<ProtectedRoute><AdminGastosConfigPage /></ProtectedRoute>} />

        {/* Relaciones */}
        <Route path="/relaciones/terceros"       element={<ProtectedRoute><TercerosList  /></ProtectedRoute>} />
        <Route path="/relaciones/terceros/nuevo" element={<ProtectedRoute><TerceroForm   /></ProtectedRoute>} />
        <Route path="/relaciones/terceros/:id"   element={<ProtectedRoute><TerceroDetail /></ProtectedRoute>} />
        <Route path="/fiscal/terceros"       element={<Navigate to="/relaciones/terceros"       replace />} />
        <Route path="/fiscal/terceros/nuevo" element={<Navigate to="/relaciones/terceros/nuevo" replace />} />

        {/* Facturación */}
        <Route path="/facturacion"       element={<ProtectedRoute><FacturacionPage /></ProtectedRoute>} />
        <Route path="/facturacion/nueva" element={<ProtectedRoute><NuevaFactura    /></ProtectedRoute>} />
        <Route path="/facturacion/:id"   element={<ProtectedRoute><VisorCFDI       /></ProtectedRoute>} />

        {/* Contabilidad */}
        <Route path="/contabilidad/buzon"         element={<ProtectedRoute><BuzonFiscal             /></ProtectedRoute>} />
        <Route path="/contabilidad/buzon/:uuid"   element={<ProtectedRoute><VisorCFDI               /></ProtectedRoute>} />
        <Route path="/contabilidad/libro-mayor"   element={<ProtectedRoute><LibroMayor              /></ProtectedRoute>} />
        <Route path="/contabilidad/polizas"       element={<ProtectedRoute><Polizas                 /></ProtectedRoute>} />
        <Route path="/contabilidad/polizas/:tipo" element={<ProtectedRoute><Polizas                 /></ProtectedRoute>} />
        <Route path="/contabilidad/polizas/:id"   element={<ProtectedRoute><PolizaForm              /></ProtectedRoute>} />
        <Route path="/contabilidad/presupuesto"   element={<ProtectedRoute><Presupuesto             /></ProtectedRoute>} />
        <Route path="/contabilidad/cuentas"       element={<ProtectedRoute><CatalogoCuentas         /></ProtectedRoute>} />
        <Route path="/contabilidad/electronica"   element={<ProtectedRoute><ContabilidadElectronica /></ProtectedRoute>} />

        {/* ── Tesorería ────────────────────────────────────── */}
        <Route path="/tesoreria"                  element={<ProtectedRoute><TesoreriaPage       /></ProtectedRoute>} />
        <Route path="/tesoreria/bancos"           element={<ProtectedRoute><BancosPage          /></ProtectedRoute>} />
        <Route path="/tesoreria/conciliacion"     element={<ProtectedRoute><ConciliacionPage    /></ProtectedRoute>} />
        <Route path="/tesoreria/conciliacion/:id" element={<ProtectedRoute><ConciliacionDetalle /></ProtectedRoute>} />
        <Route path="/tesoreria/cxc"              element={<ProtectedRoute><CxCPage             /></ProtectedRoute>} />
        <Route path="/tesoreria/cxc/:id"          element={<ProtectedRoute><CxCDetalle          /></ProtectedRoute>} />
        <Route path="/tesoreria/cxp"              element={<ProtectedRoute><CxPPage             /></ProtectedRoute>} />
        <Route path="/tesoreria/cxp/:id"          element={<ProtectedRoute><CxPDetalle          /></ProtectedRoute>} />

        {/* Obra */}
        <Route path="/obra/avances"     element={<ProtectedRoute><AvancesObra      /></ProtectedRoute>} />
        <Route path="/obra/calendarios" element={<ProtectedRoute><CalendariosPage  /></ProtectedRoute>} />
        <Route path="/obra/programa"    element={<ProtectedRoute><ProgramaObraPage /></ProtectedRoute>} />

        {/* Personal */}
        <Route path="/personal" element={<ProtectedRoute><GestionPersonal /></ProtectedRoute>} />

        {/* Compras */}
        <Route path="/compras/proveedores"   element={<ProtectedRoute><ProveedoresPage   /></ProtectedRoute>} />
        <Route path="/compras/ordenes"       element={<ProtectedRoute><OrdenesCompraPage /></ProtectedRoute>} />
        <Route path="/compras/ordenes/nueva" element={<ProtectedRoute><OrdenCompraForm   /></ProtectedRoute>} />

        {/* Gastos */}
        <Route path="/gastos/mis-gastos"      element={<ProtectedRoute><MisGastosPage          /></ProtectedRoute>} />
        <Route path="/gastos/aprobaciones"    element={<ProtectedRoute><AprobacionesPage        /></ProtectedRoute>} />
        <Route path="/gastos/reembolsos"      element={<ProtectedRoute><ReembolsosPage          /></ProtectedRoute>} />
        <Route path="/gastos/reposicion-caja" element={<ProtectedRoute><ReposicionCajaChicaPage /></ProtectedRoute>} />
        <Route path="/gastos/consolidado"     element={<ProtectedRoute><ConsolidadoPage         /></ProtectedRoute>} />

        {/* Comercial */}
        <Route path="/comercial/pipeline"         element={<ProtectedRoute><PipelinePage           /></ProtectedRoute>} />
        <Route path="/comercial/cotizacion/nueva" element={<ProtectedRoute><CotizacionPage         /></ProtectedRoute>} />
        <Route path="/comercial/cotizacion/:id"   element={<ProtectedRoute><CotizacionPage         /></ProtectedRoute>} />
        <Route path="/comercial/contrato/nuevo"   element={<ProtectedRoute><ContratoPage           /></ProtectedRoute>} />
        <Route path="/comercial/contrato/:id"     element={<ProtectedRoute><ContratoPage           /></ProtectedRoute>} />
        <Route path="/comercial/anticipo"         element={<ProtectedRoute><AnticipoPagoPage       /></ProtectedRoute>} />
        <Route path="/comercial/dashboard"        element={<ProtectedRoute><DashboardComercialPage /></ProtectedRoute>} />

        {/* ── OBRIX Master — solo accesible con VITE_OBRIX_MASTER_EMAIL ── */}
        <Route path="/obrix-master" element={<ObrixMaster />} />

        <Route path="/"  element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App