import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ToastContainer } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { ProjectForm } from './ProjectForm'
import ProjectWizard   from './ProjectWizard'
import { WarehouseForm } from './WarehouseForm'
import { CompleteProjectDialog } from './CompleteProjectDialog'
import CierreProyectoWizard from './CierreProyectoWizard'
import * as projectsService from '../../services/projects.service'
import {
  Plus, Edit2, Trash2, CheckCircle, RotateCcw,
  ChevronDown, ChevronRight, Package, FolderOpen,
  Building2, Clock, XCircle, PauseCircle, Lock,
} from 'lucide-react'

// ── Configuración visual por estado ──
const statusConfig = {
  active:    { label: 'Activo',     color: '#dcfce7', text: '#166534', icon: '🟢' },
  on_hold:   { label: 'En Pausa',   color: '#fef9c3', text: '#854d0e', icon: '🟡' },
  completed: { label: 'Terminado',  color: '#dbeafe', text: '#1e40af', icon: '✅' },
  cancelled: { label: 'Cancelado',  color: '#fee2e2', text: '#991b1b', icon: '❌' },
}

const warehouseTypeConfig = {
  general:  { label: 'General',  color: '#ede9fe', text: '#5b21b6' },
  project:  { label: 'Proyecto', color: '#dbeafe', text: '#1e40af' },
  temporal: { label: 'Temporal', color: '#fef9c3', text: '#854d0e' },
}

