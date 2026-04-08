// ============================================================
//  OBRIX ERP — Pre-Nómina Page
//  src/pages/personal/PreNominaPage.jsx  |  v1.1
//
//  Correcciones v1.1:
//    · getPrenominas() normaliza retorno ({ data } o array)
//    · getPrenominaDetalle() normaliza retorno
//    · crearPrenomina() normaliza retorno
//    · onRefresh() normaliza retorno
//    · Fechas protegidas contra null → 'Invalid Date'
//    · Number() protegido contra null → '$NaN'
// ============================================================

import { useState, useEffect } from 'react'
import { Plus, RefreshCw, ChevronRight, CheckCircle, FileText } from 'lucide-react'
import {
  getPrenominas, getPrenominaDetalle, crearPrenomina,
  cargarTrabajadoresEnPrenomina, actualizarDetallePrenomina,
  cambiarEstatusPreNomina, ESTATUS_PRENOMINA_CFG, TIPO_PERSONAL_CFG,
} from '../../services/gestionPersonal.service'
import { useAuth } from '../../context/AuthContext'
import * as projectsService from '../../services/projects.service'

// ── Helpers ───────────────────────────────────────────────────

// Normaliza retorno del servicio: array directo o { data, error }
const normalizarArray = (res) => {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.data)) return res.data
  return []
}

// Normaliza retorno de un objeto único
const normalizarObjeto = (res) => {
  if (!res) return null
  if (res.id) return res
  if (res.data?.id) return res.data
  return null
}

// Formatea fecha de forma segura
const fmtFecha = (fecha, opts) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', opts)
}

