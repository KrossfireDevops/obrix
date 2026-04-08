// ============================================================
//  OBRIX ERP — Panel de Bitácora de Obra
//  src/pages/obra/BitacoraPanel.jsx  |  v1.0
// ============================================================

import { useState, useEffect } from 'react'
import { Plus, BookOpen, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  getBitacora, crearEntradaBitacora, resolverAccionBitacora,
  TIPO_BITACORA_CFG,
} from '../../services/avancesObra.service'

export default function BitacoraPanel({ projectId, levels, toast }) {
  const [entradas,    setEntradas]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [filtroTipo,  setFiltroTipo]  = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  useEffect(() => { cargar() }, [projectId, filtroTipo, soloActivos])

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await getBitacora(projectId, {
        tipo:           filtroTipo || undefined,
        requiereAccion: soloActivos || undefined,
      })
      setEntradas(data)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const handleResolver = async (id) => {
    try { await resolverAccionBitacora(id, ''); toast.success('Acción marcada como resuelta'); cargar() }
    catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_BITACORA_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded" />
          Solo con acción pendiente
        </label>
        <button onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
          <Plus size={14} /> Nueva Entrada
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-indigo-400" /></div>
      ) : entradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay entradas en la bitácora</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
            + Crear primera entrada
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {entradas.map(e => {
            const cfg = TIPO_BITACORA_CFG[e.tipo] ?? TIPO_BITACORA_CFG.nota
            const pendiente = e.requiere_accion && !e.accion_resuelta
            return (
              <div key={e.id} className={`bg-white rounded-xl border p-4 ${pendiente ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      {e.prioridad === 'urgente' && <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-red-100 text-red-700">🔴 Urgente</span>}
                      {pendiente && <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700">⏳ Acción pendiente</span>}
                      <span className="text-xs text-gray-400 ml-auto">{new Date(e.fecha).toLocaleDateString('es-MX', { weekday:'short', day:'2-digit', month:'short' })}</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{e.titulo}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{e.descripcion}</p>
                    {(e.project_sections || e.project_levels) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {e.project_levels?.nivel_nombre}{e.project_sections && ` › ${e.project_sections.nombre}`}
                      </p>
                    )}
                    {(e.impacto_tiempo || e.impacto_costo) && (
                      <div className="flex gap-3 mt-2">
                        {e.impacto_tiempo && <span className="text-xs text-red-600 font-medium">⏱ +{e.impacto_tiempo} días retraso</span>}
                        {e.impacto_costo  && <span className="text-xs text-red-600 font-medium">💰 +${Number(e.impacto_costo).toLocaleString('es-MX')} adicional</span>}
                      </div>
                    )}
                    {pendiente && (
                      <button onClick={() => handleResolver(e.id)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-green-600 hover:underline">
                        <CheckCircle size={12} /> Marcar como resuelta
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <NuevaEntradaModal
          projectId={projectId} levels={levels}
          onSuccess={() => { setShowForm(false); cargar(); toast.success('Entrada agregada a la bitácora') }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function NuevaEntradaModal({ projectId, levels, onSuccess, onClose }) {
  const [form, setForm] = useState({
    tipo: 'nota', titulo: '', descripcion: '', prioridad: 'normal',
    levelId: '', sectionId: '', requiereAccion: false, impactoTiempo: '', impactoCosto: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const seccionesNivel = levels.find(l => l.id === form.levelId)?.project_sections ?? []

  const handleGuardar = async () => {
    if (!form.titulo.trim() || !form.descripcion.trim()) { setError('Título y descripción son obligatorios.'); return }
    setGuardando(true); setError(null)
    try {
      await crearEntradaBitacora({
        projectId,
        levelId:       form.levelId   || null,
        sectionId:     form.sectionId || null,
        tipo:          form.tipo,
        titulo:        form.titulo,
        descripcion:   form.descripcion,
        prioridad:     form.prioridad,
        requiereAccion: form.requiereAccion,
        impactoTiempo: form.impactoTiempo ? Number(form.impactoTiempo) : null,
        impactoCosto:  form.impactoCosto  ? Number(form.impactoCosto)  : null,
      })
      onSuccess()
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">📝 Nueva Entrada de Bitácora</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(TIPO_BITACORA_CFG).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('tipo', k)}
                  className={`py-2 text-xs font-medium rounded-xl border-2 transition-all ${form.tipo === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
                  <span className="text-base block">{v.emoji}</span>{v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)}
              placeholder="Ej: Fuga de agua en muro oriente"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
            <textarea rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe detalladamente la situación..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none bg-white">
                <option value="baja">🟢 Baja</option>
                <option value="normal">🔵 Normal</option>
                <option value="alta">🟡 Alta</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.requiereAccion} onChange={e => set('requiereAccion', e.target.checked)} className="rounded" />
                Requiere acción
              </label>
            </div>
          </div>

          {['incidencia','cambio'].includes(form.tipo) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Retraso estimado (días)</label>
                <input type="number" min="0" value={form.impactoTiempo} onChange={e => set('impactoTiempo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Costo adicional (MXN)</label>
                <input type="number" min="0" value={form.impactoCosto} onChange={e => set('impactoCosto', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nivel (opcional)</label>
              <select value={form.levelId} onChange={e => { set('levelId', e.target.value); set('sectionId', '') }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none bg-white">
                <option value="">— General —</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nivel_nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sección (opcional)</label>
              <select value={form.sectionId} onChange={e => set('sectionId', e.target.value)} disabled={!form.levelId}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none bg-white disabled:opacity-50">
                <option value="">— Todas —</option>
                {seccionesNivel.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {guardando ? <RefreshCw size={14} className="animate-spin" /> : null}
            Guardar en Bitácora
          </button>
        </div>
      </div>
    </div>
  )
}