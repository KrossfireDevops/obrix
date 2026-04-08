// ==============================================================
//  OBRIX — cfdi-parser.ts
//  supabase/functions/buzon-fiscal/cfdi-parser.ts
//  Versión: 2.0 | Abril 2026
//
//  Parsea el XML de un CFDI 4.0 del SAT y extrae todos los
//  campos necesarios para insertarlos en cfdi_documentos.
//
//  Soporta:
//  · Comprobante: I (Ingreso) E (Egreso) P (Pago) N (Nómina) T (Traslado)
//  · Conceptos y sus impuestos
//  · Impuestos globales (Traslados + Retenciones)
//  · Complemento de Pago 2.0 (REP)
//  · TimbreFiscalDigital (UUID, fecha timbrado, NoCertificadoSAT)
// ==============================================================

// ─── Tipos de salida ──────────────────────────────────────────

export interface CfdiParseado {
  // Campos principales → cfdi_documentos
  uuid_cfdi:                 string
  tipo_comprobante:          string        // I|E|P|N|T
  serie:                     string | null
  folio:                     string | null
  fecha_emision:             string        // YYYY-MM-DD
  lugar_expedicion:          string | null
  metodo_pago:               string | null
  forma_pago:                string | null
  condiciones_pago:          string | null
  subtotal:                  number
  descuento:                 number
  total:                     number
  moneda:                    string
  tipo_cambio:               number | null
  exportacion:               string | null
  // Emisor
  emisor_rfc:                string
  emisor_nombre:             string
  emisor_regimen:            string | null
  // Receptor
  receptor_rfc:              string
  receptor_nombre:           string
  receptor_regimen:          string | null
  uso_cfdi:                  string | null
  receptor_domicilio_fiscal: string | null
  // Timbrado
  fecha_timbrado:            string | null
  no_certificado_sat:        string | null
  sello_sat:                 string | null
  // Estatus
  estatus_emision:           string
  cancelado:                 boolean
  estatus_sat:               string
  // Arrays para tablas auxiliares
  _conceptos:                CfdiConcepto[]
  _impuestos:                CfdiImpuesto[]
  _complemento_pago:         ComplementoPago | null
}

export interface CfdiConcepto {
  clave_prod_serv:   string | null
  no_identificacion: string | null
  cantidad:          number
  clave_unidad:      string | null
  unidad:            string | null
  descripcion:       string
  valor_unitario:    number
  importe:           number
  descuento:         number | null
  objeto_imp:        string | null
}

export interface CfdiImpuesto {
  tipo:          string        // 'traslado' | 'retencion'
  impuesto:      string        // '001' ISR | '002' IVA | '003' IEPS
  tipo_factor:   string | null
  tasa_cuota:    number | null
  base_impuesto: number | null
  importe:       number | null
}

export interface ComplementoPago {
  fecha_pago:          string | null
  forma_pago_p:        string | null
  moneda_p:            string | null
  monto:               number | null
  uuid_doc_rel:        string | null
  num_parcialidad:     number | null
  imp_saldo_ant:       number | null
  imp_pagado:          number | null
  imp_saldo_insoluto:  number | null
  objeto_imp_dr:       string | null
  raw_json:            Record<string, unknown>
}

// ─── Helpers XML ──────────────────────────────────────────────

// Obtener valor de atributo — soporta cualquier namespace (cfdi:, tfd:, etc.)
const getAttr = (xml: string, tag: string, atributo: string): string => {
  const pat = new RegExp(
    `<[^>]*:?${tag}[^>]*\\s${atributo}="([^"]*)"`,
    "i"
  )
  return xml.match(pat)?.[1] ?? ""
}

// Convertir a número de forma segura
const num = (v: string | undefined | null, def = 0): number => {
  const n = parseFloat(v ?? "")
  return isNaN(n) ? def : n
}

// Limpiar fecha → YYYY-MM-DD
const toFecha = (v: string): string | null => {
  if (!v) return null
  return v.slice(0, 10)
}

