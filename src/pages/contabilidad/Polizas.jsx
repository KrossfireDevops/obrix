// ============================================================
//  OBRIX ERP — Página: Lista de Pólizas
//  Archivo: src/pages/contabilidad/Polizas.jsx
//  Versión: 1.0 | Marzo 2026
//  Ruta: /contabilidad/polizas/:tipo?
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FileText, Plus, RefreshCw, AlertTriangle, Search,
  ChevronLeft, ChevronRight, CheckCircle, Clock,
  XCircle, Zap, Download, Eye, AlertCircle,
} from 'lucide-react'
import {
  getPolizas, generarPolizaDesdeCfdi,
  formatMXN, formatFecha,
  TIPO_POLIZA_LABEL, TIPO_POLIZA_COLOR, ESTATUS_POLIZA_COLOR,
  getMesActual,
} from '../../services/libroMayor.service'
import { getCfdis } from '../../services/buzonFiscal.service'
import { MainLayout } from '../../components/layout/MainLayout'

const TABS = [
  { id: 'todos',      label: 'Todos',       tipo: null         },
  { id: 'ingreso',    label: 'Ingreso',     tipo: 'ingreso'    },
  { id: 'egreso',     label: 'Egreso',      tipo: 'egreso'     },
  { id: 'diario',     label: 'Diario',      tipo: 'diario'     },
  { id: 'cheque',     label: 'Cheque',      tipo: 'cheque'     },
  { id: 'presupuesto',label: 'Presupuesto', tipo: 'presupuesto'},
]

