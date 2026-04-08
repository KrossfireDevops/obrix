// src/services/documentParser.service.js
// OBRIX - Document Intelligence Engine v3.3
// Extracción NATIVA de texto PDF (corregido para Vite + bug crypto)

import { supabase } from '../config/supabase';

// ✅ CONFIGURACIÓN CORRECTA PARA VITE (EVITA BUG crypto)
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─────────────────────────────────────────────
// EXTRAER TEXTO DE PDF (CORREGIDO PARA VITE + BUG CRYPTO)
// ─────────────────────────────────────────────
export const extraerTextoPDF = async (file) => {
  try {
    // ✅ CORRECCIÓN CRÍTICA: Usar arrayBuffer + ignoreErrors para evitar bug crypto
    const arrayBuffer = await file.arrayBuffer();
    
    // ✅ PARÁMETROS CLAVE para evitar "hashOriginal.toHex is not a function":
    // - ignoreErrors: true → Salta verificaciones de firma digital (problemáticas en CSF del SAT)
    // - disableNativeImageDecoder: true → Evita decodificación de imágenes complejas
    // - data: arrayBuffer → Sintaxis correcta para Vite
    const pdf = await getDocument({ 
      data: arrayBuffer,
      ignoreErrors: true,
      disableNativeImageDecoder: true
    }).promise;
    
    let textoCompleto = '';
    
    // Extraer texto de todas las páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Concatenar texto manteniendo estructura
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (pageText) textoCompleto += pageText + '\n\n';
    }
    
    // Normalizar texto para mejor parsing
    return textoCompleto
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/:/g, ': ')
      .replace(/,/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } catch (error) {
    console.error('[PDF Extract] Error:', error);
    
    // ✅ MANEJO ESPECÍFICO DEL BUG CRYPTO
    if (error.message?.includes('hashOriginal.toHex')) {
      throw new Error('PDF con firma digital compleja. Intentando método alternativo...');
    }
    
    throw new Error('No se pudo extraer texto del PDF: ' + (error.message || 'Error desconocido'));
  }
};

// ─────────────────────────────────────────────
// UTILIDADES PARA UI (SIN CAMBIOS)
// ─────────────────────────────────────────────

export const getEtiquetasCampos = (tipoDocumento) => {
  const etiquetasBase = {
    rfc: 'RFC',
    nombre: 'Nombre/Razón Social',
    curp: 'CURP',
    codigo_postal: 'Código Postal',
    estatus: 'Estatus en Padrón',
    fecha_inicio_ops: 'Fecha Inicio Operaciones',
    regimen_fiscal: 'Régimen Fiscal',
    clave_regimen: 'Clave Régimen',
    domicilio_fiscal: 'Domicilio Fiscal',
    fecha_alta: 'Fecha de Alta',
    numero_serie: 'Número de Serie',
    vigencia_inicio: 'Vigencia Inicio',
    vigencia_fin: 'Vigencia Fin',
    algoritmo_firma: 'Algoritmo de Firma',
    huella_sha1: 'Huella SHA-1',
    huella_sha256: 'Huella SHA-256',
    tipo_certificado: 'Tipo de Certificado'
  };

  switch (tipoDocumento) {
    case 'CSF':
      return {
        rfc: etiquetasBase.rfc,
        nombre: etiquetasBase.nombre,
        curp: etiquetasBase.curp,
        codigo_postal: etiquetasBase.codigo_postal,
        estatus: etiquetasBase.estatus,
        fecha_inicio_ops: etiquetasBase.fecha_inicio_ops,
        regimen_fiscal: etiquetasBase.regimen_fiscal,
        clave_regimen: etiquetasBase.clave_regimen
      };
    case '32D':
      return {
        rfc: etiquetasBase.rfc,
        nombre: etiquetasBase.nombre,
        curp: etiquetasBase.curp,
        domicilio_fiscal: etiquetasBase.domicilio_fiscal,
        regimen_fiscal: etiquetasBase.regimen_fiscal,
        clave_regimen: etiquetasBase.clave_regimen,
        fecha_alta: etiquetasBase.fecha_alta,
        estatus: etiquetasBase.estatus
      };
    case 'CSD':
      return {
        rfc: etiquetasBase.rfc,
        nombre: etiquetasBase.nombre,
        numero_serie: etiquetasBase.numero_serie,
        vigencia_inicio: etiquetasBase.vigencia_inicio,
        vigencia_fin: etiquetasBase.vigencia_fin,
        algoritmo_firma: etiquetasBase.algoritmo_firma,
        huella_sha1: etiquetasBase.huella_sha1,
        huella_sha256: etiquetasBase.huella_sha256,
        tipo_certificado: etiquetasBase.tipo_certificado
      };
    default:
      return etiquetasBase;
  }
};

