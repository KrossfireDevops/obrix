// ============================================================
//  OBRIX ERP — Generador de Cotizaciones
//  src/pages/comercial/CotizacionPage.jsx  |  v1.0
//
//  Flujo:
//    1. Seleccionar oportunidad (o viene por parámetro)
//    2. Elegir método: partidas / m² / precio alzado
//    3. Agregar conceptos del catálogo
//    4. Ajustar cantidades, dimensiones y precios
//    5. Aplicar descuentos
//    6. Guardar y vincular a la oportunidad
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import { supabase }   from '../../config/supabase'
import {
  getCatalogoPorCategoria, calcularPrecioLinea,
  crearCotizacion, actualizarCotizacion,
  getCotizacion, fmtMXN,
} from '../../services/comercial.service'
import {
  Search, Plus, Trash2, Save, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle,
  FileText, Package, Calculator, Eye,
  ArrowLeft, Edit2, Check, X,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// ESTILOS BASE
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '7px 9px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 7,
  outline: 'none', color: '#111827', background: '#fff',
  boxSizing: 'border-box',
}
const lbl = {
  fontSize: 10, fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 3,
}

// ─────────────────────────────────────────────────────────────
// BADGE DE TIPO U/M
// ─────────────────────────────────────────────────────────────
const UMBadge = ({ tipo }) => {
  const cfg = {
    pza:    { label: 'Pza',    bg: '#EFF6FF', color: '#1E40AF' },
    ml:     { label: 'ML',     bg: '#FEF9C3', color: '#854D0E' },
    ml_dim: { label: 'ML+Prof',bg: '#EDE9FE', color: '#5B21B6' },
    lote:   { label: 'Lote',   bg: '#F0FDF4', color: '#065F46' },
    m2:     { label: 'M²',     bg: '#FFF7ED', color: '#C2410C' },
    global: { label: 'Global', bg: '#F5F3FF', color: '#5B21B6' },
  }[tipo] || { label: tipo, bg: '#F3F4F6', color: '#6B7280' }

  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px',
      borderRadius: 4, background: cfg.bg, color: cfg.color,
      border: `0.5px solid ${cfg.color}33`,
    }}>
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// FILA DE PARTIDA
// ─────────────────────────────────────────────────────────────
const FilaPartida = ({ partida, index, onUpdate, onDelete, currency = '$' }) => {
  const [editPrecio, setEditPrecio] = useState(false)
  const [precioTemp,  setPrecioTemp]  = useState(partida.precio_unitario)
  const esMlDim = partida.tipo_um === 'ml_dim'

  const handleCantidad = (v) => {
    const cant = Math.max(partida.cantidad_minima || 1, parseFloat(v) || 0)
    onUpdate(index, { cantidad: cant })
  }

  const handleDimension = (v) => {
    onUpdate(index, { dimension_real: parseFloat(v) || null })
  }

  const handleDescuento = (v) => {
    const pct = Math.min(partida.descuento_maximo || 0, Math.max(0, parseFloat(v) || 0))
    onUpdate(index, { descuento_pct: pct })
  }

  const confirmarPrecio = () => {
    const p = parseFloat(precioTemp) || partida.precio_unitario
    const min = partida.precio_min || 0
    const max = partida.precio_max || Infinity
    const clamped = Math.min(Math.max(p, min), max)
    onUpdate(index, { precio_unitario: clamped, precio_manual: clamped })
    setEditPrecio(false)
  }

  const subtotal = partida.total_calculado || 0
  const alertaPrecio = partida.precio_unitario < (partida.precio_min || 0)

  return (
    <tr style={{ borderBottom: '0.5px solid #F3F4F6' }}>
      {/* Núm */}
      <td style={{ padding: '8px 8px', fontSize: 11, color: '#9CA3AF',
        fontFamily: 'monospace', width: 32 }}>
        {index + 1}
      </td>

      {/* Concepto */}
      <td style={{ padding: '8px 8px', minWidth: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
          {partida.nombre}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#9CA3AF' }}>
            {partida.clave_obrix}
          </span>
          <UMBadge tipo={partida.tipo_um} />
        </div>
        {partida.notas && (
          <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
            {partida.notas}
          </div>
        )}
      </td>

      {/* Cantidad */}
      <td style={{ padding: '8px 6px', width: 80 }}>
        <input
          type="number"
          min={partida.cantidad_minima || 1}
          step={partida.tipo_um === 'pza' ? 1 : 0.5}
          value={partida.cantidad}
          onChange={e => handleCantidad(e.target.value)}
          style={{ ...inp, textAlign: 'center', width: 70 }}
        />
        <div style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'center', marginTop: 2 }}>
          {partida.unidad_venta}
          {partida.cantidad_minima > 1 && ` (mín ${partida.cantidad_minima})`}
        </div>
      </td>

      {/* Dimensión (solo ml_dim) */}
      <td style={{ padding: '8px 6px', width: 80 }}>
        {esMlDim ? (
          <>
            <input
              type="number"
              min={0}
              step={0.05}
              value={partida.dimension_real ?? ''}
              onChange={e => handleDimension(e.target.value)}
              placeholder={partida.dimension_estandar?.toString()}
              style={{ ...inp, textAlign: 'center', width: 70,
                borderColor: partida.dimension_real > partida.dimension_estandar
                  ? '#FCA5A5' : '#E5E7EB' }}
            />
            <div style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'center', marginTop: 2 }}>
              std: {partida.dimension_estandar}m
            </div>
          </>
        ) : (
          <span style={{ fontSize: 11, color: '#D1D5DB', display: 'block', textAlign: 'center' }}>
            —
          </span>
        )}
      </td>

      {/* Precio unitario */}
      <td style={{ padding: '8px 6px', width: 110 }}>
        {editPrecio ? (
          <div style={{ display: 'flex', gap: 3 }}>
            <input
              type="number"
              value={precioTemp}
              onChange={e => setPrecioTemp(e.target.value)}
              style={{ ...inp, width: 70, textAlign: 'right' }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') confirmarPrecio() }}
            />
            <button onClick={confirmarPrecio}
              style={{ padding: '4px 6px', borderRadius: 5, border: 'none',
                background: '#10B981', color: '#fff', cursor: 'pointer' }}>
              <Check size={10} />
            </button>
            <button onClick={() => setEditPrecio(false)}
              style={{ padding: '4px 6px', borderRadius: 5,
                border: '1px solid #E5E7EB', background: '#fff',
                color: '#6B7280', cursor: 'pointer' }}>
              <X size={10} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => { setPrecioTemp(partida.precio_unitario); setEditPrecio(true) }}
            style={{ cursor: 'pointer', textAlign: 'right' }}
          >
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: alertaPrecio ? '#DC2626' : '#111827',
            }}>
              {currency}{partida.precio_unitario?.toLocaleString('es-MX',
                { minimumFractionDigits: 2 })}
            </div>
            {partida.precio_min != null && (
              <div style={{ fontSize: 9, color: '#9CA3AF' }}>
                {currency}{partida.precio_min} – {currency}{partida.precio_max}
              </div>
            )}
          </div>
        )}
      </td>

      {/* Descuento */}
      <td style={{ padding: '8px 6px', width: 70 }}>
        {partida.descuento_maximo > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="number"
              min={0}
              max={partida.descuento_maximo}
              step={1}
              value={partida.descuento_pct ?? 0}
              onChange={e => handleDescuento(e.target.value)}
              style={{ ...inp, width: 40, textAlign: 'center' }}
            />
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>%</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: '#D1D5DB', display: 'block', textAlign: 'center' }}>
            —
          </span>
        )}
      </td>

      {/* Excedente */}
      <td style={{ padding: '8px 6px', width: 90, textAlign: 'right' }}>
        {partida.excedente_dim > 0 ? (
          <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600 }}>
            +{currency}{partida.excedente_dim?.toLocaleString('es-MX',
              { minimumFractionDigits: 2 })}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>
        )}
      </td>

      {/* Total */}
      <td style={{ padding: '8px 8px', width: 110, textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
          {currency}{subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
        </div>
        {partida.aplica_iva && (
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>
            +IVA {currency}{(subtotal * (partida.tasa_iva || 0.16))
              .toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
        )}
      </td>

      {/* Eliminar */}
      <td style={{ padding: '8px 6px', width: 32 }}>
        <button
          onClick={() => onDelete(index)}
          style={{ padding: 5, borderRadius: 6, border: 'none',
            background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
          onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL SELECTOR DE CONCEPTOS
// ─────────────────────────────────────────────────────────────
const SelectorConceptos = ({ catalogo, onAgregar, onClose }) => {
  const [busq, setBusq] = useState('')
  const [catSel, setCatSel] = useState('')

  const categorias = [...new Set(
    catalogo.map(c => c.categoria?.nombre).filter(Boolean)
  )]

  const filtrados = catalogo.filter(c => {
    const q = busq.toLowerCase()
    const mq = !q || c.nombre.toLowerCase().includes(q) ||
      c.clave_obrix?.toLowerCase().includes(q)
    const mc = !catSel || c.categoria?.nombre === catSel
    return mq && mc
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      zIndex: 50, paddingTop: 60,
    }}>
      <div style={{
        width: 420, height: 'calc(100vh - 60px)',
        background: '#fff', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FAFAFA',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={15} color="#2563EB" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              Catálogo de conceptos
            </span>
          </div>
          <button onClick={onClose}
            style={{ padding: 5, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer' }}>
            <X size={15} color="#6B7280" />
          </button>
        </div>

        {/* Filtros */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            border: '1px solid #E5E7EB', borderRadius: 8,
            padding: '6px 10px', marginBottom: 8, background: '#fff',
          }}>
            <Search size={12} color="#9CA3AF" />
            <input
              style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1 }}
              placeholder="Buscar concepto o clave..."
              value={busq}
              onChange={e => setBusq(e.target.value)}
              autoFocus
            />
          </div>
          <select
            value={catSel}
            onChange={e => setCatSel(e.target.value)}
            style={{ ...inp, fontSize: 11 }}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtrados.length === 0 ? (
            <div style={{
              padding: 30, textAlign: 'center',
              fontSize: 12, color: '#9CA3AF',
            }}>
              Sin resultados
            </div>
          ) : (
            filtrados.map(c => (
              <div
                key={c.id}
                onClick={() => onAgregar(c)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '0.5px solid #F3F4F6',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 3 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                      {c.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace',
                        color: '#9CA3AF' }}>
                        {c.clave_obrix}
                      </span>
                      <UMBadge tipo={c.tipo_um} />
                      {c.categoria && (
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: c.categoria.color_badge || '#F3F4F6',
                          color: c.categoria.color_texto || '#6B7280',
                        }}>
                          {c.categoria.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                      {fmtMXN(c.precio_referencia)}
                    </div>
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>
                      por {c.unidad_venta}
                    </div>
                  </div>
                </div>
                {c.dimension_estandar && (
                  <div style={{
                    fontSize: 9, color: '#7C3AED',
                    background: '#EDE9FE', padding: '1px 6px',
                    borderRadius: 4, display: 'inline-block', marginTop: 2,
                  }}>
                    {c.dimension_descripcion}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL RESUMEN / TOTALES
// ─────────────────────────────────────────────────────────────
const PanelTotales = ({ partidas, descGlobalPct, onDescGlobal, currency = '$' }) => {
  const subtotalSinDesc = partidas.reduce(
    (s, p) => s + (p.total_calculado || 0), 0
  )
  const descGlobalMonto = subtotalSinDesc * (descGlobalPct / 100)
  const subtotalConDesc = subtotalSinDesc - descGlobalMonto

  const ivaTotal = partidas.reduce((s, p) => {
    const base = (p.total_calculado || 0) * (1 - (p.descuento_pct || 0) / 100)
    return s + (p.aplica_iva ? base * (p.tasa_iva || 0.16) : 0)
  }, 0) * (1 - descGlobalPct / 100)

  const total = subtotalConDesc + ivaTotal

  const lineas = [
    { label: 'Subtotal M.O.',  value: subtotalSinDesc, muted: true },
    descGlobalPct > 0 && { label: `Descuento global (${descGlobalPct}%)`,
      value: -descGlobalMonto, color: '#059669', muted: false },
    { label: 'Subtotal c/desc.', value: subtotalConDesc, muted: false, bold: true },
    { label: 'IVA 16%',         value: ivaTotal,         muted: true },
  ].filter(Boolean)

  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', background: '#FAFAFA',
        borderBottom: '1px solid #F3F4F6',
        fontSize: 11, fontWeight: 700, color: '#374151',
      }}>
        Resumen de cotización
      </div>

      <div style={{ padding: '12px 14px' }}>
        {lineas.map((l, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '5px 0',
            borderBottom: i < lineas.length - 1
              ? '0.5px solid #F3F4F6' : 'none',
          }}>
            <span style={{
              fontSize: 11,
              color: l.muted ? '#9CA3AF' : '#374151',
              fontWeight: l.bold ? 600 : 400,
            }}>
              {l.label}
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: l.bold ? 700 : 500,
              color: l.color || (l.muted ? '#9CA3AF' : '#111827'),
            }}>
              {l.value < 0 ? '-' : ''}{currency}
              {Math.abs(l.value).toLocaleString('es-MX',
                { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}

        {/* Total grande */}
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: '#EFF6FF', borderRadius: 9,
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF' }}>
            TOTAL
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#1E40AF' }}>
            {currency}{total.toLocaleString('es-MX',
              { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Descuento global */}
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Descuento global</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number" min={0} max={30} step={1}
              value={descGlobalPct}
              onChange={e => onDescGlobal(Math.min(30, Math.max(0,
                parseFloat(e.target.value) || 0)))}
              style={{ ...inp, width: 60, textAlign: 'center' }}
            />
            <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>
              máx 30%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function CotizacionPage() {
  const { id }          = useParams()       // UUID si edita existente
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const { toast }       = useToast()

  const opId   = searchParams.get('oportunidad')
  const isEdit = !!id

  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [companyId,  setCompanyId]  = useState(null)
  const [userId,     setUserId]     = useState(null)
  const [catalogo,   setCatalogo]   = useState([])
  const [showCat,    setShowCat]    = useState(false)
  const [calculando, setCalculando] = useState(false)

  // Cabecera
  const [cabecera, setCabecera] = useState({
    nombre_proyecto:     '',
    descripcion_alcance: '',
    metodo:              'partidas',  // partidas | m2 | alzado
    area_m2:             '',
    precio_por_m2:       '',
    vigencia_dias:       15,
    tiempo_ejecucion:    '',
    forma_pago:          'Anticipo 40%, 50% avance de obra, 10% finiquito',
    notas_internas:      '',
    oportunidad_id:      opId || '',
    cliente_id:          '',
  })

  // Oportunidad vinculada
  const [oportunidad, setOportunidad] = useState(null)

  // Partidas
  const [partidas,    setPartidas]    = useState([])
  const [descGlobal,  setDescGlobal]  = useState(0)

  const calcPendiente = useRef(new Set())

  // ── Cargar usuario ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase.from('users_profiles')
        .select('company_id')
        .eq('id', u.id).single()
        .then(({ data }) => {
          setCompanyId(data?.company_id)
          setUserId(u.id)
        })
    })
  }, [])

  // ── Cargar catálogo y cotización existente ──
  useEffect(() => {
    const init = async () => {
      if (!companyId) return
      setLoading(true)
      try {
        const { data: cat } = await getCatalogoPorCategoria(companyId)
        setCatalogo(cat ?? [])

        if (isEdit) {
          const { data: cot } = await getCotizacion(id)
          if (cot) {
            setCabecera({
              nombre_proyecto:     cot.nombre_proyecto,
              descripcion_alcance: cot.descripcion_alcance || '',
              metodo:              cot.metodo,
              area_m2:             cot.area_m2 || '',
              precio_por_m2:       cot.precio_por_m2 || '',
              vigencia_dias:       cot.vigencia_dias,
              tiempo_ejecucion:    cot.tiempo_ejecucion || '',
              forma_pago:          cot.forma_pago || '',
              notas_internas:      cot.notas_internas || '',
              oportunidad_id:      cot.oportunidad_id,
              cliente_id:          cot.cliente_id,
            })
            setDescGlobal(cot.descuento_global_pct || 0)
            setOportunidad(cot.oportunidad)
            // Mapear partidas existentes
            const pts = (cot.partidas || []).map(p => ({
              ...p,
              total_calculado: p.total_partida,
            }))
            setPartidas(pts)
          }
        } else if (opId) {
          // Cargar datos de la oportunidad para pre-llenar
          const { data: op } = await supabase
            .from('oportunidades')
            .select(`*, cliente:cliente_id(id, nombre)`)
            .eq('id', opId).single()
          if (op) {
            setOportunidad(op)
            setCabecera(c => ({
              ...c,
              nombre_proyecto: op.nombre_proyecto,
              oportunidad_id:  op.id,
              cliente_id:      op.cliente_id,
            }))
          }
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [companyId, id, opId, isEdit])

  // ── Recalcular partidas cuando cambian ──
  const recalcularPartida = useCallback(async (index) => {
    const p = partidas[index]
    if (!p?.concepto_id) return

    setCalculando(true)
    try {
      const { data } = await calcularPrecioLinea(
        p.concepto_id,
        p.cantidad,
        p.dimension_real ?? null,
        p.precio_manual ?? null,
      )
      if (data) {
        setPartidas(prev => {
          const next = [...prev]
          const descPct = next[index].descuento_pct || 0
          const subtotalBase = data.subtotal
          const excedente    = data.excedente_dim || 0
          const subtotalConDesc = subtotalBase * (1 - descPct / 100)
          const iva = next[index].aplica_iva
            ? subtotalConDesc * (next[index].tasa_iva || 0.16)
            : 0
          next[index] = {
            ...next[index],
            excedente_dim:   excedente,
            total_calculado: subtotalConDesc,
          }
          return next
        })
      }
    } finally {
      setCalculando(false)
    }
  }, [partidas])

  // ── Agregar concepto del catálogo ──
  const handleAgregar = (concepto) => {
    const nueva = {
      concepto_id:        concepto.id,
      clave_obrix:        concepto.clave_obrix,
      nombre:             concepto.nombre,
      tipo_um:            concepto.tipo_um,
      unidad_venta:       concepto.unidad_venta,
      cantidad:           concepto.cantidad_minima || 1,
      cantidad_minima:    concepto.cantidad_minima || 1,
      dimension_real:     null,
      dimension_estandar: concepto.dimension_estandar,
      precio_unitario:    concepto.precio_referencia,
      precio_min:         concepto.precio_minimo,
      precio_max:         concepto.precio_maximo,
      precio_manual:      null,
      descuento_pct:      0,
      descuento_maximo:   concepto.descuento_maximo_pct || 0,
      aplica_iva:         concepto.aplica_iva,
      tasa_iva:           concepto.tasa_iva || 0.16,
      sat_clave_prod_serv: concepto.sat_clave_prod_serv,
      sat_clave_unidad:    concepto.sat_clave_unidad,
      sat_objeto_impuesto: concepto.sat_objeto_impuesto,
      excedente_dim:       0,
      total_calculado:     concepto.precio_referencia * (concepto.cantidad_minima || 1),
      company_id:          companyId,
    }
    setPartidas(p => [...p, nueva])
  }

  // ── Actualizar partida ──
  const handleUpdate = useCallback((index, cambios) => {
    setPartidas(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...cambios }
      // Recalcular subtotal localmente para respuesta inmediata
      const p = next[index]
      const cant   = Math.max(p.cantidad || 1, p.cantidad_minima || 1)
      const precio = p.precio_unitario || 0
      let excedente = 0
      if (p.tipo_um === 'ml_dim' && p.dimension_real > p.dimension_estandar) {
        // Excedente simplificado hasta que la función SQL responda
        excedente = 0 // Se actualiza con recalcularPartida()
      }
      const subtotal = cant * precio
      const descMonto = subtotal * ((p.descuento_pct || 0) / 100)
      next[index].total_calculado = subtotal - descMonto + excedente
      return next
    })
    // Disparar recálculo async contra BD
    setTimeout(() => recalcularPartida(index), 400)
  }, [recalcularPartida])

  // ── Eliminar partida ──
  const handleDelete = (index) => {
    setPartidas(p => p.filter((_, i) => i !== index))
  }

  // ── Guardar cotización ──
  const handleGuardar = async (estatus = 'borrador') => {
    if (!cabecera.nombre_proyecto.trim()) {
      toast.error('El nombre del proyecto es obligatorio')
      return
    }
    if (partidas.length === 0 && cabecera.metodo === 'partidas') {
      toast.error('Agrega al menos un concepto')
      return
    }

    setSaving(true)
    try {
      const subtotal = partidas.reduce((s, p) => s + (p.total_calculado || 0), 0)
      const descMonto = subtotal * (descGlobal / 100)
      const subtotalConDesc = subtotal - descMonto
      const iva = partidas.reduce((s, p) => {
        const base = (p.total_calculado || 0)
        return s + (p.aplica_iva ? base * (p.tasa_iva || 0.16) : 0)
      }, 0) * (1 - descGlobal / 100)
      const total = subtotalConDesc + iva

      const payload = {
        ...cabecera,
        company_id:              companyId,
        elaborado_por:           userId,
        subtotal,
        descuento_global_pct:    descGlobal,
        descuento_global_monto:  descMonto,
        subtotal_con_descuento:  subtotalConDesc,
        iva,
        total,
        estatus,
        area_m2:      cabecera.area_m2 ? parseFloat(cabecera.area_m2) : null,
        precio_por_m2: cabecera.precio_por_m2
          ? parseFloat(cabecera.precio_por_m2) : null,
      }

      let cotId = id
      if (isEdit) {
        await actualizarCotizacion(id, payload)
      } else {
        const { data: cot, error } = await crearCotizacion(payload)
        if (error) throw error
        cotId = cot.id
      }

      // Guardar partidas
      if (cotId && partidas.length > 0) {
        // Borrar existentes si es edición
        if (isEdit) {
          await supabase.from('cotizaciones_partidas')
            .delete().eq('cotizacion_id', cotId)
        }
        await supabase.from('cotizaciones_partidas').insert(
          partidas.map((p, i) => ({
            cotizacion_id:       cotId,
            company_id:          companyId,
            numero_partida:      i + 1,
            concepto_id:         p.concepto_id,
            clave_obrix:         p.clave_obrix,
            nombre:              p.nombre,
            tipo_um:             p.tipo_um,
            unidad_venta:        p.unidad_venta,
            cantidad:            p.cantidad,
            cantidad_minima:     p.cantidad_minima,
            dimension_real:      p.dimension_real,
            dimension_estandar:  p.dimension_estandar,
            excedente_dim:       p.excedente_dim || 0,
            precio_unitario:     p.precio_unitario,
            precio_min:          p.precio_min,
            precio_max:          p.precio_max,
            descuento_pct:       p.descuento_pct || 0,
            subtotal:            p.total_calculado || 0,
            aplica_iva:          p.aplica_iva,
            tasa_iva:            p.tasa_iva || 0.16,
            iva_monto:           p.aplica_iva
              ? (p.total_calculado || 0) * (p.tasa_iva || 0.16)
              : 0,
            total_partida:       p.aplica_iva
              ? (p.total_calculado || 0) * (1 + (p.tasa_iva || 0.16))
              : (p.total_calculado || 0),
            sat_clave_prod_serv: p.sat_clave_prod_serv,
            sat_clave_unidad:    p.sat_clave_unidad,
            sat_objeto_impuesto: p.sat_objeto_impuesto || '02',
            orden:               i + 1,
          }))
        )
      }

      // Actualizar monto cotizado en la oportunidad
      if (cabecera.oportunidad_id) {
        await supabase.from('oportunidades').update({
          monto_cotizado: total,
          estatus:        'cotizacion',
          updated_at:     new Date().toISOString(),
        }).eq('id', cabecera.oportunidad_id)
      }

      toast.success(estatus === 'enviada'
        ? 'Cotización enviada ✓' : 'Cotización guardada ✓')

      if (!isEdit) navigate(`/comercial/cotizacion/${cotId}`)
    } catch (e) {
      toast.error('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setCabecera(c => ({ ...c, [k]: v }))

  if (loading) {
    return (
      <MainLayout title="📄 Cotización">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <RefreshCw size={22} color="#9CA3AF"
            style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  const totalPartidas = partidas.reduce((s, p) => s + (p.total_calculado || 0), 0)
  const descMonto     = totalPartidas * (descGlobal / 100)
  const ivaTotal      = partidas.reduce((s, p) => {
    return s + (p.aplica_iva ? (p.total_calculado || 0) * (p.tasa_iva || 0.16) : 0)
  }, 0) * (1 - descGlobal / 100)
  const totalFinal    = totalPartidas - descMonto + ivaTotal

  return (
    <MainLayout title={isEdit ? '📄 Editar Cotización' : '📄 Nueva Cotización'}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* ── Columna principal ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Toolbar */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <button onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid #E5E7EB', background: '#fff',
                color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Regresar
            </button>
            <div style={{ flex: 1 }} />
            {calculando && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: '#9CA3AF', padding: '0 8px',
              }}>
                <RefreshCw size={11}
                  style={{ animation: 'spin 1s linear infinite' }} />
                Calculando...
              </div>
            )}
            <button
              onClick={() => handleGuardar('borrador')}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid #E5E7EB', background: '#fff',
                color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              <Save size={13} />
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </button>
            <button
              onClick={() => handleGuardar('enviada')}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 16px', borderRadius: 8, border: 'none',
                background: saving ? '#93C5FD' : '#2563EB',
                color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer' }}>
              <FileText size={13} />
              Enviar al cliente
            </button>
          </div>

          {/* Datos del proyecto */}
          <div style={{
            background: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 12, padding: '14px 16px', marginBottom: 12,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
              margin: '0 0 12px', textTransform: 'uppercase',
              letterSpacing: '0.05em' }}>
              Datos generales
            </p>

            {oportunidad && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', background: '#EFF6FF',
                borderRadius: 8, marginBottom: 12,
                fontSize: 11, color: '#1E40AF',
              }}>
                <FileText size={13} />
                <span>
                  Vinculada a <strong>{oportunidad.folio}</strong> —{' '}
                  {oportunidad.nombre_proyecto}
                </span>
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr',
              gap: 10, marginBottom: 10,
            }}>
              <div>
                <label style={lbl}>Nombre del proyecto *</label>
                <input style={inp} value={cabecera.nombre_proyecto}
                  onChange={e => set('nombre_proyecto', e.target.value)}
                  placeholder="Ej: Instalación eléctrica Casa García" />
              </div>
              <div>
                <label style={lbl}>Vigencia (días)</label>
                <input style={inp} type="number" min={1}
                  value={cabecera.vigencia_dias}
                  onChange={e => set('vigencia_dias', parseInt(e.target.value) || 15)} />
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 10, marginBottom: 10,
            }}>
              <div>
                <label style={lbl}>Tiempo de ejecución</label>
                <input style={inp} value={cabecera.tiempo_ejecucion}
                  onChange={e => set('tiempo_ejecucion', e.target.value)}
                  placeholder="Ej: 30 días hábiles" />
              </div>
              <div>
                <label style={lbl}>Método de cotización</label>
                <select style={{ ...inp, cursor: 'pointer' }}
                  value={cabecera.metodo}
                  onChange={e => set('metodo', e.target.value)}>
                  <option value="partidas">Por partidas (conceptos)</option>
                  <option value="m2">Por metro cuadrado</option>
                  <option value="alzado">Precio alzado global</option>
                </select>
              </div>
            </div>

            {/* Campos extra según método */}
            {cabecera.metodo === 'm2' && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 10, marginBottom: 10,
              }}>
                <div>
                  <label style={lbl}>Superficie (m²)</label>
                  <input style={inp} type="number" min={0}
                    value={cabecera.area_m2}
                    onChange={e => set('area_m2', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Precio por m²</label>
                  <input style={inp} type="number" min={0}
                    value={cabecera.precio_por_m2}
                    onChange={e => set('precio_por_m2', e.target.value)} />
                </div>
              </div>
            )}

            {cabecera.metodo === 'alzado' && (
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Monto alzado global (sin IVA)</label>
                <input style={inp} type="number" min={0}
                  value={cabecera.precio_por_m2}
                  onChange={e => set('precio_por_m2', e.target.value)}
                  placeholder="Monto total negociado" />
              </div>
            )}

            <div>
              <label style={lbl}>Condiciones de pago</label>
              <input style={inp} value={cabecera.forma_pago}
                onChange={e => set('forma_pago', e.target.value)} />
            </div>
          </div>

          {/* Tabla de partidas (solo si método = partidas) */}
          {cabecera.metodo === 'partidas' && (
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Header tabla */}
              <div style={{
                padding: '12px 14px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#FAFAFA',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>
                  Partidas — {partidas.length} concepto
                  {partidas.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowCat(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 7, border: 'none',
                    background: '#2563EB', color: '#fff',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={12} /> Agregar concepto
                </button>
              </div>

              {/* Tabla */}
              {partidas.length === 0 ? (
                <div style={{
                  padding: '40px 20px', textAlign: 'center',
                  color: '#9CA3AF',
                }}>
                  <Package size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <p style={{ fontSize: 13, margin: '0 0 4px', fontWeight: 500 }}>
                    Sin conceptos
                  </p>
                  <p style={{ fontSize: 11, margin: 0 }}>
                    Haz clic en "Agregar concepto" para comenzar
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: 12,
                  }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        <th style={{ padding: '7px 8px', textAlign: 'left',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          #
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'left',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Concepto
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'center',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Cantidad
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'center',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Prof./Dim.
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'right',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Precio U.
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'center',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Dto.
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'right',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Excedente
                        </th>
                        <th style={{ padding: '7px 8px', textAlign: 'right',
                          fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid #F3F4F6' }}>
                          Subtotal
                        </th>
                        <th style={{ padding: '7px 8px',
                          borderBottom: '1px solid #F3F4F6' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {partidas.map((p, i) => (
                        <FilaPartida
                          key={i}
                          index={i}
                          partida={p}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                        />
                      ))}
                    </tbody>
                    {/* Totales inline al pie de la tabla */}
                    <tfoot>
                      <tr style={{ background: '#F9FAFB' }}>
                        <td colSpan={7} style={{
                          padding: '8px 10px', textAlign: 'right',
                          fontSize: 11, color: '#6B7280', fontWeight: 600,
                          borderTop: '1px solid #E5E7EB',
                        }}>
                          Subtotal sin IVA
                        </td>
                        <td style={{
                          padding: '8px 8px', textAlign: 'right',
                          fontSize: 13, fontWeight: 700, color: '#111827',
                          borderTop: '1px solid #E5E7EB',
                        }}>
                          {fmtMXN(totalPartidas - descMonto)}
                        </td>
                        <td style={{ borderTop: '1px solid #E5E7EB' }} />
                      </tr>
                      <tr style={{ background: '#EFF6FF' }}>
                        <td colSpan={7} style={{
                          padding: '8px 10px', textAlign: 'right',
                          fontSize: 12, color: '#1E40AF', fontWeight: 700,
                        }}>
                          TOTAL con IVA
                        </td>
                        <td style={{
                          padding: '8px 8px', textAlign: 'right',
                          fontSize: 16, fontWeight: 800, color: '#1E40AF',
                        }}>
                          {fmtMXN(totalFinal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Vista m² */}
          {cabecera.metodo === 'm2' && cabecera.area_m2 && cabecera.precio_por_m2 && (
            <div style={{
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              borderRadius: 12, padding: 18, textAlign: 'center',
            }}>
              <p style={{ fontSize: 12, color: '#1E40AF', margin: '0 0 6px' }}>
                {parseFloat(cabecera.area_m2).toLocaleString('es-MX')} m² ×{' '}
                {fmtMXN(parseFloat(cabecera.precio_por_m2))} / m²
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#1E40AF', margin: 0 }}>
                {fmtMXN(
                  parseFloat(cabecera.area_m2) * parseFloat(cabecera.precio_por_m2)
                )}
              </p>
              <p style={{ fontSize: 10, color: '#93C5FD', margin: '4px 0 0' }}>
                sin IVA · IVA:{' '}
                {fmtMXN(
                  parseFloat(cabecera.area_m2) * parseFloat(cabecera.precio_por_m2) * 0.16
                )}
              </p>
            </div>
          )}

        </div>

        {/* ── Columna lateral: totales ── */}
        {cabecera.metodo === 'partidas' && (
          <div style={{ width: 260, flexShrink: 0 }}>
            <PanelTotales
              partidas={partidas}
              descGlobalPct={descGlobal}
              onDescGlobal={setDescGlobal}
            />
          </div>
        )}
      </div>

      {/* Panel selector de conceptos */}
      {showCat && (
        <SelectorConceptos
          catalogo={catalogo}
          onAgregar={(c) => { handleAgregar(c); }}
          onClose={() => setShowCat(false)}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
