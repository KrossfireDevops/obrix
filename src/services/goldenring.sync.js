// ============================================================
//  OBRIX GoldenRing — Motor de Sincronización
//  src/services/goldenring.sync.js
//
//  Responsabilidades:
//  · Leer la outbox (IndexedDB) e intentar subir a Supabase
//  · Aplicar reglas semánticas por módulo
//  · Detectar y registrar conflictos
//  · Manejar reintentos con backoff exponencial
//  · Cachear datos frescos cuando hay conexión
// ============================================================

import { supabase }          from '../config/supabase'
import {
  db,
  getPendientes,
  marcarSincronizando,
  marcarSincronizado,
  marcarError,
  marcarConflicto,
  guardarConflicto,
  guardarCacheProyectos,
  guardarCachePersonal,
  guardarCacheMateriales,
  guardarCacheGastosCfg,
  limpiarSincronizados,
} from './goldenring.db'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const MAX_INTENTOS    = 5
const SYNC_INTERVAL   = 30_000  // 30 segundos
const BACKOFF_BASE    = 2_000   // 2s en primer reintento

// ─────────────────────────────────────────────────────────────
// ESTADO GLOBAL DEL SYNC (singleton)
// ─────────────────────────────────────────────────────────────
let _syncTimer     = null
let _isSyncing     = false
let _listeners     = []    // callbacks para el SyncStatusBar

export function suscribirSyncStatus(cb) {
  _listeners.push(cb)
  return () => { _listeners = _listeners.filter(l => l !== cb) }
}

function notificar(estado) {
  _listeners.forEach(cb => cb(estado))
}

// ─────────────────────────────────────────────────────────────
// INICIALIZAR — llamar al montar la app
// ─────────────────────────────────────────────────────────────

export function iniciarGoldenRing() {
  // Escuchar cambios de conectividad
  window.addEventListener('online',  () => sincronizar())
  window.addEventListener('offline', () => notificarEstado())

  // Sync periódico
  _syncTimer = setInterval(() => {
    if (navigator.onLine) sincronizar()
  }, SYNC_INTERVAL)

  // Sync inmediato si hay conexión
  if (navigator.onLine) sincronizar()

  // Limpiar operaciones viejas
  limpiarSincronizados().catch(console.error)

  console.log('[GoldenRing] Iniciado ✓')
}

export function detenerGoldenRing() {
  if (_syncTimer) clearInterval(_syncTimer)
  window.removeEventListener('online',  sincronizar)
  window.removeEventListener('offline', notificarEstado)
}

// ─────────────────────────────────────────────────────────────
// NOTIFICAR ESTADO ACTUAL AL SyncStatusBar
// ─────────────────────────────────────────────────────────────

async function notificarEstado() {
  const pendientes  = await getPendientes()
  const conflictos  = pendientes.filter(p => p.status === 'conflict')
  const sinConflicto = pendientes.filter(p => p.status !== 'conflict')

  if (conflictos.length > 0) {
    notificar({ tipo: 'conflict', pendientes: sinConflicto.length, conflictos })
  } else if (sinConflicto.length > 0) {
    notificar({ tipo: 'pending', pendientes: sinConflicto.length })
  } else {
    notificar({ tipo: 'ok', ultimoSync: new Date() })
  }
}

// ─────────────────────────────────────────────────────────────
// SINCRONIZACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function sincronizar() {
  if (_isSyncing || !navigator.onLine) return
  _isSyncing = true

  try {
    const pendientes = await getPendientes()
    if (pendientes.length === 0) {
      notificar({ tipo: 'ok', ultimoSync: new Date() })
      // Aprovechar para refrescar cachés
      await refrescarCaches()
      return
    }

    notificar({ tipo: 'syncing', pendientes: pendientes.length })

    for (const op of pendientes) {
      // Skip si ya superó el máximo de intentos
      if (op.intentos >= MAX_INTENTOS) {
        await marcarError(op.id, 'Máximo de intentos alcanzado', false)
        continue
      }

      // Backoff: esperar más tiempo entre reintentos
      if (op.intentos > 0) {
        const wait = BACKOFF_BASE * Math.pow(2, op.intentos - 1)
        await new Promise(r => setTimeout(r, wait))
      }

      await marcarSincronizando(op.id)

      try {
        const payload = JSON.parse(op.payload)
        const resultado = await ejecutarOperacion(op.modulo, op.operacion, payload, op.client_uuid)

        if (resultado.status === 'conflict') {
          await marcarConflicto(op.id, resultado.detalle)
          await guardarConflicto(op.modulo, op.client_uuid, resultado)
        } else {
          await marcarSincronizado(op.id)
        }
      } catch (err) {
        console.error(`[GoldenRing] Error sincronizando op ${op.id}:`, err)
        await marcarError(op.id, err.message)
      }
    }

    await notificarEstado()
  } finally {
    _isSyncing = false
  }
}

