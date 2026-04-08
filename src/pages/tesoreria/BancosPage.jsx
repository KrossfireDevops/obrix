// ============================================================
//  OBRIX — Gestión de Cuentas Bancarias
//  src/pages/tesoreria/BancosPage.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'
import { supabase }   from '../../config/supabase'
import {
  Plus, Building2, Pencil, Trash2, CheckCircle2,
  AlertTriangle, X, Save, RefreshCw, GripVertical,
  DollarSign, CreditCard, Hash, ToggleLeft, ToggleRight,
  Landmark, ChevronDown,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
const fmt  = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtM = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`
  return `$${fmt(v)}`
}
const fmtFecha = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── Catálogo de bancos mexicanos ───────────────────────────
const BANCOS_MX = [
  'BBVA', 'Banamex (Citibanamex)', 'Santander', 'Banorte', 'HSBC',
  'Scotiabank', 'Inbursa', 'Afirme', 'BanBajío', 'Banca Mifel',
  'Multiva', 'Monexcb', 'Ve por Más', 'CIBanco', 'Intercam Banco',
  'Banco Azteca', 'Otro',
]

// ─── Constantes de estilo ───────────────────────────────────
// Colores hardcodeados compatibles con el sistema Tailwind de OBRIX
const C = {
  borde:  '#E5E7EB',   // gray-200
  bg:     '#FFFFFF',   // white
  bgSec:  '#F9FAFB',   // gray-50
}

const borde = { border: `1px solid #E5E7EB`, borderRadius: '12px' }

// ─── Catálogo de propósitos de cuenta ───────────────────────
const PROPOSITOS = [
  { value: 'general',    label: 'General',          icon: '🏦', desc: 'Uso múltiple sin restricción',               color: '#6B7280', bg: '#F9FAFB' },
  { value: 'operaciones',label: 'Operaciones',       icon: '⚙️', desc: 'Proveedores, materiales y subcontratos',     color: '#2563EB', bg: '#EFF6FF' },
  { value: 'nomina',     label: 'Nómina',            icon: '👷', desc: 'Exclusiva para dispersión de salarios',      color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'impuestos',  label: 'Fiscal / Impuestos',icon: '🧾', desc: 'ISR, IVA, retenciones SAT',                 color: '#D97706', bg: '#FFFBEB' },
  { value: 'inversion',  label: 'Inversión',         icon: '📈', desc: 'Fondos, CETES, reservas',                   color: '#16A34A', bg: '#F0FDF4' },
  { value: 'otro',       label: 'Otro',              icon: '🔖', desc: 'Propósito específico personalizado',         color: '#6B7280', bg: '#F3F4F6' },
]
const getProp = (v) => PROPOSITOS.find(p => p.value === v) || PROPOSITOS[0]

// ─── Estado inicial del formulario ──────────────────────────
const formInicial = () => ({
  nombre:          '',
  banco:           '',
  no_cuenta:       '',
  clabe:           '',
  moneda:          'MXN',
  saldo_inicial:   '',
  fecha_saldo_ini: new Date().toISOString().split('T')[0],
  activa:          true,
  proposito:       'general',
})

// ─── Modal de confirmación de eliminación ───────────────────
const ModalEliminar = ({ banco, onCancelar, onAceptar, eliminando }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  }}>
    <div style={{
      background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      padding: '24px', maxWidth: '420px', width: '100%',
      animation: 'fadeInDown 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: '#FEF2F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <AlertTriangle size={22} color="#DC2626" />
        </div>
        <div>
          <p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '0 0 6px' }}>
            ¿Eliminar cuenta bancaria?
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 4px', lineHeight: '1.5' }}>
            Se eliminará <strong>{banco?.nombre}</strong> ({banco?.banco}).
            Esta acción no se puede deshacer y podría afectar conciliaciones previas.
          </p>
          <p style={{ fontSize: '12px', color: '#DC2626', margin: 0, fontWeight: '500' }}>
            ⚠️ Asegúrate de que no tenga movimientos pendientes.
          </p>
        </div>
      </div>
      <div style={{ borderTop: `1px solid #E5E7EB`, paddingTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancelar}
          disabled={eliminando}
          style={{ padding: '9px 20px', borderRadius: '9px', border: `1px solid #E5E7EB`, background: '#FFFFFF', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
        >
          Cancelar
        </button>
        <button
          onClick={onAceptar}
          disabled={eliminando}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 20px', borderRadius: '9px', border: 'none',
            backgroundColor: eliminando ? '#FCA5A5' : '#DC2626',
            color: '#fff', cursor: eliminando ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '600',
          }}
        >
          <Trash2 size={14} />
          {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
        </button>
      </div>
    </div>
  </div>
)

// ─── Componente de campo de formulario ──────────────────────
const Campo = ({ label, requerido, children, error }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '5px' }}>
      {label}{requerido && <span style={{ color: '#DC2626', marginLeft: '2px' }}>*</span>}
    </label>
    {children}
    {error && <p style={{ fontSize: '11px', color: '#DC2626', margin: '3px 0 0' }}>{error}</p>}
  </div>
)

