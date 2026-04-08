// ============================================================
//  OBRIX ERP — Configurador de Calendarios Laborales
//  src/pages/obra/CalendariosPage.jsx  |  v1.0
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { MainLayout }        from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast }          from '../../hooks/useToast'
import {
  Calendar, Plus, Edit2, Trash2, CheckCircle,
  Clock, Star, RefreshCw, X, AlertTriangle,
} from 'lucide-react'
import {
  getCalendarios, crearCalendario, actualizarCalendario,
  eliminarCalendario, agregarExcepcion, eliminarExcepcion,
  DIAS_SEMANA,
} from '../../services/programaObra.service'

// ─────────────────────────────────────────────────────────────
// Estilos reutilizables
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', backgroundColor: '#fff',
  color: '#111827', boxSizing: 'border-box',
}
const sel = { ...inp }

const BtnPrimary = ({ onClick, icon: Icon, label, disabled, small }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: small ? '6px 12px' : '8px 16px',
      borderRadius: 8, border: 'none',
      backgroundColor: disabled ? '#E5E7EB' : '#2563EB',
      color: disabled ? '#9CA3AF' : '#fff',
      fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
    {Icon && <Icon size={small ? 12 : 14} />} {label}
  </button>
)

const BtnSecondary = ({ onClick, icon: Icon, label, danger, small }) => (
  <button onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: small ? '5px 10px' : '7px 14px',
      borderRadius: 8,
      border: `1px solid ${danger ? '#FECACA' : '#E5E7EB'}`,
      backgroundColor: danger ? '#FEF2F2' : '#F9FAFB',
      color: danger ? '#DC2626' : '#374151',
      fontSize: small ? 11 : 12, fontWeight: 500, cursor: 'pointer',
    }}>
    {Icon && <Icon size={small ? 11 : 13} />} {label}
  </button>
)

