// ============================================================
//  OBRIX ERP — Componente: RegistroAvanceModal
//  src/pages/obra/RegistroAvanceModal.jsx  |  v1.0
// ============================================================

import { useState, useRef } from 'react'
import {
  X, Camera, Trash2, Plus, ChevronDown,
  TrendingUp, Package, AlertTriangle, RefreshCw,
  CheckCircle, CloudUpload,
} from 'lucide-react'
import { crearAvance, TIPO_AVANCE_CFG, CLIMA_CFG } from '../../services/avancesObra.service'

const PASO_MAX = 3

export default function RegistroAvanceModal({
  proyecto, levels, seccionPreseleccionada,
  onSuccess, onClose,
}) {
  // ── Estado del formulario ─────────────────────────────────
  const [paso,        setPaso]        = useState(1)
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState(null)

  // Paso 1: Ubicación
  const [levelId,    setLevelId]    = useState(seccionPreseleccionada?.level_id ?? '')
  const [sectionId,  setSectionId]  = useState(seccionPreseleccionada?.section_id ?? '')

  // Paso 2: Avance
  const [tipo,        setTipo]        = useState('avance')
  const [descripcion, setDescripcion] = useState('')
  const [pctNuevo,    setPctNuevo]    = useState(
    Number(seccionPreseleccionada?.pct_actual ?? 0)
  )
  const [clima,       setClima]       = useState('')

  // Paso 3: Fotos + Materiales
  const [fotos,       setFotos]       = useState([])     // File[]
  const [previews,    setPreviews]    = useState([])     // URLs de preview
  const [materiales,  setMateriales]  = useState([])
  const fileInputRef = useRef(null)

  // Secciones del nivel seleccionado
  const seccionesNivel = levels
    .find(l => l.id === levelId)
    ?.project_sections ?? []

  const seccionActual = seccionesNivel.find(s => s.id === sectionId)
    ?? seccionPreseleccionada

  const pctAnterior = Number(seccionActual?.progress_pct ?? seccionPreseleccionada?.pct_actual ?? 0)

  // ── Fotos ─────────────────────────────────────────────────
  const handleFotos = (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const nuevasFotos = [...fotos, ...files].slice(0, 10) // máx 10 fotos
    setFotos(nuevasFotos)
    // Generar previews
    nuevasFotos.forEach((file, idx) => {
      if (previews[idx]) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPreviews(prev => {
          const arr = [...prev]
          arr[idx] = ev.target.result
          return arr
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const quitarFoto = (idx) => {
    setFotos(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Materiales ────────────────────────────────────────────
  const agregarMaterial = () => setMateriales(prev => [
    ...prev,
    { nombre_material: '', cantidad_usada: '', unidad: '', costo_unitario: '' }
  ])

  const actualizarMaterial = (idx, campo, valor) => {
    setMateriales(prev => prev.map((m, i) =>
      i === idx ? { ...m, [campo]: valor } : m
    ))
  }

  const quitarMaterial = (idx) => {
    setMateriales(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Validaciones por paso ─────────────────────────────────
  const validarPaso = () => {
    if (paso === 1 && !sectionId)    return 'Selecciona un nivel y sección.'
    if (paso === 2 && !descripcion.trim()) return 'Describe el trabajo realizado.'
    if (paso === 2 && pctNuevo < pctAnterior)
      return `El avance no puede ser menor al registrado (${pctAnterior}%).`
    return null
  }

  const siguiente = () => {
    const err = validarPaso()
    if (err) { setError(err); return }
    setError(null)
    setPaso(p => Math.min(p + 1, PASO_MAX))
  }

  // ── Guardar ───────────────────────────────────────────────
  const handleGuardar = async () => {
    const err = validarPaso()
    if (err) { setError(err); return }
    setGuardando(true); setError(null)
    try {
      await crearAvance({
        projectId:  proyecto.id,
        levelId:    levelId,
        sectionId:  sectionId,
        pctAnterior,
        pctNuevo,
        descripcion,
        tipo,
        clima:      clima || null,
        fotos,
        materiales: materiales.filter(m => m.nombre_material?.trim()),
      })
      onSuccess()
    } catch (e) {
      setError(e.message ?? 'Error al guardar el avance.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">🔨 Registrar Avance</h3>
            <p className="text-xs text-gray-400 mt-0.5">[{proyecto.code}] {proyecto.name}</p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {['Ubicación','Avance','Evidencia'].map((label, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className={`
                  flex items-center gap-1.5 flex-1
                  ${idx > 0 ? 'justify-center' : ''}
                `}>
                  {idx > 0 && (
                    <div className={`h-0.5 flex-1 ${paso > idx ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                  )}
                  <div className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${paso === idx + 1 ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : paso > idx + 1 ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-400'}
                  `}>
                    {paso > idx + 1 ? '✓' : idx + 1}
                  </div>
                  {idx < 2 && (
                    <div className={`h-0.5 flex-1 ${paso > idx + 1 ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 px-1">
            {['Ubicación','Avance','Evidencia'].map((l, i) => (
              <span key={i} className={`text-xs ${paso === i + 1 ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── PASO 1: Ubicación ── */}
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Nivel
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {levels.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => { setLevelId(l.id); setSectionId('') }}
                      className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                        levelId === l.id
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {l.nivel_nombre}
                    </button>
                  ))}
                </div>
              </div>

              {levelId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    Sección
                  </label>
                  {seccionesNivel.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Este nivel no tiene secciones
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {seccionesNivel.map(sec => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setSectionId(sec.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                            sectionId === sec.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-indigo-400">{sec.section_code}</p>
                            <p className="text-sm font-medium text-gray-800 truncate">{sec.nombre}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${
                              sec.progress_pct >= 100 ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              {Number(sec.progress_pct).toFixed(0)}%
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: Avance ── */}
          {paso === 2 && (
            <div className="space-y-4">
              {/* Info de la sección */}
              {seccionActual && (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div>
                    <p className="text-xs font-mono text-indigo-400">{seccionActual.section_code ?? seccionActual.section_id}</p>
                    <p className="text-sm font-semibold text-indigo-800">{seccionActual.nombre}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-indigo-500">Avance actual</p>
                    <p className="text-lg font-bold text-indigo-700">{pctAnterior.toFixed(0)}%</p>
                  </div>
                </div>
              )}

              {/* Tipo de registro */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Tipo de registro
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TIPO_AVANCE_CFG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTipo(key)}
                      className={`py-2 px-2 rounded-xl border-2 text-xs font-medium transition-all text-center ${
                        tipo === key
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base block mb-0.5">{cfg.emoji}</span>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nuevo % de avance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Avance al terminar
                  </label>
                  <span className="text-xl font-bold text-indigo-600">{pctNuevo}%</span>
                </div>
                <input
                  type="range" min={pctAnterior} max={100} step={5}
                  value={pctNuevo}
                  onChange={e => setPctNuevo(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{pctAnterior}% (actual)</span>
                  <span>100%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pctNuevo >= 100 ? 'bg-green-500' : pctNuevo >= 60 ? 'bg-blue-500' : pctNuevo >= 30 ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${pctNuevo}%` }}
                  />
                </div>
                {pctNuevo > pctAnterior && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    +{(pctNuevo - pctAnterior).toFixed(0)}% de incremento en este registro
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Descripción del trabajo *
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Describe qué se realizó, actividades completadas, personal involucrado..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              {/* Clima */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Condiciones climáticas
                </label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(CLIMA_CFG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setClima(clima === key ? '' : key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        clima === key
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span>{cfg.emoji}</span> {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3: Fotos + Materiales ── */}
          {paso === 3 && (
            <div className="space-y-5">

              {/* Fotos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                    <Camera size={13} /> Fotos de evidencia
                  </label>
                  <span className="text-xs text-gray-400">{fotos.length}/10</span>
                </div>

                {/* Grid de previews */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={src} alt={`Foto ${idx+1}`}
                        className="w-full h-full object-cover" />
                      <button
                        onClick={() => quitarFoto(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  {fotos.length < 10 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                    >
                      <CloudUpload size={20} />
                      <span className="text-xs">Agregar</span>
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFotos}
                  className="hidden"
                />

                <p className="text-xs text-gray-400">
                  Puedes tomar fotos desde la cámara o seleccionar de tu galería. Máx. 10 fotos.
                </p>
              </div>

              {/* Materiales consumidos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                    <Package size={13} /> Materiales usados
                  </label>
                  <button
                    onClick={agregarMaterial}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    <Plus size={12} /> Agregar
                  </button>
                </div>

                {materiales.length === 0 ? (
                  <button
                    onClick={agregarMaterial}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all"
                  >
                    + Registrar material consumido (opcional)
                  </button>
                ) : (
                  <div className="space-y-2">
                    {materiales.map((m, idx) => (
                      <div key={idx} className="flex gap-2 items-start p-2 bg-gray-50 rounded-xl">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text" placeholder="Material" value={m.nombre_material}
                            onChange={e => actualizarMaterial(idx, 'nombre_material', e.target.value)}
                            className="col-span-2 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                          <input
                            type="number" placeholder="Cantidad" value={m.cantidad_usada} min="0"
                            onChange={e => actualizarMaterial(idx, 'cantidad_usada', e.target.value)}
                            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                          <input
                            type="text" placeholder="Unidad (pzas, m², kg...)" value={m.unidad}
                            onChange={e => actualizarMaterial(idx, 'unidad', e.target.value)}
                            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        <button onClick={() => quitarMaterial(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg mt-0.5">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen del registro */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <CheckCircle size={13} /> Resumen del registro
                </p>
                <div className="text-xs text-green-700 space-y-1">
                  <p>Sección: <strong>{seccionActual?.nombre}</strong></p>
                  <p>Avance: <strong>{pctAnterior.toFixed(0)}% → {pctNuevo}%</strong> (+{(pctNuevo - pctAnterior).toFixed(0)}%)</p>
                  <p>Tipo: <strong>{TIPO_AVANCE_CFG[tipo]?.label}</strong></p>
                  <p>Fotos: <strong>{fotos.length}</strong> · Materiales: <strong>{materiales.filter(m=>m.nombre_material?.trim()).length}</strong></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: navegación */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={paso === 1 ? onClose : () => setPaso(p => p - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            {paso === 1 ? 'Cancelar' : '← Anterior'}
          </button>

          {paso < PASO_MAX ? (
            <button onClick={siguiente}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
              Siguiente →
            </button>
          ) : (
            <button onClick={handleGuardar} disabled={guardando}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50">
              {guardando
                ? <><RefreshCw size={14} className="animate-spin" /> Guardando…</>
                : <><CheckCircle size={14} /> Guardar Avance</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}