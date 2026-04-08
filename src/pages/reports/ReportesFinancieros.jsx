// ============================================================
//  OBRIX ERP — Reportes Financieros
//  src/pages/reportes/ReportesFinancieros.jsx  |  v1.0
//
//  6 reportes:
//  1. Crecimiento Orgánico
//  2. Rentabilidad Comercial por Proyecto
//  3. Punto de Equilibrio
//  4. Flujo de Caja y Liquidez
//  5. Balanza de Comprobación
//  6. Estado de Resultados
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { supabase }   from '../../config/supabase'
import {
  TrendingUp, DollarSign, BarChart2, Droplets,
  Scale, FileText, RefreshCw, ChevronDown,
  ArrowUpRight, ArrowDownRight, Target, Users,
  Briefcase, Activity,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────
const fmt  = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtM = (n) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${fmt(v)}`
}
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`
const positivo = (n) => Number(n || 0) >= 0

const AÑOS = [2024, 2025, 2026]
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Colores ───────────────────────────────────────────────────
const C = {
  azul:     '#2563EB', azulBg:   '#EFF6FF', azulText: '#1E40AF',
  verde:    '#059669', verdeBg:  '#F0FDF4', verdeText:'#065F46',
  rojo:     '#DC2626', rojoBg:   '#FEF2F2', rojoText: '#991B1B',
  amber:    '#D97706', amberBg:  '#FFFBEB', amberText:'#B45309',
  gris:     '#6B7280', grisBg:   '#F9FAFB', borde:    '#E5E7EB',
}

// ── KPI Card ─────────────────────────────────────────────────
const KpiCard = ({ label, valor, sub, color = C.azul, icon: Icon, trend }) => (
  <div style={{
    padding: '16px 18px', borderRadius: 14,
    background: '#fff', border: `1px solid ${C.borde}`,
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: C.gris, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      {Icon && <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color={color} />
      </div>}
    </div>
    <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{valor}</p>
    {sub && <p style={{ fontSize: 11, color: C.gris, margin: 0 }}>{sub}</p>}
    {trend !== undefined && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {positivo(trend)
          ? <ArrowUpRight size={13} color={C.verde} />
          : <ArrowDownRight size={13} color={C.rojo} />
        }
        <span style={{ fontSize: 11, color: positivo(trend) ? C.verde : C.rojo, fontWeight: 600 }}>
          {positivo(trend) ? '+' : ''}{fmtPct(trend)} vs período anterior
        </span>
      </div>
    )}
  </div>
)

// ── Barra horizontal ─────────────────────────────────────────
const BarraH = ({ label, valor, max, color, sub }) => {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{fmtM(valor)}</span>
          {sub && <span style={{ fontSize: 10, color: C.gris, marginLeft: 6 }}>{sub}</span>}
        </div>
      </div>
      <div style={{ height: 8, background: '#F3F4F6', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// ── Selector de período ───────────────────────────────────────
const SelectorPeriodo = ({ año, mes, onAño, onMes, showMes = false }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <select value={año} onChange={e => onAño(Number(e.target.value))}
      style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: 12, background: '#fff', cursor: 'pointer' }}>
      {AÑOS.map(a => <option key={a} value={a}>{a}</option>)}
    </select>
    {showMes && (
      <select value={mes} onChange={e => onMes(Number(e.target.value))}
        style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: 12, background: '#fff', cursor: 'pointer' }}>
        {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
      </select>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────
// REPORTE 1: CRECIMIENTO ORGÁNICO
// ─────────────────────────────────────────────────────────────
const COLORES_ETAPA = {
  prospecto:       C.gris,
  calificado:      C.amber,
  visita_tecnica:  C.amber,
  cotizacion:      C.azul,
  negociacion:     '#7C3AED',
  contrato:        C.verde,
  proyecto_activo: C.verde,
}

const ReporteCrecimiento = ({ companyId }) => {
  const [data,          setData]          = useState(null)
  const [oportunidades, setOportunidades] = useState([])
  const [proyectos,     setProyectos]     = useState([])
  const [loading,       setLoading]       = useState(false)
  const [año,           setAño]           = useState(new Date().getFullYear())

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    Promise.all([
      supabase.rpc('get_crecimiento_organico', { p_company_id: companyId, p_año: año }),
      supabase.from('oportunidades')
        .select('nombre_proyecto, monto_estimado, monto_cotizado, estatus')
        .eq('company_id', companyId)
        .not('estatus', 'in', '("perdido","cancelado")')
        .order('monto_estimado', { ascending: false })
        .limit(8),
      supabase.from('projects')
        .select('id, code, name, status, budget')
        .eq('company_id', companyId)
        .eq('status', 'active'),
    ]).then(([{ data: d }, { data: ops }, { data: proy }]) => {
      setData(d)
      setOportunidades(ops || [])
      setProyectos(proy || [])
      setLoading(false)
    })
  }, [companyId, año])

  if (loading) return <Spinner />

  const maxMonto = Math.max(...(oportunidades.map(o => Number(o.monto_estimado || o.monto_cotizado || 0))), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: C.gris, margin: 0 }}>Métricas de crecimiento del pipeline comercial — datos en tiempo real</p>
        <SelectorPeriodo año={año} onAño={setAño} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Proyectos Activos"  valor={proyectos.length}                  icon={Briefcase}  color={C.azul}  sub="obras en ejecución" />
        <KpiCard label="Pipeline Activo"    valor={fmtM(data?.valor_pipeline)}         icon={TrendingUp} color={C.verde} sub="oportunidades abiertas" />
        <KpiCard label="Valor Contratado"   valor={fmtM(data?.valor_contratado)}       icon={DollarSign} color={C.azul}  sub="contratos firmados" />
        <KpiCard label="Tasa de Conversión" valor={fmtPct(data?.tasa_conversion_pct)}  icon={Target}
          color={data?.tasa_conversion_pct >= 50 ? C.verde : C.amber}
          sub={`${data?.oportunidades_ganadas || 0} de ${data?.oportunidades_total || 0} cerradas`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Pipeline real desde BD */}
        <div style={{ padding: '16px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}` }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>
            Pipeline por oportunidad ({oportunidades.length})
          </p>
          {oportunidades.length === 0
            ? <p style={{ fontSize: 12, color: C.gris }}>Sin oportunidades activas</p>
            : oportunidades.map((op, i) => (
                <BarraH
                  key={i}
                  label={op.nombre_proyecto}
                  valor={Number(op.monto_estimado || op.monto_cotizado || 0)}
                  max={maxMonto}
                  color={COLORES_ETAPA[op.estatus] || C.gris}
                  sub={op.estatus?.replace('_', ' ')}
                />
              ))
          }
        </div>

        {/* Proyectos activos reales + métricas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '16px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>
              Proyectos activos ({proyectos.length})
            </p>
            {proyectos.length === 0
              ? <p style={{ fontSize: 12, color: C.gris }}>Sin proyectos activos</p>
              : proyectos.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.borde}` }}>
                    <div>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.azul, fontWeight: 700 }}>{p.code}</span>
                      <span style={{ fontSize: 11, color: '#111827', marginLeft: 8 }}>{p.name.split('—')[0].trim()}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.verde }}>{fmtM(p.budget)}</span>
                  </div>
                ))
            }
          </div>
          <div style={{ padding: '16px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>Métricas comerciales</p>
            {[
              { label: 'Clientes con contrato', valor: `${data?.clientes_con_contrato || 0} clientes` },
              { label: 'Ticket promedio',        valor: fmtM(data?.ticket_promedio) },
              { label: 'Oportunidades ganadas',  valor: `${data?.oportunidades_ganadas || 0} contratos` },
            ].map(({ label, valor }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.borde}` }}>
                <span style={{ fontSize: 12, color: C.gris }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{valor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REPORTE 2: RENTABILIDAD COMERCIAL
// ─────────────────────────────────────────────────────────────
const ReporteRentabilidad = ({ companyId }) => {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.rpc('get_rentabilidad_proyectos', { p_company_id: companyId })
      .then(({ data: d }) => { setData(Array.isArray(d) ? d : []); setLoading(false) })
  }, [companyId])

  if (loading) return <Spinner />
  const maxIngreso = Math.max(...data.map(p => p.ingresos || 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: C.gris, margin: 0 }}>Rentabilidad real por proyecto — ingresos vs costos registrados</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {data.map(p => {
          const color = p.margen_pct >= 20 ? C.verde : p.margen_pct >= 10 ? C.amber : C.rojo
          const bg    = p.margen_pct >= 20 ? C.verdeBg : p.margen_pct >= 10 ? C.amberBg : C.rojoBg
          return (
            <div key={p.proyecto_id} style={{ padding: '16px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: C.azul }}>{p.codigo}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: p.status === 'active' ? C.azulBg : '#F3F4F6', color: p.status === 'active' ? C.azulText : C.gris, fontWeight: 700 }}>
                  {p.status === 'active' ? 'Activo' : 'Cerrado'}
                </span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 12px', lineHeight: 1.4 }}>{p.nombre}</p>

              <div style={{ padding: '8px 10px', background: bg, borderRadius: 8, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color, fontWeight: 600 }}>Margen</span>
                <span style={{ fontSize: 18, fontWeight: 900, color }}>{fmtPct(p.margen_pct)}</span>
              </div>

              {[
                { label: 'Ingresos',      valor: fmtM(p.ingresos),     color: C.verde },
                { label: 'Costo gastos',  valor: fmtM(p.costo_gastos), color: C.rojo },
                { label: 'Costo nómina',  valor: fmtM(p.costo_nomina), color: C.rojo },
                { label: 'Utilidad',      valor: fmtM(p.utilidad),     color: p.utilidad >= 0 ? C.verde : C.rojo, bold: true },
              ].map(({ label, valor, color: vc, bold }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.borde}` }}>
                  <span style={{ fontSize: 11, color: C.gris }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: bold ? 700 : 500, color: vc }}>{valor}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REPORTE 3: PUNTO DE EQUILIBRIO
// ─────────────────────────────────────────────────────────────
const ReportePuntoEquilibrio = ({ companyId }) => {
  const [data, setData]       = useState(null)
  const [año, setAño]         = useState(2024)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.rpc('get_punto_equilibrio', { p_company_id: companyId, p_año: año, p_mes_inicio: 1, p_mes_fin: 12 })
      .then(({ data: d }) => { setData(d); setLoading(false) })
  }, [companyId, año])

  if (loading) return <Spinner />

  const pe     = data?.punto_equilibrio || 0
  const ing    = data?.ingresos || 0
  const superado = ing >= pe && pe > 0
  const pct_logrado = pe > 0 ? Math.min(100, (ing / pe) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: C.gris, margin: 0 }}>¿Cuánto necesitas facturar para no perder?</p>
        <SelectorPeriodo año={año} onAño={setAño} />
      </div>

      {/* Indicador visual principal */}
      <div style={{ padding: '24px', background: superado ? C.verdeBg : C.amberBg, borderRadius: 16, border: `2px solid ${superado ? C.verde : C.amber}`, textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: superado ? C.verdeText : C.amberText, margin: '0 0 8px' }}>
          {superado ? '✅ Punto de equilibrio superado' : '⚠️ Por debajo del punto de equilibrio'}
        </p>
        <p style={{ fontSize: 42, fontWeight: 900, color: superado ? C.verde : C.amber, margin: '0 0 8px' }}>
          {fmtPct(pct_logrado)}
        </p>
        <p style={{ fontSize: 12, color: superado ? C.verdeText : C.amberText, margin: 0 }}>
          {superado
            ? `Excedente: ${fmtM(data?.brecha)} sobre el punto de equilibrio`
            : `Faltan ${fmtM(Math.abs(data?.brecha || 0))} para alcanzar el punto de equilibrio`}
        </p>
      </div>

      {/* Barra de progreso */}
      <div style={{ padding: '16px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Avance hacia el PE</span>
          <span style={{ fontSize: 12, color: C.gris }}>{fmtM(ing)} de {fmtM(pe)} requeridos</span>
        </div>
        <div style={{ height: 16, background: '#F3F4F6', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct_logrado}%`, background: superado ? C.verde : C.amber, borderRadius: 9999, transition: 'width 1s ease' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Costos Fijos"       valor={fmtM(data?.costos_fijos)}     icon={Target}     color={C.azul}  sub="independientes del volumen" />
        <KpiCard label="Costos Variables"   valor={fmtM(data?.costos_variables)} icon={Activity}   color={C.amber} sub="varían con la actividad" />
        <KpiCard label="Ingresos del Período" valor={fmtM(ing)}                  icon={DollarSign} color={C.verde} sub="facturado en el período" />
        <KpiCard label="Punto de Equilibrio" valor={fmtM(pe)}                    icon={Scale}      color={C.azul}  sub={`Margen contribución: ${fmtPct(data?.margen_contribucion)}`} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REPORTE 4: FLUJO DE CAJA
// ─────────────────────────────────────────────────────────────
const ReporteFlujooCaja = ({ companyId }) => {
  const [data, setData]       = useState(null)
  const [año, setAño]         = useState(2024)
  const [mes, setMes]         = useState(9)
  const [loading, setLoading] = useState(true)
  const [meses, setMeses]     = useState([])

  const cargarMes = useCallback(async (a, m) => {
    setLoading(true)
    const { data: d } = await supabase.rpc('get_flujo_caja', { p_company_id: companyId, p_año: a, p_mes: m })
    setData(d)
    setLoading(false)
  }, [companyId])

  // Cargar todos los meses del año para el gráfico de barras
  useEffect(() => {
    const cargarTodos = async () => {
      const resultados = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          supabase.rpc('get_flujo_caja', { p_company_id: companyId, p_año: año, p_mes: i + 1 })
            .then(({ data: d }) => ({ mes: i + 1, ...d }))
        )
      )
      setMeses(resultados)
    }
    cargarTodos()
    cargarMes(año, mes)
  }, [companyId, año])

  useEffect(() => { cargarMes(año, mes) }, [mes])

  if (loading && !data) return <Spinner />

  const maxValor = Math.max(...meses.map(m => Math.max(m?.entradas || 0, m?.total_salidas || 0)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: C.gris, margin: 0 }}>Entradas y salidas reales de efectivo por período</p>
        <SelectorPeriodo año={año} onAño={a => { setAño(a); setMes(1) }} mes={mes} onMes={setMes} showMes />
      </div>

      {/* Gráfico de barras por mes */}
      <div style={{ padding: '16px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}` }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Flujo mensual {año}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {meses.map((m, i) => {
            const hEnt = maxValor > 0 ? ((m?.entradas || 0) / maxValor) * 90 : 0
            const hSal = maxValor > 0 ? ((m?.total_salidas || 0) / maxValor) * 90 : 0
            const activo = m.mes === mes
            return (
              <div key={i} onClick={() => setMes(m.mes)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 90 }}>
                  <div style={{ flex: 1, background: activo ? C.verde : C.verde + '60', borderRadius: '3px 3px 0 0', height: `${hEnt}px`, minHeight: hEnt > 0 ? 3 : 0, transition: 'height 0.5s' }} />
                  <div style={{ flex: 1, background: activo ? C.rojo : C.rojo + '60', borderRadius: '3px 3px 0 0', height: `${hSal}px`, minHeight: hSal > 0 ? 3 : 0, transition: 'height 0.5s' }} />
                </div>
                <span style={{ fontSize: 9, color: activo ? C.azul : C.gris, fontWeight: activo ? 700 : 400 }}>{MESES[i]}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: C.verde, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: C.gris }}>Entradas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: C.rojo, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: C.gris }}>Salidas</span>
          </div>
        </div>
      </div>

      {/* Detalle del mes seleccionado */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <KpiCard label="Entradas"        valor={fmtM(data.entradas)}       icon={ArrowUpRight}   color={C.verde} sub={data.periodo} />
          <KpiCard label="Salidas Gastos"  valor={fmtM(data.salidas_gastos)} icon={ArrowDownRight} color={C.rojo}  sub="gastos pagados" />
          <KpiCard label="Salidas Nómina"  valor={fmtM(data.salidas_nomina)} icon={Users}          color={C.amber} sub="nómina pagada" />
          <KpiCard label="Flujo Neto"      valor={fmtM(data.flujo_neto)}     icon={Droplets}
            color={data.flujo_neto >= 0 ? C.verde : C.rojo}
            sub={data.es_positivo ? 'Período positivo ✓' : 'Período negativo ⚠️'} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REPORTE 5: BALANZA DE COMPROBACIÓN
// ─────────────────────────────────────────────────────────────
const ReporteBalanza = ({ companyId }) => {
  const [polizas, setPolizas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [año, setAño]         = useState(2024)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('polizas').select('*, asientos(*, cuentas_contables(codigo, nombre, tipo))')
        .eq('company_id', companyId)
        .eq('estatus', 'aplicada')
        .gte('fecha', `${año}-01-01`).lte('fecha', `${año}-12-31`)
        .order('fecha'),
      supabase.from('cuentas_contables').select('id, codigo, nombre, tipo, naturaleza')
        .eq('company_id', companyId).eq('acepta_movimientos', true).order('codigo'),
    ]).then(([{ data: p }, { data: c }]) => {
      setPolizas(p || [])
      // Calcular saldos por cuenta
      const saldos = {}
      ;(p || []).forEach(pol => {
        ;(pol.asientos || []).forEach(a => {
          if (!saldos[a.cuenta_id]) saldos[a.cuenta_id] = { cargos: 0, abonos: 0, cuenta: a.cuentas_contables }
          if (a.tipo_movimiento === 'cargo') saldos[a.cuenta_id].cargos += Number(a.monto)
          else saldos[a.cuenta_id].abonos += Number(a.monto)
        })
      })
      setCuentas(Object.entries(saldos).map(([id, v]) => ({
        id, ...v.cuenta,
        cargos: v.cargos, abonos: v.abonos,
        saldo: v.cargos - v.abonos,
      })))
      setLoading(false)
    })
  }, [companyId, año])

  if (loading) return <Spinner />

  const totalCargos = cuentas.reduce((s, c) => s + c.cargos, 0)
  const totalAbonos = cuentas.reduce((s, c) => s + c.abonos, 0)
  const cuadra = Math.abs(totalCargos - totalAbonos) < 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: C.gris, margin: 0 }}>Saldos de todas las cuentas en el período</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: cuadra ? C.verdeBg : C.rojoBg, color: cuadra ? C.verdeText : C.rojoText, fontWeight: 700 }}>
            {cuadra ? '✓ Balanza cuadrada' : '⚠ Diferencia detectada'}
          </span>
          <SelectorPeriodo año={año} onAño={setAño} />
        </div>
      </div>

      {/* Tabla de balanza */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.grisBg, borderBottom: `2px solid ${C.borde}` }}>
              {['Código', 'Cuenta', 'Tipo', 'Cargos', 'Abonos', 'Saldo'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Cargos' || h === 'Abonos' || h === 'Saldo' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cuentas.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${C.borde}`, background: i % 2 === 0 ? '#fff' : C.grisBg }}>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: C.azul, fontWeight: 700 }}>{c.codigo}</td>
                <td style={{ padding: '8px 14px', color: '#111827' }}>{c.nombre}</td>
                <td style={{ padding: '8px 14px', color: C.gris, fontSize: 11, textTransform: 'capitalize' }}>{c.tipo}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: C.azul, fontWeight: 600 }}>${fmt(c.cargos)}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: C.gris }}>${fmt(c.abonos)}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: c.saldo >= 0 ? C.azul : C.rojo }}>${fmt(Math.abs(c.saldo))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: C.azulBg, borderTop: `2px solid ${C.azul}` }}>
              <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 700, color: C.azulText }}>TOTALES</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: C.azul }}>${fmt(totalCargos)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: C.azul }}>${fmt(totalAbonos)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: cuadra ? C.verde : C.rojo }}>
                {cuadra ? '✓ Cuadra' : `Dif: $${fmt(Math.abs(totalCargos - totalAbonos))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ fontSize: 11, color: C.gris, margin: 0 }}>
        Período: {año} · {polizas.length} pólizas aplicadas · {cuentas.length} cuentas con movimiento
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REPORTE 6: ESTADO DE RESULTADOS
// ─────────────────────────────────────────────────────────────
const ReporteEdR = ({ companyId }) => {
  const [data, setData]       = useState(null)
  const [año, setAño]         = useState(2024)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.rpc('get_estado_resultados', { p_company_id: companyId, p_año: año, p_mes_inicio: 1, p_mes_fin: 12 })
      .then(({ data: d }) => { setData(d); setLoading(false) })
  }, [companyId, año])

  if (loading) return <Spinner />

  const filas = data ? [
    { concepto: 'Ingresos por Obra Ejecutada', monto: data.ingresos_totales, nivel: 0, tipo: 'ingreso' },
    { concepto: 'Costo de Materiales',          monto: -data.costo_materiales, nivel: 1, tipo: 'costo' },
    { concepto: 'Costo de Mano de Obra',         monto: -data.costo_mano_obra,  nivel: 1, tipo: 'costo' },
    { concepto: 'UTILIDAD BRUTA',                monto: data.utilidad_bruta,    nivel: 0, tipo: 'subtotal', pct: data.margen_bruto_pct },
    { concepto: 'Gastos Operativos (variables)', monto: -data.gastos_operativos, nivel: 1, tipo: 'gasto' },
    { concepto: 'Gastos Administrativos (fijos)',monto: -data.gastos_admin,      nivel: 1, tipo: 'gasto' },
    { concepto: 'UTILIDAD DE OPERACIÓN (EBITDA)',monto: data.utilidad_operacion, nivel: 0, tipo: 'total', pct: data.margen_operacion_pct },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: C.gris, margin: 0 }}>Ingresos, costos y utilidad del período</p>
        <SelectorPeriodo año={año} onAño={setAño} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <KpiCard label="Ingresos Totales"     valor={fmtM(data?.ingresos_totales)}   icon={TrendingUp}  color={C.verde} sub={data?.periodo} />
        <KpiCard label="Utilidad Bruta"       valor={fmtM(data?.utilidad_bruta)}     icon={DollarSign}  color={data?.utilidad_bruta >= 0 ? C.azul : C.rojo}   sub={`Margen: ${fmtPct(data?.margen_bruto_pct)}`} />
        <KpiCard label="Utilidad Operación"   valor={fmtM(data?.utilidad_operacion)} icon={BarChart2}   color={data?.utilidad_operacion >= 0 ? C.verde : C.rojo} sub={`Margen: ${fmtPct(data?.margen_operacion_pct)}`} />
      </div>

      {/* Cascada de resultados */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.borde}`, overflow: 'hidden' }}>
        {filas.map((f, i) => {
          const esSubtotal = f.tipo === 'subtotal' || f.tipo === 'total'
          const color = f.tipo === 'ingreso' ? C.verde
            : f.tipo === 'costo' || f.tipo === 'gasto' ? C.rojo
            : f.monto >= 0 ? C.azul : C.rojo
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: esSubtotal ? '14px 20px' : '10px 20px',
              paddingLeft: f.nivel === 1 ? 36 : 20,
              background: esSubtotal ? (f.tipo === 'total' ? C.azulBg : C.grisBg) : '#fff',
              borderBottom: `1px solid ${C.borde}`,
              borderTop: esSubtotal ? `2px solid ${C.borde}` : 'none',
            }}>
              <span style={{ fontSize: esSubtotal ? 13 : 12, fontWeight: esSubtotal ? 800 : 400, color: esSubtotal ? '#111827' : C.gris }}>
                {f.nivel === 1 && <span style={{ color: C.borde }}>── </span>}
                {f.concepto}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {f.pct !== undefined && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: f.monto >= 0 ? C.verdeBg : C.rojoBg, color: f.monto >= 0 ? C.verdeText : C.rojoText, fontWeight: 700 }}>
                    {fmtPct(f.pct)}
                  </span>
                )}
                <span style={{ fontSize: esSubtotal ? 15 : 13, fontWeight: esSubtotal ? 800 : 500, color, minWidth: 90, textAlign: 'right' }}>
                  {f.monto < 0 ? `($${fmt(Math.abs(f.monto))})` : `$${fmt(f.monto)}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: C.azul, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
)

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
const REPORTES = [
  { id: 'crecimiento',  label: 'Crecimiento Orgánico',    icon: TrendingUp,   comp: ReporteCrecimiento },
  { id: 'rentabilidad', label: 'Rentabilidad Comercial',  icon: DollarSign,   comp: ReporteRentabilidad },
  { id: 'equilibrio',   label: 'Punto de Equilibrio',     icon: Scale,        comp: ReportePuntoEquilibrio },
  { id: 'flujo',        label: 'Flujo y Liquidez',        icon: Droplets,     comp: ReporteFlujooCaja },
  { id: 'balanza',      label: 'Balanza de Comprobación', icon: BarChart2,    comp: ReporteBalanza },
  { id: 'edr',          label: 'Estado de Resultados',    icon: FileText,     comp: ReporteEdR },
]

export default function ReportesFinancieros() {
  const [activo, setActivo]     = useState('crecimiento')
  const [companyId, setCompanyId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  const Reporte = REPORTES.find(r => r.id === activo)?.comp

  return (
    <MainLayout title="📊 Reportes Financieros">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Tabs de reportes */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {REPORTES.map(r => {
            const Icon = r.icon
            const isActive = activo === r.id
            return (
              <button key={r.id} onClick={() => setActivo(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10,
                  background: isActive ? C.azul : '#fff',
                  color: isActive ? '#fff' : C.gris,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(37,99,235,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                  border: isActive ? 'none' : `1px solid ${C.borde}`,
                  transition: 'all 0.15s',
                }}>
                <Icon size={13} />
                {r.label}
              </button>
            )
          })}
        </div>

        {/* Contenido del reporte activo */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.borde}`, padding: '20px 22px', minHeight: 400 }}>
          {companyId && Reporte ? (
            <Reporte companyId={companyId} />
          ) : (
            <Spinner />
          )}
        </div>

      </div>
    </MainLayout>
  )
}