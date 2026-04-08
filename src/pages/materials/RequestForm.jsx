// src/pages/materials/RequestForm.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Plus, Trash2, Package } from 'lucide-react'
import * as projectsService from '../../services/projectNodes.service'
import * as inventoryService from '../../services/inventory.service'

const PRIORITY_OPTIONS = [
  { value: 'BAJA',    label: '🟢 Baja'    },
  { value: 'NORMAL',  label: '🔵 Normal'  },
  { value: 'ALTA',    label: '🟡 Alta'    },
  { value: 'URGENTE', label: '🔴 Urgente' },
]

export const RequestForm = ({ onSave, onCancel }) => {
  const { userProfile } = useAuth()

  const [projects,   setProjects]   = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [materials,  setMaterials]  = useState([])
  const [loading,    setLoading]    = useState(false)

  const [formData, setFormData] = useState({
    projectId:   '',
    warehouseId: '',
    title:       '',
    description: '',
    priority:    'NORMAL',
  })

  const [items, setItems] = useState([
    { materialId: '', quantity: 1, notes: '' }
  ])

  const [errors, setErrors] = useState({})

  useEffect(() => { loadInitialData() }, [])

  const loadInitialData = async () => {
    const [proj, ware, mats] = await Promise.all([
      projectsService.getProjects(),
      inventoryService.getWarehouses(),
      inventoryService.getMaterials?.() || { data: [] }
    ])
    setProjects(proj.data  || [])
    setWarehouses(ware.data || [])

    // Cargar materiales del catálogo
    const { data: matsData } = await import('../../services/inventory.service')
      .then(m => m.getMaterialsCatalog ? m.getMaterialsCatalog() : { data: [] })
      .catch(() => ({ data: [] }))
    setMaterials(matsData || [])
  }

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }))

  const setItem = (idx, key, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }

  const addItem = () => setItems(prev => [...prev, { materialId: '', quantity: 1, notes: '' }])

  const removeItem = (idx) => {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const validate = () => {
    const e = {}
    if (!formData.projectId)  e.projectId = 'Selecciona un proyecto'
    if (!formData.title.trim()) e.title   = 'El título es obligatorio'
    items.forEach((item, i) => {
      if (!item.materialId) e[`item_${i}`] = 'Selecciona un material'
      if (!item.quantity || item.quantity < 1) e[`qty_${i}`] = 'Cantidad mínima 1'
    })
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    await onSave({
      ...formData,
      companyId: userProfile?.company_id,
      items: items.map(it => ({
        ...it,
        quantity: parseInt(it.quantity, 10)
      }))
    })
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Proyecto + Almacén destino */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="input-label">Proyecto *</label>
          <select
            className="input-field"
            value={formData.projectId}
            onChange={(e) => set('projectId', e.target.value)}
          >
            <option value="">Seleccionar proyecto...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.projectId && <p className="text-xs text-red-500 mt-1">{errors.projectId}</p>}
        </div>
        <div>
          <label className="input-label">Almacén Destino</label>
          <select
            className="input-field"
            value={formData.warehouseId}
            onChange={(e) => set('warehouseId', e.target.value)}
          >
            <option value="">Sin almacén específico</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Título + Prioridad */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
        <div>
          <label className="input-label">Título de la Solicitud *</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ej: Materiales eléctricos Torre A"
            value={formData.title}
            onChange={(e) => set('title', e.target.value)}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>
        <div>
          <label className="input-label">Prioridad</label>
          <select
            className="input-field"
            value={formData.priority}
            onChange={(e) => set('priority', e.target.value)}
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="input-label">Descripción / Justificación</label>
        <textarea
          className="input-field"
          rows={2}
          placeholder="Describe brevemente para qué se necesitan los materiales..."
          value={formData.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      {/* Items */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="input-label" style={{ margin: 0 }}>
            Materiales Solicitados *
          </label>
          <button
            type="button"
            onClick={addItem}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '13px', color: '#2563eb', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: '500'
            }}
          >
            <Plus size={14} /> Agregar material
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 1fr auto',
              gap: '8px', alignItems: 'start',
              backgroundColor: '#f9fafb', borderRadius: '10px', padding: '10px'
            }}>
              {/* Material */}
              <div>
                <select
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  value={item.materialId}
                  onChange={(e) => setItem(idx, 'materialId', e.target.value)}
                >
                  <option value="">Seleccionar material...</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.material_type} {m.category ? `— ${m.category}` : ''}
                    </option>
                  ))}
                </select>
                {errors[`item_${idx}`] && (
                  <p className="text-xs text-red-500 mt-1">{errors[`item_${idx}`]}</p>
                )}
              </div>

              {/* Cantidad */}
              <div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  placeholder="Cant."
                  value={item.quantity}
                  onChange={(e) => setItem(idx, 'quantity', e.target.value.replace(/[^0-9]/g, ''))}
                />
                {errors[`qty_${idx}`] && (
                  <p className="text-xs text-red-500 mt-1">{errors[`qty_${idx}`]}</p>
                )}
              </div>

              {/* Notas */}
              <input
                type="text"
                className="input-field"
                style={{ marginBottom: 0 }}
                placeholder="Notas (opcional)"
                value={item.notes}
                onChange={(e) => setItem(idx, 'notes', e.target.value)}
              />

              {/* Eliminar */}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                style={{
                  padding: '8px', borderRadius: '8px', border: 'none',
                  backgroundColor: items.length === 1 ? '#f3f4f6' : '#fef2f2',
                  color: items.length === 1 ? '#d1d5db' : '#dc2626',
                  cursor: items.length === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {loading ? 'Guardando...' : 'Crear Solicitud'}
        </Button>
      </div>
    </form>
  )
}