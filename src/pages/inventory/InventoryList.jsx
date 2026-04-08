import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { Plus, Package, AlertTriangle, TrendingUp, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as inventoryService from '../../services/inventory.service'

const ITEMS_PER_PAGE = 15

export const InventoryList = () => {
  const [inventory, setInventory]               = useState([])
  const [loading, setLoading]                   = useState(true)
  const [stats, setStats]                       = useState({ totalItems: 0, totalQuantity: 0, lowStock: 0 })
  const [searchTerm, setSearchTerm]             = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [warehouses, setWarehouses]             = useState([])

  // ── Paginación ──
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadWarehouses()
    loadInventory()
    loadStats()
  }, [selectedWarehouse])

  // Resetear página al cambiar búsqueda o almacén
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedWarehouse])

  const loadWarehouses = async () => {
    const { data } = await inventoryService.getWarehouses()
    setWarehouses(data || [])
  }

  const loadInventory = async () => {
    setLoading(true)
    try {
      const { data, error } = await inventoryService.getInventory(selectedWarehouse || null)
      if (error) throw error
      setInventory(data || [])
    } catch (error) {
      console.error('Error cargando inventario:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const stats = await inventoryService.getInventoryStats(selectedWarehouse || null)
    setStats(stats)
  }

  // ── Filtrado ──
  const filteredInventory = inventory.filter((item) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      item.materials_catalog?.material_type?.toLowerCase().includes(search) ||
      item.materials_catalog?.category?.toLowerCase().includes(search)
    )
  })

  // ── Paginación ──
  const totalPages    = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE)
  const paginatedData = filteredInventory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <MainLayout title="📦 Inventario">
      <div className="space-y-6">

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Materiales</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cantidad Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {parseFloat(stats.totalQuantity || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Stock Bajo</p>
                <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Almacenes</p>
                <p className="text-2xl font-bold text-gray-900">{warehouses.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros y Acciones */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 flex gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar material..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {warehouses.length > 0 && (
              <select
                className="input-field"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">Todos los almacenes</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>

          <Link to="/inventory/new">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Movimiento
            </Button>
          </Link>
        </div>

        {/* Tabla de Inventario */}
        <Card title={`Inventario Actual (${filteredInventory.length} items)`}>
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-cell-header">Material</th>
                  <th className="table-cell-header">Categoría</th>
                  <th className="table-cell-header">Cantidad</th>
                  <th className="table-cell-header">Unidad</th>
                  <th className="table-cell-header">Almacén</th>
                  <th className="table-cell-header">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                        <span className="ml-3 text-gray-500">Cargando inventario...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <p className="text-gray-500">No hay inventario registrado aún.</p>
                      <p className="text-gray-400 text-sm mt-2">
                        Registra un movimiento para comenzar.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="table-row">
                      <td className="table-cell font-medium text-gray-900">
                        {item.materials_catalog?.material_type || 'N/A'}
                      </td>
                      <td className="table-cell">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          {item.materials_catalog?.category || 'N/A'}
                        </span>
                      </td>
                      <td className="table-cell font-semibold">
                        {parseFloat(item.quantity).toFixed(2)}
                      </td>
                      <td className="table-cell text-gray-500">
                        {item.materials_catalog?.default_unit || 'Pieza'}
                      </td>
                      <td className="table-cell text-gray-600">
                        {item.warehouses?.name || 'N/A'}
                      </td>
                      <td className="table-cell">
                        {parseFloat(item.quantity) < 10 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Stock Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Paginación ── */}
          {!loading && filteredInventory.length > ITEMS_PER_PAGE && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredInventory.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </Card>

      </div>
    </MainLayout>
  )
}