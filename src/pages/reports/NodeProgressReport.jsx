// src/pages/reports/NodeProgressReport.jsx
import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { Download, CheckCircle, User, Paperclip, ChevronRight, Filter } from 'lucide-react'
import * as reportsService from '../../services/reports.service'
import * as projectsService from '../../services/projectNodes.service'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDIENTE:   { label: 'Pendiente',   color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400'  },
  EN_PROGRESO: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'  },
  COMPLETADO:  { label: 'Completado',  color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  BLOQUEADO:   { label: 'Bloqueado',   color: 'bg-red-100 text-red-700',     dot: 'bg-red-500'   },
  CANCELADO:   { label: 'Cancelado',   color: 'bg-gray-100 text-gray-400',   dot: 'bg-gray-300'  },
}

const progressColor = (p) => {
  if (p >= 100) return 'bg-green-500'
  if (p >= 60)  return 'bg-blue-500'
  if (p >= 30)  return 'bg-yellow-500'
  return 'bg-gray-300'
}

// ─── Export PDF ──────────────────────────────────────────────────────────────

const exportToPDF = (project, nodes) => {
  const doc = new jsPDF()
  const now = new Date().toLocaleString('es-MX')

  doc.setFontSize(16)
  doc.setTextColor(37, 99, 235)
  doc.text('Obrix — Reporte de Avance por Nodo', 14, 18)

  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)
  doc.text(`Proyecto: ${project.name}`, 14, 27)

  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Generado: ${now}`, 14, 33)

  doc.autoTable({
    startY: 38,
    head: [['Jerarquía / Nodo', 'Estado', 'Avance', 'Responsable', 'Validado', 'Archivos']],
    body: nodes.map(n => [
      n.breadcrumb,
      STATUS_CONFIG[n.status]?.label || n.status,
      `${Math.round(n.progress_percent)}%`,
      n.responsible_name || '-',
      n.is_validated ? '✓ Sí' : 'No',
      n.attachmentsCount || 0
    ]),
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 35 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
    },
    margin: { left: 14, right: 14 }
  })

  doc.save(`Reporte_Nodos_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ─── Export Excel ────────────────────────────────────────────────────────────

const exportToExcel = (project, nodes) => {
  const rows = nodes.map(n => ({
    'Proyecto':    project.name,
    'Jerarquía':   n.breadcrumb,
    'Nodo':        n.name,
    'Tipo':        n.node_type || '-',
    'Estado':      STATUS_CONFIG[n.status]?.label || n.status,
    'Avance %':    Math.round(n.progress_percent),
    'Responsable': n.responsible_name || '-',
    'Validado':    n.is_validated ? 'Sí' : 'No',
    'Archivos':    n.attachmentsCount || 0,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Avance por Nodo')
  XLSX.writeFile(wb, `Reporte_Nodos_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ─── Componente Principal ────────────────────────────────────────────────────

export const NodeProgressReport = () => {
  const [projects, setProjects]       = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [reportData, setReportData]   = useState(null)
  const [loading, setLoading]         = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const { toast } = useToast()

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    setLoadingProjects(true)
    const { data, error } = await projectsService.getProjects()
    if (error) toast.error('Error al cargar proyectos')
    else setProjects(data || [])
    setLoadingProjects(false)
  }

  const loadReport = async () => {
    if (!selectedProject) { toast.warning('Selecciona un proyecto'); return }
    setLoading(true)
    const { data, error } = await reportsService.getNodesByProjectReport(selectedProject)
    if (error) {
      toast.error('Error al cargar el reporte: ' + error.message)
      setReportData(null)
    } else {
      setReportData(data)
    }
    setLoading(false)
  }

  const handleExport = (format) => {
    if (!reportData) { toast.warning('Primero genera el reporte'); return }
    try {
      format === 'pdf'
        ? exportToPDF(reportData.project, reportData.nodes)
        : exportToExcel(reportData.project, reportData.nodes)
      toast.success(`✅ Reporte exportado en ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Error al exportar: ' + err.message)
    }
  }

  // Totales del reporte cargado
  const totals = reportData ? {
    total:       reportData.nodes.length,
    completados: reportData.nodes.filter(n => n.status === 'COMPLETADO').length,
    enProgreso:  reportData.nodes.filter(n => n.status === 'EN_PROGRESO').length,
    pendientes:  reportData.nodes.filter(n => n.status === 'PENDIENTE').length,
    bloqueados:  reportData.nodes.filter(n => n.status === 'BLOQUEADO').length,
    validados:   reportData.nodes.filter(n => n.is_validated).length,
    avgProgress: reportData.nodes.length > 0
      ? Math.round(reportData.nodes.reduce((s, n) => s + parseFloat(n.progress_percent || 0), 0) / reportData.nodes.length)
      : 0
  } : null

  return (
    <MainLayout title="🔍 Avance por Nodo">
      <div className="space-y-6">

        {/* Filtro de proyecto */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">Seleccionar Proyecto</h3>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="input-label">Proyecto</label>
              <select
                className="input-field"
                value={selectedProject}
                onChange={(e) => { setSelectedProject(e.target.value); setReportData(null) }}
                disabled={loadingProjects}
              >
                <option value="">
                  {loadingProjects ? 'Cargando proyectos...' : 'Seleccionar proyecto...'}
                </option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <Button onClick={loadReport} variant="primary" disabled={!selectedProject || loading}>
              {loading ? 'Generando...' : 'Generar Reporte'}
            </Button>
          </div>
        </Card>

        {/* Botones export — solo si hay datos */}
        {reportData && (
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900">{reportData.project.name}</h3>
              <p className="text-sm text-gray-400">
                {totals.total} nodos · Avance promedio: <span className="font-semibold text-primary-600">{totals.avgProgress}%</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleExport('pdf')} variant="secondary">
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button onClick={() => handleExport('excel')} variant="secondary">
                <Download className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </div>
        )}

        {/* KPIs */}
        {reportData && totals && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {[
              { label: 'Total',        value: totals.total,       color: 'text-gray-700'    },
              { label: 'Completados',  value: totals.completados, color: 'text-green-600'   },
              { label: 'En Progreso',  value: totals.enProgreso,  color: 'text-blue-600'    },
              { label: 'Pendientes',   value: totals.pendientes,  color: 'text-yellow-600'  },
              { label: 'Bloqueados',   value: totals.bloqueados,  color: 'text-red-600'     },
              { label: 'Validados',    value: totals.validados,   color: 'text-emerald-600' },
              { label: 'Avance Prom.', value: `${totals.avgProgress}%`, color: 'text-primary-600' },
            ].map(k => (
              <Card key={k.label} className="text-center py-2">
                <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Tabla de nodos */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
              <span className="ml-3 text-gray-500">Generando reporte...</span>
            </div>
          </Card>
        ) : reportData ? (
          <Card>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell-header">Jerarquía / Nodo</th>
                    <th className="table-cell-header">Estado</th>
                    <th className="table-cell-header">Avance</th>
                    <th className="table-cell-header">Responsable</th>
                    <th className="table-cell-header text-center">Validado</th>
                    <th className="table-cell-header text-center">Archivos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.nodes.map(node => {
                    const statusCfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.PENDIENTE
                    const parts = node.breadcrumb.split(' > ')

                    return (
                      <tr key={node.id} className="hover:bg-gray-50">
                        {/* Jerarquía con breadcrumb visual */}
                        <td className="table-cell">
                          <div className="flex items-center gap-1 flex-wrap">
                            {parts.map((part, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                                <span className={`text-xs ${
                                  i === parts.length - 1
                                    ? 'font-semibold text-gray-900'
                                    : 'text-gray-400'
                                }`}>
                                  {part}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </div>
                        </td>

                        {/* Avance */}
                        <td className="table-cell" style={{ minWidth: '120px' }}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progressColor(node.progress_percent)}`}
                                style={{ width: `${node.progress_percent}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-8 text-right">
                              {Math.round(node.progress_percent)}%
                            </span>
                          </div>
                        </td>

                        {/* Responsable */}
                        <td className="table-cell">
                          {node.responsible_name
                            ? <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm text-gray-600">{node.responsible_name}</span>
                              </div>
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>

                        {/* Validado */}
                        <td className="table-cell text-center">
                          {node.is_validated
                            ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>

                        {/* Archivos */}
                        <td className="table-cell text-center">
                          {node.attachmentsCount > 0
                            ? <div className="flex items-center justify-center gap-1">
                                <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-medium text-gray-600">{node.attachmentsCount}</span>
                              </div>
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : !loading && selectedProject ? null : (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <Filter className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un proyecto y presiona "Generar Reporte"</p>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}