// src/pages/admin/UsersAdmin.jsx
import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS, ROLES } from '../../config/permissions.config'
import * as usersService from '../../services/users.service'
import {
  Users, UserPlus, Edit2, Shield, ToggleLeft,
  ToggleRight, Search, Building2, Mail, Phone
} from 'lucide-react'

const ROLE_COLORS = {
  super_admin:   'bg-purple-100 text-purple-700',
  admin_empresa: 'bg-blue-100 text-blue-700',
  jefe_obra:     'bg-orange-100 text-orange-700',
  almacenista:   'bg-green-100 text-green-700',
  solicitante:   'bg-yellow-100 text-yellow-700',
  solo_lectura:  'bg-gray-100 text-gray-600',
}

// ── Modal Editar Usuario ──────────────────────────────────────────────────────
const EditUserModal = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone:     user?.phone     || '',
    role:      user?.role      || ROLES.SOLO_LECTURA,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onSave(user.id, formData)
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
        width: '100%', maxWidth: '480px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>✏️ Editar Usuario</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6b7280' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Info del usuario (solo lectura) */}
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '20px' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Usuario</p>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>{user?.email || '-'}</p>
          </div>

          {/* Nombre */}
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Nombre Completo</label>
            <input
              type="text"
              className="input-field"
              placeholder="Nombre del usuario"
              value={formData.full_name}
              onChange={(e) => setFormData(f => ({ ...f, full_name: e.target.value }))}
            />
          </div>

          {/* Teléfono */}
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Teléfono</label>
            <input
              type="text"
              className="input-field"
              placeholder="+52 33 0000 0000"
              value={formData.phone}
              onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
            />
          </div>

          {/* Rol */}
          <div style={{ marginBottom: '24px' }}>
            <label className="input-label">Rol del Sistema</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, role: value }))}
                  style={{
                    padding: '10px 12px', borderRadius: '10px', border: '2px solid',
                    borderColor: formData.role === value ? '#2563eb' : '#e5e7eb',
                    backgroundColor: formData.role === value ? '#eff6ff' : '#fff',
                    cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                    color: formData.role === value ? '#1d4ed8' : '#374151',
                    textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────
export const UsersAdmin = () => {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [editModal, setEditModal] = useState(null)
  const { toast }                 = useToast()
  const { userProfile }           = useAuth()

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data, error } = await usersService.getUsers()
    if (error) toast.error('Error al cargar usuarios')
    else setUsers(data || [])
    setLoading(false)
  }

  const handleSaveUser = async (userId, formData) => {
    const { error } = await usersService.updateUserProfile(userId, formData)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    toast.success('✅ Usuario actualizado')
    setEditModal(null)
    loadUsers()
  }

  const handleToggleActive = async (user) => {
    const { error } = await usersService.toggleUserActive(user.id, !user.is_active)
    if (error) { toast.error('Error al actualizar estado'); return }
    toast.success(`✅ Usuario ${!user.is_active ? 'activado' : 'desactivado'}`)
    loadUsers()
  }

  // Filtros
  const filteredUsers = users.filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = !filterRole || u.role === filterRole
    return matchSearch && matchRole
  })

  // Stats
  const stats = Object.keys(ROLE_LABELS).map(role => ({
    role,
    label: ROLE_LABELS[role],
    count: users.filter(u => u.role === role).length,
    color: ROLE_COLORS[role]
  }))

  return (
    <RequirePermission module="users_admin" action="view">
      <MainLayout title="👥 Administración de Usuarios">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Stats por rol ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {stats.map(s => (
              <div key={s.role} style={{
                backgroundColor: '#fff', borderRadius: '12px',
                border: '1px solid #e5e7eb', padding: '16px', textAlign: 'center'
              }}>
                <span style={{ fontSize: '11px' }} className={`px-2 py-1 rounded-full font-medium ${s.color}`}>
                  {s.label}
                </span>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: '8px 0 0' }}>
                  {s.count}
                </p>
              </div>
            ))}
          </div>

          {/* ── Filtros ── */}
          <div style={{
            backgroundColor: '#fff', borderRadius: '12px',
            border: '1px solid #e5e7eb', padding: '16px',
            display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center'
          }}>
            {/* Búsqueda */}
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', paddingLeft: '34px', paddingRight: '12px',
                  paddingTop: '8px', paddingBottom: '8px',
                  border: '1px solid #e5e7eb', borderRadius: '8px',
                  fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filtro por rol */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                padding: '8px 12px', border: '1px solid #e5e7eb',
                borderRadius: '8px', fontSize: '14px', outline: 'none',
                color: '#374151', backgroundColor: '#fff', cursor: 'pointer'
              }}
            >
              <option value="">Todos los roles</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, marginLeft: 'auto' }}>
              {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ── Tabla de usuarios ── */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No se encontraron usuarios</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    {['Usuario', 'Empresa', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => (
                    <tr key={user.id} style={{ borderBottom: idx < filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Usuario */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: '700', color: '#1d4ed8',
                            fontSize: '15px', flexShrink: 0
                          }}>
                            {(user.full_name || user.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                              {user.full_name || '—'}
                            </p>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                              {user.email || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={14} color="#9ca3af" />
                          <span style={{ fontSize: '13px', color: '#374151' }}>
                            {user.companies?.name || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Rol */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '500', padding: '4px 10px', borderRadius: '9999px' }}
                          className={ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '500', padding: '4px 10px', borderRadius: '9999px',
                          backgroundColor: user.is_active ? '#dcfce7' : '#fee2e2',
                          color: user.is_active ? '#166534' : '#991b1b'
                        }}>
                          {user.is_active ? '● Activo' : '● Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {/* Editar */}
                          <button
                            onClick={() => setEditModal(user)}
                            title="Editar usuario"
                            style={{
                              padding: '6px', borderRadius: '8px', border: 'none',
                              backgroundColor: '#eff6ff', color: '#2563eb',
                              cursor: 'pointer', transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* Activar/Desactivar — no puede desactivarse a sí mismo */}
                          {user.id !== userProfile?.id && (
                            <button
                              onClick={() => handleToggleActive(user)}
                              title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                              style={{
                                padding: '6px', borderRadius: '8px', border: 'none',
                                backgroundColor: user.is_active ? '#fef2f2' : '#f0fdf4',
                                color: user.is_active ? '#dc2626' : '#16a34a',
                                cursor: 'pointer', transition: 'background-color 0.15s'
                              }}
                            >
                              {user.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
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

      {/* Modal de edición */}
      {editModal && (
        <EditUserModal
          user={editModal}
          onSave={handleSaveUser}
          onClose={() => setEditModal(null)}
        />
      )}
    </RequirePermission>
  )
}