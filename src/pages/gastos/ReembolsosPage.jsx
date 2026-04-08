// ============================================================
//  OBRIX ERP — Reembolsos Pendientes
//  src/pages/gastos/ReembolsosPage.jsx  |  v1.0
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import {
  DollarSign, CheckCircle, RefreshCw,
  Search, Users, Clock, AlertTriangle,
} from 'lucide-react'
import {
  getReembolsosPendientes, marcarReembolsoPagado,
  fmtMXN,
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

const diasPendiente = (iso) => {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

const inp = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// MODAL: MARCAR COMO PAGADO
// ─────────────────────────────────────────────────────────────
const ModalPago = ({ gastos, onConfirm, onClose }) => {
  const [referencia, setReferencia] = useState('')
  const [saving,     setSaving]     = useState(false)
  const total = gastos.reduce((s, g) => s + parseFloat(g.monto_total), 0)

  const handleConfirm = async () => {
    if (!referencia.trim()) return
    setSaving(true)
    try { await onConfirm(gastos.map(g => g.id), referencia) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 14, width: '100%',
        maxWidth: 420, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>

        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>
          Confirmar pago de reembolso
        </h3>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 18px' }}>
          {gastos.length > 1
            ? `${gastos.length} reembolsos · total ${fmtMXN(total)}`
            : `${gastos[0]?.usuario?.full_name} · ${fmtMXN(total)}`}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Referencia de pago *
          </label>
          <input type="text" style={inp} value={referencia}
            placeholder="Número de transferencia, cheque, etc."
            onChange={e => setReferencia(e.target.value)} />
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            Esta referencia quedará registrada en el expediente del gasto.
          </p>
        </div>

        <div style={{ padding: '10px 12px', backgroundColor: '#F0FDF4',
          border: '1px solid #A7F3D0', borderRadius: 8, marginBottom: 16,
          fontSize: 11, color: '#065F46' }}>
          Al confirmar se generará el asiento contable:<br />
          <span style={{ fontFamily: 'monospace', fontSize: 10 }}>
            DEBE 201.02 Reembolsos por Pagar · HABER 102.01 Banco
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB',
              backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleConfirm}
            disabled={saving || !referencia.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 8, border: 'none',
              backgroundColor: saving || !referencia.trim() ? '#A7F3D0' : '#10B981',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: saving || !referencia.trim() ? 'not-allowed' : 'pointer' }}>
            {saving && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            <CheckCircle size={13} /> Confirmar pago
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ReembolsosPage() {
  const { toast }                       = useToast()
  const [reembolsos,  setReembolsos]    = useState([])
  const [loading,     setLoading]       = useState(true)
  const [search,      setSearch]        = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [modalPago,   setModalPago]     = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReembolsosPendientes()
      setReembolsos(data)
    } catch (e) {
      toast.error('Error al cargar reembolsos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handlePagar = async (ids, referencia) => {
    try {
      await Promise.all(ids.map(id => marcarReembolsoPagado(id, referencia)))
      toast.success(`${ids.length} reembolso${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} como pagado${ids.length !== 1 ? 's' : ''} ✓`)
      setSeleccionados([])
      setModalPago(false)
      cargar()
    } catch (e) {
      toast.error('Error al registrar pago: ' + e.message)
    }
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleTodos = () => {
    if (seleccionados.length === filtrados.length) setSeleccionados([])
    else setSeleccionados(filtrados.map(r => r.id))
  }

  const filtrados = reembolsos.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.concepto?.toLowerCase().includes(q)
        || r.usuario?.full_name?.toLowerCase().includes(q)
        || r.folio?.toLowerCase().includes(q)
  })

  const totalSeleccionado = filtrados
    .filter(r => seleccionados.includes(r.id))
    .reduce((s, r) => s + parseFloat(r.monto_total), 0)

  const totalPendiente = reembolsos.reduce((s, r) => s + parseFloat(r.monto_total), 0)

  // Agrupar por empleado para mostrar resumen
  const porEmpleado = reembolsos.reduce((acc, r) => {
    const id = r.usuario?.id
    if (!acc[id]) acc[id] = { nombre: r.usuario?.full_name, total: 0, cantidad: 0 }
    acc[id].total    += parseFloat(r.monto_total)
    acc[id].cantidad += 1
    return acc
  }, {})

  return (
    <MainLayout title="💰 Reembolsos Pendientes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Reembolsos pendientes', value: reembolsos.length,        color: '#B45309', bg: '#FFFBEB' },
            { label: 'Monto total a pagar',   value: fmtMXN(totalPendiente),   color: '#1E40AF', bg: '#EFF6FF', small: true },
            { label: 'Empleados con deuda',   value: Object.keys(porEmpleado).length, color: '#7C3AED', bg: '#F5F3FF' },
          ].map(k => (
            <div key={k.label} style={{ padding: '12px 16px', backgroundColor: k.bg,
              borderRadius: 12, border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 10, color: k.color, fontWeight: 600, margin: '0 0 3px' }}>
                {k.label}
              </p>
              <p style={{ fontSize: k.small ? 16 : 24, fontWeight: 700, color: k.color, margin: 0 }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* Resumen por empleado */}
        {Object.keys(porEmpleado).length > 0 && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, margin: '0 0 10px',
              textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resumen por empleado
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.values(porEmpleado).map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 9,
                  backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1E40AF' }}>
                    {(e.nombre ?? '?')[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>
                      {e.nombre}
                    </p>
                    <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
                      {e.cantidad} gasto{e.cantidad !== 1 ? 's' : ''} · {fmtMXN(e.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input type="text" placeholder="Buscar por empleado, concepto o folio..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, paddingLeft: 32 }} />
          </div>
          {seleccionados.length > 0 && (
            <button onClick={() => setModalPago(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 9, border: 'none',
                backgroundColor: '#10B981', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <DollarSign size={13} />
              Pagar {seleccionados.length} seleccionado{seleccionados.length !== 1 ? 's' : ''} · {fmtMXN(totalSeleccionado)}
            </button>
          )}
        </div>

        {/* Tabla */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 14, overflow: 'hidden' }}>

          {/* Header de tabla */}
          <div style={{ display: 'grid',
            gridTemplateColumns: '36px 1fr 160px 100px 80px 80px 120px',
            gap: 0, padding: '9px 16px', backgroundColor: '#F9FAFB',
            borderBottom: '1px solid #E5E7EB', fontSize: 10, fontWeight: 600,
            color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em',
            alignItems: 'center' }}>
            <div>
              <input type="checkbox"
                checked={seleccionados.length === filtrados.length && filtrados.length > 0}
                onChange={toggleTodos}
                style={{ accentColor: '#2563EB', cursor: 'pointer' }} />
            </div>
            <div>Empleado / Concepto</div>
            <div>Proyecto</div>
            <div>Fecha</div>
            <div>Días</div>
            <div style={{ textAlign: 'right' }}>Monto</div>
            <div style={{ textAlign: 'center' }}>Acción</div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 40, gap: 10, color: '#9CA3AF' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Cargando…</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
              <DollarSign size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                Sin reembolsos pendientes
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>Todos los reembolsos están al día</p>
            </div>
          ) : (
            filtrados.map((r, i) => {
              const dias     = diasPendiente(r.enviado_at)
              const urgente  = dias > 5
              const sel      = seleccionados.includes(r.id)
              return (
                <div key={r.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 160px 100px 80px 80px 120px',
                  gap: 0, padding: '11px 16px', alignItems: 'center',
                  borderBottom: i < filtrados.length-1 ? '1px solid #F3F4F6' : 'none',
                  backgroundColor: sel ? '#F8FAFF' : '#fff',
                }}>
                  <div>
                    <input type="checkbox" checked={sel}
                      onChange={() => toggleSeleccion(r.id)}
                      style={{ accentColor: '#2563EB', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                      {r.usuario?.full_name}
                    </p>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                      {r.concepto}
                      {r.folio && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontFamily: 'monospace',
                          color: '#9CA3AF', backgroundColor: '#F3F4F6',
                          padding: '0 4px', borderRadius: 3 }}>{r.folio}</span>
                      )}
                    </p>
                  </div>
                  <div style={{ fontSize: 11, color: '#6366F1', fontFamily: 'monospace', fontWeight: 600 }}>
                    {r.proyecto ? `[${r.proyecto.code}]` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    {fmtFecha(r.fecha_gasto)}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px',
                      borderRadius: 6,
                      backgroundColor: urgente ? '#FEF2F2' : '#F3F4F6',
                      color: urgente ? '#DC2626' : '#6B7280' }}>
                      {dias}d {urgente && '⚠️'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    {fmtMXN(r.monto_total)}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={() => { setSeleccionados([r.id]); setModalPago(true) }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', borderRadius: 7, border: 'none',
                        backgroundColor: '#10B981', color: '#fff',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      <DollarSign size={11} /> Pagar
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {modalPago && (
        <ModalPago
          gastos={filtrados.filter(r => seleccionados.includes(r.id))}
          onConfirm={handlePagar}
          onClose={() => setModalPago(false)}
        />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
