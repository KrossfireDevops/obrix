// src/pages/materials/MaterialCatalog.jsx
import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { usePermission } from '../../hooks/usePermission'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import * as service from '../../services/materialsCatalog.service'
import {
  Plus, Search, Edit2, Trash2, Tag, DollarSign,
  History, X, Package, AlertTriangle, CheckCircle, Ruler
} from 'lucide-react'

const UNITS = ['Pieza','Metro','Metro²','Metro³','Kilogramo','Tonelada',
               'Litro','Galón','Rollo','Caja','Bolsa','Juego','Par','Global','Kit','Tramo']

// ── Editor de Unidades de Medida ──────────────────────────────────────────────
const UnitsEditor = ({ units, onChange }) => {
  const addUnit = () => {
    if (units.length >= 3) return
    onChange([...units, { unit_name: '', conversion_factor: 1, max_quantity: 100 }])
  }

  const removeUnit = (idx) => {
    if (idx === 0) return // no borrar unidad principal
    onChange(units.filter((_, i) => i !== idx))
  }

  const setUnit = (idx, key, val) => {
    onChange(units.map((u, i) => i === idx ? { ...u, [key]: val } : u))
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>
          <Ruler size={14} style={{ display:'inline', marginRight:'4px' }} />
          Unidades de Medida
        </label>
        {units.length < 3 && (
          <button type="button" onClick={addUnit}
            style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'12px', color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:'500' }}>
            <Plus size={12} /> Agregar unidad
          </button>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {units.map((unit, idx) => (
          <div key={idx} style={{
            display:'grid',
            gridTemplateColumns: idx === 0 ? '1fr 80px' : '1fr 100px 100px 32px',
            gap:'8px', alignItems:'center',
            padding:'10px 12px',
            backgroundColor: idx === 0 ? '#eff6ff' : '#f9fafb',
            borderRadius:'8px',
            border:`1px solid ${idx === 0 ? '#bfdbfe' : '#e5e7eb'}`
          }}>

            {/* Nombre unidad */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                <span style={{
                  fontSize:'10px', fontWeight:'700', padding:'2px 6px', borderRadius:'4px',
                  backgroundColor: idx === 0 ? '#2563eb' : '#6b7280', color:'#fff'
                }}>
                  {idx === 0 ? 'PRINCIPAL' : `SECUNDARIA ${idx}`}
                </span>
              </div>
              <select
                value={unit.unit_name}
                onChange={e => setUnit(idx, 'unit_name', e.target.value)}
                style={{ width:'100%', padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', outline:'none', backgroundColor:'#fff' }}>
                <option value="">Seleccionar...</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Factor de conversión — solo secundarias */}
            {idx === 0 ? (
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:'10px', color:'#6b7280', margin:'0 0 4px', textTransform:'uppercase', fontWeight:'600' }}>Factor</p>
                <p style={{ fontSize:'13px', fontWeight:'700', color:'#2563eb', margin:0 }}>Base</p>
              </div>
            ) : (
              <>
                <div>
                  <p style={{ fontSize:'10px', color:'#6b7280', margin:'0 0 4px', textTransform:'uppercase', fontWeight:'600' }}>
                    1 {units[0]?.unit_name || 'principal'} =
                  </p>
                  <input type="number" min="0.001" step="0.001"
                    value={unit.conversion_factor}
                    onChange={e => setUnit(idx, 'conversion_factor', e.target.value)}
                    style={{ width:'100%', padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', outline:'none', boxSizing:'border-box', textAlign:'center' }}
                    placeholder="Ej: 100"
                  />
                </div>
                <div>
                  <p style={{ fontSize:'10px', color:'#d97706', margin:'0 0 4px', textTransform:'uppercase', fontWeight:'600' }}>
                    Límite
                  </p>
                  <input type="number" min="1" step="1"
                    value={unit.max_quantity}
                    onChange={e => setUnit(idx, 'max_quantity', e.target.value)}
                    style={{ width:'100%', padding:'6px 8px', border:'1px solid #fde68a', borderRadius:'6px', fontSize:'13px', outline:'none', boxSizing:'border-box', textAlign:'center' }}
                    placeholder="100"
                  />
                </div>
                <button type="button" onClick={() => removeUnit(idx)}
                  style={{ padding:'6px', borderRadius:'6px', border:'none', backgroundColor:'#fef2f2', color:'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {units.length > 1 && (
        <div style={{ marginTop:'8px', padding:'8px 10px', backgroundColor:'#fffbeb', borderRadius:'6px', border:'1px solid #fde68a' }}>
          <p style={{ fontSize:'11px', color:'#92400e', margin:0 }}>
            💡 El precio de la unidad secundaria se calcula como: <strong>Precio principal ÷ factor de conversión</strong>.
            Si la cantidad solicitada supera el límite, el sistema sugerirá usar la unidad principal.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Modal Material ────────────────────────────────────────────────────────────
const MaterialModal = ({ material, onSave, onClose }) => {
  const { userProfile } = useAuth()
  const isEdit = !!material?.id
  const [loading,     setLoading]     = useState(false)
  const [previewCode, setPreviewCode] = useState(material?.material_code || '')
  const [checking,    setChecking]    = useState(false)
  const [duplicate,   setDuplicate]   = useState(false)

  const [form, setForm] = useState({
    material_type: material?.material_type || '',
    category:      material?.category      || '',
    subcategory:   material?.subcategory   || '',
    default_unit:  material?.default_unit  || 'Pieza',
    description:   material?.description   || '',
  })

  // Inicializar unidades desde el material existente o con una unidad principal vacía
  const [units, setUnits] = useState(() => {
    const existing = material?.material_unit_conversions
    if (existing?.length > 0) {
      return [...existing].sort((a, b) => a.sort_order - b.sort_order).map(u => ({
        unit_name:         u.unit_name,
        conversion_factor: u.conversion_factor,
        max_quantity:      u.max_quantity,
      }))
    }
    return [{ unit_name: material?.default_unit || 'Pieza', conversion_factor: 1, max_quantity: 9999 }]
  })

  // Sincronizar unidad principal con default_unit del form
  useEffect(() => {
    if (units[0]?.unit_name !== form.default_unit && form.default_unit) {
      setUnits(prev => prev.map((u, i) => i === 0 ? { ...u, unit_name: form.default_unit } : u))
    }
  }, [form.default_unit])

  // Preview código
  useEffect(() => {
    if (isEdit || !form.subcategory.trim()) return
    const timer = setTimeout(async () => {
      const { data } = await service.generateMaterialCode(form.subcategory)
      if (data) setPreviewCode(data)
    }, 400)
    return () => clearTimeout(timer)
  }, [form.subcategory, isEdit])

  // Verificar duplicado
  useEffect(() => {
    if (!form.material_type.trim() || !form.subcategory.trim()) { setDuplicate(false); return }
    const timer = setTimeout(async () => {
      setChecking(true)
      const { data } = await service.checkDuplicate(
        form.material_type, form.subcategory,
        userProfile?.company_id, material?.id
      )
      setDuplicate(!!data)
      setChecking(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [form.material_type, form.subcategory])

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    // Si cambia unidad por defecto, actualizar también en units[0]
    if (key === 'default_unit') {
      setUnits(prev => prev.map((u, i) => i === 0 ? { ...u, unit_name: val } : u))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (duplicate || !form.material_type.trim() || !form.category.trim() || !form.subcategory.trim()) return
    // Validar que todas las unidades tengan nombre
    if (units.some(u => !u.unit_name)) {
      alert('Todas las unidades deben tener nombre seleccionado')
      return
    }
    setLoading(true)
    await onSave(material?.id, { ...form, units })
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ backgroundColor:'#fff', borderRadius:'16px', width:'100%', maxWidth:'560px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', margin:0 }}>
            {isEdit ? '✏️ Editar Material' : '➕ Nuevo Material'}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'18px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding:'24px' }}>

          {/* Código */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Código de Material</label>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <input type="text" readOnly
                value={isEdit ? (material.material_code || '—') : (previewCode || 'Se generará automáticamente')}
                style={{ flex:1, padding:'10px 12px', borderRadius:'8px', border:'1px solid #e5e7eb', backgroundColor:'#f9fafb', fontSize:'14px', fontWeight:'700', color:'#2563eb', cursor:'not-allowed', fontFamily:'monospace' }}
              />
              <span style={{ fontSize:'11px', color:'#9ca3af', whiteSpace:'nowrap' }}>🔒 Auto</span>
            </div>
          </div>

          {/* Nombre */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Nombre / Descripción *</label>
            <input type="text" required placeholder="Ej: Cable THW 12 AWG"
              value={form.material_type}
              onChange={e => set('material_type', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${duplicate ? '#fca5a5' : '#e5e7eb'}`, borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
            />
            {form.material_type.trim() && form.subcategory.trim() && (
              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'4px' }}>
                {checking ? (
                  <span style={{ fontSize:'11px', color:'#9ca3af' }}>Verificando...</span>
                ) : duplicate ? (
                  <><AlertTriangle size={12} color="#dc2626" /><span style={{ fontSize:'11px', color:'#dc2626' }}>Ya existe en esta subcategoría</span></>
                ) : (
                  <><CheckCircle size={12} color="#16a34a" /><span style={{ fontSize:'11px', color:'#16a34a' }}>Disponible</span></>
                )}
              </div>
            )}
          </div>

          {/* Categoría + Subcategoría */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div>
              <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Categoría *</label>
              <input type="text" required placeholder="Ej: Eléctrico"
                value={form.category}
                onChange={e => set('category', e.target.value)}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Subcategoría *</label>
              <input type="text" required placeholder="Ej: Conductores"
                value={form.subcategory}
                onChange={e => set('subcategory', e.target.value)}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
              />
            </div>
          </div>

          {/* Unidad principal */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Unidad Principal *</label>
            <select value={form.default_unit} onChange={e => set('default_unit', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', backgroundColor:'#fff' }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* ── Sección Unidades de Medida ── */}
          <div style={{ marginBottom:'20px', padding:'16px', backgroundColor:'#f8fafc', borderRadius:'12px', border:'1px solid #e5e7eb' }}>
            <UnitsEditor units={units} onChange={setUnits} />
          </div>

          {/* Notas */}
          <div style={{ marginBottom:'24px' }}>
            <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Notas adicionales</label>
            <textarea rows={2} placeholder="Especificaciones, observaciones..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', resize:'none', outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', paddingTop:'16px', borderTop:'1px solid #f3f4f6' }}>
            <button type="button" onClick={onClose}
              style={{ padding:'10px 20px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'14px' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading || duplicate}
              style={{ padding:'10px 24px', borderRadius:'10px', border:'none', backgroundColor:(loading||duplicate)?'#93c5fd':'#2563eb', color:'#fff', cursor:(loading||duplicate)?'not-allowed':'pointer', fontSize:'14px', fontWeight:'600' }}>
              {loading ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Precios (sin cambios) ───────────────────────────────────────────────
const PriceModal = ({ material, onClose }) => {
  const [prices,   setPrices]   = useState([])
  const [history,  setHistory]  = useState([])
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [tab,      setTab]      = useState('prices')
  const { toast } = useToast()

  const [priceForm, setPriceForm] = useState({
    project_id: '', purchase_price: '', management_cost: '',
    management_cost_pct: '', inflation_factor: '', notes: '',
  })

  useEffect(() => { loadData() }, [material.id])

  const loadData = async () => {
    setLoading(true)
    const [pricesRes, histRes, projRes] = await Promise.all([
      service.getPricesByMaterial(material.id),
      service.getPriceHistory(material.id),
      import('../../services/projectNodes.service').then(m => m.getProjects())
    ])
    setPrices(pricesRes.data  || [])
    setHistory(histRes.data   || [])
    setProjects(projRes.data  || [])
    setLoading(false)
  }

  const pf = (key, val) => setPriceForm(f => ({ ...f, [key]: val }))
  const purchase    = parseFloat(priceForm.purchase_price)      || 0
  const mgmtFixed   = parseFloat(priceForm.management_cost)     || 0
  const mgmtPct     = parseFloat(priceForm.management_cost_pct) / 100 || 0
  const inflation   = parseFloat(priceForm.inflation_factor)    / 100 || 0
  const salePreview = purchase + mgmtFixed + (purchase * mgmtPct) + (purchase * inflation)
  const marginPrev  = purchase > 0 ? (((salePreview - purchase) / purchase) * 100).toFixed(2) : 0
  const fmt = (n) => Number(n||0).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 })

  const handleSavePrice = async () => {
    if (!priceForm.purchase_price) { toast.error('El precio de compra es obligatorio'); return }
    setSaving(true)
    const { error } = await service.savePrice({ ...priceForm, material_id: material.id })
    if (error) toast.error('Error: ' + error.message)
    else { toast.success('✅ Precio guardado'); loadData() }
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ backgroundColor:'#fff', borderRadius:'16px', width:'100%', maxWidth:'680px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ fontSize:'11px', color:'#6b7280', margin:0, fontFamily:'monospace' }}>{material.material_code}</p>
            <h3 style={{ fontSize:'16px', fontWeight:'700', margin:'2px 0 0' }}>💰 Precios — {material.material_type}</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'18px' }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:'4px', padding:'12px 24px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#fafafa' }}>
          {[{ key:'prices', label:'💰 Precios' }, { key:'new', label:'➕ Nuevo' }, { key:'history', label:'📋 Historial' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight: tab===t.key?'600':'400', backgroundColor: tab===t.key?'#fff':'transparent', color: tab===t.key?'#1d4ed8':'#6b7280', boxShadow: tab===t.key?'0 1px 3px rgba(0,0,0,0.1)':'' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'20px 24px' }}>
          {tab === 'prices' && (
            loading ? <div style={{ textAlign:'center', padding:'32px' }}><div style={{ width:'32px', height:'32px', border:'3px solid #e5e7eb', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }} /></div>
            : prices.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>
                <DollarSign size={36} style={{ margin:'0 auto 8px', opacity:0.3 }} />
                <p>Sin precios configurados</p>
                <button onClick={() => setTab('new')} style={{ marginTop:'8px', padding:'8px 16px', borderRadius:'8px', border:'none', backgroundColor:'#eff6ff', color:'#2563eb', cursor:'pointer', fontSize:'13px' }}>
                  + Agregar precio
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {prices.map(p => (
                  <div key={p.id} style={{ border:'1px solid #e5e7eb', borderRadius:'12px', padding:'14px', backgroundColor:'#fafafa' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                      <p style={{ fontSize:'13px', fontWeight:'700', margin:0 }}>{p.project_id ? `📁 ${p.projects?.name}` : '🌐 Precio Base Global'}</p>
                      <span style={{ fontSize:'18px', fontWeight:'800', color:'#059669' }}>${fmt(p.sale_price_obra)}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                      {[
                        { label:'Compra',    value:`$${fmt(p.purchase_price)}` },
                        { label:'Gestión',   value:`$${fmt(p.management_cost)} + ${(p.management_cost_pct*100).toFixed(1)}%` },
                        { label:'Inflación', value:`${(p.inflation_factor*100).toFixed(2)}%` },
                        { label:'Margen',    value:`${(p.margin_pct*100).toFixed(2)}%` },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign:'center', backgroundColor:'#fff', borderRadius:'8px', padding:'8px', border:'1px solid #f3f4f6' }}>
                          <p style={{ fontSize:'10px', color:'#9ca3af', margin:'0 0 3px', textTransform:'uppercase' }}>{item.label}</p>
                          <p style={{ fontSize:'12px', fontWeight:'700', color:'#374151', margin:0 }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'new' && (
            <div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Proyecto</label>
                <select value={priceForm.project_id} onChange={e => pf('project_id', e.target.value)}
                  style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', backgroundColor:'#fff' }}>
                  <option value="">🌐 Precio Base Global</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                {[
                  { key:'purchase_price', label:'Precio de Compra *', placeholder:'0.00' },
                  { key:'management_cost', label:'Costo Gestión $ (fijo)', placeholder:'0.00' },
                  { key:'management_cost_pct', label:'Costo Gestión % (sobre compra)', placeholder:'0.0' },
                  { key:'inflation_factor', label:'Factor Inflacionario %', placeholder:'0.0' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>{f.label}</label>
                    <input type="number" min="0" step="0.01" placeholder={f.placeholder}
                      value={priceForm[f.key]} onChange={e => pf(f.key, e.target.value)}
                      style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
              </div>
              {purchase > 0 && (
                <div style={{ backgroundColor:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
                  <p style={{ fontSize:'12px', fontWeight:'600', color:'#166534', margin:'0 0 8px', textTransform:'uppercase' }}>📊 Precio de Venta a Obra</p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'12px', color:'#374151' }}>${fmt(purchase)} + ${fmt(mgmtFixed)} + {(mgmtPct*100).toFixed(1)}% + {(inflation*100).toFixed(1)}%</span>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:'22px', fontWeight:'800', color:'#15803d', margin:0 }}>${fmt(salePreview)}</p>
                      <p style={{ fontSize:'11px', color:'#16a34a', margin:'2px 0 0' }}>Margen: {marginPrev}%</p>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>Notas</label>
                <input type="text" placeholder="Ej: Precio negociado con proveedor X"
                  value={priceForm.notes} onChange={e => pf('notes', e.target.value)}
                  style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button onClick={handleSavePrice} disabled={saving}
                  style={{ padding:'10px 24px', borderRadius:'10px', border:'none', backgroundColor:saving?'#93c5fd':'#2563eb', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:'14px', fontWeight:'600' }}>
                  {saving ? 'Guardando...' : '💾 Guardar Precio'}
                </button>
              </div>
            </div>
          )}

          {tab === 'history' && (
            history.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>
                <History size={36} style={{ margin:'0 auto 8px', opacity:0.3 }} />
                <p>Sin historial de precios</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {history.map(h => (
                  <div key={h.id} style={{ display:'flex', gap:'12px', padding:'12px', backgroundColor:'#fafafa', borderRadius:'10px', border:'1px solid #f3f4f6' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#9ca3af', marginTop:'5px', flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <div>
                          <p style={{ fontSize:'13px', fontWeight:'600', margin:0 }}>{h.project_id ? h.projects?.name : 'Precio Base'}</p>
                          <p style={{ fontSize:'11px', color:'#9ca3af', margin:'2px 0 0' }}>{new Date(h.changed_at).toLocaleString('es-MX')}</p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontSize:'14px', fontWeight:'700', margin:0 }}>Compra: ${fmt(h.purchase_price)}</p>
                          <p style={{ fontSize:'13px', fontWeight:'700', color:'#059669', margin:'2px 0 0' }}>Venta: ${fmt(h.sale_price_obra)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────
export const MaterialCatalog = () => {
  const [materials,    setMaterials]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [categories,   setCategories]   = useState([])
  const [modalMat,     setModalMat]     = useState(null)
  const [priceModal,   setPriceModal]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { toast } = useToast()
  const { can }   = usePermission()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [matsRes, catsRes] = await Promise.all([service.getMaterials(), service.getCategories()])
    setMaterials(matsRes.data  || [])
    setCategories(catsRes.data || [])
    setLoading(false)
  }

  const loadFiltered = useCallback(async () => {
    setLoading(true)
    const { data } = await service.getMaterials({ search, category: filterCat })
    setMaterials(data || [])
    setLoading(false)
  }, [search, filterCat])

  useEffect(() => {
    const timer = setTimeout(loadFiltered, 350)
    return () => clearTimeout(timer)
  }, [loadFiltered])

  const handleSaveMaterial = async (id, formData) => {
    const { error } = await (id ? service.updateMaterial(id, formData) : service.createMaterial(formData))
    if (error) { toast.error(error.message); return }
    toast.success(id ? '✅ Material actualizado' : '✅ Material creado')
    setModalMat(null)
    loadData()
  }

  const handleDeactivate = async (material) => {
    const { error } = await service.deactivateMaterial(material.id)
    if (error) { toast.error('Error al desactivar'); return }
    toast.success('Material desactivado')
    setDeleteTarget(null)
    loadData()
  }

  return (
    <RequirePermission module="materials" action="view">
      <MainLayout title="📦 Maestro de Materiales">
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p style={{ fontSize:'14px', color:'#6b7280', margin:0 }}>{materials.length} materiales activos</p>
            {can('materials','create') && (
              <button onClick={() => setModalMat({})}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 18px', borderRadius:'10px', border:'none', backgroundColor:'#2563eb', color:'#fff', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
                <Plus size={16} /> Nuevo Material
              </button>
            )}
          </div>

          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'14px' }}>
            <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
              <Search size={15} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} />
              <input type="text" placeholder="Buscar por nombre, código o categoría..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', paddingLeft:'32px', paddingRight:'12px', paddingTop:'8px', paddingBottom:'8px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', outline:'none', backgroundColor:'#fff', minWidth:'160px' }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
          </div>

          <div style={{ backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', overflow:'hidden' }}>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'48px' }}>
                <div style={{ width:'32px', height:'32px', border:'3px solid #e5e7eb', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
              </div>
            ) : materials.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px', color:'#9ca3af' }}>
                <Package size={40} style={{ margin:'0 auto 12px', opacity:0.3 }} />
                <p>No se encontraron materiales</p>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                    {['Código','Material','Categoría','Subcategoría','Unidades','Acciones'].map(h => (
                      <th key={h} style={{ padding:'12px 16px', fontSize:'12px', fontWeight:'600', color:'#6b7280', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat, idx) => {
                    const units = mat.material_unit_conversions || []
                    return (
                      <tr key={mat.id}
                        style={{ borderBottom: idx < materials.length-1 ? '1px solid #f3f4f6' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor='#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ fontSize:'13px', fontWeight:'700', color:'#2563eb', fontFamily:'monospace', backgroundColor:'#eff6ff', padding:'3px 8px', borderRadius:'6px' }}>
                            {mat.material_code || '—'}
                          </span>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <p style={{ fontSize:'14px', fontWeight:'500', color:'#111827', margin:0 }}>{mat.material_type}</p>
                          {mat.description && <p style={{ fontSize:'11px', color:'#9ca3af', margin:'2px 0 0' }}>{mat.description}</p>}
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ fontSize:'12px', color:'#374151', backgroundColor:'#f3f4f6', padding:'3px 8px', borderRadius:'6px' }}>{mat.category}</span>
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:'13px', color:'#6b7280' }}>{mat.subcategory}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                            {units.length > 0 ? units.sort((a,b) => a.sort_order - b.sort_order).map(u => (
                              <span key={u.id} style={{
                                fontSize:'11px', padding:'2px 7px', borderRadius:'9999px', fontWeight:'500',
                                backgroundColor: u.is_primary ? '#eff6ff' : '#f3f4f6',
                                color: u.is_primary ? '#2563eb' : '#6b7280',
                                border: `1px solid ${u.is_primary ? '#bfdbfe' : '#e5e7eb'}`
                              }}>
                                {u.unit_name}{!u.is_primary ? ` (÷${u.conversion_factor})` : ''}
                              </span>
                            )) : (
                              <span style={{ fontSize:'12px', color:'#9ca3af' }}>{mat.default_unit}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button onClick={() => setPriceModal(mat)} title="Precios"
                              style={{ padding:'6px', borderRadius:'8px', border:'none', backgroundColor:'#f0fdf4', color:'#16a34a', cursor:'pointer' }}>
                              <DollarSign size={14} />
                            </button>
                            {can('materials','edit') && (
                              <button onClick={() => setModalMat(mat)} title="Editar"
                                style={{ padding:'6px', borderRadius:'8px', border:'none', backgroundColor:'#eff6ff', color:'#2563eb', cursor:'pointer' }}>
                                <Edit2 size={14} />
                              </button>
                            )}
                            {can('materials','delete') && (
                              <button onClick={() => setDeleteTarget(mat)} title="Desactivar"
                                style={{ padding:'6px', borderRadius:'8px', border:'none', backgroundColor:'#fef2f2', color:'#dc2626', cursor:'pointer' }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </MainLayout>

      {modalMat !== null && (
        <MaterialModal material={modalMat?.id ? modalMat : null} onSave={handleSaveMaterial} onClose={() => setModalMat(null)} />
      )}
      {priceModal && <PriceModal material={priceModal} onClose={() => setPriceModal(null)} />}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
          <div style={{ backgroundColor:'#fff', borderRadius:'16px', padding:'24px', maxWidth:'380px', width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <div style={{ width:'40px', height:'40px', backgroundColor:'#fef2f2', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <div>
                <p style={{ fontSize:'15px', fontWeight:'700', margin:0 }}>Desactivar Material</p>
                <p style={{ fontSize:'13px', color:'#6b7280', margin:'4px 0 0' }}>{deleteTarget.material_code} — {deleteTarget.material_type}</p>
              </div>
            </div>
            <p style={{ fontSize:'13px', color:'#374151', marginBottom:'20px' }}>El material quedará inactivo y no aparecerá en nuevas solicitudes.</p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ padding:'8px 16px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
              <button onClick={() => handleDeactivate(deleteTarget)}
                style={{ padding:'8px 16px', borderRadius:'8px', border:'none', backgroundColor:'#dc2626', color:'#fff', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </RequirePermission>
  )
}