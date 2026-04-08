// src/config/permissions.config.js
// ============================================================================
// MATRIZ COMPLETA DE PERMISOS POR ROL
// Estructura: módulo → acciones → roles que pueden ejecutarlas
// ============================================================================

export const ROLES = {
  SUPER_ADMIN:    'super_admin',
  ADMIN_EMPRESA:  'admin_empresa',
  JEFE_OBRA:      'jefe_obra',
  ALMACENISTA:    'almacenista',
  SOLICITANTE:    'solicitante',
  SOLO_LECTURA:   'solo_lectura',
}

export const ROLE_LABELS = {
  super_admin:   '⚡ Super Admin',
  admin_empresa: '🏢 Admin Empresa',
  jefe_obra:     '👷 Jefe de Obra',
  almacenista:   '📦 Almacenista',
  solicitante:   '📝 Solicitante',
  solo_lectura:  '👁️ Solo Lectura',
}

// Jerarquía de roles (mayor índice = más privilegios)
export const ROLE_HIERARCHY = [
  'solo_lectura',
  'solicitante',
  'almacenista',
  'jefe_obra',
  'admin_empresa',
  'super_admin',
]

// ============================================================================
// PERMISOS POR MÓDULO Y ACCIÓN
// Cada permiso lista los roles que PUEDEN ejecutar esa acción
// ============================================================================
export const PERMISSIONS = {

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    view: ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura'],
  },

  // ── Proyectos ─────────────────────────────────────────────────────────────
  projects: {
    view:   ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura'],
    create: ['super_admin', 'admin_empresa', 'jefe_obra'],
    edit:   ['super_admin', 'admin_empresa', 'jefe_obra'],
    delete: ['super_admin', 'admin_empresa'],
  },

  // ── Árbol de Proyecto ─────────────────────────────────────────────────────
  project_tree: {
    view:     ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura'],
    create:   ['super_admin', 'admin_empresa', 'jefe_obra'],
    edit:     ['super_admin', 'admin_empresa', 'jefe_obra'],
    delete:   ['super_admin', 'admin_empresa'],
    validate: ['super_admin', 'admin_empresa', 'jefe_obra'],
  },

  // ── Inventario ────────────────────────────────────────────────────────────
  inventory: {
    view:   ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solo_lectura'],
    create: ['super_admin', 'admin_empresa', 'almacenista'],
    edit:   ['super_admin', 'admin_empresa', 'almacenista'],
    delete: ['super_admin', 'admin_empresa'],
  },

  // ── Materiales (Catálogo) ─────────────────────────────────────────────────
  materials: {
    view:   ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura'],
    create: ['super_admin', 'admin_empresa'],
    edit:   ['super_admin', 'admin_empresa'],
    delete: ['super_admin', 'admin_empresa'],
  },

  // ── Movimientos ───────────────────────────────────────────────────────────
  movements: {
    view:   ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solo_lectura'],
    create: ['super_admin', 'admin_empresa', 'almacenista'],
    edit:   ['super_admin', 'admin_empresa'],
    delete: ['super_admin', 'admin_empresa'],
    approve:['super_admin', 'admin_empresa', 'jefe_obra'],
  },

  // ── Reportes ──────────────────────────────────────────────────────────────
  reports: {
    view:   ['super_admin', 'admin_empresa', 'jefe_obra', 'solo_lectura'],
    export: ['super_admin', 'admin_empresa', 'jefe_obra'],
  },

  // ── Asistencia ────────────────────────────────────────────────────────────
  attendance: {
    view:   ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solo_lectura'],
    create: ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista'],
    edit:   ['super_admin', 'admin_empresa', 'jefe_obra'],
    delete: ['super_admin', 'admin_empresa'],
  },

  // ── Administración de Usuarios (solo Super Admin + Admin Empresa) ─────────
  users_admin: {
    view:   ['super_admin', 'admin_empresa'],
    create: ['super_admin', 'admin_empresa'],
    edit:   ['super_admin', 'admin_empresa'],
    delete: ['super_admin'],
    assign_role: ['super_admin'],
  },

  // ── Gestión de Materiales (Solicitudes) ──────────────────────────────────────
  materials_requests: {
    view:    ['super_admin', 'admin_empresa', 'jefe_obra', 'almacenista', 'solicitante', 'solo_lectura'],
    create:  ['super_admin', 'admin_empresa', 'jefe_obra', 'solicitante'],
    edit:    ['super_admin', 'admin_empresa', 'jefe_obra'],
    delete:  ['super_admin', 'admin_empresa'],
    approve: ['super_admin', 'admin_empresa', 'jefe_obra'],
    receive: ['super_admin', 'admin_empresa', 'almacenista'],
  },

  // ── Configuración ─────────────────────────────────────────────────────────
  settings: {
    view:   ['super_admin', 'admin_empresa'],
    edit:   ['super_admin', 'admin_empresa'],
  },
}

// ============================================================================
// MÓDULOS VISIBLES EN EL MENÚ POR ROL
// ============================================================================
export const MENU_ACCESS = {
  super_admin:   ['dashboard','projects','project_tree','inventory','materials','movements','reports','attendance','users_admin','settings'],
  admin_empresa: ['dashboard','projects','project_tree','inventory','materials','movements','reports','attendance','users_admin','settings'],
  jefe_obra:     ['dashboard','projects','project_tree','inventory','materials','movements','reports','attendance'],
  almacenista:   ['dashboard','projects','project_tree','inventory','movements','attendance'],
  solicitante:   ['dashboard','projects','project_tree','materials'],
  solo_lectura:  ['dashboard','projects','project_tree','reports'],
}

// ============================================================================
// HELPER: verificar si un rol tiene un permiso específico
// ============================================================================
export const hasPermission = (role, module, action) => {
  if (!role || !module || !action) return false
  if (role === ROLES.SUPER_ADMIN) return true  // Super Admin siempre tiene acceso
  return PERMISSIONS[module]?.[action]?.includes(role) ?? false
}

export const canAccessModule = (role, module) => {
  if (!role || !module) return false
  if (role === ROLES.SUPER_ADMIN) return true
  return MENU_ACCESS[role]?.includes(module) ?? false
}