export default function Polizas() {
  const navigate         = useNavigate()
  const { tipo: tipoUrl } = useParams()

  const tabInicial = TABS.find(t => t.tipo === tipoUrl) ?? TABS[0]
  const [activeTab,   setActiveTab]   = useState(tabInicial.id)
  const [polizas,     setPolizas]     = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [page,        setPage]        = useState(1)
  const [filtros,     setFiltros]     = useState({})
  const [showGenerar, setShowGenerar] = useState(false)

  const { desde, hasta } = getMesActual()
  const [rango, setRango] = useState({ desde, hasta })

  useEffect(() => { cargar() }, [activeTab, page, rango])

  const cargar = async () => {
    try {
      setLoading(true); setError(null)
      const tab = TABS.find(t => t.id === activeTab)
      const { data, count } = await getPolizas({
        tipo:        tab.tipo,
        fecha_desde: rango.desde,
        fecha_hasta: rango.hasta,
        page, pageSize: 50,
        ...filtros,
      })
      setPolizas(data); setTotal(count)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const totalPags = Math.ceil(total / 50)

  return (
    <MainLayout title="📄 Pólizas Contables">
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <input type="date" value={rango.desde}
              onChange={e => setRango(r => ({ ...r, desde: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <span className="text-gray-400">—</span>
            <input type="date" value={rango.hasta}
              onChange={e => setRango(r => ({ ...r, hasta: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button onClick={() => setShowGenerar(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
            <Zap size={14} /> Desde CFDI
          </button>
          <button onClick={() => navigate('/contabilidad/polizas/nueva')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={15} /> Nueva Póliza
          </button>
          <button onClick={cargar}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} />
          </button>
        </div>

      {/* Tabs por tipo */}
        {/* ── Tabs + Tabla ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <nav className="flex gap-1 px-4 border-b border-gray-100">
            {TABS.map(tab => (
              <button key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1) }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                {tab.label}
                {tab.tipo && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${TIPO_POLIZA_COLOR[tab.tipo]?.bg} ${TIPO_POLIZA_COLOR[tab.tipo]?.text}`}>
                    {tab.tipo.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Error */}
          {error && (
            <div className="m-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Toolbar interno */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm text-gray-400">{total.toLocaleString('es-MX')} pólizas</span>
            <FiltroEstatus onChange={e => setFiltros(f => ({ ...f, estatus: e || undefined }))} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : polizas.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay pólizas en este período</p>
              <button onClick={() => navigate('/contabilidad/polizas/nueva')}
                className="mt-3 text-sm text-indigo-600 hover:underline">
                + Crear la primera póliza
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Folio','Fecha','Tipo','Concepto','Tercero','Cargos','Abonos','Diferencia','Estatus',''].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                      ['Cargos','Abonos','Diferencia'].includes(h) ? 'text-right' : 'text-left'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {polizas.map(p => {
                  const tColor = TIPO_POLIZA_COLOR[p.tipo] ?? TIPO_POLIZA_COLOR.diario
                  const eColor = ESTATUS_POLIZA_COLOR[p.estatus] ?? ESTATUS_POLIZA_COLOR.borrador
                  const cuadrada = Math.abs(Number(p.diferencia ?? 0)) < 0.01
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-indigo-600 font-semibold">
                          {p.folio}
                        </span>
                        {p.origen === 'automatica' && (
                          <span className="ml-1 text-xs text-amber-500" title="Generada automáticamente">⚡</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {formatFecha(p.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${tColor.bg} ${tColor.text}`}>
                          {TIPO_POLIZA_LABEL[p.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs">
                        <p className="truncate">{p.concepto}</p>
                        {p.tiene_no_deducible && (
                          <span className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                            <AlertCircle size={10} /> No deducible: {formatMXN(p.monto_no_deducible)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                        <p className="truncate">{p.terceros?.razon_social ?? '—'}</p>
                        {p.terceros?.rfc && <p className="font-mono text-gray-400">{p.terceros.rfc}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                        {formatMXN(p.total_cargos)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                        {formatMXN(p.total_abonos)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${cuadrada ? 'text-green-600' : 'text-red-600'}`}>
                        {cuadrada ? '✓ 0.00' : formatMXN(p.diferencia)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${eColor.bg} ${eColor.text}`}>
                          {p.estatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/contabilidad/polizas/${p.id}`)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Paginación */}
          {totalPags > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Página {page} de {totalPags}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPags, p+1))} disabled={page === totalPags}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: generar desde CFDI */}
      {showGenerar && (
        <GenerarDesdeCfdiModal
          onClose={() => setShowGenerar(false)}
          onSuccess={(polizaId) => {
            setShowGenerar(false)
            navigate(`/contabilidad/polizas/${polizaId}`)
          }}
        />
      )}
    </MainLayout>
  )
}

// ── Sub-componentes ────────────────────────────────────────

function FiltroEstatus({ onChange }) {
  return (
    <select onChange={e => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
      <option value="">Todos los estados</option>
      <option value="borrador">Borrador</option>
      <option value="aplicada">Aplicada</option>
      <option value="cancelada">Cancelada</option>
    </select>
  )
}

function GenerarDesdeCfdiModal({ onClose, onSuccess }) {
  const [cfdis,     setCfdis]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [generando, setGenerando] = useState(null)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    getCfdis({ contabilizado: false, tipo_comprobante: 'I', direccion: 'recibida', pageSize: 100 })
      .then(r => setCfdis(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleGenerar = async (cfdiId) => {
    setGenerando(cfdiId); setError(null)
    try {
      const polizaId = await generarPolizaDesdeCfdi(cfdiId)
      onSuccess(polizaId)
    } catch (e) { setError(e.message) }
    finally { setGenerando(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            Generar Póliza desde CFDI
          </h2>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <XCircle size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4">
            CFDIs recibidos pendientes de contabilizar:
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : cfdis.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              Todos los CFDIs ya están contabilizados ✓
            </p>
          ) : (
            <div className="space-y-2">
              {cfdis.map(cfdi => (
                <div key={cfdi.id}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {cfdi.emisor_nombre ?? cfdi.emisor_rfc}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{cfdi.uuid_cfdi?.substring(0,20)}…</p>
                    <p className="text-xs text-gray-400">{formatFecha(cfdi.fecha_emision)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatMXN(cfdi.total)}</p>
                    <button
                      onClick={() => handleGenerar(cfdi.id)}
                      disabled={generando === cfdi.id}
                      className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {generando === cfdi.id
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <Zap size={11} />
                      }
                      Generar póliza
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
