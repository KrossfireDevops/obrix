// ============================================================
//  OBRIX ERP — Página: Control Presupuestal
//  Archivo: src/pages/contabilidad/Presupuesto.jsx
//  Versión: 1.0 | Marzo 2026
//  Ruta: /contabilidad/presupuesto
// ============================================================

import { useState, useEffect } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, Save, Plus, ChevronDown } from 'lucide-react'
import { MainLayout } from '../../components/layout/MainLayout'
import {
  getResumenPresupuestal, getCuentas, upsertPresupuesto,
  formatMXN,
} from '../../services/libroMayor.service'
import { supabase } from '../../config/supabase'

export default function Presupuesto() {
  const año = new Date().getFullYear()
  const [resumen,    setResumen]    = useState([])
  const [cuentas,    setCuentas]    = useState([])
  const [proyectos,  setProyectos]  = useState([])
  const [proyecto,   setProyecto]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [editando,   setEditando]   = useState(null)  // cuenta_id en edición
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    Promise.all([
      getCuentas(),
      supabase.from('projects').select('id, name').order('name'),
    ]).then(([cs, { data: ps }]) => {
      setCuentas(cs.filter(c => c.es_presupuestable))
      setProyectos(ps ?? [])
    }).catch(console.error)
  }, [])

  useEffect(() => { cargar() }, [proyecto])

  const cargar = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getResumenPresupuestal(año, proyecto)
      setResumen(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleGuardar = async (cuentaId, monto) => {
    try {
      setSaving(true)
      await upsertPresupuesto({
        cuenta_id:           cuentaId,
        project_id:          proyecto,
        periodo_año:         año,
        periodo_mes:         null,
        monto_presupuestado: Number(monto),
      })
      setEditando(null)
      cargar()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // KPIs globales
  const totalPres  = resumen.reduce((s, r) => s + r.presupuestado, 0)
  const totalEjerc = resumen.reduce((s, r) => s + r.ejercido, 0)
  const totalDisp  = resumen.reduce((s, r) => s + r.disponible, 0)
  const pctGlobal  = totalPres > 0 ? Math.round((totalEjerc / totalPres) * 100) : 0
  const alertas    = resumen.filter(r => r.alerta).length

  return (
    <MainLayout title={`📊 Control Presupuestal ${año}`}>
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select value={proyecto ?? ''}
              onChange={e => setProyecto(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Empresa (general)</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button onClick={cargar}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiPres label="Presupuestado" valor={totalPres} color="blue" />
        <KpiPres label="Ejercido"      valor={totalEjerc} color={pctGlobal >= 80 ? 'red' : 'teal'} />
        <KpiPres label="Disponible"    valor={totalDisp}  color="green" />
        <div className="p-4 rounded-xl border bg-white border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">% Ejercido</p>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-bold ${pctGlobal >= 100 ? 'text-red-600' : pctGlobal >= 80 ? 'text-amber-600' : 'text-gray-900'}`}>
              {pctGlobal}%
            </span>
            {alertas > 0 && (
              <span className="text-xs text-amber-600 flex items-center gap-1 mb-0.5">
                <AlertTriangle size={12} /> {alertas} alertas
              </span>
            )}
          </div>
          <BarraProgreso pct={pctGlobal} />
        </div>
      </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Tabla presupuestal */}
        <div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-1">Código</div>
            <div className="col-span-3">Cuenta</div>
            <div className="col-span-2 text-right">Presupuestado</div>
            <div className="col-span-2 text-right">Ejercido</div>
            <div className="col-span-2 text-right">Disponible</div>
            <div className="col-span-1 text-center">%</div>
            <div className="col-span-1 text-center">Acción</div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : resumen.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay presupuesto configurado para {año}</p>
              <p className="text-xs text-gray-400 mt-1">
                Haz clic en "+" en cualquier cuenta para asignar presupuesto
              </p>
            </div>
          ) : (
            resumen.map(r => (
              <FilaPresupuesto key={r.cuenta_id}
                r={r}
                editando={editando === r.cuenta_id}
                saving={saving}
                onEditar={() => setEditando(r.cuenta_id)}
                onGuardar={(monto) => handleGuardar(r.cuenta_id, monto)}
                onCancelar={() => setEditando(null)}
              />
            ))
          )}

          {/* Agregar cuenta al presupuesto */}
          {!loading && (
            <AgregarCuentaPresupuesto
              cuentas={cuentas.filter(c => !resumen.find(r => r.cuenta_id === c.id))}
              onAgregar={(cuentaId) => handleGuardar(cuentaId, 0)}
            />
          )}

          {/* Total */}
          {resumen.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-100 border-t border-gray-200 text-sm font-semibold">
              <div className="col-span-4 text-gray-700">TOTALES</div>
              <div className="col-span-2 text-right font-mono text-gray-900">{formatMXN(totalPres)}</div>
              <div className="col-span-2 text-right font-mono text-gray-900">{formatMXN(totalEjerc)}</div>
              <div className={`col-span-2 text-right font-mono ${totalDisp < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {formatMXN(totalDisp)}
              </div>
              <div className={`col-span-1 text-center font-bold ${pctGlobal >= 100 ? 'text-red-600' : pctGlobal >= 80 ? 'text-amber-600' : 'text-gray-700'}`}>
                {pctGlobal}%
              </div>
              <div className="col-span-1" />
            </div>
          )}
        </div>
      </div>
      </div>
    </MainLayout>
  )
}

// ── Sub-componentes ────────────────────────────────────────

function FilaPresupuesto({ r, editando, saving, onEditar, onGuardar, onCancelar }) {
  const [monto, setMonto] = useState(r.presupuestado)
  const pct = r.pct

  return (
    <div className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 items-center text-sm
      ${r.alerta ? 'bg-amber-50' : ''}`}>
      <div className="col-span-1 font-mono text-xs text-gray-500">{r.cuenta?.codigo}</div>
      <div className="col-span-3 text-gray-700">
        {r.cuenta?.nombre}
        {r.alerta && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
      </div>
      <div className="col-span-2 text-right">
        {editando ? (
          <input type="number" value={monto} min="0" step="100"
            onChange={e => setMonto(e.target.value)}
            className="w-full px-2 py-1 text-xs text-right border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        ) : (
          <span className="font-mono text-gray-800">{formatMXN(r.presupuestado)}</span>
        )}
      </div>
      <div className="col-span-2 text-right font-mono text-gray-700">{formatMXN(r.ejercido)}</div>
      <div className={`col-span-2 text-right font-mono font-semibold ${r.disponible < 0 ? 'text-red-600' : 'text-green-700'}`}>
        {formatMXN(r.disponible)}
      </div>
      <div className="col-span-1 text-center">
        <span className={`text-xs font-bold ${pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-gray-600'}`}>
          {pct}%
        </span>
        <BarraProgreso pct={pct} mini />
      </div>
      <div className="col-span-1 flex justify-center gap-1">
        {editando ? (
          <>
            <button onClick={() => onGuardar(monto)} disabled={saving}
              className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg text-xs">
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            </button>
            <button onClick={onCancelar}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg text-xs">✕</button>
          </>
        ) : (
          <button onClick={onEditar}
            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
            ✏️
          </button>
        )}
      </div>
    </div>
  )
}

function AgregarCuentaPresupuesto({ cuentas, onAgregar }) {
  const [open, setOpen] = useState(false)
  if (cuentas.length === 0) return null
  return (
    <div className="border-t border-gray-100">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Plus size={14} /> Agregar cuenta al presupuesto
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50">
          <select onChange={e => { if (e.target.value) { onAgregar(e.target.value); setOpen(false) } }}
            className="flex-1 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg bg-white focus:outline-none">
            <option value="">— Seleccionar cuenta —</option>
            {cuentas.map(c => (
              <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
            ))}
          </select>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">Cancelar</button>
        </div>
      )}
    </div>
  )
}

function KpiPres({ label, valor, color }) {
  const map = {
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
    teal:  'bg-teal-50 border-teal-200 text-teal-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red:   'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`p-4 rounded-xl border ${map[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{formatMXN(valor)}</p>
    </div>
  )
}

function BarraProgreso({ pct, mini }) {
  const clamped = Math.min(pct, 100)
  const color   = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500'
  const h       = mini ? 'h-1' : 'h-2'
  return (
    <div className={`w-full bg-gray-200 rounded-full ${h} mt-1.5`}>
      <div className={`${h} rounded-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  )
}
