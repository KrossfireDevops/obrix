// src/pages/materials/ReceptionModal.jsx
import { useState, useRef, useEffect } from 'react'
import { Camera, Trash2, AlertTriangle, Warehouse } from 'lucide-react'
import { supabase } from '../../config/supabase'

export const ReceptionModal = ({ request, onReceive, onClose }) => {
  const [notes,      setNotes]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [warehouses, setWarehouses] = useState([])
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouseError, setWarehouseError] = useState(false)
  const fileRefs = useRef({})

  const [receivedItems, setReceivedItems] = useState(
    request.material_request_items
      ?.filter(i => i.status === 'APROBADO')
      .map(item => ({
        id:                item.id,
        quantityReceived:  item.quantity_approved || item.quantity_requested,
        quantityDefective: 0,
        defectDescription: '',
        defectPhotos:      item.defect_photos || [],
        quantity_approved:  item.quantity_approved || item.quantity_requested,
        quantity_requested: item.quantity_requested,
        material_name:      item.materials_catalog?.material_type || 'Material',
        material_code:      item.materials_catalog?.material_code || null,
        unit:               item.materials_catalog?.default_unit  || '',
      })) || []
  )

  // Cargar almacenes disponibles
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name')
        .order('name')
      setWarehouses(data || [])
      // Si solo hay uno, seleccionarlo automáticamente
      if (data?.length === 1) setWarehouseId(data[0].id)
    }
    load()
  }, [])

  const setItem = (idx, key, val) => {
    setReceivedItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }

  const handlePhotoUpload = (idx, files) => {
    const item = receivedItems[idx]
    const newPhotos = [...item.defectPhotos]
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = (e) => {
        newPhotos.push({ url: e.target.result, name: file.name, file })
        setItem(idx, 'defectPhotos', [...newPhotos])
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = (itemIdx, photoIdx) => {
    const photos = receivedItems[itemIdx].defectPhotos.filter((_, i) => i !== photoIdx)
    setItem(itemIdx, 'defectPhotos', photos)
  }

  const handleSubmit = async () => {
    // Validar almacén obligatorio
    if (!warehouseId) {
      setWarehouseError(true)
      return
    }
    setWarehouseError(false)
    setLoading(true)
    // Pasar warehouseId junto con los ítems para que el service lo use
    await onReceive(request.id, notes, receivedItems, warehouseId)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ backgroundColor:'#fff', borderRadius:'16px', width:'100%', maxWidth:'680px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(to right, #065f46, #059669)', borderRadius:'16px 16px 0 0' }}>
          <div>
            <h3 style={{ fontSize:'16px', fontWeight:'700', margin:0, color:'#fff' }}>📦 Recepción de Materiales</h3>
            <p style={{ fontSize:'13px', color:'#a7f3d0', margin:'4px 0 0' }}>
              {request.folio} — {request.title}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', color:'#fff', opacity:0.8, lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:'24px' }}>

          {/* ── SELECTOR DE ALMACÉN — OBLIGATORIO ── */}
          <div style={{
            marginBottom:'24px', padding:'16px',
            backgroundColor: warehouseError ? '#fef2f2' : '#f0fdf4',
            border:`2px solid ${warehouseError ? '#fca5a5' : '#bbf7d0'}`,
            borderRadius:'12px'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <Warehouse size={18} color={warehouseError ? '#dc2626' : '#059669'} />
              <label style={{ fontSize:'14px', fontWeight:'700', color: warehouseError ? '#dc2626' : '#065f46' }}>
                Almacén de Resguardo *
              </label>
              <span style={{ fontSize:'11px', color: warehouseError ? '#dc2626' : '#6b7280', marginLeft:'auto' }}>
                {warehouseError ? '⚠️ Selecciona un almacén para continuar' : 'Obligatorio'}
              </span>
            </div>
            <select
              value={warehouseId}
              onChange={e => { setWarehouseId(e.target.value); setWarehouseError(false) }}
              style={{
                width:'100%', padding:'10px 12px',
                border:`1px solid ${warehouseError ? '#fca5a5' : '#d1fae5'}`,
                borderRadius:'8px', fontSize:'14px', outline:'none',
                backgroundColor:'#fff', fontWeight: warehouseId ? '600' : '400',
                color: warehouseId ? '#065f46' : '#9ca3af'
              }}>
              <option value="">Seleccionar almacén...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Items */}
          {receivedItems.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>
              <AlertTriangle size={32} style={{ margin:'0 auto 8px', opacity:0.4 }} />
              <p>No hay materiales aprobados para recibir</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px', marginBottom:'20px' }}>
              {receivedItems.map((item, idx) => (
                <div key={item.id} style={{ border:'1px solid #e5e7eb', borderRadius:'12px', padding:'16px', backgroundColor:'#fafafa' }}>

                  {/* Nombre + código */}
                  <div style={{ marginBottom:'12px' }}>
                    <p style={{ fontSize:'14px', fontWeight:'600', color:'#111827', margin:0 }}>
                      📦 {item.material_name}
                    </p>
                    {item.material_code && (
                      <span style={{ fontSize:'11px', fontFamily:'monospace', color:'#2563eb', backgroundColor:'#eff6ff', padding:'1px 6px', borderRadius:'4px', marginTop:'2px', display:'inline-block' }}>
                        {item.material_code}
                      </span>
                    )}
                  </div>

                  {/* Cantidades */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'4px', fontWeight:'600', textTransform:'uppercase' }}>Aprobado</label>
                      <div style={{ fontSize:'16px', fontWeight:'700', color:'#2563eb' }}>
                        {item.quantity_approved} <span style={{ fontSize:'12px', color:'#9ca3af' }}>{item.unit}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#059669', display:'block', marginBottom:'4px', fontWeight:'600', textTransform:'uppercase' }}>Cantidad Recibida *</label>
                      <input type="number" min="0" step="1"
                        value={item.quantityReceived}
                        onChange={e => setItem(idx, 'quantityReceived', parseInt(e.target.value) || 0)}
                        style={{ width:'100%', padding:'8px', border:'1px solid #d1fae5', borderRadius:'8px', fontSize:'14px', fontWeight:'600', outline:'none', boxSizing:'border-box', color:'#065f46' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#dc2626', display:'block', marginBottom:'4px', fontWeight:'600', textTransform:'uppercase' }}>Defectuoso</label>
                      <input type="number" min="0" step="1"
                        value={item.quantityDefective}
                        onChange={e => setItem(idx, 'quantityDefective', parseInt(e.target.value) || 0)}
                        style={{ width:'100%', padding:'8px', border:'1px solid #fca5a5', borderRadius:'8px', fontSize:'14px', fontWeight:'600', color:'#dc2626', outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Defectos */}
                  {item.quantityDefective > 0 && (
                    <div style={{ marginBottom:'8px' }}>
                      <label style={{ fontSize:'12px', fontWeight:'500', color:'#dc2626', display:'block', marginBottom:'4px' }}>
                        ⚠️ Descripción del defecto
                      </label>
                      <textarea rows={2}
                        placeholder="Describe el defecto o daño encontrado..."
                        value={item.defectDescription}
                        onChange={e => setItem(idx, 'defectDescription', e.target.value)}
                        style={{ width:'100%', padding:'8px', border:'1px solid #fca5a5', borderRadius:'8px', fontSize:'13px', resize:'none', outline:'none', boxSizing:'border-box' }}
                      />
                      {/* Fotos */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'8px' }}>
                        {item.defectPhotos.map((photo, pIdx) => (
                          <div key={pIdx} style={{ position:'relative' }}>
                            <img src={photo.url} alt={photo.name}
                              style={{ width:'72px', height:'72px', objectFit:'cover', borderRadius:'8px', border:'1px solid #e5e7eb' }} />
                            <button type="button" onClick={() => removePhoto(idx, pIdx)}
                              style={{ position:'absolute', top:'-6px', right:'-6px', width:'20px', height:'20px', borderRadius:'50%', backgroundColor:'#dc2626', color:'#fff', border:'none', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              ✕
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => fileRefs.current[idx]?.click()}
                          style={{ width:'72px', height:'72px', borderRadius:'8px', border:'2px dashed #fca5a5', backgroundColor:'#fef2f2', color:'#dc2626', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px' }}>
                          <Camera size={18} />
                          <span style={{ fontSize:'10px' }}>Foto</span>
                        </button>
                        <input type="file" accept="image/*" multiple style={{ display:'none' }}
                          ref={el => fileRefs.current[idx] = el}
                          onChange={e => handlePhotoUpload(idx, Array.from(e.target.files))} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notas generales */}
          <div style={{ marginBottom:'20px' }}>
            <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151', display:'block', marginBottom:'6px' }}>
              Notas de recepción <span style={{ color:'#9ca3af', fontWeight:'400' }}>(opcional)</span>
            </label>
            <textarea rows={2}
              placeholder="Observaciones generales de la recepción..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', resize:'none', outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Aviso */}
          <div style={{ backgroundColor:'#eff6ff', borderRadius:'10px', padding:'12px', marginBottom:'20px', display:'flex', gap:'10px', alignItems:'flex-start' }}>
            <span style={{ fontSize:'18px' }}>ℹ️</span>
            <p style={{ fontSize:'13px', color:'#1d4ed8', margin:0 }}>
              Al confirmar, la cantidad neta (recibida − defectuosa) se ingresará automáticamente al inventario del almacén seleccionado.
            </p>
          </div>

          {/* Botones */}
          <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
            <button onClick={onClose}
              style={{ padding:'10px 20px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'14px', color:'#374151' }}>
              Cancelar
            </button>
            <button onClick={handleSubmit}
              disabled={loading || receivedItems.length === 0}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 24px', borderRadius:'10px', border:'none', backgroundColor: loading ? '#6ee7b7' : '#059669', color:'#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'600' }}>
              {loading ? 'Procesando...' : '✅ Confirmar Recepción'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}