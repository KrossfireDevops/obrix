// src/pages/materials/ApprovalModalV2.jsx
import { useState } from 'react'
import { CheckCircle, XCircle, Warehouse, Truck } from 'lucide-react'

export const ApprovalModalV2 = ({ request, onApprove, onReject, onClose }) => {
  const [notes,        setNotes]        = useState('')
  const [deliveryType, setDeliveryType] = useState('almacen') // 'almacen' | 'directo_obra'
  const [loading,      setLoading]      = useState(false)

  const [approvedItems, setApprovedItems] = useState(
    request.material_request_items?.map(item => ({
      id:                  item.id,
      quantity_approved:   item.quantity_requested,
      quantity_requested:  item.quantity_requested,
      unit_price:          item.unit_price || 0,
      material_name:       item.materials_catalog?.material_type || 'Material',
      material_code:       item.materials_catalog?.material_code || null,
      unit:                item.materials_catalog?.default_unit  || '',
    })) || []
  )

  const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

  const setItemQty = (idx, val) => {
    setApprovedItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, quantity_approved: parseFloat(val) || 0 } : it
    ))
  }

  const handleApprove = async () => {
    setLoading(true)
    await onApprove(request.id, notes, approvedItems, deliveryType)
    setLoading(false)
  }

  const handleReject = async () => {
    if (!notes.trim()) { alert('Escribe el motivo del rechazo'); return }
    setLoading(true)
    await onReject(request.id, notes)
    setLoading(false)
  }

  const totalAprobado = approvedItems.reduce((sum, i) =>
    sum + (i.quantity_approved * (i.unit_price || 0)), 0
  )

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ backgroundColor:'#fff', borderRadius:'16px', width:'100%', maxWidth:'640px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(to right, #1d4ed8, #2563eb)', borderRadius:'16px 16px 0 0' }}>
          <div>
            <h3 style={{ fontSize:'16px', fontWeight:'700', margin:0, color:'#fff' }}>
              ✅ Revisión de Solicitud
            </h3>
            <p style={{ fontSize:'13px', color:'#bfdbfe', margin:'4px 0 0' }}>
              {request.folio} — {request.title}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', color:'#fff', opacity:0.8, lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:'24px' }}>

          {/* Info solicitud */}
          <div style={{ backgroundColor:'#f9fafb', borderRadius:'10px', padding:'12px', marginBottom:'20px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'13px' }}>
              <div><span style={{ color:'#6b7280' }}>Proyecto: </span><strong>{request.projects?.name || '—'}</strong></div>
              <div><span style={{ color:'#6b7280' }}>Prioridad: </span><strong>{request.priority || '—'}</strong></div>
              {request.estimated_amount > 0 && (
                <div><span style={{ color:'#6b7280' }}>Monto estimado: </span><strong style={{ color:'#2563eb' }}>${fmt(request.estimated_amount)}</strong></div>
              )}
              {request.approval_level && (
                <div><span style={{ color:'#6b7280' }}>Nivel aprobación: </span>
                  <strong style={{ color: request.approval_level === 'jefe_obra' ? '#166534' : '#1e40af' }}>
                    {request.approval_level === 'jefe_obra' ? '👷 Jefe de Obra' : '🏢 Admin Empresa'}
                  </strong>
                </div>
              )}
            </div>
            {request.description && (
              <p style={{ fontSize:'13px', color:'#374151', margin:'8px 0 0', fontStyle:'italic' }}>{request.description}</p>
            )}
          </div>

          {/* Destino de entrega */}
          <div style={{ marginBottom:'20px' }}>
            <p style={{ fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'10px' }}>
              🚚 Destino de entrega
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {[
                { value:'almacen',      label:'Almacén',        sub:'Ingresa al inventario', icon: Warehouse, color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe' },
                { value:'directo_obra', label:'Directo a Obra', sub:'Va directo al proyecto', icon: Truck,     color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setDeliveryType(opt.value)}
                  style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'12px 14px', borderRadius:'10px', cursor:'pointer',
                    border:`2px solid ${deliveryType === opt.value ? opt.border : '#e5e7eb'}`,
                    backgroundColor: deliveryType === opt.value ? opt.bg : '#fff',
                    transition:'all 0.15s', textAlign:'left'
                  }}>
                  <opt.icon size={20} color={deliveryType === opt.value ? opt.color : '#9ca3af'} />
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'600', color: deliveryType === opt.value ? opt.color : '#374151', margin:0 }}>{opt.label}</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af', margin:0 }}>{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div style={{ marginBottom:'20px' }}>
            <p style={{ fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'10px' }}>
              📦 Ajusta las cantidades aprobadas
            </p>
            <div style={{ border:'1px solid #e5e7eb', borderRadius:'10px', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['Material', 'Solicitado', 'P. Unitario', 'Aprobado', 'Total'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', fontSize:'11px', color:'#6b7280', textAlign: h === 'Material' ? 'left' : 'center', fontWeight:'600', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvedItems.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: idx < approvedItems.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding:'10px 12px' }}>
                        <p style={{ fontSize:'13px', fontWeight:'500', margin:0 }}>{item.material_name}</p>
                        {item.material_code && (
                          <span style={{ fontSize:'11px', fontFamily:'monospace', color:'#2563eb', backgroundColor:'#eff6ff', padding:'1px 5px', borderRadius:'4px' }}>
                            {item.material_code}
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:'13px', textAlign:'center', color:'#6b7280' }}>
                        {item.quantity_requested} {item.unit}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:'13px', textAlign:'center', color: item.unit_price > 0 ? '#059669' : '#9ca3af', fontWeight:'600' }}>
                        {item.unit_price > 0 ? `$${fmt(item.unit_price)}` : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <input
                          type="number" min="0" step="1"
                          value={item.quantity_approved}
                          onChange={e => setItemQty(idx, e.target.value)}
                          style={{ width:'72px', padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', textAlign:'center', outline:'none' }}
                        />
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:'13px', textAlign:'center', fontWeight:'600', color: item.quantity_approved > 0 ? '#111827' : '#9ca3af' }}>
                        {item.quantity_approved > 0 && item.unit_price > 0
                          ? `$${fmt(item.quantity_approved * item.unit_price)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total aprobado */}
            {totalAprobado > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'8px', marginTop:'10px', padding:'10px 14px', backgroundColor:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px' }}>
                <span style={{ fontSize:'13px', color:'#166534' }}>Total aprobado:</span>
                <span style={{ fontSize:'18px', fontWeight:'800', color:'#15803d' }}>${fmt(totalAprobado)}</span>
              </div>
            )}
          </div>

          {/* Notas */}
          <div style={{ marginBottom:'24px' }}>
            <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'6px' }}>
              Notas <span style={{ fontWeight:'400', color:'#9ca3af' }}>(requerido para rechazar)</span>
            </label>
            <textarea rows={3}
              placeholder="Comentarios para el solicitante..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', resize:'none', outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <button onClick={onClose}
              style={{ padding:'10px 20px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'14px', color:'#374151' }}>
              Cancelar
            </button>
            <button onClick={handleReject} disabled={loading}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 20px', borderRadius:'10px', border:'none', backgroundColor:'#fef2f2', color:'#dc2626', cursor: loading ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'600', opacity: loading ? 0.7 : 1 }}>
              <XCircle size={16} /> Rechazar
            </button>
            <button onClick={handleApprove} disabled={loading}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 20px', borderRadius:'10px', border:'none', backgroundColor: loading ? '#93c5fd' : '#2563eb', color:'#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'600' }}>
              <CheckCircle size={16} /> {loading ? 'Procesando...' : 'Aprobar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}