// ============================================================
//  OBRIX ERP — Consolidado de Gastos
//  src/pages/gastos/ConsolidadoPage.jsx  |  v1.0
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import {
  BarChart2, TrendingDown, RefreshCw,
  Download, Filter, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  getConsolidadoGastos, getKpisGastos,
  CATEGORIA_CFG, fmtMXN,
} from '../../services/gastos.service'
import { supabase } from '../../config/supabase'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

const primerDiaMes = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}
const hoy = () => new Date().toISOString().split('T')[0]

const pct = (monto, total) => total > 0 ? ((monto / total) * 100).toFixed(1) : '0.0'

// ─────────────────────────────────────────────────────────────
// BARRA DE PORCENTAJE
// ─────────────────────────────────────────────────────────────
const BarraPct = ({ valor, total, color = '#2563EB' }) => {
  const pctVal = total > 0 ? Math.min((valor / total) * 100, 100) : 0
  return (
    <div style={{ height: 4, backgroundColor: '#F3F4F6', borderRadius: 9999,
      overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${pctVal}%`,
        backgroundColor: color, borderRadius: 9999, transition: 'width 0.4s' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FILA DE AGRUPACIÓN
// ─────────────────────────────────────────────────────────────
const FilaAgrupada = ({ titulo, filas, totalGlobal, colorAccent }) => {
  const [expandido, setExpandido] = useState(false)
  const subtotal = filas.reduce((s, f) => s + parseFloat(f.monto_total ?? 0), 0)
  const nd       = filas.reduce((s, f) => s + parseFloat(f.monto_nd ?? 0), 0)

  return (
    <>
      {/* Fila de grupo */}
      <tr style={{ cursor: 'pointer', backgroundColor: '#F9FAFB' }}
        onClick={() => setExpandido(!expandido)}>
        <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#111827' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {expandido
              ? <ChevronDown size={13} color="#9CA3AF" />
              : <ChevronRight size={13} color="#9CA3AF" />}
            <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0,
              backgroundColor: colorAccent }} />
            {titulo}
          </div>
        </td>
        <td style={{ padding: '9px 14px', fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
          {filas.reduce((s, f) => s + parseInt(f.total_gastos ?? 0), 0)}
        </td>
        <td style={{ padding: '9px 14px' }}>
          <div style={{ display: 'flex', align: 'center', gap: 8 }}>
            <BarraPct valor={subtotal} total={totalGlobal} color={colorAccent} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', minWidth: 80, textAlign: 'right' }}>
              {fmtMXN(subtotal)}
            </span>
          </div>
        </td>
        <td style={{ padding: '9px 14px', fontSize: 12, color: '#065F46', textAlign: 'right' }}>
          {fmtMXN(subtotal - nd)}
        </td>
        <td style={{ padding: '9px 14px', fontSize: 11, textAlign: 'right' }}>
          {nd > 0
            ? <span style={{ color: '#DC2626', fontWeight: 600 }}>{fmtMXN(nd)}</span>
            : <span style={{ color: '#D1D5DB' }}>—</span>}
        </td>
        <td style={{ padding: '9px 14px', fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
          {pct(subtotal, totalGlobal)}%
        </td>
      </tr>

      {/* Filas detalle */}
      {expandido && filas.map((f, i) => (
        <tr key={i} style={{ backgroundColor: '#fff', borderTop: '1px solid #F3F4F6' }}>
          <td style={{ padding: '7px 14px 7px 34px', fontSize: 11, color: '#374151' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF',
                backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>
                {f.cuenta_codigo ?? '—'}
              </span>
              {f.tipo_nombre}
            </div>
          </td>
          <td style={{ padding: '7px 14px', fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
            {f.total_gastos}
          </td>
          <td style={{ padding: '7px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarraPct valor={f.monto_total} total={subtotal} color="#BFDBFE" />
              <span style={{ fontSize: 11, color: '#374151', minWidth: 80, textAlign: 'right' }}>
                {fmtMXN(f.monto_total)}
              </span>
            </div>
          </td>
          <td style={{ padding: '7px 14px', fontSize: 11, color: '#065F46', textAlign: 'right' }}>
            {fmtMXN(f.monto_deducible)}
          </td>
          <td style={{ padding: '7px 14px', fontSize: 11, textAlign: 'right' }}>
            {parseFloat(f.monto_nd) > 0
              ? <span style={{ color: '#DC2626' }}>{fmtMXN(f.monto_nd)}</span>
              : <span style={{ color: '#D1D5DB' }}>—</span>}
          </td>
          <td style={{ padding: '7px 14px', fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
            {pct(f.monto_total, subtotal)}%
          </td>
        </tr>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ConsolidadoPage() {
  const { toast }                       = useToast()
  const [filas,       setFilas]         = useState([])
  const [kpis,        setKpis]          = useState({})
  const [projects,    setProjects]      = useState([])
  const [loading,     setLoading]       = useState(true)
  const [filtros, setFiltros] = useState({
    desde:     primerDiaMes(),
    hasta:     hoy(),
    projectId: '',
  })

  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v }))

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [data, k] = await Promise.all([
        getConsolidadoGastos(filtros.desde, filtros.hasta, filtros.projectId || null),
        getKpisGastos(filtros.projectId || null),
      ])
      setFilas(data); setKpis(k)
    } catch (e) {
      toast.error('Error al cargar el consolidado')
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    supabase.from('projects').select('id, code, name').eq('status', 'active').order('code')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  // Agrupar filas por categoría
  const porCategoria = filas.reduce((acc, f) => {
    const cat = f.categoria ?? 'gastos_generales'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {})

  const totalGlobal   = filas.reduce((s, f) => s + parseFloat(f.monto_total ?? 0), 0)
  const totalDed      = filas.reduce((s, f) => s + parseFloat(f.monto_deducible ?? 0), 0)
  const totalND       = filas.reduce((s, f) => s + parseFloat(f.monto_nd ?? 0), 0)

  const exportarCSV = () => {
    const cols = ['Centro costo','Proyecto','Categoría','Tipo','Cuenta','Gastos','Monto total','Deducible','No deducible']
    const rows = filas.map(f => [
      f.centro_costo ?? '', f.project_name ?? '', f.categoria ?? '',
      f.tipo_nombre ?? '', f.cuenta_codigo ?? '',
      f.total_gastos, f.monto_total, f.monto_deducible, f.monto_nd,
    ])
    const csv = [cols, ...rows].map(r => r.join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `gastos-consolidado-${filtros.desde}-${filtros.hasta}.csv`
    a.click()
  }

  return (
    <MainLayout title="📊 Consolidado de Gastos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[
            { label: 'Total gastado',   value: fmtMXN(kpis.monto_total ?? 0),      color: '#1E40AF', bg: '#EFF6FF', small: true },
            { label: 'Deducible',       value: fmtMXN(totalDed),                   color: '#065F46', bg: '#F0FDF4', small: true },
            { label: 'No deducible',    value: fmtMXN(totalND),                    color: '#991B1B', bg: '#FEF2F2', small: true },
            { label: '% Deducibilidad', value: `${pct(totalDed, totalGlobal)}%`,   color: '#065F46', bg: '#F0FDF4' },
            { label: 'Transacciones',   value: kpis.total_gastos ?? 0,             color: '#374151', bg: '#F9FAFB' },
          ].map(k => (
            <div key={k.label} style={{ padding: '10px 14px', backgroundColor: k.bg,
              borderRadius: 12, border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 10, color: k.color, fontWeight: 600, margin: '0 0 3px', opacity: 0.8 }}>
                {k.label}
              </p>
              <p style={{ fontSize: k.small ? 14 : 22, fontWeight: 700, color: k.color, margin: 0 }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end',
          backgroundColor: '#fff', padding: '12px 16px',
          border: '1px solid #E5E7EB', borderRadius: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Desde', key: 'desde', type: 'date' },
            { label: 'Hasta', key: 'hasta', type: 'date' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.label}
              </label>
              <input type={f.type} style={{ ...inp, width: 'auto', fontSize: 12 }}
                value={filtros[f.key]}
                onChange={e => setF(f.key, e.target.value)} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Proyecto
            </label>
            <select style={{ ...inp, width: 200, fontSize: 12 }}
              value={filtros.projectId} onChange={e => setF('projectId', e.target.value)}>
              <option value="">Todos los proyectos</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={cargar}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                borderRadius: 8, border: '1px solid #E5E7EB', backgroundColor: '#fff',
                color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              <Filter size={12} /> Aplicar
            </button>
            <button onClick={exportarCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                borderRadius: 8, border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF',
                color: '#1E40AF', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <Download size={12} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Tabla consolidada */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 48, gap: 10, color: '#9CA3AF' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Cargando consolidado…</span>
            </div>
          ) : filas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
              <BarChart2 size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                Sin datos para el período seleccionado
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>Ajusta los filtros para ver resultados</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['Categoría / Tipo', 'Gastos', 'Monto total', 'Deducible', 'No deducible', '% del total'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700,
                        color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em',
                        textAlign: h === 'Categoría / Tipo' ? 'left' : 'right',
                        whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(porCategoria).map(([cat, rows]) => {
                    const cfg = CATEGORIA_CFG[cat] ?? CATEGORIA_CFG.gastos_generales
                    return (
                      <FilaAgrupada key={cat}
                        titulo={`${cfg.emoji} ${cfg.label}`}
                        filas={rows}
                        totalGlobal={totalGlobal}
                        colorAccent={cfg.border}
                      />
                    )
                  })}
                </tbody>
                {/* Total general */}
                <tfoot>
                  <tr style={{ backgroundColor: '#F0FDF4', borderTop: '2px solid #A7F3D0' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, color: '#065F46' }}>
                      Total general
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700,
                      color: '#065F46', textAlign: 'center' }}>
                      {filas.reduce((s, f) => s + parseInt(f.total_gastos ?? 0), 0)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 800,
                      color: '#065F46', textAlign: 'right' }}>
                      {fmtMXN(totalGlobal)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700,
                      color: '#065F46', textAlign: 'right' }}>
                      {fmtMXN(totalDed)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700,
                      color: totalND > 0 ? '#DC2626' : '#D1D5DB', textAlign: 'right' }}>
                      {fmtMXN(totalND)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700,
                      color: '#065F46', textAlign: 'right' }}>
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Nota deducibilidad */}
        {totalND > 0 && (
          <div style={{ display: 'flex', gap: 10, padding: '10px 14px',
            backgroundColor: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 10 }}>
            <TrendingDown size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
              <strong>{fmtMXN(totalND)}</strong> en gastos no deducibles en este período.
              Revisar comprobantes faltantes para optimizar la carga fiscal.
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}