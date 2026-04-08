// ============================================================
//  OBRIX — Generador XML CFDI 4.0
//  supabase/functions/_shared/cfdi-generator.ts
//
//  Genera el XML CFDI 4.0 válido para SAT México
//  Compatible con: Ingreso (I) · Egreso (E) · Pago (P)
// ============================================================

export interface CfdiEmisor {
  rfc:            string
  nombre:         string
  regimenFiscal:  string
}

export interface CfdiReceptor {
  rfc:              string
  nombre:           string
  usoCfdi:          string
  regimenFiscal:    string
  domicilioFiscal:  string
}

export interface CfdiConcepto {
  claveProdServ:      string  // catálogo SAT
  noIdentificacion?:  string
  cantidad:           number
  claveUnidad:        string  // catálogo SAT
  unidad?:            string
  descripcion:        string
  valorUnitario:      number
  importe:            number
  descuento?:         number
  objetoImp:          '01' | '02' | '03'  // 01=No objeto, 02=Sí objeto, 03=Sí objeto y no obligado
  impuestos?: {
    traslados?: Array<{
      base:       number
      impuesto:   '001' | '002' | '003'  // ISR | IVA | IEPS
      tipoFactor: 'Tasa' | 'Cuota' | 'Exento'
      tasaOCuota: number
      importe:    number
    }>
    retenciones?: Array<{
      base:       number
      impuesto:   '001' | '002'
      tipoFactor: 'Tasa'
      tasaOCuota: number
      importe:    number
    }>
  }
}

export interface CfdiDocumentoRelacionado {
  uuid:           string
  numParcialidad: number
  impSaldoAnt:    number
  impPagado:      number
  impSaldoInsoluto: number
  equivalenciaDR: number
  monedaDR:       string
  objetoImpDR:    string
}

