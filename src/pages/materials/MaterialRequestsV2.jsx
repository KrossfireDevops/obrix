// src/pages/materials/MaterialRequestsV2.jsx
import { useState, useEffect } from 'react'
import { useOffline }   from '../../hooks/useOffline'
import SyncStatusBar    from '../../components/goldenring/SyncStatusBar'
import { MainLayout } from '../../components/layout/MainLayout'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../hooks/useToast'
import { RequestFormV2 }    from './RequestFormV2'
import { ApprovalModalV2 }  from './ApprovalModalV2'
import { ReceptionModal }   from './ReceptionModal'
import * as service from '../../services/materialRequestsV2.service'
import { Plus, FileText, Clock, CheckCircle, Package, RotateCcw, Eye, Shield, Truck, Warehouse } from 'lucide-react'

const STATUS_CONFIG = {
  BORRADOR:         { label:'Borrador',         color:'bg-gray-100 text-gray-600'    },
  ENVIADA:          { label:'En Aprobación',    color:'bg-yellow-100 text-yellow-700'},
  APROBADA:         { label:'Aprobada',         color:'bg-blue-100 text-blue-700'    },
  RECHAZADA:        { label:'Rechazada',        color:'bg-red-100 text-red-700'      },
  RECIBIDA:         { label:'Recibida',         color:'bg-green-100 text-green-700'  },
  RECIBIDA_PARCIAL: { label:'Parcial',          color:'bg-orange-100 text-orange-700'},
  DEVOLUCION:       { label:'Con Devolución',   color:'bg-purple-100 text-purple-700'},
  CERRADA:          { label:'Cerrada',          color:'bg-gray-100 text-gray-500'    },
}

const APPROVAL_LEVEL_CONFIG = {
  jefe_obra:     { label:'Jefe de Obra',  color:'#166534', bg:'#f0fdf4' },
  admin_empresa: { label:'Admin Empresa', color:'#1e40af', bg:'#eff6ff' },
}

const TABS = [
  { key:'solicitudes',  label:'Solicitudes',   icon:FileText,    statuses:['BORRADOR','ENVIADA','RECHAZADA'] },
  { key:'aprobacion',   label:'Por Aprobar',   icon:Clock,       statuses:['ENVIADA']                        },
  { key:'recepcion',    label:'Por Recibir',   icon:Package,     statuses:['APROBADA']                       },
  { key:'recibidos',    label:'Recibidos',     icon:CheckCircle, statuses:['RECIBIDA','RECIBIDA_PARCIAL']    },
  { key:'devoluciones', label:'Devoluciones',  icon:RotateCcw,   statuses:['DEVOLUCION']                    },
]

const fmt = (n) => Number(n||0).toLocaleString('es-MX', { minimumFractionDigits:2 })

