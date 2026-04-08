// ============================================================
//  OBRIX ERP — Pipeline Comercial (Kanban)
//  src/pages/comercial/PipelinePage.jsx  |  v1.0
//
//  Vista principal del módulo comercial.
//  Tablero Kanban con las 7 etapas del pipeline de DINNOVAC.
//  Drag & drop entre columnas, score de cierre, alertas.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout }  from '../../components/layout/MainLayout'
import { useToast }    from '../../hooks/useToast'
import { supabase }    from '../../config/supabase'
import {
  getPipelineKanban, getKpisPipeline, avanzarEtapa,
  ETAPAS_CONFIG, fmtMXN, fmtFecha,
  TIPO_OBRA_LABELS, ORIGEN_LABELS,
} from '../../services/comercial.service'
import {
  Plus, RefreshCw, Filter, ChevronDown,
  AlertTriangle, TrendingUp, Users,
  DollarSign, Target, Clock, Search,
  BarChart2, Eye,
} from 'lucide-react'
import NuevaOportunidadModal from './NuevaOportunidadModal'

// ─────────────────────────────────────────────────────────────
// SCORE BADGE
// ─────────────────────────────────────────────────────────────
const ScoreBadge = ({ score }) => {
  if (score == null) return null
  const cfg =
    score >= 75 ? { bg: '#D1FAE5', color: '#065F46', label: 'Alto' } :
    score >= 50 ? { bg: '#FEF3C7', color: '#92400E', label: 'Medio' } :
    score >= 25 ? { bg: '#FEE2E2', color: '#991B1B', label: 'Bajo' } :
                  { bg: '#F3F4F6', color: '#6B7280', label: 'Muy bajo' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 28, height: 5, borderRadius: 9999,
        background: '#E5E7EB', overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: cfg.color, borderRadius: 9999,
          transition: 'width 0.4s',
        }} />
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: cfg.color, background: cfg.bg,
        padding: '1px 5px', borderRadius: 5,
      }}>
        {Math.round(score)}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TARJETA DE OPORTUNIDAD
