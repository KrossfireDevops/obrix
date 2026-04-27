// ============================================================
//  OBRIX ERP — Configurador de Calendarios Laborales
//  src/pages/obra/CalendariosPage.jsx  |  v2.0
//
//  Mejoras v2.0:
//    - Asistente de configuración inicial del calendario general
//    - Horario diferenciado por día (Lun-Vie / Sáb / Dom)
//    - Domingo bloqueado como inhábil automáticamente
//    - Precarga de festivos LFT (Art. 74 + tradicionales construcción)
//    - Clonar calendario general como base para uno personalizado
//    - Panel para asignar/cambiar calendario a proyecto
//    - Excepciones con horario especial por día
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import { supabase }          from '../../config/supabase'
import {
  Calendar, Plus, Edit2, Trash2, CheckCircle,
  Clock, Star, RefreshCw, X, AlertTriangle,
  Copy, Sparkles, Building2, FolderOpen, ChevronDown,
  ChevronUp, Info,
} from 'lucide-react'
import {
  getCalendarios, crearCalendario, actualizarCalendario,
  eliminarCalendario, agregarExcepcion, eliminarExcepcion,
  clonarCalendario, precargarFestivosLFT,
  asignarCalendarioProyecto, getCalendarioProyecto,
  DIAS_SEMANA,
} from '../../services/programaObra.service'

