// src/pages/reports/ProjectsProgressReport.jsx
import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { Download, TrendingUp, CheckCircle, Clock, AlertCircle, XCircle, Home, Building2, Factory } from 'lucide-react'
import * as reportsService from '../../services/reports.service'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ─── Helpers ────────────────────────────────────────────────────────────────

const PROJECT_TYPE_LABEL = { RESIDENCIAL: 'Residencial', EDIFICIO: 'Edificio', INDUSTRIAL: 'Industrial' }
const PROJECT_TYPE_ICON  = { RESIDENCIAL: Home, EDIFICIO: Building2, INDUSTRIAL: Factory }

const STATUS_CONFIG = {
  PENDIENTE:   { label: 'Pendiente',   color: 'bg-gray-100 text-gray-600'   },
  EN_PROGRESO: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700'   },
  COMPLETADO:  { label: 'Completado',  color: 'bg-green-100 text-green-700' },
  BLOQUEADO:   { label: 'Bloqueado',   color: 'bg-red-100 text-red-700'     },
  CANCELADO:   { label: 'Cancelado',   color: 'bg-gray-100 text-gray-400'   },
  active:      { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  on_hold:     { label: 'En Pausa',    color: 'bg-yellow-100 text-yellow-700'},
  completed:   { label: 'Terminado',   color: 'bg-blue-100 text-blue-700'   },
  cancelled:   { label: 'Cancelado',   color: 'bg-gray-100 text-gray-400'   },
}

const progressColor = (p) => {
  if (p >= 100) return 'bg-green-500'
  if (p >= 60)  return 'bg-blue-500'
  if (p >= 30)  return 'bg-yellow-500'
  return 'bg-gray-300'
}

const ProgressBar = ({ value, showLabel = true }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${progressColor(value)}`}
        style={{ width: `${value}%` }}
      />
    </div>
    {showLabel && <span className="text-sm font-bold text-gray-700 w-10 text-right">{value}%</span>}
  </div>
)

// ─── Export PDF ──────────────────────────────────────────────────────────────

const exportToPDF = (data) => {
  const doc = new jsPDF()
  const now = new Date().toLocaleString('es-MX')

  // Encabezado
  doc.setFontSize(16)
  doc.setTextColor(37, 99, 235)
  doc.text('Obrix — Reporte General de Avance por Proyecto', 14, 18)
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Generado: ${now}`, 14, 25)

  let y = 32

  data.forEach((project, idx) => {
    if (y > 240) { doc.addPage(); y = 20 }

    // Cabecera del proyecto
    doc.setFillColor(239, 246, 255)
    doc.rect(14, y, 182, 10, 'F')
    doc.setFontSize(11)
    doc.setTextColor(29, 78, 216)
    doc.text(`${idx + 1}. ${project.name}`, 16, y + 7)
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(`${PROJECT_TYPE_LABEL[project.project_type] || '-'} | Avance: ${project.avgProgress}% | Presupuesto: $${project.budget ? Number(project.budget).toLocaleString('es-MX') : 'N/A'}`, 16, y + 15)
    y += 20

    // Resumen de nodos
    doc.autoTable({
      startY: y,
      head: [['Total Nodos', 'Completados', 'En Progreso', 'Pendientes', 'Bloqueados']],
      body: [[
        project.totalNodes,
        project.completados,
        project.enProgreso,
        project.pendientes,
        project.bloqueados
      ]],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      margin: { left: 14, right: 14 },
      tableWidth: 182
    })
    y = doc.lastAutoTable.finalY + 4

    // Desglose por nodo raíz
    if (project.rootNodes?.length > 0) {
      doc.autoTable({
        startY: y,
        head: [['Sección / Nodo', '% Avance']],
        body: project.rootNodes.map(n => [n.name, `${Math.round(n.progress_percent)}%`]),
        theme: 'striped',
        headStyles: { fillColor: [148, 163, 184], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        tableWidth: 182
      })
      y = doc.lastAutoTable.finalY + 8
    }
  })

  doc.save(`Reporte_Avance_Proyectos_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ─── Export Excel ────────────────────────────────────────────────────────────

const exportToExcel = (data) => {
  const rows = []

  data.forEach(project => {
    rows.push({
      'Proyecto':       project.name,
      'Tipo':           PROJECT_TYPE_LABEL[project.project_type] || '-',
      'Estado':         STATUS_CONFIG[project.status]?.label || project.status,
      'Avance %':       project.avgProgress,
      'Total Nodos':    project.totalNodes,
      'Completados':    project.completados,
      'En Progreso':    project.enProgreso,
      'Pendientes':     project.pendientes,
      'Bloqueados':     project.bloqueados,
      'Presupuesto':    project.budget || '',
      'Sección':        '',
      'Avance Sección': ''
    })

    project.rootNodes?.forEach(node => {
      rows.push({
        'Proyecto':       '',
        'Tipo':           '',
        'Estado':         '',
        'Avance %':       '',
        'Total Nodos':    '',
        'Completados':    '',
        'En Progreso':    '',
        'Pendientes':     '',
        'Bloqueados':     '',
        'Presupuesto':    '',
        'Sección':        `  └ ${node.name}`,
        'Avance Sección': `${Math.round(node.progress_percent)}%`
      })
    })

    rows.push({}) // Fila vacía entre proyectos
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Avance por Proyecto')
  XLSX.writeFile(wb, `Reporte_Avance_Proyectos_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ─── Componente Principal ────────────────────────────────────────────────────

export const ProjectsProgressReport = () => {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const { toast }             = useToast()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: result, error } = await reportsService.getProjectsProgress()
    if (error) {
      toast.error('Error al cargar el reporte: ' + error.message)
    } else {
      setData(result || [])
    }
    setLoading(false)
  }

  const handleExport = (format) => {
    if (!data?.length) { toast.warning('No hay datos para exportar'); return }
    try {
      format === 'pdf' ? exportToPDF(data) : exportToExcel(data)
      toast.success(`✅ Reporte exportado en ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Error al exportar: ' + err.message)
    }
  }

  // Totales globales
  const totals = data.reduce((acc, p) => ({
    proyectos:    acc.proyectos    + 1,
    totalNodos:   acc.totalNodos   + p.totalNodes,
    completados:  acc.completados  + p.completados,
    enProgreso:   acc.enProgreso   + p.enProgreso,
    pendientes:   acc.pendientes   + p.pendientes,
    bloqueados:   acc.bloqueados   + p.bloqueados,
  }), { proyectos: 0, totalNodos: 0, completados: 0, enProgreso: 0, pendientes: 0, bloqueados: 0 })

  const globalProgress = data.length > 0
    ? Math.round(data.reduce((sum, p) => sum + p.avgProgress, 0) / data.length)
    : 0

  return (
    <MainLayout title="📊 Avance General por Proyecto">
      <div className="space-y-6">

        {/* Botones de exportar */}
        <div className="flex justify-end gap-2">
          <Button onClick={() => handleExport('pdf')} variant="secondary" disabled={loading || !data.length}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button onClick={() => handleExport('excel')} variant="secondary" disabled={loading || !data.length}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>

        {/* KPIs globales */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Proyectos',    value: totals.proyectos,   color: 'text-primary-600'  },
              { label: 'Total Nodos',  value: totals.totalNodos,  color: 'text-gray-700'     },
              { label: 'Completados',  value: totals.completados, color: 'text-green-600'    },
              { label: 'En Progreso',  value: totals.enProgreso,  color: 'text-blue-600'     },
              { label: 'Pendientes',   value: totals.pendientes,  color: 'text-yellow-600'   },
              { label: 'Bloqueados',   value: totals.bloqueados,  color: 'text-red-600'      },
            ].map(k => (
              <Card key={k.label} className="text-center py-3">
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Progreso global */}
        {!loading && data.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Avance Global de todos los Proyectos</h3>
              <span className="text-lg font-bold text-primary-600">{globalProgress}%</span>
            </div>
            <ProgressBar value={globalProgress} showLabel={false} />
          </Card>
        )}

        {/* Lista de proyectos */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
              <span className="ml-3 text-gray-500">Cargando reporte...</span>
            </div>
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay proyectos activos</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.map(project => {
              const Icon       = PROJECT_TYPE_ICON[project.project_type] || Building2
              const statusCfg  = STATUS_CONFIG[project.status] || {}

              return (
                <Card key={project.id}>
                  {/* Encabezado del proyecto */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{PROJECT_TYPE_LABEL[project.project_type] || '-'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                            {statusCfg.label || project.status}
                          </span>
                          {project.budget && (
                            <span className="text-xs text-gray-400">
                              💰 ${Number(project.budget).toLocaleString('es-MX')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">{project.avgProgress}%</p>
                      <p className="text-xs text-gray-400">avance general</p>
                    </div>
                  </div>

                  {/* Barra de progreso general */}
                  <div className="mb-4">
                    <ProgressBar value={project.avgProgress} showLabel={false} />
                  </div>

                  {/* Contadores de estado */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: 'Completados', value: project.completados, icon: CheckCircle,  color: 'text-green-600'  },
                      { label: 'En Progreso', value: project.enProgreso,  icon: Clock,        color: 'text-blue-600'   },
                      { label: 'Pendientes',  value: project.pendientes,  icon: AlertCircle,  color: 'text-yellow-600' },
                      { label: 'Bloqueados',  value: project.bloqueados,  icon: XCircle,      color: 'text-red-600'    },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center">
                        <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Desglose por nodo raíz */}
                  {project.rootNodes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        Avance por Sección ({project.rootNodes.length} secciones)
                      </p>
                      <div className="space-y-2">
                        {project.rootNodes.map(node => (
                          <div key={node.id} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-36 truncate flex-shrink-0">{node.name}</span>
                            <div className="flex-1">
                              <ProgressBar value={Math.round(node.progress_percent)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}