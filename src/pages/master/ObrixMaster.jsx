// ============================================================
//  OBRIX MASTER — Panel privado del Owner
//  src/pages/master/ObrixMaster.jsx
//
//  Acceso: solo el usuario con email @obrix.mx (o el que
//  configures como OBRIX_MASTER_EMAIL en tu .env)
//  Ruta sugerida: /obrix-master (no incluir en Sidebar)
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { supabase }            from '../../config/supabase'
import {
  Shield, RefreshCw, Search, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, Clock,
  Building2, Users, FolderOpen, DollarSign,
  TrendingUp, Settings, Eye, Download,
  AlertOctagon, Zap, BarChart2, X, Save,
  FileText, Lock, Unlock, ChevronRight,
} from 'lucide-react'

// ─── Email del Owner (ajusta al tuyo) ───────────────────────
const OBRIX_MASTER_EMAIL = import.meta.env.VITE_OBRIX_MASTER_EMAIL || 'master@obrix.mx'

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })
const fmtFecha = (d) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'
const hoy = () => new Date().toISOString().split('T')[0]

// ─── Configuración de planes ─────────────────────────────────
const PLANES = {
  trial:      { label: 'Trial',      color: '#D97706', bg: '#FFFBEB', icon: Clock,        max_u: 5,  max_o: 3,  precio: 0     },
  arranque:   { label: 'Arranque',   color: '#0F6E56', bg: '#E1F5EE', icon: Zap,          max_u: 5,  max_o: 3,  precio: 4900  },
  operativo:  { label: 'Operativo',  color: '#2563EB', bg: '#EFF6FF', icon: TrendingUp,   max_u: 12, max_o: 5,  precio: 8900  },
  director:   { label: 'Director',   color: '#7C3AED', bg: '#F5F3FF', icon: BarChart2,    max_u: -1, max_o: -1, precio: 14900 },
  suspendido: { label: 'Suspendido', color: '#DC2626', bg: '#FEF2F2', icon: XCircle,      max_u: 0,  max_o: 0,  precio: 0     },
}

// ─── Constantes de estilo ─────────────────────────────────────
const S = {
  bg:    '#FFFFFF',
  bgSec: '#F9FAFB',
  borde: '#E5E7EB',
  text:  '#111827',
  muted: '#6B7280',
  hint:  '#9CA3AF',
}

// ─── Badge de plan ────────────────────────────────────────────
const BadgePlan = ({ plan }) => {
  const cfg  = PLANES[plan] || PLANES.trial
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.color,
    }}>
      <Icon size={11} />{cfg.label}
    </span>
  )
}

// ─── Barra de consumo ─────────────────────────────────────────
const BarraConsumo = ({ actual, maximo, color }) => {
  if (maximo === -1) return <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>∞ Ilimitado</span>
  const pct = maximo > 0 ? Math.min(100, Math.round((actual / maximo) * 100)) : 0
  const colorBarra = pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#16A34A'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: colorBarra, borderRadius: 99, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, color: pct >= 90 ? '#DC2626' : S.muted, fontWeight: pct >= 90 ? 700 : 400, whiteSpace: 'nowrap' }}>
        {actual}/{maximo === -1 ? '∞' : maximo}
      </span>
    </div>
  )
}

