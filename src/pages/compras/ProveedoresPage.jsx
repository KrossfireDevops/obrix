// ============================================================
//  OBRIX ERP — Módulo: Gestión de Compras
//  src/pages/compras/ProveedoresPage.jsx  |  v1.0
//
//  Pantalla principal del catálogo de proveedores de compra.
//  Muestra los terceros de tipo 'proveedor' enriquecidos con
//  datos operativos: condiciones de entrega, contactos de
//  venta y presentaciones de materiales por proveedor.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import { supabase }          from '../../config/supabase'
import * as service          from '../../services/compras.service'
import {
  Search, Plus, ChevronRight, Truck, MapPin, Clock,
  Phone, Mail, User, Package, Star, AlertTriangle,
  CheckCircle, XCircle, Edit3, Trash2, RefreshCw,
  ShoppingCart, Zap, Shield, Building2, X,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'

// ── Paleta de colores del módulo ──────────────────────────────
const C = {
  principal:   { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  secundario:  { bg: '#F0FDF4', color: '#065F46', border: '#A7F3D0' },
  emergencia:  { bg: '#FEF9C3', color: '#B45309', border: '#FDE68A' },
  verde:       { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  amarillo:    { bg: '#FEF9C3', color: '#B45309', border: '#FDE68A' },
  rojo:        { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
}

// ─────────────────────────────────────────────────────────────
// COMPONENTES UTILITARIOS
// ─────────────────────────────────────────────────────────────

const Badge = ({ text, style }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    fontSize: '11px', fontWeight: '600',
    padding: '2px 8px', borderRadius: '9999px',
    border: '1px solid', ...style,
  }}>{text}</span>
)

const ClasifBadge = ({ clasif }) => {
  const conf = {
    principal:  { icon: '★', label: 'Principal',  ...C.principal  },
    secundario: { icon: '◎', label: 'Secundario', ...C.secundario },
    emergencia: { icon: '⚡', label: 'Emergencia', ...C.emergencia },
  }
  const c = conf[clasif] || conf.secundario
  return (
    <Badge text={`${c.icon} ${c.label}`}
      style={{ backgroundColor: c.bg, color: c.color, borderColor: c.border }} />
  )
}

const ScoreDot = ({ semaforo }) => {
  const color = { verde: '#10B981', amarillo: '#F59E0B', rojo: '#EF4444' }
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%',
      backgroundColor: color[semaforo] || color.rojo,
      flexShrink: 0,
    }} />
  )
}

const SectionTitle = ({ icon: Icon, title, action }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icon && <Icon size={14} color="#6B7280" />}
      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151',
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
    </div>
    {action}
  </div>
)

const Pill = ({ label, value, color = '#374151', bg = '#F9FAFB' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2,
    padding: '8px 10px', borderRadius: 8,
    backgroundColor: bg, border: '1px solid #E5E7EB', minWidth: 80 }}>
    <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
  </div>
)

const SmallBtn = ({ onClick, icon: Icon, label, color = '#374151', bg = '#F9FAFB', danger }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 7,
    border: `1px solid ${danger ? '#FECACA' : '#E5E7EB'}`,
    background: danger ? '#FEF2F2' : bg,
    color: danger ? '#DC2626' : color,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
  }}>
    {Icon && <Icon size={12} />} {label}
  </button>
)