// ── Badge de estado ──
const StatusBadge = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.active
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '9999px', fontSize: '12px',
      fontWeight: '600', backgroundColor: cfg.color, color: cfg.text
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export const ProjectsPage = () => {
  const { toasts, toast, removeToast } = useToast()

  const [projects, setProjects]       = useState([])
  const [warehouses, setWarehouses]   = useState([])
  const [stats, setStats]             = useState({ total: 0, activos: 0, terminados: 0, cancelados: 0 })
  const [loading, setLoading]         = useState(true)
  const [expandedProject, setExpandedProject] = useState(null)
  const [activeTab, setActiveTab]     = useState('projects') // 'projects' | 'warehouses'

  // ── Modales ──
  const [projectModal, setProjectModal]   = useState({ open: false, data: null })
  const [warehouseModal, setWarehouseModal] = useState({ open: false, data: null })
  const [completeDialog, setCompleteDialog] = useState({ open: false, project: null })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, type: '', id: null })
  const [cierreModal, setCierreModal]     = useState({ open: false, project: null })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [{ data: proj }, { data: ware }, statsData] = await Promise.all([
        projectsService.getProjects(),
        projectsService.getWarehouses(),
        projectsService.getProjectsStats()
      ])
      setProjects(proj || [])
      setWarehouses(ware || [])
      setStats(statsData)
    } catch (err) {
      toast.error('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  // ── Proyecto handlers ──
  const handleProjectSaved = (ok, errMsg) => {
    setProjectModal({ open: false, data: null })
    if (ok) { toast.success('Proyecto guardado correctamente'); loadAll() }
    else if (errMsg) toast.error(errMsg)
  }

  const handleCompleteProject = async (id, notes) => {
    try {
      await projectsService.completeProject(id, notes)
      setCompleteDialog({ open: false, project: null })
      toast.success('Obra terminada y almacenes desactivados')
      loadAll()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleReactivate = async (id) => {
    try {
      await projectsService.reactivateProject(id)
      toast.success('Proyecto reactivado')
      loadAll()
    } catch (err) {
      toast.error('No se pudo reactivar el proyecto')
    }
  }

  const handleDeleteProject = async () => {
    try {
      await projectsService.deleteProject(confirmDelete.id)
      setConfirmDelete({ open: false, type: '', id: null })
      toast.success('Proyecto eliminado')
      loadAll()
    } catch (err) {
      setConfirmDelete({ open: false, type: '', id: null })
      toast.error(err.message)
    }
  }

  // ── Almacén handlers ──
  const handleWarehouseSaved = (ok, errMsg) => {
    setWarehouseModal({ open: false, data: null })
    if (ok) { toast.success('Almacén guardado correctamente'); loadAll() }
    else if (errMsg) toast.error(errMsg)
  }

  const handleDeleteWarehouse = async () => {
    try {
      await projectsService.deleteWarehouse(confirmDelete.id)
      setConfirmDelete({ open: false, type: '', id: null })
      toast.success('Almacén desactivado')
      loadAll()
    } catch (err) {
      setConfirmDelete({ open: false, type: '', id: null })
      toast.error(err.message)
    }
  }

  const handleConfirmDelete = () => {
    if (confirmDelete.type === 'project')   handleDeleteProject()
    if (confirmDelete.type === 'warehouse') handleDeleteWarehouse()
  }

  // ── Almacenes de un proyecto ──
  const warehousesOfProject = (projectId) =>
    warehouses.filter(w => w.project_id === projectId)

  const generalWarehouses = warehouses.filter(w => !w.project_id)

  return (
    <MainLayout title="🏗️ Proyectos y Almacenes">
      <div className="space-y-6">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Proyectos', value: stats.total,      color: '#2563eb', bg: '#dbeafe', icon: <FolderOpen size={22} /> },
            { label: 'Activos',         value: stats.activos,    color: '#16a34a', bg: '#dcfce7', icon: <Building2 size={22} /> },
            { label: 'Terminados',      value: stats.terminados, color: '#1d4ed8', bg: '#dbeafe', icon: <CheckCircle size={22} /> },
            { label: 'Cancelados',      value: stats.cancelados, color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={22} /> },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>{s.label}</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: s.color, margin: 0 }}>{s.value}</p>
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                  {s.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[
            { key: 'projects',   label: '🏗️ Proyectos' },
            { key: 'warehouses', label: '🏭 Almacenes'  },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 20px', borderRadius: '10px', border: 'none',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                backgroundColor: activeTab === tab.key ? '#ffffff' : 'transparent',
                color: activeTab === tab.key ? '#1d4ed8' : '#6b7280',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB: PROYECTOS
        ══════════════════════════════════════════ */}
        {activeTab === 'projects' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Proyectos Registrados <span style={{ color: '#9ca3af', fontWeight: '400' }}>({projects.length})</span>
              </h3>
              <Button variant="primary" onClick={() => setProjectModal({ open: true, data: null })}>
                <Plus className="w-4 h-4 mr-2" /> Nuevo Proyecto
              </Button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando proyectos...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><FolderOpen size={28} className="text-gray-400" /></div>
                <p className="empty-state-title">No hay proyectos registrados</p>
                <p className="empty-state-description">Crea tu primer proyecto para comenzar</p>
                <Button variant="primary" className="mt-4" onClick={() => setProjectModal({ open: true, data: null })}>
                  <Plus className="w-4 h-4 mr-2" /> Nuevo Proyecto
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {projects.map(project => {
                  const isExpanded = expandedProject === project.id
                  const pWarehouses = warehousesOfProject(project.id)
                  const cfg = statusConfig[project.status] || statusConfig.active

                  return (
                    <div key={project.id} style={{
                      border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden',
                      borderLeft: `4px solid ${cfg.text}`
                    }}>
                      {/* Fila del proyecto */}
                      <div style={{
                        display: 'flex', alignItems: 'center', padding: '14px 16px',
                        backgroundColor: '#fafafa', gap: '12px', flexWrap: 'wrap'
                      }}>
                        {/* Expandir */}
                        <button
                          onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', flexShrink: 0 }}
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        {/* Código */}
                        <span style={{
                          fontWeight: '700', fontSize: '15px', color: '#1d4ed8',
                          backgroundColor: '#dbeafe', padding: '3px 10px', borderRadius: '8px',
                          flexShrink: 0, fontFamily: 'monospace'
                        }}>
                          {project.code}
                        </span>

                        {/* Nombre */}
                        <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827', flex: 1, minWidth: '150px' }}>
                          {project.name}
                        </span>

                        {/* Info secundaria */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <StatusBadge status={project.status} />

                          {pWarehouses.length > 0 && (
                            <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Package size={13} /> {pWarehouses.length} almacén{pWarehouses.length !== 1 ? 'es' : ''}
                            </span>
                          )}

                          {project.end_date && (
                            <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={13} /> {new Date(project.end_date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          {/* Indicador de proyecto bloqueado */}
                          {project.is_locked && (
                            <span
                              style={{ padding: '6px', color: '#991b1b', display: 'flex', alignItems: 'center' }}
                              title="Proyecto cerrado y bloqueado"
                            >
                              <Lock size={15} />
                            </span>
                          )}

                          <button onClick={() => setProjectModal({ open: true, data: project })}
                            style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                            title="Editar"
                          ><Edit2 size={15} /></button>

                          {project.status === 'active' && (
                            <button onClick={() => setCompleteDialog({ open: true, project })}
                              style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#16a34a' }}
                              title="Terminar obra"
                            ><CheckCircle size={15} /></button>
                          )}

                          {/* Botón Cierre Formal — visible en activos y completados no bloqueados */}
                          {['active', 'completed'].includes(project.status) && !project.is_locked && (
                            <button
                              onClick={() => setCierreModal({ open: true, project })}
                              style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#7c3aed' }}
                              title="Proceso de cierre formal"
                            >
                              <Lock size={15} />
                            </button>
                          )}

                          {(project.status === 'completed' || project.status === 'cancelled') && (
                            <button onClick={() => handleReactivate(project.id)}
                              style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#2563eb' }}
                              title="Reactivar"
                            ><RotateCcw size={15} /></button>
                          )}

                          <button onClick={() => setConfirmDelete({ open: true, type: 'project', id: project.id })}
                            style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#dc2626' }}
                            title="Eliminar"
                          ><Trash2 size={15} /></button>
                        </div>
                      </div>

                      {/* Detalle expandido */}
                      {isExpanded && (
                        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
                          {/* Info del proyecto */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            {project.description && (
                              <div><p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', margin: '0 0 2px', textTransform: 'uppercase' }}>Descripción</p>
                                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{project.description}</p></div>
                            )}
                            {project.address && (
                              <div><p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', margin: '0 0 2px', textTransform: 'uppercase' }}>Ubicación</p>
                                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{project.address}</p></div>
                            )}
                            {project.budget && (
                              <div><p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', margin: '0 0 2px', textTransform: 'uppercase' }}>Presupuesto</p>
                                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                                  ${parseFloat(project.budget).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                                </p></div>
                            )}
                            {project.completion_date && (
                              <div><p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', margin: '0 0 2px', textTransform: 'uppercase' }}>Fecha de Término</p>
                                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                                  {new Date(project.completion_date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p></div>
                            )}
                            {project.closing_notes && (
                              <div><p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', margin: '0 0 2px', textTransform: 'uppercase' }}>Notas de Cierre</p>
                                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>{project.closing_notes}</p></div>
                            )}
                          </div>

                          {/* Almacenes del proyecto */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0 }}>
                              🏭 Almacenes asignados ({pWarehouses.length})
                            </p>
                            {project.status === 'active' && (
                              <button
                                onClick={() => setWarehouseModal({ open: true, data: { project_id: project.id } })}
                                style={{
                                  fontSize: '12px', color: '#2563eb', background: 'none', border: '1px solid #bfdbfe',
                                  borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <Plus size={12} /> Agregar Almacén
                              </button>
                            )}
                          </div>

                          {pWarehouses.length === 0 ? (
                            <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
                              Sin almacenes asignados.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {pWarehouses.map(w => {
                                const wCfg = warehouseTypeConfig[w.type] || warehouseTypeConfig.general
                                return (
                                  <div key={w.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 12px', borderRadius: '10px',
                                    backgroundColor: w.is_active ? '#f9fafb' : '#fef2f2',
                                    border: `1px solid ${w.is_active ? '#e5e7eb' : '#fecaca'}`,
                                  }}>
                                    <Package size={14} style={{ color: '#6b7280' }} />
                                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{w.name}</span>
                                    <span style={{ fontSize: '11px', backgroundColor: wCfg.color, color: wCfg.text, padding: '1px 7px', borderRadius: '9999px', fontWeight: '600' }}>
                                      {wCfg.label}
                                    </span>
                                    {!w.is_active && (
                                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>Inactivo</span>
                                    )}
                                    <button
                                      onClick={() => setWarehouseModal({ open: true, data: w })}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}
                                    ><Edit2 size={12} /></button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ══════════════════════════════════════════
            TAB: ALMACENES
        ══════════════════════════════════════════ */}
        {activeTab === 'warehouses' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Todos los Almacenes <span style={{ color: '#9ca3af', fontWeight: '400' }}>({warehouses.length})</span>
              </h3>
              <Button variant="primary" onClick={() => setWarehouseModal({ open: true, data: null })}>
                <Plus className="w-4 h-4 mr-2" /> Nuevo Almacén
              </Button>
            </div>

            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell-header">Nombre</th>
                    <th className="table-cell-header">Código</th>
                    <th className="table-cell-header">Tipo</th>
                    <th className="table-cell-header">Proyecto</th>
                    <th className="table-cell-header">Responsable</th>
                    <th className="table-cell-header">Estado</th>
                    <th className="table-cell-header text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan="7" className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <span className="ml-3 text-gray-500">Cargando almacenes...</span>
                      </div>
                    </td></tr>
                  ) : warehouses.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center">
                      <p className="text-gray-500">No hay almacenes registrados.</p>
                    </td></tr>
                  ) : (
                    warehouses.map(w => {
                      const wCfg = warehouseTypeConfig[w.type] || warehouseTypeConfig.general
                      return (
                        <tr key={w.id} className="table-row" style={{ opacity: w.is_active ? 1 : 0.5 }}>
                          <td className="table-cell font-medium text-gray-900">{w.name}</td>
                          <td className="table-cell text-gray-500 font-mono">{w.code || '—'}</td>
                          <td className="table-cell">
                            <span style={{ backgroundColor: wCfg.color, color: wCfg.text, padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>
                              {wCfg.label}
                            </span>
                          </td>
                          <td className="table-cell text-gray-600 text-sm">
                            {w.projects ? (
                              <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#1d4ed8' }}>
                                [{w.projects.code}]
                              </span>
                            ) : null}
                            {' '}{w.projects?.name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>General</span>}
                          </td>
                          <td className="table-cell text-gray-500 text-sm">{w.responsible || '—'}</td>
                          <td className="table-cell">
                            <span style={{
                              padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600',
                              backgroundColor: w.is_active ? '#dcfce7' : '#fee2e2',
                              color: w.is_active ? '#166534' : '#991b1b'
                            }}>
                              {w.is_active ? '✅ Activo' : '❌ Inactivo'}
                            </span>
                          </td>
                          <td className="table-cell text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setWarehouseModal({ open: true, data: w })}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setConfirmDelete({ open: true, type: 'warehouse', id: w.id })}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>

      {/* ── Modal: Nuevo Proyecto — Wizard 5 pasos ── */}
      <Modal isOpen={projectModal.open && !projectModal.data?.id}
        onClose={() => setProjectModal({ open: false, data: null })}
        title="Nuevo Proyecto" size="lg">
        <ProjectWizard
          onSuccess={(proyecto) => {
            setProjectModal({ open: false, data: null })
            toast.success(`Proyecto ${proyecto.code} creado correctamente`)
            loadAll()
          }}
          onCancel={() => setProjectModal({ open: false, data: null })}
        />
      </Modal>

      {/* ── Modal: Editar Proyecto — formulario simple ── */}
      <Modal isOpen={projectModal.open && !!projectModal.data?.id}
        onClose={() => setProjectModal({ open: false, data: null })}
        title={`Editar Proyecto [${projectModal.data?.code ?? ''}]`} size="lg">
        <ProjectForm
          project={projectModal.data}
          onClose={handleProjectSaved}
        />
      </Modal>

      <Modal isOpen={warehouseModal.open} onClose={() => setWarehouseModal({ open: false, data: null })}
        title={warehouseModal.data?.id ? 'Editar Almacén' : 'Nuevo Almacén'} size="lg">
        <WarehouseForm
          warehouse={warehouseModal.data}
          projects={projects}
          onClose={handleWarehouseSaved}
        />
      </Modal>

      <CompleteProjectDialog
        isOpen={completeDialog.open}
        project={completeDialog.project}
        onConfirm={handleCompleteProject}
        onCancel={() => setCompleteDialog({ open: false, project: null })}
      />

      <ConfirmDialog
        isOpen={confirmDelete.open}
        title={confirmDelete.type === 'project' ? 'Eliminar Proyecto' : 'Desactivar Almacén'}
        message={confirmDelete.type === 'project'
          ? 'El proyecto será marcado como inactivo. El historial se conservará.'
          : 'El almacén será desactivado. Solo es posible si no tiene inventario activo.'}
        confirmLabel="Confirmar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ open: false, type: '', id: null })}
      />

      {/* ── Modal: Cierre Formal del Proyecto ── */}
      {cierreModal.open && cierreModal.project && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Lock size={18} className="text-purple-600" />
                  Cierre Formal de Obra
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  [{cierreModal.project.code}] {cierreModal.project.name}
                </p>
              </div>
              <button
                onClick={() => setCierreModal({ open: false, project: null })}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >✕</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <CierreProyectoWizard
                proyecto={cierreModal.project}
                onClose={() => setCierreModal({ open: false, project: null })}
                onCerrado={() => {
                  setCierreModal({ open: false, project: null })
                  toast.success('🔒 Proyecto cerrado y bloqueado oficialmente')
                  loadAll()
                }}
                toast={toast}
              />
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </MainLayout>
  )
}