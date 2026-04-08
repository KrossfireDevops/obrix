// test-csf-parser.js - ACTUALIZADO
import { readFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const [,, pdfPath] = process.argv

if (!pdfPath) {
  console.error('❌ Uso: node test-csf-parser.js ./ruta/al/csf.pdf')
  process.exit(1)
}

console.log('🔍 Validando Edge Function parse-document-local...')
console.log(`📄 Archivo: ${pdfPath}`)

try {
  // 1. Leer PDF y convertir a base64
  const pdfBuffer = await readFile(pdfPath)
  const base64 = pdfBuffer.toString('base64')
  console.log(`📦 Tamaño: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  // 2. Obtener token de sesión (anon para funciones sin auth)
  // Para funciones con --no-verify-jwt, usar solo anon key
  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    // NO enviar Authorization header si la función es --no-verify-jwt
    // O enviar la anon key como Bearer si es necesario
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Prefer': 'code=200'  // Forzar status 200 incluso si hay errores
  }

  // 3. Llamar a Edge Function
  console.log('📡 Enviando a Edge Function...')
  const startTime = Date.now()
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/parse-document-local`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tipo_documento: 'CSF',
        archivo_base64: base64,
        rfc_esperado: null
      })
    }
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  const result = await response.json()

  // 4. Validar respuesta HTTP
  if (!response.ok) {
    console.error('❌ Error HTTP:', response.status)
    console.error('📋 Respuesta:', result)
    
    if (response.status === 401 && result.message === 'Invalid JWT') {
      console.error('\n💡 SOLUCIÓN: Re-desplegar la función con --no-verify-jwt')
      console.error('   Comando: supabase functions deploy parse-document-local --no-verify-jwt')
    }
    
    process.exit(1)
  }

  if (!result.success) {
    console.error('❌ Error en parsing:', result.error)
    process.exit(1)
  }

  // 5. Mostrar resultados
  const { resultado } = result
  console.log('\n✅ Parsing exitoso')
  console.log('─'.repeat(60))
  console.log(`⏱️ Tiempo de respuesta: ${elapsed}s`)
  console.log(`🎯 Confianza: ${resultado.confianza}%`)
  console.log(`✅ Documento válido: ${resultado.es_documento_correcto ? 'Sí' : 'No'}`)
  
  if (resultado.datos_extraidos) {
    console.log('\n📋 Datos extraídos:')
    const d = resultado.datos_extraidos
    console.log(`   RFC:              ${d.rfc || '—'}`)
    console.log(`   Nombre:           ${d.nombre || '—'}`)
    console.log(`   Código Postal:    ${d.codigo_postal || '—'}`)
    console.log(`   Régimen:          ${d.regimen_fiscal || '—'} (Clave: ${d.clave_regimen || '—'})`)
    console.log(`   Estatus SAT:      ${d.estatus || '—'}`)
    console.log(`   Fecha inicio ops: ${d.fecha_inicio_ops || '—'}`)
  }
  
  if (resultado.errores?.length > 0) {
    console.log('\n⚠️ Errores:')
    resultado.errores.forEach(e => console.log(`   • ${e}`))
  }
  
  console.log('\n' + '─'.repeat(60))
  
  // 6. Guardar resultado
  await import('fs').then(fs => 
    fs.promises.writeFile('csf-parse-result-local.json', JSON.stringify(result, null, 2))
  )
  console.log('💾 Resultado guardado en: csf-parse-result-local.json')
  
} catch (error) {
  console.error('❌ Error ejecutando prueba:', error.message)
  process.exit(1)
}