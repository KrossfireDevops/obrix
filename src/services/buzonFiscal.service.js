// ============================================================
//  OBRIX ERP — Servicio: Buzón Fiscal SAT
//  Archivo: src/services/buzonFiscal.service.js
//  Versión: 1.0 | Marzo 2026
// ============================================================

import { supabase } from '../config/supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buzon-fiscal`;

// ── Helper para llamar a la Edge Function ───────────────────
async function callEdge(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? `Error HTTP ${res.status}`);
  }
  return json;
}

// ── Obtener perfil/company del usuario actual ───────────────
async function getCompanyId() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  return data?.company_id;
}

// ============================================================
//  QUERIES — Lectura de CFDIs desde Supabase
// ============================================================

/**
 * KPIs del buzón para el período indicado.
 * Llama a la función SQL get_buzon_stats().
 */
export async function getBuzonStats(fechaDesde, fechaHasta) {
  const companyId = await getCompanyId();

  // Intentar RPC primero — si no existe, calcular con queries directas
  try {
    const { data, error } = await supabase.rpc('get_buzon_stats', {
      p_company_id:  companyId,
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
    });
    if (!error && data) return data?.[0] ?? {};
  } catch (_) { /* RPC no disponible — usar fallback */ }

  // Fallback: calcular stats con queries directas a cfdi_documentos
  const base = supabase
    .from('cfdi_documentos')
    .eq('company_id', companyId)
    .gte('fecha_emision', fechaDesde)
    .lte('fecha_emision', fechaHasta + 'T23:59:59');

  const [recibidas, emitidas, rep, canceladas, sinContabilizar] = await Promise.all([
    base.select('total_mxn, total', { count: 'exact', head: false }).eq('direccion', 'recibida').eq('cancelado', false),
    base.select('total_mxn, total', { count: 'exact', head: false }).eq('direccion', 'emitida').eq('cancelado', false),
    base.select('id', { count: 'exact', head: true }).eq('tipo_comprobante', 'P'),
    base.select('id', { count: 'exact', head: true }).eq('cancelado', true),
    base.select('id', { count: 'exact', head: true }).eq('contabilizado', false),
  ]);

  const sumarMonto = (rows) =>
    (rows?.data ?? []).reduce((s, r) => s + Number(r.total_mxn ?? r.total ?? 0), 0);

  return {
    total_recibidas:        recibidas.count  ?? 0,
    total_emitidas:         emitidas.count   ?? 0,
    total_rep:              rep.count        ?? 0,
    total_canceladas:       canceladas.count ?? 0,
    monto_recibidas_mxn:    sumarMonto(recibidas),
    monto_emitidas_mxn:     sumarMonto(emitidas),
    cfdi_sin_contabilizar:  sinContabilizar.count ?? 0,
    cfdi_sin_tercero:       0,  // requiere RPC para calcular eficientemente
  };
}

/**
 * Lista paginada de CFDIs con filtros.
 * @param {object} filtros - { direccion, tipo_comprobante, rfc, folio, cancelado, page, pageSize }
 */
