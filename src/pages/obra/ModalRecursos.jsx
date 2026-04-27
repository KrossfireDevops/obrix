// ============================================================
//  OBRIX ERP — Modal de Recursos por Actividad
//  src/pages/obra/ModalRecursos.jsx  |  v1.0
//
//  Tabs:
//    · Dependencias — predecesores/sucesores con tipo y lag
//    · Personal     — asignación con tipo pago (fijo/destajo)
//    · Maquinaria   — equipos asignados con horas y costo
//    · Herramientas — herramientas especiales
//
//  Alerta prominente: "Calculado con N elemento(s)"
//  Al agregar recursos → recalcula duración estimada
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  X, Plus, Trash2, RefreshCw, AlertTriangle,
  Link2, Users, Truck, Wrench, ChevronDown,
  CheckCircle, Clock, Info, Edit2, Save,
} from 'lucide-react'
import {
  getDependenciasNodo, crearDependencia,
  actualizarDependencia, eliminarDependencia,
  getPersonalAsignado, asignarPersonalActividad,
  retirarPersonalActividad,
  getMaquinariaCatalogo, getMaquinariaAsignada,
  asignarMaquinaria, retirarMaquinaria, actualizarMaquinariaAsig,
  getHerramientasCatalogo, getHerramientasAsignadas,
  asignarHerramienta, retirarHerramienta,
  getPrecioActividad, guardarPrecioActividad,
  TIPO_DEP_CFG,
} from '../../services/programaObra.service'
import { getPersonal } from '../../services/gestionPersonal.service'
import { supabase } from '../../config/supabase'

// ─────────────────────────────────────────────────────────────
// Estilos base
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '7px 9px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 7,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}
const sel = { ...inp }

const Btn = ({ onClick, icon: Icon, label, disabled, variant = 'primary', small, fullWidth }) => {
  const v = {
    primary:   { bg: disabled ? '#E5E7EB' : '#2563EB', color: disabled ? '#9CA3AF' : '#fff', border: 'none' },
    secondary: { bg: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' },
    danger:    { bg: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
    success:   { bg: '#F0FDF4', color: '#065F46', border: '1px solid #A7F3D0' },
    ghost:     { bg: 'transparent', color: '#6B7280', border: 'none' },
  }[variant]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: small ? '5px 9px' : '7px 13px',
      borderRadius: 7, border: v.border,
      backgroundColor: v.bg, color: v.color,
      fontSize: small ? 11 : 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : 'auto', whiteSpace: 'nowrap',
    }}>
      {Icon && <Icon size={small ? 11 : 13} />}{label}
    </button>
  )
}

