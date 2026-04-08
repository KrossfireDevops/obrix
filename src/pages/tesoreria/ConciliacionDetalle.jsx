// ============================================================
//  OBRIX — Detalle de Conciliación Bancaria
//  src/pages/tesoreria/ConciliacionDetalle.jsx
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate }            from 'react-router-dom'
import { MainLayout }                        from '../../components/layout/MainLayout'
import { supabase }                          from '../../config/supabase'
import {
  CheckCircle2, AlertTriangle, AlertOctagon, XCircle,
  ChevronLeft, RefreshCw, CircleCheck, Eye, EyeOff,
  Filter, Download, Lock, Unlock, ChevronDown, ChevronUp,
  FileText, Building2, Calendar, Hash, MessageSquare,
  Link2, Pencil, Check, X, Info, ClipboardCheck,
  ArrowUpDown, TriangleAlert,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtFechaHora = (d) =>
  d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)

// ─── Configuración de tipos de resultado ────────────────────
const TIPO_CFG = {
  conciliado: {
    label:  'Conciliado',
    badge:  { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
    fila:   'transparent',
    icon:   CheckCircle2,
    orden:  4,
  },
  discrepancia_monto: {
    label:  'Diferencia de monto',
    badge:  { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
    fila:   'var(--color-background-warning)',
    icon:   AlertTriangle,
    orden:  1,
  },
  discrepancia_fecha: {
    label:  'Diferencia de fecha',
    badge:  { bg: '#FFF7ED', color: '#C2610C' },
    fila:   '#FFFBEB',
    icon:   AlertTriangle,
    orden:  2,
  },
  sin_registro: {
    label:  'Sin registro en OBRIX',
    badge:  { bg: 'var(--color-background-danger)', color: 'var(--color-text-danger)' },
    fila:   'var(--color-background-danger)',
    icon:   AlertOctagon,
    orden:  0,
  },
  no_en_banco: {
    label:  'No aparece en banco',
    badge:  { bg: '#F5F3FF', color: '#6D28D9' },
    fila:   '#FAF8FF',
    icon:   XCircle,
    orden:  3,
  },
}

// ─── Configuración de resoluciones ──────────────────────────
const RESOLUCION_CFG = {
  aceptado:    { label: 'Aceptado',    color: 'var(--color-text-success)',  bg: 'var(--color-background-success)' },
  corregido:   { label: 'Corregido',   color: 'var(--color-text-info)',     bg: 'var(--color-background-info)'    },
  justificado: { label: 'Justificado', color: '#C2610C',                    bg: '#FFF7ED'                         },
  pendiente:   { label: 'Pendiente',   color: 'var(--color-text-tertiary)', bg: 'var(--color-background-secondary)' },
}

// ─── Constantes de estilo ────────────────────────────────────
const C = {
  borde: 'var(--color-border-tertiary)',
  bg:    'var(--color-background-primary)',
  bgSec: 'var(--color-background-secondary)',
}
const borde = { border: `0.5px solid ${C.borde}`, borderRadius: 'var(--border-radius-lg)' }

// ─── Badge de tipo ───────────────────────────────────────────
const BadgeTipo = ({ tipo }) => {
  const cfg  = TIPO_CFG[tipo] || TIPO_CFG.sin_registro
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      backgroundColor: cfg.badge.bg, color: cfg.badge.color,
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ─── Badge de resolución ─────────────────────────────────────
const BadgeResolucion = ({ resolucion }) => {
  if (!resolucion || resolucion === 'pendiente') return null
  const cfg = RESOLUCION_CFG[resolucion]
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.color, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Barra de progreso global ────────────────────────────────
const BarraProgreso = ({ conciliados, discrepancias, sin_registro, total }) => {
  const resueltos    = conciliados
  const pendientes   = discrepancias + sin_registro
  const pResueltos   = pct(resueltos,  total)
  const pPendientes  = pct(pendientes, total)
  const pPorResolver = 100 - pResueltos - pPendientes

  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: C.borde, gap: 1, marginBottom: 6 }}>
        {pResueltos  > 0 && <div style={{ width: `${pResueltos}%`,   background: 'var(--color-text-success)', transition: 'width .4s' }} />}
        {pPendientes > 0 && <div style={{ width: `${pPendientes}%`,  background: 'var(--color-text-warning)', transition: 'width .4s' }} />}
        {pPorResolver> 0 && <div style={{ width: `${pPorResolver}%`, background: 'var(--color-border-secondary)', transition: 'width .4s' }} />}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Conciliados',  val: conciliados,  color: 'var(--color-text-success)'  },
          { label: 'Con diff.',    val: discrepancias, color: 'var(--color-text-warning)'  },
          { label: 'Sin registro', val: sin_registro,  color: 'var(--color-text-danger)'   },
          { label: 'Total',        val: total,         color: 'var(--color-text-secondary)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}:</span>
            <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Panel de resolución inline ──────────────────────────────
const PanelResolucion = ({ linea, onGuardar, onCerrar, guardando }) => {
  const [resolucion,    setResolucion]    = useState(linea.resolucion || 'aceptado')
  const [justificacion, setJustificacion] = useState(linea.justificacion || '')

  const opciones = linea.tipo_resultado === 'conciliado'
    ? []   // conciliados no necesitan resolución manual
    : [
        { val: 'aceptado',    label: 'Aceptar diferencia',   desc: 'Reconocer la diferencia como válida sin cambios' },
        { val: 'corregido',   label: 'Marcar como corregido', desc: 'El registro en OBRIX ya fue actualizado' },
        { val: 'justificado', label: 'Justificar',            desc: 'Documentar el motivo de la diferencia' },
      ]

  return (
    <div style={{
      margin: '0 0 2px',
      backgroundColor: C.bgSec,
      border: `0.5px solid var(--color-border-info)`,
      borderRadius: 'var(--border-radius-md)',
      padding: '16px',
      animation: 'fadeInDown 0.15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Resolver diferencia
        </p>
        <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-secondary)' }}>
          <X size={15} />
        </button>
      </div>

      {/* Detalle de la línea */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, padding: '10px 12px', borderRadius: 'var(--border-radius-md)', backgroundColor: C.bg, border: `0.5px solid ${C.borde}` }}>
        {[
          { label: 'Fecha banco',     val: fmtFecha(linea.banco_fecha) },
          { label: 'Monto banco',     val: `$${fmt(Math.abs(linea.banco_monto))}` },
          { label: 'Tipo',            val: TIPO_CFG[linea.tipo_resultado]?.label || linea.tipo_resultado },
          { label: 'Diferencia',      val: linea.diferencia_monto != null ? `$${fmt(Math.abs(linea.diferencia_monto))}` : linea.diferencia_dias != null ? `${linea.diferencia_dias} días` : '—' },
        ].map(({ label, val }) => (
          <div key={label}>
            <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Concepto del banco */}
      {linea.banco_concepto && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--border-radius-md)', backgroundColor: C.bg, border: `0.5px solid ${C.borde}` }}>
          <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Concepto del banco</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>{linea.banco_concepto}</p>
        </div>
      )}

      {/* Opciones de resolución */}
      {opciones.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Acción a tomar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opciones.map(op => (
              <button
                key={op.val}
                onClick={() => setResolucion(op.val)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--border-radius-md)',
                  border: `0.5px solid ${resolucion === op.val ? 'var(--color-border-info)' : C.borde}`,
                  backgroundColor: resolucion === op.val ? 'var(--color-background-info)' : C.bg,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${resolucion === op.val ? 'var(--color-text-info)' : C.borde}`,
                  backgroundColor: resolucion === op.val ? 'var(--color-text-info)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {resolucion === op.val && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff' }} />}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{op.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>{op.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Justificación (siempre disponible) */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Comentario / Justificación {resolucion === 'justificado' && <span style={{ color: 'var(--color-text-danger)' }}>*</span>}
        </label>
        <textarea
          value={justificacion}
          onChange={e => setJustificacion(e.target.value)}
          placeholder="Describe el motivo de la diferencia o las acciones tomadas..."
          rows={3}
          style={{
            width: '100%', padding: '8px 12px', fontSize: 12, lineHeight: 1.5,
            border: `0.5px solid ${C.borde}`, borderRadius: 'var(--border-radius-md)',
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            backgroundColor: C.bg, color: 'var(--color-text-primary)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCerrar}
          style={{ flex: 1, padding: '9px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}
        >
          Cancelar
        </button>
        <button
          onClick={() => onGuardar({ resolucion, justificacion })}
          disabled={guardando || (resolucion === 'justificado' && !justificacion.trim())}
          style={{
            flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px', borderRadius: 'var(--border-radius-md)', border: 'none',
            backgroundColor: guardando ? 'var(--color-border-secondary)' : 'var(--color-text-primary)',
            color: 'var(--color-background-primary)',
            cursor: guardando || (resolucion === 'justificado' && !justificacion.trim()) ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600, opacity: resolucion === 'justificado' && !justificacion.trim() ? 0.5 : 1,
          }}
        >
          <ClipboardCheck size={13} />
          {guardando ? 'Guardando...' : 'Guardar resolución'}
        </button>
      </div>
    </div>
  )
}

// ─── Fila de línea de conciliación ──────────────────────────
const FilaLinea = ({ linea, onResolver, resolviendo, guardando }) => {
  const cfg = TIPO_CFG[linea.tipo_resultado] || TIPO_CFG.sin_registro
  const yaResuelto = linea.resolucion && linea.resolucion !== 'pendiente'
  const esConciliado = linea.tipo_resultado === 'conciliado'

  return (
    <div style={{
      borderBottom: `0.5px solid ${C.borde}`,
      backgroundColor: esConciliado ? C.bg : cfg.fila,
      opacity: esConciliado ? 0.85 : 1,
      transition: 'background .15s',
    }}>
      {/* Fila principal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 110px 1fr 120px 140px 110px 90px',
        padding: '12px 16px',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Fecha banco */}
        <p style={{ fontSize: 12, color: 'var(--color-text-primary)', margin: 0, fontFamily: 'monospace' }}>
          {fmtFecha(linea.banco_fecha)}
        </p>

        {/* Monto */}
        <p style={{
          fontSize: 13, fontWeight: 700, margin: 0, fontFamily: 'monospace', textAlign: 'right',
          color: linea.banco_monto >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)',
        }}>
          {linea.banco_monto >= 0 ? '+' : '-'}${fmt(Math.abs(linea.banco_monto))}
        </p>

        {/* Concepto */}
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {linea.banco_concepto || linea.banco_referencia || '—'}
        </p>

        {/* Diferencia */}
        <div style={{ textAlign: 'right' }}>
          {linea.diferencia_monto != null && Math.abs(linea.diferencia_monto) > 0 && (
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-warning)', margin: 0, fontFamily: 'monospace' }}>
              Δ ${fmt(Math.abs(linea.diferencia_monto))}
            </p>
          )}
          {linea.diferencia_dias != null && Math.abs(linea.diferencia_dias) > 0 && (
            <p style={{ fontSize: 11, color: 'var(--color-text-warning)', margin: 0 }}>
              Δ {Math.abs(linea.diferencia_dias)}d
            </p>
          )}
        </div>

        {/* Tipo de resultado */}
        <BadgeTipo tipo={linea.tipo_resultado} />

        {/* Resolución */}
        <div>
          {yaResuelto
            ? <BadgeResolucion resolucion={linea.resolucion} />
            : esConciliado
              ? null
              : <span style={{ fontSize: 10, color: 'var(--color-text-danger)', fontWeight: 600 }}>● Pendiente</span>
          }
        </div>

        {/* Acción */}
        {!esConciliado && (
          <button
            onClick={() => onResolver(linea)}
            disabled={resolviendo === linea.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 10px', borderRadius: 'var(--border-radius-md)',
              border: `0.5px solid ${yaResuelto ? C.borde : 'var(--color-border-info)'}`,
              backgroundColor: yaResuelto ? C.bg : 'var(--color-background-info)',
              color: yaResuelto ? 'var(--color-text-secondary)' : 'var(--color-text-info)',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              transition: 'all .15s',
            }}
          >
            <Pencil size={11} />
            {yaResuelto ? 'Editar' : 'Resolver'}
          </button>
        )}
      </div>

      {/* Panel de resolución expandido */}
      {resolviendo === linea.id && (
        <div style={{ padding: '0 16px 12px' }}>
          <PanelResolucion
            linea={linea}
            onGuardar={(datos) => onResolver(linea, datos)}
            onCerrar={() => onResolver(null)}
            guardando={guardando}
          />
        </div>
      )}
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────
export default function ConciliacionDetalle() {
  const { id }  = useParams()
  const nav     = useNavigate()

  const [archivo,     setArchivo]     = useState(null)
  const [lineas,      setLineas]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [companyId,   setCompanyId]   = useState(null)
  const [userId,      setUserId]      = useState(null)

  // Filtros y orden
  const [filtroTipo,  setFiltroTipo]  = useState('todos')
  const [filtroRes,   setFiltroRes]   = useState('todos')
  const [soloAbiertas, setSoloAbiertas] = useState(false)
  const [orden,       setOrden]       = useState('prioridad')   // prioridad | fecha | monto

  // Resolución inline
  const [resolviendo, setResolviendo] = useState(null)  // id de la línea abierta
  const [guardando,   setGuardando]   = useState(false)

  // Cierre de conciliación
  const [confirmandoCierre, setConfirmandoCierre] = useState(false)
  const [cerrando,  setCerrando]      = useState(false)

  // Toast
  const [toast,     setToast]         = useState(null)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => { if (companyId) cargarDetalle() }, [companyId, id])

  const cargarDetalle = async () => {
    setLoading(true)
    const [{ data: arch }, { data: lins }] = await Promise.all([
      supabase
        .from('conciliacion_archivos')
        .select('*, company_bancos(nombre, banco, moneda, no_cuenta)')
        .eq('id', id)
        .single(),
      supabase
        .from('conciliacion_lineas')
        .select('*')
        .eq('archivo_id', id)
        .order('created_at', { ascending: true }),
    ])
    setArchivo(arch)
    setLineas(lins || [])
    setLoading(false)
  }

  // ── KPIs derivados ─────────────────────────────────────────
  const total        = lineas.length
  const conciliados  = lineas.filter(l => l.tipo_resultado === 'conciliado').length
  const discrepancias= lineas.filter(l => ['discrepancia_monto','discrepancia_fecha'].includes(l.tipo_resultado)).length
  const sinRegistro  = lineas.filter(l => l.tipo_resultado === 'sin_registro').length
  const noEnBanco    = lineas.filter(l => l.tipo_resultado === 'no_en_banco').length
  const pendientes   = lineas.filter(l => !['conciliado'].includes(l.tipo_resultado) && (!l.resolucion || l.resolucion === 'pendiente')).length
  const pctCompletado= pct(total - pendientes, total || 1)
  const listo        = pendientes === 0 && total > 0

  // ── Filtrado y ordenamiento ────────────────────────────────
  const lineasFiltradas = lineas
    .filter(l => {
      if (filtroTipo !== 'todos' && l.tipo_resultado !== filtroTipo) return false
      if (filtroRes  !== 'todos' && l.resolucion !== filtroRes)      return false
      if (soloAbiertas && (l.tipo_resultado === 'conciliado' || (l.resolucion && l.resolucion !== 'pendiente'))) return false
      return true
    })
    .sort((a, b) => {
      if (orden === 'prioridad') {
        const oA = TIPO_CFG[a.tipo_resultado]?.orden ?? 5
        const oB = TIPO_CFG[b.tipo_resultado]?.orden ?? 5
        return oA - oB
      }
      if (orden === 'fecha')  return (a.banco_fecha || '').localeCompare(b.banco_fecha || '')
      if (orden === 'monto')  return Math.abs(b.banco_monto) - Math.abs(a.banco_monto)
      return 0
    })

  // ── Resolver línea ─────────────────────────────────────────
  const handleResolver = useCallback(async (linea, datos) => {
    // Si solo se llama con la línea (abrir panel) o con null (cerrar)
    if (!datos) {
      setResolviendo(linea?.id || null)
      return
    }

    // Guardar resolución
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('conciliacion_lineas')
        .update({
          resolucion:    datos.resolucion,
          justificacion: datos.justificacion || null,
          resuelto_por:  userId,
          resuelto_at:   new Date().toISOString(),
        })
        .eq('id', linea.id)

      if (error) throw error

      // Actualizar contadores del archivo
      const nuevasPendientes = lineas.filter(l =>
        l.id !== linea.id &&
        l.tipo_resultado !== 'conciliado' &&
        (!l.resolucion || l.resolucion === 'pendiente')
      ).length

      await supabase
        .from('conciliacion_archivos')
        .update({
          estatus: nuevasPendientes === 0 ? 'revision' : 'revision',
        })
        .eq('id', id)

      setResolviendo(null)
      mostrarToast('✅ Resolución guardada')
      cargarDetalle()

    } catch (e) {
      mostrarToast('Error al guardar: ' + e.message, 'error')
    } finally {
      setGuardando(false)
    }
  }, [lineas, userId, id])

  // ── Cerrar conciliación ────────────────────────────────────
  const cerrarConciliacion = async () => {
    setCerrando(true)
    try {
      const { error } = await supabase
        .from('conciliacion_archivos')
        .update({ estatus: 'cerrado', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      setConfirmandoCierre(false)
      mostrarToast('🔒 Conciliación cerrada correctamente')
      setTimeout(() => nav('/tesoreria/conciliacion'), 1000)
    } catch (e) {
      mostrarToast('Error al cerrar: ' + e.message, 'error')
    } finally {
      setCerrando(false)
    }
  }

  // ── Exportar reporte ───────────────────────────────────────
  const exportarCSV = () => {
    const encabezado = ['Fecha banco','Monto','Concepto/Referencia','Tipo','Diferencia monto','Diferencia días','Resolución','Justificación'].join(',')
    const filas = lineas.map(l => [
      l.banco_fecha,
      l.banco_monto,
      `"${(l.banco_concepto || l.banco_referencia || '').replace(/"/g,'""')}"`,
      TIPO_CFG[l.tipo_resultado]?.label || l.tipo_resultado,
      l.diferencia_monto ?? '',
      l.diferencia_dias  ?? '',
      l.resolucion       || 'pendiente',
      `"${(l.justificacion || '').replace(/"/g,'""')}"`,
    ].join(','))
    const blob = new Blob([[encabezado, ...filas].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `conciliacion_${archivo?.company_bancos?.nombre || 'banco'}_${archivo?.fecha_inicio || ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <MainLayout title="Conciliación — Detalle">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${C.borde}`, borderTopColor: 'var(--color-text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  if (!archivo) {
    return (
      <MainLayout title="Conciliación — Detalle">
        <div style={{ textAlign: 'center', padding: 60 }}>
          <AlertOctagon size={40} style={{ color: 'var(--color-text-danger)', marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 15, color: 'var(--color-text-primary)', fontWeight: 500, margin: '0 0 8px' }}>Conciliación no encontrada</p>
          <button onClick={() => nav('/tesoreria/conciliacion')}
            style={{ padding: '8px 18px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 13 }}>
            ← Volver a Conciliaciones
          </button>
        </div>
      </MainLayout>
    )
  }

  const isCerrado = archivo.estatus === 'cerrado'

  // ── Render principal ───────────────────────────────────────
  return (
    <MainLayout title="🔍 Detalle de Conciliación">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>

        {/* Breadcrumb + header ────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button
              onClick={() => nav('/tesoreria/conciliacion')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)', padding: '0 0 6px', fontWeight: 500 }}
            >
              <ChevronLeft size={14} /> Conciliaciones
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'var(--color-background-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={18} color="var(--color-text-info)" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  {archivo.company_bancos?.nombre}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                  {archivo.company_bancos?.banco} · {archivo.nombre_archivo} · {fmtFecha(archivo.fecha_inicio)} al {fmtFecha(archivo.fecha_fin)}
                </p>
              </div>
            </div>
          </div>

          {/* Acciones de cabecera */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={exportarCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}
            >
              <Download size={13} /> Exportar CSV
            </button>
            {!isCerrado && (
              <button
                onClick={() => setConfirmandoCierre(true)}
                disabled={!listo}
                title={!listo ? `Quedan ${pendientes} diferencias por resolver` : 'Cerrar conciliación'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--border-radius-md)', border: 'none',
                  background: listo ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
                  color: 'var(--color-background-primary)',
                  cursor: listo ? 'pointer' : 'not-allowed',
                  fontSize: 12, fontWeight: 600, opacity: listo ? 1 : 0.6,
                }}
              >
                <Lock size={13} />
                {listo ? 'Cerrar conciliación' : `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`}
              </button>
            )}
            {isCerrado && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--color-text-success)', padding: '8px 14px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--color-background-success)', border: `0.5px solid var(--color-border-success)` }}>
                <Lock size={13} /> Conciliación cerrada
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso global ──────────────────────── */}
        <div style={{ ...borde, background: C.bg, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Progreso de conciliación
            </p>
            <span style={{ fontSize: 22, fontWeight: 700, color: listo ? 'var(--color-text-success)' : 'var(--color-text-primary)' }}>
              {pctCompletado}%
            </span>
          </div>
          <BarraProgreso
            conciliados={conciliados}
            discrepancias={discrepancias + noEnBanco}
            sin_registro={sinRegistro}
            total={total}
          />
        </div>

        {/* Tarjetas resumen por tipo ─────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
          {[
            { tipo: 'sin_registro',       val: sinRegistro,   label: 'Sin registro',        urgent: true  },
            { tipo: 'discrepancia_monto',  val: discrepancias, label: 'Dif. de monto',       urgent: discrepancias > 0 },
            { tipo: 'discrepancia_fecha',  val: lineas.filter(l => l.tipo_resultado === 'discrepancia_fecha').length, label: 'Dif. de fecha', urgent: false },
            { tipo: 'no_en_banco',         val: noEnBanco,     label: 'No en banco',         urgent: false },
            { tipo: 'conciliado',          val: conciliados,   label: 'Conciliados',         urgent: false },
          ].map(({ tipo, val, label, urgent }) => {
            const cfg  = TIPO_CFG[tipo]
            const Icon = cfg.icon
            return (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
                style={{
                  ...borde, padding: '12px 14px', background: C.bg,
                  cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  border: `0.5px solid ${filtroTipo === tipo ? 'var(--color-border-info)' : C.borde}`,
                  backgroundColor: filtroTipo === tipo ? 'var(--color-background-info)' : C.bg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Icon size={15} color={cfg.badge.color} />
                  {urgent && val > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, backgroundColor: 'var(--color-background-danger)', color: 'var(--color-text-danger)' }}>
                      ATENCIÓN
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: '4px 0 2px' }}>{val}</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>{label}</p>
              </button>
            )
          })}
        </div>

        {/* Filtros y controles de la tabla ───────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="todos">Todos los tipos</option>
            <option value="sin_registro">Sin registro en OBRIX</option>
            <option value="discrepancia_monto">Diferencia de monto</option>
            <option value="discrepancia_fecha">Diferencia de fecha</option>
            <option value="no_en_banco">No aparece en banco</option>
            <option value="conciliado">Conciliados</option>
          </select>

          <select
            value={filtroRes}
            onChange={e => setFiltroRes(e.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="todos">Todas las resoluciones</option>
            <option value="pendiente">Pendiente</option>
            <option value="aceptado">Aceptado</option>
            <option value="corregido">Corregido</option>
            <option value="justificado">Justificado</option>
          </select>

          <select
            value={orden}
            onChange={e => setOrden(e.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="prioridad">Ordenar: Prioridad</option>
            <option value="fecha">Ordenar: Fecha</option>
            <option value="monto">Ordenar: Monto</option>
          </select>

          <button
            onClick={() => setSoloAbiertas(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 'var(--border-radius-md)',
              border: `0.5px solid ${soloAbiertas ? 'var(--color-border-warning)' : C.borde}`,
              backgroundColor: soloAbiertas ? 'var(--color-background-warning)' : C.bg,
              color: soloAbiertas ? 'var(--color-text-warning)' : 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: soloAbiertas ? 600 : 400,
            }}
          >
            <TriangleAlert size={12} />
            Solo pendientes {soloAbiertas && `(${pendientes})`}
          </button>

          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
            {lineasFiltradas.length} de {total} líneas
          </span>
        </div>

        {/* Tabla de líneas ────────────────────────────────── */}
        <div style={{ ...borde, background: C.bg, overflow: 'hidden' }}>

          {/* Encabezado tabla */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 110px 1fr 120px 140px 110px 90px',
            padding: '10px 16px',
            borderBottom: `0.5px solid ${C.borde}`,
            background: C.bgSec,
            gap: 8,
          }}>
            {['Fecha banco','Monto','Concepto / Referencia','Diferencia','Tipo','Resolución','Acción'].map(h => (
              <p key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
            ))}
          </div>

          {lineasFiltradas.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <CircleCheck size={32} style={{ color: 'var(--color-text-success)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                {total === 0 ? 'Sin líneas procesadas aún' : 'No hay líneas con estos filtros'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                {total === 0
                  ? 'El archivo está siendo procesado. Actualiza en unos momentos.'
                  : 'Prueba ajustando los filtros o el orden.'}
              </p>
            </div>
          ) : (
            lineasFiltradas.map(linea => (
              <FilaLinea
                key={linea.id}
                linea={linea}
                onResolver={(l, datos) => {
                  if (!datos) {
                    // Toggle: si ya está abierta, cerrar
                    setResolviendo(prev => prev === l?.id ? null : l?.id)
                  } else {
                    handleResolver(l, datos)
                  }
                }}
                resolviendo={resolviendo}
                guardando={guardando}
              />
            ))
          )}
        </div>

        {/* Leyenda de colores ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(TIPO_CFG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cfg.badge.bg, border: `0.5px solid ${cfg.badge.color}` }} />
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{cfg.label}</span>
            </div>
          ))}
        </div>

        {/* Aviso si está cerrado ──────────────────────────── */}
        {isCerrado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--color-background-secondary)', border: `0.5px solid ${C.borde}` }}>
            <Lock size={15} color="var(--color-text-tertiary)" />
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
              Esta conciliación está cerrada. Las líneas son de solo lectura. Puedes exportar el reporte en CSV.
            </p>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación de cierre ───────────────── */}
      {confirmandoCierre && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...borde, background: C.bg, padding: 24, maxWidth: 440, width: '100%', animation: 'fadeInDown .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--color-background-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={22} color="var(--color-text-success)" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                  ¿Cerrar esta conciliación?
                </p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 4px', lineHeight: 1.5 }}>
                  Al cerrar, las líneas quedarán en modo de solo lectura.
                  Se registrará la posición validada en Tesorería.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-success)', margin: 0 }}>{conciliados}</p>
                    <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0 }}>Conciliados</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-warning)', margin: 0 }}>{discrepancias}</p>
                    <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0 }}>Con dif.</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-danger)', margin: 0 }}>{sinRegistro}</p>
                    <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0 }}>Sin reg.</p>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ borderTop: `0.5px solid ${C.borde}`, paddingTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmandoCierre(false)}
                disabled={cerrando}
                style={{ padding: '9px 20px', borderRadius: 'var(--border-radius-md)', border: `0.5px solid ${C.borde}`, background: C.bg, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={cerrarConciliacion}
                disabled={cerrando}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 'var(--border-radius-md)', border: 'none', backgroundColor: cerrando ? 'var(--color-border-secondary)' : 'var(--color-text-primary)', color: 'var(--color-background-primary)', cursor: cerrando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                <Lock size={13} />
                {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: 'var(--border-radius-lg)',
          background: toast.tipo === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)',
          border: `0.5px solid ${toast.tipo === 'error' ? 'var(--color-border-danger)' : 'var(--color-border-success)'}`,
          animation: 'fadeInDown .2s ease', maxWidth: 380,
        }}>
          {toast.tipo === 'error'
            ? <AlertTriangle size={16} color="var(--color-text-danger)" />
            : <CheckCircle2  size={16} color="var(--color-text-success)" />}
          <p style={{ fontSize: 13, fontWeight: 500, color: toast.tipo === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)', margin: 0 }}>
            {toast.msg}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </MainLayout>
  )
}
