import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import * as inventoryService from '../../services/inventory.service'
import * as materialsService from '../../services/materials.service'

const movementTypes = [
  { value: 'ENTRADA',     label: 'Entrada',     icon: '📥' },
  { value: 'SALIDA',      label: 'Salida',      icon: '📤' },
  { value: 'DAÑO',        label: 'Daño',        icon: '⚠️' },
  { value: 'DESPERDICIO', label: 'Desperdicio', icon: '🗑️' },
  { value: 'PERDIDA',     label: 'Pérdida',     icon: '❌' },
  { value: 'AJUSTE',      label: 'Ajuste',      icon: '🔧' },
]

export const AddMovement = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, toast, removeToast } = useToast()

  const [loading, setLoading]       = useState(false)
  const [materials, setMaterials]   = useState([])
  const [warehouses, setWarehouses] = useState([])

  const [formData, setFormData] = useState({
    warehouse_id:  '',
    material_id:   '',
    type:          'ENTRADA',
    quantity:      '',
    reason:        '',
    observations:  '',
  })

  useEffect(() => {
    loadMaterials()
    loadWarehouses()
  }, [])

  const loadMaterials = async () => {
    const { data } = await materialsService.getMaterials()
    setMaterials(data || [])
  }

  const loadWarehouses = async () => {
    const { data } = await inventoryService.getWarehouses()
    setWarehouses(data || [])
  }

  const handleQuantityChange = (e) => {
    // ✅ FIX: Solo permitir dígitos enteros, bloquear punto y coma decimales
    const value = e.target.value.replace(/[^0-9]/g, '')
    setFormData({ ...formData, quantity: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.warehouse_id) {
      toast.warning('Por favor selecciona un almacén')
      return
    }
    if (!formData.material_id) {
      toast.warning('Por favor selecciona un material')
      return
    }
    if (!formData.quantity || parseInt(formData.quantity, 10) <= 0) {
      toast.warning('La cantidad debe ser mayor a cero')
      return
    }

    setLoading(true)
    try {
      await inventoryService.createMovement({
        ...formData,
        quantity: parseInt(formData.quantity, 10), // ✅ FIX: parseInt en lugar de parseFloat
        responsible_user_id: user?.id,
        attributes: {}
      })

      toast.success('Movimiento registrado exitosamente')
      setTimeout(() => navigate('/inventory'), 1500)
    } catch (error) {
      console.error('Error registrando movimiento:', error)
      toast.error(error.message || 'Ocurrió un error al registrar el movimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout title="📝 Nuevo Movimiento">
      <div className="space-y-6">
        <Link to="/inventory" className="inline-flex items-center text-primary-600 hover:text-primary-700">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inventario
        </Link>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Tipo de Movimiento */}
            <div>
              <label className="input-label">Tipo de Movimiento *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {movementTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.type === type.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{type.icon}</div>
                    <div className="text-sm font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Almacén */}
            <div>
              <label className="input-label">Almacén *</label>
              <select
                className="input-field"
                value={formData.warehouse_id}
                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
              >
                <option value="">Seleccionar almacén...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Material */}
            <div>
              <label className="input-label">Material *</label>
              <select
                className="input-field"
                value={formData.material_id}
                onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
              >
                <option value="">Seleccionar material...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.category} - {m.material_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
            <div>
              <label className="input-label">Cantidad *</label>
              <input
                type="number"
                step="1"
                min="1"
                className="input-field"
                placeholder="0"
                value={formData.quantity}
                onChange={handleQuantityChange}
              />
            </div>

            {/* Motivo */}
            <div>
              <label className="input-label">Motivo</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Compra, Requisición..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="input-label">Observaciones</label>
              <textarea
                className="input-field"
                rows="3"
                placeholder="Detalles adicionales..."
                value={formData.observations}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="secondary" onClick={() => navigate('/inventory')}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                {loading ? 'Registrando...' : 'Registrar Movimiento'}
              </Button>
            </div>

          </form>
        </Card>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </MainLayout>
  )
}