// ─────────────────────────────────────────────────────────────
// EJECUTAR OPERACIÓN POR MÓDULO
// ─────────────────────────────────────────────────────────────

async function ejecutarOperacion(modulo, operacion, payload, client_uuid) {
  switch (modulo) {
    case 'avances':    return sincronizarAvance(payload, client_uuid)
    case 'materiales': return sincronizarSolicitudMaterial(payload, client_uuid)
    case 'asistencia': return sincronizarAsistencia(payload, client_uuid)
    case 'gastos':     return sincronizarGasto(payload, client_uuid)
    default:
      throw new Error(`Módulo desconocido: ${modulo}`)
  }
}

// ─────────────────────────────────────────────────────────────
// REGLAS SEMÁNTICAS POR MÓDULO
// ─────────────────────────────────────────────────────────────

/**
 * AVANCES DE OBRA
 * Regla: el avance nunca retrocede. Discrepancia >15% → alerta.
 * Usa la función SQL goldenring_registrar_avance() que aplica
 * las reglas en el servidor (no se pueden saltear desde el cliente).
 */
async function sincronizarAvance(payload, client_uuid) {
  const { data, error } = await supabase.rpc('goldenring_registrar_avance', {
    p_seccion_id:  payload.seccion_id,
    p_proyecto_id: payload.proyecto_id,
    p_user_id:     payload.user_id,
    p_company_id:  payload.company_id,
    p_pct_avance:  payload.pct_avance,
    p_notas:       payload.notas,
    p_tipo:        payload.tipo,
    p_client_uuid: client_uuid,
    p_device_id:   payload.device_id,
    p_created_at:  payload.created_at,
  })

  if (error) throw new Error(error.message)

  if (data.status === 'conflict_retroceso') {
    return {
      status:  'conflict',
      tipo:    'retroceso_avance',
      detalle: `Avance ${payload.pct_avance}% rechazado — el avance actual es ${data.pct_actual}%. No se puede retroceder sin autorización.`,
    }
  }

  if (data.discrepancia) {
    return {
      status:  'ok_con_alerta',
      tipo:    'discrepancia_avance',
      detalle: `Avance registrado pero hay discrepancia >15% con el último registro. Revisar en el panel de validación.`,
    }
  }

  return { status: 'ok', id: data.id }
}

/**
 * SOLICITUDES DE MATERIAL
 * Regla: NO hay conflicto real — las solicitudes son intenciones.
 * Solo se crea la solicitud en estado BORRADOR. El almacenista
 * decide si despacha cuando ve el stock real.
 */
async function sincronizarSolicitudMaterial(payload, client_uuid) {
  // Verificar idempotencia
  const { data: existing } = await supabase
    .from('material_requests')
    .select('id')
    .eq('client_uuid', client_uuid)
    .single()

  if (existing) return { status: 'already_exists', id: existing.id }

  const { data, error } = await supabase
    .from('material_requests')
    .insert({
      ...payload,
      client_uuid,
      created_offline: true,
      status: 'BORRADOR',   // siempre borrador al sincronizar
    })
    .select('id, folio')
    .single()

  if (error) throw new Error(error.message)
  return { status: 'ok', id: data.id, folio: data.folio }
}

/**
 * ASISTENCIA
 * Regla: deduplicación por worker_id + fecha + tipo.
 * Usa la función SQL goldenring_registrar_asistencia() para
 * detectar duplicados del lado del servidor.
 */
