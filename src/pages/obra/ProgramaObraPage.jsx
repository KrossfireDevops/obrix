// ============================================================
//  OBRIX ERP — Programa de Obra (Gantt Editable)
//  src/pages/obra/ProgramaObraPage.jsx  |  v2.0
//
//  Mejoras v2.0:
//    - Dependencias visibles en el Gantt como flechas
//    - Clic en actividad → ModalRecursos (Deps/Personal/Maquinaria/Herramientas)
//    - Alerta "Calculado con 1 elemento"
//    - Exportación PDF con jsPDF + autoTable
//    - Botón "Aplicar secuencia estándar OBRIX" en proyectos sin dependencias
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams }    from 'react-router-dom'
import { MainLayout }         from '../../components/layout/MainLayout'
import { RequirePermission }  from '../../components/auth/PermissionGuard'
import { useToast }           from '../../hooks/useToast'
import { supabase }           from '../../config/supabase'
import ModalRecursos          from './ModalRecursos'
import {
  getGanttData, calcularProgramaObra, recalcularAlertas,
  ajustarFechasNodo, resetearAjusteNodo, registrarAvance,
  getPersonalAsignado, asignarPersonalActividad,
  retirarPersonalActividad, upsertCuadrilla,
  getKpisPrograma, getAlertasActivas,
  getDependencias, aplicarDependenciasStd,
  SEMAFORO_CFG,
} from '../../services/programaObra.service'
import {
  RefreshCw, Users, AlertTriangle, CheckCircle,
  ChevronRight, X, Plus, UserPlus, UserMinus,
  TrendingUp, Clock, BarChart2, Zap, FileDown,
  Link2, Settings, Sparkles,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmtFecha = (f) => {
  if (!f) return '—'
  const d = new Date(f + 'T12:00:00')
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`

const inp = {
  width: '100%', padding: '7px 9px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 7,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// BADGE SEMÁFORO
// ─────────────────────────────────────────────────────────────
const SemaforoBadge = ({ semaforo, size = 'md' }) => {
  const c = SEMAFORO_CFG[semaforo] ?? SEMAFORO_CFG.sin_inicio
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'sm' ? '2px 7px' : '4px 10px',
      borderRadius: 9999, fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 600, border: `1px solid ${c.border}`,
      backgroundColor: c.bg, color: c.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%',
        backgroundColor: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// BARRA DE PROGRESO
// ─────────────────────────────────────────────────────────────
const BarraProgreso = ({ real, plan, semaforo }) => {
  const c = SEMAFORO_CFG[semaforo] ?? SEMAFORO_CFG.sin_inicio
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: '#6B7280', marginBottom: 3 }}>
        <span>Real: {fmtPct(real)}</span>
        <span>Plan: {fmtPct(plan)}</span>
      </div>
      <div style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 9999,
        position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${Math.min(plan, 100)}%`,
          backgroundColor: '#BFDBFE', borderRadius: 9999 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${Math.min(real, 100)}%`,
          backgroundColor: c.dot, borderRadius: 9999,
          transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EXPORTAR PDF
// ─────────────────────────────────────────────────────────────
const exportarPDF = async (tareas, proyectoNombre) => {
  // Cargar jsPDF dinámicamente
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }
  if (!window.jspdf?.jsPDF) return

  await new Promise((res, rej) => {
    if (window.jspdf?.jsPDF?.API?.autoTable) { res(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
    s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })

  const semColors = {
    verde:      [16, 185, 129],
    amber:      [245, 158, 11],
    rojo:       [239, 68, 68],
    sin_inicio: [156, 163, 175],
  }

  // ── Encabezado ────────────────────────────────────────────
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, 280, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('OBRIX ERP — Programa de Obra', 14, 9)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(proyectoNombre ?? 'Proyecto', 14, 15)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })}`, 280 - 14, 15, { align: 'right' })

  // ── Tabla de actividades ──────────────────────────────────
  const filas = tareas
    .filter(t => t.fecha_inicio_plan || t.fecha_inicio_adj)
    .map((t, i) => {
      const ini = t.fecha_inicio_adj ?? t.fecha_inicio_plan ?? ''
      const fin = t.fecha_fin_adj    ?? t.fecha_fin_plan    ?? ''
      return [
        i + 1,
        t.disciplina_codigo ?? '—',
        t.nombre,
        ini ? new Date(ini + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—',
        fin ? new Date(fin + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—',
        `${t.duracion_plan ?? 0}d`,
        `${Number(t.pct_avance_real || 0).toFixed(0)}%`,
        t.semaforo ?? 'sin_inicio',
      ]
    })

  doc.autoTable({
    startY: 25,
    head: [['#', 'Disc.', 'Actividad', 'Inicio', 'Fin', 'Días', 'Avance', 'Estado']],
    body: filas,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 16, halign: 'center', font: 'courier' },
      2: { cellWidth: 80 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawCell: (data) => {
      // Colorear columna Estado con el color del semáforo
      if (data.column.index === 7 && data.section === 'body') {
        const sem = data.cell.raw
        const col = semColors[sem] ?? semColors.sin_inicio
        data.doc.setFillColor(...col)
        data.doc.setTextColor(255, 255, 255)
        data.doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F')
        data.doc.setFontSize(7)
        const label = SEMAFORO_CFG[sem]?.label ?? 'Sin iniciar'
        data.doc.text(label, data.cell.x + data.cell.width / 2,
          data.cell.y + data.cell.height / 2 + 1, { align: 'center' })
      }
    },
  })

  // ── Gantt simplificado en barras ──────────────────────────
  const tareasConFechas = tareas.filter(t =>
    (t.fecha_inicio_adj ?? t.fecha_inicio_plan) &&
    (t.fecha_fin_adj    ?? t.fecha_fin_plan)
  )

  if (tareasConFechas.length > 0) {
    doc.addPage()

    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 280, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Diagrama de Gantt — Programa de Obra', 14, 8)

    const fechasMs = tareasConFechas.flatMap(t => [
      new Date((t.fecha_inicio_adj ?? t.fecha_inicio_plan) + 'T12:00:00').getTime(),
      new Date((t.fecha_fin_adj    ?? t.fecha_fin_plan)    + 'T12:00:00').getTime(),
    ])
    const minFecha  = Math.min(...fechasMs)
    const maxFecha  = Math.max(...fechasMs)
    const rangeDias = Math.max(1, (maxFecha - minFecha) / 86400000)

    const margenIzq = 80
    const anchoGantt = 180
    const altoBarra  = 4.5
    const paddingFila = 1.2
    const yInicio = 20

    const xFecha = (fecha) => {
      const ms = new Date(fecha + 'T12:00:00').getTime()
      return margenIzq + ((ms - minFecha) / (maxFecha - minFecha)) * anchoGantt
    }

    // Encabezado columnas del Gantt
    doc.setTextColor(30, 64, 175)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('Actividad', 14, yInicio - 3)
    doc.text(new Date(minFecha).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      margenIzq, yInicio - 3)
    doc.text(new Date(maxFecha).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      margenIzq + anchoGantt, yInicio - 3, { align: 'right' })

    // Línea divisoria
    doc.setDrawColor(229, 231, 235)
    doc.line(margenIzq, yInicio - 1, margenIzq + anchoGantt, yInicio - 1)

    tareasConFechas.slice(0, 40).forEach((t, i) => {
      const y = yInicio + i * (altoBarra + paddingFila)
      const ini = t.fecha_inicio_adj ?? t.fecha_inicio_plan
      const fin = t.fecha_fin_adj    ?? t.fecha_fin_plan
      const xIni = xFecha(ini)
      const xFin = Math.max(xFecha(fin), xIni + 2)
      const col  = semColors[t.semaforo] ?? semColors.sin_inicio

      // Fila de fondo alternado
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252)
        doc.rect(0, y - 0.5, 280, altoBarra + paddingFila, 'F')
      }

      // Nombre de actividad
      doc.setTextColor(17, 24, 39)
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      const nombreCorto = t.nombre.length > 35 ? t.nombre.slice(0, 33) + '…' : t.nombre
      doc.text(nombreCorto, 14, y + altoBarra / 2 + 0.5)

      // Barra del Gantt
      doc.setFillColor(...col)
      doc.roundedRect(xIni, y, Math.max(xFin - xIni, 2), altoBarra, 0.8, 0.8, 'F')

      // % avance sobre la barra
      if (t.pct_avance_real > 0) {
        doc.setFillColor(255, 255, 255, 0.4)
        const anchoAvance = (Math.max(xFin - xIni, 2)) * (Math.min(t.pct_avance_real, 100) / 100)
        doc.setFillColor(255, 255, 255)
        doc.setGState?.(doc.GState?.({ opacity: 0.35 }))
        doc.rect(xIni, y, anchoAvance, altoBarra, 'F')
        doc.setGState?.(doc.GState?.({ opacity: 1 }))
      }
    })
  }

  // ── Pie de página en todas las páginas ───────────────────
  const totalPags = doc.getNumberOfPages()
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175)
    doc.setFont('helvetica', 'normal')
    doc.text(`OBRIX ERP · ${proyectoNombre ?? ''} · Pág. ${p} de ${totalPags}`,
      140, 210, { align: 'center' })
  }

  doc.save(`Programa_Obra_${(proyectoNombre ?? 'proyecto').replace(/\s+/g, '_')}_${
    new Date().toISOString().split('T')[0]
  }.pdf`)
}

