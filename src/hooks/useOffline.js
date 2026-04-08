// ============================================================
//  OBRIX GoldenRing — Hook useOffline
//  src/hooks/useOffline.js
//
//  Interfaz unificada para los 4 módulos GoldenRing.
//  Cada módulo usa este hook para:
//  · Saber si hay conexión
//  · Encolar operaciones offline
//  · Obtener datos del caché cuando no hay internet
//  · Recibir el estado del Outbox (pendientes/conflictos)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 }    from 'uuid'
import { sincronizar, suscribirSyncStatus } from '../services/goldenring.sync'
import {
  encolarOperacion,
  getCacheProyectos,
  getCachePersonal,
  getCacheMateriales,
  getCacheGastosCfg,
  contarPendientes,
  getConflictosNoResueltos,
} from '../services/goldenring.db'

// ─────────────────────────────────────────────────────────────
// DEVICE ID — identificador único del dispositivo
// ─────────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem('obrix_device_id')
  if (!id) {
    id = uuidv4()
    localStorage.setItem('obrix_device_id', id)
  }
  return id
}

const DEVICE_ID = getDeviceId()

// ─────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function useOffline() {
  const [isOnline,      setIsOnline]      = useState(navigator.onLine)
  const [syncStatus,    setSyncStatus]    = useState({ tipo: 'ok' })
  const [pendientes,    setPendientes]    = useState(0)
  const [conflictos,    setConflictos]    = useState([])

  // Escuchar conectividad
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  sincronizar() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Escuchar estado del sync
  useEffect(() => {
    const unsub = suscribirSyncStatus(async (estado) => {
      setSyncStatus(estado)
      setPendientes(await contarPendientes())
      setConflictos(await getConflictosNoResueltos())
    })
    // Estado inicial
    contarPendientes().then(setPendientes)
    getConflictosNoResueltos().then(setConflictos)
    return unsub
  }, [])

  // ── API para los módulos ──────────────────────────────────

  /**
   * Registrar un avance de obra offline.
   * Si hay internet, sincroniza inmediatamente.
   * Si no hay, encola para sincronizar después.
   */
  const registrarAvanceOffline = useCallback(async (datos) => {
    const client_uuid = uuidv4()
    const payload = {
      ...datos,
      device_id:  DEVICE_ID,
      client_uuid,
      created_at: new Date().toISOString(),
    }
    const id = await encolarOperacion('avances', 'create', payload, client_uuid)
    if (isOnline) sincronizar()
    return { id_local: id, client_uuid, guardado: 'local' }
  }, [isOnline])

  /**
   * Crear solicitud de material offline.
   */
  const crearSolicitudOffline = useCallback(async (datos) => {
    const client_uuid = uuidv4()
    const payload = {
      ...datos,
      client_uuid,
      created_at: new Date().toISOString(),
    }
    const id = await encolarOperacion('materiales', 'create', payload, client_uuid)
    if (isOnline) sincronizar()
    return { id_local: id, client_uuid, guardado: 'local' }
  }, [isOnline])

  /**
   * Registrar asistencia offline.
   */
  const registrarAsistenciaOffline = useCallback(async (datos) => {
    const client_uuid = uuidv4()
    const payload = {
      ...datos,
      device_id:  DEVICE_ID,
      client_uuid,
      created_at: new Date().toISOString(),
    }
    const id = await encolarOperacion('asistencia', 'create', payload, client_uuid)
    if (isOnline) sincronizar()
    return { id_local: id, client_uuid, guardado: 'local' }
  }, [isOnline])

  /**
   * Registrar gasto offline.
   * Si hay imagen adjunta, se guarda como base64 en el payload
   * y se sube al storage cuando se recupere la conexión.
   */
  const registrarGastoOffline = useCallback(async (datos, imagenBase64 = null, imagenNombre = null) => {
    const client_uuid = uuidv4()
    const payload = {
      ...datos,
      client_uuid,
      created_at: new Date().toISOString(),
      // Imagen diferida — solo si no hay conexión
      ...(imagenBase64 && !isOnline
        ? { _imagen_base64: imagenBase64, _imagen_nombre: imagenNombre }
        : {}
      ),
    }
    const id = await encolarOperacion('gastos', 'create', payload, client_uuid)
    if (isOnline) sincronizar()
    return { id_local: id, client_uuid, guardado: 'local' }
  }, [isOnline])

  // ── Acceso a cachés ───────────────────────────────────────

  const getProyectosCache   = useCallback(() => getCacheProyectos(), [])
  const getPersonalCache    = useCallback((pid) => getCachePersonal(pid), [])
  const getMaterialesCache  = useCallback((cid) => getCacheMateriales(cid), [])
  const getGastosCfgCache   = useCallback((uid) => getCacheGastosCfg(uid), [])

  // ── Sync manual ───────────────────────────────────────────

  const syncManual = useCallback(() => {
    if (isOnline) sincronizar()
  }, [isOnline])

  return {
    // Estado de conectividad
    isOnline,
    deviceId: DEVICE_ID,

    // Estado del Outbox
    syncStatus,
    pendientes,
    conflictos,

    // Operaciones offline por módulo
    registrarAvanceOffline,
    crearSolicitudOffline,
    registrarAsistenciaOffline,
    registrarGastoOffline,

    // Caché
    getProyectosCache,
    getPersonalCache,
    getMaterialesCache,
    getGastosCfgCache,

    // Sync manual
    syncManual,
  }
}
