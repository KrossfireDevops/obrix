// ============================================================
//  OBRIX ERP — Utilidades de Exportación PDF/Excel
//  Archivo: src/utils/export.utils.js
//  Versión: 2.0 | Abril 2026
//  Cambios v2.0:
//    - createHeader ahora acepta config de formato personalizado
//    - Logo de empresa desde company_settings.logo_url
//    - Colores primario/secundario configurables por formato
//    - Datos de empresa dinámicos (RFC, razón social, domicilio)
//    - Función buildPdfContext() consolida datos para cualquier formato
//    - Todas las funciones de export aceptan parámetro `config`
// ============================================================

import jsPDF    from 'jspdf'
import autoTable from 'jspdf-autotable'
import { configDefecto } from '../services/formatoConfig.service'

/* =====================================================
   UTILIDADES GENERALES
===================================================== */

export const today = () => new Date().toISOString().split('T')[0]

export const safeNumber = (value, decimals = 2) =>
  Number(parseFloat(value || 0)).toFixed(decimals)

export const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export const formatDatetime = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Convierte hex #RRGGBB → [R, G, B] para jsPDF ──────────
export const hexToRgb = (hex) => {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ]
}

// ── Número a letra (importe con letra) ────────────────────
const UNIDADES = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
  'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
const DECENAS  = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
const CENTENAS = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
  'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']

function cientosALetras(n) {
  if (n === 0)   return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const d = n % 100
  const dec = d < 20
    ? UNIDADES[d]
    : DECENAS[Math.floor(d/10)] + (d%10 ? ' Y ' + UNIDADES[d%10] : '')
  return (c ? CENTENAS[c] + (d ? ' ' : '') : '') + dec
}

function milesToLetras(n) {
  if (n === 0) return 'CERO'
  const millones = Math.floor(n / 1000000)
  const miles    = Math.floor((n % 1000000) / 1000)
  const resto    = n % 1000
  let resultado  = ''
  if (millones) resultado += (millones === 1 ? 'UN MILLÓN' : cientosALetras(millones) + ' MILLONES') + ' '
  if (miles)    resultado += (miles === 1 ? 'MIL' : cientosALetras(miles) + ' MIL') + ' '
  if (resto)    resultado += cientosALetras(resto)
  return resultado.trim()
}

export const importeConLetra = (monto, moneda = 'MXN') => {
  if (!monto && monto !== 0) return ''
  const entero   = Math.floor(Math.abs(monto))
  const centavos = Math.round((Math.abs(monto) - entero) * 100)
  return `${milesToLetras(entero)} ${String(centavos).padStart(2,'0')}/100 ${moneda}`
}

/* =====================================================
   HEADER PERSONALIZADO
===================================================== */

/**
 * Dibuja el encabezado del PDF con la configuración del formato.
 * @param {jsPDF}  doc        instancia jsPDF
 * @param {string} titulo     título del documento (ej: "FACTURA")
 * @param {object} empresa    datos de empresa {razon_social, rfc, domicilio_fiscal, telefono, email, logo_url}
 * @param {object} config     config del formato {color_primario, color_secundario, mostrar_logo}
 * @param {object} docData    datos del documento {folio, serie, fecha_emision} para mostrar en header
 * @returns {number}          posición Y donde termina el header
 */