// ─── Parsear Conceptos ────────────────────────────────────────

const parsearConceptos = (xml: string): CfdiConcepto[] => {
  const bloquePat = new RegExp(
    `<(?:[\\w]+:)?Conceptos>([\\s\\S]*?)<\\/(?:[\\w]+:)?Conceptos>`,
    "i"
  )
  const bloque = xml.match(bloquePat)?.[1] ?? ""
  if (!bloque) return []

  const conceptoPat = new RegExp(
    `<(?:[\\w]+:)?Concepto(\\s[^>]*?)(?:\\/>|>)`,
    "gi"
  )
  const conceptos: CfdiConcepto[] = []
  let m: RegExpExecArray | null

  while ((m = conceptoPat.exec(bloque)) !== null) {
    const attrs = m[0]
    const getA = (a: string) =>
      attrs.match(new RegExp(`\\s${a}="([^"]*)"`, "i"))?.[1] ?? ""

    conceptos.push({
      clave_prod_serv:   getA("ClaveProdServ")    || null,
      no_identificacion: getA("NoIdentificacion") || null,
      cantidad:          num(getA("Cantidad"), 1),
      clave_unidad:      getA("ClaveUnidad")      || null,
      unidad:            getA("Unidad")            || null,
      descripcion:       getA("Descripcion"),
      valor_unitario:    num(getA("ValorUnitario")),
      importe:           num(getA("Importe")),
      descuento:         getA("Descuento") ? num(getA("Descuento")) : null,
      objeto_imp:        getA("ObjetoImp")         || null,
    })
  }

  return conceptos
}

// ─── Parsear Impuestos ────────────────────────────────────────

const parsearImpuestos = (xml: string): CfdiImpuesto[] => {
  const impuestos: CfdiImpuesto[] = []

  // Traslados globales
  const trasladoPat = new RegExp(
    `<(?:[\\w]+:)?Traslado(\\s[^>]*?)(?:\\/>|>)`,
    "gi"
  )
  let m: RegExpExecArray | null

  while ((m = trasladoPat.exec(xml)) !== null) {
    const attrs = m[0]
    const getA = (a: string) =>
      attrs.match(new RegExp(`\\s${a}="([^"]*)"`, "i"))?.[1] ?? ""

    impuestos.push({
      tipo:          "traslado",
      impuesto:      getA("Impuesto"),
      tipo_factor:   getA("TipoFactor")  || null,
      tasa_cuota:    getA("TasaOCuota")  ? num(getA("TasaOCuota")) : null,
      base_impuesto: getA("Base")        ? num(getA("Base"))        : null,
      importe:       getA("Importe")     ? num(getA("Importe"))     : null,
    })
  }

  // Retenciones globales
  const retencionPat = new RegExp(
    `<(?:[\\w]+:)?Retencion(\\s[^>]*?)(?:\\/>|>)`,
    "gi"
  )

  while ((m = retencionPat.exec(xml)) !== null) {
    const attrs = m[0]
    const getA = (a: string) =>
      attrs.match(new RegExp(`\\s${a}="([^"]*)"`, "i"))?.[1] ?? ""

    impuestos.push({
      tipo:          "retencion",
      impuesto:      getA("Impuesto"),
      tipo_factor:   null,
      tasa_cuota:    null,
      base_impuesto: getA("Base")    ? num(getA("Base"))    : null,
      importe:       getA("Importe") ? num(getA("Importe")) : null,
    })
  }

  return impuestos
}

// ─── Parsear Complemento de Pago 2.0 ─────────────────────────

