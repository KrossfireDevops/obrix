// ============================================================
//  OBRIX ERP — Aprobaciones de Gastos
//  src/pages/gastos/AprobacionesPage.jsx  |  v1.0
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import {
  CheckCircle, XCircle, Eye, RefreshCw,
  Clock, AlertTriangle, ChevronDown, Filter,
  FileText, Link2, Download,
} from 'lucide-react'
import {
  getGastosPendientesAprobacion, aprobarGasto, rechazarGasto,
  getUrlComprobante, getKpisGastos,
  CATEGORIA_CFG, ESTATUS_CFG, FORMA_PAGO_CFG,
  DEDUCIBILIDAD_CFG, fmtMXN,
} from '../../services/gastos.service'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmtFecha = (f) => {
  if (!f) return '—'
  return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const fmtRelativo = (iso) => {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 60)   return `hace ${diff} min`
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`
  return `hace ${Math.floor(diff/1440)}d`
}

const inp = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// TARJETA DE GASTO PENDIENTE
// ─────────────────────────────────────────────────────────────
const TarjetaGasto = ({ gasto, nivelAprobador, onAprobar, onRechazar, toast }) => {
  const [expandido,    setExpandido]    = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [showRechazo,  setShowRechazo]  = useState(false)
  const [procesando,   setProcesando]   = useState(false)

  const cat = CATEGORIA_CFG[gasto.categoria] ?? CATEGORIA_CFG.gastos_generales
  const ded = DEDUCIBILIDAD_CFG[gasto.deducibilidad ?? 'deducible']

  const handleAprobar = async () => {
    setProcesando(true)
    try {
      await onAprobar(gasto.id, nivelAprobador)
    } finally {
      setProcesando(false)
    }
  }

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) { toast.error('El motivo de rechazo es obligatorio'); return }
    setProcesando(true)
    try {
      await onRechazar(gasto.id, nivelAprobador, motivoRechazo)
      setShowRechazo(false)
    } finally {
      setProcesando(false)
    }
  }

  const handleVerComprobante = async (doc) => {
    try {
      const url = await getUrlComprobante(doc.storage_path)
      window.open(url, '_blank')
    } catch (e) {
      toast.error('No se pudo abrir el comprobante')
    }
  }

  return (
    <div style={{
      backgroundColor: '#fff', border: '1px solid #E5E7EB',
      borderLeft: `4px solid ${cat.border}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 8,
    }}>
      {/* Fila principal */}
      <div style={{ padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setExpandido(!expandido)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

          {/* Emoji categoria */}
          <div style={{ width: 40, height: 40, borderRadius: 10, fontSize: 20,
            backgroundColor: cat.bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0 }}>
            {gasto.tipo?.icono ?? '📄'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Primera línea */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                {gasto.concepto}
              </span>
              {gasto.folio && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF',
                  backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>
                  {gasto.folio}
                </span>
              )}
              {/* Deducibilidad */}
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px',
                borderRadius: 4, backgroundColor: ded.bg, color: ded.color }}>
                {gasto.deducibilidad === 'no_deducible' ? '⚠️ No deducible' : '✓ Deducible'}
              </span>
            </div>
            {/* Segunda línea */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {gasto.usuario?.full_name}
              </span>
              <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {gasto.tipo?.nombre}
              </span>
              <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {fmtFecha(gasto.fecha_gasto)}
              </span>
              {gasto.proyecto && (
                <>
                  <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace',
                    color: '#6366F1', fontWeight: 600 }}>
                    [{gasto.proyecto.code}] {gasto.proyecto.name}
                  </span>
                </>
              )}
              <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                {fmtRelativo(gasto.enviado_at)}
              </span>
            </div>
          </div>

          {/* Monto y forma de pago */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
              {fmtMXN(gasto.monto_total)}
            </span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              {FORMA_PAGO_CFG[gasto.forma_pago]?.emoji} {FORMA_PAGO_CFG[gasto.forma_pago]?.label}
            </span>
          </div>

          <ChevronDown size={14} color="#D1D5DB" style={{ flexShrink: 0, marginTop: 4,
            transform: expandido ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        {/* Botones de acción rápida (siempre visibles) */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}
          onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setShowRechazo(!showRechazo); setExpandido(true) }}
            disabled={procesando}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid #FECACA', backgroundColor: '#FEF2F2',
              color: '#DC2626', cursor: 'pointer' }}>
            <XCircle size={13} /> Rechazar
          </button>
          <button
            onClick={handleAprobar}
            disabled={procesando}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: 'none', backgroundColor: procesando ? '#A7F3D0' : '#10B981',
              color: '#fff', cursor: procesando ? 'not-allowed' : 'pointer' }}>
            {procesando
              ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <CheckCircle size={13} />}
            Aprobar
          </button>
        </div>
      </div>

      {/* Panel expandido: detalle + comprobantes */}
      {expandido && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F3F4F6',
          backgroundColor: '#FAFAFA' }}>

          {/* Grid de datos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
            gap: 8, padding: '12px 0 10px' }}>
            {[
              { label: 'Monto base', value: fmtMXN(gasto.monto_base ?? gasto.monto_total) },
              { label: 'IVA',        value: fmtMXN(gasto.monto_iva ?? 0) },
              { label: 'Forma pago', value: FORMA_PAGO_CFG[gasto.forma_pago]?.label ?? '—' },
              { label: 'Centro costo', value: gasto.centro_costo ?? '—' },
              { label: 'Cuenta contable', value: gasto.cuenta_gasto_codigo ?? '—' },
              { label: 'RFC Proveedor', value: gasto.rfc_proveedor ?? '—' },
              { label: 'Proveedor', value: gasto.nombre_proveedor ?? '—' },
              { label: 'Nivel aprobación', value: `Nivel ${gasto.nivel_aprobacion_requerido}` },
            ].map(f => (
              <div key={f.label} style={{ padding: '6px 8px', backgroundColor: '#fff',
                borderRadius: 7, border: '1px solid #F3F4F6' }}>
                <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 1px',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {f.label}
                </p>
                <p style={{ fontSize: 11, color: '#111827', margin: 0, fontWeight: 500,
                  fontFamily: ['Cuenta contable','RFC Proveedor'].includes(f.label) ? 'monospace' : 'inherit' }}>
                  {f.value}
                </p>
              </div>
            ))}
          </div>

          {/* CFDI vinculado */}
          {gasto.cfdi_uuid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
              borderRadius: 8, marginBottom: 8, fontSize: 11 }}>
              <Link2 size={12} color="#2563EB" />
              <span style={{ color: '#1E40AF', fontWeight: 600 }}>CFDI vinculado</span>
              <span style={{ color: '#6B7280', fontFamily: 'monospace', fontSize: 10 }}>
                {gasto.cfdi_uuid}
              </span>
            </div>
          )}

          {/* Comprobantes */}
          {gasto.comprobantes?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, margin: '0 0 6px',
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Comprobantes adjuntos
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {gasto.comprobantes.map(doc => (
                  <button key={doc.id}
                    onClick={() => handleVerComprobante(doc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 7,
                      border: `1px solid ${doc.es_factura ? '#BFDBFE' : '#E5E7EB'}`,
                      backgroundColor: doc.es_factura ? '#EFF6FF' : '#F9FAFB',
                      color: doc.es_factura ? '#1E40AF' : '#374151',
                      fontSize: 11, cursor: 'pointer' }}>
                    <Eye size={11} />
                    {doc.nombre_archivo}
                    {doc.es_factura && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '0 4px',
                        backgroundColor: '#DBEAFE', borderRadius: 3, color: '#1E40AF' }}>
                        CFDI
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notas del empleado */}
          {gasto.notas && (
            <div style={{ padding: '8px 10px', backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A', borderRadius: 8, fontSize: 11,
              color: '#B45309', marginBottom: 8 }}>
              <strong>Nota del empleado:</strong> {gasto.notas}
            </div>
          )}

          {/* Form de rechazo */}
          {showRechazo && (
            <div style={{ padding: '10px 12px', backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA', borderRadius: 9, marginTop: 4 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#991B1B', margin: '0 0 6px' }}>
                Motivo de rechazo *
              </p>
              <textarea rows={2} style={{ ...inp, resize: 'none', marginBottom: 8 }}
                placeholder="Explica por qué se rechaza este gasto..."
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowRechazo(false)}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #E5E7EB',
                    backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleRechazar} disabled={procesando}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                    borderRadius: 7, border: 'none', backgroundColor: '#DC2626',
                    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {procesando && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                  Confirmar rechazo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function AprobacionesPage() {
  const { toast }                         = useToast()
  const [gastos,      setGastos]          = useState([])
  const [kpis,        setKpis]            = useState({})
  const [loading,     setLoading]         = useState(true)
  const [nivelAprobador, setNivelAprobador] = useState(1)
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [g, k] = await Promise.all([
        getGastosPendientesAprobacion(),
        getKpisGastos(),
      ])
      setGastos(g); setKpis(k)
    } catch (e) {
      toast.error('Error al cargar aprobaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handleAprobar = async (gastoId, nivel) => {
    try {
      const result = await aprobarGasto(gastoId, nivel)
      if (result?.estatus === 'aprobado') {
        toast.success('Gasto aprobado — póliza contable generada ✓')
      } else {
        toast.success('Aprobación nivel 1 registrada — pasa al siguiente nivel')
      }
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
  }

  const handleRechazar = async (gastoId, nivel, motivo) => {
    try {
      await rechazarGasto(gastoId, nivel, motivo)
      toast.success('Gasto rechazado — se notificó al empleado')
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
  }

  const gastosFiltrados = gastos.filter(g =>
    !filtroCategoria || g.categoria === filtroCategoria
  )

  const montoTotal = gastosFiltrados.reduce((s, g) => s + parseFloat(g.monto_total || 0), 0)

  return (
    <MainLayout title="✅ Aprobaciones de Gastos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Pendientes',       value: gastos.length,         color: '#B45309', bg: '#FFFBEB' },
            { label: 'Monto en revisión',value: fmtMXN(montoTotal),    color: '#1E40AF', bg: '#EFF6FF', small: true },
            { label: 'Aprobados hoy',    value: kpis.total_aprobados_hoy ?? 0, color: '#065F46', bg: '#F0FDF4' },
            { label: 'Reembolsos pend.', value: fmtMXN(kpis.reembolsos_pendientes ?? 0), color: '#7C3AED', bg: '#F5F3FF', small: true },
          ].map(k => (
            <div key={k.label} style={{ padding: '12px 14px', backgroundColor: k.bg,
              borderRadius: 12, border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 10, color: k.color, fontWeight: 600, margin: '0 0 3px', opacity: 0.8 }}>
                {k.label}
              </p>
              <p style={{ fontSize: k.small ? 14 : 22, fontWeight: 700, color: k.color, margin: 0 }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB', fontSize: 12, color: '#6B7280' }}>
            <Filter size={13} />
            Mi nivel de aprobación:
            <select value={nivelAprobador} onChange={e => setNivelAprobador(Number(e.target.value))}
              style={{ border: 'none', backgroundColor: 'transparent', fontSize: 12,
                fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none' }}>
              <option value={1}>Nivel 1 — Jefe inmediato</option>
              <option value={2}>Nivel 2 — Admin/Contador</option>
              <option value={3}>Nivel 3 — Director</option>
            </select>
          </div>

          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            style={{ ...inp, width: 'auto', fontSize: 12 }}>
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIA_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>

          <button onClick={cargar} style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
            backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 48, gap: 10, color: '#9CA3AF' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Cargando gastos pendientes…</span>
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px',
            backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E5E7EB' }}>
            <CheckCircle size={32} color="#10B981" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>
              Sin gastos pendientes
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              Todos los gastos han sido revisados
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 10px',
              fontWeight: 500 }}>
              {gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''} pendiente{gastosFiltrados.length !== 1 ? 's' : ''} · {fmtMXN(montoTotal)} total
            </p>
            {gastosFiltrados.map(g => (
              <TarjetaGasto
                key={g.id}
                gasto={g}
                nivelAprobador={nivelAprobador}
                onAprobar={handleAprobar}
                onRechazar={handleRechazar}
                toast={toast}
              />
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
