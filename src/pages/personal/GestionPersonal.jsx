// ============================================================
//  OBRIX ERP — Página: Gestión de Personal
//  src/pages/personal/GestionPersonal.jsx  |  v1.1
//  Ruta: /personal
//
//  Correcciones v1.1:
//    · Eliminados imports no usados (Filter, ChevronRight)
//    · Avatar protegido contra nombre/apellido_paterno null
//    · cargar() normaliza retorno del servicio ({ data } o array)
// ============================================================

import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'
import {
  Users, Plus, RefreshCw, Search,
  UserCheck, Clock, Building2, FileText,
  Edit2, UserX, Shield,
} from 'lucide-react'
import {
  getPersonal, getPersonalKpis,
  TIPO_PERSONAL_CFG, ESQUEMA_PAGO_CFG,
} from '../../services/gestionPersonal.service'
import {
  ESTATUS_TRABAJADOR_CFG,
  cambiarEstatusTrabajador,
} from '../../services/incidencias.service'
import ExpedienteForm    from './ExpedienteForm'
import ExpedienteDetalle from './ExpedienteDetalle'
import PreNominaPage     from './PreNominaPage'
import IncidenciasPage   from './IncidenciasPage'

// ── Tabs ─────────────────────────────────────────────────────
const TABS = [
  { id: 'directorio',  label: 'Directorio',  icon: Users     },
  { id: 'incidencias', label: 'Incidencias',  icon: Shield    },
  { id: 'prenomina',   label: 'Pre-Nómina',  icon: FileText  },
]

// ── Helper: iniciales seguras para el avatar ──────────────────
const iniciales = (p) => {
  const n = (p.nombre          ?? p.nombre_completo ?? '?')[0] ?? '?'
  const a = (p.apellido_paterno ?? '?')[0] ?? '?'
  return (n + a).toUpperCase()
}

// ── Helper: normalizar retorno del servicio ───────────────────
// Soporta tanto array directo como { data, error } (Supabase)
const normalizar = (resultado) => {
  if (Array.isArray(resultado)) return resultado
  if (resultado && Array.isArray(resultado.data)) return resultado.data
  return []
}

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

