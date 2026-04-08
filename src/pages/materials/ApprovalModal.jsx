// src/pages/materials/ApprovalModal.jsx
import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '../../components/ui/Button'

export const ApprovalModal = ({ request, onApprove, onReject, onClose }) => {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState(null) // 'approve' | 'reject'

  const [approvedItems, setApprovedItems] = useState(
    request.material_request_items?.map(item => ({
      id:               item.id,
      quantity_approved: item.quantity_requested,
      notes:            '',
      // refs
      quantity_requested: item.quantity_requested,
      material_name:    item.materials_catalog?.material_type || 'Material',
      unit:             item.materials_catalog?.default_unit  || '',
    })) || []
  )

  const setItemApproved = (idx, val) => {
    setApprovedItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, quantity_approved: parseFloat(val) || 0 } : it
    ))
  }

  const handleApprove = async () => {
    setLoading(true)
    setAction('approve')
    await onApprove(request.id, notes, approvedItems)
    setLoading(false)
  }

  const handleReject = async () => {
    if (!notes.trim()) { alert('Escribe el motivo del rechazo'); return }
    setLoading(true)
    setAction('reject')
    await onReject(request.id, notes)
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '16px',
        width: '100%', maxWidth: '600px', maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
              ✅ Revisión de Solicitud
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
              {request.folio} — {request.title}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Info solicitud */}
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              <div><span style={{ color: '#6b7280' }}>Proyecto: </span><strong>{request.projects?.name}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Prioridad: </span><strong>{request.priority}</strong></div>
            </div>
            {request.description && (
              <p style={{ fontSize: '13px', color: '#374151', margin: '8px 0 0' }}>{request.description}</p>
            )}
          </div>

          {/* Items para aprobar */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
              📦 Materiales solicitados — ajusta las cantidades aprobadas:
            </p>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280', textAlign: 'left', fontWeight: '600' }}>Material</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280', textAlign: 'center', fontWeight: '600' }}>Solicitado</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280', textAlign: 'center', fontWeight: '600' }}>Aprobado</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedItems.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: idx < approvedItems.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500' }}>{item.material_name}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'center', color: '#6b7280' }}>
                        {item.quantity_requested} {item.unit}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity_approved}
                          onChange={(e) => setItemApproved(idx, e.target.value)}
                          style={{
                            width: '80px', padding: '6px 8px', border: '1px solid #e5e7eb',
                            borderRadius: '6px', fontSize: '13px', textAlign: 'center',
                            outline: 'none'
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
              Notas de aprobación / motivo de rechazo
            </label>
            <textarea
              rows={3}
              placeholder="Agrega comentarios para el solicitante..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                borderRadius: '8px', fontSize: '13px', resize: 'none',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '14px' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
                fontSize: '14px', fontWeight: '600', opacity: loading ? 0.7 : 1
              }}
            >
              <XCircle size={16} /> Rechazar
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                background: '#2563eb', color: '#fff', cursor: 'pointer',
                fontSize: '14px', fontWeight: '600', opacity: loading ? 0.7 : 1
              }}
            >
              <CheckCircle size={16} /> Aprobar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}