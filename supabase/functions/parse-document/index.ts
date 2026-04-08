// supabase/functions/parse-document-local/index.ts
// Parser local de documentos fiscales SAT — 100% open-source, sin APIs de pago
// Usa pdf-parse + regex específicas para formato CSF del SAT México

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// Nota: pdf-parse no está disponible en Deno nativamente
// Opción A: Usar pdfjs-dist (compatible con Deno)
// Opción B: Mover esta función a un backend Node.js (recomendado para pdf-parse)

// Para este ejemplo, usaremos un enfoque basado en reglas + texto plano
// En producción, considera migrar a un microservicio Node.js con pdf-parse

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ══════════════════════════════════════════════════════════════════════════════
// PATRONES DE EXTRACCIÓN PARA CSF DEL SAT (formato estándar)
// ══════════════════════════════════════════════════════════════════════════════

const PATTERNS_CSF = {
  // RFC: 3-4 letras + 6 dígitos + 3 alfanuméricos
  rfc: /RFC[:\s]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
  
  // Nombre/Razón Social: después de "Nombre:" o "Razón Social:" hasta salto de línea o dos espacios
  nombre: /(?:Nombre|Razón Social)[:\s]*([A-ZÁÉÍÓÚÑ&\.\s,\-']+?)(?:\s{2,}|$|\n)/im,
  
  // Código Postal: 5 dígitos después de "C.P." o "Código Postal"
  codigo_postal: /(?:C\.P\.|Código Postal)[:\s]*(\d{5})/i,
  
  // Régimen Fiscal: clave numérica y descripción
  clave_regimen: /Clave de régimen[:\s]*(\d{3})/i,
  regimen_fiscal: /Régimen Fiscal[:\s]*([^\n]+?)(?:\s{2,}|$|\n)/im,
  
  // Fecha inicio de operaciones
  fecha_inicio_ops: /Fecha de inicio de operaciones[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
  
  // Estatus SAT
  estatus: /Situación[:\s]*(ACTIVO|SUSPENDIDO|CANCELADO)/i,
  
  // CURP (opcional, solo personas físicas)
  curp: /CURP[:\s]*([A-Z]{4}\d{6}[A-ZÑ]{6}[A-Z0-9]{2})/i,
  
  // Domicilio fiscal (estructura compleja)
  domicilio_calle: /(?:Domicilio Fiscal|Calle)[:\s]*([^\n]+?)(?:\n|$)/im,
  domicilio_numero: /No\.(?:\s*Ext\.?)?[:\s]*([A-Z0-9\-\s]+?)(?:\s{2,}|$|\n)/im,
  domicilio_colonia: /Colonia[:\s]*([^\n]+?)(?:\n|$)/im,
  domicilio_municipio: /Municipio[:\s]*([^\n]+?)(?:\n|$)/im,
  domicilio_estado: /Entidad Federativa[:\s]*([^\n]+?)(?:\n|$)/im,
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: Parsear texto extraído de PDF
// ══════════════════════════════════════════════════════════════════════════════

function parseCSFText(text: string) {
  if (!text || text.length < 100) {
    return {
      es_csf: false,
      error: 'Texto insuficiente para parsing'
    }
  }

  // Verificar que parece una CSF del SAT
  const esCSF = /Constancia de Situación Fiscal|SAT|Servicio de Administración Tributaria/i.test(text)
  if (!esCSF) {
    return { es_csf: false, error: 'El documento no parece ser una CSF del SAT' }
  }

  // Extraer campos con regex
  const extract = (pattern: RegExp): string | null => {
    const match = text.match(pattern)
    return match ? match[1]?.trim() : null
  }

  const rfc = extract(PATTERNS_CSF.rfc)
  const nombre = extract(PATTERNS_CSF.nombre)
  const codigo_postal = extract(PATTERNS_CSF.codigo_postal)
  const clave_regimen = extract(PATTERNS_CSF.clave_regimen)
  const regimen_fiscal = extract(PATTERNS_CSF.regimen_fiscal)
  
  // Formatear fecha a ISO
  let fecha_inicio_ops = extract(PATTERNS_CSF.fecha_inicio_ops)
  if (fecha_inicio_ops) {
    const [d, m, y] = fecha_inicio_ops.split('/')
    fecha_inicio_ops = `${y}-${m}-${d}`
  }

  const estatus = extract(PATTERNS_CSF.estatus)?.toUpperCase()
  const curp = extract(PATTERNS_CSF.curp)

  // Extraer domicilio (estructurado)
  const domicilio = {
    calle: extract(PATTERNS_CSF.domicilio_calle),
    numero_exterior: extract(PATTERNS_CSF.domicilio_numero),
    numero_interior: null, // No siempre presente en CSF
    colonia: extract(PATTERNS_CSF.domicilio_colonia),
    municipio: extract(PATTERNS_CSF.domicilio_municipio),
    estado: extract(PATTERNS_CSF.domicilio_estado),
  }

  // Calcular confianza basada en campos críticos extraídos
  let confianza = 0
  if (rfc) confianza += 35
  if (nombre) confianza += 20
  if (codigo_postal) confianza += 15
  if (regimen_fiscal || clave_regimen) confianza += 15
  if (estatus) confianza += 10
  if (curp) confianza += 5

  // Validaciones adicionales
  const errores: string[] = []
  const advertencias: string[] = []

  if (!rfc) errores.push('No se encontró RFC válido')
  if (!nombre) errores.push('No se encontró nombre o razón social')
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
    errores.push('El RFC extraído no tiene formato válido')
  }

  return {
    es_csf: confianza >= 35,
    rfc,
    nombre,
    codigo_postal,
    clave_regimen,
    regimen_fiscal,
    fecha_inicio_ops,
    estatus,
    curp,
    domicilio: Object.values(domicilio).some(v => v) ? domicilio : undefined,
    confianza,
    errores,
    advertencias,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tipo_documento, archivo_base64, rfc_esperado } = await req.json()

    if (!tipo_documento || !archivo_base64) {
      return new Response(
        JSON.stringify({ error: 'Se requiere tipo_documento y archivo_base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Por ahora solo soportamos CSF con parser local
    if (tipo_documento !== 'CSF') {
      return new Response(
        JSON.stringify({ error: 'Parser local solo soporta CSF por ahora. Usa parse-document para otros tipos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decodificar base64 a texto (simplificado para PDFs con texto embebido)
    // Nota: Para PDFs complejos, considera usar pdf-parse en backend Node.js
    let textoExtraido = ''
    try {
      // Intento básico: decodificar y buscar patrones de texto
      // Para producción: usar pdf-parse o pdfjs-dist para extracción robusta
      const binary = atob(archivo_base64)
      // Buscar texto legible entre etiquetas PDF o stream de texto
      const textoMatch = binary.match(/[\x20-\x7EÁÉÍÓÚÑáéíóúñ]{20,}/g)
      if (textoMatch) {
        textoExtraido = textoMatch.join(' ')
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'No se pudo extraer texto del PDF. Intenta con un PDF de texto (no escaneado).' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!textoExtraido || textoExtraido.length < 100) {
      return new Response(
        JSON.stringify({ error: 'No se encontró texto legible en el PDF. ¿Es un PDF escaneado? Considera usar OCR.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parsear con reglas SAT
    const datosRaw = parseCSFText(textoExtraido)

    // Transformar al formato estándar esperado por el frontend
    const resultado = {
      tipo_documento: 'CSF',
      es_documento_correcto: datosRaw.es_csf,
      confianza: datosRaw.confianza,
      datos_extraidos: {
        rfc: datosRaw.rfc,
        nombre: datosRaw.nombre,
        codigo_postal: datosRaw.codigo_postal,
        clave_regimen: datosRaw.clave_regimen,
        regimen_fiscal: datosRaw.regimen_fiscal,
        fecha_inicio_ops: datosRaw.fecha_inicio_ops,
        estatus: datosRaw.estatus,
        curp: datosRaw.curp,
        domicilio: datosRaw.domicilio,
      },
      errores: datosRaw.errores,
      advertencias: datosRaw.advertencias,
    }

    // Validación cruzada RFC (opcional)
    if (rfc_esperado && resultado.datos_extraidos?.rfc) {
      const rfcDoc = String(resultado.datos_extraidos.rfc).toUpperCase().trim()
      const rfcExp = String(rfc_esperado).toUpperCase().trim()
      if (rfcDoc !== rfcExp) {
        resultado.errores.push(
          `RFC del documento (${rfcDoc}) no coincide con el RFC esperado (${rfcExp}).`
        )
        resultado.es_documento_correcto = false
        resultado.confianza = Math.min(resultado.confianza, 30)
      }
    }

    return new Response(
      JSON.stringify({ success: true, resultado }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[parse-document-local]', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del parser', detalle: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})