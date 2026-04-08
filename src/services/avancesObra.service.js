// ============================================================
//  OBRIX ERP — Servicio: Avances de Obra
//  src/services/avancesObra.service.js  |  v1.0
// ============================================================

import { supabase } from '../config/supabase'

const BUCKET = 'avances-obra'

async function getCtx() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id, id, full_name')
    .eq('id', user.id)
    .single()
  return { companyId: data?.company_id, userId: data?.id, nombre: data?.full_name }
}

// ============================================================
//  AVANCES
// ============================================================

export async function getAvancesBySection(sectionId, limit = 20) {
  const { data, error } = await supabase
    .from('obra_avances')
    .select(`
      *,
      obra_avance_fotos(id, foto_url, descripcion, orden),
      obra_avance_materiales(id, nombre_material, cantidad_usada, cantidad_unidad, costo_total),
      users_profiles!registrado_por(full_name)
    `)
    .eq('section_id', sectionId)
    .order('fecha_registro', { ascending: false })
    .order('hora_registro', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getAvancesByProject(projectId, fechaDesde, fechaHasta) {
  const { data, error } = await supabase
    .from('obra_avances')
    .select(`
      *,
      project_sections(section_code, nombre),
      project_levels(nivel_nombre),
      obra_avance_fotos(id, foto_url, orden),
      users_profiles!registrado_por(full_name)
    `)
    .eq('project_id', projectId)
    .gte('fecha_registro', fechaDesde)
    .lte('fecha_registro', fechaHasta)
    .order('fecha_registro', { ascending: false })
    .order('hora_registro', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getAvancesPendientesValidar(projectId) {
  const { data, error } = await supabase
    .from('obra_avances')
    .select(`
      *,
      project_sections(section_code, nombre),
      project_levels(nivel_nombre),
      obra_avance_fotos(id, foto_url, orden)
    `)
    .eq('project_id', projectId)
    .eq('estatus', 'pendiente')
    .order('fecha_registro', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function crearAvance({
  projectId, levelId, sectionId,
  pctAnterior, pctNuevo,
  descripcion, tipo, clima,
  nombreRegistrador,
  fotos = [],
  materiales = [],
}) {
  const { companyId, userId, nombre } = await getCtx()

  // 1. Crear el avance principal
  const { data: avance, error } = await supabase
    .from('obra_avances')
    .insert({
      company_id:         companyId,
      project_id:         projectId,
      level_id:           levelId,
      section_id:         sectionId,
      fecha_registro:     new Date().toISOString().split('T')[0],
      hora_registro:      new Date().toTimeString().split(' ')[0],
      pct_anterior:       pctAnterior,
      pct_nuevo:          Math.min(100, Math.max(0, pctNuevo)),
      descripcion:        descripcion.trim(),
      tipo:               tipo ?? 'avance',
      clima:              clima ?? null,
      registrado_por:     userId,
      nombre_registrador: nombreRegistrador ?? nombre,
      estatus:            'pendiente',
    })
    .select()
    .single()
  if (error) throw error

  // 2. Subir fotos si hay
  if (fotos.length > 0) {
    await subirFotos(avance.id, projectId, sectionId, companyId, fotos)
  }

  // 3. Registrar materiales si hay
  if (materiales.length > 0) {
    const rows = materiales
      .filter(m => m.nombre_material?.trim() && m.cantidad_usada > 0)
      .map(m => ({
        avance_id:       avance.id,
        company_id:      companyId,
        project_id:      projectId,
        material_id:     m.material_id ?? null,
        nombre_material: m.nombre_material.trim(),
        unidad:          m.unidad ?? null,
        cantidad_usada:  Number(m.cantidad_usada),
        cantidad_unidad: m.cantidad_unidad ?? null,
        costo_unitario:  m.costo_unitario ? Number(m.costo_unitario) : null,
        notas:           m.notas ?? null,
      }))
    if (rows.length > 0) {
      const { error: errMat } = await supabase
        .from('obra_avance_materiales')
        .insert(rows)
      if (errMat) console.error('Error guardando materiales:', errMat)
    }
  }

  return avance
}

export async function validarAvance(avanceId, notas) {
  const { userId } = await getCtx()
  const { data, error } = await supabase
    .from('obra_avances')
    .update({
      validado:          true,
      validado_por:      userId,
      validado_at:       new Date().toISOString(),
      notas_validacion:  notas ?? null,
      estatus:           'validado',
    })
    .eq('id', avanceId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function rechazarAvance(avanceId, notas) {
  const { data, error } = await supabase
    .from('obra_avances')
    .update({ estatus: 'rechazado', notas_validacion: notas })
    .eq('id', avanceId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarAvance(avanceId) {
  const { error } = await supabase
    .from('obra_avances')
    .delete()
    .eq('id', avanceId)
  if (error) throw error
}

// ============================================================
//  FOTOS
// ============================================================

async function subirFotos(avanceId, projectId, sectionId, companyId, fotos) {
  const uploads = fotos.map(async (foto, idx) => {
    const ext  = foto.name.split('.').pop()
    const path = `${projectId}/${sectionId}/${avanceId}/${Date.now()}_${idx}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, foto, { upsert: false })

    if (uploadError) { console.error('Error subiendo foto:', uploadError); return null }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return {
      avance_id:      avanceId,
      company_id:     companyId,
      project_id:     projectId,
      foto_url:       urlData.publicUrl,
      foto_path:      path,
      nombre_archivo: foto.name,
      tamaño_bytes:   foto.size,
      orden:          idx + 1,
    }
  })

  const resultados = (await Promise.all(uploads)).filter(Boolean)
  if (resultados.length > 0) {
    await supabase.from('obra_avance_fotos').insert(resultados)
  }
  return resultados
}

export async function eliminarFoto(fotoId, fotaPath) {
  await supabase.storage.from(BUCKET).remove([fotaPath])
  await supabase.from('obra_avance_fotos').delete().eq('id', fotoId)
}

// ============================================================
//  BITÁCORA
// ============================================================

export async function getBitacora(projectId, filtros = {}) {
  const { tipo, requiereAccion, sectionId, limit = 50 } = filtros
  let query = supabase
    .from('obra_bitacora')
    .select(`
      *,
      project_sections(section_code, nombre),
      project_levels(nivel_nombre),
      users_profiles!registrado_por(full_name)
    `)
    .eq('project_id', projectId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tipo)            query = query.eq('tipo', tipo)
  if (sectionId)       query = query.eq('section_id', sectionId)
  if (requiereAccion)  query = query.eq('requiere_accion', true).eq('accion_resuelta', false)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function crearEntradaBitacora({
  projectId, levelId, sectionId, avanceId,
  tipo, titulo, descripcion, prioridad,
  impactoTiempo, impactoCosto, requiereAccion,
  nombreRegistrador,
}) {
  const { companyId, userId, nombre } = await getCtx()
  const { data, error } = await supabase
    .from('obra_bitacora')
    .insert({
      company_id:         companyId,
      project_id:         projectId,
      level_id:           levelId   ?? null,
      section_id:         sectionId ?? null,
      avance_id:          avanceId  ?? null,
      fecha:              new Date().toISOString().split('T')[0],
      tipo:               tipo ?? 'nota',
      titulo:             titulo.trim(),
      descripcion:        descripcion.trim(),
      prioridad:          prioridad ?? 'normal',
      impacto_tiempo:     impactoTiempo ?? null,
      impacto_costo:      impactoCosto  ?? null,
      requiere_accion:    requiereAccion ?? false,
      registrado_por:     userId,
      nombre_registrador: nombreRegistrador ?? nombre,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function resolverAccionBitacora(bitacoraId, notas) {
  const { data, error } = await supabase
    .from('obra_bitacora')
    .update({ accion_resuelta: true, accion_notas: notas })
    .eq('id', bitacoraId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
//  KPIs Y ESTADÍSTICAS
// ============================================================

export async function getKpisAvance(projectId) {
  const { data, error } = await supabase
    .rpc('get_kpis_avance', { p_project_id: projectId })
  if (error) throw error
  return data?.[0] ?? {}
}

export async function getResumenDiario(projectId, fechaDesde, fechaHasta) {
  const { data, error } = await supabase
    .rpc('get_avances_resumen', {
      p_project_id:  projectId,
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
    })
  if (error) throw error
  return data ?? []
}

export async function getUltimoAvancePorSeccion(projectId) {
  const { data, error } = await supabase
    .rpc('get_ultimo_avance_por_seccion', { p_project_id: projectId })
  if (error) throw error
  return data ?? []
}

// ============================================================
//  UTILIDADES
// ============================================================

export const TIPO_AVANCE_CFG = {
  avance:     { label: 'Avance',      color: 'bg-blue-100 text-blue-700',   emoji: '🔨' },
  incidencia: { label: 'Incidencia',  color: 'bg-red-100 text-red-700',     emoji: '⚠️' },
  cambio:     { label: 'Cambio',      color: 'bg-amber-100 text-amber-700', emoji: '🔄' },
  inspeccion: { label: 'Inspección',  color: 'bg-purple-100 text-purple-700',emoji: '🔍'},
  entrega:    { label: 'Entrega',     color: 'bg-green-100 text-green-700', emoji: '✅' },
}

export const TIPO_BITACORA_CFG = {
  nota:       { label: 'Nota',        color: 'bg-gray-100 text-gray-600',   emoji: '📝' },
  incidencia: { label: 'Incidencia',  color: 'bg-red-100 text-red-700',     emoji: '⚠️' },
  cambio:     { label: 'Cambio',      color: 'bg-amber-100 text-amber-700', emoji: '🔄' },
  inspeccion: { label: 'Inspección',  color: 'bg-purple-100 text-purple-700',emoji: '🔍'},
  seguridad:  { label: 'Seguridad',   color: 'bg-orange-100 text-orange-700',emoji: '🦺'},
  clima:      { label: 'Clima',       color: 'bg-sky-100 text-sky-700',     emoji: '🌧️' },
  decision:   { label: 'Decisión',    color: 'bg-teal-100 text-teal-700',   emoji: '✍️' },
}

export const CLIMA_CFG = {
  soleado:      { label: 'Soleado',       emoji: '☀️' },
  nublado:      { label: 'Nublado',       emoji: '⛅' },
  lluvioso:     { label: 'Lluvioso',      emoji: '🌧️' },
  viento_fuerte:{ label: 'Viento fuerte', emoji: '💨' },
  suspendido:   { label: 'Suspendido',    emoji: '🚫' },
}

export function formatFechaHora(fecha, hora) {
  if (!fecha) return '—'
  const f = new Date(fecha + 'T' + (hora ?? '00:00:00'))
  return f.toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short',
  }) + (hora ? ` ${hora.slice(0,5)}` : '')
}