export const createHeader = (doc, titulo, empresa = {}, config = {}, docData = {}) => {
  const cfg        = { ...configDefecto('factura'), ...config }
  const colorPrim  = hexToRgb(cfg.color_primario  || '#2563EB')
  const colorSec   = hexToRgb(cfg.color_secundario || '#1E40AF')
  const isLandscape = cfg.orientacion === 'landscape'
  const pageWidth   = isLandscape ? 297 : 216

  // ── Fondo del header ─────────────────────────────────────
  doc.setFillColor(...colorPrim)
  doc.rect(0, 0, pageWidth, 38, 'F')

  // ── Logo (si está configurado y existe URL) ──────────────
  // El logo se carga como imagen base64 antes de llamar esta función
  // y se pasa en config.logo_base64
  let xTexto = 14
  if (cfg.mostrar_logo && config.logo_base64) {
    try {
      doc.addImage(config.logo_base64, 'PNG', 10, 4, 40, 16)
      xTexto = 56
    } catch (_) {
      // Si falla la imagen, continuar sin logo
    }
  }

  // ── Título del documento ─────────────────────────────────
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo.toUpperCase(), xTexto, 14)

  // ── Razón social de la empresa ───────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (empresa.razon_social) {
    doc.text(empresa.razon_social, xTexto, 22)
  }
  if (empresa.rfc) {
    doc.text(`RFC: ${empresa.rfc}`, xTexto, 27)
  }

  // ── Folio y fecha en esquina derecha ─────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const xDerecha = pageWidth - 14
  if (docData.folio) {
    const folioTexto = docData.serie
      ? `${docData.serie}-${docData.folio}`
      : `Folio: ${docData.folio}`
    doc.text(folioTexto, xDerecha, 14, { align: 'right' })
  }
  doc.setFont('helvetica', 'normal')
  if (docData.fecha_emision) {
    doc.text(`Fecha: ${formatDate(docData.fecha_emision)}`, xDerecha, 20, { align: 'right' })
  }
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, xDerecha, 26, { align: 'right' })

  return 44  // Y donde empieza el contenido
}

/* =====================================================
   BLOQUE DE DATOS EMPRESA / CLIENTE / PROYECTO
===================================================== */

/**
 * Dibuja un bloque de información (empresa, cliente, proyecto)
 * en dos columnas lado a lado.
 */