const parsearComplementoPago = (xml: string): ComplementoPago | null => {
  if (!/Complemento/i.test(xml) || !/Pagos/i.test(xml)) return null

  const pagoPat = new RegExp(
    `<(?:[\\w]+:)?Pago(\\s[^>]*?)(?:\\/>|>)`,
    "i"
  )
  const pagoMatch = xml.match(pagoPat)
  if (!pagoMatch) return null

  const pagoAttrs = pagoMatch[0]
  const getA = (a: string) =>
    pagoAttrs.match(new RegExp(`\\s${a}="([^"]*)"`, "i"))?.[1] ?? ""

  const docPat = new RegExp(
    `<(?:[\\w]+:)?DoctoRelacionado(\\s[^>]*?)(?:\\/>|>)`,
    "i"
  )
  const docAttrs = xml.match(docPat)?.[0] ?? ""
  const getD = (a: string) =>
    docAttrs.match(new RegExp(`\\s${a}="([^"]*)"`, "i"))?.[1] ?? ""

  const raw: Record<string, unknown> = {
    FechaPago:        getA("FechaPago"),
    FormaDePagoP:     getA("FormaDePagoP"),
    MonedaP:          getA("MonedaP"),
    Monto:            getA("Monto"),
    IdDocumento:      getD("IdDocumento"),
    NumParcialidad:   getD("NumParcialidad"),
    ImpSaldoAnt:      getD("ImpSaldoAnt"),
    ImpPagado:        getD("ImpPagado"),
    ImpSaldoInsoluto: getD("ImpSaldoInsoluto"),
    ObjetoImpDR:      getD("ObjetoImpDR"),
  }

  return {
    fecha_pago:         toFecha(getA("FechaPago")),
    forma_pago_p:       getA("FormaDePagoP")    || null,
    moneda_p:           getA("MonedaP")          || null,
    monto:              getA("Monto")            ? num(getA("Monto"))            : null,
    uuid_doc_rel:       getD("IdDocumento")      || null,
    num_parcialidad:    getD("NumParcialidad")   ? parseInt(getD("NumParcialidad"), 10) : null,
    imp_saldo_ant:      getD("ImpSaldoAnt")      ? num(getD("ImpSaldoAnt"))      : null,
    imp_pagado:         getD("ImpPagado")        ? num(getD("ImpPagado"))         : null,
    imp_saldo_insoluto: getD("ImpSaldoInsoluto") ? num(getD("ImpSaldoInsoluto")) : null,
    objeto_imp_dr:      getD("ObjetoImpDR")      || null,
    raw_json:           raw,
  }
}

// ══════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════

