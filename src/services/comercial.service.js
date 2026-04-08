// ============================================================
//  OBRIX ERP — Servicio Módulo Comercial
//  src/services/comercial.service.js  |  v1.0
// ============================================================

import { supabase } from '../config/supabase'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export const fmtMXN = (n) =>
  n == null ? '—' : new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 0
  }).format(n)

export const fmtFecha = (f) => {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export const ETAPAS_CONFIG = {
  lead:            { label: 'Lead',            color: '#3B82F6', bg: '#EFF6FF', orden: 1 },
  calificado:      { label: 'Calificado',      color: '#8B5CF6', bg: '#F5F3FF', orden: 2 },
  visita_tecnica:  { label: 'Visita técnica',  color: '#F59E0B', bg: '#FFFBEB', orden: 3 },
  cotizacion:      { label: 'Cotización',      color: '#F97316', bg: '#FFF7ED', orden: 4 },
  negociacion:     { label: 'Negociación',     color: '#EC4899', bg: '#FDF2F8', orden: 5 },
  contrato:        { label: 'Contrato',        color: '#10B981', bg: '#F0FDF4', orden: 6 },
  proyecto_activo: { label: 'Proyecto activo', color: '#059669', bg: '#DCFCE7', orden: 7 },
}

export const TIPO_OBRA_LABELS = {
  residencial:    'Residencial',
  comercial:      'Comercial',
  industrial:     'Industrial',
  institucional:  'Institucional',
  infraestructura:'Infraestructura',
  mixto:          'Mixto',
}

export const ORIGEN_LABELS = {
  referido:          'Referido',
  contacto_directo:  'Contacto directo',
  licitacion_publica:'Licitación pública',
  red_social:        'Red social',
  expo_evento:       'Expo / Evento',
  pagina_web:        'Página web',
  llamada_fria:      'Llamada fría',
}

export const ZONA_LABELS = {
  zona_a: 'Zona A — CDMX / MTY / GDL',
  zona_b: 'Zona B — Otras capitales',
  zona_c: 'Zona C — Interior / Rural',
}

export const SUMINISTRO_LABELS = {
  solo_mo:       'Solo mano de obra',
  mo_materiales: 'M.O. + materiales',
  llave_en_mano: 'Llave en mano',
}

// ─────────────────────────────────────────────────────────────
// PIPELINE — KANBAN
// ─────────────────────────────────────────────────────────────

export const getPipelineKanban = async (companyId, ejecutivoId = null) => {
  const { data, error } = await supabase.rpc('get_pipeline_kanban', {
    p_company_id:   companyId,
    p_ejecutivo_id: ejecutivoId,
  })
  return { data, error }
}

export const getKpisPipeline = async (companyId, ejecutivoId = null) => {
  const { data, error } = await supabase.rpc('get_kpis_pipeline', {
    p_company_id:   companyId,
    p_ejecutivo_id: ejecutivoId,
  })
  return { data: data?.[0], error }
}

// ─────────────────────────────────────────────────────────────
// OPORTUNIDADES
// ─────────────────────────────────────────────────────────────

export const getOportunidad = async (id) => {
  const { data, error } = await supabase
    .from('oportunidades')
    .select(`
      *,
      cliente:cliente_id(*),
      ejecutivo:ejecutivo_id(id, full_name, email),
      seguimientos:oportunidades_seguimientos(
        id, tipo, titulo, descripcion,
        etapa_anterior, etapa_nueva,
        proxima_accion, proxima_accion_fecha,
        created_at,
        usuario:usuario_id(full_name)
      ),
      cotizaciones(
        id, folio, version, estatus, total, created_at
      ),
      contratos:contratos_comerciales(
        id, folio, estatus, monto_total, fecha_contrato
      )
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

export const crearOportunidad = async (payload) => {
  const { data, error } = await supabase
    .from('oportunidades')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export const actualizarOportunidad = async (id, payload) => {
  const { data, error } = await supabase
    .from('oportunidades')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const avanzarEtapa = async (opId, nuevaEtapa, usuarioId, nota = null) => {
  const { data, error } = await supabase.rpc('avanzar_etapa_oportunidad', {
    p_op_id:       opId,
    p_nueva_etapa: nuevaEtapa,
    p_usuario_id:  usuarioId,
    p_nota:        nota,
  })
  return { data, error }
}

export const calcularScore = async (opId) => {
  const { data, error } = await supabase.rpc('calcular_score_oportunidad', {
    p_oportunidad_id: opId,
  })
  return { data, error }
}

export const marcarPerdida = async (id, razon, nota) => {
  const { data, error } = await supabase
    .from('oportunidades')
    .update({
      estatus:      'perdido',
      razon_perdida: razon,
      nota_perdida:  nota,
      fecha_real_cierre: new Date().toISOString().split('T')[0],
      updated_at:    new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// SEGUIMIENTOS
// ─────────────────────────────────────────────────────────────

export const agregarSeguimiento = async (payload) => {
  const { data, error } = await supabase
    .from('oportunidades_seguimientos')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// CLIENTES COMERCIALES
// ─────────────────────────────────────────────────────────────

export const getClientes = async (companyId, search = '') => {
  let q = supabase
    .from('clientes_comerciales')
    .select('id, nombre, email, telefono, tipo_cliente, ciudad, estado')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('nombre')

  if (search) q = q.ilike('nombre', `%${search}%`)
  const { data, error } = await q
  return { data, error }
}

export const crearCliente = async (payload) => {
  const { data, error } = await supabase
    .from('clientes_comerciales')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export const getCliente = async (id) => {
  const { data, error } = await supabase
    .from('clientes_comerciales')
    .select(`
      *,
      oportunidades(
        id, folio, nombre_proyecto, estatus,
        monto_estimado, monto_contratado, created_at
      )
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// COTIZACIONES
// ─────────────────────────────────────────────────────────────

export const getCotizacion = async (id) => {
  const { data, error } = await supabase
    .from('cotizaciones')
    .select(`
      *,
      partidas:cotizaciones_partidas(
        *,
        concepto:concepto_id(
          clave_obrix, nombre, sat_clave_prod_serv,
          sat_clave_unidad, sat_objeto_impuesto
        )
      ),
      cliente:cliente_id(nombre, rfc, email, telefono),
      oportunidad:oportunidad_id(folio, nombre_proyecto, tipo_obra)
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

export const crearCotizacion = async (payload) => {
  const { data, error } = await supabase
    .from('cotizaciones')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export const actualizarCotizacion = async (id, payload) => {
  const { data, error } = await supabase
    .from('cotizaciones')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const calcularPrecioLinea = async (conceptoId, cantidad, dimension = null, precioManual = null) => {
  const { data, error } = await supabase.rpc('calcular_precio_linea', {
    p_concepto_id: conceptoId,
    p_cantidad:    cantidad,
    p_dimension:   dimension,
    p_precio_man:  precioManual,
  })
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// CONTRATOS
// ─────────────────────────────────────────────────────────────

export const calcularAnticipo = async (
  esForan, tipoSum, tamano, zona, monto
) => {
  const { data, error } = await supabase.rpc('calcular_anticipo_sugerido', {
    p_es_foranea:      esForan,
    p_tipo_suministro: tipoSum,
    p_tamano:          tamano,
    p_zona_pais:       zona,
    p_monto_contrato:  monto,
  })
  return { data, error }
}

export const crearContrato = async (payload) => {
  const { data, error } = await supabase
    .from('contratos_comerciales')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export const getContrato = async (id) => {
  const { data, error } = await supabase
    .from('contratos_comerciales')
    .select(`
      *,
      clausulas:contratos_clausulas(*),
      cliente:cliente_id(*),
      cotizacion:cotizacion_id(folio, total)
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// ANTICIPOS
// ─────────────────────────────────────────────────────────────

export const registrarAnticipo = async (payload) => {
  const { data, error } = await supabase
    .from('anticipos_comerciales')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export const dispararProyecto = async (anticipoId, usuarioId) => {
  const { data, error } = await supabase.rpc('crear_proyecto_desde_contrato', {
    p_anticipo_id: anticipoId,
    p_usuario_id:  usuarioId,
  })
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// EJECUTIVOS (para selector en formularios)
// ─────────────────────────────────────────────────────────────

export const getEjecutivos = async (companyId) => {
  const { data, error } = await supabase
    .from('users_profiles')
    .select('id, full_name, email')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('full_name')
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// CATÁLOGO DE PRECIOS (para selector en cotizaciones)
// ─────────────────────────────────────────────────────────────

export const getCatalogoPorCategoria = async (companyId) => {
  const { data, error } = await supabase
    .from('catalogo_ps')
    .select(`
      id, clave_obrix, nombre, tipo_um, unidad_venta,
      cantidad_minima, precio_minimo, precio_referencia, precio_maximo,
      descuento_maximo_pct, aplica_iva, tasa_iva,
      dimension_estandar, dimension_unidad, dimension_descripcion,
      precio_excedente_dim,
      sat_clave_prod_serv, sat_clave_unidad, sat_objeto_impuesto,
      categoria:categoria_id(nombre, codigo, color_badge, color_texto)
    `)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('orden')
  return { data, error }
}
