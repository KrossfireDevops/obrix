// src/pages/admin/UsersAdmin.jsx
// v2.0 — Abril 2026
// Nuevo: Alta de usuario, Reset de contraseña, Puestos, Panel de Permisos

import { useState, useEffect } from 'react'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import { useAuth }           from '../../context/AuthContext'
import { ROLE_LABELS, ROLES } from '../../config/permissions.config'
import * as usersService     from '../../services/users.service'
import {
  Users, UserPlus, Edit2, Shield, ToggleLeft, ToggleRight,
  Search, Building2, KeyRound, CheckCircle, X, Eye, EyeOff,
  RefreshCw, Mail, Phone, Briefcase, ChevronDown, Lock,
  AlertTriangle, Info, Save, ShieldCheck,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Configuración de módulos para permisos
// ─────────────────────────────────────────────────────────────
const MODULOS_PERMISOS = [
  { id: 'dashboard',    label: 'Dashboard',            grupo: 'General'      },
  { id: 'projects',     label: 'Proyectos / WBS',      grupo: 'Obra'         },
  { id: 'attendance',   label: 'Asistencia',           grupo: 'Obra'         },
  { id: 'inventory',    label: 'Inventario',           grupo: 'Materiales'   },
  { id: 'movements',    label: 'Solicitudes Material', grupo: 'Materiales'   },
  { id: 'materials',    label: 'Catálogo Materiales',  grupo: 'Materiales'   },
  { id: 'compras',      label: 'Compras / OC',         grupo: 'Compras'      },
  { id: 'gastos',       label: 'Gastos',               grupo: 'Gastos'       },
  { id: 'gastos_admin', label: 'Config. Gastos',       grupo: 'Gastos'       },
  { id: 'comercial',    label: 'Comercial / Pipeline', grupo: 'Comercial'    },
  { id: 'facturacion',  label: 'Facturación CFDI',     grupo: 'Finanzas'     },
  { id: 'tesoreria',    label: 'Tesorería',            grupo: 'Finanzas'     },
  { id: 'fiscal',       label: 'Contabilidad / SAT',   grupo: 'Finanzas'     },
  { id: 'reports',      label: 'Reportes',             grupo: 'Análisis'     },
  { id: 'personal',     label: 'Gestión Personal',     grupo: 'RRHH'         },
  { id: 'settings',     label: 'Config. Empresa',      grupo: 'Admin'        },
  { id: 'users_admin',  label: 'Administrar Usuarios', grupo: 'Admin'        },
]

// Permisos por defecto según rol
const PERMISOS_POR_ROL = {
  admin_empresa: MODULOS_PERMISOS.reduce((a, m) => ({ ...a, [m.id]: { view: true, edit: true } }), {}),
  jefe_obra:     {
    dashboard: { view: true, edit: false }, projects: { view: true, edit: true },
    attendance: { view: true, edit: true }, inventory: { view: true, edit: true },
    movements:  { view: true, edit: true }, materials: { view: true, edit: false },
    compras:    { view: true, edit: false }, gastos:   { view: true, edit: true },
    reports:    { view: true, edit: false }, personal:  { view: true, edit: false },
  },
  almacenista: {
    dashboard: { view: true, edit: false }, inventory: { view: true, edit: true },
    movements: { view: true, edit: true },  materials: { view: true, edit: false },
    compras:   { view: true, edit: false },
  },
  solicitante: {
    dashboard: { view: true, edit: false }, movements: { view: true, edit: true },
    gastos:    { view: true, edit: true },
  },
  solo_lectura: MODULOS_PERMISOS.reduce((a, m) => ({ ...a, [m.id]: { view: true, edit: false } }), {}),
}

const ROLE_COLORS = {
  super_admin:   { bg: '#F3E8FF', color: '#7C3AED' },
  admin_empresa: { bg: '#DBEAFE', color: '#1D4ED8' },
  jefe_obra:     { bg: '#FED7AA', color: '#C2410C' },
  almacenista:   { bg: '#D1FAE5', color: '#065F46' },
  solicitante:   { bg: '#FEF3C7', color: '#B45309' },
  solo_lectura:  { bg: '#F3F4F6', color: '#6B7280' },
}

const inp = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// MODAL: NUEVO USUARIO
// ─────────────────────────────────────────────────────────────
const ModalNuevoUsuario = ({ companyId, onCreado, onClose }) => {
  const [form, setForm] = useState({
    fullName:  '',
    email:     '',
    password:  '',
    phone:     '',
    role:      'jefe_obra',
    puesto:    '',
  })
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [errores,    setErrores]    = useState({})
  const { toast } = useToast()

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrores(e => ({ ...e, [k]: null }))
  }

  const generarPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'
    const pass = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    set('password', pass)
    setShowPass(true)
  }

  const validar = () => {
    const e = {}
    if (!form.fullName.trim())  e.fullName = 'El nombre es obligatorio'
    if (!form.email.trim())     e.email    = 'El email es obligatorio'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
    if (!form.password || form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (!form.role)             e.role     = 'Selecciona un rol'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleCrear = async () => {
    if (!validar()) return
    setLoading(true)
    const { data, error } = await usersService.createUser({
      email:     form.email.trim().toLowerCase(),
      password:  form.password,
      fullName:  form.fullName.trim(),
      role:      form.role,
      puesto:    form.puesto || null,
      companyId,
      phone:     form.phone || null,
    })
    setLoading(false)
    if (error) {
      toast.error('Error al crear usuario: ' + (error.message ?? error))
      return
    }
    toast.success(`✅ Usuario ${form.fullName} creado correctamente`)
    onCreado(data)
  }

  const rolCfg = ROLE_COLORS[form.role] ?? { bg: '#F3F4F6', color: '#6B7280' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10,
              backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={18} color="#2563EB" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Nuevo Usuario</p>
              <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>Dar de alta en el sistema</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, border: 'none', background: 'none',
            cursor: 'pointer', color: '#9CA3AF', borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* Nombre + Puesto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Nombre completo *
              </label>
              <input type="text" style={{ ...inp, borderColor: errores.fullName ? '#FCA5A5' : '#E5E7EB' }}
                placeholder="Ej: Juan Pérez López"
                value={form.fullName} onChange={e => set('fullName', e.target.value)} />
              {errores.fullName && <p style={{ fontSize: 10, color: '#DC2626', margin: '3px 0 0' }}>{errores.fullName}</p>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Puesto
              </label>
              <select style={inp} value={form.puesto} onChange={e => set('puesto', e.target.value)}>
                <option value="">— Sin especificar —</option>
                {usersService.PUESTOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Correo electrónico *
            </label>
            <input type="email" style={{ ...inp, borderColor: errores.email ? '#FCA5A5' : '#E5E7EB' }}
              placeholder="correo@empresa.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
            {errores.email && <p style={{ fontSize: 10, color: '#DC2626', margin: '3px 0 0' }}>{errores.email}</p>}
          </div>

          {/* Teléfono */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Teléfono
            </label>
            <input type="text" style={inp} placeholder="33-1234-5678"
              value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Contraseña inicial *</label>
              <button onClick={generarPassword}
                style={{ fontSize: 10, color: '#2563EB', background: 'none', border: 'none',
                  cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <RefreshCw size={10} /> Generar automática
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'}
                style={{ ...inp, paddingRight: 40, fontFamily: showPass ? 'inherit' : 'monospace',
                  borderColor: errores.password ? '#FCA5A5' : '#E5E7EB',
                  letterSpacing: showPass ? 'normal' : '0.15em' }}
                placeholder="Mínimo 8 caracteres"
                value={form.password} onChange={e => set('password', e.target.value)} />
              <button onClick={() => setShowPass(!showPass)} type="button"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#9CA3AF' }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errores.password && <p style={{ fontSize: 10, color: '#DC2626', margin: '3px 0 0' }}>{errores.password}</p>}
            {form.password && !errores.password && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 8px', backgroundColor: '#F0FDF4', borderRadius: 6 }}>
                <CheckCircle size={11} color="#16A34A" />
                <p style={{ fontSize: 10, color: '#15803D', margin: 0 }}>
                  Comparte esta contraseña con el usuario — podrá cambiarla desde su perfil
                </p>
              </div>
            )}
          </div>

          {/* Rol */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Rol del sistema *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'super_admin').map(([value, label]) => {
                const cfg = ROLE_COLORS[value] ?? { bg: '#F3F4F6', color: '#6B7280' }
                const activo = form.role === value
                return (
                  <button key={value} type="button" onClick={() => set('role', value)}
                    style={{
                      padding: '9px 12px', borderRadius: 9, border: '2px solid',
                      borderColor: activo ? cfg.color : '#E5E7EB',
                      backgroundColor: activo ? cfg.bg : '#fff',
                      cursor: 'pointer', fontSize: 12, fontWeight: activo ? 700 : 500,
                      color: activo ? cfg.color : '#374151',
                      textAlign: 'left', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}>
                    <Shield size={12} color={activo ? cfg.color : '#9CA3AF'} />
                    {label}
                  </button>
                )
              })}
            </div>
            {errores.role && <p style={{ fontSize: 10, color: '#DC2626', margin: '3px 0 0' }}>{errores.role}</p>}
          </div>

          {/* Info del rol seleccionado */}
          <div style={{ marginTop: 10, padding: '8px 10px', backgroundColor: rolCfg.bg,
            borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Info size={13} color={rolCfg.color} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: rolCfg.color, margin: 0 }}>
              {form.role === 'admin_empresa' && 'Acceso completo a todos los módulos de la empresa.'}
              {form.role === 'jefe_obra'     && 'Gestiona proyectos, materiales, gastos y personal de obra.'}
              {form.role === 'almacenista'   && 'Controla inventario y solicitudes de materiales.'}
              {form.role === 'solicitante'   && 'Puede hacer solicitudes de material y registrar gastos.'}
              {form.role === 'solo_lectura'  && 'Solo puede consultar información, sin hacer cambios.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #F3F4F6',
          flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB',
              background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleCrear} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 9, border: 'none',
              backgroundColor: loading ? '#93C5FD' : '#2563EB',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700, transition: 'background 0.2s' }}>
            {loading
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creando…</>
              : <><UserPlus size={14} /> Crear Usuario</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MODAL: EDITAR USUARIO
// ─────────────────────────────────────────────────────────────
const ModalEditarUsuario = ({ user, onSave, onClose }) => {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone:     user?.phone     || '',
    puesto:    user?.puesto    || '',
    role:      user?.role      || ROLES.SOLO_LECTURA,
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleReset = async () => {
    if (!user?.email) return
    if (!confirm(`¿Enviar email de restablecimiento de contraseña a ${user.email}?`)) return
    const { error } = await usersService.sendPasswordReset(user.email)
    if (error) toast.error('Error al enviar reset: ' + error.message)
    else toast.success(`✅ Email de restablecimiento enviado a ${user.email}`)
  }

  const handleSubmit = async () => {
    setLoading(true)
    await onSave(user.id, form)
    setLoading(false)
  }

  const rolCfg = ROLE_COLORS[form.role] ?? { bg: '#F3F4F6', color: '#6B7280' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>

        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%',
              backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#1D4ED8' }}>
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
                {user?.full_name || '—'}
              </p>
              <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, border: 'none', background: 'none',
            cursor: 'pointer', color: '#9CA3AF', borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* Reset contraseña */}
          <div style={{ marginBottom: 16, padding: '10px 14px', backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={14} color="#B45309" />
              <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
                ¿El usuario olvidó su contraseña?
              </p>
            </div>
            <button onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 7, border: '1px solid #FDE68A', backgroundColor: '#FEF3C7',
                color: '#B45309', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap' }}>
              <Mail size={11} /> Enviar reset
            </button>
          </div>

          {/* Nombre */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Nombre completo
            </label>
            <input type="text" style={inp} value={form.full_name}
              onChange={e => set('full_name', e.target.value)} />
          </div>

          {/* Puesto + Teléfono */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Puesto
              </label>
              <select style={inp} value={form.puesto} onChange={e => set('puesto', e.target.value)}>
                <option value="">— Sin especificar —</option>
                {usersService.PUESTOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Teléfono
              </label>
              <input type="text" style={inp} value={form.phone}
                onChange={e => set('phone', e.target.value)} />
            </div>
          </div>

          {/* Rol */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Rol del sistema
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'super_admin').map(([value, label]) => {
                const cfg = ROLE_COLORS[value] ?? { bg: '#F3F4F6', color: '#6B7280' }
                const activo = form.role === value
                return (
                  <button key={value} type="button" onClick={() => set('role', value)}
                    style={{
                      padding: '8px 12px', borderRadius: 9, border: '2px solid',
                      borderColor: activo ? cfg.color : '#E5E7EB',
                      backgroundColor: activo ? cfg.bg : '#fff',
                      cursor: 'pointer', fontSize: 12, fontWeight: activo ? 700 : 500,
                      color: activo ? cfg.color : '#374151',
                      textAlign: 'left', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}>
                    <Shield size={12} color={activo ? cfg.color : '#9CA3AF'} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #F3F4F6',
          flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB',
              background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 9, border: 'none',
              backgroundColor: loading ? '#93C5FD' : '#2563EB',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700 }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
            {loading ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MODAL: PERMISOS POR MÓDULO
// ─────────────────────────────────────────────────────────────
const ModalPermisos = ({ user, onClose, toast }) => {
  const [permisos, setPermisos] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      // Cargar permisos guardados — si no hay, usar los del rol
      const { data } = await usersService.getPermisosUsuario(user.id)
      if (data && data.length > 0) {
        const map = data.reduce((a, p) => ({ ...a, [p.modulo]: p.acciones }), {})
        setPermisos(map)
      } else {
        // Aplicar permisos por defecto del rol
        setPermisos(PERMISOS_POR_ROL[user.role] ?? {})
      }
      setLoading(false)
    }
    cargar()
  }, [user.id, user.role])

  const togglePermiso = (moduloId, accion) => {
    setPermisos(prev => ({
      ...prev,
      [moduloId]: {
        ...(prev[moduloId] ?? { view: false, edit: false }),
        [accion]: !(prev[moduloId]?.[accion] ?? false),
        // Si se activa edit, activar view automáticamente
        ...(accion === 'edit' && !(prev[moduloId]?.edit) ? { view: true } : {}),
      },
    }))
  }

  const aplicarRol = () => {
    setPermisos(PERMISOS_POR_ROL[user.role] ?? {})
  }

  const handleGuardar = async () => {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(permisos).map(([modulo, acciones]) =>
          usersService.upsertPermisoUsuario(user.id, modulo, acciones)
        )
      )
      toast.success('✅ Permisos guardados correctamente')
      onClose()
    } catch (e) {
      toast.error('Error al guardar permisos: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Agrupar módulos
  const grupos = [...new Set(MODULOS_PERMISOS.map(m => m.grupo))]
  const rolCfg = ROLE_COLORS[user.role] ?? { bg: '#F3F4F6', color: '#6B7280' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #E5E7EB',
          flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10,
              backgroundColor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#7C3AED" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
                Permisos — {user.full_name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 9999,
                  backgroundColor: rolCfg.bg, color: rolCfg.color }}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>· permisos individuales</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, border: 'none', background: 'none',
            cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={18} />
          </button>
        </div>

        {/* Aviso */}
        <div style={{ padding: '10px 22px', flexShrink: 0, backgroundColor: '#FFFBEB',
          borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} color="#B45309" />
          <p style={{ fontSize: 11, color: '#B45309', margin: 0 }}>
            Los permisos individuales sobreescriben los del rol. Usa
            <button onClick={aplicarRol} style={{ marginLeft: 5, color: '#2563EB', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
              Restaurar permisos del rol
            </button>
            {' '}para volver a los valores por defecto.
          </p>
        </div>

        {/* Tabla de permisos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13 }}>Cargando permisos…</p>
            </div>
          ) : (
            grupos.map(grupo => {
              const modulosGrupo = MODULOS_PERMISOS.filter(m => m.grupo === grupo)
              return (
                <div key={grupo} style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                    {grupo}
                  </p>
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px',
                      padding: '6px 14px', backgroundColor: '#F9FAFB',
                      borderBottom: '1px solid #E5E7EB' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>MÓDULO</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textAlign: 'center' }}>VER</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textAlign: 'center' }}>EDITAR</span>
                    </div>
                    {modulosGrupo.map((mod, i) => {
                      const perm = permisos[mod.id] ?? { view: false, edit: false }
                      return (
                        <div key={mod.id}
                          style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px',
                            padding: '8px 14px', alignItems: 'center',
                            backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAFA',
                            borderBottom: i < modulosGrupo.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                            {mod.label}
                          </span>
                          {/* Toggle Ver */}
                          <div style={{ textAlign: 'center' }}>
                            <button onClick={() => togglePermiso(mod.id, 'view')}
                              style={{ padding: 5, border: 'none', background: 'none',
                                cursor: 'pointer', borderRadius: 6 }}>
                              {perm.view
                                ? <CheckCircle size={18} color="#16A34A" />
                                : <div style={{ width: 18, height: 18, borderRadius: '50%',
                                    border: '2px solid #D1D5DB', display: 'inline-block' }} />
                              }
                            </button>
                          </div>
                          {/* Toggle Editar */}
                          <div style={{ textAlign: 'center' }}>
                            <button onClick={() => togglePermiso(mod.id, 'edit')}
                              style={{ padding: 5, border: 'none', background: 'none',
                                cursor: 'pointer', borderRadius: 6 }}>
                              {perm.edit
                                ? <CheckCircle size={18} color="#2563EB" />
                                : <div style={{ width: 18, height: 18, borderRadius: '50%',
                                    border: '2px solid #D1D5DB', display: 'inline-block' }} />
                              }
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid #F3F4F6',
          flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB',
              background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 9, border: 'none',
              backgroundColor: saving ? '#93C5FD' : '#7C3AED',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700 }}>
            {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={14} />}
            {saving ? 'Guardando…' : 'Guardar Permisos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export const UsersAdmin = () => {
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterRole,  setFilterRole]  = useState('')
  const [modalNuevo,  setModalNuevo]  = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalPerms,  setModalPerms]  = useState(null)
  const { toast }                     = useToast()
  const { userProfile }               = useAuth()

  const companyId = userProfile?.company_id

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
    setModalEditar(null)
    loadUsers()
  }

  const handleToggleActive = async (user) => {
    const { error } = await usersService.toggleUserActive(user.id, !user.is_active)
    if (error) { toast.error('Error al actualizar estado'); return }
    toast.success(`✅ Usuario ${!user.is_active ? 'activado' : 'desactivado'}`)
    loadUsers()
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.puesto?.toLowerCase().includes(search.toLowerCase())
    const matchRole = !filterRole || u.role === filterRole
    return matchSearch && matchRole
  })

  // Stats
  const totalActivos = users.filter(u => u.is_active).length

  return (
    <RequirePermission module="users_admin" action="view">
      <MainLayout title="👥 Administración de Usuarios">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Header con botón Nuevo Usuario ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                {totalActivos} usuario{totalActivos !== 1 ? 's' : ''} activo{totalActivos !== 1 ? 's' : ''} · {users.length} total
              </p>
            </div>
            <button onClick={() => setModalNuevo(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10, border: 'none',
                backgroundColor: '#2563EB', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1D4ED8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563EB'}>
              <UserPlus size={15} />
              Nuevo Usuario
            </button>
          </div>

          {/* ── Stats por rol ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'super_admin').map(([role, label]) => {
              const count = users.filter(u => u.role === role).length
              const cfg = ROLE_COLORS[role] ?? { bg: '#F3F4F6', color: '#6B7280' }
              return (
                <div key={role}
                  onClick={() => setFilterRole(filterRole === role ? '' : role)}
                  style={{ backgroundColor: filterRole === role ? cfg.bg : '#fff',
                    borderRadius: 12, border: `1.5px solid ${filterRole === role ? cfg.color : '#E5E7EB'}`,
                    padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (filterRole !== role) e.currentTarget.style.borderColor = cfg.color }}
                  onMouseLeave={e => { if (filterRole !== role) e.currentTarget.style.borderColor = '#E5E7EB' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: cfg.color,
                    margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: filterRole === role ? cfg.color : '#111827', margin: 0 }}>
                    {count}
                  </p>
                </div>
              )
            })}
          </div>

          {/* ── Filtros ── */}
          <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
            padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input type="text" placeholder="Buscar por nombre, email o puesto…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inp, paddingLeft: 32 }} />
            </div>
            {filterRole && (
              <button onClick={() => setFilterRole('')}
                style={{ display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 8,
                  border: `1px solid ${ROLE_COLORS[filterRole]?.color ?? '#E5E7EB'}`,
                  backgroundColor: ROLE_COLORS[filterRole]?.bg ?? '#F3F4F6',
                  color: ROLE_COLORS[filterRole]?.color ?? '#6B7280',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <X size={11} /> {ROLE_LABELS[filterRole]}
              </button>
            )}
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, marginLeft: 'auto' }}>
              {filteredUsers.length} resultado{filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ── Tabla ── */}
          <div style={{ backgroundColor: '#fff', borderRadius: 12,
            border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
                <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
                  No se encontraron usuarios
                </p>
                <p style={{ fontSize: 12, margin: 0 }}>
                  {search ? 'Intenta con otro término de búsqueda' : 'Crea el primer usuario con "Nuevo Usuario"'}
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                    {['Usuario', 'Puesto', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '11px 16px',
                        fontSize: 11, fontWeight: 700, color: '#6B7280',
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => {
                    const cfg = ROLE_COLORS[user.role] ?? { bg: '#F3F4F6', color: '#6B7280' }
                    const puesto = usersService.PUESTOS.find(p => p.value === user.puesto)
                    return (
                      <tr key={user.id}
                        style={{ borderBottom: idx < filteredUsers.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>

                        {/* Usuario */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%',
                              backgroundColor: cfg.bg, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 700, color: cfg.color,
                              fontSize: 15, flexShrink: 0 }}>
                              {(user.full_name || user.email || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>
                                {user.full_name || '—'}
                              </p>
                              <p style={{ fontSize: 11, color: '#6B7280', margin: '1px 0 0',
                                display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Mail size={10} />
                                {user.email || '—'}
                              </p>
                              {user.phone && (
                                <p style={{ fontSize: 10, color: '#9CA3AF', margin: '1px 0 0',
                                  display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Phone size={9} /> {user.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Puesto */}
                        <td style={{ padding: '13px 16px' }}>
                          {puesto ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Briefcase size={12} color="#9CA3AF" />
                              <span style={{ fontSize: 12, color: '#374151' }}>{puesto.label}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>
                          )}
                        </td>

                        {/* Rol */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px',
                            borderRadius: 9999, backgroundColor: cfg.bg, color: cfg.color }}>
                            {ROLE_LABELS[user.role] || user.role}
                          </span>
                        </td>

                        {/* Estado */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px',
                            borderRadius: 9999,
                            backgroundColor: user.is_active ? '#DCFCE7' : '#FEE2E2',
                            color: user.is_active ? '#166534' : '#991B1B' }}>
                            {user.is_active ? '● Activo' : '● Inactivo'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {/* Editar */}
                            <button onClick={() => setModalEditar(user)} title="Editar usuario"
                              style={{ padding: 6, borderRadius: 7, border: 'none',
                                backgroundColor: '#EFF6FF', color: '#2563EB', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#DBEAFE'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#EFF6FF'}>
                              <Edit2 size={14} />
                            </button>

                            {/* Permisos */}
                            <button onClick={() => setModalPerms(user)} title="Gestionar permisos"
                              style={{ padding: 6, borderRadius: 7, border: 'none',
                                backgroundColor: '#F5F3FF', color: '#7C3AED', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#EDE9FE'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F5F3FF'}>
                              <ShieldCheck size={14} />
                            </button>

                            {/* Activar/Desactivar */}
                            {user.id !== userProfile?.id && (
                              <button onClick={() => handleToggleActive(user)}
                                title={user.is_active ? 'Desactivar' : 'Activar'}
                                style={{ padding: 6, borderRadius: 7, border: 'none',
                                  backgroundColor: user.is_active ? '#FEF2F2' : '#F0FDF4',
                                  color: user.is_active ? '#DC2626' : '#16A34A', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                {user.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
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

        {/* Modales */}
        {modalNuevo && (
          <ModalNuevoUsuario
            companyId={companyId}
            onCreado={() => { setModalNuevo(false); loadUsers() }}
            onClose={() => setModalNuevo(false)}
          />
        )}
        {modalEditar && (
          <ModalEditarUsuario
            user={modalEditar}
            onSave={handleSaveUser}
            onClose={() => setModalEditar(null)}
          />
        )}
        {modalPerms && (
          <ModalPermisos
            user={modalPerms}
            onClose={() => setModalPerms(null)}
            toast={toast}
          />
        )}

      </MainLayout>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </RequirePermission>
  )
}