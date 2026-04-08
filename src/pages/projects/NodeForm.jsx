// src/pages/projects/NodeForm.jsx
import { useState } from 'react'

const NODE_TYPES = [
  { value: 'nivel',    label: 'Nivel / Piso'  },
  { value: 'torre',    label: 'Torre / Bloque' },
  { value: 'sector',   label: 'Sector / Zona'  },
  { value: 'nave',     label: 'Nave'           },
  { value: 'elemento', label: 'Elemento'       },
  { value: 'otro',     label: 'Otro'           },
]

const STATUS_OPTIONS = [
  { value: 'PENDIENTE',   label: '⏳ Pendiente'   },
  { value: 'EN_PROGRESO', label: '🔄 En Progreso' },
  { value: 'COMPLETADO',  label: '✅ Completado'  },
  { value: 'BLOQUEADO',   label: '🔴 Bloqueado'   },
  { value: 'CANCELADO',   label: '❌ Cancelado'   },
]

export const NodeForm = ({ initialData = null, onSave, onCancel }) => {
  const isEdit = !!initialData

  const [formData, setFormData] = useState({
    name:             initialData?.name             || '',
    code:             initialData?.code             || '',
    description:      initialData?.description      || '',
    node_type:        initialData?.node_type        || 'nivel',
    status:           initialData?.status           || 'PENDIENTE',
    progress_percent: initialData?.progress_percent || 0,
    responsible_name: initialData?.responsible_name || '',
    sort_order:       initialData?.sort_order       || 0,
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const validate = () => {
    const e = {}
    if (!formData.name.trim()) e.name = 'El nombre es obligatorio'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    await onSave({
      ...formData,
      progress_percent: parseFloat(formData.progress_percent),
      sort_order: parseInt(formData.sort_order, 10),
    })
    setLoading(false)
  }

  const field = (key, value) => setFormData(f => ({ ...f, [key]: value }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Tipo de nodo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Nodo</label>
        <div className="grid grid-cols-3 gap-2">
          {NODE_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => field('node_type', t.value)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                formData.node_type === t.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <input
          type="text"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none
            ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
          placeholder="Ej: Piso 3, Sector A, Torre Norte..."
          value={formData.name}
          onChange={(e) => field('name', e.target.value)}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Código + Orden */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
            placeholder="Ej: P3, SA, TN..."
            value={formData.code}
            onChange={(e) => field('code', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
          <input
            type="number"
            step="1"
            min="0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
            value={formData.sort_order}
            onChange={(e) => field('sort_order', e.target.value)}
          />
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none resize-none"
          rows={2}
          placeholder="Descripción o notas del nodo..."
          value={formData.description}
          onChange={(e) => field('description', e.target.value)}
        />
      </div>

      {/* Estado + Responsable */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
            value={formData.status}
            onChange={(e) => field('status', e.target.value)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
            placeholder="Nombre del responsable"
            value={formData.responsible_name}
            onChange={(e) => field('responsible_name', e.target.value)}
          />
        </div>
      </div>

      {/* Avance */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">Avance inicial</label>
          <span className="text-sm font-bold text-primary-600">{formData.progress_percent}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          className="w-full accent-primary-600"
          value={formData.progress_percent}
          onChange={(e) => field('progress_percent', e.target.value)}
        />
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${formData.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : isEdit ? 'Actualizar Nodo' : 'Agregar Nodo'}
        </button>
      </div>
    </form>
  )
}