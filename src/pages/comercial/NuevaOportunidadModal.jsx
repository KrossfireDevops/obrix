// ============================================================
//  OBRIX ERP — Modal Nueva Oportunidad
//  src/pages/comercial/NuevaOportunidadModal.jsx  |  v1.0
//
//  Formulario de 2 pasos:
//    Paso 1 — Datos del cliente (nuevo o existente)
//    Paso 2 — Datos de la oportunidad
// ============================================================

import { useState, useEffect } from 'react'
import {
  crearOportunidad, crearCliente, getClientes,
  calcularAnticipo,
  TIPO_OBRA_LABELS, ORIGEN_LABELS,
  ZONA_LABELS, SUMINISTRO_LABELS,
} from '../../services/comercial.service'
import {
  X, User, Building2, ChevronRight,
  ChevronLeft, Save, RefreshCw,
  Search, Plus, AlertCircle,
  Zap,
} from 'lucide-react'

// ── Helpers de estilo ─────────────────────────────────────────
const inp = {
  width: '100%', padding: '8px 10px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', color: '#111827', background: '#fff',
  boxSizing: 'border-box',
}
const sel = { ...inp, cursor: 'pointer' }
const lbl = {
  fontSize: 10, fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 4,
}
const Field = ({ label, children, half }) => (
  <div style={{ marginBottom: 12, gridColumn: half ? 'span 1' : 'span 2' }}>
    <label style={lbl}>{label}</label>
    {children}
  </div>
)

