// src/utils/export.utils.js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* =====================================================
   UTILIDADES GENERALES
===================================================== */

const today = () => new Date().toISOString().split('T')[0]

const safeNumber = (value, decimals = 2) =>
  Number(parseFloat(value || 0)).toFixed(decimals)

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// ✅ createHeader ACTUALIZADO: Formato exacto solicitado
const createHeader = (doc, reportType, projectName = null) => {
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, 297, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  
  // ✅ Formato exacto: OBRIX - [TIPO] - Proyecto: [NOMBRE]
  let fullTitle = `OBRIX - ${reportType}`
  if (projectName) {
    fullTitle += ` - Proyecto: ${projectName}`
  }
  
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
      row.map(cell =>
        `"${(cell ?? '').toString().replace(/"/g, '""')}"`
      ).join(';')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/* =====================================================
   MOVIMIENTOS / CARDEX ✅ ACTUALIZADO
===================================================== */

export const exportMovementsToPDF = (movements = [], filters = {}) => {
  if (!Array.isArray(movements) || !movements.length) return

  const doc = new jsPDF({ orientation: 'landscape' })
  
  // ✅ Extraer nombre del proyecto único
  const projectNames = [...new Set(
    movements.map(m => m.warehouses?.projects?.name).filter(Boolean)
  )]
  const projectName = projectNames.length === 1 ? projectNames[0] : null
  
  const y = createHeader(doc, 'CARDEX', projectName)

  const rows = movements.map(m => [
    formatDate(m.created_at),
    m.type || '',
    m.materials_catalog?.material_type || '',
    safeNumber(m.quantity),
    m.warehouses?.name || '',
    m.reason || ''
  ])

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Tipo', 'Material', 'Cantidad', 'Almacén', 'Motivo']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] }
  })

  const fileName = projectName 
    ? `CARDEX_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.pdf`
    : `CARDEX_Obrix_${today()}.pdf`
    
  doc.save(fileName)
}

export const exportMovementsToExcel = (movements = [], filters = {}) => {
  if (!Array.isArray(movements) || !movements.length) return

  // ✅ Extraer nombre del proyecto único
  const projectNames = [...new Set(
    movements.map(m => m.warehouses?.projects?.name).filter(Boolean)
  )]
  const projectName = projectNames.length === 1 ? projectNames[0] : null

  const headers = ['Fecha', 'Tipo', 'Material', 'Cantidad', 'Almacén', 'Motivo']

  const rows = movements.map(m => [
    formatDate(m.created_at),
    m.type || '',
    m.materials_catalog?.material_type || '',
    safeNumber(m.quantity).replace('.', ','),
    m.warehouses?.name || '',
    m.reason || ''
  ])

  const fileName = projectName 
    ? `CARDEX_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.csv`
    : `CARDEX_Obrix_${today()}.csv`
    
  saveCSV(headers, rows, fileName)
}

/* =====================================================
   STOCK ✅ ACTUALIZADO
===================================================== */

export const exportStockToPDF = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return

  const doc = new jsPDF({ orientation: 'landscape' })
  
  // ✅ Extraer nombre del proyecto único
  const projectNames = [...new Set(
    data.map(item => item.warehouses?.projects?.name).filter(Boolean)
  )]
  const projectName = projectNames.length === 1 ? projectNames[0] : null
  
  const y = createHeader(doc, 'STOCK POR ALMACÉN', projectName)

  const rows = data.map(item => {
    const itemProjectName = item.warehouses?.projects?.name || 'Sin Proyecto'
    
    return [
      item.warehouses?.name || 'Sin Almacén',
      item.materials_catalog?.material_type || '',
      item.materials_catalog?.category || '',
      itemProjectName,
      safeNumber(item.quantity),
      item.materials_catalog?.default_unit || ''
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Almacén', 'Material', 'Categoría', 'Proyecto', 'Cantidad', 'Unidad']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: {
      3: { cellWidth: 35 }
    }
  })

  const fileName = projectName 
    ? `Stock_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.pdf`
    : `Stock_Obrix_${today()}.pdf`
    
  doc.save(fileName)
}

export const exportStockToExcel = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return

  // ✅ Extraer nombre del proyecto único
  const projectNames = [...new Set(
    data.map(item => item.warehouses?.projects?.name).filter(Boolean)
  )]
  const projectName = projectNames.length === 1 ? projectNames[0] : null

  const headers = ['Almacén', 'Material', 'Categoría', 'Proyecto', 'Cantidad', 'Unidad']

  const rows = data.map(item => {
    const itemProjectName = item.warehouses?.projects?.name || 'Sin Proyecto'
    
    return [
      item.warehouses?.name || 'Sin Almacén',
      item.materials_catalog?.material_type || '',
      item.materials_catalog?.category || '',
      itemProjectName,
      safeNumber(item.quantity).replace('.', ','),
      item.materials_catalog?.default_unit || ''
    ]
  })

  const fileName = projectName 
    ? `Stock_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.csv`
    : `Stock_Obrix_${today()}.csv`
    
  saveCSV(headers, rows, fileName)
}

/* =====================================================
   TOP MATERIALES ✅ ACTUALIZADO
===================================================== */

