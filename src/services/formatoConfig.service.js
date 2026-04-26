// ============================================================
//  OBRIX ERP — Servicio: Configuración de Formatos PDF
//  Archivo: src/services/formatoConfig.service.js
//  Versión: 1.0 | Abril 2026
//  Descripción: Lee y escribe la configuración de formatos
//  personalizados de documentos PDF en company_settings.
//  La config se guarda como JSONB en el campo formato_config.
// ============================================================

import { supabase } from '../config/supabase'

// ── Obtener company_id del usuario actual ───────────────────
async function getCompanyId() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  return data?.company_id
}

// ============================================================
//  CONFIGURACIÓN POR DEFECTO DE CADA FORMATO
// ============================================================

export const FORMATOS_DISPONIBLES = [
  {
    id:          'factura',
    nombre:      'Factura CFDI',
    emoji:       '🧾',
    variantes:   ['Ingreso', 'Nota de Crédito', 'Complemento de Pago'],
    objetos:     ['empresa', 'cliente', 'doc', 'concepto', 'impuesto'],
    descripcion: 'Factura fiscal con soporte para Ingreso, Nota de Crédito y REP',
  },
  {
    id:          'cotizacion',
    nombre:      'Cotización',
    emoji:       '📋',
    variantes:   [],
    objetos:     ['empresa', 'cliente', 'proyecto', 'doc', 'concepto'],
    descripcion: 'Propuesta comercial con partidas y totales',
  },
  {
    id:          'orden_compra',
    nombre:      'Orden de Compra',
    emoji:       '🛒',
    variantes:   [],
    objetos:     ['empresa', 'proveedor', 'proyecto', 'doc', 'concepto'],
    descripcion: 'Orden de compra a proveedor con partidas',
  },
  {
    id:          'reporte_gastos',
    nombre:      'Reporte de Gastos',
    emoji:       '💸',
    variantes:   [],
    objetos:     ['empresa', 'empleado', 'proyecto', 'doc'],
    descripcion: 'Reporte de gastos por empleado y proyecto',
  },
  {
    id:          'caja_chica',
    nombre:      'Caja Chica',
    emoji:       '🏧',
    variantes:   [],
    objetos:     ['empresa', 'empleado', 'proyecto', 'doc'],
    descripcion: 'Entrega o reposición de fondo de caja chica',
  },
]

// ── Config por defecto de un formato ───────────────────────
export const configDefecto = (formatoId) => ({
  color_primario:    '#2563EB',
  color_secundario:  '#1E40AF',
  color_texto:       '#111827',
  color_fondo:       '#F9FAFB',
  mostrar_logo:      true,
  orientacion:       'portrait',   // 'portrait' | 'landscape'
  tamano_papel:      'letter',     // 'letter' | 'a4'
  // Secciones visibles
  secciones: {
    encabezado:      true,
    datos_empresa:   true,
    datos_cliente:   true,
    datos_proyecto:  ['cotizacion','orden_compra','reporte_gastos','caja_chica'].includes(formatoId),
    datos_empleado:  ['reporte_gastos','caja_chica'].includes(formatoId),
    tabla_conceptos: ['factura','cotizacion','orden_compra'].includes(formatoId),
    tabla_impuestos: formatoId === 'factura',
    totales:         true,
    notas:           true,
    pie_pagina:      true,
    firma:           ['reporte_gastos','caja_chica'].includes(formatoId),
  },
  // Textos personalizables
  textos: {
    titulo_documento:  '',   // vacío = usar nombre del formato
    pie_pagina:        '',
    terminos:          '',
    nota_pie:          '',
  },
  // Campos visibles por sección (el usuario activa/desactiva)
  campos: {
    empresa: {
      logo:              true,
      razon_social:      true,
      rfc:               true,
      regimen_fiscal:    true,
      domicilio_fiscal:  true,
      telefono:          true,
      email:             true,
      web:               false,
      representante:     false,
    },
    cliente: {
      razon_social:      true,
      rfc:               true,
      regimen_fiscal:    true,
      cp:                true,
      domicilio:         true,
      telefono:          true,
      email:             false,
      contacto_nombre:   true,
    },
    proyecto: {
      nombre:            true,
      clave:             true,
      descripcion:       false,
      fecha_inicio:      true,
      fecha_fin:         true,
      estatus:           false,
    },
    empleado: {
      nombre_completo:   true,
      puesto:            true,
      rfc:               false,
    },
    doc: {
      folio:             true,
      serie:             formatoId === 'factura',
      uuid_cfdi:         formatoId === 'factura',
      fecha_emision:     true,
      fecha_vencimiento: true,
      condiciones_pago:  true,
      metodo_pago:       formatoId === 'factura',
      forma_pago:        formatoId === 'factura',
      uso_cfdi:          formatoId === 'factura',
      moneda:            true,
      tipo_cambio:       false,
      notas:             true,
      importe_letra:     true,
    },
  },
})

