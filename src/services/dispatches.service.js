// src/services/dispatches.service.js
import { supabase } from '../config/supabase';

/**
 * Obtiene los despachos de la empresa actual, opcionalmente filtrados por solicitud.
 */
export async function getDispatches({ companyId, requestId = null, projectId = null } = {}) {
  let query = supabase
    .from('material_dispatches')
    .select(`
      *,
      material_request:material_requests(
        folio, project_id,
        project:projects(name)
      ),
      dispatched_by_profile:users_profiles!dispatched_by(full_name),
      dispatch_items:dispatch_items(
        *,
        material:materials_catalog(name, unit, material_code)
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (requestId) query = query.eq('request_id', requestId);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Obtiene el stock disponible en almacén para los ítems de una solicitud recibida.
 * Devuelve un array con stock actual por material.
 */
export async function getStockForRequest(requestId) {
  // 1. Traer los ítems de la solicitud con su material y almacén
  const { data: items, error: itemsError } = await supabase
    .from('material_request_items')
    .select(`
      id,
      material_id,
      quantity_approved,
      quantity_received,
      unit_price,
      material:materials_catalog(id, name, unit, material_code),
      warehouse_id
    `)
    .eq('request_id', requestId);

  if (itemsError) throw itemsError;

  // 2. Para cada ítem, obtener el stock en inventario
  const stockPromises = items.map(async (item) => {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity, warehouse_id, warehouse:warehouses(name)')
      .eq('material_id', item.material_id)
      .eq('warehouse_id', item.warehouse_id)
      .maybeSingle();

    // Precio vigente desde material_prices
    const { data: price } = await supabase
      .from('material_prices')
      .select('sale_price_obra, purchase_price, management_factor, inflation_factor, margin_pct')
      .eq('material_id', item.material_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ...item,
      stock_available: inv?.quantity ?? 0,
      warehouse_name: inv?.warehouse?.name ?? 'Sin almacén',
      sale_price_obra: price?.sale_price_obra ?? item.unit_price,
      margin_pct: price?.margin_pct ?? 0,
      // Cantidad a despachar (inicializada en 0, el usuario la llena)
      quantity_to_dispatch: 0,
    };
  });

  return Promise.all(stockPromises);
}

/**
 * Crea un despacho a obra.
 * - Genera folio via RPC
 * - Inserta en material_dispatches + dispatch_items
 * - Descuenta inventario
 * - Registra movements
 * - Cambia estado de la solicitud a CLOSED si todo fue despachado
 */
export async function createDispatch({
  companyId,
  requestId,
  projectId,
  dispatchedBy,
  notes,
  items, // [{ material_id, warehouse_id, quantity, sale_price_obra, unit_cost }]
}) {
  // Validaciones básicas
  if (!items || items.length === 0) throw new Error('Debes incluir al menos un ítem en el despacho.');
  const validItems = items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) throw new Error('Ingresa una cantidad mayor a 0 en al menos un material.');

  // 1. Generar folio
  const { data: folioData, error: folioError } = await supabase.rpc('generate_dispatch_folio');
  if (folioError) throw folioError;
  const folio = folioData;

  // 2. Calcular totales
  const total_cost = validItems.reduce((acc, i) => acc + i.unit_cost * i.quantity, 0);
  const total_sale = validItems.reduce((acc, i) => acc + i.sale_price_obra * i.quantity, 0);
  const total_margin = total_sale - total_cost;

  // 3. Insertar despacho principal
  const { data: dispatch, error: dispatchError } = await supabase
    .from('material_dispatches')
    .insert({
      folio,
      company_id: companyId,
      request_id: requestId,
      project_id: projectId,
      dispatched_by: dispatchedBy,
      notes,
      total_cost,
      total_sale,
      total_margin,
      status: 'completed',
    })
    .select()
    .single();

  if (dispatchError) throw dispatchError;

  // 4. Insertar ítems del despacho
  const dispatchItems = validItems.map((i) => ({
    dispatch_id: dispatch.id,
    material_id: i.material_id,
    warehouse_id: i.warehouse_id,
    quantity: i.quantity,
    unit_cost: i.unit_cost,
    sale_price_obra: i.sale_price_obra,
    total_cost: i.unit_cost * i.quantity,
    total_sale: i.sale_price_obra * i.quantity,
    margin: (i.sale_price_obra - i.unit_cost) * i.quantity,
  }));

  const { error: itemsError } = await supabase.from('dispatch_items').insert(dispatchItems);
  if (itemsError) throw itemsError;

  // 5. Descontar inventario y registrar movements para cada ítem
  for (const item of validItems) {
    // Descuento en inventory
    const { data: inv, error: invReadError } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('material_id', item.material_id)
      .eq('warehouse_id', item.warehouse_id)
      .single();

    if (invReadError) throw invReadError;

    const newQty = (inv.quantity || 0) - item.quantity;
    if (newQty < 0) throw new Error(`Stock insuficiente para el material ID ${item.material_id}.`);

    const { error: invUpdateError } = await supabase
      .from('inventory')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', inv.id);

    if (invUpdateError) throw invUpdateError;

    // Registro en movements
    const { error: movError } = await supabase.from('movements').insert({
      company_id: companyId,
      warehouse_id: item.warehouse_id,
      material_id: item.material_id,
      type: 'dispatch_to_site',
      quantity: -item.quantity,
      reference_id: dispatch.id,
      reference_type: 'material_dispatch',
      notes: `Despacho ${folio} a obra`,
      created_by: dispatchedBy,
    });

    if (movError) throw movError;
  }

  // 6. Verificar si la solicitud queda totalmente despachada → cerrar
  await _checkAndCloseRequest(requestId);

  return dispatch;
}

/**
 * Si todos los ítems de una solicitud han sido despachados, cambia su estado a 'closed'.
 */
async function _checkAndCloseRequest(requestId) {
  const { data: items } = await supabase
    .from('material_request_items')
    .select('quantity_approved, quantity_dispatched')
    .eq('request_id', requestId);

  if (!items) return;

  const allDispatched = items.every(
    (i) => (i.quantity_dispatched || 0) >= (i.quantity_approved || 0)
  );

  if (allDispatched) {
    await supabase
      .from('material_requests')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', requestId);
  }
}

/**
 * Obtiene el historial de despachos de una solicitud específica.
 */
export async function getDispatchesByRequest(requestId) {
  const { data, error } = await supabase
    .from('material_dispatches')
    .select(`
      *,
      dispatched_by_profile:users_profiles!dispatched_by(full_name),
      dispatch_items(
        quantity, unit_cost, sale_price_obra, total_sale, margin,
        material:materials_catalog(name, unit, material_code)
      )
    `)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}