// ─────────────────────────────────────────────────────────────
export default function NuevaOportunidadModal({
  companyId, userId, onSuccess, onClose, toast,
}) {
  const [paso, setPaso]           = useState(1)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  // Cliente
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes]       = useState([])
  const [clienteSel, setClienteSel]   = useState(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [clienteForm, setClienteForm] = useState({
    nombre: '', email: '', telefono: '', cargo: '',
    empresa: '', ciudad: '', estado: '',
    origen_primer_contacto: 'contacto_directo',
  })

  // Oportunidad
  const [opForm, setOpForm] = useState({
    nombre_proyecto:      '',
    tipo_obra:            'comercial',
    tipo_suministro:      'mo_materiales',
    zona_pais:            'zona_a',
    es_foranea:           false,
    tamano_proyecto:      'mediana',
    monto_estimado:       '',
    origen:               'contacto_directo',
    fecha_estimada_cierre: '',
    ciudad_obra:          '',
    estado_obra:          '',
    duracion_estimada_dias: '',
    descripcion:          '',
  })

  // Anticipo sugerido
  const [anticipoData, setAnticipoData] = useState(null)
  const [calcAnticipo, setCalcAnticipo] = useState(false)

  // Cargar clientes al buscar
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await getClientes(companyId, busqCliente)
      setClientes(data ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [busqCliente, companyId])

  // Calcular anticipo cuando cambian los datos relevantes
  useEffect(() => {
    const calcular = async () => {
      if (!opForm.monto_estimado || parseFloat(opForm.monto_estimado) <= 0) {
        setAnticipoData(null)
        return
      }
      setCalcAnticipo(true)
      try {
        const { data } = await calcularAnticipo(
          opForm.es_foranea,
          opForm.tipo_suministro,
          opForm.tamano_proyecto,
          opForm.zona_pais,
          parseFloat(opForm.monto_estimado),
        )
        setAnticipoData(data)
      } catch { setAnticipoData(null) }
      finally { setCalcAnticipo(false) }
    }
    const t = setTimeout(calcular, 500)
    return () => clearTimeout(t)
  }, [
    opForm.es_foranea, opForm.tipo_suministro,
    opForm.tamano_proyecto, opForm.zona_pais, opForm.monto_estimado,
  ])

  const setOp = (k, v) => setOpForm(f => ({ ...f, [k]: v }))
  const setCli = (k, v) => setClienteForm(f => ({ ...f, [k]: v }))

  // ── Paso 1: seleccionar / crear cliente ──────────────────
  const paso1Valido = clienteSel != null || (
    nuevoCliente && clienteForm.nombre.trim().length > 2
  )

  // ── Paso 2: validar oportunidad ──────────────────────────
  const paso2Valido = opForm.nombre_proyecto.trim().length > 2

  // ── Guardar ──────────────────────────────────────────────
  const handleGuardar = async () => {
    setError(null)
    setSaving(true)
    try {
      let cliId = clienteSel?.id

      // Crear cliente si es nuevo
      if (nuevoCliente) {
        const { data: cli, error: eCli } = await crearCliente({
          ...clienteForm,
          company_id:         companyId,
          ejecutivo_asignado: userId,
        })
        if (eCli) throw eCli
        cliId = cli.id
      }

      // Crear oportunidad
      const { error: eOp } = await crearOportunidad({
        ...opForm,
        monto_estimado:          opForm.monto_estimado
                                   ? parseFloat(opForm.monto_estimado) : null,
        duracion_estimada_dias:  opForm.duracion_estimada_dias
                                   ? parseInt(opForm.duracion_estimada_dias) : null,
        pct_anticipo_sugerido:   anticipoData?.pct_anticipo ?? null,
        monto_anticipo_sugerido: anticipoData?.monto_anticipo ?? null,
        company_id:              companyId,
        ejecutivo_id:            userId,
        cliente_id:              cliId,
        estatus:                 'lead',
      })
      if (eOp) throw eOp

      toast.success('Oportunidad creada ✓')
      onSuccess()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 60, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%',
        maxWidth: 580, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FAFAFA', borderRadius: '16px 16px 0 0',
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
              Nueva oportunidad
            </h3>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
              Paso {paso} de 2 — {paso === 1 ? 'Cliente' : 'Datos de la oportunidad'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Indicador de pasos */}
            {[1, 2].map(p => (
              <div key={p} style={{
                width: p === paso ? 24 : 8, height: 8, borderRadius: 9999,
                background: p === paso ? '#2563EB' : p < paso ? '#10B981' : '#E5E7EB',
                transition: 'all 0.2s',
              }} />
            ))}
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid #E5E7EB', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', marginLeft: 4,
            }}>
              <X size={13} color="#6B7280" />
            </button>
          </div>
        </div>

        <div style={{ padding: '18px 20px' }}>

          {error && (
            <div style={{
              display: 'flex', gap: 7, padding: '9px 11px',
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 9, marginBottom: 14,
              fontSize: 12, color: '#DC2626',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* ── PASO 1: CLIENTE ── */}
          {paso === 1 && (
            <>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
                Selecciona un cliente existente o registra uno nuevo.
              </p>

              {/* Buscar cliente existente */}
              {!nuevoCliente && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    border: '1px solid #E5E7EB', borderRadius: 9,
                    padding: '7px 11px', marginBottom: 10, background: '#fff',
                  }}>
                    <Search size={13} color="#9CA3AF" />
                    <input
                      style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1 }}
                      placeholder="Buscar cliente por nombre..."
                      value={busqCliente}
                      onChange={e => setBusqCliente(e.target.value)}
                    />
                  </div>

                  <div style={{
                    border: '1px solid #E5E7EB', borderRadius: 9,
                    maxHeight: 200, overflowY: 'auto', marginBottom: 12,
                  }}>
                    {clientes.length === 0 ? (
                      <div style={{
                        padding: '16px', textAlign: 'center',
                        fontSize: 12, color: '#9CA3AF',
                      }}>
                        {busqCliente ? 'Sin resultados' : 'Escribe para buscar...'}
                      </div>
                    ) : (
                      clientes.map(c => (
                        <div
                          key={c.id}
                          onClick={() => setClienteSel(
                            clienteSel?.id === c.id ? null : c
                          )}
                          style={{
                            padding: '9px 12px',
                            borderBottom: '0.5px solid #F3F4F6',
                            cursor: 'pointer',
                            background: clienteSel?.id === c.id
                              ? '#EFF6FF' : '#fff',
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <p style={{
                              fontSize: 12, fontWeight: 600, margin: 0,
                              color: clienteSel?.id === c.id ? '#1E40AF' : '#111827',
                            }}>
                              {c.nombre}
                            </p>
                            <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                              {c.ciudad} {c.estado ? `· ${c.estado}` : ''}
                            </p>
                          </div>
                          {clienteSel?.id === c.id && (
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%',
                              background: '#2563EB',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <span style={{ color: '#fff', fontSize: 9 }}>✓</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => { setNuevoCliente(true); setClienteSel(null) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      width: '100%', padding: '8px 12px', borderRadius: 9,
                      border: '1px dashed #D1D5DB', background: '#FAFAFA',
                      color: '#6B7280', fontSize: 12, cursor: 'pointer',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={13} /> Registrar nuevo cliente
                  </button>
                </>
              )}

              {/* Formulario nuevo cliente */}
              {nuevoCliente && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    marginBottom: 14, padding: '7px 10px',
                    background: '#EFF6FF', borderRadius: 8,
                    fontSize: 11, color: '#1E40AF',
                  }}>
                    <User size={13} />
                    <span>Registrando nuevo cliente</span>
                    <button
                      onClick={() => setNuevoCliente(false)}
                      style={{
                        marginLeft: 'auto', fontSize: 10, color: '#6B7280',
                        border: 'none', background: 'none', cursor: 'pointer',
                      }}
                    >
                      ← Buscar existente
                    </button>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px',
                  }}>
                    <Field label="Nombre completo *">
                      <input style={inp} value={clienteForm.nombre}
                        onChange={e => setCli('nombre', e.target.value)}
                        placeholder="Ej: Juan García López" />
                    </Field>
                    <Field label="Empresa / Constructora" half>
                      <input style={inp} value={clienteForm.empresa}
                        onChange={e => setCli('empresa', e.target.value)}
                        placeholder="Razón social o nombre" />
                    </Field>
                    <Field label="Email" half>
                      <input style={inp} type="email" value={clienteForm.email}
                        onChange={e => setCli('email', e.target.value)}
                        placeholder="correo@empresa.com" />
                    </Field>
                    <Field label="Teléfono" half>
                      <input style={inp} value={clienteForm.telefono}
                        onChange={e => setCli('telefono', e.target.value)}
                        placeholder="+52 55 0000 0000" />
                    </Field>
                    <Field label="Ciudad" half>
                      <input style={inp} value={clienteForm.ciudad}
                        onChange={e => setCli('ciudad', e.target.value)} />
                    </Field>
                    <Field label="Estado" half>
                      <input style={inp} value={clienteForm.estado}
                        onChange={e => setCli('estado', e.target.value)} />
                    </Field>
                    <div style={{ gridColumn: 'span 2', marginBottom: 12 }}>
                      <label style={lbl}>¿Cómo llegó este cliente?</label>
                      <select style={sel}
                        value={clienteForm.origen_primer_contacto}
                        onChange={e => setCli('origen_primer_contacto', e.target.value)}>
                        {Object.entries(ORIGEN_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── PASO 2: OPORTUNIDAD ── */}
          {paso === 2 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px',
            }}>
              <div style={{ gridColumn: 'span 2', marginBottom: 12 }}>
                <label style={lbl}>Nombre del proyecto *</label>
                <input style={inp} value={opForm.nombre_proyecto}
                  onChange={e => setOp('nombre_proyecto', e.target.value)}
                  placeholder="Ej: Instalación eléctrica residencial Torre Palmas" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Tipo de obra</label>
                <select style={sel} value={opForm.tipo_obra}
                  onChange={e => setOp('tipo_obra', e.target.value)}>
                  {Object.entries(TIPO_OBRA_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Tipo de suministro</label>
                <select style={sel} value={opForm.tipo_suministro}
                  onChange={e => setOp('tipo_suministro', e.target.value)}>
                  {Object.entries(SUMINISTRO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Zona del país</label>
                <select style={sel} value={opForm.zona_pais}
                  onChange={e => setOp('zona_pais', e.target.value)}>
                  {Object.entries(ZONA_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Tamaño del proyecto</label>
                <select style={sel} value={opForm.tamano_proyecto}
                  onChange={e => setOp('tamano_proyecto', e.target.value)}>
                  <option value="pequeña">Pequeña (menos de $500k)</option>
                  <option value="mediana">Mediana ($500k – $2M)</option>
                  <option value="grande">Grande (más de $2M)</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Monto estimado (sin IVA)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    padding: '8px 10px', background: '#F3F4F6',
                    border: '1px solid #E5E7EB', borderRight: 'none',
                    borderRadius: '8px 0 0 8px', fontSize: 12, color: '#6B7280',
                  }}>$</span>
                  <input style={{ ...inp, borderRadius: '0 8px 8px 0', flex: 1 }}
                    type="number" min="0" step="1000"
                    value={opForm.monto_estimado}
                    onChange={e => setOp('monto_estimado', e.target.value)}
                    placeholder="0" />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Ciudad de la obra</label>
                <input style={inp} value={opForm.ciudad_obra}
                  onChange={e => setOp('ciudad_obra', e.target.value)} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Estado</label>
                <input style={inp} value={opForm.estado_obra}
                  onChange={e => setOp('estado_obra', e.target.value)} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Cierre estimado</label>
                <input style={inp} type="date"
                  value={opForm.fecha_estimada_cierre}
                  onChange={e => setOp('fecha_estimada_cierre', e.target.value)} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Duración estimada (días hábiles)</label>
                <input style={inp} type="number" min="1"
                  value={opForm.duracion_estimada_dias}
                  onChange={e => setOp('duracion_estimada_dias', e.target.value)}
                  placeholder="45" />
              </div>

              {/* ¿Obra foránea? */}
              <div style={{ gridColumn: 'span 2', marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={opForm.es_foranea}
                    onChange={e => setOp('es_foranea', e.target.checked)}
                    style={{ width: 14, height: 14 }} />
                  <span style={{ fontSize: 12, color: '#374151' }}>
                    Obra foránea (fuera de la zona metropolitana)
                  </span>
                </label>
              </div>

              {/* Anticipo calculado */}
              {anticipoData && (
                <div style={{
                  gridColumn: 'span 2',
                  padding: '12px 14px',
                  background: '#F0FDF4', borderRadius: 10,
                  border: '1px solid #A7F3D0', marginBottom: 12,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    marginBottom: 8,
                  }}>
                    <Zap size={14} color="#059669" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>
                      Anticipo sugerido calculado automáticamente
                    </span>
                    {calcAnticipo && (
                      <RefreshCw size={11} color="#059669"
                        style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />
                    )}
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                  }}>
                    <div style={{
                      padding: '8px 10px', background: '#fff',
                      borderRadius: 8, border: '1px solid #D1FAE5',
                      textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 2px' }}>
                        % Anticipo
                      </p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: '#059669', margin: 0 }}>
                        {anticipoData.pct_anticipo}%
                      </p>
                    </div>
                    <div style={{
                      padding: '8px 10px', background: '#fff',
                      borderRadius: 8, border: '1px solid #D1FAE5',
                      textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 2px' }}>
                        Monto anticipo
                      </p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#059669', margin: 0 }}>
                        ${Number(anticipoData.monto_anticipo)
                            .toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 8, fontSize: 10, color: '#6B7280',
                    display: 'flex', gap: 6, flexWrap: 'wrap',
                  }}>
                    {Object.values(anticipoData.explicacion ?? {}).map((ex, i) => (
                      <span key={i} style={{
                        padding: '1px 6px', background: '#E7F5EF',
                        borderRadius: 4, color: '#065F46',
                      }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ gridColumn: 'span 2', marginBottom: 4 }}>
                <label style={lbl}>Notas iniciales</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }}
                  value={opForm.descripcion}
                  onChange={e => setOp('descripcion', e.target.value)}
                  placeholder="Contexto del proyecto, condiciones especiales..." />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #F3F4F6',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          background: '#FAFAFA', borderRadius: '0 0 16px 16px',
          position: 'sticky', bottom: 0,
        }}>
          {paso === 2 && (
            <button onClick={() => setPaso(1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 16px', borderRadius: 9,
                border: '1px solid #E5E7EB', background: '#fff',
                color: '#374151', fontSize: 12, cursor: 'pointer',
              }}>
              <ChevronLeft size={13} /> Anterior
            </button>
          )}

          <button onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 9,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer',
            }}>
            Cancelar
          </button>

          {paso === 1 ? (
            <button
              onClick={() => setPaso(2)}
              disabled={!paso1Valido}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 18px', borderRadius: 9, border: 'none',
                background: paso1Valido ? '#2563EB' : '#BFDBFE',
                color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: paso1Valido ? 'pointer' : 'not-allowed',
              }}>
              Siguiente <ChevronRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleGuardar}
              disabled={saving || !paso2Valido}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 18px', borderRadius: 9, border: 'none',
                background: (saving || !paso2Valido) ? '#A7F3D0' : '#059669',
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: (saving || !paso2Valido) ? 'not-allowed' : 'pointer',
              }}>
              {saving
                ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                : <Save size={12} />}
              Crear oportunidad
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