export default function GestionPersonal() {
  const { toasts, toast, removeToast } = useToast()

  const [personal,    setPersonal]    = useState([])
  const [kpis,        setKpis]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('directorio')
  const [search,      setSearch]      = useState('')
  const [filtroTipo,  setFiltroTipo]  = useState('')
  const [seleccionado, setSeleccionado] = useState(null)

  // Modales
  const [showForm,    setShowForm]    = useState(false)
  const [editando,    setEditando]    = useState(null)
  const [confirmBaja, setConfirmBaja] = useState(null)
  const [modalEstatusWorker, setModalEstatusWorker] = useState(null)

  useEffect(() => { cargar() }, [filtroTipo])

  const cargar = async () => {
    setLoading(true)
    try {
      const [resultPersonal, resultKpis] = await Promise.all([
        getPersonal({ tipo: filtroTipo || undefined }),
        getPersonalKpis(),
      ])

      // Normalizar ambos resultados — soporta array directo o { data, error }
      setPersonal(normalizar(resultPersonal))

      // KPIs puede ser objeto directo o { data }
      if (resultKpis && !resultKpis.error) {
        setKpis(Array.isArray(resultKpis.data) ? resultKpis.data?.[0] : (resultKpis.data ?? resultKpis))
      }
    } catch (e) {
      toast.error(e.message ?? 'Error al cargar el personal')
    } finally {
      setLoading(false)
    }
  }

  // Filtro local por búsqueda
  const personalFiltrado = personal.filter(p => {
    if (!search) return true
    const txt = search.toLowerCase()
    return (
      p.nombre_completo?.toLowerCase().includes(txt) ||
      p.rfc?.toLowerCase().includes(txt) ||
      p.curp?.toLowerCase().includes(txt) ||
      p.especialidad?.toLowerCase().includes(txt)
    )
  })

  return (
    <MainLayout title="👷 Gestión de Personal">
      <div className="space-y-5">

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Activos"   valor={kpis.total_activos      ?? 0} color="indigo" icon={Users}     />
            <KpiCard label="Con IMSS"        valor={kpis.con_imss           ?? 0} color="green"  icon={UserCheck} />
            <KpiCard label="Temporales"      valor={kpis.por_tipo_temporal  ?? 0} color="amber"  icon={Clock}     />
            <KpiCard label="Subcontratistas" valor={kpis.por_tipo_sub       ?? 0} color="purple" icon={Building2} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={15} /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* TAB: DIRECTORIO */}
        {activeTab === 'directorio' && (
          <div className="space-y-4">

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, RFC, CURP..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
                <option value="">Todos los tipos</option>
                {Object.entries(TIPO_PERSONAL_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
              <button onClick={() => { setEditando(null); setShowForm(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 ml-auto">
                <Plus size={15} /> Nuevo Trabajador
              </button>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw size={20} className="animate-spin text-indigo-400" />
                </div>
              ) : personalFiltrado.length === 0 ? (
                <div className="py-16 text-center">
                  <Users size={40} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No hay trabajadores registrados</p>
                  <button onClick={() => setShowForm(true)}
                    className="mt-3 text-sm text-indigo-600 hover:underline">
                    + Registrar primer trabajador
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Trabajador','Tipo','Especialidad','Proyecto','Esquema','Tarifa',''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {personalFiltrado.map(p => {
                      const tipoCfg    = TIPO_PERSONAL_CFG[p.tipo_personal] ?? TIPO_PERSONAL_CFG.temporal
                      const esquemaCfg = ESQUEMA_PAGO_CFG[p.esquema_pago]  ?? ESQUEMA_PAGO_CFG.jornada
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSeleccionado(p)}>

                          {/* Avatar + nombre */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                                {iniciales(p)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{p.nombre_completo}</p>
                                {p.rfc && <p className="text-xs font-mono text-gray-400">{p.rfc}</p>}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium w-fit ${tipoCfg.color}`}>
                                {tipoCfg.emoji} {tipoCfg.label}
                              </span>
                              {/* Estatus del trabajador */}
                              {(() => {
                                const key = p.estatus === 'baja' ? 'baja' : (p.estatus_incidencia || 'activo')
                                const ec  = ESTATUS_TRABAJADOR_CFG[key] ?? ESTATUS_TRABAJADOR_CFG.activo
                                return (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium w-fit ${ec.color}`}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ec.dot, display: 'inline-block' }} />
                                    {ec.label}
                                  </span>
                                )
                              })()}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-gray-600 text-sm">{p.especialidad ?? '—'}</td>

                          <td className="px-4 py-3">
                            {p.projects ? (
                              <span className="text-xs font-mono text-indigo-600 font-semibold">
                                [{p.projects.code}] {p.projects.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sin asignar</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-xs text-gray-600">
                            {esquemaCfg.emoji} {esquemaCfg.label}
                          </td>

                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                            {p.esquema_pago === 'destajo'
                              ? p.tarifa_destajo
                                ? `$${Number(p.tarifa_destajo).toLocaleString('es-MX')} / ${p.unidad_destajo ?? 'u'}`
                                : '—'
                              : p.tarifa_diaria
                                ? `$${Number(p.tarifa_diaria).toLocaleString('es-MX')} / día`
                                : '—'
                            }
                          </td>

                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditando(p); setShowForm(true) }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Editar expediente">
                                <Edit2 size={13} />
                              </button>
                              {/* Cambiar estatus — nunca eliminar */}
                              <button
                                onClick={() => setModalEstatusWorker(p)}
                                title={p.estatus === 'baja' ? 'Reactivar empleado' : 'Dar de baja'}
                                className={`p-1.5 rounded-lg ${
                                  p.estatus === 'baja'
                                    ? 'text-green-500 hover:text-green-700 hover:bg-green-50'
                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                }`}>
                                {p.estatus === 'baja' ? <UserCheck size={13} /> : <UserX size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: INCIDENCIAS */}
        {activeTab === 'incidencias' && (
          <IncidenciasPage toast={toast} />
        )}

        {/* TAB: PRE-NÓMINA */}
        {activeTab === 'prenomina' && (
          <PreNominaPage toast={toast} />
        )}
      </div>

      {/* ── Modal: Nuevo / Editar trabajador ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editando ? '✏️ Editar Trabajador' : '👷 Nuevo Trabajador'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditando(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ExpedienteForm
                inicial={editando}
                onSuccess={() => {
                  setShowForm(false)
                  setEditando(null)
                  toast.success(editando ? 'Trabajador actualizado' : 'Trabajador registrado ✓')
                  cargar()
                }}
                onCancel={() => { setShowForm(false); setEditando(null) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Panel: Detalle trabajador ── */}
      {seleccionado && (
        <ExpedienteDetalle
          trabajadorId={seleccionado.id}
          onClose={() => setSeleccionado(null)}
          onEdit={(t) => { setEditando(t); setShowForm(true); setSeleccionado(null) }}
          toast={toast}
        />
      )}

      {/* ── Modal: Cambiar estatus del trabajador (Activo / Baja) ── */}
      {modalEstatusWorker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                modalEstatusWorker.estatus === 'baja' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {modalEstatusWorker.estatus === 'baja'
                  ? <UserCheck size={18} className="text-green-600" />
                  : <UserX size={18} className="text-red-600" />
                }
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {modalEstatusWorker.estatus === 'baja' ? 'Reactivar empleado' : 'Dar de baja'}
                </p>
                <p className="text-sm text-gray-500">{modalEstatusWorker.nombre_completo}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <Shield size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                {modalEstatusWorker.estatus === 'baja'
                  ? 'El expediente del empleado se conserva íntegro. Se cambiará su estatus a Activo.'
                  : 'El empleado NO se elimina del sistema. Su expediente queda en estatus Baja y se conserva para consulta histórica y efectos legales.'
                }
              </p>
            </div>

            {modalEstatusWorker.estatus !== 'baja' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de baja *</label>
                <textarea rows={2}
                  value={confirmBaja?.motivo || ''}
                  onChange={e => setConfirmBaja(prev => ({ ...(prev || { id: modalEstatusWorker.id, nombre: modalEstatusWorker.nombre_completo }), motivo: e.target.value }))}
                  placeholder="Renuncia voluntaria, término de contrato, despido…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none" />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setModalEstatusWorker(null); setConfirmBaja(null) }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (modalEstatusWorker.estatus !== 'baja' && !confirmBaja?.motivo?.trim()) {
                    toast.error('El motivo de baja es obligatorio'); return
                  }
                  try {
                    await cambiarEstatusTrabajador(
                      modalEstatusWorker.id,
                      modalEstatusWorker.estatus === 'baja' ? 'activo' : 'baja',
                      confirmBaja?.motivo || null,
                    )
                    toast.success(
                      modalEstatusWorker.estatus === 'baja'
                        ? `${modalEstatusWorker.nombre_completo} reactivado ✓`
                        : `${modalEstatusWorker.nombre_completo} dado de baja ✓`
                    )
                    setModalEstatusWorker(null); setConfirmBaja(null)
                    cargar()
                  } catch (e) { toast.error(e.message) }
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white ${
                  modalEstatusWorker.estatus === 'baja'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}>
                {modalEstatusWorker.estatus === 'baja' ? 'Reactivar' : 'Dar de baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </MainLayout>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, valor, color, icon: Icon }) {
  const colors = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-500' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: 'text-green-500'  },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'text-amber-500'  },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500' },
  }
  const c = colors[color] ?? colors.indigo
  return (
    <div className={`p-4 rounded-xl border ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>{label}</span>
        <Icon size={16} className={c.icon} />
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{valor}</p>
    </div>
  )
}