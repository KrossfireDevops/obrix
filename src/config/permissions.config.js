// src/config/permissions.config.js
// v2.0 — Abril 2026
// Actualizado con todos los módulos de OBRIX:
// Comercial, Facturación, Tesorería, Contabilidad, Gastos,
// Compras, Personal, Programa de Obra, Calendarios, Relaciones

// ============================================================================
// ROLES
// ============================================================================
export const ROLES = {
  SUPER_ADMIN:   'super_admin',
  ADMIN_EMPRESA: 'admin_empresa',
  JEFE_OBRA:     'jefe_obra',
  ALMACENISTA:   'almacenista',
  SOLICITANTE:   'solicitante',
  SOLO_LECTURA:  'solo_lectura',
}

export const ROLE_LABELS = {
  super_admin:   '⚡ Super Admin',
  admin_empresa: '🏢 Admin Empresa',
  jefe_obra:     '👷 Jefe de Obra',
  almacenista:   '📦 Almacenista',
  solicitante:   '📝 Solicitante',
  solo_lectura:  '👁️ Solo Lectura',
}

export const ROLE_HIERARCHY = [
  'solo_lectura',
  'solicitante',
  'almacenista',
  'jefe_obra',
  'admin_empresa',
  'super_admin',
]

// Roles con acceso completo sin restricciones
const ADMINS = ['super_admin', 'admin_empresa']
const ALL    = ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura']
const STAFF  = ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante']
const OPS    = ['super_admin', 'admin_empresa', 'jefe_obra']
const MGMT   = ['super_admin', 'admin_empresa', 'jefe_obra', 'solo_lectura']

// ============================================================================
// PERMISOS POR MÓDULO
// ============================================================================
export const PERMISSIONS = {

  // ── General ───────────────────────────────────────────────
  dashboard:    { view: ALL },

  // ── Operación de Obra ─────────────────────────────────────
  projects: {
    view:   ALL,
    create: OPS,
    edit:   OPS,
    delete: ADMINS,
  },
  project_tree: {
    view:     ALL,
    create:   OPS,
    edit:     OPS,
    delete:   ADMINS,
    validate: OPS,
  },
  attendance: {
    view:   MGMT,
    create: [...OPS, 'almacenista'],
    edit:   OPS,
    delete: ADMINS,
  },

  // ── Personal ──────────────────────────────────────────────
  personal: {
    view:   ADMINS,
    create: ADMINS,
    edit:   ADMINS,
    delete: ADMINS,
  },

  // ── Materiales ────────────────────────────────────────────
  inventory: {
    view:   [...MGMT, 'almacenista'],
    create: [...ADMINS, 'almacenista'],
    edit:   [...ADMINS, 'almacenista'],
    delete: ADMINS,
  },
  materials: {
    view:   ALL,
    create: ADMINS,
    edit:   ADMINS,
    delete: ADMINS,
  },
  movements: {
    view:    [...MGMT, 'almacenista'],
    create:  [...ADMINS, 'almacenista'],
    edit:    ADMINS,
    delete:  ADMINS,
    approve: OPS,
    receive: [...ADMINS, 'almacenista'],
  },
  materials_requests: {
    view:    ALL,
    create:  STAFF,
    edit:    OPS,
    delete:  ADMINS,
    approve: OPS,
    receive: [...ADMINS, 'almacenista'],
  },

  // ── Compras ───────────────────────────────────────────────
  compras: {
    view:   [...MGMT, 'almacenista'],
    create: ADMINS,
    edit:   ADMINS,
    delete: ADMINS,
    approve:ADMINS,
  },

  // ── Gastos ────────────────────────────────────────────────
  gastos: {
    view:    ALL,
    create:  STAFF,
    edit:    OPS,
    delete:  ADMINS,
    approve: ADMINS,
  },
  gastos_admin: {
    view:  ADMINS,
    edit:  ADMINS,
  },

  // ── Comercial ─────────────────────────────────────────────
  comercial: {
    view:   [...MGMT, 'solicitante'],
    create: ADMINS,
    edit:   ADMINS,
    delete: ADMINS,
  },

  // ── Facturación ───────────────────────────────────────────
  facturacion: {
    view:   ADMINS,
    create: ADMINS,
    edit:   ADMINS,
    delete: ADMINS,
    timbrar:ADMINS,
  },

  // ── Tesorería ─────────────────────────────────────────────
  tesoreria: {
    view:       ADMINS,
    create:     ADMINS,
    edit:       ADMINS,
    delete:     ADMINS,
    conciliar:  ADMINS,
  },

  // ── Finanzas / Contabilidad ───────────────────────────────
  fiscal: {
    view:   ADMINS,
    create: ADMINS,
    edit:   ADMINS,
    delete: ADMINS,
    sync:   ADMINS,
  },

  // ── Reportes ──────────────────────────────────────────────
  reports: {
    view:   MGMT,
    export: OPS,
  },

  // ── Configuración ─────────────────────────────────────────
  settings: {
    view: ADMINS,
    edit: ADMINS,
  },

  // ── Administración de Usuarios ────────────────────────────
  users_admin: {
    view:        ADMINS,
    create:      ADMINS,
    edit:        ADMINS,
    delete:      ['super_admin'],
    assign_role: ['super_admin'],
  },
}

