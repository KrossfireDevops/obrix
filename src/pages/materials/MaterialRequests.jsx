// src/pages/materials/MaterialRequests.jsx
import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { PermissionGuard } from '../../components/auth/PermissionGuard'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../hooks/useToast'
import { RequestForm }    from './RequestForm'
import { ApprovalModal }  from './ApprovalModal'
import { ReceptionModal } from './ReceptionModal'
import * as service from '../../services/materialRequests.service'
import {
  Plus, FileText, Clock, CheckCircle, XCircle,
  Package, AlertTriangle, RotateCcw, Eye, ChevronDown
} from 'lucide-react'

// ── Configuración de estados ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  BORRADOR:         { label: 'Borrador',          color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
  ENVIADA:          { label: 'En Aprobación',      color: 'bg-yellow-100 text-yellow-700',dot: 'bg-yellow-500' },
  APROBADA:         { label: 'Aprobada',           color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  RECHAZADA:        { label: 'Rechazada',          color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  EN_RECEPCION:     { label: 'En Recepción',       color: 'bg-indigo-100 text-indigo-700',dot: 'bg-indigo-500' },
  RECIBIDA:         { label: 'Recibida',           color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  RECIBIDA_PARCIAL: { label: 'Recibida Parcial',   color: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  DEVOLUCION:       { label: 'Con Devolución',     color: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  CERRADA:          { label: 'Cerrada',            color: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300'   },
}

const PRIORITY_CONFIG = {
  BAJA:    { label: 'Baja',    color: 'text-gray-500'  },
  NORMAL:  { label: 'Normal',  color: 'text-blue-600'  },
  ALTA:    { label: 'Alta',    color: 'text-yellow-600' },
  URGENTE: { label: 'URGENTE', color: 'text-red-600 font-bold' },
}

// Tabs con sus filtros de estado
const TABS = [
  { key: 'solicitudes',  label: 'Solicitudes',    icon: FileText,      statuses: ['BORRADOR','ENVIADA','RECHAZADA'] },
  { key: 'aprobacion',   label: 'En Aprobación',  icon: Clock,         statuses: ['ENVIADA']                        },
  { key: 'recepcion',    label: 'Por Recibir',    icon: Package,       statuses: ['APROBADA','EN_RECEPCION']        },
  { key: 'recibidos',    label: 'Recibidos',      icon: CheckCircle,   statuses: ['RECIBIDA','RECIBIDA_PARCIAL']    },
  { key: 'devoluciones', label: 'Devoluciones',   icon: RotateCcw,     statuses: ['DEVOLUCION']                    },
]

// ── Componente Card de Solicitud ──────────────────────────────────────────────
const RequestCard = ({ request, onView, onApprove, onReceive, onReturn, onSubmit }) => {
  const { can } = usePermission()
  const status  = STATUS_CONFIG[request.status] || STATUS_CONFIG.BORRADOR
  const priority = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.NORMAL
  const itemCount = request.material_request_items?.length || 0

  return (
    <div style={{
      backgroundColor: '#fff', border: '1px solid #e5e7eb',
      borderRadius: '12px', padding: '16px',
      transition: 'box-shadow 0.2s', cursor: 'default'
    }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Fila 1: folio + estado + prioridad */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' }}>
            {request.folio}
          </span>
          <span className={`ml-2 text-xs font-medium ${priority.color}`}>
            {priority.label !== 'Normal' && `● ${priority.label}`}
          </span>
        </div>
        <span style={{ fontSize: '11px', fontWeight: '500', padding: '3px 10px', borderRadius: '9999px' }}
          className={status.color}>
          {status.label}
        </span>
      </div>

      {/* Título */}
      <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>
        {request.title}
      </p>

      {/* Proyecto + items */}
      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
        <span>📁 {request.projects?.name || '—'}</span>
        <span>📦 {itemCount} material{itemCount !== 1 ? 'es' : ''}</span>
        <span>🕐 {new Date(request.created_at).toLocaleDateString('es-MX')}</span>
      </div>

      {/* Acciones según estado y rol */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* Enviar a aprobación */}
        {request.status === 'BORRADOR' && can('materials', 'create') && (
          <button onClick={() => onSubmit(request)} style={btnStyle('#eff6ff', '#2563eb')}>
            📤 Enviar
          </button>
        )}
        {/* Aprobar/Rechazar */}
        {request.status === 'ENVIADA' && can('materials', 'approve') && (
          <button onClick={() => onApprove(request)} style={btnStyle('#f0fdf4', '#16a34a')}>
            ✅ Revisar
          </button>
        )}
        {/* Recibir */}
        {['APROBADA','EN_RECEPCION'].includes(request.status) && can('materials', 'create') && (
          <button onClick={() => onReceive(request)} style={btnStyle('#eff6ff', '#2563eb')}>
            📦 Recibir
          </button>
        )}
        {/* Gestionar devolución */}
        {request.status === 'DEVOLUCION' && can('materials', 'create') && (
          <button onClick={() => onReturn(request)} style={btnStyle('#fdf4ff', '#7c3aed')}>
            🔄 Devolución
          </button>
        )}
        {/* Ver detalle */}
        <button onClick={() => onView(request)} style={btnStyle('#f9fafb', '#374151')}>
          <Eye size={13} style={{ marginRight: '4px' }} /> Ver
        </button>
      </div>
    </div>
  )
}

const btnStyle = (bg, color) => ({
  display: 'flex', alignItems: 'center',
  padding: '6px 12px', borderRadius: '8px', border: 'none',
  backgroundColor: bg, color, cursor: 'pointer',
  fontSize: '12px', fontWeight: '500', transition: 'opacity 0.15s'
})

// ── Página Principal ──────────────────────────────────────────────────────────
export const MaterialRequests = () => {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState('solicitudes')
  const [showForm, setShowForm]   = useState(false)
  const [approvalTarget,  setApprovalTarget]  = useState(null)
  const [receptionTarget, setReceptionTarget] = useState(null)
  const { toast } = useToast()
  const { can }   = usePermission()

  useEffect(() => { loadRequests() }, [])

  const loadRequests = async () => {
    setLoading(true)
    const { data, error } = await service.getRequests()
    if (error) toast.error('Error al cargar solicitudes')
    else setRequests(data || [])
    setLoading(false)
  }

  // Filtrar por tab activo
  const currentTab  = TABS.find(t => t.key === activeTab)
  const filtered    = requests.filter(r => currentTab?.statuses.includes(r.status))

  // Contadores para badges
  const countByTab = (tab) => requests.filter(r => tab.statuses.includes(r.status)).length

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = async (formData) => {
    const { data, error } = await service.createRequest(formData)
    if (error) { toast.error('Error al crear: ' + error.message); return }
    toast.success(`✅ Solicitud ${data.folio} creada`)
    setShowForm(false)
    loadRequests()
  }

  const handleSubmit = async (request) => {
    const { error } = await service.submitRequest(request.id)
    if (error) { toast.error('Error al enviar'); return }
    toast.success('✅ Solicitud enviada a aprobación')
    loadRequests()
  }

  const handleApprove = async (requestId, notes, items) => {
    const { error } = await service.approveRequest(requestId, notes, items)
    if (error) { toast.error('Error al aprobar: ' + error.message); return }
    toast.success('✅ Solicitud aprobada')
    setApprovalTarget(null)
    loadRequests()
  }

  const handleReject = async (requestId, notes) => {
    const { error } = await service.rejectRequest(requestId, notes)
    if (error) { toast.error('Error al rechazar'); return }
    toast.success('Solicitud rechazada')
    setApprovalTarget(null)
    loadRequests()
  }

  const handleReceive = async (requestId, notes, items) => {
    const { error } = await service.receiveRequest(requestId, notes, items)
    if (error) { toast.error('Error en recepción: ' + error.message); return }
    toast.success('✅ Recepción confirmada — inventario actualizado automáticamente')
    setReceptionTarget(null)
    loadRequests()
  }

  return (
    <MainLayout title="📋 Gestión de Materiales">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Header con botón crear */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} en total
          </p>
          {can('materials', 'create') && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '10px', border: 'none',
                backgroundColor: '#2563eb', color: '#fff',
                cursor: 'pointer', fontSize: '14px', fontWeight: '600'
              }}
            >
              <Plus size={18} /> Nueva Solicitud
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '4px' }}>
          {TABS.map(tab => {
            const count   = countByTab(tab)
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', padding: '8px 12px', borderRadius: '8px', border: 'none',
                  backgroundColor: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#6b7280',
                  fontWeight: isActive ? '600' : '400', fontSize: '13px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <tab.icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <span style={{
                    backgroundColor: isActive ? '#dbeafe' : '#e5e7eb',
                    color: isActive ? '#1d4ed8' : '#6b7280',
                    fontSize: '11px', fontWeight: '700',
                    padding: '1px 6px', borderRadius: '9999px'
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Lista de solicitudes */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <FileText size={40} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              No hay solicitudes en esta sección
            </p>
            {activeTab === 'solicitudes' && can('materials', 'create') && (
              <button
                onClick={() => setShowForm(true)}
                style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
              >
                + Crear primera solicitud
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
            {filtered.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                onView={(r)    => console.log('Ver detalle:', r.folio)}
                onApprove={(r) => setApprovalTarget(r)}
                onReceive={(r) => setReceptionTarget(r)}
                onReturn={(r)  => console.log('Devolución:', r.folio)}
                onSubmit={handleSubmit}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Nueva Solicitud ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>📋 Nueva Solicitud de Materiales</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <RequestForm
                onSave={handleCreate}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Aprobación ── */}
      {approvalTarget && (
        <ApprovalModal
          request={approvalTarget}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setApprovalTarget(null)}
        />
      )}

      {/* ── Modal: Recepción ── */}
      {receptionTarget && (
        <ReceptionModal
          request={receptionTarget}
          onReceive={handleReceive}
          onClose={() => setReceptionTarget(null)}
        />
      )}
    </MainLayout>
  )
}