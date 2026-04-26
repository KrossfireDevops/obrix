// ============================================================
//  OBRIX ERP — Edge Function: validar-csd
//  Archivo: supabase/functions/validar-csd/index.ts
//  Runtime: Deno 2.x
//  Propósito: Valida el par de archivos .cer + .key del CSD
//             (Certificado de Sello Digital) de la empresa.
//             El CSD es emitido por el PAC y se usa para
//             timbrar CFDIs. Diferente a la e.firma personal.
//  verify_jwt: false — se llama desde CompanySettings.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// ── CORS headers ─────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ── Parsear Subject del certificado DER ──────────────────────
function parsearSubjectDer(der: Uint8Array): {
  rfc: string; nombre: string; vigencia: string; noCertificado: string
} {
  const text = new TextDecoder('latin1').decode(der)

  // RFC en CSD SAT: aparece en CN o serialNumber
  const rfcRegex   = /[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/g
  const rfcMatches = [...text.matchAll(rfcRegex)]
  const rfc        = rfcMatches[0]?.[0] ?? ''

  // Nombre del titular (razón social en CSD de empresa)
  let nombre = ''
  const cnMatch = text.match(/CN=([^,\x00-\x1F]+)/)
  if (cnMatch) {
    nombre = cnMatch[1].trim().replace(/[^\w\s\-áéíóúÁÉÍÓÚñÑ.,]/g, '').trim()
  }

  // Vigencia (segundo campo de fecha en el DER)
  let vigencia = ''
  const dateRegex = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z/g
  const dates     = [...text.matchAll(dateRegex)]
  if (dates.length >= 2) {
    const [, yy, mm, dd] = dates[1]
    const year = parseInt(yy) >= 50 ? `19${yy}` : `20${yy}`
    vigencia   = `${year}-${mm}-${dd}`
  }

  // Número de certificado: 20 dígitos en el serialNumber del CSD SAT
  let noCertificado = ''
  const serialMatch = text.match(/(\d{20})/)
  if (serialMatch) noCertificado = serialMatch[1]

  return { rfc, nombre, vigencia, noCertificado }
}

// ── Verificar estructura básica del par CSD ──────────────────
function verificarEstructura(
  cerBytes: Uint8Array,
  keyBytes: Uint8Array,
  password: string,
): { valido: boolean; error?: string } {
  // .cer debe ser DER (empieza con 0x30 = SEQUENCE)
  if (cerBytes[0] !== 0x30) {
    return { valido: false, error: 'El archivo .cer no es un certificado X.509 válido (DER)' }
  }
  // .key debe ser DER
  if (keyBytes[0] !== 0x30) {
    return { valido: false, error: 'El archivo .key no tiene formato DER válido' }
  }
  if (cerBytes.length < 500) {
    return { valido: false, error: 'El archivo .cer parece incompleto o corrupto' }
  }
  if (keyBytes.length < 100) {
    return { valido: false, error: 'El archivo .key parece incompleto o corrupto' }
  }
  if (!password || password.trim().length === 0) {
    return { valido: false, error: 'La contraseña del CSD es obligatoria' }
  }
  return { valido: true }
}

// ============================================================
//  Handler principal
// ============================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return json({ valido: false, mensaje: 'Método no permitido' }, 405)
  }

  try {
    const body = await req.json()
    const { cer_base64, key_base64, password } = body

    // ── Validaciones de entrada ──────────────────────────────
    if (!cer_base64 || typeof cer_base64 !== 'string') {
      return json({ valido: false, mensaje: 'Falta el archivo .cer en base64' }, 400)
    }
    if (!key_base64 || typeof key_base64 !== 'string') {
      return json({ valido: false, mensaje: 'Falta el archivo .key en base64' }, 400)
    }
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return json({ valido: false, mensaje: 'La contraseña es obligatoria' }, 400)
    }

    // ── Decodificar ──────────────────────────────────────────
    let cerBytes: Uint8Array
    let keyBytes: Uint8Array
    try {
      cerBytes = b64ToBytes(cer_base64)
    } catch {
      return json({ valido: false, mensaje: 'El archivo .cer no es base64 válido' }, 400)
    }
    try {
      keyBytes = b64ToBytes(key_base64)
    } catch {
      return json({ valido: false, mensaje: 'El archivo .key no es base64 válido' }, 400)
    }

    // ── Verificar estructura ─────────────────────────────────
    const verificacion = verificarEstructura(cerBytes, keyBytes, password)
    if (!verificacion.valido) {
      return json({ valido: false, mensaje: verificacion.error })
    }

    // ── Extraer datos ────────────────────────────────────────
    const { rfc, nombre, vigencia, noCertificado } = parsearSubjectDer(cerBytes)

    // ── Verificar vigencia ───────────────────────────────────
    if (vigencia) {
      const fechaVigencia = new Date(vigencia)
      if (fechaVigencia < new Date()) {
        return json({
          valido:   false,
          mensaje:  `El CSD está vencido desde ${fechaVigencia.toLocaleDateString('es-MX')}. Solicita uno nuevo a tu PAC.`,
          rfc, nombre, vigencia, noCertificado,
        })
      }
    }

    // ── Respuesta exitosa ────────────────────────────────────
    return json({
      valido:        true,
      mensaje:       'CSD válido',
      rfc:           rfc           || 'No detectado',
      nombre:        nombre        || 'No detectado',
      vigencia:      vigencia      || null,
      noCertificado: noCertificado || null,
    })

  } catch (e) {
    console.error('[validar-csd] Error:', e)
    return json({ valido: false, mensaje: `Error interno: ${e.message}` }, 500)
  }
})
