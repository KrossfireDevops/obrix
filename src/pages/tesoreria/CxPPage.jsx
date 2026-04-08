// ============================================================
//  OBRIX — Cuentas por Pagar
//  src/pages/tesoreria/CxPPage.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { MainLayout }          from '../../components/layout/MainLayout'
import { supabase }            from '../../config/supabase'
import {
  Plus, Search, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, XCircle, AlertOctagon, TrendingDown,
  DollarSign, Calendar, Building2, X, Save, FileText,
  ChevronDown, Download, Zap, GripVertical, Settings,
  Sparkles, Shield, Lock, ToggleLeft, ToggleRight,
  ArrowUp, ArrowDown, Trash2, Star,
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
  pendiente:    { label: 'Pendiente',    icon: Clock,         bg: '#F9FAFB', color: '#6B7280' },
  programado:   { label: 'Programado',   icon: Calendar,      bg: '#EFF6FF',      color: '#2563EB'      },
  pagado:       { label: 'Pagado',       icon: CheckCircle2,  bg: '#F0FDF4',   color: '#16A34A'   },
  vencido:      { label: 'Vencido',      icon: AlertOctagon,  bg: '#FEF2F2',    color: '#DC2626'    },
  cancelado:    { label: 'Cancelado',    icon: XCircle,       bg: '#F9FAFB', color: '#9CA3AF'  },
  en_revision:  { label: 'En revisión',  icon: AlertTriangle, bg: '#EFF6FF',                           color: '#1D4ED8'                     },
}

// ─── Tipos de regla ──────────────────────────────────────────
const TIPO_REGLA = {
  vencimiento:        { label: 'Vencimiento próximo',       icon: '📅', desc: 'Prioriza lo que vence antes' },
  descuento_pp:       { label: 'Descuento pronto pago',     icon: '💰', desc: 'Aprovecha descuentos disponibles' },
  flujo_disponible:   { label: 'Respetar flujo disponible', icon: '🏦', desc: 'No comprometer más del X% del saldo' },
  proveedor_critico:  { label: 'Proveedores críticos',      icon: '🏗️', desc: 'Materiales y subcontratos en obra activa' },
  monto_minimo:       { label: 'Montos menores primero',    icon: '⬇️', desc: 'Liquida deudas pequeñas antes' },
  monto_maximo:       { label: 'Montos mayores primero',    icon: '⬆️', desc: 'Prioriza los compromisos más grandes' },
  personalizada:      { label: 'Regla personalizada',       icon: '✨', desc: 'Instrucción en texto libre para la IA' },
  cuenta_proposito:   { label: 'Cuenta por propósito',      icon: '🏦', desc: 'Asignar cuenta bancaria según el tipo de pago' },
}

// ─── Semáforo ────────────────────────────────────────────────
const semaforo = (dias, estatus) => {
  if (estatus === 'pagado' || estatus === 'cancelado') return null
  if (estatus === 'vencido' || (dias ?? 0) < 0) return { color: '#DC2626', label: `${Math.abs(dias ?? 0)}d vencido`, bg: '#FEF2F2' }
  if ((dias ?? 99) <= 3)  return { color: '#DC2626', label: `Vence en ${dias}d`, bg: '#FEF2F2' }
  if ((dias ?? 99) <= 7)  return { color: '#D97706', label: `Vence en ${dias}d`, bg: '#FFFBEB' }
  if ((dias ?? 99) <= 15) return { color: '#CA8A04', label: `${dias}d restantes`, bg: '#FEFCE8' }
  return                         { color: '#16A34A', label: `${dias}d restantes`, bg: '#F0FDF4' }
}

// ─── Constantes ──────────────────────────────────────────────
const C = { borde: '#E5E7EB', bg: '#FFFFFF', bgSec: '#F9FAFB' }
const borde = { border: '1px solid #E5E7EB', borderRadius: '12px' }

