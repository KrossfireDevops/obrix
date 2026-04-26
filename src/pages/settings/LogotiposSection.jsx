// src/pages/settings/LogotiposSection.jsx
// v1.0 — Abril 2026
// Sección de carga de logotipos para CompanySettings.
// Maneja 3 logos: Sistema, Documentos y Alternativo.
// Cada logo tiene: upload drag&drop, preview inline,
// especificaciones técnicas y botón de eliminar.

import { useState, useRef } from 'react'
import { supabase } from '../../config/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  Upload, Trash2, CheckCircle2, AlertTriangle,
  Monitor, FileText, Star, RefreshCw,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Configuración de cada tipo de logo
// ─────────────────────────────────────────────────────────────
const LOGOS_CONFIG = [
  {
    id:          'logo_url',
    key:         'sistema',
    nombre:      'Logo Sistema',
    icon:        Monitor,
    color:       '#2563eb',
    colorBg:     '#eff6ff',
    descripcion: 'Aparece en el Login y en el Sidebar del sistema, reemplazando el logo de OBRIX.',
    specs: [
      'Formato: PNG con fondo transparente',
      'Dimensiones recomendadas: 600 × 200 px',
      'Peso máximo: 200 KB',
      'Relación de aspecto: 3:1 (horizontal)',
    ],
  },
  {
    id:          'logo_documentos_url',
    key:         'documentos',
    nombre:      'Logo Documentos',
    icon:        FileText,
    color:       '#059669',
    colorBg:     '#f0fdf4',
    descripcion: 'Aparece en el encabezado de todos los PDFs generados (facturas, cotizaciones, OC, etc.).',
    specs: [
      'Formato: PNG o JPG',
      'Dimensiones recomendadas: 400 × 150 px',
      'Peso máximo: 100 KB',
      'Fondo transparente o blanco recomendado',
    ],
  },
  {
    id:          'logo_alternativo_url',
    key:         'alternativo',
    nombre:      'Logo Alternativo',
    icon:        Star,
    color:       '#7c3aed',
    colorBg:     '#f5f3ff',
    descripcion: 'Logo especial para formatos específicos: RRHH, campañas, subsidiarias o documentos especiales.',
    specs: [
      'Formato: PNG o JPG',
      'Dimensiones recomendadas: 400 × 150 px',
      'Peso máximo: 100 KB',
      'Puede ser logo de departamento o campaña',
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Componente individual de un logo
// ─────────────────────────────────────────────────────────────
const LogoUploader = ({ config, urlActual, companyId, onGuardado }) => {
  const [preview,    setPreview]    = useState(urlActual || null)
  const [uploading,  setUploading]  = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error,      setError]      = useState(null)
  const [exito,      setExito]      = useState(false)
  const [dragOver,   setDragOver]   = useState(false)
  const inputRef = useRef(null)
  const Icon = config.icon

  const procesarArchivo = async (file) => {
    if (!file) return
    setError(null)
    setExito(false)

    // Validar tipo
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setError('Formato no válido. Usa PNG, JPG, WEBP o SVG.')
      return
    }

    // Validar tamaño
    const maxKB = config.key === 'sistema' ? 200 : 100
    if (file.size > maxKB * 1024) {
      setError(`El archivo es muy pesado. Máximo ${maxKB} KB.`)
      return
    }

    // Preview inmediato antes de subir
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(file)

    // Subir a Supabase Storage
    setUploading(true)
    try {
      const ext      = file.name.split('.').pop()
      const path     = `${companyId}/${config.key}.${ext}`

      // Eliminar versión anterior si existe
      await supabase.storage.from('logos-empresa').remove([path])

      const { error: uploadError } = await supabase.storage
        .from('logos-empresa')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('logos-empresa')
        .getPublicUrl(path)

      // Guardar URL en company_settings
      const { error: dbError } = await supabase
        .from('company_settings')
        .update({ [config.id]: publicUrl })
        .eq('company_id', companyId)

      if (dbError) throw dbError

      setPreview(publicUrl)
      setExito(true)
      setTimeout(() => setExito(false), 3000)
      onGuardado(config.id, publicUrl)
    } catch (e) {
      setError('Error al subir: ' + e.message)
      setPreview(urlActual || null)
    } finally {
      setUploading(false)
    }
  }

  const handleEliminar = async () => {
    setEliminando(true)
    setError(null)
    try {
      // Eliminar de Storage (intentar ambas extensiones comunes)
      await supabase.storage.from('logos-empresa').remove([
        `${companyId}/${config.key}.png`,
        `${companyId}/${config.key}.jpg`,
        `${companyId}/${config.key}.jpeg`,
        `${companyId}/${config.key}.webp`,
        `${companyId}/${config.key}.svg`,
      ])

      // Limpiar URL en BD
      await supabase
        .from('company_settings')
        .update({ [config.id]: null })
        .eq('company_id', companyId)

      setPreview(null)
      onGuardado(config.id, null)
    } catch (e) {
      setError('Error al eliminar: ' + e.message)
    } finally {
      setEliminando(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: '14px',
      overflow: 'hidden', marginBottom: '16px',
    }}>
      {/* Header del logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 18px', backgroundColor: config.colorBg,
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px',
          backgroundColor: `${config.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={17} color={config.color} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#111827', margin: 0 }}>
            {config.nombre}
          </p>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
            {config.descripcion}
          </p>
        </div>
        {/* Badge estado */}
        {preview && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
            backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
          }}>
            <CheckCircle2 size={11} color="#16a34a" /> Cargado
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>

          {/* Área de upload */}
          <div>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '8px', padding: '24px 16px',
                borderRadius: '10px', cursor: uploading ? 'not-allowed' : 'pointer',
                border: dragOver
                  ? `2px solid ${config.color}`
                  : preview ? '2px solid #16a34a' : '2px dashed #d1d5db',
                backgroundColor: dragOver
                  ? `${config.color}08`
                  : preview ? '#f0fdf4' : '#fafafa',
                transition: 'all 0.2s',
                minHeight: '110px',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={e => procesarArchivo(e.target.files[0])}
                disabled={uploading}
              />
              {uploading ? (
                <>
                  <RefreshCw size={22} color={config.color} style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: '12px', color: config.color, fontWeight: '600', margin: 0 }}>Subiendo...</p>
                </>
              ) : (
                <>
                  <Upload size={22} color={preview ? '#16a34a' : '#9ca3af'} />
                  <p style={{ fontSize: '12px', color: preview ? '#15803d' : '#6b7280', fontWeight: '600', margin: 0, textAlign: 'center' }}>
                    {preview ? 'Clic o arrastra para cambiar' : 'Clic o arrastra para subir'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>PNG · JPG · WEBP · SVG</p>
                </>
              )}
            </div>

            {/* Especificaciones técnicas */}
            <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                Especificaciones recomendadas
              </p>
              {config.specs.map((spec, i) => (
                <p key={i} style={{ fontSize: '11px', color: '#64748b', margin: '2px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: '#94a3b8', flexShrink: 0 }}>·</span>{spec}
                </p>
              ))}
            </div>
          </div>

          {/* Preview inline */}
          {preview && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                Vista previa
              </p>
              <div style={{
                backgroundColor: config.key === 'sistema' ? '#1e40af' : '#ffffff',
                borderRadius: '10px', padding: '16px',
                border: '1px solid #e5e7eb', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                minHeight: '90px',
              }}>
                <img
                  src={preview}
                  alt={config.nombre}
                  style={{
                    maxWidth: '100%', maxHeight: '80px',
                    objectFit: 'contain', display: 'block',
                  }}
                  onError={() => setPreview(null)}
                />
              </div>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: '6px 0 0', textAlign: 'center' }}>
                {config.key === 'sistema'
                  ? 'Se verá sobre fondo azul en el Sidebar'
                  : 'Se verá sobre fondo blanco en los documentos'}
              </p>

              {/* Botón eliminar */}
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', width: '100%', marginTop: '10px',
                  padding: '8px', borderRadius: '8px',
                  border: '1px solid #fca5a5', backgroundColor: '#fef2f2',
                  color: '#dc2626', cursor: eliminando ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: '600',
                  opacity: eliminando ? 0.6 : 1,
                }}
              >
                <Trash2 size={13} />
                {eliminando ? 'Eliminando...' : 'Eliminar logo'}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', padding: '9px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
            <AlertTriangle size={13} color="#dc2626" />
            <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Éxito */}
        {exito && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', padding: '9px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <CheckCircle2 size={13} color="#16a34a" />
            <p style={{ fontSize: '12px', color: '#15803d', margin: 0, fontWeight: '600' }}>
              ✅ Logo guardado — se aplicará al recargar la página
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL exportable
// ─────────────────────────────────────────────────────────────
export default function LogotiposSection() {
  const { userProfile, empresaConfig, refrescarEmpresaConfig } = useAuth()
  const companyId = userProfile?.company_id

  // Estado local de URLs para actualizar UI sin recargar
  const [urls, setUrls] = useState({
    logo_url:               empresaConfig?.logo_url               || null,
    logo_documentos_url:    empresaConfig?.logo_documentos_url    || null,
    logo_alternativo_url:   empresaConfig?.logo_alternativo_url   || null,
  })

  const handleGuardado = async (campo, url) => {
    setUrls(prev => ({ ...prev, [campo]: url }))
    // Refrescar el contexto para que Login y Sidebar
    // reflejen el nuevo logo inmediatamente
    await refrescarEmpresaConfig()
  }

  if (!companyId) return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
      No se pudo determinar la empresa. Recarga la página.
    </div>
  )

  return (
    <div>
      {/* Aviso informativo */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
      }}>
        <Monitor size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#1d4ed8', margin: '0 0 3px' }}>
            Personalización de identidad visual
          </p>
          <p style={{ fontSize: '12px', color: '#3b82f6', margin: 0, lineHeight: '1.5' }}>
            Los logos se aplican automáticamente al guardar. El <strong>Logo Sistema</strong> reemplaza
            el logo de OBRIX en Login y Sidebar. El <strong>Logo Documentos</strong> aparece en todos
            los PDFs. El <strong>Logo Alternativo</strong> está disponible para formatos específicos.
          </p>
        </div>
      </div>

      {/* Los 3 uploaders */}
      {LOGOS_CONFIG.map(config => (
        <LogoUploader
          key={config.id}
          config={config}
          urlActual={urls[config.id]}
          companyId={companyId}
          onGuardado={handleGuardado}
        />
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
