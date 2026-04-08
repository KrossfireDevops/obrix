// ============================================================
//  OBRIX ERP — Página: Libro Mayor
//  Archivo: src/pages/contabilidad/LibroMayor.jsx
//  Versión: 1.0 | Marzo 2026
//  Ruta: /contabilidad/libro-mayor
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, RefreshCw, AlertTriangle, ChevronDown,
  ChevronRight, TrendingUp, TrendingDown, Calendar,
  FileText, Search, Filter,
} from 'lucide-react'
import {
  getSaldosCuentas, getMovimientosCuenta,
  formatMXN, formatFecha, getMesActual,
} from '../../services/libroMayor.service'
import { MainLayout } from '../../components/layout/MainLayout'

const TIPOS_FILTRO = [
  { value: '',        label: 'Todos' },
  { value: 'activo',  label: 'Activo' },
  { value: 'pasivo',  label: 'Pasivo' },
  { value: 'capital', label: 'Capital' },
  { value: 'ingreso', label: 'Ingresos' },
  { value: 'costo',   label: 'Costos' },
  { value: 'egreso',  label: 'Gastos' },
]

export default function LibroMayor() {
  const navigate = useNavigate()
  const { desde, hasta, año, mes } = getMesActual()

  const [rango,       setRango]       = useState({ desde, hasta })
  const [saldos,      setSaldos]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [filtroTipo,  setFiltroTipo]  = useState('')
  const [busqueda,    setBusqueda]    = useState('')
  const [expandida,   setExpandida]   = useState(null)  // cuenta_id con drill-down abierto
  const [movimientos, setMovimientos] = useState([])
  const [loadingMov,  setLoadingMov]  = useState(false)

  useEffect(() => { cargar() }, [rango])

  const cargar = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSaldosCuentas(rango.desde, rango.hasta)
      setSaldos(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExpandir = async (cuentaId) => {
    if (expandida === cuentaId) { setExpandida(null); return }
    setExpandida(cuentaId)
    setLoadingMov(true)
    try {
      const movs = await getMovimientosCuenta(cuentaId, rango.desde, rango.hasta)
      setMovimientos(movs)
    } catch { setMovimientos([]) }
    finally { setLoadingMov(false) }
  }

  // Filtrar y agrupar
  const saldosFiltrados = saldos.filter(s => {
    const matchTipo = !filtroTipo || s.tipo === filtroTipo
    const matchBus  = !busqueda  ||
      s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.codigo.includes(busqueda)
    return matchTipo && matchBus
  })

  // Totales por grupo de tipo
  const totales = saldosFiltrados.reduce((acc, s) => {
    acc.cargos += s.total_cargos
    acc.abonos += s.total_abonos
    return acc
  }, { cargos: 0, abonos: 0 })

  // KPIs rápidos
  const totalIngresos = saldos
    .filter(s => s.tipo === 'ingreso').reduce((a, s) => a + s.saldo, 0)
  const totalGastos = saldos
    .filter(s => ['egreso','costo'].includes(s.tipo)).reduce((a, s) => a + s.saldo, 0)
  const utilidad = totalIngresos - totalGastos

  if (loading) return <Spinner />

  return (
    <MainLayout title="📖 Libro Mayor">
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-end gap-3">
          <RangoSelector rango={rango} onChange={r => { setRango(r); setExpandida(null) }} />
          <button onClick={cargar}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Ingresos"  valor={totalIngresos} color="teal"   icon={TrendingUp}   />
        <KpiCard label="Total Gastos"    valor={totalGastos}   color="red"    icon={TrendingDown} />
        <KpiCard label="Utilidad Neta"   valor={utilidad}
          color={utilidad >= 0 ? 'blue' : 'amber'} icon={BookOpen} destacado />
      </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Tabla de saldos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Buscar cuenta…" value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52"
              />
            </div>
            <div className="flex gap-1">
              {TIPOS_FILTRO.map(t => (
                <button key={t.value} onClick={() => setFiltroTipo(t.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filtroTipo === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-gray-400">
              {saldosFiltrados.length} cuentas
            </span>
          </div>

          {/* Encabezados */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-1">Código</div>
            <div className="col-span-4">Cuenta</div>
            <div className="col-span-2 text-center">Tipo</div>
            <div className="col-span-2 text-right">Cargos</div>
            <div className="col-span-2 text-right">Abonos</div>
            <div className="col-span-1 text-right">Saldo</div>
          </div>

          {/* Filas */}
          {saldosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              No hay movimientos en el período seleccionado
            </div>
          ) : (
            saldosFiltrados.map(s => (
              <div key={s.id}>
                {/* Fila principal */}
                <div
                  onClick={() => handleExpandir(s.id)}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50
                    cursor-pointer hover:bg-indigo-50 transition-colors text-sm
                    ${expandida === s.id ? 'bg-indigo-50' : ''}
                    ${s.nivel === 1 ? 'bg-gray-50 font-semibold' : ''}
                  `}
                  style={{ paddingLeft: `${(s.nivel - 1) * 16 + 16}px` }}
                >
                  <div className="col-span-1 font-mono text-xs text-gray-500">{s.codigo}</div>
                  <div className="col-span-4 flex items-center gap-1.5">
                    {expandida === s.id
                      ? <ChevronDown size={13} className="text-indigo-500 shrink-0" />
                      : <ChevronRight size={13} className="text-gray-400 shrink-0" />
                    }
                    <span className={s.nivel === 1 ? 'text-gray-900' : 'text-gray-700'}>
                      {s.nombre}
                    </span>
                    {!s.deducible && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                        No deducible
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-center">
                    <TipoBadge tipo={s.tipo} />
                  </div>
                  <div className="col-span-2 text-right text-gray-700 font-mono text-xs">
                    {s.total_cargos > 0 ? formatMXN(s.total_cargos) : '—'}
                  </div>
                  <div className="col-span-2 text-right text-gray-700 font-mono text-xs">
                    {s.total_abonos > 0 ? formatMXN(s.total_abonos) : '—'}
                  </div>
                  <div className={`col-span-1 text-right font-semibold font-mono text-xs
                    ${s.saldo >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatMXN(s.saldo)}
                  </div>
                </div>

                {/* Drill-down de movimientos */}
                {expandida === s.id && (
                  <div className="bg-indigo-50 border-b border-indigo-100">
                    {loadingMov ? (
                      <div className="flex items-center gap-2 px-8 py-4 text-sm text-gray-500">
                        <RefreshCw size={13} className="animate-spin" /> Cargando movimientos…
                      </div>
                    ) : movimientos.length === 0 ? (
                      <p className="px-8 py-4 text-sm text-gray-400">
                        Sin movimientos en este período
                      </p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 font-semibold uppercase">
                            <th className="px-8 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Póliza</th>
                            <th className="px-3 py-2 text-left">Concepto</th>
                            <th className="px-3 py-2 text-right">Cargo</th>
                            <th className="px-3 py-2 text-right">Abono</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientos.map(m => (
                            <tr key={m.id}
                              onClick={() => navigate(`/contabilidad/polizas/${m.polizas?.id}`)}
                              className="hover:bg-indigo-100 cursor-pointer border-t border-indigo-100">
                              <td className="px-8 py-2 text-gray-600">
                                {formatFecha(m.polizas?.fecha)}
                              </td>
                              <td className="px-3 py-2 font-mono text-indigo-600 hover:underline">
                                {m.polizas?.folio}
                              </td>
                              <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
                                {m.concepto ?? m.polizas?.concepto}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-800 font-mono">
                                {m.tipo_movimiento === 'cargo' ? formatMXN(m.monto) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-800 font-mono">
                                {m.tipo_movimiento === 'abono' ? formatMXN(m.monto) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Totales */}
          {saldosFiltrados.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-100 border-t border-gray-200 text-sm font-semibold">
              <div className="col-span-5 text-gray-700">TOTALES</div>
              <div className="col-span-2" />
              <div className="col-span-2 text-right font-mono text-gray-900">
                {formatMXN(totales.cargos)}
              </div>
              <div className="col-span-2 text-right font-mono text-gray-900">
                {formatMXN(totales.abonos)}
              </div>
              <div className={`col-span-1 text-right font-mono font-bold
                ${totales.cargos - totales.abonos >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatMXN(totales.cargos - totales.abonos)}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

// ── Sub-componentes ────────────────────────────────────────

function KpiCard({ label, valor, color, icon: Icon, destacado }) {
  const colors = {
    teal:  { bg: 'bg-teal-50',  text: 'text-teal-700',  border: 'border-teal-200'  },
    red:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200'   },
    blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200'  },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  }
  const c = colors[color]
  return (
    <div className={`p-4 rounded-xl border ${c.bg} ${c.border} ${destacado ? 'ring-2 ring-indigo-200' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>{label}</span>
        <Icon size={16} className={c.text} />
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{formatMXN(valor)}</p>
    </div>
  )
}

function TipoBadge({ tipo }) {
  const map = {
    activo:  'bg-blue-100 text-blue-700',
    pasivo:  'bg-purple-100 text-purple-700',
    capital: 'bg-teal-100 text-teal-700',
    ingreso: 'bg-green-100 text-green-700',
    costo:   'bg-orange-100 text-orange-700',
    egreso:  'bg-red-100 text-red-700',
    orden:   'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${map[tipo] ?? 'bg-gray-100 text-gray-600'}`}>
      {tipo}
    </span>
  )
}

function RangoSelector({ rango, onChange }) {
  const opciones = [
    { label: 'Mes actual',      fn: () => { const h=new Date(); const i=new Date(h.getFullYear(),h.getMonth(),1); return { desde: i.toISOString().split('T')[0], hasta: h.toISOString().split('T')[0] } } },
    { label: 'Últimos 30 días', fn: () => { const h=new Date(); const i=new Date(); i.setDate(h.getDate()-30); return { desde: i.toISOString().split('T')[0], hasta: h.toISOString().split('T')[0] } } },
    { label: 'Trimestre actual',fn: () => { const h=new Date(); const t=Math.floor(h.getMonth()/3); const i=new Date(h.getFullYear(),t*3,1); return { desde: i.toISOString().split('T')[0], hasta: h.toISOString().split('T')[0] } } },
    { label: 'Año actual',      fn: () => { const h=new Date(); return { desde: `${h.getFullYear()}-01-01`, hasta: h.toISOString().split('T')[0] } } },
  ]
  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300">
        <Calendar size={14} />
        {new Date(rango.desde).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}
        {' — '}
        {new Date(rango.hasta).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}
        <ChevronDown size={13} />
      </button>
      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
        {opciones.map(op => (
          <button key={op.label} onClick={() => onChange(op.fn())}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg">
            {op.label}
          </button>
        ))}
        <div className="border-t border-gray-100 p-2 space-y-1">
          <input type="date" value={rango.desde}
            onChange={e => onChange({ ...rango, desde: e.target.value })}
            className="w-full text-xs px-2 py-1 border border-gray-200 rounded" />
          <input type="date" value={rango.hasta}
            onChange={e => onChange({ ...rango, hasta: e.target.value })}
            className="w-full text-xs px-2 py-1 border border-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <MainLayout title="📖 Libro Mayor">
      <div className="flex justify-center py-24">
        <RefreshCw size={24} className="text-indigo-500 animate-spin" />
      </div>
    </MainLayout>
  )
}
