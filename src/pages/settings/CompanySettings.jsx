// src/pages/settings/CompanySettings.jsx
import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import { supabase } from '../../config/supabase'
import * as service from '../../services/companySettings.service'
import {
  DollarSign, TrendingUp, Shield, Save, RefreshCw, Building2, Info,
  KeyRound, Upload, CheckCircle2, AlertTriangle, Eye, EyeOff,
  Trash2, RotateCcw, FileKey2, ShieldCheck, X, AlertOctagon
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Componentes base
// ─────────────────────────────────────────────────────────────────────────────

const Field = ({ label, hint, children, style = {} }) => (
  <div style={{ marginBottom: '16px', ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{label}</label>
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

const Section = ({ icon: Icon, title, subtitle, children, accentColor = '#2563eb' }) => (
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
      <div>
        <p style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: 0 }}>{title}</p>
        {subtitle && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
    </div>
    <div style={{ padding: '20px' }}>{children}</div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmación de eliminación (inline, dentro de la sección)
// ─────────────────────────────────────────────────────────────────────────────
const ModalEliminar = ({ tipo, onCancelar, onAceptar, eliminando }) => {
  const esCSD = tipo === 'csd'
  return (
    <div style={{
      backgroundColor: '#fff9f9',
      border: '2px solid #fecaca',
      borderRadius: '14px',
      padding: '20px',
      marginBottom: '16px',
      animation: 'fadeInDown 0.2s ease',
    }}>
      {/* Encabezado */}
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
              ? 'Sin el CSD no podrás generar ni timbrar facturas (CFDIs) en el sistema. Esta acción eliminará los archivos del servidor.'
              : 'Sin la e.firma el Buzón Fiscal SAT dejará de funcionar y no podrás descargar CFDIs. Esta acción eliminará los archivos del servidor.'}
          </p>
          <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0, fontWeight: '600' }}>
            ⚠️ Para reactivarlo deberás volver a cargar y validar los certificados.
          </p>
        </div>
      </div>

      {/* Separador */}
      <div style={{ borderTop: '1px solid #fecaca', marginBottom: '16px' }} />

      {/* Botones */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancelar}
          disabled={eliminando}
          style={{
            padding: '9px 20px', borderRadius: '9px',
            border: '1px solid #e5e7eb', backgroundColor: '#fff',
            color: '#374151', cursor: eliminando ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '600',
            opacity: eliminando ? 0.5 : 1,
            transition: 'background-color 0.15s',
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
            transition: 'background-color 0.2s',
          }}
        >
          <Trash2 size={14} />
          {eliminando ? 'Eliminando...' : `Sí, eliminar ${esCSD ? 'CSD' : 'e.firma'}`}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Área de carga: .cer + .key + contraseña + Validar + Guardar
// ─────────────────────────────────────────────────────────────────────────────
const AreaCarga = ({ estado, color, colorBg, onCambiar, onValidar, onGuardar, labelGuardar, labelPass }) => (
  <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
      {[
        { campo: 'cer', nombreCampo: 'cerNombre', etiqueta: 'Certificado (.cer)', acepta: '.cer' },
        { campo: 'key', nombreCampo: 'keyNombre', etiqueta: 'Llave privada (.key)', acepta: '.key' },
      ].map(({ campo, nombreCampo, etiqueta, acepta }) => (
        <Field key={campo} label={etiqueta} style={{ marginBottom: 0 }}>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '6px', padding: '18px 12px',
            borderRadius: '10px', cursor: 'pointer', minHeight: '80px',
            border: estado[nombreCampo] ? '2px solid #16a34a' : '2px dashed #d1d5db',
            backgroundColor: estado[nombreCampo] ? '#f0fdf4' : '#fafafa',
            transition: 'border-color 0.2s, background-color 0.2s',
          }}>
            <input
              type="file"
              accept={acepta}
              style={{ display: 'none' }}
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
    <Field label={labelPass} style={{ marginBottom: '14px' }}>
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
        <button
          type="button"
          onClick={() => onCambiar('showPassword', !estado.showPassword)}
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
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
      </div>
    )}

    {/* Botones Validar / Guardar */}
    <div style={{ display: 'flex', gap: '10px' }}>
      <button
        onClick={onValidar}
        disabled={estado.validando || estado.guardando}
        style={{
          flex: estado.validado ? '0 0 auto' : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '7px', padding: '11px 20px', borderRadius: '10px',
          border: `1.5px solid ${color}`,
          backgroundColor: '#fff', color,
          cursor: (estado.validando || estado.guardando) ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: '600',
          opacity: (estado.validando || estado.guardando) ? 0.6 : 1,
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <Shield size={14} />
        {estado.validando ? 'Validando...' : 'Validar archivos'}
      </button>

      {estado.validado && (
        <button
          onClick={onGuardar}
          disabled={estado.guardando}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '7px', padding: '11px 20px', borderRadius: '10px',
            border: `1.5px solid ${color}`,
            backgroundColor: estado.guardando ? colorBg : color,
            color: estado.guardando ? color : '#fff',
            cursor: estado.guardando ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '700',
            transition: 'all 0.2s',
          }}
        >
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

// ─────────────────────────────────────────────────────────────────────────────
// Alerta de vigencia próxima a vencer o vencida
// ─────────────────────────────────────────────────────────────────────────────
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
          : `⚠️ Vence en ${dias} día${dias === 1 ? '' : 's'} — renueva antes de que expire para evitar interrupciones.`}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial de una firma digital
// ─────────────────────────────────────────────────────────────────────────────
const firmaInicial = () => ({
  cer: null, key: null, cerNombre: '', keyNombre: '',
  password: '', showPassword: false,
  modoRenovar: false,
  validando: false, guardando: false, eliminando: false,
  validado: false,
  confirmarEliminar: false,       // ← controla si se muestra el modal inline
  rfcPreview: '', nombrePreview: '', vigenciaPreview: '',
  cerB64Preview: '', keyB64Preview: '',
  configurada: false, rfc: '', nombre: '', vigencia: '',
  noCertificado: '', updatedAt: '',
})

// ─────────────────────────────────────────────────────────────────────────────
// Página Principal
// ─────────────────────────────────────────────────────────────────────────────
export const CompanySettings = () => {
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [settings,    setSettings]    = useState({
    approval_limit_jefe_obra: 2000,
    currency:                 'MXN',
    currency_symbol:          '$',
    default_inflation_factor: 0,
    default_management_cost:  0,
  })
  const [companyName, setCompanyName] = useState('')
  const [companyId,   setCompanyId]   = useState(null)
  const [csd,         setCsd]         = useState(firmaInicial())
  const [efirma,      setEfirma]      = useState(firmaInicial())
  const { toast } = useToast()

  const mutar = (setter) => (k, v) => setter(s => ({ ...s, [k]: v }))
  const mutarCsd    = mutar(setCsd)
  const mutarEfirma = mutar(setEfirma)

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { cargarTodo() }, [])

  const cargarTodo = async () => {
    setLoading(true)
    const { data, error } = await service.getSettings()
    if (error) {
      toast.warning('No se encontró configuración. Se usarán valores por defecto.')
    } else if (data) {
      setSettings({
        approval_limit_jefe_obra: data.approval_limit_jefe_obra,
        currency:                 data.currency,
        currency_symbol:          data.currency_symbol,
        default_inflation_factor: parseFloat((data.default_inflation_factor * 100).toFixed(4)),
        default_management_cost:  parseFloat((data.default_management_cost  * 100).toFixed(4)),
      })
      setCompanyName(data.companies?.name || '')
      const cid = data.company_id
      setCompanyId(cid)

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

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  // ── Guardar configuración general ─────────────────────────────────────────
  const handleSaveGeneral = async () => {
    if (parseFloat(settings.approval_limit_jefe_obra) <= 0) {
      toast.error('El límite de aprobación debe ser mayor a 0')
      return
    }
    if (!settings.currency.trim() || !settings.currency_symbol.trim()) {
      toast.error('La moneda y símbolo son obligatorios')
      return
    }
    setSaving(true)
    const { error } = await service.saveSettings(settings)
    if (error) toast.error('Error al guardar: ' + error.message)
    else       toast.success('✅ Configuración guardada correctamente')
    setSaving(false)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const getCompanyId = async () => {
    if (companyId) return companyId
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p }        = await supabase
      .from('users_profiles').select('company_id').eq('id', user.id).single()
    return p.company_id
  }

  const cancelarRenovar = (setter) => setter(s => ({
    ...s, modoRenovar: false, validado: false,
    cer: null, key: null, cerNombre: '', keyNombre: '', password: '',
    rfcPreview: '', nombrePreview: '', vigenciaPreview: '',
    cerB64Preview: '', keyB64Preview: '',
  }))

  // ─────────────────────────────────────────────────────────────────────────
  // CSD
  // ─────────────────────────────────────────────────────────────────────────
  const validarCSD = async () => {
    if (!csd.cer || !csd.key)     { toast.error('Debes cargar el .cer y el .key del CSD'); return }
    if (!csd.password.trim())     { toast.error('La contraseña del CSD es obligatoria');   return }
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

  // ─────────────────────────────────────────────────────────────────────────
  // e.firma
  // ─────────────────────────────────────────────────────────────────────────
  const validarEfirma = async () => {
    if (!efirma.cer || !efirma.key)  { toast.error('Debes cargar el .cer y el .key de la e.firma'); return }
    if (!efirma.password.trim())     { toast.error('La contraseña de la e.firma es obligatoria');   return }
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
        rfcPreview: result.rfc, nombrePreview: result.nombre,
        vigenciaPreview: result.vigencia,
        cerB64Preview: cerB64, keyB64Preview: keyB64,
        validado: true,
      }))
      toast.success(`✅ e.firma válida — RFC: ${result.rfc}`)
    } catch (e) {
      toast.error('Error al validar e.firma: ' + e.message)
    } finally {
      mutarEfirma('validando', false)
    }
  }

  const guardarEfirma = async () => {
    if (!efirma.validado) { toast.error('Primero valida la e.firma'); return }
    mutarEfirma('guardando', true)
    try {
      const cid = await getCompanyId()
      const { error } = await supabase.from('company_efirma').upsert({
        company_id: cid, cer_base64: efirma.cerB64Preview, key_base64: efirma.keyB64Preview,
        password_hint: efirma.password, rfc: efirma.rfcPreview,
        nombre_titular: efirma.nombrePreview, vigencia: efirma.vigenciaPreview,
        configurada: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' })
      if (error) throw error
      setEfirma({ ...firmaInicial(), configurada: true, rfc: efirma.rfcPreview, nombre: efirma.nombrePreview, vigencia: efirma.vigenciaPreview, updatedAt: new Date().toISOString() })
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

  // Vista previa costos
  const examplePurchase  = 1000
  const mgmtCostPct      = parseFloat(settings.default_management_cost)  / 100 || 0
  const inflationPct     = parseFloat(settings.default_inflation_factor) / 100 || 0
  const exampleSalePrice = examplePurchase * (1 + mgmtCostPct + inflationPct)
  const exampleMargin    = exampleSalePrice - examplePurchase
  const exampleMarginPct = ((exampleMargin / examplePurchase) * 100).toFixed(2)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <MainLayout title="⚙️ Configuración de Empresa">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <RequirePermission module="settings" action="edit">
      <MainLayout title="⚙️ Configuración de Empresa">
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>

          {/* Empresa actual */}
          {companyName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: '12px', padding: '12px 16px', marginBottom: '24px',
            }}>
              <Building2 size={18} color="#2563eb" />
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Configurando empresa</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#1d4ed8', margin: '2px 0 0' }}>{companyName}</p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              Sección 1 — Niveles de Aprobación
          ══════════════════════════════════════════════════════════════════ */}
          <Section icon={Shield} title="Niveles de Aprobación" subtitle="Define quién aprueba las solicitudes de materiales según el monto">
            <Field label="Límite para aprobación de Jefe de Obra" hint="Solicitudes hasta este monto las aprueba el Jefe de Obra. Las mayores requieren Admin Empresa.">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ padding: '10px 12px', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>
                  {settings.currency_symbol}
                </span>
                <input
                  type="number" min="1" step="100"
                  value={settings.approval_limit_jefe_obra}
                  onChange={e => set('approval_limit_jefe_obra', e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '0 8px 8px 0', fontSize: '14px', fontWeight: '600', outline: 'none', color: '#111827' }}
                />
              </div>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#166534', textTransform: 'uppercase', margin: '0 0 4px' }}>👷 Jefe de Obra aprueba</p>
                <p style={{ fontSize: '16px', fontWeight: '700', color: '#15803d', margin: 0 }}>Hasta {settings.currency_symbol}{Number(settings.approval_limit_jefe_obra).toLocaleString('es-MX')}</p>
              </div>
              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af', textTransform: 'uppercase', margin: '0 0 4px' }}>🏢 Admin Empresa aprueba</p>
                <p style={{ fontSize: '16px', fontWeight: '700', color: '#1d4ed8', margin: 0 }}>Más de {settings.currency_symbol}{Number(settings.approval_limit_jefe_obra).toLocaleString('es-MX')}</p>
              </div>
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              Sección 2 — Moneda
          ══════════════════════════════════════════════════════════════════ */}
          <Section icon={DollarSign} title="Moneda" subtitle="Configuración de moneda para precios y reportes">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px' }}>
              <Field label="Código de moneda">
                <select
                  value={settings.currency}
                  onChange={e => {
                    const symbols = { MXN: '$', USD: 'USD$', EUR: '€' }
                    set('currency', e.target.value)
                    set('currency_symbol', symbols[e.target.value] || '$')
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
                >
                  <option value="MXN">MXN — Peso Mexicano</option>
                  <option value="USD">USD — Dólar Americano</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </Field>
              <Field label="Símbolo">
                <input type="text" maxLength={5} value={settings.currency_symbol} onChange={e => set('currency_symbol', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', fontWeight: '700', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
              </Field>
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              Sección 3 — Costos por defecto
          ══════════════════════════════════════════════════════════════════ */}
          <Section icon={TrendingUp} title="Factores de Costo por Defecto" subtitle="Se aplican a materiales sin precio específico configurado">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Costo de Gestión %" hint="Porcentaje adicional por flete, maniobras y almacenaje">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="number" min="0" max="100" step="0.1" value={settings.default_management_cost} onChange={e => set('default_management_cost', e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px 0 0 8px', fontSize: '14px', fontWeight: '600', outline: 'none' }} />
                  <span style={{ padding: '10px 12px', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: '14px', color: '#6b7280' }}>%</span>
                </div>
              </Field>
              <Field label="Factor Inflacionario %" hint="Porcentaje de ajuste por inflación o indexación de precios">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="number" min="0" max="100" step="0.1" value={settings.default_inflation_factor} onChange={e => set('default_inflation_factor', e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px 0 0 8px', fontSize: '14px', fontWeight: '600', outline: 'none' }} />
                  <span style={{ padding: '10px 12px', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: '14px', color: '#6b7280' }}>%</span>
                </div>
              </Field>
            </div>
            {(mgmtCostPct > 0 || inflationPct > 0) && (
              <div style={{ backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginTop: '8px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase' }}>📊 Vista previa — Material con precio de compra {settings.currency_symbol}1,000</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Precio Compra', value: `${settings.currency_symbol}${examplePurchase.toFixed(2)}`,                    color: '#374151' },
                    { label: 'Costo Gestión', value: `+ ${settings.currency_symbol}${(examplePurchase * mgmtCostPct).toFixed(2)}`, color: '#d97706' },
                    { label: 'Inflación',      value: `+ ${settings.currency_symbol}${(examplePurchase * inflationPct).toFixed(2)}`,color: '#7c3aed' },
                    { label: 'Precio a Obra', value: `${settings.currency_symbol}${exampleSalePrice.toFixed(2)}`,                  color: '#059669' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 4px' }}>{item.label}</p>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: item.color, margin: 0 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>Margen total: {settings.currency_symbol}{exampleMargin.toFixed(2)} ({exampleMarginPct}%)</span>
                </div>
              </div>
            )}
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              Sección 4 — CSD
          ══════════════════════════════════════════════════════════════════ */}
          <Section icon={FileKey2} title="CSD — Certificado de Sello Digital" subtitle="Requerido para firmar y timbrar CFDIs ante el PAC" accentColor="#7c3aed">

            {/* Modal de confirmación eliminar CSD */}
            {csd.confirmarEliminar && (
              <ModalEliminar
                tipo="csd"
                eliminando={csd.eliminando}
                onCancelar={() => mutarCsd('confirmarEliminar', false)}
                onAceptar={eliminarCSD}
              />
            )}

            {/* Estado: configurado */}
            {csd.configurada && !csd.modoRenovar && !csd.confirmarEliminar && (
              <>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    {/* Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '700', color: '#15803d', margin: '0 0 8px' }}>CSD configurado correctamente</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: '4px', columnGap: '16px' }}>
                          {[
                            ['RFC',        csd.rfc],
                            ['Titular',    csd.nombre],
                            ['Vigencia',   csd.vigencia ? new Date(csd.vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : null],
                            ['No. Cert.',  csd.noCertificado],
                          ].filter(([, v]) => v).map(([k, v]) => (
                            <div key={k} style={{ display: 'contents' }}>
                              <span style={{ fontSize: '12px', color: '#4b7c59', fontWeight: '600' }}>{k}</span>
                              <span style={{ fontSize: '12px', color: '#166534' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        {csd.updatedAt && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '8px 0 0' }}>Actualizado: {new Date(csd.updatedAt).toLocaleDateString('es-MX')}</p>}
                      </div>
                    </div>
                    {/* Acciones */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => mutarCsd('modoRenovar', true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #ddd6fe', backgroundColor: '#f5f3ff', color: '#6d28d9', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}
                      >
                        <RotateCcw size={13} /> Renovar
                      </button>
                      <button
                        onClick={() => mutarCsd('confirmarEliminar', true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}
                      >
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
                <AlertaVigencia vigencia={csd.vigencia} />
              </>
            )}

            {/* Estado: sin configurar */}
            {!csd.configurada && !csd.modoRenovar && !csd.confirmarEliminar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>Sin CSD configurado — no podrás generar ni timbrar facturas en el sistema.</p>
              </div>
            )}

            {/* Encabezado modo renovar */}
            {csd.modoRenovar && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCcw size={15} color="#7c3aed" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#6d28d9' }}>Renovando CSD — carga los nuevos archivos</span>
                </div>
                <button onClick={() => cancelarRenovar(setCsd)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#7c3aed', fontWeight: '600', padding: '4px' }}>
                  <X size={14} /> Cancelar
                </button>
              </div>
            )}

            {/* Área de carga */}
            {(!csd.configurada || csd.modoRenovar) && !csd.confirmarEliminar && (
              <AreaCarga
                estado={csd} color="#7c3aed" colorBg="#f5f3ff"
                onCambiar={mutarCsd} onValidar={validarCSD} onGuardar={guardarCSD}
                labelGuardar="Guardar CSD"
                labelPass="Contraseña del CSD (.key)"
              />
            )}
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              Sección 5 — e.firma
          ══════════════════════════════════════════════════════════════════ */}
          <Section icon={ShieldCheck} title="e.firma — Antes FIEL" subtitle="Requerida para autenticarse ante el SAT en el Buzón Fiscal" accentColor="#2563eb">

            {/* Modal de confirmación eliminar e.firma */}
            {efirma.confirmarEliminar && (
              <ModalEliminar
                tipo="efirma"
                eliminando={efirma.eliminando}
                onCancelar={() => mutarEfirma('confirmarEliminar', false)}
                onAceptar={eliminarEfirma}
              />
            )}

            {/* Estado: configurada */}
            {efirma.configurada && !efirma.modoRenovar && !efirma.confirmarEliminar && (
              <>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    {/* Info */}
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
                              <span style={{ fontSize: '12px', color: '#166534' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        {efirma.updatedAt && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '8px 0 0' }}>Actualizado: {new Date(efirma.updatedAt).toLocaleDateString('es-MX')}</p>}
                      </div>
                    </div>
                    {/* Acciones */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => mutarEfirma('modoRenovar', true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}
                      >
                        <RotateCcw size={13} /> Renovar
                      </button>
                      <button
                        onClick={() => mutarEfirma('confirmarEliminar', true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}
                      >
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
                <AlertaVigencia vigencia={efirma.vigencia} />
              </>
            )}

            {/* Estado: sin configurar */}
            {!efirma.configurada && !efirma.modoRenovar && !efirma.confirmarEliminar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>Sin e.firma configurada — el Buzón Fiscal SAT no podrá descargar CFDIs.</p>
              </div>
            )}

            {/* Encabezado modo renovar */}
            {efirma.modoRenovar && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCcw size={15} color="#2563eb" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d4ed8' }}>Renovando e.firma — carga los nuevos archivos</span>
                </div>
                <button onClick={() => cancelarRenovar(setEfirma)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2563eb', fontWeight: '600', padding: '4px' }}>
                  <X size={14} /> Cancelar
                </button>
              </div>
            )}

            {/* Área de carga */}
            {(!efirma.configurada || efirma.modoRenovar) && !efirma.confirmarEliminar && (
              <AreaCarga
                estado={efirma} color="#2563eb" colorBg="#eff6ff"
                onCambiar={mutarEfirma} onValidar={validarEfirma} onGuardar={guardarEfirma}
                labelGuardar="Guardar e.firma"
                labelPass="Contraseña de la e.firma (.key)"
              />
            )}
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              Botones — Guardar configuración general
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={cargarTodo}
              disabled={loading || saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
            >
              <RefreshCw size={15} /> Restablecer
            </button>
            <button
              onClick={handleSaveGeneral}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '10px', border: 'none', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', transition: 'background-color 0.2s' }}
            >
              <Save size={15} />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>

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