// ============================================================
//  OBRIX ERP — Servicio: Cierre de Proyecto
//  src/services/cierreProyecto.service.js  |  v1.0
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
//  HISTORIAL DE RESPONSABLES
// ============================================================

export async function getHistorialResponsables(projectId) {
  const { data, error } = await supabase
    .rpc('get_historial_responsables', { p_project_id: projectId })
  if (error) throw error
  return data ?? []
}

export async function cambiarResponsable({ projectId, responsableId, motivo }) {
  const { userId } = await getCtx()
  const { data, error } = await supabase
    .rpc('cambiar_responsable_proyecto', {
      p_project_id:     projectId,
      p_responsable_id: responsableId,
      p_motivo:         motivo ?? null,
      p_user_id:        userId,
    })
  if (error) throw error
  return data
}

export async function getSupervisores() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .rpc('get_supervisores', { p_company_id: companyId })
  if (error) throw error
  return data ?? []
}

// Obtener residentes de obra (filtro específico)
export async function getResidentesObra() {
  const { companyId } = await getCtx()
  const { data, error } = await supabase
    .from('personal_expediente')
    .select('id, nombre_completo, puesto, especialidad')
    .eq('company_id', companyId)
    .eq('estatus', 'activo')
    .ilike('puesto', '%residente%')
    .order('apellido_paterno')
  if (error) throw error
  return data ?? []
}

// ============================================================
//  CIERRE DE PROYECTO
// ============================================================

export async function getCierreByProject(projectId) {
  const { data, error } = await supabase
    .from('project_cierres')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function iniciarCierre(projectId) {
  const { companyId, userId } = await getCtx()

  // Calcular snapshot de gastos
  const [
    { data: matData },
    { data: moData },
  ] = await Promise.all([
    supabase
      .from('obra_avance_materiales')
      .select('costo_total')
      .eq('project_id', projectId),
    supabase
      .from('personal_prenomina')
      .select('total_neto')
      .eq('project_id', projectId)
      .eq('estatus', 'pagada'),
  ])

  const gastoMat = (matData ?? []).reduce((s, r) => s + Number(r.costo_total ?? 0), 0)
  const gastoMO  = (moData  ?? []).reduce((s, r) => s + Number(r.total_neto  ?? 0), 0)

  // Contar incidencias y cambios
  const [{ count: incidencias }, { count: cambios }] = await Promise.all([
    supabase.from('obra_bitacora').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('tipo', 'incidencia'),
    supabase.from('obra_bitacora').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('tipo', 'cambio'),
  ])

  const { data, error } = await supabase
    .from('project_cierres')
    .upsert({
      project_id:         projectId,
      company_id:         companyId,
      iniciado_por:       userId,
      gasto_materiales:   gastoMat,
      gasto_mano_obra:    gastoMO,
      total_incidencias:  incidencias ?? 0,
      total_cambios:      cambios ?? 0,
      estatus:            'en_proceso',
    }, { onConflict: 'project_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarCierre(cierreId, changes) {
  const { data, error } = await supabase
    .from('project_cierres')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', cierreId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Subir foto de entrega
export async function subirFotoEntrega(cierreId, projectId, foto) {
  const { companyId } = await getCtx()
  const ext  = foto.name.split('.').pop()
  const path = `${projectId}/cierre/${cierreId}/entrega_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, foto, { upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  await actualizarCierre(cierreId, {
    foto_entrega_url:  urlData.publicUrl,
    foto_entrega_path: path,
  })

  return urlData.publicUrl
}

// Firmar el acta (1, 2 o 3)
export async function firmarCierre({ cierreId, firmaNum, firmante, notas }) {
  const { userId } = await getCtx()
  const firmId = firmaNum === 2 ? userId : firmante
  const { data, error } = await supabase
    .rpc('firmar_cierre', {
      p_cierre_id:   cierreId,
      p_firma_num:   firmaNum,
      p_firmante_id: firmId,
      p_notas:       notas ?? null,
    })
  if (error) throw error
  return data  // nuevo estatus
}

// ============================================================
//  CORRECCIONES POST-CIERRE (solo admin)
// ============================================================

export async function registrarCorreccion({
  projectId, tablaAfectada, registroId,
  campoModificado, valorAnterior, valorNuevo,
  justificacion,
}) {
  const { companyId, userId, nombre } = await getCtx()
  const { data, error } = await supabase
    .from('project_correcciones')
    .insert({
      project_id:       projectId,
      company_id:       companyId,
      admin_id:         userId,
      admin_nombre:     nombre,
      tabla_afectada:   tablaAfectada,
      registro_id:      registroId ?? null,
      campo_modificado: campoModificado ?? null,
      valor_anterior:   valorAnterior ?? null,
      valor_nuevo:      valorNuevo ?? null,
      justificacion,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getCorrecciones(projectId) {
  const { data, error } = await supabase
    .from('project_correcciones')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ============================================================
//  UTILIDADES
// ============================================================

export const ESTATUS_CIERRE = {
  en_proceso:        { label: 'En proceso',        color: 'bg-gray-100 text-gray-600',    paso: 1 },
  pendiente_firmas:  { label: 'Pendiente firmas',  color: 'bg-amber-100 text-amber-700',  paso: 5 },
  firmado_1:         { label: 'Firma 1 obtenida',  color: 'bg-blue-100 text-blue-700',    paso: 5 },
  firmado_2:         { label: 'Firma 2 obtenida',  color: 'bg-indigo-100 text-indigo-700',paso: 5 },
  cerrado:           { label: 'Cerrado ✓',          color: 'bg-green-100 text-green-700',  paso: 6 },
}

export const PASOS_CIERRE = [
  { num: 1, label: 'Devolución materiales', icon: '📦' },
  { num: 2, label: 'Resumen de gastos',     icon: '💰' },
  { num: 3, label: 'Incidencias y cambios', icon: '📋' },
  { num: 4, label: 'Foto de entrega',       icon: '📷' },
  { num: 5, label: 'Firmas electrónicas',   icon: '✍️' },
  { num: 6, label: 'Acta de cierre',        icon: '✅' },
]