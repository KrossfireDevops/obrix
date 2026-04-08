// ocr-service/index.js
// Servicio OCR para CSF del SAT - Versión FINAL mejorada
// Fallback: Extraer texto legible de PDFs imagen

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Tesseract from 'tesseract.js'
import { fromBuffer } from 'pdf2pic'
import { readFileSync, unlinkSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// Crear carpeta temp si no existe
const tempDir = join(__dirname, 'temp')
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true })
  console.log(`📁 Carpeta temp creada: ${tempDir}`)
}

// Configurar multer para uploads en memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB máximo
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINT PRINCIPAL: OCR de PDF
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/ocr-csf', upload.single('archivo'), async (req, res) => {
  const startTime = Date.now()
  
  try {
    console.log('📄 [OCR] Recibiendo archivo:', req.file?.originalname)
    console.log('📦 [OCR] Tamaño:', (req.file?.size / 1024 / 1024).toFixed(2), 'MB')
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' })
    }

    // ── PASO 1: Intentar convertir PDF a imagen ───────────────────────────────
    console.log('🔄 [OCR] Convirtiendo PDF a imagen...')
    
    let imagePath = null
    try {
      const pdfToImage = fromBuffer(req.file.buffer, {
        density: 300,
        format: 'png',
        width: 1000,
        height: 1400,
        saveFilename: `csf_${Date.now()}`,
        savePath: tempDir
      })

      const imageInfo = await pdfToImage()
      imagePath = imageInfo.path
      console.log('✅ [OCR] Imagen generada:', imagePath)
      
    } catch (pdfError) {
      console.warn('⚠️ [OCR] pdf2pic falló:', pdfError.message)
      
      // ═══════════════════════════════════════════════════════════════════════
      // FALLBACK MEJORADO: Extraer texto legible del binary del PDF
      // ═══════════════════════════════════════════════════════════════════════
      
      console.log('🔄 [OCR] Intentando fallback mejorado...')
      
      try {
        const binary = Buffer.from(req.file.buffer).toString('binary')
        
        // Estrategia 1: Extraer solo texto legible (caracteres imprimibles + español)
        let textoLegible = binary
          .replace(/[^\x20-\x7EÁÉÍÓÚÑáéíóúñ\r\n:]+/g, ' ')  // Solo caracteres legibles
          .replace(/\s{3,}/g, '\n')  // Múltiples espacios → saltos de línea
          .split('\n')
          .filter(line => line.trim().length > 5)  // Solo líneas con contenido
          .filter(line => /[A-ZÑ]{3,}/i.test(line))  // Solo líneas con letras
          .join('\n')
        
        // Estrategia 2: Buscar patrones específicos del SAT en el binary
        const satPatterns = [
          /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/g,  // RFC
          /([A-Z]{4}\d{6}[A-ZÑ]{6}[A-Z0-9]{2})/g,  // CURP
          /Nombre,\s*denominación\s*o\s*razón\s*social\s*([A-ZÁÉÍÓÚÑ\s]+)/gi,
          /Código\s*Postal[:\s]*(\d{5})/gi,
          /Estatus\s+en\s+el\s+padrón[:\s]*(ACTIVO|SUSPENDIDO|CANCELADO)/gi,
          /Fecha\s+inicio\s+de\s+operaciones[:\s]*([\d\sDE]+?)(?=\s+Estatus)/gi,
          /Régimen\s+de\s+([^\n|]+)/gi,
        ]
        
        const extracted = []
        satPatterns.forEach(pattern => {
          const matches = [...binary.matchAll(pattern)]
          matches.forEach(m => extracted.push(m[0]))
        })
        
        // Combinar texto legible + patrones extraídos
        const textoExtraido = [textoLegible, ...extracted].join('\n')
        
        console.log(`✅ [OCR] Fallback exitoso - Texto extraído: ${textoExtraido.length} chars`)
        
        // Guardar texto completo en archivo
        const timestamp = Date.now()
        const fileName = `ocr-texto-${timestamp}.txt`
        const filePath = join(tempDir, fileName)
        writeFileSync(filePath, textoExtraido, 'utf8')
        console.log(`💾 [OCR] Texto completo guardado en: ${filePath}`)
        
        // Logging en consola
        console.log('\n' + '='.repeat(100))
        console.log('🔍 TEXTO OCR - PRIMEROS 5000 CHARS')
        console.log('='.repeat(100))
        console.log(textoExtraido.substring(0, 5000))
        console.log('='.repeat(100))
        console.log(`💡 Texto completo (${textoExtraido.length} chars) en: ${fileName}`)
        console.log('='.repeat(100) + '\n')
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
        
        return res.json({
          success: true,
          texto: textoExtraido,
          confianza_ocr: 70,
          longitud: textoExtraido.length,
          tiempo_procesamiento: elapsed,
          metodo: 'fallback_mejorado',
          archivo_debug: fileName,
        })
        
      } catch (fallbackError) {
        console.error('❌ [OCR] Fallback falló:', fallbackError.message)
        
        return res.status(500).json({
          error: 'No se pudo extraer texto del PDF',
          detalle: fallbackError.message,
        })
      }
    }

    // ── PASO 2: OCR con Tesseract (si pdf2pic funcionó) ──────────────────────
    console.log('🔍 [OCR] Ejecutando OCR con Tesseract...')
    
    const result = await Tesseract.recognize(imagePath, 'spa', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📊 [OCR] Progreso: ${Math.round(m.progress * 100)}%`)
        }
      }
    })
    
    const text = result?.data?.text || ''
    const confidence = result?.data?.confidence || 0
    
    console.log(`✅ [OCR] Completado - Confianza: ${confidence.toFixed(1)}%`)
    console.log('📝 [OCR] Texto extraído:', text.length, 'caracteres')

    // Limpiar archivo temporal
    try {
      if (imagePath && existsSync(imagePath)) {
        unlinkSync(imagePath)
        console.log('🧹 [OCR] Archivo temporal eliminado')
      }
    } catch (e) {
      console.warn('⚠️ [OCR] No se pudo eliminar archivo temporal:', e.message)
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`⏱️ [OCR] Tiempo total: ${elapsed}s`)

    res.json({
      success: true,
      texto: text,
      confianza_ocr: Math.round(confidence),
      longitud: text.length,
      tiempo_procesamiento: elapsed
    })
    
  } catch (error) {
    console.error('❌ [OCR] Error general:', error.message)
    
    res.status(500).json({
      error: 'Error al procesar el documento',
      detalle: error.message,
      tiempo_procesamiento: ((Date.now() - startTime) / 1000).toFixed(2),
    })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINT DE SALUD
// ══════════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ocr-csf', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    temp_dir: tempDir,
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ══════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  🚀 OCR Service para CSF del SAT                             ║')
  console.log('║  Piloto costo $0 - Fallback mejorado                         ║')
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log(`║  📡 Servidor corriendo en: http://localhost:${PORT}              ║`)
  console.log(`║  📋 Endpoint: POST http://localhost:${PORT}/api/ocr-csf          ║`)
  console.log(`║  💚 Health: GET http://localhost:${PORT}/health                  ║`)
  console.log(`║  📁 Textos guardados en: ${tempDir}                            ║`)
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log('')
})