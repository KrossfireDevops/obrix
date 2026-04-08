// ============================================================
//  OBRIX ERP — Anticipo y Disparo de Proyecto
//  src/pages/comercial/AnticipoPagoPage.jsx  |  v1.0
//
//  Flujo:
//    1. Seleccionar contrato firmado
//    2. Registrar monto recibido, forma de cobro y referencia
//    3. Subir comprobante de transferencia
//    4. Confirmar → crear_proyecto_desde_contrato()
//    5. Alertas al equipo involucrado
//    6. Oportunidad pasa a "Proyecto activo"
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import { supabase }   from '../../config/supabase'
import {
  registrarAnticipo, dispararProyecto, fmtMXN,
} from '../../services/comercial.service'
import {
  ArrowLeft, Zap, CheckCircle, RefreshCw,
  Upload, AlertTriangle, DollarSign,
  Shield, Bell, Rocket, FileText,
  Users, Building2, Wrench,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '9px 11px', fontSize: 13,
  border: '1px solid #E5E7EB', borderRadius: 9,
  outline: 'none', color: '#111827', background: '#fff',
  boxSizing: 'border-box',
}
const lbl = {
  fontSize: 10, fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 4,
}
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={lbl}>{label}</label>
    {children}
  </div>
)

// ─────────────────────────────────────────────────────────────
// PASO INDICADOR
// ─────────────────────────────────────────────────────────────
const PasoIndicador = ({ pasos, actual }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
    {pasos.map((p, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < pasos.length - 1 ? 1 : 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: i < actual ? '#10B981' : i === actual ? '#2563EB' : '#E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s',
          }}>
            {i < actual
              ? <CheckCircle size={16} color="#fff" />
              : <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: i === actual ? '#fff' : '#9CA3AF',
                }}>{i + 1}</span>
            }
          </div>
          <span style={{
            fontSize: 9, marginTop: 4, fontWeight: 600,
            color: i === actual ? '#2563EB' : i < actual ? '#10B981' : '#9CA3AF',
            whiteSpace: 'nowrap',
          }}>
            {p}
          </span>
        </div>
        {i < pasos.length - 1 && (
          <div style={{
            flex: 1, height: 2, margin: '0 6px',
            marginBottom: 18,
            background: i < actual ? '#10B981' : '#E5E7EB',
            transition: 'background 0.3s',
          }} />
        )}
      </div>
    ))}
  </div>
)