// ─────────────────────────────────────────────────────────────
// FORMULARIO DE CALENDARIO
// ─────────────────────────────────────────────────────────────
const FormCalendario = ({ inicial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    nombre:      inicial?.nombre      || '',
    descripcion: inicial?.descripcion || '',
    es_general:  inicial?.es_general  ?? false,
    hora_inicio: inicial?.hora_inicio || '08:00',
    hora_fin:    inicial?.hora_fin    || '17:00',
    dias: DIAS_SEMANA.map(d => {
      const existente = inicial?.work_calendar_days?.find(wd => wd.dow === d.dow)
      return {
        dow:         d.dow,
        label:       d.label,
        short:       d.short,
        es_habil:    existente ? existente.es_habil : d.dow !== 0,
        hora_inicio: existente?.hora_inicio || null,
        hora_fin:    existente?.hora_fin    || null,
      }
    }),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleDia = (dow) => {
    setForm(f => ({
      ...f,
      dias: f.dias.map(d => d.dow === dow ? { ...d, es_habil: !d.es_habil } : d),
    }))
  }

  const horasDia = form.hora_inicio && form.hora_fin
    ? ((new Date('2000-01-01T' + form.hora_fin) - new Date('2000-01-01T' + form.hora_inicio)) / 3600000).toFixed(1)
    : '—'

  return (
    <div style={{ padding: '14px', backgroundColor: '#F8FAFC',
      border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 12 }}>

      <p style={{ fontSize: 12, fontWeight: 700, color: '#374151',
        textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
        {inicial ? 'Editar calendario' : 'Nuevo calendario'}
      </p>

      {/* Nombre + General */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
            Nombre *
          </label>
          <input type="text" style={inp} value={form.nombre}
            placeholder="Ej: Horario extendido, Turno nocturno"
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

      {/* Horario */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
            Hora entrada
          </label>
          <input type="time" style={inp} value={form.hora_inicio}
            onChange={e => set('hora_inicio', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
            Hora salida
          </label>
          <input type="time" style={inp} value={form.hora_fin}
            onChange={e => set('hora_fin', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', paddingBottom: 1 }}>
          <div style={{ padding: '8px 10px', backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 1px' }}>Horas/día</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E40AF', margin: 0 }}>
              {horasDia}h
            </p>
          </div>
        </div>
      </div>

      {/* Días hábiles */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px', fontWeight: 600 }}>
          Días hábiles
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {form.dias.map(d => (
            <button key={d.dow} type="button"
              onClick={() => toggleDia(d.dow)}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
                borderColor:     d.es_habil ? '#2563EB' : '#E5E7EB',
                backgroundColor: d.es_habil ? '#EFF6FF' : '#F9FAFB',
                color:           d.es_habil ? '#1E40AF' : '#9CA3AF',
              }}>
              {d.short}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '5px 0 0' }}>
          {form.dias.filter(d => d.es_habil).length} días hábiles por semana
        </p>
      </div>

      {/* Descripción */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
          Descripción (opcional)
        </label>
        <textarea rows={2} style={{ ...inp, resize: 'none' }}
          placeholder="Notas sobre este calendario..."
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <BtnSecondary onClick={onCancel} icon={X} label="Cancelar" small />
        <BtnPrimary
          onClick={() => onSave(form)}
          icon={CheckCircle}
          label={saving ? 'Guardando…' : 'Guardar calendario'}
          disabled={saving || !form.nombre.trim()}
          small
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TARJETA DE CALENDARIO
// ─────────────────────────────────────────────────────────────
const CalendarioCard = ({ cal, activo, onClick, onEdit, onDelete, onAddExcepcion }) => {
  const diasHabiles = cal.work_calendar_days?.filter(d => d.es_habil) ?? []
  const excepciones = cal.work_calendar_exceptions ?? []

  return (
    <div onClick={onClick}
      style={{
        padding: '14px 16px', cursor: 'pointer',
        backgroundColor: activo ? '#EFF6FF' : '#fff',
        borderBottom: '1px solid #F3F4F6',
        borderLeft: `3px solid ${activo ? '#2563EB' : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!activo) e.currentTarget.style.backgroundColor = '#F9FAFB' }}
      onMouseLeave={e => { if (!activo) e.currentTarget.style.backgroundColor = '#fff' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            {cal.nombre}
          </span>
          {cal.es_general && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 600, padding: '1px 7px',
              borderRadius: 9999, backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
              <Star size={10} /> General
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(cal)}
            style={{ padding: 5, borderRadius: 6, border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer', color: '#6B7280' }}>
            <Edit2 size={13} />
          </button>
          {!cal.es_general && (
            <button onClick={() => onDelete(cal.id)}
              style={{ padding: 5, borderRadius: 6, border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', color: '#EF4444' }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        {DIAS_SEMANA.map(d => {
          const habil = diasHabiles.some(dh => dh.dow === d.dow)
          return (
            <span key={d.dow} style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5,
              backgroundColor: habil ? '#DBEAFE' : '#F3F4F6',
              color: habil ? '#1E40AF' : '#D1D5DB',
            }}>{d.short}</span>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#6B7280',
          display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
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
// PANEL DETALLE — Excepciones
// ─────────────────────────────────────────────────────────────
const PanelExcepciones = ({ cal, onAgregar, onEliminar, toast }) => {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha: '', tipo: 'festivo', descripcion: '', es_habil: false })
  const [saving, setSaving] = useState(false)

  const handleAgregar = async () => {
    if (!form.fecha) { toast.error('La fecha es obligatoria'); return }
    setSaving(true)
    try {
      await onAgregar(cal.id, { ...form, es_habil: form.tipo === 'dia_extra' })
      toast.success('Excepción guardada')
      setShowForm(false)
      setForm({ fecha: '', tipo: 'festivo', descripcion: '', es_habil: false })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const excs = cal.work_calendar_exceptions ?? []

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Excepciones — {cal.nombre}
        </p>
        <BtnSecondary onClick={() => setShowForm(!showForm)} icon={Plus}
          label="Agregar" small />
      </div>

      {showForm && (
        <div style={{ padding: 12, backgroundColor: '#F9FAFB',
          border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                Fecha *
              </label>
              <input type="date" style={inp} value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                Tipo
              </label>
              <select style={sel} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="festivo">Festivo (día inhábil)</option>
                <option value="dia_extra">Día extra (hábil)</option>
                <option value="horario_especial">Horario especial</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>
              Descripción
            </label>
            <input type="text" style={inp} value={form.descripcion}
              placeholder="Ej: Año Nuevo, Día de la Constitución..."
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <BtnSecondary onClick={() => setShowForm(false)} icon={X} label="Cancelar" small />
            <BtnPrimary onClick={handleAgregar} icon={CheckCircle}
              label={saving ? 'Guardando…' : 'Guardar'} disabled={saving} small />
          </div>
        </div>
      )}

      {excs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
          <Calendar size={24} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
          <p style={{ fontSize: 12 }}>Sin excepciones registradas</p>
          <p style={{ fontSize: 11, color: '#D1D5DB', marginTop: 4 }}>
            Agrega festivos o días de trabajo extra
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {excs.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(exc => (
            <div key={exc.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', backgroundColor: exc.es_habil ? '#F0FDF4' : '#FEF9C3',
              border: `1px solid ${exc.es_habil ? '#A7F3D0' : '#FDE68A'}`,
              borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                color: '#374151', minWidth: 80 }}>
                {new Date(exc.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'short'
                })}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>
                {exc.descripcion || exc.tipo}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px',
                borderRadius: 9999,
                backgroundColor: exc.es_habil ? '#D1FAE5' : '#FEF3C7',
                color: exc.es_habil ? '#065F46' : '#B45309' }}>
                {exc.es_habil ? 'Hábil' : 'Inhábil'}
              </span>
              <button onClick={() => onEliminar(exc.id)}
                style={{ padding: 4, border: 'none', background: 'none',
                  cursor: 'pointer', color: '#EF4444' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function CalendariosPage() {
  const { toast }                           = useToast()
  const [calendarios, setCalendarios]       = useState([])
  const [loading,     setLoading]           = useState(true)
  const [seleccionado, setSeleccionado]     = useState(null)
  const [showForm,    setShowForm]          = useState(false)
  const [editando,    setEditando]          = useState(null)
  const [saving,      setSaving]            = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCalendarios()
      setCalendarios(data)
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

  const calSeleccionado = calendarios.find(c => c.id === seleccionado)

  return (
    <RequirePermission module="projects" action="view">
      <MainLayout title="📅 Calendarios Laborales">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Calendarios activos', value: calendarios.length, color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Calendar general',
                value: calendarios.find(c => c.es_general)?.nombre ?? 'No configurado',
                color: '#065F46', bg: '#F0FDF4', small: true },
              { label: 'Total excepciones',
                value: calendarios.reduce((s, c) => s + (c.work_calendar_exceptions?.length ?? 0), 0),
                color: '#B45309', bg: '#FFF7ED' },
            ].map(k => (
              <div key={k.label} style={{ padding: '12px 16px',
                backgroundColor: k.bg, borderRadius: 12,
                border: `1px solid ${k.color}22` }}>
                <p style={{ fontSize: 11, color: k.color, fontWeight: 600,
                  margin: '0 0 3px', opacity: 0.8 }}>{k.label}</p>
                <p style={{ fontSize: k.small ? 14 : 22, fontWeight: 800,
                  color: k.color, margin: 0 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Área principal */}
          <div style={{ display: 'flex', gap: 0,
            border: '1px solid #E5E7EB', borderRadius: 14,
            overflow: 'hidden', backgroundColor: '#fff', minHeight: 400 }}>

            {/* ── Lista izquierda ── */}
            <div style={{ width: 300, borderRight: '1px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

              <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6',
                flexShrink: 0 }}>
                <BtnPrimary onClick={() => { setEditando(null); setShowForm(true) }}
                  icon={Plus} label="Nuevo calendario" />
              </div>

              {showForm && !editando && (
                <div style={{ padding: 12, borderBottom: '1px solid #F3F4F6' }}>
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
                ) : calendarios.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF' }}>
                    <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: 13 }}>Sin calendarios configurados</p>
                    <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4 }}>
                      Crea un calendario general para tu empresa
                    </p>
                  </div>
                ) : (
                  calendarios.map(cal => {
                    if (editando?.id === cal.id && showForm) {
                      return (
                        <div key={cal.id} style={{ padding: 12,
                          borderBottom: '1px solid #F3F4F6' }}>
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
                        onEdit={(c) => { setEditando(c); setShowForm(true) }}
                        onDelete={handleEliminar}
                      />
                    )
                  })
                )}
              </div>

              <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6',
                flexShrink: 0 }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
                  El calendario <strong>General</strong> aplica a todos los proyectos
                  que no tienen uno específico.
                </p>
              </div>
            </div>

            {/* ── Panel derecho ── */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {calSeleccionado ? (
                <PanelExcepciones
                  cal={calSeleccionado}
                  onAgregar={handleAgregarExcepcion}
                  onEliminar={handleEliminarExcepcion}
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
                    Aquí puedes agregar festivos, días de trabajo extra y horarios especiales.
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
