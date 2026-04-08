// ============================================================
//  OBRIX — Multi-PAC Adapter
//  supabase/functions/_shared/pac-adapter.ts
//
//  Implementa el patrón Adaptador para 3 PACs:
//  · SW Sapien   (sw.com.mx)
//  · Formas Digitales (formasdigitales.com.mx)
//  · Digibox     (digibox.mx)
//
//  Uso:
//    const pac = getPacAdapter('sw_sapien', config)
//    const result = await pac.timbrar(xmlString)
// ============================================================

export type PacProveedor = 'sw_sapien' | 'formas_digitales' | 'digibox'

export interface PacConfig {
  pac:        PacProveedor
  ambiente:   'sandbox' | 'produccion'
  // SW Sapien
  sw_usuario?:  string
  sw_password?: string
  // Formas Digitales
  fd_api_key?:  string
  // Digibox
  db_api_key?:     string
  db_api_secret?:  string
}

export interface PacResult {
  ok:           boolean
  uuid?:        string
  xml_timbrado?: string
  qr_url?:      string
  error?:       string
  error_code?:  string
  raw:          unknown
}

export interface PacCancelResult {
  ok:          boolean
  acuse?:      string
  error?:      string
  raw:         unknown
}

// ─────────────────────────────────────────────────────────────
// Interfaz base — todos los PACs la implementan
// ─────────────────────────────────────────────────────────────
interface PacAdapter {
  timbrar(xml: string): Promise<PacResult>
  cancelar(uuid: string, rfc: string, motivo: string, uuidSustitucion?: string): Promise<PacCancelResult>
  consultar(uuid: string, rfc: string): Promise<{ vigente: boolean; raw: unknown }>
  recuperar(uuid: string): Promise<{ xml?: string; raw: unknown }>
}

// ─────────────────────────────────────────────────────────────
// SW SAPIEN — services.test.sw.com.mx / services.sw.com.mx
// ─────────────────────────────────────────────────────────────
class SwSapienAdapter implements PacAdapter {
  private baseUrl: string
  private token: string | null = null
  private tokenExpiry: number = 0

  constructor(private cfg: PacConfig) {
    this.baseUrl = cfg.ambiente === 'produccion'
      ? 'https://services.sw.com.mx'
      : 'https://services.test.sw.com.mx'
  }

