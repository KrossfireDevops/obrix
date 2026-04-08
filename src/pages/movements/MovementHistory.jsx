import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { ToastContainer } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { Package, ArrowDownCircle, ArrowUpCircle, Trash2, Search, FileText, FileSpreadsheet } from 'lucide-react'
import * as movementsService from '../../services/movements.service'
import * as inventoryService from '../../services/inventory.service'
import { exportMovementsToPDF, exportMovementsToExcel } from '../../utils/export.utils'

const ITEMS_PER_PAGE = 15

const typeConfig = {
  'ENTRADA':     { label: 'Entrada',     color: 'bg-green-100 text-green-800',   icon: '📥' },
  'SALIDA':      { label: 'Salida',      color: 'bg-blue-100 text-blue-800',     icon: '📤' },
  'DAÑO':        { label: 'Daño',        color: 'bg-red-100 text-red-800',       icon: '⚠️' },
  'DESPERDICIO': { label: 'Desperdicio', color: 'bg-orange-100 text-orange-800', icon: '🗑️' },
  'PERDIDA':     { label: 'Pérdida',     color: 'bg-gray-100 text-gray-800',     icon: '❌' },
  'AJUSTE':      { label: 'Ajuste',      color: 'bg-purple-100 text-purple-800', icon: '🔧' },
}

export const MovementHistory = () => {
  const { toasts, toast, removeToast } = useToast()

  const [movements, setMovements]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [stats, setStats]               = useState({ movementsToday: 0, totalEntries: 0, totalExits: 0 })
  const [searchTerm, setSearchTerm]     = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [warehouses, setWarehouses]     = useState([])
  const [exporting, setExporting]       = useState(false)
  const [currentPage, setCurrentPage]   = useState(1)

  // ── ConfirmDialog state ──
  const [confirm, setConfirm] = useState({ open: false, id: null })

  useEffect(() => {
    loadWarehouses()
    loadMovements()
    loadStats()
  }, [selectedType, selectedWarehouse])

  useEffect(() => { setCurrentPage(1) }, [searchTerm, selectedType, selectedWarehouse])

  const loadWarehouses = async () => {
    const { data } = await inventoryService.getWarehouses()
    setWarehouses(data || [])
  }

  const loadMovements = async () => {
    setLoading(true)
    try {
      const filters = {}
      if (selectedType)      filters.type         = selectedType
      if (selectedWarehouse) filters.warehouse_id = selectedWarehouse
      const { data, error } = await movementsService.getMovements(filters)
      if (error) throw error
      setMovements(data || [])
    } catch (error) {
      toast.error('No se pudieron cargar los movimientos')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const stats = await movementsService.getMovementStats(selectedWarehouse || null)
    setStats(stats)
  }

  // ── Eliminar con ConfirmDialog ──
  const handleDeleteClick = (id) => setConfirm({ open: true, id })

  const handleDeleteConfirm = async () => {
    try {
      await movementsService.deleteMovement(confirm.id)
      setConfirm({ open: false, id: null })
      loadMovements()
      toast.success('Movimiento eliminado correctamente')
    } catch (error) {
      setConfirm({ open: false, id: null })
      toast.error('No se pudo eliminar el movimiento')
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const filters = {
        type:      selectedType ? typeConfig[selectedType]?.label : '',
        warehouse: warehouses.find(w => w.id === selectedWarehouse)?.name || '',
        search:    searchTerm
      }
      exportMovementsToPDF(filteredMovements, filters)
      toast.success('Archivo PDF descargado exitosamente')
    } catch (error) {
      toast.error('No se pudo exportar el PDF')
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      exportMovementsToExcel(filteredMovements)
      toast.success('Archivo Excel descargado exitosamente')
    } catch (error) {
      toast.error('No se pudo exportar el Excel')
    } finally {
      setExporting(false)
    }
  }

  const filteredMovements = movements.filter((item) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      item.materials_catalog?.material_type?.toLowerCase().includes(search) ||
      item.materials_catalog?.category?.toLowerCase().includes(search) ||
      item.reason?.toLowerCase().includes(search)
    )
  })

  const totalPages    = Math.ceil(filteredMovements.length / ITEMS_PER_PAGE)
  const paginatedData = filteredMovements.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <MainLayout title="📋 Historial de Movimientos">
      <div className="space-y-6">

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Movimientos Hoy</p>
                <p className="text-2xl font-bold text-gray-900">{stats.movementsToday}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Entradas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEntries}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDownCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Salidas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalExits}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowUpCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros y Exportación */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por material, motivo..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="input-field" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(typeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.icon} {config.label}</option>
              ))}
            </select>
            {warehouses.length > 0 && (
              <select className="input-field" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
                <option value="">Todos los almacenes</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExportPDF} disabled={exporting || filteredMovements.length === 0}>
              <FileText className="w-4 h-4 mr-2" />{exporting ? '...' : 'PDF'}
            </Button>
            <Button variant="secondary" onClick={handleExportExcel} disabled={exporting || filteredMovements.length === 0}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />{exporting ? '...' : 'Excel'}
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <Card title={`Historial de Movimientos (${filteredMovements.length} registros)`}>
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-cell-header">Fecha</th>
                  <th className="table-cell-header">Tipo</th>
                  <th className="table-cell-header">Material</th>
                  <th className="table-cell-header">Cantidad</th>
                  <th className="table-cell-header">Almacén</th>
                  <th className="table-cell-header">Motivo</th>
                  <th className="table-cell-header text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                      <span className="ml-3 text-gray-500">Cargando movimientos...</span>
                    </div>
                  </td></tr>
                ) : paginatedData.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center">
                    <p className="text-gray-500">No hay movimientos registrados aún.</p>
                    <p className="text-gray-400 text-sm mt-2">Registra un movimiento desde Inventario → Nuevo Movimiento</p>
                  </td></tr>
                ) : (
                  paginatedData.map((movement) => {
                    const type = typeConfig[movement.type] || { label: movement.type, color: 'bg-gray-100 text-gray-800', icon: '📄' }
                    return (
                      <tr key={movement.id} className="table-row">
                        <td className="table-cell text-sm text-gray-500">
                          {new Date(movement.created_at).toLocaleDateString('es-MX', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${type.color}`}>
                            <span className="mr-1">{type.icon}</span>{type.label}
                          </span>
                        </td>
                        <td className="table-cell font-medium text-gray-900">
                          {movement.materials_catalog?.material_type || 'N/A'}
                          <p className="text-xs text-gray-500">{movement.materials_catalog?.category || ''}</p>
                        </td>
                        <td className="table-cell">
                          <span className={`font-semibold ${movement.type === 'ENTRADA' ? 'text-green-600' : 'text-red-600'}`}>
                            {movement.type === 'ENTRADA' ? '+' : '-'}{parseFloat(movement.quantity).toFixed(2)}
                          </span>
                        </td>
                        <td className="table-cell text-gray-600 text-sm">{movement.warehouses?.name || 'N/A'}</td>
                        <td className="table-cell text-gray-500 text-sm">{movement.reason || '-'}</td>
                        <td className="table-cell text-right">
                          <button
                            onClick={() => handleDeleteClick(movement.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredMovements.length > ITEMS_PER_PAGE && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredMovements.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </Card>

      </div>

      {/* ── Toast + ConfirmDialog ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog
        isOpen={confirm.open}
        title="Eliminar movimiento"
        message="¿Estás seguro? Esta acción eliminará el registro permanentemente."
        confirmLabel="Sí, eliminar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirm({ open: false, id: null })}
      />
    </MainLayout>
  )
}