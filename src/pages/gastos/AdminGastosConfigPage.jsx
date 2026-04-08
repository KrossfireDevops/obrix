// ============================================================
//  OBRIX ERP — Configuración del Módulo de Gastos
//  src/pages/gastos/AdminGastosConfigPage.jsx  |  v1.0
//
//  Tabs:
//    1. Perfiles de gasto     — crear/editar perfiles operativos
//    2. Tipos de gasto        — catálogo maestro
//    3. Límites por perfil    — matriz perfil × tipo × montos
//    4. Fondos y tarjetas     — cajas chicas y tarjetas corp.
//    5. Asignar perfiles      — asignar perfil a cada usuario
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import {
  Settings, Users, Plus, Edit2, CheckCircle,
  RefreshCw, X, Shield, CreditCard, Wallet,
  DollarSign, AlertTriangle, PiggyBank,
} from 'lucide-react'
import {
  getPerfilesGasto, crearPerfil, actualizarPerfil,
  getTiposGasto, crearTipoGasto,
  upsertLimitePerfil, asignarPerfilAUsuario,
  getCajasChicasAdmin, crearCajaChica, reponerCajaChica,
  getTarjetasAdmin,
  CATEGORIA_CFG, fmtMXN,
} from '../../services/gastos.service'
import { supabase } from '../../config/supabase'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '8px 10px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}
const sel = { ...inp }

const Toggle = ({ checked, onChange, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8,
    cursor: 'pointer', fontSize: 12, color: '#374151' }}>
    <div style={{ position: 'relative', width: 36, height: 20,
      backgroundColor: checked ? '#2563EB' : '#D1D5DB', borderRadius: 10,
      transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2,
        left: checked ? 18 : 2, width: 16, height: 16,
        backgroundColor: '#fff', borderRadius: '50%',
        transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }} />
    </div>
    {label}
  </label>
)

