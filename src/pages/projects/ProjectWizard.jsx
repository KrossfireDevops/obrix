// ============================================================
//  OBRIX ERP — Componente: ProjectWizard
//  src/pages/projects/ProjectWizard.jsx  |  v2.2
//
//  Cambios v2.2:
//    - FIX: Los nodos eliminados en la preview (Paso 5)
//      ahora se respetan al guardar el proyecto.
//      Flujo corregido:
//        1. Clonar WBS completo desde plantilla
//        2. Soft-delete de nodos marcados como eliminados
//           usando template_nodo_id (sistema) o nombre (empresa)
//    - FIX: DISC_ICONS usa 'VOZ/DATOS' en lugar de 'VOZDATOS'
//      para coincidir con el código real en BD
//    - Import: agrega eliminarNodosWbsPorTemplateIds y flattenTree
//
//  Paso 1: Datos del proyecto (Responsable = OPCIONAL)
//  Paso 2: Niveles
//  Paso 3: Secciones
//  Paso 4: Motor de Plantillas WBS
//  Paso 5: Vista Previa + Confirmar
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight, ChevronLeft, CheckCircle, Plus, Trash2,
  Building2, Home, Factory, Layers, Grid, Copy,
  Zap, Droplets, Flame, Wind, Wifi, Cpu, Sun,
  BatteryCharging, ChevronDown, ChevronUp, BookTemplate,
  Sparkles, AlertCircle, Clock, LayoutTemplate,
} from 'lucide-react'
import * as projectsService from '../../services/projects.service'
import {
  createLevelesBatch, createSectionsBatch, CATALOGO_NIVELES,
} from '../../services/planeacionObra.service'
import {
  getDisciplinas, getSubdisciplinas, getPlantillasDisponibles,
  previewNodosSistema, clonarWbsDesdeSistema, clonarWbsDesdeEmpresa,
  // ── FIX v2.2: nueva función para respetar nodos eliminados ──
  eliminarNodosWbsPorTemplateIds,
  // ── FIX v2.2: flattenTree para extraer nodos del árbol preview ──
  flattenTree,
} from '../../services/wbsPlantillas.service'
import { supabase } from '../../config/supabase'
import { useAuth } from '../../context/AuthContext'  // ← FIX v2.3
import ResponsableSelector from '../../components/shared/ResponsableSelector'
import { cambiarResponsable } from '../../services/cierreProyecto.service'

// ── Tipos de proyecto ────────────────────────────────────────
// project_type → mayúsculas (constraint projects_project_type_check)
// tipo_estructura → minúsculas mapeadas (constraint projects_tipo_estructura_check)
const PROJECT_TYPES = [
  { value: 'EDIFICIO',    tipoEstructura: 'edificio',        label: 'Edificio',    icon: Building2, desc: 'Torre, depto, oficinas'  },
  { value: 'RESIDENCIAL', tipoEstructura: 'casa_habitacion', label: 'Residencial', icon: Home,      desc: 'Casa, villa, residencia' },
  { value: 'INDUSTRIAL',  tipoEstructura: 'nave_industrial', label: 'Industrial',  icon: Factory,   desc: 'Nave, planta, almacén'   },
]

// ── Icono por código de disciplina ───────────────────────────
// FIX v2.2: 'VOZ/DATOS' corregido (antes era 'VOZDATOS' que no coincidía con BD)
const DISC_ICONS = {
  CIVIL:      Building2,
  ELECT:      Zap,
  HIDRO:      Droplets,
  GAS:        Flame,
  HVAC:       Wind,
  'VOZ/DATOS':Wifi,       // ← FIX: código real en BD es 'VOZ/DATOS'
  DOMOTICA:   Cpu,
  FOTOVOLT:   Sun,
  PLUZ:       BatteryCharging,
}

// ── Pasos del wizard ─────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Datos'       },
  { num: 2, label: 'Niveles'     },
  { num: 3, label: 'Secciones'   },
  { num: 4, label: 'Disciplinas' },
  { num: 5, label: 'Confirmar'   },
]

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