export const exportTopMaterialsToPDF = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return

  const doc = new jsPDF()
  
  // ✅ Extraer projectName de filters si está disponible
  const projectName = filters.projectName || null
  
  const y = createHeader(doc, 'TOP MATERIALES', projectName)

  const rows = data.map((item, i) => [
    i + 1,
    item.material_type || '',
    item.category || '',
    safeNumber(item.movimientos, 0),
    safeNumber(item.entradas, 1),
    safeNumber(item.salidas, 1)
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'Material', 'Categoría', 'Movimientos', 'Entradas', 'Salidas']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] }
  })

  const fileName = projectName 
    ? `TopMateriales_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.pdf`
    : `TopMateriales_Obrix_${today()}.pdf`
    
  doc.save(fileName)
}

export const exportTopMaterialsToExcel = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return

  const projectName = filters.projectName || null

  const headers = ['Ranking', 'Material', 'Categoría', 'Movimientos', 'Entradas', 'Salidas']

  const rows = data.map((item, i) => [
    i + 1,
    item.material_type || '',
    item.category || '',
    safeNumber(item.movimientos, 0),
    safeNumber(item.entradas, 1).replace('.', ','),
    safeNumber(item.salidas, 1).replace('.', ',')
  ])

  const fileName = projectName 
    ? `TopMateriales_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.csv`
    : `TopMateriales_Obrix_${today()}.csv`
    
  saveCSV(headers, rows, fileName)
}

/* =====================================================
   MERMAS Y PÉRDIDAS ✅ ACTUALIZADO
===================================================== */

export const exportLossesToPDF = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return

  const doc = new jsPDF({ orientation: 'landscape' })
  
  // ✅ Extraer nombre del proyecto único
  const projectNames = [...new Set(
    data.map(m => m.warehouses?.projects?.name).filter(Boolean)
  )]
  const projectName = projectNames.length === 1 ? projectNames[0] : null
  
  const y = createHeader(doc, 'SALIDAS Y MERMAS', projectName)

  const rows = data.map(m => [
    formatDate(m.created_at),
    m.type || '',
    m.materials_catalog?.material_type || '',
    safeNumber(m.quantity),
    m.warehouses?.name || '',
    m.reason || ''
  ])

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Tipo', 'Material', 'Cantidad', 'Almacén', 'Motivo']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38] }
  })

  const fileName = projectName 
    ? `Mermas_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.pdf`
    : `Mermas_Obrix_${today()}.pdf`
    
  doc.save(fileName)
}

export const exportLossesToExcel = (data = [], filters = {}) => {
  if (!Array.isArray(data) || !data.length) return

  // ✅ Extraer nombre del proyecto único
  const projectNames = [...new Set(
    data.map(m => m.warehouses?.projects?.name).filter(Boolean)
  )]
  const projectName = projectNames.length === 1 ? projectNames[0] : null

  const headers = ['Fecha', 'Tipo', 'Material', 'Cantidad', 'Almacén', 'Motivo']

  const rows = data.map(m => [
    formatDate(m.created_at),
    m.type || '',
    m.materials_catalog?.material_type || '',
    safeNumber(m.quantity).replace('.', ','),
    m.warehouses?.name || '',
    m.reason || ''
  ])

  const fileName = projectName 
    ? `Mermas_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.csv`
    : `Mermas_Obrix_${today()}.csv`
    
  saveCSV(headers, rows, fileName)
}

/* =====================================================
   RESUMEN EJECUTIVO ✅ ACTUALIZADO
===================================================== */

export const exportExecutiveToPDF = (data = {}, filters = {}) => {
  if (!data) return

  const doc = new jsPDF()
  
  // ✅ Extraer projectName de filters
  const projectName = filters.projectName || null
  
  const y = createHeader(doc, 'RESUMEN EJECUTIVO', projectName)

  const rows = [
    ['Total Materiales', data.totalMateriales || 0],
    ['Total Movimientos', data.totalMovimientos || 0],
    ['Stock Total', safeNumber(data.totalStock)],
    ['Almacenes', data.totalAlmacenes || 0],
    ['Entradas', data.movimientosPorTipo?.ENTRADA || 0],
    ['Salidas',
      (data.movimientosPorTipo?.SALIDA || 0) +
      (data.movimientosPorTipo?.DAÑO || 0)
    ]
  ]

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'grid',
    styles: { fontSize: 11 }
  })

  const fileName = projectName 
    ? `ResumenEjecutivo_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.pdf`
    : `ResumenEjecutivo_Obrix_${today()}.pdf`
    
  doc.save(fileName)
}

export const exportExecutiveToExcel = (data = {}, filters = {}) => {
  if (!data) return

  const projectName = filters.projectName || null

  const headers = ['Indicador', 'Valor']

  const rows = [
    ['Total Materiales', data.totalMateriales || 0],
    ['Total Movimientos', data.totalMovimientos || 0],
    ['Stock Total', safeNumber(data.totalStock).replace('.', ',')],
    ['Almacenes', data.totalAlmacenes || 0],
    ['Entradas', data.movimientosPorTipo?.ENTRADA || 0],
    ['Salidas',
      (data.movimientosPorTipo?.SALIDA || 0) +
      (data.movimientosPorTipo?.DAÑO || 0)
    ]
  ]

  const fileName = projectName 
    ? `ResumenEjecutivo_Obrix_Proyecto-${projectName.replace(/\s+/g, '-')}_${today()}.csv`
    : `ResumenEjecutivo_Obrix_${today()}.csv`
    
  saveCSV(headers, rows, fileName)
}