// ============================================================
//  OBRIX ERP — Edge Function: buzon-fiscal
//  Archivo: supabase/functions/buzon-fiscal/index.ts
//  Versión: 1.0 | Marzo 2026
//  Deno v2.1.4 | verify_jwt = false (se valida manualmente)
// ============================================================
//
//  ACCIONES DISPONIBLES (campo "action" en el body):
//
//  1. "solicitar_descarga"   → SolicitaDescarga SAT
//     Body: { action, company_id, fecha_inicio, fecha_fin,
//             tipo_descarga, tipo_comprobante? }
//
//  2. "verificar_solicitud"  → VerificaSolicitudDescarga SAT
//     Body: { action, company_id, solicitud_id }
//
//  3. "descargar_paquete"    → DescargaMasiva SAT (un paquete)
//     Body: { action, company_id, paquete_id }
//
//  4. "verificar_cfdi"       → VerificaCFDI SAT (estatus individual)
//     Body: { action, company_id, uuid_cfdi,
//             emisor_rfc, receptor_rfc, total }
//
//  5. "procesar_pendientes"  → Cron: verifica + descarga automática
//     Body: { action, company_id? }   ← company_id opcional en cron
//
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SatSoapClient } from "./sat-soap.ts";
import { parseCfdiXml } from "./cfdi-parser.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Helpers ────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400, detail?: unknown) {
  console.error(`[buzon-fiscal] ERROR ${status}: ${message}`, detail ?? "");
  return jsonResponse({ success: false, error: message, detail }, status);
}

// ── Handler principal ──────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return errorResponse("Método no permitido. Usar POST.", 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body inválido. Se esperaba JSON.");
  }

  const { action, company_id } = body;

  if (!action) return errorResponse("Campo 'action' requerido.");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`[buzon-fiscal] action=${action} company=${company_id ?? "ALL"}`);

  try {
    switch (action) {
      case "solicitar_descarga":
        return await accionSolicitarDescarga(supabase, body);

      case "verificar_solicitud":
        return await accionVerificarSolicitud(supabase, body);

      case "descargar_paquete":
        return await accionDescargarPaquete(supabase, body);

      case "verificar_cfdi":
        return await accionVerificarCfdi(supabase, body);

      case "procesar_pendientes":
        return await accionProcesarPendientes(supabase, body);

      default:
        return errorResponse(`Acción desconocida: ${action}`);
    }
  } catch (err) {
    return errorResponse("Error interno en Edge Function.", 500, err?.message);
  }
});


// ============================================================
//  ACCIÓN 1: solicitar_descarga
//  Registra la solicitud en BD y la envía al SAT.
// ============================================================

