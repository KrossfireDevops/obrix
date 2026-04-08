// ============================================================
//  OBRIX ERP — Página: Catálogo de Cuentas
//  Archivo: src/pages/contabilidad/CatalogoCuentas.jsx
//  Versión: 1.0 | Marzo 2026
//  Ruta: /contabilidad/cuentas
// ============================================================

import { useState, useEffect } from 'react'
import {
  List, Plus, Save, X, RefreshCw, AlertTriangle,
  ChevronRight, ChevronDown, Search, Eye, EyeOff,
} from 'lucide-react'
import { getCuentasArbol, upsertCuenta, toggleCuenta } from '../../services/libroMayor.service'
import { MainLayout } from '../../components/layout/MainLayout'

const TIPOS = ['activo','pasivo','capital','ingreso','costo','egreso','orden']
const NATURALEZAS = ['deudora','acreedora']

const TIPO_COLOR = {
  activo:  'bg-blue-100 text-blue-700',
  pasivo:  'bg-purple-100 text-purple-700',
  capital: 'bg-teal-100 text-teal-700',
  ingreso: 'bg-green-100 text-green-700',
  costo:   'bg-orange-100 text-orange-700',
  egreso:  'bg-red-100 text-red-700',
  orden:   'bg-gray-100 text-gray-600',
}

const CUENTA_NUEVA = {
  codigo: '', codigo_sat: '', nombre: '', descripcion: '',
  nivel: 3, tipo: 'egreso', naturaleza: 'deudora',
  deducible: true, requiere_cfdi: false, aplica_iva: false,
  es_presupuestable: false, acepta_movimientos: true,
  incluir_anexo24: true, is_active: true, cuenta_padre_id: null,
}

export default function CatalogoCuentas() {
  const [arbol,     setArbol]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [busqueda,  setBusqueda]  = useState('')
  const [expandidos,setExpandidos]= useState({})
  const [editando,  setEditando]  = useState(null)   // cuenta o 'nueva'
  const [form,      setForm]      = useState(CUENTA_NUEVA)
  const [saving,    setSaving]    = useState(false)
  const [soloActivas, setSoloActivas] = useState(true)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getCuentasArbol()
      setArbol(data)
      // Expandir nivel 1 por defecto
      const exp = {}
      data.forEach(c => { exp[c.id] = true })
      setExpandidos(exp)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleEditar = (cuenta) => {
    setForm({ ...CUENTA_NUEVA, ...cuenta })
    setEditando(cuenta.id)
  }

  const handleNueva = (padreId = null, padreNivel = 0) => {
    setForm({ ...CUENTA_NUEVA, cuenta_padre_id: padreId, nivel: padreNivel + 1 })
    setEditando('nueva')
  }

  const handleGuardar = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setError('Código y nombre son obligatorios.'); return
    }
    try {
      setSaving(true); setError(null)
      await upsertCuenta(editando === 'nueva' ? form : { ...form, id: editando })
      setEditando(null)
      cargar()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleToggle = async (id, activo) => {
    try {
      await toggleCuenta(id, !activo)
      cargar()
    } catch (e) { setError(e.message) }
  }

  const toggleExpand = (id) => setExpandidos(p => ({ ...p, [id]: !p[id] }))

  // Búsqueda plana
  const todosFlat = flattenArbol(arbol)
  const filtrados = busqueda
    ? todosFlat.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.codigo.includes(busqueda) ||
        (c.codigo_sat ?? '').includes(busqueda)
      )
    : null

  return (
    <MainLayout title="📒 Catálogo de Cuentas">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10,
              top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input type="text" placeholder="Buscar por código, nombre o clave SAT…"
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 32px', fontSize: 12,
                border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none',
                background: '#fff', boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloActivas}
              onChange={e => setSoloActivas(e.target.checked)}
              style={{ accentColor: '#4F46E5' }} />
            Solo activas
          </label>
          <button onClick={cargar}
            style={{ padding: '8px 10px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => handleNueva()}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#4F46E5', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Nueva Cuenta
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 10,
            color: '#991B1B', fontSize: 12 }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* Árbol / Lista */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          {/* Encabezados */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
            <div className="col-span-2">Código</div>
            <div className="col-span-3">Nombre</div>
            <div className="col-span-1">SAT</div>
            <div className="col-span-1 text-center">Tipo</div>
            <div className="col-span-1 text-center">Nat.</div>
            <div className="col-span-1 text-center">Deduc.</div>
            <div className="col-span-1 text-center">CFDI</div>
            <div className="col-span-1 text-center">Presupto.</div>
            <div className="col-span-1 text-center">Acciones</div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : filtrados ? (
            // Vista de búsqueda — lista plana
            filtrados.map(c => (
              <FilaCuenta key={c.id} cuenta={c} nivel={0}
                onEditar={handleEditar} onToggle={handleToggle} onNueva={handleNueva}
                soloActivas={soloActivas} />
            ))
          ) : (
            // Vista árbol
            arbol.map(grupo => (
              <NodoArbol key={grupo.id} nodo={grupo}
                expandidos={expandidos} onToggle={toggleExpand}
                onEditar={handleEditar} onToggleActiva={handleToggle} onNueva={handleNueva}
                soloActivas={soloActivas} nivel={0} />
            ))
          )}
        </div>
      </div>

      {/* Modal: crear / editar cuenta */}
      {editando && (
        <ModalCuenta
          form={form} setForm={setForm}
          onGuardar={handleGuardar} onCerrar={() => setEditando(null)}
          saving={saving} esNueva={editando === 'nueva'}
        />
      )}
      </div>
    </MainLayout>
  )
}

// ── Nodo árbol recursivo ───────────────────────────────────