// ============================================================================
// MÓDULOS VISIBLES EN EL MENÚ POR ROL
// ============================================================================
export const MENU_ACCESS = {

  super_admin: [
    // General
    'dashboard',
    // Obra
    'projects', 'project_tree', 'attendance',
    // Personal
    'personal',
    // Materiales
    'inventory', 'materials', 'movements', 'materials_requests',
    // Compras
    'compras',
    // Gastos
    'gastos', 'gastos_admin',
    // Comercial
    'comercial',
    // Facturación
    'facturacion',
    // Tesorería
    'tesoreria',
    // Finanzas
    'fiscal',
    // Reportes
    'reports',
    // Admin
    'settings', 'users_admin',
  ],

  admin_empresa: [
    'dashboard',
    'projects', 'project_tree', 'attendance',
    'personal',
    'inventory', 'materials', 'movements', 'materials_requests',
    'compras',
    'gastos', 'gastos_admin',
    'comercial',
    'facturacion',
    'tesoreria',
    'fiscal',
    'reports',
    'settings', 'users_admin',
  ],

  jefe_obra: [
    'dashboard',
    'projects', 'project_tree', 'attendance',
    'personal',
    'inventory', 'materials', 'movements', 'materials_requests',
    'compras',
    'gastos',
    'reports',
  ],

  almacenista: [
    'dashboard',
    'projects', 'project_tree',
    'inventory', 'movements', 'materials_requests',
    'attendance',
  ],

  solicitante: [
    'dashboard',
    'projects', 'project_tree',
    'materials', 'materials_requests',
    'gastos',
    'comercial',
  ],

  solo_lectura: [
    'dashboard',
    'projects', 'project_tree',
    'reports',
  ],
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verifica si un rol tiene permiso para una acción en un módulo.
 * El super_admin siempre tiene acceso a todo.
 */
export const hasPermission = (role, module, action) => {
  if (!role || !module || !action) return false
  if (role === ROLES.SUPER_ADMIN) return true
  return PERMISSIONS[module]?.[action]?.includes(role) ?? false
}

/**
 * Verifica si un rol puede acceder a un módulo del menú.
 * El super_admin siempre puede acceder a todo.
 */
export const canAccessModule = (role, module) => {
  if (!role || !module) return false
  if (role === ROLES.SUPER_ADMIN) return true
  return MENU_ACCESS[role]?.includes(module) ?? false
}

/**
 * Retorna todos los módulos accesibles para un rol.
 */
export const getModulosAccesibles = (role) => {
  if (!role) return []
  if (role === ROLES.SUPER_ADMIN) return Object.keys(PERMISSIONS)
  return MENU_ACCESS[role] ?? []
}

/**
 * Verifica si un rol es igual o superior a otro en la jerarquía.
 */
export const rolTieneJerarquia = (rolActual, rolMinimo) => {
  const idxActual  = ROLE_HIERARCHY.indexOf(rolActual)
  const idxMinimo  = ROLE_HIERARCHY.indexOf(rolMinimo)
  if (idxActual === -1) return false
  return idxActual >= idxMinimo
}