// Formatea moneda de forma segura
const fmtMonto = (valor) =>
  `$${Number(valor || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

// ─────────────────────────────────────────────────────────────

export default function PreNominaPage({ toast }) {
  const { user } = useAuth()
  const [prenominas,   setPrenominas]   = useState([])
  const [seleccionada, setSeleccionada] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [projects,     setProjects]     = useState([])
  const [showNueva,    setShowNueva]    = useState(false)

  useEffect(() => {
    cargar()
    projectsService.getProjects().then(({ data }) =>
      setProjects((data ?? []).filter(p => p.status === 'active'))
    )
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await getPrenominas()
      setPrenominas(normalizarArray(res))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const abrirPrenomina = async (p) => {
    try {
      const res = await getPrenominaDetalle(p.id)
      const detalle = normalizarObjeto(res)
      if (!detalle) throw new Error('No se pudo cargar el detalle')
      setSeleccionada(detalle)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleCambioEstatus = async (prenominaId, estatus) => {
    try {
      await cambiarEstatusPreNomina(prenominaId, estatus, user?.id)
      toast.success(estatus === 'aprobada' ? 'Pre-nómina aprobada' : 'Marcada como pagada')
      const res = await getPrenominaDetalle(prenominaId)
      setSeleccionada(normalizarObjeto(res))
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (seleccionada) {
    return (
      <DetallePrenomina
        prenomina={seleccionada}
        onVolver={() => setSeleccionada(null)}
        onRefresh={async () => {
          const res = await getPrenominaDetalle(seleccionada.id)
          const detalle = normalizarObjeto(res)
          if (detalle) setSeleccionada(detalle)
        }}
        onCambioEstatus={handleCambioEstatus}
        toast={toast}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {prenominas.length} período{prenominas.length !== 1 ? 's' : ''} registrado{prenominas.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowNueva(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
          <Plus size={14} /> Nueva Pre-Nómina
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-indigo-400" />
        </div>
      ) : prenominas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay pre-nóminas registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prenominas.map(p => {
            const est = ESTATUS_PRENOMINA_CFG[p.estatus] ?? ESTATUS_PRENOMINA_CFG.borrador
            return (
              <div key={p.id} onClick={() => abrirPrenomina(p)}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{p.periodo_nombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtFecha(p.fecha_inicio, { day: '2-digit', month: 'short' })} —{' '}
                    {fmtFecha(p.fecha_fin,    { day: '2-digit', month: 'short', year: 'numeric' })}
                    {p.projects && ` · [${p.projects.code}] ${p.projects.name}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-800">{fmtMonto(p.total_neto)}</p>
                  <p className="text-xs text-gray-400">{p.total_trabajadores} trabajadores</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium shrink-0 ${est.color}`}>
                  {est.label}
                </span>
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      {showNueva && (
        <NuevaPrenominaModal
          projects={projects}
          onSuccess={async (nuevaRaw) => {
            setShowNueva(false)
            const nueva = normalizarObjeto(nuevaRaw)
            if (!nueva) { toast.error('Error al crear la pre-nómina'); return }
            toast.success('Pre-nómina creada ✓')
            if (nueva.project_id) {
              await cargarTrabajadoresEnPrenomina(nueva.id, nueva.project_id)
            }
            const res = await getPrenominaDetalle(nueva.id)
            const detalle = normalizarObjeto(res)
            if (detalle) setSeleccionada(detalle)
            cargar()
          }}
          onClose={() => setShowNueva(false)}
          toast={toast}
        />
      )}
    </div>
  )
}

// ── Detalle de una pre-nómina ─────────────────────────────────

function DetallePrenomina({ prenomina, onVolver, onRefresh, onCambioEstatus, toast }) {
  const det        = prenomina.personal_prenomina_det ?? []
  const est        = ESTATUS_PRENOMINA_CFG[prenomina.estatus] ?? ESTATUS_PRENOMINA_CFG.borrador
  const esBorrador = prenomina.estatus === 'borrador'

  const handleUpdate = async (detId, campo, valor) => {
    try {
      await actualizarDetallePrenomina(detId, { [campo]: Number(valor) })
      await onRefresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">

      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <button onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
          ← Volver
        </button>
        <div className="flex items-center gap-2">
          {prenomina.estatus === 'borrador' && (
            <button onClick={() => onCambioEstatus(prenomina.id, 'aprobada')}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700">
              <CheckCircle size={14} /> Aprobar
            </button>
          )}
          {prenomina.estatus === 'aprobada' && (
            <button onClick={() => onCambioEstatus(prenomina.id, 'pagada')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
              <CheckCircle size={14} /> Marcar Pagada
            </button>
          )}
        </div>
      </div>

      {/* Header de la pre-nómina */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{prenomina.periodo_nombre}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {fmtFecha(prenomina.fecha_inicio, { day: '2-digit', month: 'long' })} al{' '}
              {fmtFecha(prenomina.fecha_fin,    { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className={`px-3 py-1.5 text-sm rounded-full font-semibold ${est.color}`}>
            {est.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          {[
            { label: 'Trabajadores',    value: prenomina.total_trabajadores ?? 0 },
            { label: 'Días trabajados', value: prenomina.total_dias_trabajados ?? 0 },
            { label: 'Total bruto',     value: fmtMonto(prenomina.total_bruto) },
            { label: 'Neto a pagar',    value: fmtMonto(prenomina.total_neto), bold: true },
          ].map(({ label, value, bold }) => (
            <div key={label} className="text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-sm ${bold ? 'font-bold text-indigo-700 text-base' : 'font-semibold text-gray-800'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de trabajadores */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-sm font-medium text-gray-700">{det.length} trabajadores en este período</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Trabajador','Tipo','Días','H. Extra','Percepciones','Deducciones','Neto','Pago'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {det.map(d => {
                const t       = d.personal_expediente
                const tipoCfg = TIPO_PERSONAL_CFG[t?.tipo_personal] ?? TIPO_PERSONAL_CFG.temporal
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900 text-xs">
                        {t?.nombre ?? '—'} {t?.apellido_paterno ?? ''}
                      </p>
                      <p className="text-xs text-gray-400">{t?.especialidad ?? ''}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${tipoCfg.color}`}>
                        {tipoCfg.emoji}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {esBorrador ? (
                        <input type="number" min="0" max="7" step="0.5"
                          defaultValue={d.dias_trabajados}
                          onBlur={e => handleUpdate(d.id, 'dias_trabajados', e.target.value)}
                          className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 text-center" />
                      ) : (
                        <span className="font-semibold">{d.dias_trabajados}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {esBorrador ? (
                        <input type="number" min="0" step="0.5"
                          defaultValue={d.horas_extra}
                          onBlur={e => handleUpdate(d.id, 'horas_extra', e.target.value)}
                          className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 text-center" />
                      ) : (
                        <span>{d.horas_extra}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-green-700 font-semibold text-xs">
                      {fmtMonto(d.total_percepciones)}
                    </td>
                    <td className="px-3 py-3 text-red-600 text-xs">
                      {fmtMonto(d.total_deducciones)}
                    </td>
                    <td className="px-3 py-3 font-bold text-indigo-700">
                      {fmtMonto(d.neto_pagar)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium capitalize ${
                        d.pagado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {d.pagado ? '✓ Pagado' : (d.forma_pago ?? 'Pendiente')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Modal nueva pre-nómina ────────────────────────────────────

function NuevaPrenominaModal({ projects, onSuccess, onClose, toast }) {
  const [form, setForm] = useState({
    periodoNombre: '',
    fechaInicio:   '',
    fechaFin:      '',
    tipoPeriodo:   'semanal',
    projectId:     '',
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-generar nombre del período cuando cambian las fechas
  useEffect(() => {
    if (form.fechaInicio && form.fechaFin) {
      const ini = new Date(form.fechaInicio + 'T12:00:00')
      const fin = new Date(form.fechaFin   + 'T12:00:00')
      if (!isNaN(ini) && !isNaN(fin)) {
        const label =
          ini.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) +
          ' al ' +
          fin.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        set('periodoNombre', label)
      }
    }
  }, [form.fechaInicio, form.fechaFin])

  const handleGuardar = async () => {
    if (!form.periodoNombre || !form.fechaInicio || !form.fechaFin) return
    setGuardando(true)
    try {
      const nueva = await crearPrenomina({
        projectId:     form.projectId || null,
        periodoNombre: form.periodoNombre,
        fechaInicio:   form.fechaInicio,
        fechaFin:      form.fechaFin,
        tipoPeriodo:   form.tipoPeriodo,
      })
      onSuccess(nueva)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">📋 Nueva Pre-Nómina</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">

          {/* Tipo de período */}
          <div className="flex gap-3">
            {['semanal', 'quincenal', 'mensual'].map(t => (
              <button key={t} type="button" onClick={() => set('tipoPeriodo', t)}
                className={`flex-1 py-2 text-xs font-medium rounded-xl border-2 capitalize transition-all ${
                  form.tipoPeriodo === t
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600'
                }`}>{t}</button>
            ))}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
              <input type="date" value={form.fechaInicio}
                onChange={e => set('fechaInicio', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
              <input type="date" value={form.fechaFin}
                onChange={e => set('fechaFin', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
          </div>

          {/* Nombre del período */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del período</label>
            <input type="text" value={form.periodoNombre}
              onChange={e => set('periodoNombre', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
          </div>

          {/* Proyecto */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proyecto (opcional)</label>
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
              <option value="">— General (todos los proyectos) —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Si seleccionas un proyecto, los trabajadores asignados se cargan automáticamente.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar}
            disabled={guardando || !form.fechaInicio || !form.fechaFin}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {guardando && <RefreshCw size={14} className="animate-spin" />}
            Crear Pre-Nómina
          </button>
        </div>
      </div>
    </div>
  )
}