// ============================================================
//  OBRIX ERP — Mis Gastos
//  src/pages/gastos/MisGastosPage.jsx  |  v1.0
//
//  Vista principal del usuario operativo/residente.
//  · Lista de sus gastos con estatus y semáforo
//  · Botón "Nuevo Gasto" → wizard de 3 pasos
//  · Panel de detalle con comprobantes y aprobaciones
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOffline }   from '../../hooks/useOffline'
import SyncStatusBar, { ConflictosPanel } from '../../components/goldenring/SyncStatusBar'
import { MainLayout }  from '../../components/layout/MainLayout'
import { useToast }    from '../../hooks/useToast'
import {
  Plus, Search, RefreshCw, FileText, Upload,
  CheckCircle, XCircle, Clock, ChevronRight,
  X, AlertTriangle, Camera, Link2, Eye,
} from 'lucide-react'
import {
  getMisGastos, crearGasto, enviarGasto, cancelarGasto,
  getMiPerfilGasto, getMisCajasChicas, getMisTarjetas,
  subirComprobante, getUrlComprobante, vincularCFDI,
  buscarCFDIsCoincidentes,
  CATEGORIA_CFG, ESTATUS_CFG, FORMA_PAGO_CFG,
  calcularNivelAprobacionLocal, calcularDeducibilidadLocal,
  fmtMXN,
} from '../../services/gastos.service'
import { supabase } from '../../config/supabase'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const fmtFecha = (f) => {
  if (!f) return '—'
  return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const inp = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// BADGE DE ESTATUS
// ─────────────────────────────────────────────────────────────
const EstatusBadge = ({ estatus }) => {
  const c = ESTATUS_CFG[estatus] ?? ESTATUS_CFG.borrador
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 9999,
      fontSize: 11, fontWeight: 600,
      background: c.color.split(' ')[0].replace('bg-', '').includes('gray')
        ? '#F3F4F6' : undefined,
    }} className={c.color}>
      <span style={{ width: 6, height: 6, borderRadius: '50%',
        backgroundColor: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// WIZARD: NUEVO GASTO (3 pasos)
// ─────────────────────────────────────────────────────────────
const WizardNuevoGasto = ({ perfil, cajas, tarjetas, projects, onSuccess, onClose, toast }) => {
  const {
    isOnline,
    registrarGastoOffline,
  } = useOffline()
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState({
    // Paso 1: Tipo y clasificación
    tipo_id: '', categoria: '', concepto: '', fecha_gasto: new Date().toISOString().split('T')[0],
    // Paso 2: Monto y pago
    monto_total: '', monto_iva: '', forma_pago: '', caja_chica_id: '', tarjeta_id: '',
    project_id: '', centro_costo: '',
    // Paso 3: Comprobante
    tiene_factura: false, cfdi_uuid: '', rfc_proveedor: '', nombre_proveedor: '', notas: '',
  })
  const [archivos,      setArchivos]      = useState([])
  const [cfdisSugeridos, setCfdisSugeridos] = useState([])
  const [saving,        setSaving]        = useState(false)
  const [gastoCreado,   setGastoCreado]   = useState(null)
  const [error,         setError]         = useState(null)
  const fileRef = useRef()

  // Tipos disponibles para este perfil
  const tiposDisponibles = perfil?.gastos_perfiles_tipos ?? []
  const tipoSeleccionado = tiposDisponibles.find(t => t.tipo_id === form.tipo_id)
  const limite = tipoSeleccionado

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Al cambiar monto, buscar CFDIs coincidentes
  useEffect(() => {
    if (form.monto_total >= 500) {
      buscarCFDIsCoincidentes(parseFloat(form.monto_total))
        .then(setCfdisSugeridos)
        .catch(() => {})
    }
  }, [form.monto_total])

  const nivelRequerido  = calcularNivelAprobacionLocal(form.monto_total || 0)
  const deducibilidad   = calcularDeducibilidadLocal(form)
  const requiereFactura = parseFloat(form.monto_total || 0) >= (tipoSeleccionado?.tipo?.requiere_factura_desde ?? 1000)

  // Validar cada paso
  const validarPaso1 = () => {
    if (!form.tipo_id)     return 'Selecciona el tipo de gasto'
    if (!form.concepto)    return 'Escribe el concepto del gasto'
    if (!form.fecha_gasto) return 'Selecciona la fecha'
    return null
  }
  const validarPaso2 = () => {
    if (!form.monto_total || parseFloat(form.monto_total) <= 0) return 'El monto debe ser mayor a $0'
    if (!form.forma_pago)  return 'Selecciona la forma de pago'
    if (form.forma_pago === 'caja_chica'          && !form.caja_chica_id) return 'Selecciona la caja chica'
    if (form.forma_pago === 'tarjeta_corporativa' && !form.tarjeta_id)    return 'Selecciona la tarjeta'
    if (tipoSeleccionado?.tipo?.requiere_proyecto && !form.project_id) return 'Este tipo de gasto requiere un proyecto'
    if (limite?.monto_max_por_gasto && parseFloat(form.monto_total) > limite.monto_max_por_gasto)
      return `El monto excede el límite de ${fmtMXN(limite.monto_max_por_gasto)} para este tipo de gasto`
    return null
  }
  const validarPaso3 = () => {
    if (requiereFactura && !form.tiene_factura && archivos.length === 0)
      return `Los gastos de ${fmtMXN(tipoSeleccionado?.tipo?.requiere_factura_desde)} o más requieren factura`
    return null
  }

  const avanzar = () => {
    const err = paso === 1 ? validarPaso1() : paso === 2 ? validarPaso2() : null
    if (err) { setError(err); return }
    setError(null)
    setPaso(p => p + 1)
  }

  const handleGuardar = async (enviar = false) => {
    const err = validarPaso3()
    if (err) { setError(err); return }
    setSaving(true); setError(null)
    try {
      if (!isOnline) {
        // ── MODO OFFLINE ─────────────────────────────────────
        // Convertir imagen a base64 para guardar localmente
        let imagenBase64 = null, imagenNombre = null
        if (archivos.length > 0) {
          const reader = new FileReader()
          imagenBase64 = await new Promise(res => {
            reader.onload = e => res(e.target.result)
            reader.readAsDataURL(archivos[0].file)
          })
          imagenNombre = archivos[0].file.name
        }
        await registrarGastoOffline(
          {
            ...form,
            tiene_factura: form.tiene_factura || !!form.cfdi_uuid,
          },
          imagenBase64,
          imagenNombre
        )
        toast.success('📱 Gasto guardado — se sincronizará al reconectar')
        onSuccess(); onClose()
        return
      }

      // ── MODO ONLINE (flujo normal) ────────────────────────
      const gasto = await crearGasto({
        ...form,
        tiene_factura: form.tiene_factura || (form.cfdi_uuid ? true : false),
      })

      // Subir archivos
      for (const arch of archivos) {
        await subirComprobante(gasto.id, arch.file, arch.esFactura)
      }

      // Vincular CFDI si se seleccionó
      if (form.cfdi_uuid) {
        await vincularCFDI(gasto.id, form.cfdi_uuid)
      }

      if (enviar) {
        await enviarGasto(gasto.id)
        toast.success('Gasto enviado para aprobación ✓')
      } else {
        toast.success('Gasto guardado como borrador ✓')
      }

      onSuccess()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const pasos = ['Tipo y concepto', 'Monto y pago', 'Comprobante']

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%',
        maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nuevo Gasto</h3>
            <button onClick={onClose} style={{ border: 'none', background: 'none',
              cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
          {/* Indicador de pasos */}
          <div style={{ display: 'flex', gap: 0 }}>
            {pasos.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', fontSize: 11,
                    fontWeight: 700, display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: paso > i+1 ? '#10B981' : paso === i+1 ? '#2563EB' : '#E5E7EB',
                    color: paso >= i+1 ? '#fff' : '#9CA3AF',
                  }}>
                    {paso > i+1 ? '✓' : i+1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: paso === i+1 ? 600 : 400,
                    color: paso === i+1 ? '#111827' : '#9CA3AF' }}>{p}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB', margin: '0 8px' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Cuerpo del formulario */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
              color: '#991B1B', fontSize: 12, marginBottom: 16 }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* ── PASO 1: Tipo y concepto ── */}
          {paso === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tipo de gasto *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {tiposDisponibles.map(pt => {
                    const cat = CATEGORIA_CFG[pt.tipo?.categoria] ?? CATEGORIA_CFG.gastos_generales
                    return (
                      <button key={pt.tipo_id} type="button"
                        onClick={() => { set('tipo_id', pt.tipo_id); set('categoria', pt.tipo?.categoria) }}
                        style={{
                          padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                          cursor: 'pointer', transition: 'all 0.15s',
                          border: `2px solid ${form.tipo_id === pt.tipo_id ? '#2563EB' : '#E5E7EB'}`,
                          backgroundColor: form.tipo_id === pt.tipo_id ? '#EFF6FF' : '#fff',
                        }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{pt.tipo?.icono}</div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                          {pt.tipo?.nombre}
                        </p>
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                          {cat.label}
                          {pt.monto_max_por_gasto ? ` · máx ${fmtMXN(pt.monto_max_por_gasto)}` : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                  Concepto *
                </label>
                <input type="text" style={inp} value={form.concepto}
                  placeholder="Describe brevemente el gasto..."
                  onChange={e => set('concepto', e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                  Fecha del gasto *
                </label>
                <input type="date" style={{ ...inp, width: 'auto' }} value={form.fecha_gasto}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => set('fecha_gasto', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── PASO 2: Monto y pago ── */}
          {paso === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Monto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                    Monto total (MXN) *
                  </label>
                  <input type="number" min="1" step="0.01" style={inp}
                    value={form.monto_total} placeholder="0.00"
                    onChange={e => set('monto_total', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                    IVA incluido
                  </label>
                  <input type="number" min="0" step="0.01" style={inp}
                    value={form.monto_iva} placeholder="0.00"
                    onChange={e => set('monto_iva', e.target.value)} />
                </div>
              </div>

              {/* Indicadores automáticos */}
              {form.monto_total > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px',
                    borderRadius: 6, backgroundColor: nivelRequerido === 0 ? '#D1FAE5' : '#FEF9C3',
                    color: nivelRequerido === 0 ? '#065F46' : '#B45309' }}>
                    {nivelRequerido === 0 ? '⚡ Aprobación automática'
                      : `📋 Requiere aprobación nivel ${nivelRequerido}`}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px',
                    borderRadius: 6, backgroundColor: deducibilidad === 'deducible' ? '#D1FAE5' : '#FEE2E2',
                    color: deducibilidad === 'deducible' ? '#065F46' : '#991B1B' }}>
                    {deducibilidad === 'deducible' ? '✓ Deducible' : '⚠️ No deducible sin factura'}
                  </span>
                  {requiereFactura && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px',
                      borderRadius: 6, backgroundColor: '#FEF9C3', color: '#B45309' }}>
                      📄 Factura obligatoria
                    </span>
                  )}
                </div>
              )}

              {/* Forma de pago */}
              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                  Forma de pago *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(FORMA_PAGO_CFG).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => set('forma_pago', k)}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                        cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        border: `2px solid ${form.forma_pago === k ? '#2563EB' : '#E5E7EB'}`,
                        backgroundColor: form.forma_pago === k ? '#EFF6FF' : '#fff',
                        color: form.forma_pago === k ? '#1E40AF' : '#374151',
                      }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>{v.emoji}</div>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de caja chica */}
              {form.forma_pago === 'caja_chica' && (
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                    Caja chica *
                  </label>
                  <select style={inp} value={form.caja_chica_id}
                    onChange={e => set('caja_chica_id', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {cajas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} · Disponible: {fmtMXN(c.monto_disponible)}
                      </option>
                    ))}
                  </select>
                  {form.caja_chica_id && cajas.find(c => c.id === form.caja_chica_id) && (
                    (() => {
                      const caja = cajas.find(c => c.id === form.caja_chica_id)
                      const insuficiente = parseFloat(form.monto_total || 0) > caja.monto_disponible
                      return insuficiente ? (
                        <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                          ⚠️ Saldo insuficiente en caja chica ({fmtMXN(caja.monto_disponible)} disponible)
                        </p>
                      ) : null
                    })()
                  )}
                </div>
              )}

              {/* Selector de tarjeta */}
              {form.forma_pago === 'tarjeta_corporativa' && (
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                    Tarjeta corporativa *
                  </label>
                  <select style={inp} value={form.tarjeta_id}
                    onChange={e => set('tarjeta_id', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {tarjetas.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.alias} · *{t.ultimos_4}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Proyecto (si aplica) */}
              {tipoSeleccionado?.tipo?.requiere_proyecto && (
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                    Proyecto *
                  </label>
                  <select style={inp} value={form.project_id}
                    onChange={e => set('project_id', e.target.value)}>
                    <option value="">— Seleccionar proyecto —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `[${p.code}] ` : ''}{p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 3: Comprobante ── */}
          {paso === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* CFDIs sugeridos del Buzón */}
              {cfdisSugeridos.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                    textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    CFDIs coincidentes en el Buzón Fiscal
                  </p>
                  {cfdisSugeridos.map(cfdi => (
                    <div key={cfdi.uuid}
                      onClick={() => {
                        set('cfdi_uuid', cfdi.uuid)
                        set('rfc_proveedor', cfdi.rfc_emisor)
                        set('nombre_proveedor', cfdi.nombre_emisor)
                        set('tiene_factura', true)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', marginBottom: 5, borderRadius: 9,
                        cursor: 'pointer',
                        border: `1.5px solid ${form.cfdi_uuid === cfdi.uuid ? '#2563EB' : '#E5E7EB'}`,
                        backgroundColor: form.cfdi_uuid === cfdi.uuid ? '#EFF6FF' : '#F9FAFB',
                      }}>
                      <Link2 size={14} color={form.cfdi_uuid === cfdi.uuid ? '#2563EB' : '#9CA3AF'} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>
                          {cfdi.nombre_emisor}
                        </p>
                        <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
                          {cfdi.rfc_emisor} · {fmtFecha(cfdi.fecha)}
                        </p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                        {fmtMXN(cfdi.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Subir archivo */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                  {requiereFactura ? 'Factura CFDI *' : 'Comprobante (opcional)'}
                </p>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 8, padding: 20,
                    border: '2px dashed', borderRadius: 12, cursor: 'pointer',
                    borderColor: archivos.length > 0 ? '#6EE7B7' : '#D1D5DB',
                    backgroundColor: archivos.length > 0 ? '#F0FDF4' : '#F9FAFB',
                  }}>
                  {archivos.length > 0 ? (
                    <>
                      <CheckCircle size={20} color="#10B981" />
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#065F46', margin: 0 }}>
                        {archivos.length} archivo{archivos.length !== 1 ? 's' : ''} adjunto{archivos.length !== 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <Camera size={20} color="#9CA3AF" />
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        Toca para subir foto o PDF del comprobante
                      </p>
                      <p style={{ fontSize: 10, color: '#D1D5DB', margin: 0 }}>
                        JPG, PNG, PDF · máx. 10 MB
                      </p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" multiple
                  accept="image/jpeg,image/png,application/pdf,image/heic"
                  className="hidden" style={{ display: 'none' }}
                  onChange={e => {
                    const nuevos = Array.from(e.target.files).map(f => ({
                      file: f, esFactura: f.name.endsWith('.pdf'),
                    }))
                    setArchivos(prev => [...prev, ...nuevos])
                  }} />
              </div>

              {/* Lista de archivos */}
              {archivos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {archivos.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', backgroundColor: '#F9FAFB',
                      border: '1px solid #E5E7EB', borderRadius: 8 }}>
                      <FileText size={13} color="#6B7280" />
                      <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{a.file.name}</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: '#6B7280', cursor: 'pointer' }}>
                        <input type="checkbox" checked={a.esFactura}
                          onChange={e => setArchivos(prev => prev.map((x, j) =>
                            j === i ? { ...x, esFactura: e.target.checked } : x
                          ))}
                          style={{ accentColor: '#2563EB' }} />
                        Es factura
                      </label>
                      <button onClick={() => setArchivos(prev => prev.filter((_, j) => j !== i))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer',
                          color: '#EF4444', padding: 3 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* RFC/Proveedor manual */}
              {!form.cfdi_uuid && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                      RFC Proveedor
                    </label>
                    <input type="text" style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }}
                      placeholder="XAXX010101000"
                      value={form.rfc_proveedor}
                      onChange={e => set('rfc_proveedor', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                      Nombre del proveedor
                    </label>
                    <input type="text" style={inp} value={form.nombre_proveedor}
                      placeholder="Razón social o nombre comercial"
                      onChange={e => set('nombre_proveedor', e.target.value)} />
                  </div>
                </div>
              )}

              {/* CFDI vinculado */}
              {form.cfdi_uuid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9 }}>
                  <Link2 size={13} color="#2563EB" />
                  <span style={{ fontSize: 12, color: '#1E40AF', fontWeight: 600 }}>
                    CFDI vinculado: {form.nombre_proveedor}
                  </span>
                  <button onClick={() => { set('cfdi_uuid', ''); set('rfc_proveedor', ''); set('nombre_proveedor', '') }}
                    style={{ marginLeft: 'auto', border: 'none', background: 'none',
                      cursor: 'pointer', color: '#9CA3AF', padding: 3 }}>
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Notas */}
              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                  Notas adicionales (opcional)
                </label>
                <textarea rows={2} style={{ ...inp, resize: 'none' }}
                  placeholder="Detalles adicionales sobre este gasto..."
                  value={form.notas}
                  onChange={e => set('notas', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button onClick={paso > 1 ? () => setPaso(p => p-1) : onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB',
              backgroundColor: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            {paso > 1 ? 'Atrás' : 'Cancelar'}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {paso === 3 && (
              <button onClick={() => handleGuardar(false)} disabled={saving}
                style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB', color: '#374151', fontSize: 12,
                  cursor: 'pointer' }}>
                Guardar borrador
              </button>
            )}
            <button
              onClick={paso < 3 ? avanzar : () => handleGuardar(true)}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 9, border: 'none',
                backgroundColor: saving ? '#93C5FD' : '#2563EB',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {paso < 3 ? 'Siguiente' : 'Enviar gasto'}
              {paso < 3 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function MisGastosPage() {
  const { toast }                       = useToast()

  const {
    isOnline,
    syncStatus,
    pendientes:  syncPendientes,
    conflictos:  syncConflictos,
    syncManual,
    getGastosCfgCache,
  } = useOffline()

  const [showConflictos, setShowConflictos] = useState(false)
  const [gastos,      setGastos]        = useState([])
  const [perfil,      setPerfil]        = useState(null)
  const [cajas,       setCajas]         = useState([])
  const [tarjetas,    setTarjetas]      = useState([])
  const [projects,    setProjects]      = useState([])
  const [loading,     setLoading]       = useState(true)
  const [showWizard,  setShowWizard]    = useState(false)
  const [filtroEstatus, setFiltroEstatus] = useState('')
  const [search,      setSearch]        = useState('')
  const [gastoActivo, setGastoActivo]   = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [g, p, c, t] = await Promise.all([
        getMisGastos({ estatus: filtroEstatus || undefined }),
        getMiPerfilGasto(),
        getMisCajasChicas(),
        getMisTarjetas(),
      ])
      setGastos(g); setPerfil(p); setCajas(c); setTarjetas(t)
    } catch (e) {
      toast.error('Error al cargar gastos')
    } finally {
      setLoading(false)
    }
  }, [filtroEstatus])

  useEffect(() => { cargar() }, [cargar])

  // Caché offline: si no hay conexión, usar perfil guardado
  useEffect(() => {
    if (!isOnline) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) getGastosCfgCache(user.id).then(cached => {
          if (cached && !perfil) setPerfil(cached)
        })
      })
    }
  }, [isOnline])

  useEffect(() => {
    supabase.from('projects').select('id, code, name').eq('status', 'active').order('code')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  const gastosFiltrados = gastos.filter(g => {
    if (!search) return true
    const q = search.toLowerCase()
    return g.concepto?.toLowerCase().includes(q)
        || g.tipo?.nombre?.toLowerCase().includes(q)
        || g.folio?.toLowerCase().includes(q)
  })

  const totalPendiente = gastos.filter(g => g.estatus === 'pendiente').reduce((s, g) => s + parseFloat(g.monto_total), 0)
  const totalBorrador  = gastos.filter(g => g.estatus === 'borrador').length

  return (
    <MainLayout title="💸 Mis Gastos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── GoldenRing: Estado de sincronización ── */}
        <SyncStatusBar
          isOnline={isOnline}
          syncStatus={syncStatus}
          pendientes={syncPendientes}
          conflictos={syncConflictos}
          onSync={syncManual}
          onVerConflictos={() => setShowConflictos(true)}
        />

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Total gastos', value: gastos.length, color: '#1E40AF', bg: '#EFF6FF' },
            { label: 'En revisión',  value: gastos.filter(g => g.estatus === 'pendiente').length, color: '#B45309', bg: '#FFFBEB' },
            { label: 'Monto pendiente', value: fmtMXN(totalPendiente), color: '#B45309', bg: '#FFFBEB', small: true },
            { label: 'Borradores',   value: totalBorrador, color: '#6B7280', bg: '#F9FAFB' },
          ].map(k => (
            <div key={k.label} style={{ padding: '12px 14px', backgroundColor: k.bg,
              borderRadius: 12, border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 10, color: k.color, fontWeight: 600, margin: '0 0 3px', opacity: 0.8 }}>
                {k.label}
              </p>
              <p style={{ fontSize: k.small ? 14 : 22, fontWeight: 700, color: k.color, margin: 0 }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input type="text" placeholder="Buscar por concepto o folio..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inp, paddingLeft: 32 }} />
          </div>
          <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}
            style={{ ...inp, width: 'auto' }}>
            <option value="">Todos los estatus</option>
            {Object.entries(ESTATUS_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowWizard(true)}
            disabled={!perfil}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              backgroundColor: !perfil ? '#E5E7EB' : '#2563EB',
              color: !perfil ? '#9CA3AF' : '#fff',
              fontSize: 13, fontWeight: 600, cursor: !perfil ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap' }}>
            <Plus size={15} /> Nuevo Gasto
          </button>
        </div>

        {!perfil && !loading && (
          <div style={{ padding: '12px 16px', backgroundColor: '#FEF9C3',
            border: '1px solid #FDE68A', borderRadius: 10, fontSize: 12, color: '#B45309' }}>
            ⚠️ Tu usuario no tiene un perfil de gasto asignado. Contacta al administrador para poder registrar gastos.
          </div>
        )}

        {/* ── Lista de gastos ── */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 14, overflow: 'hidden' }}>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 40, gap: 10, color: '#9CA3AF' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Cargando…</span>
            </div>
          ) : gastosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
              <FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                Sin gastos registrados
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>Haz clic en "Nuevo Gasto" para empezar</p>
            </div>
          ) : (
            gastosFiltrados.map((g, i) => {
              const cat = CATEGORIA_CFG[g.categoria] ?? CATEGORIA_CFG.gastos_generales
              return (
                <div key={g.id}
                  onClick={() => setGastoActivo(gastoActivo?.id === g.id ? null : g)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', cursor: 'pointer',
                    borderBottom: i < gastosFiltrados.length - 1 ? '1px solid #F3F4F6' : 'none',
                    borderLeft: `3px solid ${cat.border}`,
                    backgroundColor: gastoActivo?.id === g.id ? '#F8FAFF' : '#fff',
                  }}
                  onMouseEnter={e => { if (gastoActivo?.id !== g.id) e.currentTarget.style.backgroundColor = '#F9FAFB' }}
                  onMouseLeave={e => { if (gastoActivo?.id !== g.id) e.currentTarget.style.backgroundColor = '#fff' }}>

                  {/* Emoji tipo */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18,
                    backgroundColor: cat.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0 }}>
                    {g.tipo?.emoji}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {g.concepto}
                      </span>
                      {g.folio && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF',
                          backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>
                          {g.folio}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        {g.tipo?.nombre} · {fmtFecha(g.fecha_gasto)}
                      </span>
                      {g.proyecto && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace',
                          color: '#6366F1', fontWeight: 600 }}>
                          [{g.proyecto.code}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                      {fmtMXN(g.monto_total)}
                    </span>
                    <EstatusBadge estatus={g.estatus} />
                  </div>

                  <ChevronRight size={14} color="#D1D5DB" style={{ flexShrink: 0 }} />
                </div>
              )
            })
          )}
        </div>

        {/* ── Panel de detalle inline ── */}
        {gastoActivo && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                {gastoActivo.concepto}
              </h4>
              <div style={{ display: 'flex', gap: 8 }}>
                {gastoActivo.estatus === 'borrador' && (
                  <button onClick={async () => {
                    try {
                      await enviarGasto(gastoActivo.id)
                      toast.success('Gasto enviado ✓')
                      setGastoActivo(null); cargar()
                    } catch (e) { toast.error(e.message) }
                  }}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none',
                    backgroundColor: '#2563EB', color: '#fff', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer' }}>
                    Enviar para aprobación
                  </button>
                )}
                {['borrador','rechazado'].includes(gastoActivo.estatus) && (
                  <button onClick={async () => {
                    if (!confirm('¿Cancelar este gasto?')) return
                    try {
                      await cancelarGasto(gastoActivo.id)
                      toast.success('Gasto cancelado')
                      setGastoActivo(null); cargar()
                    } catch (e) { toast.error(e.message) }
                  }}
                  style={{ padding: '6px 14px', borderRadius: 8,
                    border: '1px solid #FECACA', backgroundColor: '#FEF2F2',
                    color: '#DC2626', fontSize: 12, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Monto',     value: fmtMXN(gastoActivo.monto_total) },
                { label: 'Fecha',     value: fmtFecha(gastoActivo.fecha_gasto) },
                { label: 'Forma pago',value: FORMA_PAGO_CFG[gastoActivo.forma_pago]?.label ?? '—' },
                { label: 'Proyecto',  value: gastoActivo.proyecto?.name ?? 'Sin proyecto' },
              ].map(f => (
                <div key={f.label} style={{ padding: '8px 10px', backgroundColor: '#F9FAFB',
                  borderRadius: 8, border: '1px solid #F3F4F6' }}>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</p>
                  <p style={{ fontSize: 12, color: '#111827', margin: 0, fontWeight: 500 }}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Historial de aprobaciones */}
            {gastoActivo.aprobaciones?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, margin: '0 0 6px',
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Historial de aprobación
                </p>
                {gastoActivo.aprobaciones.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 0', borderBottom: i < gastoActivo.aprobaciones.length-1
                      ? '1px solid #F3F4F6' : 'none' }}>
                    {a.estatus === 'aprobado'
                      ? <CheckCircle size={13} color="#10B981" />
                      : a.estatus === 'rechazado'
                      ? <XCircle size={13} color="#EF4444" />
                      : <Clock size={13} color="#F59E0B" />}
                    <span style={{ fontSize: 11, color: '#374151' }}>
                      Nivel {a.nivel} · {a.estatus}
                    </span>
                    {a.comentario && (
                      <span style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
                        "{a.comentario}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wizard de nuevo gasto */}
      {/* Panel de conflictos GoldenRing */}
      {showConflictos && (
        <ConflictosPanel
          conflictos={syncConflictos}
          onResolver={async (id) => {
            const { marcarConflictoResuelto } = await import('../../services/goldenring.db')
            await marcarConflictoResuelto(id)
          }}
          onCerrar={() => setShowConflictos(false)}
        />
      )}

      {showWizard && perfil && (
        <WizardNuevoGasto
          perfil={perfil}
          cajas={cajas}
          tarjetas={tarjetas}
          projects={projects}
          onSuccess={cargar}
          onClose={() => setShowWizard(false)}
          toast={toast}
        />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}