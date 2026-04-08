// ============================================================
//  OBRIX — Dashboard de Tesorería
//  src/pages/tesoreria/TesoreriaPage.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { MainLayout }          from '../../components/layout/MainLayout'
import { supabase }            from '../../config/supabase'
import {
  Landmark, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, AlertOctagon, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, Building2,
  Calendar, ChevronRight, Sparkles,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtM = (n) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`
  return `$${fmt(v)}`
}
const fmtFecha = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'
const hoy = () => new Date().toISOString().split('T')[0]
const addDias = (dias) => {
  const d = new Date(); d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

// ─── Constantes ──────────────────────────────────────────────
const C = { borde: '#E5E7EB', bg: '#FFFFFF', bgSec: '#F9FAFB' }
const borde = { border: '1px solid #E5E7EB', borderRadius: '12px' }
const PERIODOS = [30, 60, 90, 120]

// ─── Barra de proyección ─────────────────────────────────────
const BarraProyeccion = ({ cxc, cxp, maximo }) => {
  if (maximo === 0) return null
  const wCxc = Math.round((cxc / maximo) * 100)
  const wCxp = Math.round((cxp / maximo) * 100)
  return (
    <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 99, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
      <div style={{ width: `${wCxc}%`, background: '#16A34A', borderRadius: '99px 0 0 99px', transition: 'width .4s' }} />
      <div style={{ width: `${wCxp}%`, background: '#D97706', borderRadius: wCxc === 0 ? 99 : '0 99px 99px 0', transition: 'width .4s' }} />
    </div>
  )
}

export default function TesoreriaPage() {
  const nav = useNavigate()
  const [companyId,  setCompanyId]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [periodo,    setPeriodo]    = useState(30)

  // Datos
  const [bancos,     setBancos]     = useState([])
  const [cxcActivas, setCxcActivas] = useState([])
  const [cxpActivas, setCxpActivas] = useState([])
  const [alertas,    setAlertas]    = useState([])

  // ── Carga ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => { if (companyId) cargarTodo() }, [companyId])

  const cargarTodo = async () => {
    setLoading(true)
    const fechaLimite = addDias(120)

    const [{ data: bks }, { data: cxc }, { data: cxp }] = await Promise.all([
      supabase
        .from('company_bancos')
        .select('id, nombre, banco, moneda, saldo_inicial, activa')
        .eq('company_id', companyId)
        .eq('activa', true)
        .order('orden'),
      supabase
        .from('v_tesoreria_cxc')
        .select('id, concepto, monto_original, saldo_pendiente, fecha_vencimiento, estatus, dias_restantes, terceros(razon_social)')
        .eq('company_id', companyId)
        .not('estatus', 'in', '("cobrado","cancelado")')
        .lte('fecha_vencimiento', fechaLimite)
        .order('fecha_vencimiento'),
      supabase
        .from('v_tesoreria_cxp')
        .select('id, concepto, monto_original, saldo_pendiente, fecha_vencimiento, estatus, dias_restantes, proveedor_critico, descuento_pp_monto, descuento_pp_fecha, terceros(razon_social)')
        .eq('company_id', companyId)
        .not('estatus', 'in', '("pagado","cancelado")')
        .lte('fecha_vencimiento', fechaLimite)
        .order('fecha_vencimiento'),
    ])

    setBancos(bks || [])
    setCxcActivas(cxc || [])
    setCxpActivas(cxp || [])
    generarAlertas(cxc || [], cxp || [], bks || [])
    setLoading(false)
  }

  // ── Generar alertas proactivas ─────────────────────────────
  const generarAlertas = (cxc, cxp, bks) => {
    const lista = []
    const saldoTotal = bks.reduce((s, b) => s + Number(b.saldo_inicial || 0), 0)

    // CxC: facturas vencidas
    const vencidasCxC = cxc.filter(c => (c.dias_restantes ?? 0) < 0)
    if (vencidasCxC.length > 0) {
      const total = vencidasCxC.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
      lista.push({
        tipo: 'danger', icono: '🔴',
        titulo: `${vencidasCxC.length} factura${vencidasCxC.length !== 1 ? 's' : ''} por cobrar vencida${vencidasCxC.length !== 1 ? 's' : ''}`,
        detalle: `Total: ${fmtM(total)} — requieren gestión de cobranza inmediata.`,
        accion: { label: 'Ver CxC', path: '/tesoreria/cxc' },
      })
    }

    // CxP: pagos que vencen en ≤ 3 días
    const urgenteCxP = cxp.filter(c => (c.dias_restantes ?? 99) >= 0 && (c.dias_restantes ?? 99) <= 3)
    if (urgenteCxP.length > 0) {
      const total = urgenteCxP.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
      lista.push({
        tipo: 'danger', icono: '⏰',
        titulo: `${urgenteCxP.length} pago${urgenteCxP.length !== 1 ? 's' : ''} vence${urgenteCxP.length === 1 ? '' : 'n'} en ≤ 3 días`,
        detalle: `${fmtM(total)} comprometidos — verifica disponibilidad bancaria.`,
        accion: { label: 'Ver CxP', path: '/tesoreria/cxp' },
      })
    }

    // Descuentos por pronto pago disponibles
    const conDescuento = cxp.filter(c => c.descuento_pp_fecha && c.descuento_pp_fecha >= hoy() && c.descuento_pp_monto > 0)
    if (conDescuento.length > 0) {
      const ahorro = conDescuento.reduce((s, c) => s + Number(c.descuento_pp_monto || 0), 0)
      lista.push({
        tipo: 'success', icono: '💰',
        titulo: `${fmtM(ahorro)} en descuentos por pronto pago disponibles`,
        detalle: `${conDescuento.length} proveedor${conDescuento.length !== 1 ? 'es ofrecen' : ' ofrece'} descuento vigente. Aprovéchalos antes de que venzan.`,
        accion: { label: 'Ver CxP', path: '/tesoreria/cxp' },
      })
    }

    // Saldo bajo vs compromisos próximos 30d
    const cxp30 = cxp.filter(c => (c.dias_restantes ?? 99) <= 30).reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
    if (saldoTotal > 0 && cxp30 > saldoTotal * 0.8) {
      lista.push({
        tipo: 'warning', icono: '🏦',
        titulo: 'Compromisos próximos superan el 80% del saldo bancario',
        detalle: `${fmtM(cxp30)} por pagar en 30 días vs ${fmtM(saldoTotal)} en cuentas. Revisa el flujo.`,
        accion: { label: 'Ver Bancos', path: '/tesoreria/bancos' },
      })
    }

    // Proveedores críticos con pagos pendientes
    const criticos = cxp.filter(c => c.proveedor_critico && (c.dias_restantes ?? 99) <= 15)
    if (criticos.length > 0) {
      lista.push({
        tipo: 'warning', icono: '🏗️',
        titulo: `${criticos.length} proveedor${criticos.length !== 1 ? 'es críticos' : ' crítico'} con pago pendiente ≤ 15 días`,
        detalle: `Materiales o subcontratos de obra activa en riesgo de interrupción.`,
        accion: { label: 'Ver CxP', path: '/tesoreria/cxp' },
      })
    }

    setAlertas(lista)
  }

  // ── Cálculos derivados ─────────────────────────────────────
  const saldoBancarioTotal = bancos.reduce((s, b) => s + Number(b.saldo_inicial || 0), 0)

  // Filtrar por período seleccionado
  const cxcPeriodo = cxcActivas.filter(c => (c.dias_restantes ?? -1) >= 0 && (c.dias_restantes ?? 999) <= periodo)
  const cxpPeriodo = cxpActivas.filter(c => (c.dias_restantes ?? -1) >= 0 && (c.dias_restantes ?? 999) <= periodo)
  const cxcVencidas= cxcActivas.filter(c => (c.dias_restantes ?? 0) < 0)
  const cxpVencidas= cxpActivas.filter(c => (c.dias_restantes ?? 0) < 0)

  const totalCxCPeriodo  = cxcPeriodo.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const totalCxPPeriodo  = cxpPeriodo.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const totalCxCVencidas = cxcVencidas.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const totalCxPVencidas = cxpVencidas.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)

  // Posición neta proyectada
  const posicionNeta = saldoBancarioTotal + totalCxCPeriodo - totalCxPPeriodo
  const esPositiva   = posicionNeta >= 0

  // Máximo para barras de proyección por tramo
  const tramosData = PERIODOS.map(p => {
    const c = cxcActivas.filter(x => (x.dias_restantes ?? -1) >= 0 && (x.dias_restantes ?? 999) <= p)
    const g = cxpActivas.filter(x => (x.dias_restantes ?? -1) >= 0 && (x.dias_restantes ?? 999) <= p)
    return {
      dias: p,
      cxc:  c.reduce((s, x) => s + Number(x.saldo_pendiente || 0), 0),
      cxp:  g.reduce((s, x) => s + Number(x.saldo_pendiente || 0), 0),
      neto: saldoBancarioTotal + c.reduce((s, x) => s + Number(x.saldo_pendiente || 0), 0) - g.reduce((s, x) => s + Number(x.saldo_pendiente || 0), 0),
    }
  })
  const maxProyeccion = Math.max(...tramosData.map(t => Math.max(t.cxc, t.cxp)), 1)

  // Próximos vencimientos (los 5 más urgentes de cada módulo)
  const proxCxC = [...cxcActivas].filter(c => (c.dias_restantes ?? -1) >= 0).slice(0, 5)
  const proxCxP = [...cxpActivas].filter(c => (c.dias_restantes ?? -1) >= 0).slice(0, 5)

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <MainLayout title="Tesorería — Posición de Caja">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: `2px solid #E5E7EB`, borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout title="🏦 Posición de Caja">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1060, margin: '0 auto' }}>

        {/* ── Encabezado ────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 2px' }}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              Posición consolidada de {bancos.length} cuenta{bancos.length !== 1 ? 's' : ''} bancaria{bancos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={cargarTodo} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '8px', border: `0.5px solid #E5E7EB`, background: '#FFFFFF', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>

        {/* ── KPIs principales ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 10 }}>
          {[
            {
              label: 'Saldo bancario actual',
              valor: fmtM(saldoBancarioTotal),
              sub:   `${bancos.length} cuenta${bancos.length !== 1 ? 's' : ''} activa${bancos.length !== 1 ? 's' : ''}`,
              icon:  <Landmark size={20} color="#2563EB" />,
              bg:    '#EFF6FF',
              grande: true,
            },
            {
              label: `Pos. neta ${periodo}d`,
              valor: (esPositiva ? '+' : '') + fmtM(posicionNeta),
              sub:   esPositiva ? 'Flujo positivo' : '⚠️ Flujo negativo',
              icon:  esPositiva
                ? <TrendingUp  size={20} color="#16A34A" />
                : <TrendingDown size={20} color="#DC2626" />,
              bg:    esPositiva ? '#F0FDF4' : '#FEF2F2',
              color: esPositiva ? '#16A34A' : '#DC2626',
              grande: true,
            },
            {
              label: 'Por cobrar vencido',
              valor: fmtM(totalCxCVencidas),
              sub:   `${cxcVencidas.length} documento${cxcVencidas.length !== 1 ? 's' : ''}`,
              icon:  <AlertOctagon size={18} color="#DC2626" />,
              bg:    '#FEF2F2',
            },
            {
              label: 'Por pagar vencido',
              valor: fmtM(totalCxPVencidas),
              sub:   `${cxpVencidas.length} documento${cxpVencidas.length !== 1 ? 's' : ''}`,
              icon:  <AlertOctagon size={18} color="#D97706" />,
              bg:    '#FFFBEB',
            },
          ].map(k => (
            <div key={k.label} style={{ ...borde, background: '#FFFFFF', padding: k.grande ? '16px 18px' : '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: k.grande ? 44 : 38, height: k.grande ? 44 : 38, borderRadius: k.grande ? 12 : 10, backgroundColor: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {k.icon}
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 2px' }}>{k.label}</p>
                <p style={{ fontSize: k.grande ? 22 : 18, fontWeight: 700, color: k.color || '#111827', margin: 0, lineHeight: 1.2 }}>{k.valor}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Alertas proactivas ────────────────────────────── */}
        {alertas.length > 0 && (
          <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `0.5px solid #E5E7EB`, backgroundColor: '#F9FAFB' }}>
              <Sparkles size={15} color="#7C3AED" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Alertas proactivas</p>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, backgroundColor: '#F5F3FF', color: '#7C3AED', fontWeight: 600 }}>
                {alertas.length} activa{alertas.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {alertas.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < alertas.length - 1 ? `0.5px solid #E5E7EB` : 'none',
                    backgroundColor: a.tipo === 'danger'  ? '#FFF9F9'
                      : a.tipo === 'warning' ? '#FFFDF0' : '#F0FDF4',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icono}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{a.titulo}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>{a.detalle}</p>
                  </div>
                  <button
                    onClick={() => nav(a.accion.path)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `0.5px solid #E5E7EB`, background: '#FFFFFF', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {a.accion.label} <ChevronRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Proyección 30/60/90/120 días ─────────────────── */}
        <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `0.5px solid #E5E7EB`, backgroundColor: '#F9FAFB', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} color="#6B7280" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Proyección de flujo</p>
            </div>
            {/* Selector de período */}
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODOS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: `0.5px solid ${periodo === p ? '#3B82F6' : '#E5E7EB'}`, backgroundColor: periodo === p ? '#EFF6FF' : '#FFFFFF', color: periodo === p ? '#2563EB' : '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: periodo === p ? 700 : 400, transition: 'all .15s' }}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de tramos */}
          <div style={{ padding: '16px 20px' }}>
            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {[
                { color: '#16A34A', label: 'Por cobrar (CxC)' },
                { color: '#D97706', label: 'Por pagar (CxP)'  },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color }} />
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{l.label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EFF6FF', border: `1px solid #3B82F6` }} />
                <span style={{ fontSize: 11, color: '#6B7280' }}>Posición neta</span>
              </div>
            </div>

            {/* Grilla de 4 tramos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {tramosData.map(t => {
                const activo = t.dias === periodo
                const neto   = t.neto
                const positivo = neto >= 0
                return (
                  <div
                    key={t.dias}
                    onClick={() => setPeriodo(t.dias)}
                    style={{
                      padding: '14px', borderRadius: '12px', cursor: 'pointer',
                      border: `0.5px solid ${activo ? '#3B82F6' : '#E5E7EB'}`,
                      backgroundColor: activo ? '#EFF6FF' : '#F9FAFB',
                      transition: 'all .15s',
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, color: activo ? '#2563EB' : '#9CA3AF', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {t.dias} días
                    </p>
                    <BarraProyeccion cxc={t.cxc} cxp={t.cxp} maximo={maxProyeccion} />
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#16A34A' }}>↑ CxC</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>{fmtM(t.cxc)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#D97706' }}>↓ CxP</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>{fmtM(t.cxp)}</span>
                      </div>
                      <div style={{ borderTop: `0.5px solid #E5E7EB`, paddingTop: 4, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Neto</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: positivo ? '#16A34A' : '#DC2626' }}>
                          {positivo ? '+' : ''}{fmtM(neto)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Resumen de bancos ─────────────────────────────── */}
        {bancos.length > 0 && (
          <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `0.5px solid #E5E7EB`, backgroundColor: '#F9FAFB' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Cuentas bancarias</p>
              <button onClick={() => nav('/tesoreria/bancos')} style={{ fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                Administrar <ChevronRight size={12} />
              </button>
            </div>
            {bancos.map((banco, i) => (
              <div key={banco.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < bancos.length - 1 ? `0.5px solid #E5E7EB` : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={16} color="#2563EB" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{banco.nombre}</p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{banco.banco}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, fontFamily: 'monospace' }}>
                    ${fmt(banco.saldo_inicial)}
                  </p>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, backgroundColor: banco.moneda === 'USD' ? '#FFFBEB' : '#F0FDF4', color: banco.moneda === 'USD' ? '#D97706' : '#16A34A', fontWeight: 600 }}>
                    {banco.moneda}
                  </span>
                </div>
              </div>
            ))}
            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#F9FAFB', borderTop: `0.5px solid #E5E7EB` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total MXN</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>${fmt(saldoBancarioTotal)}</span>
            </div>
          </div>
        )}

        {/* ── Próximos vencimientos ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* CxC próximos */}
          <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `0.5px solid #E5E7EB`, backgroundColor: '#F9FAFB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <TrendingUp size={14} color="#16A34A" />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Próximos cobros</p>
              </div>
              <button onClick={() => nav('/tesoreria/cxc')} style={{ fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                Ver todos <ChevronRight size={12} />
              </button>
            </div>
            {proxCxC.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9CA3AF', padding: '20px 16px', margin: 0, textAlign: 'center' }}>Sin cobros pendientes en los próximos {periodo} días.</p>
            ) : (
              proxCxC.map((c, i) => {
                const dias = c.dias_restantes ?? 0
                const urgente = dias <= 5
                return (
                  <div
                    key={c.id}
                    onClick={() => nav(`/tesoreria/cxc/${c.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < proxCxC.length - 1 ? `0.5px solid #E5E7EB` : 'none', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: urgente ? '#DC2626' : '#16A34A', flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.terceros?.razon_social || c.concepto}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                        {fmtFecha(c.fecha_vencimiento)} · {dias}d
                      </p>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', margin: 0, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      +${fmt(c.saldo_pendiente)}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          {/* CxP próximos */}
          <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `0.5px solid #E5E7EB`, backgroundColor: '#F9FAFB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <TrendingDown size={14} color="#D97706" />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Próximos pagos</p>
              </div>
              <button onClick={() => nav('/tesoreria/cxp')} style={{ fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                Ver todos <ChevronRight size={12} />
              </button>
            </div>
            {proxCxP.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9CA3AF', padding: '20px 16px', margin: 0, textAlign: 'center' }}>Sin pagos pendientes en los próximos {periodo} días.</p>
            ) : (
              proxCxP.map((c, i) => {
                const dias    = c.dias_restantes ?? 0
                const urgente = dias <= 7
                const tieneDesc = c.descuento_pp_fecha && c.descuento_pp_fecha >= hoy() && c.descuento_pp_monto > 0
                return (
                  <div
                    key={c.id}
                    onClick={() => nav(`/tesoreria/cxp/${c.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < proxCxP.length - 1 ? `0.5px solid #E5E7EB` : 'none', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: urgente ? '#DC2626' : '#D97706', flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.terceros?.razon_social || c.concepto}
                        </p>
                        {c.proveedor_critico && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, backgroundColor: '#FFFBEB', color: '#D97706', fontWeight: 700, flexShrink: 0 }}>CRÍTICO</span>}
                        {tieneDesc && <Zap size={11} color="#16A34A" style={{ flexShrink: 0 }} />}
                      </div>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                        {fmtFecha(c.fecha_vencimiento)} · {dias}d
                      </p>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#D97706', margin: 0, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      -${fmt(c.saldo_pendiente)}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Links rápidos ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
          {[
            { label: 'Bancos',        path: '/tesoreria/bancos',       icon: <Landmark size={18} color="#2563EB" />,    bg: '#EFF6FF'    },
            { label: 'Conciliación',  path: '/tesoreria/conciliacion', icon: <CheckCircle2 size={18} color="#16A34A" />, bg: '#F0FDF4' },
            { label: 'CxC',          path: '/tesoreria/cxc',          icon: <TrendingUp size={18} color="#16A34A" />,  bg: '#F0FDF4' },
            { label: 'CxP',          path: '/tesoreria/cxp',          icon: <TrendingDown size={18} color="#D97706" />,bg: '#FFFBEB' },
          ].map(a => (
            <button
              key={a.path}
              onClick={() => nav(a.path)}
              style={{ ...borde, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#FFFFFF', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.icon}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.label}</span>
              <ChevronRight size={14} style={{ color: '#9CA3AF', marginLeft: 'auto' }} />
            </button>
          ))}
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </MainLayout>
  )
}
