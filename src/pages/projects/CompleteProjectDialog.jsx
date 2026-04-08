import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'

export const CompleteProjectDialog = ({ isOpen, project, onConfirm, onCancel }) => {
  const [closingNotes, setClosingNotes] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen || !project) return null

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(project.id, closingNotes)
    setLoading(false)
    setClosingNotes('')
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 998
        }}
      />
      {/* Diálogo */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999, backgroundColor: '#ffffff',
        borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '460px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        {/* Ícono */}
        <div style={{
          width: '52px', height: '52px',
          backgroundColor: '#f0fdf4', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <CheckCircle size={28} style={{ color: '#16a34a' }} />
        </div>

        <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 6px' }}>
          Terminar Obra
        </h3>
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6b7280', margin: '0 0 4px' }}>
          <strong>[{project.code}] {project.name}</strong>
        </p>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af', margin: '0 0 20px' }}>
          Se registrará la fecha de hoy como término de obra y los almacenes del proyecto serán desactivados.
        </p>

        {/* Notas de cierre */}
        <div style={{ marginBottom: '20px' }}>
          <label className="input-label">Notas de Cierre (opcional)</label>
          <textarea
            className="input-field"
            rows="3"
            placeholder="Observaciones del cierre, entregables, etc..."
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
          />
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="button"
            variant="success"
            loading={loading}
            onClick={handleConfirm}
            className="flex-1"
          >
            {loading ? 'Cerrando...' : '✅ Confirmar Cierre'}
          </Button>
        </div>
      </div>
    </>
  )
}