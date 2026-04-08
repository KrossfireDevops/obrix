// ============================================================
//  OBRIX ERP — Página: Formulario de Póliza
//  Archivo: src/pages/contabilidad/PolizaForm.jsx
//  Versión: 1.0 | Marzo 2026
//  Ruta: /contabilidad/polizas/nueva  |  /contabilidad/polizas/:id
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Save, CheckCircle, XCircle, Plus, Trash2,
  AlertTriangle, RefreshCw, FileText, Zap, Info,
} from 'lucide-react'
import {
  getPolizaDetalle, crearPoliza, actualizarPoliza,
  aplicarPoliza, cancelarPoliza, upsertAsientos,
  getCuentas, formatMXN, TIPO_POLIZA_LABEL,
} from '../../services/libroMayor.service'
import { MainLayout } from '../../components/layout/MainLayout'

const TIPOS_POLIZA = ['ingreso','egreso','diario','cheque','presupuesto']

const ASIENTO_VACIO = {
  cuenta_id: '', tipo_movimiento: 'cargo', monto: '',
  concepto: '', deducible: true, tipo_no_deducible: '',
  monto_no_deducible: 0, tipo_iva: '', monto_iva: 0,
}

export default function PolizaForm() {
  const navigate     = useNavigate()
  const { id }       = useParams()
  const esNueva      = !id || id === 'nueva'

  const [poliza,    setPoliza]    = useState(null)
  const [cuentas,   setCuentas]   = useState([])
  const [asientos,  setAsientos]  = useState([{ ...ASIENTO_VACIO }, { ...ASIENTO_VACIO, tipo_movimiento: 'abono' }])
  const [form,      setForm]      = useState({
    tipo: 'egreso', fecha: new Date().toISOString().split('T')[0],
    concepto: '', numero_externo: '', project_id: null,
  })
  const [loading,   setLoading]   = useState(!esNueva)
  const [guardando, setGuardando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error,     setError]     = useState(null)
  const [exito,     setExito]     = useState(null)

  useEffect(() => {
    getCuentas().then(setCuentas).catch(console.error)
    if (!esNueva) cargarPoliza()
  }, [id])

  const cargarPoliza = async () => {
    try {
      setLoading(true)
      const data = await getPolizaDetalle(id)
      setPoliza(data)
      setForm({
        tipo:           data.tipo,
        fecha:          data.fecha,
        concepto:       data.concepto ?? '',
        numero_externo: data.numero_externo ?? '',
        project_id:     data.project_id,
      })
      if (data.asientos?.length) {
        setAsientos(data.asientos.map(a => ({
          id:                 a.id,
          cuenta_id:          a.cuenta_id,
          tipo_movimiento:    a.tipo_movimiento,
          monto:              a.monto,
          concepto:           a.concepto ?? '',
          deducible:          a.deducible,
          tipo_no_deducible:  a.tipo_no_deducible ?? '',
          monto_no_deducible: a.monto_no_deducible ?? 0,
          tipo_iva:           a.tipo_iva ?? '',
          monto_iva:          a.monto_iva ?? 0,
        })))
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Cálculos en tiempo real ───────────────────────────────
  const totalCargos = useMemo(() =>
    asientos.filter(a => a.tipo_movimiento === 'cargo')
      .reduce((s, a) => s + (Number(a.monto) || 0), 0),
    [asientos]
  )
  const totalAbonos = useMemo(() =>
    asientos.filter(a => a.tipo_movimiento === 'abono')
      .reduce((s, a) => s + (Number(a.monto) || 0), 0),
    [asientos]
  )
  const diferencia   = totalCargos - totalAbonos
  const estaCuadrada = Math.abs(diferencia) < 0.01
  const tieneNoDeducible = asientos.some(a => !a.deducible && a.monto > 0)

  // ── Asientos helpers ──────────────────────────────────────
  const agregarAsiento = (tipo = 'cargo') => {
    setAsientos(prev => [...prev, { ...ASIENTO_VACIO, tipo_movimiento: tipo }])
  }

  const actualizarAsiento = (idx, campo, valor) => {
    setAsientos(prev => prev.map((a, i) => {
      if (i !== idx) return a
      const updated = { ...a, [campo]: valor }
      // Auto-toggle deducible si la cuenta seleccionada es no deducible
      if (campo === 'cuenta_id') {
        const cuenta = cuentas.find(c => c.id === valor)
        if (cuenta) updated.deducible = cuenta.deducible !== false
      }
      // Auto-calcular IVA si se ingresa monto y hay tasa
      if (campo === 'monto' && a.tipo_iva === 'acreditable') {
        updated.monto_iva = Number(valor) * 0.16
      }
      return updated
    }))
  }

  const eliminarAsiento = (idx) => {
    setAsientos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Guardar ───────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!form.concepto.trim()) { setError('El concepto es obligatorio.'); return }
    if (asientos.length < 2)   { setError('Una póliza necesita al menos 2 asientos.'); return }
    if (asientos.some(a => !a.cuenta_id)) { setError('Todos los asientos deben tener cuenta.'); return }

    try {
      setGuardando(true); setError(null)
      let polizaId = poliza?.id

      if (esNueva) {
        const nueva = await crearPoliza(form)
        polizaId = nueva.id
      } else {
        await actualizarPoliza(poliza.id, form)
      }

      await upsertAsientos(polizaId, asientos.map((a, i) => ({
        ...a,
        linea:  i + 1,
        monto:  Number(a.monto),
        monto_iva: Number(a.monto_iva) || 0,
        monto_no_deducible: !a.deducible ? Number(a.monto) : 0,
      })))

      setExito('Póliza guardada correctamente.')
      if (esNueva) navigate(`/contabilidad/polizas/${polizaId}`, { replace: true })
      else cargarPoliza()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  // ── Aplicar ───────────────────────────────────────────────
  const handleAplicar = async () => {
    if (!estaCuadrada) { setError('La póliza no está cuadrada. Corrija la diferencia antes de aplicar.'); return }
    if (!window.confirm('¿Aplicar esta póliza? Una vez aplicada no se puede editar.')) return
    try {
      setAplicando(true); setError(null)
      // Guardar primero
      await upsertAsientos(poliza.id, asientos.map((a, i) => ({
        ...a, linea: i + 1, monto: Number(a.monto),
        monto_iva: Number(a.monto_iva) || 0,
        monto_no_deducible: !a.deducible ? Number(a.monto) : 0,
      })))
      await aplicarPoliza(poliza.id)
      setExito('Póliza aplicada correctamente.')
      cargarPoliza()
    } catch (e) { setError(e.message) }
    finally { setAplicando(false) }
  }

  // ── Cancelar póliza ───────────────────────────────────────
  const handleCancelar = async () => {
    const motivo = window.prompt('Motivo de cancelación:')
    if (!motivo) return
    try {
      await cancelarPoliza(poliza.id, motivo)
      setExito('Póliza cancelada.')
      cargarPoliza()
    } catch (e) { setError(e.message) }
  }

  const esBorrador  = !poliza || poliza.estatus === 'borrador'
  const esAplicada  = poliza?.estatus === 'aplicada'
  const esCancelada = poliza?.estatus === 'cancelada'
  const readOnly    = !esBorrador

  if (loading) return (
    <MainLayout title={esNueva ? "📄 Nueva Póliza" : "📄 Póliza"}>
      <div className="flex justify-center py-24">
        <RefreshCw size={24} className="text-indigo-500 animate-spin" />
      </div>
    </MainLayout>
  )

  const titulo = esNueva ? '📄 Nueva Póliza' : `📄 Póliza ${poliza?.folio ?? ''}`

  return (
    <MainLayout title={titulo}>
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/contabilidad/polizas')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              {poliza?.estatus && <EstatusBadge estatus={poliza.estatus} />}
              {poliza?.origen === 'automatica' && (
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <Zap size={12} /> Auto
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {esBorrador && (
              <>
                <button onClick={handleGuardar} disabled={guardando}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {guardando ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar
                </button>
                <button onClick={handleAplicar} disabled={!estaCuadrada || aplicando}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {aplicando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Aplicar Póliza
                </button>
              </>
            )}
            {esAplicada && (
              <button onClick={handleCancelar}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50">
                <XCircle size={14} /> Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}
        {exito && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle size={14} className="shrink-0" /> {exito}
          </div>
        )}

        {/* Encabezado de la póliza */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos de la Póliza</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select value={form.tipo} disabled={readOnly}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-500">
                {TIPOS_POLIZA.map(t => (
                  <option key={t} value={t}>{TIPO_POLIZA_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input type="date" value={form.fecha} disabled={readOnly}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Concepto *</label>
              <input type="text" value={form.concepto} disabled={readOnly}
                onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                placeholder="Describe el motivo de la póliza"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                No. Cheque / Referencia
              </label>
              <input type="text" value={form.numero_externo} disabled={readOnly}
                onChange={e => setForm(f => ({ ...f, numero_externo: e.target.value }))}
                placeholder="Opcional"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50" />
            </div>
            {/* CFDI vinculado */}
            {poliza?.cfdi_documentos && (
              <div className="lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">CFDI Vinculado</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <Zap size={12} />
                  <span className="font-mono">{poliza.cfdi_documentos.uuid_cfdi}</span>
                  <span>·</span>
                  <span>{poliza.cfdi_documentos.emisor_nombre}</span>
                  <span>·</span>
                  <span className="font-semibold">{formatMXN(poliza.cfdi_documentos.total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Asientos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Asientos Contables
            </h2>
            {/* Indicador cuadre */}
            <div className={`flex items-center gap-2 text-sm font-medium ${estaCuadrada ? 'text-green-600' : 'text-red-600'}`}>
              {estaCuadrada
                ? <><CheckCircle size={14} /> Cuadrada</>
                : <><AlertTriangle size={14} /> Diferencia: {formatMXN(Math.abs(diferencia))}</>
              }
            </div>
          </div>

          {/* Encabezados tabla */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
            <div className="col-span-3">Cuenta</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2 text-right">Monto</div>
            <div className="col-span-2">Concepto</div>
            <div className="col-span-2">Deducible / IVA</div>
            <div className="col-span-1"></div>
          </div>

          {/* Filas de asientos */}
          {asientos.map((a, idx) => (
            <div key={idx}
              className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-50 items-center
                ${!a.deducible ? 'bg-red-50' : ''}`}>
              {/* Cuenta */}
              <div className="col-span-3">
                <select value={a.cuenta_id} disabled={readOnly}
                  onChange={e => actualizarAsiento(idx, 'cuenta_id', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-50">
                  <option value="">— Seleccionar cuenta —</option>
                  {cuentas.filter(c => c.acepta_movimientos).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} · {c.nombre}{!c.deducible ? ' ⚠' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {/* Tipo movimiento */}
              <div className="col-span-2">
                <select value={a.tipo_movimiento} disabled={readOnly}
                  onChange={e => actualizarAsiento(idx, 'tipo_movimiento', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-50">
                  <option value="cargo">CARGO</option>
                  <option value="abono">ABONO</option>
                </select>
              </div>
              {/* Monto */}
              <div className="col-span-2">
                <input type="number" min="0" step="0.01" value={a.monto} disabled={readOnly}
                  onChange={e => actualizarAsiento(idx, 'monto', e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-2 py-1.5 text-xs text-right border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-50
                    ${a.tipo_movimiento === 'cargo' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`} />
              </div>
              {/* Concepto del asiento */}
              <div className="col-span-2">
                <input type="text" value={a.concepto} disabled={readOnly}
                  onChange={e => actualizarAsiento(idx, 'concepto', e.target.value)}
                  placeholder="Descripción…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-50" />
              </div>
              {/* Deducible / IVA */}
              <div className="col-span-2 flex items-center gap-2">
                {!readOnly && (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={a.deducible}
                      onChange={e => actualizarAsiento(idx, 'deducible', e.target.checked)}
                      className="rounded" />
                    <span className="text-xs text-gray-600">Deduc.</span>
                  </label>
                )}
                {!a.deducible && (
                  <span className="text-xs text-red-500 font-medium">No ded.</span>
                )}
                {a.tipo_iva === 'acreditable' && (
                  <span className="text-xs text-blue-500">IVA: {formatMXN(a.monto_iva)}</span>
                )}
              </div>
              {/* Eliminar */}
              <div className="col-span-1 flex justify-end">
                {!readOnly && asientos.length > 2 && (
                  <button onClick={() => eliminarAsiento(idx)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Totales */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm font-semibold">
            <div className="col-span-3 text-gray-600">TOTALES</div>
            <div className="col-span-2" />
            <div className="col-span-2 text-right">
              <span className="text-blue-700 font-mono">{formatMXN(totalCargos)}</span>
              <span className="text-gray-400 ml-2 text-xs">cargos</span>
            </div>
            <div className="col-span-2" />
            <div className="col-span-2" />
            <div className={`col-span-1 text-right font-mono ${estaCuadrada ? 'text-green-600' : 'text-red-600'}`}>
              {estaCuadrada ? '✓' : `Δ${formatMXN(diferencia)}`}
            </div>
          </div>

          {/* Abonos total separado */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Total Abonos:</span>
            <span className="font-mono text-green-700 font-semibold">{formatMXN(totalAbonos)}</span>
          </div>

          {/* Agregar asiento */}
          {!readOnly && (
            <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
              <button onClick={() => agregarAsiento('cargo')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                <Plus size={12} /> Cargo
              </button>
              <button onClick={() => agregarAsiento('abono')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50">
                <Plus size={12} /> Abono
              </button>
              {tieneNoDeducible && (
                <div className="flex items-center gap-1.5 ml-auto text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  <Info size={12} />
                  Póliza con gastos no deducibles — se reportarán en Contabilidad Electrónica
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  )
}

function EstatusBadge({ estatus }) {
  const map = {
    borrador:  'bg-gray-100 text-gray-600',
    aplicada:  'bg-green-100 text-green-700',
    cancelada: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${map[estatus] ?? map.borrador}`}>
      {estatus}
    </span>
  )
}
