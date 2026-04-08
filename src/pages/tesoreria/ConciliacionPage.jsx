// ============================================================
//  OBRIX — Conciliación Bancaria
//  src/pages/tesoreria/ConciliacionPage.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { supabase }   from '../../config/supabase'
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Clock,
  XCircle, ChevronRight, RefreshCw, Building2, Search,
  Filter, Download, Eye, Plus, Landmark, AlertOctagon,
  CircleCheck, X, ChevronDown, FileUp, Info,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
const fmt      = (n)  => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d)  => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0

// ─── Configuración de estatus ────────────────────────────────
const ESTATUS_CFG = {
  procesando: {
    label: 'Procesando',
    icon:  RefreshCw,
    bg:    '#FFFBEB',
    color: '#D97706',
    spin:  true,
  },
  revision: {
    label: 'En revisión',
    icon:  AlertTriangle,
    bg:    '#FFFBEB',
    color: '#D97706',
    spin:  false,
  },
  cerrado: {
    label: 'Cerrado',
    icon:  CircleCheck,
    bg:    '#F0FDF4',
    color: '#16A34A',
    spin:  false,
  },
  error: {
    label: 'Error',
    icon:  XCircle,
    bg:    '#FEF2F2',
    color: '#DC2626',
    spin:  false,
  },
}

// ─── Constantes de estilo ────────────────────────────────────
const C = {
  borde: '#E5E7EB',
  bg:    '#FFFFFF',
  bgSec: '#F9FAFB',
}
const borde = { border: '1px solid #E5E7EB', borderRadius: '12px' }

// ─── Barra de progreso de conciliación ──────────────────────
const BarraConciliacion = ({ conciliados, discrepancias, sin_registro, total }) => {
  if (!total) return <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sin líneas</span>
  const pCon  = pct(conciliados,    total)
  const pDisc = pct(discrepancias,  total)
  const pSin  = pct(sin_registro,   total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
      <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: '#E5E7EB', gap: 1 }}>
        {pCon  > 0 && <div style={{ width: `${pCon}%`,  background: '#16A34A', transition: 'width .3s' }} />}
        {pDisc > 0 && <div style={{ width: `${pDisc}%`, background: '#D97706', transition: 'width .3s' }} />}
        {pSin  > 0 && <div style={{ width: `${pSin}%`,  background: '#DC2626',  transition: 'width .3s' }} />}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#16A34A',  fontWeight: 600 }}>{conciliados}✓</span>
        {discrepancias > 0 && <span style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>{discrepancias}⚠</span>}
        {sin_registro  > 0 && <span style={{ fontSize: 10, color: '#DC2626',  fontWeight: 600 }}>{sin_registro}✗</span>}
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>/ {total}</span>
      </div>
    </div>
  )
}

// ─── Badge de estatus ────────────────────────────────────────
const BadgeEstatus = ({ estatus }) => {
  const cfg = ESTATUS_CFG[estatus] || ESTATUS_CFG.revision
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, padding: '3px 10px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.color, fontWeight: 500,
    }}>
      <Icon size={11} style={cfg.spin ? { animation: 'spin 1.2s linear infinite' } : {}} />
      {cfg.label}
    </span>
  )
}

// ─── Badge de formato ────────────────────────────────────────
const BadgeFormato = ({ formato }) => (
  <span style={{
    display: 'inline-block', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 6,
    backgroundColor: formato === 'OFX' ? '#EFF6FF' : '#F9FAFB',
    color: formato === 'OFX' ? '#2563EB' : '#6B7280',
    fontFamily: 'monospace', letterSpacing: '0.04em',
  }}>
    {formato}
  </span>
)

