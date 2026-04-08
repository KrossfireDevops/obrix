// ============================================================
//  OBRIX ERP — Sub-módulo: Incidencias de Personal
//  src/pages/personal/IncidenciasPage.jsx  |  v1.0
//
//  Tipos de incidencia:
//    · Vacaciones      — fecha inicio/fin, goce de sueldo
//    · Enfermedad      — 1-2 días, cubre la empresa
//    · Incapacidad IMSS — días, folio, subir formato PDF
//    · Suspensión Disciplinaria — días, con/sin goce
//
//  Incluye:
//    · KPIs de incidencias activas por tipo
//    · Lista filtrable de incidencias
//    · Modal de alta de nueva incidencia
//    · Subida de archivo (formato IMSS)
//    · Cerrar / Cancelar incidencia
//    · Cambio de estatus del trabajador (Activo / Baja)
//      — los empleados NUNCA se eliminan
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Search, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, FileText, Upload, Download,
  ChevronDown, X, Calendar, Clock,
  UserCheck, UserX, Shield,
} from 'lucide-react'
import {
  getIncidencias, crearIncidencia, cerrarIncidencia,
  cancelarIncidencia, subirDocumentoIncidencia,
  getUrlDocumento, eliminarDocumento, getIncidenciasKpis,
  cambiarEstatusTrabajador,
  TIPO_INCIDENCIA_CFG, ESTATUS_INCIDENCIA_CFG,
  ESTATUS_TRABAJADOR_CFG,
} from '../../services/incidencias.service'
import { getPersonal } from '../../services/gestionPersonal.service'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const fmtFecha = (f) => {
  if (!f) return '—'
  const d = new Date(f + 'T12:00:00')
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const dias = (ini, fin) => {
  if (!ini || !fin) return null
  const a = new Date(ini + 'T12:00:00')
  const b = new Date(fin + 'T12:00:00')
  return Math.round((b - a) / 86400000) + 1
}

const iniciales = (t) => {
  const n = (t?.nombre ?? t?.nombre_completo ?? '?')[0] ?? '?'
  const a = (t?.apellido_paterno ?? '?')[0] ?? '?'
  return (n + a).toUpperCase()
}

// ─────────────────────────────────────────────────────────────
// BADGE DE TIPO
// ─────────────────────────────────────────────────────────────
const TipoBadge = ({ tipo, small }) => {
  const c = TIPO_INCIDENCIA_CFG[tipo]
  if (!c) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${c.color} ${c.border} ${small ? 'text-xs' : 'text-sm'}`}>
      {c.emoji} {c.label}
    </span>
  )
}

const EstatusBadge = ({ estatus }) => {
  const c = ESTATUS_INCIDENCIA_CFG[estatus] || ESTATUS_INCIDENCIA_CFG.activa
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      {c.emoji} {c.label}
    </span>
  )
}

const EstatusTrabBadge = ({ estatus, estatus_incidencia }) => {
  const key = estatus === 'baja' ? 'baja' : (estatus_incidencia || 'activo')
  const c   = ESTATUS_TRABAJADOR_CFG[key] ?? ESTATUS_TRABAJADOR_CFG.activo
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.dot, display: 'inline-block', flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// MODAL: NUEVA INCIDENCIA
// ─────────────────────────────────────────────────────────────
const ModalNuevaIncidencia = ({ isOpen, onClose, onSuccess, toast, trabajadorPresel }) => {
  const [personal,   setPersonal]   = useState([])
  const [form,       setForm]       = useState({
    trabajadorId: trabajadorPresel?.id || '',
    tipo:         'vacaciones',
    fecha_inicio: '',
    fecha_fin:    '',
    con_goce_sueldo: true,
    porcentaje_pago: 100,
    motivo:          '',
    folio_imss:      '',
    dias_pagados_imss: '',
    dias_suspension: '',
    notas_internas:  '',
  })
  const [archivo,    setArchivo]    = useState(null)
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    setError(null); setArchivo(null)
    setForm(f => ({ ...f, trabajadorId: trabajadorPresel?.id || '' }))
    getPersonal({ estatus: 'activo' }).then(data => {
      setPersonal(Array.isArray(data) ? data : (data?.data ?? []))
    })
  }, [isOpen, trabajadorPresel])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const tipoCfg = TIPO_INCIDENCIA_CFG[form.tipo]

  const validar = () => {
    if (!form.trabajadorId) return 'Selecciona un trabajador'
    if (!form.fecha_inicio) return 'La fecha de inicio es obligatoria'
    if (form.tipo === 'vacaciones' && !form.fecha_fin) return 'La fecha de fin es obligatoria para vacaciones'
    if (form.tipo === 'suspension_disciplinaria' && !form.dias_suspension) return 'Ingresa los días de suspensión'
    if (form.tipo === 'incapacidad_imss' && !archivo) return 'Debes subir el formato de incapacidad del IMSS'
    return null
  }

  const handleGuardar = async () => {
    const err = validar()
    if (err) { setError(err); return }
    setGuardando(true); setError(null)
    try {
      const inc = await crearIncidencia(form)

      // Subir documento si es incapacidad IMSS
      if (archivo && inc.id) {
        await subirDocumentoIncidencia(inc.id, archivo)
      }

      toast.success('Incidencia registrada ✓')
      onSuccess(inc)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-bold text-gray-900">📋 Nueva Incidencia</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Trabajador */}
          {!trabajadorPresel ? (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Trabajador *
              </label>
              <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.trabajadorId} onChange={e => set('trabajadorId', e.target.value)}>
                <option value="">— Seleccionar trabajador —</option>
                {personal.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre_completo}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                {iniciales(trabajadorPresel)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{trabajadorPresel.nombre_completo}</p>
                <p className="text-xs text-gray-500">{trabajadorPresel.especialidad ?? ''}</p>
              </div>
            </div>
          )}

          {/* Tipo de incidencia */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Tipo de incidencia *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TIPO_INCIDENCIA_CFG).map(([k, v]) => (
                <button key={k} type="button"
                  onClick={() => set('tipo', k)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                    form.tipo === k
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                  <span className="text-xl">{v.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{v.label}</p>
                    <p className="text-xs text-gray-400 leading-tight">{v.descripcion}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio}
                onChange={e => set('fecha_inicio', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            {/* Fecha fin — solo para vacaciones, enfermedad, incapacidad */}
            {['vacaciones', 'enfermedad', 'incapacidad_imss'].includes(form.tipo) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fecha fin {form.tipo === 'vacaciones' ? '*' : '(opcional)'}
                </label>
                <input type="date" value={form.fecha_fin}
                  onChange={e => set('fecha_fin', e.target.value)}
                  min={form.fecha_inicio || undefined}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            )}

            {/* Días de suspensión */}
            {form.tipo === 'suspension_disciplinaria' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Días de suspensión *</label>
                <input type="number" min="1" max="365" value={form.dias_suspension}
                  onChange={e => set('dias_suspension', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            )}
          </div>

          {/* Preview días */}
          {form.fecha_inicio && (
            form.tipo === 'suspension_disciplinaria' && form.dias_suspension ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                <Clock size={13} />
                <span>{form.dias_suspension} día{form.dias_suspension != 1 ? 's' : ''} de suspensión</span>
              </div>
            ) : form.fecha_fin && form.fecha_inicio ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <Calendar size={13} />
                <span>
                  {dias(form.fecha_inicio, form.fecha_fin)} día{dias(form.fecha_inicio, form.fecha_fin) !== 1 ? 's' : ''} · {fmtFecha(form.fecha_inicio)} → {fmtFecha(form.fecha_fin)}
                </span>
              </div>
            ) : null
          )}

          {/* Campos específicos por tipo */}

          {/* INCAPACIDAD IMSS — folio + días IMSS + subir archivo */}
          {form.tipo === 'incapacidad_imss' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Folio IMSS</label>
                  <input type="text" value={form.folio_imss}
                    onChange={e => set('folio_imss', e.target.value)}
                    placeholder="Ej. 12345678"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Días que cubre el IMSS</label>
                  <input type="number" min="1" value={form.dias_pagados_imss}
                    onChange={e => set('dias_pagados_imss', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Formato de incapacidad IMSS *
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    archivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40'
                  }`}>
                  {archivo ? (
                    <>
                      <CheckCircle size={20} className="text-green-500" />
                      <p className="text-sm font-medium text-green-700">{archivo.name}</p>
                      <p className="text-xs text-green-500">
                        {(archivo.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button type="button" onClick={e => { e.stopPropagation(); setArchivo(null) }}
                        className="text-xs text-red-500 hover:underline">
                        Quitar archivo
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="text-gray-400" />
                      <p className="text-sm text-gray-600">Haz clic para subir el formato IMSS</p>
                      <p className="text-xs text-gray-400">PDF, JPG o PNG — máx. 10 MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file"
                  accept="application/pdf,image/jpeg,image/png,image/heic"
                  className="hidden"
                  onChange={e => setArchivo(e.target.files?.[0] || null)} />
              </div>
              {/* % de pago IMSS */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  % del salario que cubre el IMSS
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="100" step="5"
                    value={form.porcentaje_pago}
                    onChange={e => set('porcentaje_pago', e.target.value)}
                    className="flex-1 accent-indigo-600" />
                  <span className="text-sm font-bold text-indigo-700 w-12 text-right">
                    {form.porcentaje_pago}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  El IMSS cubre generalmente el 60% del salario a partir del 4° día de incapacidad.
                </p>
              </div>
            </div>
          )}

          {/* SUSPENSIÓN — con/sin goce de sueldo */}
          {form.tipo === 'suspension_disciplinaria' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                ¿Incluye goce de sueldo?
              </label>
              <div className="flex gap-3">
                {[
                  { val: true,  label: 'Con goce de sueldo',  color: 'border-green-400 bg-green-50 text-green-800' },
                  { val: false, label: 'Sin goce de sueldo',   color: 'border-red-400 bg-red-50 text-red-800' },
                ].map(opt => (
                  <button key={String(opt.val)} type="button"
                    onClick={() => set('con_goce_sueldo', opt.val)}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                      form.con_goce_sueldo === opt.val ? opt.color : 'border-gray-200 text-gray-600'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Motivo (enfermedad, suspensión) */}
          {['enfermedad', 'suspension_disciplinaria'].includes(form.tipo) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {form.tipo === 'enfermedad' ? 'Descripción de la enfermedad' : 'Motivo de la suspensión'}
              </label>
              <textarea rows={2} value={form.motivo}
                onChange={e => set('motivo', e.target.value)}
                placeholder={
                  form.tipo === 'enfermedad'
                    ? 'Ej: Gripa, gastroenteritis…'
                    : 'Ej: Inasistencia injustificada, conducta inapropiada…'
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none" />
            </div>
          )}

          {/* Notas internas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas (opcional)</label>
            <textarea rows={2} value={form.notas_internas}
              onChange={e => set('notas_internas', e.target.value)}
              placeholder="Observaciones para el equipo de RH…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {guardando && <RefreshCw size={13} className="animate-spin" />}
            Registrar incidencia
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MODAL: CAMBIAR ESTATUS DEL TRABAJADOR
// ─────────────────────────────────────────────────────────────
const ModalEstatusTrabajador = ({ trabajador, isOpen, onClose, onSuccess, toast }) => {
  const [motivo,    setMotivo]    = useState('')
  const [guardando, setGuardando] = useState(false)
  const esBaja = trabajador?.estatus === 'baja'

  const handleGuardar = async () => {
    if (!esBaja && !motivo.trim()) {
      toast.error('Ingresa el motivo de la baja')
      return
    }
    setGuardando(true)
    try {
      await cambiarEstatusTrabajador(
        trabajador.id,
        esBaja ? 'activo' : 'baja',
        esBaja ? null : motivo,
      )
      toast.success(esBaja
        ? `${trabajador.nombre_completo} reactivado ✓`
        : `${trabajador.nombre_completo} dado de baja ✓`
      )
      setMotivo('')
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!isOpen || !trabajador) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            esBaja ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {esBaja
              ? <UserCheck size={18} className="text-green-600" />
              : <UserX size={18} className="text-red-600" />
            }
          </div>
          <div>
            <p className="font-bold text-gray-900">
              {esBaja ? 'Reactivar empleado' : 'Dar de baja'}
            </p>
            <p className="text-sm text-gray-500">{trabajador.nombre_completo}</p>
          </div>
        </div>

        {/* Aviso importante */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
          <Shield size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            {esBaja
              ? 'El expediente del empleado se conserva íntegro. Se cambiará su estatus a Activo.'
              : 'El empleado NO se elimina del sistema. Su expediente queda en estatus Baja y se conserva para consulta histórica.'
            }
          </p>
        </div>

        {!esBaja && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de baja *</label>
            <textarea rows={2} value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Renuncia voluntaria, término de contrato, despido…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none" />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white disabled:opacity-50 ${
              esBaja ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}>
            {guardando && <RefreshCw size={13} className="animate-spin" />}
            {esBaja ? 'Reactivar' : 'Dar de baja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TARJETA DE INCIDENCIA
// ─────────────────────────────────────────────────────────────
const IncidenciaCard = ({ inc, onCerrar, onCancelar, toast }) => {
  const [expandido,     setExpandido]     = useState(false)
  const [cargandoUrl,   setCargandoUrl]   = useState(false)

  const t        = inc.trabajador || {}
  const tipoCfg  = TIPO_INCIDENCIA_CFG[inc.tipo]
  const esCerrada = inc.estatus !== 'activa'

  const handleDescargar = async (doc) => {
    setCargandoUrl(true)
    try {
      const url = await getUrlDocumento(doc.storage_path)
      window.open(url, '_blank')
    } catch (e) {
      toast.error('Error al generar el enlace: ' + e.message)
    } finally {
      setCargandoUrl(false)
    }
  }

  const totalDias = inc.dias_totales
    ?? (inc.tipo === 'suspension_disciplinaria' ? inc.dias_suspension : null)
    ?? dias(inc.fecha_inicio, inc.fecha_fin)

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      esCerrada ? 'border-gray-200 opacity-70' : `border-l-4 border-gray-200`
    }`}
      style={!esCerrada ? { borderLeftColor: tipoCfg?.text } : {}}>

      {/* Fila principal */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpandido(!expandido)}>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
          {iniciales(t)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {t.nombre_completo}
            </span>
            <TipoBadge tipo={inc.tipo} small />
            <EstatusBadge estatus={inc.estatus} />
          </div>
          <p className="text-xs text-gray-500">
            {fmtFecha(inc.fecha_inicio)}
            {inc.fecha_fin ? ` → ${fmtFecha(inc.fecha_fin)}` : ' → (en curso)'}
            {totalDias ? ` · ${totalDias} día${totalDias !== 1 ? 's' : ''}` : ''}
            {inc.tipo !== 'vacaciones' && (
              <span className={`ml-2 font-medium ${inc.con_goce_sueldo ? 'text-green-600' : 'text-red-500'}`}>
                {inc.con_goce_sueldo ? '• Con goce' : '• Sin goce'}
              </span>
            )}
          </p>
        </div>

        {/* Acciones rápidas si activa */}
        {!esCerrada && (
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onCerrar(inc)}
              title="Cerrar incidencia"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100">
              <CheckCircle size={12} /> Cerrar
            </button>
            <button
              onClick={() => onCancelar(inc)}
              title="Cancelar por error"
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200">
              <XCircle size={14} />
            </button>
          </div>
        )}

        <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${expandido ? 'rotate-180' : ''}`} />
      </div>

      {/* Detalle expandido */}
      {expandido && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100 bg-gray-50/50">

          {/* Datos específicos por tipo */}
          {inc.tipo === 'incapacidad_imss' && (inc.folio_imss || inc.dias_pagados_imss || inc.porcentaje_pago) && (
            <div className="grid grid-cols-3 gap-3 pt-3">
              {inc.folio_imss && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Folio IMSS</p>
                  <p className="text-sm font-mono font-medium text-gray-800">{inc.folio_imss}</p>
                </div>
              )}
              {inc.dias_pagados_imss && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Días que cubre el IMSS</p>
                  <p className="text-sm font-semibold text-gray-800">{inc.dias_pagados_imss} días</p>
                </div>
              )}
              {inc.porcentaje_pago && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">% pago IMSS</p>
                  <p className="text-sm font-semibold text-gray-800">{inc.porcentaje_pago}%</p>
                </div>
              )}
            </div>
          )}

          {inc.motivo && (
            <div className="pt-3">
              <p className="text-xs text-gray-400 mb-0.5">Motivo</p>
              <p className="text-sm text-gray-700">{inc.motivo}</p>
            </div>
          )}

          {inc.notas_internas && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Notas internas</p>
              <p className="text-sm text-gray-600 italic">{inc.notas_internas}</p>
            </div>
          )}

          {/* Documentos */}
          {inc.personal_incidencias_docs?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Documentos adjuntos</p>
              <div className="space-y-1.5">
                {inc.personal_incidencias_docs.map(doc => (
                  <div key={doc.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                    <FileText size={13} className="text-indigo-500 shrink-0" />
                    <span className="flex-1 text-xs text-gray-700 truncate">{doc.nombre_archivo}</span>
                    <button
                      onClick={() => handleDescargar(doc)}
                      disabled={cargandoUrl}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:underline disabled:opacity-50">
                      {cargandoUrl ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                      Descargar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 pt-1 text-xs text-gray-400">
            {inc.registrado_por?.full_name && (
              <span>Registrado por: {inc.registrado_por.full_name}</span>
            )}
            <span>{fmtFecha(inc.created_at?.split('T')[0])}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function IncidenciasPage({ toast, trabajadorFiltro }) {
  const [incidencias,   setIncidencias]   = useState([])
  const [kpis,          setKpis]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [filtroTipo,    setFiltroTipo]    = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState('activa')
  const [search,        setSearch]        = useState('')
  const [showModal,     setShowModal]     = useState(false)
  const [trabajadorSel, setTrabajadorSel] = useState(null)
  const [modalEstatus,  setModalEstatus]  = useState(null)   // trabajador a cambiar estatus
  const [confirmCerrar, setConfirmCerrar] = useState(null)   // incidencia a cerrar
  const [confirmCancel, setConfirmCancel] = useState(null)   // incidencia a cancelar
  const [motCancel,     setMotCancel]     = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [data, kpisData] = await Promise.all([
        getIncidencias({
          tipo:         filtroTipo   || undefined,
          estatus:      filtroEstatus || undefined,
          trabajadorId: trabajadorFiltro?.id || undefined,
        }),
        getIncidenciasKpis(),
      ])
      setIncidencias(data)
      setKpis(kpisData)
    } catch (e) {
      toast.error('Error al cargar incidencias: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [filtroTipo, filtroEstatus, trabajadorFiltro])

  useEffect(() => { cargar() }, [cargar])

  const handleCerrar = async (inc) => {
    try {
      await cerrarIncidencia(inc.id)
      toast.success('Incidencia cerrada ✓')
      setConfirmCerrar(null)
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleCancelar = async () => {
    if (!confirmCancel) return
    try {
      await cancelarIncidencia(confirmCancel.id, motCancel)
      toast.success('Incidencia cancelada')
      setConfirmCancel(null); setMotCancel('')
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const incFiltradas = incidencias.filter(inc => {
    if (!search) return true
    const q = search.toLowerCase()
    const nombre = inc.trabajador?.nombre_completo?.toLowerCase() ?? ''
    return nombre.includes(q)
  })

  // ── KPI Cards ─────────────────────────────────────────────
  const kpiItems = [
    { label: 'Activas',       value: kpis?.total_activas    ?? 0, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Vacaciones',    value: kpis?.en_vacaciones    ?? 0, color: '#1E40AF', bg: '#DBEAFE', emoji: '🏖️' },
    { label: 'Enfermos',      value: kpis?.enfermos         ?? 0, color: '#B45309', bg: '#FEF9C3', emoji: '🤒' },
    { label: 'Incapacitados', value: kpis?.incapacitados    ?? 0, color: '#991B1B', bg: '#FEE2E2', emoji: '🏥' },
    { label: 'Suspendidos',   value: kpis?.suspendidos      ?? 0, color: '#374151', bg: '#F3F4F6', emoji: '⛔' },
  ]

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpiItems.map(k => (
          <div key={k.label}
            style={{ backgroundColor: k.bg, border: `1px solid ${k.color}22` }}
            className="p-4 rounded-xl">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: k.color }}>
              {k.emoji ? `${k.emoji} ` : ''}{k.label}
            </p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre del trabajador..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        {/* Filtro tipo */}
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_INCIDENCIA_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>

        {/* Filtro estatus */}
        <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
          <option value="">Todos los estatus</option>
          {Object.entries(ESTATUS_INCIDENCIA_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>

        {/* Botón nueva incidencia */}
        <button
          onClick={() => { setTrabajadorSel(trabajadorFiltro || null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 ml-auto">
          <Plus size={14} /> Nueva Incidencia
        </button>
      </div>

      {/* Lista de incidencias */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Cargando incidencias…</span>
        </div>
      ) : incFiltradas.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Sin incidencias registradas</p>
          <p className="text-sm mt-1">
            {filtroEstatus === 'activa' ? 'No hay incidencias activas en este momento.' : 'Cambia los filtros para ver más resultados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {incFiltradas.map(inc => (
            <IncidenciaCard
              key={inc.id}
              inc={inc}
              onCerrar={setConfirmCerrar}
              onCancelar={setConfirmCancel}
              toast={toast}
            />
          ))}
          <p className="text-xs text-gray-400 text-center pt-2">
            {incFiltradas.length} incidencia{incFiltradas.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* ── Modal: Nueva incidencia ── */}
      <ModalNuevaIncidencia
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={cargar}
        toast={toast}
        trabajadorPresel={trabajadorSel}
      />

      {/* ── Modal: Cambiar estatus del trabajador ── */}
      <ModalEstatusTrabajador
        trabajador={modalEstatus}
        isOpen={!!modalEstatus}
        onClose={() => setModalEstatus(null)}
        onSuccess={cargar}
        toast={toast}
      />

      {/* ── Confirm: Cerrar incidencia ── */}
      {confirmCerrar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="font-bold text-gray-900 mb-2">¿Cerrar esta incidencia?</p>
            <p className="text-sm text-gray-500 mb-4">
              Se marcará como cerrada y el empleado volverá a estatus activo
              si no tiene otras incidencias en curso.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmCerrar(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => handleCerrar(confirmCerrar)}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium">
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm: Cancelar incidencia ── */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="font-bold text-gray-900 mb-2">Cancelar incidencia</p>
            <p className="text-sm text-gray-500 mb-3">Solo cancela si fue registrada por error.</p>
            <textarea rows={2} value={motCancel}
              onChange={e => setMotCancel(e.target.value)}
              placeholder="Motivo de cancelación…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setConfirmCancel(null); setMotCancel('') }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                No cancelar
              </button>
              <button onClick={handleCancelar}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">
                Cancelar incidencia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