export const drawInfoBlocks = (doc, yStart, izquierda, derecha, config = {}) => {
  const colorPrim = hexToRgb(config.color_primario || '#2563EB')
  const pageWidth = config.orientacion === 'landscape' ? 297 : 216
  const midX      = pageWidth / 2

  // Títulos de sección
  doc.setFillColor(...colorPrim)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')

  if (izquierda.titulo) {
    doc.rect(14, yStart, midX - 20, 7, 'F')
    doc.text(izquierda.titulo.toUpperCase(), 16, yStart + 5)
  }
  if (derecha.titulo) {
    doc.rect(midX + 4, yStart, midX - 18, 7, 'F')
    doc.text(derecha.titulo.toUpperCase(), midX + 6, yStart + 5)
  }

  // Contenido
  doc.setTextColor(50, 50, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  let yIzq = yStart + 12
  for (const [etiqueta, valor] of izquierda.campos || []) {
    if (!valor) continue
    doc.setFont('helvetica', 'bold')
    doc.text(`${etiqueta}:`, 16, yIzq)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(String(valor), midX - 38)
    doc.text(lines, 50, yIzq)
    yIzq += 5 * lines.length
  }

  let yDer = yStart + 12
  for (const [etiqueta, valor] of derecha.campos || []) {
    if (!valor) continue
    doc.setFont('helvetica', 'bold')
    doc.text(`${etiqueta}:`, midX + 6, yDer)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(String(valor), midX - 38)
    doc.text(lines, midX + 40, yDer)
    yDer += 5 * lines.length
  }

  return Math.max(yIzq, yDer) + 4
}

/* =====================================================
   PIE DE PÁGINA
===================================================== */

export const drawFooter = (doc, config = {}, empresa = {}) => {
  const colorPrim = hexToRgb(config.color_primario || '#2563EB')
  const isLandscape = config.orientacion === 'landscape'
  const pageWidth   = isLandscape ? 297 : 216
  const pageHeight  = isLandscape ? 216 : 279

  doc.setFillColor(...colorPrim)
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')

  const pieTexto = config.textos?.pie_pagina
    || [empresa.telefono, empresa.email, empresa.web].filter(Boolean).join('  |  ')
    || empresa.razon_social || 'OBRIX ERP'

  doc.text(pieTexto, pageWidth / 2, pageHeight - 5, { align: 'center' })
  doc.text(
    `Página ${doc.internal.getCurrentPageInfo().pageNumber}`,
    pageWidth - 14,
    pageHeight - 5,
    { align: 'right' }
  )
}

/* =====================================================
   TABLA DE CONCEPTOS / PARTIDAS
===================================================== */

export const drawTablaConceptos = (doc, yStart, conceptos = [], config = {}) => {
  const colorPrim = hexToRgb(config.color_primario || '#2563EB')

  const columnas = [
    { header: 'Cantidad',       dataKey: 'cantidad'       },
    { header: 'Código',         dataKey: 'codigo'         },
    { header: 'Descripción',    dataKey: 'descripcion'    },
    { header: 'Unidad',         dataKey: 'unidad_medida'  },
    { header: 'Precio Unit.',   dataKey: 'precio_unitario'},
    { header: 'Importe',        dataKey: 'importe'        },
  ]

  const filas = conceptos.map(c => ({
    cantidad:        safeNumber(c.cantidad, 0),
    codigo:          c.codigo          || c.clave_prod_serv || '',
    descripcion:     c.descripcion     || c.concepto        || '',
    unidad_medida:   c.unidad_medida   || c.unidad          || '',
    precio_unitario: `$${safeNumber(c.precio_unitario || c.valor_unitario)}`,
    importe:         `$${safeNumber(c.importe)}`,
  }))

  autoTable(doc, {
    startY:    yStart,
    columns:   columnas,
    body:      filas,
    theme:     'grid',
    headStyles: {
      fillColor:  colorPrim,
      textColor:  [255, 255, 255],
      fontSize:   8,
      fontStyle:  'bold',
    },
    bodyStyles:  { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
    },
  })

  return doc.lastAutoTable.finalY + 4
}

/* =====================================================
   TOTALES
===================================================== */

export const drawTotales = (doc, yStart, totales = {}, config = {}) => {
  const colorPrim   = hexToRgb(config.color_primario || '#2563EB')
  const isLandscape = config.orientacion === 'landscape'
  const pageWidth   = isLandscape ? 297 : 216
  const xDerecha    = pageWidth - 14

  const filas = [
    ['Subtotal',    `$${safeNumber(totales.subtotal)}`],
    ['Descuento',   totales.descuento ? `-$${safeNumber(totales.descuento)}` : null],
    ['IVA (16%)',   `$${safeNumber(totales.iva || totales.total_impuestos_trasladados)}`],
    ['Retenciones', totales.retenciones ? `-$${safeNumber(totales.retenciones)}` : null],
  ].filter(([, v]) => v !== null)

  let y = yStart
  doc.setFontSize(8)

  for (const [etiqueta, valor] of filas) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(etiqueta, xDerecha - 30, y, { align: 'right' })
    doc.text(valor,    xDerecha,       y, { align: 'right' })
    y += 6
  }

  // Total final con fondo de color
  doc.setFillColor(...colorPrim)
  doc.rect(pageWidth - 70, y - 4, 56, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TOTAL',                              xDerecha - 30, y + 3, { align: 'right' })
  doc.text(`$${safeNumber(totales.total)}`,      xDerecha,      y + 3, { align: 'right' })

  // Importe con letra
  if (totales.total) {
    y += 14
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    const letra = importeConLetra(totales.total, totales.moneda || 'MXN')
    doc.text(`Son: ${letra}`, 14, y)
    y += 6
  }

  return y
}

/* =====================================================
   NOTA / TÉRMINOS Y CONDICIONES
===================================================== */

export const drawNotas = (doc, yStart, nota = '', config = {}) => {
  if (!nota) return yStart
  const isLandscape = config.orientacion === 'landscape'
  const pageWidth   = isLandscape ? 297 : 216

  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120, 120, 120)
  doc.text('Notas:', 14, yStart)
  const lines = doc.splitTextToSize(nota, pageWidth - 28)
  doc.text(lines, 14, yStart + 5)
  return yStart + 5 + lines.length * 4 + 4
}

/* =====================================================
   FUNCIÓN PRINCIPAL: buildPdf
   Construye cualquier PDF aplicando la config del formato
===================================================== */