// ─────────────────────────────────────────────────────────────
// Festivos LFT para mostrar en la UI (lunes móviles calculados)
// ─────────────────────────────────────────────────────────────
const getLunesDelMes = (año, mes, nthLunes) => {
  // mes: 1-12, nthLunes: 1-5
  const d = new Date(año, mes - 1, 1)
  let count = 0
  while (d.getMonth() === mes - 1) {
    if (d.getDay() === 1) { count++; if (count === nthLunes) return d }
    d.setDate(d.getDate() + 1)
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Estilos base
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}
const sel = { ...inp }

const Btn = ({ onClick, icon: Icon, label, disabled, variant = 'primary', small }) => {
  const styles = {
    primary:   { bg: disabled ? '#E5E7EB' : '#2563EB', color: disabled ? '#9CA3AF' : '#fff', border: 'none' },
    secondary: { bg: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' },
    danger:    { bg: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
    success:   { bg: '#F0FDF4', color: '#065F46', border: '1px solid #A7F3D0' },
    ghost:     { bg: 'transparent', color: '#6B7280', border: 'none' },
  }
  const s = styles[variant]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: small ? '5px 10px' : '8px 14px',
      borderRadius: 8, border: s.border,
      backgroundColor: s.bg, color: s.color,
      fontSize: small ? 11 : 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap',
    }}>
      {Icon && <Icon size={small ? 11 : 14} />} {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// ASISTENTE INICIAL — wizard para crear el calendario general
// ─────────────────────────────────────────────────────────────
const AsistenteInicial = ({ onCrear, saving }) => {
  const año = new Date().getFullYear()
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState({
    nombre:         'Calendario General de la Empresa',
    hora_inicio:    '08:00',
    hora_fin:       '17:00',
    sabado_habil:   true,
    sabado_inicio:  '08:00',
    sabado_fin:     '13:00',
    cargar_lft:     true,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const horasLV = form.hora_inicio && form.hora_fin
    ? ((new Date(`2000-01-01T${form.hora_fin}`) - new Date(`2000-01-01T${form.hora_inicio}`)) / 3600000).toFixed(1)
    : '—'

  const horasSab = form.sabado_habil && form.sabado_inicio && form.sabado_fin
    ? ((new Date(`2000-01-01T${form.sabado_fin}`) - new Date(`2000-01-01T${form.sabado_inicio}`)) / 3600000).toFixed(1)
    : 0

  const handleCrear = () => {
    const dias = [
      // Lunes a Viernes
      ...[1,2,3,4,5].map(dow => ({
        dow, es_habil: true,
        hora_inicio: form.hora_inicio,
        hora_fin:    form.hora_fin,
      })),
      // Sábado
      {
        dow: 6, es_habil: form.sabado_habil,
        hora_inicio: form.sabado_habil ? form.sabado_inicio : null,
        hora_fin:    form.sabado_habil ? form.sabado_fin    : null,
      },
      // Domingo — siempre inhábil
      { dow: 0, es_habil: false, hora_inicio: null, hora_fin: null },
    ]
    onCrear({ ...form, es_general: true, dias, cargar_lft: form.cargar_lft })
  }

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Sparkles size={24} color="#2563EB" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
          Configura tu Calendario General
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
          Este calendario aplica a toda la empresa. Podrás crear calendarios personalizados por proyecto después.
        </p>
      </div>

      {/* Paso 1 — Horario L-V */}
      <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
          1. Horario Lunes — Viernes
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Entrada</label>
            <input type="time" style={inp} value={form.hora_inicio}
              onChange={e => set('hora_inicio', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Salida</label>
            <input type="time" style={inp} value={form.hora_fin}
              onChange={e => set('hora_fin', e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 1 }}>
            <div style={{ padding: '8px 10px', backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 8, textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 1px' }}>Horas/día</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1E40AF', margin: 0 }}>{horasLV}h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Paso 2 — Sábado */}
      <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            2. Sábado
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7,
            cursor: 'pointer', fontSize: 12, color: '#374151' }}>
            <input type="checkbox" checked={form.sabado_habil}
              onChange={e => set('sabado_habil', e.target.checked)}
              style={{ accentColor: '#2563EB', width: 14, height: 14 }} />
            Día hábil
          </label>
        </div>
        {form.sabado_habil ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Entrada</label>
              <input type="time" style={inp} value={form.sabado_inicio}
                onChange={e => set('sabado_inicio', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Salida</label>
              <input type="time" style={inp} value={form.sabado_fin}
                onChange={e => set('sabado_fin', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 1 }}>
              <div style={{ padding: '8px 10px', backgroundColor: '#F0FDF4',
                border: '1px solid #A7F3D0', borderRadius: 8, textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 1px' }}>Horas</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#065F46', margin: 0 }}>{horasSab}h</p>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: '#991B1B', margin: 0 }}>
              Sábado marcado como inhábil — no se contará en el cálculo del programa de obra.
            </p>
          </div>
        )}
      </div>

      {/* Paso 3 — Domingo */}
      <div style={{ marginBottom: 20, padding: '12px 16px', backgroundColor: '#FEF9C3',
        border: '1px solid #FDE68A', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Info size={16} color="#B45309" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
          <strong>Domingo</strong> se configura automáticamente como día inhábil según la Ley Federal del Trabajo.
        </p>
      </div>

      {/* Paso 4 — Festivos LFT */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
          3. Días Festivos Oficiales — Art. 74 LFT
        </p>
        <div style={{ marginBottom: 10 }}>
          {[
            `1 Ene — Año Nuevo`,
            `1er Lunes Feb — Día de la Constitución`,
            `3er Lunes Mar — Natalicio Benito Juárez`,
            `1 May — Día del Trabajo`,
            `16 Sep — Día de la Independencia`,
            `3er Lunes Nov — Revolución Mexicana`,
            `25 Dic — Navidad`,
            `+ Viernes Santo, Día de Muertos, 12 Dic (tradicionales construcción)`,
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, color: '#374151', marginBottom: 4 }}>
              <span style={{ color: '#10B981', fontSize: 10 }}>✓</span> {f}
            </div>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', fontSize: 12, color: '#374151',
          padding: '8px 10px', backgroundColor: form.cargar_lft ? '#EFF6FF' : '#fff',
          border: `1px solid ${form.cargar_lft ? '#BFDBFE' : '#E5E7EB'}`,
          borderRadius: 8 }}>
          <input type="checkbox" checked={form.cargar_lft}
            onChange={e => set('cargar_lft', e.target.checked)}
            style={{ accentColor: '#2563EB', width: 14, height: 14 }} />
          <span>Precargar festivos del <strong>{año}</strong> automáticamente</span>
        </label>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
          Podrás agregar, eliminar o personalizar cualquier día después.
        </p>
      </div>

      <Btn
        onClick={handleCrear}
        icon={CheckCircle}
        label={saving ? 'Creando calendario…' : 'Crear Calendario General'}
        disabled={saving}
        variant="primary"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FORMULARIO DE CALENDARIO (edición/creación avanzada)
// ─────────────────────────────────────────────────────────────
const FormCalendario = ({ inicial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(() => {
    const diasBase = DIAS_SEMANA.map(d => {
      const existente = inicial?.work_calendar_days?.find(wd => wd.dow === d.dow)
      return {
        dow:         d.dow,
        label:       d.label,
        short:       d.short,
        es_habil:    d.dow === 0 ? false : (existente ? existente.es_habil : d.dow !== 0),
        hora_inicio: existente?.hora_inicio?.slice(0,5) || (d.dow === 0 ? null : '08:00'),
        hora_fin:    existente?.hora_fin?.slice(0,5)    || (d.dow === 0 ? null : '17:00'),
      }
    })
    return {
      nombre:      inicial?.nombre      || '',
      descripcion: inicial?.descripcion || '',
      es_general:  inicial?.es_general  ?? false,
      hora_inicio: inicial?.hora_inicio?.slice(0,5) || '08:00',
      hora_fin:    inicial?.hora_fin?.slice(0,5)    || '17:00',
      dias:        diasBase,
    }
  })

  const [mostrarDias, setMostrarDias] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleDia = (dow) => {
    if (dow === 0) return // Domingo siempre inhábil
    setForm(f => ({
      ...f,
      dias: f.dias.map(d => d.dow === dow ? { ...d, es_habil: !d.es_habil } : d),
    }))
  }

  const setHoraDia = (dow, campo, valor) => {
    setForm(f => ({
      ...f,
      dias: f.dias.map(d => d.dow === dow ? { ...d, [campo]: valor } : d),
    }))
  }

  const aplicarHorarioGeneral = () => {
    setForm(f => ({
      ...f,
      dias: f.dias.map(d => d.es_habil ? {
        ...d,
        hora_inicio: f.hora_inicio,
        hora_fin:    f.hora_fin,
      } : d),
    }))
  }

  return (
    <div style={{ padding: 14, backgroundColor: '#F8FAFC',
      border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 12 }}>

      <p style={{ fontSize: 12, fontWeight: 700, color: '#374151',
        textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
        {inicial ? 'Editar calendario' : 'Nuevo calendario'}
      </p>

      {/* Nombre + General */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Nombre *</label>
          <input type="text" style={inp} value={form.nombre}
            placeholder="Ej: Horario extendido, Turno matutino"
            onChange={e => set('nombre', e.target.value)} />
        </div>
        <div style={{ paddingTop: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7,
            cursor: 'pointer', fontSize: 12, color: '#374151',
            padding: '8px 10px', border: '1px solid #E5E7EB',
            borderRadius: 8, backgroundColor: form.es_general ? '#EFF6FF' : '#fff',
            whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={form.es_general}
              onChange={e => set('es_general', e.target.checked)}
              style={{ accentColor: '#2563EB' }} />
            <Star size={13} color={form.es_general ? '#2563EB' : '#9CA3AF'} />
            General
          </label>
        </div>
      </div>

      {/* Horario general */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Hora entrada general</label>
          <input type="time" style={inp} value={form.hora_inicio}
            onChange={e => set('hora_inicio', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Hora salida general</label>
          <input type="time" style={inp} value={form.hora_fin}
            onChange={e => set('hora_fin', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 1 }}>
          <button onClick={aplicarHorarioGeneral}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #BFDBFE',
              backgroundColor: '#EFF6FF', color: '#1E40AF', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Aplicar a todos
          </button>
        </div>
      </div>

      {/* Días hábiles básico */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px', fontWeight: 600 }}>Días hábiles</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {form.dias.map(d => (
            <button key={d.dow} type="button"
              onClick={() => toggleDia(d.dow)}
              disabled={d.dow === 0}
              title={d.dow === 0 ? 'Domingo siempre inhábil (LFT)' : ''}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: d.dow === 0 ? 'not-allowed' : 'pointer', border: '1.5px solid',
                borderColor:     d.es_habil ? '#2563EB' : (d.dow === 0 ? '#F3F4F6' : '#E5E7EB'),
                backgroundColor: d.es_habil ? '#EFF6FF' : (d.dow === 0 ? '#F3F4F6' : '#F9FAFB'),
                color:           d.es_habil ? '#1E40AF' : (d.dow === 0 ? '#D1D5DB' : '#9CA3AF'),
                opacity:         d.dow === 0 ? 0.6 : 1,
              }}>
              {d.short}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '5px 0 0' }}>
          {form.dias.filter(d => d.es_habil).length} días hábiles · Domingo siempre inhábil (Art. 74 LFT)
        </p>
      </div>

      {/* Horarios por día — desplegable */}
      <button onClick={() => setMostrarDias(!mostrarDias)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          color: '#2563EB', background: 'none', border: 'none',
          cursor: 'pointer', fontWeight: 600, marginBottom: mostrarDias ? 10 : 12 }}>
        {mostrarDias ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {mostrarDias ? 'Ocultar' : 'Configurar'} horario por día
      </button>

      {mostrarDias && (
        <div style={{ marginBottom: 12, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          {form.dias.filter(d => d.es_habil).map((d, i) => (
            <div key={d.dow} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 1fr',
              gap: 8, padding: '8px 12px', alignItems: 'center',
              backgroundColor: i % 2 === 0 ? '#fff' : '#F9FAFB',
              borderBottom: i < form.dias.filter(x => x.es_habil).length - 1 ? '1px solid #F3F4F6' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{d.label}</span>
              <input type="time" style={{ ...inp, padding: '6px 8px', fontSize: 12 }}
                value={d.hora_inicio || ''}
                onChange={e => setHoraDia(d.dow, 'hora_inicio', e.target.value)} />
              <input type="time" style={{ ...inp, padding: '6px 8px', fontSize: 12 }}
                value={d.hora_fin || ''}
                onChange={e => setHoraDia(d.dow, 'hora_fin', e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {/* Descripción */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Descripción (opcional)</label>
        <textarea rows={2} style={{ ...inp, resize: 'none' }}
          placeholder="Notas sobre este calendario..."
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onCancel} icon={X} label="Cancelar" variant="secondary" small />
        <Btn onClick={() => onSave(form)} icon={CheckCircle}
          label={saving ? 'Guardando…' : 'Guardar calendario'}
          disabled={saving || !form.nombre.trim()} small />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TARJETA DE CALENDARIO
// ─────────────────────────────────────────────────────────────
const CalendarioCard = ({ cal, activo, onClick, onEdit, onDelete, onClonar }) => {
  const diasHabiles = cal.work_calendar_days?.filter(d => d.es_habil) ?? []
  const excepciones = cal.work_calendar_exceptions ?? []

  return (
    <div onClick={onClick}
      style={{
        padding: '12px 14px', cursor: 'pointer',
        backgroundColor: activo ? '#EFF6FF' : '#fff',
        borderBottom: '1px solid #F3F4F6',
        borderLeft: `3px solid ${activo ? '#2563EB' : 'transparent'}`,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={e => { if (!activo) e.currentTarget.style.backgroundColor = '#F9FAFB' }}
      onMouseLeave={e => { if (!activo) e.currentTarget.style.backgroundColor = '#fff' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', truncate: true }}>
            {cal.nombre}
          </span>
          {cal.es_general && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 600, padding: '1px 7px',
              borderRadius: 9999, backgroundColor: '#EFF6FF', color: '#1E40AF',
              flexShrink: 0 }}>
              <Star size={10} /> General
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(cal)}
            style={{ padding: 5, borderRadius: 6, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', color: '#6B7280' }}
            title="Editar">
            <Edit2 size={12} />
          </button>
          <button onClick={() => onClonar(cal)}
            style={{ padding: 5, borderRadius: 6, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', color: '#6B7280' }}
            title="Clonar como personalizado">
            <Copy size={12} />
          </button>
          {!cal.es_general && (
            <button onClick={() => onDelete(cal.id)}
              style={{ padding: 5, borderRadius: 6, border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', color: '#EF4444' }}
              title="Eliminar">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {DIAS_SEMANA.map(d => {
          const diaData = cal.work_calendar_days?.find(wd => wd.dow === d.dow)
          const habil   = diaData?.es_habil ?? false
          return (
            <span key={d.dow} style={{
              fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 5,
              backgroundColor: habil ? '#DBEAFE' : '#F3F4F6',
              color: habil ? '#1E40AF' : '#D1D5DB',
            }}>
              {d.short}
            </span>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} />
          {cal.hora_inicio?.slice(0,5)} – {cal.hora_fin?.slice(0,5)}
          · {diasHabiles.length} días/sem
        </span>
        {excepciones.length > 0 && (
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
            {excepciones.length} excepción{excepciones.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL DETALLE — Excepciones + Asignación a proyectos
// ─────────────────────────────────────────────────────────────
const PanelDetalle = ({ cal, onAgregar, onEliminar, onPrecargarLFT, toast }) => {
  const [tab,       setTab]       = useState('excepciones') // 'excepciones' | 'proyectos'
  const [showForm,  setShowForm]  = useState(false)
  const [proyectos, setProyectos] = useState([])
  const [loadingP,  setLoadingP]  = useState(false)
  const [form, setForm] = useState({
    fecha: '', tipo: 'festivo', descripcion: '',
    es_habil: false, hora_inicio: '', hora_fin: '',
  })
  const [saving, setSaving] = useState(false)
  const [cargandoLFT, setCargandoLFT] = useState(false)

  // Cargar proyectos que usan este calendario
  useEffect(() => {
    if (tab !== 'proyectos') return
    setLoadingP(true)
    supabase
      .from('project_calendars')
      .select('project_id, projects(id, name, code, status)')
      .eq('calendar_id', cal.id)
      .then(({ data }) => setProyectos(data ?? []))
      .finally(() => setLoadingP(false))
  }, [tab, cal.id])

  const handleAgregar = async () => {
    if (!form.fecha) { toast.error('La fecha es obligatoria'); return }
    setSaving(true)
    try {
      await onAgregar(cal.id, {
        ...form,
        es_habil:   form.tipo === 'dia_extra',
        hora_inicio: form.hora_inicio || null,
        hora_fin:    form.hora_fin    || null,
      })
      toast.success('Excepción guardada')
      setShowForm(false)
      setForm({ fecha: '', tipo: 'festivo', descripcion: '', es_habil: false, hora_inicio: '', hora_fin: '' })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePrecargarLFT = async () => {
    setCargandoLFT(true)
    try {
      const n = await onPrecargarLFT(cal.id)
      toast.success(`✅ ${n} festivos LFT cargados`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCargandoLFT(false)
    }
  }

  const excs = [...(cal.work_calendar_exceptions ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        {[
          { id: 'excepciones', label: `Excepciones (${excs.length})` },
          { id: 'proyectos',   label: 'Proyectos asignados' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? '#2563EB' : '#6B7280',
              borderBottom: `2px solid ${tab === t.id ? '#2563EB' : 'transparent'}`,
              background: 'none', border: 'none',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Excepciones */}
      {tab === 'excepciones' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Btn onClick={() => setShowForm(!showForm)} icon={Plus}
              label="Agregar excepción" variant="secondary" small />
            <Btn onClick={handlePrecargarLFT} icon={Sparkles}
              label={cargandoLFT ? 'Cargando…' : 'Precargar festivos LFT'}
              disabled={cargandoLFT} variant="success" small />
          </div>

          {showForm && (
            <div style={{ padding: 12, backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Fecha *</label>
                  <input type="date" style={inp} value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Tipo</label>
                  <select style={sel} value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="festivo">Festivo (día inhábil)</option>
                    <option value="dia_extra">Día extra hábil</option>
                    <option value="horario_especial">Horario especial</option>
                  </select>
                </div>
              </div>

              {form.tipo === 'horario_especial' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Hora inicio</label>
                    <input type="time" style={inp} value={form.hora_inicio}
                      onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Hora fin</label>
                    <input type="time" style={inp} value={form.hora_fin}
                      onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Descripción</label>
                <input type="text" style={inp} value={form.descripcion}
                  placeholder="Ej: Año Nuevo, Día de la Constitución…"
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => setShowForm(false)} icon={X} label="Cancelar" variant="secondary" small />
                <Btn onClick={handleAgregar} icon={CheckCircle}
                  label={saving ? 'Guardando…' : 'Guardar'} disabled={saving} small />
              </div>
            </div>
          )}

          {excs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
              <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 13, margin: '0 0 4px' }}>Sin excepciones registradas</p>
              <p style={{ fontSize: 11, color: '#D1D5DB', margin: 0 }}>
                Usa "Precargar festivos LFT" para agregar los días oficiales
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {excs.map(exc => (
                <div key={exc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px',
                  backgroundColor: exc.tipo === 'dia_extra' ? '#F0FDF4'
                    : exc.tipo === 'horario_especial' ? '#EFF6FF' : '#FEF9C3',
                  border: `1px solid ${exc.tipo === 'dia_extra' ? '#A7F3D0'
                    : exc.tipo === 'horario_especial' ? '#BFDBFE' : '#FDE68A'}`,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                    color: '#374151', minWidth: 70 }}>
                    {new Date(exc.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short',
                    })}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>
                    {exc.descripcion || exc.tipo}
                  </span>
                  {exc.hora_inicio && (
                    <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>
                      {exc.hora_inicio?.slice(0,5)}–{exc.hora_fin?.slice(0,5)}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px',
                    borderRadius: 9999,
                    backgroundColor: exc.es_habil ? '#D1FAE5' : '#FEF3C7',
                    color: exc.es_habil ? '#065F46' : '#B45309',
                    flexShrink: 0 }}>
                    {exc.tipo === 'horario_especial' ? 'Especial'
                      : exc.es_habil ? 'Hábil' : 'Inhábil'}
                  </span>
                  <button onClick={() => onEliminar(exc.id)}
                    style={{ padding: 4, border: 'none', background: 'none',
                      cursor: 'pointer', color: '#EF4444', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Proyectos */}
      {tab === 'proyectos' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {loadingP ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24, color: '#9CA3AF' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : proyectos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
              <FolderOpen size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 13, margin: '0 0 4px' }}>Ningún proyecto usa este calendario</p>
              <p style={{ fontSize: 11, color: '#D1D5DB', margin: 0 }}>
                Asigna este calendario desde la pantalla del proyecto
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {proyectos.map(pc => (
                <div key={pc.project_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB', borderRadius: 8,
                }}>
                  <FolderOpen size={14} color="#6B7280" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                      {pc.projects?.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                      {pc.projects?.code} · {pc.projects?.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function CalendariosPage() {
  const { toast }                         = useToast()
  const [calendarios,  setCalendarios]    = useState([])
  const [loading,      setLoading]        = useState(true)
  const [seleccionado, setSeleccionado]   = useState(null)
  const [showForm,     setShowForm]       = useState(false)
  const [editando,     setEditando]       = useState(null)
  const [saving,       setSaving]         = useState(false)
  const [hayGeneral,   setHayGeneral]     = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCalendarios()
      setCalendarios(data)
      setHayGeneral(data.some(c => c.es_general))
      if (!seleccionado && data.length > 0) {
        setSeleccionado(data.find(c => c.es_general)?.id ?? data[0].id)
      }
    } catch (e) {
      toast.error('Error al cargar calendarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Crear desde asistente inicial ─────────────────────────
  const handleCrearDesdeAsistente = async (form) => {
    setSaving(true)
    try {
      const cal = await crearCalendario(form)
      // Precargar festivos LFT si el usuario lo pidió
      if (form.cargar_lft) {
        await precargarFestivosLFT(cal.id)
      }
      toast.success('✅ Calendario general configurado')
      cargar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Guardar desde formulario de edición ───────────────────
  const handleGuardar = async (form) => {
    setSaving(true)
    try {
      if (editando) {
        await actualizarCalendario(editando.id, form)
        toast.success('Calendario actualizado ✓')
      } else {
        await crearCalendario(form)
        toast.success('Calendario creado ✓')
      }
      setShowForm(false); setEditando(null)
      cargar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este calendario?')) return
    try {
      await eliminarCalendario(id)
      toast.success('Calendario eliminado')
      if (seleccionado === id) setSeleccionado(null)
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleClonar = async (cal) => {
    const nombre = prompt(`Nombre para el calendario personalizado:`, `${cal.nombre} — Personalizado`)
    if (!nombre?.trim()) return
    try {
      const nuevo = await clonarCalendario(cal.id, nombre.trim())
      toast.success('Calendario clonado ✓')
      cargar()
      setSeleccionado(nuevo.id)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleAgregarExcepcion = async (calId, datos) => {
    await agregarExcepcion(calId, datos)
    cargar()
  }

  const handleEliminarExcepcion = async (excId) => {
    try {
      await eliminarExcepcion(excId)
      toast.success('Excepción eliminada')
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handlePrecargarLFT = async (calId) => {
    const n = await precargarFestivosLFT(calId)
    cargar()
    return n
  }

  const calSeleccionado = calendarios.find(c => c.id === seleccionado)

  // ── Si no hay calendario general → mostrar asistente ──────
  if (!loading && !hayGeneral) {
    return (
      <RequirePermission module="projects" action="view">
        <MainLayout title="📅 Calendarios Laborales">
          <AsistenteInicial onCrear={handleCrearDesdeAsistente} saving={saving} />
        </MainLayout>
      </RequirePermission>
    )
  }

  return (
    <RequirePermission module="projects" action="view">
      <MainLayout title="📅 Calendarios Laborales">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Calendarios activos', value: calendarios.length,
                color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Calendario general',
                value: calendarios.find(c => c.es_general)?.nombre ?? 'No configurado',
                color: '#065F46', bg: '#F0FDF4', small: true },
              { label: 'Total excepciones',
                value: calendarios.reduce((s, c) => s + (c.work_calendar_exceptions?.length ?? 0), 0),
                color: '#B45309', bg: '#FFF7ED' },
            ].map(k => (
              <div key={k.label} style={{ padding: '12px 16px',
                backgroundColor: k.bg, borderRadius: 12, border: `1px solid ${k.color}22` }}>
                <p style={{ fontSize: 11, color: k.color, fontWeight: 600,
                  margin: '0 0 3px', opacity: 0.8 }}>{k.label}</p>
                <p style={{ fontSize: k.small ? 13 : 22, fontWeight: 800,
                  color: k.color, margin: 0 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Área principal */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid #E5E7EB',
            borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', minHeight: 440 }}>

            {/* ── Lista izquierda ── */}
            <div style={{ width: 290, borderRight: '1px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6',
                flexShrink: 0, display: 'flex', gap: 6 }}>
                <Btn onClick={() => { setEditando(null); setShowForm(true) }}
                  icon={Plus} label="Nuevo" variant="primary" small />
              </div>

              {showForm && !editando && (
                <div style={{ padding: 10, borderBottom: '1px solid #F3F4F6', overflowY: 'auto', maxHeight: 500 }}>
                  <FormCalendario
                    onSave={handleGuardar}
                    onCancel={() => { setShowForm(false); setEditando(null) }}
                    saving={saving}
                  />
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'center', height: 100, color: '#9CA3AF', gap: 8 }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 13 }}>Cargando…</span>
                  </div>
                ) : (
                  calendarios.map(cal => {
                    if (editando?.id === cal.id && showForm) {
                      return (
                        <div key={cal.id} style={{ padding: 10, borderBottom: '1px solid #F3F4F6' }}>
                          <FormCalendario
                            inicial={editando}
                            onSave={handleGuardar}
                            onCancel={() => { setShowForm(false); setEditando(null) }}
                            saving={saving}
                          />
                        </div>
                      )
                    }
                    return (
                      <CalendarioCard
                        key={cal.id}
                        cal={cal}
                        activo={seleccionado === cal.id}
                        onClick={() => setSeleccionado(cal.id)}
                        onEdit={c => { setEditando(c); setShowForm(true) }}
                        onDelete={handleEliminar}
                        onClonar={handleClonar}
                      />
                    )
                  })
                )}
              </div>

              <div style={{ padding: '8px 12px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
                  El calendario <strong>General</strong> aplica a todos los proyectos sin calendario específico.
                  Usa <strong>Clonar</strong> <Copy size={10} /> para crear uno personalizado.
                </p>
              </div>
            </div>

            {/* ── Panel derecho ── */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {calSeleccionado ? (
                <PanelDetalle
                  cal={calSeleccionado}
                  onAgregar={handleAgregarExcepcion}
                  onEliminar={handleEliminarExcepcion}
                  onPrecargarLFT={handlePrecargarLFT}
                  toast={toast}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#9CA3AF', gap: 10, padding: 32 }}>
                  <Calendar size={32} color="#D1D5DB" />
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
                    Selecciona un calendario
                  </p>
                  <p style={{ fontSize: 12, margin: 0, textAlign: 'center', maxWidth: 240 }}>
                    Aquí puedes ver festivos, excepciones y proyectos asignados.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </MainLayout>
    </RequirePermission>
  )
}