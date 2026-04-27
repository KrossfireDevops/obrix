// src/pages/admin/EmpresasPage.jsx
// Vista de gestión de empresas — exclusiva para super_admin

import { useState, useEffect } from 'react'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import { supabase }          from '../../config/supabase'
import {
  Building2, Users, CheckCircle, AlertTriangle,
  RefreshCw, Plus, Edit2, X, Save, Eye,
} from 'lucide-react'

const inp = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// MODAL: NUEVA / EDITAR EMPRESA
// ─────────────────────────────────────────────────────────────
const ModalEmpresa = ({ empresa, onGuardar, onClose }) => {
  const [form, setForm] = useState({
    name:   empresa?.name   || '',
    rfc:    empresa?.rfc    || '',
    plan:   empresa?.plan   || 'basic',
  })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      if (empresa?.id) {
        const { error } = await supabase
          .from('companies')
          .update({ name: form.name.trim(), updated_at: new Date().toISOString() })
          .eq('id', empresa.id)
        if (error) throw error
        toast.success('✅ Empresa actualizada')
      } else {
        const { error } = await supabase
          .from('companies')
          .insert({ name: form.name.trim(), created_at: new Date().toISOString() })
        if (error) throw error
        toast.success('✅ Empresa creada')
      }
      onGuardar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Building2 size={18} color="#2563EB" />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
              {empresa ? 'Editar Empresa' : 'Nueva Empresa'}
            </p>
          </div>
          <button onClick={onClose} style={{ padding: 5, border: 'none', background: 'none',
            cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Nombre de la empresa *
            </label>
            <input type="text" style={inp} placeholder="Ej: Constructora Ejemplo SA de CV"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              RFC (opcional)
            </label>
            <input type="text" style={inp} placeholder="Ej: CES123456XY1"
              value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
                background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                backgroundColor: saving ? '#93C5FD' : '#2563EB',
                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700 }}>
              {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function EmpresasPage() {
  const [empresas,  setEmpresas]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null) // null | 'nueva' | empresa
  const { toast } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          usuarios:users_profiles (
            id, full_name, role, is_active
          )
        `)
        .order('name', { ascending: true })
      if (error) throw error
      setEmpresas(data ?? [])
    } catch (e) {
      toast.error('Error al cargar empresas: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  return (
    <RequirePermission module="users_admin" action="view">
      <MainLayout title="🏢 Gestión de Empresas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} registrada{empresas.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => setModal('nueva')}
              style={{ display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 9, border: 'none',
                backgroundColor: '#2563EB', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={14} /> Nueva Empresa
            </button>
          </div>

          {/* Lista */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <RefreshCw size={24} color="#9CA3AF" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {empresas.map(emp => {
                const usuarios    = emp.usuarios ?? []
                const activos     = usuarios.filter(u => u.is_active).length
                const admins      = usuarios.filter(u => u.role === 'admin_empresa').length
                const superAdmins = usuarios.filter(u => u.role === 'super_admin').length

                return (
                  <div key={emp.id} style={{ backgroundColor: '#fff', borderRadius: 14,
                    border: '1px solid #E5E7EB', overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

                    {/* Header empresa */}
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: '#FAFAFA' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10,
                          backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center',
                          justifyContent: 'center' }}>
                          <Building2 size={18} color="#1D4ED8" />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
                            {emp.name}
                          </p>
                          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF', margin: '2px 0 0' }}>
                            {emp.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setModal(emp)}
                        style={{ padding: 6, border: 'none', backgroundColor: '#EFF6FF',
                          borderRadius: 7, cursor: 'pointer', color: '#2563EB' }}>
                        <Edit2 size={13} />
                      </button>
                    </div>

                    {/* Stats */}
                    <div style={{ padding: '12px 18px',
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        { label: 'Usuarios activos', value: activos,     color: '#065F46', bg: '#F0FDF4' },
                        { label: 'Administradores',  value: admins,      color: '#1D4ED8', bg: '#EFF6FF' },
                        { label: 'Super Admins',      value: superAdmins, color: '#7C3AED', bg: '#F5F3FF' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px',
                          backgroundColor: s.bg, borderRadius: 8 }}>
                          <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0 }}>
                            {s.value}
                          </p>
                          <p style={{ fontSize: 9, color: s.color, margin: '2px 0 0',
                            fontWeight: 600, opacity: 0.8, lineHeight: 1.2 }}>
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Usuarios */}
                    {usuarios.length > 0 && (
                      <div style={{ padding: '0 18px 14px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                          textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                          Usuarios
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {usuarios.slice(0, 5).map(u => (
                            <div key={u.id} style={{ display: 'flex', alignItems: 'center',
                              gap: 7, fontSize: 12 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                backgroundColor: u.is_active ? '#10B981' : '#EF4444' }} />
                              <span style={{ flex: 1, color: '#374151', fontWeight: 500 }}>
                                {u.full_name || '—'}
                              </span>
                              <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                                {u.role?.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                          {usuarios.length > 5 && (
                            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                              +{usuarios.length - 5} más
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal */}
        {modal && (
          <ModalEmpresa
            empresa={modal === 'nueva' ? null : modal}
            onGuardar={() => { setModal(null); cargar() }}
            onClose={() => setModal(null)}
          />
        )}

      </MainLayout>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </RequirePermission>
  )
}