/**
 * Construye un PDF aplicando la configuración del formato.
 * @param {object} params
 * @param {string} params.formatoId     'factura' | 'cotizacion' | 'orden_compra' | etc.
 * @param {string} params.titulo        Título del documento
 * @param {object} params.config        Config del formato (de formatoConfig.service.js)
 * @param {object} params.empresa       Datos de empresa
 * @param {object} params.cliente       Datos de cliente/proveedor
 * @param {object} params.proyecto      Datos de proyecto (opcional)
 * @param {object} params.empleado      Datos de empleado (opcional)
 * @param {object} params.doc           Datos del documento (folio, fechas, totales)
 * @param {Array}  params.conceptos     Líneas de la tabla de conceptos
 * @param {string} params.fileName      Nombre del archivo a descargar
 */
export const buildPdf = ({
  formatoId  = 'factura',
  titulo     = 'DOCUMENTO',
  config     = {},
  empresa    = {},
  cliente    = {},
  proyecto   = {},
  empleado   = {},
  doc: docData = {},
  conceptos  = [],
  fileName   = `documento_${today()}.pdf`,
}) => {
  const cfg = { ...configDefecto(formatoId), ...config }

  const orientation = cfg.orientacion === 'landscape' ? 'landscape' : 'portrait'
  const format      = cfg.tamano_papel === 'a4' ? 'a4' : [216, 279]  // letter

  const doc = new jsPDF({ orientation, format, unit: 'mm' })

  // ── Header ───────────────────────────────────────────────
  let y = createHeader(doc, titulo, empresa, cfg, docData)

  // ── Datos empresa / cliente ───────────────────────────────
  const camposEmpresa = cfg.campos?.empresa || {}
  const camposCliente = cfg.campos?.cliente || {}

  const bloqueEmpresa = {
    titulo: 'Datos del Emisor',
    campos: [
      camposEmpresa.rfc             && ['RFC',         empresa.rfc],
      camposEmpresa.regimen_fiscal  && ['Régimen',     empresa.regimen_fiscal],
      camposEmpresa.domicilio_fiscal&& ['Domicilio',   empresa.domicilio_fiscal],
      camposEmpresa.telefono        && ['Tel.',        empresa.telefono],
      camposEmpresa.email           && ['Email',       empresa.email],
      camposEmpresa.web             && ['Web',         empresa.web],
    ].filter(Boolean),
  }

  // Cliente o proveedor
  const esProveedor = formatoId === 'orden_compra'
  const bloqueCliente = {
    titulo: esProveedor ? 'Datos del Proveedor' : 'Datos del Receptor',
    campos: [
      camposCliente.razon_social    && ['Razón Social', cliente.razon_social],
      camposCliente.rfc             && ['RFC',          cliente.rfc],
      camposCliente.regimen_fiscal  && ['Régimen',      cliente.regimen_fiscal],
      camposCliente.cp              && ['C.P.',         cliente.codigo_postal],
      camposCliente.domicilio       && ['Domicilio',    [
        cliente.calle, cliente.numero_ext,
        cliente.colonia, cliente.ciudad, cliente.estado,
      ].filter(Boolean).join(', ')],
      camposCliente.telefono        && ['Tel.',         cliente.telefono],
      camposCliente.email           && ['Email',        cliente.email],
      camposCliente.contacto_nombre && ['Contacto',    cliente.contacto_nombre],
    ].filter(Boolean),
  }

  y = drawInfoBlocks(doc, y, bloqueEmpresa, bloqueCliente, cfg)

  // ── Datos de proyecto (si aplica) ────────────────────────
  if (cfg.secciones?.datos_proyecto && proyecto?.nombre) {
    const camposProyecto = cfg.campos?.proyecto || {}
    const bloqueProyecto = {
      titulo: 'Proyecto',
      campos: [
        camposProyecto.nombre       && ['Proyecto',    proyecto.nombre],
        camposProyecto.clave        && ['Clave',       proyecto.clave],
        camposProyecto.descripcion  && ['Descripción', proyecto.descripcion],
        camposProyecto.fecha_inicio && ['Inicio',      formatDate(proyecto.fecha_inicio)],
        camposProyecto.fecha_fin    && ['Término',     formatDate(proyecto.fecha_fin)],
        camposProyecto.estatus      && ['Estatus',     proyecto.estatus],
      ].filter(Boolean),
    }
    const bloqueVacio = { titulo: '', campos: [] }
    y = drawInfoBlocks(doc, y, bloqueProyecto, bloqueVacio, cfg)
  }

  // ── Datos de empleado (si aplica) ─────────────────────────
  if (cfg.secciones?.datos_empleado && empleado?.nombre_completo) {
    const camposEmpleado = cfg.campos?.empleado || {}
    const bloqueEmpleado = {
      titulo: 'Responsable',
      campos: [
        camposEmpleado.nombre_completo && ['Nombre',  empleado.nombre_completo],
        camposEmpleado.puesto          && ['Puesto',  empleado.puesto],
        camposEmpleado.rfc             && ['RFC',     empleado.rfc],
      ].filter(Boolean),
    }
    const bloqueDoc = {
      titulo: 'Documento',
      campos: [
        ['Folio',   docData.folio],
        ['Fecha',   formatDate(docData.fecha_emision)],
        ['Período', docData.condiciones_pago],
      ].filter(([, v]) => v),
    }
    y = drawInfoBlocks(doc, y, bloqueEmpleado, bloqueDoc, cfg)
  }

  // ── Tabla de conceptos (si aplica) ───────────────────────
  if (cfg.secciones?.tabla_conceptos && conceptos.length > 0) {
    y = drawTablaConceptos(doc, y, conceptos, cfg)
  }

  // ── Totales ──────────────────────────────────────────────
  if (cfg.secciones?.totales) {
    y = drawTotales(doc, y, docData, cfg)
  }

  // ── Notas ────────────────────────────────────────────────
  if (cfg.secciones?.notas && docData.notas) {
    y = drawNotas(doc, y, docData.notas, cfg)
  }

  // ── Términos y condiciones ───────────────────────────────
  if (cfg.textos?.terminos) {
    y = drawNotas(doc, y, cfg.textos.terminos, cfg)
  }

  // ── Pie de página ─────────────────────────────────────────
  if (cfg.secciones?.pie_pagina) {
    drawFooter(doc, cfg, empresa)
  }

  doc.save(fileName)
}

