// ============================================================
//  OBRIX ERP — Página: Avances de Obra
//  src/pages/obra/AvancesObra.jsx  |  v2.0 GoldenRing
//  Ruta: /obra/avances
// ============================================================

import { useState, useEffect } from 'react'
import { MainLayout }       from '../../components/layout/MainLayout'
import { useToast }         from '../../hooks/useToast'
import { ToastContainer }   from '../../components/ui/Toast'
import { useAuth }          from '../../context/AuthContext'
import { useOffline }       from '../../hooks/useOffline'
import SyncStatusBar        from '../../components/goldenring/SyncStatusBar'
import {
  TrendingUp, RefreshCw, AlertTriangle, CheckCircle,
  Clock, Camera, BookOpen, Plus, Filter,
  ChevronDown, Building2, Layers,
} from 'lucide-react'
import {
  getKpisAvance, getUltimoAvancePorSeccion,
  getAvancesPendientesValidar, getBitacora,
  TIPO_AVANCE_CFG,
} from '../../services/avancesObra.service'
import { getLevelsByProject } from '../../services/planeacionObra.service'
import * as projectsService   from '../../services/projects.service'
import RegistroAvanceModal    from './RegistroAvanceModal'
import ValidacionPanel        from './ValidacionPanel'
import BitacoraPanel          from './BitacoraPanel'

const TABS = [
  { id: 'avances',    label: 'Avances',    icon: TrendingUp  },
  { id: 'validacion', label: 'Validación', icon: CheckCircle },
  { id: 'bitacora',   label: 'Bitácora',   icon: BookOpen    },
]

