// ============================================================
//  OBRIX ERP — Componente: HistorialResponsables
//  src/pages/projects/HistorialResponsables.jsx  |  v1.0
// ============================================================

import { useState, useEffect } from 'react'
import { User, RefreshCw, Clock } from 'lucide-react'
import { getHistorialResponsables } from '../../services/cierreProyecto.service'

export default function HistorialResponsables({ projectId, projectName }) {
  const [historial, setHistorial] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!projectId) return
    getHistorialResponsables(projectId)
      .then(setHistorial)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return (
    <div className="flex justify-center py-8">
      <RefreshCw size={16} className="animate-spin text-indigo-400" />
    </div>
  )

  if (historial.length === 0) return (
    <div className="py-8 text-center">
      <User size={32} className="text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500">Sin historial de responsables</p>
      <p className="text-xs text-gray-400 mt-1">Asigna un responsable al proyecto para comenzar el registro.</p>
    </div>
  )

  return (
    <div className="space-y-1">
      {historial.map((h, idx) => (
        <div key={h.id} className="flex gap-3">
          {/* Timeline vertical */}
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
              h.es_actual ? 'bg-indigo-600' : 'bg-gray-300'
            }`} />
            {idx < historial.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 my-1" />
            )}
          </div>

          {/* Contenido */}
          <div className={`flex-1 pb-4 ${idx < historial.length - 1 ? '' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{h.nombre}</p>
                  {h.es_actual && (
                    <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                      Actual
                    </span>
                  )}
                </div>
                {h.puesto && (
                  <p className="text-xs text-gray-500 mt-0.5">{h.puesto}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                  <Clock size={10} />
                  {new Date(h.fecha_inicio).toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })}
                </p>
                {h.fecha_fin && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    hasta {new Date(h.fecha_fin).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </div>

            {h.motivo_cambio && (
              <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                {h.motivo_cambio}
              </p>
            )}
            {h.cambiado_por_nombre && (
              <p className="text-xs text-gray-400 mt-1">
                Asignado por: {h.cambiado_por_nombre}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