/* =====================================================
   EXPORTS LEGACY — mantienen compatibilidad con
   Reports.jsx y otros módulos existentes
===================================================== */

const createHeaderLegacy = (doc, reportType, projectName = null) => {
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, 297, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  let fullTitle = `OBRIX - ${reportType}`
  if (projectName) fullTitle += ` - Proyecto: ${projectName}`
  doc.text(fullTitle, 14, 18)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Sistema de Control de Inventarios', 14, 26)
  doc.text('Generado: ' + new Date().toLocaleDateString('es-MX'), 14, 31)
  return 42
}

const saveCSV = (headers, rows, fileName) => {
  if (!rows || !rows.length) return
  const BOM = '\uFEFF'
  const csvContent = [
    BOM,
    headers.join(';'),
    ...rows.map(row =>
      row.map(cell => `"${(cell ?? '').toString().replace(/"/g,'""')}"`).join(';')
    )
  ].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href     = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportMovementsToPDF = (movements = [], filters = {}) => {
  if (!Array.isArray(movements) || !movements.length) return
  const doc = new jsPDF({ orientation: 'landscape' })
  const projectNames = [...new Set(movements.map(m => m.warehouses?.projects?.name).filter(Boolean))]
  const projectName  = projectNames.length === 1 ? projectNames[0] : null
  const y = createHeaderLegacy(doc, 'CARDEX', projectName)
  autoTable(doc, {
    startY: y,
    head: [['Fecha','Tipo','Material','Cantidad','Almacén','Motivo']],
    body: movements.map(m => [
      formatDatetime(m.created_at), m.type || '',
      m.materials_catalog?.material_type || '',
      safeNumber(m.quantity), m.warehouses?.name || '', m.reason || '',
    ]),
    theme: 'grid', headStyles: { fillColor: [37,99,235] },
  })
  doc.save(projectName
    ? `CARDEX_Obrix_Proyecto-${projectName.replace(/\s+/g,'-')}_${today()}.pdf`
    : `CARDEX_Obrix_${today()}.pdf`)
}

export const exportMovementsToExcel = (movements = [], filters = {}) => {
  if (!Array.isArray(movements) || !movements.length) return
  const projectNames = [...new Set(movements.map(m => m.warehouses?.projects?.name).filter(Boolean))]
  const projectName  = projectNames.length === 1 ? projectNames[0] : null
  saveCSV(
    ['Fecha','Tipo','Material','Cantidad','Almacén','Motivo'],
    movements.map(m => [
      formatDatetime(m.created_at), m.type || '',
      m.materials_catalog?.material_type || '',
      safeNumber(m.quantity).replace('.',','), m.warehouses?.name || '', m.reason || '',
    ]),
    projectName
      ? `CARDEX_Obrix_Proyecto-${projectName.replace(/\s+/g,'-')}_${today()}.csv`
      : `CARDEX_Obrix_${today()}.csv`
  )
}

export const exportStockToPDF = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return
  const doc = new jsPDF({ orientation: 'landscape' })
  const projectNames = [...new Set(data.map(i => i.warehouses?.projects?.name).filter(Boolean))]
  const projectName  = projectNames.length === 1 ? projectNames[0] : null
  const y = createHeaderLegacy(doc, 'STOCK POR ALMACÉN', projectName)
  autoTable(doc, {
    startY: y,
    head: [['Almacén','Material','Categoría','Proyecto','Cantidad','Unidad']],
    body: data.map(item => [
      item.warehouses?.name || 'Sin Almacén',
      item.materials_catalog?.material_type || '',
      item.materials_catalog?.category || '',
      item.warehouses?.projects?.name || 'Sin Proyecto',
      safeNumber(item.quantity),
      item.materials_catalog?.default_unit || '',
    ]),
    theme: 'grid', headStyles: { fillColor: [37,99,235] },
    columnStyles: { 3: { cellWidth: 35 } },
  })
  doc.save(projectName
    ? `Stock_Obrix_Proyecto-${projectName.replace(/\s+/g,'-')}_${today()}.pdf`
    : `Stock_Obrix_${today()}.pdf`)
}