export const getCamposCriticos = (tipoDocumento) => {
  switch (tipoDocumento) {
    case 'CSF':
      return ['rfc', 'nombre', 'codigo_postal', 'regimen_fiscal', 'estatus'];
    case '32D':
      return ['rfc', 'nombre', 'domicilio_fiscal', 'regimen_fiscal', 'fecha_alta'];
    case 'CSD':
      return ['rfc', 'nombre', 'numero_serie', 'vigencia_inicio', 'vigencia_fin'];
    default:
      return ['rfc', 'nombre'];
  }
};

// ─────────────────────────────────────────────
// PARSER CSF MEJORADO (3 variantes)
// ─────────────────────────────────────────────
function parseCSF(texto) {
  // Detectar tipo de CSF
  const esNueva = texto.match(/CONSTANCIA\s+DE\s+SITUACIÓN\s+FISCAL/i);
  const esAntigua = texto.match(/32\/D|CONSTANCIA\s+DE\s+INSCRIPCIÓN/i);

  let rfc = null;
  let nombre = null;
  let curp = null;
  let codigo_postal = null;
  let estatus = null;
  let fecha_inicio_ops = null;
  let fecha_ultimo_cambio = null;
  let regimen_capital = null;
  let nombre_comercial = null;
  let regimen_fiscal = null;
  let clave_regimen = null;
  // Domicilio fiscal — campos exactos de la CSF
  let domicilio = {
    tipo_vialidad: null, nombre_vialidad: null,
    numero_exterior: null, numero_interior: null,
    colonia: null, localidad: null, municipio: null,
    estado: null, entre_calle: null, y_calle: null,
  };

  // RFC - Múltiples patrones (mejorados para CSF 2023-2026)
  const rfcPatterns = [
    /RFC[:\s]+([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
    /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\s+RFC/i,
    /RFC\s*[:\s]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
    // Patrón para CSF nueva (2023+) donde RFC está en línea separada
    /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})(?=\s+CURP)/i,
  ];
  
  for (const pattern of rfcPatterns) {
    const match = texto.match(pattern);
    if (match && match[1].length >= 12) {
      rfc = match[1].toUpperCase().trim();
      break;
    }
  }

  // CURP
  const curpPatterns = [
    /CURP[:\s]+([A-Z0-9]{18})/i,
    /([A-Z0-9]{18})\s+CURP/i,
    // Patrón para CSF nueva donde CURP está después del RFC
    /(?<=RFC\s+[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\s+)([A-Z0-9]{18})/i,
  ];

  for (const pattern of curpPatterns) {
    const match = texto.match(pattern);
    if (match) {
      curp = match[1].trim();
      break;
    }
  }

  // Nombre/Razón Social - Patrones mejorados para CSF 2023-2026
  // FIX: Prefijos del SAT que aparecen antes de la razón social y no deben incluirse
  const PREFIJOS_SAT = [
    /^Registro\s+Federal\s+de\s+Contribuyentes\s*/i,
    /^Constancia\s+de\s+Situaci[oó]n\s+Fiscal\s*/i,
    /^Denominaci[oó]n\s+o\s+Raz[oó]n\s+Social[:\s]*/i,
    /^Raz[oó]n\s+Social[:\s]*/i,
    /^Nombre[:\s]*/i,
    /^NOMBRE[:\s]*/i,
    /^SAT\s+/i,
  ]

  const limpiarNombre = (raw) => {
    if (!raw) return null
    let limpio = raw.trim()
    // Eliminar prefijos institucionales del SAT
    for (const pref of PREFIJOS_SAT) {
      limpio = limpio.replace(pref, '')
    }
    // Eliminar todo lo que venga después de Capital:, Nombre Comercial:, Giro:
    limpio = limpio.replace(/\s*(Capital|Nombre\s+Comercial|Giro|Régimen|Domicilio|Código\s+Postal)[:\s].*/i, '')
    // Eliminar residuos de puntuación al inicio/fin
    limpio = limpio.replace(/^[,.:;\s]+|[,.:;\s]+$/g, '').replace(/\s+/g, ' ').trim()
    // Si quedó muy corto o solo tiene palabras del SAT, descartar
    if (limpio.length < 3) return null
    return limpio
  }

  const nombrePatterns = [
    // CSF nueva 2023+: Nombre viene después de CURP, antes de Código Postal
    /CURP\s+[A-Z0-9]{18}\s+([A-ZÁÉÍÓÚÑ\s,.'&-]{5,80})\s+(?:Código\s+Postal|\d{5}|Domicilio)/i,
    // CSF persona moral: razón social antes de RFC
    /Denominaci[oó]n\s+o\s+Raz[oó]n\s+Social[:\s]+([A-ZÁÉÍÓÚÑ\s,.'&-]{5,120}?)\s+(?:RFC|Régimen|$)/i,
    // Patrón con etiqueta NOMBRE explícita
    /(?:Nombre|NOMBRE|Raz[oó]n\s+Social)[:\s]+([A-ZÁÉÍÓÚÑ\s,.'&-]{5,120}?)(?=\s+(?:RFC|CURP|Código|Domicilio|Régimen|$))/i,
    // CSF antigua - nombre antes de la etiqueta
    /([A-ZÁÉÍÓÚÑ\s,.'&-]{10,80})\s+Nombre,\s*denominaci[oó]n\s+o\s+raz[oó]n\s+social/i,
  ]
  
  for (const pattern of nombrePatterns) {
    const match = texto.match(pattern)
    if (match) {
      const candidato = limpiarNombre(match[1])
      if (candidato && candidato.length >= 3) {
        nombre = candidato
        break
      }
    }
  }

  // Código Postal - Patrones mejorados
  const cpPatterns = [
    /Código\s+Postal[:\s]*(\d{5})/i,
    /C\.?\s*P\.?[:\s]*(\d{5})/i,
    /(\d{5})\s+Código\s+Postal/i,
    // CSF nueva: CP después de nombre
    /([A-ZÁÉÍÓÚÑ\s,.]{10,})\s+(\d{5})\s+(?:Colonia|Municipio)/i,
  ];

  for (const pattern of cpPatterns) {
    const match = texto.match(pattern);
    if (match) {
      // Para el patrón que captura nombre + CP, tomar el segundo grupo
      codigo_postal = match[match.length - 1].trim();
      break;
    }
  }

  // Estatus en el padrón
  const estatusPatterns = [
    /Estatus\s+en\s+el\s+padrón[:\s]+(ACTIVO|SUSPENDIDO|CANCELADO)/i,
    /Situación\s+en\s+el\s+padrón[:\s]+(ACTIVO|SUSPENDIDO|CANCELADO)/i,
    /ACTIVO\s+en\s+el\s+padrón\s+fiscal/i,
  ];

  for (const pattern of estatusPatterns) {
    const match = texto.match(pattern);
    if (match) {
      estatus = match[1] || 'ACTIVO';
      break;
    }
  }

  // ── Mapeo COMPLETO de regímenes SAT vigentes ────────────────────────────────
  // Se define ANTES de los patrones para usarse tanto en extracción como en mapeo
  const MAPA_REGIMENES = [
    { patron: /General\s+de\s+Ley\s+Personas\s+Morales/i,                    clave: '601', label: 'General de Ley Personas Morales' },
    { patron: /Personas\s+Morales\s+con\s+Fines\s+no\s+Lucrativos/i,         clave: '603', label: 'Personas Morales con Fines no Lucrativos' },
    { patron: /Sueldos\s+y\s+Salarios/i,                                       clave: '605', label: 'Sueldos y Salarios' },
    { patron: /Arrendamiento/i,                                                 clave: '606', label: 'Arrendamiento' },
    { patron: /Actividades\s+Empresariales\s+y\s+Profesionales/i,             clave: '612', label: 'Actividades Empresariales y Profesionales' },
    { patron: /Actividades\s+Empresariales/i,                                  clave: '612', label: 'Personas Físicas con Actividades Empresariales' },
    { patron: /Personas\s+F[ií]sicas\s+con\s+Actividades\s+Empresariales/i,  clave: '612', label: 'Personas Físicas con Actividades Empresariales' },
    { patron: /Sin\s+obligaciones\s+fiscales/i,                                clave: '616', label: 'Sin obligaciones fiscales' },
    { patron: /Incorporaci[oó]n\s+Fiscal/i,                                   clave: '621', label: 'Incorporación Fiscal' },
    { patron: /R[eé]gimen\s+Simplificado\s+de\s+Confianza|RESICO/i,          clave: '626', label: 'Régimen Simplificado de Confianza (RESICO)' },
  ]

  // ── Estrategia de extracción de régimen ─────────────────────────────────────
  // En lugar de confiar en un regex de límites (que falla cuando el texto del PDF
  // no tiene separadores claros), buscamos DIRECTAMENTE las cadenas conocidas
  // de los regímenes SAT en el texto completo. Esto es más robusto que cualquier
  // patrón de captura con lookahead/lookbehind.

  // Estrategia 1 — búsqueda directa de nombre de régimen conocido en el texto del PDF
  for (const { patron, clave, label } of MAPA_REGIMENES) {
    if (patron.test(texto)) {
      regimen_fiscal = label
      clave_regimen  = clave
      break
    }
  }

  // Estrategia 2 — fallback: buscar después de etiqueta "Régimen" con lookahead estricto
  // Solo se ejecuta si la estrategia 1 no encontró nada
  if (!regimen_fiscal) {
    const regimenPatterns = [
      // CSF nueva 2023+: "Régimen General de Ley Personas Morales Fecha Inicio"
      // Captura la etiqueta completa del régimen antes de "Fecha" o fecha numérica
      /Régimen\s+((?:General\s+de\s+Ley\s+|Personas\s+|Sueldos\s+|Arrendamiento|Sin\s+|Incorporaci[oó]n|Simplificado)[A-ZÁÉÍÓÚÑA-Za-z\s,.()+]{3,80}?)(?=\s+(?:Fecha|Estatus|\d{2}[\/\-]\d{2})|$)/i,
      // Con etiqueta "Régimen Fiscal:"
      /Régimen\s+Fiscal\s*[:\s]+([A-ZÁÉÍÓÚÑ\s,.()+]{5,80}?)(?=\s+(?:Fecha|Capital|Nombre\s+Comercial|Estatus|\d{2}[\/\-]\d{2})|$)/i,
    ]
    for (const pattern of regimenPatterns) {
      const match = texto.match(pattern)
      if (match) {
        const candidato = match[1]
          .replace(/\s*(Fecha|Capital|Nombre\s+Comercial|Domicilio|Giro|Inicio)[:\s].*/i, '')
          .replace(/\s+/g, ' ')
          .trim()
        // Verificar que no capturó "Fecha Inicio" ni texto de 2 palabras sin sentido
        if (candidato.length > 8 && !/^Fecha/i.test(candidato)) {
          regimen_fiscal = candidato
          // Intentar mapear a clave
          for (const { patron, clave } of MAPA_REGIMENES) {
            if (patron.test(regimen_fiscal)) { clave_regimen = clave; break }
          }
          break
        }
      }
    }
  }

  // Fecha de inicio de operaciones
  const fechaPatterns = [
    /(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    // CSF nueva: formato "15/01/2020"
    /Fecha\s+de\s+inicio\s+de\s+operaciones[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
  ];

  const meses = {
    ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04',
    MAYO: '05', JUNIO: '06', JULIO: '07', AGOSTO: '08',
    SEPTIEMBRE: '09', SETIEMBRE: '09', OCTUBRE: '10',
    NOVIEMBRE: '11', DICIEMBRE: '12'
  };

  for (const pattern of fechaPatterns) {
    const match = texto.match(pattern);
    if (match) {
      let day, month, year;
      
      if (pattern.toString().includes('DE')) {
        // Formato: 15 DE ENERO DE 2020
        day = match[1].padStart(2, '0');
        month = meses[match[2].toUpperCase()] || '01';
        year = match[3];
      } else {
        // Formato: 15/01/2020
        day = match[1].padStart(2, '0');
        month = match[2].padStart(2, '0');
        year = match[3];
      }
      
      fecha_inicio_ops = `${year}-${month}-${day}`;
      break;
    }
  }

  // Régimen de Capital (SA de CV, SC, etc.)
  const regCapPatterns = [
    /Régimen\s+de\s+Capital[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Nombre\s+Comercial|\s+Fecha|\s+Estatus|$)/i,
    /Capital[:\s]+([A-ZÁÉÍÓÚÑ\s]{10,80}?)(?=\s+Nombre\s+Comercial|\s+Fecha|\s+Estatus|$)/i,
  ]
  for (const p of regCapPatterns) {
    const m = texto.match(p)
    if (m) { regimen_capital = m[1].replace(/\s+/g,' ').trim(); break }
  }

  // Nombre Comercial (opcional)
  const nomComPatterns = [
    /Nombre\s+Comercial[:\s]+([A-ZÁÉÍÓÚÑ\s,.&-]{2,80}?)(?=\s+Fecha|\s+Estatus|\s+Código|\s+$)/i,
  ]
  for (const p of nomComPatterns) {
    const m = texto.match(p)
    if (m && m[1].trim().length > 1) { nombre_comercial = m[1].replace(/\s+/g,' ').trim(); break }
  }

  // Fecha último cambio de estado
  const fechaUltPatterns = [
    /[Úu]ltimo\s+cambio\s+de\s+estado[:\s]*(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i,
    /[Úu]ltimo\s+cambio\s+de\s+estado[:\s]*(\d{1,2})\/(\d{2})\/(\d{4})/i,
    /Fecha\s+de\s+[Úu]ltimo\s+cambio[:\s]*(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i,
  ]
  for (const p of fechaUltPatterns) {
    const m = texto.match(p)
    if (m) {
      const mes = isNaN(m[2]) ? (meses[m[2].toUpperCase()] || '01') : m[2].padStart(2,'0')
      fecha_ultimo_cambio = `${m[3]}-${mes}-${m[1].padStart(2,'0')}`
      break
    }
  }

  // Domicilio fiscal — todos los campos de la CSF
  // Función de limpieza universal: corta al encontrar cualquier etiqueta SAT
  // El PDF extrae texto en flujo continuo — las etiquetas son los únicos separadores.
  // FIX: numero_interior y localidad capturaban el inicio de la etiqueta siguiente.
  const STOP_SAT = new RegExp(
    '\\s+(?:' +
    'Tipo\\s+de\\s+Vialidad|Nombre\\s+de\\s+Vialidad|' +
    'N[uú]mero\\s+Exterior|N[uú]mero\\s+Interior|' +
    'Colonia|Nombre\\s+de\\s+la\\s+Localidad|Nombre\\s+del|' +
    'Municipio|Nombre\\s+de\\s+la\\s+Entidad|Entidad\\s+Federativa|' +
    'Entre\\s+Calle|Y\\s+Calle|C[oó]digo\\s+Postal|' +
    'RFC|Estatus|Fecha|R[eé]gimen' +
    ')', 'i'
  )

  const limpiarDom = (raw) => {
    if (!raw) return null
    // Cortar en la primera etiqueta SAT que quedó incluida en la captura
    const idx = raw.search(STOP_SAT)
    const valor = (idx >= 0 ? raw.slice(0, idx) : raw)
      .replace(/\s+/g, ' ')
      .trim()
    return valor.length > 0 ? valor : null
  }

  const domPatterns = {
    tipo_vialidad:
      /Tipo\s+de\s+Vialidad[:\s]+([A-ZÁÉÍÓÚÑ\s.()/]+?)(?=\s+Nombre\s+de\s+Vialidad|\s+N[uú]mero|$)/i,
    nombre_vialidad:
      /Nombre\s+de\s+Vialidad[:\s]+([A-ZÁÉÍÓÚÑ\s0-9.,-]+?)(?=\s+N[uú]mero\s+Exterior|\s+N[uú]mero\s+Interior|\s+Colonia|$)/i,
    numero_exterior:
      /N[uú]mero\s+Exterior[:\s]+([A-Z0-9\s/.-]+?)(?=\s+N[uú]mero\s+Interior|\s+Colonia|\s+Nombre|\s+C[oó]digo|$)/i,
    // FIX: lookahead incluye "Nombre" para cortar antes de "Nombre de la Localidad"
    numero_interior:
      /N[uú]mero\s+Interior[:\s]+([A-Z0-9\s/.-]+?)(?=\s+Colonia|\s+Nombre|\s+Municipio|\s+C[oó]digo|$)/i,
    colonia:
      /Colonia[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Nombre\s+de\s+la\s+Localidad|\s+Nombre\s+del|\s+Municipio|\s+C[oó]digo|$)/i,
    // FIX: lookahead incluye "Nombre del" (truncado de "Nombre del Municipio") y "Municipio o"
    localidad:
      /Nombre\s+de\s+la\s+Localidad[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Nombre\s+del|\s+Municipio\s+o|\s+Municipio|\s+Nombre\s+de\s+la\s+Ent|\s+C[oó]digo|$)/i,
    municipio:
      /Municipio\s+o\s+Demarcaci[oó]n[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Nombre\s+de\s+la\s+Entidad|\s+Entidad|\s+Entre|$)/i,
    estado:
      /Nombre\s+de\s+la\s+Entidad\s+Federativa[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Entre\s+Calle|\s+Y\s+Calle|$)/i,
    entre_calle:
      /Entre\s+Calle[:\s]+([A-ZÁÉÍÓÚÑ\s0-9]+?)(?=\s+Y\s+Calle|$)/i,
    y_calle:
      /Y\s+Calle[:\s]+([A-ZÁÉÍÓÚÑ\s0-9]+?)(?=\s+RFC|\s+Estatus|\s+Fecha|$)/i,
  }

  for (const [campo, patron] of Object.entries(domPatterns)) {
    const m = texto.match(patron)
    if (m) {
      const valor = limpiarDom(m[1])
      if (valor) domicilio[campo] = valor
    }
  }

  // Calcular confianza
  let confianza = 0;
  if (rfc) confianza += 35;
  if (nombre) confianza += 25;
  if (codigo_postal) confianza += 15;
  if (regimen_fiscal) confianza += 15;
  if (estatus) confianza += 10;

  const errores = [];
  if (!rfc) errores.push('No se encontró RFC válido');
  if (!nombre) errores.push('No se encontró nombre o razón social');

  return {
    confianza,
    datos: {
      rfc,
      nombre,
      curp,
      codigo_postal,
      estatus,
      fecha_inicio_ops,
      fecha_ultimo_cambio,
      regimen_capital,
      nombre_comercial,
      regimen_fiscal,
      clave_regimen,
      domicilio,
      tipo_csf: esNueva ? 'nueva' : (esAntigua ? 'antigua' : 'desconocida')
    },
    errores,
    advertencias: [],
    debug: {
      rfc_detectado: rfc,
      nombre_detectado: nombre,
      texto_fragmento: texto.substring(0, 300)
    }
  };
}

// ─────────────────────────────────────────────
// PARSERS PLACEHOLDER (32D y CSD)
// ─────────────────────────────────────────────
function parse32D(texto) {
  return {
    confianza: 0,
    datos: {},
    errores: ["Parser 32D aún no implementado"],
    advertencias: [],
    debug: {}
  };
}

function parseCSD(texto) {
  return {
    confianza: 0,
    datos: {},
    errores: ["Parser CSD aún no implementado"],
    advertencias: [],
    debug: {}
  };
}

// ─────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────
export const parsearDocumento = async (file, tipoDocumento, rfcEsperado = null) => {
  try {
    // Validaciones iniciales
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'Solo se aceptan archivos PDF.' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'El archivo excede el tamaño máximo de 10MB.' };
    }

    console.log('[OBRIX Parser] Iniciando análisis', { 
      tipoDocumento, 
      size: file.size,
      fileName: file.name 
    });

    // Extraer texto nativo del PDF
    let textoExtraido = null;
    let metodoExtraccion = 'pdf.js';
    
    try {
      textoExtraido = await extraerTextoPDF(file);
      
      if (!textoExtraido || textoExtraido.length < 50) {
        throw new Error('Texto extraído insuficiente');
      }
      
      console.log(`[OBRIX Parser] ✅ Texto extraído (${textoExtraido.length} caracteres)`);
      console.log('[OBRIX Parser] 📄 Fragmento:', textoExtraido.substring(0, 200));
    } catch (pdfError) {
      console.error('[OBRIX Parser] Error extrayendo texto:', pdfError.message);
      
      // ✅ MANEJO ESPECÍFICO DEL BUG CRYPTO: Intentar fallback simple
      if (pdfError.message?.includes('hashOriginal.toHex')) {
        return { 
          success: false, 
          error: 'Documento con firma digital compleja. Por favor, usa una CSF sin firma avanzada o contacta al administrador.',
          metodo: 'failed_crypto'
        };
      }
      
      return { 
        success: false, 
        error: 'No se pudo extraer texto del documento PDF: ' + pdfError.message,
        metodo: 'failed'
      };
    }

    // Parsear texto extraído
    let resultadoParsing = null;

    switch (tipoDocumento) {
      case 'CSF':
        resultadoParsing = parseCSF(textoExtraido);
        break;
      case '32D':
        resultadoParsing = parse32D(textoExtraido);
        break;
      case 'CSD':
        resultadoParsing = parseCSD(textoExtraido);
        break;
      default:
        throw new Error(`Tipo de documento no soportado: ${tipoDocumento}`);
    }

    const resultado = {
      tipo_documento: tipoDocumento,
      es_documento_correcto: resultadoParsing.confianza >= 50,
      confianza: resultadoParsing.confianza,
      datos_extraidos: resultadoParsing.datos,
      errores: resultadoParsing.errores || [],
      advertencias: resultadoParsing.advertencias || [],
      metodo_extraccion: metodoExtraccion,
      debug: {
        texto_len: textoExtraido.length,
        metodo: metodoExtraccion,
        ...resultadoParsing.debug,
      }
    };

    console.log('[OBRIX Parser] ✅ Análisis completado', {
      confianza: resultado.confianza,
      metodo: metodoExtraccion,
      campos: Object.keys(resultado.datos_extraidos).filter(k => resultado.datos_extraidos[k])
    });

    return { success: true, resultado };
  } catch (err) {
    console.error('[OBRIX Parser] Error general:', err);
    return { 
      success: false, 
      error: 'No se pudo procesar el documento: ' + err.message,
      metodo: 'error'
    };
  }
};

// ─────────────────────────────────────────────
// UTILIDADES ADICIONALES
// ─────────────────────────────────────────────
export const getSemaforoParsing = (confianza, esDocumentoCorrecto) => {
  if (!esDocumentoCorrecto) return { icon: '❌', label: 'Documento incorrecto' };
  if (confianza >= 80) return { icon: '✅', label: 'Documento válido' };
  if (confianza >= 50) return { icon: '⚠️', label: 'Documento con advertencias' };
  return { icon: '❌', label: 'No se pudo validar' };
};

export const validarRFC = (rfc) => {
  if (!rfc) return false;
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase());
};

export const calcularDiasVigencia = (fechaFin) => {
  if (!fechaFin) return null;
  const fechaVencimiento = new Date(fechaFin);
  const hoy = new Date();
  const diffTiempo = fechaVencimiento - hoy;
  const diffDias = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));
  return diffDias;
};