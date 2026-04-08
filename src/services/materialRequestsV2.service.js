// src/services/materialRequestsV2.service.js
import { supabase } from '../config/supabase'

const REQUEST_SELECT = `
  *,
  projects   (id, name, project_type),
  warehouses (id, name),
  material_request_items (
    *,
    materials_catalog (id, material_type, material_code, category, subcategory, default_unit)
  )
`

export const getRequests = async (status = null) => {
  try {
    let query = supabase
      .from('material_requests')
      .select(REQUEST_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const createRequest = async ({ projectId, warehouseId, title, description,
  priority, items, companyId, estimatedAmount, approvalLevel, sendNow }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: folio } = await supabase.rpc('generate_request_folio')

    const { data: request, error: reqError } = await supabase
      .from('material_requests')
      .insert([{
        company_id:       companyId,
        project_id:       projectId,
        warehouse_id:     warehouseId || null,
        folio:            folio || `SOL-${Date.now()}`,
        title,
        description,
        priority,
        status:           sendNow ? 'ENVIADA' : 'BORRADOR',
        estimated_amount: estimatedAmount || 0,
        approval_level:   approvalLevel   || 'jefe_obra',
        requested_by:     user.id,
        requested_at:     new Date().toISOString(),
      }])
      .select()
      .single()

    if (reqError) throw reqError

    const itemsPayload = items.map(item => ({
      request_id:         request.id,
      material_id:        item.materialId,
      quantity_requested: item.quantity,
      notes:              item.notes || null,
      unit_price:         item.unitPrice || 0,
    }))

    const { error: itemsError } = await supabase
      .from('material_request_items')
      .insert(itemsPayload)

    if (itemsError) throw itemsError
    return { data: request, error: null }
  } catch (error) {
    console.error('Error creating request:', error)
    return { data: null, error }
  }
}

export const submitRequest = async (requestId) => {
  try {
    const { data, error } = await supabase
      .from('material_requests')
      .update({ status: 'ENVIADA', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select().single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const approveRequest = async (requestId, notes, approvedItems, deliveryType) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('material_requests')
      .update({
        status:         'APROBADA',
        approved_by:    user.id,
        approved_at:    new Date().toISOString(),
        approval_notes: notes,
        delivery_type:  deliveryType || 'almacen',
        updated_at:     new Date().toISOString()
      })
      .eq('id', requestId)
      .select().single()

    if (error) throw error

    for (const item of approvedItems) {
      await supabase
        .from('material_request_items')
        .update({
          quantity_approved: item.quantity_approved,
          status: item.quantity_approved > 0 ? 'APROBADO' : 'RECHAZADO',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const rejectRequest = async (requestId, notes) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('material_requests')
      .update({
        status:         'RECHAZADA',
        approved_by:    user.id,
        approved_at:    new Date().toISOString(),
        approval_notes: notes,
        updated_at:     new Date().toISOString()
      })
      .eq('id', requestId)
      .select().single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// FIX: recibe warehouseId desde ReceptionModal y lo guarda en la solicitud
// antes de llamar a auto_ingest_to_inventory, para que la función SQL
// siempre tenga un warehouse_id válido
export const receiveRequest = async (requestId, receptionNotes, receivedItems, warehouseId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Actualizar ítems recibidos
    for (const item of receivedItems) {
      await supabase
        .from('material_request_items')
        .update({
          quantity_received:  item.quantityReceived,
          quantity_defective: item.quantityDefective || 0,
          defect_description: item.defectDescription || null,
          defect_photos:      item.defectPhotos      || [],
          status: item.quantityReceived >= (item.quantity_approved || item.quantity_requested)
            ? 'RECIBIDO' : 'RECIBIDO_PARCIAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
    }

    const allReceived = receivedItems.every(i =>
      i.quantityReceived >= (i.quantity_approved || i.quantity_requested))
    const hasDefects  = receivedItems.some(i => (i.quantityDefective || 0) > 0)

    const newStatus = hasDefects ? 'DEVOLUCION'
      : allReceived ? 'RECIBIDA' : 'RECIBIDA_PARCIAL'

    // 2. FIX: guardar warehouse_id en la solicitud ANTES de llamar al ingreso
    //    Así auto_ingest_to_inventory siempre encuentra un almacén válido
    const { data, error } = await supabase
      .from('material_requests')
      .update({
        status:          newStatus,
        warehouse_id:    warehouseId,          // ← almacén definido en recepción
        received_by:     user.id,
        received_at:     new Date().toISOString(),
        reception_notes: receptionNotes,
        updated_at:      new Date().toISOString()
      })
      .eq('id', requestId)
      .select().single()

    if (error) throw error

    // 3. Ingreso automático al inventario
    console.log('Llamando auto_ingest_to_inventory para:', requestId)
    const { error: ingestError } = await supabase
      .rpc('auto_ingest_to_inventory', { request_id: requestId })

    if (ingestError) {
      console.error('Error en auto_ingest_to_inventory:', ingestError)
      // No lanzamos el error para no bloquear la recepción,
      // pero lo registramos para diagnóstico
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error receiving:', error)
    return { data: null, error }
  }
}