function NodoArbol({ nodo, expandidos, onToggle, onEditar, onToggleActiva, onNueva, soloActivas, nivel }) {
  const tieneHijos = nodo.hijos?.length > 0
  const expandido  = expandidos[nodo.id]

  if (soloActivas && !nodo.is_active) return null

  return (
    <>
      <FilaCuenta cuenta={nodo} nivel={nivel}
        expandido={expandido} tieneHijos={tieneHijos}
        onToggleExpand={() => onToggle(nodo.id)}
        onEditar={onEditar} onToggle={onToggleActiva} onNueva={onNueva}
        soloActivas={soloActivas} />
      {expandido && tieneHijos && nodo.hijos.map(hijo => (
        <NodoArbol key={hijo.id} nodo={hijo}
          expandidos={expandidos} onToggle={onToggle}
          onEditar={onEditar} onToggleActiva={onToggleActiva} onNueva={onNueva}
          soloActivas={soloActivas} nivel={nivel + 1} />
      ))}
    </>
  )
}

function FilaCuenta({ cuenta, nivel, expandido, tieneHijos, onToggleExpand, onEditar, onToggle, onNueva, soloActivas }) {
  const indent = nivel * 20
  if (soloActivas && !cuenta.is_active) return null
  return (
    <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-50 items-center text-sm
      ${!cuenta.is_active ? 'opacity-40' : ''}
      ${cuenta.nivel === 1 ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}
    `}>
      {/* Código */}
      <div className="col-span-2 flex items-center gap-1" style={{ paddingLeft: indent }}>
        {tieneHijos ? (
          <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600">
            {expandido ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="w-4" />}
        <span className="font-mono text-xs text-gray-600">{cuenta.codigo}</span>
      </div>
      {/* Nombre */}
      <div className="col-span-3 truncate">
        <span className={cuenta.nivel === 1 ? 'text-gray-900' : 'text-gray-700'}>{cuenta.nombre}</span>
        {!cuenta.deducible && (
          <span className="ml-1 text-xs px-1 bg-red-100 text-red-600 rounded">ND</span>
        )}
      </div>
      {/* Código SAT */}
      <div className="col-span-1 font-mono text-xs text-gray-400">{cuenta.codigo_sat ?? '—'}</div>
      {/* Tipo */}
      <div className="col-span-1 text-center">
        <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${TIPO_COLOR[cuenta.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
          {cuenta.tipo}
        </span>
      </div>
      {/* Naturaleza */}
      <div className="col-span-1 text-center text-xs text-gray-500 capitalize">{cuenta.naturaleza}</div>
      {/* Deducible */}
      <div className="col-span-1 text-center text-xs">
        {cuenta.deducible ? '✅' : '❌'}
      </div>
      {/* Requiere CFDI */}
      <div className="col-span-1 text-center text-xs">
        {cuenta.requiere_cfdi ? '✅' : '—'}
      </div>
      {/* Presupuestable */}
      <div className="col-span-1 text-center text-xs">
        {cuenta.es_presupuestable ? '✅' : '—'}
      </div>
      {/* Acciones */}
      <div className="col-span-1 flex items-center justify-center gap-1">
        <button onClick={() => onEditar(cuenta)}
          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-xs">
          ✏️
        </button>
        {!cuenta.acepta_movimientos && (
          <button onClick={() => onNueva(cuenta.id, cuenta.nivel)}
            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
            <Plus size={11} />
          </button>
        )}
        <button onClick={() => onToggle(cuenta.id, cuenta.is_active)}
          className={`p-1 rounded transition-colors ${cuenta.is_active ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300 hover:text-gray-500'}`}
          title={cuenta.is_active ? 'Desactivar' : 'Activar'}>
          {cuenta.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
    </div>
  )
}

// ── Modal editar / nueva cuenta ───────────────────────────

function ModalCuenta({ form, setForm, onGuardar, onCerrar, saving, esNueva }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {esNueva ? 'Nueva Cuenta Contable' : 'Editar Cuenta'}
          </h2>
          <button onClick={onCerrar} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Código *" value={form.codigo} onChange={v => set('codigo', v)} placeholder="Ej: 6.1.12" />
            <Campo label="Código SAT" value={form.codigo_sat ?? ''} onChange={v => set('codigo_sat', v)} placeholder="Ej: 6112" />
          </div>
          <Campo label="Nombre *" value={form.nombre} onChange={v => set('nombre', v)} placeholder="Nombre de la cuenta" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {TIPOS.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Naturaleza *</label>
              <select value={form.naturaleza} onChange={e => set('naturaleza', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {NATURALEZAS.map(n => <option key={n} value={n} className="capitalize">{n}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nivel (1–4)</label>
              <input type="number" min={1} max={4} value={form.nivel}
                onChange={e => set('nivel', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          {/* Checkboxes */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'deducible',         label: 'Es deducible (LISR)'    },
              { key: 'requiere_cfdi',      label: 'Requiere CFDI'          },
              { key: 'aplica_iva',         label: 'Aplica IVA'             },
              { key: 'es_presupuestable',  label: 'Presupuestable'         },
              { key: 'acepta_movimientos', label: 'Acepta movimientos'     },
              { key: 'incluir_anexo24',    label: 'Incluir en Anexo 24'    },
              { key: 'is_active',          label: 'Cuenta activa'          },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form[key]}
                  onChange={e => set(key, e.target.checked)} className="rounded" />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onCerrar}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onGuardar} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {esNueva ? 'Crear Cuenta' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
    </div>
  )
}

// Utilidad: aplanar árbol para búsqueda
function flattenArbol(nodos, acc = []) {
  nodos.forEach(n => { acc.push(n); if (n.hijos?.length) flattenArbol(n.hijos, acc) })
  return acc
}
