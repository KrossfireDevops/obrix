// src/components/fiscal/DocumentUploadValidator.jsx
// Componente reutilizable de carga + validación automática de documentos fiscales
// Al soltar un PDF, llama al parser y muestra resultado inline
// Uso:
//   <DocumentUploadValidator
//     tipoDocumento="CSF"
//     rfcEsperado="XAXX010101000"
//     onValidado={(datos) => setForm(f => ({ ...f, ...datos }))}
//     onArchivo={(file) => setArchivos(a => ({ ...a, csf: file }))}
//   />

import { useState, useRef } from 'react'
import {
  parsearDocumento,
  getSemaforoParsing,
  getEtiquetasCampos,
  getCamposCriticos,
} from '../../services/documentParser.service'
import {
  Upload, CheckCircle, XCircle, AlertTriangle,
  FileText, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react'

// ── Config por tipo de documento ──────────────────────────────────────────────
const DOCUMENTO_CONFIG = {
  CSF: {
    label:      'Constancia de Situación Fiscal (CSF)',
    hint:       'PDF descargado del portal del SAT',
    icon:       '📄',
    accept:     '.pdf',
    scoreLabel: '+15 pts — Antigüedad RFC',
  },
  '32D': {
    label:      'Opinión de Cumplimiento 32-D',
    hint:       'PDF del SAT — vigencia máx. 30 días',
    icon:       '✅',
    accept:     '.pdf',
    scoreLabel: '+25 pts — Opinión positiva',
  },
  CSD: {
    label:      'Certificado de Sello Digital (CSD)',
    hint:       'Acuse de activación PDF o archivo .cer',
    icon:       '🔐',
    accept:     '.pdf,.cer',
    scoreLabel: '+10 pts — CSD vigente',
  },
  ESTADO_CUENTA: {
    label:      'Estado de Cuenta Bancario',
    hint:       'Carátula con CLABE y titular — máx. 3 meses',
    icon:       '🏦',
    accept:     '.pdf',
    scoreLabel: '+5 pts — CLABE verificada',
  },
}

// ── Estado del componente ─────────────────────────────────────────────────────
// idle       → sin archivo
// uploading  → procesando
// valid      → documento correcto
// warning    → correcto pero con advertencias
// error      → documento incorrecto o no reconocido

export const DocumentUploadValidator = ({
  tipoDocumento,    // 'CSF' | '32D' | 'CSD' | 'ESTADO_CUENTA'
  rfcEsperado,      // RFC del tercero para validación cruzada
  onValidado,       // callback (datosExtraidos) → actualiza form padre
  onArchivo,        // callback (file) → guarda archivo en padre
  disabled = false,
}) => {
  const inputRef = useRef()
  const config   = DOCUMENTO_CONFIG[tipoDocumento]

  const [estado,        setEstado]        = useState('idle')
  const [archivo,       setArchivo]       = useState(null)
  const [resultado,     setResultado]     = useState(null)
  const [mostrarDetalle,setMostrarDetalle]= useState(false)
  const [dragging,      setDragging]      = useState(false)

  // ── Procesar archivo ────────────────────────────────────────────────────────
  const procesarArchivo = async (file) => {
    if (!file) return

    setArchivo(file)
    setEstado('uploading')
    setResultado(null)
    setMostrarDetalle(false)
    onArchivo?.(file)

    const { success, resultado: res, error } = await parsearDocumento(
      file, tipoDocumento, rfcEsperado
    )

    if (!success) {
      setEstado('error')
      setResultado({ errores: [error], advertencias: [], datos_extraidos: {}, confianza: 0, es_documento_correcto: false })
      return
    }

    setResultado(res)

    // Determinar estado visual
    if (!res.es_documento_correcto || res.errores.length > 0) {
      setEstado('error')
    } else if (res.advertencias.length > 0) {
      setEstado('warning')
    } else {
      setEstado('valid')
    }

    // Notificar datos extraídos al padre si el documento es correcto
    if (res.es_documento_correcto) {
      onValidado?.(res.datos_extraidos)
    }
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true)  }
  const handleDragLeave= ()    => setDragging(false)

  // ── Limpiar ─────────────────────────────────────────────────────────────────
  const limpiar = (e) => {
    e.stopPropagation()
    setArchivo(null)
    setEstado('idle')
    setResultado(null)
    setMostrarDetalle(false)
    onArchivo?.(null)
    onValidado?.({})
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Colores por estado ──────────────────────────────────────────────────────
  const colorPorEstado = {
    idle:      { border: '#D1D5DB', bg: '#F9FAFB',   text: '#6B7280' },
    uploading: { border: '#93C5FD', bg: '#EFF6FF',   text: '#1E40AF' },
    valid:     { border: '#6EE7B7', bg: '#F0FDF4',   text: '#065F46' },
    warning:   { border: '#FDE68A', bg: '#FFFBEB',   text: '#B45309' },
    error:     { border: '#FECACA', bg: '#FEF2F2',   text: '#DC2626' },
  }
  const c = colorPorEstado[estado]

  const semaforo = resultado
    ? getSemaforoParsing(resultado.confianza, resultado.es_documento_correcto)
    : null

  const etiquetas  = getEtiquetasCampos(tipoDocumento)
  const criticos   = getCamposCriticos(tipoDocumento)

  return (
    <div style={{ marginBottom: '4px' }}>

      {/* ── Label ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
          {config.icon} {config.label}
        </label>
        {config.scoreLabel && estado !== 'error' && (
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600',
            backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '9999px' }}>
            {config.scoreLabel}
          </span>
        )}
      </div>

      {/* ── Zona de drop ── */}
      <div
        onClick={() => !disabled && estado !== 'uploading' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${dragging ? '#1E40AF' : c.border}`,
          borderRadius: '12px',
          backgroundColor: dragging ? '#EFF6FF' : c.bg,
          padding: '16px',
          cursor: disabled || estado === 'uploading' ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        <input
          ref={inputRef} type="file" accept={config.accept}
          style={{ display: 'none' }}
          onChange={e => e.target.files[0] && procesarArchivo(e.target.files[0])}
        />

        {/* ── Estado: idle ── */}
        {estado === 'idle' && (
          <div style={{ textAlign: 'center' }}>
            <Upload size={22} style={{ margin: '0 auto 6px', color: '#9CA3AF', display: 'block' }} />
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 2px', fontWeight: '500' }}>
              Arrastra el PDF aquí o haz clic
            </p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{config.hint}</p>
          </div>
        )}

        {/* ── Estado: uploading ── */}
        {estado === 'uploading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <RefreshCw size={18} color="#1E40AF"
              style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', color: '#1E40AF', fontWeight: '600', margin: 0 }}>
                Validando documento...
              </p>
              <p style={{ fontSize: '11px', color: '#60A5FA', margin: 0 }}>{archivo?.name}</p>
            </div>
          </div>
        )}

        {/* ── Estado: valid / warning / error ── */}
        {['valid', 'warning', 'error'].includes(estado) && resultado && (
          <div>
            {/* Fila principal: icono + nombre + botón limpiar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                {estado === 'valid'   && <CheckCircle  size={20} color="#059669" style={{ flexShrink: 0 }} />}
                {estado === 'warning' && <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0 }} />}
                {estado === 'error'   && <XCircle      size={20} color="#DC2626" style={{ flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: c.text, margin: '0 0 2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {semaforo?.label}
                  </p>
                  <p style={{ fontSize: '11px', color: '#6B7280', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {archivo?.name} · Confianza: {resultado.confianza}%
                  </p>
                </div>
              </div>
              <button
                onClick={limpiar}
                style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
                  borderRadius: '6px', border: '1px solid #E5E7EB', backgroundColor: '#fff',
                  color: '#6B7280', marginLeft: '8px' }}>
                Cambiar
              </button>
            </div>

            {/* Campos extraídos — resumen rápido de críticos */}
            {estado !== 'error' && (
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {criticos.map(campo => {
                  const val = resultado.datos_extraidos[campo]
                  if (!val) return null
                  return (
                    <span key={campo} style={{
                      fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                      backgroundColor: '#fff', border: '1px solid #E5E7EB', color: '#374151',
                    }}>
                      <span style={{ color: '#9CA3AF' }}>{etiquetas[campo] ?? campo}: </span>
                      <strong>{val}</strong>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Errores */}
            {resultado.errores.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {resultado.errores.map((err, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start',
                    backgroundColor: '#FEF2F2', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px' }}>
                    <XCircle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '12px', color: '#991B1B' }}>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Advertencias */}
            {resultado.advertencias.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                {resultado.advertencias.map((adv, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start',
                    backgroundColor: '#FFFBEB', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px' }}>
                    <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '12px', color: '#92400E' }}>{adv}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Toggle detalle completo */}
            {Object.keys(resultado.datos_extraidos).length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setMostrarDetalle(d => !d) }}
                style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: '#6B7280', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0 }}>
                {mostrarDetalle ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {mostrarDetalle ? 'Ocultar detalle' : 'Ver todos los campos extraídos'}
              </button>
            )}

            {/* Detalle completo */}
            {mostrarDetalle && (
              <div style={{ marginTop: '8px', backgroundColor: '#fff', borderRadius: '8px',
                border: '1px solid #E5E7EB', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>
                {Object.entries(resultado.datos_extraidos).map(([campo, valor], i) => {
                  if (!valor) return null
                  const esVacio = valor === null || valor === ''
                  return (
                    <div key={campo} style={{
                      display: 'flex', padding: '7px 12px',
                      backgroundColor: i % 2 === 0 ? '#F9FAFB' : '#fff',
                      borderBottom: '1px solid #F3F4F6',
                    }}>
                      <span style={{ fontSize: '11px', color: '#9CA3AF', width: '140px', flexShrink: 0 }}>
                        {etiquetas[campo] ?? campo}
                      </span>
                      <span style={{ fontSize: '12px', color: esVacio ? '#D1D5DB' : '#111827',
                        fontWeight: criticos.includes(campo) ? '600' : '400' }}>
                        {valor ?? '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animación spin */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}