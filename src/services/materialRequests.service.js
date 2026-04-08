// src/services/materialRequests.service.js
import { supabase } from '../config/supabase'

const REQUEST_SELECT = `
  *,
  projects   (id, name, project_type),
  warehouses (id, name),
  material_request_items (
    *,
    materials_catalog (id, material_type, category, default_unit)
  )
`

// ── Solicitudes ───────────────────────────────────────────────────────────────

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
    console.error('Error getting requests:', error)
    return { data: null, error }
  }
}

export const getRequestById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('material_requests')
      .select(REQUEST_SELECT)
      .eq('id', id)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const createRequest = async ({ projectId, warehouseId, title, description, priority, items, companyId }) => {
  try {
    // Generar folio
    const { data: folioData } = await supabase.rpc('generate_request_folio')
    const folio = folioData || `SOL-${Date.now()}`

    const { data: { user } } = await supabase.auth.getUser()

    // Crear solicitud
    const { data: request, error: reqError } = await supabase
      .from('material_requests')
      .insert([{
        company_id:   companyId,
        project_id:   projectId,
        warehouse_id: warehouseId || null,
        folio,
        title,
        description,
        priority,
        status:       'BORRADOR',
        requested_by: user.id,
      }])
      .select()
      .single()

    if (reqError) throw reqError

    // Crear items
    const itemsPayload = items.map(item => ({
      request_id:         request.id,
      material_id:        item.materialId,
      quantity_requested: item.quantity,
      notes:              item.notes || null,
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
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── Aprobación ────────────────────────────────────────────────────────────────

export const approveRequest = async (requestId, notes, approvedItems) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Actualizar solicitud
    const { data, error } = await supabase
      .from('material_requests')
      .update({
        status:        'APROBADA',
        approved_by:   user.id,
        approved_at:   new Date().toISOString(),
        approval_notes: notes,
        updated_at:    new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw error

    // Actualizar cantidades aprobadas por ítem
    for (const item of approvedItems) {
      await supabase
        .from('material_request_items')
        .update({
          quantity_approved: item.quantityApproved,
          status: item.quantityApproved > 0 ? 'APROBADO' : 'RECHAZADO',
          notes: item.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error approving request:', error)
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
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── Recepción ─────────────────────────────────────────────────────────────────

export const receiveRequest = async (requestId, receptionNotes, receivedItems) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Actualizar items recibidos
    for (const item of receivedItems) {
      await supabase
        .from('material_request_items')
        .update({
          quantity_received:  item.quantityReceived,
          quantity_defective: item.quantityDefective || 0,
          defect_description: item.defectDescription || null,
          defect_photos:      item.defectPhotos || [],
          status: item.quantityReceived >= item.quantity_approved
            ? 'RECIBIDO' : 'RECIBIDO_PARCIAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
    }

    // Determinar estado general
    const allReceived = receivedItems.every(i => i.quantityReceived >= (i.quantity_approved || i.quantity_requested))
    const hasDefects  = receivedItems.some(i => (i.quantityDefective || 0) > 0)

    const newStatus = hasDefects
      ? 'DEVOLUCION'
      : allReceived ? 'RECIBIDA' : 'RECIBIDA_PARCIAL'

    const { data, error } = await supabase
      .from('material_requests')
      .update({
        status:          newStatus,
        received_by:     user.id,
        received_at:     new Date().toISOString(),
        reception_notes: receptionNotes,
        updated_at:      new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw error

    // Ingreso automático al inventario
    await supabase.rpc('auto_ingest_to_inventory', { request_id: requestId })

    return { data, error: null }
  } catch (error) {
    console.error('Error receiving request:', error)
    return { data: null, error }
  }
}

// ── Devolución ────────────────────────────────────────────────────────────────

export const returnItem = async (itemId, returnReason) => {
  try {
    const { data, error } = await supabase
      .from('material_request_items')
      .update({
        status:        'DEVUELTO',
        return_reason: returnReason,
        return_date:   new Date().toISOString(),
        updated_at:    new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ── Adjuntos de defectos ──────────────────────────────────────────────────────

export const uploadDefectPhoto = async (itemId, file, currentPhotos = []) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const ext  = file.name.split('.').pop()
    const path = `defects/${itemId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(path, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(path)

    const newPhotos = [...currentPhotos, {
      url:         publicUrl,
      name:        file.name,
      path,
      uploaded_at: new Date().toISOString(),
      uploaded_by: user.id
    }]

    const { data, error } = await supabase
      .from('material_request_items')
      .update({ defect_photos: newPhotos, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}