export default function ProjectWizard({ onSuccess, onCancel }) {
  // FIX v2.3: leer companyId desde AuthContext directamente.
  // Antes se obtenía con un useEffect + query asíncrona que podía
  // no haber terminado cuando el usuario llegaba al Paso 5,
  // causando que companyId fuera null al hacer el insert.
  const { userProfile } = useAuth()
  const companyId = userProfile?.company_id ?? null

  const [paso,   setPaso]   = useState(1)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  // ── Paso 1 ────────────────────────────────────────────────
  const [formProyecto, setFormProyecto] = useState({
    project_type:   'EDIFICIO',
    code:           '',
    name:           '',
    description:    '',
    address:        '',
    start_date:     '',
    end_date:       '',
    budget:         '',
    responsable_id: '',
  })

  // ── Paso 2 ────────────────────────────────────────────────
  const [nivelesSeleccionados, setNivelesSeleccionados] = useState([])

  // ── Paso 3 ────────────────────────────────────────────────
  const [seccionesPorNivel, setSeccionesPorNivel] = useState({})
  const [nivelActivoStep3,  setNivelActivoStep3]  = useState(null)

  // ── Paso 4 ────────────────────────────────────────────────
  const [disciplinas,    setDisciplinas]    = useState([])
  const [subdisciplinas, setSubdisciplinas] = useState({})
  const [plantillasDisp, setPlantillasDisp] = useState([])
  const [discActivas,    setDiscActivas]    = useState({})
  const [subActivas,     setSubActivas]     = useState({})
  const [voltajeElegido, setVoltajeElegido] = useState('TRIF')
  const [gasElegido,     setGasElegido]     = useState('LP')
  const [numNiveles,     setNumNiveles]     = useState(nivelesSeleccionados.length || 1)
  const [m2,             setM2]             = useState(150)
  const [plantillaFuente,setPlantillaFuente]= useState('sistema')
  const [loadingDisc,    setLoadingDisc]    = useState(false)

  // ── Paso 5 ────────────────────────────────────────────────
  const [wbsPreview,     setWbsPreview]     = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [wbsEliminados,  setWbsEliminados]  = useState(new Set())
  const [wbsExpandidos,  setWbsExpandidos]  = useState(new Set())

  useEffect(() => {
    if (nivelesSeleccionados.length > 0) setNumNiveles(nivelesSeleccionados.length)
  }, [nivelesSeleccionados])

  useEffect(() => {
    if (paso !== 4 || !companyId) return
    setLoadingDisc(true)
    Promise.all([
      getDisciplinas(),
      getSubdisciplinas(),
      getPlantillasDisponibles(companyId),
    ]).then(([discs, subs, plants]) => {
      setDisciplinas(discs)
      setSubdisciplinas(subs)
      setPlantillasDisp(plants)
      const civilId = discs.find(d => d.codigo === 'CIVIL')?.id
      if (civilId) setDiscActivas({ [civilId]: true })
    }).catch(e => setError(e.message)).finally(() => setLoadingDisc(false))
  }, [paso, companyId])

  useEffect(() => {
    if (paso !== 5) return
    generarPreview()
  }, [paso])

  const generarPreview = useCallback(async () => {
    setLoadingPreview(true)
    setError(null)
    try {
      if (plantillaFuente === 'sistema') {
        const codigos = disciplinas
          .filter(d => discActivas[d.id])
          .map(d => d.codigo)
        if (!codigos.length) { setWbsPreview([]); return }
        const tree = await previewNodosSistema(codigos, numNiveles, m2)
        setWbsPreview(tree)
        setWbsExpandidos(new Set(tree.map(n => n.id)))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingPreview(false)
    }
  }, [disciplinas, discActivas, numNiveles, m2, plantillaFuente])

  // ── Navegación ────────────────────────────────────────────
  const irA = (num) => { setError(null); setPaso(num) }

  const validarPaso = () => {
    if (paso === 1) {
      if (!formProyecto.code.trim()) return 'El código del proyecto es obligatorio.'
      if (!formProyecto.name.trim()) return 'El nombre del proyecto es obligatorio.'
    }
    if (paso === 2 && nivelesSeleccionados.length === 0) {
      return 'Selecciona al menos un nivel.'
    }
    if (paso === 4) {
      const algunaActiva = Object.values(discActivas).some(Boolean)
      if (!algunaActiva) return 'Activa al menos una disciplina para generar el árbol de obra.'
    }
    return null
  }

  const handleSiguiente = () => {
    const err = validarPaso()
    if (err) { setError(err); return }

    if (paso === 1 || paso === 2) {
      const init = {}
      nivelesSeleccionados.forEach(n => { if (!seccionesPorNivel[n.num]) init[n.num] = [] })
      setSeccionesPorNivel(prev => ({ ...prev, ...init }))
      if (nivelesSeleccionados.length > 0) setNivelActivoStep3(nivelesSeleccionados[0].num)
    }
    irA(paso + 1)
  }

  // ── Guardar todo ──────────────────────────────────────────
  const handleGuardar = async () => {
    setSaving(true); setError(null)
    try {
      const cid = companyId

      // FIX v2.3: validación explícita antes de cualquier operación
      if (!cid) {
        throw new Error('No se pudo determinar la empresa del usuario. Recarga la página e intenta de nuevo.')
      }

      const disciplinasActivas = disciplinas
        .filter(d => discActivas[d.id])
        .map(d => d.codigo)

      const subdisciplinasActivas = Object.entries(subActivas)
        .filter(([, v]) => v)
        .map(([k]) => k)

      const electActiva = disciplinas.find(d => d.codigo === 'ELECT' && discActivas[d.id])
      if (electActiva && voltajeElegido) subdisciplinasActivas.push(`ELECT_${voltajeElegido}`)

      const gasActiva = disciplinas.find(d => d.codigo === 'GAS' && discActivas[d.id])
      if (gasActiva && gasElegido) subdisciplinasActivas.push(`GAS_${gasElegido}`)

      // 1. Crear proyecto
      const { data: proyecto, error: proyectoError } = await projectsService.createProject({
        ...formProyecto,
        company_id:             cid,
        budget:                 formProyecto.budget ? parseFloat(formProyecto.budget) : null,
        start_date:             formProyecto.start_date || null,
        end_date:               formProyecto.end_date   || null,
        responsable_id:         formProyecto.responsable_id || null,
        tipo_estructura:        PROJECT_TYPES.find(t => t.value === formProyecto.project_type)?.tipoEstructura ?? 'personalizado',
        num_niveles:            numNiveles,
        m2_construccion:        m2 || null,
        disciplinas_activas:    disciplinasActivas,
        subdisciplinas_activas: subdisciplinasActivas,
      })

      if (proyectoError) throw new Error(proyectoError.message)
      if (!proyecto?.id) throw new Error('El proyecto se creó pero no retornó un ID válido. Verifica los permisos RLS en la tabla projects.')

      // 2. Registrar responsable en historial
      if (formProyecto.responsable_id && proyecto?.id) {
        await cambiarResponsable({
          projectId:     proyecto.id,
          responsableId: formProyecto.responsable_id,
          motivo:        'Responsable asignado al crear el proyecto',
        }).catch(console.error)
      }

      // 3. Crear niveles
      const nivelesCreados = await createLevelesBatch(proyecto.id, nivelesSeleccionados)

      // 4. Crear secciones
      const seccionesParaInsertar = []
      for (const nivel of nivelesCreados) {
        const nombres = seccionesPorNivel[nivel.nivel_num] ?? []
        nombres.forEach((nombre, i) => {
          if (!nombre.trim()) return
          seccionesParaInsertar.push({
            project_id:   proyecto.id,
            level_id:     nivel.id,
            company_id:   cid,
            section_code: `${formProyecto.code}-N${nivel.nivel_num}-S${String(i + 1).padStart(3, '0')}`,
            nombre:       nombre.trim().slice(0, 65),
            sort_order:   i,
          })
        })
      }
      if (seccionesParaInsertar.length) await createSectionsBatch(seccionesParaInsertar)

      // 5. Generar WBS completo desde plantilla
      if (plantillaFuente === 'sistema') {
        await clonarWbsDesdeSistema(proyecto.id)
      } else {
        await clonarWbsDesdeEmpresa(proyecto.id, plantillaFuente)
      }

      // ── FIX v2.2: Respetar nodos eliminados en la preview ──────────
      // Los nodos marcados en wbsEliminados (Set de IDs del preview)
      // corresponden a IDs de obra_template_nodos (fuente sistema) o
      // IDs temporales del árbol preview (fuente empresa).
      // Aplanamos el árbol preview para cruzar IDs con nombres.
      if (wbsEliminados.size > 0) {
        const todosLosNodos = flattenTree(wbsPreview)

        // Nodos eliminados con su metadata
        const nodosEliminados = todosLosNodos.filter(n => wbsEliminados.has(n.id))

        if (plantillaFuente === 'sistema') {
          // Para plantillas del sistema: usar el ID del nodo del preview
          // que es el mismo que obra_template_nodos.id (template_nodo_id en project_wbs)
          const templateIds = nodosEliminados
            .map(n => n.id)          // id en preview = id en obra_template_nodos
            .filter(Boolean)

          if (templateIds.length) {
            await eliminarNodosWbsPorTemplateIds(proyecto.id, templateIds, [])
          }
        } else {
          // Para plantillas de empresa: los nodos no tienen template_nodo_id
          // del sistema, usamos el nombre como fallback
          const nombres = nodosEliminados
            .map(n => n.nombre)
            .filter(Boolean)

          if (nombres.length) {
            await eliminarNodosWbsPorTemplateIds(proyecto.id, [], nombres)
          }
        }
      }
      // ── Fin FIX v2.2 ───────────────────────────────────────────────

      onSuccess(proyecto)
    } catch (e) {
      setError(e.message ?? 'Error al guardar el proyecto.')
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers WBS preview ───────────────────────────────────
  const toggleExpand = (id) => {
    setWbsExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleEliminar = (id) => {
    setWbsEliminados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const contarNodos = (nodos) => {
    let total = 0
    const recorrer = (arr) => arr.forEach(n => {
      if (!wbsEliminados.has(n.id)) {
        total++
        if (n.children?.length) recorrer(n.children)
      }
    })
    recorrer(nodos)
    return total
  }

  const totalDias = wbsPreview
    .filter(n => !wbsEliminados.has(n.id))
    .reduce((s, n) => s + (n.dur_calculada ?? n.dur_base_dias ?? 0), 0)

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ minHeight: '540px' }}>

      <StepIndicator paso={paso} />

      {error && (
        <div className="mx-1 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {paso === 1 && (
          <PasoDatosProyecto form={formProyecto} onChange={setFormProyecto} />
        )}
        {paso === 2 && (
          <PasoNiveles
            seleccionados={nivelesSeleccionados}
            onChange={setNivelesSeleccionados}
          />
        )}
        {paso === 3 && (
          <PasoSecciones
            niveles={nivelesSeleccionados}
            secciones={seccionesPorNivel}
            onChange={setSeccionesPorNivel}
            nivelActivo={nivelActivoStep3}
            setNivelActivo={setNivelActivoStep3}
            projectCode={formProyecto.code}
          />
        )}
        {paso === 4 && (
          <PasoMotorPlantillas
            disciplinas={disciplinas}
            subdisciplinas={subdisciplinas}
            plantillasDisp={plantillasDisp}
            discActivas={discActivas}
            setDiscActivas={setDiscActivas}
            subActivas={subActivas}
            setSubActivas={setSubActivas}
            voltajeElegido={voltajeElegido}
            setVoltajeElegido={setVoltajeElegido}
            gasElegido={gasElegido}
            setGasElegido={setGasElegido}
            numNiveles={numNiveles}
            setNumNiveles={setNumNiveles}
            m2={m2}
            setM2={setM2}
            plantillaFuente={plantillaFuente}
            setPlantillaFuente={setPlantillaFuente}
            loading={loadingDisc}
          />
        )}
        {paso === 5 && (
          <PasoConfirmar
            wbsPreview={wbsPreview}
            loading={loadingPreview}
            eliminados={wbsEliminados}
            expandidos={wbsExpandidos}
            onToggleExpand={toggleExpand}
            onToggleEliminar={toggleEliminar}
            onRefresh={generarPreview}
            totalDias={totalDias}
            totalNodos={contarNodos(wbsPreview)}
            disciplinasActivas={disciplinas.filter(d => discActivas[d.id])}
            formProyecto={formProyecto}
            numNiveles={numNiveles}
            m2={m2}
          />
        )}
      </div>

      {/* Botones de navegación */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
        <button
          onClick={paso === 1 ? onCancel : () => irA(paso - 1)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={15} />
          {paso === 1 ? 'Cancelar' : 'Anterior'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{paso} de {STEPS.length}</span>
          {paso < STEPS.length ? (
            <button
              onClick={handleSiguiente}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Siguiente <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving
                ? <><span className="animate-spin inline-block">⏳</span> Creando proyecto…</>
                : <><CheckCircle size={15} /> Crear Proyecto</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  PASO 4 — Motor de Plantillas WBS
// ============================================================

function PasoMotorPlantillas({
  disciplinas, subdisciplinas, plantillasDisp,
  discActivas, setDiscActivas,
  subActivas, setSubActivas,
  voltajeElegido, setVoltajeElegido,
  gasElegido, setGasElegido,
  numNiveles, setNumNiveles,
  m2, setM2,
  plantillaFuente, setPlantillaFuente,
  loading,
}) {
  const [subOpen, setSubOpen] = useState({})
  const plantillasEmpresa = plantillasDisp.filter(p => p.fuente === 'empresa')

  const toggleDisc = (id) => {
    setDiscActivas(prev => ({ ...prev, [id]: !prev[id] }))
    if (!discActivas[id]) setSubOpen(prev => ({ ...prev, [id]: true }))
  }

  const toggleSub = (codigo) => {
    setSubActivas(prev => ({ ...prev, [codigo]: !prev[codigo] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <span className="animate-spin mr-2">⏳</span>
        <span className="text-sm">Cargando disciplinas…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {plantillasEmpresa.length > 0 && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
            <LayoutTemplate size={13} /> Fuente del árbol WBS
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name="fuente" value="sistema"
                checked={plantillaFuente === 'sistema'}
                onChange={() => setPlantillaFuente('sistema')}
                className="accent-indigo-600" />
              <span className="text-sm text-gray-700">
                <span className="font-medium">Plantillas del sistema</span>
                <span className="text-gray-400 ml-1">— seleccionar disciplinas abajo</span>
              </span>
            </label>
            {plantillasEmpresa.map(p => (
              <label key={p.id} className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="fuente" value={p.id}
                  checked={plantillaFuente === p.id}
                  onChange={() => setPlantillaFuente(p.id)}
                  className="accent-indigo-600" />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                    Empresa · v{p.version}
                  </span>
                  {p.veces_usada > 0 && (
                    <span className="ml-1 text-xs text-gray-400">usada {p.veces_usada}x</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {plantillaFuente === 'sistema' && (
        <>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Sparkles size={12} /> Disciplinas de obra
            </p>
            <p className="text-xs text-gray-400 mb-3">
              OBRIX generará el árbol WBS automáticamente según las disciplinas que actives.
            </p>
            <div className="space-y-2">
              {disciplinas.map(disc => {
                const Icon    = DISC_ICONS[disc.codigo] ?? Building2
                const activa  = !!discActivas[disc.id]
                const subsList = subdisciplinas[disc.id] ?? []
                const abierto = subOpen[disc.id]

                return (
                  <div key={disc.id}
                    className={`border rounded-xl transition-all overflow-hidden ${
                      activa ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button type="button" onClick={() => toggleDisc(disc.id)}
                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                          activa ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          activa ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: disc.color + '22', border: `1px solid ${disc.color}44` }}>
                        <Icon size={14} style={{ color: disc.color }} />
                      </div>
                      <span className={`flex-1 text-sm font-medium ${activa ? 'text-indigo-800' : 'text-gray-600'}`}>
                        {disc.nombre}
                      </span>
                      {activa && subsList.length > 0 && (
                        <button type="button"
                          onClick={() => setSubOpen(prev => ({ ...prev, [disc.id]: !prev[disc.id] }))}
                          className="p-1 text-indigo-400 hover:text-indigo-600 rounded">
                          {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>
                    {activa && abierto && subsList.length > 0 && (
                      <SubdisciplinasPanel
                        disciplinaCodigo={disc.codigo}
                        subs={subsList}
                        subActivas={subActivas}
                        onToggleSub={toggleSub}
                        voltajeElegido={voltajeElegido}
                        setVoltajeElegido={setVoltajeElegido}
                        gasElegido={gasElegido}
                        setGasElegido={setGasElegido}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Clock size={12} /> Parámetros para el cronograma estimado
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Número de niveles</label>
                <input type="number" min="1" max="50" value={numNiveles}
                  onChange={e => setNumNiveles(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">M² de construcción</label>
                <input type="number" min="10" value={m2}
                  onChange={e => setM2(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              OBRIX usará estos valores para calcular la duración estimada de cada actividad.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Panel de subdisciplinas ───────────────────────────────────
function SubdisciplinasPanel({
  disciplinaCodigo, subs, subActivas, onToggleSub,
  voltajeElegido, setVoltajeElegido,
  gasElegido, setGasElegido,
}) {
  const exclusivos = subs.filter(s => s.es_exclusivo)
  const multiples  = subs.filter(s => !s.es_exclusivo)

  return (
    <div className="px-4 pb-3 pt-1 border-t border-indigo-100 bg-white/50">
      {exclusivos.length > 0 && (
        <div className="mb-2.5">
          <p className="text-xs text-indigo-500 font-medium mb-1.5">
            {disciplinaCodigo === 'ELECT' ? 'Tipo de voltaje' : 'Tipo de suministro'}
          </p>
          <div className="flex flex-wrap gap-2">
            {exclusivos.map(sub => {
              const selVal   = disciplinaCodigo === 'ELECT' ? voltajeElegido : gasElegido
              const setSelFn = disciplinaCodigo === 'ELECT' ? setVoltajeElegido : setGasElegido
              const sufijo   = sub.codigo.replace(`${disciplinaCodigo}_`, '')
              const activo   = selVal === sufijo
              return (
                <button key={sub.id} type="button" onClick={() => setSelFn(sufijo)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                    activo
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                  }`}>
                  {sub.nombre}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {multiples.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {multiples.map(sub => (
            <label key={sub.id} className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={!!subActivas[sub.codigo]}
                onChange={() => onToggleSub(sub.codigo)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded shrink-0" />
              <span className="text-xs text-gray-600 group-hover:text-indigo-700 transition-colors leading-tight">
                {sub.nombre}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
//  PASO 5 — Vista Previa WBS + Confirmar
// ============================================================

function PasoConfirmar({
  wbsPreview, loading, eliminados, expandidos,
  onToggleExpand, onToggleEliminar, onRefresh,
  totalDias, totalNodos,
  disciplinasActivas, formProyecto, numNiveles, m2,
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <span className="text-2xl animate-spin">⏳</span>
        <span className="text-sm">Generando árbol WBS…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { lbl: 'Disciplinas', val: disciplinasActivas.length },
          { lbl: 'Actividades', val: totalNodos },
          { lbl: 'Días est.',   val: `${totalDias}d` },
          { lbl: 'M²',         val: m2 },
        ].map(s => (
          <div key={s.lbl} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{s.lbl}</p>
            <p className="text-lg font-bold text-gray-800">{s.val}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Vista previa del árbol WBS
          </p>
          <button onClick={onRefresh}
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
            ↺ Regenerar
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Puedes eliminar etapas o actividades que no apliquen. El árbol se guardará al crear el proyecto.
        </p>

        {/* Aviso de nodos eliminados */}
        {eliminados.size > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={13} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">{eliminados.size} nodo{eliminados.size > 1 ? 's' : ''} eliminado{eliminados.size > 1 ? 's' : ''}</span>
              {' '}— no se incluirán al crear el proyecto.
            </p>
          </div>
        )}

        {wbsPreview.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
            No se generaron nodos. Revisa las disciplinas activas en el paso anterior.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {wbsPreview.map(etapa => (
              <NodoWbsPreview
                key={etapa.id}
                nodo={etapa}
                eliminados={eliminados}
                expandidos={expandidos}
                onToggleExpand={onToggleExpand}
                onToggleEliminar={onToggleEliminar}
                nivel={0}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
        <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
        <p className="text-xs text-green-700">
          Al crear el proyecto, OBRIX generará el WBS completo en la base de datos.
          Podrás seguir editando el árbol desde la vista de proyecto.
        </p>
      </div>
    </div>
  )
}

// ── Nodo árbol WBS (recursivo) ────────────────────────────────
function NodoWbsPreview({ nodo, eliminados, expandidos, onToggleExpand, onToggleEliminar, nivel }) {
  const eliminado  = eliminados.has(nodo.id)
  const expandido  = expandidos.has(nodo.id)
  const tieneHijos = nodo.children?.filter(c => !eliminados.has(c.id)).length > 0
  const colorDisc  = nodo.disciplina?.color ?? '#6366F1'
  const duracion   = nodo.dur_calculada ?? nodo.dur_base_dias ?? 1

  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
        eliminado
          ? 'opacity-40 bg-red-50 border-red-200 line-through'
          : nivel === 0
            ? 'bg-white border-gray-200 font-medium'
            : 'bg-gray-50/80 border-gray-100 ml-4'
      }`}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colorDisc }} />
        {tieneHijos ? (
          <button type="button" onClick={() => onToggleExpand(nodo.id)}
            className="text-gray-400 hover:text-gray-600 shrink-0">
            {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={`flex-1 text-xs ${nivel === 0 ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>
          {nodo.nombre}
        </span>
        <span className="text-xs text-gray-400 shrink-0 min-w-[32px] text-right">{duracion}d</span>
        <button type="button" onClick={() => onToggleEliminar(nodo.id)}
          className={`text-xs px-1.5 py-0.5 rounded transition-colors shrink-0 ${
            eliminado
              ? 'text-green-600 hover:bg-green-100'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}>
          {eliminado ? '↩' : <Trash2 size={10} />}
        </button>
      </div>
      {expandido && !eliminado && nodo.children?.map(hijo => (
        <NodoWbsPreview
          key={hijo.id}
          nodo={hijo}
          eliminados={eliminados}
          expandidos={expandidos}
          onToggleExpand={onToggleExpand}
          onToggleEliminar={onToggleEliminar}
          nivel={nivel + 1}
        />
      ))}
    </div>
  )
}

// ============================================================
//  PASO 1 — Datos del Proyecto
// ============================================================

function PasoDatosProyecto({ form, onChange }) {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          Tipo de Proyecto
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PROJECT_TYPES.map(t => {
            const Icon = t.icon
            return (
              <button key={t.value} type="button" onClick={() => set('project_type', t.value)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  form.project_type === t.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <Icon size={22} className={`mx-auto mb-1 ${form.project_type === t.value ? 'text-indigo-600' : 'text-gray-400'}`} />
                <p className="text-xs font-semibold text-gray-700">{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
          <input type="text" maxLength={10} value={form.code} placeholder="BOQ17"
            onChange={e => set('code', e.target.value.toUpperCase())}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
        </div>
        <div className="col-span-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
          <input type="text" value={form.name} placeholder="Ej: Bosquet 17"
            onChange={e => set('name', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Dirección / Ubicación</label>
        <input type="text" value={form.address} placeholder="Calle, colonia, ciudad..."
          onChange={e => set('address', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Inicio</label>
          <input type="date" value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fin estimado</label>
          <input type="date" value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Presupuesto (MXN)</label>
        <input type="number" min="0" step="0.01" value={form.budget} placeholder="0.00"
          onChange={e => set('budget', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>

      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <ResponsableSelector
          value={form.responsable_id}
          onChange={v => set('responsable_id', v)}
          label="Responsable de Obra (opcional)"
          placeholder="— Sin asignar — se puede definir después —"
          showBadge={false}
        />
        <p className="text-xs text-indigo-400 mt-1.5">
          Campo opcional. Si se asigna ahora, quedará registrado en el historial desde el inicio del proyecto.
        </p>
      </div>
    </div>
  )
}

// ============================================================
//  PASO 2 — Niveles
// ============================================================

function PasoNiveles({ seleccionados, onChange }) {
  const toggleNivel = (nivel) => {
    const existe = seleccionados.find(n => n.num === nivel.num)
    if (existe) {
      onChange(prev => prev.filter(n => n.num !== nivel.num))
    } else {
      onChange(prev =>
        [...prev, { num: nivel.num, nombre: nivel.nombre }].sort((a, b) => a.num - b.num)
      )
    }
  }

  const estaSeleccionado = (num) => seleccionados.some(n => n.num === num)

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Selecciona los niveles que componen este proyecto. Puedes agregar más después.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CATALOGO_NIVELES.map(n => {
          const activo = estaSeleccionado(n.num)
          return (
            <button key={n.num} type="button" onClick={() => toggleNivel(n)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                activo
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                activo ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
              }`}>
                {activo && <span className="text-white text-xs">✓</span>}
              </div>
              <span>{n.nombre}</span>
            </button>
          )
        })}
      </div>

      {seleccionados.length > 0 && (
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <p className="text-xs font-semibold text-indigo-700 mb-2">
            {seleccionados.length} nivel{seleccionados.length !== 1 ? 'es' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {seleccionados.map(n => (
              <span key={n.num} className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full font-medium">
                {n.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
//  PASO 3 — Secciones
// ============================================================

function PasoSecciones({ niveles, secciones, onChange, nivelActivo, setNivelActivo, projectCode }) {
  const [nuevaSeccion,  setNuevaSeccion]  = useState('')
  const [replicarModal, setReplicarModal] = useState(false)

  const seccionesActivas = secciones[nivelActivo] ?? []

  const agregarSeccion = () => {
    const nombre = nuevaSeccion.trim().slice(0, 65)
    if (!nombre) return
    onChange(prev => ({ ...prev, [nivelActivo]: [...(prev[nivelActivo] ?? []), nombre] }))
    setNuevaSeccion('')
  }

  const eliminarSeccion = (idx) => {
    onChange(prev => ({ ...prev, [nivelActivo]: (prev[nivelActivo] ?? []).filter((_, i) => i !== idx) }))
  }

  const editarSeccion = (idx, nuevoNombre) => {
    onChange(prev => ({
      ...prev,
      [nivelActivo]: (prev[nivelActivo] ?? []).map((s, i) => i === idx ? nuevoNombre.slice(0, 65) : s),
    }))
  }

  const replicarEnTodos = () => {
    const base = secciones[nivelActivo] ?? []
    if (!base.length) return
    const nuevo = { ...secciones }
    niveles.forEach(n => { if (n.num !== nivelActivo) nuevo[n.num] = [...base] })
    onChange(nuevo)
    setReplicarModal(false)
  }

  const nivelInfo      = niveles.find(n => n.num === nivelActivo)
  const previewCode    = (idx) => `${projectCode}-N${nivelActivo}-S${String(idx + 1).padStart(3, '0')}`
  const totalSecciones = Object.values(secciones).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: '340px' }}>
      <div className="w-36 shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Niveles</p>
        <div className="space-y-1">
          {niveles.map(n => {
            const count = (secciones[n.num] ?? []).length
            return (
              <button key={n.num} onClick={() => setNivelActivo(n.num)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  nivelActivo === n.num ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}>
                <span className="font-medium">{n.nombre}</span>
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    nivelActivo === n.num ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">{totalSecciones} secciones total</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {nivelInfo && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Nivel: <span className="text-indigo-600">{nivelInfo.nombre}</span>
                </p>
                <p className="text-xs text-gray-400">
                  {projectCode}-N{nivelActivo}-S### · {seccionesActivas.length} secciones
                </p>
              </div>
              {seccionesActivas.length > 0 && niveles.length > 1 && (
                <button onClick={() => setReplicarModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                  <Copy size={11} /> Replicar en otros
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <input type="text" value={nuevaSeccion}
                onChange={e => setNuevaSeccion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarSeccion()}
                maxLength={65} placeholder="Ej: Cuarto Eléctrico"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={agregarSeccion} disabled={!nuevaSeccion.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                <Plus size={14} /> Agregar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {seccionesActivas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Grid size={28} className="mb-2 opacity-40" />
                  <p className="text-xs text-center">Sin secciones. Escribe el nombre y presiona Agregar.</p>
                </div>
              ) : (
                seccionesActivas.map((sec, idx) => (
                  <SeccionItem key={idx} nombre={sec} code={previewCode(idx)}
                    onEdit={(v) => editarSeccion(idx, v)}
                    onDelete={() => eliminarSeccion(idx)} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {replicarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-1">Replicar secciones</h3>
            <p className="text-sm text-gray-500 mb-4">
              Las {seccionesActivas.length} secciones de <strong>{nivelInfo?.nombre}</strong> se copiarán a todos los demás niveles.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReplicarModal(false)}
                className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={replicarEnTodos}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                Replicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fila editable de sección ──────────────────────────────────
function SeccionItem({ nombre, code, onEdit, onDelete }) {
  const [editando, setEditando] = useState(false)
  const [valor,    setValor]    = useState(nombre)

  const confirmar = () => {
    if (valor.trim()) onEdit(valor.trim())
    setEditando(false)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg group hover:border-indigo-200 transition-colors">
      <span className="text-xs font-mono text-indigo-500 shrink-0 w-28">{code}</span>
      {editando ? (
        <input autoFocus type="text" value={valor} maxLength={65}
          onChange={e => setValor(e.target.value)} onBlur={confirmar}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') { setValor(nombre); setEditando(false) } }}
          className="flex-1 px-2 py-0.5 text-sm border border-indigo-300 rounded focus:outline-none" />
      ) : (
        <span onClick={() => setEditando(true)}
          className="flex-1 text-sm text-gray-700 cursor-text hover:text-indigo-700 truncate"
          title="Clic para editar">{nombre}</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditando(true)}
          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">✏️</button>
        <button onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Indicador de pasos ────────────────────────────────────────
function StepIndicator({ paso }) {
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((s, idx) => (
        <div key={s.num} className="flex items-center flex-1">
          <div className={`flex items-center gap-2 ${idx > 0 ? 'flex-1' : ''}`}>
            {idx > 0 && (
              <div className={`h-0.5 flex-1 transition-colors ${paso > idx ? 'bg-indigo-500' : 'bg-gray-200'}`} />
            )}
            <div title={s.label}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                paso === s.num ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                  : paso > s.num ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
              {paso > s.num ? '✓' : s.num}
            </div>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 transition-colors ${paso > s.num ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}