export function parseCfdiXml(xmlContent: string): CfdiParseado | null {
  try {
    if (!xmlContent || xmlContent.length < 100) return null

    if (!xmlContent.includes("Comprobante")) {
      console.warn("[cfdi-parser] XML no parece ser un CFDI válido")
      return null
    }

    // ── Comprobante ───────────────────────────────────────────
    const tipo        = getAttr(xmlContent, "Comprobante", "TipoDeComprobante")
    const serie       = getAttr(xmlContent, "Comprobante", "Serie")               || null
    const folio       = getAttr(xmlContent, "Comprobante", "Folio")               || null
    const fechaStr    = getAttr(xmlContent, "Comprobante", "Fecha")
    const lugar       = getAttr(xmlContent, "Comprobante", "LugarExpedicion")     || null
    const metodoPago  = getAttr(xmlContent, "Comprobante", "MetodoPago")          || null
    const formaPago   = getAttr(xmlContent, "Comprobante", "FormaPago")           || null
    const condiciones = getAttr(xmlContent, "Comprobante", "CondicionesDePago")   || null
    const subtotal    = num(getAttr(xmlContent, "Comprobante", "SubTotal"))
    const descuento   = num(getAttr(xmlContent, "Comprobante", "Descuento"))
    const total       = num(getAttr(xmlContent, "Comprobante", "Total"))
    const moneda      = getAttr(xmlContent, "Comprobante", "Moneda")              || "MXN"
    const tipoCambio  = getAttr(xmlContent, "Comprobante", "TipoCambio")
    const exportacion = getAttr(xmlContent, "Comprobante", "Exportacion")         || null

    if (!tipo || !fechaStr) {
      console.warn("[cfdi-parser] Comprobante sin TipoDeComprobante o Fecha")
      return null
    }

    // ── Emisor ────────────────────────────────────────────────
    const emisorRfc     = getAttr(xmlContent, "Emisor", "Rfc")
    const emisorNombre  = getAttr(xmlContent, "Emisor", "Nombre")
    const emisorRegimen = getAttr(xmlContent, "Emisor", "RegimenFiscal") || null

    if (!emisorRfc) {
      console.warn("[cfdi-parser] CFDI sin RFC emisor")
      return null
    }

    // ── Receptor ──────────────────────────────────────────────
    const receptorRfc     = getAttr(xmlContent, "Receptor", "Rfc")
    const receptorNombre  = getAttr(xmlContent, "Receptor", "Nombre")
    const receptorRegimen = getAttr(xmlContent, "Receptor", "RegimenFiscalReceptor") || null
    const usoCfdi         = getAttr(xmlContent, "Receptor", "UsoCFDI")               || null
    const domFiscal       = getAttr(xmlContent, "Receptor", "DomicilioFiscalReceptor") || null

    if (!receptorRfc) {
      console.warn("[cfdi-parser] CFDI sin RFC receptor")
      return null
    }

    // ── TimbreFiscalDigital ───────────────────────────────────
    const uuid = (
      getAttr(xmlContent, "TimbreFiscalDigital", "UUID") ||
      getAttr(xmlContent, "tfd:TimbreFiscalDigital", "UUID")
    ).toUpperCase()

    const fechaTimbrado = toFecha(
      getAttr(xmlContent, "TimbreFiscalDigital", "FechaTimbrado") ||
      getAttr(xmlContent, "tfd:TimbreFiscalDigital", "FechaTimbrado")
    )

    const noCertSAT = (
      getAttr(xmlContent, "TimbreFiscalDigital", "NoCertificadoSAT") ||
      getAttr(xmlContent, "tfd:TimbreFiscalDigital", "NoCertificadoSAT")
    ) || null

    const selloSAT = (
      getAttr(xmlContent, "TimbreFiscalDigital", "SelloSAT") ||
      getAttr(xmlContent, "tfd:TimbreFiscalDigital", "SelloSAT")
    ) || null

    if (!uuid) {
      console.warn("[cfdi-parser] CFDI sin UUID — podría ser borrador")
      return null
    }

    // ── Conceptos, Impuestos y Complemento ────────────────────
    const conceptos       = parsearConceptos(xmlContent)
    const impuestos       = parsearImpuestos(xmlContent)
    const complementoPago = tipo === "P" ? parsearComplementoPago(xmlContent) : null

    return {
      uuid_cfdi:                 uuid,
      tipo_comprobante:          tipo,
      serie,
      folio,
      fecha_emision:             toFecha(fechaStr) ?? fechaStr.slice(0, 10),
      lugar_expedicion:          lugar,
      metodo_pago:               metodoPago,
      forma_pago:                formaPago,
      condiciones_pago:          condiciones,
      subtotal,
      descuento,
      total,
      moneda,
      tipo_cambio:               tipoCambio ? num(tipoCambio) : null,
      exportacion,
      emisor_rfc:                emisorRfc,
      emisor_nombre:             emisorNombre,
      emisor_regimen:            emisorRegimen,
      receptor_rfc:              receptorRfc,
      receptor_nombre:           receptorNombre,
      receptor_regimen:          receptorRegimen,
      uso_cfdi:                  usoCfdi,
      receptor_domicilio_fiscal: domFiscal,
      fecha_timbrado:            fechaTimbrado,
      no_certificado_sat:        noCertSAT,
      sello_sat:                 selloSAT,
      estatus_emision:           "timbrado",
      cancelado:                 false,
      estatus_sat:               "vigente",
      _conceptos:                conceptos,
      _impuestos:                impuestos,
      _complemento_pago:         complementoPago,
    }

  } catch (e) {
    console.error("[cfdi-parser] Error parseando XML:", (e as Error)?.message)
    return null
  }
}