// ─────────────────────────────────────────────────────────────
// TARJETA DE ALERTA AL EQUIPO
// ─────────────────────────────────────────────────────────────
const AlertaEquipo = ({ icono: Icono, rol, nombre, accion, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 13px',
    background: color + '10',
    border: `0.5px solid ${color}33`,
    borderRadius: 10, marginBottom: 7,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9,
      background: color + '20',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icono size={16} color={color} />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 1px' }}>
        {rol}
      </p>
      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
        {accion}
      </p>
    </div>
    {nombre && (
      <span style={{
        fontSize: 10, fontWeight: 600,
        background: color + '15', color,
        padding: '2px 8px', borderRadius: 20,
      }}>
        {nombre}
      </span>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function AnticipoPagoPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { toast }      = useToast()

  const contratoId = searchParams.get('contrato')
  const opId       = searchParams.get('oportunidad')

  const [paso,       setPaso]       = useState(0)  // 0=datos, 1=confirmar, 2=activado
  const [loading,    setLoading]    = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [companyId,  setCompanyId]  = useState(null)
  const [userId,     setUserId]     = useState(null)
  const [contrato,   setContrato]   = useState(null)
  const [anticipo,   setAnticipo]   = useState(null)  // resultado tras crear
  const [proyecto,   setProyecto]   = useState(null)  // resultado del disparo
  const [equipo,     setEquipo]     = useState([])

  // Formulario
  const [form, setForm] = useState({
    monto_recibido:   '',
    fecha_recibido:   new Date().toISOString().split('T')[0],
    forma_cobro:      'transferencia',
    referencia_bancaria: '',
    notas:            '',
  })
  const [comprobante, setComprobante] = useState(null)
  const [subiendo,    setSubiendo]    = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Cargar usuario ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase.from('users_profiles')
        .select('company_id').eq('id', u.id).single()
        .then(({ data }) => {
          setCompanyId(data?.company_id)
          setUserId(u.id)
        })
    })
  }, [])

  // ── Cargar contrato ──
  useEffect(() => {
    if (!companyId) return
    const cargar = async () => {
      setLoading(true)
      try {
        let cid = contratoId
        if (!cid && opId) {
          // Buscar el contrato firmado de esta oportunidad
          const { data: cont } = await supabase
            .from('contratos_comerciales')
            .select('id')
            .eq('oportunidad_id', opId)
            .eq('estatus', 'firmado')
            .single()
          cid = cont?.id
        }
        if (!cid && opId) {
          // Si no hay firmado, tomar cualquiera
          const { data: cont } = await supabase
            .from('contratos_comerciales')
            .select('id')
            .eq('oportunidad_id', opId)
            .order('created_at', { ascending: false })
            .limit(1).single()
          cid = cont?.id
        }
        if (!cid) { setLoading(false); return }

        const { data: cont } = await supabase
          .from('contratos_comerciales')
          .select(`
            *,
            cliente:cliente_id(nombre, email, telefono),
            oportunidad:oportunidad_id(
              folio, nombre_proyecto,
              ejecutivo:ejecutivo_id(full_name, email)
            )
          `)
          .eq('id', cid).single()

        setContrato(cont)
        if (cont) {
          set('monto_recibido', cont.monto_anticipo?.toString() || '')
        }

        // Cargar equipo del proyecto
        const { data: miembros } = await supabase
          .from('users_profiles')
          .select('id, full_name, role')
          .eq('company_id', companyId)
          .in('role', ['admin_empresa','director_operativo','residente_obra',
                        'compras','finanzas','contador'])
          .eq('is_active', true)

        setEquipo(miembros ?? [])
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [companyId, contratoId, opId])

  // ── Subir comprobante ──
  const handleComprobante = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `anticipos/${companyId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('gastos-comprobantes')
        .upload(path, file, { upsert: false })
      if (error) throw error
      setComprobante(path)
      toast.success('Comprobante subido ✓')
    } catch (e) {
      toast.error('Error al subir: ' + e.message)
    } finally {
      setSubiendo(false)
    }
  }

  // ── Registrar anticipo ──
  const handleRegistrar = async () => {
    if (!form.monto_recibido || parseFloat(form.monto_recibido) <= 0) {
      toast.error('El monto recibido es obligatorio')
      return
    }
    if (!form.referencia_bancaria.trim()) {
      toast.error('La referencia bancaria es obligatoria')
      return
    }
    setProcesando(true)
    try {
      const { data: ant, error } = await registrarAnticipo({
        company_id:       companyId,
        contrato_id:      contrato.id,
        oportunidad_id:   contrato.oportunidad_id,
        monto_recibido:   parseFloat(form.monto_recibido),
        fecha_recibido:   form.fecha_recibido,
        forma_cobro:      form.forma_cobro,
        referencia_bancaria: form.referencia_bancaria,
        comprobante_path: comprobante,
        notas:            form.notas,
        registrado_por:   userId,
      })
      if (error) throw error
      setAnticipo(ant)
      setPaso(1)
    } catch (e) {
      toast.error('Error al registrar anticipo: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  // ── Disparar proyecto ──
  const handleDisparar = async () => {
    if (!anticipo) return
    setProcesando(true)
    try {
      const { data, error } = await dispararProyecto(anticipo.id, userId)
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || 'Error al crear proyecto')

      // Actualizar estatus del contrato a vigente
      await supabase.from('contratos_comerciales')
        .update({ estatus: 'vigente' }).eq('id', contrato.id)

      setProyecto(data)
      setPaso(2)
      toast.success(`¡Proyecto "${data.nombre}" activado en OBRIX! 🚀`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setProcesando(false)
    }
  }

  const pctRecibido = contrato
    ? Math.round((parseFloat(form.monto_recibido) /
        (contrato.monto_total || 1)) * 100)
    : 0

  const alertasEquipo = [
    { icono: Building2, rol: 'Director de Obra',  color: '#2563EB',
      accion: 'Nuevo proyecto asignado — revisar alcance y arrancar plan de obra' },
    { icono: Wrench,    rol: 'Director Operativo', color: '#7C3AED',
      accion: 'Proyecto activo — coordinar asignación de cuadrilla' },
    { icono: Users,     rol: 'Compras',            color: '#D97706',
      accion: 'Solicitud de materiales habilitada para el proyecto' },
    { icono: DollarSign,rol: 'Finanzas',           color: '#059669',
      accion: `Anticipo de ${fmtMXN(parseFloat(form.monto_recibido) || 0)} recibido — registrar en libro mayor` },
    { icono: Shield,    rol: 'Administración',     color: '#DC2626',
      accion: 'Contrato vigente — archivar expediente y generar póliza contable' },
  ]

  if (loading) {
    return (
      <MainLayout title="💰 Registro de Anticipo">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <RefreshCw size={22} color="#9CA3AF"
            style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout title="💰 Registro de Anticipo">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Indicador de pasos */}
        <PasoIndicador
          pasos={['Registrar pago', 'Confirmar', 'Proyecto activo']}
          actual={paso}
        />

        {/* ── PASO 0: REGISTRAR PAGO ── */}
        {paso === 0 && contrato && (
          <>
            {/* Resumen del contrato */}
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 13, padding: '16px 18px', marginBottom: 14,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Contrato vinculado
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { l: 'Folio',       v: contrato.folio },
                  { l: 'Cliente',     v: contrato.cliente?.nombre },
                  { l: 'Proyecto',    v: contrato.nombre_proyecto },
                  { l: 'Monto total', v: fmtMXN(contrato.monto_total) },
                  { l: 'Anticipo pactado',
                    v: `${contrato.pct_anticipo}% — ${fmtMXN(contrato.monto_anticipo)}` },
                  { l: 'Ejecutivo',
                    v: contrato.oportunidad?.ejecutivo?.full_name || '—' },
                ].map(r => (
                  <div key={r.l}>
                    <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 2px',
                      textTransform: 'uppercase', fontWeight: 600 }}>{r.l}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>
                      {r.v || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario de pago */}
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 13, padding: '18px 20px', marginBottom: 14,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Datos del pago recibido
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Monto recibido *">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        padding: '9px 11px', background: '#F3F4F6',
                        border: '1px solid #E5E7EB', borderRight: 'none',
                        borderRadius: '9px 0 0 9px', fontSize: 13, color: '#6B7280',
                      }}>$</span>
                      <input
                        style={{ ...inp, borderRadius: '0 9px 9px 0', flex: 1,
                          fontSize: 18, fontWeight: 700 }}
                        type="number" min={0}
                        value={form.monto_recibido}
                        onChange={e => set('monto_recibido', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    {/* Indicador del % del contrato */}
                    {pctRecibido > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>
                          <span>Porcentaje del contrato</span>
                          <span style={{
                            fontWeight: 700,
                            color: pctRecibido >= 40 ? '#059669' : '#B45309',
                          }}>
                            {pctRecibido}%
                            {pctRecibido < 40 && ' (mínimo 40%)'}
                          </span>
                        </div>
                        <div style={{ height: 5, background: '#F3F4F6',
                          borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(pctRecibido, 100)}%`, height: '100%',
                            background: pctRecibido >= 40 ? '#10B981' : '#F59E0B',
                            borderRadius: 9999, transition: 'width 0.4s',
                          }} />
                        </div>
                      </div>
                    )}
                  </Field>
                </div>

                <Field label="Fecha de recepción">
                  <input style={inp} type="date"
                    value={form.fecha_recibido}
                    onChange={e => set('fecha_recibido', e.target.value)} />
                </Field>

                <Field label="Forma de cobro">
                  <select style={{ ...inp, cursor: 'pointer' }}
                    value={form.forma_cobro}
                    onChange={e => set('forma_cobro', e.target.value)}>
                    <option value="transferencia">Transferencia bancaria</option>
                    <option value="deposito">Depósito bancario</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo</option>
                  </select>
                </Field>

                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Referencia / número de operación *">
                    <input style={inp}
                      placeholder="Ej: SPEI-20250326-123456789"
                      value={form.referencia_bancaria}
                      onChange={e => set('referencia_bancaria', e.target.value)} />
                  </Field>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Comprobante de pago">
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 9,
                      border: `2px dashed ${comprobante ? '#A7F3D0' : '#E5E7EB'}`,
                      background: comprobante ? '#F0FDF4' : '#FAFAFA',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      {subiendo
                        ? <RefreshCw size={16} color="#9CA3AF"
                            style={{ animation: 'spin 1s linear infinite' }} />
                        : comprobante
                          ? <CheckCircle size={16} color="#10B981" />
                          : <Upload size={16} color="#9CA3AF" />}
                      <span style={{
                        fontSize: 12,
                        color: comprobante ? '#065F46' : '#6B7280',
                      }}>
                        {subiendo ? 'Subiendo...'
                          : comprobante ? 'Comprobante adjunto ✓'
                          : 'Subir comprobante (PDF, JPG, PNG)'}
                      </span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleComprobante}
                        style={{ display: 'none' }} />
                    </label>
                  </Field>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Notas internas">
                    <textarea style={{ ...inp, minHeight: 60, resize: 'vertical',
                      fontFamily: 'inherit' }}
                      placeholder="Notas sobre el pago..."
                      value={form.notas}
                      onChange={e => set('notas', e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Advertencia monto menor al pactado */}
            {form.monto_recibido && pctRecibido < 40 && (
              <div style={{
                display: 'flex', gap: 10, padding: '11px 14px',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 10, marginBottom: 14,
              }}>
                <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
                  El monto registrado es menor al anticipo mínimo pactado
                  ({contrato.pct_anticipo}% = {fmtMXN(contrato.monto_anticipo)}).
                  Puedes continuar si hay un acuerdo especial con el cliente.
                </p>
              </div>
            )}

            <button
              onClick={handleRegistrar}
              disabled={procesando || !form.referencia_bancaria.trim() ||
                        !form.monto_recibido}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                padding: '13px 20px', borderRadius: 11, border: 'none',
                background: procesando ? '#93C5FD' : '#2563EB',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: procesando ? 'not-allowed' : 'pointer',
              }}>
              {procesando
                ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <DollarSign size={16} />}
              Registrar anticipo recibido
            </button>
          </>
        )}

        {/* ── PASO 1: CONFIRMAR Y DISPARAR ── */}
        {paso === 1 && anticipo && (
          <>
            {/* Confirmación del pago */}
            <div style={{
              background: '#F0FDF4', border: '1px solid #A7F3D0',
              borderRadius: 13, padding: '18px 20px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CheckCircle size={22} color="#10B981" />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#065F46', margin: 0 }}>
                    Anticipo registrado correctamente
                  </p>
                  <p style={{ fontSize: 11, color: '#6EE7B7', margin: 0 }}>
                    El pago quedó registrado en el sistema
                  </p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { l: 'Monto registrado', v: fmtMXN(parseFloat(form.monto_recibido)) },
                  { l: 'Referencia',       v: form.referencia_bancaria },
                  { l: 'Fecha',            v: form.fecha_recibido },
                  { l: 'Forma de cobro',   v: form.forma_cobro },
                ].map(r => (
                  <div key={r.l} style={{
                    padding: '8px 10px', background: '#fff',
                    borderRadius: 8, border: '0.5px solid #D1FAE5',
                  }}>
                    <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 2px',
                      textTransform: 'uppercase', fontWeight: 600 }}>{r.l}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: 0 }}>
                      {r.v}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas al equipo */}
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 13, padding: '16px 18px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Bell size={15} color="#2563EB" />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                  margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Al activar el proyecto se notificará a:
                </p>
              </div>
              {alertasEquipo.map((a, i) => (
                <AlertaEquipo key={i} {...a}
                  nombre={equipo.find(e =>
                    e.role === a.rol.toLowerCase().replace(/ /g,'_'))?.full_name}
                />
              ))}
            </div>

            {/* Resumen del proyecto que se creará */}
            <div style={{
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              borderRadius: 13, padding: '14px 18px', marginBottom: 16,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF',
                margin: '0 0 8px' }}>
                Se creará automáticamente en OBRIX:
              </p>
              {[
                '✓ Proyecto activo vinculado al contrato',
                '✓ Seguimiento registrado en el expediente',
                '✓ Oportunidad movida a "Proyecto activo"',
                '✓ Contrato marcado como vigente',
              ].map((item, i) => (
                <p key={i} style={{ fontSize: 12, color: '#1E40AF', margin: '4px 0' }}>
                  {item}
                </p>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPaso(0)}
                style={{ padding: '11px 18px', borderRadius: 10,
                  border: '1px solid #E5E7EB', background: '#fff',
                  color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                ← Regresar
              </button>
              <button
                onClick={handleDisparar}
                disabled={procesando}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  padding: '13px 20px', borderRadius: 11, border: 'none',
                  background: procesando ? '#93C5FD' : '#059669',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: procesando ? 'not-allowed' : 'pointer',
                }}>
                {procesando
                  ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Rocket size={16} />}
                {procesando ? 'Activando proyecto...' : '🚀 Activar proyecto en OBRIX'}
              </button>
            </div>
          </>
        )}

        {/* ── PASO 2: PROYECTO ACTIVADO ── */}
        {paso === 2 && proyecto && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
            }}>
              <Rocket size={36} color="#fff" />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#065F46',
              margin: '0 0 8px' }}>
              ¡Proyecto activado!
            </h2>
            <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 28px' }}>
              <strong>{proyecto.nombre}</strong> ya está activo en OBRIX.
              Todo el equipo fue notificado.
            </p>

            {/* Datos del proyecto creado */}
            <div style={{
              background: '#F0FDF4', border: '1px solid #A7F3D0',
              borderRadius: 13, padding: '16px 20px', marginBottom: 24,
              textAlign: 'left',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { l: 'Proyecto', v: proyecto.nombre },
                  { l: 'Monto contratado', v: fmtMXN(proyecto.monto) },
                  { l: 'Anticipo recibido',
                    v: fmtMXN(parseFloat(form.monto_recibido)) },
                  { l: 'Saldo pendiente',
                    v: fmtMXN(proyecto.monto - parseFloat(form.monto_recibido)) },
                ].map(r => (
                  <div key={r.l} style={{
                    padding: '8px 10px', background: '#fff',
                    borderRadius: 8, border: '0.5px solid #D1FAE5',
                  }}>
                    <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 2px',
                      textTransform: 'uppercase', fontWeight: 600 }}>{r.l}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#065F46', margin: 0 }}>
                      {r.v}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/comercial/pipeline')}
                style={{ padding: '11px 20px', borderRadius: 10,
                  border: '1px solid #E5E7EB', background: '#fff',
                  color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                Ver Pipeline
              </button>
              <button
                onClick={() => navigate('/projects')}
                style={{ display: 'flex', alignItems: 'center', gap: 7,
                  padding: '11px 24px', borderRadius: 10, border: 'none',
                  background: '#2563EB', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <FileText size={15} /> Ir al proyecto en OBRIX
              </button>
            </div>
          </div>
        )}

        {/* Sin contrato */}
        {!loading && !contrato && paso === 0 && (
          <div style={{
            textAlign: 'center', padding: '50px 20px',
            background: '#fff', borderRadius: 14,
            border: '1px solid #E5E7EB',
          }}>
            <AlertTriangle size={30} color="#F59E0B"
              style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151',
              margin: '0 0 6px' }}>
              No se encontró un contrato vinculado
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
              Genera primero un contrato para la oportunidad antes de registrar el anticipo.
            </p>
            <button onClick={() => navigate(-1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 9,
                border: '1px solid #E5E7EB', background: '#fff',
                color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Regresar
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
