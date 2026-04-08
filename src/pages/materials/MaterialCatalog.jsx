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
  History, ChevronDown, ChevronUp, X, Package,
  AlertTriangle, CheckCircle
} from 'lucide-react'

// ── Unidades disponibles ──────────────────────────────────────────────────────
const UNITS = ['Pieza','Metro','Metro²','Metro³','Kilogramo','Tonelada',
               'Litro','Galón','Rollo','Caja','Bolsa','Juego','Par','Global']

// ── Modal Material ────────────────────────────────────────────────────────────
const MaterialModal = ({ material, onSave, onClose }) => {
  const { userProfile } = useAuth()
  const isEdit = !!material?.id
  const [loading,    setLoading]    = useState(false)
  const [previewCode, setPreviewCode] = useState(material?.material_code || '')
  const [checking,   setChecking]   = useState(false)
  const [duplicate,  setDuplicate]  = useState(false)

  const [form, setForm] = useState({
    material_type: material?.material_type || '',
    category:      material?.category      || '',
    subcategory:   material?.subcategory   || '',
    default_unit:  material?.default_unit  || 'Pieza',
    description:   material?.description   || '',
  })

  // Preview de código al cambiar subcategoría (solo en creación)
  useEffect(() => {
    if (isEdit || !form.subcategory.trim()) return
    const timer = setTimeout(async () => {
      const { data } = await service.generateMaterialCode(form.subcategory)
      if (data) setPreviewCode(data)
    }, 400)
    return () => clearTimeout(timer)
  }, [form.subcategory, isEdit])

  // Verificar duplicado al cambiar nombre o subcategoría
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (duplicate) { return }
    if (!form.material_type.trim()) return
    if (!form.category.trim())      return
    if (!form.subcategory.trim())   return

    setLoading(true)
    await onSave(material?.id, form)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'16px' }}>
      <div style={{ backgroundColor:'#fff',borderRadius:'16px',width:'100%',maxWidth:'520px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <h3 style={{ fontSize:'16px',fontWeight:'700',margin:0 }}>
            {isEdit ? '✏️ Editar Material' : '➕ Nuevo Material'}
          </h3>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:'18px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding:'24px' }}>

          {/* Código (solo lectura) */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>
              Código de Material
            </label>
            <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
              <input
                type="text"
                readOnly
                value={isEdit ? material.material_code : (previewCode || 'Se generará automáticamente')}
                style={{
                  flex:1, padding:'10px 12px', borderRadius:'8px',
                  border:'1px solid #e5e7eb', backgroundColor:'#f9fafb',
                  fontSize:'14px', fontWeight:'700', color:'#2563eb',
                  cursor:'not-allowed', fontFamily:'monospace'
                }}
              />
              <span style={{ fontSize:'11px',color:'#9ca3af',whiteSpace:'nowrap' }}>
                🔒 Auto
              </span>
            </div>
          </div>

          {/* Nombre del material */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>
              Nombre / Descripción *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Tubo PVC 4 pulgadas"
              value={form.material_type}
              onChange={(e) => set('material_type', e.target.value)}
              style={{ width:'100%',padding:'10px 12px',border:`1px solid ${duplicate ? '#fca5a5' : '#e5e7eb'}`,borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }}
            />
            {/* Indicador de duplicado */}
            {form.material_type.trim() && form.subcategory.trim() && (
              <div style={{ display:'flex',alignItems:'center',gap:'4px',marginTop:'4px' }}>
                {checking ? (
                  <span style={{ fontSize:'11px',color:'#9ca3af' }}>Verificando...</span>
                ) : duplicate ? (
                  <>
                    <AlertTriangle size={12} color="#dc2626" />
                    <span style={{ fontSize:'11px',color:'#dc2626' }}>
                      Ya existe este material en la subcategoría seleccionada
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={12} color="#16a34a" />
                    <span style={{ fontSize:'11px',color:'#16a34a' }}>Disponible</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Categoría + Subcategoría */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px' }}>
            <div>
              <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>
                Categoría *
              </label>
              <input
                type="text" required
                placeholder="Ej: Plomería"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>
                Subcategoría *
              </label>
              <input
                type="text" required
                placeholder="Ej: Tubería"
                value={form.subcategory}
                onChange={(e) => set('subcategory', e.target.value)}
                style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }}
              />
            </div>
          </div>

          {/* Unidad */}
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>
              Unidad de Medida *
            </label>
            <select
              value={form.default_unit}
              onChange={(e) => set('default_unit', e.target.value)}
              style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',backgroundColor:'#fff' }}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Descripción */}
          <div style={{ marginBottom:'24px' }}>
            <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>
              Notas adicionales
            </label>
            <textarea
              rows={2}
              placeholder="Especificaciones, observaciones..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',resize:'none',outline:'none',boxSizing:'border-box' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display:'flex',gap:'12px',justifyContent:'flex-end',paddingTop:'16px',borderTop:'1px solid #f3f4f6' }}>
            <button type="button" onClick={onClose}
              style={{ padding:'10px 20px',borderRadius:'10px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'14px' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading || duplicate}
              style={{ padding:'10px 24px',borderRadius:'10px',border:'none',backgroundColor: (loading||duplicate) ? '#93c5fd':'#2563eb',color:'#fff',cursor:(loading||duplicate)?'not-allowed':'pointer',fontSize:'14px',fontWeight:'600' }}>
              {loading ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Precios ─────────────────────────────────────────────────────────────
const PriceModal = ({ material, onClose }) => {
  const [prices,   setPrices]   = useState([])
  const [history,  setHistory]  = useState([])
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [tab,      setTab]      = useState('prices')
  const { toast } = useToast()

  const [priceForm, setPriceForm] = useState({
    project_id:          '',
    purchase_price:      '',
    management_cost:     '',
    management_cost_pct: '',
    inflation_factor:    '',
    notes:               '',
  })

  useEffect(() => { loadData() }, [material.id])

  const loadData = async () => {
    setLoading(true)
    const [pricesRes, histRes, projRes] = await Promise.all([
      service.getPricesByMaterial(material.id),
      service.getPriceHistory(material.id),
      import('../../services/projectNodes.service').then(m => m.getProjects())
    ])
    setPrices(pricesRes.data   || [])
    setHistory(histRes.data    || [])
    setProjects(projRes.data   || [])
    setLoading(false)
  }

  const pf = (key, val) => setPriceForm(f => ({ ...f, [key]: val }))

  // Calcular precio venta preview
  const purchase    = parseFloat(priceForm.purchase_price)      || 0
  const mgmtFixed   = parseFloat(priceForm.management_cost)     || 0
  const mgmtPct     = parseFloat(priceForm.management_cost_pct) / 100 || 0
  const inflation   = parseFloat(priceForm.inflation_factor)    / 100 || 0
  const salePreview = purchase + mgmtFixed + (purchase * mgmtPct) + (purchase * inflation)
  const marginPreview = purchase > 0 ? (((salePreview - purchase) / purchase) * 100).toFixed(2) : 0

  const handleSavePrice = async () => {
    if (!priceForm.purchase_price) { toast.error('El precio de compra es obligatorio'); return }
    setSaving(true)
    const { error } = await service.savePrice({ ...priceForm, material_id: material.id })
    if (error) { toast.error('Error al guardar precio: ' + error.message) }
    else { toast.success('✅ Precio guardado'); loadData() }
    setSaving(false)
  }

  const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'16px' }}>
      <div style={{ backgroundColor:'#fff',borderRadius:'16px',width:'100%',maxWidth:'680px',maxHeight:'92vh',overflowY:'auto',boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <p style={{ fontSize:'11px',color:'#6b7280',margin:0,fontFamily:'monospace' }}>{material.material_code}</p>
            <h3 style={{ fontSize:'16px',fontWeight:'700',margin:'2px 0 0' }}>💰 Precios — {material.material_type}</h3>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:'18px' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',gap:'4px',padding:'12px 24px',borderBottom:'1px solid #e5e7eb',backgroundColor:'#fafafa' }}>
          {[
            { key:'prices',  label:'💰 Precios por Proyecto' },
            { key:'new',     label:'➕ Nuevo Precio'         },
            { key:'history', label:'📋 Historial'            },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'6px 14px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight: tab===t.key ? '600':'400',backgroundColor: tab===t.key ? '#fff':'transparent',color: tab===t.key ? '#1d4ed8':'#6b7280',boxShadow: tab===t.key ? '0 1px 3px rgba(0,0,0,0.1)':'' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* Tab: Precios existentes */}
          {tab === 'prices' && (
            loading ? (
              <div style={{ textAlign:'center',padding:'32px' }}>
                <div style={{ width:'32px',height:'32px',border:'3px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto' }} />
              </div>
            ) : prices.length === 0 ? (
              <div style={{ textAlign:'center',padding:'32px',color:'#9ca3af' }}>
                <DollarSign size={36} style={{ margin:'0 auto 8px',opacity:0.3 }} />
                <p>No hay precios configurados</p>
                <button onClick={() => setTab('new')}
                  style={{ marginTop:'8px',padding:'8px 16px',borderRadius:'8px',border:'none',backgroundColor:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:'13px',fontWeight:'500' }}>
                  + Agregar primer precio
                </button>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
                {prices.map(p => (
                  <div key={p.id} style={{ border:'1px solid #e5e7eb',borderRadius:'12px',padding:'14px',backgroundColor:'#fafafa' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px' }}>
                      <div>
                        <p style={{ fontSize:'13px',fontWeight:'700',color:'#111827',margin:0 }}>
                          {p.project_id ? `📁 ${p.projects?.name}` : '🌐 Precio Base Global'}
                        </p>
                        {p.notes && <p style={{ fontSize:'11px',color:'#9ca3af',margin:'2px 0 0' }}>{p.notes}</p>}
                      </div>
                      <span style={{ fontSize:'18px',fontWeight:'800',color:'#059669' }}>
                        ${fmt(p.sale_price_obra)}
                      </span>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px' }}>
                      {[
                        { label:'Compra',    value:`$${fmt(p.purchase_price)}`,                          color:'#374151' },
                        { label:'Gestión',   value:`$${fmt(p.management_cost)} + ${(p.management_cost_pct*100).toFixed(1)}%`, color:'#d97706' },
                        { label:'Inflación', value:`${(p.inflation_factor*100).toFixed(2)}%`,            color:'#7c3aed' },
                        { label:'Margen',    value:`${(p.margin_pct*100).toFixed(2)}%`,                  color:'#059669' },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign:'center',backgroundColor:'#fff',borderRadius:'8px',padding:'8px',border:'1px solid #f3f4f6' }}>
                          <p style={{ fontSize:'10px',color:'#9ca3af',margin:'0 0 3px',textTransform:'uppercase' }}>{item.label}</p>
                          <p style={{ fontSize:'12px',fontWeight:'700',color:item.color,margin:0 }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Tab: Nuevo precio */}
          {tab === 'new' && (
            <div>
              {/* Proyecto */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>Proyecto</label>
                <select value={priceForm.project_id} onChange={e => pf('project_id', e.target.value)}
                  style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',backgroundColor:'#fff' }}>
                  <option value="">🌐 Precio Base Global (aplica a todos)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Precios */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px' }}>
                <div>
                  <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>Precio de Compra *</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={priceForm.purchase_price} onChange={e => pf('purchase_price', e.target.value)}
                    style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>Costo Gestión $ (fijo)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={priceForm.management_cost} onChange={e => pf('management_cost', e.target.value)}
                    style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>Costo Gestión % (sobre compra)</label>
                  <input type="number" min="0" max="100" step="0.1" placeholder="0.0"
                    value={priceForm.management_cost_pct} onChange={e => pf('management_cost_pct', e.target.value)}
                    style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>Factor Inflacionario %</label>
                  <input type="number" min="0" max="100" step="0.1" placeholder="0.0"
                    value={priceForm.inflation_factor} onChange={e => pf('inflation_factor', e.target.value)}
                    style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }} />
                </div>
              </div>

              {/* Preview del cálculo */}
              {purchase > 0 && (
                <div style={{ backgroundColor:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'10px',padding:'14px',marginBottom:'16px' }}>
                  <p style={{ fontSize:'12px',fontWeight:'600',color:'#166534',margin:'0 0 10px',textTransform:'uppercase' }}>
                    📊 Precio de Venta a Obra
                  </p>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <div style={{ fontSize:'12px',color:'#374151' }}>
                      ${fmt(purchase)} + ${fmt(mgmtFixed)} + {(mgmtPct*100).toFixed(1)}% + {(inflation*100).toFixed(1)}%
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:'22px',fontWeight:'800',color:'#15803d',margin:0 }}>${fmt(salePreview)}</p>
                      <p style={{ fontSize:'11px',color:'#16a34a',margin:'2px 0 0' }}>Margen: {marginPreview}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'13px',fontWeight:'600',color:'#374151',display:'block',marginBottom:'6px' }}>Notas</label>
                <input type="text" placeholder="Ej: Precio negociado con proveedor X"
                  value={priceForm.notes} onChange={e => pf('notes', e.target.value)}
                  style={{ width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }} />
              </div>

              <div style={{ display:'flex',justifyContent:'flex-end' }}>
                <button onClick={handleSavePrice} disabled={saving}
                  style={{ padding:'10px 24px',borderRadius:'10px',border:'none',backgroundColor:saving?'#93c5fd':'#2563eb',color:'#fff',cursor:saving?'not-allowed':'pointer',fontSize:'14px',fontWeight:'600' }}>
                  {saving ? 'Guardando...' : '💾 Guardar Precio'}
                </button>
              </div>
            </div>
          )}

          {/* Tab: Historial */}
          {tab === 'history' && (
            history.length === 0 ? (
              <div style={{ textAlign:'center',padding:'32px',color:'#9ca3af' }}>
                <History size={36} style={{ margin:'0 auto 8px',opacity:0.3 }} />
                <p>Sin historial de cambios de precio</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                {history.map((h, idx) => (
                  <div key={h.id} style={{ display:'flex',gap:'12px',padding:'12px',backgroundColor:'#fafafa',borderRadius:'10px',border:'1px solid #f3f4f6' }}>
                    <div style={{ width:'8px',height:'8px',borderRadius:'50%',backgroundColor:'#9ca3af',marginTop:'5px',flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                        <div>
                          <p style={{ fontSize:'13px',fontWeight:'600',color:'#374151',margin:0 }}>
                            {h.project_id ? h.projects?.name : 'Precio Base'}
                          </p>
                          <p style={{ fontSize:'11px',color:'#9ca3af',margin:'2px 0 0' }}>
                            {new Date(h.changed_at).toLocaleString('es-MX')}
                          </p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontSize:'14px',fontWeight:'700',color:'#374151',margin:0 }}>
                            Compra: ${fmt(h.purchase_price)}
                          </p>
                          <p style={{ fontSize:'13px',fontWeight:'700',color:'#059669',margin:'2px 0 0' }}>
                            Venta: ${fmt(h.sale_price_obra)}
                          </p>
                        </div>
                      </div>
                      {h.change_reason && (
                        <p style={{ fontSize:'11px',color:'#6b7280',margin:'4px 0 0',fontStyle:'italic' }}>
                          "{h.change_reason}"
                        </p>
                      )}
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
  const [materials,  setMaterials]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterCat,  setFilterCat]  = useState('')
  const [categories, setCategories] = useState([])
  const [modalMat,   setModalMat]   = useState(null)   // null | {} | {id,...}
  const [priceModal, setPriceModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { toast } = useToast()
  const { can }   = usePermission()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [matsRes, catsRes] = await Promise.all([
      service.getMaterials(),
      service.getCategories()
    ])
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
    const fn = id ? service.updateMaterial(id, formData) : service.createMaterial(formData)
    const { error } = await fn
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
        <div style={{ display:'flex',flexDirection:'column',gap:'16px' }}>

          {/* Header */}
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <p style={{ fontSize:'14px',color:'#6b7280',margin:0 }}>
              {materials.length} material{materials.length !== 1 ? 'es' : ''} activos
            </p>
            {can('materials','create') && (
              <button onClick={() => setModalMat({})}
                style={{ display:'flex',alignItems:'center',gap:'8px',padding:'10px 18px',borderRadius:'10px',border:'none',backgroundColor:'#2563eb',color:'#fff',cursor:'pointer',fontSize:'14px',fontWeight:'600' }}>
                <Plus size={16} /> Nuevo Material
              </button>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display:'flex',gap:'10px',flexWrap:'wrap',backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'14px' }}>
            <div style={{ position:'relative',flex:1,minWidth:'200px' }}>
              <Search size={15} style={{ position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'#9ca3af' }} />
              <input type="text" placeholder="Buscar por nombre, código o categoría..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width:'100%',paddingLeft:'32px',paddingRight:'12px',paddingTop:'8px',paddingBottom:'8px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box' }} />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',outline:'none',backgroundColor:'#fff',minWidth:'160px' }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
          </div>

          {/* Tabla */}
          <div style={{ backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',overflow:'hidden' }}>
            {loading ? (
              <div style={{ display:'flex',justifyContent:'center',padding:'48px' }}>
                <div style={{ width:'32px',height:'32px',border:'3px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin 1s linear infinite' }} />
              </div>
            ) : materials.length === 0 ? (
              <div style={{ textAlign:'center',padding:'48px',color:'#9ca3af' }}>
                <Package size={40} style={{ margin:'0 auto 12px',opacity:0.3 }} />
                <p>No se encontraron materiales</p>
              </div>
            ) : (
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb' }}>
                    {['Código','Material','Categoría','Subcategoría','Unidad','Acciones'].map(h => (
                      <th key={h} style={{ padding:'12px 16px',fontSize:'12px',fontWeight:'600',color:'#6b7280',textAlign:'left',textTransform:'uppercase',letterSpacing:'0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat, idx) => (
                    <tr key={mat.id}
                      style={{ borderBottom: idx < materials.length-1 ? '1px solid #f3f4f6':'none',transition:'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor='#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontSize:'13px',fontWeight:'700',color:'#2563eb',fontFamily:'monospace',backgroundColor:'#eff6ff',padding:'3px 8px',borderRadius:'6px' }}>
                          {mat.material_code || '—'}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <p style={{ fontSize:'14px',fontWeight:'500',color:'#111827',margin:0 }}>{mat.material_type}</p>
                        {mat.description && <p style={{ fontSize:'11px',color:'#9ca3af',margin:'2px 0 0' }}>{mat.description}</p>}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontSize:'12px',color:'#374151',backgroundColor:'#f3f4f6',padding:'3px 8px',borderRadius:'6px' }}>{mat.category}</span>
                      </td>
                      <td style={{ padding:'12px 16px',fontSize:'13px',color:'#6b7280' }}>{mat.subcategory}</td>
                      <td style={{ padding:'12px 16px',fontSize:'13px',color:'#6b7280' }}>{mat.default_unit}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex',gap:'6px' }}>
                          {/* Precios */}
                          <button onClick={() => setPriceModal(mat)} title="Gestionar precios"
                            style={{ padding:'6px',borderRadius:'8px',border:'none',backgroundColor:'#f0fdf4',color:'#16a34a',cursor:'pointer' }}>
                            <DollarSign size={14} />
                          </button>
                          {/* Editar */}
                          {can('materials','edit') && (
                            <button onClick={() => setModalMat(mat)} title="Editar"
                              style={{ padding:'6px',borderRadius:'8px',border:'none',backgroundColor:'#eff6ff',color:'#2563eb',cursor:'pointer' }}>
                              <Edit2 size={14} />
                            </button>
                          )}
                          {/* Desactivar */}
                          {can('materials','delete') && (
                            <button onClick={() => setDeleteTarget(mat)} title="Desactivar"
                              style={{ padding:'6px',borderRadius:'8px',border:'none',backgroundColor:'#fef2f2',color:'#dc2626',cursor:'pointer' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </MainLayout>

      {/* Modal Material */}
      {modalMat !== null && (
        <MaterialModal
          material={modalMat?.id ? modalMat : null}
          onSave={handleSaveMaterial}
          onClose={() => setModalMat(null)}
        />
      )}

      {/* Modal Precios */}
      {priceModal && (
        <PriceModal
          material={priceModal}
          onClose={() => setPriceModal(null)}
        />
      )}

      {/* Modal Confirmación Desactivar */}
      {deleteTarget && (
        <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'16px' }}>
          <div style={{ backgroundColor:'#fff',borderRadius:'16px',padding:'24px',maxWidth:'380px',width:'100%' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px' }}>
              <div style={{ width:'40px',height:'40px',backgroundColor:'#fef2f2',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <div>
                <p style={{ fontSize:'15px',fontWeight:'700',margin:0 }}>Desactivar Material</p>
                <p style={{ fontSize:'13px',color:'#6b7280',margin:'4px 0 0' }}>{deleteTarget.material_code} — {deleteTarget.material_type}</p>
              </div>
            </div>
            <p style={{ fontSize:'13px',color:'#374151',marginBottom:'20px' }}>
              El material no se eliminará, solo quedará inactivo y no aparecerá en nuevas solicitudes.
            </p>
            <div style={{ display:'flex',gap:'10px',justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ padding:'8px 16px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'13px' }}>
                Cancelar
              </button>
              <button onClick={() => handleDeactivate(deleteTarget)}
                style={{ padding:'8px 16px',borderRadius:'8px',border:'none',backgroundColor:'#dc2626',color:'#fff',cursor:'pointer',fontSize:'13px',fontWeight:'600' }}>
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </RequirePermission>
  )
}