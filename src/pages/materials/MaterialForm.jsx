import { useState, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import * as materialsService from '../../services/materials.service'

export const MaterialForm = ({ material, onClose, categories }) => {
  const [loading, setLoading] = useState(false)
  const [subcategories, setSubcategories] = useState([])
  
  const [formData, setFormData] = useState({
    category: material?.category || '',
    subcategory: material?.subcategory || '',
    material_type: material?.material_type || '',
    default_unit: material?.default_unit || 'Pieza',
    form_config: material?.form_config || { fields: [] }
  })

  // Cargar subcategorías cuando cambia categoría
  useEffect(() => {
    if (formData.category) {
      loadSubcategories(formData.category)
    }
  }, [formData.category])

  const loadSubcategories = async (category) => {
    const subs = await materialsService.getSubcategories(category)
    setSubcategories(subs)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (material?.id) {
        // Actualizar
        await materialsService.updateMaterial(material.id, formData)
      } else {
        // Crear
        await materialsService.createMaterial(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error guardando material:', error)
      alert('Error al guardar el material: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Categoría */}
      <div>
        <label className="input-label">Categoría *</label>
        <select
          className="input-field"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
          required
        >
          <option value="">Seleccionar categoría...</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Subcategoría */}
      {formData.category && (
        <div>
          <label className="input-label">Subcategoría *</label>
          <select
            className="input-field"
            value={formData.subcategory}
            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
            required
          >
            <option value="">Seleccionar subcategoría...</option>
            {subcategories.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
            {subcategories.length === 0 && (
              <option value="new">+ Nueva subcategoría...</option>
            )}
          </select>
        </div>
      )}

      {/* Tipo de Material */}
      <div>
        <label className="input-label">Tipo de Material *</label>
        <input
          type="text"
          className="input-field"
          placeholder="Ej: Cable cobre, Conduit PVC, Breaker..."
          value={formData.material_type}
          onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
          required
        />
      </div>

      {/* Unidad de Medida */}
      <div>
        <label className="input-label">Unidad de Medida *</label>
        <select
          className="input-field"
          value={formData.default_unit}
          onChange={(e) => setFormData({ ...formData, default_unit: e.target.value })}
          required
        >
          <option value="Pieza">Pieza</option>
          <option value="Metro">Metro</option>
          <option value="Kilómetro">Kilómetro</option>
          <option value="Caja">Caja</option>
          <option value="Paquete">Paquete</option>
          <option value="Rollos">Rollos</option>
          <option value="Juego">Juego</option>
        </select>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {loading ? 'Guardando...' : (material?.id ? 'Actualizar' : 'Crear Material')}
        </Button>
      </div>
    </form>
  )
}