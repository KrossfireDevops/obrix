// ============================================================
//  OBRIX — Detalle de Cuenta por Pagar
//  src/pages/tesoreria/CxPDetalle.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MainLayout }             from '../../components/layout/MainLayout'
import { supabase }               from '../../config/supabase'
import {
  ChevronLeft, CheckCircle2, AlertTriangle, AlertOctagon,
  Clock, TrendingDown, XCircle, Building2, Calendar,
  DollarSign, Plus, Trash2, Save, X, RefreshCw, FileText,
  Download, MessageSquare, Edit2, Lock, ChevronDown,
  Zap, Sparkles, Star, Shield, ToggleLeft, ToggleRight,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
const fmtFechaCorta = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtHora = (d) =>
  d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const hoy = () => new Date().toISOString().split('T')[0]
const pct = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0

// ─── Config estatus ──────────────────────────────────────────
const ESTATUS_CFG = {
  pendiente:   { label: 'Pendiente',   icon: Clock,         bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
  programado:  { label: 'Programado',  icon: Calendar,      bg: 'var(--color-background-info)',      color: 'var(--color-text-info)'      },
  pagado:      { label: 'Pagado',      icon: CheckCircle2,  bg: 'var(--color-background-success)',   color: 'var(--color-text-success)'   },
  vencido:     { label: 'Vencido',     icon: AlertOctagon,  bg: 'var(--color-background-danger)',    color: 'var(--color-text-danger)'    },
  cancelado:   { label: 'Cancelado',   icon: XCircle,       bg: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)'  },
  en_revision: { label: 'En revisión', icon: AlertTriangle, bg: '#EFF6FF',                           color: '#1D4ED8'                     },
}

const FORMAS_PAGO = [
  'Transferencia electrónica', 'Cheque nominativo', 'Efectivo',
  'Depósito bancario', 'Tarjeta de crédito', 'Compensación', 'Otro',
]

// ─── Semáforo ────────────────────────────────────────────────
const semaforo = (dias, estatus) => {
  if (['pagado','cancelado'].includes(estatus)) return null
  if (dias == null) return null
  if (dias < 0)   return { color: '#DC2626', label: `Venció hace ${Math.abs(dias)}d`,  bg: '#FEF2F2', urgente: true  }
  if (dias === 0) return { color: '#DC2626', label: 'Vence hoy',                        bg: '#FEF2F2', urgente: true  }
  if (dias <= 3)  return { color: '#DC2626', label: `Vence en ${dias}d`,               bg: '#FEF2F2', urgente: true  }
  if (dias <= 7)  return { color: '#D97706', label: `Vence en ${dias}d`,               bg: '#FFFBEB', urgente: true  }
  if (dias <= 15) return { color: '#CA8A04', label: `${dias}d restantes`,              bg: '#FEFCE8', urgente: false }
  return               { color: '#16A34A', label: `${dias}d restantes`,                bg: '#F0FDF4', urgente: false }
}

// ─── Constantes ──────────────────────────────────────────────
const C = { borde: 'var(--color-border-tertiary)', bg: 'var(--color-background-primary)', bgSec: 'var(--color-background-secondary)' }
const borde = { border: `0.5px solid ${C.borde}`, borderRadius: 'var(--border-radius-lg)' }

// ─── Panel registro de pago ──────────────────────────────────
const PanelPago = ({ cxp, bancos, onCerrar, onExito, companyId, userId }) => {
  const maxPagable = Number(cxp.saldo_pendiente || 0)
  // Si hay descuento pp vigente, sugerir el monto con descuento
  const tieneDescuento = cxp.descuento_pp_fecha && cxp.descuento_pp_fecha >= hoy() && cxp.descuento_pp_monto > 0
  const montoSugerido  = tieneDescuento
    ? (maxPagable - Number(cxp.descuento_pp_monto || 0)).toFixed(2)
    : maxPagable.toFixed(2)

  const [form, setForm] = useState({
    fecha_pago:  hoy(),
    monto:       montoSugerido,
    forma_pago:  'Transferencia electrónica',
    banco_id:    bancos[0]?.id || '',
    referencia:  '',
    notas:       tieneDescuento ? `Descuento pronto pago aplicado: $${fmt(cxp.descuento_pp_monto)}` : '',
  })
  const [errores,   setErrores]   = useState({})
  const [guardando, setGuardando] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    const e = {}
    if (!form.fecha_pago) e.fecha_pago = 'Requerida'
    const m = Number(form.monto)
    if (!form.monto || isNaN(m) || m <= 0)       e.monto = 'Ingresa un monto válido'
    if (m > maxPagable + 0.01)                   e.monto = `No puede superar el saldo ($${fmt(maxPagable)})`
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      const { error } = await supabase.from('tesoreria_cxp_pagos').insert({
        cxp_id:        cxp.id,
        company_id:    companyId,
        banco_id:      form.banco_id || null,
        fecha_pago:    form.fecha_pago,
        monto:         Number(form.monto),
        forma_pago:    form.forma_pago,
        referencia:    form.referencia.trim() || null,
        notas:         form.notas.trim() || null,
        registrado_por: userId,
      })
      if (error) throw error
      onExito()
    } catch (e) {
      setErrores({ general: 'Error: ' + e.message })
    } finally {
      setGuardando(false)
    }
  }

  const inputStyle = (err) => ({
    width: '100%', padding: '9px 12px', fontSize: 13, outline: 'none',
    border: `0.5px solid ${err ? 'var(--color-border-danger)' : C.borde}`,
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: C.bg, color: 'var(--color-text-primary)', boxSizing: 'border-box',
  })

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 80 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw', backgroundColor: C.bg, borderLeft: `0.5px solid ${C.borde}`, zIndex: 90, display: 'flex', flexDirection: 'column', animation: 'slideInRight .2s ease' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `0.5px solid ${C.borde}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: 'var(--color-background-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="var(--color-text-warning)" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>Registrar pago</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>
                Saldo pendiente: <strong>${fmt(maxPagable)}</strong>
              </p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-secondary)' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Alerta descuento pp */}
          {tieneDescuento && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--color-background-success)', border: `0.5px solid var(--color-border-success)`, marginBottom: 16 }}>
              <Zap size={16} color="var(--color-text-success)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-success)', margin: '0 0 2px' }}>
                  💰 Descuento por pronto pago disponible
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-success)', margin: 0, opacity: 0.85 }}>
                  Ahorra <strong>${fmt(cxp.descuento_pp_monto)}</strong> pagando antes del {fmtFechaCorta(cxp.descuento_pp_fecha)}.
                  El monto ya fue ajustado automáticamente.
                </p>
              </div>
            </div>
          )}

          {errores.general && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--color-background-danger)', border: `0.5px solid var(--color-border-danger)`, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: 0 }}>{errores.general}</p>
            </div>
          )}

          {/* Fecha */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5 }}>
              Fecha de pago <span style={{ color: 'var(--color-text-danger)' }}>*</span>
            </label>
            <input type="date" value={form.fecha_pago} onChange={e => setF('fecha_pago', e.target.value)} style={inputStyle(errores.fecha_pago)} />
            {errores.fecha_pago && <p style={{ fontSize: 11, color: 'var(--color-text-danger)', margin: '3px 0 0' }}>{errores.fecha_pago}</p>}
          </div>

          {/* Monto */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5 }}>
              Monto a pagar <span style={{ color: 'var(--color-text-danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>$</span>
              <input type="number" min="0.01" step="0.01" value={form.monto} onChange={e => setF('monto', e.target.value)} style={{ ...inputStyle(errores.monto), paddingLeft: 22 }} />
            </div>
            {errores.monto && <p style={{ fontSize: 11, color: 'var(--color-text-danger)', margin: '3px 0 0' }}>{errores.monto}</p>}
            {Number(form.monto) !== maxPagable && (
              <button onClick={() => setF('monto', maxPagable.toFixed(2))} style={{ fontSize: 11, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0', textDecoration: 'underline' }}>
                Pagar saldo completo (${fmt(maxPagable)})
              </button>
            )}
          </div>

          {/* Forma de pago */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5 }}>Forma de pago</label>
            <div style={{ position: 'relative' }}>
              <select value={form.forma_pago} onChange={e => setF('forma_pago', e.target.value)} style={{ ...inputStyle(), appearance: 'none', paddingRight: 28 }}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Banco origen */}
          {bancos.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5 }}>Cuenta bancaria que paga</label>
              <div style={{ position: 'relative' }}>
                <select value={form.banco_id} onChange={e => setF('banco_id', e.target.value)} style={{ ...inputStyle(), appearance: 'none', paddingRight: 28 }}>
                  <option value="">Sin cuenta específica</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre} ({b.moneda})</option>)}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}

          {/* Referencia */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5 }}>Referencia / No. de operación</label>
            <input type="text" placeholder="Folio de transferencia, cheque, etc." value={form.referencia} onChange={e => setF('referencia', e.target.value)} style={inputStyle()} />
          </div>

          {/* Notas */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5 }}>Notas del pago</label>
            <textarea value={form.notas} onChange={e => setF('notas', e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: `0.5px solid ${C.borde}`, flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 'var(--border-radius-md)', border: 'none', background: guardando ? 'var(--color-border-secondary)' : 'var(--color-text-warning)', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} />{guardando ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Página principal ────────────────────────────────────────
export default function CxPDetalle() {
  const { id }  = useParams()
  const nav     = useNavigate()

  const [cxp,           setCxp]           = useState(null)
  const [pagos,         setPagos]         = useState([])
  const [bancos,        setBancos]        = useState([])
  const [companyId,     setCompanyId]     = useState(null)
  const [userId,        setUserId]        = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [panelPago,     setPanelPago]     = useState(false)
  const [editandoNota,  setEditandoNota]  = useState(false)
  const [nota,          setNota]          = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [eliminando,    setEliminando]    = useState(null)
  const [toast,         setToast]         = useState(null)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Carga ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => { if (companyId) cargarTodo() }, [companyId, id])

  const cargarTodo = async () => {
    setLoading(true)
    const [{ data: cx }, { data: pgs }, { data: bks }] = await Promise.all([
      supabase
        .from('v_tesoreria_cxp')
        .select('*, terceros(id, razon_social, nombre_comercial, rfc, telefono)')
        .eq('id', id)
        .single(),
      supabase
        .from('tesoreria_cxp_pagos')
        .select('*, company_bancos(nombre, banco)')
        .eq('cxp_id', id)
        .order('fecha_pago', { ascending: false }),
      supabase
        .from('company_bancos')
        .select('id, nombre, banco, moneda')
        .eq('company_id', companyId)
        .eq('activa', true)
        .order('orden'),
    ])
    setCxp(cx)
    setPagos(pgs || [])
    setBancos(bks || [])
    setNota(cx?.notas || '')
    setLoading(false)
  }

  // ── Cambiar estatus ────────────────────────────────────────
  const cambiarEstatus = async (nuevoEstatus) => {
    const extra = nuevoEstatus === 'programado' && cxp.fecha_pago_prog
      ? {}
      : nuevoEstatus === 'programado'
        ? { fecha_pago_prog: hoy() }
        : {}
    const { error } = await supabase
      .from('tesoreria_cxp')
      .update({ estatus: nuevoEstatus, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { mostrarToast('Error: ' + error.message, 'error'); return }
    mostrarToast(`Estatus actualizado a "${nuevoEstatus}"`)
    cargarTodo()
  }

  // ── Toggle proveedor crítico ───────────────────────────────
  const toggleCritico = async () => {
    const { error } = await supabase
      .from('tesoreria_cxp')
      .update({ proveedor_critico: !cxp.proveedor_critico, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { mostrarToast('Error: ' + error.message, 'error'); return }
    mostrarToast(cxp.proveedor_critico ? 'Marcado como no crítico' : '🏗️ Marcado como proveedor crítico')
    cargarTodo()
  }

  // ── Guardar nota ───────────────────────────────────────────
  const guardarNota = async () => {
    setGuardandoNota(true)
    const { error } = await supabase
      .from('tesoreria_cxp')
      .update({ notas: nota.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', id)
    setGuardandoNota(false)
    if (error) { mostrarToast('Error: ' + error.message, 'error'); return }
    setEditandoNota(false)
    mostrarToast('Nota guardada')
    cargarTodo()
  }

  // ── Eliminar pago ──────────────────────────────────────────
  const eliminarPago = async (pagoId) => {
    if (!window.confirm('¿Eliminar este pago registrado? Se recalculará el saldo.')) return
    setEliminando(pagoId)
    const { error } = await supabase.from('tesoreria_cxp_pagos').delete().eq('id', pagoId)
    setEliminando(null)
    if (error) { mostrarToast('Error: ' + error.message, 'error'); return }
    mostrarToast('Pago eliminado')
    cargarTodo()
  }

  // ── Exportar resumen ───────────────────────────────────────
  const exportarResumen = () => {
    if (!cxp) return
    const lineas = [
      `OBRIX — Cuenta por Pagar`,
      `Fecha: ${new Date().toLocaleDateString('es-MX')}`,
      ``,
      `Proveedor: ${cxp.terceros?.razon_social || '—'}`,
      `RFC:       ${cxp.terceros?.rfc || '—'}`,
      `Concepto:  ${cxp.concepto}`,
      `Folio:     ${cxp.numero_documento || '—'}`,
      `Emisión:   ${fmtFechaCorta(cxp.fecha_emision)}`,
      `Vencimiento:${fmtFechaCorta(cxp.fecha_vencimiento)}`,
      ``,
      `Monto original: $${fmt(cxp.monto_original)}`,
      `Monto pagado:   $${fmt(cxp.monto_pagado)}`,
      `Saldo pendiente:$${fmt(cxp.saldo_pendiente)}`,
      `Estatus:        ${ESTATUS_CFG[cxp.estatus]?.label || cxp.estatus}`,
      `Crítico:        ${cxp.proveedor_critico ? 'Sí' : 'No'}`,
      ``,
      `─── Historial de pagos ───`,
      ...pagos.map(p => `${fmtFechaCorta(p.fecha_pago)}  $${fmt(p.monto)}  ${p.forma_pago}  ${p.referencia || ''}`),
    ]
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `cxp_${cxp.numero_documento || cxp.id.slice(0, 8)}.txt` })
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Loading / Not found ────────────────────────────────────
  if (loading) {
    return (
      <MainLayout title="CxP — Detalle">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${C.borde}`, borderTopColor: 'var(--color-text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  if (!cxp) {
    return (
      <MainLayout title="CxP — Detalle">
        <div style={{ textAlign: 'center', padding: 60 }}>
          <AlertOctagon size={40} style={{ color: 'var(--color-text-danger)', margin: '0 auto 16px', display: 'block' }} />
          <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 16px' }}>Cuenta no encontrada</p>
          <button onClick={() => nav('/tesoreria/cxp')} style={{ padding: '8px 18px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        </div>
      </MainLayout>
    )
  }

  const est       = ESTATUS_CFG[cxp.estatus] || ESTATUS_CFG.pendiente
  const EstIcon   = est.icon
  const sem       = semaforo(cxp.dias_restantes, cxp.estatus)
  const pctPag    = pct(Number(cxp.monto_pagado || 0), Number(cxp.monto_original))
  const esCerrada = ['pagado','cancelado'].includes(cxp.estatus)
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const tieneDescuento = cxp.descuento_pp_fecha && cxp.descuento_pp_fecha >= hoy() && Number(cxp.descuento_pp_monto || 0) > 0

  return (
    <MainLayout title="📉 Detalle CxP">
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Breadcrumb */}
        <button onClick={() => nav('/tesoreria/cxp')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)', padding: 0, fontWeight: 500, alignSelf: 'flex-start' }}>
          <ChevronLeft size={14} /> Cuentas por Pagar
        </button>

        {/* ── Header ────────────────────────────────────────── */}
        <div style={{ ...borde, background: C.bg, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: cxp.proveedor_critico ? 'var(--color-background-warning)' : 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {cxp.proveedor_critico
                  ? <Star size={22} color="var(--color-text-warning)" />
                  : <Building2 size={22} color="var(--color-text-secondary)" />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    {cxp.terceros?.razon_social || cxp.terceros?.nombre_comercial || 'Sin proveedor'}
                  </h2>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, backgroundColor: est.bg, color: est.color, fontWeight: 600 }}>
                    <EstIcon size={11} />{est.label}
                  </span>
                  {sem && (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, backgroundColor: sem.bg, color: sem.color, fontWeight: 600 }}>
                      {sem.label}
                    </span>
                  )}
                  {cxp.proveedor_critico && (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, backgroundColor: 'var(--color-background-warning)', color: 'var(--color-text-warning)', fontWeight: 600 }}>
                      🏗️ Proveedor crítico
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>{cxp.concepto}</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0, fontFamily: 'monospace' }}>
                  {cxp.terceros?.rfc && `RFC: ${cxp.terceros.rfc}`}
                  {cxp.numero_documento && ` · Folio: ${cxp.numero_documento}`}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={exportarResumen} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <Download size={13} /> Resumen
              </button>
              {!esCerrada && (
                <button
                  onClick={() => setPanelPago(true)}
                  disabled={Number(cxp.saldo_pendiente) <= 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--border-radius-md)', border: 'none', background: Number(cxp.saldo_pendiente) <= 0 ? 'var(--color-border-secondary)' : 'var(--color-text-warning)', color: '#fff', cursor: Number(cxp.saldo_pendiente) <= 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  <Plus size={14} /> Registrar pago
                </button>
              )}
            </div>
          </div>

          {/* Alerta descuento pronto pago */}
          {tieneDescuento && !esCerrada && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '10px 14px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--color-background-success)', border: `0.5px solid var(--color-border-success)` }}>
              <Zap size={15} color="var(--color-text-success)" />
              <p style={{ fontSize: 12, color: 'var(--color-text-success)', margin: 0, fontWeight: 500 }}>
                💰 <strong>Descuento por pronto pago:</strong> ahorra ${fmt(cxp.descuento_pp_monto)} ({cxp.descuento_pp_pct}%) pagando antes del {fmtFechaCorta(cxp.descuento_pp_fecha)}.
              </p>
            </div>
          )}

          {/* Barra de progreso */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Pagado: <strong>${fmt(cxp.monto_pagado)}</strong> de <strong>${fmt(cxp.monto_original)}</strong>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: pctPag >= 100 ? 'var(--color-text-success)' : 'var(--color-text-primary)' }}>
                {pctPag}%
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 99, backgroundColor: C.borde, overflow: 'hidden' }}>
              <div style={{ width: `${pctPag}%`, height: '100%', borderRadius: 99, background: pctPag >= 100 ? 'var(--color-text-success)' : 'var(--color-text-warning)', transition: 'width .4s' }} />
            </div>
          </div>

          {/* Montos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Monto original',  val: `$${fmt(cxp.monto_original)}`,   color: 'var(--color-text-primary)'  },
              { label: 'Monto pagado',    val: `$${fmt(cxp.monto_pagado)}`,      color: 'var(--color-text-success)'  },
              { label: 'Saldo pendiente', val: `$${fmt(cxp.saldo_pendiente)}`,   color: Number(cxp.saldo_pendiente) > 0 ? 'var(--color-text-warning)' : 'var(--color-text-success)' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', padding: '10px', borderRadius: 'var(--border-radius-md)', backgroundColor: C.bgSec }}>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: m.color, margin: 0, fontFamily: 'monospace' }}>{m.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Datos del documento + Proveedor ──────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Info documento */}
          <div style={{ ...borde, background: C.bg, padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>Datos del documento</p>
            {[
              { label: 'Emisión',       val: fmtFecha(cxp.fecha_emision)     },
              { label: 'Vencimiento',   val: fmtFecha(cxp.fecha_vencimiento) },
              { label: 'Pago prog.',    val: cxp.fecha_pago_prog ? fmtFecha(cxp.fecha_pago_prog) : '—' },
              { label: 'Moneda',        val: cxp.moneda                       },
              { label: 'Origen',        val: cxp.origen?.replace('_',' ')    },
              { label: 'Validado SAT',  val: cxp.validado_sat ? '✅ Sí' : '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${C.borde}` }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{val || '—'}</span>
              </div>
            ))}
          </div>

          {/* Proveedor + controles */}
          <div style={{ ...borde, background: C.bg, padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>Proveedor</p>
            {cxp.terceros ? (
              <>
                {[
                  { label: 'Razón social', val: cxp.terceros.razon_social },
                  { label: 'RFC',          val: cxp.terceros.rfc          },
                  { label: 'Teléfono',     val: cxp.terceros.telefono     },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${C.borde}` }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{val || '—'}</span>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>Sin proveedor asignado</p>
            )}

            {/* Toggle proveedor crítico */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: '10px 0', borderTop: `0.5px solid ${C.borde}` }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>🏗️ Proveedor crítico de obra</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>La IA le da prioridad en propuestas de pago</p>
              </div>
              <button onClick={toggleCritico} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                {cxp.proveedor_critico
                  ? <ToggleRight size={26} color="var(--color-text-warning)" />
                  : <ToggleLeft  size={26} color="var(--color-text-tertiary)" />}
              </button>
            </div>

            {/* Cambiar estatus */}
            {!esCerrada && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${C.borde}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>Cambiar estatus</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['programado','en_revision','cancelado'].map(s => {
                    const cfg = ESTATUS_CFG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => cambiarEstatus(s)}
                        disabled={cxp.estatus === s}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `0.5px solid ${cxp.estatus === s ? cfg.color : C.borde}`, backgroundColor: cxp.estatus === s ? cfg.bg : C.bg, color: cxp.estatus === s ? cfg.color : 'var(--color-text-secondary)', cursor: cxp.estatus === s ? 'default' : 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        <cfg.icon size={11} />{cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Historial de pagos ────────────────────────────── */}
        <div style={{ ...borde, background: C.bg, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `0.5px solid ${C.borde}`, backgroundColor: C.bgSec }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Historial de pagos</p>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {pagos.length} pago{pagos.length !== 1 ? 's' : ''} · Total: ${fmt(totalPagado)}
            </span>
          </div>

          {pagos.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <DollarSign size={28} style={{ color: 'var(--color-text-tertiary)', margin: '0 auto 10px', display: 'block' }} />
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Sin pagos registrados aún.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 160px 1fr 100px 36px', padding: '10px 20px', borderBottom: `0.5px solid ${C.borde}`, backgroundColor: C.bgSec, gap: 8 }}>
                {['Fecha','Monto','Forma de pago','Referencia / Cuenta','Registrado',''].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
                ))}
              </div>
              {pagos.map((pago, i) => (
                <div key={pago.id} style={{ display: 'grid', gridTemplateColumns: '100px 120px 160px 1fr 100px 36px', padding: '12px 20px', borderBottom: i < pagos.length - 1 ? `0.5px solid ${C.borde}` : 'none', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--color-text-primary)', margin: 0, fontFamily: 'monospace' }}>{fmtFechaCorta(pago.fecha_pago)}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-warning)', margin: 0, fontFamily: 'monospace' }}>-${fmt(pago.monto)}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>{pago.forma_pago || '—'}</p>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-primary)', margin: 0 }}>{pago.referencia || '—'}</p>
                    {pago.company_bancos && <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '1px 0 0' }}>{pago.company_bancos.nombre}</p>}
                    {pago.notas && <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '1px 0 0', fontStyle: 'italic' }}>{pago.notas}</p>}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>{fmtHora(pago.created_at)}</p>
                  {!esCerrada && (
                    <button onClick={() => eliminarPago(pago.id)} disabled={eliminando === pago.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: `0.5px solid var(--color-border-danger)`, background: 'var(--color-background-danger)', cursor: 'pointer', flexShrink: 0 }}>
                      <Trash2 size={12} color="var(--color-text-danger)" />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Notas internas ───────────────────────────────── */}
        <div style={{ ...borde, background: C.bg, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editandoNota ? 12 : (cxp.notas ? 10 : 0) }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Notas internas
            </p>
            {!editandoNota && !esCerrada && (
              <button onClick={() => setEditandoNota(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <Edit2 size={12} /> {cxp.notas ? 'Editar' : 'Agregar nota'}
              </button>
            )}
          </div>
          {editandoNota ? (
            <>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} placeholder="Notas internas, condiciones especiales..." style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, color: 'var(--color-text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => { setEditandoNota(false); setNota(cxp.notas || '') }} style={{ flex: 1, padding: '8px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                <button onClick={guardarNota} disabled={guardandoNota} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 'var(--border-radius-md)', border: 'none', background: guardandoNota ? 'var(--color-border-secondary)' : 'var(--color-text-primary)', color: '#fff', cursor: guardandoNota ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                  <Save size={13} />{guardandoNota ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </>
          ) : (
            cxp.notas
              ? <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>{cxp.notas}</p>
              : <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0, fontStyle: 'italic' }}>Sin notas registradas.</p>
          )}
        </div>

      </div>

      {/* Panel pago */}
      {panelPago && (
        <PanelPago
          cxp={cxp}
          bancos={bancos}
          companyId={companyId}
          userId={userId}
          onCerrar={() => setPanelPago(false)}
          onExito={() => { setPanelPago(false); mostrarToast('✅ Pago registrado'); cargarTodo() }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 'var(--border-radius-lg)', background: toast.tipo === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)', border: `0.5px solid ${toast.tipo === 'error' ? 'var(--color-border-danger)' : 'var(--color-border-success)'}`, animation: 'fadeInDown .2s ease', maxWidth: 380 }}>
          {toast.tipo === 'error' ? <AlertTriangle size={16} color="var(--color-text-danger)" /> : <CheckCircle2 size={16} color="var(--color-text-success)" />}
          <p style={{ fontSize: 13, fontWeight: 500, color: toast.tipo === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)', margin: 0 }}>{toast.msg}</p>
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