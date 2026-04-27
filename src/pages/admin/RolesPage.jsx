// src/pages/admin/RolesPage.jsx
// Vista de la matriz de permisos por rol — solo lectura con indicadores visuales
// El super_admin puede ajustar permisos individuales desde UsersAdmin

import { useState } from 'react'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { PERMISSIONS, ROLE_LABELS, ROLES, MENU_ACCESS } from '../../config/permissions.config'
import { usePermission } from '../../hooks/usePermission'
import { CheckCircle, X, Shield, Info } from 'lucide-react'

const ROLE_COLORS = {
  super_admin:   { bg: '#F3E8FF', color: '#7C3AED', border: '#DDD6FE' },
  admin_empresa: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  jefe_obra:     { bg: '#FED7AA', color: '#C2410C', border: '#FDBA74' },
  almacenista:   { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  solicitante:   { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  solo_lectura:  { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
}

const ACCIONES_LABELS = {
  view:        'Ver',
  create:      'Crear',
  edit:        'Editar',
  delete:      'Eliminar',
  approve:     'Aprobar',
  export:      'Exportar',
  sync:        'Sincronizar',
  timbrar:     'Timbrar',
  conciliar:   'Conciliar',
  receive:     'Recibir',
  validate:    'Validar',
  assign_role: 'Asignar Rol',
}

const GRUPOS_MODULOS = [
  { label: 'General',     modulos: ['dashboard'] },
  { label: 'Obra',        modulos: ['projects', 'project_tree', 'attendance'] },
  { label: 'Personal',    modulos: ['personal'] },
  { label: 'Materiales',  modulos: ['inventory', 'materials', 'movements', 'materials_requests'] },
  { label: 'Compras',     modulos: ['compras'] },
  { label: 'Gastos',      modulos: ['gastos', 'gastos_admin'] },
  { label: 'Comercial',   modulos: ['comercial'] },
  { label: 'Facturación', modulos: ['facturacion'] },
  { label: 'Tesorería',   modulos: ['tesoreria'] },
  { label: 'Finanzas',    modulos: ['fiscal'] },
  { label: 'Reportes',    modulos: ['reports'] },
  { label: 'Admin',       modulos: ['settings', 'users_admin'] },
]

const ROLES_ORDEN = ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura']

export default function RolesPage() {
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [grupoActivo, setGrupoActivo] = useState('Obra')
  const { isSuperAdmin } = usePermission()

  const modulosDelGrupo = GRUPOS_MODULOS.find(g => g.label === grupoActivo)?.modulos ?? []

  return (
    <RequirePermission module="users_admin" action="view">
      <MainLayout title="🛡️ Roles y Permisos">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header informativo */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 16px', backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE', borderRadius: 12 }}>
            <Info size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', margin: '0 0 3px' }}>
                Matriz de Permisos por Rol
              </p>
              <p style={{ fontSize: 12, color: '#3B82F6', margin: 0 }}>
                Define qué puede ver y hacer cada rol en el sistema.
                Los permisos individuales por usuario se gestionan desde
                <strong> Administración → Usuarios → ícono 🛡️</strong>.
                {isSuperAdmin && ' Como Super Admin puedes ver la matriz completa.'}
              </p>
            </div>
          </div>

          {/* Tarjetas de roles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {ROLES_ORDEN.map(rol => {
              const cfg = ROLE_COLORS[rol] ?? ROLE_COLORS.solo_lectura
              const modulos = MENU_ACCESS[rol]?.length ?? 0
              const activo = rolSeleccionado === rol
              return (
                <div key={rol}
                  onClick={() => setRolSeleccionado(activo ? null : rol)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${activo ? cfg.color : cfg.border}`,
                    backgroundColor: activo ? cfg.bg : '#fff',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Shield size={14} color={cfg.color} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
                      {ROLE_LABELS[rol]}
                    </span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: cfg.color, margin: 0 }}>
                    {modulos === 0 ? '∞' : modulos}
                  </p>
                  <p style={{ fontSize: 10, color: cfg.color, margin: '2px 0 0', opacity: 0.8 }}>
                    {modulos === 0 ? 'Acceso total' : `módulos visibles`}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Tabla de permisos */}
          <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden' }}>

            {/* Tabs de grupos */}
            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB' }}>
              {GRUPOS_MODULOS.map(g => (
                <button key={g.label} onClick={() => setGrupoActivo(g.label)}
                  style={{
                    padding: '10px 16px', border: 'none', whiteSpace: 'nowrap',
                    borderBottom: `2px solid ${grupoActivo === g.label ? '#2563EB' : 'transparent'}`,
                    backgroundColor: 'transparent',
                    color: grupoActivo === g.label ? '#2563EB' : '#6B7280',
                    fontSize: 12, fontWeight: grupoActivo === g.label ? 700 : 500,
                    cursor: 'pointer',
                  }}>
                  {g.label}
                </button>
              ))}
            </div>

            {/* Matriz */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11,
                      fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
                      letterSpacing: '0.06em', minWidth: 160 }}>
                      Módulo / Acción
                    </th>
                    {(rolSeleccionado ? [rolSeleccionado] : ROLES_ORDEN).map(rol => {
                      const cfg = ROLE_COLORS[rol] ?? ROLE_COLORS.solo_lectura
                      return (
                        <th key={rol} style={{ textAlign: 'center', padding: '10px 12px',
                          fontSize: 11, fontWeight: 700, color: cfg.color,
                          backgroundColor: cfg.bg, minWidth: 90 }}>
                          {ROLE_LABELS[rol]?.replace(/^[^ ]+ /, '')}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {modulosDelGrupo.map((moduloId, mIdx) => {
                    const acciones = PERMISSIONS[moduloId]
                    if (!acciones) return null
                    const accionesKeys = Object.keys(acciones)
                    const rolesAMostrar = rolSeleccionado ? [rolSeleccionado] : ROLES_ORDEN

                    return accionesKeys.map((accion, aIdx) => {
                      const esUltimaAccion = aIdx === accionesKeys.length - 1
                      const esUltimoModulo = mIdx === modulosDelGrupo.length - 1
                      return (
                        <tr key={`${moduloId}-${accion}`}
                          style={{
                            borderBottom: esUltimaAccion && !esUltimoModulo
                              ? '2px solid #E5E7EB'
                              : '1px solid #F3F4F6',
                            backgroundColor: mIdx % 2 === 0 ? '#fff' : '#FAFAFA',
                          }}>
                          <td style={{ padding: '7px 16px' }}>
                            {aIdx === 0 && (
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                                margin: '0 0 2px', textTransform: 'uppercase',
                                letterSpacing: '0.04em' }}>
                                {moduloId.replace(/_/g, ' ')}
                              </p>
                            )}
                            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: aIdx === 0 ? 0 : 0 }}>
                              {ACCIONES_LABELS[accion] ?? accion}
                            </span>
                          </td>
                          {rolesAMostrar.map(rol => {
                            const cfg = ROLE_COLORS[rol] ?? ROLE_COLORS.solo_lectura
                            // super_admin siempre tiene acceso
                            const tieneAcceso = rol === 'super_admin'
                              ? true
                              : acciones[accion]?.includes(rol) ?? false
                            return (
                              <td key={rol} style={{ textAlign: 'center', padding: '7px 12px' }}>
                                {tieneAcceso ? (
                                  <CheckCircle size={16} color={cfg.color} />
                                ) : (
                                  <X size={14} color="#E5E7EB" />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} color="#2563EB" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Tiene permiso</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={14} color="#E5E7EB" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Sin acceso — módulo no visible</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#7C3AED" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Super Admin — acceso total siempre</span>
            </div>
          </div>

        </div>
      </MainLayout>
    </RequirePermission>
  )
}