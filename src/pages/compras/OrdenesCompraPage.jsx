// ============================================================
//  OBRIX ERP — Módulo: Gestión de Compras
//  src/pages/compras/OrdenesCompraPage.jsx  |  v1.0
//
//  Lista principal de Órdenes de Compra con:
//    · Filtros por estatus, proyecto, proveedor, origen
//    · Vista de detalle lateral con ítems y timeline
//    · Acciones: enviar, confirmar, cancelar, recibir
//    · Panel de recepción de materiales
//    · Botones para crear OC (3 orígenes)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }       from 'react-router-dom'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import { supabase }          from '../../config/supabase'
import * as service          from '../../services/compras.service'
import {
  Search, Plus, ChevronRight, Truck, Clock, CheckCircle,
  XCircle, AlertTriangle, Package, Send, Eye, Trash2,
  RefreshCw, FileText, ShoppingCart, Building2, X,
  ArrowRight, Filter, Download, MoreVertical, Warehouse,
  Calendar, DollarSign, User, Mail, Phone,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE ESTATUS
// ─────────────────────────────────────────────────────────────
const ESTATUS_CONFIG = {
  borrador:          { label: 'Borrador',          bg: '#F3F4F6', color: '#374151', border: '#E5E7EB', icon: '📝', dot: '#9CA3AF' },
  enviada:           { label: 'Enviada',            bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', icon: '📤', dot: '#3B82F6' },
  confirmada:        { label: 'Confirmada',         bg: '#F0FDF4', color: '#065F46', border: '#A7F3D0', icon: '✅', dot: '#10B981' },
  recibida_parcial:  { label: 'Recibida parcial',   bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA', icon: '📦', dot: '#F97316' },
  recibida_total:    { label: 'Recibida total',     bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', icon: '✅', dot: '#059669' },
  cancelada:         { label: 'Cancelada',          bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', icon: '❌', dot: '#DC2626' },
}

const ORIGEN_CONFIG = {
  solicitud:   { label: 'Desde solicitud',   bg: '#F5F3FF', color: '#5B21B6' },
  consolidada: { label: 'Consolidada',       bg: '#FFF7ED', color: '#B45309' },
  directa:     { label: 'Directa',           bg: '#F0FDF4', color: '#065F46' },
}

// ─────────────────────────────────────────────────────────────
// COMPONENTES BASE
// ─────────────────────────────────────────────────────────────

const EstatusBadge = ({ estatus, size = 'md' }) => {
  const c = ESTATUS_CONFIG[estatus] || ESTATUS_CONFIG.borrador
  const pad = size === 'sm' ? '2px 8px' : '4px 12px'
  const fs  = size === 'sm' ? '11px' : '12px'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: pad, borderRadius: 9999, fontSize: fs, fontWeight: 600,
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {c.icon} {c.label}
    </span>
  )
}

const OrigenBadge = ({ origen }) => {
  const c = ORIGEN_CONFIG[origen] || ORIGEN_CONFIG.directa
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '1px 7px',
      borderRadius: 9999, backgroundColor: c.bg, color: c.color,
    }}>{c.label}</span>
  )
}

const MontoFmt = ({ value, size = 'md' }) => (
  <span style={{
    fontSize: size === 'lg' ? 18 : 13, fontWeight: 700, color: '#111827',
  }}>
    ${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
  </span>
)

const inputSt = {
  padding: '8px 10px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff', color: '#111827',
  boxSizing: 'border-box',
}

const BtnPrimary = ({ onClick, icon: Icon, label, disabled, color = '#2563EB', bg, small }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: small ? '6px 12px' : '8px 16px',
      borderRadius: 8, border: 'none',
      backgroundColor: disabled ? '#E5E7EB' : (bg || color),
      color: disabled ? '#9CA3AF' : '#fff',
      fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
    {Icon && <Icon size={small ? 12 : 14} />} {label}
  </button>
)

const BtnSecondary = ({ onClick, icon: Icon, label, danger, small }) => (
  <button onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: small ? '5px 10px' : '7px 14px',
      borderRadius: 8,
      border: `1px solid ${danger ? '#FECACA' : '#E5E7EB'}`,
      backgroundColor: danger ? '#FEF2F2' : '#F9FAFB',
      color: danger ? '#DC2626' : '#374151',
      fontSize: small ? 11 : 12, fontWeight: 500,
      cursor: 'pointer',
    }}>
    {Icon && <Icon size={small ? 11 : 13} />} {label}
  </button>
)

