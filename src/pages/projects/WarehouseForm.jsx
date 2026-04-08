import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import * as projectsService from '../../services/projects.service'

const warehouseTypes = [
  { value: 'general',  label: '🏭 General'  },
  { value: 'project',  label: '🏗️ Proyecto' },
  { value: 'temporal', label: '⏱️ Temporal' },
]

export const WarehouseForm = ({ warehouse, projects, onClose, companyId }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name:        warehouse?.name        || '',
    code:        warehouse?.code        || '',
    type:        warehouse?.type        || 'project',
    project_id:  warehouse?.project_id  || '',
    responsible: warehouse?.responsible || '',
    location:    warehouse?.location    || '',
    notes:       warehouse?.notes       || '',
    company_id:  warehouse?.company_id  || companyId || '',
    is_active:   warehouse?.is_active   ?? true,
  })

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setLoading(true)
    try {
      const payload = {
        ...formData,
        project_id: formData.project_id || null,
      }

      if (warehouse?.id) {
        await projectsService.updateWarehouse(warehouse.id, payload)
      } else {
        await projectsService.createWarehouse(payload)
      }
      onClose(true)
    } catch (error) {
      console.error('Error guardando almacén:', error)
      onClose(false, error.message)
    } finally {
      setLoading(false)
    }
  }

  // Proyectos activos disponibles para asignar
  const activeProjects = projects?.filter(p => p.status === 'active') || []

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="input-label">Nombre del Almacén *</label>
        <input
          type="text"
          className="input-field"
          placeholder="Ej: Almacén Principal, Bodega A..."
          value={formData.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
      </div>

      {/* Código + Tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="input-label">Código Interno</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ej: ALM-01"
            value={formData.code}
            onChange={(e) => set('code', e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Tipo de Almacén</label>
          <select
            className="input-field"
            value={formData.type}
            onChange={(e) => set('type', e.target.value)}
          >
            {warehouseTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Proyecto asignado */}
      <div>
        <label className="input-label">Proyecto Asignado</label>
        <select
          className="input-field"
          value={formData.project_id}
          onChange={(e) => set('project_id', e.target.value)}
        >
          <option value="">— Sin proyecto (almacén general) —</option>
          {activeProjects.map(p => (
            <option key={p.id} value={p.id}>
              [{p.code}] {p.name}
            </option>
          ))}
        </select>
        {formData.project_id === '' && (
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Un almacén sin proyecto asignado estará disponible para todos los proyectos.
          </p>
        )}
      </div>

      {/* Responsable */}
      <div>
        <label className="input-label">Responsable</label>
        <input
          type="text"
          className="input-field"
          placeholder="Nombre del responsable del almacén..."
          value={formData.responsible}
          onChange={(e) => set('responsible', e.target.value)}
        />
      </div>

      {/* Ubicación */}
      <div>
        <label className="input-label">Ubicación Física</label>
        <input
          type="text"
          className="input-field"
          placeholder="Dirección o descripción de la ubicación..."
          value={formData.location}
          onChange={(e) => set('location', e.target.value)}
        />
      </div>

      {/* Notas */}
      <div>
        <label className="input-label">Notas</label>
        <textarea
          className="input-field"
          rows="2"
          placeholder="Observaciones adicionales..."
          value={formData.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={() => onClose(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {loading ? 'Guardando...' : (warehouse?.id ? 'Actualizar Almacén' : 'Crear Almacén')}
        </Button>
      </div>
    </form>
  )
}