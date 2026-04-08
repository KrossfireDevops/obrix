// ============================================================
//  OBRIX ERP — Servicio: Incidencias de Personal
//  src/services/incidencias.service.js  |  v1.0
// ============================================================

import { supabase } from '../config/supabase'

const BUCKET_INCIDENCIAS = 'incidencias-personal'

async function getCtx() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id, full_name')
    .eq('id', user.id)
    .single()
  return { companyId: data?.company_id, userId: data?.id, nombre: data?.full_name }
}

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN UI (constantes exportadas)
// ─────────────────────────────────────────────────────────────

export const TIPO_INCIDENCIA_CFG = {
  vacaciones: {
    label:      'Vacaciones',
    emoji:      '🏖️',
    color:      'bg-blue-100 text-blue-700',
    border:     'border-blue-300',
    bg:         '#EFF6FF',
    text:       '#1E40AF',
    descripcion: 'Período de descanso anual con goce de sueldo',
    campos:     ['fecha_inicio', 'fecha_fin', 'notas'],
    goce:        true,
  },
  enfermedad: {
    label:      'Enfermedad',
    emoji:      '🤒',
    color:      'bg-amber-100 text-amber-700',
    border:     'border-amber-300',
    bg:         '#FFFBEB',
    text:       '#B45309',
    descripcion: 'Incapacidad por enfermedad cubierta por la empresa (1–2 días)',
    campos:     ['fecha_inicio', 'fecha_fin', 'motivo', 'notas'],
    goce:        true,
  },
  incapacidad_imss: {
    label:      'Incapacidad IMSS',
    emoji:      '🏥',
    color:      'bg-red-100 text-red-700',
    border:     'border-red-300',
    bg:         '#FEF2F2',
    text:       '#991B1B',
    descripcion: 'Incapacidad emitida por el IMSS — requiere subir el formato oficial',
    campos:     ['fecha_inicio', 'fecha_fin', 'folio_imss', 'dias_pagados_imss', 'notas'],
    goce:        true,  // parcial — se configura con porcentaje_pago
  },
  suspension_disciplinaria: {
    label:      'Suspensión Disciplinaria',
    emoji:      '⛔',
    color:      'bg-red-100 text-red-800',
    border:     'border-red-400',
    bg:         '#FEF2F2',
    text:       '#7F1D1D',
    descripcion: 'Suspensión por falta disciplinaria — puede ser con o sin goce de sueldo',
    campos:     ['fecha_inicio', 'dias_suspension', 'con_goce_sueldo', 'motivo', 'notas'],
    goce:        null, // se define por el usuario
  },
}

