// ==============================================================
//  OBRIX — sat-soap.ts
//  supabase/functions/buzon-fiscal/sat-soap.ts
//  Versión: 2.0 | Abril 2026
//
//  Cliente SOAP para los servicios de Descarga Masiva del SAT:
//  1. Autentica          → token de sesión
//  2. SolicitaDescarga   → IdSolicitud
//  3. VerificaSolicitud  → estado + IDs de paquetes
//  4. DescargaMasiva     → ZIP en Base64
//  5. VerificaCFDI       → estatus individual (sin e.firma)
// ==============================================================

// ─── URLs de los servicios del SAT ───────────────────────────
const SAT_URLS = {
  auth:      "https://cfdidescargamasiva.clouda.sat.gob.mx/AuthenticateConcImpl.svc",
  solicitud: "https://cfdidescargamasiva.clouda.sat.gob.mx/SolicitaDescargaService.svc",
  verifica:  "https://cfdidescargamasiva.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc",
  descarga:  "https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc",
  cfdi:      "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc",
}

// ─── Tipos ────────────────────────────────────────────────────

export interface SatClientConfig {
  rfc:    string
  cerPem: string
  keyPem: string
}

export interface SolicitaDescargaParams {
  rfcSolicitante:   string
  fechaInicio:      string   // "YYYY-MM-DD"
  fechaFin:         string   // "YYYY-MM-DD"
  tipoSolicitud:    string   // "CFDI"
  tipoComprobante?: string   // "I"|"E"|"P"|"N"|"T" — null = todos
  tipoDescarga:     string   // "emitidas"|"recibidas"|"ambas"
  rfcEmisor?:       string
  rfcReceptor?:     string
}

export interface SolicitaDescargaResult {
  idSolicitud: string
  codEstatus:  string
  mensaje:     string
}

export interface VerificaSolicitudResult {
  codEstatus:      string
  estadoSolicitud: string   // "1"|"2"|"3"|"4"
  mensaje:         string
  numeroCFDIs:     number
  idsPaquetes:     string[]
}

export interface DescargaMasivaResult {
  paqueteB64: string
  codEstatus: string
  mensaje:    string
}

export interface VerificaCfdiResult {
  estado:              string
  efectoCancelacion:   string
  codigoEstatus:       string
  esCancelable:        string
  estatusCancelacion:  string
}

// ─── Helper: extraer atributo XML ────────────────────────────
const attr = (xml: string, tag: string, attribute: string): string => {
  const patterns = [
    new RegExp(`<[^>]*:?${tag}[^>]*\\s${attribute}="([^"]*)"`, "i"),
    new RegExp(`${attribute}="([^"]*)"[^>]*<[^>]*:?${tag}`, "i"),
  ]
  for (const p of patterns) {
    const m = xml.match(p)
    if (m) return m[1]
  }
  return ""
}

// ─── Helper: extraer contenido de tag ────────────────────────
const tagContent = (xml: string, tag: string): string => {
  const pat = new RegExp(
    `<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`,
    "i"
  )
  return xml.match(pat)?.[1]?.trim() ?? ""
}

// ─── Helper: extraer todos los valores de tags repetidos ─────
const allTagValues = (xml: string, tag: string): string[] => {
  const pattern = new RegExp(
    `<[^>]*:?${tag}[^>]*>([^<]*)<\\/[^>]*:?${tag}>`,
    "gi"
  )
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(xml)) !== null) {
    if (m[1].trim()) results.push(m[1].trim())
  }
  return results
}

// ─── Helper: envelope SOAP ───────────────────────────────────
const soapEnvelope = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx/"
  xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
  <s:Header/>
  <s:Body>${body}</s:Body>