export const exportStockToExcel = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return
  const projectNames = [...new Set(data.map(i => i.warehouses?.projects?.name).filter(Boolean))]
  const projectName  = projectNames.length === 1 ? projectNames[0] : null
  saveCSV(
    ['Almacén','Material','Categoría','Proyecto','Cantidad','Unidad'],
    data.map(item => [
      item.warehouses?.name || 'Sin Almacén',
      item.materials_catalog?.material_type || '',
      item.materials_catalog?.category || '',
      item.warehouses?.projects?.name || 'Sin Proyecto',
      safeNumber(item.quantity).replace('.',','),
      item.materials_catalog?.default_unit || '',
    ]),
    projectName
      ? `Stock_Obrix_Proyecto-${projectName.replace(/\s+/g,'-')}_${today()}.csv`
      : `Stock_Obrix_${today()}.csv`
  )
}

export const exportTopMaterialsToPDF = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return
  const doc = new jsPDF()
  const y = createHeaderLegacy(doc, 'TOP MATERIALES', filters.projectName || null)
  autoTable(doc, {
    startY: y,
    head: [['#','Material','Categoría','Movimientos','Entradas','Salidas']],
    body: data.map((item, i) => [
      i+1, item.material_type || '', item.category || '',
      safeNumber(item.movimientos,0), safeNumber(item.entradas,1), safeNumber(item.salidas,1),
    ]),
    theme: 'grid', headStyles: { fillColor: [37,99,235] },
  })
  doc.save(`TopMateriales_Obrix_${today()}.pdf`)
}