export const ESTATUS_INCIDENCIA_CFG = {
  activa:    { label: 'Activa',    color: 'bg-green-100 text-green-700',  emoji: '🟢' },
  cerrada:   { label: 'Cerrada',   color: 'bg-gray-100 text-gray-600',   emoji: '⚪' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-600',     emoji: '🔴' },
}

export const ESTATUS_TRABAJADOR_CFG = {
  activo:     { label: 'Activo',      color: 'bg-green-100 text-green-700',   emoji: '✅', dot: '#10B981' },
  baja:       { label: 'Baja',        color: 'bg-red-100 text-red-700',       emoji: '🔴', dot: '#EF4444' },
  vacaciones: { label: 'Vacaciones',  color: 'bg-blue-100 text-blue-700',     emoji: '🏖️', dot: '#3B82F6' },
  enfermedad: { label: 'Enfermedad',  color: 'bg-amber-100 text-amber-700',   emoji: '🤒', dot: '#F59E0B' },
  incapacidad_imss:             { label: 'Incapacitado', color: 'bg-red-100 text-red-600',    emoji: '🏥', dot: '#DC2626' },
  suspension_disciplinaria:     { label: 'Suspendido',  color: 'bg-gray-200 text-gray-800',   emoji: '⛔', dot: '#374151' },
}

// ─────────────────────────────────────────────────────────────
// CRUD INCIDENCIAS
// ─────────────────────────────────────────────────────────────

/**
 * Lista incidencias con filtros opcionales.
 */
export async function getIncidencias(filtros = {}) {
  const { companyId } = await getCtx()
  const { trabajadorId, tipo, estatus, projectId, desde, hasta } = filtros

  let q = supabase
    .from('personal_incidencias')
    .select(`
      *,
      trabajador:trabajador_id (
        id, nombre, apellido_paterno, apellido_materno,
        nombre_completo, tipo_personal, especialidad,
        project_id
      ),
      registrado_por:registrado_por ( full_name ),
      aprobado_por:aprobado_por   ( full_name ),
      personal_incidencias_docs ( id, nombre_archivo, storage_path, mime_type )
    `)
    .eq('company_id', companyId)
    .order('fecha_inicio', { ascending: false })

  if (trabajadorId) q = q.eq('trabajador_id', trabajadorId)
  if (tipo)         q = q.eq('tipo', tipo)
  if (estatus)      q = q.eq('estatus', estatus)
  if (projectId)    q = q.eq('project_id', projectId)
  if (desde)        q = q.gte('fecha_inicio', desde)
  if (hasta)        q = q.lte('fecha_inicio', hasta)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/**
 * Obtiene una incidencia por ID con todos sus documentos.
 */
export async function getIncidenciaById(id) {
  const { data, error } = await supabase
    .from('personal_incidencias')
    .select(`
      *,
      trabajador:trabajador_id (
        id, nombre, apellido_paterno, nombre_completo,
        tipo_personal, especialidad
      ),
      registrado_por:registrado_por ( full_name ),
      personal_incidencias_docs ( * )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Crea una nueva incidencia.
 * Para suspensión: calcula fecha_fin en base a dias_suspension.
 */
export async function crearIncidencia(datos) {
  const { companyId, userId } = await getCtx()

  // Para suspensión disciplinaria: calcular fecha_fin
  let fechaFin = datos.fecha_fin || null
  if (datos.tipo === 'suspension_disciplinaria' && datos.dias_suspension && datos.fecha_inicio) {
    const inicio = new Date(datos.fecha_inicio + 'T12:00:00')
    inicio.setDate(inicio.getDate() + parseInt(datos.dias_suspension) - 1)
    fechaFin = inicio.toISOString().split('T')[0]
  }

  // Para enfermedad sin fecha fin: poner mismo día + 1
  if (datos.tipo === 'enfermedad' && !fechaFin && datos.fecha_inicio) {
    fechaFin = datos.fecha_inicio
  }

  const { data, error } = await supabase
    .from('personal_incidencias')
    .insert({
      company_id:         companyId,
      trabajador_id:      datos.trabajadorId,
      project_id:         datos.projectId     || null,
      tipo:               datos.tipo,
      fecha_inicio:       datos.fecha_inicio,
      fecha_fin:          fechaFin,
      con_goce_sueldo:    datos.con_goce_sueldo !== false,
      porcentaje_pago:    datos.porcentaje_pago  ?? 100,
      motivo:             datos.motivo           || null,
      folio_imss:         datos.folio_imss       || null,
      dias_pagados_imss:  datos.dias_pagados_imss ? parseInt(datos.dias_pagados_imss) : null,
      tipo_suspension:    datos.tipo_suspension   || null,
      dias_suspension:    datos.dias_suspension   ? parseInt(datos.dias_suspension)   : null,
      notas_internas:     datos.notas_internas    || null,
      estatus:            'activa',
      registrado_por:     userId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Actualiza campos de una incidencia en estado borrador/activa.
 */
export async function actualizarIncidencia(id, cambios) {
  const { data, error } = await supabase
    .from('personal_incidencias')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Cierra una incidencia (marca como 'cerrada' y registra fecha_fin si falta).
 */
export async function cerrarIncidencia(id, fechaFin = null) {
  const updates = {
    estatus:    'cerrada',
    updated_at: new Date().toISOString(),
  }
  if (fechaFin) updates.fecha_fin = fechaFin

  const { data, error } = await supabase
    .from('personal_incidencias')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Cancela una incidencia registrada por error.
 */
export async function cancelarIncidencia(id, motivo) {
  const { data, error } = await supabase
    .from('personal_incidencias')
    .update({
      estatus:        'cancelada',
      notas_internas: motivo || null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * KPIs del módulo de incidencias.
 */
export async function getIncidenciasKpis() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .rpc('get_incidencias_kpis', { p_company_id: companyId })
  if (error) throw error
  return data?.[0] ?? {}
}

// ─────────────────────────────────────────────────────────────
// ESTATUS DEL TRABAJADOR (Activo / Baja) — sin DELETE
// ─────────────────────────────────────────────────────────────

/**
 * Cambia el estatus de un trabajador entre 'activo' y 'baja'.
 * Los empleados NUNCA se eliminan — solo cambia el estatus.
 */
export async function cambiarEstatusTrabajador(trabajadorId, nuevoEstatus, motivo = null) {
  const updates = {
    estatus:    nuevoEstatus,
    updated_at: new Date().toISOString(),
  }

  if (nuevoEstatus === 'baja') {
    updates.fecha_baja  = new Date().toISOString().split('T')[0]
    updates.motivo_baja = motivo || null
  } else if (nuevoEstatus === 'activo') {
    // Reactivación — limpiar fecha de baja
    updates.fecha_baja  = null
    updates.motivo_baja = null
  }

  const { data, error } = await supabase
    .from('personal_expediente')
    .update(updates)
    .eq('id', trabajadorId)
    .select('id, estatus, fecha_baja, motivo_baja')
    .single()

  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────
// DOCUMENTOS DE INCIDENCIAS (Storage)
// ─────────────────────────────────────────────────────────────

/**
 * Sube un archivo (ej. formato IMSS) y lo vincula a una incidencia.
 */
export async function subirDocumentoIncidencia(incidenciaId, archivo) {
  const { companyId, userId } = await getCtx()

  const ext        = archivo.name.split('.').pop()
  const timestamp  = Date.now()
  const path       = `${companyId}/${incidenciaId}/${timestamp}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_INCIDENCIAS)
    .upload(path, archivo, { contentType: archivo.type, upsert: false })

  if (uploadError) throw uploadError

  const { data, error: dbError } = await supabase
    .from('personal_incidencias_docs')
    .insert({
      incidencia_id:  incidenciaId,
      company_id:     companyId,
      nombre_archivo: archivo.name,
      storage_path:   path,
      mime_type:      archivo.type,
      tamanio_bytes:  archivo.size,
      subido_por:     userId,
    })
    .select()
    .single()

  if (dbError) throw dbError
  return data
}

/**
 * Genera una URL firmada temporal para descargar un documento.
 */
export async function getUrlDocumento(storagePath, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET_INCIDENCIAS)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

/**
 * Elimina un documento adjunto a una incidencia.
 */
export async function eliminarDocumento(docId, storagePath) {
  await supabase.storage.from(BUCKET_INCIDENCIAS).remove([storagePath])
  const { error } = await supabase
    .from('personal_incidencias_docs')
    .delete()
    .eq('id', docId)
  if (error) throw error
}
