// src/pages/attendance/PersonnelForm.jsx
import { useState, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import * as attendanceService from '../../services/attendance.service'

const POSITIONS = ['Supervisor', 'Encargado', 'Oficial', 'Medio Oficial', 'Ayudante']

export const PersonnelForm = ({ initialData, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    first_names: '',
    last_names: '',
    position: 'Ayudante',
    company_name: '',
    phone: '',
    email: '',
    project_id: ''
  })
  const [projects, setProjects] = useState([])
  const [errors, setErrors] = useState({})
  const [loadingProjects, setLoadingProjects] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        first_names: initialData.first_names || '',
        last_names: initialData.last_names || '',
        position: initialData.position || 'Ayudante',
        company_name: initialData.company_name || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        project_id: initialData.project_id || ''
      })
    }
    loadProjects()
  }, [initialData])

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const { data, error } = await attendanceService.getProjects()
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.first_names.trim()) newErrors.first_names = 'Nombre requerido'
    if (!formData.last_names.trim()) newErrors.last_names = 'Apellidos requeridos'
    if (!formData.company_name.trim()) newErrors.company_name = 'Empresa requerida'
    if (!formData.position) newErrors.position = 'Puesto requerido'
    if (!formData.project_id) newErrors.project_id = '⚠️ Proyecto requerido'
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Nombre(s) *</label>
          <input
            type="text"
            className="input-field"
            value={formData.first_names}
            onChange={(e) => setFormData({ ...formData, first_names: e.target.value })}
            placeholder="Ej: Juan Carlos"
          />
          {errors.first_names && <p className="text-red-500 text-xs mt-1">{errors.first_names}</p>}
        </div>
        <div>
          <label className="input-label">Apellidos *</label>
          <input
            type="text"
            className="input-field"
            value={formData.last_names}
            onChange={(e) => setFormData({ ...formData, last_names: e.target.value })}
            placeholder="Ej: Pérez López"
          />
          {errors.last_names && <p className="text-red-500 text-xs mt-1">{errors.last_names}</p>}
        </div>
      </div>

      <div>
        <label className="input-label">Puesto *</label>
        <select
          className="input-field"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
        >
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
        {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position}</p>}
      </div>

      <div>
        <label className="input-label">Proyecto Asignado *</label>
        <select
          className="input-field"
          value={formData.project_id}
          onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
          disabled={loadingProjects}
        >
          <option value="">Seleccionar proyecto...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.code ? `(${p.code})` : ''}
            </option>
          ))}
        </select>
        {errors.project_id && (
          <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
            <span>⚠️</span> {errors.project_id}
          </p>
        )}
        {loadingProjects && <p className="text-gray-500 text-xs mt-1">Cargando proyectos...</p>}
      </div>

      <div>
        <label className="input-label">Empresa *</label>
        <input
          type="text"
          className="input-field"
          value={formData.company_name}
          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
          placeholder="Ej: Constructora ABC"
        />
        {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Teléfono</label>
          <input
            type="tel"
            className="input-field"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Ej: 55 1234 5678"
          />
        </div>
        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            className="input-field"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Ej: juan@empresa.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          💡 <strong>Nota:</strong> El personal quedará asignado al proyecto seleccionado. 
          La asistencia se registrará automáticamente bajo este proyecto.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" onClick={onCancel} variant="secondary" className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={loading || loadingProjects}>
          {loading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Guardar')}
        </Button>
      </div>
    </form>
  )
}