export interface CfdiInput {
  tipo:           'I' | 'E' | 'P'
  serie?:         string
  folio?:         string
  fecha:          string  // ISO 8601: 2026-03-29T10:00:00
  lugarExpedicion: string // CP
  metodoPago?:    'PUE' | 'PPD'
  formaPago?:     string  // 01=Efectivo, 03=Transferencia, etc.
  moneda?:        string
  tipoCambio?:    number
  condicionesPago?: string
  emisor:         CfdiEmisor
  receptor:       CfdiReceptor
  conceptos:      CfdiConcepto[]
  // Para Pago (P)
  pagos?: Array<{
    fechaPago:          string
    formaDePagoP:       string
    monedaP:            string
    tipoCambioP?:       number
    monto:              number
    numOperacion?:      string
    doctoRelacionado:   CfdiDocumentoRelacionado[]
  }>
  // Para Nota de Crédito (E)
  cfdiRelacionados?: {
    tipoRelacion: '01' | '02' | '03' | '04'  // 01=NC, 02=ND
    uuids: string[]
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => r2(n).toFixed(6)
const fmt2 = (n: number) => r2(n).toFixed(2)

function calcularTotales(conceptos: CfdiConcepto[]) {
  let subtotal = 0, descuento = 0, totalIva = 0, totalRet = 0
  for (const c of conceptos) {
    subtotal  += r2(c.importe)
    descuento += r2(c.descuento || 0)
    for (const t of c.impuestos?.traslados || []) totalIva += r2(t.importe)
    for (const r of c.impuestos?.retenciones || []) totalRet += r2(r.importe)
  }
  const total = r2(subtotal - descuento + totalIva - totalRet)
  return { subtotal, descuento, totalIva, totalRet, total }
}

// ─────────────────────────────────────────────────────────────
// Constructor principal
// ─────────────────────────────────────────────────────────────
export function generarXmlCfdi(input: CfdiInput): string {
  const { subtotal, descuento, totalIva, totalRet, total } = calcularTotales(input.conceptos)

  // ── Atributos del comprobante ──────────────────────────────
  const attrs: Record<string, string> = {
    'xmlns:cfdi':        'http://www.sat.gob.mx/cfd/4',
    'xmlns:xsi':         'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
    'Version':           '4.0',
    'Fecha':             input.fecha,
    'Sello':             '',   // se llena al timbrar
    'NoCertificado':     '',   // se llena al timbrar
    'Certificado':       '',   // se llena al timbrar
    'SubTotal':          fmt2(subtotal),
    'Total':             fmt2(total),
    'Moneda':            input.moneda || 'MXN',
    'TipoDeComprobante': input.tipo,
    'Exportacion':       '01',
    'LugarExpedicion':   input.lugarExpedicion,
  }

  if (input.serie)       attrs['Serie']            = input.serie
  if (input.folio)       attrs['Folio']            = input.folio
  if (descuento > 0)     attrs['Descuento']        = fmt2(descuento)
  if (input.metodoPago)  attrs['MetodoPago']       = input.metodoPago
  if (input.formaPago)   attrs['FormaPago']        = input.formaPago
  if (input.tipoCambio && input.tipoCambio !== 1) attrs['TipoCambio'] = fmt(input.tipoCambio)
  if (input.condicionesPago) attrs['CondicionesDePago'] = input.condicionesPago
  if (input.tipo === 'P') { attrs['MetodoPago'] = 'PPD'; attrs['FormaPago'] = '99'; attrs['SubTotal'] = '0'; attrs['Total'] = '0' }

  const attrsStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join('\n  ')

  // ── CFDI Relacionados (Notas de Crédito) ──────────────────
  let relacionadosXml = ''
  if (input.cfdiRelacionados?.uuids?.length) {
    const uuidsXml = input.cfdiRelacionados.uuids
      .map(u => `    <cfdi:CfdiRelacionado UUID="${u}"/>`)
      .join('\n')
    relacionadosXml = `
  <cfdi:CfdiRelacionados TipoRelacion="${input.cfdiRelacionados.tipoRelacion}">
${uuidsXml}
  </cfdi:CfdiRelacionados>`
  }

  // ── Emisor ────────────────────────────────────────────────
  const emisorXml = `
  <cfdi:Emisor
    Rfc="${input.emisor.rfc}"
    Nombre="${escaparXml(input.emisor.nombre)}"
    RegimenFiscal="${input.emisor.regimenFiscal}"/>`

  // ── Receptor ──────────────────────────────────────────────
  const receptorXml = `
  <cfdi:Receptor
    Rfc="${input.receptor.rfc}"
    Nombre="${escaparXml(input.receptor.nombre)}"
    DomicilioFiscalReceptor="${input.receptor.domicilioFiscal}"
    RegimenFiscalReceptor="${input.receptor.regimenFiscal}"
    UsoCFDI="${input.receptor.usoCfdi}"/>`

  // ── Conceptos ─────────────────────────────────────────────
  const conceptosXml = input.conceptos.map(c => {
    const impXml = (c.impuestos && (c.impuestos.traslados?.length || c.impuestos.retenciones?.length))
      ? `
      <cfdi:Impuestos>${
        (c.impuestos.traslados?.length ? `
        <cfdi:Traslados>${
          c.impuestos.traslados.map(t => `
          <cfdi:Traslado
            Base="${fmt2(t.base)}"
            Impuesto="${t.impuesto}"
            TipoFactor="${t.tipoFactor}"
            ${t.tipoFactor !== 'Exento' ? `TasaOCuota="${fmt(t.tasaOCuota)}" Importe="${fmt2(t.importe)}"` : ''}/>`)
          .join('')}
        </cfdi:Traslados>` : '') +
        (c.impuestos.retenciones?.length ? `
        <cfdi:Retenciones>${
          c.impuestos.retenciones.map(r => `
          <cfdi:Retencion
            Base="${fmt2(r.base)}"
            Impuesto="${r.impuesto}"
            TipoFactor="${r.tipoFactor}"
            TasaOCuota="${fmt(r.tasaOCuota)}"
            Importe="${fmt2(r.importe)}"/>`)
          .join('')}
        </cfdi:Retenciones>` : '')}
      </cfdi:Impuestos>` : ''

    return `
    <cfdi:Concepto
      ClaveProdServ="${c.claveProdServ}"
      ${c.noIdentificacion ? `NoIdentificacion="${c.noIdentificacion}"` : ''}
      Cantidad="${fmt(c.cantidad)}"
      ClaveUnidad="${c.claveUnidad}"
      ${c.unidad ? `Unidad="${escaparXml(c.unidad)}"` : ''}
      Descripcion="${escaparXml(c.descripcion)}"
      ValorUnitario="${fmt2(c.valorUnitario)}"
      Importe="${fmt2(c.importe)}"
      ${(c.descuento || 0) > 0 ? `Descuento="${fmt2(c.descuento!)}"` : ''}
      ObjetoImp="${c.objetoImp}">${impXml}
    </cfdi:Concepto>`
  }).join('')

  // ── Impuestos globales ────────────────────────────────────
  let impuestosGlobalesXml = ''
  if (totalIva > 0 || totalRet > 0) {
    // Consolidar traslados por tasa
    const trasladosMapa: Record<string, { base: number; importe: number; tasa: number; impuesto: string; factor: string }> = {}
    const retencionesMapa: Record<string, { base: number; importe: number; tasa: number; impuesto: string }> = {}

    for (const c of input.conceptos) {
      for (const t of c.impuestos?.traslados || []) {
        const key = `${t.impuesto}_${t.tipoFactor}_${t.tasaOCuota}`
        if (!trasladosMapa[key]) trasladosMapa[key] = { base: 0, importe: 0, tasa: t.tasaOCuota, impuesto: t.impuesto, factor: t.tipoFactor }
        trasladosMapa[key].base    += r2(t.base)
        trasladosMapa[key].importe += r2(t.importe)
      }
      for (const r of c.impuestos?.retenciones || []) {
        const key = `${r.impuesto}_${r.tasaOCuota}`
        if (!retencionesMapa[key]) retencionesMapa[key] = { base: 0, importe: 0, tasa: r.tasaOCuota, impuesto: r.impuesto }
        retencionesMapa[key].base    += r2(r.base)
        retencionesMapa[key].importe += r2(r.importe)
      }
    }

    const trasladosXml = Object.values(trasladosMapa).map(t =>
      `      <cfdi:Traslado Base="${fmt2(t.base)}" Impuesto="${t.impuesto}" TipoFactor="${t.factor}" TasaOCuota="${fmt(t.tasa)}" Importe="${fmt2(t.importe)}"/>`
    ).join('\n')

    const retencionesXml = Object.values(retencionesMapa).map(r =>
      `      <cfdi:Retencion Impuesto="${r.impuesto}" Importe="${fmt2(r.importe)}"/>`
    ).join('\n')

    impuestosGlobalesXml = `
  <cfdi:Impuestos
    ${totalIva > 0 ? `TotalImpuestosTrasladados="${fmt2(totalIva)}"` : ''}
    ${totalRet > 0 ? `TotalImpuestosRetenidos="${fmt2(totalRet)}"` : ''}>
    ${trasladosXml ? `<cfdi:Traslados>\n${trasladosXml}\n    </cfdi:Traslados>` : ''}
    ${retencionesXml ? `<cfdi:Retenciones>\n${retencionesXml}\n    </cfdi:Retenciones>` : ''}
  </cfdi:Impuestos>`
  }

  // ── Complemento de Pago ───────────────────────────────────
  let complementoPagoXml = ''
  if (input.tipo === 'P' && input.pagos?.length) {
    const pagosXml = input.pagos.map(p => {
      const docsXml = p.doctoRelacionado.map(d => `
          <pago20:DoctoRelacionado
            IdDocumento="${d.uuid}"
            MonedaDR="${d.monedaDR}"
            EquivalenciaDR="${fmt(d.equivalenciaDR)}"
            NumParcialidad="${d.numParcialidad}"
            ImpSaldoAnt="${fmt2(d.impSaldoAnt)}"
            ImpPagado="${fmt2(d.impPagado)}"
            ImpSaldoInsoluto="${fmt2(d.impSaldoInsoluto)}"
            ObjetoImpDR="${d.objetoImpDR}"/>`).join('')

      return `
      <pago20:Pago
        FechaPago="${p.fechaPago}"
        FormaDePagoP="${p.formaDePagoP}"
        MonedaP="${p.monedaP}"
        ${p.tipoCambioP && p.tipoCambioP !== 1 ? `TipoCambioP="${fmt(p.tipoCambioP)}"` : ''}
        Monto="${fmt2(p.monto)}"
        ${p.numOperacion ? `NumOperacion="${p.numOperacion}"` : ''}>${docsXml}
      </pago20:Pago>`
    }).join('')

    complementoPagoXml = `
  <cfdi:Complemento>
    <pago20:Pagos
      xmlns:pago20="http://www.sat.gob.mx/Pagos20"
      Version="2.0">
      <pago20:Totales
        MontoTotalPagos="${fmt2(input.pagos.reduce((s, p) => s + p.monto, 0))}"/>${pagosXml}
    </pago20:Pagos>
  </cfdi:Complemento>`
  }

  // ── Ensamblar XML final ───────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  ${attrsStr}>${relacionadosXml}${emisorXml}${receptorXml}
  <cfdi:Conceptos>${conceptosXml}
  </cfdi:Conceptos>${impuestosGlobalesXml}${complementoPagoXml}
</cfdi:Comprobante>`
}

function escaparXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─────────────────────────────────────────────────────────────
// Helpers para construir conceptos comunes en construcción
// ─────────────────────────────────────────────────────────────
export function conceptoAnticipo(monto: number, descripcion: string, ivaRate = 0.16): CfdiConcepto {
  const base = r2(monto / (1 + ivaRate))
  const iva  = r2(monto - base)
  return {
    claveProdServ: '72154001',  // Servicios de construcción de edificios
    claveUnidad:   'E48',       // Unidad de servicio
    unidad:        'Servicio',
    descripcion,
    cantidad:      1,
    valorUnitario: base,
    importe:       base,
    objetoImp:     '02',
    impuestos: {
      traslados: [{
        base, impuesto: '002', tipoFactor: 'Tasa',
        tasaOCuota: ivaRate, importe: iva,
      }]
    }
  }
}

export function conceptoEstimacion(
  descripcion: string, cantidad: number, valorUnitario: number, ivaRate = 0.16
): CfdiConcepto {
  const importe = r2(cantidad * valorUnitario)
  const iva     = r2(importe * ivaRate)
  return {
    claveProdServ: '72154001',
    claveUnidad:   'E48',
    unidad:        'Servicio',
    descripcion,
    cantidad,
    valorUnitario,
    importe,
    objetoImp: '02',
    impuestos: {
      traslados: [{
        base: importe, impuesto: '002', tipoFactor: 'Tasa',
        tasaOCuota: ivaRate, importe: iva,
      }]
    }
  }
}
