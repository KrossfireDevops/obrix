// ============================================================
//  OBRIX ERP — Detalle de Expediente
//  src/pages/personal/ExpedienteDetalle.jsx  |  v1.1
//
//  Correcciones v1.1:
//    · Avatar protegido contra nombre/apellido_paterno null
//    · getTrabajador() normaliza retorno ({ data } o directo)
// ============================================================

import { useState, useEffect } from 'react'
import {
  X, CreditCard, Edit2, RefreshCw, CheckCircle,
  Building2, Calendar,
} from 'lucide-react'
import {
  getTrabajador, asignarAProyecto,
  TIPO_PERSONAL_CFG, ESQUEMA_PAGO_CFG,
} from '../../services/gestionPersonal.service'
import * as projectsService from '../../services/projects.service'

// ── Helper: iniciales seguras para el avatar ──────────────────
const iniciales = (t) => {
  const n = (t?.nombre           ?? t?.nombre_completo ?? '?')[0] ?? '?'
  const a = (t?.apellido_paterno ?? '?')[0] ?? '?'
  return (n + a).toUpperCase()
}

// ── Helper: normalizar retorno del servicio ───────────────────
const normalizarTrabajador = (resultado) => {
  if (!resultado) return null
  // Retorno directo del objeto
  if (resultado.id) return resultado
  // Patrón Supabase { data, error }
  if (resultado.data?.id) return resultado.data
  return null
}

export default function ExpedienteDetalle({ trabajadorId, onClose, onEdit, toast }) {
  const [trabajador, setTrabajador] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [projects,   setProjects]   = useState([])
  const [asignando,  setAsignando]  = useState(false)
  const [formAsig,   setFormAsig]   = useState({ projectId: '', rol: '' })

  useEffect(() => {
    cargar()
    projectsService.getProjects().then(({ data }) =>
      setProjects((data ?? []).filter(p => p.status === 'active'))
    )
  }, [trabajadorId])

  const cargar = async () => {
    setLoading(true)
    try {
      const resultado = await getTrabajador(trabajadorId)
      const t = normalizarTrabajador(resultado)
      if (!t) throw new Error('No se encontró el trabajador')
      setTrabajador(t)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAsignar = async () => {
    if (!formAsig.projectId) return
    try {
      await asignarAProyecto({
        trabajadorId,
        projectId: formAsig.projectId,
        rol: formAsig.rol || null,
      })
      toast.success('Trabajador asignado al proyecto ✓')
      setAsignando(false)
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-12">
        <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto" />
      </div>
    </div>
  )

  if (!trabajador) return null

  const tipoCfg    = TIPO_PERSONAL_CFG[trabajador.tipo_personal] ?? TIPO_PERSONAL_CFG.temporal
  const esquemaCfg = ESQUEMA_PAGO_CFG[trabajador.esquema_pago]   ?? ESQUEMA_PAGO_CFG.jornada

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center lg:justify-end z-50 p-0 lg:p-4">
      <div className="bg-white w-full lg:w-96 h-[90vh] lg:h-[92vh] rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Expediente</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(trabajador)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
              <Edit2 size={15} />
            </button>
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Avatar + nombre */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 shrink-0">
              {iniciales(trabajador)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{trabajador.nombre_completo}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${tipoCfg.color}`}>
                  {tipoCfg.emoji} {tipoCfg.label}
                </span>
                {trabajador.especialidad && (
                  <span className="text-xs text-gray-500">{trabajador.especialidad}</span>
                )}
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="space-y-2">
            {[
              { label: 'RFC',   value: trabajador.rfc      ?? '—', mono: true },
              { label: 'CURP',  value: trabajador.curp     ?? '—', mono: true },
              { label: 'NSS',   value: trabajador.nss      ?? '—', mono: true },
              { label: 'Tel',   value: trabajador.telefono ?? '—' },
              { label: 'Email', value: trabajador.email    ?? '—' },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs text-gray-400 font-medium w-12">{label}</span>
                <span className={`text-sm text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Esquema de pago */}
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
              <CreditCard size={12} /> Esquema de pago
            </p>
            <p className="text-sm text-indigo-800">{esquemaCfg.emoji} {esquemaCfg.label}</p>
            {trabajador.tarifa_diaria && (
              <p className="text-xs text-indigo-600 mt-1">
                Tarifa diaria: <strong>${Number(trabajador.tarifa_diaria).toLocaleString('es-MX')}</strong>
              </p>
            )}
            {trabajador.tarifa_destajo && (
              <p className="text-xs text-indigo-600 mt-1">
                Destajo: <strong>${Number(trabajador.tarifa_destajo).toLocaleString('es-MX')} / {trabajador.unidad_destajo}</strong>
              </p>
            )}
          </div>

          {/* IMSS */}
          {trabajador.imss_activo && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                <CheckCircle size={12} /> IMSS activo
              </p>
              <p className="text-xs text-green-600 mt-1">
                Alta: {trabajador.fecha_alta_imss
                  ? new Date(trabajador.fecha_alta_imss).toLocaleDateString('es-MX')
                  : '—'}
              </p>
            </div>
          )}

          {/* Proyecto asignado */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 size={12} /> Proyecto asignado
              </p>
              <button onClick={() => setAsignando(!asignando)}
                className="text-xs text-indigo-600 hover:underline">
                {asignando ? 'Cancelar' : 'Cambiar'}
              </button>
            </div>

            {asignando ? (
              <div className="space-y-2">
                <select value={formAsig.projectId}
                  onChange={e => setFormAsig(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
                  <option value="">— Seleccionar proyecto —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                  ))}
                </select>
                <input type="text" value={formAsig.rol}
                  onChange={e => setFormAsig(f => ({ ...f, rol: e.target.value }))}
                  placeholder="Rol en el proyecto (opcional)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
                <button onClick={handleAsignar} disabled={!formAsig.projectId}
                  className="w-full py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50">
                  Confirmar asignación
                </button>
              </div>
            ) : (
              <p className={`text-sm ${trabajador.projects ? 'text-gray-800 font-medium' : 'text-gray-400 italic'}`}>
                {trabajador.projects
                  ? `[${trabajador.projects.code}] ${trabajador.projects.name}`
                  : 'Sin proyecto asignado'}
              </p>
            )}
          </div>

          {/* Historial de proyectos */}
          {(trabajador.personal_asignaciones ?? []).length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Calendar size={12} /> Historial de proyectos
              </p>
              <div className="space-y-1">
                {trabajador.personal_asignaciones
                  .sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))
                  .slice(0, 5)
                  .map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                      <span className="text-gray-700 font-medium">
                        [{a.projects?.code}] {a.projects?.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        a.es_actual
                          ? 'bg-green-100 text-green-700 font-medium'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.es_actual
                          ? 'Actual'
                          : new Date(a.fecha_inicio).toLocaleDateString('es-MX', {
                              month: 'short', year: 'numeric',
                            })}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}