// ============================================================
//  OBRIX ERP — Módulo: Gestión de Compras
//  src/pages/compras/OrdenCompraForm.jsx  |  v1.0
//
//  Wizard para crear una Orden de Compra desde 3 orígenes:
//    1. DIRECTA       — sin solicitud previa
//    2. SOLICITUD     — desde 1 solicitud aprobada
//    3. CONSOLIDADA   — desde N solicitudes del mismo proyecto
//
//  Pasos:
//    Origen = 'directa':     [Proveedor] → [Proyecto+Config] → [Ítems] → [Confirmar]
//    Origen = 'solicitud':   [Seleccionar solicitud] → [Proveedor] → [Revisar] → [Confirmar]
//    Origen = 'consolidada': [Seleccionar solicitudes] → [Proveedor] → [Revisar] → [Confirmar]
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams }      from 'react-router-dom'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import { supabase }          from '../../config/supabase'
import * as service          from '../../services/compras.service'
import {
  ChevronLeft, ChevronRight, CheckCircle, Plus, Trash2,
  Search, Package, Building2, FileText, ShoppingCart,
  AlertTriangle, RefreshCw, X, Star,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// PASOS POR ORIGEN
// ─────────────────────────────────────────────────────────────
const PASOS = {
  directa:     ['Proveedor', 'Config. OC', 'Ítems', 'Confirmar'],
  solicitud:   ['Solicitud', 'Proveedor',  'Revisar ítems', 'Confirmar'],
  consolidada: ['Solicitudes', 'Proveedor', 'Revisar ítems', 'Confirmar'],
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE ESTILO
// ─────────────────────────────────────────────────────────────
const inputSt = {
  padding: '9px 11px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff', color: '#111827',
  width: '100%', boxSizing: 'border-box',
}

const selectSt = { ...inputSt }

const Label = ({ children, required }) => (
  <label style={{ fontSize: 11, color: '#6B7280', display: 'block',
    marginBottom: 4, fontWeight: 600 }}>
    {children} {required && <span style={{ color: '#DC2626' }}>*</span>}
  </label>
)

const FieldError = ({ msg }) => msg
  ? <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{msg}</p>
  : null

// ─────────────────────────────────────────────────────────────
// PASO: SELECCIONAR PROVEEDOR
// ─────────────────────────────────────────────────────────────
const PasoProveedor = ({ value, onChange }) => {
  const [proveedores, setProveedores] = useState([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    service.getProveedoresCompra().then(({ data }) => {
      setProveedores(data || [])
      setLoading(false)
    })
  }, [])

  const filtrados = proveedores.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.rfc.toLowerCase().includes(q) ||
           p.razon_social.toLowerCase().includes(q)
  })

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
        Selecciona el proveedor al que se emitirá la orden de compra.
      </p>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
          transform: 'translateY(-50%)', color: '#9CA3AF' }} />
        <input type="text" placeholder="Buscar proveedor…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputSt, paddingLeft: 30 }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24, color: '#9CA3AF', gap: 8 }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Cargando proveedores…</span>
        </div>
      ) : (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 10,
          overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
              <p style={{ fontSize: 13 }}>Sin proveedores{search ? ' para esta búsqueda' : ''}</p>
            </div>
          ) : (
            filtrados.map(p => (
              <div key={p.id}
                onClick={() => onChange({ terceroId: p.id, razonSocial: p.razon_social,
                  rfc: p.rfc, email: p.compra_config?.email_compras || p.email || '' })}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  backgroundColor: value?.terceroId === p.id ? '#EFF6FF' : '#fff',
                  borderBottom: '1px solid #F3F4F6',
                  borderLeft: `3px solid ${value?.terceroId === p.id ? '#2563EB' : 'transparent'}`,
                }}
                onMouseEnter={e => { if (value?.terceroId !== p.id) e.currentTarget.style.backgroundColor = '#F9FAFB' }}
                onMouseLeave={e => { if (value?.terceroId !== p.id) e.currentTarget.style.backgroundColor = '#fff' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                        color: '#1E40AF', backgroundColor: '#EFF6FF',
                        padding: '1px 6px', borderRadius: 4 }}>{p.rfc}</span>
                      {p.compra_config && (
                        <span style={{ fontSize: 10, color: '#065F46' }}>✓ Configurado</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                      {p.razon_social}
                    </p>
                    {p.compra_config && (
                      <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                        {p.compra_config.maneja_entrega ? '🚛 Entrega · ' : '📦 Recolección · '}
                        {p.compra_config.cobertura} · {p.compra_config.tiempo_entrega_dias}d entrega
                      </p>
                    )}
                  </div>
                  {value?.terceroId === p.id && (
                    <CheckCircle size={18} color="#2563EB" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PASO: SELECCIONAR SOLICITUD(ES) APROBADAS
// ─────────────────────────────────────────────────────────────
const PasoSolicitudes = ({ seleccionadas, onChange, multiple }) => {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    service.getSolicitudesAprobadas().then(({ data }) => {
      setSolicitudes(data || [])
      setLoading(false)
    })
  }, [])

  const toggle = (sol) => {
    if (!multiple) {
      onChange(seleccionadas[0]?.id === sol.id ? [] : [sol])
      return
    }
    const existe = seleccionadas.find(s => s.id === sol.id)
    if (existe) onChange(seleccionadas.filter(s => s.id !== sol.id))
    else onChange([...seleccionadas, sol])
  }

  const isSelected = (id) => seleccionadas.some(s => s.id === id)

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
        {multiple
          ? 'Selecciona las solicitudes aprobadas que quieres consolidar en una sola OC. Deben ser del mismo proyecto.'
          : 'Selecciona la solicitud aprobada desde la que generarás la OC.'}
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24, color: '#9CA3AF', gap: 8 }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Cargando solicitudes…</span>
        </div>
      ) : solicitudes.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF',
          border: '1px dashed #E5E7EB', borderRadius: 10 }}>
          <FileText size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
          <p style={{ fontSize: 13, margin: 0 }}>No hay solicitudes aprobadas pendientes de OC</p>
          <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4 }}>
            Las solicitudes aparecen aquí cuando están aprobadas y aún no tienen OC generada.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {solicitudes.map(sol => {
            const sel = isSelected(sol.id)
            const totalItems = sol.material_request_items?.length || 0
            return (
              <div key={sol.id}
                onClick={() => toggle(sol)}
                style={{
                  padding: '12px 14px', cursor: 'pointer', borderRadius: 10,
                  border: `1.5px solid ${sel ? '#2563EB' : '#E5E7EB'}`,
                  backgroundColor: sel ? '#EFF6FF' : '#fff',
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ width: 18, height: 18, borderRadius: multiple ? 4 : '50%',
                        border: `2px solid ${sel ? '#2563EB' : '#D1D5DB'}`,
                        backgroundColor: sel ? '#2563EB' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0 }}>
                        {sel && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                        color: '#1E40AF', backgroundColor: '#EFF6FF',
                        padding: '1px 6px', borderRadius: 4 }}>
                        {sol.folio}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600,
                        backgroundColor: '#FEF3C7', color: '#B45309',
                        padding: '1px 7px', borderRadius: 9999 }}>
                        {sol.priority}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                      {sol.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                      📁 {sol.project?.name} · {totalItems} material{totalItems !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0, marginTop: 4 }}>
                    {new Date(sol.created_at).toLocaleDateString('es-MX')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {multiple && seleccionadas.length > 0 && (
        <div style={{ marginTop: 12, padding: '8px 12px',
          backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: '#1E40AF', margin: 0, fontWeight: 600 }}>
            ✓ {seleccionadas.length} solicitud{seleccionadas.length !== 1 ? 'es' : ''} seleccionada{seleccionadas.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PASO: CONFIGURACIÓN DE LA OC
// ─────────────────────────────────────────────────────────────
const PasoConfigOC = ({ form, onChange, proyectos, almacenes }) => {
  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <Label>Proyecto</Label>
          <select style={selectSt} value={form.project_id || ''}
            onChange={e => set('project_id', e.target.value)}>
            <option value="">Sin proyecto</option>
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Almacén destino</Label>
          <select style={selectSt} value={form.warehouse_id || ''}
            onChange={e => set('warehouse_id', e.target.value)}>
            <option value="">Sin almacén específico</option>
            {almacenes.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label required>Fecha de emisión</Label>
          <input type="date" style={inputSt} value={form.fecha_emision || ''}
            onChange={e => set('fecha_emision', e.target.value)} />
        </div>
        <div>
          <Label>Fecha requerida</Label>
          <input type="date" style={inputSt} value={form.fecha_requerida || ''}
            onChange={e => set('fecha_requerida', e.target.value)} />
        </div>
        <div>
          <Label>Lugar de entrega</Label>
          <select style={selectSt} value={form.lugar_entrega || 'recoleccion'}
            onChange={e => set('lugar_entrega', e.target.value)}>
            <option value="recoleccion">📦 Recolección en bodega</option>
            <option value="domicilio">🚛 Entrega a domicilio</option>
            <option value="obra">🏗️ Entrega en obra</option>
          </select>
        </div>
        <div>
          <Label>Días de crédito</Label>
          <input type="number" min="0" style={inputSt} value={form.dias_credito || 0}
            onChange={e => set('dias_credito', e.target.value)} />
        </div>
      </div>
      {form.lugar_entrega !== 'recoleccion' && (
        <div>
          <Label>Dirección de entrega</Label>
          <input type="text" style={inputSt}
            placeholder="Calle, número, colonia, ciudad…"
            value={form.direccion_entrega || ''}
            onChange={e => set('direccion_entrega', e.target.value)} />
        </div>
      )}
      <div>
        <Label>Condiciones de pago</Label>
        <input type="text" style={inputSt}
          placeholder="Ej: 30 días netos, Contado, 50% anticipo 50% entrega…"
          value={form.condiciones_pago || ''}
          onChange={e => set('condiciones_pago', e.target.value)} />
      </div>
      <div>
        <Label>Notas generales</Label>
        <textarea rows={2} style={{ ...inputSt, resize: 'none' }}
          placeholder="Instrucciones especiales, observaciones…"
          value={form.notas || ''}
          onChange={e => set('notas', e.target.value)} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PASO: ÍTEMS DE LA OC (solo para OC directa)
// ─────────────────────────────────────────────────────────────
const PasoItems = ({ items, onChange, materiales, proveedor }) => {
  const [presentacionesMap, setPresentacionesMap] = useState({})

  // Cargar presentaciones del proveedor para el material seleccionado
  const cargarPresentaciones = useCallback(async (materialId) => {
    if (!materialId || !proveedor?.terceroId || presentacionesMap[materialId]) return
    const { data } = await supabase
      .from('proveedor_presentaciones')
      .select('*')
      .eq('material_id', materialId)
      .eq('tercero_id', proveedor.terceroId)
      .eq('is_active', true)
    setPresentacionesMap(prev => ({ ...prev, [materialId]: data || [] }))
  }, [proveedor, presentacionesMap])

  const setItem = (idx, key, val) => {
    onChange(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }

  const addItem = () => onChange(prev => [...prev, {
    material_id: '', material_nombre: '', unidad: '',
    presentacion_id: '', presentacion_nombre: '',
    cantidad_presentacion: 1, precio_unitario: 0, descuento_pct: 0, notas: '',
  }])

  const removeItem = (idx) => {
    if (items.length <= 1) return
    onChange(prev => prev.filter((_, i) => i !== idx))
  }

  const onMaterialChange = async (idx, materialId) => {
    const mat = materiales.find(m => m.id === materialId)
    setItem(idx, 'material_id', materialId)
    setItem(idx, 'material_nombre', mat?.material_type || '')
    setItem(idx, 'material_code', mat?.material_code || '')
    setItem(idx, 'unidad', mat?.default_unit || '')
    setItem(idx, 'presentacion_id', '')
    setItem(idx, 'presentacion_nombre', '')
    await cargarPresentaciones(materialId)
  }

  const onPresentacionChange = (idx, presentacionId, materialId) => {
    const pres = (presentacionesMap[materialId] || []).find(p => p.id === presentacionId)
    setItem(idx, 'presentacion_id', presentacionId)
    if (pres) {
      setItem(idx, 'presentacion_nombre', pres.nombre)
      setItem(idx, 'precio_unitario', pres.precio_unitario)
    }
  }

  const totalSinIva = items.reduce((s, it) => {
    return s + ((it.cantidad_presentacion || 0) * (it.precio_unitario || 0) *
      (1 - (it.descuento_pct || 0) / 100))
  }, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
          Agrega los materiales que incluirá la orden de compra.
        </p>
        <button onClick={addItem}
          style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 7, border: '1px solid #BFDBFE',
            backgroundColor: '#EFF6FF', color: '#1E40AF',
            fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Agregar material
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, idx) => {
          const presentaciones = presentacionesMap[item.material_id] || []
          const importe = (item.cantidad_presentacion || 0) * (item.precio_unitario || 0) *
            (1 - (item.descuento_pct || 0) / 100)

          return (
            <div key={idx} style={{ padding: 12, backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB', borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                <div>
                  <Label required>Material</Label>
                  <select style={selectSt} value={item.material_id}
                    onChange={e => onMaterialChange(idx, e.target.value)}>
                    <option value="">Seleccionar material…</option>
                    {materiales.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_code ? `[${m.material_code}] ` : ''}{m.material_type}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={() => removeItem(idx)} disabled={items.length <= 1}
                  style={{ alignSelf: 'flex-end', padding: '8px', borderRadius: 7,
                    border: 'none', backgroundColor: items.length <= 1 ? '#F3F4F6' : '#FEF2F2',
                    color: items.length <= 1 ? '#D1D5DB' : '#DC2626',
                    cursor: items.length <= 1 ? 'not-allowed' : 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {item.material_id && presentaciones.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <Label>Presentación del proveedor</Label>
                  <select style={selectSt} value={item.presentacion_id}
                    onChange={e => onPresentacionChange(idx, e.target.value, item.material_id)}>
                    <option value="">Precio manual (sin presentación)</option>
                    {presentaciones.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}{p.descripcion ? ` — ${p.descripcion}` : ''}
                        {` · $${Number(p.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <Label required>Cantidad</Label>
                  <input type="number" min="0.001" step="0.001" style={inputSt}
                    value={item.cantidad_presentacion}
                    onChange={e => setItem(idx, 'cantidad_presentacion', e.target.value)} />
                </div>
                <div>
                  <Label required>Precio unitario</Label>
                  <input type="number" min="0" step="0.01" style={inputSt}
                    value={item.precio_unitario}
                    onChange={e => setItem(idx, 'precio_unitario', e.target.value)} />
                </div>
                <div>
                  <Label>Descuento %</Label>
                  <input type="number" min="0" max="100" step="0.5" style={inputSt}
                    value={item.descuento_pct || 0}
                    onChange={e => setItem(idx, 'descuento_pct', e.target.value)} />
                </div>
                <div>
                  <Label>Importe</Label>
                  <div style={{ ...inputSt, backgroundColor: '#F0FDF4',
                    border: '1px solid #A7F3D0', fontWeight: 700, color: '#065F46',
                    display: 'flex', alignItems: 'center' }}>
                    ${importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {item.material_id && (
                <div style={{ marginTop: 8 }}>
                  <Label>Notas del ítem</Label>
                  <input type="text" style={inputSt}
                    placeholder="Especificaciones, observaciones…"
                    value={item.notas || ''}
                    onChange={e => setItem(idx, 'notas', e.target.value)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Totales */}
      <div style={{ marginTop: 14, padding: '12px 14px',
        backgroundColor: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 10,
        display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 2px' }}>Subtotal</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>
            ${totalSinIva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 2px' }}>IVA 16%</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>
            ${(totalSinIva * 0.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: '#065F46', fontWeight: 600, margin: '0 0 2px' }}>TOTAL</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#065F46', margin: 0 }}>
            ${(totalSinIva * 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PASO: CONFIRMACIÓN FINAL
// ─────────────────────────────────────────────────────────────
const PasoConfirmar = ({ origen, proveedor, config, items, solicitudes }) => {
  const totalSinIva = items.reduce((s, it) =>
    s + ((it.cantidad_presentacion || 0) * (it.precio_unitario || 0) *
         (1 - (it.descuento_pct || 0) / 100)), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: 14, backgroundColor: '#F0FDF4',
        border: '1px solid #A7F3D0', borderRadius: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 10px' }}>
          ✅ Resumen de la Orden de Compra
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FilaResumen label="Proveedor" value={proveedor?.razonSocial || '—'} />
          <FilaResumen label="RFC" value={proveedor?.rfc || '—'} />
          <FilaResumen label="Origen" value={
            origen === 'directa' ? 'OC Directa' :
            origen === 'solicitud' ? 'Desde solicitud' : 'Solicitudes consolidadas'
          } />
          {config?.project_id && <FilaResumen label="Proyecto" value={config.project_id} />}
          <FilaResumen label="Fecha de emisión" value={config?.fecha_emision || '—'} />
          {config?.fecha_requerida && <FilaResumen label="Fecha requerida" value={config.fecha_requerida} />}
          <FilaResumen label="Lugar de entrega" value={
            config?.lugar_entrega === 'recoleccion' ? '📦 Recolección' :
            config?.lugar_entrega === 'domicilio'   ? '🚛 Domicilio'   : '🏗️ En obra'
          } />
          {config?.dias_credito > 0 && (
            <FilaResumen label="Crédito" value={`${config.dias_credito} días`} />
          )}
        </div>
      </div>

      <div style={{ padding: 12, backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB', borderRadius: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
          margin: '0 0 8px', textTransform: 'uppercase' }}>
          {items.length} ítem{items.length !== 1 ? 's' : ''}
        </p>
        {items.filter(it => it.material_nombre).map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
            padding: '5px 0', borderBottom: i < items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
            <span style={{ fontSize: 12, color: '#374151' }}>
              {it.cantidad_presentacion}x {it.material_nombre}
              {it.presentacion_nombre && ` (${it.presentacion_nombre})`}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#065F46' }}>
              ${((it.cantidad_presentacion || 0) * (it.precio_unitario || 0) *
                (1 - (it.descuento_pct || 0) / 100))
                .toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10,
          paddingTop: 8, borderTop: '2px solid #E5E7EB' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 2px' }}>
              Subtotal ${totalSinIva.toLocaleString('es-MX', { minimumFractionDigits: 2 })} + IVA
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#065F46', margin: 0 }}>
              Total ${(totalSinIva * 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 12px', backgroundColor: '#EFF6FF',
        border: '1px solid #BFDBFE', borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: '#1E40AF', margin: 0 }}>
          ℹ️ La OC se creará en estatus <strong>Borrador</strong>. Podrás revisarla y
          marcarla como <em>Enviada</em> cuando la envíes al proveedor.
        </p>
      </div>
    </div>
  )
}

const FilaResumen = ({ label, value }) => (
  <div>
    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 1px', fontWeight: 600 }}>{label}</p>
    <p style={{ fontSize: 12, color: '#111827', fontWeight: 500, margin: 0 }}>{value}</p>
  </div>
)

// ─────────────────────────────────────────────────────────────
// INDICADOR DE PASOS
// ─────────────────────────────────────────────────────────────
const StepBar = ({ paso, pasos }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
    {pasos.map((label, idx) => (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: idx < pasos.length - 1 ? 1 : 'initial' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0, transition: 'all 0.2s',
            backgroundColor: paso > idx ? '#10B981' : paso === idx ? '#2563EB' : '#F3F4F6',
            color: paso > idx ? '#fff' : paso === idx ? '#fff' : '#9CA3AF',
            boxShadow: paso === idx ? '0 0 0 4px #DBEAFE' : 'none',
          }}>
            {paso > idx ? '✓' : idx + 1}
          </div>
          <span style={{ fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap',
            color: paso === idx ? '#2563EB' : paso > idx ? '#059669' : '#9CA3AF' }}>
            {label}
          </span>
        </div>
        {idx < pasos.length - 1 && (
          <div style={{ flex: 1, height: 2, margin: '0 8px', marginBottom: 14,
            backgroundColor: paso > idx ? '#10B981' : '#E5E7EB', transition: 'background 0.3s' }} />
        )}
      </div>
    ))}
  </div>
)

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function OrdenCompraForm() {
  const navigate                      = useNavigate()
  const [searchParams]                = useSearchParams()
  const { toast }                     = useToast()
  const origen                        = searchParams.get('origen') || 'directa'
  const terceroParam                  = searchParams.get('tercero') || ''

  const pasos = PASOS[origen] || PASOS.directa
  const [paso,     setPaso]     = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  // Estado por sección
  const [proveedor,    setProveedor]    = useState(
    terceroParam ? { terceroId: terceroParam } : null
  )
  const [solicitudes,  setSolicitudes]  = useState([])  // para origen solicitud/consolidada
  const [config,       setConfig]       = useState({
    fecha_emision:  new Date().toISOString().split('T')[0],
    lugar_entrega:  'recoleccion',
    dias_credito:   0,
  })
  const [items, setItems] = useState([{
    material_id: '', material_nombre: '', unidad: '',
    presentacion_id: '', presentacion_nombre: '',
    cantidad_presentacion: 1, precio_unitario: 0, descuento_pct: 0, notas: '',
  }])

  // Catálogos
  const [proyectos,  setProyectos]  = useState([])
  const [almacenes,  setAlmacenes]  = useState([])
  const [materiales, setMateriales] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('projects').select('id, name, code').eq('is_active', true)
        .order('name').then(({ data }) => setProyectos(data || [])),
      supabase.from('warehouses').select('id, name').order('name')
        .then(({ data }) => setAlmacenes(data || [])),
      supabase.from('materials_catalog').select('id, material_code, material_type, default_unit')
        .eq('is_active', true).order('material_type')
        .then(({ data }) => setMateriales(data || [])),
    ])
  }, [])

  // Si viene con tercero precargado, ir al paso de config
  useEffect(() => {
    if (terceroParam && origen === 'directa') setPaso(1)
  }, [terceroParam, origen])

  // Validar paso actual antes de avanzar
  const validar = () => {
    if (origen === 'directa') {
      if (paso === 0 && !proveedor?.terceroId) return 'Selecciona un proveedor'
      if (paso === 2) {
        const sinMaterial = items.some(it => !it.material_id || !it.material_nombre?.trim())
        if (sinMaterial) return 'Todos los ítems deben tener un material seleccionado'
        const sinCantidad = items.some(it => !it.cantidad_presentacion || it.cantidad_presentacion <= 0)
        if (sinCantidad) return 'Todos los ítems deben tener cantidad mayor a 0'
      }
    } else {
      if (paso === 0 && solicitudes.length === 0) return 'Selecciona al menos una solicitud'
      if (paso === 1 && !proveedor?.terceroId) return 'Selecciona un proveedor'
    }
    return null
  }

  const handleSiguiente = () => {
    const err = validar()
    if (err) { setError(err); return }
    setError(null)
    setPaso(p => p + 1)
  }

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)
    try {
      let ocId

      if (origen === 'directa') {
        const { data, error: e } = await service.crearOrdenDirecta({
          tercero_id:       proveedor.terceroId,
          project_id:       config.project_id       || null,
          warehouse_id:     config.warehouse_id     || null,
          fecha_emision:    config.fecha_emision,
          fecha_requerida:  config.fecha_requerida  || null,
          dias_credito:     parseInt(config.dias_credito) || 0,
          condiciones_pago: config.condiciones_pago || null,
          lugar_entrega:    config.lugar_entrega,
          direccion_entrega: config.direccion_entrega || null,
          notas:            config.notas            || null,
          items: items.filter(it => it.material_id),
        })
        if (e) throw e
        ocId = data?.id
      } else {
        const projectId = solicitudes[0]?.project?.id || null
        const { data, error: e } = await service.crearOcDesdeSolicitudes(
          solicitudes.map(s => s.id),
          proveedor.terceroId,
          projectId,
          config.warehouse_id || null
        )
        if (e) throw e
        ocId = data
      }

      toast.success('¡Orden de Compra creada exitosamente! 🎉')
      navigate(`/compras/ordenes`)
    } catch (e) {
      setError(e.message || 'Error al crear la orden de compra')
    } finally {
      setSaving(false)
    }
  }

  // Para origen solicitud/consolidada — precargar ítems desde las solicitudes
  const itemsSolicitudes = solicitudes.flatMap(sol =>
    (sol.material_request_items || []).map(it => ({
      material_id:           it.materials_catalog?.id || '',
      material_nombre:       it.materials_catalog?.material_type || '',
      material_code:         it.materials_catalog?.material_code || '',
      unidad:                it.materials_catalog?.default_unit  || '',
      presentacion_id:       '',
      presentacion_nombre:   '',
      cantidad_presentacion: it.quantity_approved || it.quantity_requested || 1,
      precio_unitario:       0,
      descuento_pct:         0,
      notas:                 '',
    }))
  )

  // Determinar ítems a mostrar según origen
  const itemsActuales = origen === 'directa' ? items : itemsSolicitudes

  const tituloPaso = () => {
    if (origen === 'directa') {
      const ts = ['Seleccionar proveedor', 'Configurar OC', 'Agregar materiales', 'Confirmar y crear']
      return ts[paso] || ''
    } else {
      const ts = [
        origen === 'solicitud' ? 'Seleccionar solicitud' : 'Seleccionar solicitudes a consolidar',
        'Seleccionar proveedor',
        'Revisar materiales y precios',
        'Confirmar y crear',
      ]
      return ts[paso] || ''
    }
  }

  return (
    <RequirePermission module="compras" action="create">
      <MainLayout title={`Nueva Orden de Compra — ${
        origen === 'directa'     ? 'OC Directa' :
        origen === 'solicitud'   ? 'Desde solicitud' : 'Solicitudes consolidadas'
      }`}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          <StepBar paso={paso} pasos={pasos} />

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA', borderRadius: 9, marginBottom: 14 }}>
              <AlertTriangle size={15} color="#DC2626" />
              <span style={{ fontSize: 13, color: '#991B1B' }}>{error}</span>
            </div>
          )}

          {/* Contenido del paso */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827',
              margin: '0 0 16px' }}>{tituloPaso()}</h3>

            {/* ORIGEN DIRECTA */}
            {origen === 'directa' && paso === 0 && (
              <PasoProveedor value={proveedor} onChange={setProveedor} />
            )}
            {origen === 'directa' && paso === 1 && (
              <PasoConfigOC form={config} onChange={setConfig}
                proyectos={proyectos} almacenes={almacenes} />
            )}
            {origen === 'directa' && paso === 2 && (
              <PasoItems items={items} onChange={setItems}
                materiales={materiales} proveedor={proveedor} />
            )}
            {origen === 'directa' && paso === 3 && (
              <PasoConfirmar origen={origen} proveedor={proveedor}
                config={config} items={items} solicitudes={[]} />
            )}

            {/* ORIGEN SOLICITUD */}
            {origen === 'solicitud' && paso === 0 && (
              <PasoSolicitudes seleccionadas={solicitudes}
                onChange={setSolicitudes} multiple={false} />
            )}
            {origen === 'solicitud' && paso === 1 && (
              <PasoProveedor value={proveedor} onChange={setProveedor} />
            )}
            {origen === 'solicitud' && paso === 2 && (
              <div>
                <div style={{ padding: '10px 12px', backgroundColor: '#F0FDF4',
                  border: '1px solid #A7F3D0', borderRadius: 8, marginBottom: 14 }}>
                  <p style={{ fontSize: 12, color: '#065F46', margin: 0 }}>
                    ✓ Los ítems fueron importados desde la solicitud aprobada.
                    Puedes ajustar los precios antes de confirmar.
                  </p>
                </div>
                <PasoItems items={itemsSolicitudes}
                  onChange={() => {}} // read-only en este paso
                  materiales={materiales} proveedor={proveedor} />
              </div>
            )}
            {origen === 'solicitud' && paso === 3 && (
              <PasoConfirmar origen={origen} proveedor={proveedor}
                config={config} items={itemsSolicitudes} solicitudes={solicitudes} />
            )}

            {/* ORIGEN CONSOLIDADA */}
            {origen === 'consolidada' && paso === 0 && (
              <PasoSolicitudes seleccionadas={solicitudes}
                onChange={setSolicitudes} multiple={true} />
            )}
            {origen === 'consolidada' && paso === 1 && (
              <PasoProveedor value={proveedor} onChange={setProveedor} />
            )}
            {origen === 'consolidada' && paso === 2 && (
              <div>
                <div style={{ padding: '10px 12px', backgroundColor: '#FFF7ED',
                  border: '1px solid #FED7AA', borderRadius: 8, marginBottom: 14 }}>
                  <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
                    📦 Se consolidaron {solicitudes.length} solicitudes —
                    {itemsSolicitudes.length} ítems en total.
                    Ajusta precios antes de confirmar.
                  </p>
                </div>
                <PasoItems items={itemsSolicitudes}
                  onChange={() => {}}
                  materiales={materiales} proveedor={proveedor} />
              </div>
            )}
            {origen === 'consolidada' && paso === 3 && (
              <PasoConfirmar origen={origen} proveedor={proveedor}
                config={config} items={itemsSolicitudes} solicitudes={solicitudes} />
            )}
          </div>

          {/* Navegación */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={paso === 0 ? () => navigate('/compras/ordenes') : () => { setError(null); setPaso(p => p - 1) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '9px 18px', borderRadius: 9,
                border: '1px solid #E5E7EB', backgroundColor: '#fff',
                color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <ChevronLeft size={15} />
              {paso === 0 ? 'Cancelar' : 'Anterior'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                Paso {paso + 1} de {pasos.length}
              </span>
              {paso < pasos.length - 1 ? (
                <button onClick={handleSiguiente}
                  style={{ display: 'flex', alignItems: 'center', gap: 5,
                    padding: '9px 22px', borderRadius: 9, border: 'none',
                    backgroundColor: '#2563EB', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Siguiente <ChevronRight size={15} />
                </button>
              ) : (
                <button onClick={handleGuardar} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 5,
                    padding: '9px 22px', borderRadius: 9, border: 'none',
                    backgroundColor: saving ? '#6EE7B7' : '#059669',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving
                    ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creando…</>
                    : <><CheckCircle size={14} /> Crear Orden de Compra</>}
                </button>
              )}
            </div>
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </MainLayout>
    </RequirePermission>
  )
}