</s:Envelope>`

// ─── Helper: enviar request SOAP ─────────────────────────────
const soapFetch = async (
  url:    string,
  action: string,
  body:   string,
  token?: string
): Promise<string> => {
  const headers: Record<string, string> = {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction":   `"${action}"`,
  }
  if (token) headers["Authorization"] = `WRAP access_token="${token}"`

  const resp = await fetch(url, {
    method:  "POST",
    headers,
    body:    soapEnvelope(body),
  })

  const text = await resp.text()

  if (!resp.ok) {
    const fault = tagContent(text, "faultstring") || tagContent(text, "Message")
    throw new Error(`SAT HTTP ${resp.status}: ${fault || text.slice(0, 200)}`)
  }

  return text
}

// ─── Firmar mensaje con la clave privada ──────────────────────
const firmarMensaje = async (mensaje: string, keyPem: string): Promise<string> => {
  const pemBody = keyPem
    .replace(/-----BEGIN[^-]+-----/, "")
    .replace(/-----END[^-]+-----/, "")
    .replace(/\s/g, "")

  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const encoder  = new TextEncoder()
  const msgBytes = encoder.encode(mensaje)
  const firma    = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, msgBytes)

  return btoa(String.fromCharCode(...new Uint8Array(firma)))
}

// ─── Construir header de autenticación firmado ───────────────
const construirTokenAuth = async (
  rfc:    string,
  cerPem: string,
  keyPem: string
): Promise<string> => {
  const ahora  = new Date()
  const creado = ahora.toISOString().replace(/\.\d{3}Z$/, "Z")
  const expira = new Date(ahora.getTime() + 5 * 60 * 1000)
    .toISOString().replace(/\.\d{3}Z$/, "Z")

  const mensajeSello = `<u:Timestamp xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" u:Id="_0"><u:Created>${creado}</u:Created><u:Expires>${expira}</u:Expires></u:Timestamp>`
  const firma = await firmarMensaje(mensajeSello, keyPem)

  const cerBody = cerPem
    .replace(/-----BEGIN[^-]+-----/, "")
    .replace(/-----END[^-]+-----/, "")
    .replace(/\s/g, "")

  return `<o:Security xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <u:Timestamp xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" u:Id="_0">
    <u:Created>${creado}</u:Created>
    <u:Expires>${expira}</u:Expires>
  </u:Timestamp>
  <o:BinarySecurityToken
    u:Id="uuid-${crypto.randomUUID()}"
    xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
    ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
    EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">
    ${cerBody}
  </o:BinarySecurityToken>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="#_0">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue></DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${firma}</SignatureValue>
  </Signature>
</o:Security>`
}

