// ============================================================
//  OBRIX ERP — Submódulo: Configuración de Formatos PDF
//  Archivo: src/pages/settings/FormatosTab.jsx
//  Versión: 1.0 | Abril 2026
//  Descripción: Pestaña dentro de CompanySettings que permite
//  configurar el diseño personalizado de cada formato de
//  documento PDF (Factura, Cotización, OC, Gastos, Caja Chica)
// ============================================================

import { useState, useEffect, useRef } from 'react'
import {
  Save, Eye, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, Palette, Layout,
  FileText, Type, ToggleLeft, ToggleRight, Info,
} from 'lucide-react'
import {
  FORMATOS_DISPONIBLES, CATALOGO_VARIABLES,
  configDefecto, getFormatosConfig, saveFormatoConfig,
  getDatosEmpresa,
} from '../../services/formatoConfig.service'
import { buildPdf } from '../../utils/export.utils'

// ─────────────────────────────────────────────────────────────
// Helper: toggle de campo visible/oculto
// ─────────────────────────────────────────────────────────────
const Toggle = ({ activo, onChange, label, variable }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 10px', borderRadius: '8px',
    backgroundColor: activo ? '#eff6ff' : '#f9fafb',
    border: `1px solid ${activo ? '#bfdbfe' : '#e5e7eb'}`,
    marginBottom: '6px', cursor: 'pointer', transition: 'all 0.15s',
  }} onClick={() => onChange(!activo)}>
    <div>
      <p style={{ fontSize: '12px', fontWeight: '600', color: activo ? '#1d4ed8' : '#374151', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: '10px', color: '#9ca3af', margin: '1px 0 0', fontFamily: 'monospace' }}>
        {variable}
      </p>
    </div>
    {activo
      ? <ToggleRight size={20} color="#2563eb" />
      : <ToggleLeft  size={20} color="#d1d5db" />
    }
  </div>
)