const inputStyle = (error) => ({
  width: '100%', padding: '9px 12px',
  border: `1px solid ${error ? '#EF4444' : '#E5E7EB'}`,
  borderRadius: '8px',
  fontSize: '13px', outline: 'none',
  backgroundColor: '#FFFFFF', color: '#111827',
  boxSizing: 'border-box',
})

// ─── Página principal ────────────────────────────────────────
export default function BancosPage() {
  const [companyId,  setCompanyId]  = useState(null)
  const [bancos,     setBancos]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [guardando,  setGuardando]  = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // Panel lateral
  const [panelAbierto,  setPanelAbierto]  = useState(false)
  const [modoEdicion,   setModoEdicion]   = useState(false)
  const [bancoEditando, setBancoEditando] = useState(null)
  const [form,          setForm]          = useState(formInicial())
  const [errores,       setErrores]       = useState({})

  // Modal eliminar
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [bancoAEliminar,    setBancoAEliminar]    = useState(null)

  // Toast interno
  const [toast, setToast] = useState(null)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => { if (companyId) cargarBancos() }, [companyId])

  const cargarBancos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('company_bancos')
      .select('*')
      .eq('company_id', companyId)
      .order('orden', { ascending: true })
    if (!error) setBancos(data || [])
    setLoading(false)
  }

  // ── Saldo calculado (saldo_inicial + movimientos) ──────────
  // Por ahora se usa saldo_inicial directamente.
  // En fases siguientes se calculará sumando/restando movimientos reales.
  const saldoCalculado = (banco) => Number(banco.saldo_inicial || 0)

  // ── KPIs ───────────────────────────────────────────────────
  const bancosActivos    = bancos.filter(b => b.activa)
  const totalMXN         = bancosActivos.filter(b => b.moneda === 'MXN').reduce((s, b) => s + saldoCalculado(b), 0)
  const totalUSD         = bancosActivos.filter(b => b.moneda === 'USD').reduce((s, b) => s + saldoCalculado(b), 0)
  const totalCuentas     = bancosActivos.length

  // ── Formulario ─────────────────────────────────────────────
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const abrirNuevo = () => {
    setForm(formInicial())
    setErrores({})
    setBancoEditando(null)
    setModoEdicion(false)
    setPanelAbierto(true)
  }

  const abrirEdicion = (banco) => {
    setForm({
      nombre:          banco.nombre,
      banco:           banco.banco,
      no_cuenta:       banco.no_cuenta || '',
      clabe:           banco.clabe || '',
      moneda:          banco.moneda || 'MXN',
      saldo_inicial:   banco.saldo_inicial?.toString() || '',
      fecha_saldo_ini: banco.fecha_saldo_ini || new Date().toISOString().split('T')[0],
      activa:          banco.activa !== false,
      proposito:       banco.proposito || 'general',
    })
    setErrores({})
    setBancoEditando(banco)
    setModoEdicion(true)
    setPanelAbierto(true)
  }

  const cerrarPanel = () => {
    setPanelAbierto(false)
    setBancoEditando(null)
    setForm(formInicial())
    setErrores({})
  }

  // ── Validación ─────────────────────────────────────────────
  const validar = () => {
    const e = {}
    if (!form.nombre.trim())          e.nombre        = 'El nombre es obligatorio'
    if (!form.banco.trim())           e.banco         = 'Selecciona un banco'
    if (!form.saldo_inicial.trim() || isNaN(Number(form.saldo_inicial)))
                                      e.saldo_inicial = 'Ingresa un monto válido'
    if (!form.fecha_saldo_ini)        e.fecha_saldo_ini = 'La fecha es obligatoria'
    if (form.clabe && form.clabe.replace(/\s/g, '').length !== 18)
                                      e.clabe         = 'La CLABE debe tener 18 dígitos'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  // ── Guardar (crear o editar) ───────────────────────────────
  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      const payload = {
        company_id:      companyId,
        nombre:          form.nombre.trim(),
        banco:           form.banco.trim(),
        no_cuenta:       form.no_cuenta.trim() || null,
        clabe:           form.clabe.replace(/\s/g, '') || null,
        moneda:          form.moneda,
        saldo_inicial:   Number(form.saldo_inicial),
        fecha_saldo_ini: form.fecha_saldo_ini,
        activa:          form.activa,
        proposito:       form.proposito || 'general',
        updated_at:      new Date().toISOString(),
      }

      if (modoEdicion && bancoEditando) {
        const { error } = await supabase
          .from('company_bancos')
          .update(payload)
          .eq('id', bancoEditando.id)
        if (error) throw error
        mostrarToast('✅ Cuenta bancaria actualizada')
      } else {
        const { error } = await supabase
          .from('company_bancos')
          .insert({ ...payload, orden: bancos.length + 1 })
        if (error) throw error
        mostrarToast('✅ Cuenta bancaria registrada')
      }

      cerrarPanel()
      cargarBancos()
    } catch (e) {
      mostrarToast('Error al guardar: ' + e.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar ───────────────────────────────────────────────
  const pedirEliminar = (banco) => {
    setBancoAEliminar(banco)
    setConfirmarEliminar(true)
  }

  const ejecutarEliminar = async () => {
    setEliminando(true)
    try {
      const { error } = await supabase
        .from('company_bancos')
        .delete()
        .eq('id', bancoAEliminar.id)
      if (error) throw error
      setConfirmarEliminar(false)
      setBancoAEliminar(null)
      mostrarToast('Cuenta bancaria eliminada')
      cargarBancos()
    } catch (e) {
      mostrarToast('Error al eliminar: ' + e.message, 'error')
    } finally {
      setEliminando(false)
    }
  }

  // ── Toggle activa/inactiva ────────────────────────────────
  const toggleActiva = async (banco) => {
    const { error } = await supabase
      .from('company_bancos')
      .update({ activa: !banco.activa, updated_at: new Date().toISOString() })
      .eq('id', banco.id)
    if (!error) {
      mostrarToast(banco.activa ? 'Cuenta desactivada' : 'Cuenta activada')
      cargarBancos()
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <MainLayout title="🏦 Cuentas Bancarias">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960, margin: '0 auto' }}>

        {/* KPIs ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {[
            {
              label: 'Cuentas activas',
              valor: totalCuentas,
              sub:   `de ${bancos.length} registradas`,
              icon:  <Landmark size={18} color="#2563EB" />,
              bg:    '#EFF6FF',
            },
            {
              label: 'Total MXN',
              valor: `$${fmt(totalMXN)}`,
              sub:   'saldo inicial acumulado',
              icon:  <DollarSign size={18} color="#16A34A" />,
              bg:    '#F0FDF4',
            },
            {
              label: 'Total USD',
              valor: `$${fmt(totalUSD)}`,
              sub:   'saldo inicial acumulado',
              icon:  <DollarSign size={18} color="#D97706" />,
              bg:    '#FFFBEB',
            },
          ].map(k => (
            <div key={k.label} style={{ ...borde, background: '#FFFFFF', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {k.icon}
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 2px' }}>{k.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0, lineHeight: 1.2 }}>{k.valor}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Barra de acciones ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              Registra y administra las cuentas bancarias de la empresa.
              El saldo inicial es el punto de partida para el cálculo del flujo real.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={cargarBancos}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '8px', border: `0.5px solid #E5E7EB`, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, color: '#6B7280' }}
            >
              <RefreshCw size={14} /> Actualizar
            </button>
            {bancos.length < 5 && (
              <button
                onClick={abrirNuevo}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111827', color: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                <Plus size={14} /> Nueva cuenta
              </button>
            )}
          </div>
        </div>

        {/* Aviso límite ──────────────────────────────────────── */}
        {bancos.length >= 5 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', border: `0.5px solid #F59E0B`, borderRadius: '8px', padding: '10px 14px' }}>
            <AlertTriangle size={16} color="#D97706" />
            <p style={{ fontSize: 13, color: '#D97706', margin: 0 }}>
              Has alcanzado el límite de 5 cuentas bancarias. Elimina una para agregar otra.
            </p>
          </div>
        )}

        {/* Lista de cuentas ───────────────────────────────────── */}
        <div style={{ ...borde, background: '#FFFFFF', overflow: 'hidden' }}>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 28, height: 28, border: `2px solid #E5E7EB`, borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>

          ) : bancos.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center' }}>
              <Landmark size={36} style={{ color: '#9CA3AF', margin: '0 auto 14px', display: 'block' }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', margin: '0 0 6px' }}>
                Sin cuentas bancarias registradas
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
                Agrega las cuentas de la empresa para comenzar a gestionar el flujo de Tesorería.
              </p>
              <button
                onClick={abrirNuevo}
                style={{ padding: '9px 20px', borderRadius: '8px', border: `0.5px solid #E5E7EB`, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#111827' }}
              >
                + Agregar primera cuenta
              </button>
            </div>

          ) : (
            <>
              {/* Header tabla */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 160px 120px 100px 90px', padding: '10px 16px', borderBottom: `0.5px solid #E5E7EB`, background: '#F9FAFB' }}>
                {['Cuenta', 'Propósito', 'Moneda', 'Saldo inicial', 'Fecha saldo', 'Estatus', ''].map(h => (
                  <p key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{h}</p>
                ))}
              </div>

              {/* Filas */}
              {bancos.map((banco, i) => (
                <div
                  key={banco.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 120px 160px 120px 100px 90px',
                    padding: '14px 16px',
                    borderBottom: i < bancos.length - 1 ? `0.5px solid #E5E7EB` : 'none',
                    alignItems: 'center',
                    background: banco.activa ? '#FFFFFF' : '#F9FAFB',
                    transition: 'background .1s',
                    opacity: banco.activa ? 1 : 0.65,
                  }}
                >
                  {/* Nombre + banco */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      backgroundColor: '#EFF6FF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Building2 size={16} color="#2563EB" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                        {banco.nombre}
                      </p>
                      <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                        {banco.banco}
                        {banco.no_cuenta && ` · ****${banco.no_cuenta.slice(-4)}`}
                      </p>
                      {banco.clabe && (
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '1px 0 0', fontFamily: 'monospace' }}>
                          CLABE: {banco.clabe.slice(0, 6)}···{banco.clabe.slice(-4)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Propósito */}
                  {(() => {
                    const prop = getProp(banco.proposito || 'general')
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 11, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 20,
                        backgroundColor: prop.bg, color: prop.color,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ fontSize: 13 }}>{prop.icon}</span>
                        {prop.label}
                      </span>
                    )
                  })()}

                  {/* Moneda */}
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 600,
                    padding: '3px 10px', borderRadius: 20,
                    backgroundColor: banco.moneda === 'USD' ? '#FFFBEB' : '#F0FDF4',
                    color: banco.moneda === 'USD' ? '#D97706' : '#16A34A',
                  }}>
                    {banco.moneda}
                  </span>

                  {/* Saldo inicial */}
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0, fontFamily: 'monospace' }}>
                    ${fmt(banco.saldo_inicial)}
                  </p>

                  {/* Fecha saldo */}
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                    {fmtFecha(banco.fecha_saldo_ini)}
                  </p>

                  {/* Estatus toggle */}
                  <button
                    onClick={() => toggleActiva(banco)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                    title={banco.activa ? 'Desactivar cuenta' : 'Activar cuenta'}
                  >
                    {banco.activa
                      ? <><ToggleRight size={20} color="#16A34A" /><span style={{ fontSize: 11, color: '#16A34A', fontWeight: 500 }}>Activa</span></>
                      : <><ToggleLeft  size={20} color="#9CA3AF" /><span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Inactiva</span></>
                    }
                  </button>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => abrirEdicion(banco)}
                      title="Editar"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: `0.5px solid #E5E7EB`, background: '#FFFFFF', cursor: 'pointer', color: '#6B7280' }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => pedirEliminar(banco)}
                      title="Eliminar"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: `0.5px solid #EF4444`, background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Nota informativa ───────────────────────────────────── */}
        {bancos.length > 0 && (
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
            💡 El saldo mostrado es el saldo inicial capturado. El saldo real calculado estará disponible
            al integrar los movimientos de CxC, CxP y la conciliación bancaria.
          </p>
        )}

      </div>

      {/* ── Panel lateral — Formulario ─────────────────────────────── */}
      {panelAbierto && (
        <>
          {/* Overlay */}
          <div
            onClick={cerrarPanel}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 80 }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: '420px', maxWidth: '95vw',
            backgroundColor: '#FFFFFF',
            borderLeft: `1px solid #E5E7EB`,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
            zIndex: 90, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.2s ease',
          }}>

            {/* Header panel */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid #E5E7EB`, backgroundColor: '#F9FAFB', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark size={16} color="#2563EB" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                    {modoEdicion ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                    {modoEdicion ? bancoEditando?.nombre : `${bancos.length}/5 cuentas registradas`}
                  </p>
                </div>
              </div>
              <button onClick={cerrarPanel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}>
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* Nombre de la cuenta */}
              <Campo label="Nombre de la cuenta" requerido error={errores.nombre}>
                <input
                  type="text"
                  placeholder='Ej: "BBVA Operaciones" o "Santander Nómina"'
                  value={form.nombre}
                  onChange={e => setF('nombre', e.target.value)}
                  style={inputStyle(errores.nombre)}
                />
              </Campo>

              {/* Banco */}
              <Campo label="Banco" requerido error={errores.banco}>
                <div style={{ position: 'relative' }}>
                  <select
                    value={form.banco}
                    onChange={e => setF('banco', e.target.value)}
                    style={{ ...inputStyle(errores.banco), appearance: 'none', paddingRight: 32 }}
                  >
                    <option value="">Seleccionar banco...</option>
                    {BANCOS_MX.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </Campo>

              {/* Moneda */}
              <Campo label="Moneda" requerido>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['MXN', 'USD'].map(m => (
                    <button
                      key={m}
                      onClick={() => setF('moneda', m)}
                      style={{
                        flex: 1, padding: '9px', borderRadius: '8px',
                        border: `0.5px solid ${form.moneda === m ? '#3B82F6' : '#E5E7EB'}`,
                        background: form.moneda === m ? '#EFF6FF' : '#FFFFFF',
                        color: form.moneda === m ? '#2563EB' : '#6B7280',
                        cursor: 'pointer', fontSize: 13, fontWeight: form.moneda === m ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {m === 'MXN' ? '🇲🇽 Peso Mexicano (MXN)' : '🇺🇸 Dólar Americano (USD)'}
                    </button>
                  ))}
                </div>
              </Campo>

              {/* Propósito de la cuenta */}
              <Campo label="Propósito de la cuenta" requerido>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {PROPOSITOS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setF('proposito', p.value)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: `2px solid ${form.proposito === p.value ? p.color : '#E5E7EB'}`,
                        backgroundColor: form.proposito === p.value ? p.bg : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                      <div style={{
                        fontSize: 11, fontWeight: 600,
                        color: form.proposito === p.value ? p.color : '#374151',
                        lineHeight: 1.2, marginBottom: 2,
                      }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.3 }}>
                        {p.desc}
                      </div>
                    </button>
                  ))}
                </div>
                {form.proposito !== 'general' && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8,
                    backgroundColor: getProp(form.proposito).bg,
                    border: `1px solid ${getProp(form.proposito).color}33`,
                  }}>
                    <p style={{ fontSize: 11, color: getProp(form.proposito).color, margin: 0, fontWeight: 500 }}>
                      💡 La IA usará esta cuenta automáticamente para pagos de tipo "{getProp(form.proposito).label}"
                    </p>
                  </div>
                )}
              </Campo>

              {/* No. de cuenta */}
              <Campo label="Número de cuenta" error={errores.no_cuenta}>
                <input
                  type="text"
                  placeholder="Últimos dígitos o número completo"
                  value={form.no_cuenta}
                  onChange={e => setF('no_cuenta', e.target.value)}
                  style={inputStyle(errores.no_cuenta)}
                  maxLength={30}
                />
              </Campo>

              {/* CLABE */}
              <Campo label="CLABE interbancaria (18 dígitos)" error={errores.clabe}>
                <input
                  type="text"
                  placeholder="000000000000000000"
                  value={form.clabe}
                  onChange={e => setF('clabe', e.target.value.replace(/\D/g, '').slice(0, 18))}
                  style={{ ...inputStyle(errores.clabe), fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  maxLength={18}
                />
                {form.clabe.length > 0 && form.clabe.length < 18 && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0' }}>
                    {form.clabe.length} / 18 dígitos
                  </p>
                )}
              </Campo>

              {/* Separador */}
              <div style={{ borderTop: `0.5px solid #E5E7EB`, margin: '4px 0 16px' }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>
                Saldo de apertura
              </p>

              {/* Saldo inicial */}
              <Campo label="Saldo inicial" requerido error={errores.saldo_inicial}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.saldo_inicial}
                    onChange={e => setF('saldo_inicial', e.target.value)}
                    style={{ ...inputStyle(errores.saldo_inicial), paddingLeft: 24 }}
                  />
                </div>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0', lineHeight: 1.4 }}>
                  Captura el saldo real de la cuenta en la fecha indicada. Este es el punto de partida para el cálculo del flujo.
                </p>
              </Campo>

              {/* Fecha del saldo */}
              <Campo label="Fecha del saldo inicial" requerido error={errores.fecha_saldo_ini}>
                <input
                  type="date"
                  value={form.fecha_saldo_ini}
                  onChange={e => setF('fecha_saldo_ini', e.target.value)}
                  style={inputStyle(errores.fecha_saldo_ini)}
                />
              </Campo>

              {/* Cuenta activa */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', border: `0.5px solid #E5E7EB`, background: '#F9FAFB' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>Cuenta activa</p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>Las cuentas inactivas no aparecen en la posición de caja</p>
                </div>
                <button
                  onClick={() => setF('activa', !form.activa)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  {form.activa
                    ? <ToggleRight size={28} color="#16A34A" />
                    : <ToggleLeft  size={28} color="#9CA3AF" />}
                </button>
              </div>

            </div>

            {/* Footer panel */}
            <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: `1px solid #E5E7EB`, backgroundColor: '#F9FAFB', flexShrink: 0 }}>
              <button
                onClick={cerrarPanel}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid #E5E7EB`, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{
                  flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: '8px', border: 'none',
                  background: guardando ? '#D1D5DB' : '#111827',
                  color: '#FFFFFF',
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <Save size={14} />
                {guardando ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Registrar cuenta'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal confirmar eliminar ─────────────────────────────── */}
      {confirmarEliminar && (
        <ModalEliminar
          banco={bancoAEliminar}
          eliminando={eliminando}
          onCancelar={() => { setConfirmarEliminar(false); setBancoAEliminar(null) }}
          onAceptar={ejecutarEliminar}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: '12px',
          background: toast.tipo === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `0.5px solid ${toast.tipo === 'error' ? '#EF4444' : '#22C55E'}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          animation: 'fadeInDown 0.2s ease',
          maxWidth: 360,
        }}>
          {toast.tipo === 'error'
            ? <AlertTriangle size={16} color="#DC2626" />
            : <CheckCircle2  size={16} color="#16A34A" />}
          <p style={{ fontSize: 13, fontWeight: 500, color: toast.tipo === 'error' ? '#DC2626' : '#16A34A', margin: 0 }}>
            {toast.msg}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes fadeInDown   { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
      `}</style>

    </MainLayout>
  )
}