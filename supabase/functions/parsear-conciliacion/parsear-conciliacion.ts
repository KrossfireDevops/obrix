// =================================================================
//  OBRIX — Edge Function: parsear-conciliacion
//  supabase/functions/parsear-conciliacion/index.ts
//
//  Recibe: { archivo_id: string }
//  Lee el archivo desde conciliacion_archivos,
//  parsea OFX o CSV, ejecuta matching contra movimientos OBRIX,
//  inserta las líneas clasificadas en conciliacion_lineas
//  y actualiza los contadores del archivo.
// =================================================================

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Tipos ────────────────────────────────────────────────────────
interface LineaBanco {
  fecha:      string        // YYYY-MM-DD
  monto:      number        // positivo = abono, negativo = cargo
  referencia: string | null
  concepto:   string | null
}

interface MovimientoObrix {
  id:     string
  fecha:  string
  monto:  number
  tipo:   string            // 'cxp' | 'cxc' | 'gasto' | 'otro'
  ref:    string | null
}

type TipoResultado =
  | 'conciliado'
  | 'discrepancia_monto'
  | 'discrepancia_fecha'
  | 'sin_registro'
  | 'no_en_banco'

interface LineaResultado {
  archivo_id:        string
  company_id:        string
  banco_fecha:       string
  banco_monto:       number
  banco_referencia:  string | null
  banco_concepto:    string | null
  tipo_resultado:    TipoResultado
  movimiento_id:     string | null
  diferencia_monto:  number | null
  diferencia_dias:   number | null
  resolucion:        'pendiente'
}

// ─── Configuración de matching ────────────────────────────────────
const TOLERANCIA_MONTO_DEFAULT = 1.00     // diferencia máxima en pesos para match exacto
const VENTANA_DIAS_DEFAULT      = 3       // días de margen en fechas

// ─── Headers CORS ────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// =================================================================
// PARSERS
// =================================================================

