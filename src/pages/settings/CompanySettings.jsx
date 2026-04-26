// src/pages/settings/CompanySettings.jsx
// v2.0 FINAL — Abril 2026
// Cambios vs v1.1:
//   - Pestañas: "Configuración General" y "Formatos PDF"
//   - Orden: Datos Fiscales → e.firma → CSD → Moneda
//   - Validación cruzada RFC: CSD debe coincidir con RFC empresa
//   - Datos Fiscales ampliados: domicilio, teléfono, email, web
//   - FormatosTab integrada como segunda pestaña
//   - Eliminadas: Sección Niveles de Aprobación y Factores de Costo
//   - Conservados: catálogo completo 18 regímenes, animaciones,
//     disabled en botón Cancelar modal, transiciones en AreaCarga,
//     mensajes detallados de error, botón Restablecer

import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import { supabase } from '../../config/supabase'
import * as service from '../../services/companySettings.service'
import FormatosTab      from './FormatosTab'
import LogotiposSection from './LogotiposSection'
import {
  DollarSign, Shield, Save, RefreshCw, Building2, Info,
  Upload, CheckCircle2, AlertTriangle, Eye, EyeOff,
  Trash2, RotateCcw, FileKey2, ShieldCheck, X, AlertOctagon,
  Receipt, FileText, ImageIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Catálogo completo de regímenes fiscales SAT (18 regímenes)
// ─────────────────────────────────────────────────────────────
const REGIMENES_FISCALES = [
  { value: '601', label: '601 — General de Ley Personas Morales' },
  { value: '603', label: '603 — Personas Morales con Fines no Lucrativos' },
  { value: '605', label: '605 — Sueldos y Salarios e Ingresos Asimilados' },
  { value: '606', label: '606 — Arrendamiento' },
  { value: '607', label: '607 — Régimen de Enajenación o Adquisición de Bienes' },
  { value: '608', label: '608 — Demás Ingresos' },
  { value: '610', label: '610 — Residentes en el Extranjero sin EP en México' },
  { value: '611', label: '611 — Ingresos por Dividendos' },
  { value: '612', label: '612 — Personas Físicas con Actividades Empresariales' },
  { value: '614', label: '614 — Ingresos por intereses' },
  { value: '616', label: '616 — Sin obligaciones fiscales' },
  { value: '620', label: '620 — Sociedades Cooperativas de Producción' },
  { value: '621', label: '621 — Incorporación Fiscal' },
  { value: '622', label: '622 — Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { value: '623', label: '623 — Opcional para Grupos de Sociedades' },
  { value: '624', label: '624 — Coordinados' },
  { value: '625', label: '625 — Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { value: '626', label: '626 — Régimen Simplificado de Confianza (RESICO)' },
]

// ─────────────────────────────────────────────────────────────
// Validador de RFC México
// ─────────────────────────────────────────────────────────────
function validarRFC(rfc) {
  if (!rfc) return false
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim())
}

// ─────────────────────────────────────────────────────────────
// Componentes base
// ─────────────────────────────────────────────────────────────
const Field = ({ label, hint, required, children, style = {} }) => (
  <div style={{ marginBottom: '16px', ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: '3px' }}>*</span>}
      </label>
      {hint && (
        <div style={{ position: 'relative', display: 'inline-flex' }} className="hint-container">
          <Info size={13} color="#9ca3af" style={{ cursor: 'help' }} />
          <div className="hint-tooltip" style={{
            position: 'absolute', left: '20px', top: '-4px',
            backgroundColor: '#1f2937', color: '#fff', fontSize: '11px',
            padding: '6px 10px', borderRadius: '6px', whiteSpace: 'nowrap',
            zIndex: 10, display: 'none', pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {hint}
          </div>
        </div>
      )}
    </div>
    {children}
  </div>
)

const Section = ({ icon: Icon, title, subtitle, children, accentColor = '#2563eb', badge }) => (
  <div style={{
    backgroundColor: '#fff', border: '1px solid #e5e7eb',
    borderRadius: '16px', overflow: 'hidden', marginBottom: '20px',
  }}>
    <div style={{
      padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
      display: 'flex', alignItems: 'center', gap: '12px',
      backgroundColor: '#fafafa',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        backgroundColor: `${accentColor}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={accentColor} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: 0 }}>{title}</p>
        {subtitle && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
      {badge}
    </div>
    <div style={{ padding: '20px' }}>{children}</div>
  </div>
)

// ─────────────────────────────────────────────────────────────
// Badge de completitud
// ─────────────────────────────────────────────────────────────
const BadgeCompleto = ({ completo, texto }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
    backgroundColor: completo ? '#f0fdf4' : '#fffbeb',
    color: completo ? '#15803d' : '#92400e',
    border: `1px solid ${completo ? '#bbf7d0' : '#fde68a'}`,
    flexShrink: 0,
  }}>
    {completo
      ? <CheckCircle2 size={11} color="#16a34a" />
      : <AlertTriangle size={11} color="#d97706" />
    }
    {texto}
  </div>
)

// ─────────────────────────────────────────────────────────────
// Modal de confirmación de eliminación
// Conservado de v1.1: disabled + opacity en botón Cancelar,
// animación fadeInDown
// ─────────────────────────────────────────────────────────────
const ModalEliminar = ({ tipo, onCancelar, onAceptar, eliminando }) => {
  const esCSD = tipo === 'csd'
  return (
    <div style={{
      backgroundColor: '#fff9f9', border: '2px solid #fecaca',
      borderRadius: '14px', padding: '20px', marginBottom: '16px',
      animation: 'fadeInDown 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: '#fee2e2', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <AlertOctagon size={24} color="#dc2626" />
        </div>
        <div>
          <p style={{ fontSize: '15px', fontWeight: '700', color: '#991b1b', margin: '0 0 6px' }}>
            ¿Eliminar {esCSD ? 'el CSD' : 'la e.firma'}?
          </p>
          <p style={{ fontSize: '13px', color: '#7f1d1d', margin: '0 0 4px', lineHeight: '1.5' }}>
            {esCSD
              ? 'Sin el CSD no podrás generar ni timbrar facturas (CFDIs) en el sistema.'
              : 'Sin la e.firma el Buzón Fiscal SAT dejará de funcionar y no podrás descargar CFDIs.'}
          </p>
          <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0, fontWeight: '600' }}>
            ⚠️ Para reactivarlo deberás volver a cargar y validar los certificados.
          </p>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #fecaca', marginBottom: '16px' }} />
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        {/* Conservado de v1.1: disabled + opacity en Cancelar */}
        <button
          onClick={onCancelar}
          disabled={eliminando}
          style={{
            padding: '9px 20px', borderRadius: '9px',
            border: '1px solid #e5e7eb', backgroundColor: '#fff',
            color: '#374151', cursor: eliminando ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '600',
            opacity: eliminando ? 0.5 : 1,
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onAceptar}
          disabled={eliminando}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 20px', borderRadius: '9px', border: 'none',
            backgroundColor: eliminando ? '#fca5a5' : '#dc2626',
            color: '#fff', cursor: eliminando ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '600',
          }}
        >
          <Trash2 size={14} />
          {eliminando ? 'Eliminando...' : `Sí, eliminar ${esCSD ? 'CSD' : 'e.firma'}`}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Área de carga: .cer + .key + contraseña + nombre manual
// Conservado de v1.1: transition en label de archivo,
// mensaje detallado en campo nombre manual
// ─────────────────────────────────────────────────────────────
const AreaCarga = ({
  estado, color, colorBg,
  onCambiar, onValidar, onGuardar, onLimpiar,
  labelGuardar, labelPass,
  mostrarNombreManual = false,
}) => (
  <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
      {[
        { campo: 'cer', nombreCampo: 'cerNombre', etiqueta: 'Certificado (.cer)', acepta: '.cer' },
        { campo: 'key', nombreCampo: 'keyNombre', etiqueta: 'Llave privada (.key)', acepta: '.key' },
      ].map(({ campo, nombreCampo, etiqueta, acepta }) => (
        <Field key={campo} label={etiqueta} required style={{ marginBottom: 0 }}>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '6px', padding: '18px 12px',
            borderRadius: '10px', cursor: 'pointer', minHeight: '80px',
            border: estado[nombreCampo] ? '2px solid #16a34a' : '2px dashed #d1d5db',
            backgroundColor: estado[nombreCampo] ? '#f0fdf4' : '#fafafa',
            // Conservado de v1.1
            transition: 'border-color 0.2s, background-color 0.2s',
          }}>
            <input type="file" accept={acepta} style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files[0]
                if (f) {
                  onCambiar(campo, f)
                  onCambiar(nombreCampo, f.name)
                  onCambiar('validado', false)
                }
              }}
            />
            <Upload size={18} color={estado[nombreCampo] ? '#16a34a' : '#9ca3af'} />
            <span style={{
              fontSize: '11px', textAlign: 'center', wordBreak: 'break-all',
              color: estado[nombreCampo] ? '#15803d' : '#6b7280',
              fontWeight: estado[nombreCampo] ? '600' : '400',
            }}>
              {estado[nombreCampo] || `Seleccionar ${acepta}`}
            </span>
          </label>
        </Field>
      ))}
    </div>

    {/* Contraseña */}
    <Field label={labelPass} required style={{ marginBottom: '14px' }}>
      <div style={{ position: 'relative' }}>
        <input
          type={estado.showPassword ? 'text' : 'password'}
          placeholder="Contraseña del archivo .key"
          value={estado.password}
          onChange={e => onCambiar('password', e.target.value)}
          style={{
            width: '100%', padding: '10px 40px 10px 12px',
            border: '1px solid #e5e7eb', borderRadius: '8px',
            fontSize: '14px', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button type="button" onClick={() => onCambiar('showPassword', !estado.showPassword)}
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}>
          {estado.showPassword ? <EyeOff size={15} color="#9ca3af" /> : <Eye size={15} color="#9ca3af" />}
        </button>
      </div>
    </Field>

    {/* Preview validación exitosa */}
    {estado.validado && (
      <div style={{
        backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: '10px', padding: '14px', marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
          <CheckCircle2 size={15} color="#16a34a" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#15803d' }}>
            Par de archivos validado correctamente
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { label: 'RFC',      value: estado.rfcPreview },
            { label: 'Titular',  value: estado.nombrePreview },
            { label: 'Vigencia', value: estado.vigenciaPreview
                ? new Date(estado.vigenciaPreview).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—' },
          ].map(i => (
            <div key={i.label} style={{
              backgroundColor: '#fff', borderRadius: '8px',
              padding: '8px 10px', border: '1px solid #bbf7d0',
            }}>
              <p style={{ fontSize: '10px', color: '#4b7c59', margin: '0 0 2px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{i.label}</p>
              <p style={{ fontSize: '12px', color: '#15803d', margin: 0, fontWeight: '700' }}>{i.value}</p>
            </div>
          ))}
        </div>

        {/* Campo nombre manual — conservado de v1.1 con mensaje completo */}
        {mostrarNombreManual && (
          (estado.nombrePreview === 'No detectado' || !estado.nombrePreview) && (
            <div style={{
              marginTop: '12px', padding: '12px',
              backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={13} color="#d97706" />
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', margin: 0 }}>
                  El nombre del titular no se pudo detectar automáticamente.
                  Captúralo manualmente — es obligatorio para guardar.
                </p>
              </div>
              <input
                type="text"
                placeholder="Nombre completo del titular de la e.firma"
                value={estado.nombreManual || ''}
                onChange={e => onCambiar('nombreManual', e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #f59e0b', borderRadius: '8px',
                  fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box', backgroundColor: '#fff',
                }}
              />
            </div>
          )
        )}
      </div>
    )}

    {/* Botones Validar / Cancelar / Guardar */}
    <div style={{ display: 'flex', gap: '10px' }}>
      <button onClick={onValidar} disabled={estado.validando || estado.guardando}
        style={{
          flex: estado.validado ? '0 0 auto' : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '7px', padding: '11px 20px', borderRadius: '10px',
          border: `1.5px solid ${color}`, backgroundColor: '#fff', color,
          cursor: (estado.validando || estado.guardando) ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: '600',
          opacity: (estado.validando || estado.guardando) ? 0.6 : 1,
          transition: 'opacity 0.15s', whiteSpace: 'nowrap',
        }}>
        <Shield size={14} />
        {estado.validando ? 'Validando...' : 'Validar archivos'}
      </button>

      {/* Cancelar — aparece cuando hay archivos seleccionados o ya se validó.
          Limpia todo el formulario sin necesidad de recargar la página. */}
      {(estado.cerNombre || estado.keyNombre || estado.validado) && !estado.guardando && (
        <button onClick={onLimpiar}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '7px', padding: '11px 20px', borderRadius: '10px',
            border: '1.5px solid #e5e7eb', backgroundColor: '#fff',
            color: '#6b7280', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fff' }}
        >
          <X size={14} />
          Cancelar
        </button>
      )}

      {estado.validado && (
        <button onClick={onGuardar} disabled={estado.guardando}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '7px', padding: '11px 20px', borderRadius: '10px',
            border: `1.5px solid ${color}`,
            backgroundColor: estado.guardando ? colorBg : color,
            color: estado.guardando ? color : '#fff',
            cursor: estado.guardando ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '700', transition: 'all 0.2s',
          }}>
          <Save size={14} />
          {estado.guardando ? 'Guardando...' : labelGuardar}
        </button>
      )}
    </div>

    <p style={{ fontSize: '10px', color: '#9ca3af', margin: '10px 0 0', textAlign: 'center', lineHeight: '1.4' }}>
      🔒 Los archivos se almacenan encriptados en el servidor.<br />
      La contraseña no se transmite en texto plano a ningún tercero.
    </p>
  </>
)

// ─────────────────────────────────────────────────────────────
// Alerta de vigencia próxima a vencer o vencida
// ─────────────────────────────────────────────────────────────
const AlertaVigencia = ({ vigencia }) => {
  if (!vigencia) return null
  const dias = Math.ceil((new Date(vigencia) - new Date()) / 86400000)
  if (dias > 30) return null
  const vencido = dias <= 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px',
      backgroundColor: vencido ? '#fef2f2' : '#fffbeb',
      border: `1px solid ${vencido ? '#fecaca' : '#fde68a'}`,
      borderRadius: '8px', padding: '10px 12px',
    }}>
      <AlertTriangle size={15} color={vencido ? '#dc2626' : '#d97706'} />
      <p style={{ fontSize: '12px', color: vencido ? '#991b1b' : '#92400e', margin: 0, fontWeight: '500' }}>
        {vencido
          ? '🚫 Certificado vencido — renuévalo inmediatamente para no perder funcionalidad.'
          : `⚠️ Vence en ${dias} día${dias === 1 ? '' : 's'} — renueva antes de que expire.`}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Estado inicial de una firma digital
// ─────────────────────────────────────────────────────────────
const firmaInicial = () => ({
  cer: null, key: null, cerNombre: '', keyNombre: '',
  password: '', showPassword: false, modoRenovar: false,
  validando: false, guardando: false, eliminando: false,
  validado: false, confirmarEliminar: false,
  rfcPreview: '', nombrePreview: '', vigenciaPreview: '',
  cerB64Preview: '', keyB64Preview: '',
  nombreManual: '',
  configurada: false, rfc: '', nombre: '', vigencia: '',
  noCertificado: '', updatedAt: '',
})

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export const CompanySettings = () => {
  const [loading,       setLoading]       = useState(true)
  const [tabActiva,     setTabActiva]     = useState('general')
  const [savingFiscal,  setSavingFiscal]  = useState(false)
  const [savingMoneda,  setSavingMoneda]  = useState(false)

  // Datos fiscales ampliados (v2.0: + domicilio, telefono, email, web)
  const [datosFiscales, setDatosFiscales] = useState({
    rfc:              '',
    razon_social:     '',
    regimen_fiscal:   '601',
    cp_fiscal:        '',
    domicilio_fiscal: '',
    telefono:         '',
    email:            '',
    web:              '',
  })
  const [datosFiscalesCompletos, setDatosFiscalesCompletos] = useState(false)

  const [moneda,      setMoneda]      = useState({ currency: 'MXN', currency_symbol: '$' })
  const [companyName, setCompanyName] = useState('')
  const [companyId,   setCompanyId]   = useState(null)
  const [csd,         setCsd]         = useState(firmaInicial())
  const [efirma,      setEfirma]      = useState(firmaInicial())
  const { toast } = useToast()

  const mutar = (setter) => (k, v) => setter(s => ({ ...s, [k]: v }))
  const mutarCsd    = mutar(setCsd)
  const mutarEfirma = mutar(setEfirma)
  const setDF       = (k, v) => setDatosFiscales(s => ({ ...s, [k]: v }))

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => { cargarTodo() }, [])

  const cargarTodo = async () => {
    setLoading(true)
    const { data, error } = await service.getSettings()
    if (error) {
      toast.warning('No se encontró configuración. Se usarán valores por defecto.')
    } else if (data) {
      const cid = data.company_id
      setCompanyId(cid)
      setCompanyName(data.companies?.name || '')
      setMoneda({
        currency:        data.currency        || 'MXN',
        currency_symbol: data.currency_symbol || '$',
      })

      const df = {
        rfc:              data.rfc                     || '',
        razon_social:     data.razon_social            || '',
        regimen_fiscal:   data.regimen_fiscal_emisor   || '601',
        cp_fiscal:        data.codigo_postal_fiscal    || '',
        domicilio_fiscal: data.domicilio_fiscal        || '',
        telefono:         data.telefono                || '',
        email:            data.email                   || '',
        web:              data.web                     || '',
      }
      setDatosFiscales(df)
      setDatosFiscalesCompletos(
        validarRFC(df.rfc) && df.razon_social.trim().length > 3 && df.cp_fiscal.trim().length === 5
      )

      try {
        const { data: d } = await supabase
          .from('company_csd')
          .select('rfc, nombre_titular, vigencia, no_certificado, configurada, updated_at')
          .eq('company_id', cid).maybeSingle()
        if (d) setCsd(s => ({
          ...s,
          configurada:   d.configurada    || false,
          rfc:           d.rfc            || '',
          nombre:        d.nombre_titular || '',
          vigencia:      d.vigencia       || '',
          noCertificado: d.no_certificado || '',
          updatedAt:     d.updated_at     || '',
        }))
      } catch (_) {}

      try {
        const { data: d } = await supabase
          .from('company_efirma')
          .select('rfc, nombre_titular, vigencia, configurada, updated_at')
          .eq('company_id', cid).maybeSingle()
        if (d) setEfirma(s => ({
          ...s,
          configurada: d.configurada    || false,
          rfc:         d.rfc            || '',
          nombre:      d.nombre_titular || '',
          vigencia:    d.vigencia       || '',
          updatedAt:   d.updated_at     || '',
        }))
      } catch (_) {}
    }
    setLoading(false)
  }

  // ── Helpers ───────────────────────────────────────────────
  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const getCompanyId = async () => {
    if (companyId) return companyId
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase
      .from('users_profiles').select('company_id').eq('id', user.id).single()
    return p.company_id
  }

  const cancelarRenovar = (setter) => setter(s => ({
    ...s, modoRenovar: false, validado: false,
    cer: null, key: null, cerNombre: '', keyNombre: '', password: '',
    rfcPreview: '', nombrePreview: '', vigenciaPreview: '',
    cerB64Preview: '', keyB64Preview: '', nombreManual: '',
  }))

  // ── Guardar Datos Fiscales ─────────────────────────────────
  const handleSaveDatosFiscales = async () => {
    if (!datosFiscales.rfc.trim()) {
      toast.error('El RFC de la empresa es obligatorio'); return
    }
    if (!validarRFC(datosFiscales.rfc)) {
      toast.error('El RFC no tiene un formato válido (ej: ABC123456XYZ)'); return
    }
    if (!datosFiscales.razon_social.trim() || datosFiscales.razon_social.trim().length < 3) {
      toast.error('La razón social es obligatoria (mínimo 3 caracteres)'); return
    }
    if (!datosFiscales.regimen_fiscal) {
      toast.error('El régimen fiscal es obligatorio'); return
    }
    if (!datosFiscales.cp_fiscal.trim() || datosFiscales.cp_fiscal.trim().length !== 5) {
      toast.error('El código postal fiscal debe tener exactamente 5 dígitos'); return
    }

    setSavingFiscal(true)
    try {
      const cid = companyId || await getCompanyId()
      const { error } = await supabase
        .from('company_settings')
        .update({
          rfc:                   datosFiscales.rfc.trim().toUpperCase(),
          razon_social:          datosFiscales.razon_social.trim().toUpperCase(),
          regimen_fiscal_emisor: datosFiscales.regimen_fiscal,
          codigo_postal_fiscal:  datosFiscales.cp_fiscal.trim(),
          domicilio_fiscal:      datosFiscales.domicilio_fiscal.trim(),
          telefono:              datosFiscales.telefono.trim(),
          email:                 datosFiscales.email.trim(),
          web:                   datosFiscales.web.trim(),
        })
        .eq('company_id', cid)
      if (error) throw error
      setDatosFiscalesCompletos(true)
      toast.success('✅ Datos fiscales guardados correctamente')
    } catch (e) {
      toast.error('Error al guardar datos fiscales: ' + e.message)
    } finally {
      setSavingFiscal(false)
    }
  }

  // ── Guardar Moneda ─────────────────────────────────────────
  const handleSaveMoneda = async () => {
    if (!moneda.currency.trim() || !moneda.currency_symbol.trim()) {
      toast.error('La moneda y símbolo son obligatorios'); return
    }
    setSavingMoneda(true)
    const { error } = await service.saveSettings({
      currency:        moneda.currency,
      currency_symbol: moneda.currency_symbol,
    })
    if (error) toast.error('Error al guardar: ' + error.message)
    else       toast.success('✅ Moneda guardada correctamente')
    setSavingMoneda(false)
  }

  // ── Validación cruzada RFC ────────────────────────────────
  // El RFC del CSD debe coincidir con el RFC fiscal de la empresa.
  // La e.firma es del representante legal (RFC persona física) —
  // ese RFC es distinto al de la empresa, no se valida cruzado.
  const rfcCsdCoincide = (rfcCert) => {
    if (!datosFiscales.rfc || !rfcCert) return true
    return rfcCert.toUpperCase() === datosFiscales.rfc.toUpperCase()
  }

  // ─── CSD ──────────────────────────────────────────────────
  const validarCSD = async () => {
    if (!csd.cer || !csd.key) { toast.error('Debes cargar el .cer y el .key del CSD'); return }
    if (!csd.password.trim()) { toast.error('La contraseña del CSD es obligatoria');   return }
    mutarCsd('validando', true)
    try {
      const cerB64 = await toBase64(csd.cer)
      const keyB64 = await toBase64(csd.key)
      const { data: result, error } = await supabase.functions.invoke('validar-csd', {
        body: { cer_base64: cerB64, key_base64: keyB64, password: csd.password }
      })
      if (error || !result?.valido) {
        toast.error(result?.mensaje || 'Par CSD inválido. Verifica los archivos y la contraseña.')
        return
      }
      // Validación cruzada: RFC del CSD debe coincidir con RFC de la empresa
      if (!rfcCsdCoincide(result.rfc)) {
        toast.error(`⚠️ El RFC del CSD (${result.rfc}) no coincide con el RFC de la empresa (${datosFiscales.rfc}). Verifica que estés usando el CSD correcto.`)
        return
      }
      setCsd(s => ({
        ...s,
        rfcPreview: result.rfc, nombrePreview: result.nombre,
        vigenciaPreview: result.vigencia,
        cerB64Preview: cerB64, keyB64Preview: keyB64,
        validado: true,
      }))
      toast.success(`✅ CSD válido — RFC: ${result.rfc}`)
    } catch (e) {
      toast.error('Error al validar CSD: ' + e.message)
    } finally {
      mutarCsd('validando', false)
    }
  }

  const guardarCSD = async () => {
    if (!csd.validado) { toast.error('Primero valida el CSD'); return }
    mutarCsd('guardando', true)
    try {
      const cid = await getCompanyId()
      const { error } = await supabase.from('company_csd').upsert({
        company_id: cid, cer_base64: csd.cerB64Preview, key_base64: csd.keyB64Preview,
        password_hint: csd.password, rfc: csd.rfcPreview,
        nombre_titular: csd.nombrePreview, vigencia: csd.vigenciaPreview,
        configurada: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' })
      if (error) throw error
      setCsd({ ...firmaInicial(), configurada: true, rfc: csd.rfcPreview, nombre: csd.nombrePreview, vigencia: csd.vigenciaPreview, updatedAt: new Date().toISOString() })
      toast.success('🔏 CSD guardado correctamente')
    } catch (e) {
      toast.error('Error al guardar CSD: ' + e.message)
    } finally {
      mutarCsd('guardando', false)
    }
  }

  const eliminarCSD = async () => {
    mutarCsd('eliminando', true)
    try {
      const cid = await getCompanyId()
      const { error } = await supabase.from('company_csd')
        .update({ configurada: false, cer_base64: null, key_base64: null, password_hint: null })
        .eq('company_id', cid)
      if (error) throw error
      setCsd(firmaInicial())
      toast.success('CSD eliminado correctamente')
    } catch (e) {
      mutarCsd('eliminando', false)
      mutarCsd('confirmarEliminar', false)
      toast.error('Error al eliminar CSD: ' + e.message)
    }
  }

  // ─── e.firma ──────────────────────────────────────────────
  const validarEfirma = async () => {
    if (!efirma.cer || !efirma.key) { toast.error('Debes cargar el .cer y el .key de la e.firma'); return }
    if (!efirma.password.trim())    { toast.error('La contraseña de la e.firma es obligatoria');   return }
    mutarEfirma('validando', true)
    try {
      const cerB64 = await toBase64(efirma.cer)
      const keyB64 = await toBase64(efirma.key)
      const { data: result, error } = await supabase.functions.invoke('validar-efirma', {
        body: { cer_base64: cerB64, key_base64: keyB64, password: efirma.password }
      })
      if (error || !result?.valida) {
        toast.error(result?.mensaje || 'Par e.firma inválido. Verifica los archivos y la contraseña.')
        return
      }
      setEfirma(s => ({
        ...s,
        rfcPreview:      result.rfc,
        nombrePreview:   result.nombre,
        vigenciaPreview: result.vigencia,
        cerB64Preview:   cerB64,
        keyB64Preview:   keyB64,
        nombreManual:    '',
        validado:        true,
      }))
      // Conservado de v1.1: aviso diferenciado si nombre no se detectó
      if (!result.nombre || result.nombre === 'No detectado') {
        toast.warning('⚠️ Nombre del titular no detectado — captúralo manualmente antes de guardar.')
      } else {
        toast.success(`✅ e.firma válida — RFC: ${result.rfc}`)
      }
    } catch (e) {
      toast.error('Error al validar e.firma: ' + e.message)
    } finally {
      mutarEfirma('validando', false)
    }
  }

  const guardarEfirma = async () => {
    if (!efirma.validado) { toast.error('Primero valida la e.firma'); return }

    const nombreFinal = (
      !efirma.nombrePreview || efirma.nombrePreview === 'No detectado'
    )
      ? efirma.nombreManual?.trim()
      : efirma.nombrePreview

    // Conservado de v1.1: mensaje de error detallado
    if (!nombreFinal || nombreFinal.length < 3) {
      toast.error('El nombre del titular de la e.firma es obligatorio. Captúralo en el campo amarillo.')
      return
    }

    mutarEfirma('guardando', true)
    try {
      const cid = await getCompanyId()
      const { error } = await supabase.from('company_efirma').upsert({
        company_id:     cid,
        cer_base64:     efirma.cerB64Preview,
        key_base64:     efirma.keyB64Preview,
        password_hint:  efirma.password,
        rfc:            efirma.rfcPreview,
        nombre_titular: nombreFinal,
        vigencia:       efirma.vigenciaPreview,
        configurada:    true,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'company_id' })
      if (error) throw error
      setEfirma({
        ...firmaInicial(),
        configurada: true,
        rfc:         efirma.rfcPreview,
        nombre:      nombreFinal,
        vigencia:    efirma.vigenciaPreview,
        updatedAt:   new Date().toISOString(),
      })
      toast.success('🔐 e.firma guardada correctamente')
    } catch (e) {
      toast.error('Error al guardar e.firma: ' + e.message)
    } finally {
      mutarEfirma('guardando', false)
    }
  }

  const eliminarEfirma = async () => {
    mutarEfirma('eliminando', true)
    try {
      const cid = await getCompanyId()
      const { error } = await supabase.from('company_efirma')
        .update({ configurada: false, cer_base64: null, key_base64: null, password_hint: null })
        .eq('company_id', cid)
      if (error) throw error
      setEfirma(firmaInicial())
      toast.success('e.firma eliminada correctamente')
    } catch (e) {
      mutarEfirma('eliminando', false)
      mutarEfirma('confirmarEliminar', false)
      toast.error('Error al eliminar e.firma: ' + e.message)
    }
  }

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <MainLayout title="⚙️ Configuración de Empresa">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <RequirePermission module="settings" action="edit">
      <MainLayout title="⚙️ Configuración de Empresa">
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>

          {/* Empresa actual */}
          {companyName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
            }}>
              <Building2 size={18} color="#2563eb" />
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Configurando empresa</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#1d4ed8', margin: '2px 0 0' }}>{companyName}</p>
              </div>
            </div>
          )}

          {/* ── Pestañas ── */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '24px',
            backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '12px',
          }}>
            {[
              { id: 'general',  label: 'Configuración General', Icon: Building2 },
              { id: 'formatos', label: 'Formatos PDF',          Icon: FileText  },
            ].map(({ id, label, Icon }) => {
              const activa = tabActiva === id
              return (
                <button key={id} onClick={() => setTabActiva(id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px',
                    padding: '10px 16px', borderRadius: '9px', border: 'none',
                    backgroundColor: activa ? '#fff' : 'transparent',
                    color: activa ? '#1d4ed8' : '#6b7280',
                    cursor: 'pointer', fontSize: '13px',
                    fontWeight: activa ? '700' : '500',
                    boxShadow: activa ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                  <Icon size={15} />{label}
                </button>
              )
            })}
          </div>

          {/* ══════════════════════════════════════════════════
              TAB: CONFIGURACIÓN GENERAL
          ══════════════════════════════════════════════════ */}
          {tabActiva === 'general' && (
            <>
              {/* ── 1. Datos Fiscales ── */}
              <Section
                icon={Receipt}
                title="Datos Fiscales de la Empresa"
                subtitle="Requeridos para el Buzón Fiscal SAT y la emisión de CFDIs"
                accentColor="#059669"
                badge={
                  <BadgeCompleto
                    completo={datosFiscalesCompletos}
                    texto={datosFiscalesCompletos ? 'Completo' : 'Requerido'}
                  />
                }
              >
                {!datosFiscalesCompletos && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    backgroundColor: '#fef3c7', border: '1px solid #fde68a',
                    borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
                  }}>
                    <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0, lineHeight: '1.5' }}>
                      <strong>Datos incompletos.</strong> El Buzón Fiscal SAT y la Facturación
                      no funcionarán correctamente hasta que captures y guardes el RFC real,
                      la razón social, el régimen fiscal y el código postal de la empresa.
                    </p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field label="RFC de la empresa" required hint="RFC fiscal de la empresa (persona moral o física)">
                    <input
                      type="text" placeholder="Ej: ABC123456XY1"
                      value={datosFiscales.rfc} maxLength={13}
                      onChange={e => setDF('rfc', e.target.value.toUpperCase())}
                      style={{
                        width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                        border: `1px solid ${datosFiscales.rfc && !validarRFC(datosFiscales.rfc) ? '#fca5a5' : '#e5e7eb'}`,
                        borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                        fontFamily: 'monospace', outline: 'none',
                        backgroundColor: datosFiscales.rfc && !validarRFC(datosFiscales.rfc) ? '#fef2f2' : '#fff',
                      }}
                    />
                    {datosFiscales.rfc && !validarRFC(datosFiscales.rfc) && (
                      <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>
                        Formato inválido. Ej: XAXX010101000
                      </p>
                    )}
                  </Field>

                  <Field label="Código Postal Fiscal" required hint="CP del domicilio fiscal registrado ante el SAT">
                    <input
                      type="text" placeholder="Ej: 44100"
                      value={datosFiscales.cp_fiscal} maxLength={5}
                      onChange={e => setDF('cp_fiscal', e.target.value.replace(/\D/g, '').slice(0, 5))}
                      style={{
                        width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                        border: `1px solid ${datosFiscales.cp_fiscal && datosFiscales.cp_fiscal.length !== 5 ? '#fca5a5' : '#e5e7eb'}`,
                        borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                        fontFamily: 'monospace', outline: 'none',
                        backgroundColor: datosFiscales.cp_fiscal && datosFiscales.cp_fiscal.length !== 5 ? '#fef2f2' : '#fff',
                      }}
                    />
                    {datosFiscales.cp_fiscal && datosFiscales.cp_fiscal.length !== 5 && (
                      <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>
                        Debe tener exactamente 5 dígitos
                      </p>
                    )}
                  </Field>
                </div>

                <Field label="Razón Social" required hint="Nombre completo registrado ante el SAT — igual a la Constancia de Situación Fiscal">
                  <input
                    type="text" placeholder="Ej: CONSTRUCTORA EJEMPLO SA DE CV"
                    value={datosFiscales.razon_social}
                    onChange={e => setDF('razon_social', e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </Field>

                <Field label="Régimen Fiscal" required hint="Régimen bajo el que está registrada la empresa ante el SAT">
                  <select
                    value={datosFiscales.regimen_fiscal}
                    onChange={e => setDF('regimen_fiscal', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    {REGIMENES_FISCALES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Domicilio Fiscal" hint="Calle, número, colonia, ciudad, estado">
                  <input
                    type="text" placeholder="Ej: Av. Revolución 123, Col. Centro, Guadalajara, Jalisco"
                    value={datosFiscales.domicilio_fiscal}
                    onChange={e => setDF('domicilio_fiscal', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <Field label="Teléfono" style={{ marginBottom: 0 }}>
                    <input type="text" placeholder="33-1234-5678" value={datosFiscales.telefono}
                      onChange={e => setDF('telefono', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </Field>
                  <Field label="Email" style={{ marginBottom: 0 }}>
                    <input type="email" placeholder="contacto@empresa.com" value={datosFiscales.email}
                      onChange={e => setDF('email', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </Field>
                  <Field label="Sitio Web" style={{ marginBottom: 0 }}>
                    <input type="text" placeholder="www.empresa.com" value={datosFiscales.web}
                      onChange={e => setDF('web', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </Field>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button onClick={handleSaveDatosFiscales} disabled={savingFiscal}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      backgroundColor: savingFiscal ? '#6ee7b7' : '#059669',
                      color: '#fff', cursor: savingFiscal ? 'not-allowed' : 'pointer',
                      fontSize: '13px', fontWeight: '700', transition: 'background-color 0.2s',
                    }}>
                    <Save size={14} />
                    {savingFiscal ? 'Guardando...' : 'Guardar Datos Fiscales'}
                  </button>
                </div>
              </Section>

              {/* ── 2. Logotipos ── */}
              <Section
                icon={ImageIcon}
                title="Logotipos de la Empresa"
                subtitle="Logo Sistema (Login/Sidebar), Logo Documentos (PDFs) y Logo Alternativo"
                accentColor="#0891b2"
              >
                <LogotiposSection />
              </Section>

              {/* ── 3. e.firma ── */}
              <Section
                icon={ShieldCheck}
                title="e.firma — Antes FIEL"
                subtitle="Del representante legal — requerida para autenticarse ante el SAT en el Buzón Fiscal"
                accentColor="#2563eb"
                badge={
                  <BadgeCompleto
                    completo={efirma.configurada && efirma.nombre && efirma.nombre !== 'No detectado'}
                    texto={efirma.configurada ? 'Configurada' : 'Pendiente'}
                  />
                }
              >
                {efirma.confirmarEliminar && (
                  <ModalEliminar tipo="efirma" eliminando={efirma.eliminando}
                    onCancelar={() => mutarEfirma('confirmarEliminar', false)} onAceptar={eliminarEfirma} />
                )}

                {efirma.configurada && !efirma.modoRenovar && !efirma.confirmarEliminar && (
                  <>
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: '#15803d', margin: '0 0 8px' }}>e.firma configurada correctamente</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: '4px', columnGap: '16px' }}>
                              {[
                                ['RFC',      efirma.rfc],
                                ['Titular',  efirma.nombre],
                                ['Vigencia', efirma.vigencia ? new Date(efirma.vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : null],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <div key={k} style={{ display: 'contents' }}>
                                  <span style={{ fontSize: '12px', color: '#4b7c59', fontWeight: '600' }}>{k}</span>
                                  <span style={{
                                    fontSize: '12px',
                                    color: v === 'No detectado' ? '#d97706' : '#166534',
                                    fontWeight: v === 'No detectado' ? '700' : 'normal',
                                  }}>{v}</span>
                                </div>
                              ))}
                            </div>
                            {(!efirma.nombre || efirma.nombre === 'No detectado') && (
                              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706' }}>
                                <AlertTriangle size={13} />
                                <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                  Nombre no registrado — usa "Renovar" para capturarlo.
                                </span>
                              </div>
                            )}
                            {efirma.updatedAt && (
                              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '8px 0 0' }}>
                                Actualizado: {new Date(efirma.updatedAt).toLocaleDateString('es-MX')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                          <button onClick={() => mutarEfirma('modoRenovar', true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            <RotateCcw size={13} /> Renovar
                          </button>
                          <button onClick={() => mutarEfirma('confirmarEliminar', true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                    <AlertaVigencia vigencia={efirma.vigencia} />
                  </>
                )}

                {!efirma.configurada && !efirma.modoRenovar && !efirma.confirmarEliminar && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>Sin e.firma configurada — el Buzón Fiscal SAT no podrá descargar CFDIs.</p>
                  </div>
                )}

                {efirma.modoRenovar && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RotateCcw size={15} color="#2563eb" />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d4ed8' }}>Renovando e.firma — carga los nuevos archivos</span>
                    </div>
                    <button onClick={() => cancelarRenovar(setEfirma)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2563eb', fontWeight: '600', padding: '4px' }}>
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                )}

                {(!efirma.configurada || efirma.modoRenovar) && !efirma.confirmarEliminar && (
                  <AreaCarga
                    estado={efirma} color="#2563eb" colorBg="#eff6ff"
                    onCambiar={mutarEfirma} onValidar={validarEfirma} onGuardar={guardarEfirma}
                    onLimpiar={() => cancelarRenovar(setEfirma)}
                    labelGuardar="Guardar e.firma" labelPass="Contraseña de la e.firma (.key)"
                    mostrarNombreManual={true}
                  />
                )}
              </Section>

              {/* ── 3. CSD ── */}
              <Section
                icon={FileKey2}
                title="CSD — Certificado de Sello Digital"
                subtitle="De la empresa — requerido para firmar y timbrar CFDIs ante el PAC"
                accentColor="#7c3aed"
                badge={<BadgeCompleto completo={csd.configurada} texto={csd.configurada ? 'Configurado' : 'Pendiente'} />}
              >
                {csd.confirmarEliminar && (
                  <ModalEliminar tipo="csd" eliminando={csd.eliminando}
                    onCancelar={() => mutarCsd('confirmarEliminar', false)} onAceptar={eliminarCSD} />
                )}

                {/* Aviso si RFC empresa no está configurado aún */}
                {!datosFiscales.rfc && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
                      Primero guarda el RFC en <strong>Datos Fiscales</strong> para poder validar que el CSD pertenece a esta empresa.
                    </p>
                  </div>
                )}

                {csd.configurada && !csd.modoRenovar && !csd.confirmarEliminar && (
                  <>
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: '#15803d', margin: '0 0 8px' }}>CSD configurado correctamente</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: '4px', columnGap: '16px' }}>
                              {[
                                ['RFC',       csd.rfc],
                                ['Titular',   csd.nombre],
                                ['Vigencia',  csd.vigencia ? new Date(csd.vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : null],
                                ['No. Cert.', csd.noCertificado],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <div key={k} style={{ display: 'contents' }}>
                                  <span style={{ fontSize: '12px', color: '#4b7c59', fontWeight: '600' }}>{k}</span>
                                  <span style={{ fontSize: '12px', color: '#166534' }}>{v}</span>
                                </div>
                              ))}
                            </div>
                            {csd.updatedAt && (
                              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '8px 0 0' }}>
                                Actualizado: {new Date(csd.updatedAt).toLocaleDateString('es-MX')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                          <button onClick={() => mutarCsd('modoRenovar', true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #ddd6fe', backgroundColor: '#f5f3ff', color: '#6d28d9', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            <RotateCcw size={13} /> Renovar
                          </button>
                          <button onClick={() => mutarCsd('confirmarEliminar', true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                    <AlertaVigencia vigencia={csd.vigencia} />
                  </>
                )}

                {!csd.configurada && !csd.modoRenovar && !csd.confirmarEliminar && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>Sin CSD configurado — no podrás generar ni timbrar facturas en el sistema.</p>
                  </div>
                )}

                {csd.modoRenovar && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RotateCcw size={15} color="#7c3aed" />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#6d28d9' }}>Renovando CSD — carga los nuevos archivos</span>
                    </div>
                    <button onClick={() => cancelarRenovar(setCsd)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#7c3aed', fontWeight: '600', padding: '4px' }}>
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                )}

                {(!csd.configurada || csd.modoRenovar) && !csd.confirmarEliminar && (
                  <AreaCarga
                    estado={csd} color="#7c3aed" colorBg="#f5f3ff"
                    onCambiar={mutarCsd} onValidar={validarCSD} onGuardar={guardarCSD}
                    onLimpiar={() => cancelarRenovar(setCsd)}
                    labelGuardar="Guardar CSD" labelPass="Contraseña del CSD (.key)"
                    mostrarNombreManual={false}
                  />
                )}
              </Section>

              {/* ── 4. Moneda ── */}
              <Section icon={DollarSign} title="Moneda" subtitle="Configuración de moneda para precios y reportes">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px' }}>
                  <Field label="Código de moneda">
                    <select value={moneda.currency}
                      onChange={e => {
                        const symbols = { MXN: '$', USD: 'USD$', EUR: '€' }
                        setMoneda({ currency: e.target.value, currency_symbol: symbols[e.target.value] || '$' })
                      }}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}>
                      <option value="MXN">MXN — Peso Mexicano</option>
                      <option value="USD">USD — Dólar Americano</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </Field>
                  <Field label="Símbolo">
                    <input type="text" maxLength={5} value={moneda.currency_symbol}
                      onChange={e => setMoneda(m => ({ ...m, currency_symbol: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', fontWeight: '700', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
                  </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button onClick={handleSaveMoneda} disabled={savingMoneda}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      backgroundColor: savingMoneda ? '#93c5fd' : '#2563eb',
                      color: '#fff', cursor: savingMoneda ? 'not-allowed' : 'pointer',
                      fontSize: '13px', fontWeight: '700', transition: 'background-color 0.2s',
                    }}>
                    <Save size={14} />
                    {savingMoneda ? 'Guardando...' : 'Guardar Moneda'}
                  </button>
                </div>
              </Section>

              {/* Botón Restablecer — conservado de v1.1 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button
                  onClick={cargarTodo}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', borderRadius: '10px',
                    border: '1px solid #e5e7eb', backgroundColor: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px', color: '#374151',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={15} /> Restablecer
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════
              TAB: FORMATOS PDF
          ══════════════════════════════════════════════════ */}
          {tabActiva === 'formatos' && (
            <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '24px' }}>
              <FormatosTab />
            </div>
          )}

        </div>
      </MainLayout>

      <style>{`
        .hint-container:hover .hint-tooltip { display: block !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </RequirePermission>
  )
}