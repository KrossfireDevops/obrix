// ============================================================
//  OBRIX ERP — Módulo: Gestión de Asistencia
//  src/pages/attendance/Attendance.jsx  |  v2.0
//
//  Cambios v2.0:
//    · Eliminado flujo de alta de personal (se gestiona en Gestión de Personal)
//    · Botón "Nuevo Personal" → "Asignar Personal a Obra"
//    · Modal de asignación carga personal activo de personal_expediente
//    · Botón "Desasignar" en tabla de Personal en Obra
//    · Se mantiene intacto el flujo de toma de asistencia e historial
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useOffline }       from '../../hooks/useOffline'
import SyncStatusBar        from '../../components/goldenring/SyncStatusBar'
import { MainLayout }       from '../../components/layout/MainLayout'
import { Card }             from '../../components/ui/Card'
import { Button }           from '../../components/ui/Button'
import { Modal }            from '../../components/ui/Modal'
import { useToast }         from '../../hooks/useToast'
import { ConfirmDialog }    from '../../components/ui/ConfirmDialog'
import { useAuth }          from '../../context/AuthContext'
import {
  Users, UserPlus, CheckCircle, XCircle,
  Search, Edit2, Trash2, Clock, FileText,
  UserMinus, RefreshCw, Building2,
} from 'lucide-react'
import * as attendanceService from '../../services/attendance.service'
import * as inventoryService  from '../../services/inventory.service'
import {
  getPersonal,
  TIPO_PERSONAL_CFG,
  ESQUEMA_PAGO_CFG,
} from '../../services/gestionPersonal.service'
import { asignarAProyecto } from '../../services/gestionPersonal.service'

