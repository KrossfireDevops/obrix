// ============================================================
//  OBRIX ERP — Panel de Validación de Avances
//  src/pages/obra/ValidacionPanel.jsx  |  v1.0
// ============================================================

import { useState } from 'react'
import { CheckCircle, XCircle, Camera, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { validarAvance, rechazarAvance, TIPO_AVANCE_CFG } from '../../services/avancesObra.service'

export default function ValidacionPanel({ pendientes, onRefresh, toast }) {
  const [expandido, setExpandido] = useState(null)
  const [notas,     setNotas]     = useState({})
  const [cargando,  setCargando]  = useState(null)

  const handleValidar = async (avanceId) => {
    setCargando(avanceId)
    try {
      await validarAvance(avanceId, notas[avanceId] ?? '')
      toast.success('Avance validado ✓')
      onRefresh()
    } catch (e) { toast.error(e.message) }
    finally { setCargando(null) }
  }

  const handleRechazar = async (avanceId) => {
    if (!notas[avanceId]?.trim()) { toast.error('Escribe el motivo del rechazo'); return }
    setCargando(avanceId)
    try {
      await rechazarAvance(avanceId, notas[avanceId])
      toast.success('Avance rechazado')
      onRefresh()
    } catch (e) { toast.error(e.message) }
    finally { setCargando(null) }
  }

  if (pendientes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
        <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Todo al día</p>
        <p className="text-sm text-gray-400 mt-1">No hay avances pendientes de validar</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {pendientes.length} registro{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} de validación
      </p>
      {pendientes.map(avance => {
        const tipoCfg = TIPO_AVANCE_CFG[avance.tipo] ?? TIPO_AVANCE_CFG.avance
        const abierto = expandido === avance.id
        const fotos   = avance.obra_avance_fotos ?? []
        return (
          <div key={avance.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandido(abierto ? null : avance.id)}>
              <span className="text-xl shrink-0">{tipoCfg.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-indigo-500">{avance.project_sections?.section_code}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${tipoCfg.color}`}>{tipoCfg.label}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate">{avance.project_sections?.nombre}</p>
                <p className="text-xs text-gray-400">
                  {avance.project_levels?.nivel_nombre} · {avance.pct_anterior}% → <strong>{avance.pct_nuevo}%</strong> · {avance.nombre_registrador ?? 'Sin nombre'}
                  {fotos.length > 0 && ` · ${fotos.length} 📷`}
                  {' · '}{new Date(avance.fecha_registro).toLocaleDateString('es-MX', { day:'2-digit', month:'short' })}
                </p>
              </div>
              {abierto ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
            </div>

            {abierto && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-gray-700">{avance.descripcion}</p>
                </div>
                {fotos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Camera size={11} /> Evidencia fotográfica
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {fotos.sort((a,b) => a.orden - b.orden).map(f => (
                        <a key={f.id} href={f.foto_url} target="_blank" rel="noopener noreferrer">
                          <img src={f.foto_url} alt="Evidencia"
                            className="w-full aspect-square object-cover rounded-lg border border-gray-200 hover:border-indigo-400 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(avance.obra_avance_materiales ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Materiales consumidos</p>
                    <div className="space-y-1">
                      {avance.obra_avance_materiales.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-sm bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                          <span className="text-gray-700">{m.nombre_material}</span>
                          <span className="text-gray-500 text-xs font-medium">{m.cantidad_usada} {m.cantidad_unidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Notas (requeridas para rechazo)
                  </label>
                  <textarea rows={2} value={notas[avance.id] ?? ''}
                    onChange={e => setNotas(prev => ({ ...prev, [avance.id]: e.target.value }))}
                    placeholder="Observaciones o motivo de rechazo..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => handleRechazar(avance.id)} disabled={cargando === avance.id}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50">
                    <XCircle size={14} /> Rechazar
                  </button>
                  <button onClick={() => handleValidar(avance.id)} disabled={cargando === avance.id}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium disabled:opacity-50">
                    {cargando === avance.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Validar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}