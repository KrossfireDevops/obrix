// ============================================================
//  OBRIX ERP — Servicio: Gestión de Compras
//  src/services/compras.service.js  |  v1.0
//
//  Cubre:
//    · Catálogo de proveedores de compra (extiende terceros)
//    · Contactos de venta por proveedor
//    · Presentaciones de materiales por proveedor
//    · Relación material ↔ proveedor (principal/secundario/emergencia)
//    · Órdenes de Compra: CRUD, cambios de estatus, envío
//    · Recepciones de materiales de OC
//    · KPIs del módulo
// ============================================================

import { supabase } from '../config/supabase'

// ─────────────────────────────────────────────────────────────
// HELPER: contexto del usuario
// ─────────────────────────────────────────────────────────────
const getCtx = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('users_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()
  return { userId: user.id, companyId: profile.company_id, role: profile.role }
}

// ─────────────────────────────────────────────────────────────
// 1. PROVEEDORES DE COMPRA
// ─────────────────────────────────────────────────────────────

/**
 * Lista todos los terceros de tipo 'proveedor' de la empresa,
 * combinados con sus datos de compra (proveedor_compras).
 * Los que aún no tienen proveedor_compras configurado
 * aparecen con compra_config: null.
 */
export const getProveedoresCompra = async (filters = {}) => {
  try {
    const { companyId } = await getCtx()

    let query = supabase
      .from('terceros')
      .select(`
        id, rfc, razon_social, email, nivel_completado,
        tercero_relaciones!inner (
          id, tipo, dias_credito, limite_credito, moneda,
          score_semaforo, score_fiscal, bloqueado, is_active,
          company_id
        ),
        proveedor_compras (
          id, maneja_entrega, maneja_recoleccion, cobertura,
          tiempo_entrega_dias, entrega_en_obra,
          acepta_devoluciones, plazo_devolucion_dias,
          requiere_orden_compra, monto_minimo_compra,
          descuento_volumen_pct, email_compras, whatsapp_compras,
          notas_operativas, company_id
        )
      `)
      .eq('tercero_relaciones.company_id', companyId)
      .eq('tercero_relaciones.is_active', true)
      .in('tercero_relaciones.tipo', ['proveedor', 'ambos'])
      .order('razon_social', { ascending: true })

    if (filters.search) {
      query = query.or(
        `rfc.ilike.%${filters.search}%,razon_social.ilike.%${filters.search}%`
      )
    }
    if (filters.cobertura) {
      query = query.eq('proveedor_compras.cobertura', filters.cobertura)
    }
    if (filters.solo_configurados) {
      query = query.not('proveedor_compras', 'is', null)
    }

    const { data, error } = await query
    if (error) throw error

    // Normalizar: aplanar proveedor_compras (viene como array por la relación)
    const normalized = (data || []).map(t => ({
      ...t,
      relacion:     t.tercero_relaciones?.[0] || {},
      compra_config: t.proveedor_compras?.find(p => p.company_id === companyId) || null,
    }))

    return { data: normalized, error: null }
  } catch (error) {
    console.error('[getProveedoresCompra]', error)
    return { data: null, error }
  }
}

/**
 * Obtiene un proveedor completo con todos sus datos de compra,
 * contactos de venta, presentaciones y materiales relacionados.
 */
export const getProveedorCompraById = async (terceroId) => {
  try {
    const { companyId } = await getCtx()

    const [terceroRes, contactosRes, presentacionesRes, materialProvRes] =
      await Promise.all([
        supabase
          .from('terceros')
          .select(`
            id, rfc, razon_social, email, nivel_completado,
            tercero_relaciones (
              id, tipo, dias_credito, limite_credito, moneda,
              score_semaforo, score_fiscal, bloqueado, company_id
            ),
            proveedor_compras (*)
          `)
          .eq('id', terceroId)
          .single(),

        supabase
          .from('proveedor_contactos_venta')
          .select('*')
          .eq('tercero_id', terceroId)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('is_principal', { ascending: false }),

        supabase
          .from('proveedor_presentaciones')
          .select(`
            *,
            material:material_id ( id, material_code, material_type, default_unit, category )
          `)
          .eq('tercero_id', terceroId)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('clasificacion', { ascending: true }),

        supabase
          .from('material_proveedores')
          .select(`
            *,
            material:material_id ( id, material_code, material_type, default_unit )
          `)
          .eq('tercero_id', terceroId)
          .eq('company_id', companyId)
          .eq('is_active', true),
      ])

    if (terceroRes.error) throw terceroRes.error

    const tercero = terceroRes.data
    return {
      data: {
        ...tercero,
        relacion:      tercero.tercero_relaciones?.find(r => r.company_id === companyId) || {},
        compra_config: tercero.proveedor_compras?.find(p => p.company_id === companyId) || null,
        contactos:     contactosRes.data     || [],
        presentaciones: presentacionesRes.data || [],
        materiales:    materialProvRes.data  || [],
      },
      error: null,
    }
  } catch (error) {
    console.error('[getProveedorCompraById]', error)
    return { data: null, error }
  }
}

