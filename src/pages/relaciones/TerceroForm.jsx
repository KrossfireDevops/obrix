// src/pages/relaciones/TerceroForm.jsx
// Módulo: Gestión de Relaciones Comerciales
// Flujo rediseñado: CSF primero → auto-llenado → Nivel 1 → Nivel 2
// Paso 1: Cargar CSF (obligatorio)
// Paso 2: Confirmar datos + direcciones opcionales (Nivel 1 mínimo)
// Paso 3: Documentación complementaria (Nivel 2 óptimo)

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import * as service from '../../services/terceros.service'
import { parsearDocumento } from '../../services/documentParser.service'
import { DocumentUploadValidator } from '../../components/fiscal/DocumentUploadValidator'
import {
  ChevronRight, ChevronLeft, CheckCircle, AlertTriangle,
  Info, Shield, Star, RefreshCw, FileText, MapPin,
  Building2, Truck, Upload, Edit3, Lock
} from 'lucide-react'

// ── Catálogos SAT ─────────────────────────────────────────────────────────────
const REGIMENES = [
  { clave: '601', desc: 'General de Ley Personas Morales' },
  { clave: '603', desc: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', desc: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', desc: 'Arrendamiento' },
  { clave: '612', desc: 'Personas Físicas con Actividades Empresariales' },
  { clave: '616', desc: 'Sin obligaciones fiscales' },
  { clave: '621', desc: 'Incorporación Fiscal' },
  { clave: '626', desc: 'Régimen Simplificado de Confianza (RESICO)' },
]

const USOS_CFDI = [
  { clave: 'G01', desc: 'Adquisición de mercancias' },
  { clave: 'G03', desc: 'Gastos en general' },
  { clave: 'I01', desc: 'Construcciones' },
  { clave: 'I04', desc: 'Equipo de computo y accesorios' },
  { clave: 'S01', desc: 'Sin efectos fiscales' },
  { clave: 'CP01', desc: 'Pagos' },
]

// ── Componentes UI base ───────────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151',
    marginBottom: '4px', display: 'block' }}>
    {children} {required && <span style={{ color: '#DC2626' }}>*</span>}
  </label>
)

const Input = ({ error, readOnly, locked, ...props }) => (
  <div style={{ position: 'relative' }}>
    <input {...props} readOnly={readOnly || locked}
      style={{
        width: '100%', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box',
        border: `1px solid ${error ? '#FCA5A5' : locked ? '#BFDBFE' : '#E5E7EB'}`,
        borderRadius: '8px', outline: 'none',
        backgroundColor: locked ? '#EFF6FF' : readOnly ? '#F9FAFB' : '#fff',
        color: locked ? '#1E40AF' : readOnly ? '#6B7280' : '#111827',
        paddingRight: locked ? '36px' : '12px',
      }} />
    {locked && (
      <Lock size={13} style={{ position: 'absolute', right: '10px', top: '50%',
        transform: 'translateY(-50%)', color: '#93C5FD' }} />
    )}
  </div>
)

const Select = ({ error, children, ...props }) => (
  <select {...props} style={{
    width: '100%', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box',
    border: `1px solid ${error ? '#FCA5A5' : '#E5E7EB'}`,
    borderRadius: '8px', outline: 'none', backgroundColor: '#fff',
  }}>
    {children}
  </select>
)

const FieldError = ({ msg }) => msg
  ? <p style={{ fontSize: '12px', color: '#DC2626', margin: '4px 0 0' }}>{msg}</p>
  : null