// ─────────────────────────────────────────────────────────────
// TARJETA DE PROVEEDOR (lista izquierda)
// ─────────────────────────────────────────────────────────────
const ProveedorCard = ({ prov, activo, onClick }) => {
  const rel   = prov.relacion      || {}
  const cfg   = prov.compra_config || null
  const score = rel.score_semaforo || 'rojo'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px', cursor: 'pointer',
        backgroundColor: activo ? '#EFF6FF' : '#fff',
        borderBottom: '1px solid #F3F4F6',
        borderLeft: `3px solid ${activo ? '#2563EB' : 'transparent'}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!activo) e.currentTarget.style.backgroundColor = '#F9FAFB' }}
      onMouseLeave={e => { if (!activo) e.currentTarget.style.backgroundColor = '#fff' }}
    >
      {/* Fila 1: RFC + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <ScoreDot semaforo={score} />
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
          color: '#1E40AF', backgroundColor: '#EFF6FF',
          padding: '1px 6px', borderRadius: 4 }}>{prov.rfc}</span>
        {!cfg && (
          <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>
            Sin configurar
          </span>
        )}
      </div>
      {/* Razón social */}
      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 6px',
        lineHeight: 1.3 }}>{prov.razon_social}</p>
      {/* Chips de condiciones */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cfg?.maneja_entrega && (
          <Badge text="🚛 Entrega"
            style={{ backgroundColor: '#F0FDF4', color: '#065F46', borderColor: '#A7F3D0' }} />
        )}
        {cfg?.maneja_recoleccion && (
          <Badge text="📦 Recolección"
            style={{ backgroundColor: '#F9FAFB', color: '#374151', borderColor: '#E5E7EB' }} />
        )}
        {cfg?.cobertura && (
          <Badge text={cfg.cobertura.charAt(0).toUpperCase() + cfg.cobertura.slice(1)}
            style={{ backgroundColor: '#F5F3FF', color: '#5B21B6', borderColor: '#DDD6FE' }} />
        )}
        {rel.dias_credito > 0 && (
          <Badge text={`${rel.dias_credito}d crédito`}
            style={{ backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL LATERAL DERECHO — DETALLE DEL PROVEEDOR
// ─────────────────────────────────────────────────────────────
const ProveedorDetalle = ({ terceroId, onClose, onRefresh, toast }) => {
  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState('condiciones')
  const [editCfg,       setEditCfg]       = useState(false)
  const [cfgForm,       setCfgForm]       = useState({})
  const [savingCfg,     setSavingCfg]     = useState(false)
  const [showAddContacto, setShowAddContacto] = useState(false)
  const [contactoForm,  setContactoForm]  = useState({})
  const [savingContacto, setSavingContacto] = useState(false)
  const [showAddPresent, setShowAddPresent] = useState(false)
  const [presentForm,   setPresentForm]   = useState({ clasificacion: 'secundario' })
  const [savingPresent, setSavingPresent] = useState(false)
  const [materiales,    setMateriales]    = useState([])
  const [warehouses,    setWarehouses]    = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await service.getProveedorCompraById(terceroId)
    setData(d)
    setCfgForm(d?.compra_config || {})
    setLoading(false)
  }, [terceroId])

  useEffect(() => { load() }, [load])

  // Cargar catálogo de materiales y almacenes para los formularios
  useEffect(() => {
    supabase.from('materials_catalog').select('id, material_code, material_type, default_unit')
      .eq('is_active', true).order('material_type')
      .then(({ data }) => setMateriales(data || []))
    supabase.from('warehouses').select('id, name').order('name')
      .then(({ data }) => setWarehouses(data || []))
  }, [])

  const guardarCfg = async () => {
    setSavingCfg(true)
    const { error } = await service.upsertProveedorCompra(terceroId, cfgForm)
    setSavingCfg(false)
    if (error) { toast.error('Error al guardar condiciones'); return }
    toast.success('Condiciones actualizadas')
    setEditCfg(false)
    load(); onRefresh()
  }

  const guardarContacto = async () => {
    if (!contactoForm.nombre?.trim()) { toast.error('El nombre es obligatorio'); return }
    setSavingContacto(true)
    const { error } = await service.upsertContactoVenta(terceroId, contactoForm)
    setSavingContacto(false)
    if (error) { toast.error('Error al guardar contacto'); return }
    toast.success('Contacto guardado')
    setShowAddContacto(false); setContactoForm({})
    load()
  }

  const eliminarContacto = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return
    await service.deleteContactoVenta(id)
    toast.success('Contacto eliminado'); load()
  }

  const guardarPresentacion = async () => {
    if (!presentForm.material_id) { toast.error('Selecciona un material'); return }
    if (!presentForm.nombre?.trim()) { toast.error('Nombre de presentación obligatorio'); return }
    if (!presentForm.precio_unitario) { toast.error('Precio obligatorio'); return }
    setSavingPresent(true)
    const { error } = await service.upsertPresentacion(terceroId, presentForm)
    setSavingPresent(false)
    if (error) { toast.error('Error al guardar presentación'); return }
    toast.success('Presentación guardada')
    setShowAddPresent(false); setPresentForm({ clasificacion: 'secundario' })
    load()
  }

  const eliminarPresentacion = async (id) => {
    if (!confirm('¿Eliminar esta presentación?')) return
    await service.deletePresentacion(id)
    toast.success('Presentación eliminada'); load()
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9CA3AF', flexDirection: 'column', gap: 12 }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13 }}>Cargando proveedor…</span>
    </div>
  )

  if (!data) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9CA3AF', flexDirection: 'column', gap: 8 }}>
      <AlertTriangle size={28} />
      <span style={{ fontSize: 13 }}>No se pudo cargar el proveedor</span>
    </div>
  )

  const rel  = data.relacion      || {}
  const cfg  = data.compra_config || null
  const tabs = [
    { id: 'condiciones', label: 'Condiciones' },
    { id: 'contactos',   label: `Contactos (${data.contactos?.length ?? 0})` },
    { id: 'materiales',  label: `Materiales (${data.presentaciones?.length ?? 0})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header del panel ── */}
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                color: '#1E40AF', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>
                {data.rfc}
              </span>
              <ScoreDot semaforo={rel.score_semaforo} />
              {rel.bloqueado && (
                <Badge text="🔒 Bloqueado"
                  style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderColor: '#FECACA' }} />
              )}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.razon_social}
            </h3>
            {data.email && (
              <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0', display: 'flex',
                alignItems: 'center', gap: 4 }}>
                <Mail size={11} /> {data.email}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: '#9CA3AF', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Pill label="Días crédito" value={rel.dias_credito ? `${rel.dias_credito}d` : 'Contado'} />
          <Pill label="Entrega" value={cfg?.tiempo_entrega_dias ? `${cfg.tiempo_entrega_dias}d` : '—'} />
          <Pill label="Cobertura"
            value={cfg?.cobertura ? cfg.cobertura.charAt(0).toUpperCase() + cfg.cobertura.slice(1) : '—'} />
          <Pill label="Score" value={rel.score_fiscal ?? '—'}
            color={rel.score_semaforo === 'verde' ? '#065F46' :
                   rel.score_semaforo === 'amarillo' ? '#B45309' : '#991B1B'} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t.id ? '#2563EB' : '#6B7280',
              borderBottom: `2px solid ${tab === t.id ? '#2563EB' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Contenido del tab ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* ════ TAB: CONDICIONES ════ */}
        {tab === 'condiciones' && (
          <div>
            {!cfg && !editCfg && (
              <div style={{ padding: 16, backgroundColor: '#FFF7ED',
                border: '1px solid #FED7AA', borderRadius: 10, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color="#D97706" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', margin: 0 }}>
                    Sin configuración de compra
                  </p>
                  <p style={{ fontSize: 12, color: '#B45309', margin: '2px 0 0' }}>
                    Configura las condiciones para poder generar OC con este proveedor.
                  </p>
                </div>
                <SmallBtn onClick={() => setEditCfg(true)} icon={Edit3}
                  label="Configurar" color="#2563EB" />
              </div>
            )}

            {(cfg || editCfg) && !editCfg && (
              <div>
                <SectionTitle icon={Truck} title="Condiciones de entrega"
                  action={<SmallBtn onClick={() => setEditCfg(true)} icon={Edit3} label="Editar" />} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <Fila label="Maneja entrega a domicilio/obra"
                    value={cfg.maneja_entrega ? '✅ Sí' : '❌ No'} />
                  <Fila label="Maneja recolección en bodega"
                    value={cfg.maneja_recoleccion ? '✅ Sí' : '❌ No'} />
                  <Fila label="Entrega directo en obra"
                    value={cfg.entrega_en_obra ? '✅ Sí' : '❌ No'} />
                  <Fila label="Cobertura geográfica"
                    value={cfg.cobertura ? cfg.cobertura.charAt(0).toUpperCase() + cfg.cobertura.slice(1) : '—'} />
                  <Fila label="Tiempo de entrega promedio"
                    value={cfg.tiempo_entrega_dias ? `${cfg.tiempo_entrega_dias} días hábiles` : '—'} />
                  <Fila label="Requiere Orden de Compra formal"
                    value={cfg.requiere_orden_compra ? '✅ Sí' : '❌ No'} />
                  <Fila label="Acepta devoluciones"
                    value={cfg.acepta_devoluciones ? `✅ Sí (${cfg.plazo_devolucion_dias}d)` : '❌ No'} />
                  <Fila label="Monto mínimo de compra"
                    value={cfg.monto_minimo_compra
                      ? `$${Number(cfg.monto_minimo_compra).toLocaleString('es-MX')}` : '—'} />
                  <Fila label="Descuento por volumen"
                    value={cfg.descuento_volumen_pct ? `${cfg.descuento_volumen_pct}%` : '—'} />
                </div>

                <SectionTitle icon={Mail} title="Comunicación para OC" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Fila label="Email para envío de OC"    value={cfg.email_compras   || '—'} />
                  <Fila label="WhatsApp de ventas"        value={cfg.whatsapp_compras || '—'} />
                </div>
                {cfg.notas_operativas && (
                  <div style={{ marginTop: 12, padding: 10, backgroundColor: '#F9FAFB',
                    borderRadius: 8, border: '1px solid #E5E7EB' }}>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px' }}>Notas operativas</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{cfg.notas_operativas}</p>
                  </div>
                )}
              </div>
            )}

            {editCfg && (
              <FormCondiciones
                form={cfgForm}
                onChange={setCfgForm}
                onSave={guardarCfg}
                onCancel={() => { setEditCfg(false); setCfgForm(cfg || {}) }}
                saving={savingCfg}
              />
            )}
          </div>
        )}

        {/* ════ TAB: CONTACTOS ════ */}
        {tab === 'contactos' && (
          <div>
            <SectionTitle icon={User} title="Contactos de venta"
              action={
                <SmallBtn onClick={() => { setShowAddContacto(true); setContactoForm({}) }}
                  icon={Plus} label="Agregar" color="#2563EB" />
              }
            />

            {showAddContacto && (
              <FormContacto
                form={contactoForm}
                onChange={setContactoForm}
                onSave={guardarContacto}
                onCancel={() => { setShowAddContacto(false); setContactoForm({}) }}
                saving={savingContacto}
              />
            )}

            {data.contactos?.length === 0 && !showAddContacto && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
                <User size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>Sin contactos de venta registrados</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {data.contactos?.map(c => (
                <ContactoCard key={c.id} contacto={c} onDelete={() => eliminarContacto(c.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ════ TAB: MATERIALES ════ */}
        {tab === 'materiales' && (
          <div>
            <SectionTitle icon={Package} title="Presentaciones y precios"
              action={
                <SmallBtn
                  onClick={() => { setShowAddPresent(true); setPresentForm({ clasificacion: 'secundario' }) }}
                  icon={Plus} label="Agregar" color="#2563EB" />
              }
            />

            {showAddPresent && (
              <FormPresentacion
                form={presentForm}
                onChange={setPresentForm}
                materiales={materiales}
                onSave={guardarPresentacion}
                onCancel={() => { setShowAddPresent(false); setPresentForm({ clasificacion: 'secundario' }) }}
                saving={savingPresent}
              />
            )}

            {data.presentaciones?.length === 0 && !showAddPresent && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
                <Package size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>Sin presentaciones registradas</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {data.presentaciones?.map(p => (
                <PresentacionCard key={p.id} pres={p} onDelete={() => eliminarPresentacion(p.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: Ir a OC ── */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0,
        display: 'flex', gap: 8 }}>
        <a href={`/compras/ordenes/nueva?tercero=${terceroId}`}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '9px 0', backgroundColor: '#2563EB', color: '#fff',
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            border: 'none', cursor: 'pointer' }}>
          <ShoppingCart size={14} /> Nueva Orden de Compra
        </a>
        <a href={`/relaciones/terceros/${terceroId}`}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px',
            backgroundColor: '#F9FAFB', color: '#374151',
            borderRadius: 9, fontSize: 12, fontWeight: 500, textDecoration: 'none',
            border: '1px solid #E5E7EB', cursor: 'pointer' }}>
          <ExternalLink size={12} /> Ver en Terceros
        </a>
      </div>
    </div>
  )
}

// ── Fila clave-valor ──────────────────────────────────────────
const Fila = ({ label, value }) => (
  <div style={{ padding: '8px 10px', backgroundColor: '#F9FAFB',
    borderRadius: 7, border: '1px solid #F3F4F6' }}>
    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>{label}</p>
    <p style={{ fontSize: 13, color: '#111827', margin: 0, fontWeight: 500 }}>{value}</p>
  </div>
)

// ── Tarjeta de contacto ───────────────────────────────────────
const ContactoCard = ({ contacto: c, onDelete }) => (
  <div style={{ padding: 12, backgroundColor: '#F9FAFB',
    borderRadius: 10, border: '1px solid #E5E7EB' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.nombre}</span>
          {c.is_principal && (
            <Badge text="★ Principal"
              style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' }} />
          )}
          {c.recibe_oc && (
            <Badge text="📧 Recibe OC"
              style={{ backgroundColor: '#F0FDF4', color: '#065F46', borderColor: '#A7F3D0' }} />
          )}
        </div>
        {c.cargo && <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px' }}>{c.cargo}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {c.email && (
            <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: '#2563EB',
              display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
              <Mail size={11} /> {c.email}
            </a>
          )}
          {c.telefono && (
            <span style={{ fontSize: 12, color: '#374151',
              display: 'flex', alignItems: 'center', gap: 3 }}>
              <Phone size={11} /> {c.telefono}{c.extension ? ` ext. ${c.extension}` : ''}
            </span>
          )}
        </div>
      </div>
      <SmallBtn onClick={onDelete} icon={Trash2} label="" danger />
    </div>
  </div>
)

// ── Tarjeta de presentación ───────────────────────────────────
const PresentacionCard = ({ pres: p, onDelete }) => (
  <div style={{ padding: 12, backgroundColor: '#F9FAFB',
    borderRadius: 10, border: '1px solid #E5E7EB' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6B7280',
            backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>
            {p.material?.material_code || '—'}
          </span>
          <ClasifBadge clasif={p.clasificacion} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.material?.material_type}
        </p>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
          {p.nombre}
          {p.cantidad_por_unidad && (
            <span> · {p.cantidad_por_unidad} {p.unidad_base}/{p.unidad_presentacion}</span>
          )}
        </p>
      </div>
      <SmallBtn onClick={onDelete} icon={Trash2} label="" danger />
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#065F46' }}>
        ${Number(p.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </span>
      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
        por {p.unidad_presentacion} {p.incluye_iva ? '(c/IVA)' : '(s/IVA)'}
      </span>
      {p.tiempo_surtido_dias && (
        <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={11} /> {p.tiempo_surtido_dias}d surtido
        </span>
      )}
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────
// FORMULARIOS INLINE
// ─────────────────────────────────────────────────────────────

const inputSt = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', boxSizing: 'border-box',
  backgroundColor: '#fff', color: '#111827',
}

const selectSt = { ...inputSt }

const FormCondiciones = ({ form, onChange, onSave, onCancel, saving }) => {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }))
  const toggle = (k) => set(k, !form[k])

  return (
    <div style={{ padding: 14, backgroundColor: '#F0F9FF',
      border: '1px solid #BAE6FD', borderRadius: 10, marginBottom: 12 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', margin: '0 0 12px',
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Condiciones de entrega y compra
      </p>

      {/* Checkboxes de opciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          ['maneja_entrega',       '🚛 Maneja entrega a domicilio/obra'],
          ['maneja_recoleccion',   '📦 Maneja recolección en bodega'],
          ['entrega_en_obra',      '🏗️ Entrega directo en obra'],
          ['requiere_orden_compra','📋 Requiere OC formal para despachar'],
          ['acepta_devoluciones',  '↩️ Acepta devoluciones'],
        ].map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7,
            cursor: 'pointer', fontSize: 12, color: '#374151',
            padding: '6px 8px', backgroundColor: '#fff',
            border: '1px solid #E5E7EB', borderRadius: 7 }}>
            <input type="checkbox" checked={!!form[key]}
              onChange={() => toggle(key)}
              style={{ accentColor: '#2563EB', width: 14, height: 14 }} />
            {label}
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Cobertura
          </label>
          <select style={selectSt} value={form.cobertura || 'local'}
            onChange={e => set('cobertura', e.target.value)}>
            <option value="local">Local (ciudad)</option>
            <option value="estado">Estado</option>
            <option value="nacional">Nacional</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Tiempo entrega (días)
          </label>
          <input type="number" min="1" style={inputSt}
            value={form.tiempo_entrega_dias || ''}
            onChange={e => set('tiempo_entrega_dias', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Plazo devolución (días)
          </label>
          <input type="number" min="0" style={inputSt}
            value={form.plazo_devolucion_dias || ''}
            onChange={e => set('plazo_devolucion_dias', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Monto mínimo de compra ($)
          </label>
          <input type="number" min="0" step="0.01" style={inputSt}
            placeholder="0.00"
            value={form.monto_minimo_compra || ''}
            onChange={e => set('monto_minimo_compra', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Descuento por volumen (%)
          </label>
          <input type="number" min="0" max="100" step="0.5" style={inputSt}
            value={form.descuento_volumen_pct || ''}
            onChange={e => set('descuento_volumen_pct', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Email para envío de OC
          </label>
          <input type="email" style={inputSt} placeholder="compras@proveedor.com"
            value={form.email_compras || ''}
            onChange={e => set('email_compras', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            WhatsApp de ventas
          </label>
          <input type="tel" style={inputSt} placeholder="33 1234 5678"
            value={form.whatsapp_compras || ''}
            onChange={e => set('whatsapp_compras', e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
          Notas operativas
        </label>
        <textarea rows={2} style={{ ...inputSt, resize: 'none' }}
          placeholder="Horario de atención, días de visita, notas especiales..."
          value={form.notas_operativas || ''}
          onChange={e => set('notas_operativas', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <SmallBtn onClick={onCancel} icon={X} label="Cancelar" />
        <button onClick={onSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            backgroundColor: saving ? '#93C5FD' : '#2563EB',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={13} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

const FormContacto = ({ form, onChange, onSave, onCancel, saving }) => {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }))
  return (
    <div style={{ padding: 12, backgroundColor: '#F9FAFB',
      border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 10px',
        textTransform: 'uppercase' }}>Nuevo contacto de venta</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Nombre *</label>
          <input type="text" style={inputSt} placeholder="Nombre completo"
            value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Cargo</label>
          <input type="text" style={inputSt} placeholder="Ej: Ejecutivo de Ventas"
            value={form.cargo || ''} onChange={e => set('cargo', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Email</label>
          <input type="email" style={inputSt} placeholder="ventas@proveedor.com"
            value={form.email || ''} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Teléfono</label>
          <input type="tel" style={inputSt} placeholder="33 1234 5678"
            value={form.telefono || ''} onChange={e => set('telefono', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>WhatsApp</label>
          <input type="tel" style={inputSt} placeholder="33 1234 5678"
            value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Extensión</label>
          <input type="text" style={inputSt} placeholder="Ext. 101"
            value={form.extension || ''} onChange={e => set('extension', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!form.is_principal}
            onChange={e => set('is_principal', e.target.checked)}
            style={{ accentColor: '#2563EB' }} />
          Contacto principal
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.recibe_oc !== false}
            onChange={e => set('recibe_oc', e.target.checked)}
            style={{ accentColor: '#2563EB' }} />
          Recibe OC por email
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <SmallBtn onClick={onCancel} icon={X} label="Cancelar" />
        <button onClick={onSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            backgroundColor: saving ? '#93C5FD' : '#2563EB',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={13} /> {saving ? 'Guardando…' : 'Guardar contacto'}
        </button>
      </div>
    </div>
  )
}

const FormPresentacion = ({ form, onChange, materiales, onSave, onCancel, saving }) => {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }))
  return (
    <div style={{ padding: 12, backgroundColor: '#F9FAFB',
      border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 10px',
        textTransform: 'uppercase' }}>Nueva presentación</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Material *</label>
          <select style={selectSt} value={form.material_id || ''}
            onChange={e => set('material_id', e.target.value)}>
            <option value="">Seleccionar material…</option>
            {materiales.map(m => (
              <option key={m.id} value={m.id}>
                {m.material_code ? `[${m.material_code}] ` : ''}{m.material_type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Nombre presentación *</label>
          <input type="text" style={inputSt} placeholder="Ej: Caja cerrada, Bulto, Pieza"
            value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Descripción</label>
          <input type="text" style={inputSt} placeholder="Ej: Caja c/12 piezas"
            value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Unidad de presentación *</label>
          <input type="text" style={inputSt} placeholder="caja, bulto, kg, pieza, rollo…"
            value={form.unidad_presentacion || ''} onChange={e => set('unidad_presentacion', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Cantidad por unidad</label>
          <input type="number" min="0" step="0.001" style={inputSt}
            placeholder="Ej: 12 (piezas por caja)"
            value={form.cantidad_por_unidad || ''}
            onChange={e => set('cantidad_por_unidad', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Precio unitario (sin IVA) *</label>
          <input type="number" min="0" step="0.01" style={inputSt}
            placeholder="0.00"
            value={form.precio_unitario || ''}
            onChange={e => set('precio_unitario', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Clasificación</label>
          <select style={selectSt} value={form.clasificacion || 'secundario'}
            onChange={e => set('clasificacion', e.target.value)}>
            <option value="principal">★ Principal</option>
            <option value="secundario">◎ Secundario</option>
            <option value="emergencia">⚡ Emergencia</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Tiempo de surtido (días)</label>
          <input type="number" min="1" style={inputSt}
            value={form.tiempo_surtido_dias || 3}
            onChange={e => set('tiempo_surtido_dias', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Vigencia del precio</label>
          <input type="date" style={inputSt}
            value={form.precio_vigente_al || ''}
            onChange={e => set('precio_vigente_al', e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
          <input type="checkbox" id="iva" checked={!!form.incluye_iva}
            onChange={e => set('incluye_iva', e.target.checked)}
            style={{ accentColor: '#2563EB', width: 14, height: 14 }} />
          <label htmlFor="iva" style={{ fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            El precio ya incluye IVA
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <SmallBtn onClick={onCancel} icon={X} label="Cancelar" />
        <button onClick={onSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            backgroundColor: saving ? '#93C5FD' : '#2563EB',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={13} /> {saving ? 'Guardando…' : 'Guardar presentación'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const { toast }                           = useToast()
  const [proveedores, setProveedores]       = useState([])
  const [loading,     setLoading]           = useState(true)
  const [search,      setSearch]            = useState('')
  const [filtroCobertura, setFiltroCobertura] = useState('')
  const [soloConfig,  setSoloConfig]        = useState(false)
  const [seleccionado, setSeleccionado]     = useState(null)
  const [kpis,        setKpis]              = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await service.getProveedoresCompra({
      search:          search || undefined,
      cobertura:       filtroCobertura || undefined,
      solo_configurados: soloConfig || undefined,
    })
    if (error) toast.error('Error al cargar proveedores')
    else setProveedores(data || [])
    setLoading(false)
  }, [search, filtroCobertura, soloConfig])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    service.getKpisCompras().then(({ data }) => setKpis(data))
  }, [])

  const proveedoresFiltrados = proveedores.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.rfc.toLowerCase().includes(q) ||
           p.razon_social.toLowerCase().includes(q)
  })

  const configurados   = proveedores.filter(p => p.compra_config).length
  const sinConfigurar  = proveedores.length - configurados

  return (
    <RequirePermission module="compras" action="view">
      <MainLayout title="🏪 Proveedores de Compra">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

          {/* ── KPIs superiores ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12, padding: '0 0 16px' }}>
            {[
              { label: 'Proveedores totales',   value: proveedores.length,  color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Configurados',           value: configurados,        color: '#065F46', bg: '#F0FDF4' },
              { label: 'Sin configurar',         value: sinConfigurar,       color: '#B45309', bg: '#FFF7ED' },
              { label: 'OC pendientes recep.',
                value: kpis?.oc_recibidas_parcial ?? '—',                   color: '#7C3AED', bg: '#F5F3FF' },
            ].map(k => (
              <div key={k.label} style={{ padding: '14px 16px',
                backgroundColor: k.bg, borderRadius: 12,
                border: `1px solid ${k.color}22` }}>
                <p style={{ fontSize: 11, color: k.color, fontWeight: 600,
                  margin: '0 0 4px', opacity: 0.8 }}>{k.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* ── Área principal: lista + panel ── */}
          <div style={{ flex: 1, display: 'flex', gap: 0,
            border: '1px solid #E5E7EB', borderRadius: 14,
            overflow: 'hidden', backgroundColor: '#fff', minHeight: 0 }}>

            {/* ── Columna izquierda: filtros + lista ── */}
            <div style={{ width: 320, borderRight: '1px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

              {/* Filtros */}
              <div style={{ padding: '14px 14px 12px',
                borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                    transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                  <input
                    type="text"
                    placeholder="Buscar por RFC o nombre…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...inputSt, paddingLeft: 30 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select style={{ ...selectSt, flex: 1 }}
                    value={filtroCobertura}
                    onChange={e => setFiltroCobertura(e.target.value)}>
                    <option value="">Toda cobertura</option>
                    <option value="local">Local</option>
                    <option value="estado">Estado</option>
                    <option value="nacional">Nacional</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, color: '#374151', cursor: 'pointer',
                    padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8,
                    backgroundColor: soloConfig ? '#EFF6FF' : '#fff',
                    whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={soloConfig}
                      onChange={e => setSoloConfig(e.target.checked)}
                      style={{ accentColor: '#2563EB' }} />
                    Solo config.
                  </label>
                </div>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 120, color: '#9CA3AF', gap: 8 }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 13 }}>Cargando…</span>
                  </div>
                ) : proveedoresFiltrados.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF' }}>
                    <Building2 size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>
                      {search ? 'Sin resultados para esta búsqueda' : 'Sin proveedores registrados'}
                    </p>
                    {!search && (
                      <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 6 }}>
                        Agrega proveedores desde Relaciones Comerciales → Terceros
                      </p>
                    )}
                  </div>
                ) : (
                  proveedoresFiltrados.map(p => (
                    <ProveedorCard
                      key={p.id}
                      prov={p}
                      activo={seleccionado === p.id}
                      onClick={() => setSeleccionado(prev => prev === p.id ? null : p.id)}
                    />
                  ))
                )}
              </div>

              {/* Footer lista */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6',
                flexShrink: 0, display: 'flex', justifyContent: 'space-between',
                alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {proveedoresFiltrados.length} proveedor{proveedoresFiltrados.length !== 1 ? 'es' : ''}
                </span>
                <a href="/relaciones/terceros/nuevo"
                  style={{ display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, color: '#2563EB', fontWeight: 600,
                    textDecoration: 'none' }}>
                  <Plus size={12} /> Nuevo proveedor
                </a>
              </div>
            </div>

            {/* ── Panel derecho: detalle ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {seleccionado ? (
                <ProveedorDetalle
                  key={seleccionado}
                  terceroId={seleccionado}
                  onClose={() => setSeleccionado(null)}
                  onRefresh={cargar}
                  toast={toast}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#9CA3AF', gap: 12, padding: 32 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%',
                    backgroundColor: '#F3F4F6', display: 'flex',
                    alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={24} color="#D1D5DB" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                      Selecciona un proveedor
                    </p>
                    <p style={{ fontSize: 12, margin: 0, maxWidth: 260, lineHeight: 1.5 }}>
                      Haz clic en cualquier proveedor de la lista para ver sus condiciones,
                      contactos de venta y presentaciones de materiales.
                    </p>
                  </div>
                  {sinConfigurar > 0 && (
                    <div style={{ padding: '10px 16px', backgroundColor: '#FFF7ED',
                      border: '1px solid #FED7AA', borderRadius: 10, maxWidth: 280 }}>
                      <p style={{ fontSize: 12, color: '#92400E', margin: 0, textAlign: 'center' }}>
                        ⚠️ {sinConfigurar} proveedor{sinConfigurar !== 1 ? 'es' : ''} sin
                        condiciones de compra configuradas
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Estilos globales del módulo */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </MainLayout>
    </RequirePermission>
  )
}
