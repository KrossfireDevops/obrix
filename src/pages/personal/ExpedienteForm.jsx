// ============================================================
//  OBRIX ERP — Componente: ExpedienteForm
//  src/pages/personal/ExpedienteForm.jsx  |  v1.1
//
//  Correcciones v1.1:
//    · fecha_ingreso agregado al objeto INIT (evita warning React)
//    · project_id eliminado del INIT y del formulario
//      (la asignación se gestiona desde ExpedienteDetalle)
// ============================================================

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  crearTrabajador, actualizarTrabajador,
  TIPO_PERSONAL_CFG, ESQUEMA_PAGO_CFG, ESPECIALIDADES,
} from '../../services/gestionPersonal.service'

const INIT = {
  nombre:            '',
  apellido_paterno:  '',
  apellido_materno:  '',
  fecha_nacimiento:  '',
  curp:              '',
  rfc:               '',
  telefono:          '',
  email:             '',
  direccion:         '',
  tipo_personal:     'temporal',
  especialidad:      '',
  puesto:            '',
  fecha_ingreso:     '',        // ← agregado en v1.1
  nss:               '',
  imss_activo:       false,
  fecha_alta_imss:   '',
  salario_base_imss: '',
  esquema_pago:      'jornada',
  tarifa_diaria:     '',
  tarifa_destajo:    '',
  unidad_destajo:    '',
  banco:             '',
  clabe:             '',
}

export default function ExpedienteForm({ inicial, onSuccess, onCancel }) {
  const [form,      setForm]      = useState({ ...INIT, ...(inicial ?? {}) })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState(null)
  const [seccion,   setSeccion]   = useState('datos')

  const SECCIONES = [
    { id: 'datos',   label: 'Datos Personales' },
    { id: 'laboral', label: 'Info Laboral'      },
    { id: 'pago',    label: 'Esquema de Pago'   },
    { id: 'imss',    label: 'IMSS'              },
  ]

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.apellido_paterno.trim()) {
      setError('Nombre y apellido paterno son obligatorios.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const payload = {
        ...form,
        tarifa_diaria:     form.tarifa_diaria     ? Number(form.tarifa_diaria)     : null,
        tarifa_destajo:    form.tarifa_destajo     ? Number(form.tarifa_destajo)    : null,
        salario_base_imss: form.salario_base_imss  ? Number(form.salario_base_imss) : null,
        nss:               form.nss               || null,
        rfc:               form.rfc               || null,
        curp:              form.curp              || null,
        fecha_nacimiento:  form.fecha_nacimiento  || null,
        fecha_alta_imss:   form.fecha_alta_imss   || null,
        fecha_ingreso:     form.fecha_ingreso     || null,
      }

      const result = inicial
        ? await actualizarTrabajador(inicial.id, payload)
        : await crearTrabajador(payload)

      onSuccess(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs internos */}
      <div className="flex gap-1 border-b border-gray-200">
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => setSeccion(s.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              seccion === s.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── DATOS PERSONALES ── */}
      {seccion === 'datos' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre(s) *</label>
              <input type="text" value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ap. Paterno *</label>
              <input type="text" value={form.apellido_paterno}
                onChange={e => set('apellido_paterno', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ap. Materno</label>
              <input type="text" value={form.apellido_materno}
                onChange={e => set('apellido_materno', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CURP</label>
              <input type="text" maxLength={18} value={form.curp}
                onChange={e => set('curp', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none font-mono uppercase" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">RFC</label>
              <input type="text" maxLength={13} value={form.rfc}
                onChange={e => set('rfc', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none font-mono uppercase" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento</label>
              <input type="date" value={form.fecha_nacimiento}
                onChange={e => set('fecha_nacimiento', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input type="tel" value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
            <input type="text" value={form.direccion}
              onChange={e => set('direccion', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
          </div>
        </div>
      )}

      {/* ── INFO LABORAL ── */}
      {seccion === 'laboral' && (
        <div className="space-y-4">
          {/* Tipo de personal */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Tipo de personal
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TIPO_PERSONAL_CFG).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('tipo_personal', k)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                    form.tipo_personal === k
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-xl">{v.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{v.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Especialidad + Puesto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Especialidad / Oficio</label>
              <select value={form.especialidad} onChange={e => set('especialidad', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
                <option value="">— Seleccionar —</option>
                {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Puesto / Categoría</label>
              <input type="text" value={form.puesto}
                onChange={e => set('puesto', e.target.value)}
                placeholder="Ej: Oficial, Ayudante, Supervisor"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
          </div>

          {/* Fecha de ingreso */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de ingreso</label>
            <input type="date" value={form.fecha_ingreso}
              onChange={e => set('fecha_ingreso', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs text-blue-700">
              💡 La asignación a proyecto se gestiona desde el panel de <strong>Expediente</strong>
              del trabajador, donde también queda registrado el historial de proyectos.
            </p>
          </div>
        </div>
      )}

      {/* ── ESQUEMA DE PAGO ── */}
      {seccion === 'pago' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Esquema de pago
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ESQUEMA_PAGO_CFG).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('esquema_pago', k)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                    form.esquema_pago === k
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-xl">{v.emoji}</span>
                  <p className="text-sm font-semibold text-gray-800">{v.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tarifa diaria */}
          {['jornada', 'mixto'].includes(form.esquema_pago) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa diaria (MXN)</label>
              <input type="number" min="0" step="0.01" value={form.tarifa_diaria}
                onChange={e => set('tarifa_diaria', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
          )}

          {/* Tarifa destajo */}
          {['destajo', 'mixto'].includes(form.esquema_pago) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa por unidad (MXN)</label>
                <input type="number" min="0" step="0.01" value={form.tarifa_destajo}
                  onChange={e => set('tarifa_destajo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unidad de destajo</label>
                <input type="text" value={form.unidad_destajo}
                  onChange={e => set('unidad_destajo', e.target.value)}
                  placeholder="Ej: m², ml, pieza"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              </div>
            </div>
          )}

          {/* Datos bancarios */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Datos bancarios
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Banco</label>
                <input type="text" value={form.banco}
                  onChange={e => set('banco', e.target.value)}
                  placeholder="Ej: BBVA, Santander"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">CLABE interbancaria</label>
                <input type="text" maxLength={18} value={form.clabe}
                  onChange={e => set('clabe', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none font-mono" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IMSS ── */}
      {seccion === 'imss' && (
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
            <input type="checkbox" checked={form.imss_activo}
              onChange={e => set('imss_activo', e.target.checked)}
              className="w-4 h-4 rounded" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Trabajador inscrito en IMSS</p>
              <p className="text-xs text-gray-500">Solo aplica para personal de planta</p>
            </div>
          </label>

          {form.imss_activo && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NSS (Núm. Seguridad Social)</label>
                  <input type="text" maxLength={11} value={form.nss}
                    onChange={e => set('nss', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de alta IMSS</label>
                  <input type="date" value={form.fecha_alta_imss}
                    onChange={e => set('fecha_alta_imss', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Salario Base de Cotización (MXN)
                </label>
                <input type="number" min="0" step="0.01" value={form.salario_base_imss}
                  onChange={e => set('salario_base_imss', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
                <p className="text-xs text-gray-400 mt-1">SBC para el cálculo de cuotas IMSS</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleGuardar} disabled={guardando}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          {guardando && <RefreshCw size={14} className="animate-spin" />}
          {inicial ? 'Actualizar' : 'Guardar Trabajador'}
        </button>
      </div>
    </div>
  )
}