// ─────────────────────────────────────────────────────────────
// MODAL: Asignar Personal a Obra
// ─────────────────────────────────────────────────────────────
const ModalAsignarPersonal = ({ isOpen, onClose, projects, onAsignar, toast }) => {
  const [catalogoPersonal, setCatalogoPersonal] = useState([])
  const [loading,          setLoading]          = useState(true)
  const [search,           setSearch]           = useState('')
  const [projectId,        setProjectId]        = useState('')
  const [seleccionados,    setSeleccionados]    = useState([])
  const [guardando,        setGuardando]        = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setSearch(''); setProjectId(''); setSeleccionados([])
    cargarCatalogo()
  }, [isOpen])

  const cargarCatalogo = async () => {
    setLoading(true)
    try {
      // Solo personal activo del catálogo de Gestión de Personal
      const data = await getPersonal({ estatus: 'activo' })
      setCatalogoPersonal(Array.isArray(data) ? data : (data?.data ?? []))
    } catch (e) {
      toast.error('Error al cargar el catálogo de personal: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleConfirmar = async () => {
    if (!projectId) { toast.error('Selecciona el proyecto destino'); return }
    if (!seleccionados.length) { toast.error('Selecciona al menos un trabajador'); return }
    setGuardando(true)
    try {
      await onAsignar(seleccionados, projectId)
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = catalogoPersonal.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.nombre_completo?.toLowerCase().includes(q) ||
      p.especialidad?.toLowerCase().includes(q) ||
      p.rfc?.toLowerCase().includes(q)
    )
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title="👷 Asignar Personal a Obra" size="lg">
      <div className="space-y-4">

        {/* Selector de proyecto */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
            Proyecto destino *
          </label>
          <select className="input-field" value={projectId}
            onChange={e => setProjectId(e.target.value)}>
            <option value="">— Seleccionar proyecto —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.code ? `[${p.code}]` : ''}</option>
            ))}
          </select>
        </div>

        {/* Buscador de personal */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input-field pl-10"
            placeholder="Buscar por nombre, especialidad, RFC..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Contador de selección */}
        {seleccionados.length > 0 && (
          <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700 font-medium">
            ✓ {seleccionados.length} trabajador{seleccionados.length !== 1 ? 'es' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Lista de personal */}
        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm">Cargando catálogo de personal…</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {search ? 'Sin resultados para esta búsqueda' : 'No hay personal activo registrado'}
              </p>
              {!search && (
                <p className="text-xs text-gray-300 mt-1">
                  Registra trabajadores en Gestión de Personal
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Trabajador</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Proyecto actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map(p => {
                  const sel     = seleccionados.includes(p.id)
                  const tipoCfg = TIPO_PERSONAL_CFG[p.tipo_personal] ?? TIPO_PERSONAL_CFG.temporal
                  return (
                    <tr key={p.id}
                      onClick={() => toggleSeleccion(p.id)}
                      className={`cursor-pointer transition-colors ${
                        sel ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'
                      }`}>
                      <td className="px-3 py-3 text-center">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center mx-auto transition-all ${
                          sel ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                        }`}>
                          {sel && <span className="text-white text-xs leading-none">✓</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900">{p.nombre_completo}</p>
                        <p className="text-xs text-gray-400">{p.especialidad ?? '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${tipoCfg.color}`}>
                          {tipoCfg.emoji} {tipoCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {p.projects
                          ? <span className="font-mono text-indigo-600">[{p.projects.code}]</span>
                          : <span className="text-gray-300 italic">Sin asignar</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirmar}
            disabled={guardando || !seleccionados.length || !projectId}>
            {guardando
              ? <><RefreshCw size={14} className="animate-spin mr-2" /> Asignando…</>
              : <><UserPlus className="w-4 h-4 mr-2" /> Confirmar asignación</>
            }
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export const Attendance = () => {
  const [activeTab,          setActiveTab]          = useState('take')
  const [loading,            setLoading]            = useState(false)
  const [personnel,          setPersonnel]          = useState([])
  const [attendance,         setAttendance]         = useState([])
  const [warehouses,         setWarehouses]         = useState([])
  const [projects,           setProjects]           = useState([])
  const [todayDate,          setTodayDate]          = useState(new Date().toISOString().split('T')[0])
  const [searchTerm,         setSearchTerm]         = useState('')
  const [selectedWarehouse,  setSelectedWarehouse]  = useState('')
  const [selectedProject,    setSelectedProject]    = useState('')
  const [modalAsignarOpen,   setModalAsignarOpen]   = useState(false)
  const [isConfirmOpen,      setIsConfirmOpen]      = useState(false)
  const [confirmAction,      setConfirmAction]      = useState(null)

  const { toast } = useToast()
  const { user }  = useAuth()

  const {
    isOnline,
    syncStatus,
    pendientes:  syncPendientes,
    conflictos:  syncConflictos,
    syncManual,
    registrarAsistenciaOffline,
    getPersonalCache,
  } = useOffline()

  useEffect(() => {
    loadProjects()
    loadWarehouses()
  }, [])

  useEffect(() => {
    loadPersonnel()
    if (activeTab === 'take') loadTodayAttendance()
  }, [activeTab, todayDate, selectedProject, searchTerm])

  const loadProjects = async () => {
    try {
      const { data, error } = await attendanceService.getProjects()
      if (error) throw error
      setProjects(data || [])
    } catch (e) {
      console.error('Error loading projects:', e)
    }
  }

  const loadWarehouses = async () => {
    try {
      const { data } = await inventoryService.getWarehouses()
      setWarehouses(data || [])
    } catch (e) {
      console.error('Error loading warehouses:', e)
    }
  }

  // Personal en obra: usa el servicio de attendance (tabla attendance.personnel)
  // que refleja las asignaciones activas del proyecto
  const loadPersonnel = async () => {
    setLoading(true)
    try {
      if (!isOnline && selectedProject) {
        // Sin conexión: usar caché local
        const cached = await getPersonalCache(selectedProject)
        if (cached.length) { setPersonnel(cached); setLoading(false); return }
      }
      const { data, error } = await attendanceService.getPersonnel({
        search:    searchTerm,
        isActive:  true,
        projectId: selectedProject || null,
      })
      if (error) throw error
      setPersonnel(data || [])
    } catch (e) {
      console.error('Error loading personnel:', e)
      if (isOnline) toast.error('Error al cargar personal')
      else toast.warning('⚠️ Sin conexión — mostrando último caché disponible')
    } finally {
      setLoading(false)
    }
  }

  const loadTodayAttendance = async () => {
    try {
      const { data, error } = await attendanceService.getAttendance({
        attendanceDate: todayDate,
        projectId:      selectedProject || null,
      })
      if (error) throw error
      setAttendance(data || [])
    } catch (e) {
      console.error('Error loading attendance:', e)
      toast.error('Error al cargar asistencia del día')
    }
  }

  // ── Tomar asistencia (Online + Offline) ──────────────────
  const handleRegisterAttendance = async (personnelId, status) => {
    const person = personnel.find(p => p.id === personnelId)
    if (!person) { toast.error('Personal no encontrado'); return }

    if (attendance.find(a => a.personnel_id === personnelId)) {
      toast.warning('⚠️ Ya se registró asistencia para esta persona hoy')
      return
    }

    const payload = {
      personnel_id:    personnelId,
      company_id:      person.company_id,
      project_id:      person.project_id,
      attendance_date: todayDate,
      status,
      warehouse_id:    selectedWarehouse || null,
    }

    setLoading(true)
    try {
      if (!isOnline) {
        // ── MODO OFFLINE ────────────────────────────────────
        await registrarAsistenciaOffline(payload)
        // Actualizar UI inmediatamente (Optimistic UI)
        setAttendance(prev => [...prev, {
          personnel_id: personnelId,
          status,
          attendance_date: todayDate,
          _offline: true,
        }])
        toast.success(
          status === 'ASISTENCIA'
            ? '📱 Asistencia guardada — se sincronizará al reconectar'
            : '📱 Falta guardada — se sincronizará al reconectar'
        )
        return
      }

      // ── MODO ONLINE (flujo normal) ───────────────────────
      const { error } = await attendanceService.registerAttendance(payload)
      if (error) throw error
      toast.success(status === 'ASISTENCIA'
        ? '✅ Asistencia registrada' : '❌ Falta registrada')
      loadTodayAttendance()
    } catch (e) {
      toast.error('Error al registrar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Asignar trabajadores a obra ──────────────────────────
  const handleAsignar = async (trabajadorIds, projectId) => {
    let exitosos = 0
    for (const id of trabajadorIds) {
      try {
        await asignarAProyecto({ trabajadorId: id, projectId })
        exitosos++
      } catch (e) {
        console.error(`Error asignando trabajador ${id}:`, e)
      }
    }
    if (exitosos > 0) {
      toast.success(
        `✅ ${exitosos} trabajador${exitosos !== 1 ? 'es' : ''} asignado${exitosos !== 1 ? 's' : ''} a la obra`
      )
      loadPersonnel()
    } else {
      toast.error('No se pudo asignar ningún trabajador')
    }
  }

  // ── Desasignar trabajador de obra ────────────────────────
  const handleDesasignar = (person) => {
    setConfirmAction(() => async () => {
      try {
        // Desasignar: limpiar project_id en personal_expediente
        // y cerrar asignación activa en personal_asignaciones
        await asignarAProyecto({
          trabajadorId: person.trabajador_id ?? person.id,
          projectId:    null,
        }).catch(() => null) // Si falla el cierre de asignación, continúa

        // También marcar como inactivo en la tabla de attendance.personnel si aplica
        if (person.id && attendanceService.deletePersonnel) {
          await attendanceService.deletePersonnel(person.id)
        }

        toast.success(`${person.first_names ?? person.nombre_completo} desasignado de la obra`)
        loadPersonnel()
      } catch (e) {
        toast.error('Error al desasignar: ' + e.message)
      }
      setIsConfirmOpen(false)
      setConfirmAction(null)
    })
    setIsConfirmOpen(true)
  }

  const getAttendanceStatus = (personnelId) =>
    attendance.find(a => a.personnel_id === personnelId)

  const filteredPersonnel = personnel.filter(p =>
    `${p.first_names} ${p.last_names}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total:       filteredPersonnel.length,
    registered:  attendance.length,
    pending:     filteredPersonnel.length - attendance.length,
    asistencias: attendance.filter(a => a.status === 'ASISTENCIA').length,
    faltas:      attendance.filter(a => a.status === 'FALTA').length,
  }

  return (
    <MainLayout title="📋 Gestión de Asistencia">
      <div className="space-y-6">

        {/* ── GoldenRing: Estado de sincronización ── */}
        <SyncStatusBar
          isOnline={isOnline}
          syncStatus={syncStatus}
          pendientes={syncPendientes}
          conflictos={syncConflictos}
          onSync={syncManual}
        />

        {/* ── Tabs ── */}
        <Card>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'take',       icon: Clock,     label: 'Tomar Asistencia'  },
              { id: 'personnel',  icon: Users,     label: 'Personal en Obra'  },
              { id: 'history',    icon: FileText,  label: 'Historial'         },
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              )
            })}
          </div>
        </Card>

        {/* ══════════════════════════════════════════════
            TAB: Tomar Asistencia
        ══════════════════════════════════════════════ */}
        {activeTab === 'take' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Total',       value: stats.total,       color: '' },
                { label: 'Registrados', value: stats.registered,  color: 'text-blue-600' },
                { label: 'Pendientes',  value: stats.pending,     color: 'text-yellow-600' },
                { label: 'Asistencias', value: stats.asistencias, color: 'text-green-600' },
                { label: 'Faltas',      value: stats.faltas,      color: 'text-red-600' },
              ].map(k => (
                <Card key={k.label} className="text-center">
                  <p className="text-sm text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </Card>
              ))}
            </div>

            {/* Filtros */}
            <Card>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="input-label">Fecha</label>
                  <input type="date" className="input-field" value={todayDate}
                    onChange={e => setTodayDate(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Proyecto</label>
                  <select className="input-field" value={selectedProject}
                    onChange={e => { setSelectedProject(e.target.value); loadPersonnel() }}>
                    <option value="">Todos los proyectos</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Almacén</label>
                  <select className="input-field" value={selectedWarehouse}
                    onChange={e => setSelectedWarehouse(e.target.value)}>
                    <option value="">Todos</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="input-label">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" className="input-field pl-10"
                      placeholder="Nombre, puesto o empresa..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabla de asistencia */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  📋 Personal en obra — {new Date(todayDate + 'T12:00:00').toLocaleDateString('es-MX')}
                </h3>
                <Button onClick={() => setModalAsignarOpen(true)} variant="primary">
                  <UserPlus className="w-4 h-4 mr-2" /> Asignar Personal a Obra
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                  <p className="text-gray-500 mt-2">Cargando…</p>
                </div>
              ) : filteredPersonnel.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-gray-500">No hay personal asignado a esta obra</p>
                  <p className="text-sm mt-1">Usa "Asignar Personal a Obra" para agregar trabajadores</p>
                  <Button onClick={() => setModalAsignarOpen(true)}
                    variant="primary" className="mt-4">
                    <UserPlus className="w-4 h-4 mr-2" /> Asignar Personal
                  </Button>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead className="table-header">
                      <tr>
                        <th className="table-cell-header">Nombre</th>
                        <th className="table-cell-header">Puesto</th>
                        <th className="table-cell-header">Empresa</th>
                        <th className="table-cell-header">Estado hoy</th>
                        <th className="table-cell-header text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPersonnel.map(person => {
                        const status = getAttendanceStatus(person.id)
                        return (
                          <tr key={person.id} className="table-row hover:bg-gray-50">
                            <td className="table-cell font-medium">
                              {person.first_names} {person.last_names}
                            </td>
                            <td className="table-cell">
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                {person.position}
                              </span>
                            </td>
                            <td className="table-cell text-gray-500">{person.company_name}</td>
                            <td className="table-cell">
                              {status ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  status.status === 'ASISTENCIA'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {status.status === 'ASISTENCIA' ? '✅' : '❌'} {status.status}
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                  ⏳ Pendiente
                                </span>
                              )}
                            </td>
                            <td className="table-cell text-center">
                              {status ? (
                                <span className="text-gray-400 text-sm">Registrado</span>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleRegisterAttendance(person.id, 'ASISTENCIA')}
                                    disabled={loading}
                                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50">
                                    ✅ Asistencia
                                  </button>
                                  <button
                                    onClick={() => handleRegisterAttendance(person.id, 'FALTA')}
                                    disabled={loading}
                                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                                    ❌ Falta
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Personal en Obra
        ══════════════════════════════════════════════ */}
        {activeTab === 'personnel' && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">👷 Personal asignado a obra</h3>
              <Button onClick={() => setModalAsignarOpen(true)} variant="primary">
                <UserPlus className="w-4 h-4 mr-2" /> Asignar Personal a Obra
              </Button>
            </div>

            {personnel.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">Sin personal asignado</p>
                <p className="text-sm mt-1">
                  El personal se gestiona en el módulo de Gestión de Personal
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-cell-header">Nombre</th>
                      <th className="table-cell-header">Puesto</th>
                      <th className="table-cell-header">Empresa</th>
                      <th className="table-cell-header">Proyecto</th>
                      <th className="table-cell-header text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {personnel.map(person => (
                      <tr key={person.id} className="table-row hover:bg-gray-50">
                        <td className="table-cell font-medium">
                          {person.first_names} {person.last_names}
                        </td>
                        <td className="table-cell">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            {person.position}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500">{person.company_name}</td>
                        <td className="table-cell text-gray-500">
                          {person.projects?.name
                            ? <span className="text-xs font-mono text-indigo-600 font-semibold">
                                [{person.projects.code}] {person.projects.name}
                              </span>
                            : <span className="text-gray-300 italic text-xs">Sin proyecto</span>
                          }
                        </td>
                        <td className="table-cell text-center">
                          <button
                            onClick={() => handleDesasignar(person)}
                            title="Desasignar de la obra"
                            className="flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                            <UserMinus className="w-3.5 h-3.5" /> Desasignar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Historial
        ══════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">📅 Historial de Asistencia</h3>
            <p className="text-gray-500 text-sm">
              Los registros completos están disponibles en el módulo de Reportes.
            </p>
            <div className="mt-4">
              <Button onClick={() => window.location.href = '/reports'} variant="secondary">
                <FileText className="w-4 h-4 mr-2" /> Ir a Reportes
              </Button>
            </div>
          </Card>
        )}

        {/* ── Modal: Asignar Personal a Obra ── */}
        <ModalAsignarPersonal
          isOpen={modalAsignarOpen}
          onClose={() => setModalAsignarOpen(false)}
          projects={projects}
          onAsignar={handleAsignar}
          toast={toast}
        />

        {/* ── Confirmar desasignación ── */}
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title="¿Desasignar de la obra?"
          message="El trabajador quedará sin proyecto asignado. Puedes reasignarlo en cualquier momento desde Gestión de Personal o desde aquí."
          confirmLabel="Desasignar"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={confirmAction}
          onCancel={() => { setIsConfirmOpen(false); setConfirmAction(null) }}
        />
      </div>
    </MainLayout>
  )
}