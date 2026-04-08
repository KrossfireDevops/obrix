// ============================================================
//  OBRIX ERP — Modal de Preferencias de Usuario
//  src/components/UserPreferencesModal.jsx
//
//  El usuario elige su pantalla inicial al entrar a OBRIX.
//  Se guarda en users_profiles.home_path + localStorage.
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import {
  X, Check, RefreshCw, LayoutDashboard,
  FolderOpen, TrendingUp, Receipt, Scale,
  ShoppingCart, HardHat, BarChart2, Package,
  Zap, FileText, Shield, Inbox,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// OPCIONES DE PANTALLA INICIAL — organizadas por categoría
// ─────────────────────────────────────────────────────────────
const OPCIONES = [
  {
    categoria: 'General',
    items: [
      { label: 'Dashboard principal',  path: '/dashboard',              icon: LayoutDashboard, desc: 'Vista general de KPIs de toda la empresa' },
    ]
  },
  {
    categoria: 'Operación de Obra',
    items: [
      { label: 'Proyectos',            path: '/projects',               icon: FolderOpen,   desc: 'Lista de proyectos activos' },
      { label: 'Avances de Obra',      path: '/obra/avances',           icon: TrendingUp,   desc: 'Registro de avances por sección' },
      { label: 'Programa de Obra',     path: '/obra/programa',          icon: BarChart2,    desc: 'Gantt y programación de actividades' },
    ]
  },
  {
    categoria: 'Comercial',
    items: [
      { label: 'Pipeline Comercial',   path: '/comercial/pipeline',     icon: TrendingUp,   desc: 'Tablero Kanban de oportunidades' },
      { label: 'Dashboard Comercial',  path: '/comercial/dashboard',    icon: BarChart2,    desc: 'KPIs y análisis del pipeline' },
      { label: 'Nueva Cotización',     path: '/comercial/cotizacion/nueva', icon: FileText, desc: 'Generar una cotización directamente' },
    ]
  },
  {
    categoria: 'Gastos',
    items: [
      { label: 'Mis Gastos',           path: '/gastos/mis-gastos',      icon: Receipt,      desc: 'Registro personal de gastos' },
      { label: 'Aprobaciones',         path: '/gastos/aprobaciones',    icon: Check,        desc: 'Gastos pendientes de aprobación' },
      { label: 'Caja Chica',           path: '/gastos/reposicion-caja', icon: Package,      desc: 'Gestión de fondo fijo' },
    ]
  },
  {
    categoria: 'Materiales y Compras',
    items: [
      { label: 'Inventario',           path: '/inventory',              icon: Package,      desc: 'Stock actual por almacén' },
      { label: 'Solicitudes',          path: '/materials/requests',     icon: ShoppingCart, desc: 'Solicitudes de material en proceso' },
      { label: 'Órdenes de Compra',    path: '/compras/ordenes',        icon: ShoppingCart, desc: 'OC abiertas y en seguimiento' },
    ]
  },
  {
    categoria: 'Personal',
    items: [
      { label: 'Directorio',           path: '/personal',               icon: HardHat,      desc: 'Expedientes del equipo' },
    ]
  },
  {
    categoria: 'Finanzas',
    items: [
      { label: 'Buzón Fiscal SAT',     path: '/contabilidad/buzon',     icon: Inbox,        desc: 'CFDIs recibidos y emitidos' },
      { label: 'Libro Mayor',          path: '/contabilidad/libro-mayor', icon: Scale,      desc: 'Saldos y movimientos contables' },
    ]
  },
]

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────
export default function UserPreferencesModal({ onClose }) {
  const [current,  setCurrent]  = useState('/dashboard')
  const [selected, setSelected] = useState('/dashboard')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [userId,   setUserId]   = useState(null)
  const [error,    setError]    = useState(null)

  // Cargar preferencia actual
  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem('obrix_home_path')
      if (cached) { setCurrent(cached); setSelected(cached) }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('users_profiles')
        .select('home_path')
        .eq('id', user.id)
        .single()

      if (data?.home_path) {
        setCurrent(data.home_path)
        setSelected(data.home_path)
      }
    }
    load()
  }, [])

  const handleGuardar = async () => {
    if (selected === current) { onClose(); return }
    if (!userId) {
      setError('No se pudo identificar tu usuario. Recarga la página e intenta de nuevo.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: dbError } = await supabase
        .from('users_profiles')
        .update({ home_path: selected })
        .eq('id', userId)

      if (dbError) throw dbError

      // Guardar en localStorage SOLO si la BD confirmó el update
      localStorage.setItem('obrix_home_path', selected)
      setCurrent(selected)
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 900)
    } catch (e) {
      console.error('Error guardando preferencia:', e)
      if (e?.code === '42703') {
        setError('La columna home_path no existe aún. Ejecuta la migración migration_user_preferences.sql en Supabase.')
      } else {
        setError('Error al guardar: ' + (e?.message || 'Error desconocido'))
      }
    } finally {
      setSaving(false)
    }
  }

  const opcionActual = OPCIONES
    .flatMap(c => c.items)
    .find(o => o.path === selected)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 540,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FAFAFA', borderRadius: '18px 18px 0 0', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111827' }}>
              🏠 Pantalla inicial
            </h3>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
              Al entrar a OBRIX irás directamente a esta pantalla
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '1px solid #E5E7EB', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={14} color="#6B7280" />
          </button>
        </div>

        {/* Vista previa de la selección */}
        {opcionActual && (
          <div style={{
            padding: '10px 18px',
            background: '#EFF6FF', borderBottom: '1px solid #DBEAFE',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: '#DBEAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <opcionActual.icon size={16} color="#2563EB" />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', margin: 0 }}>
                {opcionActual.label}
              </p>
              <p style={{ fontSize: 10, color: '#93C5FD', margin: 0 }}>
                {opcionActual.desc}
              </p>
            </div>
            {selected !== current && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                background: '#DBEAFE', color: '#1E40AF',
                padding: '2px 8px', borderRadius: 20,
              }}>
                Sin guardar
              </span>
            )}
          </div>
        )}

        {/* Lista de opciones */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {OPCIONES.map(cat => (
            <div key={cat.categoria} style={{ marginBottom: 14 }}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                margin: '0 0 6px 4px',
              }}>
                {cat.categoria}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {cat.items.map(opcion => {
                  const isSelected = selected === opcion.path
                  const isCurrent  = current  === opcion.path
                  return (
                    <button
                      key={opcion.path}
                      onClick={() => setSelected(opcion.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 11, border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        background: isSelected ? '#EFF6FF' : '#F9FAFB',
                        outline: isSelected ? '2px solid #BFDBFE' : '2px solid transparent',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB' }}
                    >
                      {/* Icono */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: isSelected ? '#DBEAFE' : '#E5E7EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}>
                        <opcion.icon size={14} color={isSelected ? '#2563EB' : '#6B7280'} />
                      </div>

                      {/* Texto */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 13, fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#1E40AF' : '#374151',
                          }}>
                            {opcion.label}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              background: '#D1FAE5', color: '#065F46',
                              padding: '1px 6px', borderRadius: 20,
                            }}>
                              Actual
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                          {opcion.desc}
                        </p>
                      </div>

                      {/* Check */}
                      {isSelected && (
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#2563EB', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={11} color="#fff" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #F3F4F6',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: '#FAFAFA', borderRadius: '0 0 18px 18px', flexShrink: 0,
        }}>
          {/* Error */}
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 9,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 11, color: '#DC2626', lineHeight: 1.5,
            }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 9,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving || saved}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 20px', borderRadius: 9, border: 'none',
                background: saved ? '#10B981' : saving ? '#93C5FD' : '#2563EB',
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: saving || saved ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {saved
                ? <><Check size={13} /> ¡Guardado!</>
                : saving
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                : <><Check size={13} /> Guardar preferencia</>
              }
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}