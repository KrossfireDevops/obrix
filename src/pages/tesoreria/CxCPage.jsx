// ============================================================
//  OBRIX — Cuentas por Cobrar
//  src/pages/tesoreria/CxCPage.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { MainLayout }          from '../../components/layout/MainLayout'
import { supabase }            from '../../config/supabase'
import {
  Plus, Search, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, XCircle, AlertOctagon, TrendingUp,
  DollarSign, Calendar, Building2, X, Save, FileText,
  ChevronDown, Filter, Download, Zap,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtM = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`
  return `$${fmt(v)}`
}
const fmtFecha = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const hoy = () => new Date().toISOString().split('T')[0]

// ─── Configuración de estatus ────────────────────────────────
const ESTATUS_CFG = {
  pendiente:   { label: 'Pendiente',   icon: Clock,         bg: '#F9FAFB', color: '#6B7280' },
  parcial:     { label: 'Parcial',     icon: TrendingUp,    bg: '#FFFBEB',   color: '#D97706'   },
  cobrado:     { label: 'Cobrado',     icon: CheckCircle2,  bg: '#F0FDF4',   color: '#16A34A'   },
  vencido:     { label: 'Vencido',     icon: AlertOctagon,  bg: '#FEF2F2',    color: '#DC2626'    },
  cancelado:   { label: 'Cancelado',   icon: XCircle,       bg: '#F9FAFB', color: '#9CA3AF'  },
  en_disputa:  { label: 'En disputa',  icon: AlertTriangle, bg: '#F5F3FF',                           color: '#6D28D9'                     },
}

// ─── Semáforo por días restantes ────────────────────────────
const semaforo = (dias, estatus) => {
  if (estatus === 'cobrado' || estatus === 'cancelado') return null
  if (estatus === 'vencido' || dias < 0)  return { color: '#DC2626', label: `${Math.abs(dias)}d vencido`,  bg: '#FEF2F2' }
  if (dias <= 5)                          return { color: '#D97706', label: `Vence en ${dias}d`,           bg: '#FFFBEB' }
  if (dias <= 15)                         return { color: '#CA8A04', label: `Vence en ${dias}d`,           bg: '#FEFCE8' }
  return                                         { color: '#16A34A', label: `${dias}d restantes`,           bg: '#F0FDF4' }
}

// ─── Constantes de estilo ────────────────────────────────────
const C = { borde: '#E5E7EB', bg: '#FFFFFF', bgSec: '#F9FAFB' }
const borde = { border: '1px solid #E5E7EB', borderRadius: '12px' }

// ─── Formulario de nuevo CxC ────────────────────────────────
const formInicial = () => ({
  concepto:          '',
  numero_documento:  '',
  tercero_id:        '',
  fecha_emision:     hoy(),
  fecha_vencimiento: '',
  monto_original:    '',
  moneda:            'MXN',
  origen:            'manual',
  notas:             '',
})

// ─── Panel lateral — Nuevo CxC manual ───────────────────────
const PanelNuevoCxC = ({ terceros, onCerrar, onExito, companyId, userId }) => {
  const [form,     setForm]     = useState(formInicial())
  const [errores,  setErrores]  = useState({})
  const [guardando,setGuardando]= useState(false)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    const e = {}
    if (!form.concepto.trim())        e.concepto         = 'El concepto es obligatorio'
    if (!form.fecha_emision)          e.fecha_emision    = 'Fecha de emisión requerida'
    if (!form.fecha_vencimiento)      e.fecha_vencimiento= 'Fecha de vencimiento requerida'
    if (form.fecha_vencimiento && form.fecha_emision && form.fecha_vencimiento < form.fecha_emision)
                                      e.fecha_vencimiento= 'Debe ser posterior a la emisión'
    if (!form.monto_original || isNaN(Number(form.monto_original)) || Number(form.monto_original) <= 0)
                                      e.monto_original   = 'Ingresa un monto válido mayor a 0'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      const { error } = await supabase.from('tesoreria_cxc').insert({
        company_id:        companyId,
        tercero_id:        form.tercero_id || null,
        concepto:          form.concepto.trim(),
        numero_documento:  form.numero_documento.trim() || null,
        fecha_emision:     form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        monto_original:    Number(form.monto_original),
        monto_cobrado:     0,
        moneda:            form.moneda,
        estatus:           'pendiente',
        origen:            form.origen,
        notas:             form.notas.trim() || null,
        creado_por:        userId,
      })
      if (error) throw error
      onExito()
    } catch (e) {
      setErrores({ general: 'Error al guardar: ' + e.message })
    } finally {
      setGuardando(false)
    }
  }

  const inputStyle = (err) => ({
    width: '100%', padding: '9px 12px', fontSize: 13, outline: 'none',
    border: `0.5px solid ${err ? '#EF4444' : '#E5E7EB'}`,
    borderRadius: '8px', backgroundColor: '#FFFFFF',
    color: '#111827', boxSizing: 'border-box',
  })
  const Label = ({ t, req }) => (
    <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>
      {t}{req && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
    </label>
  )
  const Err = ({ k }) => errores[k] ? <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{errores[k]}</p> : null
  const Campo = ({ children, mb = 14 }) => <div style={{ marginBottom: mb }}>{children}</div>

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 80 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw', backgroundColor: '#FFFFFF', borderLeft: '1px solid #E5E7EB', zIndex: 90, display: 'flex', flexDirection: 'column', animation: 'slideInRight .2s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#16A34A" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Nueva cuenta por cobrar</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Registro manual</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}><X size={18} /></button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {errores.general && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: `0.5px solid #EF4444`, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{errores.general}</p>
            </div>
          )}

          <Campo>
            <Label t="Concepto" req />
            <input type="text" placeholder='Ej: "Estimación 3 — Obra Guadalajara"' value={form.concepto} onChange={e => setF('concepto', e.target.value)} style={inputStyle(errores.concepto)} />
            <Err k="concepto" />
          </Campo>

          <Campo>
            <Label t="Cliente" />
            <div style={{ position: 'relative' }}>
              <select value={form.tercero_id} onChange={e => setF('tercero_id', e.target.value)} style={{ ...inputStyle(), appearance: 'none', paddingRight: 28 }}>
                <option value="">Sin cliente asignado</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.razon_social || t.nombre_comercial}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
            </div>
          </Campo>

          <Campo>
            <Label t="No. de documento / Folio" />
            <input type="text" placeholder="Folio, estimación o referencia" value={form.numero_documento} onChange={e => setF('numero_documento', e.target.value)} style={inputStyle()} />
          </Campo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <Label t="Fecha emisión" req />
              <input type="date" value={form.fecha_emision} onChange={e => setF('fecha_emision', e.target.value)} style={inputStyle(errores.fecha_emision)} />
              <Err k="fecha_emision" />
            </div>
            <div>
              <Label t="Fecha vencimiento" req />
              <input type="date" value={form.fecha_vencimiento} onChange={e => setF('fecha_vencimiento', e.target.value)} style={inputStyle(errores.fecha_vencimiento)} />
              <Err k="fecha_vencimiento" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <Label t="Monto" req />
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9CA3AF' }}>$</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.monto_original} onChange={e => setF('monto_original', e.target.value)} style={{ ...inputStyle(errores.monto_original), paddingLeft: 22 }} />
              </div>
              <Err k="monto_original" />
            </div>
            <div>
              <Label t="Moneda" />
              <select value={form.moneda} onChange={e => setF('moneda', e.target.value)} style={{ ...inputStyle(), appearance: 'none' }}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <Campo>
            <Label t="Origen" />
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ v: 'manual', l: 'Manual' }, { v: 'anticipo', l: 'Anticipo' }].map(o => (
                <button key={o.v} onClick={() => setF('origen', o.v)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `0.5px solid ${form.origen === o.v ? '#3B82F6' : '#E5E7EB'}`, backgroundColor: form.origen === o.v ? '#EFF6FF' : '#FFFFFF', color: form.origen === o.v ? '#2563EB' : '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: form.origen === o.v ? 600 : 400 }}>
                  {o.l}
                </button>
              ))}
            </div>
          </Campo>

          <Campo mb={0}>
            <Label t="Notas internas" />
            <textarea value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Observaciones, condiciones especiales..." rows={3} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </Campo>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: '8px', border: 'none', background: guardando ? '#D1D5DB' : '#16A34A', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} />{guardando ? 'Guardando...' : 'Registrar CxC'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Página principal ────────────────────────────────────────
