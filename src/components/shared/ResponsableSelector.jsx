// ============================================================
//  OBRIX ERP — Componente: ResponsableSelector
//  src/components/shared/ResponsableSelector.jsx  |  v1.0
//
//  Selector reutilizable de Supervisor/Encargado.
//  Se usa en: ProjectWizard, ProjectForm, ProjectTree
//  (niveles y secciones)
// ============================================================

import { useState, useEffect } from 'react'
import { User, RefreshCw } from 'lucide-react'
import { supabase } from '../../config/supabase'

// ── Obtener supervisores via RPC ─────────────────────────────
async function getSupervisores() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('users_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .rpc('get_supervisores', { p_company_id: profile.company_id })
  if (error) throw error
  return data ?? []
}

// ============================================================
//  HOOK: useSupervisores
// ============================================================

export function useSupervisores() {
  const [supervisores, setSupervisores] = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    getSupervisores()
      .then(setSupervisores)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { supervisores, loading }
}

// ============================================================
//  COMPONENTE: ResponsableSelector
//
//  Props:
//    value       — UUID del responsable seleccionado (o '')
//    onChange    — fn(uuid | '') llamada al cambiar
//    label       — string, default 'Responsable'
//    placeholder — string, default '— Heredado del proyecto —'
//    showBadge   — bool, muestra badge "Hereda" cuando value=''
//    size        — 'sm' | 'md' (default 'md')
// ============================================================

export default function ResponsableSelector({
  value       = '',
  onChange,
  label       = 'Responsable',
  placeholder = '— Heredado —',
  showBadge   = false,
  size        = 'md',
}) {
  const { supervisores, loading } = useSupervisores()

  const inputClass = size === 'sm'
    ? 'w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300'
    : 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'

  const seleccionado = supervisores.find(s => s.id === value)

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className={`font-medium text-gray-600 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
            <User size={11} className="inline mr-1 text-gray-400" />
            {label}
          </label>
          {showBadge && !value && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">
              Heredado
            </span>
          )}
          {showBadge && value && (
            <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium">
              Asignado
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl">
          <RefreshCw size={12} className="animate-spin text-gray-400" />
          <span className="text-xs text-gray-400">Cargando...</span>
        </div>
      ) : (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{placeholder}</option>
          {supervisores.length === 0 ? (
            <option disabled>No hay supervisores/encargados registrados</option>
          ) : (
            supervisores.map(s => (
              <option key={s.id} value={s.id}>
                {s.nombre_completo}
                {s.puesto ? ` — ${s.puesto}` : ''}
                {s.project_actual ? ` · [${s.project_actual}]` : ''}
              </option>
            ))
          )}
        </select>
      )}

      {/* Info del seleccionado */}
      {seleccionado && (
        <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
          <User size={10} />
          {seleccionado.puesto ?? 'Sin puesto'} ·
          {seleccionado.especialidad ?? '—'}
          {seleccionado.project_actual && ` · ${seleccionado.project_actual}`}
        </p>
      )}

      {/* Aviso si no hay supervisores */}
      {!loading && supervisores.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠️ Registra personal con puesto "Supervisor" o "Encargado" en el módulo de Personal.
        </p>
      )}
    </div>
  )
}