// ─── Parser OFX ──────────────────────────────────────────────────
function parsearOFX(contenido: string): LineaBanco[] {
  const lineas: LineaBanco[] = []

  // Extraer todos los bloques STMTTRN
  const bloques = contenido.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []

  for (const bloque of bloques) {
    const get = (tag: string): string => {
      const m = bloque.match(new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i'))
      return m ? m[1].trim() : ''
    }

    // Parsear fecha OFX: YYYYMMDD o YYYYMMDDHHMMSS[timezone]
    const rawFecha = get('DTPOSTED') || get('DTUSER')
    let fecha = ''
    if (rawFecha) {
      const solo = rawFecha.replace(/\[.*\]/, '').trim()
      if (solo.length >= 8) {
        fecha = `${solo.slice(0, 4)}-${solo.slice(4, 6)}-${solo.slice(6, 8)}`
      }
    }

    // Parsear monto
    const rawMonto = get('TRNAMT')
    const monto = parseFloat(rawMonto.replace(',', '.')) || 0

    const referencia = get('FITID') || get('CHECKNUM') || null
    const concepto   = get('MEMO') || get('NAME') || null

    if (fecha && monto !== 0) {
      lineas.push({ fecha, monto, referencia, concepto })
    }
  }

  return lineas
}

// ─── Parser CSV ───────────────────────────────────────────────────
function parsearCSV(contenido: string): LineaBanco[] {
  const lineas: LineaBanco[] = []

  // Separar líneas — manejar \r\n y \n
  const filas = contenido.split(/\r?\n/).map(l => l.trim()).filter(l => l)
  if (filas.length === 0) return lineas

  // Detectar separador: coma o punto y coma
  const separador = filas[0].includes(';') ? ';' : ','

  // Parsear CSV respetando comillas
  const parsearFila = (fila: string): string[] => {
    const cols: string[] = []
    let actual = ''
    let enComillas = false
    for (let i = 0; i < fila.length; i++) {
      const c = fila[i]
      if (c === '"') {
        if (enComillas && fila[i + 1] === '"') { actual += '"'; i++ }
        else enComillas = !enComillas
      } else if (c === separador && !enComillas) {
        cols.push(actual.trim()); actual = ''
      } else {
        actual += c
      }
    }
    cols.push(actual.trim())
    return cols
  }

  // Detectar si hay encabezado
  const primeraFila   = filas[0].toLowerCase()
  const tieneHeader   = /fecha|date|concepto|descripcion|monto|amount|cargo|abono/.test(primeraFila)
  const filasData     = tieneHeader ? filas.slice(1) : filas

  // Detectar columnas por encabezado o por posición
  let idxFecha = 0, idxConcepto = 1, idxMonto = 2, idxRef = -1

  if (tieneHeader) {
    const headers = parsearFila(filas[0]).map(h => h.toLowerCase())
    idxFecha    = headers.findIndex(h => /fecha|date/.test(h))
    idxConcepto = headers.findIndex(h => /concepto|descripcion|memo|description/.test(h))
    idxMonto    = headers.findIndex(h => /monto|importe|amount|cargo|abono/.test(h))
    idxRef      = headers.findIndex(h => /referencia|ref|folio|num/.test(h))
    // Fallback si no se detectan
    if (idxFecha    < 0) idxFecha    = 0
    if (idxConcepto < 0) idxConcepto = 1
    if (idxMonto    < 0) idxMonto    = 2
  }

  for (const fila of filasData) {
    if (!fila.trim()) continue
    const cols = parsearFila(fila)

    // Parsear fecha — soportar DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    const rawFecha = cols[idxFecha]?.replace(/["']/g, '').trim() ?? ''
    let fecha = ''
    if (/^\d{4}-\d{2}-\d{2}/.test(rawFecha)) {
      fecha = rawFecha.slice(0, 10)
    } else if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(rawFecha)) {
      const partes = rawFecha.split(/[\/-]/)
      // Intentar determinar si es DD/MM o MM/DD por el valor
      const p0 = parseInt(partes[0]), p1 = parseInt(partes[1])
      if (p0 > 12) {
        fecha = `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`
      } else {
        fecha = `${partes[2]}-${partes[0].padStart(2,'0')}-${partes[1].padStart(2,'0')}`
      }
    }

    // Parsear monto — eliminar signos de moneda, espacios, paréntesis (negativo)
    const rawMonto = cols[idxMonto]?.replace(/["'$,\s]/g, '').trim() ?? '0'
    const negativo  = rawMonto.startsWith('(') || rawMonto.startsWith('-')
    const montoNum  = parseFloat(rawMonto.replace(/[()]/g, '').replace(',', '.')) || 0
    const monto     = negativo && montoNum > 0 ? -montoNum : montoNum

    const concepto   = cols[idxConcepto]?.replace(/["']/g, '').trim() || null
    const referencia = idxRef >= 0 ? cols[idxRef]?.replace(/["']/g, '').trim() || null : null

    if (fecha && monto !== 0) {
      lineas.push({ fecha, monto, referencia, concepto })
    }
  }

  return lineas
}

// =================================================================
// MOTOR DE MATCHING
// =================================================================

// ─── Diferencia en días entre dos fechas YYYY-MM-DD ─────────────
function difDias(fechaA: string, fechaB: string): number {
  const a = new Date(fechaA + 'T12:00:00Z').getTime()
  const b = new Date(fechaB + 'T12:00:00Z').getTime()
  return Math.round((a - b) / 86_400_000)
}

// ─── Score de similitud de texto ─────────────────────────────────
function similitudTexto(a: string, b: string): number {
  if (!a || !b) return 0
  const na = a.toLowerCase().replace(/\s+/g, ' ').trim()
  const nb = b.toLowerCase().replace(/\s+/g, ' ').trim()
  if (na === nb) return 1
  // Contar palabras en común
  const wa = new Set(na.split(/\W+/).filter(w => w.length > 2))
  const wb = new Set(nb.split(/\W+/).filter(w => w.length > 2))
  let comunes = 0
  for (const w of wa) if (wb.has(w)) comunes++
  const total = Math.max(wa.size, wb.size)
  return total > 0 ? comunes / total : 0
}

// ─── Matching principal ───────────────────────────────────────────
function matchear(
  lineaBanco: LineaBanco,
  movimientos: MovimientoObrix[],
  toleranciaMonto: number,
  ventanaDias:     number,
): {
  tipo:         TipoResultado
  movimiento:   MovimientoObrix | null
  difMonto:     number | null
  difDiasVal:   number | null
} {
  const montoB  = Math.abs(lineaBanco.monto)
  const fechaB  = lineaBanco.fecha

  // Candidatos: movimientos con monto aproximado (±10% o ±tolerancia, el mayor)
  const umbral = Math.max(toleranciaMonto, montoB * 0.005)
  const candidatos = movimientos.filter(m => Math.abs(Math.abs(m.monto) - montoB) <= umbral)

  if (candidatos.length === 0) {
    return { tipo: 'sin_registro', movimiento: null, difMonto: null, difDiasVal: null }
  }

  // ── Intentar match exacto (monto exacto + fecha en ventana) ──
  for (const mov of candidatos) {
    const difM = Math.abs(Math.abs(mov.monto) - montoB)
    const difD = Math.abs(difDias(fechaB, mov.fecha))

    if (difM <= toleranciaMonto && difD <= ventanaDias) {
      // Match exacto
      const difMonto = Math.abs(mov.monto) - montoB
      return {
        tipo:       Math.abs(difMonto) < 0.01 ? 'conciliado' : 'discrepancia_monto',
        movimiento: mov,
        difMonto:   Math.abs(difMonto) < 0.01 ? null : parseFloat(difMonto.toFixed(2)),
        difDiasVal: difD > 0 ? difD : null,
      }
    }
  }

  // ── Match por monto exacto pero fecha fuera de ventana ────────
  for (const mov of candidatos) {
    const difM = Math.abs(Math.abs(mov.monto) - montoB)
    const difD = difDias(fechaB, mov.fecha)

    if (difM <= toleranciaMonto) {
      return {
        tipo:       'discrepancia_fecha',
        movimiento: mov,
        difMonto:   null,
        difDiasVal: difD,
      }
    }
  }

  // ── Match por monto aproximado (discrepancia de monto) ────────
  // Ordenar candidatos por menor diferencia de monto, luego por fecha más cercana
  candidatos.sort((a, b) => {
    const dma = Math.abs(Math.abs(a.monto) - montoB)
    const dmb = Math.abs(Math.abs(b.monto) - montoB)
    if (Math.abs(dma - dmb) > 0.01) return dma - dmb
    return Math.abs(difDias(fechaB, a.fecha)) - Math.abs(difDias(fechaB, b.fecha))
  })

  // Bonus de similitud por texto si hay referencia/concepto
  if (lineaBanco.referencia || lineaBanco.concepto) {
    candidatos.sort((a, b) => {
      const textoBanco = `${lineaBanco.referencia ?? ''} ${lineaBanco.concepto ?? ''}`
      const scoreA = similitudTexto(textoBanco, a.ref ?? '')
      const scoreB = similitudTexto(textoBanco, b.ref ?? '')
      return scoreB - scoreA
    })
  }

  const mejor = candidatos[0]
  const difMonto = Math.abs(mejor.monto) - montoB

  return {
    tipo:       'discrepancia_monto',
    movimiento: mejor,
    difMonto:   parseFloat(difMonto.toFixed(2)),
    difDiasVal: difDias(fechaB, mejor.fecha),
  }
}

// =================================================================
// HANDLER PRINCIPAL
// =================================================================
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Autenticación ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // ── Leer body ──────────────────────────────────────────────
    const body = await req.json()
    const { archivo_id, tolerancia_monto, ventana_dias } = body

    if (!archivo_id) {
      return new Response(JSON.stringify({ error: 'archivo_id es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tolerancia = typeof tolerancia_monto === 'number' ? tolerancia_monto : TOLERANCIA_MONTO_DEFAULT
    const ventana    = typeof ventana_dias      === 'number' ? ventana_dias      : VENTANA_DIAS_DEFAULT

    // ── Leer registro del archivo ──────────────────────────────
    const { data: archivo, error: errArch } = await supabase
      .from('conciliacion_archivos')
      .select('*, company_bancos(company_id)')
      .eq('id', archivo_id)
      .single()

    if (errArch || !archivo) {
      return new Response(JSON.stringify({ error: 'Archivo no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const companyId = archivo.company_bancos?.company_id
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'No se pudo determinar la empresa' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Marcar como procesando ─────────────────────────────────
    await supabase
      .from('conciliacion_archivos')
      .update({ estatus: 'procesando' })
      .eq('id', archivo_id)

    // ── Leer contenido del archivo desde Storage ───────────────
    // El archivo se subió previamente al bucket 'conciliaciones'
    const storagePath = `${companyId}/${archivo_id}/${archivo.nombre_archivo}`
    const { data: fileData, error: errFile } = await supabase.storage
      .from('conciliaciones')
      .download(storagePath)

    // Si no está en Storage (modo dev sin storage), usar contenido_raw si existe
    let contenido = ''
    if (errFile || !fileData) {
      // Fallback: leer contenido raw guardado en la tabla (campo opcional)
      const { data: rawRow } = await supabase
        .from('conciliacion_archivos')
        .select('contenido_raw')
        .eq('id', archivo_id)
        .single()

      if (!rawRow?.contenido_raw) {
        await supabase
          .from('conciliacion_archivos')
          .update({ estatus: 'error' })
          .eq('id', archivo_id)

        return new Response(JSON.stringify({ error: 'No se pudo leer el archivo' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      contenido = rawRow.contenido_raw
    } else {
      contenido = await fileData.text()
    }

    // ── Parsear según formato ──────────────────────────────────
    let lineasBanco: LineaBanco[] = []
    const fmt = archivo.formato?.toUpperCase()

    if (fmt === 'OFX') {
      lineasBanco = parsearOFX(contenido)
    } else if (fmt === 'CSV') {
      lineasBanco = parsearCSV(contenido)
    } else {
      await supabase
        .from('conciliacion_archivos')
        .update({ estatus: 'error' })
        .eq('id', archivo_id)

      return new Response(JSON.stringify({ error: `Formato no soportado: ${fmt}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (lineasBanco.length === 0) {
      await supabase
        .from('conciliacion_archivos')
        .update({ estatus: 'error' })
        .eq('id', archivo_id)

      return new Response(JSON.stringify({ error: 'No se encontraron líneas válidas en el archivo' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Cargar movimientos OBRIX del período ───────────────────
    // Buscar en CxP (gastos aprobados), CxC (facturas emitidas), gastos registrados
    const [
      { data: gastos   },
      { data: facturas },
    ] = await Promise.all([
      // Gastos aprobados con fecha de pago en el período
      supabase
        .from('gastos_registros')
        .select('id, fecha_gasto, monto_total, descripcion, referencia_pago')
        .eq('company_id', companyId)
        .gte('fecha_gasto', archivo.fecha_inicio)
        .lte('fecha_gasto', archivo.fecha_fin)
        .in('estatus', ['aprobado', 'pagado', 'reembolsado']),

      // Facturas emitidas timbradas con complemento de pago
      supabase
        .from('cfdi_documentos')
        .select('id, fecha_emision, total, receptor_nombre, uuid_cfdi')
        .eq('company_id', companyId)
        .eq('direccion', 'emitida')
        .eq('estatus_emision', 'timbrado')
        .gte('fecha_emision', archivo.fecha_inicio)
        .lte('fecha_emision', archivo.fecha_fin),
    ])

    // Normalizar movimientos OBRIX a formato común
    const movimientosObrix: MovimientoObrix[] = [
      ...(gastos ?? []).map(g => ({
        id:    g.id,
        fecha: g.fecha_gasto,
        monto: -(g.monto_total || 0),   // cargo (negativo)
        tipo:  'gasto' as const,
        ref:   g.referencia_pago || g.descripcion || null,
      })),
      ...(facturas ?? []).map(f => ({
        id:    f.id,
        fecha: f.fecha_emision,
        monto: f.total || 0,             // abono (positivo)
        tipo:  'cxc' as const,
        ref:   f.uuid_cfdi || f.receptor_nombre || null,
      })),
    ]

    // ── Ejecutar matching por cada línea del banco ─────────────
    // Llevar control de movimientos ya usados (para evitar doble match)
    const usados = new Set<string>()
    const resultados: LineaResultado[] = []

    let cntConciliados   = 0
    let cntDiscrepancias = 0
    let cntSinRegistro   = 0

    for (const lineaBanco of lineasBanco) {
      // Excluir movimientos ya vinculados
      const disponibles = movimientosObrix.filter(m => !usados.has(m.id))
      const resultado   = matchear(lineaBanco, disponibles, tolerancia, ventana)

      // Marcar como usado si hubo match
      if (resultado.movimiento) {
        usados.add(resultado.movimiento.id)
      }

      // Contadores
      if (resultado.tipo === 'conciliado')             cntConciliados++
      else if (resultado.tipo === 'sin_registro')      cntSinRegistro++
      else                                             cntDiscrepancias++

      resultados.push({
        archivo_id,
        company_id:       companyId,
        banco_fecha:      lineaBanco.fecha,
        banco_monto:      lineaBanco.monto,
        banco_referencia: lineaBanco.referencia,
        banco_concepto:   lineaBanco.concepto,
        tipo_resultado:   resultado.tipo,
        movimiento_id:    resultado.movimiento?.id ?? null,
        diferencia_monto: resultado.difMonto,
        diferencia_dias:  resultado.difDiasVal,
        resolucion:       'pendiente',
      })
    }

    // ── Detectar movimientos OBRIX sin contraparte en el banco ──
    // (en_obrix pero no_en_banco)
    const noEnBanco = movimientosObrix.filter(m => !usados.has(m.id))
    for (const mov of noEnBanco) {
      resultados.push({
        archivo_id,
        company_id:       companyId,
        banco_fecha:      mov.fecha,
        banco_monto:      mov.monto,
        banco_referencia: null,
        banco_concepto:   `[OBRIX: ${mov.tipo.toUpperCase()}] ${mov.ref ?? ''}`,
        tipo_resultado:   'no_en_banco',
        movimiento_id:    mov.id,
        diferencia_monto: null,
        diferencia_dias:  null,
        resolucion:       'pendiente',
      })
      cntDiscrepancias++
    }

    // ── Limpiar líneas anteriores si se re-procesa ─────────────
    await supabase
      .from('conciliacion_lineas')
      .delete()
      .eq('archivo_id', archivo_id)

    // ── Insertar todas las líneas en lotes de 100 ─────────────
    const BATCH = 100
    for (let i = 0; i < resultados.length; i += BATCH) {
      const lote = resultados.slice(i, i + BATCH)
      const { error: errInsert } = await supabase
        .from('conciliacion_lineas')
        .insert(lote)

      if (errInsert) {
        console.error(`Error insertando lote ${i}:`, errInsert.message)
        throw new Error(`Error al insertar líneas: ${errInsert.message}`)
      }
    }

    // ── Actualizar contadores y estatus del archivo ───────────
    const { error: errUpdate } = await supabase
      .from('conciliacion_archivos')
      .update({
        total_lineas:  lineasBanco.length,
        conciliados:   cntConciliados,
        discrepancias: cntDiscrepancias,
        sin_registro:  cntSinRegistro,
        estatus:       'revision',
      })
      .eq('id', archivo_id)

    if (errUpdate) throw new Error(`Error al actualizar archivo: ${errUpdate.message}`)

    // ── Respuesta exitosa ─────────────────────────────────────
    const respuesta = {
      ok:            true,
      archivo_id,
      total:         lineasBanco.length,
      conciliados:   cntConciliados,
      discrepancias: cntDiscrepancias,
      sin_registro:  cntSinRegistro,
      no_en_banco:   noEnBanco.length,
      pct_conciliado: lineasBanco.length > 0
        ? Math.round((cntConciliados / lineasBanco.length) * 100)
        : 0,
    }

    console.log(`[parsear-conciliacion] Completado:`, respuesta)

    return new Response(JSON.stringify(respuesta), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[parsear-conciliacion] Error:', err)

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