// ─── Modal: cambiar plan ──────────────────────────────────────
const ModalCambiarPlan = ({ empresa, onCerrar, onGuardado }) => {
  const [plan,      setPlan]      = useState(empresa.licencia?.plan || 'trial')
  const [notas,     setNotas]     = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState(null)

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      // Llamar la función SQL que solo el service_role puede ejecutar
      const { data, error: rpcError } = await supabase
        .rpc('obrix_cambiar_plan', {
          p_company_id: empresa.id,
          p_plan:       plan,
          p_notas:      notas.trim() || null,
        })

      if (rpcError) throw rpcError
      if (data?.error) throw new Error(data.error)

      onGuardado(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const planActual = empresa.licencia?.plan
  const cambiando  = plan !== planActual

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.bg, border: `1px solid ${S.borde}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 480, animation: 'fadeInDown .2s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${S.borde}`, backgroundColor: S.bgSec, borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={18} color="#7C3AED" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: S.text, margin: 0 }}>Cambiar plan</p>
              <p style={{ fontSize: 12, color: S.muted, margin: 0 }}>{empresa.name}</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Selector de plan */}
          <p style={{ fontSize: 12, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 12px' }}>Seleccionar plan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {Object.entries(PLANES).map(([key, cfg]) => {
              const Icon = cfg.icon
              const esActual = key === planActual
              const seleccionado = key === plan
              return (
                <button
                  key={key}
                  onClick={() => setPlan(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${seleccionado ? cfg.color : S.borde}`,
                    backgroundColor: seleccionado ? cfg.bg : S.bg,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: seleccionado ? cfg.color : S.text }}>{cfg.label}</span>
                      {esActual && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, backgroundColor: '#E5E7EB', color: S.muted, fontWeight: 600 }}>ACTUAL</span>}
                    </div>
                    <span style={{ fontSize: 11, color: S.muted }}>
                      {cfg.max_u === -1 ? 'Usuarios ilimitados' : `${cfg.max_u} usuarios`} · {cfg.max_o === -1 ? 'Obras ilimitadas' : `${cfg.max_o} obras`}
                      {cfg.precio > 0 ? ` · $${fmt(cfg.precio)}/mes` : key === 'trial' ? ' · 30 días gratis' : ' · Acceso suspendido'}
                    </span>
                  </div>
                  {seleccionado && <CheckCircle2 size={16} color={cfg.color} />}
                </button>
              )
            })}
          </div>

          {/* Notas internas */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: S.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Nota interna (solo visible para ti)
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Motivo del cambio, condiciones del acuerdo, etc..."
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${S.borde}`, backgroundColor: S.bg, color: S.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>

          {/* Aviso de cambio */}
          {cambiando && plan === 'suspendido' && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#DC2626', margin: 0, fontWeight: 500 }}>
                ⚠️ Al suspender, el cliente perderá acceso inmediatamente. Los datos se conservan.
              </p>
            </div>
          )}
          {cambiando && plan !== 'suspendido' && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#16A34A', margin: 0, fontWeight: 500 }}>
                ✓ El cliente verá el nuevo plan activo de forma inmediata al recargar OBRIX.
              </p>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: `1px solid ${S.borde}`, backgroundColor: S.bgSec, borderRadius: '0 0 16px 16px' }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${S.borde}`, background: S.bg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: S.text }}>
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || !cambiando}
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: 'none', background: guardando || !cambiando ? '#D1D5DB' : '#111827', color: '#fff', cursor: guardando || !cambiando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Save size={14} />
            {guardando ? 'Guardando...' : cambiando ? `Cambiar a ${PLANES[plan]?.label}` : 'Sin cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: ver detalle de empresa ───────────────────────────
const ModalDetalle = ({ empresa, auditoria, onCerrar, onCambiarPlan }) => {
  const lic = empresa.licencia

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.bg, border: `1px solid ${S.borde}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'fadeInDown .2s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${S.borde}`, backgroundColor: S.bgSec, borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="#2563EB" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: S.text, margin: 0 }}>{empresa.name}</p>
              <p style={{ fontSize: 12, color: S.muted, margin: 0 }}>RFC: {empresa.rfc || '—'} · {empresa.id.slice(0, 8)}...</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Licencia actual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Plan actual',      val: <BadgePlan plan={lic?.plan || 'trial'} /> },
              { label: 'Estado',           val: lic?.activa ? <span style={{ color: '#16A34A', fontWeight: 600, fontSize: 13 }}>✓ Activa</span> : <span style={{ color: '#DC2626', fontWeight: 600, fontSize: 13 }}>✗ Suspendida</span> },
              { label: 'Precio mensual',   val: lic?.precio_mensual > 0 ? `$${fmt(lic.precio_mensual)} MXN` : 'Sin cargo' },
              { label: 'Vencimiento',      val: lic?.fecha_vence ? fmtFecha(lic.fecha_vence) : 'Sin vencimiento' },
              { label: 'Inicio',           val: fmtFecha(lic?.fecha_inicio) },
              { label: 'Días restantes',   val: lic?.fecha_vence ? `${Math.max(0, Math.round((new Date(lic.fecha_vence) - new Date()) / 86400000))}d` : '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: S.bgSec, border: `1px solid ${S.borde}` }}>
                <p style={{ fontSize: 11, color: S.hint, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
                <div style={{ fontSize: 13, fontWeight: 500, color: S.text }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Consumo */}
          <p style={{ fontSize: 11, fontWeight: 700, color: S.hint, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Consumo actual</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: S.bgSec, border: `1px solid ${S.borde}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={13} color={S.muted} />
                <span style={{ fontSize: 11, color: S.muted, fontWeight: 600 }}>Usuarios</span>
              </div>
              <BarraConsumo actual={empresa.usuarios_count || 0} maximo={lic?.max_usuarios || 5} />
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: S.bgSec, border: `1px solid ${S.borde}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FolderOpen size={13} color={S.muted} />
                <span style={{ fontSize: 11, color: S.muted, fontWeight: 600 }}>Obras activas</span>
              </div>
              <BarraConsumo actual={empresa.obras_count || 0} maximo={lic?.max_obras || 3} />
            </div>
          </div>

          {/* Notas internas */}
          {lic?.notas_internas && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: S.hint, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>Notas internas</p>
              <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#92400E', margin: 0, lineHeight: 1.5 }}>{lic.notas_internas}</p>
              </div>
            </>
          )}

          {/* Auditoría de cambios */}
          {auditoria.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: S.hint, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Historial de cambios de plan</p>
              <div style={{ border: `1px solid ${S.borde}`, borderRadius: 8, overflow: 'hidden' }}>
                {auditoria.map((a, i) => (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: 8, padding: '10px 14px', borderBottom: i < auditoria.length - 1 ? `1px solid ${S.borde}` : 'none', backgroundColor: S.bg, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: S.hint, fontFamily: 'monospace' }}>{fmtFecha(a.created_at?.slice(0, 10))}</span>
                    <span style={{ fontSize: 11 }}><BadgePlan plan={a.plan_anterior} /></span>
                    <span style={{ fontSize: 11, color: S.hint }}>→</span>
                    <span style={{ fontSize: 11 }}><BadgePlan plan={a.plan_nuevo} /></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: `1px solid ${S.borde}`, backgroundColor: S.bgSec, borderRadius: '0 0 16px 16px', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${S.borde}`, background: S.bg, cursor: 'pointer', fontSize: 13, color: S.text }}>
            Cerrar
          </button>
          <button onClick={() => { onCerrar(); onCambiarPlan(empresa) }} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Settings size={14} /> Cambiar plan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function ObrixMaster() {
  const nav = useNavigate()

  const [autorizado,    setAutorizado]    = useState(false)
  const [verificando,   setVerificando]   = useState(true)
  const [empresas,      setEmpresas]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [busqueda,      setBusqueda]      = useState('')
  const [filtroPlan,    setFiltroPlan]    = useState('todos')
  const [modalPlan,     setModalPlan]     = useState(null)   // empresa seleccionada para cambiar plan
  const [modalDetalle,  setModalDetalle]  = useState(null)   // empresa para ver detalle
  const [auditoria,     setAuditoria]     = useState([])
  const [toast,         setToast]         = useState(null)
  const [exportando,    setExportando]    = useState(false)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Verificar que el usuario es el Owner ─────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { nav('/login'); return }
      if (user.email !== OBRIX_MASTER_EMAIL) {
        // No es el owner → redirigir al dashboard normal
        nav('/dashboard')
        return
      }
      setAutorizado(true)
      setVerificando(false)
    })
  }, [])

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  // ── Cargar todas las empresas con sus licencias y consumo ────
  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Usar service_role vía RPC para leer company_licencias
      const { data: empresasData } = await supabase
        .from('companies')
        .select('id, name, rfc, created_at')
        .order('created_at', { ascending: false })

      if (!empresasData) { setLoading(false); return }

      // Para cada empresa, obtener licencia y consumo
      const empresasConLicencia = await Promise.all(
        empresasData.map(async (emp) => {
          const [
            { data: licencia },
            { count: usuarios_count },
            { count: obras_count },
          ] = await Promise.all([
            supabase.from('company_licencias').select('*').eq('company_id', emp.id).single(),
            supabase.from('users_profiles').select('*', { count: 'exact', head: true }).eq('company_id', emp.id),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('company_id', emp.id).eq('status', 'active'),
          ])
          return { ...emp, licencia, usuarios_count: usuarios_count || 0, obras_count: obras_count || 0 }
        })
      )

      setEmpresas(empresasConLicencia)

      // Cargar auditoría global (últimos 50 cambios)
      const { data: audit } = await supabase
        .from('obrix_licencias_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      setAuditoria(audit || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── KPIs globales ────────────────────────────────────────────
  const mrr = empresas.reduce((s, e) => s + Number(e.licencia?.precio_mensual || 0), 0)
  const activas = empresas.filter(e => e.licencia?.activa !== false)
  const porPlan = Object.keys(PLANES).reduce((acc, k) => {
    acc[k] = empresas.filter(e => e.licencia?.plan === k).length
    return acc
  }, {})
  const totalUsuarios = empresas.reduce((s, e) => s + e.usuarios_count, 0)

  // ── Filtrado ─────────────────────────────────────────────────
  const filtradas = empresas.filter(e => {
    const matchB = !busqueda || [e.name, e.rfc, e.id]
      .some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
    const matchP = filtroPlan === 'todos' || e.licencia?.plan === filtroPlan
    return matchB && matchP
  })

  // ── Exportar CSV ─────────────────────────────────────────────
  const exportarCSV = () => {
    setExportando(true)
    const hdr = ['Empresa','RFC','Plan','Activa','Usuarios','Obras','MRR','Vencimiento','Inicio','ID'].join(',')
    const filas = empresas.map(e => [
      `"${e.name}"`,
      e.rfc || '',
      e.licencia?.plan || 'sin_licencia',
      e.licencia?.activa ? 'Sí' : 'No',
      e.usuarios_count,
      e.obras_count,
      e.licencia?.precio_mensual || 0,
      e.licencia?.fecha_vence || 'Sin vencimiento',
      e.licencia?.fecha_inicio || '',
      e.id,
    ].join(','))
    const blob = new Blob([[hdr, ...filas].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `obrix_licencias_${hoy()}.csv` })
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  // ── Estados de carga / acceso ─────────────────────────────────
  if (verificando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!autorizado) return null

  // ── Render principal ──────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F3F4F6', padding: '24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #111827 0%, #374151 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={24} color="#FFFFFF" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>OBRIX Master</h1>
              <p style={{ fontSize: 13, color: S.muted, margin: 0 }}>Panel privado de administración de licencias</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cargarDatos} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: `1px solid ${S.borde}`, background: S.bg, cursor: 'pointer', fontSize: 13, color: S.muted }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualizar
            </button>
            <button onClick={exportarCSV} disabled={exportando} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: `1px solid ${S.borde}`, background: S.bg, cursor: 'pointer', fontSize: 13, color: S.muted }}>
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* ── KPIs globales ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
          {[
            { label: 'MRR Total',         valor: `$${fmt(mrr)}`, sub: 'MXN / mes',                          icon: <DollarSign size={20} color="#16A34A" />, bg: '#F0FDF4' },
            { label: 'Empresas activas',  valor: activas.length, sub: `de ${empresas.length} registradas`,  icon: <Building2  size={20} color="#2563EB" />, bg: '#EFF6FF' },
            { label: 'Usuarios totales',  valor: totalUsuarios,  sub: 'en todas las empresas',              icon: <Users      size={20} color="#7C3AED" />, bg: '#F5F3FF' },
            { label: 'Planes pagados',    valor: (porPlan.arranque || 0) + (porPlan.operativo || 0) + (porPlan.director || 0), sub: 'arranque + operativo + director', icon: <TrendingUp size={20} color="#D97706" />, bg: '#FFFBEB' },
          ].map(k => (
            <div key={k.label} style={{ background: S.bg, border: `1px solid ${S.borde}`, borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
              <div>
                <p style={{ fontSize: 11, color: S.hint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 2px' }}>{k.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0, lineHeight: 1.2 }}>{k.valor}</p>
                <p style={{ fontSize: 11, color: S.muted, margin: '2px 0 0' }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Distribución por plan ─────────────────────────────── */}
        <div style={{ background: S.bg, border: `1px solid ${S.borde}`, borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: S.hint, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0, flexShrink: 0 }}>Distribución</p>
          {Object.entries(PLANES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFiltroPlan(filtroPlan === key ? 'todos' : key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filtroPlan === key ? cfg.color : S.borde}`, backgroundColor: filtroPlan === key ? cfg.bg : S.bg, cursor: 'pointer', transition: 'all .15s' }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{porPlan[key] || 0}</span>
              <span style={{ fontSize: 12, color: filtroPlan === key ? cfg.color : S.muted }}>{cfg.label}</span>
            </button>
          ))}
          {filtroPlan !== 'todos' && (
            <button onClick={() => setFiltroPlan('todos')} style={{ fontSize: 11, color: S.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Ver todos
            </button>
          )}
        </div>

        {/* ── Barra de búsqueda ─────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: S.hint }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RFC o ID de empresa..."
            style={{ width: '100%', paddingLeft: 36, padding: '11px 14px 11px 36px', fontSize: 13, borderRadius: 10, border: `1px solid ${S.borde}`, background: S.bg, color: S.text, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* ── Tabla de empresas ─────────────────────────────────── */}
        <div style={{ background: S.bg, border: `1px solid ${S.borde}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

          {/* Header tabla */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 120px 120px 130px 100px', padding: '11px 20px', borderBottom: `1px solid ${S.borde}`, backgroundColor: S.bgSec, gap: 8 }}>
            {['Empresa','Plan','Estado','Usuarios','Obras','MRR / mes','Acciones'].map(h => (
              <p key={h} style={{ fontSize: 11, fontWeight: 700, color: S.hint, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${S.borde}`, borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>

          ) : filtradas.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Building2 size={32} style={{ color: S.hint, margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, color: S.text, fontWeight: 500, margin: '0 0 4px' }}>
                {empresas.length === 0 ? 'Sin empresas registradas' : 'Sin resultados'}
              </p>
              <p style={{ fontSize: 13, color: S.muted, margin: 0 }}>
                {empresas.length === 0 ? 'Las empresas aparecerán aquí cuando se registren.' : 'Ajusta el filtro o la búsqueda.'}
              </p>
            </div>

          ) : filtradas.map((emp, i) => {
            const lic       = emp.licencia
            const planCfg   = PLANES[lic?.plan] || PLANES.trial
            const vencePronto = lic?.fecha_vence && (new Date(lic.fecha_vence) - new Date()) / 86400000 <= 15
            const suspendida  = lic?.plan === 'suspendido' || lic?.activa === false

            return (
              <div
                key={emp.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 130px 120px 120px 130px 100px',
                  padding: '14px 20px',
                  borderBottom: i < filtradas.length - 1 ? `1px solid ${S.borde}` : 'none',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: suspendida ? '#FFF8F8' : S.bg,
                  opacity: suspendida ? 0.8 : 1,
                  transition: 'background .1s',
                }}
              >
                {/* Empresa */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={15} color="#2563EB" />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: S.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</p>
                    <p style={{ fontSize: 11, color: S.hint, margin: 0, fontFamily: 'monospace' }}>
                      {emp.rfc || '—'} · {fmtFecha(emp.created_at?.slice(0,10))}
                    </p>
                    {vencePronto && !suspendida && (
                      <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>
                        ⚠ Vence pronto
                      </span>
                    )}
                  </div>
                </div>

                {/* Plan */}
                <BadgePlan plan={lic?.plan || 'trial'} />

                {/* Estado */}
                {suspendida
                  ? <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> Suspendida</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><Unlock size={11} /> Activa</span>
                }

                {/* Usuarios */}
                <BarraConsumo actual={emp.usuarios_count} maximo={lic?.max_usuarios || 5} />

                {/* Obras */}
                <BarraConsumo actual={emp.obras_count} maximo={lic?.max_obras || 3} />

                {/* MRR */}
                <p style={{ fontSize: 13, fontWeight: 600, color: lic?.precio_mensual > 0 ? '#16A34A' : S.hint, margin: 0, fontFamily: 'monospace' }}>
                  {lic?.precio_mensual > 0 ? `$${fmt(lic.precio_mensual)}` : '—'}
                </p>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      const audit = auditoria.filter(a => a.company_id === emp.id)
                      setModalDetalle({ empresa: emp, auditoria: audit })
                    }}
                    title="Ver detalle"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: `1px solid ${S.borde}`, background: S.bg, cursor: 'pointer' }}
                  >
                    <Eye size={13} color={S.muted} />
                  </button>
                  <button
                    onClick={() => setModalPlan(emp)}
                    title="Cambiar plan"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: `1px solid ${S.borde}`, background: S.bg, cursor: 'pointer' }}
                  >
                    <Settings size={13} color={S.muted} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Auditoría reciente ────────────────────────────────── */}
        {auditoria.length > 0 && (
          <div style={{ background: S.bg, border: `1px solid ${S.borde}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${S.borde}`, backgroundColor: S.bgSec, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={14} color={S.muted} />
              <p style={{ fontSize: 13, fontWeight: 700, color: S.text, margin: 0 }}>Últimos cambios de plan</p>
              <span style={{ fontSize: 11, color: S.hint, marginLeft: 4 }}>{auditoria.length} registros</span>
            </div>
            {auditoria.slice(0, 8).map((a, i) => {
              const emp = empresas.find(e => e.id === a.company_id)
              return (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 20px 120px 160px', gap: 12, padding: '10px 20px', borderBottom: i < Math.min(auditoria.length, 8) - 1 ? `1px solid ${S.borde}` : 'none', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, color: S.text, fontWeight: 500, margin: 0 }}>{emp?.name || a.company_id.slice(0, 8) + '...'}</p>
                  <BadgePlan plan={a.plan_anterior} />
                  <ChevronRight size={12} color={S.hint} />
                  <BadgePlan plan={a.plan_nuevo} />
                  <p style={{ fontSize: 11, color: S.hint, margin: 0, fontFamily: 'monospace' }}>
                    {new Date(a.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Pie */}
        <p style={{ fontSize: 11, color: S.hint, textAlign: 'center', margin: 0 }}>
          OBRIX Master · {filtradas.length} empresa{filtradas.length !== 1 ? 's' : ''} · MRR ${fmt(mrr)} MXN · Solo visible para {OBRIX_MASTER_EMAIL}
        </p>

      </div>

      {/* ── Modales ──────────────────────────────────────────── */}
      {modalPlan && (
        <ModalCambiarPlan
          empresa={modalPlan}
          onCerrar={() => setModalPlan(null)}
          onGuardado={(resultado) => {
            setModalPlan(null)
            mostrarToast(`✅ ${modalPlan.name} → Plan ${PLANES[resultado.plan]?.label}`)
            cargarDatos()
          }}
        />
      )}

      {modalDetalle && (
        <ModalDetalle
          empresa={modalDetalle.empresa}
          auditoria={modalDetalle.auditoria}
          onCerrar={() => setModalDetalle(null)}
          onCambiarPlan={(emp) => { setModalDetalle(null); setModalPlan(emp) }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12, background: toast.tipo === 'error' ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${toast.tipo === 'error' ? '#FCA5A5' : '#86EFAC'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', animation: 'fadeInDown .2s ease', maxWidth: 380 }}>
          {toast.tipo === 'error'
            ? <AlertTriangle size={16} color="#DC2626" />
            : <CheckCircle2  size={16} color="#16A34A" />}
          <p style={{ fontSize: 13, fontWeight: 500, color: toast.tipo === 'error' ? '#DC2626' : '#16A34A', margin: 0 }}>{toast.msg}</p>
        </div>
      )}

      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  )
}