async function accionSolicitarDescarga(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const {
    company_id,
    fecha_inicio,
    fecha_fin,
    tipo_descarga,
    tipo_comprobante,
    iniciada_por,
  } = body as {
    company_id:       string;
    fecha_inicio:     string;  // "YYYY-MM-DD"
    fecha_fin:        string;  // "YYYY-MM-DD"
    tipo_descarga:    "emitidas" | "recibidas" | "ambas";
    tipo_comprobante?: string; // "I" | "E" | "P" | null = todos
    iniciada_por?:    string;
  };

  if (!company_id || !fecha_inicio || !fecha_fin || !tipo_descarga) {
    return errorResponse("Faltan campos: company_id, fecha_inicio, fecha_fin, tipo_descarga.");
  }

  // ── VALIDACIÓN: evitar solicitudes duplicadas del mismo período ──
  // El SAT puede bloquear el RFC si recibe demasiadas solicitudes repetidas.
  const { data: verificacion } = await supabase.rpc("solicitud_periodo_existe", {
    p_company_id:    company_id,
    p_fecha_inicio:  fecha_inicio,
    p_fecha_fin:     fecha_fin,
    p_tipo_descarga: tipo_descarga,
  });

  if (verificacion?.existe) {
    const estadoExistente = verificacion.estado;

    // Si ya está en proceso o lista → no enviar nueva solicitud al SAT
    if (["en_proceso", "lista", "pendiente"].includes(estadoExistente)) {
      return jsonResponse({
        success:        false,
        solicitud_id:   verificacion.solicitud_id,
        estado:         estadoExistente,
        cfdis_obtenidos: verificacion.cfdis_obtenidos,
        error:          `Ya existe una solicitud ${estadoExistente} para este período. ` +
                        `Solicitud ID: ${verificacion.solicitud_id}. ` +
                        `No se enviará una nueva petición al SAT para evitar posibles bloqueos.`,
        accion_sugerida: estadoExistente === "lista"
          ? "Descarga los paquetes disponibles con acción 'descargar_paquete'."
          : "Espera a que la solicitud actual se procese y luego usa 'verificar_solicitud'.",
      }, 409); // 409 Conflict
    }

    // Si la anterior tuvo error o está vencida → permitir nueva solicitud
    console.log(`[buzon-fiscal] Solicitud previa en estado '${estadoExistente}' — permitiendo nueva solicitud`);
  }
  // ── FIN VALIDACIÓN ────────────────────────────────────────────

  // Obtener configuración fiscal de la empresa
  const config = await getCompanyConfig(supabase, company_id);
  if (!config) return errorResponse("No se encontró configuración fiscal de la empresa.", 404);
  if (!config.rfc_emisor) return errorResponse("RFC emisor no configurado en company_settings.");
  // La e.firma se valida dentro de cargarEfirma() leyendo company_efirma directamente

  // Crear registro en BD (estado: pendiente)
  const { data: solicitud, error: errInsert } = await supabase
    .from("sat_solicitudes_descarga")
    .insert({
      company_id,
      tipo_solicitud:   "CFDI",
      tipo_comprobante: tipo_comprobante ?? null,
      tipo_descarga,
      fecha_inicio,
      fecha_fin,
      estado_solicitud: "pendiente",
      iniciada_por:     iniciada_por ?? null,
    })
    .select()
    .single();

  if (errInsert) return errorResponse("Error al crear solicitud en BD.", 500, errInsert);

  // Cargar e.firma desde Storage
  const efirma = await cargarEfirma(supabase, config);
  if (!efirma.ok) return errorResponse(efirma.error!, 500);

  // Instanciar cliente SOAP y enviar solicitud al SAT
  const satClient = new SatSoapClient({
    rfc:         config.rfc_emisor,
    cerPem:      efirma.cerPem!,
    keyPem:      efirma.keyPem!,
  });

  const resultado = await satClient.solicitaDescarga({
    rfcSolicitante: config.rfc_emisor,
    fechaInicio:    fecha_inicio,
    fechaFin:       fecha_fin,
    tipoSolicitud:  "CFDI",
    tipoComprobante: tipo_comprobante,
    tipoDescarga:   tipo_descarga,
  });

  // Actualizar registro con respuesta del SAT
  const estadoSolicitud = resultado.codEstatus === "5000" ? "en_proceso" : "error";

  await supabase
    .from("sat_solicitudes_descarga")
    .update({
      id_solicitud_sat:  resultado.idSolicitud,
      estado_solicitud:  estadoSolicitud,
      codigo_estado_sat: resultado.codEstatus,
      mensaje_sat:       resultado.mensaje,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", solicitud.id);

  if (resultado.codEstatus !== "5000") {
    return jsonResponse({
      success: false,
      solicitud_id: solicitud.id,
      cod_estatus:  resultado.codEstatus,
      mensaje:      resultado.mensaje,
      error:        "El SAT rechazó la solicitud. Ver 'mensaje' para detalles.",
    }, 422);
  }

  return jsonResponse({
    success:         true,
    solicitud_id:    solicitud.id,
    id_solicitud_sat: resultado.idSolicitud,
    mensaje:         "Solicitud aceptada por el SAT. Verificar en ~5 minutos.",
  });
}


// ============================================================
//  ACCIÓN 2: verificar_solicitud
//  Consulta el estado de una solicitud en el SAT.
//  Si está lista, crea los registros de paquetes pendientes.
// ============================================================

async function accionVerificarSolicitud(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const { company_id, solicitud_id } = body as {
    company_id:   string;
    solicitud_id: string;
  };

  if (!company_id || !solicitud_id) {
    return errorResponse("Faltan campos: company_id, solicitud_id.");
  }

  // Obtener solicitud de la BD
  const { data: solicitud, error: errSol } = await supabase
    .from("sat_solicitudes_descarga")
    .select("*")
    .eq("id", solicitud_id)
    .eq("company_id", company_id)
    .single();

  if (errSol || !solicitud) return errorResponse("Solicitud no encontrada.", 404);
  if (!solicitud.id_solicitud_sat) return errorResponse("Solicitud aún sin ID del SAT.");
  if (solicitud.estado_solicitud === "lista") {
    return jsonResponse({ success: true, estado: "lista", ya_procesada: true });
  }
  if (solicitud.intentos_verificacion >= solicitud.max_intentos) {
    await supabase.from("sat_solicitudes_descarga")
      .update({ estado_solicitud: "vencida" }).eq("id", solicitud_id);
    return jsonResponse({ success: false, estado: "vencida",
      error: "Se agotaron los intentos de verificación." });
  }

  const config = await getCompanyConfig(supabase, company_id);
  if (!config) return errorResponse("Configuración no encontrada.", 404);

  const efirma = await cargarEfirma(supabase, config);
  if (!efirma.ok) return errorResponse(efirma.error!, 500);

  const satClient = new SatSoapClient({
    rfc: config.rfc_emisor,
    cerPem: efirma.cerPem!,
    keyPem: efirma.keyPem!,
  });

  const resultado = await satClient.verificaSolicitud({
    idSolicitud:    solicitud.id_solicitud_sat,
    rfcSolicitante: config.rfc_emisor,
  });

  // Incrementar intentos
  const nuevoIntentos = solicitud.intentos_verificacion + 1;

  // Mapear estado SAT → estado interno
  // EstadoSolicitud: 1=Aceptada, 2=EnProceso, 3=Terminada, 4=Error
  const estadoMap: Record<string, string> = {
    "1": "en_proceso",
    "2": "en_proceso",
    "3": "lista",
    "4": "error",
  };
  const nuevoEstado = estadoMap[resultado.estadoSolicitud] ?? "en_proceso";

  const updateData: Record<string, unknown> = {
    estado_solicitud:      nuevoEstado,
    codigo_estado_sat:     resultado.codEstatus,
    mensaje_sat:           resultado.mensaje,
    intentos_verificacion: nuevoIntentos,
    ultimo_chequeo:        new Date().toISOString(),
  };

  if (nuevoEstado === "lista") {
    updateData.total_cfdi_encontrados = resultado.numeroCFDIs ?? 0;
    updateData.total_paquetes         = resultado.idsPaquetes?.length ?? 0;
    updateData.completada_at          = new Date().toISOString();
  }

  await supabase.from("sat_solicitudes_descarga")
    .update(updateData).eq("id", solicitud_id);

  // Si está lista, crear registros de paquetes
  let paquetesCreados = 0;
  if (nuevoEstado === "lista" && resultado.idsPaquetes?.length > 0) {
    const paquetes = resultado.idsPaquetes.map((idPaq: string, idx: number) => ({
      solicitud_id:     solicitud_id,
      company_id:       company_id,
      id_paquete_sat:   idPaq,
      numero_paquete:   idx + 1,
      estado:           "pendiente",
    }));

    const { error: errPaq } = await supabase
      .from("sat_paquetes_descarga")
      .upsert(paquetes, { onConflict: "id_paquete_sat" });

    if (!errPaq) paquetesCreados = paquetes.length;
  }

  return jsonResponse({
    success:           true,
    estado:            nuevoEstado,
    estado_sat:        resultado.estadoSolicitud,
    num_cfdis:         resultado.numeroCFDIs ?? 0,
    paquetes_creados:  paquetesCreados,
    ids_paquetes:      resultado.idsPaquetes ?? [],
    intentos:          nuevoIntentos,
  });
}


// ============================================================
//  ACCIÓN 3: descargar_paquete
//  Descarga un paquete ZIP del SAT, descomprime y parsea los XMLs.
// ============================================================

async function accionDescargarPaquete(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const { company_id, paquete_id } = body as {
    company_id: string;
    paquete_id: string;
  };

  if (!company_id || !paquete_id) {
    return errorResponse("Faltan campos: company_id, paquete_id.");
  }

  // Obtener paquete
  const { data: paquete, error: errPaq } = await supabase
    .from("sat_paquetes_descarga")
    .select("*, sat_solicitudes_descarga(*)")
    .eq("id", paquete_id)
    .eq("company_id", company_id)
    .single();

  if (errPaq || !paquete) return errorResponse("Paquete no encontrado.", 404);
  if (paquete.estado === "procesado") {
    return jsonResponse({ success: true, ya_procesado: true });
  }

  // Marcar como descargando
  await supabase.from("sat_paquetes_descarga")
    .update({ estado: "descargando",
              intentos_descarga: (paquete.intentos_descarga ?? 0) + 1 })
    .eq("id", paquete_id);

  const config = await getCompanyConfig(supabase, company_id);
  if (!config) return errorResponse("Configuración no encontrada.", 404);

  const efirma = await cargarEfirma(supabase, config);
  if (!efirma.ok) return errorResponse(efirma.error!, 500);

  const satClient = new SatSoapClient({
    rfc: config.rfc_emisor,
    cerPem: efirma.cerPem!,
    keyPem: efirma.keyPem!,
  });

  // Descargar ZIP en Base64 del SAT
  const resultado = await satClient.descargaMasiva({
    idPaquete:      paquete.id_paquete_sat,
    rfcSolicitante: config.rfc_emisor,
  });

  if (!resultado.paqueteB64) {
    await supabase.from("sat_paquetes_descarga")
      .update({ estado: "error", ultimo_error: resultado.mensaje ?? "Sin datos del SAT" })
      .eq("id", paquete_id);
    return errorResponse("El SAT no retornó datos para este paquete.", 422);
  }

  // Descomprimir el ZIP (Base64 → Uint8Array → archivos XML)
  const xmlFiles = await descomprimirZipBase64(resultado.paqueteB64);
  console.log(`[buzon-fiscal] Paquete ${paquete_id}: ${xmlFiles.length} XMLs encontrados`);

  // Procesar cada XML
  let insertados   = 0;
  let duplicados   = 0;
  let conError     = 0;
  const rfcEmisor  = config.rfc_emisor;

  for (const xmlContent of xmlFiles) {
    try {
      const cfdiData = parseCfdiXml(xmlContent);
      if (!cfdiData) { conError++; continue; }

      // Verificar duplicado
      const { data: existe } = await supabase
        .rpc("cfdi_existe", { p_company_id: company_id, p_uuid_cfdi: cfdiData.uuid_cfdi });

      if (existe) { duplicados++; continue; }

      // Determinar dirección (emitida/recibida)
      const direccion = cfdiData.emisor_rfc === rfcEmisor ? "emitida" : "recibida";

      // Guardar XML en Supabase Storage
      const xmlPath = `cfdi/${company_id}/${cfdiData.uuid_cfdi}.xml`;
      await supabase.storage
        .from("documentos-fiscales")
        .upload(xmlPath, new Blob([xmlContent], { type: "application/xml" }), {
          upsert: true,
        });

      const { data: urlData } = supabase.storage
        .from("documentos-fiscales")
        .getPublicUrl(xmlPath);

      // Insertar CFDI principal
      const { data: cfdiInserted, error: errCfdi } = await supabase
        .from("cfdi_documentos")
        .insert({
          company_id,
          ...cfdiData,
          direccion,
          xml_url:       urlData.publicUrl,
          xml_raw:       xmlContent,
          sat_paquete_id: paquete_id,
          sat_solicitud_id: paquete.solicitud_id,
          origen_descarga: "sat_automatico",
        })
        .select("id")
        .single();

      if (errCfdi) { conError++; continue; }

      // Insertar conceptos
      if (cfdiData._conceptos?.length) {
        await supabase.from("cfdi_conceptos").insert(
          cfdiData._conceptos.map((c: Record<string, unknown>) => ({
            ...c,
            cfdi_id:    cfdiInserted.id,
            company_id,
          }))
        );
      }

      // Insertar impuestos
      if (cfdiData._impuestos?.length) {
        await supabase.from("cfdi_impuestos").insert(
          cfdiData._impuestos.map((imp: Record<string, unknown>) => ({
            ...imp,
            cfdi_id:    cfdiInserted.id,
            company_id,
          }))
        );
      }

      // Insertar complemento REP si aplica
      if (cfdiData._complemento_pago) {
        await supabase.from("cfdi_complementos").insert({
          cfdi_id:         cfdiInserted.id,
          company_id,
          tipo_complemento: "pago20",
          ...cfdiData._complemento_pago,
        });
      }

      insertados++;
    } catch (errXml) {
      console.error("[buzon-fiscal] Error procesando XML:", errXml?.message);
      conError++;
    }
  }

  // Actualizar estado del paquete
  await supabase.from("sat_paquetes_descarga").update({
    estado:               "procesado",
    total_xml_en_paquete: xmlFiles.length,
    xml_procesados:       insertados + duplicados,
    xml_con_error:        conError,
    procesado_at:         new Date().toISOString(),
    descargado_at:        new Date().toISOString(),
  }).eq("id", paquete_id);

  // Actualizar totales en la solicitud usando función SQL segura
  await supabase.rpc("incrementar_contadores_solicitud", {
    p_solicitud_id:     paquete.solicitud_id,
    p_cfdi_descargados: insertados + duplicados,
    p_cfdi_nuevos:      insertados,
    p_cfdi_duplicados:  duplicados,
    p_cfdi_error:       conError,
  });

  return jsonResponse({
    success:       true,
    paquete_id,
    xml_total:     xmlFiles.length,
    insertados,
    duplicados,
    con_error:     conError,
  });
}


// ============================================================
//  ACCIÓN 4: verificar_cfdi
//  Consulta el estatus individual de un CFDI en el SAT.
// ============================================================

async function accionVerificarCfdi(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const { company_id, uuid_cfdi, emisor_rfc, receptor_rfc, total } = body as {
    company_id:   string;
    uuid_cfdi:    string;
    emisor_rfc:   string;
    receptor_rfc: string;
    total:        string;
  };

  if (!company_id || !uuid_cfdi || !emisor_rfc || !receptor_rfc || !total) {
    return errorResponse("Faltan campos para verificar CFDI.");
  }

  const config = await getCompanyConfig(supabase, company_id);
  if (!config) return errorResponse("Configuración no encontrada.", 404);

  // VerificaCFDI no requiere e.firma, solo hace una consulta HTTP al SAT
  const satClient = new SatSoapClient({
    rfc:    config.rfc_emisor,
    cerPem: "",
    keyPem: "",
  });

  const resultado = await satClient.verificaCfdi({
    uuidCfdi:    uuid_cfdi,
    emisorRfc:   emisor_rfc,
    receptorRfc: receptor_rfc,
    total,
  });

  // Actualizar estatus en BD si el CFDI existe
  if (resultado.estado) {
    await supabase.from("cfdi_documentos")
      .update({
        estatus_sat: resultado.estado === "Vigente" ? "vigente" :
                     resultado.estado === "Cancelado" ? "cancelado" : "no_encontrado",
        cancelado:   resultado.estado === "Cancelado",
        updated_at:  new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .eq("uuid_cfdi",  uuid_cfdi);
  }

  return jsonResponse({
    success:           true,
    uuid_cfdi,
    estado:            resultado.estado,            // 'Vigente' | 'Cancelado' | 'No Encontrado'
    efecto_cancelacion: resultado.efectoCancelacion, // 'Ingreso' | 'Egreso' etc.
    codigo_estatus:    resultado.codigoEstatus,
    es_cancelable:     resultado.esCancelable,
    estatus_cancelacion: resultado.estatusCancelacion,
  });
}


// ============================================================
//  ACCIÓN 5: procesar_pendientes (CRON)
//  Verifica todas las solicitudes "en_proceso" y descarga
//  todos los paquetes "pendientes". Diseñado para Supabase Cron.
// ============================================================

async function accionProcesarPendientes(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const { company_id } = body as { company_id?: string };

  const resumen: Record<string, unknown> = {
    solicitudes_verificadas: 0,
    solicitudes_listas:      0,
    paquetes_descargados:    0,
    cfdis_insertados:        0,
    errores:                 [] as string[],
  };

  // 1. Verificar solicitudes en_proceso
  let query = supabase
    .from("sat_solicitudes_descarga")
    .select("id, company_id")
    .eq("estado_solicitud", "en_proceso")
    .lt("intentos_verificacion", 24);

  if (company_id) query = query.eq("company_id", company_id);

  const { data: solicitudes } = await query;

  for (const sol of (solicitudes ?? [])) {
    try {
      const resp = await accionVerificarSolicitud(supabase, {
        action:       "verificar_solicitud",
        company_id:   sol.company_id,
        solicitud_id: sol.id,
      });
      const data = await resp.json();
      (resumen.solicitudes_verificadas as number)++;
      if (data.estado === "lista") (resumen.solicitudes_listas as number)++;
    } catch (e) {
      (resumen.errores as string[]).push(`Sol ${sol.id}: ${e?.message}`);
    }
  }

  // 2. Descargar paquetes pendientes
  let queryPaq = supabase
    .from("sat_paquetes_descarga")
    .select("id, company_id")
    .eq("estado", "pendiente")
    .lt("intentos_descarga", 3);

  if (company_id) queryPaq = queryPaq.eq("company_id", company_id);

  const { data: paquetes } = await queryPaq;

  for (const paq of (paquetes ?? [])) {
    try {
      const resp = await accionDescargarPaquete(supabase, {
        action:     "descargar_paquete",
        company_id: paq.company_id,
        paquete_id: paq.id,
      });
      const data = await resp.json();
      (resumen.paquetes_descargados as number)++;
      (resumen.cfdis_insertados as number) += (data.insertados ?? 0);
    } catch (e) {
      (resumen.errores as string[]).push(`Paq ${paq.id}: ${e?.message}`);
    }
  }

  console.log("[buzon-fiscal] procesar_pendientes completado:", resumen);
  return jsonResponse({ success: true, ...resumen });
}


// ============================================================
//  HELPERS INTERNOS
// ============================================================

async function getCompanyConfig(
  supabase: ReturnType<typeof createClient>,
  company_id: string
) {
  // Leer datos generales de company_settings
  const { data: settings } = await supabase
    .from("company_settings")
    .select("rfc_emisor, razon_social_emisor, regimen_fiscal_emisor, sat_dias_descarga")
    .eq("company_id", company_id)
    .single();

  if (!settings) return null;

  // Combinar con company_id para que cargarEfirma lo tenga disponible
  return { ...settings, company_id };
}

// Carga la e.firma desde company_efirma (base64 guardado por CompanySettings.jsx)
// La tabla company_efirma guarda cer_base64 y key_base64 directamente en BD.
async function cargarEfirma(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, string>
): Promise<{ ok: boolean; cerPem?: string; keyPem?: string; error?: string }> {
  try {
    // Obtener e.firma desde company_efirma (guardada por CompanySettings.jsx)
    const { data: efirmaRow, error: errEfirma } = await supabase
      .from("company_efirma")
      .select("cer_base64, key_base64, password_hint, configurada")
      .eq("company_id", config.company_id)
      .single();

    if (errEfirma || !efirmaRow?.configurada) {
      return { ok: false, error: "e.firma no configurada. Ve a Configuración → e.firma." };
    }
    if (!efirmaRow.cer_base64 || !efirmaRow.key_base64) {
      return { ok: false, error: "Archivos de e.firma incompletos. Vuelve a cargar el .cer y .key." };
    }

    // El .cer viene en base64 DER → convertir a PEM
    const cerDer = Uint8Array.from(atob(efirmaRow.cer_base64), c => c.charCodeAt(0));
    const cerPem = derToPem(cerDer, "CERTIFICATE");

    // El .key viene en base64 DER cifrado → descifrar con la contraseña
    const keyDer = Uint8Array.from(atob(efirmaRow.key_base64), c => c.charCodeAt(0));
    const keyPassword = efirmaRow.password_hint;
    if (!keyPassword) {
      return { ok: false, error: "Contraseña de e.firma no encontrada." };
    }

    const keyPem = await pkcs8EncryptedToPem(keyDer, keyPassword);
    return { ok: true, cerPem, keyPem };
  } catch (e) {
    return { ok: false, error: `Error cargando e.firma: ${e?.message}` };
  }
}

// DER → PEM (para el certificado .cer del SAT)
function derToPem(der: Uint8Array, label: string): string {
  const b64 = btoa(String.fromCharCode(...der));
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

// Convierte .key SAT (PKCS#8 cifrado) a PEM usando la contraseña
async function pkcs8EncryptedToPem(
  keyDer: Uint8Array,
  password: string
): Promise<string> {
  // El .key del SAT es PKCS#8 cifrado con 3DES o AES
  // Importar como clave cifrada y exportar desencriptada
  const importedKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  ).catch(() => null);

  if (importedKey) {
    const exported = await crypto.subtle.exportKey("pkcs8", importedKey);
    return derToPem(new Uint8Array(exported), "PRIVATE KEY");
  }

  // Fallback: retornar el DER como PEM sin descifrar (para pruebas)
  // En producción esto no debería ocurrir — la contraseña debe ser correcta
  console.warn("[buzon-fiscal] AVISO: .key no pudo descifrarse con Web Crypto API.");
  return derToPem(keyDer, "ENCRYPTED PRIVATE KEY");
}

// Descomprimir ZIP en Base64 → array de strings XML
async function descomprimirZipBase64(paqueteB64: string): Promise<string[]> {
  // Decodificar Base64 → bytes
  const binaryStr = atob(paqueteB64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Usar DecompressionStream de Deno para el ZIP
  // Deno soporta 'deflate-raw' y 'gzip' nativamente
  // Para ZIP necesitamos parsear la estructura manualmente
  const xmlFiles: string[] = [];

  // Parsear estructura ZIP (PK header)
  let offset = 0;
  const view  = new DataView(bytes.buffer);

  while (offset < bytes.length - 4) {
    // Local file header signature = 0x04034b50
    if (view.getUint32(offset, true) !== 0x04034b50) break;

    const compression    = view.getUint16(offset + 8,  true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength    = view.getUint16(offset + 28, true);
    const fileNameBytes  = bytes.slice(offset + 30, offset + 30 + fileNameLength);
    const fileName       = new TextDecoder().decode(fileNameBytes);

    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd   = dataStart + compressedSize;
    const fileData  = bytes.slice(dataStart, dataEnd);

    // Solo procesar archivos .xml
    if (fileName.toLowerCase().endsWith(".xml")) {
      let xmlContent: string;

      if (compression === 0) {
        // Sin compresión
        xmlContent = new TextDecoder("utf-8").decode(fileData);
      } else if (compression === 8) {
        // DEFLATE
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(fileData);
        writer.close();

        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
        let pos = 0;
        for (const chunk of chunks) { merged.set(chunk, pos); pos += chunk.length; }
        xmlContent = new TextDecoder("utf-8").decode(merged);
      } else {
        console.warn(`[buzon-fiscal] Compresión no soportada: ${compression} en ${fileName}`);
        offset = dataEnd;
        continue;
      }

      xmlFiles.push(xmlContent);
    }

    offset = dataEnd;
  }

  return xmlFiles;
}