/**
 * Crea o actualiza la configuración de compra de un proveedor.
 */
export const upsertProveedorCompra = async (terceroId, datos) => {
  try {
    const { userId, companyId } = await getCtx()

    const { data, error } = await supabase
      .from('proveedor_compras')
      .upsert({
        tercero_id: terceroId,
        company_id: companyId,
        ...datos,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,tercero_id' })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('[upsertProveedorCompra]', error)
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. CONTACTOS DE VENTA
// ─────────────────────────────────────────────────────────────

export const upsertContactoVenta = async (terceroId, contacto) => {
  try {
    const { userId, companyId } = await getCtx()

    // Si hay un nuevo contacto principal, desmarcar el anterior
    if (contacto.is_principal && !contacto.id) {
      await supabase
        .from('proveedor_contactos_venta')
        .update({ is_principal: false })
        .eq('tercero_id', terceroId)
        .eq('company_id', companyId)
    }

    const payload = {
      tercero_id: terceroId,
      company_id: companyId,
      nombre:      contacto.nombre,
      cargo:       contacto.cargo    || null,
      email:       contacto.email    || null,
      telefono:    contacto.telefono || null,
      extension:   contacto.extension || null,
      whatsapp:    contacto.whatsapp || null,
      is_principal: !!contacto.is_principal,
      recibe_oc:   contacto.recibe_oc !== false,
      notas:       contacto.notas    || null,
      updated_at:  new Date().toISOString(),
    }

    let query = supabase.from('proveedor_contactos_venta')
    if (contacto.id) {
      const { data, error } = await query
        .update(payload).eq('id', contacto.id).select().single()
      if (error) throw error
      return { data, error: null }
    } else {
      const { data, error } = await query
        .insert({ ...payload }).select().single()
      if (error) throw error
      return { data, error: null }
    }
  } catch (error) {
    console.error('[upsertContactoVenta]', error)
    return { data: null, error }
  }
}

export const deleteContactoVenta = async (contactoId) => {
  try {
    const { error } = await supabase
      .from('proveedor_contactos_venta')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', contactoId)
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// ─────────────────────────────────────────────────────────────
// 3. PRESENTACIONES POR MATERIAL
// ─────────────────────────────────────────────────────────────

export const upsertPresentacion = async (terceroId, presentacion) => {
  try {
    const { userId, companyId } = await getCtx()

    const payload = {
      tercero_id:          terceroId,
      company_id:          companyId,
      material_id:         presentacion.material_id,
      nombre:              presentacion.nombre,
      descripcion:         presentacion.descripcion || null,
      unidad_presentacion: presentacion.unidad_presentacion,
      cantidad_por_unidad: presentacion.cantidad_por_unidad || null,
      unidad_base:         presentacion.unidad_base || null,
      precio_unitario:     parseFloat(presentacion.precio_unitario) || 0,
      moneda:              presentacion.moneda || 'MXN',
      precio_vigente_al:   presentacion.precio_vigente_al || null,
      incluye_iva:         !!presentacion.incluye_iva,
      disponible:          presentacion.disponible !== false,
      tiempo_surtido_dias: parseInt(presentacion.tiempo_surtido_dias) || 3,
      clasificacion:       presentacion.clasificacion || 'secundario',
      updated_at:          new Date().toISOString(),
    }

    let query = supabase.from('proveedor_presentaciones')
    if (presentacion.id) {
      const { data, error } = await query
        .update(payload).eq('id', presentacion.id).select().single()
      if (error) throw error
      return { data, error: null }
    } else {
      const { data, error } = await query.insert(payload).select().single()
      if (error) throw error

      // Sincronizar material_proveedores
      await sincronizarMaterialProveedor(
        companyId, presentacion.material_id, terceroId,
        presentacion.clasificacion, parseFloat(presentacion.precio_unitario)
      )
      return { data, error: null }
    }
  } catch (error) {
    console.error('[upsertPresentacion]', error)
    return { data: null, error }
  }
}

export const deletePresentacion = async (presentacionId) => {
  try {
    const { error } = await supabase
      .from('proveedor_presentaciones')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', presentacionId)
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Helper: mantiene material_proveedores sincronizado
const sincronizarMaterialProveedor = async (
  companyId, materialId, terceroId, clasificacion, precio
) => {
  await supabase
    .from('material_proveedores')
    .upsert({
      company_id:        companyId,
      material_id:       materialId,
      tercero_id:        terceroId,
      clasificacion:     clasificacion || 'secundario',
      precio_referencia: precio || null,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'company_id,material_id,tercero_id' })
}

/**
 * Obtiene los proveedores disponibles para un material dado,
 * ordenados por clasificación (principal primero).
 */
export const getProveedoresPorMaterial = async (materialId) => {
  try {
    const { companyId } = await getCtx()

    const { data, error } = await supabase
      .from('material_proveedores')
      .select(`
        *,
        tercero:tercero_id ( id, rfc, razon_social, email ),
        proveedor_compras!inner ( email_compras, tiempo_entrega_dias, maneja_entrega, cobertura )
      `)
      .eq('material_id', materialId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('clasificacion', { ascending: true })

    if (error) throw error

    // Ordenar: principal → secundario → emergencia
    const orden = { principal: 0, secundario: 1, emergencia: 2 }
    const sorted = (data || []).sort(
      (a, b) => (orden[a.clasificacion] ?? 9) - (orden[b.clasificacion] ?? 9)
    )
    return { data: sorted, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// 4. ÓRDENES DE COMPRA
// ─────────────────────────────────────────────────────────────

const OC_SELECT = `
  id, folio, folio_proveedor, estatus, origen,
  fecha_emision, fecha_requerida, fecha_entrega_est,
  fecha_confirmacion, fecha_recepcion,
  subtotal, iva, total, moneda,
  dias_credito, condiciones_pago, lugar_entrega,
  enviada_por_email, email_destino, enviada_at,
  notas, notas_internas, created_at, updated_at,
  project:project_id ( id, name, code ),
  tercero:tercero_id ( id, rfc, razon_social, email ),
  warehouse:warehouse_id ( id, name ),
  ordenes_compra_items (
    id, material_id, material_code, material_nombre, unidad,
    presentacion_id, presentacion_nombre,
    cantidad_presentacion, cantidad_unidades,
    precio_unitario, descuento_pct, importe,
    cantidad_recibida, estatus_item, notas, sort_order,
    wbs_id, partida_nombre
  )
`

export const getOrdenesCompra = async (filters = {}) => {
  try {
    const { companyId } = await getCtx()

    let query = supabase
      .from('ordenes_compra')
      .select(OC_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (filters.estatus)    query = query.eq('estatus', filters.estatus)
    if (filters.project_id) query = query.eq('project_id', filters.project_id)
    if (filters.tercero_id) query = query.eq('tercero_id', filters.tercero_id)
    if (filters.origen)     query = query.eq('origen', filters.origen)
    if (filters.search) {
      query = query.ilike('folio', `%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('[getOrdenesCompra]', error)
    return { data: null, error }
  }
}

export const getOrdenCompraById = async (ocId) => {
  try {
    const { companyId } = await getCtx()

    const [ocRes, logRes, recepcionesRes] = await Promise.all([
      supabase
        .from('ordenes_compra')
        .select(OC_SELECT)
        .eq('id', ocId)
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('oc_estatus_log')
        .select('*, realizado_por:realizado_por ( full_name, role )')
        .eq('oc_id', ocId)
        .order('created_at', { ascending: false }),
      supabase
        .from('oc_recepciones')
        .select('*, confirmado_por:confirmado_por ( full_name, role )')
        .eq('oc_id', ocId)
        .order('created_at', { ascending: false }),
    ])

    if (ocRes.error) throw ocRes.error
    return {
      data: {
        ...ocRes.data,
        log:        logRes.data       || [],
        recepciones: recepcionesRes.data || [],
      },
      error: null,
    }
  } catch (error) {
    console.error('[getOrdenCompraById]', error)
    return { data: null, error }
  }
}

/**
 * Crea una OC directa (origen = 'directa') sin solicitudes base.
 */
export const crearOrdenDirecta = async (datos) => {
  try {
    const { userId, companyId } = await getCtx()

    // Generar folio
    const { data: folioData } = await supabase
      .rpc('generar_folio_oc', { p_company_id: companyId })

    const { data: oc, error: ocError } = await supabase
      .from('ordenes_compra')
      .insert({
        company_id:       companyId,
        folio:            folioData,
        project_id:       datos.project_id       || null,
        tercero_id:       datos.tercero_id,
        warehouse_id:     datos.warehouse_id     || null,
        estatus:          'borrador',
        origen:           'directa',
        fecha_emision:    datos.fecha_emision    || new Date().toISOString().split('T')[0],
        fecha_requerida:  datos.fecha_requerida  || null,
        dias_credito:     datos.dias_credito     || 0,
        condiciones_pago: datos.condiciones_pago || null,
        lugar_entrega:    datos.lugar_entrega    || 'recoleccion',
        direccion_entrega: datos.direccion_entrega || null,
        notas:            datos.notas            || null,
        created_by:       userId,
      })
      .select()
      .single()

    if (ocError) throw ocError

    // Insertar ítems si vienen
    if (datos.items?.length) {
      const items = datos.items.map((it, i) => ({
        oc_id:                oc.id,
        company_id:           companyId,
        material_id:          it.material_id          || null,
        material_code:        it.material_code         || null,
        material_nombre:      it.material_nombre,
        unidad:               it.unidad               || null,
        presentacion_id:      it.presentacion_id      || null,
        presentacion_nombre:  it.presentacion_nombre  || null,
        cantidad_presentacion: parseFloat(it.cantidad_presentacion) || 1,
        cantidad_unidades:    parseFloat(it.cantidad_unidades)     || null,
        precio_unitario:      parseFloat(it.precio_unitario)       || 0,
        descuento_pct:        parseFloat(it.descuento_pct)         || 0,
        wbs_id:               it.wbs_id               || null,
        partida_nombre:       it.partida_nombre        || null,
        notas:                it.notas                || null,
        sort_order:           i,
      }))

      const { error: itemsError } = await supabase
        .from('ordenes_compra_items')
        .insert(items)
      if (itemsError) throw itemsError
    }

    // Log
    await supabase.from('oc_estatus_log').insert({
      oc_id: oc.id, company_id: companyId,
      estatus_nuevo: 'borrador', accion: 'crear', realizado_por: userId,
    })

    return { data: oc, error: null }
  } catch (error) {
    console.error('[crearOrdenDirecta]', error)
    return { data: null, error }
  }
}

/**
 * Crea una OC desde 1 o N solicitudes aprobadas del mismo proyecto.
 */
export const crearOcDesdeSolicitudes = async (
  solicitudIds, terceroId, projectId, warehouseId = null
) => {
  try {
    const { data, error } = await supabase
      .rpc('crear_oc_desde_solicitudes', {
        p_solicitud_ids: solicitudIds,
        p_tercero_id:    terceroId,
        p_project_id:    projectId,
        p_warehouse_id:  warehouseId,
      })
    if (error) throw error
    return { data, error: null }  // data = UUID de la OC creada
  } catch (error) {
    console.error('[crearOcDesdeSolicitudes]', error)
    return { data: null, error }
  }
}

/**
 * Actualiza los datos de cabecera de una OC en borrador.
 */
export const updateOrdenCompra = async (ocId, cambios) => {
  try {
    const { userId } = await getCtx()
    const { data, error } = await supabase
      .from('ordenes_compra')
      .update({ ...cambios, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', ocId)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── Gestión de ítems de OC ────────────────────────────────────
export const addItemOc = async (ocId, item) => {
  try {
    const { companyId } = await getCtx()
    const { data: existing } = await supabase
      .from('ordenes_compra_items')
      .select('sort_order')
      .eq('oc_id', ocId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const { data, error } = await supabase
      .from('ordenes_compra_items')
      .insert({
        oc_id:                ocId,
        company_id:           companyId,
        material_id:          item.material_id          || null,
        material_code:        item.material_code        || null,
        material_nombre:      item.material_nombre,
        unidad:               item.unidad               || null,
        presentacion_id:      item.presentacion_id      || null,
        presentacion_nombre:  item.presentacion_nombre  || null,
        cantidad_presentacion: parseFloat(item.cantidad_presentacion) || 1,
        cantidad_unidades:    parseFloat(item.cantidad_unidades)     || null,
        precio_unitario:      parseFloat(item.precio_unitario)       || 0,
        descuento_pct:        parseFloat(item.descuento_pct)         || 0,
        notas:                item.notas || null,
        sort_order:           (existing?.sort_order ?? -1) + 1,
      })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const updateItemOc = async (itemId, cambios) => {
  try {
    const { data, error } = await supabase
      .from('ordenes_compra_items')
      .update(cambios)
      .eq('id', itemId)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const deleteItemOc = async (itemId) => {
  try {
    const { error } = await supabase
      .from('ordenes_compra_items')
      .delete()
      .eq('id', itemId)
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// ─────────────────────────────────────────────────────────────
// 5. CAMBIOS DE ESTATUS DE OC
// ─────────────────────────────────────────────────────────────

const cambiarEstatusOc = async (ocId, nuevoEstatus, accion, extra = {}) => {
  try {
    const { userId, companyId } = await getCtx()

    const { data: oc, error: ocError } = await supabase
      .from('ordenes_compra')
      .update({
        estatus:    nuevoEstatus,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        ...extra,
      })
      .eq('id', ocId)
      .select('estatus')
      .single()
    if (ocError) throw ocError

    await supabase.from('oc_estatus_log').insert({
      oc_id:         ocId,
      company_id:    companyId,
      estatus_nuevo: nuevoEstatus,
      accion,
      notas:         extra.notas || null,
      realizado_por: userId,
    })

    return { data: oc, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Marca la OC como enviada al proveedor.
 * Registra el email destino y la fecha de envío.
 */
export const enviarOrdenCompra = async (ocId, emailDestino) => {
  return cambiarEstatusOc(ocId, 'enviada', 'enviar', {
    enviada_por_email: true,
    email_destino:     emailDestino,
    enviada_at:        new Date().toISOString(),
  })
}

export const confirmarOrdenCompra = async (ocId, fechaEntregaEst = null) => {
  return cambiarEstatusOc(ocId, 'confirmada', 'confirmar', {
    fecha_confirmacion: new Date().toISOString().split('T')[0],
    fecha_entrega_est:  fechaEntregaEst,
  })
}

export const cancelarOrdenCompra = async (ocId, motivo) => {
  return cambiarEstatusOc(ocId, 'cancelada', 'cancelar', {
    motivo_cancelacion: motivo,
    fecha_cancelacion:  new Date().toISOString().split('T')[0],
  })
}

// ─────────────────────────────────────────────────────────────
// 6. RECEPCIONES
// ─────────────────────────────────────────────────────────────

/**
 * Registra la recepción de un ítem de OC.
 * Llama a la función SQL que valida el rol, actualiza
 * inventario y genera el movimiento de entrada.
 */
export const registrarRecepcion = async ({
  ocItemId, cantidad, warehouseId,
  rolConfirmacion, folioRemision = null, notas = null,
}) => {
  try {
    const { data, error } = await supabase
      .rpc('registrar_recepcion_oc', {
        p_oc_item_id:       ocItemId,
        p_cantidad:         cantidad,
        p_warehouse_id:     warehouseId,
        p_rol_confirmacion: rolConfirmacion,
        p_folio_remision:   folioRemision,
        p_notas:            notas,
      })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('[registrarRecepcion]', error)
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// 7. SOLICITUDES APROBADAS (para generar OC desde ellas)
// ─────────────────────────────────────────────────────────────

/**
 * Lista las solicitudes de material aprobadas que aún
 * no tienen una OC generada, opcionalmentepor proyecto.
 */
export const getSolicitudesAprobadas = async (projectId = null) => {
  try {
    const { companyId } = await getCtx()

    let query = supabase
      .from('material_requests')
      .select(`
        id, folio, title, priority, created_at,
        project:project_id ( id, name, code ),
        material_request_items (
          id, quantity_requested, quantity_approved,
          materials_catalog ( id, material_code, material_type, default_unit )
        )
      `)
      .eq('company_id', companyId)
      .in('status', ['approved', 'aprobada', 'APROBADO'])
      .order('created_at', { ascending: false })

    if (projectId) query = query.eq('project_id', projectId)

    // Excluir las que ya tienen OC
    const { data: conOC } = await supabase
      .from('oc_solicitudes_origen')
      .select('solicitud_id')
      .eq('company_id', companyId)

    const { data, error } = await query
    if (error) throw error

    const idsConOC = new Set((conOC || []).map(r => r.solicitud_id))
    const sinOC    = (data || []).filter(s => !idsConOC.has(s.id))

    return { data: sinOC, error: null }
  } catch (error) {
    console.error('[getSolicitudesAprobadas]', error)
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────
// 8. KPIs
// ─────────────────────────────────────────────────────────────

export const getKpisCompras = async () => {
  try {
    const { companyId } = await getCtx()
    const { data, error } = await supabase
      .rpc('get_kpis_compras', { p_company_id: companyId })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