// ============================================================
//  CATÁLOGO DE VARIABLES DISPONIBLES POR OBJETO
//  Se usa en el editor de formatos para mostrar al usuario
//  qué variables puede activar/desactivar
// ============================================================

export const CATALOGO_VARIABLES = {
  empresa: [
    { key: 'logo',             label: 'Logo',                  variable: '{{empresa.logo_url}}'         },
    { key: 'razon_social',     label: 'Razón Social',          variable: '{{empresa.razon_social}}'     },
    { key: 'rfc',              label: 'RFC',                   variable: '{{empresa.rfc}}'              },
    { key: 'regimen_fiscal',   label: 'Régimen Fiscal',        variable: '{{empresa.regimen_fiscal}}'   },
    { key: 'domicilio_fiscal', label: 'Domicilio Fiscal',      variable: '{{empresa.domicilio_fiscal}}' },
    { key: 'telefono',         label: 'Teléfono',              variable: '{{empresa.telefono}}'         },
    { key: 'email',            label: 'Email',                 variable: '{{empresa.email}}'            },
    { key: 'web',              label: 'Sitio Web',             variable: '{{empresa.web}}'              },
    { key: 'representante',    label: 'Representante Legal',   variable: '{{empresa.representante_legal}}' },
  ],
  cliente: [
    { key: 'razon_social',     label: 'Razón Social',          variable: '{{cliente.razon_social}}'     },
    { key: 'rfc',              label: 'RFC',                   variable: '{{cliente.rfc}}'              },
    { key: 'regimen_fiscal',   label: 'Régimen Fiscal',        variable: '{{cliente.regimen_fiscal}}'   },
    { key: 'cp',               label: 'Código Postal',         variable: '{{cliente.codigo_postal}}'    },
    { key: 'domicilio',        label: 'Domicilio',             variable: '{{cliente.domicilio}}'        },
    { key: 'telefono',         label: 'Teléfono',              variable: '{{cliente.telefono}}'         },
    { key: 'email',            label: 'Email',                 variable: '{{cliente.email}}'            },
    { key: 'contacto_nombre',  label: 'Nombre de Contacto',   variable: '{{cliente.contacto_nombre}}'  },
  ],
  proyecto: [
    { key: 'nombre',           label: 'Nombre del Proyecto',   variable: '{{proyecto.nombre}}'          },
    { key: 'clave',            label: 'Clave',                 variable: '{{proyecto.clave}}'           },
    { key: 'descripcion',      label: 'Descripción',           variable: '{{proyecto.descripcion}}'     },
    { key: 'fecha_inicio',     label: 'Fecha Inicio',          variable: '{{proyecto.fecha_inicio}}'    },
    { key: 'fecha_fin',        label: 'Fecha Fin',             variable: '{{proyecto.fecha_fin}}'       },
    { key: 'estatus',          label: 'Estatus',               variable: '{{proyecto.estatus}}'         },
  ],
  empleado: [
    { key: 'nombre_completo',  label: 'Nombre Completo',       variable: '{{empleado.nombre_completo}}' },
    { key: 'puesto',           label: 'Puesto',                variable: '{{empleado.puesto}}'          },
    { key: 'rfc',              label: 'RFC',                   variable: '{{empleado.rfc}}'             },
  ],
  doc: [
    { key: 'folio',            label: 'Folio',                 variable: '{{doc.folio}}'                },
    { key: 'serie',            label: 'Serie',                 variable: '{{doc.serie}}'                },
    { key: 'uuid_cfdi',        label: 'UUID CFDI',             variable: '{{doc.uuid_cfdi}}'            },
    { key: 'fecha_emision',    label: 'Fecha de Emisión',      variable: '{{doc.fecha_emision}}'        },
    { key: 'fecha_vencimiento',label: 'Fecha de Vencimiento',  variable: '{{doc.fecha_vencimiento}}'    },
    { key: 'condiciones_pago', label: 'Condiciones de Pago',   variable: '{{doc.condiciones_pago}}'     },
    { key: 'metodo_pago',      label: 'Método de Pago',        variable: '{{doc.metodo_pago}}'          },
    { key: 'forma_pago',       label: 'Forma de Pago',         variable: '{{doc.forma_pago}}'           },
    { key: 'uso_cfdi',         label: 'Uso CFDI',              variable: '{{doc.uso_cfdi}}'             },
    { key: 'moneda',           label: 'Moneda',                variable: '{{doc.moneda}}'               },
    { key: 'tipo_cambio',      label: 'Tipo de Cambio',        variable: '{{doc.tipo_cambio}}'          },
    { key: 'notas',            label: 'Notas',                 variable: '{{doc.notas}}'                },
    { key: 'importe_letra',    label: 'Importe con Letra',     variable: '{{doc.importe_letra}}'        },
  ],
  concepto: [
    { key: 'cantidad',         label: 'Cantidad',              variable: '{{concepto.cantidad}}'        },
    { key: 'codigo',           label: 'Código',                variable: '{{concepto.codigo}}'          },
    { key: 'descripcion',      label: 'Descripción',           variable: '{{concepto.descripcion}}'     },
    { key: 'unidad_medida',    label: 'Unidad de Medida',      variable: '{{concepto.unidad_medida}}'   },
    { key: 'codigo_sat',       label: 'Código SAT',            variable: '{{concepto.codigo_sat}}'      },
    { key: 'precio_unitario',  label: 'Precio Unitario',       variable: '{{concepto.precio_unitario}}' },
    { key: 'importe',          label: 'Importe',               variable: '{{concepto.importe}}'         },
    { key: 'objeto_impuesto',  label: 'Objeto de Impuesto',    variable: '{{concepto.objeto_impuesto}}' },
  ],
  impuesto: [
    { key: 'base',             label: 'Base',                  variable: '{{impuesto.base}}'            },
    { key: 'impuesto',         label: 'Impuesto',              variable: '{{impuesto.impuesto}}'        },
    { key: 'tipo',             label: 'Tipo (Traslado/Ret.)',  variable: '{{impuesto.tipo}}'            },
    { key: 'tasa',             label: 'Tasa',                  variable: '{{impuesto.tasa}}'            },
    { key: 'importe',          label: 'Importe Impuesto',      variable: '{{impuesto.importe}}'         },
  ],
}