// ─────────────────────────────────────────────────────────────
// TARJETA DE OC (lista)
// ─────────────────────────────────────────────────────────────
const OcCard = ({ oc, activa, onClick }) => {
  const pct = calcPctRecepcion(oc)

  return (
    <div onClick={onClick}
      style={{
        padding: '14px 16px', cursor: 'pointer',
        backgroundColor: activa ? '#EFF6FF' : '#fff',
        borderBottom: '1px solid #F3F4F6',
        borderLeft: `3px solid ${activa ? '#2563EB' : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!activa) e.currentTarget.style.backgroundColor = '#F9FAFB' }}
      onMouseLeave={e => { if (!activa) e.currentTarget.style.backgroundColor = '#fff' }}
    >
      {/* Fila 1: folio + estatus */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#1E40AF' }}>
          {oc.folio}
        </span>
        <EstatusBadge estatus={oc.estatus} size="sm" />
      </div>
      {/* Proveedor */}
      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 4px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {oc.tercero?.razon_social}
      </p>
      {/* Fila 3: proyecto + monto */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#6B7280' }}>
          {oc.project?.name || 'Sin proyecto'}
        </span>
        <MontoFmt value={oc.total} />
      </div>
      {/* Fila 4: origen + barra progreso si aplica */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <OrigenBadge origen={oc.origen} />
        {['recibida_parcial', 'recibida_total', 'confirmada'].includes(oc.estatus) && (
          <div style={{ flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 9999 }}>
            <div style={{
              height: '100%', borderRadius: 9999,
              backgroundColor: oc.estatus === 'recibida_total' ? '#10B981' : '#F97316',
              width: `${pct}%`, transition: 'width 0.3s',
            }} />
          </div>
        )}
        <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>
          {oc.fecha_emision}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL DETALLE OC (derecha)
// ─────────────────────────────────────────────────────────────
const OcDetalle = ({ ocId, onClose, onRefresh, toast, userRole }) => {
  const navigate = useNavigate()
  const [oc,          setOc]          = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('items')
  const [showEnviar,  setShowEnviar]  = useState(false)
  const [emailEnvio,  setEmailEnvio]  = useState('')
  const [showCancelar,setShowCancelar]= useState(false)
  const [motCancel,   setMotCancel]   = useState('')
  const [showRecibir, setShowRecibir] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [warehouses,  setWarehouses]  = useState([])
  const [recibiendo,  setRecibiendo]  = useState({}) // { itemId: {cantidad, warehouseId} }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await service.getOrdenCompraById(ocId)
    setOc(data)
    if (data?.tercero) {
      const emailSugerido = data.tercero.email || ''
      setEmailEnvio(emailSugerido)
    }
    setLoading(false)
  }, [ocId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('warehouses').select('id, name').order('name')
      .then(({ data }) => setWarehouses(data || []))
  }, [])

  const handleEnviar = async () => {
    if (!emailEnvio.trim()) { toast.error('Ingresa el email del proveedor'); return }
    setSaving(true)
    const { error } = await service.enviarOrdenCompra(ocId, emailEnvio)
    setSaving(false)
    if (error) { toast.error('Error al marcar como enviada'); return }
    toast.success('OC marcada como enviada')
    setShowEnviar(false); load(); onRefresh()
  }

  const handleConfirmar = async () => {
    setSaving(true)
    const { error } = await service.confirmarOrdenCompra(ocId)
    setSaving(false)
    if (error) { toast.error('Error al confirmar'); return }
    toast.success('OC confirmada por el proveedor')
    load(); onRefresh()
  }

  const handleCancelar = async () => {
    if (!motCancel.trim()) { toast.error('Escribe el motivo de cancelación'); return }
    setSaving(true)
    const { error } = await service.cancelarOrdenCompra(ocId, motCancel)
    setSaving(false)
    if (error) { toast.error('Error al cancelar'); return }
    toast.success('OC cancelada')
    setShowCancelar(false); load(); onRefresh()
  }

  const handleRecibir = async (item) => {
    const r = recibiendo[item.id]
    if (!r?.cantidad || r.cantidad <= 0) { toast.error('Ingresa la cantidad a recibir'); return }
    if (!r?.warehouseId) { toast.error('Selecciona el almacén de destino'); return }

    // Determinar rol de confirmación según el rol del usuario
    const rolMap = {
      super_admin:   'admin_empresa',
      admin_empresa: 'admin_empresa',
      jefe_obra:     'jefe_obra',
      almacenista:   'almacenista_obra',
    }
    const rol = rolMap[userRole] || 'almacenista_obra'

    setSaving(true)
    const { error } = await service.registrarRecepcion({
      ocItemId:         item.id,
      cantidad:         parseFloat(r.cantidad),
      warehouseId:      r.warehouseId,
      rolConfirmacion:  rol,
      folioRemision:    r.folioRemision || null,
      notas:            r.notas        || null,
    })
    setSaving(false)
    if (error) { toast.error(`Error: ${error.message}`); return }
    toast.success(`Recepción registrada — inventario actualizado`)
    setRecibiendo(prev => { const n = { ...prev }; delete n[item.id]; return n })
    load(); onRefresh()
  }

  const setRec = (itemId, key, val) => {
    setRecibiendo(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [key]: val },
    }))
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9CA3AF', gap: 10 }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13 }}>Cargando OC…</span>
    </div>
  )

  if (!oc) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9CA3AF' }}>
      <AlertTriangle size={24} /> <span style={{ marginLeft: 8 }}>OC no encontrada</span>
    </div>
  )

  const canEnviar    = oc.estatus === 'borrador'
  const canConfirmar = oc.estatus === 'enviada'
  const canRecibir   = ['confirmada', 'recibida_parcial'].includes(oc.estatus)
  const canCancelar  = !['recibida_total', 'cancelada'].includes(oc.estatus)
  const canEdit      = oc.estatus === 'borrador'
  const pct          = calcPctRecepcion(oc)
  const tabs         = [
    { id: 'items',   label: `Ítems (${oc.ordenes_compra_items?.length ?? 0})` },
    { id: 'recibir', label: 'Recepción', disabled: !canRecibir },
    { id: 'log',     label: `Historial (${oc.log?.length ?? 0})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 20px 0', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, color: '#1E40AF' }}>
                {oc.folio}
              </span>
              <EstatusBadge estatus={oc.estatus} />
              <OrigenBadge origen={oc.origen} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
              {oc.tercero?.razon_social}
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              {oc.project?.name && `📁 ${oc.project.name} · `}
              Emitida: {oc.fecha_emision}
              {oc.fecha_requerida && ` · Requerida: ${oc.fecha_requerida}`}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Totales */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 1px' }}>Subtotal</p>
            <MontoFmt value={oc.subtotal} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 1px' }}>IVA</p>
            <MontoFmt value={oc.iva} />
          </div>
          <div style={{ textAlign: 'center', backgroundColor: '#F0FDF4',
            padding: '4px 12px', borderRadius: 8, border: '1px solid #A7F3D0' }}>
            <p style={{ fontSize: 10, color: '#065F46', margin: '0 0 1px', fontWeight: 600 }}>TOTAL</p>
            <MontoFmt value={oc.total} size="lg" />
          </div>
          {oc.dias_credito > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 1px' }}>Crédito</p>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                {oc.dias_credito}d
              </span>
            </div>
          )}
          {canRecibir && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', paddingLeft: 8 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 3px' }}>
                Recepción {pct}%
              </p>
              <div style={{ height: 5, backgroundColor: '#E5E7EB', borderRadius: 9999 }}>
                <div style={{ height: '100%', borderRadius: 9999, width: `${pct}%`,
                  backgroundColor: pct >= 100 ? '#10B981' : '#F97316',
                  transition: 'width 0.4s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Acciones principales */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 10 }}>
          {canEdit && (
            <BtnSecondary
              onClick={() => navigate(`/compras/ordenes/${ocId}/editar`)}
              icon={FileText} label="Editar OC" small />
          )}
          {canEnviar && (
            <BtnPrimary onClick={() => setShowEnviar(true)}
              icon={Send} label="Enviar al proveedor" small />
          )}
          {canConfirmar && (
            <BtnPrimary onClick={handleConfirmar} icon={CheckCircle}
              label="Marcar confirmada" small color="#059669" disabled={saving} />
          )}
          {canRecibir && (
            <BtnPrimary onClick={() => setTab('recibir')}
              icon={Package} label="Registrar recepción" small color="#F97316" />
          )}
          {canCancelar && (
            <BtnSecondary onClick={() => setShowCancelar(true)}
              icon={XCircle} label="Cancelar OC" danger small />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => !t.disabled && setTab(t.id)}
              disabled={t.disabled}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 600,
                border: 'none', background: 'none',
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                color: t.disabled ? '#D1D5DB' : tab === t.id ? '#2563EB' : '#6B7280',
                borderBottom: `2px solid ${tab === t.id ? '#2563EB' : 'transparent'}`,
              }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Modales inline ── */}
      {showEnviar && (
        <div style={{ margin: '12px 20px 0', padding: 14,
          backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', margin: '0 0 8px' }}>
            📤 Enviar OC al proveedor
          </p>
          <p style={{ fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
            La OC quedará marcada como "Enviada". El email es solo para registro — el envío real
            deberás realizarlo desde tu cliente de correo.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="email" style={{ ...inputSt, flex: 1 }}
              placeholder="Email del contacto comercial"
              value={emailEnvio}
              onChange={e => setEmailEnvio(e.target.value)} />
            <BtnPrimary onClick={handleEnviar} icon={Send} label="Confirmar envío"
              disabled={saving} small />
            <BtnSecondary onClick={() => setShowEnviar(false)} icon={X} label="" small />
          </div>
        </div>
      )}

      {showCancelar && (
        <div style={{ margin: '12px 20px 0', padding: 14,
          backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', margin: '0 0 8px' }}>
            ❌ Cancelar Orden de Compra
          </p>
          <textarea rows={2} style={{ ...inputSt, width: '100%', resize: 'none', marginBottom: 8 }}
            placeholder="Motivo de la cancelación (obligatorio)…"
            value={motCancel} onChange={e => setMotCancel(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnSecondary onClick={() => setShowCancelar(false)} icon={X} label="No cancelar" small />
            <BtnPrimary onClick={handleCancelar} icon={XCircle} label="Cancelar OC"
              color="#DC2626" disabled={saving} small />
          </div>
        </div>
      )}

      {/* ── Contenido del tab ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>

        {/* ════ TAB: ÍTEMS ════ */}
        {tab === 'items' && (
          <div>
            {(!oc.ordenes_compra_items || oc.ordenes_compra_items.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
                <Package size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>Sin ítems en esta OC</p>
              </div>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>Material</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6B7280' }}>Cant.</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: '#6B7280' }}>Precio</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: '#6B7280' }}>Importe</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6B7280' }}>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oc.ordenes_compra_items.map((item, idx) => (
                      <tr key={item.id}
                        style={{ borderBottom: idx < oc.ordenes_compra_items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <p style={{ fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                            {item.material_nombre}
                          </p>
                          {item.material_code && (
                            <span style={{ fontSize: 10, fontFamily: 'monospace',
                              backgroundColor: '#EFF6FF', color: '#1E40AF',
                              padding: '1px 5px', borderRadius: 4 }}>
                              {item.material_code}
                            </span>
                          )}
                          {item.presentacion_nombre && (
                            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                              {item.presentacion_nombre}
                            </p>
                          )}
                          {item.partida_nombre && (
                            <p style={{ fontSize: 10, color: '#7C3AED', margin: '2px 0 0' }}>
                              📌 {item.partida_nombre}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                          {item.cantidad_presentacion}
                          <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block' }}>
                            {item.unidad}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>
                          ${Number(item.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#065F46' }}>
                          ${Number(item.importe || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <ItemEstatusBadge estatus={item.estatus_item}
                            recibido={item.cantidad_recibida}
                            total={item.cantidad_presentacion} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#F9FAFB', borderTop: '2px solid #E5E7EB' }}>
                      <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right',
                        fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                        Subtotal / IVA 16% / Total
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>
                          ${Number(oc.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>
                          ${Number(oc.iva).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                          ${Number(oc.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {oc.notas && (
              <div style={{ marginTop: 12, padding: 10, backgroundColor: '#F9FAFB',
                borderRadius: 8, border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 4px', fontWeight: 600 }}>NOTAS</p>
                <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{oc.notas}</p>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: RECEPCIÓN ════ */}
        {tab === 'recibir' && (
          <div>
            <div style={{ padding: '10px 12px', backgroundColor: '#FFF7ED',
              border: '1px solid #FED7AA', borderRadius: 10, marginBottom: 14,
              display: 'flex', gap: 8 }}>
              <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
                Al registrar la recepción, la cantidad ingresará automáticamente al inventario
                del almacén seleccionado y se generará un movimiento de entrada.
              </p>
            </div>

            {oc.ordenes_compra_items
              ?.filter(i => i.estatus_item !== 'recibido_total' && i.estatus_item !== 'cancelado')
              .map(item => {
                const r = recibiendo[item.id] || {}
                const pendiente = (item.cantidad_presentacion || 0) - (item.cantidad_recibida || 0)
                return (
                  <div key={item.id} style={{ padding: 14, border: '1px solid #E5E7EB',
                    borderRadius: 10, marginBottom: 10, backgroundColor: '#FAFAFA' }}>
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
                        {item.material_nombre}
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        Pendiente: <strong>{pendiente} {item.unidad}</strong>
                        {item.cantidad_recibida > 0 && (
                          <span style={{ color: '#059669', marginLeft: 8 }}>
                            · Ya recibido: {item.cantidad_recibida}
                          </span>
                        )}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                          Cantidad a recibir *
                        </label>
                        <input type="number" min="0.001" step="0.001"
                          max={pendiente} style={{ ...inputSt, width: '100%' }}
                          placeholder={`Máx. ${pendiente}`}
                          value={r.cantidad || ''}
                          onChange={e => setRec(item.id, 'cantidad', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                          Almacén destino *
                        </label>
                        <select style={{ ...inputSt, width: '100%' }}
                          value={r.warehouseId || ''}
                          onChange={e => setRec(item.id, 'warehouseId', e.target.value)}>
                          <option value="">Seleccionar…</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                          Folio de remisión
                        </label>
                        <input type="text" style={{ ...inputSt, width: '100%' }}
                          placeholder="Nº remisión del proveedor"
                          value={r.folioRemision || ''}
                          onChange={e => setRec(item.id, 'folioRemision', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                          Notas de recepción
                        </label>
                        <input type="text" style={{ ...inputSt, width: '100%' }}
                          placeholder="Observaciones…"
                          value={r.notas || ''}
                          onChange={e => setRec(item.id, 'notas', e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <BtnPrimary
                        onClick={() => handleRecibir(item)}
                        icon={CheckCircle}
                        label={`Confirmar recepción de ${r.cantidad || '?'} ${item.unidad || ''}`}
                        disabled={saving || !r.cantidad || !r.warehouseId}
                        color="#059669"
                        small
                      />
                    </div>
                  </div>
                )
              })}

            {oc.ordenes_compra_items?.every(i =>
              ['recibido_total', 'cancelado'].includes(i.estatus_item)
            ) && (
              <div style={{ textAlign: 'center', padding: 24, color: '#059669' }}>
                <CheckCircle size={28} style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, fontWeight: 600 }}>Todos los ítems recibidos</p>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: HISTORIAL ════ */}
        {tab === 'log' && (
          <div>
            {(!oc.log || oc.log.length === 0) ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                Sin historial
              </p>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8,
                  width: 1, backgroundColor: '#E5E7EB' }} />
                {oc.log.map((entry, i) => {
                  const c = ESTATUS_CONFIG[entry.estatus_nuevo] || ESTATUS_CONFIG.borrador
                  return (
                    <div key={entry.id} style={{ display: 'flex', gap: 12,
                      marginBottom: 12, position: 'relative' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: c.bg, border: `2px solid ${c.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, zIndex: 1 }}>
                        {c.icon}
                      </div>
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>
                            {c.label}
                          </span>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                            {new Date(entry.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {entry.realizado_por?.full_name && (
                          <p style={{ fontSize: 11, color: '#6B7280', margin: '1px 0 0' }}>
                            👤 {entry.realizado_por.full_name}
                          </p>
                        )}
                        {entry.notas && (
                          <p style={{ fontSize: 11, color: '#374151', margin: '3px 0 0',
                            backgroundColor: '#F9FAFB', padding: '4px 8px', borderRadius: 6 }}>
                            {entry.notas}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BADGE ESTATUS ÍTEM
// ─────────────────────────────────────────────────────────────
const ItemEstatusBadge = ({ estatus, recibido, total }) => {
  const conf = {
    pendiente:        { bg: '#F3F4F6', color: '#6B7280', label: 'Pendiente' },
    recibido_parcial: { bg: '#FFF7ED', color: '#9A3412', label: `${recibido}/${total}` },
    recibido_total:   { bg: '#ECFDF5', color: '#065F46', label: '✓ Total' },
    cancelado:        { bg: '#FEF2F2', color: '#991B1B', label: 'Cancelado' },
  }
  const c = conf[estatus] || conf.pendiente
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 9999, backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// HELPER: calcular % de recepción de la OC
// ─────────────────────────────────────────────────────────────
const calcPctRecepcion = (oc) => {
  if (!oc?.ordenes_compra_items?.length) return 0
  const total    = oc.ordenes_compra_items.reduce((s, i) => s + (i.cantidad_presentacion || 0), 0)
  const recibido = oc.ordenes_compra_items.reduce((s, i) => s + (i.cantidad_recibida || 0), 0)
  if (!total) return 0
  return Math.round((recibido / total) * 100)
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function OrdenesCompraPage() {
  const navigate                            = useNavigate()
  const { toast }                           = useToast()
  const [ordenes,     setOrdenes]           = useState([])
  const [loading,     setLoading]           = useState(true)
  const [seleccionada, setSeleccionada]     = useState(null)
  const [filtroEstatus, setFiltroEstatus]   = useState('')
  const [filtroOrigen,  setFiltroOrigen]    = useState('')
  const [search,        setSearch]          = useState('')
  const [kpis,          setKpis]            = useState(null)
  const [userRole,      setUserRole]        = useState('almacenista')

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await service.getOrdenesCompra({
      estatus: filtroEstatus || undefined,
      origen:  filtroOrigen  || undefined,
    })
    if (error) toast.error('Error al cargar órdenes de compra')
    else setOrdenes(data || [])
    setLoading(false)
  }, [filtroEstatus, filtroOrigen])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    service.getKpisCompras().then(({ data }) => setKpis(data))
    // Obtener rol del usuario
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users_profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => data && setUserRole(data.role))
    })
  }, [])

  const ordenesFiltradas = ordenes.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.folio?.toLowerCase().includes(q) ||
           o.tercero?.razon_social?.toLowerCase().includes(q) ||
           o.project?.name?.toLowerCase().includes(q)
  })

  const kpiItems = [
    { label: 'Borradores',      value: kpis?.oc_borrador          ?? 0, color: '#374151', bg: '#F3F4F6' },
    { label: 'Enviadas',        value: kpis?.oc_enviadas           ?? 0, color: '#1E40AF', bg: '#EFF6FF' },
    { label: 'Confirmadas',     value: kpis?.oc_confirmadas        ?? 0, color: '#065F46', bg: '#F0FDF4' },
    { label: 'Pend. recepción', value: kpis?.oc_recibidas_parcial  ?? 0, color: '#9A3412', bg: '#FFF7ED' },
    { label: 'Total del mes',
      value: `$${Number(kpis?.total_mes || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,
      color: '#5B21B6', bg: '#F5F3FF' },
  ]

  return (
    <RequirePermission module="compras" action="view">
      <MainLayout title="🛒 Órdenes de Compra">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

          {/* ── KPIs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10, marginBottom: 16 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ padding: '12px 14px',
                backgroundColor: k.bg, borderRadius: 10,
                border: `1px solid ${k.color}22` }}>
                <p style={{ fontSize: 10, color: k.color, fontWeight: 600,
                  margin: '0 0 3px', opacity: 0.8 }}>{k.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* ── Área principal ── */}
          <div style={{ flex: 1, display: 'flex', gap: 0,
            border: '1px solid #E5E7EB', borderRadius: 14,
            overflow: 'hidden', backgroundColor: '#fff', minHeight: 0 }}>

            {/* ── Columna izquierda ── */}
            <div style={{ width: 340, borderRight: '1px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

              {/* Controles */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                    transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                  <input type="text" placeholder="Buscar folio, proveedor, proyecto…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ ...inputSt, width: '100%', paddingLeft: 30 }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select style={{ ...inputSt, flex: 1 }}
                    value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
                    <option value="">Todos los estatus</option>
                    {Object.entries(ESTATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                  <select style={{ ...inputSt, flex: 1 }}
                    value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}>
                    <option value="">Todos los orígenes</option>
                    <option value="directa">Directa</option>
                    <option value="solicitud">Desde solicitud</option>
                    <option value="consolidada">Consolidada</option>
                  </select>
                </div>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 100, color: '#9CA3AF', gap: 8 }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 13 }}>Cargando…</span>
                  </div>
                ) : ordenesFiltradas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF' }}>
                    <ShoppingCart size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p style={{ fontSize: 13 }}>Sin órdenes de compra</p>
                    <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4 }}>
                      Crea tu primera OC con el botón de abajo
                    </p>
                  </div>
                ) : (
                  ordenesFiltradas.map(o => (
                    <OcCard
                      key={o.id}
                      oc={o}
                      activa={seleccionada === o.id}
                      onClick={() => setSeleccionada(prev => prev === o.id ? null : o.id)}
                    />
                  ))
                )}
              </div>

              {/* Footer con 3 botones de creación */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6',
                flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 4px',
                  textTransform: 'uppercase', fontWeight: 600 }}>Nueva orden de compra</p>
                <button onClick={() => navigate('/compras/ordenes/nueva?origen=directa')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #BFDBFE',
                    backgroundColor: '#EFF6FF', color: '#1E40AF', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  <Plus size={14} /> OC Directa
                  <span style={{ fontSize: 10, color: '#93C5FD', marginLeft: 'auto' }}>
                    Sin solicitud previa
                  </span>
                </button>
                <button onClick={() => navigate('/compras/ordenes/nueva?origen=solicitud')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #A7F3D0',
                    backgroundColor: '#ECFDF5', color: '#065F46', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  <FileText size={14} /> Desde solicitud aprobada
                  <span style={{ fontSize: 10, color: '#6EE7B7', marginLeft: 'auto' }}>
                    1 solicitud → 1 OC
                  </span>
                </button>
                <button onClick={() => navigate('/compras/ordenes/nueva?origen=consolidada')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #FDE68A',
                    backgroundColor: '#FFFBEB', color: '#B45309', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  <Package size={14} /> Consolidar solicitudes
                  <span style={{ fontSize: 10, color: '#FCD34D', marginLeft: 'auto' }}>
                    N solicitudes → 1 OC
                  </span>
                </button>
              </div>
            </div>

            {/* ── Panel derecho ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {seleccionada ? (
                <OcDetalle
                  key={seleccionada}
                  ocId={seleccionada}
                  onClose={() => setSeleccionada(null)}
                  onRefresh={cargar}
                  toast={toast}
                  userRole={userRole}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#9CA3AF', gap: 12, padding: 32 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%',
                    backgroundColor: '#F3F4F6', display: 'flex',
                    alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart size={24} color="#D1D5DB" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                      Selecciona una orden
                    </p>
                    <p style={{ fontSize: 12, margin: 0, maxWidth: 260, lineHeight: 1.5 }}>
                      Haz clic en cualquier OC para ver sus ítems, registrar recepciones
                      y consultar el historial de cambios.
                    </p>
                  </div>
                  {(kpis?.oc_recibidas_parcial > 0) && (
                    <div style={{ padding: '10px 16px', backgroundColor: '#FFF7ED',
                      border: '1px solid #FED7AA', borderRadius: 10 }}>
                      <p style={{ fontSize: 12, color: '#92400E', margin: 0, textAlign: 'center' }}>
                        📦 {kpis.oc_recibidas_parcial} OC{kpis.oc_recibidas_parcial !== 1 ? 's' : ''} con recepción pendiente
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </MainLayout>
    </RequirePermission>
  )
}
