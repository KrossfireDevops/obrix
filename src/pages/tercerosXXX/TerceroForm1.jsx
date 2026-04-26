// src/pages/terceros/TerceroForm.jsx
// Alta de tercero en 2 pasos:
// Paso 1 → Nivel 1 (obligatorio, bloqueante)
// Paso 2 → Nivel 2 (opcional, incrementa score en tiempo real)

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import * as service from '../../services/terceros.service'
import { DocumentUploadValidator } from '../../components/fiscal/DocumentUploadValidator'
import {
  ChevronRight, ChevronLeft, CheckCircle, Upload, AlertTriangle,
  Info, Shield, Star, FileText, Building2, RefreshCw
} from 'lucide-react'

// ── Constantes SAT ────────────────────────────────────────────────────────────
const REGIMENES = [
  { clave: '601', desc: 'General de Ley Personas Morales' },
  { clave: '603', desc: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', desc: 'Sueldos y Salarios e Ingresos Asimilados' },
  { clave: '606', desc: 'Arrendamiento' },
  { clave: '607', desc: 'Régimen de Enajenación o Adquisición de Bienes' },
  { clave: '608', desc: 'Demás ingresos' },
  { clave: '610', desc: 'Residentes en el Extranjero sin Establecimiento' },
  { clave: '611', desc: 'Ingresos por Dividendos' },
  { clave: '612', desc: 'Personas Físicas con Actividades Empresariales' },
  { clave: '614', desc: 'Ingresos por intereses' },
  { clave: '616', desc: 'Sin obligaciones fiscales' },
  { clave: '621', desc: 'Incorporación Fiscal' },
  { clave: '622', desc: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', desc: 'Opcional para Grupos de Sociedades' },
  { clave: '624', desc: 'Coordinados' },
  { clave: '625', desc: 'Régimen de las Actividades Empresariales con ingresos por Plataformas Tecnológicas' },
  { clave: '626', desc: 'Régimen Simplificado de Confianza (RESICO)' },
]

const USOS_CFDI = [
  { clave: 'G01', desc: 'Adquisición de mercancias' },
  { clave: 'G02', desc: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', desc: 'Gastos en general' },
  { clave: 'I01', desc: 'Construcciones' },
  { clave: 'I02', desc: 'Mobilario y equipo de oficina' },
  { clave: 'I04', desc: 'Equipo de computo y accesorios' },
  { clave: 'I06', desc: 'Comunicaciones telefónicas' },
  { clave: 'I08', desc: 'Otra maquinaria y equipo' },
  { clave: 'D01', desc: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'D10', desc: 'Pagos por servicios educativos' },
  { clave: 'S01', desc: 'Sin efectos fiscales' },
  { clave: 'CP01', desc: 'Pagos' },
  { clave: 'CN01', desc: 'Nómina' },
]

const METODOS_PAGO = [
  { clave: 'PPD', desc: 'Pago en Parcialidades o Diferido' },
  { clave: 'PUE', desc: 'Pago en Una sola Exhibición' },
]

const FORMAS_PAGO = [
  { clave: '01', desc: 'Efectivo' },
  { clave: '02', desc: 'Cheque nominativo' },
  { clave: '03', desc: 'Transferencia electrónica' },
  { clave: '04', desc: 'Tarjeta de crédito' },
  { clave: '28', desc: 'Tarjeta de débito' },
  { clave: '99', desc: 'Por definir' },
]

// ── Validación RFC ────────────────────────────────────────────────────────────
const validarRFC = (rfc) => {
  const rfcPersonaMoral   = /^[A-Z&Ñ]{3}\d{6}[A-Z0-9]{3}$/
  const rfcPersonaFisica  = /^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$/
  const clean = rfc.trim().toUpperCase()
  if (rfcPersonaMoral.test(clean) || rfcPersonaFisica.test(clean)) return { valido: true, tipo: clean.length === 12 ? 'moral' : 'fisica' }
  return { valido: false, tipo: null }
}

// ── Score Proyectado ──────────────────────────────────────────────────────────
const calcularScoreProyectado = (form) => {
  let score = 0
  const factores = []

  // Factor 1: Lista negra (asumimos limpio en alta — worker lo verificará)
  score += 40
  factores.push({ label: 'Sin lista negra', pts: 40, ok: true })

  // Factor 2: 32-D
  if (form.opinion_32d_estatus === 'positiva' && form.opinion_32d_fecha) {
    const dias = Math.floor((Date.now() - new Date(form.opinion_32d_fecha)) / 86400000)
    const pts  = dias <= 27 ? 25 : dias <= 30 ? 20 : dias <= 60 ? 15 : 5
    score += pts
    factores.push({ label: 'Opinión 32-D', pts, ok: true })
  } else {
    factores.push({ label: 'Opinión 32-D', pts: 0, ok: false, hint: '+25 pts al cargar' })
  }

  // Factor 3: Antigüedad
  if (form.csf_fecha_inicio_ops) {
    const meses = Math.floor((Date.now() - new Date(form.csf_fecha_inicio_ops)) / (86400000 * 30))
    const pts   = meses >= 24 ? 15 : meses >= 12 ? 10 : meses >= 6 ? 5 : 0
    score += pts
    factores.push({ label: 'Antigüedad RFC', pts, ok: pts > 0 })
  } else {
    score += 5 // neutro
    factores.push({ label: 'Antigüedad RFC', pts: 5, ok: null, hint: 'Pendiente CSF' })
  }

  // Factor 4: CSD
  if (form.csd_estatus === 'vigente') {
    const dias  = form.csd_vencimiento ? Math.floor((new Date(form.csd_vencimiento) - Date.now()) / 86400000) : 999
    const pts   = dias > 30 ? 10 : 5
    score += pts
    factores.push({ label: 'CSD vigente', pts, ok: true })
  } else {
    factores.push({ label: 'CSD', pts: 0, ok: false, hint: '+10 pts al verificar' })
  }

  // Factor 5: Domicilio
  if (form.domicilio_estatus_sat === 'localizado') {
    score += 5
    factores.push({ label: 'Domicilio localizado', pts: 5, ok: true })
  } else {
    factores.push({ label: 'Domicilio', pts: 0, ok: false, hint: '+5 pts al verificar' })
  }

  // Factor 6: CLABE
  if (form.clabe_verificada) {
    score += 5
    factores.push({ label: 'CLABE verificada', pts: 5, ok: true })
  } else {
    factores.push({ label: 'CLABE', pts: 0, ok: false, hint: '+5 pts al verificar' })
  }

  const semaforo = score >= 80 ? 'verde' : score >= 50 ? 'amarillo' : 'rojo'
  return { score, semaforo, factores }
}

// ── Componentes UI ────────────────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
    {children} {required && <span style={{ color: '#DC2626' }}>*</span>}
  </label>
)

const Input = ({ error, readOnly, ...props }) => (
  <input {...props}
    readOnly={readOnly}
    style={{
      width: '100%', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box',
      border: `1px solid ${error ? '#FCA5A5' : '#E5E7EB'}`,
      borderRadius: '8px', outline: 'none', transition: 'border-color 0.2s',
      backgroundColor: readOnly ? '#F9FAFB' : '#fff',
      color: readOnly ? '#6B7280' : '#111827',
    }}
    onFocus={e => { if (!readOnly) e.target.style.borderColor = '#1E40AF' }}
    onBlur={e  => { if (!readOnly) e.target.style.borderColor = error ? '#FCA5A5' : '#E5E7EB' }}
  />
)

const Select = ({ error, children, ...props }) => (
  <select {...props}
    style={{
      width: '100%', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box',
      border: `1px solid ${error ? '#FCA5A5' : '#E5E7EB'}`,
      borderRadius: '8px', outline: 'none', backgroundColor: '#fff', color: '#111827',
    }}>
    {children}
  </select>
)

const FieldError = ({ msg }) => msg
  ? <p style={{ fontSize: '12px', color: '#DC2626', margin: '4px 0 0' }}>{msg}</p>
  : null

const FileUpload = ({ label, hint, onFile, file, accept = '.pdf' }) => {
  const ref = useRef()
  return (
    <div>
      <Label>{label}</Label>
      <div
        onClick={() => ref.current.click()}
        style={{
          border: '2px dashed #D1D5DB', borderRadius: '10px', padding: '16px',
          textAlign: 'center', cursor: 'pointer', backgroundColor: file ? '#F0FDF4' : '#F9FAFB',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#1E40AF'}
        onMouseLeave={e => e.currentTarget.style.borderColor = file ? '#6EE7B7' : '#D1D5DB'}
      >
        <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
          onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={16} color="#059669" />
            <span style={{ fontSize: '13px', color: '#065F46', fontWeight: '500' }}>{file.name}</span>
          </div>
        ) : (
          <>
            <Upload size={20} style={{ margin: '0 auto 6px', color: '#9CA3AF' }} />
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 2px' }}>{hint || 'Haz clic para seleccionar'}</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{accept.toUpperCase().replace(/\./g, '')}</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Score Panel (lateral) ─────────────────────────────────────────────────────
const ScorePanel = ({ proyectado }) => {
  const { score, semaforo, factores } = proyectado
  const colors = {
    verde:    { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', icon: '🟢' },
    amarillo: { bg: '#FEF9C3', border: '#FDE68A', text: '#B45309', icon: '🟡' },
    rojo:     { bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', icon: '🔴' },
  }
  const c = colors[semaforo]

  return (
    <div style={{ position: 'sticky', top: '80px', width: '280px', flexShrink: 0 }}>
      <div style={{ backgroundColor: c.bg, border: `2px solid ${c.border}`,
        borderRadius: '14px', padding: '20px', marginBottom: '12px' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: c.text, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Score proyectado
        </p>
        <p style={{ fontSize: '48px', fontWeight: '900', color: c.text, margin: '0 0 4px', lineHeight: 1 }}>
          {score}
        </p>
        <p style={{ fontSize: '14px', color: c.text, margin: 0 }}>
          {c.icon} {semaforo === 'verde' ? 'Proveedor Confiable' : semaforo === 'amarillo' ? 'Riesgo Medio' : 'Riesgo Alto'}
        </p>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB',
        borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', margin: '0 0 10px',
          textTransform: 'uppercase', letterSpacing: '0.05em' }}>Factores</p>
        {factores.map((f, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 0', borderBottom: i < factores.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
            <span style={{ fontSize: '12px', color: f.ok === false ? '#9CA3AF' : '#374151' }}>
              {f.ok === true  ? '✅' : f.ok === false ? '⬜' : '⚪'} {f.label}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700',
              color: f.ok === false ? '#D1D5DB' : '#1E40AF' }}>
              {f.pts > 0 ? `+${f.pts}` : f.hint || '0'}
            </span>
          </div>
        ))}
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #E5E7EB',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Total</span>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#1E40AF' }}>{score}/100</span>
        </div>
      </div>
    </div>
  )
}

// ── Paso 1: Nivel 1 ───────────────────────────────────────────────────────────
const Paso1Nivel1 = ({ form, setForm, errors, onRFCBlur, rfcChecking, rfcExistente }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

    <div style={{ backgroundColor: '#EFF6FF', borderRadius: '10px', padding: '14px',
      display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <Info size={16} color="#1E40AF" style={{ flexShrink: 0, marginTop: '1px' }} />
      <p style={{ fontSize: '13px', color: '#1E40AF', margin: 0, lineHeight: 1.5 }}>
        <strong>Nivel 1 — Obligatorio.</strong> Sin estos datos no es posible emitir ni recibir CFDIs con este tercero bajo CFDI 4.0.
      </p>
    </div>

    {/* RFC */}
    <div>
      <Label required>RFC</Label>
      <div style={{ position: 'relative' }}>
        <Input
          type="text" placeholder="Ej: XAXX010101000"
          value={form.rfc}
          onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
          onBlur={onRFCBlur}
          error={errors.rfc}
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace' }}
        />
        {rfcChecking && (
          <RefreshCw size={14} style={{ position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)', color: '#6B7280', animation: 'spin 1s linear infinite' }} />
        )}
      </div>
      <FieldError msg={errors.rfc} />
      {rfcExistente && (
        <p style={{ fontSize: '12px', color: '#059669', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle size={12} /> RFC encontrado en el sistema — datos pre-cargados
        </p>
      )}
    </div>

    {/* Tipo */}
    <div>
      <Label required>Tipo de tercero</Label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { v: 'proveedor', label: '🏭 Proveedor' },
          { v: 'cliente',   label: '🤝 Cliente'   },
          { v: 'ambos',     label: '🔄 Ambos'      },
        ].map(opt => (
          <button key={opt.v} type="button"
            onClick={() => setForm(f => ({ ...f, tipo: opt.v }))}
            style={{
              flex: 1, padding: '9px 6px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', transition: 'all 0.15s',
              border: form.tipo === opt.v ? '2px solid #1E40AF' : '1px solid #E5E7EB',
              backgroundColor: form.tipo === opt.v ? '#EFF6FF' : '#fff',
              color: form.tipo === opt.v ? '#1E40AF' : '#6B7280',
            }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {/* Razón Social */}
    <div>
      <Label required>Razón Social / Nombre</Label>
      <Input
        type="text" placeholder="Nombre exacto según SAT"
        value={form.razon_social}
        onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
        error={errors.razon_social}
        readOnly={rfcExistente}
      />
      <FieldError msg={errors.razon_social} />
      {rfcExistente && (
        <p style={{ fontSize: '11px', color: '#6B7280', margin: '3px 0 0' }}>
          🔒 Extraído de CSF — no editable para garantizar timbrado correcto
        </p>
      )}
    </div>

    {/* CP + Régimen */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
      <div>
        <Label required>CP Fiscal</Label>
        <Input type="text" placeholder="12345" maxLength={5}
          value={form.codigo_postal}
          onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value.replace(/\D/g, '') }))}
          error={errors.codigo_postal}
        />
        <FieldError msg={errors.codigo_postal} />
      </div>
      <div>
        <Label required>Régimen Fiscal</Label>
        <Select value={form.regimen_fiscal}
          onChange={e => setForm(f => ({ ...f, regimen_fiscal: e.target.value }))}
          error={errors.regimen_fiscal}>
          <option value="">Selecciona régimen...</option>
          {REGIMENES.map(r => (
            <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>
          ))}
        </Select>
        <FieldError msg={errors.regimen_fiscal} />
      </div>
    </div>

    {/* Uso CFDI + Email */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <div>
        <Label required>Uso CFDI por defecto</Label>
        <Select value={form.uso_cfdi_default}
          onChange={e => setForm(f => ({ ...f, uso_cfdi_default: e.target.value }))}>
          {USOS_CFDI.map(u => (
            <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label required>Correo electrónico oficial</Label>
        <Input type="email" placeholder="facturacion@empresa.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          error={errors.email}
        />
        <FieldError msg={errors.email} />
      </div>
    </div>

    {/* Condiciones comerciales */}
    <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
      <p style={{ fontSize: '13px', fontWeight: '700', color: '#374151', margin: '0 0 12px' }}>
        Condiciones Comerciales <span style={{ fontWeight: '400', color: '#9CA3AF' }}>(opcionales)</span>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <Label>Límite de crédito</Label>
          <Input type="number" placeholder="0.00"
            value={form.limite_credito}
            onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))}
          />
        </div>
        <div>
          <Label>Días de crédito</Label>
          <Input type="number" placeholder="30"
            value={form.dias_credito}
            onChange={e => setForm(f => ({ ...f, dias_credito: e.target.value }))}
          />
        </div>
        <div>
          <Label>Método de pago</Label>
          <Select value={form.metodo_pago_default}
            onChange={e => setForm(f => ({ ...f, metodo_pago_default: e.target.value }))}>
            <option value="">Selecciona...</option>
            {METODOS_PAGO.map(m => <option key={m.clave} value={m.clave}>{m.clave} — {m.desc}</option>)}
          </Select>
        </div>
      </div>
    </div>
  </div>
)

// ── Paso 2: Nivel 2 ───────────────────────────────────────────────────────────
const Paso2Nivel2 = ({ form, setForm, archivos, setArchivos }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

    <div style={{ backgroundColor: '#F0FDF4', borderRadius: '10px', padding: '14px',
      display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <Star size={16} color="#059669" style={{ flexShrink: 0, marginTop: '1px' }} />
      <p style={{ fontSize: '13px', color: '#065F46', margin: 0, lineHeight: 1.5 }}>
        <strong>Nivel 2 — Opcional.</strong> Cada documento que agregues incrementa el Score en tiempo real.
        Sin estos documentos el sistema asignará automáticamente <strong>Riesgo Medio</strong>.
      </p>
    </div>

    {/* A. Documentación Digital */}
    <div>
      <p style={{ fontSize: '14px', fontWeight: '700', color: '#1E40AF', margin: '0 0 12px',
        display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={16} /> A. Documentación Digital
      </p>

      {/* CSF + 32-D en grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <DocumentUploadValidator
          tipoDocumento="CSF"
          rfcEsperado={form.rfc}
          onArchivo={f => setArchivos(a => ({ ...a, csf: f }))}
          onValidado={datos => {
            setForm(f => ({
              ...f,
              csf_fecha_inicio_ops: datos.fecha_inicio_ops || f.csf_fecha_inicio_ops,
              // Si CSF tiene datos más precisos, actualizar nombre y CP
              razon_social:   datos.nombre        || f.razon_social,
              codigo_postal:  datos.codigo_postal  || f.codigo_postal,
              regimen_fiscal: datos.clave_regimen  || f.regimen_fiscal,
            }))
          }}
        />

        <DocumentUploadValidator
          tipoDocumento="32D"
          rfcEsperado={form.rfc}
          onArchivo={f => setArchivos(a => ({ ...a, opinion_32d: f }))}
          onValidado={datos => {
            setForm(f => ({
              ...f,
              opinion_32d_estatus: datos.estatus_opinion?.toLowerCase() || 'positiva',
              opinion_32d_fecha:   datos.fecha_emision || f.opinion_32d_fecha,
            }))
          }}
        />
      </div>

      {/* Alerta empresa fantasma — se muestra si la CSF ya fue parseada */}
      {form.csf_fecha_inicio_ops && (() => {
        const meses = Math.floor((Date.now() - new Date(form.csf_fecha_inicio_ops)) / (86400000 * 30))
        if (meses < 6) return (
          <div style={{ backgroundColor: '#FEE2E2', borderRadius: '8px', padding: '10px 14px',
            display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: '600' }}>
              RFC con {meses} mes{meses !== 1 ? 'es' : ''} de operación — verificar sustancia económica antes de operar
            </span>
          </div>
        )
        return null
      })()}
    </div>

    {/* B. Sustancia Económica */}
    <div>
      <p style={{ fontSize: '14px', fontWeight: '700', color: '#065F46', margin: '0 0 12px',
        display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Building2 size={16} /> B. Datos de Operación Real
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* CSD */}
        <DocumentUploadValidator
          tipoDocumento="CSD"
          rfcEsperado={form.rfc}
          onArchivo={f => setArchivos(a => ({ ...a, csd: f }))}
          onValidado={datos => {
            setForm(f => ({
              ...f,
              csd_numero:      datos.numero_certificado || f.csd_numero,
              csd_vencimiento: datos.fecha_fin          || f.csd_vencimiento,
              csd_estatus:     datos.estatus?.toLowerCase().replace(' ', '_') || f.csd_estatus,
            }))
          }}
        />

        {/* Estado de cuenta bancario */}
        <DocumentUploadValidator
          tipoDocumento="ESTADO_CUENTA"
          rfcEsperado={form.rfc}
          onArchivo={f => setArchivos(a => ({ ...a, estado_cuenta: f }))}
          onValidado={datos => {
            setForm(f => ({
              ...f,
              clabe:            datos.clabe    || f.clabe,
              clabe_titular:    datos.titular  || f.clabe_titular,
              // Si el titular del banco coincide con el RFC → verificada automáticamente
              clabe_verificada: datos.rfc_titular
                ? datos.rfc_titular.toUpperCase() === f.rfc.toUpperCase()
                : f.clabe_verificada,
            }))
          }}
        />
      </div>
    </div>
  </div>
)

// ── Formulario Principal ──────────────────────────────────────────────────────
export const TerceroForm = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [paso,        setPaso]        = useState(1)
  const [saving,      setSaving]      = useState(false)
  const [rfcChecking, setRfcChecking] = useState(false)
  const [rfcExistente, setRfcExistente] = useState(false)
  const [errors,      setErrors]      = useState({})

  const [form, setForm] = useState({
    rfc: '', tipo: 'proveedor', razon_social: '', codigo_postal: '',
    regimen_fiscal: '', uso_cfdi_default: 'G03', email: '',
    limite_credito: '', dias_credito: '', metodo_pago_default: '',
    // Nivel 2
    csf_fecha_inicio_ops: '', opinion_32d_estatus: '', opinion_32d_fecha: '',
    domicilio_estatus_sat: 'no_verificado', csd_numero: '', csd_vencimiento: '',
    csd_estatus: 'no_verificado', clabe: '', clabe_titular: '', clabe_verificada: false,
    repse_numero: '', repse_vencimiento: '',
  })

  const [archivos, setArchivos] = useState({
    csf: null, opinion_32d: null, comprobante_domicilio: null, repse: null
  })

  const proyectado = calcularScoreProyectado(form)

  // Buscar RFC al salir del campo
  const handleRFCBlur = async () => {
    const { valido } = validarRFC(form.rfc)
    if (!valido) return
    setRfcChecking(true)
    const { data } = await service.getTerceroByRFC(form.rfc)
    setRfcChecking(false)
    if (data) {
      setRfcExistente(true)
      setForm(f => ({
        ...f,
        razon_social:   data.razon_social,
        codigo_postal:  data.codigo_postal,
        regimen_fiscal: data.regimen_fiscal,
        email:          data.email || f.email,
      }))
    } else {
      setRfcExistente(false)
    }
  }

  // Validar Nivel 1
  const validarPaso1 = () => {
    const e = {}
    if (!validarRFC(form.rfc).valido) e.rfc = 'RFC inválido — verifica formato y dígito verificador'
    if (!form.razon_social.trim())    e.razon_social   = 'Razón social requerida'
    if (form.codigo_postal.length !== 5) e.codigo_postal = 'CP debe tener 5 dígitos'
    if (!form.regimen_fiscal)         e.regimen_fiscal = 'Selecciona un régimen fiscal'
    if (!form.email || !form.email.includes('@')) e.email = 'Correo electrónico inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSiguiente = () => {
    if (validarPaso1()) setPaso(2)
  }

  const handleGuardar = async () => {
    setSaving(true)
    try {
      // 1. Crear/actualizar tercero base
      const { data: resultado, error } = await service.upsertTercero(form)
      if (error) throw error

      const terceroId = resultado.tercero.id

      // 2. Subir documentos Nivel 2 si existen
      const uploads = []
      if (archivos.csf) {
        uploads.push(service.uploadDocumento(terceroId, 'csf', archivos.csf, {
          fecha_inicio_ops: form.csf_fecha_inicio_ops || null
        }))
      }
      if (archivos.opinion_32d) {
        uploads.push(service.uploadDocumento(terceroId, 'opinion_32d', archivos.opinion_32d, {
          estatus:          form.opinion_32d_estatus || 'positiva',
          fecha_documento:  form.opinion_32d_fecha,
        }))
      }
      if (archivos.comprobante_domicilio) {
        uploads.push(service.uploadDocumento(terceroId, 'comprobante_domicilio', archivos.comprobante_domicilio))
      }
      if (archivos.repse) {
        uploads.push(service.uploadDocumento(terceroId, 'repse', archivos.repse))
      }

      if (uploads.length > 0) {
        await Promise.all(uploads)
        // Actualizar Nivel 2 con datos del form
        await service.updateTerceroNivel2(terceroId, form)
      }

      toast.success(`Tercero ${resultado.tercero.rfc} dado de alta correctamente`)
      navigate(`/fiscal/terceros/${terceroId}`)
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar: ' + (err.message || 'Intenta de nuevo'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <RequirePermission module="fiscal" action="create">
      <MainLayout title={paso === 1 ? '🏢 Nuevo Tercero — Nivel 1' : '⭐ Completar Nivel 2 (Opcional)'}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', maxWidth: '1100px' }}>

          {/* ── Formulario ── */}
          <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '14px',
            border: '1px solid #E5E7EB', padding: '28px' }}>

            {/* Steps indicator */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '28px' }}>
              {[
                { n: 1, label: '🛡️ Nivel 1 — Mínimo Indispensable', desc: '6 campos obligatorios CFDI 4.0' },
                { n: 2, label: '🚀 Nivel 2 — Cero Riesgo',           desc: 'Documentación + Score máximo' },
              ].map((step, i) => (
                <div key={step.n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0' }}>
                  <div style={{ flex: 1, padding: '12px 16px', borderRadius: i === 0 ? '10px 0 0 10px' : '0 10px 10px 0',
                    backgroundColor: paso === step.n ? '#1E40AF' : paso > step.n ? '#D1FAE5' : '#F9FAFB',
                    border: `1px solid ${paso === step.n ? '#1E40AF' : paso > step.n ? '#6EE7B7' : '#E5E7EB'}` }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 2px',
                      color: paso === step.n ? '#fff' : paso > step.n ? '#065F46' : '#9CA3AF' }}>
                      {paso > step.n ? '✅ ' : ''}{step.label}
                    </p>
                    <p style={{ fontSize: '11px', margin: 0,
                      color: paso === step.n ? '#BFDBFE' : paso > step.n ? '#059669' : '#D1D5DB' }}>
                      {step.desc}
                    </p>
                  </div>
                  {i === 0 && <ChevronRight size={20} color="#D1D5DB" style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>

            {/* Contenido del paso */}
            {paso === 1
              ? <Paso1Nivel1 form={form} setForm={setForm} errors={errors}
                  onRFCBlur={handleRFCBlur} rfcChecking={rfcChecking} rfcExistente={rfcExistente} />
              : <Paso2Nivel2 form={form} setForm={setForm} archivos={archivos} setArchivos={setArchivos} />
            }

            {/* Navegación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px',
              paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
              {paso === 2 ? (
                <button onClick={() => setPaso(1)} style={{ display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 18px', borderRadius: '10px', border: '1px solid #E5E7EB',
                  backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <ChevronLeft size={16} /> Volver al Nivel 1
                </button>
              ) : (
                <button onClick={() => navigate(-1)} style={{ padding: '10px 18px',
                  borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#fff',
                  cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  Cancelar
                </button>
              )}

              {paso === 1 ? (
                <button onClick={handleSiguiente} style={{ display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '10px', border: 'none',
                  backgroundColor: '#1E40AF', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                  Continuar al Nivel 2 <ChevronRight size={16} />
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleGuardar()} disabled={saving}
                    style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #E5E7EB',
                      backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                    Guardar solo Nivel 1
                  </button>
                  <button onClick={handleGuardar} disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 20px', borderRadius: '10px', border: 'none',
                      backgroundColor: saving ? '#9CA3AF' : '#059669',
                      color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '14px', fontWeight: '600' }}>
                    {saving ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} />}
                    {saving ? 'Guardando...' : '✅ Guardar Expediente Completo'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Panel Score (solo Paso 2) ── */}
          {paso === 2 && <ScorePanel proyectado={proyectado} />}
        </div>
      </MainLayout>
    </RequirePermission>
  )
}