// ─────────────────────────────────────────────────────────────
// Selector de color con preview
// ─────────────────────────────────────────────────────────────
const ColorPicker = ({ label, value, onChange }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
      {label}
    </label>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '40px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer', padding: '2px' }}
      />
      <input
        type="text"
        value={value}
        onChange={e => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && onChange(e.target.value)}
        style={{ width: '90px', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
      />
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: value, border: '1px solid #e5e7eb', flexShrink: 0 }} />
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────
// Panel colapsable de sección
// ─────────────────────────────────────────────────────────────
const PanelSeccion = ({ titulo, icono: Icono, color = '#2563eb', children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: open ? `${color}0F` : '#fafafa',
          border: 'none', cursor: 'pointer', transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {Icono && <Icono size={15} color={open ? color : '#6b7280'} />}
          <span style={{ fontSize: '13px', fontWeight: '700', color: open ? color : '#374151' }}>{titulo}</span>
        </div>
        {open
          ? <ChevronDown  size={14} color={color} />
          : <ChevronRight size={14} color="#9ca3af" />
        }
      </button>
      {open && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderTop: '1px solid #f3f4f6' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Editor de un formato específico
// ─────────────────────────────────────────────────────────────
const EditorFormato = ({ formato, config, onChange, empresa, onPreview, guardando }) => {
  const cfg = config || configDefecto(formato.id)

  const updateColor  = (key, val) => onChange({ ...cfg, [key]: val })
  const updateSeccion= (key, val) => onChange({ ...cfg, secciones: { ...cfg.secciones, [key]: val } })
  const updateTexto  = (key, val) => onChange({ ...cfg, textos:    { ...cfg.textos,    [key]: val } })
  const updateCampo  = (objeto, key, val) => onChange({
    ...cfg,
    campos: { ...cfg.campos, [objeto]: { ...(cfg.campos?.[objeto] || {}), [key]: val } },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>

      {/* ── Colores corporativos ── */}
      <PanelSeccion titulo="Colores Corporativos" icono={Palette} color="#7c3aed" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <ColorPicker
            label="Color Primario (encabezado, títulos)"
            value={cfg.color_primario || '#2563EB'}
            onChange={val => updateColor('color_primario', val)}
          />
          <ColorPicker
            label="Color Secundario (botones, acentos)"
            value={cfg.color_secundario || '#1E40AF'}
            onChange={val => updateColor('color_secundario', val)}
          />
        </div>
        {/* Preview de colores */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <div style={{ flex: 1, height: '32px', borderRadius: '8px', backgroundColor: cfg.color_primario, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: '600' }}>Primario</span>
          </div>
          <div style={{ flex: 1, height: '32px', borderRadius: '8px', backgroundColor: cfg.color_secundario, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: '600' }}>Secundario</span>
          </div>
        </div>
      </PanelSeccion>

      {/* ── Configuración de página ── */}
      <PanelSeccion titulo="Configuración de Página" icono={Layout} color="#059669">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Orientación</label>
            <select value={cfg.orientacion || 'portrait'} onChange={e => onChange({ ...cfg, orientacion: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: '#fff' }}>
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Tamaño de Papel</label>
            <select value={cfg.tamano_papel || 'letter'} onChange={e => onChange({ ...cfg, tamano_papel: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: '#fff' }}>
              <option value="letter">Carta (Letter)</option>
              <option value="a4">A4</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Logo en encabezado</label>
            <button onClick={() => onChange({ ...cfg, mostrar_logo: !cfg.mostrar_logo })}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: cfg.mostrar_logo ? '#eff6ff' : '#f9fafb', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: cfg.mostrar_logo ? '#1d4ed8' : '#6b7280', width: '100%' }}>
              {cfg.mostrar_logo ? <ToggleRight size={18} color="#2563eb" /> : <ToggleLeft size={18} color="#d1d5db" />}
              {cfg.mostrar_logo ? 'Visible' : 'Oculto'}
            </button>
          </div>
        </div>
      </PanelSeccion>

      {/* ── Secciones visibles ── */}
      <PanelSeccion titulo="Secciones Visibles" icono={Layout} color="#0891b2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { key: 'encabezado',      label: 'Encabezado'           },
            { key: 'datos_empresa',   label: 'Datos de Empresa'     },
            { key: 'datos_cliente',   label: 'Datos de Cliente'     },
            { key: 'datos_proyecto',  label: 'Datos de Proyecto'    },
            { key: 'datos_empleado',  label: 'Datos de Empleado'    },
            { key: 'tabla_conceptos', label: 'Tabla de Conceptos'   },
            { key: 'tabla_impuestos', label: 'Tabla de Impuestos'   },
            { key: 'totales',         label: 'Totales'              },
            { key: 'notas',           label: 'Notas'                },
            { key: 'pie_pagina',      label: 'Pie de Página'        },
            { key: 'firma',           label: 'Espacio de Firma'     },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => updateSeccion(key, !cfg.secciones?.[key])}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderRadius: '8px', border: '1px solid',
                borderColor: cfg.secciones?.[key] ? '#bfdbfe' : '#e5e7eb',
                backgroundColor: cfg.secciones?.[key] ? '#eff6ff' : '#f9fafb',
                cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                color: cfg.secciones?.[key] ? '#1d4ed8' : '#6b7280',
                transition: 'all 0.15s',
              }}>
              {cfg.secciones?.[key]
                ? <CheckCircle2 size={13} color="#2563eb" />
                : <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid #d1d5db' }} />
              }
              {label}
            </button>
          ))}
        </div>
      </PanelSeccion>

      {/* ── Campos visibles por objeto ── */}
      {formato.objetos.map(objeto => {
        const variables = CATALOGO_VARIABLES[objeto] || []
        if (!variables.length) return null
        const titulo = {
          empresa:   '📋 Campos de Empresa',
          cliente:   '👤 Campos de Cliente / Proveedor',
          proyecto:  '🏗️ Campos de Proyecto',
          empleado:  '👷 Campos de Empleado',
          doc:       '🧾 Campos del Documento',
          concepto:  '📦 Campos de Concepto (tabla)',
          impuesto:  '💰 Campos de Impuesto (tabla)',
        }[objeto] || objeto

        return (
          <PanelSeccion key={objeto} titulo={titulo} icono={FileText} color="#374151">
            {variables.map(({ key, label, variable }) => (
              <Toggle
                key={key}
                activo={cfg.campos?.[objeto]?.[key] ?? false}
                label={label}
                variable={variable}
                onChange={val => updateCampo(objeto, key, val)}
              />
            ))}
          </PanelSeccion>
        )
      })}

      {/* ── Textos personalizables ── */}
      <PanelSeccion titulo="Textos Personalizables" icono={Type} color="#d97706">
        {[
          { key: 'titulo_documento', label: 'Título del documento', placeholder: `Ej: ${formato.nombre.toUpperCase()} — vacío usa el nombre del formato` },
          { key: 'pie_pagina',       label: 'Pie de página',        placeholder: 'Ej: Tel. 33-1234-5678 | contacto@empresa.com' },
          { key: 'terminos',         label: 'Términos y condiciones',placeholder: 'Ej: Esta cotización tiene vigencia de 30 días...' },
          { key: 'nota_pie',         label: 'Nota al pie',          placeholder: 'Ej: Precios más IVA, sujetos a disponibilidad' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>{label}</label>
            <textarea
              value={cfg.textos?.[key] || ''}
              onChange={e => updateTexto(key, e.target.value)}
              placeholder={placeholder}
              rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        ))}
      </PanelSeccion>

      {/* ── Botón vista previa ── */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
        <button
          onClick={onPreview}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '10px 20px', borderRadius: '10px',
            border: '1.5px solid #2563eb', backgroundColor: '#fff',
            color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
          }}
        >
          <Eye size={14} /> Generar Vista Previa
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function FormatosTab() {
  const [formatoActivo, setFormatoActivo] = useState('factura')
  const [configs,       setConfigs]       = useState({})
  const [empresa,       setEmpresa]       = useState({})
  const [loading,       setLoading]       = useState(true)
  const [guardando,     setGuardando]     = useState(false)
  const [guardadoOk,    setGuardadoOk]    = useState(false)
  const [error,         setError]         = useState(null)

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        const [cfgs, emp] = await Promise.all([
          getFormatosConfig(),
          getDatosEmpresa(),
        ])
        setConfigs(cfgs)
        setEmpresa(emp)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  // ── Actualizar config local del formato activo ────────────
  const handleChange = (formatoId, nuevaConfig) => {
    setConfigs(prev => ({ ...prev, [formatoId]: nuevaConfig }))
    setGuardadoOk(false)
  }

  // ── Guardar en BD ─────────────────────────────────────────
  const handleGuardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await saveFormatoConfig(formatoActivo, configs[formatoActivo])
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
    } catch (e) {
      setError('Error al guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Restaurar defaults ────────────────────────────────────
  const handleRestaurar = () => {
    setConfigs(prev => ({ ...prev, [formatoActivo]: configDefecto(formatoActivo) }))
    setGuardadoOk(false)
  }

  // ── Vista previa ──────────────────────────────────────────
  const handlePreview = () => {
    const formato = FORMATOS_DISPONIBLES.find(f => f.id === formatoActivo)
    const cfg     = configs[formatoActivo] || configDefecto(formatoActivo)

    // Datos de ejemplo para la vista previa
    buildPdf({
      formatoId: formatoActivo,
      titulo:    cfg.textos?.titulo_documento || formato.nombre.toUpperCase(),
      config:    cfg,
      empresa,
      cliente: {
        razon_social:    'EMPRESA CLIENTE EJEMPLO SA DE CV',
        rfc:             'ECE010101ABC',
        regimen_fiscal:  '601 - General de Ley Personas Morales',
        codigo_postal:   '44100',
        calle:           'Av. Ejemplo',
        numero_ext:      '123',
        colonia:         'Centro',
        ciudad:          'Guadalajara',
        estado:          'Jalisco',
        telefono:        '33-1234-5678',
        email:           'contacto@cliente.com',
        contacto_nombre: 'Juan Pérez González',
      },
      proyecto: {
        nombre:      'Proyecto Ejemplo',
        clave:       'PRY-2026-001',
        fecha_inicio: '2026-01-01',
        fecha_fin:    '2026-12-31',
        estatus:      'Activo',
      },
      empleado: {
        nombre_completo: 'María García López',
        puesto:          'Coordinadora de Proyectos',
        rfc:             'GALM850101XYZ',
      },
      doc: {
        folio:            'PREV-001',
        serie:            'A',
        fecha_emision:    new Date().toISOString(),
        fecha_vencimiento:new Date(Date.now() + 30*86400000).toISOString(),
        condiciones_pago: 'Neto 30 días',
        moneda:           'MXN',
        subtotal:         10000,
        iva:              1600,
        total:            11600,
        notas:            'Esta es una vista previa del formato configurado.',
        uuid_cfdi:        'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
        metodo_pago:      'PPD',
        forma_pago:       '99 - Por definir',
        uso_cfdi:         'G03 - Gastos en general',
      },
      conceptos: [
        { cantidad: 1, codigo: 'SERV001', descripcion: 'Servicio de construcción ejemplo', unidad_medida: 'Servicio', precio_unitario: 5000, importe: 5000 },
        { cantidad: 2, codigo: 'MAT001',  descripcion: 'Material de construcción ejemplo', unidad_medida: 'Pieza',    precio_unitario: 2500, importe: 5000 },
      ],
      fileName: `VISTA_PREVIA_${formatoActivo.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`,
    })
  }

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const formatoInfo = FORMATOS_DISPONIBLES.find(f => f.id === formatoActivo)

  return (
    <div style={{ display: 'flex', gap: '20px', minHeight: '600px' }}>

      {/* ── Panel izquierdo: selector de formatos ── */}
      <div style={{ width: '200px', flexShrink: 0 }}>
        <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
          Formatos
        </p>
        {FORMATOS_DISPONIBLES.map(formato => {
          const activo = formatoActivo === formato.id
          return (
            <button
              key={formato.id}
              onClick={() => { setFormatoActivo(formato.id); setGuardadoOk(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px', marginBottom: '4px', borderRadius: '10px',
                border: activo ? '1.5px solid #bfdbfe' : '1.5px solid transparent',
                backgroundColor: activo ? '#eff6ff' : 'transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.backgroundColor = '#f9fafb' }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <span style={{ fontSize: '18px' }}>{formato.emoji}</span>
              <div>
                <p style={{ fontSize: '12px', fontWeight: activo ? '700' : '500', color: activo ? '#1d4ed8' : '#374151', margin: 0 }}>
                  {formato.nombre}
                </p>
                {formato.variantes?.length > 0 && (
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: '1px 0 0' }}>
                    {formato.variantes.length} variante{formato.variantes.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Panel derecho: editor del formato activo ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header del formato */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 2px' }}>
              {formatoInfo?.emoji} {formatoInfo?.nombre}
            </h3>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
              {formatoInfo?.descripcion}
            </p>
            {formatoInfo?.variantes?.length > 0 && (
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                Variantes: {formatoInfo.variantes.join(' · ')}
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleRestaurar}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              <RefreshCw size={13} /> Restaurar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: guardadoOk ? '#059669' : guardando ? '#93c5fd' : '#2563eb',
                color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer',
                fontSize: '12px', fontWeight: '700', transition: 'background-color 0.2s',
              }}>
              {guardadoOk
                ? <><CheckCircle2 size={13} /> Guardado</>
                : guardando
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                : <><Save size={13} /> Guardar</>
              }
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={14} color="#dc2626" />
            <p style={{ fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Info: objetos disponibles */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {formatoInfo?.objetos.map(obj => (
            <span key={obj} style={{ padding: '3px 10px', borderRadius: '20px', backgroundColor: '#f3f4f6', color: '#374151', fontSize: '11px', fontWeight: '600', border: '1px solid #e5e7eb' }}>
              {obj}
            </span>
          ))}
        </div>

        {/* Editor */}
        {formatoInfo && (
          <EditorFormato
            formato={formatoInfo}
            config={configs[formatoActivo]}
            onChange={cfg => handleChange(formatoActivo, cfg)}
            empresa={empresa}
            onPreview={handlePreview}
            guardando={guardando}
          />
        )}
      </div>
    </div>
  )
}