// ─── Panel de nueva conciliación ────────────────────────────
const PanelNuevaConciliacion = ({ bancos, onCerrar, onExito, companyId, userId }) => {
  const [bancoId,      setBancoId]      = useState('')
  const [archivo,      setArchivo]      = useState(null)
  const [formato,      setFormato]      = useState(null)   // 'OFX' | 'CSV'
  const [fechaInicio,  setFechaInicio]  = useState('')
  const [fechaFin,     setFechaFin]     = useState('')
  const [arrastrando,  setArrastrando]  = useState(false)
  const [errores,      setErrores]      = useState({})
  const [cargando,     setCargando]     = useState(false)
  const [paso,         setPaso]         = useState(1)       // 1=config, 2=carga, 3=preview
  const [preview,      setPreview]      = useState(null)    // líneas parseadas antes de confirmar
  const inputRef = useRef()

  const seleccionarArchivo = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toUpperCase()
    if (!['OFX', 'CSV'].includes(ext)) {
      setErrores(e => ({ ...e, archivo: 'Solo se permiten archivos .OFX o .CSV' }))
      return
    }
    setArchivo(f)
    setFormato(ext)
    setErrores(e => ({ ...e, archivo: null }))
  }

  const validarPaso1 = () => {
    const e = {}
    if (!bancoId)     e.banco      = 'Selecciona una cuenta bancaria'
    if (!fechaInicio) e.fechaInicio = 'Fecha de inicio requerida'
    if (!fechaFin)    e.fechaFin   = 'Fecha de fin requerida'
    if (fechaInicio && fechaFin && fechaInicio > fechaFin)
                      e.fechaFin   = 'La fecha fin debe ser posterior al inicio'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const siguientePaso = () => {
    if (paso === 1 && validarPaso1()) setPaso(2)
  }

  // Parseo local básico para preview (sin Edge Function aún)
  const parsearArchivoLocal = async (file, fmt) => {
    const texto = await file.text()
    if (fmt === 'CSV') return parsearCSV(texto)
    if (fmt === 'OFX') return parsearOFX(texto)
    return []
  }

  const parsearCSV = (texto) => {
    const lineas = texto.split('\n').filter(l => l.trim())
    // Detectar si primera línea es encabezado
    const primera = lineas[0].toLowerCase()
    const tieneHeader = primera.includes('fecha') || primera.includes('date') || primera.includes('concepto')
    const datos = tieneHeader ? lineas.slice(1) : lineas
    return datos.slice(0, 5).map((linea, i) => {
      const cols = linea.split(',').map(c => c.replace(/"/g, '').trim())
      return {
        idx:      i + 1,
        fecha:    cols[0] || '',
        concepto: cols[1] || cols[2] || '',
        monto:    parseFloat((cols[2] || cols[3] || '0').replace(/[$,]/g, '')) || 0,
      }
    }).filter(l => l.fecha || l.monto)
  }

  const parsearOFX = (texto) => {
    const stmts = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || []
    return stmts.slice(0, 5).map((bloque, i) => {
      const get = (tag) => {
        const m = bloque.match(new RegExp(`<${tag}>([^<\n]+)`))
        return m ? m[1].trim() : ''
      }
      const rawFecha = get('DTPOSTED')
      const fecha = rawFecha
        ? `${rawFecha.slice(0, 4)}-${rawFecha.slice(4, 6)}-${rawFecha.slice(6, 8)}`
        : ''
      return {
        idx:      i + 1,
        fecha,
        concepto: get('MEMO') || get('NAME') || '',
        monto:    parseFloat(get('TRNAMT') || '0'),
      }
    })
  }

  const procesarArchivo = async () => {
    if (!archivo) {
      setErrores(e => ({ ...e, archivo: 'Selecciona un archivo antes de continuar' }))
      return
    }
    setCargando(true)
    try {
      const lineas = await parsearArchivoLocal(archivo, formato)
      setPreview(lineas)
      setPaso(3)
    } catch (err) {
      setErrores(e => ({ ...e, archivo: 'Error al leer el archivo: ' + err.message }))
    } finally {
      setCargando(false)
    }
  }

  const confirmarCarga = async () => {
    setCargando(true)
    try {
      // 1. Crear registro del archivo en Supabase
      const { data: archivoData, error: errArchivo } = await supabase
        .from('conciliacion_archivos')
        .insert({
          company_id:     companyId,
          banco_id:       bancoId,
          nombre_archivo: archivo.name,
          formato,
          fecha_inicio:   fechaInicio,
          fecha_fin:      fechaFin,
          total_lineas:   0,
          conciliados:    0,
          discrepancias:  0,
          sin_registro:   0,
          estatus:        'revision',
          cargado_por:    userId,
        })
        .select()
        .single()

      if (errArchivo) throw errArchivo

      // 2. Llamar Edge Function para parseo completo y matching
      //    (cuando esté disponible — por ahora deja el registro en estatus 'revision')
      // await supabase.functions.invoke('parsear-conciliacion', {
      //   body: { archivo_id: archivoData.id, contenido: await archivo.text() }
      // })

      onExito(archivoData.id)
    } catch (err) {
      setErrores(e => ({ ...e, general: 'Error al procesar: ' + err.message }))
      setCargando(false)
    }
  }

  const inputStyle = (err) => ({
    width: '100%', padding: '9px 12px',
    border: `0.5px solid ${err ? '#EF4444' : '#E5E7EB'}`,
    borderRadius: '8px', fontSize: '13px', outline: 'none',
    backgroundColor: '#FFFFFF', color: '#111827', boxSizing: 'border-box',
  })

  const bancosActivos = bancos.filter(b => b.activa)

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 80 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '480px', maxWidth: '95vw',
        backgroundColor: '#FFFFFF', borderLeft: '1px solid #E5E7EB', boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
        zIndex: 90, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={16} color="#2563EB" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Nueva conciliación</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Paso {paso} de 3</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}>
            <X size={18} />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', gap: 0, flexShrink: 0, padding: '0 20px', borderBottom: '1px solid #E5E7EB' }}>
          {[
            { n: 1, label: 'Configurar' },
            { n: 2, label: 'Cargar archivo' },
            { n: 3, label: 'Confirmar' },
          ].map(({ n, label }) => (
            <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 4px', position: 'relative' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', marginBottom: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                backgroundColor: paso >= n ? '#111827' : '#F9FAFB',
                color: paso >= n ? '#FFFFFF' : '#9CA3AF',
                border: `0.5px solid ${paso >= n ? '#111827' : '#E5E7EB'}`,
                transition: 'all 0.2s',
              }}>{n}</div>
              <span style={{ fontSize: 10, color: paso >= n ? '#111827' : '#9CA3AF', fontWeight: paso === n ? 600 : 400 }}>
                {label}
              </span>
              {n < 3 && (
                <div style={{ position: 'absolute', top: 21, left: '60%', right: '-40%', height: 1, backgroundColor: paso > n ? '#111827' : '#E5E7EB', transition: 'background .2s' }} />
              )}
            </div>
          ))}
        </div>

        {/* Contenido por paso */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── Paso 1: Configuración ── */}
          {paso === 1 && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
                Selecciona la cuenta bancaria y el período que cubre el estado de cuenta que vas a cargar.
              </p>

              {/* Banco */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>
                  Cuenta bancaria <span style={{ color: '#DC2626' }}>*</span>
                </label>
                {bancosActivos.length === 0 ? (
                  <div style={{ padding: '12px 14px', borderRadius: '8px', border: `0.5px solid #F59E0B`, backgroundColor: '#FFFBEB' }}>
                    <p style={{ fontSize: 12, color: '#D97706', margin: 0 }}>
                      No tienes cuentas bancarias registradas. Ve a <strong>Bancos</strong> para agregar una primero.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {bancosActivos.map(banco => (
                      <button
                        key={banco.id}
                        onClick={() => { setBancoId(banco.id); setErrores(e => ({ ...e, banco: null })) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                          border: `0.5px solid ${bancoId === banco.id ? '#3B82F6' : '#E5E7EB'}`,
                          backgroundColor: bancoId === banco.id ? '#EFF6FF' : '#FFFFFF',
                          transition: 'all 0.15s', textAlign: 'left',
                        }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={15} color="#6B7280" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{banco.nombre}</p>
                          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{banco.banco} · {banco.moneda}</p>
                        </div>
                        {bancoId === banco.id && <CheckCircle2 size={16} color="#2563EB" />}
                      </button>
                    ))}
                  </div>
                )}
                {errores.banco && <p style={{ fontSize: 11, color: '#DC2626', margin: '4px 0 0' }}>{errores.banco}</p>}
              </div>

              {/* Período */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>
                  Período del estado de cuenta <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 3 }}>Desde</label>
                    <input type="date" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setErrores(er => ({ ...er, fechaInicio: null })) }} style={inputStyle(errores.fechaInicio)} />
                    {errores.fechaInicio && <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{errores.fechaInicio}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 3 }}>Hasta</label>
                    <input type="date" value={fechaFin} onChange={e => { setFechaFin(e.target.value); setErrores(er => ({ ...er, fechaFin: null })) }} style={inputStyle(errores.fechaFin)} />
                    {errores.fechaFin && <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{errores.fechaFin}</p>}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: '8px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Info size={14} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                  El período debe coincidir con el estado de cuenta bancario. OBRIX comparará cada movimiento del banco contra los registros del mismo período.
                </p>
              </div>
            </div>
          )}

          {/* ── Paso 2: Carga de archivo ── */}
          {paso === 2 && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
                Descarga el estado de cuenta desde tu portal bancario en formato <strong>.OFX</strong> (preferido) o <strong>.CSV</strong> y cárgalo aquí.
              </p>

              {/* Zona de drag & drop */}
              <div
                onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={e => {
                  e.preventDefault()
                  setArrastrando(false)
                  const f = e.dataTransfer.files[0]
                  if (f) seleccionarArchivo(f)
                }}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${arrastrando ? '#3B82F6' : archivo ? '#22C55E' : '#E5E7EB'}`,
                  borderRadius: '12px',
                  backgroundColor: arrastrando ? '#EFF6FF' : archivo ? '#F0FDF4' : '#F9FAFB',
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: 16,
                }}
              >
                <input ref={inputRef} type="file" accept=".ofx,.csv" style={{ display: 'none' }} onChange={e => seleccionarArchivo(e.target.files[0])} />

                {archivo ? (
                  <>
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#16A34A', margin: '0 0 4px' }}>{archivo.name}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>
                      {(archivo.size / 1024).toFixed(1)} KB · Formato: <strong>{formato}</strong>
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); setArchivo(null); setFormato(null) }}
                      style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Cambiar archivo
                    </button>
                  </>
                ) : (
                  <>
                    <FileUp size={32} color="#9CA3AF" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: '0 0 4px' }}>
                      {arrastrando ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para seleccionar'}
                    </p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                      Formatos aceptados: .OFX · .CSV
                    </p>
                  </>
                )}
              </div>

              {errores.archivo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: `0.5px solid #EF4444`, marginBottom: 16 }}>
                  <AlertOctagon size={14} color="#DC2626" />
                  <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{errores.archivo}</p>
                </div>
              )}

              {/* Tips por formato */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { fmt: 'OFX', desc: 'Formato estándar bancario. Exporta desde "Banca Electrónica → Movimientos → Exportar OFX". Recomendado.', color: '#EFF6FF', border: '#3B82F6', text: '#2563EB' },
                  { fmt: 'CSV', desc: 'Tabla de texto separada por comas. Asegúrate de que incluya: Fecha, Concepto y Monto en las primeras columnas.', color: '#F9FAFB', border: '#E5E7EB', text: '#6B7280' },
                ].map(tip => (
                  <div key={tip.fmt} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: tip.color, border: `0.5px solid ${tip.border}` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: tip.text, margin: '0 0 4px', fontFamily: 'monospace' }}>.{tip.fmt}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Paso 3: Preview y confirmación ── */}
          {paso === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: `0.5px solid #22C55E`, marginBottom: 20 }}>
                <CheckCircle2 size={16} color="#16A34A" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#16A34A', margin: 0 }}>Archivo leído correctamente</p>
                  <p style={{ fontSize: 11, color: '#16A34A', margin: '1px 0 0', opacity: 0.8 }}>
                    Se detectaron {preview?.length || 0} líneas en la muestra. El procesamiento completo ocurrirá tras confirmar.
                  </p>
                </div>
              </div>

              {/* Resumen */}
              <div style={{ ...borde, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Resumen de la carga</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  {[
                    { label: 'Cuenta',   valor: bancos.find(b => b.id === bancoId)?.nombre || '—' },
                    { label: 'Formato',  valor: formato },
                    { label: 'Desde',    valor: fmtFecha(fechaInicio) },
                    { label: 'Hasta',    valor: fmtFecha(fechaFin) },
                    { label: 'Archivo',  valor: archivo?.name },
                  ].map(({ label, valor }, i) => (
                    <div key={label} style={{ padding: '10px 14px', borderBottom: i < 4 ? `0.5px solid #E5E7EB` : 'none', borderRight: i % 2 === 0 ? `0.5px solid #E5E7EB` : 'none' }}>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px' }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0, wordBreak: 'break-all' }}>{valor}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Muestra de líneas */}
              {preview && preview.length > 0 && (
                <div style={{ ...borde, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '10px 14px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>
                      Vista previa — primeras {preview.length} líneas
                    </p>
                  </div>
                  {preview.map((linea, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px', padding: '8px 14px', borderBottom: i < preview.length - 1 ? `0.5px solid #E5E7EB` : 'none', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{linea.fecha}</span>
                      <span style={{ fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{linea.concepto || '—'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', textAlign: 'right', color: linea.monto >= 0 ? '#16A34A' : '#DC2626' }}>
                        {linea.monto >= 0 ? '+' : ''}${fmt(Math.abs(linea.monto))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {errores.general && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: `0.5px solid #EF4444` }}>
                  <AlertOctagon size={14} color="#DC2626" />
                  <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{errores.general}</p>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FFFBEB', border: `0.5px solid #F59E0B` }}>
                <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: '#D97706', margin: 0, lineHeight: 1.5 }}>
                  Al confirmar, OBRIX procesará el archivo completo, realizará el matching automático y resaltará las discrepancias para tu revisión. Este proceso puede tomar unos segundos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          {paso > 1 ? (
            <button
              onClick={() => setPaso(p => p - 1)}
              disabled={cargando}
              style={{ flex: 1, padding: 10, borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#111827' }}
            >
              ← Atrás
            </button>
          ) : (
            <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#111827' }}>
              Cancelar
            </button>
          )}

          {paso === 1 && (
            <button
              onClick={siguientePaso}
              disabled={bancosActivos.length === 0}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: '8px', border: 'none', background: '#111827', color: '#FFFFFF', cursor: bancosActivos.length === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: bancosActivos.length === 0 ? 0.5 : 1 }}
            >
              Siguiente →
            </button>
          )}

          {paso === 2 && (
            <button
              onClick={procesarArchivo}
              disabled={!archivo || cargando}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: '8px', border: 'none', background: !archivo || cargando ? '#D1D5DB' : '#111827', color: '#FFFFFF', cursor: !archivo || cargando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {cargando ? 'Leyendo archivo...' : 'Procesar archivo →'}
            </button>
          )}

          {paso === 3 && (
            <button
              onClick={confirmarCarga}
              disabled={cargando}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: '8px', border: 'none', background: cargando ? '#D1D5DB' : '#111827', color: '#FFFFFF', cursor: cargando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <Upload size={14} />
              {cargando ? 'Procesando...' : 'Confirmar y procesar'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Página principal ────────────────────────────────────────
export default function ConciliacionPage() {
  const nav = useNavigate()
  const [companyId,   setCompanyId]   = useState(null)
  const [userId,      setUserId]      = useState(null)
  const [archivos,    setArchivos]    = useState([])
  const [bancos,      setBancos]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [busqueda,    setBusqueda]    = useState('')
  const [filtroBanco, setFiltroBanco] = useState('todos')
  const [filtroEst,   setFiltroEst]   = useState('todos')
  const [toast,       setToast]       = useState(null)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // ── KPIs calculados ────────────────────────────────────────
  const totalArchivos    = archivos.length
  const enRevision       = archivos.filter(a => a.estatus === 'revision').length
  const totalDiscrepancias = archivos.reduce((s, a) => s + (a.discrepancias || 0) + (a.sin_registro || 0), 0)
  const totalCerrados    = archivos.filter(a => a.estatus === 'cerrado').length

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => { if (companyId) { cargarDatos() } }, [companyId])

  const cargarDatos = async () => {
    setLoading(true)
    const [{ data: arch }, { data: banc }] = await Promise.all([
      supabase
        .from('conciliacion_archivos')
        .select(`*, company_bancos(nombre, banco, moneda)`)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('company_bancos')
        .select('*')
        .eq('company_id', companyId)
        .order('orden'),
    ])
    setArchivos(arch || [])
    setBancos(banc || [])
    setLoading(false)
  }

  // ── Filtrado ───────────────────────────────────────────────
  const filtrados = archivos.filter(a => {
    const matchBusq = !busqueda ||
      a.nombre_archivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.company_bancos?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    const matchBanco = filtroBanco === 'todos' || a.banco_id === filtroBanco
    const matchEst   = filtroEst  === 'todos' || a.estatus === filtroEst
    return matchBusq && matchBanco && matchEst
  })

  const onExito = (nuevoId) => {
    setPanelAbierto(false)
    mostrarToast('✅ Conciliación iniciada — revisa las discrepancias detectadas')
    cargarDatos()
    // Navegar al detalle automáticamente
    setTimeout(() => nav(`/tesoreria/conciliacion/${nuevoId}`), 800)
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <MainLayout title="🔍 Conciliación Bancaria">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1060, margin: '0 auto' }}>

        {/* KPIs ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
          {[
            { label: 'Total procesos',    valor: totalArchivos,     sub: 'cargados',          icon: <FileText   size={18} color="#2563EB" />,    bg: '#EFF6FF'    },
            { label: 'En revisión',       valor: enRevision,        sub: 'requieren atención', icon: <AlertTriangle size={18} color="#D97706" />, bg: '#FFFBEB' },
            { label: 'Diferencias abiertas', valor: totalDiscrepancias, sub: 'líneas por resolver', icon: <AlertOctagon size={18} color="#DC2626" />,  bg: '#FEF2F2'  },
            { label: 'Cerrados',          valor: totalCerrados,     sub: 'conciliaciones completas', icon: <CircleCheck size={18} color="#16A34A" />, bg: '#F0FDF4' },
          ].map(k => (
            <div key={k.label} style={{ ...borde, background: '#FFFFFF', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {k.icon}
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 2px' }}>{k.label}</p>
                <p style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: 0, lineHeight: 1.2 }}>{k.valor}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Barra de acciones ─────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Buscador */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por archivo o cuenta..."
              style={{ width: '100%', paddingLeft: 32, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          {/* Filtro banco */}
          <select value={filtroBanco} onChange={e => setFiltroBanco(e.target.value)} style={{ fontSize: 12 }}>
            <option value="todos">Todas las cuentas</option>
            {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>

          {/* Filtro estatus */}
          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)} style={{ fontSize: 12 }}>
            <option value="todos">Todos los estatus</option>
            <option value="procesando">Procesando</option>
            <option value="revision">En revisión</option>
            <option value="cerrado">Cerrado</option>
            <option value="error">Con error</option>
          </select>

          <button onClick={cargarDatos} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, color: '#6B7280' }}>
            <RefreshCw size={14} /> Actualizar
          </button>

          <button
            onClick={() => {
              if (bancos.filter(b => b.activa).length === 0) {
                mostrarToast('Registra al menos una cuenta bancaria activa antes de conciliar', 'error')
                return
              }
              setPanelAbierto(true)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111827', color: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            <Plus size={14} /> Nueva conciliación
          </button>
        </div>

        {/* Tabla de procesos ──────────────────────────────────── */}
        <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 28, height: 28, border: `2px solid #E5E7EB`, borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>

          ) : filtrados.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center' }}>
              <FileText size={36} style={{ color: '#9CA3AF', margin: '0 auto 14px', display: 'block' }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>
                {archivos.length === 0 ? 'Sin conciliaciones registradas' : 'Sin resultados para los filtros'}
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
                {archivos.length === 0
                  ? 'Carga el estado de cuenta de tu banco para comenzar el proceso de validación.'
                  : 'Prueba ajustando los filtros de búsqueda.'}
              </p>
              {archivos.length === 0 && (
                <button
                  onClick={() => setPanelAbierto(true)}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  + Cargar primer estado de cuenta
                </button>
              )}
            </div>

          ) : (
            <>
              {/* Header tabla */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 180px 80px 36px', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                {['Cuenta · Archivo', 'Período', 'Estatus', 'Progreso de conciliación', 'Formato', ''].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
                ))}
              </div>

              {/* Filas */}
              {filtrados.map((archivo, i) => (
                <div
                  key={archivo.id}
                  onClick={() => nav(`/tesoreria/conciliacion/${archivo.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px 130px 180px 80px 36px',
                    padding: '14px 16px',
                    borderBottom: i < filtrados.length - 1 ? `0.5px solid #E5E7EB` : 'none',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: '#FFFFFF',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                >
                  {/* Cuenta + archivo */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={15} color="#2563EB" />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {archivo.company_bancos?.nombre || '—'}
                      </p>
                      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {archivo.nombre_archivo}
                      </p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                        {fmtFechaHora(archivo.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Período */}
                  <div>
                    <p style={{ fontSize: 12, color: '#111827', margin: '0 0 1px', fontWeight: 500 }}>
                      {fmtFecha(archivo.fecha_inicio)}
                    </p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                      al {fmtFecha(archivo.fecha_fin)}
                    </p>
                  </div>

                  {/* Estatus */}
                  <BadgeEstatus estatus={archivo.estatus} />

                  {/* Barra progreso */}
                  <BarraConciliacion
                    conciliados={archivo.conciliados   || 0}
                    discrepancias={archivo.discrepancias || 0}
                    sin_registro={archivo.sin_registro  || 0}
                    total={archivo.total_lineas         || 0}
                  />

                  {/* Formato */}
                  <BadgeFormato formato={archivo.formato} />

                  {/* Chevron */}
                  <ChevronRight size={15} style={{ color: '#9CA3AF' }} />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Pie de página */}
        {filtrados.length > 0 && (
          <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right', margin: 0 }}>
            {filtrados.length} proceso{filtrados.length !== 1 ? 's' : ''} · Haz clic en una fila para ver el detalle y resolver discrepancias
          </p>
        )}

        {/* Aviso sin bancos */}
        {!loading && bancos.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: '8px', backgroundColor: '#FFFBEB', border: `0.5px solid #F59E0B` }}>
            <AlertTriangle size={16} color="#D97706" />
            <p style={{ fontSize: 13, color: '#D97706', margin: 0 }}>
              Para conciliar necesitas registrar al menos una cuenta bancaria.{' '}
              <button onClick={() => nav('/tesoreria/bancos')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#D97706', textDecoration: 'underline', padding: 0 }}>
                Ir a Bancos →
              </button>
            </p>
          </div>
        )}

      </div>

      {/* Panel nueva conciliación */}
      {panelAbierto && (
        <PanelNuevaConciliacion
          bancos={bancos}
          companyId={companyId}
          userId={userId}
          onCerrar={() => setPanelAbierto(false)}
          onExito={onExito}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: '12px',
          background: toast.tipo === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `0.5px solid ${toast.tipo === 'error' ? '#EF4444' : '#22C55E'}`,
          animation: 'fadeInDown 0.2s ease', maxWidth: 380,
        }}>
          {toast.tipo === 'error'
            ? <AlertTriangle size={16} color="#DC2626" />
            : <CheckCircle2  size={16} color="#16A34A" />}
          <p style={{ fontSize: 13, fontWeight: 500, color: toast.tipo === 'error' ? '#DC2626' : '#16A34A', margin: 0 }}>
            {toast.msg}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes fadeInDown   { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
      `}</style>

    </MainLayout>
  )
}