  private async getToken(): Promise<string> {
    // Reutilizar token si no ha expirado (vigencia 1 hora)
    if (this.token && Date.now() < this.tokenExpiry) return this.token

    const res = await fetch(`${this.baseUrl}/security/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: this.cfg.sw_usuario,
        password: this.cfg.sw_password,
      }),
    })
    const data = await res.json()
    if (!data.status || data.status !== 'success') {
      throw new Error(`SW Sapien auth error: ${data.message || JSON.stringify(data)}`)
    }
    this.token = data.data.token
    this.tokenExpiry = Date.now() + 55 * 60 * 1000 // 55 min
    return this.token!
  }

  async timbrar(xml: string): Promise<PacResult> {
    try {
      const token = await this.getToken()
      const xmlB64 = btoa(unescape(encodeURIComponent(xml)))

      const res = await fetch(`${this.baseUrl}/cfdi33/stamp/v4/b64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `bearer ${token}`,
        },
        body: JSON.stringify({ xml: xmlB64 }),
      })
      const data = await res.json()

      if (data.status === 'success') {
        const xmlTimbrado = decodeURIComponent(escape(atob(data.data.cfdi || '')))
        const uuid = this._extractUuid(xmlTimbrado)
        return { ok: true, uuid, xml_timbrado: xmlTimbrado, raw: data }
      }
      return {
        ok: false,
        error: data.message || 'Error desconocido SW Sapien',
        error_code: data.data?.status || '',
        raw: data,
      }
    } catch (e) {
      return { ok: false, error: String(e), raw: {} }
    }
  }

  async cancelar(uuid: string, rfc: string, motivo: string, uuidSustitucion?: string): Promise<PacCancelResult> {
    try {
      const token = await this.getToken()
      const body: Record<string, string> = { uuid, rfcEmisor: rfc, motivo }
      if (uuidSustitucion) body.uuidSustitucion = uuidSustitucion

      const res = await fetch(`${this.baseUrl}/cfdi33/cancel/xml/cancelation/${rfc}/${uuid}/${motivo}`, {
        method: 'DELETE',
        headers: { 'Authorization': `bearer ${token}` },
      })
      const data = await res.json()
      return {
        ok: data.status === 'success',
        acuse: data.data?.acuse,
        error: data.message,
        raw: data,
      }
    } catch (e) {
      return { ok: false, error: String(e), raw: {} }
    }
  }

  async consultar(uuid: string, rfc: string): Promise<{ vigente: boolean; raw: unknown }> {
    try {
      const token = await this.getToken()
      const res = await fetch(`${this.baseUrl}/validation/cfdi/${uuid}/${rfc}`, {
        headers: { 'Authorization': `bearer ${token}` },
      })
      const data = await res.json()
      return { vigente: data.data?.Estado === 'Vigente', raw: data }
    } catch (e) {
      return { vigente: false, raw: {} }
    }
  }

  async recuperar(uuid: string): Promise<{ xml?: string; raw: unknown }> {
    try {
      const token = await this.getToken()
      const res = await fetch(`${this.baseUrl}/recovery/comprobante/${uuid}`, {
        headers: { 'Authorization': `bearer ${token}` },
      })
      const data = await res.json()
      return { xml: data.data?.cfdi, raw: data }
    } catch (e) {
      return { raw: {} }
    }
  }

  private _extractUuid(xml: string): string {
    const match = xml.match(/UUID="([^"]+)"/i)
    return match?.[1] || ''
  }
}

// ─────────────────────────────────────────────────────────────
// FORMAS DIGITALES — api.formasdigitales.com.mx
// ─────────────────────────────────────────────────────────────
class FormasDigitalesAdapter implements PacAdapter {
  private baseUrl: string

  constructor(private cfg: PacConfig) {
    this.baseUrl = cfg.ambiente === 'produccion'
      ? 'https://api.formasdigitales.com.mx/v1'
      : 'https://api-sandbox.formasdigitales.com.mx/v1'
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.cfg.fd_api_key || '',
    }
  }

  async timbrar(xml: string): Promise<PacResult> {
    try {
      const res = await fetch(`${this.baseUrl}/stamp`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ xml }),
      })
      const data = await res.json()

      if (data.success || data.xmlTimbrado) {
        const uuid = this._extractUuid(data.xmlTimbrado || '')
        return { ok: true, uuid, xml_timbrado: data.xmlTimbrado, raw: data }
      }
      return {
        ok: false,
        error: data.message || data.error || 'Error Formas Digitales',
        error_code: data.code || '',
        raw: data,
      }
    } catch (e) {
      return { ok: false, error: String(e), raw: {} }
    }
  }

  async cancelar(uuid: string, rfc: string, motivo: string, uuidSustitucion?: string): Promise<PacCancelResult> {
    try {
      const body: Record<string, string> = { uuid, rfcEmisor: rfc, motivo }
      if (uuidSustitucion) body.uuidSustitucion = uuidSustitucion

      const res = await fetch(`${this.baseUrl}/cancel`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      return { ok: data.success, acuse: data.acuse, error: data.message, raw: data }
    } catch (e) {
      return { ok: false, error: String(e), raw: {} }
    }
  }

  async consultar(uuid: string, _rfc: string): Promise<{ vigente: boolean; raw: unknown }> {
    try {
      const res = await fetch(`${this.baseUrl}/validate/${uuid}`, { headers: this.headers })
      const data = await res.json()
      return { vigente: data.estado === 'Vigente', raw: data }
    } catch (e) {
      return { vigente: false, raw: {} }
    }
  }

  async recuperar(uuid: string): Promise<{ xml?: string; raw: unknown }> {
    try {
      const res = await fetch(`${this.baseUrl}/recover/${uuid}`, { headers: this.headers })
      const data = await res.json()
      return { xml: data.xml, raw: data }
    } catch (e) {
      return { raw: {} }
    }
  }

  private _extractUuid(xml: string): string {
    const match = xml.match(/UUID="([^"]+)"/i)
    return match?.[1] || ''
  }
}