// ── Indicador de pasos ────────────────────────────────────────────────────────
const StepIndicator = ({ paso, csf_ok }) => {
  const pasos = [
    { n: 1, icon: '📄', label: 'Cargar CSF' },
    { n: 2, icon: '✏️',  label: 'Datos y Direcciones' },
    { n: 3, icon: '⭐',  label: 'Documentación Óptima' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {pasos.map((p, i) => (
        <div key={p.n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              border: `2px solid ${paso === p.n ? '#1E40AF' : paso > p.n ? '#10B981' : '#E5E7EB'}`,
              backgroundColor: paso === p.n ? '#1E40AF' : paso > p.n ? '#D1FAE5' : '#F9FAFB',
            }}>
              {paso > p.n ? <CheckCircle size={18} color="#059669" /> : p.icon}
            </div>
            <span style={{ fontSize: '11px', fontWeight: paso === p.n ? '700' : '400',
              color: paso === p.n ? '#1E40AF' : paso > p.n ? '#059669' : '#9CA3AF',
              whiteSpace: 'nowrap' }}>
              {p.label}
            </span>
          </div>
          {i < 2 && (
            <div style={{ flex: 1, height: '2px', margin: '0 8px', marginBottom: '16px',
              backgroundColor: paso > p.n ? '#10B981' : '#E5E7EB' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Bloque de alerta de campos pendientes ─────────────────────────────────────
const AlertasPendientes = ({ alertas }) => {
  if (!alertas.length) return null
  return (
    <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
      borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400E', margin: '0 0 6px' }}>
            Documentación pendiente para estado ÓPTIMO
          </p>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {alertas.map((a, i) => (
              <li key={i} style={{ fontSize: '12px', color: '#B45309', marginBottom: '2px' }}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Sección de Dirección ──────────────────────────────────────────────────────
const SeccionDireccion = ({ titulo, icono, color, bg, datos, onChange, locked = false, opcional = false }) => {
  const [expandida, setExpandida] = useState(!opcional)

  return (
    <div style={{ border: `1px solid ${color}30`, borderRadius: '12px',
      overflow: 'hidden', marginBottom: '12px' }}>
      <div
        onClick={() => opcional && setExpandida(e => !e)}
        style={{ padding: '12px 16px', backgroundColor: bg, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          cursor: opcional ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{icono}</span>
          <span style={{ fontSize: '13px', fontWeight: '700', color }}>
            {titulo}
          </span>
          {opcional && (
            <span style={{ fontSize: '11px', color: '#9CA3AF',
              backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '9999px' }}>
              Opcional
            </span>
          )}
          {locked && (
            <span style={{ fontSize: '11px', color: '#1E40AF',
              backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '9999px',
              display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Lock size={10} /> Auto-llenada desde CSF
            </span>
          )}
        </div>
        {opcional && (
          <ChevronRight size={16} color="#9CA3AF"
            style={{ transform: expandida ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        )}
      </div>

      {expandida && (
        <div style={{ padding: '16px', display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#fff' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Calle / Vialidad</Label>
            <Input value={datos.calle || ''} locked={locked}
              onChange={e => onChange('calle', e.target.value)}
              placeholder="Nombre de la calle o vialidad" />
          </div>
          <div>
            <Label>Número Exterior</Label>
            <Input value={datos.numero_exterior || ''} locked={locked}
              onChange={e => onChange('numero_exterior', e.target.value)}
              placeholder="Ej: 654" />
          </div>
          <div>
            <Label>Número Interior</Label>
            <Input value={datos.numero_interior || ''} locked={locked}
              onChange={e => onChange('numero_interior', e.target.value)}
              placeholder="Ej: 13" />
          </div>
          <div>
            <Label>Colonia</Label>
            <Input value={datos.colonia || ''} locked={locked}
              onChange={e => onChange('colonia', e.target.value)}
              placeholder="Nombre de la colonia" />
          </div>
          <div>
            <Label>Código Postal</Label>
            <Input value={datos.codigo_postal || ''} locked={locked}
              onChange={e => onChange('codigo_postal', e.target.value.replace(/\D/g,'').slice(0,5))}
              placeholder="00000" maxLength={5} />
          </div>
          <div>
            <Label>Municipio / Alcaldía</Label>
            <Input value={datos.municipio || ''} locked={locked}
              onChange={e => onChange('municipio', e.target.value)}
              placeholder="Municipio o delegación" />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={datos.estado || ''} locked={locked}
              onChange={e => onChange('estado', e.target.value)}
              placeholder="Estado de la república" />
          </div>
          {!locked && (
            <>
              <div>
                <Label>Contacto (nombre)</Label>
                <Input value={datos.contacto_nombre || ''}
                  onChange={e => onChange('contacto_nombre', e.target.value)}
                  placeholder="Nombre del contacto" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={datos.contacto_tel || ''}
                  onChange={e => onChange('contacto_tel', e.target.value)}
                  placeholder="10 dígitos" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Label>Referencias / Indicaciones</Label>
                <Input value={datos.referencia || ''}
                  onChange={e => onChange('referencia', e.target.value)}
                  placeholder="Entre calles, referencias para llegar..." />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export const TerceroForm = () => {
  const navigate  = useNavigate()
  const { toast } = useToast()

  const [paso,    setPaso]    = useState(1)
  const [avisos,  setAvisos]  = useState({}) // notificaciones de campo vacío/inválido
  const [saving,  setSaving]  = useState(false)
  const [errors,  setErrors]  = useState({})

  // Estado CSF
  const [csfArchivo,    setCsfArchivo]    = useState(null)
  const [csfParsing,    setCsfParsing]    = useState(false)
  const [csfResultado,  setCsfResultado]  = useState(null)  // resultado del parser
  const [csfManual,     setCsfManual]     = useState(false) // modo captura manual

  // Datos del formulario
  const [form, setForm] = useState({
    // ── Bloque 1: Datos fiscales SAT (orden CSF) ──
    rfc:                      '',   // obligatorio
    razon_social:             '',   // obligatorio — Denominación/Razón Social
    regimen_capital:          '',   // obligatorio — ej: SOCIEDAD ANONIMA DE CAPITAL VARIABLE
    nombre_comercial:         '',   // opcional
    fecha_inicio_ops:         '',   // obligatorio — YYYY-MM-DD
    estatus_padron:           '',   // obligatorio — ACTIVO | SUSPENDIDO | CANCELADO
    fecha_ultimo_cambio:      '',   // obligatorio — YYYY-MM-DD
    regimen_fiscal:           '',   // obligatorio — clave SAT (601, 626, etc.)
    // ── Bloque 2: Datos de contacto OBRIX (no vienen en CSF) ──
    tipo:                     'proveedor',
    uso_cfdi_default:         'G03',
    email:                    '',
    telefono:                 '',
    // ── Nivel 2 ──
    opinion_32d_estatus:      '',
    opinion_32d_fecha:        '',
    csd_numero:               '',
    csd_vencimiento:          '',
    csd_estatus:              'no_verificado',
    clabe:                    '',
    clabe_titular:            '',
    clabe_verificada:         false,
    repse_numero:             '',
  })

  // Direcciones
  const [dirFiscal, setDirFiscal] = useState({
    // Campos exactos de la CSF SAT
    codigo_postal:    '',
    tipo_vialidad:    '',   // ej: AVENIDA (AV.)
    nombre_vialidad:  '',   // ej: AV DE LAS AMERICAS
    numero_exterior:  '',
    numero_interior:  '',
    colonia:          '',
    localidad:        '',   // Nombre de la Localidad
    municipio:        '',
    estado:           '',   // Entidad Federativa
    entre_calle:      '',   // Entre Calle
    y_calle:          '',   // Y Calle
    fuente_csf:       false,
  })
  const [dirAdmin, setDirAdmin] = useState({
    calle: '', numero_exterior: '', numero_interior: '',
    colonia: '', codigo_postal: '', municipio: '', estado: '',
    contacto_nombre: '', contacto_tel: '', referencia: ''
  })
  const [dirEntrega, setDirEntrega] = useState({
    calle: '', numero_exterior: '', numero_interior: '',
    colonia: '', codigo_postal: '', municipio: '', estado: '',
    contacto_nombre: '', contacto_tel: '', referencia: ''
  })

  // Archivos Nivel 2
  const [archivos, setArchivos] = useState({
    opinion_32d: null, csd: null, estado_cuenta: null, repse: null
  })

  // ── useEffect: evaluar avisos al entrar al paso 2 ───────────────────────────
  // Garantiza que el panel de notificaciones aparezca incluyendo en modo manual
  useEffect(() => {
    if (paso === 2) {
      evaluarAvisos(form)
    }
  }, [paso]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Alertas pendientes calculadas dinámicamente ───────────────────────────
  const alertasPendientes = () => {
    const alertas = []
    if (!form.opinion_32d_estatus) alertas.push('Opinión de Cumplimiento 32-D — requerida para operar sin riesgo')
    if (form.csd_estatus !== 'vigente') alertas.push('Certificado de Sello Digital (CSD) — necesario para timbrado')
    if (!form.clabe_verificada)    alertas.push('CLABE bancaria — sin verificar, riesgo en transferencias')
    return alertas
  }

  // ── PASO 1: Procesar CSF ─────────────────────────────────────────────────
  const procesarCSF = async (file) => {
    setCsfArchivo(file)
    setCsfParsing(true)
    setCsfResultado(null)

    const { success, resultado } = await parsearDocumento(file, 'CSF', null)
    setCsfParsing(false)

    if (!success || !resultado) {
      setCsfResultado({ es_documento_correcto: false, errores: ['No se pudo conectar con el validador.'] })
      return
    }

    setCsfResultado(resultado)

    if (resultado.es_documento_correcto) {
      // Auto-llenar formulario con datos de CSF
      const d = resultado.datos_extraidos

      // FIX Bug 4: resolver clave de régimen con fallback desde texto largo
      const MAPA_REGIMENES_FORM = [
        { patron: /General\s+de\s+Ley\s+Personas\s+Morales/i,              clave: '601' },
        { patron: /Personas\s+Morales\s+con\s+Fines\s+no\s+Lucrativos/i,  clave: '603' },
        { patron: /Sueldos\s+y\s+Salarios/i,                                  clave: '605' },
        { patron: /Arrendamiento/i,                                              clave: '606' },
        { patron: /Actividades\s+Empresariales/i,                               clave: '612' },
        { patron: /Sin\s+obligaciones\s+fiscales/i,                            clave: '616' },
        { patron: /Incorporaci[oó]n\s+Fiscal/i,                                clave: '621' },
        { patron: /R[eé]gimen\s+Simplificado\s+de\s+Confianza|RESICO/i,     clave: '626' },
      ]

      const resolverClaveRegimen = (datos) => {
        // 1. Si el parser ya resolvió la clave — usar directamente
        if (datos.clave_regimen) return datos.clave_regimen
        // 2. Intentar inferir desde el texto largo de regimen_fiscal
        if (datos.regimen_fiscal) {
          for (const { patron, clave } of MAPA_REGIMENES_FORM) {
            if (patron.test(datos.regimen_fiscal)) return clave
          }
        }
        // 3. Sin resolución — dejar vacío para que el usuario elija
        return ''
      }

      // FIX Bug 1 (seguridad extra): limpiar nombre por si parser antiguo
      // todavía captura prefijos del SAT
      const limpiarNombreForm = (nombre) => {
        if (!nombre) return ''
        return nombre
          .replace(/^Registro\s+Federal\s+de\s+Contribuyentes\s*/i, '')
          .replace(/^Constancia\s+de\s+Situaci[oó]n\s+Fiscal\s*/i, '')
          .replace(/\s*(Capital|Nombre\s+Comercial|Giro)[:\s].*/i, '')
          .replace(/^[,.:;\s]+|[,.:;\s]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      }

      setForm(f => ({
        ...f,
        // Bloque 1 — datos SAT en orden CSF
        rfc:                  d.rfc                                     || f.rfc,
        razon_social:         limpiarNombreForm(d.nombre)               || f.razon_social,
        regimen_capital:      d.regimen_capital                         || f.regimen_capital,
        nombre_comercial:     d.nombre_comercial                        || f.nombre_comercial,
        fecha_inicio_ops:     d.fecha_inicio_ops                        || f.fecha_inicio_ops,
        estatus_padron:       d.estatus                                 || f.estatus_padron,
        fecha_ultimo_cambio:  d.fecha_ultimo_cambio                     || f.fecha_ultimo_cambio,
        regimen_fiscal:       resolverClaveRegimen(d)                   || f.regimen_fiscal,
      }))
      // Auto-llenar dirección fiscal con todos los campos de la CSF
      setDirFiscal({
        codigo_postal:   d.codigo_postal                || '',
        tipo_vialidad:   d.domicilio?.tipo_vialidad     || '',
        nombre_vialidad: d.domicilio?.nombre_vialidad   || d.domicilio?.calle || '',
        numero_exterior: d.domicilio?.numero_exterior   || '',
        numero_interior: d.domicilio?.numero_interior   || '',
        colonia:         d.domicilio?.colonia           || '',
        localidad:       d.domicilio?.localidad         || '',
        municipio:       d.domicilio?.municipio         || '',
        estado:          d.domicilio?.estado            || '',
        entre_calle:     d.domicilio?.entre_calle       || '',
        y_calle:         d.domicilio?.y_calle           || '',
        fuente_csf:      true,
      })
      // Si CSF es válida, avanzar automáticamente al paso 2
      // IMPORTANTE: pasar datosOCR directamente a evaluarAvisos porque
      // el estado de React (form) aún no se actualizó en este ciclo de render.
      const datosOCR = {
        rfc:                 d.rfc                       || '',
        razon_social:        limpiarNombreForm(d.nombre) || '',
        regimen_fiscal:      resolverClaveRegimen(d)     || '',
        tipo:                form.tipo                   || 'proveedor',
        email:               form.email                  || '',
        regimen_capital:     d.regimen_capital           || '',
        fecha_inicio_ops:    d.fecha_inicio_ops          || '',
        estatus_padron:      d.estatus                   || '',
        fecha_ultimo_cambio: d.fecha_ultimo_cambio       || '',
        nombre_comercial:    d.nombre_comercial          || '',
      }
      setTimeout(() => {
        setPaso(2)
        evaluarAvisos(datosOCR)
      }, 800)
    }
  }

  // ── Campos mínimos indispensables para "Guardar Datos Mínimos" ─────────────
  //   RFC · Denominación/Razón Social · Régimen Fiscal · Tipo de relación
  //   Estos 4 campos permiten identificar al tercero en el SAT y asignar semáforo.
  //   El resto (email, dirección, fechas) se pueden completar después.

  // ── Validar en tiempo real — genera avisos por campo ─────────────────────
  const evaluarAvisos = (formActual = form) => {
    const a = {}
    const rfcRe = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

    // RFC
    if (!formActual.rfc?.trim())
      a.rfc = { tipo: 'vacio', msg: 'El campo RFC se encuentra vacío. Es indispensable para identificar al tercero ante el SAT.' }
    else if (!rfcRe.test(formActual.rfc.toUpperCase()))
      a.rfc = { tipo: 'formato', msg: `RFC inválido — formato esperado: 3-4 letras + 6 dígitos + 3 caracteres. Ejemplo: AOC110120LZ2` }
    else if (/[^A-ZÑ&0-9]/i.test(formActual.rfc.trim()))
      a.rfc = { tipo: 'especial', msg: 'El RFC no permite caracteres especiales ni espacios.' }

    // Razón Social
    if (!formActual.razon_social?.trim())
      a.razon_social = { tipo: 'vacio', msg: 'El campo Denominación/Razón Social se encuentra vacío. Es indispensable para el directorio fiscal.' }
    else if (/[<>{}\[\]|]/.test(formActual.razon_social))
      a.razon_social = { tipo: 'especial', msg: 'La Razón Social no permite los caracteres: < > { } [ ] |' }

    // Régimen Fiscal
    if (!formActual.regimen_fiscal)
      a.regimen_fiscal = { tipo: 'vacio', msg: 'El campo Régimen Fiscal se encuentra vacío. Selecciona el régimen que corresponde según la CSF del SAT.' }

    // Tipo de relación
    if (!formActual.tipo)
      a.tipo = { tipo: 'vacio', msg: 'Define si es Proveedor, Cliente o Ambos para clasificar correctamente en el directorio.' }

    // Email (opcional para mínimo, pero avisa si tiene formato incorrecto)
    if (formActual.email && !formActual.email.includes('@'))
      a.email = { tipo: 'formato', msg: 'El correo electrónico no tiene un formato válido. Ejemplo: facturacion@empresa.com' }
    else if (formActual.email && /[\s]/.test(formActual.email))
      a.email = { tipo: 'especial', msg: 'El correo electrónico no permite espacios en blanco.' }
    else if (!formActual.email?.trim())
      a.email = { tipo: 'vacio', msg: 'El campo Correo Electrónico se encuentra vacío. Se necesita para el envío de CFDI.' }

    // Régimen de Capital (aviso informativo, no bloquea el mínimo)
    if (!formActual.regimen_capital?.trim())
      a.regimen_capital = { tipo: 'info', msg: 'El campo Régimen de Capital está vacío. Se recomienda capturarlo para el expediente completo.' }

    // Fecha inicio ops (aviso informativo)
    if (!formActual.fecha_inicio_ops)
      a.fecha_inicio_ops = { tipo: 'info', msg: 'La Fecha de Inicio de Operaciones está vacía. Complétala para mejorar el score fiscal.' }

    // Estatus padrón (aviso informativo)
    if (!formActual.estatus_padron)
      a.estatus_padron = { tipo: 'info', msg: 'El Estatus en el Padrón está vacío. Se recomienda capturarlo para validación fiscal.' }

    setAvisos(a)
    return a
  }

  // Verificar si el botón "Guardar Datos Mínimos" puede activarse
  const minimoCompleto = () => {
    const rfcRe = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
    return (
      rfcRe.test((form.rfc || '').toUpperCase()) &&
      !!form.razon_social?.trim() &&
      !!form.regimen_fiscal &&
      !!form.tipo
    )
  }

  // ── Validar MÍNIMO al hacer clic en guardar ───────────────────────────────
  const validarMinimo = () => {
    const a = evaluarAvisos()
    const erroresBloqueo = Object.entries(a)
      .filter(([, v]) => v.tipo !== 'info')
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v.msg }), {})
    // Solo los campos mínimos bloquean
    const bloqueo = {}
    if (erroresBloqueo.rfc)           bloqueo.rfc           = erroresBloqueo.rfc
    if (erroresBloqueo.razon_social)  bloqueo.razon_social  = erroresBloqueo.razon_social
    if (erroresBloqueo.regimen_fiscal) bloqueo.regimen_fiscal = erroresBloqueo.regimen_fiscal
    if (erroresBloqueo.tipo)          bloqueo.tipo          = erroresBloqueo.tipo
    setErrors(bloqueo)
    return Object.keys(bloqueo).length === 0
  }

  // ── Validar NIVEL 1 completo — para "Agregar documentación" ──────────────
  // Valida todos los campos del paso 2 antes de avanzar al paso 3.
  const validarNivel1 = () => {
    const e = {}
    const rfcRe = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
    if (!rfcRe.test(form.rfc.toUpperCase()))          e.rfc             = 'RFC inválido'
    if (!form.razon_social?.trim())                   e.razon_social    = 'Razón social requerida'
    if (!form.regimen_capital?.trim())                e.regimen_capital = 'Régimen de capital requerido'
    if (!form.fecha_inicio_ops)                       e.fecha_inicio_ops    = 'Fecha de inicio requerida'
    if (!form.estatus_padron)                         e.estatus_padron      = 'Estatus en el padrón requerido'
    if (!form.fecha_ultimo_cambio)                    e.fecha_ultimo_cambio = 'Fecha de último cambio requerida'
    if (!form.regimen_fiscal)                         e.regimen_fiscal  = 'Selecciona un régimen fiscal'
    if ((dirFiscal.codigo_postal || '').length !== 5) e.codigo_postal   = 'CP de 5 dígitos'
    if (!dirFiscal.nombre_vialidad?.trim())           e.nombre_vialidad = 'Nombre de vialidad requerido'
    if (!dirFiscal.municipio?.trim())                 e.municipio       = 'Municipio requerido'
    if (!dirFiscal.estado?.trim())                    e.estado          = 'Entidad federativa requerida'
    if (!form.email || !form.email.includes('@'))     e.email           = 'Correo electrónico inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Guardar MÍNIMO — "Guardar mínimo y continuar después" ──────────────────
  const guardarNivel1 = async () => {
    // Evaluar y mostrar todos los avisos al intentar guardar
    evaluarAvisos(form)
    if (!validarMinimo()) return
    setSaving(true)
    try {
      const { data, error } = await service.upsertTercero({
        // Campos mínimos obligatorios
        rfc:              form.rfc,
        razon_social:     form.razon_social,
        regimen_fiscal:   form.regimen_fiscal,
        tipo:             form.tipo,
        uso_cfdi_default: form.uso_cfdi_default,
        email:            form.email             || null,
        telefono:         form.telefono          || null,
        // Campos CSF opcionales — si el OCR los extrajo, se guardan
        regimen_capital:      form.regimen_capital      || null,
        nombre_comercial:     form.nombre_comercial     || null,
        fecha_inicio_ops:     form.fecha_inicio_ops     || null,
        estatus_padron:       form.estatus_padron       || null,
        fecha_ultimo_cambio:  form.fecha_ultimo_cambio  || null,
        codigo_postal:        dirFiscal.codigo_postal   || null,
        // Metadatos CSF
        csf_parseada:    csfResultado?.es_documento_correcto ?? false,
        csf_confianza:   csfResultado?.confianza ?? 0,
        onboarding_paso: 2,
      })

      if (error) throw error

      // Guardar dirección fiscal si tiene al menos el CP
      if (data?.tercero?.id && dirFiscal.codigo_postal) {
        await service.upsertDireccion(data.tercero.id, 'fiscal', { ...dirFiscal, fuente_csf: true })
      }
      if (data?.tercero?.id && dirAdmin.calle) {
        await service.upsertDireccion(data.tercero.id, 'administrativa', dirAdmin)
      }
      if (data?.tercero?.id && dirEntrega.calle) {
        await service.upsertDireccion(data.tercero.id, 'entrega', dirEntrega)
      }

      toast.success('✅ Registro guardado — completa la documentación para mejorar el score fiscal')
      navigate('/relaciones/terceros')
    } catch (err) {
      console.error('[guardarNivel1]', err)
      toast.error('Error al guardar: ' + (err.message || 'Intenta de nuevo'))
    } finally {
      setSaving(false)
    }
  }

  // ── Guardar COMPLETO (Nivel 1 + 2) ──────────────────────────────────────────
  const guardarCompleto = async () => {
    if (!validarNivel1()) { setPaso(2); return }
    setSaving(true)
    try {
      const { data, error } = await service.upsertTercero({
        ...form,
        codigo_postal:   dirFiscal.codigo_postal || form.codigo_postal,
        onboarding_paso: 3,
        csf_parseada:    csfResultado?.es_documento_correcto ?? false,
        csf_confianza:   csfResultado?.confianza ?? 0,
      })
      if (error) throw error

      const terceroId = data.tercero.id

      // Direcciones
      await service.upsertDireccion(terceroId, 'fiscal',    { ...dirFiscal, fuente_csf: true })
      if (dirAdmin.calle)   await service.upsertDireccion(terceroId, 'administrativa', dirAdmin)
      if (dirEntrega.calle) await service.upsertDireccion(terceroId, 'entrega',        dirEntrega)

      // Documentos Nivel 2
      const uploads = []
      if (archivos.opinion_32d) uploads.push(service.uploadDocumento(terceroId, 'opinion_32d', archivos.opinion_32d, {
        estatus: form.opinion_32d_estatus || 'positiva',
        fecha_documento: form.opinion_32d_fecha,
      }))
      if (archivos.csd)          uploads.push(service.uploadDocumento(terceroId, 'csd', archivos.csd))
      if (archivos.estado_cuenta) uploads.push(service.uploadDocumento(terceroId, 'estado_cuenta', archivos.estado_cuenta))
      if (archivos.repse)         uploads.push(service.uploadDocumento(terceroId, 'repse', archivos.repse))

      if (uploads.length > 0) {
        await Promise.all(uploads)
        await service.updateTerceroNivel2(terceroId, form)
      }

      toast.success('Expediente completo guardado correctamente ✅')
      navigate(`/relaciones/terceros/${terceroId}`)
    } catch (err) {
      toast.error('Error al guardar: ' + (err.message || 'Intenta de nuevo'))
    } finally {
      setSaving(false)
    }
  }

  const updDir = (setter) => (campo, valor) => setter(d => ({ ...d, [campo]: valor }))

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <RequirePermission module="fiscal" action="create">
      <MainLayout title="➕ Nuevo Cliente / Proveedor">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          <StepIndicator paso={paso} csf_ok={csfResultado?.es_documento_correcto} />

          <div style={{ backgroundColor: '#fff', borderRadius: '16px',
            border: '1px solid #E5E7EB', padding: '28px' }}>

            {/* ════════════════ PASO 1: CARGAR CSF ════════════════ */}
            {paso === 1 && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#111827', margin: '0 0 8px' }}>
                    Comencemos con la Constancia de Situación Fiscal
                  </h2>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                    Carga el PDF de la CSF del cliente o proveedor.<br />
                    El sistema leerá automáticamente todos los datos fiscales.
                  </p>
                </div>

                {/* Zona de carga */}
                {!csfArchivo && !csfParsing && (
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '12px',
                    border: '3px dashed #BFDBFE', borderRadius: '16px',
                    padding: '48px', cursor: 'pointer', backgroundColor: '#F0F9FF',
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#1E40AF'; e.currentTarget.style.backgroundColor = '#EFF6FF' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.backgroundColor = '#F0F9FF' }}>
                    <input type="file" accept=".pdf" style={{ display: 'none' }}
                      onChange={e => e.target.files[0] && procesarCSF(e.target.files[0])} />
                    <Upload size={40} color="#1E40AF" />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '16px', fontWeight: '700', color: '#1E40AF', margin: '0 0 4px' }}>
                        Arrastra aquí el PDF de la CSF
                      </p>
                      <p style={{ fontSize: '13px', color: '#60A5FA', margin: 0 }}>
                        o haz clic para seleccionar el archivo
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', color: '#9CA3AF',
                      backgroundColor: '#fff', padding: '4px 12px', borderRadius: '9999px',
                      border: '1px solid #E5E7EB' }}>
                      Solo PDF — Constancia de Situación Fiscal del SAT
                    </span>
                  </label>
                )}

                {/* Procesando */}
                {csfParsing && (
                  <div style={{ textAlign: 'center', padding: '48px',
                    backgroundColor: '#EFF6FF', borderRadius: '16px' }}>
                    <RefreshCw size={36} color="#1E40AF"
                      style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
                    <p style={{ fontSize: '15px', fontWeight: '600', color: '#1E40AF', margin: '0 0 4px' }}>
                      Leyendo la CSF...
                    </p>
                    <p style={{ fontSize: '13px', color: '#60A5FA', margin: 0 }}>
                      Extrayendo RFC, nombre, CP y régimen fiscal
                    </p>
                  </div>
                )}

                {/* Resultado CSF */}
                {csfResultado && !csfParsing && (
                  <div>
                    {csfResultado.es_documento_correcto ? (
                      <div style={{ backgroundColor: '#F0FDF4', border: '2px solid #6EE7B7',
                        borderRadius: '14px', padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                          <CheckCircle size={24} color="#059669" />
                          <div>
                            <p style={{ fontSize: '15px', fontWeight: '700', color: '#065F46', margin: 0 }}>
                              CSF leída correctamente — Confianza: {csfResultado.confianza}%
                            </p>
                            <p style={{ fontSize: '12px', color: '#059669', margin: 0 }}>
                              Avanzando al siguiente paso automáticamente...
                            </p>
                          </div>
                        </div>
                        {/* Preview datos extraídos */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {[
                            ['RFC',           csfResultado.datos_extraidos.rfc],
                            ['Nombre',        csfResultado.datos_extraidos.nombre],
                            ['CP',            csfResultado.datos_extraidos.codigo_postal],
                            ['Régimen',       csfResultado.datos_extraidos.clave_regimen
                              ? `${csfResultado.datos_extraidos.clave_regimen} — ${csfResultado.datos_extraidos.regimen_fiscal || ''}`.slice(0,50)
                              : csfResultado.datos_extraidos.regimen_fiscal],
                            ['Estatus SAT',   csfResultado.datos_extraidos.estatus],
                          ].filter(([,v]) => v).map(([label, valor]) => (
                            <div key={label} style={{ backgroundColor: '#fff', borderRadius: '8px',
                              padding: '8px 12px', border: '1px solid #D1FAE5' }}>
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{label}: </span>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{valor}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#FEF2F2', border: '2px solid #FECACA',
                        borderRadius: '14px', padding: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                          <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#991B1B', margin: '0 0 4px' }}>
                              No se pudo leer la CSF automáticamente
                            </p>
                            {csfResultado.errores?.map((e, i) => (
                              <p key={i} style={{ fontSize: '12px', color: '#DC2626', margin: '2px 0' }}>• {e}</p>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button onClick={() => { setCsfArchivo(null); setCsfResultado(null) }}
                            style={{ padding: '8px 16px', borderRadius: '8px',
                              border: '1px solid #FECACA', backgroundColor: '#fff',
                              color: '#DC2626', cursor: 'pointer', fontSize: '13px' }}>
                            Intentar con otro PDF
                          </button>
                          <button onClick={() => { setCsfManual(true); setPaso(2) }}
                            style={{ padding: '8px 16px', borderRadius: '8px',
                              border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB',
                              color: '#374151', cursor: 'pointer', fontSize: '13px',
                              display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Edit3 size={13} /> Capturar manualmente con advertencia
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* ════════════════ PASO 2: DATOS + DIRECCIONES ════════════════ */}
            {paso === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Aviso modo manual */}
                {csfManual && (
                  <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                    borderRadius: '10px', padding: '12px 16px',
                    display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AlertTriangle size={16} color="#D97706" />
                    <p style={{ fontSize: '13px', color: '#92400E', margin: 0 }}>
                      <strong>Captura manual activa.</strong> Ingresa los datos exactamente como aparecen en la CSF del SAT para garantizar el timbrado correcto.
                    </p>
                  </div>
                )}

                {/* ── Panel de avisos de campos ── */}
                {Object.keys(avisos).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Campos mínimos faltantes — bloquean el guardado */}
                    {(() => {
                      const criticos = Object.entries(avisos).filter(([,v]) => v.tipo === 'vacio' || v.tipo === 'formato' || v.tipo === 'especial')
                      const informativos = Object.entries(avisos).filter(([,v]) => v.tipo === 'info')
                      return (
                        <>
                          {criticos.length > 0 && (
                            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                              borderRadius: '10px', padding: '12px 14px' }}>
                              <p style={{ fontSize: '12px', fontWeight: '700', color: '#991B1B',
                                margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={13} /> Campos que requieren atención
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {criticos.map(([campo, aviso]) => (
                                  <div key={campo} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700',
                                      color: aviso.tipo === 'especial' ? '#7C3AED' :
                                             aviso.tipo === 'formato'  ? '#B45309' : '#DC2626',
                                      flexShrink: 0, marginTop: '1px' }}>
                                      {aviso.tipo === 'vacio'    ? '○ Vacío' :
                                       aviso.tipo === 'formato'  ? '⚠ Formato' : '✕ Carácter'}
                                    </span>
                                    <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>{aviso.msg}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {informativos.length > 0 && (
                            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
                              borderRadius: '10px', padding: '10px 14px' }}>
                              <p style={{ fontSize: '12px', fontWeight: '700', color: '#1E40AF',
                                margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Info size={13} /> Campos opcionales vacíos — completa para mejorar el score
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {informativos.map(([campo, aviso]) => (
                                  <span key={campo} style={{ fontSize: '11px', color: '#1E40AF',
                                    backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '9999px' }}>
                                    {aviso.msg.split('.')[0]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* ── BLOQUE 1: Datos Fiscales — mismos campos y orden que la CSF SAT ── */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Shield size={16} color="#1E40AF" />
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#1E40AF', margin: 0 }}>
                      Datos Fiscales — Constancia de Situación Fiscal
                    </p>
                    {!csfManual && (
                      <span style={{ fontSize: '11px', color: '#60A5FA', backgroundColor: '#EFF6FF',
                        padding: '2px 8px', borderRadius: '9999px',
                        display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={10} /> Auto-llenados desde CSF
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                    {/* RFC */}
                    <div>
                      <Label required>RFC</Label>
                      <Input value={form.rfc} locked={!csfManual}
                        onChange={e => {
                          const v = e.target.value.toUpperCase().replace(/\s/g,'')
                          setForm(f => { const nf = { ...f, rfc: v }; evaluarAvisos(nf); return nf })
                        }}
                        placeholder="Ej: AOC110120LZ2" error={errors.rfc} maxLength={13} />
                      <FieldError msg={errors.rfc} />
                    </div>

                    {/* Tipo de relación OBRIX (no viene en CSF, va junto al RFC) */}
                    <div>
                      <Label required>Tipo de relación</Label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[['proveedor','🏭 Proveedor'],['cliente','🤝 Cliente'],['ambos','🔄 Ambos']].map(([v,l]) => (
                          <button key={v} type="button" onClick={() => setForm(f => ({ ...f, tipo: v }))}
                            style={{ flex: 1, padding: '9px 4px', borderRadius: '8px', fontSize: '12px',
                              fontWeight: '600', cursor: 'pointer',
                              border: form.tipo === v ? '2px solid #1E40AF' : '1px solid #E5E7EB',
                              backgroundColor: form.tipo === v ? '#EFF6FF' : '#fff',
                              color: form.tipo === v ? '#1E40AF' : '#6B7280' }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Denominación / Razón Social */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Label required>Denominación / Razón Social</Label>
                      <Input value={form.razon_social} locked={!csfManual}
                        onChange={e => {
                          const v = e.target.value
                          setForm(f => { const nf = { ...f, razon_social: v }; evaluarAvisos(nf); return nf })
                        }}
                        placeholder="Nombre exacto según SAT" error={errors.razon_social} />
                      <FieldError msg={errors.razon_social} />
                    </div>

                    {/* Régimen de Capital */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Label required>Régimen de Capital</Label>
                      <Input value={form.regimen_capital} locked={!csfManual}
                        onChange={e => setForm(f => ({ ...f, regimen_capital: e.target.value }))}
                        placeholder="Ej: SOCIEDAD ANONIMA DE CAPITAL VARIABLE"
                        error={errors.regimen_capital} />
                      <FieldError msg={errors.regimen_capital} />
                    </div>

                    {/* Nombre Comercial (opcional) */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Label>Nombre Comercial <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>(Opcional)</span></Label>
                      <Input value={form.nombre_comercial}
                        locked={!csfManual && !!form.nombre_comercial}
                        onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))}
                        placeholder="Nombre comercial o de uso — si aplica" />
                    </div>

                    {/* Fecha inicio de operaciones */}
                    <div>
                      <Label required>Fecha de Inicio de Operaciones</Label>
                      {csfManual ? (
                        <Input type="date" value={form.fecha_inicio_ops}
                          onChange={e => setForm(f => ({ ...f, fecha_inicio_ops: e.target.value }))}
                          error={errors.fecha_inicio_ops} />
                      ) : (
                        <Input value={form.fecha_inicio_ops
                          ? new Date(form.fecha_inicio_ops + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
                          : ''} locked placeholder="Se llena desde la CSF" error={errors.fecha_inicio_ops} onChange={() => {}} />
                      )}
                      <FieldError msg={errors.fecha_inicio_ops} />
                    </div>

                    {/* Estatus en el padrón */}
                    <div>
                      <Label required>Estatus en el Padrón</Label>
                      {csfManual ? (
                        <Select value={form.estatus_padron}
                          onChange={e => setForm(f => ({ ...f, estatus_padron: e.target.value }))}
                          error={errors.estatus_padron}>
                          <option value="">Selecciona...</option>
                          <option value="ACTIVO">ACTIVO</option>
                          <option value="SUSPENDIDO">SUSPENDIDO</option>
                          <option value="CANCELADO">CANCELADO</option>
                        </Select>
                      ) : (
                        <Input value={form.estatus_padron} locked onChange={() => {}}
                          placeholder="Se llena desde la CSF"
                          style={{ color: form.estatus_padron === 'ACTIVO' ? '#065F46' :
                            form.estatus_padron === 'SUSPENDIDO' ? '#B45309' : '#991B1B' }}
                          error={errors.estatus_padron} />
                      )}
                      <FieldError msg={errors.estatus_padron} />
                    </div>

                    {/* Fecha último cambio de estado */}
                    <div>
                      <Label required>Fecha de Último Cambio de Estado</Label>
                      {csfManual ? (
                        <Input type="date" value={form.fecha_ultimo_cambio}
                          onChange={e => setForm(f => ({ ...f, fecha_ultimo_cambio: e.target.value }))}
                          error={errors.fecha_ultimo_cambio} />
                      ) : (
                        <Input value={form.fecha_ultimo_cambio
                          ? new Date(form.fecha_ultimo_cambio + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
                          : ''} locked placeholder="Se llena desde la CSF" onChange={() => {}} error={errors.fecha_ultimo_cambio} />
                      )}
                      <FieldError msg={errors.fecha_ultimo_cambio} />
                    </div>

                    {/* Régimen Fiscal (clave SAT) */}
                    <div>
                      <Label required>Régimen Fiscal</Label>
                      {csfManual ? (
                        <Select value={form.regimen_fiscal}
                          onChange={e => setForm(f => ({ ...f, regimen_fiscal: e.target.value }))}
                          error={errors.regimen_fiscal}>
                          <option value="">Selecciona...</option>
                          {REGIMENES.map(r => <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>)}
                        </Select>
                      ) : (
                        <Input value={form.regimen_fiscal
                          ? `${form.regimen_fiscal} — ${REGIMENES.find(r => r.clave === form.regimen_fiscal)?.desc || ''}`
                          : ''} locked onChange={() => {}} error={errors.regimen_fiscal} />
                      )}
                      <FieldError msg={errors.regimen_fiscal} />
                    </div>

                  </div>
                </div>

                {/* ── BLOQUE 2: Datos de contacto OBRIX ── */}
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#374151',
                    margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📬 Datos de Contacto
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <Label required>Correo Electrónico</Label>
                      <Input type="email" value={form.email} placeholder="facturacion@empresa.com"
                        onChange={e => {
                          const v = e.target.value
                          setForm(f => { const nf = { ...f, email: v }; evaluarAvisos(nf); return nf })
                        }}
                        error={errors.email} />
                      <FieldError msg={errors.email} />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input type="tel" value={form.telefono} placeholder="10 dígitos"
                        onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                    </div>
                    <div>
                      <Label required>Uso CFDI por Defecto</Label>
                      <Select value={form.uso_cfdi_default}
                        onChange={e => setForm(f => ({ ...f, uso_cfdi_default: e.target.value }))}>
                        {USOS_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Direcciones */}
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#374151',
                    margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} /> Direcciones
                  </p>
                  {/* Dirección Fiscal — campos exactos de la CSF SAT */}
                  <div style={{ border: '1px solid #1E40AF30', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#EFF6FF',
                      display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>🏛️</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF' }}>Dirección Fiscal — Cédula SAT</span>
                      <span style={{ fontSize: '11px', color: '#059669', backgroundColor: '#D1FAE5',
                        padding: '2px 8px', borderRadius: '9999px',
                        display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        ✏️ Editable — corrige lo que necesites
                      </span>
                    </div>
                    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#fff' }}>

                      {/* Código Postal */}
                      <div>
                        <Label required>Código Postal</Label>
                        <Input value={dirFiscal.codigo_postal} maxLength={5}
                          onChange={e => setDirFiscal(d => ({ ...d, codigo_postal: e.target.value.replace(/\D/,'').slice(0,5) }))}
                          placeholder="00000" error={errors.codigo_postal} />
                        <FieldError msg={errors.codigo_postal} />
                      </div>

                      {/* Tipo de Vialidad — siempre selector */}
                      <div>
                        <Label>Tipo de Vialidad</Label>
                        <Select value={dirFiscal.tipo_vialidad}
                          onChange={e => setDirFiscal(d => ({ ...d, tipo_vialidad: e.target.value }))}>
                          <option value="">Selecciona...</option>
                          {['AVENIDA (AV.)','CALLE','BOULEVARD (BLVD.)','CALZADA (CALZ.)','CARRETERA',
                            'CIRCUITO','CIRCUNVALACIÓN','CERRADA','DIAGONAL','EJE VIAL',
                            'PASEO','PERIFÉRICO','PRIVADA','PROLONGACIÓN','RETORNO','VÍA'].map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </Select>
                      </div>

                      {/* Nombre de Vialidad — ancho completo */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Label required>Nombre de Vialidad</Label>
                        <Input value={dirFiscal.nombre_vialidad}
                          onChange={e => setDirFiscal(d => ({ ...d, nombre_vialidad: e.target.value }))}
                          placeholder="Ej: AV DE LAS AMERICAS" error={errors.nombre_vialidad} />
                        <FieldError msg={errors.nombre_vialidad} />
                      </div>

                      {/* Número Exterior */}
                      <div>
                        <Label>Número Exterior</Label>
                        <Input value={dirFiscal.numero_exterior}
                          onChange={e => setDirFiscal(d => ({ ...d, numero_exterior: e.target.value }))}
                          placeholder="Ej: 1254" />
                      </div>

                      {/* Número Interior */}
                      <div>
                        <Label>Número Interior</Label>
                        <Input value={dirFiscal.numero_interior}
                          onChange={e => setDirFiscal(d => ({ ...d, numero_interior: e.target.value }))}
                          placeholder="Ej: PISO 11-A" />
                      </div>

                      {/* Colonia */}
                      <div>
                        <Label>Colonia</Label>
                        <Input value={dirFiscal.colonia}
                          onChange={e => setDirFiscal(d => ({ ...d, colonia: e.target.value }))}
                          placeholder="Nombre de la colonia" />
                      </div>

                      {/* Nombre de la Localidad */}
                      <div>
                        <Label>Nombre de la Localidad</Label>
                        <Input value={dirFiscal.localidad}
                          onChange={e => setDirFiscal(d => ({ ...d, localidad: e.target.value }))}
                          placeholder="Ej: GUADALAJARA" />
                      </div>

                      {/* Municipio o Demarcación */}
                      <div>
                        <Label required>Municipio o Demarcación</Label>
                        <Input value={dirFiscal.municipio}
                          onChange={e => setDirFiscal(d => ({ ...d, municipio: e.target.value }))}
                          placeholder="Ej: GUADALAJARA" error={errors.municipio} />
                        <FieldError msg={errors.municipio} />
                      </div>

                      {/* Nombre de la Entidad Federativa */}
                      <div>
                        <Label required>Nombre de la Entidad Federativa</Label>
                        <Input value={dirFiscal.estado}
                          onChange={e => setDirFiscal(d => ({ ...d, estado: e.target.value }))}
                          placeholder="Ej: JALISCO" error={errors.estado} />
                        <FieldError msg={errors.estado} />
                      </div>

                      {/* Entre Calle y Y Calle */}
                      <div>
                        <Label>Entre Calle</Label>
                        <Input value={dirFiscal.entre_calle}
                          onChange={e => setDirFiscal(d => ({ ...d, entre_calle: e.target.value }))}
                          placeholder="Ej: MAR TIRRENO" />
                      </div>
                      <div>
                        <Label>Y Calle</Label>
                        <Input value={dirFiscal.y_calle}
                          onChange={e => setDirFiscal(d => ({ ...d, y_calle: e.target.value }))}
                          placeholder="Ej: MAR BÁLTICO" />
                      </div>

                    </div>
                  </div>
                  <SeccionDireccion
                    titulo="Dirección Administrativa" opcional
                    icono="🏢" color="#059669" bg="#F0FDF4"
                    datos={dirAdmin}
                    onChange={updDir(setDirAdmin)} />
                  <SeccionDireccion
                    titulo="Dirección de Entrega / Logística" opcional
                    icono="🚚" color="#7C3AED" bg="#F5F3FF"
                    datos={dirEntrega}
                    onChange={updDir(setDirEntrega)} />
                </div>

                {/* Alertas de lo que falta para estado ÓPTIMO */}
                <AlertasPendientes alertas={alertasPendientes()} />

              </div>
            )}

            {/* ════════════════ PASO 3: NIVEL 2 ÓPTIMO ════════════════ */}
            {paso === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ backgroundColor: '#F0FDF4', borderRadius: '10px', padding: '14px',
                  display: 'flex', gap: '10px' }}>
                  <Star size={16} color="#059669" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ fontSize: '13px', color: '#065F46', margin: 0, lineHeight: 1.5 }}>
                    <strong>Documentación para estado ÓPTIMO.</strong> Cada documento que agregues incrementa
                    el score fiscal y elimina alertas pendientes. Puedes guardar ahora y completarlos después.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <DocumentUploadValidator
                      tipoDocumento="CSF"
                      onValidado={(res) => {

                        const datos = res.datos_extraidos

                        setForm(f => ({
                          ...f,
                          rfc: datos.rfc,
                          razon_social: datos.nombre,
                          codigo_postal: datos.codigo_postal,
                          regimen_fiscal: datos.regimen_fiscal
                        }))

                      }}
                    />
                  <DocumentUploadValidator
                    tipoDocumento="32D" rfcEsperado={form.rfc}
                    onArchivo={f => setArchivos(a => ({ ...a, opinion_32d: f }))}
                    onValidado={d => setForm(f => ({
                      ...f,
                      opinion_32d_estatus: d.estatus_opinion?.toLowerCase() || 'positiva',
                      opinion_32d_fecha:   d.fecha_emision || f.opinion_32d_fecha,
                    }))} />
                  <DocumentUploadValidator
                    tipoDocumento="CSD" rfcEsperado={form.rfc}
                    onArchivo={f => setArchivos(a => ({ ...a, csd: f }))}
                    onValidado={d => setForm(f => ({
                      ...f,
                      csd_numero:      d.numero_certificado || f.csd_numero,
                      csd_vencimiento: d.fecha_fin          || f.csd_vencimiento,
                      csd_estatus:     d.estatus?.toLowerCase().replace(' ','_') || f.csd_estatus,
                    }))} />
                  <DocumentUploadValidator
                    tipoDocumento="ESTADO_CUENTA" rfcEsperado={form.rfc}
                    onArchivo={f => setArchivos(a => ({ ...a, estado_cuenta: f }))}
                    onValidado={d => setForm(f => ({
                      ...f,
                      clabe:           d.clabe   || f.clabe,
                      clabe_titular:   d.titular || f.clabe_titular,
                      clabe_verificada: d.rfc_titular
                        ? d.rfc_titular.toUpperCase() === f.rfc.toUpperCase()
                        : f.clabe_verificada,
                    }))} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                      🏭 REPSE <span style={{ fontWeight: '400', color: '#9CA3AF' }}>(servicios especializados)</span>
                    </label>
                    <Input type="text" placeholder="Número de registro REPSE"
                      value={form.repse_numero}
                      onChange={e => setForm(f => ({ ...f, repse_numero: e.target.value }))} />
                    <div style={{ backgroundColor: '#FEF3C7', borderRadius: '8px', padding: '8px 12px',
                      display: 'flex', gap: '6px' }}>
                      <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '11px', color: '#92400E' }}>
                        Obligatorio para servicios especializados. Sin REPSE: responsabilidad solidaria.
                      </span>
                    </div>
                  </div>
                </div>

                <AlertasPendientes alertas={alertasPendientes()} />
              </div>
            )}

            {/* ════════════════ NAVEGACIÓN ════════════════ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>

              {/* Botón izquierdo */}
              {paso === 1 && (
                <button onClick={() => navigate(-1)}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #E5E7EB',
                    backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  Cancelar
                </button>
              )}
              {paso === 2 && (
                <button onClick={() => setPaso(1)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
                    borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#fff',
                    cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <ChevronLeft size={16} /> Volver
                </button>
              )}
              {paso === 3 && (
                <button onClick={() => setPaso(2)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
                    borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#fff',
                    cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <ChevronLeft size={16} /> Volver
                </button>
              )}

              {/* Botones derechos */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {paso === 2 && (
                  <>
                    <button
                      onClick={() => {
                        evaluarAvisos(form) // siempre mostrar avisos al hacer clic
                        if (!saving) guardarNivel1()
                      }}
                      disabled={saving}
                      title={!minimoCompleto() ? 'Completa los 4 campos mínimos: RFC · Razón Social · Régimen Fiscal · Tipo de relación' : 'Guardar con los datos mínimos requeridos'}
                      style={{
                        padding: '10px 18px', borderRadius: '10px', fontSize: '14px',
                        fontWeight: minimoCompleto() ? '600' : '400',
                        border: `1px solid ${minimoCompleto() ? '#059669' : '#E5E7EB'}`,
                        backgroundColor: minimoCompleto() ? '#F0FDF4' : '#F9FAFB',
                        color: minimoCompleto() ? '#065F46' : '#9CA3AF',
                        cursor: (saving || !minimoCompleto()) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                      {minimoCompleto()
                        ? <><CheckCircle size={14} /> Guardar Datos Mínimos</>
                        : <>Guardar Datos Mínimos</>
                      }
                    </button>
                    <button onClick={() => { if (validarNivel1()) setPaso(3) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 20px', borderRadius: '10px', border: 'none',
                        backgroundColor: '#1E40AF', color: '#fff',
                        cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                      Agregar documentación <ChevronRight size={16} />
                    </button>
                  </>
                )}
                {paso === 3 && (
                  <button onClick={guardarCompleto} disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      backgroundColor: saving ? '#9CA3AF' : '#059669',
                      color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '14px', fontWeight: '600' }}>
                    {saving
                      ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                      : <><CheckCircle size={15} /> Guardar Expediente Completo</>
                    }
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </MainLayout>
    </RequirePermission>
  )
}