// ─── Modal: Reglas de pago ────────────────────────────────────
const ModalReglas = ({ reglas, onCerrar, onGuardar, companyId }) => {
  const [lista,    setLista]    = useState(reglas)
  const [guardando,setGuardando]= useState(false)
  const [dragIdx,  setDragIdx]  = useState(null)
  const [modalNueva, setModalNueva] = useState(false)
  const [nuevaTipo, setNuevaTipo]   = useState('vencimiento')
  const [nuevaParams, setNuevaParams] = useState({})
  const [nuevaInstruccion, setNuevaInstruccion] = useState('')

  const mover = (idx, dir) => {
    const next = [...lista]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setLista(next.map((r, i) => ({ ...r, orden: i + 1 })))
  }

  const toggleActiva = (idx) => {
    setLista(l => l.map((r, i) => i === idx ? { ...r, activa: !r.activa } : r))
  }

  const eliminar = (idx) => {
    setLista(l => l.filter((_, i) => i !== idx).map((r, i) => ({ ...r, orden: i + 1 })))
  }

  const agregarRegla = () => {
    const params = nuevaTipo === 'personalizada'
      ? { instruccion: nuevaInstruccion }
      : nuevaTipo === 'cuenta_proposito'
        ? { nomina: 'nomina', impuestos: 'impuestos', operaciones: 'operaciones' }
        : nuevaParams
    const nueva = {
      company_id:  companyId,
      nombre:      TIPO_REGLA[nuevaTipo].label,
      descripcion: TIPO_REGLA[nuevaTipo].desc,
      tipo:        nuevaTipo,
      activa:      true,
      orden:       lista.length + 1,
      parametros:  params,
    }
    setLista(l => [...l, nueva])
    setModalNueva(false)
    setNuevaTipo('vencimiento')
    setNuevaParams({})
    setNuevaInstruccion('')
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      // Upsert por company_id + orden
      await supabase.from('tesoreria_reglas_pago').delete().eq('company_id', companyId)
      if (lista.length > 0) {
        const { error } = await supabase.from('tesoreria_reglas_pago').insert(
          lista.map((r, i) => ({
            company_id:  companyId,
            nombre:      r.nombre,
            descripcion: r.descripcion,
            tipo:        r.tipo,
            activa:      r.activa,
            orden:       i + 1,
            parametros:  r.parametros || {},
          }))
        )
        if (error) throw error
      }
      onGuardar(lista)
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...borde, background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'fadeInDown .2s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#7C3AED" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Reglas de pago CxP</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>La IA aplica estas reglas en orden de prioridad al proponer pagos</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}><X size={18} /></button>
        </div>

        {/* Lista de reglas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {lista.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: '#9CA3AF' }}>
              <Sparkles size={28} style={{ margin: '0 auto 10px', display: 'block' }} />
              <p style={{ fontSize: 13, margin: 0 }}>Sin reglas configuradas. Agrega al menos una para que la IA pueda proponer pagos.</p>
            </div>
          )}

          {lista.map((regla, idx) => {
            const meta = TIPO_REGLA[regla.tipo] || TIPO_REGLA.personalizada
            return (
              <div
                key={idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: '8px',
                  border: `0.5px solid ${regla.activa ? '#E5E7EB' : 'transparent'}`,
                  backgroundColor: regla.activa ? '#FFFFFF' : '#F9FAFB',
                  marginBottom: 8, opacity: regla.activa ? 1 : 0.55,
                  transition: 'all .15s',
                }}
              >
                {/* Número de orden */}
                <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: regla.activa ? '#F5F3FF' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: regla.activa ? '#7C3AED' : '#9CA3AF' }}>{idx + 1}</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{meta.icon}</span>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{regla.nombre}</p>
                  </div>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                    {regla.tipo === 'personalizada' && regla.parametros?.instruccion
                      ? `"${regla.parametros.instruccion}"`
                      : regla.tipo === 'cuenta_proposito'
                        ? '👷 Nómina · 🧾 Fiscal · ⚙️ Operaciones → cuenta asignada automáticamente'
                        : meta.desc}
                    {regla.tipo === 'flujo_disponible' && regla.parametros?.pct_maximo
                      ? ` — máx ${regla.parametros.pct_maximo}% del saldo` : ''}
                    {regla.tipo === 'descuento_pp' && regla.parametros?.ahorro_minimo
                      ? ` — ahorro mín $${fmt(regla.parametros.ahorro_minimo)}` : ''}
                  </p>
                </div>

                {/* Controles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => mover(idx, -1)} disabled={idx === 0} style={{ padding: '4px 6px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>
                    <ArrowUp size={12} color="#6B7280" />
                  </button>
                  <button onClick={() => mover(idx, +1)} disabled={idx === lista.length - 1} style={{ padding: '4px 6px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: idx === lista.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === lista.length - 1 ? 0.3 : 1 }}>
                    <ArrowDown size={12} color="#6B7280" />
                  </button>
                  <button onClick={() => toggleActiva(idx)} style={{ padding: '4px 6px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }}>
                    {regla.activa
                      ? <ToggleRight size={16} color="#16A34A" />
                      : <ToggleLeft  size={16} color="#9CA3AF" />}
                  </button>
                  <button onClick={() => eliminar(idx)} style={{ padding: '4px 6px', background: 'none', border: `0.5px solid #EF4444`, borderRadius: 6, cursor: 'pointer' }}>
                    <Trash2 size={12} color="#DC2626" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Agregar nueva regla */}
          {!modalNueva ? (
            <button onClick={() => setModalNueva(true)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1.5px dashed #E5E7EB`, background: '#F9FAFB', cursor: 'pointer', fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={14} /> Agregar regla
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: '8px', border: `0.5px solid #DDD6FE`, backgroundColor: '#FAF8FF' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED', margin: '0 0 10px' }}>Nueva regla</p>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, fontWeight: 600 }}>Tipo de regla</label>
                <select value={nuevaTipo} onChange={e => { setNuevaTipo(e.target.value); setNuevaParams({}) }} style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}>
                  {Object.entries(TIPO_REGLA).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              {/* Parámetros según tipo */}
              {nuevaTipo === 'flujo_disponible' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, fontWeight: 600 }}>% máximo del saldo a comprometer</label>
                  <input type="number" min={1} max={100} placeholder="40" value={nuevaParams.pct_maximo || ''} onChange={e => setNuevaParams({ pct_maximo: Number(e.target.value) })} style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              {nuevaTipo === 'descuento_pp' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, fontWeight: 600 }}>Ahorro mínimo para activar ($)</label>
                  <input type="number" min={0} placeholder="500" value={nuevaParams.ahorro_minimo || ''} onChange={e => setNuevaParams({ ahorro_minimo: Number(e.target.value) })} style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              {nuevaTipo === 'vencimiento' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, fontWeight: 600 }}>Días de alerta antes del vencimiento</label>
                  <input type="number" min={1} placeholder="5" value={nuevaParams.dias_umbral || ''} onChange={e => setNuevaParams({ dias_umbral: Number(e.target.value) })} style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              {nuevaTipo === 'personalizada' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, fontWeight: 600 }}>Instrucción para la IA</label>
                  <textarea value={nuevaInstruccion} onChange={e => setNuevaInstruccion(e.target.value)} placeholder='Ej: "Pagar nómina antes que cualquier proveedor"' rows={2} style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              )}
              {nuevaTipo === 'cuenta_proposito' && (
                <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px', fontWeight: 600 }}>Cómo funciona esta regla</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { tipo: 'nomina',      emoji: '👷', label: 'Pagos de nómina y personal',        cuenta: 'Cuenta Nómina'    },
                      { tipo: 'impuestos',   emoji: '🧾', label: 'ISR, IVA y retenciones SAT',        cuenta: 'Cuenta Fiscal'    },
                      { tipo: 'operaciones', emoji: '⚙️', label: 'Proveedores, materiales, gastos',   cuenta: 'Cuenta Operativa' },
                    ].map(r => (
                      <div key={r.tipo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{r.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, color: '#374151' }}>{r.label}</span>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                          → {r.cuenta}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: '8px 0 0', lineHeight: 1.4 }}>
                    La IA detectará automáticamente el propósito de cada CxP y seleccionará la cuenta bancaria correcta al proponer pagos.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModalNueva(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                <button onClick={agregarRegla} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Agregar regla
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10, borderRadius: '8px', border: 'none', background: guardando ? '#D1D5DB' : '#7C3AED', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} />{guardando ? 'Guardando...' : 'Guardar reglas'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel nueva CxP manual ──────────────────────────────────
const PanelNuevoCxP = ({ terceros, onCerrar, onExito, companyId, userId }) => {
  const [form,     setForm]     = useState({
    concepto: '', numero_documento: '', tercero_id: '',
    fecha_emision: hoy(), fecha_vencimiento: '',
    monto_original: '', moneda: 'MXN', origen: 'manual',
    descuento_pp_pct: '', descuento_pp_fecha: '',
    proveedor_critico: false, notas: '',
  })
  const [errores,   setErrores]   = useState({})
  const [guardando, setGuardando] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    const e = {}
    if (!form.concepto.trim())        e.concepto          = 'El concepto es obligatorio'
    if (!form.fecha_emision)          e.fecha_emision     = 'Requerida'
    if (!form.fecha_vencimiento)      e.fecha_vencimiento = 'Requerida'
    if (form.fecha_vencimiento && form.fecha_emision && form.fecha_vencimiento < form.fecha_emision)
                                      e.fecha_vencimiento = 'Debe ser posterior'
    if (!form.monto_original || isNaN(Number(form.monto_original)) || Number(form.monto_original) <= 0)
                                      e.monto_original    = 'Ingresa un monto válido'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      const descPct   = form.descuento_pp_pct ? Number(form.descuento_pp_pct) : null
      const montoBase = Number(form.monto_original)
      const descMonto = descPct ? parseFloat((montoBase * descPct / 100).toFixed(2)) : null

      const { error } = await supabase.from('tesoreria_cxp').insert({
        company_id:        companyId,
        tercero_id:        form.tercero_id || null,
        concepto:          form.concepto.trim(),
        numero_documento:  form.numero_documento.trim() || null,
        fecha_emision:     form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        monto_original:    montoBase,
        monto_pagado:      0,
        moneda:            form.moneda,
        estatus:           'pendiente',
        origen:            form.origen,
        descuento_pp_pct:  descPct,
        descuento_pp_fecha:form.descuento_pp_fecha || null,
        descuento_pp_monto:descMonto,
        proveedor_critico: form.proveedor_critico,
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
  const Label = ({ t, req }) => <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>{t}{req && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}</label>
  const Err   = ({ k }) => errores[k] ? <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{errores[k]}</p> : null

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 80 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '95vw', backgroundColor: '#FFFFFF', borderLeft: '1px solid #E5E7EB', zIndex: 90, display: 'flex', flexDirection: 'column', animation: 'slideInRight .2s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={16} color="#D97706" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Nueva cuenta por pagar</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Registro manual</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {errores.general && <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: `0.5px solid #EF4444`, marginBottom: 14 }}><p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{errores.general}</p></div>}

          <div style={{ marginBottom: 14 }}>
            <Label t="Concepto" req />
            <input type="text" placeholder='Ej: "Factura proveedor estructura metálica"' value={form.concepto} onChange={e => setF('concepto', e.target.value)} style={inputStyle(errores.concepto)} />
            <Err k="concepto" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <Label t="Proveedor" />
            <div style={{ position: 'relative' }}>
              <select value={form.tercero_id} onChange={e => setF('tercero_id', e.target.value)} style={{ ...inputStyle(), appearance: 'none', paddingRight: 28 }}>
                <option value="">Sin proveedor asignado</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.razon_social || t.nombre_comercial}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Label t="No. de documento / Factura" />
            <input type="text" placeholder="Folio o referencia de la factura" value={form.numero_documento} onChange={e => setF('numero_documento', e.target.value)} style={inputStyle()} />
          </div>

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

          {/* Descuento por pronto pago */}
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>💰 Descuento por pronto pago (opcional)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label t="% de descuento" />
                <div style={{ position: 'relative' }}>
                  <input type="number" min="0" max="100" step="0.1" placeholder="0.0" value={form.descuento_pp_pct} onChange={e => setF('descuento_pp_pct', e.target.value)} style={{ ...inputStyle(), paddingRight: 24 }} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9CA3AF' }}>%</span>
                </div>
              </div>
              <div>
                <Label t="Válido hasta" />
                <input type="date" value={form.descuento_pp_fecha} onChange={e => setF('descuento_pp_fecha', e.target.value)} style={inputStyle()} />
              </div>
            </div>
            {form.descuento_pp_pct && form.monto_original && (
              <p style={{ fontSize: 11, color: '#16A34A', margin: '6px 0 0', fontWeight: 500 }}>
                💡 Ahorro potencial: ${fmt(Number(form.monto_original) * Number(form.descuento_pp_pct) / 100)}
              </p>
            )}
          </div>

          {/* Proveedor crítico */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>🏗️ Proveedor crítico de obra</p>
              <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>La IA le dará mayor prioridad en las propuestas de pago</p>
            </div>
            <button onClick={() => setF('proveedor_critico', !form.proveedor_critico)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              {form.proveedor_critico
                ? <ToggleRight size={28} color="#D97706" />
                : <ToggleLeft  size={28} color="#9CA3AF" />}
            </button>
          </div>

          <div style={{ marginBottom: 0 }}>
            <Label t="Notas internas" />
            <textarea value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Observaciones o condiciones especiales..." rows={2} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: '8px', border: 'none', background: guardando ? '#D1D5DB' : '#D97706', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} />{guardando ? 'Guardando...' : 'Registrar CxP'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Página principal ────────────────────────────────────────
export default function CxPPage() {
  const nav = useNavigate()
  const [companyId,     setCompanyId]     = useState(null)
  const [userId,        setUserId]        = useState(null)
  const [cuentas,       setCuentas]       = useState([])
  const [terceros,      setTerceros]      = useState([])
  const [reglas,        setReglas]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [panelNuevo,    setPanelNuevo]    = useState(false)
  const [modalReglas,   setModalReglas]   = useState(false)
  const [busqueda,      setBusqueda]      = useState('')
  const [filtroEst,     setFiltroEst]     = useState('todos')
  const [filtroSem,     setFiltroSem]     = useState('todos')
  const [toast,         setToast]         = useState(null)

  const mostrarToast = (msg, tipo = 'success') => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500) }

  // ── KPIs ──────────────────────────────────────────────────
  const activas        = cuentas.filter(c => !['pagado','cancelado'].includes(c.estatus))
  const totalPendiente = activas.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const totalVencido   = activas.filter(c => (c.dias_restantes ?? 0) < 0).reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const ahorroDisponible = activas.filter(c => c.descuento_pp_fecha && c.descuento_pp_fecha >= hoy() && c.descuento_pp_monto).reduce((s, c) => s + Number(c.descuento_pp_monto || 0), 0)

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
    const [{ data: cx }, { data: ter }, { data: reg }] = await Promise.all([
      supabase
        .from('tesoreria_cxp')
        .select('*, terceros(razon_social, nombre_comercial, rfc)')
        .eq('company_id', companyId)
        .order('fecha_vencimiento', { ascending: true })
        .limit(300),
      supabase
        .from('terceros')
        .select('id, razon_social, nombre_comercial, rfc')
        .eq('company_id', companyId)
        .eq('tipo_relacion', 'proveedor')
        .order('razon_social'),
      supabase
        .from('tesoreria_reglas_pago')
        .select('*')
        .eq('company_id', companyId)
        .order('orden'),
    ])
    setCuentas(cx || [])
    setTerceros(ter || [])
    setReglas(reg || [])
    setLoading(false)
  }

  // ── Filtrado ───────────────────────────────────────────────
  const filtradas = cuentas.filter(c => {
    const matchBusq = !busqueda || [c.concepto, c.numero_documento, c.terceros?.razon_social, c.terceros?.rfc]
      .some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
    const matchEst = filtroEst === 'todos' || c.estatus === filtroEst
    const matchSem = filtroSem === 'todos'
      || (filtroSem === 'vencido'  && (c.dias_restantes ?? 0) < 0)
      || (filtroSem === 'urgente'  && (c.dias_restantes ?? 99) >= 0 && (c.dias_restantes ?? 99) <= 7)
      || (filtroSem === 'descuento'&& c.descuento_pp_fecha >= hoy())
      || (filtroSem === 'critico'  && c.proveedor_critico)
    return matchBusq && matchEst && matchSem
  })

  const exportarCSV = () => {
    const hdr = ['Proveedor','RFC','Concepto','Folio','Emisión','Vencimiento','Monto','Saldo','Estatus','Proveedor Crítico'].join(',')
    const filas = filtradas.map(c => [
      `"${c.terceros?.razon_social || '—'}"`, c.terceros?.rfc || '',
      `"${c.concepto}"`, c.numero_documento || '',
      c.fecha_emision, c.fecha_vencimiento,
      c.monto_original, c.saldo_pendiente, c.estatus,
      c.proveedor_critico ? 'Sí' : 'No',
    ].join(','))
    const blob = new Blob([[hdr, ...filas].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `cxp_${hoy()}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <MainLayout title="📉 Cuentas por Pagar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1060, margin: '0 auto' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {[
            { label: 'Comprometido pendiente', valor: fmtM(totalPendiente),    sub: `${activas.length} documentos activos`,  icon: <TrendingDown size={18} color="#D97706" />, bg: '#FFFBEB' },
            { label: 'Cartera vencida',        valor: fmtM(totalVencido),      sub: 'requiere pago inmediato',               icon: <AlertOctagon size={18} color="#DC2626" />,  bg: '#FEF2F2'  },
            { label: 'Ahorro disponible',      valor: fmtM(ahorroDisponible),  sub: 'descuentos por pronto pago vigentes',   icon: <Zap size={18} color="#16A34A" />,          bg: '#F0FDF4' },
            { label: 'Reglas activas',         valor: reglas.filter(r => r.activa).length, sub: 'para propuesta IA',         icon: <Sparkles size={18} color="#7C3AED" />,                       bg: '#F5F3FF'                         },
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

        {/* Alerta de ahorro disponible */}
        {ahorroDisponible > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: `0.5px solid #22C55E` }}>
            <Zap size={16} color="#16A34A" />
            <p style={{ fontSize: 13, color: '#16A34A', margin: 0, fontWeight: 500 }}>
              💡 Tienes <strong>${fmt(ahorroDisponible)}</strong> disponibles en descuentos por pronto pago vigentes. Entra a cada CxP para aprovecharlos antes de que venzan.
            </p>
          </div>
        )}

        {/* Barra de acciones */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por proveedor, RFC, concepto..." style={{ width: '100%', paddingLeft: 32, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)} style={{ fontSize: 12 }}>
            <option value="todos">Todos los estatus</option>
            {Object.entries(ESTATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroSem} onChange={e => setFiltroSem(e.target.value)} style={{ fontSize: 12 }}>
            <option value="todos">Todos los filtros</option>
            <option value="vencido">🔴 Vencidos</option>
            <option value="urgente">🟡 Urgentes ≤7d</option>
            <option value="descuento">💰 Con descuento PP</option>
            <option value="critico">🏗️ Proveedor crítico</option>
          </select>
          <button onClick={cargarDatos} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, color: '#6B7280' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={exportarCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
            <Download size={13} /> CSV
          </button>
          <button onClick={() => setModalReglas(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '8px', border: `0.5px solid #DDD6FE`, background: '#FAF8FF', cursor: 'pointer', fontSize: 12, color: '#7C3AED', fontWeight: 500 }}>
            <Sparkles size={13} /> Reglas IA
          </button>
          <button onClick={() => setPanelNuevo(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#D97706', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            <Plus size={14} /> Nueva CxP
          </button>
        </div>

        {/* Tabla */}
        <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 28, height: 28, border: `2px solid #E5E7EB`, borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center' }}>
              <TrendingDown size={36} style={{ color: '#9CA3AF', margin: '0 auto 14px', display: 'block' }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>
                {cuentas.length === 0 ? 'Sin cuentas por pagar registradas' : 'Sin resultados'}
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
                {cuentas.length === 0 ? 'Las CxP se crean desde CFDIs recibidos en el Buzón SAT o puedes registrarlas manualmente.' : 'Ajusta los filtros.'}
              </p>
              {cuentas.length === 0 && <button onClick={() => setPanelNuevo(true)} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>+ Registrar primera CxP</button>}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 120px 100px 36px', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', gap: 8 }}>
                {['Proveedor · Concepto','Folio','Vencimiento','Monto','Saldo','Estatus',''].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
                ))}
              </div>

              {filtradas.map((c, i) => {
                const est    = ESTATUS_CFG[c.estatus] || ESTATUS_CFG.pendiente
                const EstIcon= est.icon
                const sem    = semaforo(c.dias_restantes, c.estatus)
                const tieneDescuento = c.descuento_pp_fecha && c.descuento_pp_fecha >= hoy() && c.descuento_pp_monto > 0

                return (
                  <div
                    key={c.id}
                    onClick={() => nav(`/tesoreria/cxp/${c.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 120px 100px 36px', padding: '13px 16px', borderBottom: i < filtradas.length - 1 ? `0.5px solid #E5E7EB` : 'none', alignItems: 'center', cursor: 'pointer', background: '#FFFFFF', transition: 'background .1s', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    {/* Proveedor + concepto */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, overflow: 'hidden' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: c.proveedor_critico ? '#FFFBEB' : '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {c.proveedor_critico
                          ? <Star size={14} color="#D97706" />
                          : <Building2 size={14} color="#6B7280" />}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.terceros?.razon_social || c.terceros?.nombre_comercial || 'Sin proveedor'}
                        </p>
                        <p style={{ fontSize: 11, color: '#6B7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.concepto}</p>
                        {tieneDescuento && (
                          <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>
                            💰 Ahorra ${fmt(c.descuento_pp_monto)} hasta {fmtFecha(c.descuento_pp_fecha)}
                          </span>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0, fontFamily: 'monospace' }}>{c.numero_documento || '—'}</p>

                    <div>
                      <p style={{ fontSize: 12, color: '#111827', margin: '0 0 3px', fontWeight: 500 }}>{fmtFecha(c.fecha_vencimiento)}</p>
                      {sem && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, backgroundColor: sem.bg, color: sem.color, fontWeight: 600 }}>{sem.label}</span>}
                    </div>

                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, fontFamily: 'monospace' }}>${fmt(c.monto_original)}</p>

                    <p style={{ fontSize: 13, fontWeight: 700, color: Number(c.saldo_pendiente) > 0 ? '#D97706' : '#16A34A', margin: 0, fontFamily: 'monospace' }}>
                      ${fmt(c.saldo_pendiente)}
                    </p>

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
            {filtradas.length} documento{filtradas.length !== 1 ? 's' : ''} · Haz clic en una fila para ver el detalle y registrar pagos
          </p>
        )}
      </div>

      {panelNuevo && <PanelNuevoCxP terceros={terceros} companyId={companyId} userId={userId} onCerrar={() => setPanelNuevo(false)} onExito={() => { setPanelNuevo(false); mostrarToast('✅ CxP registrada'); cargarDatos() }} />}
      {modalReglas && <ModalReglas reglas={reglas} companyId={companyId} onCerrar={() => setModalReglas(false)} onGuardar={(nuevas) => { setReglas(nuevas); setModalReglas(false); mostrarToast('✅ Reglas guardadas') }} />}

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