const fmt$ = (n) => n != null ? `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'

// ─────────────────────────────────────────────────────────────
// TAB: DEPENDENCIAS
// ─────────────────────────────────────────────────────────────
const TabDependencias = ({ nodo, projectId, tareas, toast, onRecalcular }) => {
  const [deps,        setDeps]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [form, setForm] = useState({ predecesor_id: '', tipo: 'FS', lag_dias: 0 })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDependenciasNodo(projectId, nodo.wbs_id)
      setDeps(data)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [projectId, nodo.wbs_id])

  useEffect(() => { cargar() }, [cargar])

  const predecesores = deps.filter(d => d.sucesor_id  === nodo.wbs_id)
  const sucesores    = deps.filter(d => d.predecesor_id === nodo.wbs_id)

  const handleAgregar = async () => {
    if (!form.predecesor_id) { toast.error('Selecciona el nodo predecesor'); return }
    if (form.predecesor_id === nodo.wbs_id) { toast.error('Una actividad no puede depender de sí misma'); return }
    setSaving(true)
    try {
      await crearDependencia(projectId, form.predecesor_id, nodo.wbs_id, form.tipo, parseInt(form.lag_dias) || 0)
      toast.success('Dependencia creada ✓')
      setShowForm(false)
      setForm({ predecesor_id: '', tipo: 'FS', lag_dias: 0 })
      cargar()
      onRecalcular()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleEliminar = async (depId) => {
    try {
      await eliminarDependencia(depId)
      toast.success('Dependencia eliminada')
      cargar()
      onRecalcular()
    } catch (e) { toast.error(e.message) }
  }

  // Opciones disponibles (excluir el nodo actual y sus ya dependientes)
  const yaVinculados = new Set(deps.map(d => d.predecesor_id).concat(deps.map(d => d.sucesor_id)))
  const opcionesTareas = (tareas ?? []).filter(t =>
    t.wbs_id !== nodo.wbs_id && !yaVinculados.has(t.wbs_id)
  )

  return (
    <div>
      {/* Aviso OBRIX: secuencia estándar aplicada */}
      {predecesores.length === 0 && sucesores.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
          backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, marginBottom: 12 }}>
          <Info size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#1E40AF', margin: 0 }}>
            Esta actividad no tiene dependencias configuradas. Las dependencias controlan
            cuándo puede iniciar en el Gantt. Puedes agregar predecesores aquí o usar
            <strong> Recalcular</strong> para aplicar la secuencia estándar OBRIX.
          </p>
        </div>
      )}

      {/* Predecesores */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Predecesores ({predecesores.length})
          </p>
          <Btn onClick={() => setShowForm(!showForm)} icon={Plus}
            label="Agregar" variant="secondary" small />
        </div>

        {showForm && (
          <div style={{ padding: 10, backgroundColor: '#F0F9FF',
            border: '1px solid #BAE6FD', borderRadius: 8, marginBottom: 10 }}>
            <div style={{ marginBottom: 7 }}>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Actividad predecesor *
              </label>
              <select style={sel} value={form.predecesor_id}
                onChange={e => setForm(f => ({ ...f, predecesor_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {opcionesTareas.map(t => (
                  <option key={t.wbs_id} value={t.wbs_id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Tipo de dependencia
                </label>
                <select style={sel} value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPO_DEP_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Lag (días)
                </label>
                <input type="number" style={inp} value={form.lag_dias} min="-30" max="30"
                  placeholder="0 = sin desfase"
                  onChange={e => setForm(f => ({ ...f, lag_dias: e.target.value }))} />
              </div>
            </div>
            {form.tipo && (
              <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 8px',
                padding: '4px 8px', backgroundColor: '#F1F5F9', borderRadius: 5 }}>
                💡 {TIPO_DEP_CFG[form.tipo]?.desc}
              </p>
            )}
            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowForm(false)} icon={X} label="Cancelar" variant="secondary" small />
              <Btn onClick={handleAgregar} icon={CheckCircle} label={saving ? 'Guardando…' : 'Guardar'}
                disabled={saving || !form.predecesor_id} small />
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 12, color: '#9CA3AF' }}>
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : predecesores.length === 0 ? (
          <p style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
            Sin predecesores — esta actividad puede iniciar en cualquier momento
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {predecesores.map(d => (
              <DepRow key={d.id} dep={d} esPredecesor nodo={nodo}
                onEliminar={handleEliminar} toast={toast} onActualizar={cargar} />
            ))}
          </div>
        )}
      </div>

      {/* Sucesores */}
      {sucesores.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Sucesores ({sucesores.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sucesores.map(d => (
              <DepRow key={d.id} dep={d} esPredecesor={false} nodo={nodo}
                onEliminar={handleEliminar} toast={toast} onActualizar={cargar} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Fila de dependencia editable
const DepRow = ({ dep, esPredecesor, nodo, onEliminar, toast, onActualizar }) => {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ tipo: dep.tipo, lag_dias: dep.lag_dias })
  const [saving, setSaving] = useState(false)

  const otroNodo = esPredecesor ? dep.predecesor : dep.sucesor
  const cfg = TIPO_DEP_CFG[dep.tipo] ?? {}

  const handleGuardar = async () => {
    setSaving(true)
    try {
      await actualizarDependencia(dep.id, form.tipo, parseInt(form.lag_dias) || 0)
      toast.success('Dependencia actualizada ✓')
      setEditando(false)
      onActualizar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '8px 10px', backgroundColor: '#F9FAFB',
      border: '1px solid #E5E7EB', borderRadius: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link2 size={12} color="#6B7280" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {otroNodo?.nombre ?? '—'}
          </p>
          {!editando && (
            <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
              {dep.tipo} · {cfg.label}
              {dep.lag_dias !== 0 && ` · ${dep.lag_dias > 0 ? '+' : ''}${dep.lag_dias}d lag`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setEditando(!editando)}
            style={{ padding: 4, border: 'none', background: 'none',
              cursor: 'pointer', color: '#6B7280' }}>
            <Edit2 size={11} />
          </button>
          <button onClick={() => onEliminar(dep.id)}
            style={{ padding: 4, border: 'none', background: 'none',
              cursor: 'pointer', color: '#EF4444' }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {editando && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
          <select style={{ ...sel, fontSize: 11, padding: '5px 7px' }}
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {Object.keys(TIPO_DEP_CFG).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input type="number" style={{ ...inp, fontSize: 11, padding: '5px 7px' }}
            value={form.lag_dias} min="-30" max="30" placeholder="Lag"
            onChange={e => setForm(f => ({ ...f, lag_dias: e.target.value }))} />
          <button onClick={handleGuardar} disabled={saving}
            style={{ padding: '5px 8px', borderRadius: 6, border: 'none',
              backgroundColor: '#2563EB', color: '#fff', cursor: 'pointer',
              fontSize: 11, fontWeight: 600 }}>
            {saving ? '…' : <Save size={11} />}
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: PERSONAL
// ─────────────────────────────────────────────────────────────
const TabPersonal = ({ nodo, projectId, toast, onRecalcular }) => {
  const [personal,     setPersonal]     = useState([])
  const [catalogo,     setCatalogo]     = useState([])
  const [precioVig,    setPrecioVig]    = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [showPrecio,   setShowPrecio]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form, setForm] = useState({
    trabajadorId: '', es_lider: false, rol_actividad: '',
    tipo_pago: 'fijo', sueldo_dia: '', precio_destajo: '', unidad_destajo: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
  })
  const [formPrecio, setFormPrecio] = useState({
    tipo_pago: 'fijo', precio_unitario: '', unidad_medida: '',
    precio_dia: '', fecha_inicio: new Date().toISOString().split('T')[0],
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [pers, cat, precio] = await Promise.all([
        getPersonalAsignado(nodo.wbs_id),
        getPersonal({ estatus: 'activo' }),
        getPrecioActividad(nodo.wbs_id),
      ])
      setPersonal(pers)
      setCatalogo(Array.isArray(cat) ? cat : (cat?.data ?? []))
      setPrecioVig(precio)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [nodo.wbs_id])

  useEffect(() => { cargar() }, [cargar])

  const handleAsignar = async () => {
    if (!form.trabajadorId) { toast.error('Selecciona un trabajador'); return }
    setSaving(true)
    try {
      await asignarPersonalActividad(projectId, nodo.wbs_id, form.trabajadorId, {
        es_lider:       form.es_lider,
        rol_actividad:  form.rol_actividad || null,
        tipo_pago:      form.tipo_pago,
        sueldo_dia:     form.sueldo_dia     ? parseFloat(form.sueldo_dia)     : null,
        precio_destajo: form.precio_destajo ? parseFloat(form.precio_destajo) : null,
        unidad_destajo: form.unidad_destajo || null,
        fecha_inicio:   form.fecha_inicio,
      })
      toast.success('Personal asignado ✓')
      setShowForm(false)
      cargar()
      onRecalcular()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleRetirar = async (asigId) => {
    try {
      await retirarPersonalActividad(asigId)
      toast.success('Trabajador retirado')
      cargar()
      onRecalcular()
    } catch (e) { toast.error(e.message) }
  }

  const handleGuardarPrecio = async () => {
    if (!formPrecio.tipo_pago) { toast.error('Selecciona tipo de pago'); return }
    setSaving(true)
    try {
      await guardarPrecioActividad(nodo.wbs_id, projectId, formPrecio)
      toast.success('Precio configurado ✓')
      setShowPrecio(false)
      cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const sinAsignar = catalogo.filter(p => !personal.some(pa => pa.trabajador_id === p.id))
  const totalSueldo = personal.reduce((s, p) => s + (parseFloat(p.sueldo_dia) || 0), 0)

  return (
    <div>
      {/* Precio vigente de la actividad */}
      <div style={{ marginBottom: 12, padding: '8px 12px',
        backgroundColor: precioVig ? '#F0FDF4' : '#FFFBEB',
        border: `1px solid ${precioVig ? '#A7F3D0' : '#FDE68A'}`,
        borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280',
              textTransform: 'uppercase', margin: '0 0 2px' }}>Esquema de pago vigente</p>
            {precioVig ? (
              <p style={{ fontSize: 12, color: '#065F46', fontWeight: 600, margin: 0 }}>
                {precioVig.tipo_pago === 'fijo'
                  ? `Fijo: ${fmt$(precioVig.precio_dia)}/persona/día`
                  : `Destajo: ${fmt$(precioVig.precio_unitario)} por ${precioVig.unidad_medida}`}
              </p>
            ) : (
              <p style={{ fontSize: 11, color: '#B45309', margin: 0 }}>
                Sin precio configurado — necesario para calcular costos
              </p>
            )}
          </div>
          <Btn onClick={() => setShowPrecio(!showPrecio)} icon={Edit2}
            label="Configurar" variant="secondary" small />
        </div>
      </div>

      {showPrecio && (
        <div style={{ padding: 10, backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
            Esquema de pago para esta actividad
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Tipo de pago *
              </label>
              <select style={sel} value={formPrecio.tipo_pago}
                onChange={e => setFormPrecio(f => ({ ...f, tipo_pago: e.target.value }))}>
                <option value="fijo">Fijo — precio por día/persona</option>
                <option value="destajo">Destajo — precio por unidad avance</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Vigencia desde
              </label>
              <input type="date" style={inp} value={formPrecio.fecha_inicio}
                onChange={e => setFormPrecio(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
          </div>
          {formPrecio.tipo_pago === 'fijo' ? (
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Precio día/persona ($)
              </label>
              <input type="number" min="0" style={inp} placeholder="Ej: 350.00"
                value={formPrecio.precio_dia}
                onChange={e => setFormPrecio(f => ({ ...f, precio_dia: e.target.value }))} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Precio unitario ($)
                </label>
                <input type="number" min="0" style={inp} placeholder="Ej: 85.00"
                  value={formPrecio.precio_unitario}
                  onChange={e => setFormPrecio(f => ({ ...f, precio_unitario: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Unidad de medida
                </label>
                <input type="text" style={inp} placeholder="m2, ml, pieza..."
                  value={formPrecio.unidad_medida}
                  onChange={e => setFormPrecio(f => ({ ...f, unidad_medida: e.target.value }))} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn onClick={() => setShowPrecio(false)} icon={X} label="Cancelar" variant="secondary" small />
            <Btn onClick={handleGuardarPrecio} icon={Save}
              label={saving ? 'Guardando…' : 'Guardar precio'} disabled={saving} small />
          </div>
        </div>
      )}

      {/* Lista de personal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Personal asignado ({personal.length})
          {personal.length > 0 && (
            <span style={{ fontWeight: 400, color: '#6B7280', textTransform: 'none', marginLeft: 6 }}>
              · {fmt$(totalSueldo)}/día total
            </span>
          )}
        </p>
        <Btn onClick={() => setShowForm(!showForm)} icon={Plus}
          label="Asignar" variant="secondary" small />
      </div>

      {showForm && (
        <div style={{ padding: 10, backgroundColor: '#F0FDF4',
          border: '1px solid #A7F3D0', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ marginBottom: 7 }}>
            <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
              Trabajador *
            </label>
            <select style={sel} value={form.trabajadorId}
              onChange={e => setForm(f => ({ ...f, trabajadorId: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {sinAsignar.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo}{p.especialidad ? ` · ${p.especialidad}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 7 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Rol en actividad
              </label>
              <input type="text" style={inp} placeholder="Oficial, Ayudante..."
                value={form.rol_actividad}
                onChange={e => setForm(f => ({ ...f, rol_actividad: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Tipo de pago
              </label>
              <select style={sel} value={form.tipo_pago}
                onChange={e => setForm(f => ({ ...f, tipo_pago: e.target.value }))}>
                <option value="fijo">Fijo</option>
                <option value="destajo">Destajo</option>
              </select>
            </div>
          </div>
          {form.tipo_pago === 'fijo' ? (
            <div style={{ marginBottom: 7 }}>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Sueldo diario ($)
              </label>
              <input type="number" min="0" style={inp} placeholder="Ej: 350.00"
                value={form.sueldo_dia}
                onChange={e => setForm(f => ({ ...f, sueldo_dia: e.target.value }))} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 7 }}>
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Precio destajo ($)
                </label>
                <input type="number" min="0" style={inp} placeholder="Ej: 85.00"
                  value={form.precio_destajo}
                  onChange={e => setForm(f => ({ ...f, precio_destajo: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                  Unidad
                </label>
                <input type="text" style={inp} placeholder="m2, ml..."
                  value={form.unidad_destajo}
                  onChange={e => setForm(f => ({ ...f, unidad_destajo: e.target.value }))} />
              </div>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: '#374151', cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={form.es_lider}
              onChange={e => setForm(f => ({ ...f, es_lider: e.target.checked }))}
              style={{ accentColor: '#2563EB' }} />
            Líder de actividad
          </label>
          <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setShowForm(false)} icon={X} label="Cancelar" variant="secondary" small />
            <Btn onClick={handleAsignar} icon={CheckCircle}
              label={saving ? 'Guardando…' : 'Asignar'}
              disabled={saving || !form.trabajadorId} small />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: '#9CA3AF' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : personal.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF' }}>
          <Users size={22} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
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
                <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0,
                  display: 'flex', alignItems: 'center', gap: 5 }}>
                  {p.trabajador?.nombre_completo ?? '—'}
                  {p.es_lider && (
                    <span style={{ fontSize: 9, fontWeight: 700,
                      backgroundColor: '#FEF9C3', color: '#B45309',
                      padding: '0 5px', borderRadius: 4 }}>Líder</span>
                  )}
                  {p.tipo_pago && (
                    <span style={{ fontSize: 9, fontWeight: 600,
                      backgroundColor: p.tipo_pago === 'destajo' ? '#F0FDF4' : '#EFF6FF',
                      color: p.tipo_pago === 'destajo' ? '#065F46' : '#1E40AF',
                      padding: '0 5px', borderRadius: 4 }}>
                      {p.tipo_pago === 'destajo' ? 'Destajo' : 'Fijo'}
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
                  {p.rol_actividad ?? p.trabajador?.especialidad ?? '—'}
                  {p.sueldo_dia && ` · ${fmt$(p.sueldo_dia)}/día`}
                </p>
              </div>
              <button onClick={() => handleRetirar(p.id)}
                style={{ padding: 5, border: 'none', background: 'none',
                  cursor: 'pointer', color: '#9CA3AF' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: MAQUINARIA
// ─────────────────────────────────────────────────────────────
const TabMaquinaria = ({ nodo, projectId, toast, onRecalcular }) => {
  const [asignada,  setAsignada]  = useState([])
  const [catalogo,  setCatalogo]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({
    maquinaria_id: '', cantidad: 1, horas_dia: 8,
    costo_hora_override: '', fecha_inicio: '', fecha_fin: '', notas: '',
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [asig, cat] = await Promise.all([
        getMaquinariaAsignada(projectId, nodo.wbs_id),
        getMaquinariaCatalogo(),
      ])
      setAsignada(asig)
      setCatalogo(cat)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [projectId, nodo.wbs_id])

  useEffect(() => { cargar() }, [cargar])

  const handleAsignar = async () => {
    if (!form.maquinaria_id) { toast.error('Selecciona el equipo'); return }
    setSaving(true)
    try {
      await asignarMaquinaria(projectId, nodo.wbs_id, form)
      toast.success('Maquinaria asignada ✓')
      setShowForm(false)
      setForm({ maquinaria_id: '', cantidad: 1, horas_dia: 8,
        costo_hora_override: '', fecha_inicio: '', fecha_fin: '', notas: '' })
      cargar()
      onRecalcular()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const maquinaSeleccionada = catalogo.find(m => m.id === form.maquinaria_id)
  const costoTotal = asignada.reduce((s, a) => {
    const ch = a.costo_hora_override ?? a.maquinaria?.costo_hora ?? 0
    return s + (ch * a.horas_dia * a.cantidad)
  }, 0)

  // Agrupar catálogo por tipo
  const tipos = [...new Set(catalogo.map(m => m.tipo))].sort()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Maquinaria asignada ({asignada.length})
          {costoTotal > 0 && (
            <span style={{ fontWeight: 400, color: '#6B7280', textTransform: 'none', marginLeft: 6 }}>
              · {fmt$(costoTotal)}/día est.
            </span>
          )}
        </p>
        <Btn onClick={() => setShowForm(!showForm)} icon={Plus}
          label="Asignar" variant="secondary" small />
      </div>

      {showForm && (
        <div style={{ padding: 10, backgroundColor: '#FFF7ED',
          border: '1px solid #FED7AA', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ marginBottom: 7 }}>
            <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
              Equipo / Maquinaria *
            </label>
            <select style={sel} value={form.maquinaria_id}
              onChange={e => setForm(f => ({ ...f, maquinaria_id: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {tipos.map(tipo => (
                <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                  {catalogo.filter(m => m.tipo === tipo).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} · {fmt$(m.costo_hora)}/{m.unidad_cobro}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {maquinaSeleccionada && (
            <div style={{ padding: '6px 8px', backgroundColor: '#FEF3C7',
              borderRadius: 6, marginBottom: 8, fontSize: 11, color: '#B45309' }}>
              {maquinaSeleccionada.descripcion} · Costo base: {fmt$(maquinaSeleccionada.costo_hora)}/{maquinaSeleccionada.unidad_cobro}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 7 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Cantidad
              </label>
              <input type="number" min="1" style={inp} value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Horas/día
              </label>
              <input type="number" min="1" max="24" style={inp} value={form.horas_dia}
                onChange={e => setForm(f => ({ ...f, horas_dia: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Costo/hora override
              </label>
              <input type="number" min="0" style={inp} placeholder="Dejar vacío = catálogo"
                value={form.costo_hora_override}
                onChange={e => setForm(f => ({ ...f, costo_hora_override: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 7 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Fecha inicio
              </label>
              <input type="date" style={inp} value={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
                Fecha fin
              </label>
              <input type="date" style={inp} value={form.fecha_fin}
                onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
            </div>
          </div>

          {/* Estimado de costo diario */}
          {form.maquinaria_id && form.horas_dia && (
            <div style={{ padding: '6px 8px', backgroundColor: '#F0FDF4',
              borderRadius: 6, marginBottom: 8, fontSize: 11, color: '#065F46', fontWeight: 600 }}>
              Estimado: {fmt$(
                (parseFloat(form.costo_hora_override) || maquinaSeleccionada?.costo_hora || 0)
                * parseFloat(form.horas_dia) * parseInt(form.cantidad || 1)
              )}/día
            </div>
          )}

          <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setShowForm(false)} icon={X} label="Cancelar" variant="secondary" small />
            <Btn onClick={handleAsignar} icon={CheckCircle}
              label={saving ? 'Guardando…' : 'Asignar'}
              disabled={saving || !form.maquinaria_id} small />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: '#9CA3AF' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : asignada.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF' }}>
          <Truck size={22} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
          <p style={{ fontSize: 11 }}>Sin maquinaria asignada</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {asignada.map(a => {
            const ch = a.costo_hora_override ?? a.maquinaria?.costo_hora ?? 0
            const costoDia = ch * a.horas_dia * a.cantidad
            return (
              <div key={a.id} style={{ padding: '8px 10px', backgroundColor: '#FFF7ED',
                border: '1px solid #FED7AA', borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Truck size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>
                      {a.maquinaria?.nombre ?? '—'}
                      {a.cantidad > 1 && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700,
                          backgroundColor: '#FEF3C7', color: '#B45309',
                          padding: '1px 6px', borderRadius: 4 }}>×{a.cantidad}</span>
                      )}
                    </p>
                    <p style={{ fontSize: 10, color: '#6B7280', margin: '1px 0 0' }}>
                      {a.horas_dia}h/día · {fmt$(ch)}/h · {fmt$(costoDia)}/día
                      {a.costo_hora_override && ' (precio personalizado)'}
                    </p>
                    {(a.fecha_inicio || a.fecha_fin) && (
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: '1px 0 0' }}>
                        {a.fecha_inicio ?? '—'} → {a.fecha_fin ?? 'sin fecha fin'}
                      </p>
                    )}
                  </div>
                  <button onClick={() => retirarMaquinaria(a.id).then(() => { toast.success('Retirado'); cargar(); onRecalcular() }).catch(e => toast.error(e.message))}
                    style={{ padding: 5, border: 'none', background: 'none',
                      cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: HERRAMIENTAS
// ─────────────────────────────────────────────────────────────
const TabHerramientas = ({ nodo, projectId, toast }) => {
  const [asignadas, setAsignadas] = useState([])
  const [catalogo,  setCatalogo]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({
    herramienta_id: '', cantidad: 1,
    costo_dia_override: '', fecha_inicio: '', fecha_fin: '',
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [asig, cat] = await Promise.all([
        getHerramientasAsignadas(projectId, nodo.wbs_id),
        getHerramientasCatalogo(),
      ])
      setAsignadas(asig)
      setCatalogo(cat)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [projectId, nodo.wbs_id])

  useEffect(() => { cargar() }, [cargar])

  const handleAsignar = async () => {
    if (!form.herramienta_id) { toast.error('Selecciona la herramienta'); return }
    setSaving(true)
    try {
      await asignarHerramienta(projectId, nodo.wbs_id, form)
      toast.success('Herramienta asignada ✓')
      setShowForm(false)
      setForm({ herramienta_id: '', cantidad: 1, costo_dia_override: '', fecha_inicio: '', fecha_fin: '' })
      cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const tipos = [...new Set(catalogo.map(h => h.tipo))].sort()
  const herramientaSeleccionada = catalogo.find(h => h.id === form.herramienta_id)
  const costoTotal = asignadas.reduce((s, a) => {
    const cd = a.costo_dia_override ?? a.herramienta?.costo_dia ?? 0
    return s + (cd * a.cantidad)
  }, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Herramientas especiales ({asignadas.length})
          {costoTotal > 0 && (
            <span style={{ fontWeight: 400, color: '#6B7280', textTransform: 'none', marginLeft: 6 }}>
              · {fmt$(costoTotal)}/día est.
            </span>
          )}
        </p>
        <Btn onClick={() => setShowForm(!showForm)} icon={Plus}
          label="Asignar" variant="secondary" small />
      </div>

      {showForm && (
        <div style={{ padding: 10, backgroundColor: '#F5F3FF',
          border: '1px solid #DDD6FE', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ marginBottom: 7 }}>
            <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>
              Herramienta *
            </label>
            <select style={sel} value={form.herramienta_id}
              onChange={e => setForm(f => ({ ...f, herramienta_id: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {tipos.map(tipo => (
                <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                  {catalogo.filter(h => h.tipo === tipo).map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nombre} · {fmt$(h.costo_dia)}/día
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {herramientaSeleccionada && (
            <div style={{ padding: '6px 8px', backgroundColor: '#EDE9FE',
              borderRadius: 6, marginBottom: 8, fontSize: 11, color: '#7C3AED' }}>
              {herramientaSeleccionada.descripcion}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 7 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>Cantidad</label>
              <input type="number" min="1" style={inp} value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>Costo/día override</label>
              <input type="number" min="0" style={inp} placeholder="Vacío = catálogo"
                value={form.costo_dia_override}
                onChange={e => setForm(f => ({ ...f, costo_dia_override: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>Fecha inicio</label>
              <input type="date" style={inp} value={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setShowForm(false)} icon={X} label="Cancelar" variant="secondary" small />
            <Btn onClick={handleAsignar} icon={CheckCircle}
              label={saving ? 'Guardando…' : 'Asignar'}
              disabled={saving || !form.herramienta_id} small />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: '#9CA3AF' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : asignadas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF' }}>
          <Wrench size={22} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
          <p style={{ fontSize: 11 }}>Sin herramientas asignadas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {asignadas.map(a => {
            const cd = a.costo_dia_override ?? a.herramienta?.costo_dia ?? 0
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', backgroundColor: '#F5F3FF',
                border: '1px solid #DDD6FE', borderRadius: 7 }}>
                <Wrench size={13} color="#7C3AED" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>
                    {a.herramienta?.nombre ?? '—'}
                    {a.cantidad > 1 && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700,
                        backgroundColor: '#EDE9FE', color: '#7C3AED',
                        padding: '1px 6px', borderRadius: 4 }}>×{a.cantidad}</span>
                    )}
                  </p>
                  <p style={{ fontSize: 10, color: '#6B7280', margin: '1px 0 0' }}>
                    {fmt$(cd)}/día · {fmt$(cd * a.cantidad)}/día total
                  </p>
                </div>
                <button onClick={() => retirarHerramienta(a.id).then(() => { toast.success('Retirada'); cargar() }).catch(e => toast.error(e.message))}
                  style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MODAL PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ModalRecursos({ nodo, projectId, tareas, onClose, onRecalcular, toast }) {
  const [tabActiva, setTabActiva] = useState('dependencias')

  if (!nodo) return null

  const TABS = [
    { id: 'dependencias', label: 'Dependencias', icon: Link2,  color: '#2563EB' },
    { id: 'personal',     label: 'Personal',     icon: Users,  color: '#059669' },
    { id: 'maquinaria',   label: 'Maquinaria',   icon: Truck,  color: '#D97706' },
    { id: 'herramientas', label: 'Herramientas', icon: Wrench, color: '#7C3AED' },
  ]

  // Alerta si calculado con 1 elemento
  const calculadoConUno = (nodo.personas_plan ?? 1) === 1 && (nodo.personas_real ?? 0) <= 1

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {nodo.disciplina_color && (
                  <span style={{ width: 10, height: 10, borderRadius: 3,
                    backgroundColor: nodo.disciplina_color, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
                  {nodo.disciplina_codigo ?? '—'}
                </span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827',
                margin: 0, lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nodo.nombre}
              </h3>
              <p style={{ fontSize: 11, color: '#6B7280', margin: '3px 0 0' }}>
                {nodo.duracion_plan ?? 0} días hábiles
                {nodo.fecha_inicio_plan && ` · ${nodo.fecha_inicio_plan}`}
                {nodo.fecha_fin_plan    && ` → ${nodo.fecha_fin_plan}`}
              </p>
            </div>
            <button onClick={onClose}
              style={{ padding: 6, border: 'none', background: 'none',
                cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* ALERTA: Calculado con 1 elemento */}
          {calculadoConUno && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
              padding: '7px 10px', backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A', borderRadius: 8,
            }}>
              <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: '#B45309', margin: 0 }}>
                <strong>Programa calculado con 1 elemento.</strong> Agrega personal o maquinaria
                para recalcular los tiempos reales de ejecución.
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const activa = tabActiva === tab.id
            return (
              <button key={tab.id} onClick={() => setTabActiva(tab.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 5,
                  padding: '10px 8px', border: 'none',
                  borderBottom: `2px solid ${activa ? tab.color : 'transparent'}`,
                  backgroundColor: activa ? `${tab.color}08` : 'transparent',
                  color: activa ? tab.color : '#6B7280',
                  fontSize: 11, fontWeight: activa ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <Icon size={13} />{tab.label}
              </button>
            )
          })}
        </div>

        {/* Contenido de la tab activa */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          {tabActiva === 'dependencias' && (
            <TabDependencias
              nodo={nodo} projectId={projectId} tareas={tareas}
              toast={toast} onRecalcular={onRecalcular}
            />
          )}
          {tabActiva === 'personal' && (
            <TabPersonal
              nodo={nodo} projectId={projectId}
              toast={toast} onRecalcular={onRecalcular}
            />
          )}
          {tabActiva === 'maquinaria' && (
            <TabMaquinaria
              nodo={nodo} projectId={projectId}
              toast={toast} onRecalcular={onRecalcular}
            />
          )}
          {tabActiva === 'herramientas' && (
            <TabHerramientas
              nodo={nodo} projectId={projectId}
              toast={toast}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #F3F4F6',
          flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
            Los cambios se aplican al recalcular el programa
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={onRecalcular} icon={RefreshCw}
              label="Recalcular programa" variant="secondary" small />
            <Btn onClick={onClose} icon={CheckCircle}
              label="Cerrar" variant="primary" small />
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}