// ============================================================
//  OBRIX ERP — Página: Árbol de Proyecto (Reingeniería)
//  src/pages/projects/ProjectTree.jsx  |  v2.0
//
//  Estructura: Proyecto → Nivel → Sección
//  Flujo nuevo: sin NodeForm genérico
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'
import {
  ChevronRight, ChevronDown, Plus, Edit2, Trash2,
  CheckCircle, FolderOpen, Folder, Building2,
  Home, Factory, TrendingUp, AlertCircle,
  Layers, Grid, Copy, RefreshCw, MoreVertical,
  Paperclip, User, Clock, Shield,
} from 'lucide-react'
import * as projectsService from '../../services/projects.service'
import {
  getLevelsByProject, createLevel, updateLevel, deleteLevel,
  createSection, updateSection, deleteSection,
  updateProgress, validateSection, getProjectStats,
  replicarSecciones, CATALOGO_NIVELES,
} from '../../services/planeacionObra.service'
import { ToastContainer } from '../../components/ui/Toast'

// ── Configuraciones visuales ─────────────────────────────────

const STATUS_CFG = {
  PENDIENTE:   { label: 'Pendiente',   dot: 'bg-gray-400',  badge: 'bg-gray-100 text-gray-600'   },
  EN_PROGRESO: { label: 'En Progreso', dot: 'bg-blue-500',  badge: 'bg-blue-100 text-blue-700'   },
  COMPLETADO:  { label: 'Completado',  dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  BLOQUEADO:   { label: 'Bloqueado',   dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700'     },
  CANCELADO:   { label: 'Cancelado',   dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-400'   },
}

const PROJECT_ICON = { RESIDENCIAL: Home, EDIFICIO: Building2, INDUSTRIAL: Factory }

const progressColor = (p) => {
  if (p >= 100) return 'bg-green-500'
  if (p >= 60)  return 'bg-blue-500'
  if (p >= 30)  return 'bg-amber-500'
  return 'bg-gray-200'
}

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

export const ProjectTree = () => {
  const { toasts, toast, removeToast } = useToast()
  const { user } = useAuth()

  // ── Proyectos ─────────────────────────────────────────────
  const [projects,        setProjects]        = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [loadingProjects, setLoadingProjects] = useState(true)

  // ── Árbol de niveles/secciones ────────────────────────────
  const [levels,      setLevels]      = useState([])   // array de niveles con secciones anidadas
  const [loadingTree, setLoadingTree] = useState(false)
  const [stats,       setStats]       = useState(null)

  // ── Selección ─────────────────────────────────────────────
  const [selectedSection, setSelectedSection] = useState(null)
  const [expandedLevels,  setExpandedLevels]  = useState({}) // { levelId: bool }

  // ── Modales ───────────────────────────────────────────────
  const [addLevelModal,    setAddLevelModal]    = useState(false)
  const [addSectionModal,  setAddSectionModal]  = useState({ open: false, levelId: null, levelNum: null, levelNombre: '' })
  const [editSectionModal, setEditSectionModal] = useState({ open: false, section: null })
  const [editLevelModal,   setEditLevelModal]   = useState({ open: false, level: null })
  const [validateModal,    setValidateModal]    = useState({ open: false, section: null, notes: '' })
  const [replicarModal,    setReplicarModal]    = useState({ open: false, sourceLevelId: null })
  const [confirmDelete,    setConfirmDelete]    = useState({ open: false, type: null, target: null })

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const { data } = await projectsService.getProjects()
      setProjects(data ?? [])
      if (data?.length === 1) selectProject(data[0])
    } catch { toast.error('Error cargando proyectos') }
    finally { setLoadingProjects(false) }
  }

  const selectProject = useCallback(async (project) => {
    setSelectedProject(project)
    setSelectedSection(null)
    setLoadingTree(true)
    try {
      const [lvls, statsData] = await Promise.all([
        getLevelsByProject(project.id),
        getProjectStats(project.id),
      ])
      setLevels(lvls)
      setStats(statsData)
      // Expandir todos los niveles por defecto
      const exp = {}
      lvls.forEach(l => { exp[l.id] = true })
      setExpandedLevels(exp)
    } catch { toast.error('Error cargando árbol') }
    finally { setLoadingTree(false) }
  }, [])

  const reloadTree = async () => {
    if (!selectedProject) return
    try {
      const [lvls, statsData] = await Promise.all([
        getLevelsByProject(selectedProject.id),
        getProjectStats(selectedProject.id),
      ])
      setLevels(lvls)
      setStats(statsData)
      // Actualizar sección seleccionada
      if (selectedSection) {
        const updated = lvls
          .flatMap(l => l.project_sections ?? [])
          .find(s => s.id === selectedSection.id)
        setSelectedSection(updated ?? null)
      }
    } catch { toast.error('Error actualizando árbol') }
  }

  // ── Handlers: Niveles ─────────────────────────────────────

  const handleAddLevel = async (nivelNum, nivelNombre) => {
    try {
      await createLevel({
        projectId:   selectedProject.id,
        nivelNum,
        nivelNombre,
        sortOrder:   nivelNum + 1,
      })
      toast.success(`Nivel ${nivelNombre} agregado`)
      setAddLevelModal(false)
      await reloadTree()
      // Expandir el nuevo nivel
      const nuevo = levels.find(l => l.nivel_num === nivelNum)
      if (nuevo) setExpandedLevels(prev => ({ ...prev, [nuevo.id]: true }))
    } catch (e) { toast.error(e.message) }
  }

  const handleDeleteLevel = async () => {
    const level = confirmDelete.target
    try {
      await deleteLevel(level.id)
      toast.success(`Nivel ${level.nivel_nombre} eliminado`)
      setConfirmDelete({ open: false, type: null, target: null })
      if (selectedSection?.level_id === level.id) setSelectedSection(null)
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  // ── Handlers: Secciones ───────────────────────────────────

  const handleAddSection = async (nombre, responsable) => {
    const { levelId, levelNum, levelNombre } = addSectionModal
    try {
      await createSection({
        projectId:       selectedProject.id,
        levelId,
        nombre,
        responsibleName: responsable,
        nivelNum:        levelNum,
        projectCode:     selectedProject.code,
      })
      toast.success(`Sección agregada en ${levelNombre}`)
      setAddSectionModal({ open: false, levelId: null, levelNum: null, levelNombre: '' })
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  const handleEditSection = async (sectionId, changes) => {
    try {
      await updateSection(sectionId, changes)
      toast.success('Sección actualizada')
      setEditSectionModal({ open: false, section: null })
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  const handleDeleteSection = async () => {
    const sec = confirmDelete.target
    try {
      await deleteSection(sec.id)
      toast.success('Sección eliminada')
      setConfirmDelete({ open: false, type: null, target: null })
      if (selectedSection?.id === sec.id) setSelectedSection(null)
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  const handleProgressChange = async (sectionId, pct) => {
    try {
      await updateProgress(sectionId, pct)
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  const handleValidate = async () => {
    const { section, notes } = validateModal
    try {
      await validateSection(section.id, notes, user?.id)
      toast.success('Sección validada ✓')
      setValidateModal({ open: false, section: null, notes: '' })
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  const handleReplicar = async (targetLevelIds) => {
    try {
      await replicarSecciones(
        replicarModal.sourceLevelId,
        targetLevelIds,
        selectedProject.id,
        selectedProject.code,
      )
      toast.success('Secciones replicadas correctamente')
      setReplicarModal({ open: false, sourceLevelId: null })
      await reloadTree()
    } catch (e) { toast.error(e.message) }
  }

  // ── Niveles disponibles para agregar (los que aún no existen) ──
  const nivelesDisponibles = CATALOGO_NIVELES.filter(
    n => !levels.some(l => l.nivel_num === n.num)
  )

  const ProjectIcon = PROJECT_ICON[selectedProject?.project_type] ?? Building2

  // ── Render ────────────────────────────────────────────────
  return (
    <MainLayout title="🏗️ Árbol de Proyecto">
      <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>

        {/* ── Panel izquierdo: selector de proyectos ── */}
        <div className="w-64 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyectos</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingProjects ? (
              <div className="flex justify-center py-8">
                <RefreshCw size={18} className="animate-spin text-indigo-400" />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">
                No hay proyectos
              </p>
            ) : (
              projects.map(p => {
                const PIcon = PROJECT_ICON[p.project_type] ?? Building2
                const activo = selectedProject?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProject(p)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors mb-1 ${
                      activo
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <PIcon size={16} className={activo ? 'text-indigo-600' : 'text-gray-400'} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Panel central: árbol de niveles/secciones ── */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          {!selectedProject ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <FolderOpen size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Selecciona un proyecto</p>
            </div>
          ) : (
            <>
              {/* Header del árbol */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ProjectIcon size={18} className="text-indigo-500" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{selectedProject.name}</p>
                    <p className="text-xs text-gray-400">
                      {stats ? `${stats.total_niveles} nivel(es) · ${stats.total_secciones} secciones · ${Number(stats.progreso_global).toFixed(0)}% avance` : '…'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={reloadTree}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Actualizar"
                  >
                    <RefreshCw size={14} />
                  </button>
                  {nivelesDisponibles.length > 0 && (
                    <button
                      onClick={() => setAddLevelModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                    >
                      <Plus size={13} /> Agregar Nivel
                    </button>
                  )}
                </div>
              </div>

              {/* Árbol */}
              <div className="flex-1 overflow-y-auto p-3">
                {loadingTree ? (
                  <div className="flex justify-center py-12">
                    <RefreshCw size={20} className="animate-spin text-indigo-400" />
                  </div>
                ) : levels.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Layers size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm mb-2">Este proyecto no tiene niveles aún</p>
                    <button
                      onClick={() => setAddLevelModal(true)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      + Agregar primer nivel
                    </button>
                  </div>
                ) : (
                  levels.map(level => (
                    <NivelRow
                      key={level.id}
                      level={level}
                      expanded={expandedLevels[level.id] ?? false}
                      onToggle={() => setExpandedLevels(prev => ({ ...prev, [level.id]: !prev[level.id] }))}
                      selectedSectionId={selectedSection?.id}
                      onSelectSection={setSelectedSection}
                      onAddSection={() => setAddSectionModal({
                        open: true,
                        levelId:     level.id,
                        levelNum:    level.nivel_num,
                        levelNombre: level.nivel_nombre,
                      })}
                      onEditLevel={() => setEditLevelModal({ open: true, level })}
                      onDeleteLevel={() => setConfirmDelete({ open: true, type: 'level', target: level })}
                      onDeleteSection={(s) => setConfirmDelete({ open: true, type: 'section', target: s })}
                      onEditSection={(s) => setEditSectionModal({ open: true, section: s })}
                      onReplicar={() => setReplicarModal({ open: true, sourceLevelId: level.id })}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Panel derecho: detalle de sección ── */}
        <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!selectedSection ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
              <Grid size={36} className="mb-3 opacity-30" />
              <p className="text-xs text-center">Selecciona una sección para ver su detalle</p>
            </div>
          ) : (
            <SectionDetail
              section={selectedSection}
              onProgressChange={handleProgressChange}
              onEdit={() => setEditSectionModal({ open: true, section: selectedSection })}
              onValidate={() => setValidateModal({ open: true, section: selectedSection, notes: '' })}
            />
          )}
        </div>
      </div>

      {/* ═══ MODALES ═══ */}

      {/* Agregar Nivel */}
      {addLevelModal && (
        <ModalAgregarNivel
          disponibles={nivelesDisponibles}
          onAdd={handleAddLevel}
          onClose={() => setAddLevelModal(false)}
        />
      )}

      {/* Agregar Sección */}
      {addSectionModal.open && (
        <ModalAgregarSeccion
          levelNombre={addSectionModal.levelNombre}
          levelNum={addSectionModal.levelNum}
          projectCode={selectedProject?.code}
          sectionsCount={(levels.find(l => l.id === addSectionModal.levelId)?.project_sections ?? []).length}
          onAdd={handleAddSection}
          onClose={() => setAddSectionModal({ open: false, levelId: null, levelNum: null, levelNombre: '' })}
        />
      )}

      {/* Editar Sección */}
      {editSectionModal.open && (
        <ModalEditarSeccion
          section={editSectionModal.section}
          onSave={(changes) => handleEditSection(editSectionModal.section.id, changes)}
          onClose={() => setEditSectionModal({ open: false, section: null })}
        />
      )}

      {/* Validar */}
      {validateModal.open && (
        <ModalValidar
          section={validateModal.section}
          notes={validateModal.notes}
          onNotesChange={(n) => setValidateModal(v => ({ ...v, notes: n }))}
          onConfirm={handleValidate}
          onClose={() => setValidateModal({ open: false, section: null, notes: '' })}
        />
      )}

      {/* Replicar secciones */}
      {replicarModal.open && (
        <ModalReplicar
          levels={levels}
          sourceLevelId={replicarModal.sourceLevelId}
          onConfirm={handleReplicar}
          onClose={() => setReplicarModal({ open: false, sourceLevelId: null })}
        />
      )}

      {/* Confirmar eliminación */}
      {confirmDelete.open && (
        <ModalConfirmarEliminar
          type={confirmDelete.type}
          target={confirmDelete.target}
          onConfirm={confirmDelete.type === 'level' ? handleDeleteLevel : handleDeleteSection}
          onClose={() => setConfirmDelete({ open: false, type: null, target: null })}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </MainLayout>
  )
}

// ============================================================
//  SUB-COMPONENTES DEL ÁRBOL
// ============================================================

function NivelRow({
  level, expanded, onToggle,
  selectedSectionId, onSelectSection,
  onAddSection, onEditLevel, onDeleteLevel,
  onDeleteSection, onEditSection, onReplicar,
}) {
  const secciones = level.project_sections ?? []
  const statusCfg = STATUS_CFG[level.status] ?? STATUS_CFG.PENDIENTE

  return (
    <div className="mb-2">
      {/* Cabecera del nivel */}
      <div className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}>
        {/* Toggle */}
        <button onClick={(e) => { e.stopPropagation(); onToggle() }}
          className="w-5 h-5 flex items-center justify-center text-gray-400 shrink-0">
          {secciones.length > 0
            ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            : <span className="w-4" />
          }
        </button>

        {/* Icono nivel */}
        {expanded
          ? <FolderOpen size={16} className="text-amber-500 shrink-0" />
          : <Folder    size={16} className="text-amber-400 shrink-0" />
        }

        {/* Info nivel */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />
          <span className="font-semibold text-sm text-gray-800 truncate">
            {level.nivel_nombre}
          </span>
          <span className="text-xs text-gray-400">
            ({secciones.length} secciones)
          </span>
        </div>

        {/* Barra de progreso */}
        <div className="hidden group-hover:flex items-center gap-1.5 shrink-0">
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${progressColor(level.progress_pct)}`}
              style={{ width: `${level.progress_pct}%` }} />
          </div>
          <span className="text-xs text-gray-400 w-8">{Number(level.progress_pct).toFixed(0)}%</span>
        </div>

        {/* Acciones del nivel */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0"
          onClick={e => e.stopPropagation()}>
          <button onClick={onAddSection}
            className="p-1 rounded hover:bg-indigo-100 text-indigo-600" title="Agregar sección">
            <Plus size={13} />
          </button>
          <button onClick={onReplicar}
            className="p-1 rounded hover:bg-teal-100 text-teal-600" title="Replicar secciones">
            <Copy size={13} />
          </button>
          <button onClick={onEditLevel}
            className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Editar nivel">
            <Edit2 size={13} />
          </button>
          <button onClick={onDeleteLevel}
            className="p-1 rounded hover:bg-red-100 text-red-500" title="Eliminar nivel">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Secciones */}
      {expanded && (
        <div className="ml-8 border-l-2 border-gray-100 pl-3 space-y-0.5">
          {secciones.length === 0 ? (
            <button onClick={onAddSection}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              + Agregar primera sección
            </button>
          ) : (
            secciones.map(sec => (
              <SeccionRow
                key={sec.id}
                section={sec}
                isSelected={selectedSectionId === sec.id}
                onSelect={() => onSelectSection(sec)}
                onEdit={() => onEditSection(sec)}
                onDelete={() => onDeleteSection(sec)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SeccionRow({ section, isSelected, onSelect, onEdit, onDelete }) {
  const statusCfg = STATUS_CFG[section.status] ?? STATUS_CFG.PENDIENTE

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-indigo-400 shrink-0">{section.section_code}</span>
          {section.is_validated && (
            <CheckCircle size={11} className="text-green-500 shrink-0" />
          )}
        </div>
        <p className={`text-sm truncate ${isSelected ? 'font-semibold text-indigo-700' : 'text-gray-700'}`}>
          {section.nombre}
        </p>
      </div>

      {/* Mini progress */}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${progressColor(section.progress_pct)}`}
            style={{ width: `${section.progress_pct}%` }} />
        </div>
        <span className="text-xs text-gray-400">{Number(section.progress_pct).toFixed(0)}%</span>
      </div>

      {/* Acciones */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0"
        onClick={e => e.stopPropagation()}>
        <button onClick={onEdit}
          className="p-1 rounded hover:bg-blue-100 text-blue-500">
          <Edit2 size={12} />
        </button>
        <button onClick={onDelete}
          className="p-1 rounded hover:bg-red-100 text-red-500">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Panel de detalle de sección ──────────────────────────────

function SectionDetail({ section, onProgressChange, onEdit, onValidate }) {
  const [pct, setPct] = useState(Number(section.progress_pct))
  const statusCfg = STATUS_CFG[section.status] ?? STATUS_CFG.PENDIENTE

  useEffect(() => { setPct(Number(section.progress_pct)) }, [section])

  const handleBlur = () => {
    if (pct !== Number(section.progress_pct)) {
      onProgressChange(section.id, pct)
    }
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-indigo-400 mb-0.5">{section.section_code}</p>
          <h3 className="text-base font-bold text-gray-900 leading-tight">{section.nombre}</h3>
        </div>
        <button onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-2">
          <Edit2 size={14} />
        </button>
      </div>

      {/* Estado + validación */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${statusCfg.badge}`}>
          {statusCfg.label}
        </span>
        {section.is_validated ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle size={12} /> Validado
          </span>
        ) : (
          <button onClick={onValidate}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
            <Shield size={11} /> Validar
          </button>
        )}
      </div>

      {/* Progreso */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Avance</span>
          <input
            type="number" min={0} max={100} step={5}
            value={pct}
            onChange={e => setPct(Number(e.target.value))}
            onBlur={handleBlur}
            className="w-16 text-right text-sm font-bold text-indigo-600 border-0 focus:outline-none bg-transparent"
          />
          <span className="text-sm font-bold text-indigo-600">%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={pct}
          onChange={e => setPct(Number(e.target.value))}
          onMouseUp={handleBlur}
          onTouchEnd={handleBlur}
          className="w-full accent-indigo-600"
        />
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
          <div className={`h-full rounded-full transition-all ${progressColor(pct)}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Info adicional */}
      {section.responsible_name && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={14} className="text-gray-400" />
          {section.responsible_name}
        </div>
      )}
      {section.descripcion && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{section.descripcion}</p>
      )}
      {section.is_validated && section.validation_notes && (
        <div className="text-xs text-green-700 bg-green-50 rounded-lg p-2">
          <p className="font-semibold mb-0.5">Notas de validación:</p>
          <p>{section.validation_notes}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
//  MODALES
// ============================================================

function ModalBase({ title, onClose, children, maxW = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxW}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalAgregarNivel({ disponibles, onAdd, onClose }) {
  const [nivelNum, setNivelNum] = useState(disponibles[0]?.num ?? 0)

  const handleAdd = () => {
    const n = CATALOGO_NIVELES.find(c => c.num === nivelNum)
    if (n) onAdd(n.num, n.nombre)
  }

  return (
    <ModalBase title="➕ Agregar Nivel" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Selecciona el nivel</label>
          <div className="grid grid-cols-3 gap-2">
            {disponibles.map(n => (
              <button key={n.num} type="button"
                onClick={() => setNivelNum(n.num)}
                className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  nivelNum === n.num
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {n.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleAdd}
            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
            Agregar
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

function ModalAgregarSeccion({ levelNombre, levelNum, projectCode, sectionsCount, onAdd, onClose }) {
  const [nombre,      setNombre]      = useState('')
  const [responsable, setResponsable] = useState('')
  const previewCode = `${projectCode}-N${levelNum}-S${String(sectionsCount + 1).padStart(3, '0')}`

  return (
    <ModalBase title={`➕ Nueva Sección — ${levelNombre}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="px-3 py-2 bg-indigo-50 rounded-lg">
          <p className="text-xs text-indigo-600 font-mono font-semibold">ID: {previewCode}</p>
          <p className="text-xs text-indigo-500 mt-0.5">Se asignará automáticamente</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nombre de la sección * <span className="text-gray-400">(máx. 65 caracteres)</span>
          </label>
          <input
            autoFocus type="text" maxLength={65} value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nombre.trim() && onAdd(nombre, responsable)}
            placeholder="Ej: Cuarto Eléctrico, Lobby, Estacionamiento..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{nombre.length}/65</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
          <input type="text" value={responsable}
            onChange={e => setResponsable(e.target.value)}
            placeholder="Nombre del responsable (opcional)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => nombre.trim() && onAdd(nombre, responsable)}
            disabled={!nombre.trim()}
            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-40">
            Agregar Sección
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

function ModalEditarSeccion({ section, onSave, onClose }) {
  const [nombre,      setNombre]      = useState(section.nombre)
  const [responsable, setResponsable] = useState(section.responsible_name ?? '')
  const [descripcion, setDescripcion] = useState(section.descripcion ?? '')

  return (
    <ModalBase title="✏️ Editar Sección" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs font-mono text-indigo-500">{section.section_code}</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
          <input type="text" maxLength={65} value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
          <input type="text" value={responsable}
            onChange={e => setResponsable(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / Notas</label>
          <textarea rows={2} value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => nombre.trim() && onSave({ nombre, responsible_name: responsable, descripcion })}
            disabled={!nombre.trim()}
            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-40">
            Guardar
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

function ModalValidar({ section, notes, onNotesChange, onConfirm, onClose }) {
  return (
    <ModalBase title="✅ Validar Sección" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Validar: <span className="font-semibold">{section?.nombre}</span>
        </p>
        <p className="text-xs text-gray-400">{section?.section_code}</p>
        <textarea rows={3}
          placeholder="Notas de validación (opcional)..."
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
            Confirmar Validación
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

function ModalReplicar({ levels, sourceLevelId, onConfirm, onClose }) {
  const [seleccionados, setSeleccionados] = useState([])
  const sourceLevel = levels.find(l => l.id === sourceLevelId)
  const targetLevels = levels.filter(l => l.id !== sourceLevelId)

  const toggle = (id) => setSeleccionados(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
  )

  return (
    <ModalBase title="📋 Replicar Secciones" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Copiar secciones de <strong>{sourceLevel?.nivel_nombre}</strong> a:
        </p>
        <div className="space-y-2">
          {targetLevels.map(l => (
            <label key={l.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={seleccionados.includes(l.id)}
                onChange={() => toggle(l.id)} className="rounded" />
              <span className="text-sm text-gray-700">{l.nivel_nombre}</span>
              <span className="text-xs text-gray-400">
                ({(l.project_sections ?? []).length} secciones actuales)
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
          ⚠️ Las secciones existentes en los niveles seleccionados no se borrarán — se agregarán las nuevas.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => seleccionados.length && onConfirm(seleccionados)}
            disabled={!seleccionados.length}
            className="px-5 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-40">
            Replicar ({seleccionados.length} nivel{seleccionados.length !== 1 ? 'es' : ''})
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

function ModalConfirmarEliminar({ type, target, onConfirm, onClose }) {
  return (
    <ModalBase title="⚠️ Confirmar eliminación" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">¿Eliminar este elemento?</p>
            <p className="text-sm text-gray-600 mt-0.5">
              <strong>{target?.nivel_nombre ?? target?.nombre}</strong>
              {type === 'level' && ' y todas sus secciones'}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400">Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
            Eliminar
          </button>
        </div>
      </div>
    </ModalBase>
  )
}