export const exportTopMaterialsToExcel = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return
  saveCSV(
    ['Ranking','Material','Categoría','Movimientos','Entradas','Salidas'],
    data.map((item, i) => [
      i+1, item.material_type || '', item.category || '',
      safeNumber(item.movimientos,0),
      safeNumber(item.entradas,1).replace('.',','),
      safeNumber(item.salidas,1).replace('.',','),
    ]),
    `TopMateriales_Obrix_${today()}.csv`
  )
}

export const exportLossesToPDF = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return
  const doc = new jsPDF({ orientation: 'landscape' })
  const projectNames = [...new Set(data.map(m => m.warehouses?.projects?.name).filter(Boolean))]
  const projectName  = projectNames.length === 1 ? projectNames[0] : null
  const y = createHeaderLegacy(doc, 'SALIDAS Y MERMAS', projectName)
  autoTable(doc, {
    startY: y,
    head: [['Fecha','Tipo','Material','Cantidad','Almacén','Motivo']],
    body: data.map(m => [
      formatDatetime(m.created_at), m.type || '',
      m.materials_catalog?.material_type || '',
      safeNumber(m.quantity), m.warehouses?.name || '', m.reason || '',
    ]),
    theme: 'grid', headStyles: { fillColor: [220,38,38] },
  })
  doc.save(projectName
    ? `Mermas_Obrix_Proyecto-${projectName.replace(/\s+/g,'-')}_${today()}.pdf`
    : `Mermas_Obrix_${today()}.pdf`)
}

export const exportLossesToExcel = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return
  const projectNames = [...new Set(data.map(m => m.warehouses?.projects?.name).filter(Boolean))]
  const projectName  = projectNames.length === 1 ? projectNames[0] : null
  saveCSV(
    ['Fecha','Tipo','Material','Cantidad','Almacén','Motivo'],
    data.map(m => [
      formatDatetime(m.created_at), m.type || '',
      m.materials_catalog?.material_type || '',
      safeNumber(m.quantity).replace('.',','), m.warehouses?.name || '', m.reason || '',
    ]),
    projectName
      ? `Mermas_Obrix_Proyecto-${projectName.replace(/\s+/g,'-')}_${today()}.csv`
      : `Mermas_Obrix_${today()}.csv`
  )
}

export const exportExecutiveToPDF = (data = {}, filters = {}) => {
  if (!data) return
  const doc = new jsPDF()
  const y = createHeaderLegacy(doc, 'RESUMEN EJECUTIVO', filters.projectName || null)
  autoTable(doc, {
    startY: y,
    body: [
      ['Total Materiales',  data.totalMateriales  || 0],
      ['Total Movimientos', data.totalMovimientos  || 0],
      ['Stock Total',       safeNumber(data.totalStock)],
      ['Almacenes',         data.totalAlmacenes    || 0],
      ['Entradas',          data.movimientosPorTipo?.ENTRADA || 0],
      ['Salidas',           (data.movimientosPorTipo?.SALIDA||0)+(data.movimientosPorTipo?.DAÑO||0)],
    ],
    theme: 'grid', styles: { fontSize: 11 },
  })
  doc.save(`ResumenEjecutivo_Obrix_${today()}.pdf`)
}

export const exportExecutiveToExcel = (data = {}, filters = {}) => {
  if (!data) return
  saveCSV(
    ['Indicador','Valor'],
    [
      ['Total Materiales',  data.totalMateriales  || 0],
      ['Total Movimientos', data.totalMovimientos  || 0],
      ['Stock Total',       safeNumber(data.totalStock).replace('.',',')],
      ['Almacenes',         data.totalAlmacenes    || 0],
      ['Entradas',          data.movimientosPorTipo?.ENTRADA || 0],
      ['Salidas',           (data.movimientosPorTipo?.SALIDA||0)+(data.movimientosPorTipo?.DAÑO||0)],
    ],
    `ResumenEjecutivo_Obrix_${today()}.csv`
  )
}