export default function CxCPage() {
  const nav = useNavigate()
  const [companyId,    setCompanyId]    = useState(null)
  const [userId,       setUserId]       = useState(null)
  const [cuentas,      setCuentas]      = useState([])
  const [terceros,     setTerceros]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroEst,    setFiltroEst]    = useState('todos')
  const [filtroSem,    setFiltroSem]    = useState('todos')   // todos | vencido | urgente | ok
  const [toast,        setToast]        = useState(null)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // ── KPIs ──────────────────────────────────────────────────
  const activas      = cuentas.filter(c => !['cobrado','cancelado'].includes(c.estatus))
  const totalPendiente = activas.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const totalVencido   = activas.filter(c => c.estatus === 'vencido' || (c.dias_restantes ?? 0) < 0)
    .reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const totalCobradoMes = cuentas
    .filter(c => c.estatus === 'cobrado' && c.updated_at?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, c) => s + Number(c.monto_original || 0), 0)
  const cntVencidas = activas.filter(c => c.estatus === 'vencido' || (c.dias_restantes ?? 1) < 0).length

  // ── Carga ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => { if (companyId) cargarDatos() }, [companyId])

  const cargarDatos = async () => {
    setLoading(true)
    const [{ data: cx }, { data: ter }] = await Promise.all([
      supabase
        .from('tesoreria_cxc')
        .select('*, terceros(razon_social, nombre_comercial, rfc)')
        .eq('company_id', companyId)
        .order('fecha_vencimiento', { ascending: true })
        .limit(300),
      supabase
        .from('terceros')
        .select('id, razon_social, nombre_comercial, rfc')
        .eq('company_id', companyId)
        .eq('tipo_relacion', 'cliente')
        .order('razon_social'),
    ])
    setCuentas(cx || [])
    setTerceros(ter || [])
    setLoading(false)
  }

  // ── Filtrado ───────────────────────────────────────────────
  const filtradas = cuentas.filter(c => {
    const s = semaforo(c.dias_restantes, c.estatus)
    const matchBusq = !busqueda || [
      c.concepto, c.numero_documento,
      c.terceros?.razon_social, c.terceros?.rfc,
    ].some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
    const matchEst = filtroEst === 'todos' || c.estatus === filtroEst
    const matchSem = filtroSem === 'todos'
      || (filtroSem === 'vencido'  && (c.dias_restantes ?? 0) < 0)
      || (filtroSem === 'urgente'  && (c.dias_restantes ?? 99) >= 0 && (c.dias_restantes ?? 99) <= 5)
      || (filtroSem === 'ok'       && (c.dias_restantes ?? 99) > 5)
    return matchBusq && matchEst && matchSem
  })

  // ── Exportar CSV ───────────────────────────────────────────
  const exportarCSV = () => {
    const hdr = ['Cliente','RFC','Concepto','Folio','Emisión','Vencimiento','Monto','Saldo','Estatus'].join(',')
    const filas = filtradas.map(c => [
      `"${c.terceros?.razon_social || '—'}"`,
      c.terceros?.rfc || '',
      `"${c.concepto}"`,
      c.numero_documento || '',
      c.fecha_emision,
      c.fecha_vencimiento,
      c.monto_original,
      c.saldo_pendiente,
      c.estatus,
    ].join(','))
    const blob = new Blob([[hdr, ...filas].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `cxc_${hoy()}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <MainLayout title="📈 Cuentas por Cobrar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1060, margin: '0 auto' }}>

        {/* KPIs ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {[
            { label: 'Cartera pendiente',  valor: fmtM(totalPendiente),  sub: `${activas.length} documentos activos`,  icon: <TrendingUp size={18} color="#2563EB" />,    bg: '#EFF6FF'    },
            { label: 'Cartera vencida',    valor: fmtM(totalVencido),    sub: `${cntVencidas} documento${cntVencidas !== 1 ? 's' : ''} vencido${cntVencidas !== 1 ? 's' : ''}`, icon: <AlertOctagon size={18} color="#DC2626" />, bg: '#FEF2F2'  },
            { label: 'Cobrado este mes',   valor: fmtM(totalCobradoMes), sub: 'documentos cerrados',                    icon: <CheckCircle2 size={18} color="#16A34A" />, bg: '#F0FDF4' },
            { label: 'Total documentos',   valor: cuentas.length,        sub: 'en el período',                         icon: <FileText size={18} color="#6B7280" />,  bg: '#F9FAFB'},
          ].map(k => (
            <div key={k.label} style={{ ...borde, background: '#FFFFFF', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
              <div>
                <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 2px' }}>{k.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0, lineHeight: 1.2 }}>{k.valor}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Barra acciones ──────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por cliente, RFC, concepto..." style={{ width: '100%', paddingLeft: 32, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)} style={{ fontSize: 12 }}>
            <option value="todos">Todos los estatus</option>
            {Object.entries(ESTATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroSem} onChange={e => setFiltroSem(e.target.value)} style={{ fontSize: 12 }}>
            <option value="todos">Todo el semáforo</option>
            <option value="vencido">🔴 Vencidos</option>
            <option value="urgente">🟡 Urgentes ≤5d</option>
            <option value="ok">🟢 Al corriente</option>
          </select>
          <button onClick={cargarDatos} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, color: '#6B7280' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={exportarCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
            <Download size={13} /> CSV
          </button>
          <button onClick={() => setPanelAbierto(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            <Plus size={14} /> Nueva CxC
          </button>
        </div>

        {/* Tabla ───────────────────────────────────────────── */}
        <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 28, height: 28, border: `2px solid #E5E7EB`, borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>

          ) : filtradas.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center' }}>
              <TrendingUp size={36} style={{ color: '#9CA3AF', margin: '0 auto 14px', display: 'block' }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>
                {cuentas.length === 0 ? 'Sin cuentas por cobrar registradas' : 'Sin resultados para los filtros'}
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
                {cuentas.length === 0 ? 'Las cuentas se crean automáticamente desde CFDIs emitidos o puedes registrarlas manualmente.' : 'Ajusta los filtros de búsqueda.'}
              </p>
              {cuentas.length === 0 && (
                <button onClick={() => setPanelAbierto(true)} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  + Registrar primera CxC
                </button>
              )}
            </div>

          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 120px 100px 36px', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', gap: 8 }}>
                {['Cliente · Concepto','Folio','Vencimiento','Monto','Saldo','Estatus',''].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
                ))}
              </div>

              {/* Filas */}
              {filtradas.map((c, i) => {
                const est = ESTATUS_CFG[c.estatus] || ESTATUS_CFG.pendiente
                const EstIcon = est.icon
                const sem = semaforo(c.dias_restantes, c.estatus)
                const pctCobrado = c.monto_original > 0 ? Math.round((Number(c.monto_cobrado || 0) / c.monto_original) * 100) : 0

                return (
                  <div
                    key={c.id}
                    onClick={() => nav(`/tesoreria/cxc/${c.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 120px 100px 36px', padding: '13px 16px', borderBottom: i < filtradas.length - 1 ? `0.5px solid #E5E7EB` : 'none', alignItems: 'center', cursor: 'pointer', background: '#FFFFFF', transition: 'background .1s', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    {/* Cliente + concepto */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, overflow: 'hidden' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={14} color="#16A34A" />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.terceros?.razon_social || c.terceros?.nombre_comercial || 'Sin cliente'}
                        </p>
                        <p style={{ fontSize: 11, color: '#6B7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.concepto}
                        </p>
                        {/* Mini barra de cobro */}
                        {c.estatus === 'parcial' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <div style={{ flex: 1, height: 3, borderRadius: 99, background: '#E5E7EB' }}>
                              <div style={{ width: `${pctCobrado}%`, height: '100%', borderRadius: 99, background: '#D97706' }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>{pctCobrado}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Folio */}
                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0, fontFamily: 'monospace' }}>{c.numero_documento || '—'}</p>

                    {/* Vencimiento + semáforo */}
                    <div>
                      <p style={{ fontSize: 12, color: '#111827', margin: '0 0 3px', fontWeight: 500 }}>{fmtFecha(c.fecha_vencimiento)}</p>
                      {sem && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, backgroundColor: sem.bg, color: sem.color, fontWeight: 600 }}>
                          {sem.label}
                        </span>
                      )}
                    </div>

                    {/* Monto */}
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, fontFamily: 'monospace' }}>${fmt(c.monto_original)}</p>

                    {/* Saldo */}
                    <p style={{ fontSize: 13, fontWeight: 700, color: Number(c.saldo_pendiente) > 0 ? '#DC2626' : '#16A34A', margin: 0, fontFamily: 'monospace' }}>
                      ${fmt(c.saldo_pendiente)}
                    </p>

                    {/* Estatus */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', borderRadius: 20, backgroundColor: est.bg, color: est.color, fontWeight: 500 }}>
                      <EstIcon size={10} />{est.label}
                    </span>

                    <ChevronRight size={14} style={{ color: '#9CA3AF' }} />
                  </div>
                )
              })}
            </>
          )}
        </div>

        {filtradas.length > 0 && (
          <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right', margin: 0 }}>
            {filtradas.length} documento{filtradas.length !== 1 ? 's' : ''} · Haz clic en una fila para ver el detalle y registrar cobros
          </p>
        )}
      </div>

      {/* Panel */}
      {panelAbierto && (
        <PanelNuevoCxC
          terceros={terceros}
          companyId={companyId}
          userId={userId}
          onCerrar={() => setPanelAbierto(false)}
          onExito={() => { setPanelAbierto(false); mostrarToast('✅ CxC registrada'); cargarDatos() }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: '12px', background: toast.tipo === 'error' ? '#FEF2F2' : '#F0FDF4', border: `0.5px solid ${toast.tipo === 'error' ? '#EF4444' : '#22C55E'}`, animation: 'fadeInDown .2s ease', maxWidth: 380 }}>
          {toast.tipo === 'error' ? <AlertTriangle size={16} color="#DC2626" /> : <CheckCircle2 size={16} color="#16A34A" />}
          <p style={{ fontSize: 13, fontWeight: 500, color: toast.tipo === 'error' ? '#DC2626' : '#16A34A', margin: 0 }}>{toast.msg}</p>
        </div>
      )}

      <style>{`
        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes fadeInDown   { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
      `}</style>
    </MainLayout>
  )
}