export default function AvancesObra() {
  const { toasts, toast, removeToast } = useToast()
  const { user }  = useAuth()

  const {
    isOnline,
    syncStatus,
    pendientes:  syncPendientes,
    conflictos:  syncConflictos,
    syncManual,
    registrarAvanceOffline,
    getProyectosCache,
  } = useOffline()

  const [projects,     setProjects]     = useState([])
  const [proyecto,     setProyecto]     = useState(null)
  const [levels,       setLevels]       = useState([])
  const [kpis,         setKpis]         = useState(null)
  const [secciones,    setSecciones]    = useState([])
  const [pendientes,   setPendientes]   = useState([])
  const [activeTab,    setActiveTab]    = useState('avances')
  const [loading,      setLoading]      = useState(false)
  const [showRegistro, setShowRegistro] = useState(false)
  const [seccionSelec, setSeccionSelec] = useState(null)
  const [levelFiltro,  setLevelFiltro]  = useState(null)

  // Cargar proyectos — online: desde Supabase / offline: desde caché
  useEffect(() => {
    const cargarProyectos = async () => {
      if (!isOnline) {
        const cached = await getProyectosCache()
        if (cached.length) {
          setProjects(cached)
          if (cached.length === 1) seleccionarProyecto(cached[0])
        }
        return
      }
      const { data } = await projectsService.getProjects()
      const activos = (data ?? []).filter(p => p.status === 'active')
      setProjects(activos)
      if (activos.length === 1) seleccionarProyecto(activos[0])
    }
    cargarProyectos()
  }, [isOnline])

  const seleccionarProyecto = async (p) => {
    setProyecto(p)
    setLevelFiltro(null)
    if (!isOnline) {
      // Sin conexión: mostrar proyecto sin datos frescos
      toast.warning('📱 Sin conexión — mostrando datos del último caché')
      return
    }
    setLoading(true)
    try {
      const [lvls, kpisData, secsData, pendData] = await Promise.all([
        getLevelsByProject(p.id),
        getKpisAvance(p.id),
        getUltimoAvancePorSeccion(p.id),
        getAvancesPendientesValidar(p.id),
      ])
      setLevels(lvls)
      setKpis(kpisData)
      setSecciones(secsData)
      setPendientes(pendData)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const recargar = () => proyecto && seleccionarProyecto(proyecto)

  // ── Registrar avance: Online o Offline ────────────────────
  const handleAvanceRegistrado = async (datosAvance) => {
    if (!isOnline) {
      // Modo offline: encolar en IndexedDB
      await registrarAvanceOffline({
        seccion_id:  datosAvance.seccion_id,
        proyecto_id: proyecto.id,
        user_id:     user?.id,
        company_id:  proyecto.company_id,
        pct_avance:  datosAvance.pct_avance,
        notas:       datosAvance.notas,
        tipo:        datosAvance.tipo ?? 'avance',
      })
      toast.success('📱 Avance guardado — se sincronizará al reconectar')
      setShowRegistro(false)
      // Optimistic UI: actualizar % en secciones localmente
      setSecciones(prev => prev.map(s =>
        s.section_id === datosAvance.seccion_id
          ? { ...s, pct_actual: datosAvance.pct_avance, _offline: true }
          : s
      ))
      return
    }
    // Online: flujo normal
    setShowRegistro(false)
    recargar()
    toast.success('Avance registrado ✓')
  }

  const seccionesFiltradas = levelFiltro
    ? secciones.filter(s => {
        const level = levels.find(l => l.id === levelFiltro)
        return level?.nivel_nombre === s.nivel_nombre
      })
    : secciones

  const pendientesValidar = pendientes.length

  return (
    <MainLayout title="🔨 Avances de Obra">
      <div className="space-y-5">

        {/* ── GoldenRing: Estado de sincronización ── */}
        <SyncStatusBar
          isOnline={isOnline}
          syncStatus={syncStatus}
          pendientes={syncPendientes}
          conflictos={syncConflictos}
          onSync={syncManual}
        />

        {/* ── Selector de proyecto ── */}
        <div className="flex items-center gap-3">
          <select
            value={proyecto?.id ?? ''}
            onChange={e => {
              const p = projects.find(p => p.id === e.target.value)
              if (p) seleccionarProyecto(p)
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
          >
            <option value="">— Seleccionar proyecto —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
            ))}
          </select>
          {proyecto && (
            <>
              <button onClick={recargar} disabled={!isOnline}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40">
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => { setSeccionSelec(null); setShowRegistro(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 ml-auto"
              >
                <Plus size={15} />
                {isOnline ? 'Registrar Avance' : '📱 Registrar Avance (offline)'}
              </button>
            </>
          )}
        </div>

        {/* ── KPIs ── */}
        {kpis && proyecto && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Avance Global"
              valor={`${Number(kpis.pct_avance_global ?? 0).toFixed(1)}%`}
              sub={`${kpis.secciones_completas}/${kpis.total_secciones} secciones`}
              color="indigo" icon={TrendingUp} />
            <KpiCard label="Registros Hoy"
              valor={kpis.total_registros_hoy ?? 0}
              sub="entradas de avance" color="blue" icon={Clock} />
            <KpiCard label="Fotos Totales"
              valor={kpis.total_fotos ?? 0}
              sub="evidencias cargadas" color="teal" icon={Camera} />
            <KpiCard label="Por Validar"
              valor={pendientesValidar}
              sub="registros pendientes"
              color={pendientesValidar > 0 ? 'amber' : 'green'}
              icon={pendientesValidar > 0 ? AlertTriangle : CheckCircle}
              alert={pendientesValidar > 0} />
          </div>
        )}

        {/* ── Tabs ── */}
        {proyecto && (
          <>
            <div className="flex items-center gap-1 border-b border-gray-200">
              {TABS.map(tab => {
                const Icon = tab.icon
                const badge = tab.id === 'validacion' ? pendientesValidar : 0
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    <Icon size={15} />
                    {tab.label}
                    {badge > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-semibold">
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {activeTab === 'avances' && (
              <TabAvances
                levels={levels}
                secciones={seccionesFiltradas}
                todasSecciones={secciones}
                levelFiltro={levelFiltro}
                setLevelFiltro={setLevelFiltro}
                loading={loading}
                isOnline={isOnline}
                onRegistrar={(sec) => { setSeccionSelec(sec); setShowRegistro(true) }}
              />
            )}
            {activeTab === 'validacion' && (
              <ValidacionPanel pendientes={pendientes} onRefresh={recargar} toast={toast} />
            )}
            {activeTab === 'bitacora' && (
              <BitacoraPanel projectId={proyecto.id} levels={levels} toast={toast} />
            )}
          </>
        )}

        {!proyecto && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Building2 size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Selecciona un proyecto para ver sus avances</p>
            {!isOnline && (
              <p className="text-xs text-amber-600 mt-2">
                📱 Modo offline — mostrando proyectos del caché local
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal: Registrar Avance (funciona online y offline) */}
      {showRegistro && proyecto && (
        <RegistroAvanceModal
          proyecto={proyecto}
          levels={levels}
          seccionPreseleccionada={seccionSelec}
          isOnline={isOnline}
          onSuccess={handleAvanceRegistrado}
          onClose={() => setShowRegistro(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </MainLayout>
  )
}

// ── TabAvances ─────────────────────────────────────────────────
function TabAvances({ levels, secciones, todasSecciones, levelFiltro, setLevelFiltro, loading, isOnline, onRegistrar }) {
  const progressColor = (p) => {
    if (p >= 100) return 'bg-green-500'
    if (p >= 60)  return 'bg-blue-500'
    if (p >= 30)  return 'bg-amber-500'
    return 'bg-gray-200'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nivel:</span>
        <button onClick={() => setLevelFiltro(null)}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
            !levelFiltro ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          Todos ({todasSecciones.length})
        </button>
        {levels.map(l => {
          const count = todasSecciones.filter(s => s.nivel_nombre === l.nivel_nombre).length
          return (
            <button key={l.id} onClick={() => setLevelFiltro(l.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                levelFiltro === l.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {l.nivel_nombre} ({count})
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-indigo-400" />
          </div>
        ) : secciones.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Layers size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay secciones en este proyecto</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['ID Sección','Nivel','Sección','Avance','Último registro','Días sin avance',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {secciones.map(sec => {
                const pct = Number(sec.pct_actual ?? 0)
                const dias = sec.dias_sin_avance
                const alerta = dias > 3 && pct < 100
                return (
                  <tr key={sec.section_id} className={`hover:bg-gray-50 transition-colors ${sec._offline ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-indigo-500 font-semibold">{sec.section_code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{sec.nivel_nombre}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {sec.nombre}
                      {sec._offline && <span className="ml-2 text-xs text-amber-600 font-normal">📱 offline</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${pct >= 100 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {sec.ultimo_registro
                        ? new Date(sec.ultimo_registro).toLocaleDateString('es-MX', { day:'2-digit', month:'short' })
                        : <span className="text-gray-300">Sin registros</span>}
                    </td>
                    <td className="px-4 py-3">
                      {dias != null && pct < 100 ? (
                        <span className={`text-xs font-medium ${alerta ? 'text-red-600' : 'text-gray-500'}`}>
                          {alerta ? '⚠️ ' : ''}{dias}d
                        </span>
                      ) : pct >= 100 ? (
                        <span className="text-xs text-green-600 font-medium">✓ Completa</span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {pct < 100 && (
                        <button onClick={() => onRegistrar(sec)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                          <Plus size={11} />
                          {isOnline ? 'Avance' : '📱 Avance'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, valor, sub, color, icon: Icon, alert }) {
  const colors = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-500' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: 'text-blue-500'   },
    teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   icon: 'text-teal-500'   },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'text-amber-500'  },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: 'text-green-500'  },
  }
  const c = colors[color] ?? colors.indigo
  return (
    <div className={`p-4 rounded-xl border ${c.bg} ${c.border} ${alert ? 'ring-2 ring-amber-300' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>{label}</span>
        <Icon size={16} className={c.icon} />
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{valor}</p>
      <p className={`text-xs mt-0.5 ${c.text} opacity-70`}>{sub}</p>
    </div>
  )
}