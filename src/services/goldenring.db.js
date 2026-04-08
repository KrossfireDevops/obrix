// ============================================================
//  OBRIX GoldenRing — Base de Datos Local (IndexedDB)
//  src/services/goldenring.db.js
//
//  Usa Dexie.js como wrapper de IndexedDB.
//  Instalar: npm install dexie
//
//  Tablas locales:
//  · outbox          — operaciones pendientes de sincronizar
//  · cache_projects  — proyectos y secciones cacheados
//  · cache_personal  — personal asignado a obra (para Asistencia)
//  · cache_materiales— catálogo de materiales (para Solicitudes)
//  · cache_gastos_cfg— perfil de gasto y tipos (para Gastos)
//  · conflicts       — conflictos detectados al sincronizar
// ============================================================

import Dexie from 'dexie'

export const db = new Dexie('ObrixGoldenRing')

db.version(1).stores({
  // Cola de operaciones pendientes
  outbox: [
    '++id',          // autoincrement local
    'modulo',        // 'avances'|'materiales'|'asistencia'|'gastos'
    'operacion',     // 'create'|'update'
    'client_uuid',   // UUID generado en el dispositivo (idempotencia)
    'status',        // 'pendiente'|'sincronizando'|'ok'|'error'|'conflict'
    'intentos',      // número de reintentos
    'created_at',
    'synced_at',
  ].join(','),

  // Caché de proyectos + secciones (para Avances y Materiales)
  cache_projects: '++id, project_id, &project_id',

  // Caché de personal asignado por proyecto (para Asistencia)
  cache_personal: '++id, personnel_id, project_id',

  // Caché de catálogo de materiales (para Solicitudes)
  cache_materiales: '++id, material_id, company_id',

  // Caché de configuración de gastos (perfil + tipos)
  cache_gastos_cfg: '++id, user_id, &user_id',

  // Conflictos detectados localmente
  conflicts: '++id, modulo, client_uuid, resuelto',
})

// ─────────────────────────────────────────────────────────────
// OUTBOX — operaciones pendientes
// ─────────────────────────────────────────────────────────────

/**
 * Agrega una operación a la cola offline.
 * @param {string} modulo - 'avances'|'materiales'|'asistencia'|'gastos'
 * @param {string} operacion - 'create'|'update'
 * @param {object} payload - datos completos de la operación
 * @param {string} client_uuid - UUID único generado en el cliente
 */
export async function encolarOperacion(modulo, operacion, payload, client_uuid) {
  return db.outbox.add({
    modulo,
    operacion,
    client_uuid,
    payload: JSON.stringify(payload),
    status:   'pendiente',
    intentos: 0,
    error_msg: null,
    created_at: new Date().toISOString(),
    synced_at:  null,
  })
}

/** Todas las operaciones pendientes de sincronizar */
export async function getPendientes() {
  return db.outbox
    .where('status').anyOf(['pendiente', 'error'])
    .sortBy('created_at')
}

/** Contador de pendientes para el SyncStatusBar */
export async function contarPendientes() {
  return db.outbox.where('status').anyOf(['pendiente', 'error']).count()
}

/** Marcar como sincronizando (evita doble envío) */
export async function marcarSincronizando(id) {
  return db.outbox.update(id, { status: 'sincronizando' })
}

/** Marcar como OK tras sincronización exitosa */
export async function marcarSincronizado(id) {
  return db.outbox.update(id, {
    status: 'ok',
    synced_at: new Date().toISOString(),
  })
}

/** Marcar como error con mensaje */
export async function marcarError(id, msg, incrementarIntentos = true) {
  const item = await db.outbox.get(id)
  return db.outbox.update(id, {
    status:    'error',
    error_msg: msg,
    intentos:  incrementarIntentos ? (item?.intentos ?? 0) + 1 : item?.intentos ?? 0,
  })
}

/** Marcar como conflicto detectado en el servidor */
export async function marcarConflicto(id, detalle) {
  return db.outbox.update(id, {
    status:    'conflict',
    error_msg: detalle,
    synced_at: new Date().toISOString(),
  })
}

/** Limpiar operaciones ya sincronizadas (> 7 días) */
export async function limpiarSincronizados() {
  const hace7dias = new Date()
  hace7dias.setDate(hace7dias.getDate() - 7)
  return db.outbox
    .where('status').equals('ok')
    .and(item => new Date(item.synced_at) < hace7dias)
    .delete()
}

// ─────────────────────────────────────────────────────────────
// CACHÉ — proyectos y secciones
// ─────────────────────────────────────────────────────────────

export async function guardarCacheProyectos(proyectos) {
  await db.cache_projects.clear()
  return db.cache_projects.bulkAdd(
    proyectos.map(p => ({
      project_id: p.id,
      data: JSON.stringify(p),
      cached_at: new Date().toISOString(),
    }))
  )
}

export async function getCacheProyectos() {
  const items = await db.cache_projects.toArray()
  return items.map(i => JSON.parse(i.data))
}

// ─────────────────────────────────────────────────────────────
// CACHÉ — personal de obra
// ─────────────────────────────────────────────────────────────

export async function guardarCachePersonal(personal, projectId) {
  await db.cache_personal.where('project_id').equals(projectId).delete()
  return db.cache_personal.bulkAdd(
    personal.map(p => ({
      personnel_id: p.id,
      project_id:   projectId,
      data: JSON.stringify(p),
      cached_at: new Date().toISOString(),
    }))
  )
}

export async function getCachePersonal(projectId) {
  const items = await db.cache_personal
    .where('project_id').equals(projectId)
    .toArray()
  return items.map(i => JSON.parse(i.data))
}

// ─────────────────────────────────────────────────────────────
// CACHÉ — catálogo de materiales
// ─────────────────────────────────────────────────────────────

export async function guardarCacheMateriales(materiales, companyId) {
  await db.cache_materiales.where('company_id').equals(companyId).delete()
  return db.cache_materiales.bulkAdd(
    materiales.map(m => ({
      material_id: m.id,
      company_id:  companyId,
      data: JSON.stringify(m),
      cached_at: new Date().toISOString(),
    }))
  )
}

export async function getCacheMateriales(companyId) {
  const items = await db.cache_materiales
    .where('company_id').equals(companyId)
    .toArray()
  return items.map(i => JSON.parse(i.data))
}

// ─────────────────────────────────────────────────────────────
// CACHÉ — configuración de gastos
// ─────────────────────────────────────────────────────────────

export async function guardarCacheGastosCfg(userId, cfg) {
  await db.cache_gastos_cfg.where('user_id').equals(userId).delete()
  return db.cache_gastos_cfg.add({
    user_id:   userId,
    data:      JSON.stringify(cfg),
    cached_at: new Date().toISOString(),
  })
}

export async function getCacheGastosCfg(userId) {
  const item = await db.cache_gastos_cfg
    .where('user_id').equals(userId)
    .first()
  return item ? JSON.parse(item.data) : null
}

// ─────────────────────────────────────────────────────────────
// CONFLICTOS locales
// ─────────────────────────────────────────────────────────────

export async function guardarConflicto(modulo, client_uuid, detalle) {
  return db.conflicts.add({
    modulo,
    client_uuid,
    detalle: JSON.stringify(detalle),
    resuelto:   false,
    created_at: new Date().toISOString(),
  })
}

export async function getConflictosNoResueltos() {
  return db.conflicts.where('resuelto').equals(0).toArray()
}

export async function marcarConflictoResuelto(id) {
  return db.conflicts.update(id, { resuelto: true })
}