// ============================================================
//  OPERACIONES BD
// ============================================================

/**
 * Obtiene la configuración completa de todos los formatos.
 * Si no existe en BD devuelve los defaults.
 */
export async function getFormatosConfig() {
  const companyId = await getCompanyId()
  const { data, error } = await supabase
    .from('company_settings')
    .select('formato_config')
    .eq('company_id', companyId)
    .single()

  if (error) throw error

  // Si no hay config guardada, construir defaults para todos los formatos
  const configGuardada = data?.formato_config || {}
  const configCompleta = {}
  for (const f of FORMATOS_DISPONIBLES) {
    configCompleta[f.id] = configGuardada[f.id] || configDefecto(f.id)
  }
  return configCompleta
}

/**
 * Guarda la configuración de UN formato específico.
 */
export async function saveFormatoConfig(formatoId, config) {
  const companyId = await getCompanyId()

  // Leer config actual para no pisar los otros formatos
  const { data } = await supabase
    .from('company_settings')
    .select('formato_config')
    .eq('company_id', companyId)
    .single()

  const configActual = data?.formato_config || {}
  const configNueva  = { ...configActual, [formatoId]: config }

  const { error } = await supabase
    .from('company_settings')
    .update({ formato_config: configNueva })
    .eq('company_id', companyId)

  if (error) throw error
  return configNueva
}

/**
 * Obtiene la config de un formato específico.
 * Útil para llamar desde export.utils.js antes de generar PDF.
 */
export async function getFormatoById(formatoId) {
  const companyId = await getCompanyId()
  const { data, error } = await supabase
    .from('company_settings')
    .select('formato_config')
    .eq('company_id', companyId)
    .single()

  if (error) throw error
  return data?.formato_config?.[formatoId] || configDefecto(formatoId)
}

/**
 * Lee los datos de empresa para usar en los PDFs.
 * Consolida company_settings + company_efirma.
 */
export async function getDatosEmpresa() {
  const companyId = await getCompanyId()
  const { data, error } = await supabase
    .from('company_settings')
    .select(`
      rfc, razon_social, regimen_fiscal_emisor,
      codigo_postal_fiscal, domicilio_fiscal,
      telefono, email, web, logo_url,
      representante_legal
    `)
    .eq('company_id', companyId)
    .single()

  if (error) throw error
  return {
    rfc:               data?.rfc               || '',
    razon_social:      data?.razon_social       || '',
    regimen_fiscal:    data?.regimen_fiscal_emisor || '',
    cp_fiscal:         data?.codigo_postal_fiscal  || '',
    domicilio_fiscal:  data?.domicilio_fiscal   || '',
    telefono:          data?.telefono           || '',
    email:             data?.email              || '',
    web:               data?.web                || '',
    logo_url:          data?.logo_url           || '',
    representante_legal: data?.representante_legal || '',
  }
}