// ─────────────────────────────────────────────────────────────
// GANTT WRAPPER (frappe-gantt via CDN)
// ─────────────────────────────────────────────────────────────
const GanttChart = ({ tareas, dependencias, onDateChange, onTaskClick, viewMode }) => {
  const containerRef = useRef(null)
  const ganttRef     = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !tareas?.length) return

    const init = () => {
      if (!window.Gantt) return

      // Construir mapa de dependencias: sucesor → predecesor
      const depMap = {}
      dependencias?.forEach(d => {
        if (!depMap[d.sucesor_id]) depMap[d.sucesor_id] = []
        depMap[d.sucesor_id].push(d.predecesor_id)
      })

      const tasks = tareas.map(t => ({
        id:           t.wbs_id,
        name:         t.nombre,
        start:        (t.fecha_inicio_adj ?? t.fecha_inicio_plan ?? '').toString(),
        end:          (t.fecha_fin_adj    ?? t.fecha_fin_plan    ?? '').toString(),
        progress:     Math.round(Number(t.pct_avance_real) || 0),
        custom_class: `semaforo-${t.semaforo ?? 'sin_inicio'}`,
        // ← DEPENDENCIAS: frappe-gantt las dibuja como flechas
        dependencies: (depMap[t.wbs_id] ?? []).join(','),
      })).filter(t => t.start && t.end)

      if (!tasks.length) return

      containerRef.current.innerHTML = ''

      ganttRef.current = new window.Gantt(containerRef.current, tasks, {
        view_mode:         viewMode || 'Week',
        language:          'es',
        bar_height:        20,
        bar_corner_radius: 3,
        arrow_curve:       5,
        padding:           14,
        date_format:       'YYYY-MM-DD',
        custom_popup_html: null,
        on_date_change: (task, start, end) => {
          if (onDateChange) onDateChange(task.id, start, end)
        },
        on_click: (task) => {
          if (onTaskClick) onTaskClick(task.id)
        },
      })
    }

    if (window.Gantt) {
      init()
    } else {
      const scriptCSS = document.createElement('link')
      scriptCSS.rel  = 'stylesheet'
      scriptCSS.href = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.css'
      document.head.appendChild(scriptCSS)

      const script = document.createElement('script')
      script.src   = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.js'
      script.onload = init
      document.head.appendChild(script)
    }

    return () => {
      try { containerRef.current && (containerRef.current.innerHTML = '') }
      catch (_) {}
    }
  }, [tareas, dependencias, viewMode])

  return (
    <>
      <style>{`
        .semaforo-verde      .bar { fill: #10B981 !important; }
        .semaforo-amber      .bar { fill: #F59E0B !important; }
        .semaforo-rojo       .bar { fill: #EF4444 !important; }
        .semaforo-sin_inicio .bar { fill: #D1D5DB !important; }
        .gantt .bar-progress      { fill: rgba(255,255,255,0.35) !important; }
        .gantt .bar-label         { fill: #fff !important; font-size: 11px !important; }
        .gantt .arrow             { stroke: #6B7280 !important; stroke-width: 1.5 !important; }
        .gantt-container          { overflow-x: auto; }
        @keyframes spin           { to { transform: rotate(360deg); } }
      `}</style>
      <div ref={containerRef} className="gantt-container"
        style={{ minHeight: 200, width: '100%' }} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ProgramaObraPage() {
  const [searchParams]                          = useSearchParams()
  const { toast }                               = useToast()

  const [projects,       setProjects]           = useState([])
  const [projectId,      setProjectId]          = useState(searchParams.get('project') || '')
  const [projectNombre,  setProjectNombre]      = useState('')
  const [tareas,         setTareas]             = useState([])
  const [dependencias,   setDependencias]       = useState([])
  const [kpis,           setKpis]               = useState(null)
  const [alertas,        setAlertas]            = useState([])
  const [loading,        setLoading]            = useState(false)
  const [calculando,     setCalculando]         = useState(false)
  const [exportando,     setExportando]         = useState(false)
  const [nodoActivo,     setNodoActivo]         = useState(null)
  const [viewMode,       setViewMode]           = useState('Week')
  const [sinDeps,        setSinDeps]            = useState(false)

  // Cargar proyectos activos
  useEffect(() => {
    supabase.from('projects').select('id, name, code, status')
      .eq('status', 'active').order('code')
      .then(({ data }) => {
        setProjects(data ?? [])
        if (!projectId && data?.length) {
          setProjectId(data[0].id)
          setProjectNombre(data[0].name)
        }
      })
  }, [])

  const cargar = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [ganttData, kpisData, alertasData, depsData] = await Promise.all([
        getGanttData(projectId),
        getKpisPrograma(projectId),
        getAlertasActivas(projectId),
        getDependencias(projectId),
      ])
      setTareas(ganttData)
      setKpis(kpisData)
      setAlertas(alertasData)
      setDependencias(depsData)
      setSinDeps(depsData.length === 0)
    } catch (e) {
      toast.error('Error al cargar el programa: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { cargar() }, [cargar])

  // Actualizar nombre del proyecto al cambiar selector
  useEffect(() => {
    const p = projects.find(p => p.id === projectId)
    if (p) setProjectNombre(p.name)
  }, [projectId, projects])

  const handleCalcular = async () => {
    if (!projectId) return
    setCalculando(true)
    try {
      const n = await calcularProgramaObra(projectId, false)
      await recalcularAlertas(projectId)
      toast.success(`Programa calculado — ${n} actividades procesadas ✓`)
      cargar()
    } catch (e) {
      toast.error('Error al calcular: ' + e.message)
    } finally {
      setCalculando(false)
    }
  }

  const handleRecalcular = async () => {
    if (!projectId) return
    setCalculando(true)
    try {
      const n = await calcularProgramaObra(projectId, true)
      await recalcularAlertas(projectId)
      toast.success(`Programa recalculado — ${n} nodos ✓`)
      cargar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCalculando(false)
    }
  }

  const handleAplicarSecuenciaStd = async () => {
    if (!projectId) return
    if (!confirm('¿Aplicar la secuencia estándar OBRIX a este proyecto? Se crearán dependencias basadas en la lógica constructiva estándar.')) return
    setCalculando(true)
    try {
      const n = await aplicarDependenciasStd(projectId)
      toast.success(`✅ ${n} dependencias aplicadas — recalculando programa…`)
      await calcularProgramaObra(projectId, true)
      await recalcularAlertas(projectId)
      cargar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCalculando(false)
    }
  }

  const handleDateChange = async (wbsId, start, end) => {
    if (!projectId) return
    try {
      const ini = typeof start === 'string' ? start : start.toISOString().split('T')[0]
      const fin = typeof end   === 'string' ? end   : end.toISOString().split('T')[0]
      await ajustarFechasNodo(projectId, wbsId, ini, fin)
      await recalcularAlertas(projectId)
      cargar()
    } catch (e) {
      toast.error('Error al ajustar fechas: ' + e.message)
    }
  }

  const handleTaskClick = (wbsId) => {
    const nodo = tareas.find(t => t.wbs_id === wbsId)
    if (nodo) setNodoActivo(nodo)
  }

  const handleExportarPDF = async () => {
    if (!tareas.length) { toast.error('No hay actividades para exportar'); return }
    setExportando(true)
    try {
      await exportarPDF(tareas, projectNombre)
      toast.success('PDF generado ✓')
    } catch (e) {
      toast.error('Error al generar PDF: ' + e.message)
    } finally {
      setExportando(false)
    }
  }

  const sinPrograma = tareas.length === 0 && !loading

  return (
    <RequirePermission module="projects" action="view">
      <MainLayout title="📊 Programa de Obra">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

          {/* ── Toolbar superior ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 14, flexWrap: 'wrap' }}>

            <select
              value={projectId}
              onChange={e => {
                setProjectId(e.target.value)
                setNodoActivo(null)
                setTareas([])
                setDependencias([])
              }}
              style={{ ...inp, width: 'auto', minWidth: 220, padding: '8px 12px',
                fontSize: 13, fontWeight: 600 }}>
              <option value="">— Seleccionar proyecto —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code ? `[${p.code}] ` : ''}{p.name}
                </option>
              ))}
            </select>

            {/* Zoom Gantt */}
            <div style={{ display: 'flex', gap: 0, border: '1px solid #E5E7EB',
              borderRadius: 8, overflow: 'hidden' }}>
              {['Day','Week','Month'].map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ padding: '7px 14px', border: 'none', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer',
                    backgroundColor: viewMode === m ? '#2563EB' : '#fff',
                    color: viewMode === m ? '#fff' : '#374151' }}>
                  {m === 'Day' ? 'Día' : m === 'Week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>

              {/* Alerta secuencia estándar */}
              {sinDeps && projectId && !sinPrograma && (
                <button onClick={handleAplicarSecuenciaStd} disabled={calculando}
                  style={{ display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF',
                    color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Sparkles size={13} />
                  Aplicar secuencia OBRIX
                </button>
              )}

              {/* Exportar PDF */}
              {!sinPrograma && projectId && (
                <button onClick={handleExportarPDF} disabled={exportando}
                  style={{ display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB',
                    color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  {exportando
                    ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <FileDown size={13} />}
                  Exportar PDF
                </button>
              )}

              {sinPrograma && projectId && (
                <button onClick={handleCalcular} disabled={calculando}
                  style={{ display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    backgroundColor: calculando ? '#93C5FD' : '#2563EB',
                    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {calculando
                    ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Zap size={14} />}
                  Generar programa
                </button>
              )}

              {!sinPrograma && projectId && (
                <button onClick={handleRecalcular} disabled={calculando}
                  style={{ display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB',
                    color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  {calculando
                    ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <RefreshCw size={13} />}
                  Recalcular
                </button>
              )}
            </div>
          </div>

          {/* ── Alerta: sin dependencias configuradas ── */}
          {sinDeps && !sinPrograma && projectId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 10, marginBottom: 12 }}>
              <Link2 size={15} color="#2563EB" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#1E40AF', margin: 0 }}>
                <strong>Sin dependencias configuradas.</strong> Las actividades no tienen
                secuencia lógica definida — todos inician en la misma fecha.
                Usa <strong>Aplicar secuencia OBRIX</strong> para aplicar la lógica
                constructiva estándar, o configúralas manualmente haciendo clic en cada actividad.
              </p>
            </div>
          )}

          {/* ── KPIs ── */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
              gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Avance global',  value: fmtPct(kpis.pct_avance_global),
                  color: '#065F46', bg: '#F0FDF4', icon: TrendingUp },
                { label: 'En tiempo',      value: kpis.actividades_en_tiempo ?? 0,
                  color: '#065F46', bg: '#F0FDF4', icon: CheckCircle },
                { label: 'Atención',       value: kpis.actividades_amber ?? 0,
                  color: '#B45309', bg: '#FFFBEB', icon: Clock },
                { label: 'Críticas',       value: kpis.actividades_rojo ?? 0,
                  color: '#991B1B', bg: '#FEF2F2', icon: AlertTriangle },
                { label: 'Completadas',    value: kpis.actividades_completadas ?? 0,
                  color: '#1E40AF', bg: '#EFF6FF', icon: BarChart2 },
              ].map(k => {
                const Icon = k.icon
                return (
                  <div key={k.label} style={{ padding: '10px 14px',
                    backgroundColor: k.bg, borderRadius: 10,
                    border: `1px solid ${k.color}22`,
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} color={k.color} style={{ flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 10, color: k.color, fontWeight: 600,
                        margin: '0 0 1px', opacity: 0.8 }}>{k.label}</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: k.color, margin: 0 }}>
                        {k.value}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Área principal: Gantt ── */}
          <div style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 14,
            overflow: 'hidden', backgroundColor: '#fff', minHeight: 400 }}>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px',
              minWidth: 0, position: 'relative', height: '100%' }}>

              {!projectId ? (
                <div style={{ display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#9CA3AF', gap: 10 }}>
                  <BarChart2 size={32} color="#D1D5DB" />
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>
                    Selecciona un proyecto
                  </p>
                </div>
              ) : loading ? (
                <div style={{ display: 'flex', alignItems: 'center',
                  justifyContent: 'center', height: '100%', color: '#9CA3AF', gap: 10 }}>
                  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Cargando programa…</span>
                </div>
              ) : sinPrograma ? (
                <div style={{ display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#9CA3AF', gap: 12 }}>
                  <Zap size={32} color="#D1D5DB" />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
                      Sin programa generado
                    </p>
                    <p style={{ fontSize: 12, margin: '0 0 16px', maxWidth: 280 }}>
                      Haz clic en "Generar programa" para calcular las fechas
                      del WBS usando el calendario activo del proyecto.
                    </p>
                    <button onClick={handleCalcular} disabled={calculando}
                      style={{ display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 20px', borderRadius: 10, border: 'none',
                        backgroundColor: '#2563EB', color: '#fff', fontSize: 14,
                        fontWeight: 600, cursor: 'pointer', margin: '0 auto' }}>
                      <Zap size={16} /> Generar programa
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px' }}>
                    💡 Haz <strong>clic en cualquier barra</strong> para gestionar
                    dependencias, personal, maquinaria y herramientas de esa actividad.
                  </p>
                  <GanttChart
                    tareas={tareas}
                    dependencias={dependencias}
                    viewMode={viewMode}
                    onDateChange={handleDateChange}
                    onTaskClick={handleTaskClick}
                  />
                </>
              )}
            </div>
          </div>

          {/* ── Alertas activas ── */}
          {alertas.length > 0 && (
            <div style={{ marginTop: 12, padding: '12px 16px',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#991B1B',
                margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Actividades en riesgo
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {alertas.slice(0, 6).map(a => (
                  <button key={a.id}
                    onClick={() => {
                      const nodo = tareas.find(t => t.wbs_id === a.wbs_id)
                      if (nodo) setNodoActivo(nodo)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 8,
                      border: `1px solid ${a.semaforo === 'rojo' ? '#FECACA' : '#FDE68A'}`,
                      backgroundColor: a.semaforo === 'rojo' ? '#FEF2F2' : '#FFFBEB',
                      cursor: 'pointer' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: a.semaforo === 'rojo' ? '#EF4444' : '#F59E0B',
                      flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 500,
                      color: a.semaforo === 'rojo' ? '#991B1B' : '#B45309' }}>
                      {a.nodo?.nombre ?? 'Actividad'}
                    </span>
                    {a.dias_atraso > 0 && (
                      <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>
                        -{a.dias_atraso}d
                      </span>
                    )}
                  </button>
                ))}
                {alertas.length > 6 && (
                  <span style={{ fontSize: 11, color: '#9CA3AF', padding: '5px 0' }}>
                    +{alertas.length - 6} más
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Modal de Recursos ── */}
        {nodoActivo && (
          <ModalRecursos
            nodo={nodoActivo}
            projectId={projectId}
            tareas={tareas}
            onClose={() => setNodoActivo(null)}
            onRecalcular={handleRecalcular}
            toast={toast}
          />
        )}

      </MainLayout>
    </RequirePermission>
  )
}