// ─────────────────────────────────────────────────────────────
// DIGIBOX — api.digibox.mx
// ─────────────────────────────────────────────────────────────
class DigiboxAdapter implements PacAdapter {
  private baseUrl: string

  constructor(private cfg: PacConfig) {
    this.baseUrl = cfg.ambiente === 'produccion'
      ? 'https://api.digibox.mx/v2'
      : 'https://sandbox.digibox.mx/v2'
  }

  private get headers() {
    const credentials = btoa(`${this.cfg.db_api_key}:${this.cfg.db_api_secret}`)
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    }
  }

  async timbrar(xml: string): Promise<PacResult> {
    try {
      const res = await fetch(`${this.baseUrl}/cfdi/stamp`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ xml, format: 'xml' }),
      })
      const data = await res.json()

      if (data.uuid || data.xmlTimbrado || data.cfdi) {
        const xmlTimbrado = data.xmlTimbrado || data.cfdi || ''
        return {
          ok: true,
          uuid: data.uuid || this._extractUuid(xmlTimbrado),
          xml_timbrado: xmlTimbrado,
          raw: data,
        }
      }
      return {
        ok: false,
        error: data.message || data.error || 'Error Digibox',
        error_code: data.code || data.errorCode || '',
        raw: data,
      }
    } catch (e) {
      return { ok: false, error: String(e), raw: {} }
    }
  }

  async cancelar(uuid: string, rfc: string, motivo: string, uuidSustitucion?: string): Promise<PacCancelResult> {
    try {
      const body: Record<string, string> = { uuid, rfcEmisor: rfc, motivo }
      if (uuidSustitucion) body.uuidSustitucion = uuidSustitucion

      const res = await fetch(`${this.baseUrl}/cfdi/cancel`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      return { ok: data.success || data.cancelado, acuse: data.acuse, error: data.message, raw: data }
    } catch (e) {
      return { ok: false, error: String(e), raw: {} }
    }
  }

  async consultar(uuid: string, rfc: string): Promise<{ vigente: boolean; raw: unknown }> {
    try {
      const res = await fetch(`${this.baseUrl}/cfdi/status/${uuid}?rfc=${rfc}`, { headers: this.headers })
      const data = await res.json()
      return { vigente: data.estado === 'Vigente' || data.status === 'active', raw: data }
    } catch (e) {
      return { vigente: false, raw: {} }
    }
  }

  async recuperar(uuid: string): Promise<{ xml?: string; raw: unknown }> {
    try {
      const res = await fetch(`${this.baseUrl}/cfdi/recover/${uuid}`, { headers: this.headers })
      const data = await res.json()
      return { xml: data.xml || data.cfdi, raw: data }
    } catch (e) {
      return { raw: {} }
    }
  }

  private _extractUuid(xml: string): string {
    const match = xml.match(/UUID="([^"]+)"/i)
    return match?.[1] || ''
  }
}

// ─────────────────────────────────────────────────────────────
// FACTORY — retorna el adaptador correcto
// ─────────────────────────────────────────────────────────────
export function getPacAdapter(cfg: PacConfig): PacAdapter {
  switch (cfg.pac) {
    case 'sw_sapien':       return new SwSapienAdapter(cfg)
    case 'formas_digitales': return new FormasDigitalesAdapter(cfg)
    case 'digibox':         return new DigiboxAdapter(cfg)
    default: throw new Error(`PAC no soportado: ${cfg.pac}`)
  }
}

export type { PacAdapter }
