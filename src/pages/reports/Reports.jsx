import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { FileText, Package, TrendingUp, AlertTriangle, Download, Calendar, Filter } from 'lucide-react'
import * as reportsService from '../../services/reports.service'
import * as inventoryService from '../../services/inventory.service'
import { exportMovementsToPDF, exportMovementsToExcel } from '../../utils/export.utils'

const reportTypes = [
  { id: 'stock', name: 'Stock por Almacén', icon: '📦', color: 'bg-blue-500' },
  { id: 'movements', name: 'CARDEX por Fecha', icon: '📋', color: 'bg-green-500' },
  { id: 'top', name: 'Top Materiales', icon: '🏆', color: 'bg-yellow-500' },
  { id: 'losses', name: 'Salidas y Mermas', icon: '⚠️', color: 'bg-red-500' },
  { id: 'executive', name: 'Resumen Ejecutivo', icon: '📊', color: 'bg-purple-500' },
]

export const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('stock')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    warehouseId: ''
  })

  // ✅ FIX 1: Separar efectos — warehouses solo carga una vez
  useEffect(() => {
    loadWarehouses()
  }, [])

  // ✅ FIX 1: loadReport solo se dispara cuando cambia el tipo de reporte
  useEffect(() => {
    loadReport()
  }, [selectedReport])

  const loadWarehouses = async () => {
    const { data } = await inventoryService.getWarehouses()
    setWarehouses(data || [])
  }

  const loadReport = async () => {
    setLoading(true)
    try {
      let reportData = null

      // ✅ FIX 2: Desenvolver correctamente el patrón { data, error } de Supabase
      switch (selectedReport) {
        case 'stock': {
          const result = await reportsService.getStockByWarehouse()
          if (result.error) throw result.error
          reportData = result.data
          break
        }
        case 'movements': {
          const result = await reportsService.getMovementsByDateRange(
            filters.startDate,
            filters.endDate,
            filters.warehouseId || null
          )
          if (result.error) throw result.error
          reportData = result.data
          break
        }
        case 'top': {
          const result = await reportsService.getTopMaterials(10)
          if (result.error) throw result.error
          reportData = result.data
          break
        }
        case 'losses': {
          const result = await reportsService.getLossesReport(filters.startDate, filters.endDate)
          if (result.error) throw result.error
          reportData = result.data
          break
        }
        case 'executive': {
          const result = await reportsService.getExecutiveSummary()
          if (result.error) throw result.error
          reportData = result.data
          break
        }
        default:
          break
      }

      setData(reportData)
    } catch (error) {
      console.error('Error cargando reporte:', error)
      alert('Error al cargar el reporte: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format = 'pdf') => {
    if (!data) return

    const reportName =
      reportTypes.find(r => r.id === selectedReport)?.name || 'Reporte'

    try {
      switch (selectedReport) {
        case 'movements':
        case 'losses':
          if (format === 'pdf') {
            exportMovementsToPDF(data, {
              type: reportName,
              startDate: filters.startDate,
              endDate: filters.endDate
            })
          } else {
            exportMovementsToExcel(data, {
              type: reportName,
              startDate: filters.startDate,
              endDate: filters.endDate
            })
          }
          break

        case 'stock':
        case 'top':
          if (format === 'pdf') {
            exportMovementsToPDF(data, { type: reportName })
          } else {
            exportMovementsToExcel(data, { type: reportName })
          }
          break

        // ✅ FIX 5: Reporte ejecutivo tiene su propia lógica de export
        // data aquí es un objeto, no un array de movimientos
        case 'executive':
          if (format === 'pdf') {
            exportMovementsToPDF(data, { type: reportName, isExecutive: true })
          } else {
            exportMovementsToExcel(data, { type: reportName, isExecutive: true })
          }
          break

        default:
          alert('Tipo de reporte no soportado')
          break
      }
    } catch (error) {
      console.error('Error exportando:', error)
      alert('Error al exportar el reporte')
    }
  }

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-500">Generando reporte...</span>
        </div>
      )
    }

    if (!data) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>No hay datos para mostrar</p>
        </div>
      )
    }

    switch (selectedReport) {
      case 'stock':
        return renderStockReport(data)
      case 'movements':
        return renderMovementsReport(data)
      case 'top':
        return renderTopMaterialsReport(data)
      case 'losses':
        return renderLossesReport(data)
      case 'executive':
        return renderExecutiveReport(data)
      default:
        return null
    }
  }

  const renderStockReport = (data) => {
    // ✅ Guardia de seguridad
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <p className="text-center text-gray-500 py-8">
          No hay stock registrado
        </p>
      )
    }

    const grouped = data.reduce((acc, item) => {
      const warehouse = item.warehouses?.name || 'Sin Almacén'
      if (!acc[warehouse]) acc[warehouse] = []
      acc[warehouse].push(item)
      return acc
    }, {})

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([warehouse, items]) => (
          <div key={warehouse} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">📦 {warehouse}</h4>
              <p className="text-sm text-gray-500">{items.length} materiales</p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Material</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Categoría</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cantidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.materials_catalog?.material_type || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.materials_catalog?.category || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {Math.round(parseFloat(item.quantity))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.materials_catalog?.default_unit || 'Pieza'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  const renderMovementsReport = (data) => {
    // ✅ Guardia de seguridad
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <p className="text-center text-gray-500 py-8">
          No hay movimientos en el período seleccionado
        </p>
      )
    }

    return (
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(m.created_at).toLocaleDateString('es-MX', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    m.type === 'ENTRADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {m.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {m.materials_catalog?.material_type || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm font-semibold">
                  {m.type === 'ENTRADA' ? '+' : '-'}{Math.round(parseFloat(m.quantity))}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {m.warehouses?.name || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {m.reason || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderTopMaterialsReport = (data) => {
    // ✅ Guardia de seguridad
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <p className="text-center text-gray-500 py-8">
          No hay materiales registrados
        </p>
      )
    }

    return (
      <div className="grid gap-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-lg font-bold text-yellow-700">
                #{idx + 1}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{item.material_type}</p>
                <p className="text-sm text-gray-500">{item.category}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Movimientos</p>
              <p className="text-xl font-bold text-gray-900">{item.movimientos}</p>
              <p className="text-xs text-gray-400">
                📥 {Math.round(item.entradas)} {item.unit} | 📤 {Math.round(item.salidas)} {item.unit}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderLossesReport = (data) => {
    // ✅ FIX 3: Guardia antes del reduce para evitar crash con array vacío o null
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <p className="text-center text-gray-500 py-8">
          No hay mermas en el período seleccionado
        </p>
      )
    }

    const totalLosses = data.reduce((sum, m) => sum + parseFloat(m.quantity || 0), 0)

    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">Total de Mermas</p>
              <p className="text-2xl font-bold text-red-700">{Math.round(totalLosses)} unidades</p>
            </div>
          </div>
        </div>

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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(m.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {m.materials_catalog?.material_type || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-red-600">
                    {Math.round(parseFloat(m.quantity))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {m.warehouses?.name || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {m.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderExecutiveReport = (data) => {
    // ✅ Guardia de seguridad
    if (!data) {
      return (
        <p className="text-center text-gray-500 py-8">
          No hay datos para el resumen ejecutivo
        </p>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center py-6 bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl text-white">
          <h3 className="text-2xl font-bold mb-2">📊 Resumen Ejecutivo Obrix</h3>
          <p className="text-primary-100">Generado: {data.fechaGeneracion}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Total Materiales</p>
            <p className="text-3xl font-bold text-primary-600">{data.totalMateriales ?? 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Total Movimientos</p>
            <p className="text-3xl font-bold text-green-600">{data.totalMovimientos ?? 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Stock Total</p>
            {/* ✅ FIX 4: Optional chaining para evitar crash si el dato no existe */}
            <p className="text-3xl font-bold text-blue-600">{Math.round(data.totalStock ?? 0)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Almacenes</p>
            <p className="text-3xl font-bold text-purple-600">{data.totalAlmacenes ?? 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Entradas</p>
            {/* ✅ FIX 4: Optional chaining en movimientosPorTipo */}
            <p className="text-3xl font-bold text-green-600">{data.movimientosPorTipo?.ENTRADA ?? 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Salidas</p>
            <p className="text-3xl font-bold text-red-600">
              {(data.movimientosPorTipo?.SALIDA ?? 0) + (data.movimientosPorTipo?.DAÑO ?? 0)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <MainLayout title="📄 Centro de Reportes">
      <div className="space-y-6">
        {/* Selector de Tipo de Reporte */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Reporte</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {reportTypes.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedReport === report.id
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{report.icon}</div>
                <div className="text-sm font-medium">{report.name}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Filtros */}
        {(selectedReport === 'movements' || selectedReport === 'losses') && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="input-label">Fecha Inicio</label>
                <input
                  type="date"
                  className="input-field"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Fecha Fin</label>
                <input
                  type="date"
                  className="input-field"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Almacén</label>
                <select
                  className="input-field"
                  value={filters.warehouseId}
                  onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value })}
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={loadReport} variant="primary" className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Contenido del Reporte */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {reportTypes.find(r => r.id === selectedReport)?.name}
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport('pdf')}
                variant="secondary"
                disabled={loading || !data}
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button
                onClick={() => handleExport('excel')}
                variant="secondary"
                disabled={loading || !data}
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
          {renderReportContent()}
        </Card>
      </div>
    </MainLayout>
  )
}