export async function getCfdis(filtros = {}) {
  const companyId = await getCompanyId();
  const {
    direccion,
    tipo_comprobante,
    rfc,
    folio,
    cancelado,
    fecha_desde,
    fecha_hasta,
    page = 1,
    pageSize = 50,
  } = filtros;

  let query = supabase
    .from('cfdi_documentos')
    .select(`
      id, uuid_cfdi, tipo_comprobante, direccion,
      emisor_rfc, emisor_nombre,
      receptor_rfc, receptor_nombre,
      serie, folio, fecha_emision,
      subtotal, total, moneda, total_mxn,
      total_impuestos_tras, metodo_pago, forma_pago,
      cancelado, estatus_sat, contabilizado,
      xml_url, pdf_url,
      tercero_id, terceros(razon_social),
      created_at
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .order('fecha_emision', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (direccion)         query = query.eq('direccion', direccion);
  if (tipo_comprobante)  query = query.eq('tipo_comprobante', tipo_comprobante);
  if (cancelado !== undefined) query = query.eq('cancelado', cancelado);
  if (fecha_desde)       query = query.gte('fecha_emision', fecha_desde);
  if (fecha_hasta)       query = query.lte('fecha_emision', fecha_hasta + 'T23:59:59');

  if (rfc) {
    query = query.or(`emisor_rfc.ilike.%${rfc}%,receptor_rfc.ilike.%${rfc}%`);
  }
  if (folio) {
    query = query.or(`folio.ilike.%${folio}%,uuid_cfdi.ilike.%${folio}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

/**
 * Detalle completo de un CFDI por UUID.
 */
export async function getCfdiDetalle(uuidCfdi) {
  const companyId = await getCompanyId();
  const { data, error } = await supabase
    .from('cfdi_documentos')
    .select(`
      *,
      terceros(id, razon_social, rfc, tipo),
      cfdi_conceptos(*),
      cfdi_impuestos(*)
    `)
    .eq('company_id', companyId)
    .eq('uuid_cfdi', uuidCfdi)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Lista de solicitudes de descarga con sus paquetes.
 */
export async function getSolicitudesDescarga(limit = 10) {
  const companyId = await getCompanyId();
  try {
    const { data, error } = await supabase
      .from('sat_solicitudes_descarga')
      .select(`
        *,
        sat_paquetes_descarga(id, numero_paquete, estado, total_xml_en_paquete, xml_procesados)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    // Si la tabla no existe (42P01) devolver vacío sin romper la UI
    if (error?.code === '42P01') return [];
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('[getSolicitudesDescarga] Tabla sat_solicitudes_descarga no disponible:', e.message);
    return [];
  }
}

/**
 * Configuración fiscal de la empresa (RFC, e.firma, sync).
 */
export async function getConfigFiscal() {
  const companyId = await getCompanyId();
  const { data, error } = await supabase
    .from('company_settings')
    .select(`
      rfc, razon_social, regimen_fiscal_emisor,
      efirma_cer_url, efirma_key_url, efirma_vencimiento, efirma_serie,
      sat_sync_activo, sat_ultimo_sync, sat_dias_descarga,
      codigo_postal_fiscal
    `)
    .eq('company_id', companyId)
    .single();
  if (error) throw error;
  // Normalizar nombres para el frontend — BuzonFiscal.jsx espera rfc_emisor
  return {
    ...data,
    rfc_emisor:           data?.rfc,
    razon_social_emisor:  data?.razon_social,
    company_id:           companyId,
  };
}

// ============================================================
//  ACCIONES — Llaman a la Edge Function
// ============================================================

/**
 * Inicia una descarga masiva de CFDIs del SAT.
 */
export async function solicitarDescarga({ fechaInicio, fechaFin, tipoDescarga, tipoComprobante }) {
  const companyId = await getCompanyId();
  const { data: { user } } = await supabase.auth.getUser();
  return callEdge('solicitar_descarga', {
    company_id:       companyId,
    fecha_inicio:     fechaInicio,
    fecha_fin:        fechaFin,
    tipo_descarga:    tipoDescarga,
    tipo_comprobante: tipoComprobante ?? null,
    iniciada_por:     user.id,
  });
}

/**
 * Verifica el estado de una solicitud en el SAT.
 */
export async function verificarSolicitud(solicitudId) {
  const companyId = await getCompanyId();
  return callEdge('verificar_solicitud', {
    company_id:   companyId,
    solicitud_id: solicitudId,
  });
}

/**
 * Descarga un paquete ZIP del SAT y procesa los XMLs.
 */
export async function descargarPaquete(paqueteId) {
  const companyId = await getCompanyId();
  return callEdge('descargar_paquete', {
    company_id: companyId,
    paquete_id: paqueteId,
  });
}

/**
 * Verifica el estatus de un CFDI individual en el SAT.
 */
export async function verificarCfdi({ uuidCfdi, emisorRfc, receptorRfc, total }) {
  const companyId = await getCompanyId();
  return callEdge('verificar_cfdi', {
    company_id:   companyId,
    uuid_cfdi:    uuidCfdi,
    emisor_rfc:   emisorRfc,
    receptor_rfc: receptorRfc,
    total:        String(total),
  });
}

// ============================================================
//  UTILIDADES DE FORMATO
// ============================================================

export const TIPO_COMPROBANTE_LABEL = {
  I: 'Ingreso',
  E: 'Egreso',
  P: 'Pago (REP)',
  T: 'Traslado',
  N: 'Nómina',
};

export const FORMA_PAGO_LABEL = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
  '99': 'Por definir',
};

export const METODO_PAGO_LABEL = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido',
};

export const USO_CFDI_LABEL = {
  G01: 'Adquisición de mercancias',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  P01: 'Por definir',
  S01: 'Sin efectos fiscales',
  D10: 'Pagos por servicios educativos',
};

export function formatMXN(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatFecha(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Calcula rango de fechas para "últimos N días"
 */
export function getRangoUltimos30Dias() {
  const hoy    = new Date();
  const inicio = new Date();
  inicio.setDate(hoy.getDate() - 30);
  return {
    fechaDesde: inicio.toISOString().split('T')[0],
    fechaHasta: hoy.toISOString().split('T')[0],
  };
}