async function sincronizarAsistencia(payload, client_uuid) {
  const { data, error } = await supabase.rpc('goldenring_registrar_asistencia', {
    p_personnel_id: payload.personnel_id,
    p_company_id:   payload.company_id,
    p_project_id:   payload.project_id,
    p_date:         payload.attendance_date,
    p_status:       payload.status,
    p_client_uuid:  client_uuid,
    p_device_id:    payload.device_id,
    p_warehouse_id: payload.warehouse_id ?? null,
    p_created_at:   payload.created_at,
  })

  if (error) throw new Error(error.message)

  if (data.status === 'duplicado') {
    return {
      status:  'ok_con_alerta',
      tipo:    'duplicado_asistencia',
      detalle: `Asistencia duplicada detectada. El registro original se mantiene. El duplicado quedó en historial para auditoría.`,
    }
  }

  return { status: 'ok', id: data.id }
}

/**
 * GASTOS
 * Regla: idempotencia por client_uuid (UNIQUE en BD).
 * Si el worker reintenta, ON CONFLICT DO NOTHING en el servidor.
 * Los gastos offline solo se crean como BORRADOR.
 */
async function sincronizarGasto(payload, client_uuid) {
  const { data, error } = await supabase
    .from('gastos_registros')
    .insert({
      ...payload,
      client_uuid,
      created_offline: true,
      estatus: 'borrador',   // siempre borrador, el usuario envía manualmente
    })
    .select('id')
    .single()

  // Error de duplicado (client_uuid ya existe) → éxito silencioso
  if (error?.code === '23505') {
    const { data: existing } = await supabase
      .from('gastos_registros')
      .select('id')
      .eq('client_uuid', client_uuid)
      .single()
    return { status: 'already_exists', id: existing?.id }
  }

  if (error) throw new Error(error.message)

  // Si había imagen, intentar subirla ahora
  if (payload._imagen_base64) {
    await subirImagenGastoDiferida(data.id, payload._imagen_base64, payload._imagen_nombre)
  }

  return { status: 'ok', id: data.id }
}

// ─────────────────────────────────────────────────────────────
// SUBIDA DIFERIDA DE IMÁGENES
// ─────────────────────────────────────────────────────────────

async function subirImagenGastoDiferida(gastoId, base64, nombre) {
  try {
    const blob = base64ToBlob(base64)
    const path = `gastos/${gastoId}/${nombre}`
    await supabase.storage.from('gastos-comprobantes').upload(path, blob, {
      upsert: true,
      contentType: blob.type,
    })
  } catch (err) {
    console.warn('[GoldenRing] Error subiendo imagen diferida:', err)
    // No es fatal — el gasto ya se creó, la imagen se puede agregar después
  }
}

function base64ToBlob(base64) {
  const [header, data] = base64.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// ─────────────────────────────────────────────────────────────
// REFRESCO DE CACHÉS (cuando hay conexión)
// ─────────────────────────────────────────────────────────────

async function refrescarCaches() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) return
    const cid = profile.company_id

    // Proyectos activos
    const { data: proyectos } = await supabase
      .from('projects')
      .select('id, code, name, status')
      .eq('company_id', cid)
      .eq('status', 'active')

    if (proyectos?.length) await guardarCacheProyectos(proyectos)

    // Catálogo de materiales
    const { data: materiales } = await supabase
      .from('materials_catalog')
      .select('id, material_code, nombre, unidad, precio_compra')
      .eq('company_id', cid)
      .eq('is_active', true)
      .limit(500)

    if (materiales?.length) await guardarCacheMateriales(materiales, cid)

    // Configuración de gastos del usuario
    const { data: gastosCfg } = await supabase
      .from('gastos_perfiles')
      .select('*, gastos_perfiles_tipos(*, tipo:gastos_tipos_catalogo(*))')
      .eq('user_id', user.id)
      .single()

    if (gastosCfg) await guardarCacheGastosCfg(user.id, gastosCfg)

    console.log('[GoldenRing] Cachés refrescados ✓')
  } catch (err) {
    console.warn('[GoldenRing] Error refrescando cachés:', err)
  }
}

// Exportar para uso manual desde los módulos
export { refrescarCaches }