// ── Card de solicitud ─────────────────────────────────────────────────────────
const RequestCard = ({ request, onApprove, onReceive, onSubmit, canApprove, canReceive }) => {
  const status    = STATUS_CONFIG[request.status]   || STATUS_CONFIG.BORRADOR
  const approval  = APPROVAL_LEVEL_CONFIG[request.approval_level]
  const itemCount = request.material_request_items?.length || 0

  return (
    <div style={{ backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'16px',transition:'box-shadow 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>

      {/* Fila 1: folio + estado */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px' }}>
        <span style={{ fontSize:'12px',fontWeight:'700',color:'#2563eb',fontFamily:'monospace' }}>
          {request.folio}
        </span>
        <span style={{ fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'9999px' }}
          className={status.color}>{status.label}</span>
      </div>

      {/* Título */}
      <p style={{ fontSize:'14px',fontWeight:'600',color:'#111827',margin:'0 0 6px' }}>
        {request.title}
      </p>

      {/* Meta */}
      <div style={{ display:'flex',gap:'12px',fontSize:'12px',color:'#6b7280',marginBottom:'10px',flexWrap:'wrap' }}>
        <span>📁 {request.projects?.name || '—'}</span>
        <span>📦 {itemCount} ítem{itemCount!==1?'s':''}</span>
        {request.estimated_amount > 0 && (
          <span style={{ fontWeight:'600',color:'#2563eb' }}>${fmt(request.estimated_amount)}</span>
        )}
      </div>

      {/* Nivel de aprobación + destino */}
      <div style={{ display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap' }}>
        {approval && (
          <span style={{ fontSize:'11px',fontWeight:'500',padding:'3px 8px',borderRadius:'6px',backgroundColor: approval.bg, color: approval.color }}>
            <Shield size={10} style={{ marginRight:'3px',display:'inline' }} />
            {approval.label}
          </span>
        )}
        {request.delivery_type && (
          <span style={{ fontSize:'11px',fontWeight:'500',padding:'3px 8px',borderRadius:'6px',backgroundColor:'#f3f4f6',color:'#374151' }}>
            {request.delivery_type === 'almacen'
              ? <><Warehouse size={10} style={{ marginRight:'3px',display:'inline' }} />Almacén</>
              : <><Truck size={10} style={{ marginRight:'3px',display:'inline' }} />Directo a Obra</>
            }
          </span>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display:'flex',gap:'6px',flexWrap:'wrap' }}>
        {request.status === 'BORRADOR' && (
          <button onClick={() => onSubmit(request)}
            style={{ padding:'6px 12px',borderRadius:'8px',border:'none',backgroundColor:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:'12px',fontWeight:'500' }}>
            📤 Enviar
          </button>
        )}
        {request.status === 'ENVIADA' && canApprove && (
          <button onClick={() => onApprove(request)}
            style={{ padding:'6px 12px',borderRadius:'8px',border:'none',backgroundColor:'#f0fdf4',color:'#16a34a',cursor:'pointer',fontSize:'12px',fontWeight:'500' }}>
            ✅ Aprobar / Rechazar
          </button>
        )}
        {request.status === 'APROBADA' && canReceive && (
          <button onClick={() => onReceive(request)}
            style={{ padding:'6px 12px',borderRadius:'8px',border:'none',backgroundColor:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:'12px',fontWeight:'500' }}>
            📦 Recibir
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────
export const MaterialRequestsV2 = () => {
  const [requests,  setRequests]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('solicitudes')
  const [showForm,  setShowForm]  = useState(false)
  const [approvalTarget,  setApprovalTarget]  = useState(null)
  const [receptionTarget, setReceptionTarget] = useState(null)
  const { toast } = useToast()
  const { can, role } = usePermission()

  const {
    isOnline,
    syncStatus,
    pendientes:  syncPendientes,
    conflictos:  syncConflictos,
    syncManual,
    crearSolicitudOffline,
  } = useOffline()

  // Permisos contextuales
  const canApprove = can('materials_requests', 'approve')
  const canReceive = can('materials_requests', 'receive') || role === 'jefe_obra'
  const canCreate  = can('materials_requests', 'create')

  useEffect(() => { loadRequests() }, [])

  const loadRequests = async () => {
    setLoading(true)
    const { data, error } = await service.getRequests()
    if (error) toast.error('Error al cargar solicitudes')
    else setRequests(data || [])
    setLoading(false)
  }

  const currentTab = TABS.find(t => t.key === activeTab)
  const filtered   = requests.filter(r => currentTab?.statuses.includes(r.status))
  const countTab   = (tab) => requests.filter(r => tab.statuses.includes(r.status)).length

  const handleCreate = async (formData) => {
    if (!isOnline) {
      // ── MODO OFFLINE ─────────────────────────────────────
      await crearSolicitudOffline(formData)
      toast.success('📱 Solicitud guardada localmente — se sincronizará al reconectar')
      setShowForm(false)
      return
    }
    // ── MODO ONLINE (flujo normal) ────────────────────────
    const { data, error } = await service.createRequest(formData)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success(`✅ Solicitud ${data.folio} ${formData.sendNow ? 'enviada' : 'guardada'}`)
    setShowForm(false)
    loadRequests()
  }

  const handleSubmit = async (request) => {
    const { error } = await service.submitRequest(request.id)
    if (error) { toast.error('Error al enviar'); return }
    toast.success('✅ Solicitud enviada a aprobación')
    loadRequests()
  }

  const handleApprove = async (requestId, notes, items, deliveryType) => {
    const { error } = await service.approveRequest(requestId, notes, items, deliveryType)
    if (error) { toast.error('Error: ' + error.message); return }
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

  const handleReceive = async (requestId, notes, items, warehouseId) => {
    const { error } = await service.receiveRequest(requestId, notes, items, warehouseId)
    if (error) { toast.error('Error en recepción: ' + error.message); return }
    toast.success('✅ Recepción confirmada — inventario actualizado')
    setReceptionTarget(null)
    loadRequests()
  }

  return (
    <MainLayout title="📋 Gestión de Materiales">
      <div style={{ display:'flex',flexDirection:'column',gap:'20px' }}>

        {/* ── GoldenRing: Estado de sincronización ── */}
        <SyncStatusBar
          isOnline={isOnline}
          syncStatus={syncStatus}
          pendientes={syncPendientes}
          conflictos={syncConflictos}
          onSync={syncManual}
        />

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <p style={{ fontSize:'14px',color:'#6b7280',margin:0 }}>
            {requests.length} solicitud{requests.length!==1?'es':''} en total
          </p>
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              style={{ display:'flex',alignItems:'center',gap:'8px',padding:'10px 18px',borderRadius:'10px',border:'none',backgroundColor:'#2563eb',color:'#fff',cursor:'pointer',fontSize:'14px',fontWeight:'600' }}>
              <Plus size={16} /> Nueva Solicitud
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',gap:'4px',backgroundColor:'#f3f4f6',borderRadius:'12px',padding:'4px' }}>
          {TABS.map(tab => {
            const count    = countTab(tab)
            const isActive = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px 10px',borderRadius:'8px',border:'none',backgroundColor: isActive?'#fff':'transparent',color: isActive?'#1d4ed8':'#6b7280',fontWeight: isActive?'600':'400',fontSize:'13px',cursor:'pointer',transition:'all 0.15s',boxShadow: isActive?'0 1px 3px rgba(0,0,0,0.1)':'' }}>
                <tab.icon size={15} />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span style={{ backgroundColor: isActive?'#dbeafe':'#e5e7eb',color: isActive?'#1d4ed8':'#6b7280',fontSize:'11px',fontWeight:'700',padding:'1px 6px',borderRadius:'9999px' }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:'48px' }}>
            <div style={{ width:'36px',height:'36px',border:'3px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px',backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb' }}>
            <FileText size={40} style={{ margin:'0 auto 12px',color:'#d1d5db' }} />
            <p style={{ fontSize:'14px',color:'#9ca3af' }}>No hay solicitudes en esta sección</p>
          </div>
        ) : (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(340px,1fr))',gap:'12px' }}>
            {filtered.map(req => (
              <RequestCard key={req.id} request={req}
                canApprove={canApprove}
                canReceive={canReceive}
                onApprove={r => setApprovalTarget(r)}
                onReceive={r => setReceptionTarget(r)}
                onSubmit={handleSubmit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal: Nueva Solicitud */}
      {showForm && (
        <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'16px' }}>
          <div style={{ backgroundColor:'#fff',borderRadius:'16px',width:'100%',maxWidth:'760px',maxHeight:'92vh',overflowY:'auto',boxShadow:'0 25px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ padding:'20px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',margin:0 }}>📋 Nueva Solicitud de Materiales</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:'#6b7280' }}>✕</button>
            </div>
            <div style={{ padding:'24px' }}>
              <RequestFormV2 onSave={handleCreate} onCancel={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}

      {approvalTarget && (
        <ApprovalModalV2 request={approvalTarget}
          onApprove={handleApprove} onReject={handleReject}
          onClose={() => setApprovalTarget(null)} />
      )}

      {receptionTarget && (
        <ReceptionModal request={receptionTarget}
          onReceive={handleReceive}
          onClose={() => setReceptionTarget(null)} />
      )}
    </MainLayout>
  )
}