// ─────────────────────────────────────────────────────────────
// TAB 1: PERFILES
// ─────────────────────────────────────────────────────────────
const TabPerfiles = ({ toast }) => {
  const [perfiles,  setPerfiles]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [form, setForm] = useState({
    codigo: '', nombre: '', descripcion: '',
    puede_aprobar: false, nivel_aprobacion: '',
    puede_ver_consolidado: false, puede_configurar: false,
    limite_semanal_global: '',
  })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setPerfiles(await getPerfilesGasto()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirForm = (p = null) => {
    setEditando(p)
    setForm(p ? {
      codigo:                p.codigo,
      nombre:                p.nombre,
      descripcion:           p.descripcion ?? '',
      puede_aprobar:         p.puede_aprobar,
      nivel_aprobacion:      p.nivel_aprobacion ?? '',
      puede_ver_consolidado: p.puede_ver_consolidado,
      puede_configurar:      p.puede_configurar,
      limite_semanal_global: p.limite_semanal_global ?? '',
    } : {
      codigo: '', nombre: '', descripcion: '',
      puede_aprobar: false, nivel_aprobacion: '',
      puede_ver_consolidado: false, puede_configurar: false,
      limite_semanal_global: '',
    })
    setShowForm(true)
  }

  const guardar = async () => {
    if (!form.codigo || !form.nombre) { toast.error('Código y nombre son obligatorios'); return }
    setSaving(true)
    try {
      const datos = {
        ...form,
        nivel_aprobacion:      form.nivel_aprobacion ? parseInt(form.nivel_aprobacion) : null,
        limite_semanal_global: form.limite_semanal_global ? parseFloat(form.limite_semanal_global) : null,
      }
      if (editando) await actualizarPerfil(editando.id, datos)
      else          await crearPerfil(datos)
      toast.success(editando ? 'Perfil actualizado ✓' : 'Perfil creado ✓')
      setShowForm(false); cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
          Define los roles operativos del módulo de gastos y sus capacidades.
        </p>
        <button onClick={() => abrirForm()}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            borderRadius: 8, border: 'none', backgroundColor: '#2563EB',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Nuevo perfil
        </button>
      </div>

      {showForm && (
        <div style={{ padding: 16, backgroundColor: '#F8FAFF', border: '1px solid #BFDBFE',
          borderRadius: 12, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Código *</label>
              <input type="text" style={{ ...inp, fontFamily: 'monospace', textTransform: 'lowercase' }}
                placeholder="residente_obra" value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.replace(/\s/g,'_').toLowerCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Nombre *</label>
              <input type="text" style={inp} placeholder="Residente de Obra" value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Toggle label="Puede aprobar gastos"
              checked={form.puede_aprobar}
              onChange={v => setForm(f => ({ ...f, puede_aprobar: v, nivel_aprobacion: v ? (f.nivel_aprobacion || 1) : '' }))} />
            <Toggle label="Ver consolidado"
              checked={form.puede_ver_consolidado}
              onChange={v => setForm(f => ({ ...f, puede_ver_consolidado: v }))} />
            <Toggle label="Puede configurar"
              checked={form.puede_configurar}
              onChange={v => setForm(f => ({ ...f, puede_configurar: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {form.puede_aprobar && (
              <div>
                <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                  fontWeight: 600, textTransform: 'uppercase' }}>Nivel de aprobación</label>
                <select style={sel} value={form.nivel_aprobacion}
                  onChange={e => setForm(f => ({ ...f, nivel_aprobacion: e.target.value }))}>
                  <option value="1">Nivel 1 — Jefe inmediato (&lt;$2,000)</option>
                  <option value="2">Nivel 2 — Admin/Contador ($2,000–$9,999)</option>
                  <option value="3">Nivel 3 — Director ($10,000+)</option>
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Límite semanal global ($)</label>
              <input type="number" min="0" style={inp} placeholder="Sin límite"
                value={form.limite_semanal_global}
                onChange={e => setForm(f => ({ ...f, limite_semanal_global: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
                backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 18px',
                borderRadius: 8, border: 'none', backgroundColor: '#2563EB',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              <CheckCircle size={12} /> Guardar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {perfiles.map(p => (
            <div key={p.id} style={{ padding: '12px 14px', backgroundColor: '#fff',
              border: '1px solid #E5E7EB', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{p.nombre}</span>
                  <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'monospace',
                    color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>
                    {p.codigo}
                  </span>
                </div>
                <button onClick={() => abrirForm(p)}
                  style={{ padding: 5, border: 'none', background: 'none',
                    cursor: 'pointer', color: '#9CA3AF' }}>
                  <Edit2 size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {p.puede_aprobar && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    backgroundColor: '#F0FDF4', color: '#065F46', border: '1px solid #A7F3D0' }}>
                    Aprueba N{p.nivel_aprobacion}
                  </span>
                )}
                {p.puede_ver_consolidado && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                    Ve consolidado
                  </span>
                )}
                {p.limite_semanal_global && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    backgroundColor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
                    Máx {fmtMXN(p.limite_semanal_global)}/sem
                  </span>
                )}
                <span style={{ fontSize: 10, color: '#9CA3AF', padding: '2px 0' }}>
                  {p.gastos_perfiles_tipos?.length ?? 0} tipos configurados
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB 2: TIPOS DE GASTO
// ─────────────────────────────────────────────────────────────
const TabTipos = ({ toast }) => {
  const [tipos,    setTipos]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    categoria: 'gastos_generales', codigo: '', nombre: '', icono: '📄',
    requiere_factura_desde: 1000, requiere_proyecto: false,
    es_deducible_por_defecto: true,
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setTipos(await getTiposGasto(false)) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.codigo || !form.nombre) { toast.error('Código y nombre obligatorios'); return }
    setSaving(true)
    try {
      await crearTipoGasto(form)
      toast.success('Tipo de gasto creado ✓')
      setShowForm(false); cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const porCategoria = tipos.reduce((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = []
    acc[t.categoria].push(t)
    return acc
  }, {})

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
          Catálogo maestro de conceptos de gasto con su cuenta contable predeterminada.
        </p>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
            borderRadius: 8, border: 'none', backgroundColor: '#2563EB',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Nuevo tipo
        </button>
      </div>

      {showForm && (
        <div style={{ padding: 16, backgroundColor: '#F8FAFF', border: '1px solid #BFDBFE',
          borderRadius: 12, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Categoría</label>
              <select style={sel} value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {Object.entries(CATEGORIA_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Código *</label>
              <input type="text" style={{ ...inp, fontFamily: 'monospace' }}
                placeholder="gasolina" value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.replace(/\s/g,'_').toLowerCase() }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Nombre *</label>
              <input type="text" style={inp} placeholder="Gasolina / Combustible"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Emoji/ícono</label>
              <input type="text" style={{ ...inp, fontFamily: 'monospace', fontSize: 16, textAlign: 'center' }}
                value={form.icono} maxLength={2}
                onChange={e => setForm(f => ({ ...f, icono: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Factura obligatoria desde $</label>
              <input type="number" min="0" style={inp}
                value={form.requiere_factura_desde}
                onChange={e => setForm(f => ({ ...f, requiere_factura_desde: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 18 }}>
              <Toggle label="Requiere proyecto"
                checked={form.requiere_proyecto}
                onChange={v => setForm(f => ({ ...f, requiere_proyecto: v }))} />
              <Toggle label="Deducible por defecto"
                checked={form.es_deducible_por_defecto}
                onChange={v => setForm(f => ({ ...f, es_deducible_por_defecto: v }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
                backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 18px',
                borderRadius: 8, border: 'none', backgroundColor: '#2563EB',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              Guardar tipo
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        Object.entries(porCategoria).map(([cat, items]) => {
          const cfg = CATEGORIA_CFG[cat] ?? CATEGORIA_CFG.gastos_generales
          return (
            <div key={cat} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 8px',
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{cfg.emoji}</span> {cfg.label}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {items.map(t => (
                  <div key={t.id} style={{ padding: '10px 12px', backgroundColor: '#fff',
                    border: '1px solid #E5E7EB', borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                    opacity: t.is_active ? 1 : 0.5 }}>
                    <span style={{ fontSize: 20 }}>{t.icono}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>
                        {t.nombre}
                      </p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>
                        {t.codigo} · factura ≥${t.requiere_factura_desde}
                        {t.requiere_proyecto ? ' · req. proyecto' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB 3: MATRIZ DE LÍMITES
// ─────────────────────────────────────────────────────────────
const TabLimites = ({ toast }) => {
  const [perfiles, setPerfiles] = useState([])
  const [tipos,    setTipos]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editCell, setEditCell] = useState(null)  // { perfilId, tipoId }
  const [formCell, setFormCell] = useState({})
  const [saving,   setSaving]   = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [p, t] = await Promise.all([getPerfilesGasto(), getTiposGasto()])
      setPerfiles(p); setTipos(t)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const getLimite = (perfilId, tipoId) => {
    const perfil = perfiles.find(p => p.id === perfilId)
    return perfil?.gastos_perfiles_tipos?.find(pt => pt.tipo_id === tipoId) ?? null
  }

  const abrirEditor = (perfilId, tipoId) => {
    const lim = getLimite(perfilId, tipoId)
    setFormCell({
      monto_min:                  lim?.monto_min               ?? 1,
      monto_max_por_gasto:        lim?.monto_max_por_gasto     ?? '',
      monto_max_diario:           lim?.monto_max_diario        ?? '',
      monto_max_semanal:          lim?.monto_max_semanal       ?? '',
      aprobacion_automatica_hasta: lim?.aprobacion_automatica_hasta ?? 0,
    })
    setEditCell({ perfilId, tipoId })
  }

  const guardarLimite = async () => {
    if (!editCell) return
    setSaving(true)
    try {
      await upsertLimitePerfil(editCell.perfilId, editCell.tipoId, {
        monto_min:                  parseFloat(formCell.monto_min) || 1,
        monto_max_por_gasto:        formCell.monto_max_por_gasto ? parseFloat(formCell.monto_max_por_gasto) : null,
        monto_max_diario:           formCell.monto_max_diario     ? parseFloat(formCell.monto_max_diario)    : null,
        monto_max_semanal:          formCell.monto_max_semanal    ? parseFloat(formCell.monto_max_semanal)   : null,
        aprobacion_automatica_hasta: parseFloat(formCell.aprobacion_automatica_hasta) || 0,
        is_active: true,
      })
      toast.success('Límite guardado ✓')
      setEditCell(null); cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
        Haz clic en cualquier celda para configurar los límites de ese perfil para ese tipo de gasto.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10,
                fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
                letterSpacing: '0.06em', minWidth: 140, position: 'sticky', left: 0,
                backgroundColor: '#F9FAFB' }}>
                Tipo de gasto
              </th>
              {perfiles.map(p => (
                <th key={p.id} style={{ padding: '8px 12px', textAlign: 'center',
                  fontSize: 10, fontWeight: 700, color: '#1E40AF',
                  minWidth: 110, maxWidth: 140 }}>
                  {p.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tipos.map((t, ti) => (
              <tr key={t.id}
                style={{ borderBottom: '1px solid #F3F4F6',
                  backgroundColor: ti % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <td style={{ padding: '8px 12px', position: 'sticky', left: 0,
                  backgroundColor: ti % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{t.icono}</span>
                    <span style={{ fontWeight: 500, color: '#374151' }}>{t.nombre}</span>
                  </div>
                </td>
                {perfiles.map(p => {
                  const lim = getLimite(p.id, t.id)
                  const activo = editCell?.perfilId === p.id && editCell?.tipoId === t.id
                  return (
                    <td key={p.id} style={{ padding: '4px 8px', textAlign: 'center',
                      verticalAlign: 'top' }}>
                      {activo ? (
                        <div style={{ padding: 8, backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE', borderRadius: 8, minWidth: 110 }}>
                          {[
                            { key: 'monto_max_por_gasto', label: 'Máx/gasto $' },
                            { key: 'monto_max_semanal',   label: 'Máx/semana $' },
                            { key: 'aprobacion_automatica_hasta', label: 'Auto hasta $' },
                          ].map(f => (
                            <div key={f.key} style={{ marginBottom: 5 }}>
                              <label style={{ fontSize: 9, color: '#6B7280', display: 'block',
                                marginBottom: 1, fontWeight: 600 }}>{f.label}</label>
                              <input type="number" min="0"
                                style={{ ...inp, padding: '4px 6px', fontSize: 11 }}
                                value={formCell[f.key] ?? ''}
                                onChange={e => setFormCell(fc => ({ ...fc, [f.key]: e.target.value }))} />
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 6 }}>
                            <button onClick={() => setEditCell(null)}
                              style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #E5E7EB',
                                backgroundColor: '#fff', fontSize: 10, cursor: 'pointer' }}>✕</button>
                            <button onClick={guardarLimite} disabled={saving}
                              style={{ padding: '3px 10px', borderRadius: 5, border: 'none',
                                backgroundColor: '#2563EB', color: '#fff',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                              {saving ? '…' : '✓'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => abrirEditor(p.id, t.id)}
                          style={{ padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                            border: lim ? '1px solid #A7F3D0' : '1px dashed #E5E7EB',
                            backgroundColor: lim ? '#F0FDF4' : 'transparent',
                            fontSize: 10, color: lim ? '#065F46' : '#9CA3AF',
                            width: '100%', textAlign: 'center' }}>
                          {lim
                            ? <>
                                {lim.monto_max_por_gasto ? `${fmtMXN(lim.monto_max_por_gasto)}` : 'Sin límite'}
                                {lim.monto_max_semanal ? <><br /><span style={{ fontSize: 9, opacity: 0.7 }}>{fmtMXN(lim.monto_max_semanal)}/sem</span></> : ''}
                              </>
                            : '+ Configurar'
                          }
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB 4: ASIGNAR PERFILES A USUARIOS
// ─────────────────────────────────────────────────────────────
const TabAsignar = ({ toast }) => {
  const [usuarios,   setUsuarios]  = useState([])
  const [perfiles,   setPerfiles]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [guardando,  setGuardando] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('users_profiles').select('id, full_name, email, perfil_gasto_id').order('full_name'),
      getPerfilesGasto(),
    ]).then(([{ data: u }, p]) => {
      setUsuarios(u ?? []); setPerfiles(p)
      setLoading(false)
    })
  }, [])

  const handleAsignar = async (userId, perfilId) => {
    setGuardando(userId)
    try {
      await asignarPerfilAUsuario(userId, perfilId || null)
      setUsuarios(prev => prev.map(u =>
        u.id === userId ? { ...u, perfil_gasto_id: perfilId || null } : u
      ))
      toast.success('Perfil asignado ✓')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGuardando(null)
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
        Asigna un perfil de gasto a cada usuario de la empresa.
      </p>
      <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {usuarios.map((u, i) => {
          const perfilActual = perfiles.find(p => p.id === u.perfil_gasto_id)
          return (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px',
              borderBottom: i < usuarios.length-1 ? '1px solid #F3F4F6' : 'none',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#EFF6FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#1E40AF', flexShrink: 0 }}>
                {(u.full_name ?? '?')[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                  {u.full_name}
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{u.email}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {guardando === u.id && (
                  <RefreshCw size={13} color="#9CA3AF" style={{ animation: 'spin 1s linear infinite' }} />
                )}
                <select
                  value={u.perfil_gasto_id ?? ''}
                  onChange={e => handleAsignar(u.id, e.target.value)}
                  style={{ ...sel, width: 220, fontSize: 12 }}>
                  <option value="">— Sin perfil de gasto —</option>
                  {perfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// TAB 5: FONDOS — Cajas Chicas y Tarjetas Corporativas
// ─────────────────────────────────────────────────────────────
const TabFondos = ({ toast }) => {
  const [cajas,       setCajas]       = useState([])
  const [tarjetas,    setTarjetas]    = useState([])
  const [usuarios,    setUsuarios]    = useState([])
  const [proyectos,   setProyectos]   = useState([])
  const [cuentas,     setCuentas]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [seccion,     setSeccion]     = useState('cajas')  // 'cajas' | 'tarjetas'
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [modalRepos,  setModalRepos]  = useState(null)  // caja a reponer
  const [reposRef,    setReposRef]    = useState('')
  const [reposMonto,  setReposMonto]  = useState('')

  // Formularios
  const [formCaja, setFormCaja] = useState({
    usuario_id: '', project_id: '', nombre: '',
    monto_fondo: '', monto_minimo_reposicion: '', cuenta_contable_id: '',
  })
  const [formTarjeta, setFormTarjeta] = useState({
    usuario_id: '', project_id: '', alias: '', ultimos_4: '',
    banco: '', red: 'visa', limite_mensual: '',
    dia_corte: '', dia_pago: '', cuenta_contable_id: '',
  })

  const setC = (k, v) => setFormCaja(f => ({ ...f, [k]: v }))
  const setT = (k, v) => setFormTarjeta(f => ({ ...f, [k]: v }))

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [c, t] = await Promise.all([
        getCajasChicasAdmin(),
        getTarjetasAdmin(),
      ])
      setCajas(c); setTarjetas(t)

      // Usuarios y proyectos para los selectores
      const [{ data: us }, { data: pr }, { data: cu }] = await Promise.all([
        supabase.from('users_profiles').select('id, full_name').order('full_name'),
        supabase.from('projects').select('id, code, name').eq('status', 'active').order('code'),
        supabase.from('cuentas_contables').select('id, codigo, nombre').eq('is_active', true).order('codigo'),
      ])
      setUsuarios(us ?? []); setProyectos(pr ?? []); setCuentas(cu ?? [])
    } catch (e) {
      toast.error('Error al cargar fondos: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handleCrearCaja = async () => {
    if (!formCaja.usuario_id) { toast.error('Selecciona el empleado'); return }
    if (!formCaja.nombre)     { toast.error('El nombre es obligatorio'); return }
    if (!formCaja.monto_fondo || parseFloat(formCaja.monto_fondo) < 100) {
      toast.error('El monto del fondo debe ser mayor a $100'); return
    }
    setSaving(true)
    try {
      await crearCajaChica(formCaja)
      toast.success('Caja chica creada ✓')
      setShowForm(false)
      setFormCaja({ usuario_id: '', project_id: '', nombre: '', monto_fondo: '', monto_minimo_reposicion: '', cuenta_contable_id: '' })
      cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleCrearTarjeta = async () => {
    if (!formTarjeta.alias)     { toast.error('El alias es obligatorio'); return }
    if (!formTarjeta.ultimos_4 || formTarjeta.ultimos_4.length !== 4) {
      toast.error('Ingresa los últimos 4 dígitos'); return
    }
    setSaving(true)
    try {
      const { companyId } = await (async () => {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        return { companyId: data.company_id }
      })()
      await supabase.from('tarjetas_corporativas').insert({
        ...formTarjeta,
        company_id:     companyId,
        limite_mensual: formTarjeta.limite_mensual  ? parseFloat(formTarjeta.limite_mensual)  : null,
        dia_corte:      formTarjeta.dia_corte       ? parseInt(formTarjeta.dia_corte)          : null,
        dia_pago:       formTarjeta.dia_pago        ? parseInt(formTarjeta.dia_pago)           : null,
        usuario_id:     formTarjeta.usuario_id      || null,
        project_id:     formTarjeta.project_id      || null,
        cuenta_contable_id: formTarjeta.cuenta_contable_id || null,
      })
      toast.success('Tarjeta registrada ✓')
      setShowForm(false)
      setFormTarjeta({ usuario_id: '', project_id: '', alias: '', ultimos_4: '', banco: '', red: 'visa', limite_mensual: '', dia_corte: '', dia_pago: '', cuenta_contable_id: '' })
      cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleReponer = async () => {
    if (!reposMonto || parseFloat(reposMonto) <= 0) { toast.error('Ingresa el monto de reposición'); return }
    setSaving(true)
    try {
      await reponerCajaChica(modalRepos.id, parseFloat(reposMonto), reposRef || null)
      toast.success('Reposición registrada ✓')
      setModalRepos(null); setReposRef(''); setReposMonto('')
      cargar()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const pctSaldo = (caja) => {
    const pct = (caja.monto_disponible / caja.monto_fondo) * 100
    return Math.max(0, Math.min(100, pct))
  }

  const colorSaldo = (caja) => {
    const p = pctSaldo(caja)
    if (p > 50) return { bar: '#10B981', text: '#065F46', bg: '#F0FDF4' }
    if (p > 20) return { bar: '#F59E0B', text: '#B45309', bg: '#FFFBEB' }
    return       { bar: '#EF4444', text: '#991B1B', bg: '#FEF2F2' }
  }

  const inp2 = {
    width: '100%', padding: '7px 9px', fontSize: 12,
    border: '1px solid #E5E7EB', borderRadius: 7,
    outline: 'none', backgroundColor: '#fff',
    color: '#111827', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Sub-tabs: Cajas / Tarjetas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'cajas',    label: '💵 Cajas chicas',        count: cajas.length    },
          { id: 'tarjetas', label: '💳 Tarjetas corporativas', count: tarjetas.length },
        ].map(s => (
          <button key={s.id} onClick={() => { setSeccion(s.id); setShowForm(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              backgroundColor: seccion === s.id ? '#2563EB' : '#F3F4F6',
              color: seccion === s.id ? '#fff' : '#374151' }}>
            {s.label}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px',
              borderRadius: 9999,
              backgroundColor: seccion === s.id ? 'rgba(255,255,255,0.25)' : '#E5E7EB',
              color: seccion === s.id ? '#fff' : '#6B7280' }}>
              {s.count}
            </span>
          </button>
        ))}
        <button onClick={() => setShowForm(!showForm)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 9, border: 'none',
            backgroundColor: '#10B981', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} />
          {seccion === 'cajas' ? 'Nueva caja chica' : 'Nueva tarjeta'}
        </button>
      </div>

      {/* ── FORMULARIO NUEVA CAJA CHICA ── */}
      {showForm && seccion === 'cajas' && (
        <div style={{ padding: 16, backgroundColor: '#F0FDF4', border: '1px solid #A7F3D0',
          borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 12px' }}>
            Nueva caja chica
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Empleado *</label>
              <select style={inp2} value={formCaja.usuario_id} onChange={e => setC('usuario_id', e.target.value)}>
                <option value="">— Seleccionar empleado —</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Nombre del fondo *</label>
              <input type="text" style={inp2} value={formCaja.nombre}
                placeholder="Ej: Caja chica Ricardo - Obra CDMX-01"
                onChange={e => setC('nombre', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Monto del fondo ($) *</label>
              <input type="number" min="100" max="10000" step="100" style={inp2}
                value={formCaja.monto_fondo} placeholder="3000"
                onChange={e => setC('monto_fondo', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Reponer cuando queden ($)</label>
              <input type="number" min="0" style={inp2}
                value={formCaja.monto_minimo_reposicion} placeholder="Ej: 800"
                onChange={e => setC('monto_minimo_reposicion', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Proyecto (opcional)</label>
              <select style={inp2} value={formCaja.project_id} onChange={e => setC('project_id', e.target.value)}>
                <option value="">— Sin proyecto específico —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Cuenta contable (113.01)</label>
              <select style={inp2} value={formCaja.cuenta_contable_id} onChange={e => setC('cuenta_contable_id', e.target.value)}>
                <option value="">— Seleccionar cuenta —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: '#fff', border: '1px solid #A7F3D0',
            borderRadius: 8, marginBottom: 10, fontSize: 11, color: '#065F46' }}>
            Al crear la caja chica, se generará el asiento:
            <span style={{ fontFamily: 'monospace', marginLeft: 6 }}>
              DEBE 113.01 Caja Chica → HABER 102.01 Banco
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
                backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleCrearCaja} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 18px',
                borderRadius: 8, border: 'none', backgroundColor: '#10B981',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              <CheckCircle size={12} /> Crear caja chica
            </button>
          </div>
        </div>
      )}

      {/* ── FORMULARIO NUEVA TARJETA ── */}
      {showForm && seccion === 'tarjetas' && (
        <div style={{ padding: 16, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', margin: '0 0 12px' }}>
            Nueva tarjeta corporativa
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Alias de la tarjeta *</label>
              <input type="text" style={inp2} value={formTarjeta.alias}
                placeholder="Ej: AMEX Ricardo - Obra CDMX-01"
                onChange={e => setT('alias', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Últimos 4 dígitos *</label>
              <input type="text" maxLength={4} style={{ ...inp2, fontFamily: 'monospace', letterSpacing: '0.15em', textAlign: 'center' }}
                value={formTarjeta.ultimos_4} placeholder="4521"
                onChange={e => setT('ultimos_4', e.target.value.replace(/\D/g,''))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Banco</label>
              <input type="text" style={inp2} value={formTarjeta.banco}
                placeholder="BBVA, Santander, Banamex..."
                onChange={e => setT('banco', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Red</label>
              <select style={inp2} value={formTarjeta.red} onChange={e => setT('red', e.target.value)}>
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="amex">American Express</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Límite mensual ($)</label>
              <input type="number" min="0" style={inp2} value={formTarjeta.limite_mensual}
                placeholder="Sin límite"
                onChange={e => setT('limite_mensual', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Día de corte</label>
              <input type="number" min="1" max="31" style={inp2} value={formTarjeta.dia_corte}
                placeholder="15" onChange={e => setT('dia_corte', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Día de pago</label>
              <input type="number" min="1" max="31" style={inp2} value={formTarjeta.dia_pago}
                placeholder="25" onChange={e => setT('dia_pago', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Asignar a empleado</label>
              <select style={inp2} value={formTarjeta.usuario_id} onChange={e => setT('usuario_id', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Proyecto</label>
              <select style={inp2} value={formTarjeta.project_id} onChange={e => setT('project_id', e.target.value)}>
                <option value="">— Sin proyecto —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Cuenta contable (205.0X)</label>
              <select style={inp2} value={formTarjeta.cuenta_contable_id} onChange={e => setT('cuenta_contable_id', e.target.value)}>
                <option value="">— Seleccionar cuenta —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
                backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleCrearTarjeta} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 18px',
                borderRadius: 8, border: 'none', backgroundColor: '#2563EB',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              <CheckCircle size={12} /> Registrar tarjeta
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (

        /* ── LISTA CAJAS CHICAS ── */
        seccion === 'cajas' ? (
          cajas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: '#9CA3AF' }}>
              <PiggyBank size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                Sin cajas chicas registradas
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>
                Crea una caja chica para asignar fondos a un empleado
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {cajas.map(c => {
                const col  = colorSaldo(c)
                const pct  = pctSaldo(c)
                return (
                  <div key={c.id} style={{ padding: '14px 16px', backgroundColor: '#fff',
                    border: '1px solid #E5E7EB', borderRadius: 12 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
                          {c.nombre}
                        </p>
                        <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                          {c.usuario?.full_name}
                          {c.proyecto && (
                            <span style={{ marginLeft: 6, fontFamily: 'monospace',
                              color: '#6366F1', fontWeight: 600 }}>
                              [{c.proyecto.code}]
                            </span>
                          )}
                        </p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 9999,
                        backgroundColor: c.estatus === 'activa' ? '#D1FAE5' : '#F3F4F6',
                        color: c.estatus === 'activa' ? '#065F46' : '#6B7280' }}>
                        {c.estatus}
                      </span>
                    </div>

                    {/* Barra de saldo */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 10, color: '#6B7280', marginBottom: 4 }}>
                        <span>Saldo disponible</span>
                        <span style={{ fontWeight: 700, color: col.text }}>
                          {pct.toFixed(0)}% del fondo
                        </span>
                      </div>
                      <div style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 9999,
                        overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`,
                          backgroundColor: col.bar, borderRadius: 9999,
                          transition: 'width 0.4s' }} />
                      </div>
                    </div>

                    {/* Montos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: 'Disponible', value: c.monto_disponible, color: col.text, bg: col.bg },
                        { label: 'Fondo total', value: c.monto_fondo, color: '#374151', bg: '#F9FAFB' },
                      ].map(m => (
                        <div key={m.label} style={{ padding: '6px 8px', backgroundColor: m.bg,
                          borderRadius: 7, textAlign: 'center' }}>
                          <p style={{ fontSize: 9, color: m.color, fontWeight: 600, margin: '0 0 2px',
                            textTransform: 'uppercase', opacity: 0.7 }}>{m.label}</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: m.color, margin: 0 }}>
                            ${parseFloat(m.value).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Alerta de reposición */}
                    {c.monto_minimo_reposicion && parseFloat(c.monto_disponible) <= parseFloat(c.monto_minimo_reposicion) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px', backgroundColor: '#FEF9C3',
                        border: '1px solid #FDE68A', borderRadius: 7,
                        fontSize: 10, color: '#B45309', marginBottom: 8, fontWeight: 600 }}>
                        <AlertTriangle size={11} /> Solicitar reposición
                      </div>
                    )}

                    {/* Botón reponer */}
                    {c.estatus === 'activa' && (
                      <button onClick={() => { setModalRepos(c); setReposMonto(
                        String(parseFloat(c.monto_fondo) - parseFloat(c.monto_disponible))
                      )}}
                        style={{ width: '100%', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 8,
                          border: '1px solid #A7F3D0', backgroundColor: '#F0FDF4',
                          color: '#065F46', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <RefreshCw size={11} /> Registrar reposición
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : (

          /* ── LISTA TARJETAS ── */
          tarjetas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: '#9CA3AF' }}>
              <CreditCard size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                Sin tarjetas corporativas registradas
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>
                Registra las tarjetas de la empresa para que los empleados puedan usarlas
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {tarjetas.map(t => (
                <div key={t.id} style={{ padding: '14px 16px', backgroundColor: '#fff',
                  border: '1px solid #E5E7EB', borderRadius: 12 }}>
                  {/* Header con red de la tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 26, borderRadius: 4,
                        backgroundColor: t.red === 'amex' ? '#007BC1' : t.red === 'visa' ? '#1A1F71' : '#EB001B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>
                        {t.red?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>
                          {t.alias}
                        </p>
                        <p style={{ fontSize: 11, fontFamily: 'monospace',
                          color: '#9CA3AF', margin: 0, letterSpacing: '0.15em' }}>
                          •••• {t.ultimos_4}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 9999,
                      backgroundColor: t.is_active ? '#D1FAE5' : '#F3F4F6',
                      color: t.is_active ? '#065F46' : '#6B7280' }}>
                      {t.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {/* Detalles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {[
                      { label: 'Banco',      value: t.banco ?? '—'                },
                      { label: 'Asignada a', value: t.usuario?.full_name ?? 'Sin asignar' },
                      { label: 'Proyecto',   value: t.proyecto ? `[${t.proyecto.code}]` : '—' },
                      { label: 'Cuenta',     value: t.cuenta?.codigo ?? '—', mono: true },
                    ].map(d => (
                      <div key={d.label} style={{ padding: '5px 7px', backgroundColor: '#F9FAFB',
                        borderRadius: 6 }}>
                        <p style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                          margin: '0 0 1px', textTransform: 'uppercase' }}>{d.label}</p>
                        <p style={{ fontSize: 11, color: '#374151', margin: 0, fontWeight: 500,
                          fontFamily: d.mono ? 'monospace' : 'inherit' }}>{d.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Límite mensual */}
                  {t.limite_mensual && (
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      padding: '6px 8px', backgroundColor: '#EFF6FF', borderRadius: 7,
                      fontSize: 11 }}>
                      <span style={{ color: '#6B7280' }}>Límite mensual</span>
                      <span style={{ fontWeight: 700, color: '#1E40AF' }}>
                        ${parseFloat(t.limite_mensual).toLocaleString('es-MX')}
                      </span>
                    </div>
                  )}

                  {/* Corte / Pago */}
                  {(t.dia_corte || t.dia_pago) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {t.dia_corte && (
                        <span style={{ fontSize: 10, color: '#B45309', fontWeight: 600,
                          padding: '2px 7px', borderRadius: 6, backgroundColor: '#FFFBEB' }}>
                          Corte: día {t.dia_corte}
                        </span>
                      )}
                      {t.dia_pago && (
                        <span style={{ fontSize: 10, color: '#065F46', fontWeight: 600,
                          padding: '2px 7px', borderRadius: 6, backgroundColor: '#F0FDF4' }}>
                          Pago: día {t.dia_pago}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )
      )}

      {/* ── MODAL REPOSICIÓN ── */}
      {modalRepos && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 14, width: '100%',
            maxWidth: 380, padding: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
              Registrar reposición
            </h3>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px' }}>
              {modalRepos.nombre} · Saldo actual: ${parseFloat(modalRepos.monto_disponible).toLocaleString('es-MX')}
            </p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Monto a reponer ($) *</label>
              <input type="number" min="1" style={{ ...inp2, width: '100%' }}
                value={reposMonto} placeholder="Monto de la transferencia"
                onChange={e => setReposMonto(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 3,
                fontWeight: 600, textTransform: 'uppercase' }}>Referencia de transferencia</label>
              <input type="text" style={{ ...inp2, width: '100%' }}
                value={reposRef} placeholder="Número de operación bancaria"
                onChange={e => setReposRef(e.target.value)} />
            </div>
            <div style={{ padding: '8px 10px', backgroundColor: '#F0FDF4',
              border: '1px solid #A7F3D0', borderRadius: 8, fontSize: 11,
              color: '#065F46', marginBottom: 14 }}>
              Asiento: DEBE 113.01 Caja Chica → HABER 102.01 Banco
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalRepos(null); setReposRef(''); setReposMonto('') }}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB',
                  backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleReponer} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  backgroundColor: '#10B981', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {saving && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                Confirmar reposición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminGastosConfigPage() {
  const { toast }           = useToast()
  const [tab, setTab]       = useState('perfiles')

  const TABS = [
    { id: 'perfiles', label: 'Perfiles',       icon: Shield     },
    { id: 'tipos',    label: 'Tipos de gasto',  icon: Settings   },
    { id: 'limites',  label: 'Límites',          icon: DollarSign },
    { id: 'asignar',  label: 'Asignar',          icon: Users      },
    { id: 'fondos',   label: 'Fondos',           icon: Wallet     },
  ]

  return (
    <MainLayout title="⚙️ Configuración de Gastos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, backgroundColor: '#fff',
          border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '11px 8px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                  backgroundColor: tab === t.id ? '#EFF6FF' : '#fff',
                  color: tab === t.id ? '#1E40AF' : '#374151',
                  borderBottom: tab === t.id ? '2px solid #2563EB' : '2px solid transparent',
                  transition: 'all 0.15s' }}>
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Contenido del tab activo */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 14, padding: '18px 20px' }}>
          {tab === 'perfiles' && <TabPerfiles toast={toast} />}
          {tab === 'tipos'    && <TabTipos    toast={toast} />}
          {tab === 'limites'  && <TabLimites  toast={toast} />}
          {tab === 'asignar'  && <TabAsignar  toast={toast} />}
          {tab === 'fondos'   && <TabFondos   toast={toast} />}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}