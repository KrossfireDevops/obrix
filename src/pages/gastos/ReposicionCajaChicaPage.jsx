// ============================================================
//  OBRIX ERP — Reposición de Caja Chica
//  src/pages/gastos/ReposicionCajaChicaPage.jsx  |  v1.0
//
//  Vista empleado:
//    · Checklist de 3 condiciones
//    · Solicitar reposición
//    · Firmar recibo con PIN
//    · Configurar PIN (primera vez)
//
//  Vista Admin/Autorizador:
//    · Bandeja de solicitudes pendientes
//    · Autorizar + ingresar referencia bancaria
//    · Ver recibos firmados
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { MainLayout }  from '../../components/layout/MainLayout'
import { useToast }    from '../../hooks/useToast'
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  RefreshCw, Lock, FileText, Download,
  Eye, ChevronDown, ChevronRight, Shield,
} from 'lucide-react'
import { supabase } from '../../config/supabase'
import { fmtMXN }   from '../../services/gastos.service'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmtFecha = (f) => {
  if (!f) return '—'
  const d = new Date(f)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** SHA-256 del PIN en el navegador — sin librerías externas */
async function sha256(text) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

const inp = {
  width: '100%', padding: '9px 11px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 9,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}

// ─────────────────────────────────────────────────────────────
// ÍCONO DE CONDICIÓN
// ─────────────────────────────────────────────────────────────
const IconCond = ({ ok }) => ok
  ? <CheckCircle size={16} color="#10B981" style={{ flexShrink: 0 }} />
  : <XCircle     size={16} color="#EF4444" style={{ flexShrink: 0 }} />

// ─────────────────────────────────────────────────────────────
// MODAL: CONFIGURAR PIN
// ─────────────────────────────────────────────────────────────
const ModalConfigurarPIN = ({ userId, onSuccess, onClose }) => {
  const [pin,    setPin]    = useState('')
  const [pin2,   setPin2]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const validarPin = (p) => /^[a-zA-Z0-9]{4,6}$/.test(p)

  const handleGuardar = async () => {
    setError(null)
    if (!validarPin(pin))       { setError('El PIN debe tener entre 4 y 6 caracteres alfanuméricos'); return }
    if (pin !== pin2)           { setError('Los PINs no coinciden'); return }
    setSaving(true)
    try {
      const hash = await sha256(pin.toUpperCase())
      const { error: e } = await supabase
        .from('users_profiles')
        .update({
          pin_caja_chica_hash:   hash,
          pin_caja_chica_set_at: new Date().toISOString(),
        })
        .eq('id', userId)
      if (e) throw e
      onSuccess()
    } catch (e) {
      setError('Error al guardar el PIN: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%',
        maxWidth: 400, padding: 26, boxShadow: '0 24px 48px rgba(0,0,0,0.15)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color="#2563EB" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Configurar PIN de caja chica</h3>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
          Este PIN se usará para firmar digitalmente los recibos de reposición. 
          Es tu constancia legal de haber recibido el dinero. Guárdalo en un lugar seguro.
        </p>

        {error && (
          <div style={{ display: 'flex', gap: 7, padding: '9px 11px', backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 9, marginBottom: 14, fontSize: 12, color: '#DC2626' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            PIN (4–6 caracteres alfanuméricos)
          </label>
          <input type="password" maxLength={6} style={{ ...inp, fontFamily: 'monospace',
            fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }}
            placeholder="••••••"
            value={pin}
            onChange={e => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            Ejemplo: A1B2C3 · Solo letras y números
          </p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Confirmar PIN
          </label>
          <input type="password" maxLength={6} style={{ ...inp, fontFamily: 'monospace',
            fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }}
            placeholder="••••••"
            value={pin2}
            onChange={e => setPin2(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB',
              backgroundColor: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 22px', borderRadius: 9, border: 'none',
              backgroundColor: saving ? '#93C5FD' : '#2563EB',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            <Lock size={13} /> Guardar PIN
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MODAL: FIRMAR RECIBO CON PIN
// ─────────────────────────────────────────────────────────────
const ModalFirmarRecibo = ({ reposicion, recibo, userId, onSuccess, onClose, toast }) => {
  const [pin,        setPin]        = useState('')
  const [signing,    setSigning]    = useState(false)
  const [error,      setError]      = useState(null)
  const [generando,  setGenerando]  = useState(false)

  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']
  const fecha  = new Date()
  const dia    = fecha.getDate()
  const mes    = meses[fecha.getMonth()]
  const anio   = fecha.getFullYear()

  const generarYSubirPDF = async () => {
    setGenerando(true)
    try {
      // Cargar jsPDF dinámicamente
      const script = document.createElement('script')
      script.src   = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      document.head.appendChild(script)

      await new Promise((res, rej) => {
        script.onload = res; script.onerror = rej
      })

      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

      // ── Encabezado ──
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(recibo.razon_social || recibo.empresa_nombre || 'EMPRESA', 105, 18, { align: 'center' })
      if (recibo.rfc_empresa) {
        doc.text('RFC: ' + recibo.rfc_empresa, 105, 23, { align: 'center' })
      }

      doc.setFontSize(13)
      doc.setTextColor(0)
      doc.setFont(undefined, 'bold')
      doc.text('RECIBO DE CAJA CHICA — REPOSICIÓN DE FONDO', 105, 33, { align: 'center' })

      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(100)
      doc.text('Folio: ' + reposicion.folio, 105, 39, { align: 'center' })

      // Línea separadora
      doc.setDrawColor(200)
      doc.line(20, 42, 190, 42)

      // ── Cuerpo del recibo ──
      doc.setFontSize(11)
      doc.setTextColor(30)
      const lineH = 7

      const cuerpo = [
        '',
        `Yo, ${recibo.nombre_empleado},`,
        `en mi carácter de ${recibo.puesto_empleado},`,
        '',
        `manifiesto haber recibido la cantidad de  $${parseFloat(reposicion.monto_reposicion).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        `(${recibo.monto_letra}),`,
        '',
        `el día ${dia} del mes de ${mes} del año ${anio},`,
        '',
        'por concepto de reposición de caja chica a mi resguardo y responsabilidad,',
        `para cubrir gastos operativos relacionados con el proyecto:`,
        `"${recibo.proyecto_nombre || 'General'}".`,
        '',
        'Me comprometo a aplicar los recursos únicamente en gastos autorizados y a',
        'presentar los comprobantes correspondientes en cada reposición posterior.',
      ]

      let y = 52
      cuerpo.forEach(line => {
        if (line === '') { y += 3; return }
        doc.text(line, 20, y)
        y += lineH
      })

      // ── Sección de firmas ──
      y += 10
      doc.setDrawColor(200)
      doc.line(20, y, 190, y)
      y += 8

      doc.setFontSize(9)
      doc.setTextColor(80)

      // Tres columnas de firma
      const col1 = 35, col2 = 105, col3 = 172
      const yFirma = y + 18

      doc.line(col1 - 25, yFirma, col1 + 25, yFirma)
      doc.text('Firma del responsable', col1, yFirma + 5, { align: 'center' })
      doc.text(recibo.nombre_empleado, col1, yFirma + 10, { align: 'center' })
      doc.text(recibo.puesto_empleado, col1, yFirma + 14, { align: 'center' })

      doc.line(col2 - 25, yFirma, col2 + 25, yFirma)
      doc.text('Firma digital OBRIX', col2, yFirma + 5, { align: 'center' })
      doc.text('PIN registrado en sistema', col2, yFirma + 10, { align: 'center' })
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text('user_id: ' + userId.slice(0,8) + '...', col2, yFirma + 14, { align: 'center' })
      doc.text(new Date().toISOString(), col2, yFirma + 18, { align: 'center' })

      doc.setFontSize(9)
      doc.setTextColor(80)
      doc.line(col3 - 25, yFirma, col3 + 25, yFirma)
      doc.text('Autorizado por', col3, yFirma + 5, { align: 'center' })
      doc.text('Admin Empresa', col3, yFirma + 10, { align: 'center' })
      doc.text('OBRIX ERP', col3, yFirma + 14, { align: 'center' })

      // ── Footer ──
      const yFooter = 260
      doc.setFontSize(8)
      doc.setTextColor(160)
      doc.text('Documento generado digitalmente por OBRIX ERP — ' + new Date().toLocaleString('es-MX'),
        105, yFooter, { align: 'center' })
      doc.text('Este documento tiene validez como comprobante interno de recepción de fondos.',
        105, yFooter + 5, { align: 'center' })

      // Guardar PDF en Storage
      const pdfBytes = doc.output('arraybuffer')
      const fileName = `recibos/${reposicion.folio}-${Date.now()}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gastos-comprobantes')
        .upload(fileName, pdfBytes, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadError) throw uploadError
      return fileName

    } finally {
      setGenerando(false)
    }
  }

  const handleFirmar = async () => {
    setError(null)
    if (!pin || pin.length < 4) { setError('Ingresa tu PIN (mínimo 4 caracteres)'); return }
    setSigning(true)

    try {
      const pinHash = await sha256(pin.toUpperCase())

      // Generar y subir PDF primero
      let pdfPath = null
      try {
        pdfPath = await generarYSubirPDF()
      } catch (pdfErr) {
        console.warn('PDF no se pudo generar, continuando sin él:', pdfErr)
      }

      // Obtener IP del cliente (best effort)
      let ip = null
      try {
        const r = await fetch('https://api.ipify.org?format=json')
        const d = await r.json()
        ip = d.ip
      } catch { /* sin IP */ }

      const { data, error: e } = await supabase.rpc('firmar_recibo_reposicion', {
        p_recibo_id:  recibo.id,
        p_usuario_id: userId,
        p_pin_hash:   pinHash,
        p_ip:         ip,
        p_pdf_path:   pdfPath,
      })

      if (e) throw new Error(e.message)
      if (!data?.ok) throw new Error(data?.error || 'Error al firmar')

      toast.success('Recibo firmado correctamente ✓ — Caja chica repuesta')
      onSuccess()
    } catch (e) {
      setError(e.message.includes('PIN incorrecto')
        ? 'PIN incorrecto. Verifica tu PIN de caja chica.'
        : e.message)
    } finally {
      setSigning(false)
    }
  }

  const meses2 = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre']

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%',
        maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F3F4F6',
          backgroundColor: '#FAFAFA', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} color="#2563EB" />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              Firmar recibo de reposición
            </h3>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace',
              color: '#9CA3AF', backgroundColor: '#F3F4F6',
              padding: '2px 7px', borderRadius: 5 }}>
              {reposicion.folio}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {/* Texto del recibo */}
          <div style={{ padding: '16px', backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 12, marginBottom: 18,
            fontSize: 12, color: '#374151', lineHeight: 1.9,
            fontFamily: 'Georgia, serif' }}>
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 13,
              color: '#111827', margin: '0 0 8px', textTransform: 'uppercase',
              letterSpacing: '0.03em' }}>
              Recibo de Caja Chica — Reposición de Fondo
            </p>
            <p style={{ textAlign: 'center', fontSize: 10, color: '#9CA3AF',
              margin: '0 0 14px', fontFamily: 'monospace' }}>
              {reposicion.folio}
            </p>
            <p style={{ margin: '0 0 6px' }}>
              Yo, <strong>{recibo.nombre_empleado}</strong>, en mi carácter de{' '}
              <strong>{recibo.puesto_empleado}</strong>, manifiesto haber recibido la cantidad de{' '}
              <strong style={{ color: '#1E40AF' }}>
                ${parseFloat(reposicion.monto_reposicion).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </strong>
            </p>
            <p style={{ margin: '0 0 6px', fontStyle: 'italic', color: '#4B5563' }}>
              ({recibo.monto_letra})
            </p>
            <p style={{ margin: '0 0 6px' }}>
              el día <strong>{dia}</strong> del mes de <strong>{mes}</strong> del año{' '}
              <strong>{anio}</strong>, por concepto de{' '}
              <strong>reposición de caja chica a mi resguardo y responsabilidad</strong>,
              para cubrir gastos operativos relacionados con el proyecto:{' '}
              <strong>"{recibo.proyecto_nombre || 'General'}"</strong>.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6B7280' }}>
              Me comprometo a aplicar los recursos únicamente en gastos autorizados
              y a presentar los comprobantes correspondientes en cada reposición.
            </p>
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 7, padding: '9px 11px',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 9, marginBottom: 14, fontSize: 12, color: '#DC2626' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {/* Campo PIN */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 5,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ingresa tu PIN para firmar digitalmente *
            </label>
            <input
              type="password"
              maxLength={6}
              autoComplete="off"
              style={{ ...inp, fontFamily: 'monospace', fontSize: 22,
                letterSpacing: '0.4em', textAlign: 'center',
                border: '2px solid #2563EB', borderRadius: 10 }}
              placeholder="••••••"
              value={pin}
              onChange={e => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
            />
            <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
              Al ingresar tu PIN confirmas haber leído y aceptado el contenido del recibo.
              Se registrará tu user_id, la hora exacta y tu dirección IP como evidencia.
            </p>
          </div>

          {generando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px',
              backgroundColor: '#EFF6FF', borderRadius: 9, marginBottom: 12,
              fontSize: 12, color: '#1E40AF' }}>
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
              Generando PDF del recibo…
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB',
                backgroundColor: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleFirmar}
              disabled={signing || generando || pin.length < 4}
              style={{ display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 22px', borderRadius: 9, border: 'none',
                backgroundColor: (signing || generando || pin.length < 4) ? '#A7F3D0' : '#10B981',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: (signing || generando || pin.length < 4) ? 'not-allowed' : 'pointer' }}>
              {(signing || generando)
                ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Shield size={13} />}
              Firmar y cerrar recibo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TARJETA DE SOLICITUD — Vista Admin
// ─────────────────────────────────────────────────────────────
const TarjetaSolicitud = ({ rep, onAutorizar, onRechazar, toast }) => {
  const [expandido,   setExpandido]   = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [referencia,  setReferencia]  = useState('')
  const [motivo,      setMotivo]      = useState('')
  const [procesando,  setProcesando]  = useState(false)
  const [accion,      setAccion]      = useState(null)  // 'aprobar' | 'rechazar'

  const condiciones = rep.condicion_detalle || {}

  const handleConfirmar = async () => {
    if (accion === 'aprobar' && !referencia.trim()) {
      toast.error('La referencia bancaria es obligatoria'); return
    }
    if (accion === 'rechazar' && !motivo.trim()) {
      toast.error('El motivo de rechazo es obligatorio'); return
    }
    setProcesando(true)
    try {
      if (accion === 'aprobar') await onAutorizar(rep.id, referencia)
      else                      await onRechazar(rep.id, motivo)
      setShowForm(false)
    } finally {
      setProcesando(false)
    }
  }

  const estColor = {
    solicitada:      { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
    autorizada:      { bg: '#F0FDF4', text: '#065F46', border: '#A7F3D0' },
    pendiente_firma: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
    firmada:         { bg: '#F0FDF4', text: '#065F46', border: '#A7F3D0' },
    rechazada:       { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  }[rep.estatus] || { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' }

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 13, overflow: 'hidden', marginBottom: 10 }}>

      {/* Header de la tarjeta */}
      <div style={{ padding: '13px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={() => setExpandido(!expandido)}>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
              {rep.caja_nombre}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9CA3AF',
              backgroundColor: '#F3F4F6', padding: '1px 6px', borderRadius: 4 }}>
              {rep.folio}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700,
              padding: '2px 9px', borderRadius: 9999,
              backgroundColor: estColor.bg, color: estColor.text,
              border: `1px solid ${estColor.border}` }}>
              {rep.estatus.replace('_', ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#6B7280' }}>
            <span>{rep.empleado_nombre}</span>
            <span style={{ color: '#D1D5DB' }}>·</span>
            <span>{fmtFecha(rep.created_at)}</span>
            {rep.proyecto_nombre && (
              <>
                <span style={{ color: '#D1D5DB' }}>·</span>
                <span style={{ color: '#6366F1', fontFamily: 'monospace', fontWeight: 600 }}>
                  {rep.proyecto_nombre}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 2px' }}>
            {fmtMXN(rep.monto_reposicion)}
          </p>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
            Fondo: {fmtMXN(rep.monto_fondo)}
          </p>
        </div>

        <ChevronDown size={14} color="#D1D5DB"
          style={{ transform: expandido ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </div>

      {/* Panel expandido */}
      {expandido && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F3F4F6',
          backgroundColor: '#FAFAFA' }}>

          {/* Checklist de condiciones */}
          <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, margin: '12px 0 8px',
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Verificación de condiciones
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {[
              { key: 'condicion_1', ok: rep.condicion_1_ok },
              { key: 'condicion_2', ok: rep.condicion_2_ok },
              { key: 'condicion_3', ok: rep.condicion_3_ok },
            ].map(c => {
              const det = condiciones[c.key] ?? {}
              return (
                <div key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 10px', borderRadius: 9,
                  backgroundColor: c.ok ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${c.ok ? '#A7F3D0' : '#FECACA'}` }}>
                  <IconCond ok={c.ok} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600,
                      color: c.ok ? '#065F46' : '#991B1B', margin: '0 0 1px' }}>
                      {det.titulo ?? c.key}
                    </p>
                    <p style={{ fontSize: 10, color: c.ok ? '#6B7280' : '#DC2626', margin: 0 }}>
                      {det.detalle}
                    </p>
                    {/* Gastos sin comprobante */}
                    {!c.ok && det.faltantes && Array.isArray(det.faltantes) && det.faltantes.map(f => (
                      <div key={f.id} style={{ marginTop: 4, fontSize: 10,
                        color: '#DC2626', display: 'flex', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace' }}>{f.folio}</span>
                        <span>{f.concepto}</span>
                        <span style={{ fontWeight: 600 }}>{fmtMXN(f.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Referencia bancaria si ya fue autorizada */}
          {rep.referencia_banco && (
            <div style={{ padding: '8px 10px', backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 9, marginBottom: 10,
              fontSize: 11, color: '#1E40AF' }}>
              <strong>Referencia bancaria:</strong> {rep.referencia_banco}
            </div>
          )}

          {/* Acciones del Admin */}
          {rep.estatus === 'solicitada' && (
            <>
              {!showForm ? (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={() => { setAccion('rechazar'); setShowForm(true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: '1px solid #FECACA', backgroundColor: '#FEF2F2',
                      color: '#DC2626', cursor: 'pointer' }}>
                    <XCircle size={13} /> Rechazar
                  </button>
                  <button onClick={() => { setAccion('aprobar'); setShowForm(true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: 'none', backgroundColor: '#10B981',
                      color: '#fff', cursor: 'pointer' }}>
                    <CheckCircle size={13} /> Autorizar reposición
                  </button>
                </div>
              ) : (
                <div style={{ padding: '12px', backgroundColor: '#fff',
                  border: `1px solid ${accion === 'aprobar' ? '#A7F3D0' : '#FECACA'}`,
                  borderRadius: 10, marginTop: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 8px',
                    color: accion === 'aprobar' ? '#065F46' : '#991B1B' }}>
                    {accion === 'aprobar'
                      ? `Autorizar ${fmtMXN(rep.monto_reposicion)} — ingresa la referencia bancaria`
                      : 'Rechazar solicitud — ingresa el motivo'}
                  </p>
                  <input type="text" style={{ ...inp, marginBottom: 10 }}
                    placeholder={accion === 'aprobar'
                      ? 'Número de operación / transferencia bancaria'
                      : 'Motivo del rechazo...'}
                    value={accion === 'aprobar' ? referencia : motivo}
                    onChange={e => accion === 'aprobar'
                      ? setReferencia(e.target.value) : setMotivo(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowForm(false)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
                        backgroundColor: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={handleConfirmar} disabled={procesando}
                      style={{ display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 18px', borderRadius: 8, border: 'none', fontSize: 12,
                        fontWeight: 600, cursor: 'pointer',
                        backgroundColor: accion === 'aprobar' ? '#10B981' : '#DC2626',
                        color: '#fff' }}>
                      {procesando && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Recibo firmado: botón para descargar PDF */}
          {rep.estatus === 'firmada' && rep.recibo_pdf_path && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={async () => {
                const { data } = await supabase.storage
                  .from('gastos-comprobantes')
                  .createSignedUrl(rep.recibo_pdf_path, 3600)
                if (data?.signedUrl) window.open(data.signedUrl, '_blank')
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF',
                color: '#1E40AF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={13} /> Descargar recibo firmado
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ReposicionCajaChicaPage() {
  const { toast }                           = useToast()
  const [user,         setUser]             = useState(null)
  const [perfil,       setPerfil]           = useState(null)
  const [tienePIN,     setTienePIN]         = useState(false)
  const [cajas,        setCajas]            = useState([])
  const [solicitudes,  setSolicitudes]      = useState([])
  const [loading,      setLoading]          = useState(true)
  const [showPIN,      setShowPIN]          = useState(false)
  const [reposSel,     setReposSel]         = useState(null)  // para firmar
  const [reciboSel,    setReciboSel]        = useState(null)
  const [verificando,  setVerificando]      = useState(null)  // id de caja
  const [condiciones,  setCondiciones]      = useState({})
  const [solicitando,  setSolicitando]      = useState(null)
  const [vistaAdmin,   setVistaAdmin]       = useState(false)

  // Cargar usuario y perfil
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase.from('users_profiles')
        .select('*, perfil:perfil_gasto_id(nombre, puede_aprobar, puede_configurar)')
        .eq('id', u.id).single()
        .then(({ data }) => {
          setUser({ ...u, profile: data })
          setPerfil(data?.perfil)
          setTienePIN(!!data?.pin_caja_chica_hash)
          setVistaAdmin(!!(data?.perfil?.puede_aprobar || data?.perfil?.puede_configurar))
        })
    })
  }, [])

  const cargar = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Cajas del empleado (para vista empleado)
      const { data: cajasData } = await supabase
        .from('cajas_chicas')
        .select('*, proyecto:project_id(code, name)')
        .eq('usuario_id', user.id)
        .eq('estatus', 'activa')

      setCajas(cajasData ?? [])

      // Solicitudes — para admin: todas; para empleado: las suyas
      const qSol = supabase.from('cajas_reposiciones')
        .select(`
          *,
          caja:caja_id(nombre, monto_fondo, pct_minimo_consumo),
          empleado:solicitante_id(full_name),
          proyecto:caja_id(project_id(name)),
          recibo:cajas_reposiciones_recibo(
            id, nombre_empleado, puesto_empleado, proyecto_nombre,
            monto_numero, monto_letra, rfc_empresa, razon_social,
            firmado_at, pdf_storage_path
          )
        `)
        .order('created_at', { ascending: false })

      const { data: solData } = vistaAdmin
        ? await qSol
        : await qSol.eq('solicitante_id', user.id)

      // Normalizar para la vista
      const normalized = (solData ?? []).map(s => ({
        ...s,
        caja_nombre:     s.caja?.nombre,
        monto_fondo:     s.caja?.monto_fondo,
        empleado_nombre: s.empleado?.full_name,
        proyecto_nombre: s.proyecto?.project_id?.name,
        recibo_pdf_path: s.recibo?.[0]?.pdf_storage_path,
        recibo_obj:      s.recibo?.[0],
      }))
      setSolicitudes(normalized)
    } catch (e) {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [user, vistaAdmin])

  useEffect(() => { cargar() }, [cargar])

  const verificarCaja = async (cajaId) => {
    setVerificando(cajaId)
    try {
      const { data, error } = await supabase.rpc('verificar_condiciones_reposicion', {
        p_caja_id: cajaId
      })
      if (error) throw error
      setCondiciones(prev => ({ ...prev, [cajaId]: data }))
    } catch (e) {
      toast.error('Error al verificar: ' + e.message)
    } finally {
      setVerificando(null)
    }
  }

  const solicitarReposicion = async (cajaId) => {
    setSolicitando(cajaId)
    try {
      const { data, error } = await supabase.rpc('crear_solicitud_reposicion', {
        p_caja_id:    cajaId,
        p_usuario_id: user.id,
        p_forzar:     false,
      })
      if (error) throw error
      if (!data.ok) throw new Error(data.error)
      toast.success(`Solicitud enviada — Folio: ${data.folio}`)
      cargar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSolicitando(null)
    }
  }

  const autorizarReposicion = async (repId, referencia) => {
    const { data, error } = await supabase.rpc('autorizar_reposicion', {
      p_reposicion_id:  repId,
      p_autorizador_id: user.id,
      p_referencia_banco: referencia,
    })
    if (error) throw error
    toast.success('Reposición autorizada — el empleado debe firmar el recibo ✓')
    cargar()
    return data
  }

  const rechazarReposicion = async (repId, motivo) => {
    const { error } = await supabase
      .from('cajas_reposiciones')
      .update({ estatus: 'rechazada', motivo_rechazo: motivo, updated_at: new Date().toISOString() })
      .eq('id', repId)
    if (error) throw error
    toast.success('Solicitud rechazada')
    cargar()
  }

  const pendienteFirma = solicitudes.find(
    s => s.estatus === 'pendiente_firma' && s.solicitante_id === user?.id
  )

  const kpis = {
    activas:    cajas.length,
    solicitadas: solicitudes.filter(s => s.estatus === 'solicitada').length,
    pendFirma:  solicitudes.filter(s => s.estatus === 'pendiente_firma').length,
    firmadas:   solicitudes.filter(s => s.estatus === 'firmada').length,
  }

  return (
    <MainLayout title="💵 Reposición de Caja Chica">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Alerta: recibo pendiente de firma ── */}
        {pendienteFirma && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', backgroundColor: '#EFF6FF',
            border: '2px solid #2563EB', borderRadius: 13 }}>
            <Shield size={20} color="#2563EB" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', margin: '0 0 2px' }}>
                Tienes un recibo pendiente de firma
              </p>
              <p style={{ fontSize: 12, color: '#3B82F6', margin: 0 }}>
                El folio <strong>{pendienteFirma.folio}</strong> por{' '}
                <strong>{fmtMXN(pendienteFirma.monto_reposicion)}</strong> fue autorizado.
                Debes firmarlo para recibir el dinero.
              </p>
            </div>
            <button
              onClick={() => {
                setReposSel(pendienteFirma)
                setReciboSel(pendienteFirma.recibo_obj)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 9, border: 'none',
                backgroundColor: '#2563EB', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Shield size={14} /> Firmar ahora
            </button>
          </div>
        )}

        {/* ── PIN no configurado ── */}
        {!tienePIN && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: 12 }}>
            <Lock size={16} color="#B45309" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#B45309', margin: 0, flex: 1 }}>
              No tienes un PIN de caja chica configurado. Lo necesitas para firmar recibos de reposición.
            </p>
            <button onClick={() => setShowPIN(true)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
                backgroundColor: '#F59E0B', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Configurar PIN
            </button>
          </div>
        )}

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Cajas activas',    value: kpis.activas,    color: '#1E40AF', bg: '#EFF6FF' },
            { label: 'Solicitudes',      value: kpis.solicitadas, color: '#B45309', bg: '#FFFBEB' },
            { label: 'Pendientes firma', value: kpis.pendFirma,  color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Reposiciones OK',  value: kpis.firmadas,   color: '#065F46', bg: '#F0FDF4' },
          ].map(k => (
            <div key={k.label} style={{ padding: '11px 14px', backgroundColor: k.bg,
              borderRadius: 12, border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 10, color: k.color, fontWeight: 600, margin: '0 0 3px', opacity: 0.8 }}>
                {k.label}
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: 0 }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Vista empleado: Mis cajas ── */}
        {!vistaAdmin && cajas.length > 0 && (
          <div>
            <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, margin: '0 0 10px',
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Mis cajas chicas
            </p>
            {cajas.map(caja => {
              const cond    = condiciones[caja.id]
              const pct     = ((caja.monto_disponible / caja.monto_fondo) * 100).toFixed(1)
              const colBar  = pct > 50 ? '#10B981' : pct > 20 ? '#F59E0B' : '#EF4444'
              const verif   = verificando === caja.id

              return (
                <div key={caja.id} style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
                  borderRadius: 13, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
                        {caja.nombre}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                        {caja.proyecto?.name ?? 'Sin proyecto específico'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 2px' }}>
                        {fmtMXN(caja.monto_disponible)}
                      </p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                        de {fmtMXN(caja.monto_fondo)}
                      </p>
                    </div>
                  </div>

                  {/* Barra de saldo */}
                  <div style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 9999,
                    overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', width: `${pct}%`,
                      backgroundColor: colBar, borderRadius: 9999, transition: 'width 0.4s' }} />
                  </div>

                  {/* Condiciones verificadas */}
                  {cond && (
                    <div style={{ marginBottom: 10 }}>
                      {[1,2,3].map(n => {
                        const c = cond[`condicion_${n}`]
                        return (
                          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 7,
                            padding: '5px 8px', borderRadius: 7, marginBottom: 4,
                            backgroundColor: c.ok ? '#F0FDF4' : '#FEF2F2' }}>
                            <IconCond ok={c.ok} />
                            <span style={{ fontSize: 11, color: c.ok ? '#065F46' : '#DC2626',
                              fontWeight: 500 }}>
                              {c.titulo}
                            </span>
                            {!c.ok && (
                              <span style={{ fontSize: 10, color: '#DC2626', marginLeft: 'auto' }}>
                                {c.detalle}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => verificarCaja(caja.id)} disabled={verif}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1,
                        padding: '8px 12px', borderRadius: 9, border: '1px solid #E5E7EB',
                        backgroundColor: '#F9FAFB', color: '#374151',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', justifyContent: 'center' }}>
                      {verif
                        ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        : <CheckCircle size={12} />}
                      Verificar condiciones
                    </button>

                    {cond?.puede_solicitar && (
                      <button onClick={() => solicitarReposicion(caja.id)}
                        disabled={solicitando === caja.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 2,
                          padding: '8px 12px', borderRadius: 9, border: 'none',
                          backgroundColor: '#10B981', color: '#fff',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', justifyContent: 'center' }}>
                        {solicitando === caja.id
                          ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <FileText size={12} />}
                        Solicitar reposición
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Historial de solicitudes ── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 40, gap: 10, color: '#9CA3AF' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Cargando…</span>
          </div>
        ) : solicitudes.length > 0 ? (
          <div>
            <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, margin: '0 0 10px',
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {vistaAdmin ? 'Todas las solicitudes' : 'Mis solicitudes'}
            </p>
            {solicitudes.map(s => (
              <TarjetaSolicitud key={s.id} rep={s}
                onAutorizar={autorizarReposicion}
                onRechazar={rechazarReposicion}
                toast={toast} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px',
            backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E5E7EB' }}>
            <FileText size={28} color="#D1D5DB" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
              Sin solicitudes de reposición
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              Cuando una caja chica necesite reposición aparecerá aquí
            </p>
          </div>
        )}
      </div>

      {/* Modales */}
      {showPIN && user && (
        <ModalConfigurarPIN
          userId={user.id}
          onSuccess={() => { setShowPIN(false); setTienePIN(true); toast.success('PIN configurado ✓') }}
          onClose={() => setShowPIN(false)}
        />
      )}

      {reposSel && reciboSel && user && (
        <ModalFirmarRecibo
          reposicion={reposSel}
          recibo={reciboSel}
          userId={user.id}
          onSuccess={() => { setReposSel(null); setReciboSel(null); cargar() }}
          onClose={() => { setReposSel(null); setReciboSel(null) }}
          toast={toast}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
