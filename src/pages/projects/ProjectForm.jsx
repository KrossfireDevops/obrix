// src/pages/projects/ProjectForm.jsx
import { useState, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import * as projectsService from '../../services/projects.service'
import ResponsableSelector from '../../components/shared/ResponsableSelector'
import { cambiarResponsable } from '../../services/cierreProyecto.service'

const PROJECT_TYPES = [
  { value: 'RESIDENCIAL', label: 'Residencial', icon: '🏠',
    description: 'Casa, villa, residencia privada' },
  { value: 'EDIFICIO',    label: 'Edificio',    icon: '🏢',
    description: 'Torre, edificio de departamentos, oficinas' },
  { value: 'INDUSTRIAL',  label: 'Industrial',  icon: '🏭',
    description: 'Nave, planta, almacén, fábrica' },
]

const STATUS_OPTIONS = [
  { value: 'active',    label: '🟢 Activo'     },
  { value: 'on_hold',   label: '🟡 En Pausa'   },
  { value: 'completed', label: '✅ Terminado'   },
  { value: 'cancelled', label: '❌ Cancelado'   },
]

export const ProjectForm = ({ project, onClose, onSave, companyId }) => {
  const isEdit = !!project?.id

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code:           project?.code           || '',
    name:           project?.name           || '',
    description:    project?.description    || '',
    address:        project?.address        || '',
    start_date:     project?.start_date     || '',
    end_date:       project?.end_date       || '',
    budget:         project?.budget         || '',
    status:         project?.status         || 'active',
    company_id:     project?.company_id     || companyId || '',
    project_type:   project?.project_type   || 'EDIFICIO',
    responsable_id: project?.responsable_id || '',
  })

  // Auto-generar código al crear nuevo proyecto
  useEffect(() => {
    if (!isEdit) {
      projectsService.generateProjectCode()
        .then(code => setFormData(prev => ({ ...prev, code })))
        .catch(() => {})
    }
  }, [])

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) return

    setLoading(true)
    try {
      const payload = {
        ...formData,
        budget:         formData.budget     ? parseFloat(formData.budget) : null,
        start_date:     formData.start_date || null,
        end_date:       formData.end_date   || null,
        responsable_id: formData.responsable_id || null,
      }

      let savedData
      if (isEdit) {
        const { data } = await projectsService.updateProject(project.id, payload)
        savedData = data
        // Si cambió el responsable, registrar en historial
        if (formData.responsable_id && formData.responsable_id !== project.responsable_id) {
          await cambiarResponsable({
            projectId:     project.id,
            responsableId: formData.responsable_id,
            motivo:        'Cambio de responsable desde edición de proyecto',
          }).catch(console.error)
        }
      } else {
        const { data } = await projectsService.createProject(payload)
        savedData = data
        // Registrar en historial si se asignó responsable al crear
        if (formData.responsable_id && savedData?.id) {
          await cambiarResponsable({
            projectId:     savedData.id,
            responsableId: formData.responsable_id,
            motivo:        'Responsable asignado al crear el proyecto',
          }).catch(console.error)
        }
      }

      // onSave → usado por ProjectTree (necesita el project_type para aplicar template)
      // onClose → usado por el módulo existente de proyectos
      if (onSave)  onSave(savedData)
      if (onClose) onClose(true)

    } catch (error) {
      console.error('Error guardando proyecto:', error)
      if (onClose) onClose(false, error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (onSave)  onSave(null)
    if (onClose) onClose(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Tipo de Proyecto */}
      <div>
        <label className="input-label">Tipo de Proyecto *</label>
        <div className="grid grid-cols-3 gap-2">
          {PROJECT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('project_type', t.value)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                formData.project_type === t.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="text-xs font-semibold text-gray-700">{t.label}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-tight">{t.description}</div>
            </button>
          ))}
        </div>

        {/* Aviso de auto-estructura solo en creación */}
        {!isEdit && (
          <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              💡 Se creará automáticamente la estructura base para tipo
              <span className="font-semibold"> {PROJECT_TYPES.find(t => t.value === formData.project_type)?.label}</span>
            </p>
          </div>
        )}
      </div>

      {/* Código + Nombre */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
        <div>
          <label className="input-label">ID / Código *</label>
          <input
            type="text"
            className="input-field"
            placeholder="001"
            maxLength={10}
            value={formData.code}
            onChange={(e) => set('code', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="input-label">Nombre del Proyecto *</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ej: Bosquet 17"
            value={formData.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="input-label">Descripción</label>
        <textarea
          className="input-field"
          rows="2"
          placeholder="Descripción breve del proyecto..."
          value={formData.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      {/* Dirección */}
      <div>
        <label className="input-label">Dirección / Ubicación</label>
        <input
          type="text"
          className="input-field"
          placeholder="Calle, colonia, ciudad..."
          value={formData.address}
          onChange={(e) => set('address', e.target.value)}
        />
      </div>

      {/* Fechas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="input-label">Fecha de Inicio</label>
          <input
            type="date"
            className="input-field"
            value={formData.start_date}
            onChange={(e) => set('start_date', e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Fecha Fin Estimada</label>
          <input
            type="date"
            className="input-field"
            value={formData.end_date}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </div>
      </div>

      {/* Presupuesto + Estado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="input-label">Presupuesto (MXN)</label>
          <input
            type="number" min="0" step="0.01" className="input-field"
            placeholder="0.00" value={formData.budget}
            onChange={(e) => set('budget', e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Estado</label>
          <select className="input-field" value={formData.status}
            onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsable de Obra */}
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <ResponsableSelector
          value={formData.responsable_id}
          onChange={v => set('responsable_id', v)}
          label="Responsable de Obra"
          placeholder="— Sin asignar —"
          showBadge={isEdit}
        />
        {isEdit && formData.responsable_id !== (project?.responsable_id || '') && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            ⚠️ El cambio de responsable quedará registrado en el historial del proyecto.
          </p>
        )}
        {!isEdit && (
          <p className="text-xs text-indigo-500 mt-1.5">
            El responsable se registrará en el historial desde el inicio del proyecto.
          </p>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {loading ? 'Guardando...' : isEdit ? 'Actualizar Proyecto' : 'Crear Proyecto'}
        </Button>
      </div>
    </form>
  )
}