// ══════════════════════════════════════════════════════════════
//  CLASE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export class SatSoapClient {
  private rfc:         string
  private cerPem:      string
  private keyPem:      string
  private token:       string | null = null
  private tokenExpira: Date   | null = null

  constructor(config: SatClientConfig) {
    this.rfc    = config.rfc
    this.cerPem = config.cerPem
    this.keyPem = config.keyPem
  }

  // ── Caché de token (4 min) ────────────────────────────────
  private async getToken(): Promise<string> {
    if (this.token && this.tokenExpira && new Date() < this.tokenExpira) {
      return this.token
    }
    this.token       = await this.autentica()
    this.tokenExpira = new Date(Date.now() + 4 * 60 * 1000)
    return this.token
  }

  // ── 1. Autentica ──────────────────────────────────────────
  async autentica(): Promise<string> {
    const securityHeader = await construirTokenAuth(this.rfc, this.cerPem, this.keyPem)

    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    ${securityHeader}
  </s:Header>
  <s:Body>
    <Autentica xmlns="http://DescargaMasivaTerceros.sat.gob.mx/"/>
  </s:Body>
</s:Envelope>`

    const resp = await fetch(SAT_URLS.auth, {
      method:  "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction":   `"http://DescargaMasivaTerceros.sat.gob.mx/IAutenticacion/Autentica"`,
      },
      body: envelope,
    })

    const xml   = await resp.text()
    const token = tagContent(xml, "AutenticaResult")

    if (!token) {
      const fault = tagContent(xml, "faultstring")
      throw new Error(`SAT Autenticación fallida: ${fault || "Sin token en la respuesta"}`)
    }

    console.log(`[sat-soap] Token obtenido para RFC: ${this.rfc}`)
    return token
  }

  // ── 2. SolicitaDescarga ───────────────────────────────────
  async solicitaDescarga(params: SolicitaDescargaParams): Promise<SolicitaDescargaResult> {
    const token = await this.getToken()

    const { rfcSolicitante, fechaInicio, fechaFin,
            tipoSolicitud, tipoComprobante, tipoDescarga,
            rfcEmisor, rfcReceptor } = params

    const emisorXml = rfcEmisor
      ? `<des:RfcEmisor>${rfcEmisor}</des:RfcEmisor>`
      : tipoDescarga === "emitidas"
        ? `<des:RfcEmisor>${rfcSolicitante}</des:RfcEmisor>`
        : ""

    const receptorXml = rfcReceptor
      ? `<des:RfcReceptores><des:RfcReceptor>${rfcReceptor}</des:RfcReceptor></des:RfcReceptores>`
      : tipoDescarga === "recibidas"
        ? `<des:RfcReceptores><des:RfcReceptor>${rfcSolicitante}</des:RfcReceptor></des:RfcReceptores>`
        : ""

    const compXml = tipoComprobante ? `TipoComprobante="${tipoComprobante}"` : ""

    const body = `<des:SolicitaDescarga>
  <des:solicitud
    RfcSolicitante="${rfcSolicitante}"
    FechaInicial="${fechaInicio}T00:00:00"
    FechaFinal="${fechaFin}T23:59:59"
    TipoSolicitud="${tipoSolicitud}"
    ${compXml}
    xmlns="http://DescargaMasivaTerceros.sat.gob.mx/">
    ${emisorXml}
    ${receptorXml}
  </des:solicitud>
</des:SolicitaDescarga>`

    const xml = await soapFetch(
      SAT_URLS.solicitud,
      "http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/SolicitaDescarga",
      body,
      token
    )

    return {
      idSolicitud: attr(xml, "SolicitaDescargaResult", "IdSolicitud"),
      codEstatus:  attr(xml, "SolicitaDescargaResult", "CodEstatus"),
      mensaje:     attr(xml, "SolicitaDescargaResult", "Mensaje"),
    }
  }

  // ── 3. VerificaSolicitud ──────────────────────────────────
  async verificaSolicitud(params: {
    idSolicitud:    string
    rfcSolicitante: string
  }): Promise<VerificaSolicitudResult> {
    const token = await this.getToken()

    const body = `<des:VerificaSolicitudDescarga>
  <des:solicitud
    IdSolicitud="${params.idSolicitud}"
    RfcSolicitante="${params.rfcSolicitante}"
    xmlns="http://DescargaMasivaTerceros.sat.gob.mx/"/>
</des:VerificaSolicitudDescarga>`

    const xml = await soapFetch(
      SAT_URLS.verifica,
      "http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/VerificaSolicitudDescarga",
      body,
      token
    )

    const idsPaquetes = allTagValues(xml, "IdsPaquetes")
      .concat(allTagValues(xml, "IdPaquete"))

    return {
      codEstatus:      attr(xml, "VerificaSolicitudDescargaResult", "CodEstatus"),
      estadoSolicitud: attr(xml, "VerificaSolicitudDescargaResult", "EstadoSolicitud"),
      mensaje:         attr(xml, "VerificaSolicitudDescargaResult", "Mensaje"),
      numeroCFDIs:     parseInt(attr(xml, "VerificaSolicitudDescargaResult", "NumeroCFDIs") || "0", 10),
      idsPaquetes,
    }
  }

  // ── 4. DescargaMasiva ─────────────────────────────────────
  async descargaMasiva(params: {
    idPaquete:      string
    rfcSolicitante: string
  }): Promise<DescargaMasivaResult> {
    const token = await this.getToken()

    const body = `<des:PeticionDescargaMasivaTercerosEntrada>
  <des:peticionDescarga
    IdPaquete="${params.idPaquete}"
    RfcSolicitante="${params.rfcSolicitante}"
    xmlns="http://DescargaMasivaTerceros.sat.gob.mx/"/>
</des:PeticionDescargaMasivaTercerosEntrada>`

    const xml = await soapFetch(
      SAT_URLS.descarga,
      "http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/DescargarPaquete",
      body,
      token
    )

    return {
      paqueteB64: tagContent(xml, "Paquete"),
      codEstatus: attr(xml, "RespuestaDescargaMasivaTercerosSalida", "CodEstatus"),
      mensaje:    attr(xml, "RespuestaDescargaMasivaTercerosSalida", "Mensaje"),
    }
  }

  // ── 5. VerificaCFDI (sin e.firma) ─────────────────────────
  async verificaCfdi(params: {
    uuidCfdi:    string
    emisorRfc:   string
    receptorRfc: string
    total:       string
  }): Promise<VerificaCfdiResult> {
    const body = `<Consulta xmlns="http://tempuri.org/">
  <expresionImpresa>
    ?re=${encodeURIComponent(params.emisorRfc)}&amp;rr=${encodeURIComponent(params.receptorRfc)}&amp;tt=${params.total}&amp;id=${params.uuidCfdi}
  </expresionImpresa>
</Consulta>`

    const xml = await soapFetch(
      SAT_URLS.cfdi,
      "http://tempuri.org/IConsultaCFDIService/Consulta",
      body
    )

    return {
      estado:             tagContent(xml, "Estado"),
      efectoCancelacion:  tagContent(xml, "EfectoCancelacion"),
      codigoEstatus:      tagContent(xml, "CodigoEstatus"),
      esCancelable:       tagContent(xml, "EsCancelable"),
      estatusCancelacion: tagContent(xml, "EstatusCancelacion"),
    }
  }
}