// ─────────────────────────────────────────────────────────────
const OportunidadCard = ({
  op, etapaColor, onDragStart, onDragEnd, isDragging, onClick
}) => {
  const alerta = op.alerta
  const diasStr = op.dias_en_etapa > 0
    ? `${op.dias_en_etapa}d en esta etapa`
    : 'Hoy'

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, op)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(op)}
      style={{
        background: '#fff',
        border: `1px solid ${alerta ? '#FCA5A5' : '#E5E7EB'}`,
        borderLeft: `3px solid ${alerta ? '#EF4444' : etapaColor}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 7,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'box-shadow 0.15s, opacity 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Alerta */}
      {alerta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 6, padding: '3px 7px',
          background: '#FEF2F2', borderRadius: 5,
        }}>
          <AlertTriangle size={11} color="#EF4444" />
          <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>
            Sin movimiento {op.dias_en_etapa}d
          </span>
        </div>
      )}

      {/* Folio + tipo de obra */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 10,
          color: '#9CA3AF', background: '#F9FAFB',
          padding: '1px 5px', borderRadius: 4,
          border: '0.5px solid #E5E7EB',
        }}>
          {op.folio}
        </span>
        {op.tipo_obra && (
          <span style={{ fontSize: 10, color: '#6B7280' }}>
            {TIPO_OBRA_LABELS[op.tipo_obra] ?? op.tipo_obra}
          </span>
        )}
      </div>

      {/* Nombre */}
      <p style={{
        fontSize: 12, fontWeight: 600, color: '#111827',
        margin: '0 0 3px', lineHeight: 1.35,
      }}>
        {op.nombre_proyecto}
      </p>

      {/* Cliente */}
      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px' }}>
        {op.cliente_nombre}
      </p>

      {/* Monto + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
          {fmtMXN(op.monto_estimado)}
        </span>
        <ScoreBadge score={op.score_cierre} />
      </div>

      {/* Ejecutivo + días */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 7,
        paddingTop: 7, borderTop: '0.5px solid #F3F4F6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: etapaColor + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: etapaColor,
          }}>
            {(op.ejecutivo_nombre ?? 'U')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
            {op.ejecutivo_nombre?.split(' ')[0]}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} color="#D1D5DB" />
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{diasStr}</span>
        </div>
      </div>

      {/* Próxima acción */}
      {op.proxima_accion && (
        <div style={{
          marginTop: 6, padding: '4px 7px',
          background: '#F0F9FF', borderRadius: 5,
          fontSize: 10, color: '#0369A1',
          borderLeft: '2px solid #38BDF8',
        }}>
          📅 {fmtFecha(op.proxima_accion_fecha)} — {op.proxima_accion}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COLUMNA DEL KANBAN
// ─────────────────────────────────────────────────────────────
const KanbanColumna = ({
  etapa, config, oportunidades, total,
  onDragStart, onDragEnd, onDrop, dragOver,
  onCardClick, setDragOver,
}) => {
  const isDragOver = dragOver === etapa
  const monto = oportunidades.reduce(
    (s, o) => s + (parseFloat(o.monto_estimado) || 0), 0
  )

  return (
    <div
      style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(etapa) }}
      onDrop={e => onDrop(e, etapa)}
      onDragLeave={() => setDragOver(null)}
    >
      {/* Cabecera de columna */}
      <div style={{
        padding: '8px 10px', borderRadius: '10px 10px 0 0',
        background: config.bg, marginBottom: 0,
        borderBottom: `2px solid ${config.color}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: config.color,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700, color: config.color,
            }}>
              {config.label}
            </span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: config.color, color: '#fff',
            width: 20, height: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {oportunidades.length}
          </span>
        </div>
        {monto > 0 && (
          <p style={{ fontSize: 10, color: config.color, margin: '3px 0 0', fontWeight: 600 }}>
            {fmtMXN(monto)}
          </p>
        )}
      </div>

      {/* Zona de drop */}
      <div style={{
        flex: 1, minHeight: 120,
        background: isDragOver ? config.bg : '#F9FAFB',
        border: `1px solid ${isDragOver ? config.color : '#E5E7EB'}`,
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        padding: '8px 7px',
        transition: 'background 0.15s, border-color 0.15s',
      }}>
        {oportunidades.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 10px',
            color: '#D1D5DB', fontSize: 11,
          }}>
            Sin oportunidades
          </div>
        ) : (
          oportunidades.map(op => (
            <OportunidadCard
              key={op.id}
              op={op}
              etapaColor={config.color}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={false}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { toast }                       = useToast()
  const navigate                        = useNavigate()
  const [user, setUser]                 = useState(null)
  const [companyId, setCompanyId]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [oportunidades, setOportunidades] = useState([])
  const [kpis, setKpis]                 = useState(null)
  const [showModal, setShowModal]       = useState(false)
  const [search, setSearch]             = useState('')
  const [filtroEjecutivo, setFiltroEjecutivo] = useState('')
  const [ejecutivos, setEjecutivos]     = useState([])

  // Drag & drop
  const [dragItem, setDragItem]         = useState(null)
  const [dragOver, setDragOver]         = useState(null)
  const [moviendo, setMoviendo]         = useState(false)

  // ── Cargar usuario ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase.from('users_profiles')
        .select('company_id, full_name')
        .eq('id', u.id).single()
        .then(({ data }) => {
          setUser({ ...u, ...data })
          setCompanyId(data?.company_id)
        })
    })
  }, [])

  // ── Cargar pipeline ──
  const cargar = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [{ data: ops }, { data: kpisData }, { data: execs }] = await Promise.all([
        getPipelineKanban(companyId, filtroEjecutivo || null),
        getKpisPipeline(companyId, filtroEjecutivo || null),
        supabase.from('users_profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .order('full_name'),
      ])
      setOportunidades(ops ?? [])
      setKpis(kpisData)
      setEjecutivos(execs ?? [])
    } catch (e) {
      toast.error('Error al cargar el pipeline')
    } finally {
      setLoading(false)
    }
  }, [companyId, filtroEjecutivo])

  useEffect(() => { cargar() }, [cargar])

  // ── Filtrar por búsqueda ──
  const opsFiltradas = oportunidades.filter(op => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      op.nombre_proyecto?.toLowerCase().includes(q) ||
      op.cliente_nombre?.toLowerCase().includes(q)  ||
      op.folio?.toLowerCase().includes(q)
    )
  })

  // ── Agrupar por etapa ──
  const porEtapa = Object.keys(ETAPAS_CONFIG).reduce((acc, e) => {
    acc[e] = opsFiltradas.filter(o => o.estatus === e)
    return acc
  }, {})

  // ── Drag & drop ──
  const handleDragStart = (e, op) => {
    setDragItem(op)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDragItem(null)
    setDragOver(null)
  }

  const handleDrop = async (e, nuevaEtapa) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragItem || dragItem.estatus === nuevaEtapa) return
    if (moviendo) return
    setMoviendo(true)
    try {
      await avanzarEtapa(dragItem.id, nuevaEtapa, user.id,
        `Movido a "${ETAPAS_CONFIG[nuevaEtapa]?.label}" desde el Kanban`)
      toast.success(`Movido a ${ETAPAS_CONFIG[nuevaEtapa]?.label} ✓`)
      cargar()
    } catch (e) {
      toast.error('Error al mover la oportunidad')
    } finally {
      setMoviendo(false)
      setDragItem(null)
    }
  }

  const handleCardClick = (op) => {
    navigate(`/comercial/oportunidad/${op.id}`)
  }

  // ── KPI cards ──
  const kpiCards = kpis ? [
    {
      label: 'Pipeline activo',
      value: fmtMXN(kpis.monto_pipeline),
      icon: DollarSign,
      color: '#2563EB', bg: '#EFF6FF',
    },
    {
      label: 'Ganado este año',
      value: fmtMXN(kpis.monto_ganado),
      icon: TrendingUp,
      color: '#059669', bg: '#F0FDF4',
    },
    {
      label: 'Tasa de conversión',
      value: `${kpis.tasa_conversion ?? 0}%`,
      icon: Target,
      color: '#7C3AED', bg: '#F5F3FF',
    },
    {
      label: 'Sin movimiento',
      value: kpis.ops_sin_movimiento ?? 0,
      icon: AlertTriangle,
      color: kpis.ops_sin_movimiento > 0 ? '#DC2626' : '#6B7280',
      bg: kpis.ops_sin_movimiento > 0 ? '#FEF2F2' : '#F9FAFB',
    },
  ] : []

  return (
    <MainLayout title="📊 Pipeline Comercial">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KPIs ── */}
        {kpis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {kpiCards.map(k => (
              <div key={k.label} style={{
                padding: '11px 14px',
                background: k.bg,
                borderRadius: 12,
                border: `1px solid ${k.color}22`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: k.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <k.icon size={16} color={k.color} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: k.color, margin: '0 0 2px', opacity: 0.8 }}>
                    {k.label}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: k.color, margin: 0 }}>
                    {k.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          {/* Buscador */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 9, padding: '7px 11px', flex: 1, minWidth: 200,
          }}>
            <Search size={13} color="#9CA3AF" />
            <input
              style={{
                border: 'none', outline: 'none', fontSize: 12,
                color: '#111827', background: 'transparent', flex: 1,
              }}
              placeholder="Buscar oportunidad, cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro ejecutivo */}
          <select
            value={filtroEjecutivo}
            onChange={e => setFiltroEjecutivo(e.target.value)}
            style={{
              padding: '7px 11px', borderRadius: 9, fontSize: 12,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Todos los ejecutivos</option>
            {ejecutivos.map(e => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={cargar}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 9,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer',
            }}
          >
            <RefreshCw
              size={13}
              style={loading ? { animation: 'spin 1s linear infinite' } : {}}
            />
            Actualizar
          </button>

          {/* Dashboard */}
          <button
            onClick={() => navigate('/comercial/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 9,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer',
            }}
          >
            <BarChart2 size={13} />
            Dashboard
          </button>

          {/* Nueva oportunidad */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 9, border: 'none',
              background: '#2563EB', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Nueva oportunidad
          </button>
        </div>

        {/* ── Tablero Kanban ── */}
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 60, gap: 10, color: '#9CA3AF',
          }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Cargando pipeline...</span>
          </div>
        ) : (
          <div style={{
            overflowX: 'auto', paddingBottom: 12,
          }}>
            <div style={{
              display: 'flex', gap: 10,
              minWidth: 'max-content', paddingBottom: 4,
            }}>
              {Object.entries(ETAPAS_CONFIG).map(([etapa, config]) => (
                <KanbanColumna
                  key={etapa}
                  etapa={etapa}
                  config={config}
                  oportunidades={porEtapa[etapa] ?? []}
                  total={oportunidades.length}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Estado vacío ── */}
        {!loading && oportunidades.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '50px 20px',
            background: '#fff', borderRadius: 14,
            border: '1px solid #E5E7EB',
          }}>
            <TrendingUp size={32} color="#D1D5DB"
              style={{ margin: '0 auto 12px' }} />
            <p style={{
              fontSize: 15, fontWeight: 600, color: '#374151',
              margin: '0 0 6px',
            }}>
              Sin oportunidades en el pipeline
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
              Registra tu primer lead para empezar a construir el pipeline
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: '#2563EB', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Registrar primer lead
            </button>
          </div>
        )}
      </div>

      {/* ── Modal nueva oportunidad ── */}
      {showModal && companyId && user && (
        <NuevaOportunidadModal
          companyId={companyId}
          userId={user.id}
          onSuccess={() => { setShowModal(false); cargar() }}
          onClose={() => setShowModal(false)}
          toast={toast}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
