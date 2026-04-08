// src/pages/materials/RequestFormV2.jsx
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import * as catalogService from '../../services/materialsCatalog.service'
import * as settingsService from '../../services/companySettings.service'
import * as projectsService from '../../services/projectNodes.service'
import { Plus, Trash2, AlertTriangle, Shield, Info } from 'lucide-react'

const PRIORITY_OPTIONS = [
  { value: 'BAJA',    label: '🟢 Baja'    },
  { value: 'NORMAL',  label: '🔵 Normal'  },
  { value: 'ALTA',    label: '🟡 Alta'    },
  { value: 'URGENTE', label: '🔴 Urgente' },
]

const EMPTY_ITEM = {
  materialId:   '',
  selectedUnit: '',
  quantity:     1,
  unitPrice:    0,
  subtotal:     0,
  unitOptions:  [],
  priceWarning: null,
}

export const RequestFormV2 = ({ onSave, onCancel }) => {
  const { userProfile } = useAuth()
  const loadedRef       = useRef(false)

  const [projects,    setProjects]    = useState([])
  const [materials,   setMaterials]   = useState([])
  const [settings,    setSettings]    = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  const [formData, setFormData] = useState({
    projectId: '', title: '', description: '', priority: 'NORMAL',
  })

  const [items,  setItems]  = useState([{ ...EMPTY_ITEM }])
  const [errors, setErrors] = useState({})

  // ── Cargar datos ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedRef.current || !userProfile) return
    loadedRef.current = true
    const load = async () => {
      setDataLoading(true)
      try {
        const [projRes, matsRes, settRes] = await Promise.all([
          projectsService.getProjects(),
          catalogService.getMaterials(),   // incluye material_unit_conversions
          settingsService.getSettings(),
        ])
        setProjects(projRes.data  || [])
        setMaterials(matsRes.data || [])
        setSettings(settRes.data  || null)
      } catch (err) {
        console.error('[RequestFormV2]', err)
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [userProfile])

  // ── Recalcular precios cuando cambia proyecto ─────────────────────────────
  useEffect(() => {
    if (!formData.projectId || items.every(i => !i.materialId)) return
    const update = async () => {
      const updated = await Promise.all(
        items.map(item => item.materialId ? recalcItem(item, formData.projectId) : item)
      )
      setItems(updated)
    }
    update()
  }, [formData.projectId])

  // ── Calcular precio según unidad elegida ──────────────────────────────────
  const calcUnitPrice = (baseSalePrice, unitObj, quantity) => {
    if (!unitObj || !baseSalePrice) return { price: 0, warning: null }
    if (unitObj.is_primary) return { price: baseSalePrice, warning: null }

    const factor = parseFloat(unitObj.conversion_factor) || 1
    const max    = parseFloat(unitObj.max_quantity)       || 100
    const qty    = parseFloat(quantity)                   || 0
    const price  = baseSalePrice / factor

    return {
      price,
      warning: qty >= max
        ? `Con ${qty} ${unitObj.unit_name} conviene solicitar en unidad principal (límite: ${max}).`
        : null
    }
  }

  const getBaseSalePrice = async (materialId, projectId) => {
    const { data: prices } = await catalogService.getPricesByMaterial(materialId)
    const row = prices?.find(p => p.project_id === projectId) || prices?.find(p => !p.project_id)
    return row ? parseFloat(row.sale_price_obra) : 0
  }

  const recalcItem = async (item, projectId) => {
    try {
      const baseSalePrice = await getBaseSalePrice(item.materialId, projectId)
      const mat       = materials.find(m => m.id === item.materialId)
      const unitOpts  = (mat?.material_unit_conversions || []).sort((a,b) => a.sort_order - b.sort_order)
      const chosenUnit = unitOpts.find(u => u.unit_name === item.selectedUnit)
                      || unitOpts.find(u => u.is_primary)
      const { price, warning } = calcUnitPrice(baseSalePrice, chosenUnit, item.quantity)
      return {
        ...item,
        unitOptions:  unitOpts,
        selectedUnit: chosenUnit?.unit_name || item.selectedUnit,
        unitPrice:    price,
        subtotal:     price * (parseInt(item.quantity) || 0),
        priceWarning: warning,
      }
    } catch { return item }
  }

  // ── Cambio de material ────────────────────────────────────────────────────
  const handleMaterialChange = async (idx, materialId) => {
    if (!materialId) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...EMPTY_ITEM } : it))
      return
    }
    const mat      = materials.find(m => m.id === materialId)
    const unitOpts = (mat?.material_unit_conversions || []).sort((a,b) => a.sort_order - b.sort_order)
    const primary  = unitOpts.find(u => u.is_primary) || unitOpts[0]
    const base     = { ...items[idx], materialId, unitOptions: unitOpts, selectedUnit: primary?.unit_name || '', quantity: 1 }
    const recalced = await recalcItem(base, formData.projectId)
    setItems(prev => prev.map((it, i) => i === idx ? recalced : it))
  }

  // ── Cambio de unidad ──────────────────────────────────────────────────────
  const handleUnitChange = async (idx, unitName) => {
    const item     = { ...items[idx], selectedUnit: unitName }
    const recalced = await recalcItem(item, formData.projectId)
    setItems(prev => prev.map((it, i) => i === idx ? recalced : it))
  }

  // ── Cambio de cantidad ────────────────────────────────────────────────────
  const handleQuantityChange = async (idx, val) => {
    const qty  = val.replace(/[^0-9]/g, '') || '1'
    const item = { ...items[idx], quantity: qty }
    if (item.materialId) {
      const recalced = await recalcItem(item, formData.projectId)
      setItems(prev => prev.map((it, i) => i === idx ? recalced : it))
    } else {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: qty } : it))
    }
  }

  const addItem    = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx) => {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const estimatedTotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0)
  const approvalLevel  = settings
    ? (estimatedTotal <= (parseFloat(settings.approval_limit_jefe_obra) || 2000) ? 'jefe_obra' : 'admin_empresa')
    : null
  const approvalLabel  = approvalLevel === 'jefe_obra'
    ? { text:'👷 Aprueba: Jefe de Obra',  color:'#166534', bg:'#f0fdf4', border:'#bbf7d0' }
    : { text:'🏢 Aprueba: Admin Empresa', color:'#1e40af', bg:'#eff6ff', border:'#bfdbfe' }

  const fmt = (n) => Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })

  const getMaterialLabel = (m) => {
    const code = m.material_code ? `[${m.material_code}] ` : ''
    return `${code}${m.material_type}`
  }

  // ── Validación ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!formData.projectId)    e.projectId = 'Selecciona un proyecto'
    if (!formData.title.trim()) e.title     = 'El título es obligatorio'
    items.forEach((item, i) => {
      if (!item.materialId)                    e[`item_${i}`] = 'Selecciona un material'
      if (!item.quantity || item.quantity < 1) e[`qty_${i}`]  = 'Mínimo 1'
    })
    return e
  }

  const handleSubmit = async (e, sendNow = false) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true)
    await onSave({
      ...formData,
      warehouseId:     null,
      companyId:       userProfile?.company_id,
      estimatedAmount: estimatedTotal,
      approvalLevel,
      sendNow,
      items: items.map(it => ({
        materialId:   it.materialId,
        quantity:     parseInt(it.quantity),
        selectedUnit: it.selectedUnit,
        notes:        '',
        unitPrice:    it.unitPrice,
        subtotal:     it.subtotal,
      }))
    })
    setLoading(false)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (dataLoading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px', gap:'12px' }}>
        <div style={{ width:'32px', height:'32px', border:'3px solid #e5e7eb', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
        <p style={{ fontSize:'13px', color:'#9ca3af', margin:0 }}>Cargando catálogo...</p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => handleSubmit(e, false)}>

      {/* Proyecto + Prioridad */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:'12px', marginBottom:'16px' }}>
        <div>
          <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Proyecto *</label>
          <select className="input-field" value={formData.projectId}
            onChange={e => setFormData(f => ({ ...f, projectId: e.target.value }))}>
            <option value="">Seleccionar proyecto...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.projectId && <p style={{ fontSize:'11px', color:'#dc2626', margin:'4px 0 0' }}>{errors.projectId}</p>}
        </div>
        <div>
          <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Prioridad</label>
          <select className="input-field" value={formData.priority}
            onChange={e => setFormData(f => ({ ...f, priority: e.target.value }))}>
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Título */}
      <div style={{ marginBottom:'16px' }}>
        <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Título *</label>
        <input type="text" className="input-field" placeholder="Ej: Materiales eléctricos Torre A"
          value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} />
        {errors.title && <p style={{ fontSize:'11px', color:'#dc2626', margin:'4px 0 0' }}>{errors.title}</p>}
      </div>

      {/* Justificación */}
      <div style={{ marginBottom:'16px' }}>
        <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>
          Justificación <span style={{ fontWeight:'400', color:'#9ca3af' }}>(opcional)</span>
        </label>
        <textarea rows={2} className="input-field"
          placeholder="Describe brevemente para qué se necesitan los materiales..."
          value={formData.description}
          onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
      </div>

      {/* ── Tabla de materiales ── */}
      <div style={{ marginBottom:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Materiales Solicitados *</label>
          <button type="button" onClick={addItem}
            style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:'500' }}>
            <Plus size={14} /> Agregar
          </button>
        </div>

        {/* Encabezado */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 130px 80px 110px 110px 36px', gap:'8px', padding:'6px 10px', backgroundColor:'#f9fafb', borderRadius:'8px 8px 0 0', border:'1px solid #e5e7eb', borderBottom:'none' }}>
          {['Material','Unidad','Cant.','P. Unitario','Subtotal',''].map(h => (
            <span key={h} style={{ fontSize:'11px', fontWeight:'600', color:'#6b7280', textTransform:'uppercase' }}>{h}</span>
          ))}
        </div>

        {items.map((item, idx) => (
          <div key={idx}>
            <div style={{
              display:'grid', gridTemplateColumns:'2fr 130px 80px 110px 110px 36px',
              gap:'8px', alignItems:'center', padding:'10px',
              backgroundColor:'#fff', border:'1px solid #e5e7eb',
              borderBottom: !item.priceWarning && idx === items.length - 1 ? '1px solid #e5e7eb' : 'none',
              borderRadius: !item.priceWarning && idx === items.length - 1 ? '0 0 8px 8px' : '0'
            }}>

              {/* Material */}
              <div>
                <select value={item.materialId}
                  onChange={e => handleMaterialChange(idx, e.target.value)}
                  style={{ width:'100%', padding:'8px', border:`1px solid ${errors[`item_${idx}`] ? '#fca5a5' : '#e5e7eb'}`, borderRadius:'6px', fontSize:'13px', outline:'none' }}>
                  <option value="">Seleccionar...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{getMaterialLabel(m)}</option>)}
                </select>
                {errors[`item_${idx}`] && <p style={{ fontSize:'11px', color:'#dc2626', margin:'2px 0 0' }}>{errors[`item_${idx}`]}</p>}
              </div>

              {/* Unidad */}
              {item.unitOptions?.length > 1 ? (
                <select value={item.selectedUnit}
                  onChange={e => handleUnitChange(idx, e.target.value)}
                  style={{ padding:'8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', outline:'none', backgroundColor:'#fff', width:'100%' }}>
                  {item.unitOptions.map(u => (
                    <option key={u.unit_name} value={u.unit_name}>
                      {u.is_primary ? '★ ' : ''}{u.unit_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding:'8px', backgroundColor:'#f9fafb', borderRadius:'6px', fontSize:'13px', color:'#6b7280', textAlign:'center' }}>
                  {item.selectedUnit || '—'}
                </div>
              )}

              {/* Cantidad */}
              <input type="number" min="1" step="1"
                value={item.quantity ?? 1}
                onChange={e => handleQuantityChange(idx, e.target.value)}
                style={{ padding:'8px', border:`1px solid ${errors[`qty_${idx}`] ? '#fca5a5' : '#e5e7eb'}`, borderRadius:'6px', fontSize:'13px', outline:'none', width:'100%', boxSizing:'border-box', textAlign:'center' }} />

              {/* Precio unitario */}
              <div style={{ padding:'8px', backgroundColor:'#f9fafb', borderRadius:'6px', fontSize:'13px', color: item.unitPrice > 0 ? '#059669' : '#9ca3af', fontWeight:'600', textAlign:'right' }}>
                {item.unitPrice > 0 ? `$${fmt(item.unitPrice)}` : '—'}
              </div>

              {/* Subtotal */}
              <div style={{ padding:'8px', backgroundColor: item.subtotal > 0 ? '#f0fdf4' : '#f9fafb', borderRadius:'6px', fontSize:'13px', color: item.subtotal > 0 ? '#059669' : '#9ca3af', fontWeight:'700', textAlign:'right' }}>
                {item.subtotal > 0 ? `$${fmt(item.subtotal)}` : '—'}
              </div>

              {/* Eliminar */}
              <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1}
                style={{ padding:'6px', borderRadius:'6px', border:'none', backgroundColor: items.length === 1 ? '#f9fafb' : '#fef2f2', color: items.length === 1 ? '#d1d5db' : '#dc2626', cursor: items.length === 1 ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Trash2 size={14} />
              </button>
            </div>

            {/* Warning límite superado */}
            {item.priceWarning && (
              <div style={{
                display:'flex', alignItems:'center', gap:'6px', padding:'6px 10px',
                backgroundColor:'#fffbeb', border:'1px solid #fde68a',
                borderBottom: idx === items.length - 1 ? '1px solid #fde68a' : 'none',
                borderRadius: idx === items.length - 1 ? '0 0 8px 8px' : '0'
              }}>
                <Info size={13} color="#d97706" />
                <p style={{ fontSize:'11px', color:'#92400e', margin:0 }}>{item.priceWarning}</p>
              </div>
            )}
          </div>
        ))}

        {items.some(i => i.materialId && i.unitPrice === 0) && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 12px', backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', marginTop:'8px' }}>
            <AlertTriangle size={14} color="#d97706" />
            <p style={{ fontSize:'12px', color:'#92400e', margin:0 }}>Algunos materiales no tienen precio configurado para este proyecto.</p>
          </div>
        )}
      </div>

      {/* Monto + Aprobación */}
      <div style={{ backgroundColor:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'16px', marginBottom:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: approvalLevel && estimatedTotal > 0 ? '12px' : '0' }}>
          <span style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Monto Estimado Total</span>
          <span style={{ fontSize:'22px', fontWeight:'800', color: estimatedTotal > 0 ? '#111827' : '#9ca3af' }}>
            {estimatedTotal > 0 ? `$${fmt(estimatedTotal)}` : '—'}
          </span>
        </div>
        {approvalLevel && estimatedTotal > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', backgroundColor: approvalLabel.bg, border:`1px solid ${approvalLabel.border}`, borderRadius:'8px' }}>
            <Shield size={15} color={approvalLabel.color} />
            <p style={{ fontSize:'13px', fontWeight:'600', color: approvalLabel.color, margin:0 }}>{approvalLabel.text}</p>
            {settings && (
              <p style={{ fontSize:'11px', color: approvalLabel.color, margin:'0 0 0 auto', opacity:0.7 }}>
                Límite Jefe de Obra: ${fmt(settings.approval_limit_jefe_obra)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Botones */}
      <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', paddingTop:'16px', borderTop:'1px solid #f3f4f6' }}>
        <button type="button" onClick={onCancel}
          style={{ padding:'10px 20px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'14px', color:'#374151' }}>
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          style={{ padding:'10px 20px', borderRadius:'10px', border:'none', backgroundColor:'#f3f4f6', color:'#374151', cursor:'pointer', fontSize:'14px', fontWeight:'500' }}>
          💾 Guardar Borrador
        </button>
        <button type="button" disabled={loading}
          onClick={() => handleSubmit({ preventDefault: () => {} }, true)}
          style={{ padding:'10px 20px', borderRadius:'10px', border:'none', backgroundColor: loading ? '#93c5fd' : '#2563eb', color:'#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'600' }}>
          {loading ? 'Enviando...' : '📤 Enviar a Aprobación'}
        </button>
      </div>
    </form>
  )
}