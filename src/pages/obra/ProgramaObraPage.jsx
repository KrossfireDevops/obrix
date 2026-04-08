// ============================================================
//  OBRIX ERP — Programa de Obra (Gantt Editable)
//  src/pages/obra/ProgramaObraPage.jsx  |  v1.0
//
//  Características:
//    · Gantt editable con frappe-gantt (drag & drop de fechas)
//    · Panel lateral: semáforo, avance real, cuadrilla, personal
//    · KPIs superiores: avance global, actividades en riesgo
//    · Captura de avance real por actividad
//    · Asignación / retiro de personal por actividad
//    · Simulador de recuperación (personas adicionales)
//    · Selector de proyecto
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams }    from 'react-router-dom'
import { MainLayout }         from '../../components/layout/MainLayout'
import { RequirePermission }  from '../../components/auth/PermissionGuard'
import { useToast }           from '../../hooks/useToast'
import { supabase }           from '../../config/supabase'
import {
  getGanttData, calcularProgramaObra, recalcularAlertas,
  ajustarFechasNodo, resetearAjusteNodo, registrarAvance,
  getPersonalAsignado, asignarPersonalActividad,
  retirarPersonalActividad, upsertCuadrilla,
  getKpisPrograma, getAlertasActivas,
  SEMAFORO_CFG,
} from '../../services/programaObra.service'
import { getPersonal } from '../../services/gestionPersonal.service'
import {
  RefreshCw, Users, AlertTriangle, CheckCircle,
  ChevronRight, X, Plus, UserPlus, UserMinus,
  TrendingUp, Clock, BarChart2, Zap,
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
// BADGE DE SEMÁFORO
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
// PANEL LATERAL — Detalle de la actividad seleccionada
// ─────────────────────────────────────────────────────────────
const PanelActividad = ({ nodo, projectId, onClose, onActualizar, toast }) => {
  const [personal,      setPersonal]      = useState([])
  const [catalogoPers,  setCatalogoPers]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showAvance,    setShowAvance]    = useState(false)
  const [showAsignar,   setShowAsignar]   = useState(false)
  const [formAvance,    setFormAvance]    = useState({
    pct_avance: nodo.pct_avance_real ?? 0,
    fecha_corte: new Date().toISOString().split('T')[0],
    personas_dia: '',
    notas: '',
  })
  const [formAsig,    setFormAsig]    = useState({ trabajadorId: '', es_lider: false, rol_actividad: '' })
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    Promise.all([
      getPersonalAsignado(nodo.wbs_id),
      getPersonal({ estatus: 'activo' }),
    ]).then(([pers, cat]) => {
      setPersonal(pers)
      setCatalogoPers(Array.isArray(cat) ? cat : (cat?.data ?? []))
      setLoading(false)
    })
  }, [nodo.wbs_id])

  const handleGuardarAvance = async () => {
    if (!formAvance.pct_avance && formAvance.pct_avance !== 0) {
      toast.error('Ingresa el porcentaje de avance'); return
    }
    setSaving(true)
    try {
      await registrarAvance(projectId, nodo.wbs_id, {
        pct_avance:   formAvance.pct_avance,
        fecha_corte:  formAvance.fecha_corte,
        personas_dia: formAvance.personas_dia || null,
        notas:        formAvance.notas || null,
        pct_avance_plan: nodo.pct_avance_plan,
      })
      await recalcularAlertas(projectId)
      toast.success('Avance registrado ✓')
      setShowAvance(false)
      onActualizar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAsignar = async () => {
    if (!formAsig.trabajadorId) { toast.error('Selecciona un trabajador'); return }
    setSaving(true)
    try {
      await asignarPersonalActividad(projectId, nodo.wbs_id, formAsig.trabajadorId, {
        es_lider:      formAsig.es_lider,
        rol_actividad: formAsig.rol_actividad || null,
      })
      toast.success('Personal asignado ✓')
      setShowAsignar(false)
      setFormAsig({ trabajadorId: '', es_lider: false, rol_actividad: '' })
      const pers = await getPersonalAsignado(nodo.wbs_id)
      setPersonal(pers)
      onActualizar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRetirar = async (asigId) => {
    if (!confirm('¿Retirar este trabajador de la actividad?')) return
    try {
      await retirarPersonalActividad(asigId)
      toast.success('Trabajador retirado')
      const pers = await getPersonalAsignado(nodo.wbs_id)
      setPersonal(pers)
      onActualizar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const semCfg = SEMAFORO_CFG[nodo.semaforo] ?? SEMAFORO_CFG.sin_inicio

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {nodo.disciplina_color && (
                <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                  backgroundColor: nodo.disciplina_color }} />
              )}
              <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
                {nodo.disciplina_codigo ?? '—'}
              </span>
              <SemaforoBadge semaforo={nodo.semaforo} size="sm" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827',
              margin: 0, lineHeight: 1.3 }}>{nodo.nombre}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: '#9CA3AF', padding: 3, flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

        {/* Fechas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Inicio plan', value: fmtFecha(nodo.fecha_inicio_plan) },
            { label: 'Fin plan',    value: fmtFecha(nodo.fecha_fin_plan)    },
            { label: 'Duración',    value: `${nodo.duracion_plan ?? 0} días hábiles` },
            { label: 'Días atraso', value: nodo.dias_atraso > 0
                ? <span style={{ color: '#DC2626', fontWeight: 700 }}>{nodo.dias_atraso}d</span>
                : <span style={{ color: '#065F46' }}>En tiempo</span> },
          ].map(f => (
            <div key={f.label} style={{ padding: '8px 9px', backgroundColor: '#F9FAFB',
              borderRadius: 7, border: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>
                {f.label}
              </p>
              <p style={{ fontSize: 12, color: '#111827', margin: 0, fontWeight: 500 }}>
                {f.value}
              </p>
            </div>
          ))}
        </div>

        {/* Avance */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Avance
            </p>
            <button onClick={() => setShowAvance(!showAvance)}
              style={{ fontSize: 11, color: '#2563EB', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showAvance ? 'Cancelar' : '+ Capturar'}
            </button>
          </div>

          <BarraProgreso
            real={nodo.pct_avance_real}
            plan={nodo.pct_avance_plan}
            semaforo={nodo.semaforo}
          />

          {showAvance && (
            <div style={{ marginTop: 10, padding: 10, backgroundColor: '#F0F9FF',
              border: '1px solid #BAE6FD', borderRadius: 9 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                    % avance real *
                  </label>
                  <input type="number" min="0" max="100" step="0.5" style={inp}
                    value={formAvance.pct_avance}
                    onChange={e => setFormAvance(f => ({ ...f, pct_avance: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                    Fecha corte
                  </label>
                  <input type="date" style={inp} value={formAvance.fecha_corte}
                    onChange={e => setFormAvance(f => ({ ...f, fecha_corte: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                    Personas·día
                  </label>
                  <input type="number" min="0" style={inp}
                    placeholder="Ej: 14"
                    value={formAvance.personas_dia}
                    onChange={e => setFormAvance(f => ({ ...f, personas_dia: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                    Notas
                  </label>
                  <input type="text" style={inp} placeholder="Observaciones..."
                    value={formAvance.notas}
                    onChange={e => setFormAvance(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                <button onClick={() => setShowAvance(false)}
                  style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7,
                    border: '1px solid #E5E7EB', backgroundColor: '#fff',
                    cursor: 'pointer', color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={handleGuardarAvance} disabled={saving}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7,
                    border: 'none', backgroundColor: '#2563EB', color: '#fff',
                    cursor: 'pointer', fontWeight: 600, display: 'flex',
                    alignItems: 'center', gap: 4 }}>
                  {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                  Guardar avance
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cuadrilla */}
        <div style={{ marginBottom: 14, padding: 10,
          backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 9 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Cuadrilla
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Planeada', value: nodo.personas_plan ?? 1, color: '#1E40AF' },
              { label: 'Actual',   value: nodo.personas_real ?? 0, color: '#065F46' },
              { label: 'Adicionales',
                value: nodo.personas_adicionales > 0
                  ? `+${nodo.personas_adicionales}` : '—',
                color: nodo.personas_adicionales > 0 ? '#DC2626' : '#6B7280' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 2px',
                  fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: m.color, margin: 0 }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
          {nodo.personas_adicionales > 0 && (
            <div style={{ marginTop: 8, padding: '5px 8px',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6 }}>
              <p style={{ fontSize: 10, color: '#991B1B', margin: 0 }}>
                Se necesitan <strong>{nodo.personas_adicionales} personas adicionales</strong>{' '}
                para cumplir la fecha compromiso.
              </p>
            </div>
          )}
        </div>

        {/* Personal asignado */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Personal en actividad
            </p>
            <button onClick={() => setShowAsignar(!showAsignar)}
              style={{ fontSize: 11, color: '#2563EB', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4 }}>
              <UserPlus size={12} /> Asignar
            </button>
          </div>

          {showAsignar && (
            <div style={{ padding: 10, backgroundColor: '#F0FDF4',
              border: '1px solid #A7F3D0', borderRadius: 9, marginBottom: 10 }}>
              <div style={{ marginBottom: 7 }}>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Trabajador *
                </label>
                <select style={inp} value={formAsig.trabajadorId}
                  onChange={e => setFormAsig(f => ({ ...f, trabajadorId: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {catalogoPers
                    .filter(p => !personal.some(pa => pa.trabajador_id === p.id))
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_completo}{p.especialidad ? ` · ${p.especialidad}` : ''}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div style={{ marginBottom: 7 }}>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Rol en actividad
                </label>
                <input type="text" style={inp} placeholder="Oficial, Ayudante, Supervisor..."
                  value={formAsig.rol_actividad}
                  onChange={e => setFormAsig(f => ({ ...f, rol_actividad: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: '#374151', cursor: 'pointer', marginBottom: 8 }}>
                <input type="checkbox" checked={formAsig.es_lider}
                  onChange={e => setFormAsig(f => ({ ...f, es_lider: e.target.checked }))}
                  style={{ accentColor: '#2563EB' }} />
                Líder de actividad
              </label>
              <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAsignar(false)}
                  style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7,
                    border: '1px solid #E5E7EB', backgroundColor: '#fff',
                    cursor: 'pointer', color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={handleAsignar} disabled={saving || !formAsig.trabajadorId}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7,
                    border: 'none', backgroundColor: '#059669', color: '#fff',
                    cursor: 'pointer', fontWeight: 600, display: 'flex',
                    alignItems: 'center', gap: 4 }}>
                  {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#9CA3AF' }}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : personal.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#9CA3AF' }}>
              <Users size={20} style={{ margin: '0 auto 4px', opacity: 0.3 }} />
              <p style={{ fontSize: 11 }}>Sin personal asignado</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {personal.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 9px', backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB', borderRadius: 7 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    color: '#1E40AF', flexShrink: 0 }}>
                    {(p.trabajador?.nombre_completo ?? '?')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827',
                      margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {p.trabajador?.nombre_completo ?? '—'}
                      {p.es_lider && (
                        <span style={{ fontSize: 9, fontWeight: 700,
                          backgroundColor: '#FEF9C3', color: '#B45309',
                          padding: '0 5px', borderRadius: 4 }}>Líder</span>
                      )}
                    </p>
                    <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
                      {p.rol_actividad ?? p.trabajador?.especialidad ?? '—'}
                    </p>
                  </div>
                  <button onClick={() => handleRetirar(p.id)}
                    title="Retirar de actividad"
                    style={{ padding: 5, border: 'none', background: 'none',
                      cursor: 'pointer', color: '#9CA3AF' }}>
                    <UserMinus size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// GANTT WRAPPER (frappe-gantt via CDN)
// ─────────────────────────────────────────────────────────────
const GanttChart = ({ tareas, onDateChange, onTaskClick, viewMode }) => {
  const containerRef = useRef(null)
  const ganttRef     = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !tareas?.length) return

    const init = () => {
      if (!window.Gantt) return

      const tasks = tareas.map(t => ({
        id:         t.wbs_id,
        name:       t.nombre,
        start:      (t.fecha_inicio_adj ?? t.fecha_inicio_plan ?? '').toString(),
        end:        (t.fecha_fin_adj    ?? t.fecha_fin_plan    ?? '').toString(),
        progress:   Math.round(Number(t.pct_avance_real) || 0),
        custom_class: `semaforo-${t.semaforo ?? 'sin_inicio'}`,
        dependencies: '',
      })).filter(t => t.start && t.end)

      if (!tasks.length) return

      containerRef.current.innerHTML = ''

      ganttRef.current = new window.Gantt(containerRef.current, tasks, {
        view_mode:          viewMode || 'Week',
        language:           'es',
        bar_height:         20,
        bar_corner_radius:  3,
        arrow_curve:        5,
        padding:            14,
        date_format:        'YYYY-MM-DD',
        custom_popup_html:  null,
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
      if (ganttRef.current) {
        try { containerRef.current && (containerRef.current.innerHTML = '') }
        catch (_) {}
      }
    }
  }, [tareas, viewMode])

  return (
    <>
      <style>{`
        .semaforo-verde     .bar { fill: #10B981 !important; }
        .semaforo-amber     .bar { fill: #F59E0B !important; }
        .semaforo-rojo      .bar { fill: #EF4444 !important; }
        .semaforo-sin_inicio .bar { fill: #D1D5DB !important; }
        .gantt .bar-progress { fill: rgba(255,255,255,0.35) !important; }
        .gantt .bar-label { fill: #fff !important; font-size: 11px !important; }
        .gantt-container { overflow-x: auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
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

  const [projects,      setProjects]            = useState([])
  const [projectId,     setProjectId]           = useState(searchParams.get('project') || '')
  const [tareas,        setTareas]              = useState([])
  const [kpis,          setKpis]                = useState(null)
  const [alertas,       setAlertas]             = useState([])
  const [loading,       setLoading]             = useState(false)
  const [calculando,    setCalculando]          = useState(false)
  const [nodoActivo,    setNodoActivo]          = useState(null)
  const [viewMode,      setViewMode]            = useState('Week')

  // Cargar proyectos activos
  useEffect(() => {
    supabase.from('projects').select('id, name, code, status')
      .eq('status', 'active').order('code')
      .then(({ data }) => {
        setProjects(data ?? [])
        if (!projectId && data?.length) setProjectId(data[0].id)
      })
  }, [])

  const cargar = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [ganttData, kpisData, alertasData] = await Promise.all([
        getGanttData(projectId),
        getKpisPrograma(projectId),
        getAlertasActivas(projectId),
      ])
      setTareas(ganttData)
      setKpis(kpisData)
      setAlertas(alertasData)
    } catch (e) {
      toast.error('Error al cargar el programa: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { cargar() }, [cargar])

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

  const nodoActivoData = nodoActivo
    ? tareas.find(t => t.wbs_id === nodoActivo.wbs_id) ?? nodoActivo
    : null

  const sinPrograma = tareas.length === 0 && !loading

  return (
    <RequirePermission module="projects" action="view">
      <MainLayout title="📊 Programa de Obra">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

          {/* ── Toolbar superior ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 14, flexWrap: 'wrap' }}>

            {/* Selector de proyecto */}
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); setNodoActivo(null) }}
              style={{ ...inp, width: 'auto', minWidth: 220, padding: '8px 12px',
                fontSize: 13, fontWeight: 600 }}>
              <option value="">— Seleccionar proyecto —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code ? `[${p.code}] ` : ''}{p.name}
                </option>
              ))}
            </select>

            {/* Zoom del Gantt */}
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

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
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

          {/* ── KPIs ── */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
              gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Avance global', value: fmtPct(kpis.pct_avance_global),
                  color: '#065F46', bg: '#F0FDF4', icon: TrendingUp },
                { label: 'En tiempo', value: kpis.actividades_en_tiempo ?? 0,
                  color: '#065F46', bg: '#F0FDF4', icon: CheckCircle },
                { label: 'Atención', value: kpis.actividades_amber ?? 0,
                  color: '#B45309', bg: '#FFFBEB', icon: Clock },
                { label: 'Críticas', value: kpis.actividades_rojo ?? 0,
                  color: '#991B1B', bg: '#FEF2F2', icon: AlertTriangle },
                { label: 'Completadas', value: kpis.actividades_completadas ?? 0,
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

          {/* ── Área principal: Gantt + Panel ── */}
          <div style={{ flex: 1, display: 'flex', gap: 0,
            border: '1px solid #E5E7EB', borderRadius: 14,
            overflow: 'hidden', backgroundColor: '#fff', minHeight: 400 }}>

            {/* Gantt */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px',
              minWidth: 0, position: 'relative' }}>

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
                <GanttChart
                  tareas={tareas}
                  viewMode={viewMode}
                  onDateChange={handleDateChange}
                  onTaskClick={handleTaskClick}
                />
              )}
            </div>

            {/* Panel lateral */}
            {nodoActivoData && (
              <div style={{ width: 320, borderLeft: '1px solid #E5E7EB',
                display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <PanelActividad
                  nodo={nodoActivoData}
                  projectId={projectId}
                  onClose={() => setNodoActivo(null)}
                  onActualizar={cargar}
                  toast={toast}
                />
              </div>
            )}
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
      </MainLayout>
    </RequirePermission>
  )
}
