// ============================================================
//  OBRIX ERP — Contrato Inteligente
//  src/pages/comercial/ContratoPage.jsx  |  v1.0
//
//  Flujo:
//    1. Seleccionar oportunidad y cotización vinculada
//    2. Pre-llenar automáticamente datos del cliente y proyecto
//    3. Motor de anticipo calcula el % sugerido (4 reglas DINNOVAC)
//    4. Editar 5 variables negociables (V1-V5)
//    5. Vista previa del contrato completo
//    6. Guardar en BD + avanzar etapa a "contrato"
//    7. Generar PDF descargable
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { useToast }   from '../../hooks/useToast'
import { supabase }   from '../../config/supabase'
import {
  calcularAnticipo, crearContrato, getContrato,
  avanzarEtapa, fmtMXN,
  TIPO_OBRA_LABELS, SUMINISTRO_LABELS, ZONA_LABELS,
} from '../../services/comercial.service'
import {
  ArrowLeft, Save, FileText, RefreshCw,
  Zap, Eye, EyeOff, Shield, AlertCircle,
  ChevronDown, ChevronUp, CheckCircle,
  Lock, Edit2, Download,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// ESTILOS BASE
// ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '8px 10px', fontSize: 12,
  border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', color: '#111827', background: '#fff',
  boxSizing: 'border-box',
}
const lbl = {
  fontSize: 10, fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 4,
}
const txt = {
  ...inp,
  minHeight: 70, resize: 'vertical',
  fontFamily: 'inherit', lineHeight: 1.5,
}

// ─────────────────────────────────────────────────────────────
// PANEL DE ANTICIPO — Motor de cálculo DINNOVAC
// ─────────────────────────────────────────────────────────────
const PanelAnticipo = ({ datos, resultado, calculando, onAjustar }) => {
  const [pctManual, setPctManual] = useState(null)
  const pctFinal = pctManual ?? resultado?.pct_anticipo ?? 40

  useEffect(() => {
    if (resultado) onAjustar(pctFinal)
  }, [pctFinal, resultado])

  if (!resultado) return null

  const desglose = resultado.desglose ?? {}
  const explicacion = resultado.explicacion ?? {}

  return (
    <div style={{
      background: '#F0FDF4', border: '1px solid #A7F3D0',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: '#D1FAE5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={16} color="#059669" />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: 0 }}>
            Anticipo calculado automáticamente
          </p>
          <p style={{ fontSize: 10, color: '#6EE7B7', margin: 0 }}>
            Motor de reglas DINNOVAC — base 40% + ajustes
          </p>
        </div>
        {calculando && (
          <RefreshCw size={13} color="#059669"
            style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />
        )}
      </div>

      {/* Desglose de reglas */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 6, marginBottom: 12,
      }}>
        {[
          { label: 'Base mínima',    valor: desglose.base,           siempre: true },
          { label: 'Por ubicación',  valor: desglose.por_ubicacion,  regla: explicacion.ubicacion },
          { label: 'Por suministro', valor: desglose.por_suministro, regla: explicacion.suministro },
          { label: 'Por tamaño',     valor: desglose.por_tamano,     regla: explicacion.tamano },
          { label: 'Por zona',       valor: desglose.por_zona,       regla: explicacion.zona },
        ].map((r, i) => (
          <div key={i} style={{
            padding: '7px 9px', borderRadius: 8,
            background: r.valor > 0 ? '#fff' : '#F9FFF9',
            border: `0.5px solid ${r.valor > 0 ? '#A7F3D0' : '#D1FAE5'}`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 10, color: '#374151' }}>{r.label}</span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: r.valor > 0 ? '#059669' : '#9CA3AF',
              }}>
                +{r.valor ?? 0}%
              </span>
            </div>
            {r.regla && (
              <p style={{ fontSize: 9, color: '#6B7280', margin: '2px 0 0' }}>
                {r.regla}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Resultado */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        padding: '12px 14px', background: '#fff',
        borderRadius: 10, border: '1px solid #D1FAE5',
        marginBottom: 12,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 3px' }}>
            % Anticipo sugerido
          </p>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#059669', margin: 0 }}>
            {resultado.pct_anticipo}%
          </p>
          {resultado.pct_anticipo >= 60 && (
            <p style={{ fontSize: 9, color: '#B45309', margin: '2px 0 0' }}>
              Tope máximo 60%
            </p>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 3px' }}>
            Monto anticipo
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#059669', margin: 0 }}>
            {fmtMXN(resultado.monto_anticipo)}
          </p>
          <p style={{ fontSize: 9, color: '#9CA3AF', margin: '2px 0 0' }}>
            sin IVA
          </p>
        </div>
      </div>

      {/* Ajuste manual del % */}
      <div>
        <label style={lbl}>
          Ajustar % anticipo manualmente (rango 40%–60%)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range" min={40} max={60} step={1}
            value={pctFinal}
            onChange={e => setPctManual(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: '#059669' }}
          />
          <span style={{
            fontSize: 16, fontWeight: 700, color: '#059669',
            minWidth: 42, textAlign: 'right',
          }}>
            {pctFinal}%
          </span>
          {pctManual !== null && (
            <button
              onClick={() => setPctManual(null)}
              style={{ fontSize: 10, color: '#9CA3AF', border: 'none',
                background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Resetear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CLÁUSULA — VISTA
// ─────────────────────────────────────────────────────────────
const ClausulaItem = ({ num, titulo, contenido, negociable, modificada }) => {
  const [exp, setExp] = useState(false)
  return (
    <div style={{
      border: `1px solid ${modificada ? '#FDE68A' : negociable ? '#BFDBFE' : '#F3F4F6'}`,
      borderRadius: 9, overflow: 'hidden', marginBottom: 6,
    }}>
      <div
        onClick={() => setExp(!exp)}
        style={{
          padding: '9px 12px', cursor: 'pointer',
          background: modificada ? '#FFFBEB' : negociable ? '#EFF6FF' : '#FAFAFA',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {negociable
            ? <Edit2 size={11} color="#2563EB" />
            : <Lock size={11} color="#9CA3AF" />}
          <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>
            Cláusula {num}. {titulo}
          </span>
          {negociable && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 4,
              background: '#DBEAFE', color: '#1E40AF', fontWeight: 600,
            }}>
              Negociable
            </span>
          )}
          {modificada && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 4,
              background: '#FEF3C7', color: '#B45309', fontWeight: 600,
            }}>
              Modificada
            </span>
          )}
        </div>
        {exp ? <ChevronUp size={13} color="#9CA3AF" />
              : <ChevronDown size={13} color="#9CA3AF" />}
      </div>
      {exp && (
        <div style={{
          padding: '10px 14px', fontSize: 11, color: '#374151',
          lineHeight: 1.7, background: '#fff',
          borderTop: '0.5px solid #F3F4F6',
          whiteSpace: 'pre-wrap',
        }}>
          {contenido}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VISTA PREVIA DEL CONTRATO
// ─────────────────────────────────────────────────────────────
const VistaPrevia = ({ datos, clausulas, empresa }) => (
  <div style={{
    background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 12, padding: '24px 28px',
    fontFamily: 'Georgia, serif', fontSize: 12,
    lineHeight: 1.8, color: '#111827',
  }}>
    {/* Encabezado */}
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px' }}>
        {empresa?.razon_social || empresa?.name || 'DINNOVAC'}
      </p>
      {empresa?.rfc && (
        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 12px' }}>
          RFC: {empresa.rfc}
        </p>
      )}
      <h2 style={{
        fontSize: 14, fontWeight: 700, margin: '0 0 4px',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        Contrato de Prestación de Servicios
      </h2>
      <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
        {datos.folio || 'CONT-2025-XXXXX'} — {datos.fecha_contrato || new Date().toLocaleDateString('es-MX')}
      </p>
    </div>

    <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '0 0 20px' }} />

    {/* Partes */}
    <p style={{ marginBottom: 14 }}>
      <strong>CONTRATO</strong> que celebran, por una parte,{' '}
      <strong>{empresa?.razon_social || 'DINNOVAC S.A. DE C.V.'}</strong>{' '}
      (en adelante <strong>"EL PRESTADOR"</strong>), y por la otra parte,{' '}
      <strong>{datos.cliente_nombre || '[NOMBRE DEL CLIENTE]'}</strong>{' '}
      (en adelante <strong>"EL CLIENTE"</strong>), con base en las siguientes declaraciones y cláusulas:
    </p>

    {/* Variables principales */}
    <div style={{
      background: '#F9FAFB', borderRadius: 9, padding: '12px 16px',
      marginBottom: 18, border: '1px solid #E5E7EB',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 10px',
        textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151' }}>
        Objeto del contrato
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
        {[
          { l: 'Proyecto',       v: datos.nombre_proyecto },
          { l: 'Tipo de obra',   v: TIPO_OBRA_LABELS[datos.tipo_obra] ?? datos.tipo_obra },
          { l: 'Suministro',     v: SUMINISTRO_LABELS[datos.tipo_suministro] ?? '—' },
          { l: 'Monto total',    v: fmtMXN(datos.monto_total) },
          { l: 'Anticipo',       v: `${datos.pct_anticipo}% — ${fmtMXN(datos.monto_anticipo)}` },
          { l: 'Inicio estimado',v: datos.fecha_inicio_estimada || '—' },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 100 }}>{r.l}:</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{r.v || '—'}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Cláusulas */}
    {clausulas.map((c, i) => (
      <div key={i} style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>
          CLÁUSULA {c.numero || i + 1}. {c.titulo?.toUpperCase()}
        </p>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.contenido}</p>
      </div>
    ))}

    {/* Firmas */}
    <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '28px 0 20px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
      {['EL PRESTADOR', 'EL CLIENTE'].map(p => (
        <div key={p} style={{ textAlign: 'center' }}>
          <div style={{
            height: 40, borderBottom: '1px solid #111827', marginBottom: 6,
          }} />
          <p style={{ fontSize: 10, fontWeight: 700, margin: '0 0 2px',
            textTransform: 'uppercase' }}>{p}</p>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
            {p === 'EL PRESTADOR'
              ? (empresa?.representante_legal || empresa?.name || '')
              : (datos.cliente_nombre || '')}
          </p>
        </div>
      ))}
    </div>

    <p style={{
      fontSize: 9, color: '#9CA3AF', textAlign: 'center',
      marginTop: 20,
    }}>
      Documento generado por OBRIX ERP — {new Date().toLocaleString('es-MX')}
    </p>
  </div>
)

// ─────────────────────────────────────────────────────────────
// CLÁUSULAS BASE DEL CONTRATO DINNOVAC
// ─────────────────────────────────────────────────────────────
const clausulasBase = (vars = {}) => [
  {
    numero: 1,
    titulo: 'Objeto del contrato',
    negociable: false,
    contenido: `EL PRESTADOR se obliga a ejecutar los trabajos de instalación eléctrica y servicios relacionados descritos en la propuesta técnica y económica que forma parte integral del presente contrato, denominado en adelante "LA OBRA", en el inmueble ubicado en el proyecto "${vars.nombre_proyecto || '[PROYECTO]'}", con el alcance acordado entre las partes.`,
  },
  {
    numero: 2,
    titulo: 'Plazo de ejecución',
    negociable: true,
    contenido: vars.var1_valor ||
      'El plazo de ejecución de LA OBRA será de ____ días hábiles, contados a partir de la fecha en que EL CLIENTE entregue el anticipo pactado y el acceso al inmueble. Cualquier modificación al alcance podrá afectar el plazo y deberá acordarse por escrito.',
  },
  {
    numero: 3,
    titulo: 'Precio y condiciones de pago',
    negociable: true,
    contenido: vars.var2_valor ||
      `El monto total de LA OBRA es de ${fmtMXN(vars.monto_total) || '$0.00'} (sin IVA).\n\nForma de pago:\n• Anticipo: ${vars.pct_anticipo || 40}% del total — ${fmtMXN(vars.monto_anticipo) || '$0.00'} — a la firma del contrato.\n• Avance: 50% del total al alcanzar el 60% de avance verificado.\n• Finiquito: ${100 - (vars.pct_anticipo || 40) - 50}% restante a la recepción de LA OBRA.\n\nTodos los pagos se realizarán mediante transferencia bancaria a la cuenta que EL PRESTADOR indique.`,
  },
  {
    numero: 4,
    titulo: 'Alcance del suministro',
    negociable: true,
    contenido: vars.var3_valor ||
      'EL PRESTADOR suministrará la mano de obra especializada y los materiales descritos en la propuesta técnica. Quedan expresamente excluidos del alcance los trabajos de albañilería, pintura, resanes finos y cualquier actividad no especificada en la propuesta técnica aprobada.',
  },
  {
    numero: 5,
    titulo: 'Responsabilidad y garantía de obra',
    negociable: true,
    contenido: vars.var5_valor ||
      'EL PRESTADOR otorga una garantía de 12 (doce) meses sobre los trabajos ejecutados, contados a partir de la fecha de recepción formal de LA OBRA. La garantía cubre defectos de instalación y materiales suministrados por EL PRESTADOR. Quedan excluidos los daños por mal uso, modificaciones posteriores o causas de fuerza mayor.',
  },
  {
    numero: 6,
    titulo: 'Penalización por atraso en pagos',
    negociable: true,
    contenido: vars.var4_valor ||
      'En caso de que EL CLIENTE incumpla los pagos pactados en los plazos establecidos, EL PRESTADOR tendrá derecho a suspender los trabajos previa notificación por escrito con 48 horas de anticipación, sin que ello genere responsabilidad para EL PRESTADOR. La reanudación de trabajos estará sujeta a la regularización de pagos pendientes.',
  },
  {
    numero: 7,
    titulo: 'Modificaciones al alcance',
    negociable: false,
    contenido: 'Cualquier modificación, ampliación o reducción al alcance original de LA OBRA deberá acordarse mediante orden de cambio firmada por ambas partes, con el ajuste económico correspondiente. Las órdenes de cambio verbales no tendrán validez contractual.',
  },
  {
    numero: 8,
    titulo: 'Propiedad intelectual',
    negociable: false,
    contenido: 'Los planos, memorias descriptivas, cálculos y demás documentación técnica elaborada por EL PRESTADOR para LA OBRA son propiedad intelectual de EL PRESTADOR. EL CLIENTE recibe una licencia de uso para el inmueble específico objeto de este contrato.',
  },
  {
    numero: 9,
    titulo: 'Rescisión del contrato',
    negociable: false,
    contenido: 'Cualquiera de las partes podrá rescindir el presente contrato por incumplimiento de la otra parte, previa notificación escrita con 15 días de anticipación. En caso de rescisión imputable a EL CLIENTE, los anticipos entregados no serán reembolsables y EL PRESTADOR tendrá derecho al pago proporcional del avance ejecutado. En caso de rescisión imputable a EL PRESTADOR, deberá reintegrar los anticipos proporcionales al trabajo no ejecutado.',
  },
  {
    numero: 10,
    titulo: 'Jurisdicción',
    negociable: false,
    contenido: 'Para la interpretación y cumplimiento del presente contrato, las partes se someten expresamente a las leyes aplicables y a los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.',
  },
]

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ContratoPage() {
  const { id }         = useParams()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { toast }      = useToast()

  const opId   = searchParams.get('oportunidad')
  const cotId  = searchParams.get('cotizacion')
  const isEdit = !!id

  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [companyId,  setCompanyId]  = useState(null)
  const [userId,     setUserId]     = useState(null)
  const [empresa,    setEmpresa]    = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(false)
  const [anticipoRes, setAnticipoRes] = useState(null)
  const [calcAnticipo, setCalcAnticipo] = useState(false)

  // Oportunidad y cotización vinculadas
  const [oportunidad, setOportunidad] = useState(null)
  const [cotizacion,  setCotizacion]  = useState(null)

  // Datos del contrato
  const [form, setForm] = useState({
    nombre_proyecto:       '',
    tipo_obra:             'comercial',
    tipo_suministro:       'mo_materiales',
    zona_pais:             'zona_a',
    es_foranea:            false,
    tamano_proyecto:       'mediana',
    monto_total:           '',
    fecha_contrato:        new Date().toISOString().split('T')[0],
    fecha_inicio_estimada: '',
    fecha_fin_estimada:    '',
    cliente_nombre:        '',
    // Variables V1-V5
    var1_valor: '',  // Plazo de ejecución
    var2_valor: '',  // Condiciones de pago
    var3_valor: '',  // Alcance del suministro
    var4_valor: '',  // Penalización por atraso
    var5_valor: '',  // Garantía de obra
    // Anticipo
    pct_anticipo:   40,
    monto_anticipo: 0,
    oportunidad_id: opId || '',
    cotizacion_id:  cotId || '',
    cliente_id:     '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Cargar usuario y empresa ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase.from('users_profiles')
        .select('company_id').eq('id', u.id).single()
        .then(({ data }) => {
          setCompanyId(data?.company_id)
          setUserId(u.id)
          // Cargar datos de la empresa para el encabezado del contrato
          supabase.from('companies')
            .select('name, id')
            .eq('id', data?.company_id).single()
            .then(({ data: co }) => {
              supabase.from('company_settings')
                .select('rfc, razon_social, domicilio_fiscal, representante_legal, logo_url')
                .eq('company_id', data?.company_id).single()
                .then(({ data: cs }) => {
                  setEmpresa({ ...co, ...cs })
                })
            })
        })
    })
  }, [])

  // ── Cargar oportunidad y cotización ──
  useEffect(() => {
    const cargar = async () => {
      if (!companyId) return
      setLoading(true)
      try {
        if (isEdit) {
          const { data: cont } = await getContrato(id)
          if (cont) {
            setForm({
              nombre_proyecto:       cont.nombre_proyecto,
              tipo_obra:             cont.tipo_obra,
              tipo_suministro:       cont.tipo_suministro,
              monto_total:           cont.monto_total,
              fecha_contrato:        cont.fecha_contrato,
              fecha_inicio_estimada: cont.fecha_inicio_estimada || '',
              fecha_fin_estimada:    cont.fecha_fin_estimada || '',
              var1_valor: cont.var1_valor || '',
              var2_valor: cont.var2_valor || '',
              var3_valor: cont.var3_valor || '',
              var4_valor: cont.var4_valor || '',
              var5_valor: cont.var5_valor || '',
              pct_anticipo:   cont.pct_anticipo,
              monto_anticipo: cont.monto_anticipo,
              oportunidad_id: cont.oportunidad_id,
              cotizacion_id:  cont.cotizacion_id || '',
              cliente_id:     cont.cliente_id,
              cliente_nombre: cont.cliente?.nombre || '',
              zona_pais:      'zona_a',
              es_foranea:     false,
              tamano_proyecto: 'mediana',
            })
          }
        } else if (opId) {
          const { data: op } = await supabase
            .from('oportunidades')
            .select(`
              *, cliente:cliente_id(id, nombre, rfc, email, telefono),
              cotizaciones(id, folio, total, estatus)
            `)
            .eq('id', opId).single()

          if (op) {
            setOportunidad(op)
            const cotAceptada = op.cotizaciones?.find(
              c => c.estatus === 'aceptada' || c.estatus === 'enviada'
            ) || op.cotizaciones?.[0]
            setCotizacion(cotAceptada)

            setForm(f => ({
              ...f,
              nombre_proyecto:  op.nombre_proyecto,
              tipo_obra:        op.tipo_obra,
              tipo_suministro:  op.tipo_suministro,
              zona_pais:        op.zona_pais,
              es_foranea:       op.es_foranea,
              tamano_proyecto:  op.tamano_proyecto,
              monto_total:      cotAceptada?.total || op.monto_cotizado || op.monto_estimado || '',
              oportunidad_id:   op.id,
              cotizacion_id:    cotAceptada?.id || '',
              cliente_id:       op.cliente_id,
              cliente_nombre:   op.cliente?.nombre || '',
            }))
          }
        }
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [companyId, id, opId, isEdit])

  // ── Calcular anticipo cuando cambian los parámetros ──
  const calcular = useCallback(async () => {
    if (!form.monto_total || parseFloat(form.monto_total) <= 0) return
    setCalcAnticipo(true)
    try {
      const { data } = await calcularAnticipo(
        form.es_foranea,
        form.tipo_suministro,
        form.tamano_proyecto,
        form.zona_pais,
        parseFloat(form.monto_total),
      )
      setAnticipoRes(data)
      if (data) {
        set('pct_anticipo',   data.pct_anticipo)
        set('monto_anticipo', data.monto_anticipo)
      }
    } finally {
      setCalcAnticipo(false)
    }
  }, [form.monto_total, form.es_foranea, form.tipo_suministro,
      form.tamano_proyecto, form.zona_pais])

  useEffect(() => {
    const t = setTimeout(calcular, 600)
    return () => clearTimeout(t)
  }, [calcular])

  // ── Cláusulas del contrato con variables reemplazadas ──
  const clausulas = clausulasBase({
    ...form,
    monto_total:    parseFloat(form.monto_total) || 0,
    monto_anticipo: form.monto_anticipo,
  })

  // Marcar cuáles tienen valor personalizado
  const clausulasConEstado = clausulas.map((c, i) => ({
    ...c,
    modificada: c.negociable && !!form[`var${i < 5 ? i + 1 : i}`],
  }))

  // ── Guardar contrato ──
  const handleGuardar = async (estatus = 'borrador') => {
    if (!form.nombre_proyecto.trim()) {
      toast.error('El nombre del proyecto es obligatorio')
      return
    }
    if (!form.monto_total || parseFloat(form.monto_total) <= 0) {
      toast.error('El monto total es obligatorio')
      return
    }
    setSaving(true)
    try {
      const monto = parseFloat(form.monto_total)
      const iva   = monto * 0.16
      const payload = {
        ...form,
        company_id:      companyId,
        elaborado_por:   userId,
        monto_total:     monto,
        monto_iva:       iva,
        monto_con_iva:   monto + iva,
        monto_anticipo:  form.monto_anticipo,
        monto_anticipo_iva: form.monto_anticipo * 0.16,
        estatus,
      }

      let contId = id
      if (isEdit) {
        await supabase.from('contratos_comerciales')
          .update(payload).eq('id', id)
      } else {
        const { data: cont, error } = await crearContrato(payload)
        if (error) throw error
        contId = cont.id

        // Guardar cláusulas
        await supabase.from('contratos_clausulas').insert(
          clausulas.map((c, i) => ({
            contrato_id:  contId,
            company_id:   companyId,
            numero:       c.numero,
            titulo:       c.titulo,
            contenido:    c.contenido,
            es_negociable: c.negociable,
            es_modificada: !!form[`var${i + 1}_valor`],
            orden:         i + 1,
          }))
        )

        // Avanzar etapa de la oportunidad a "contrato"
        if (form.oportunidad_id) {
          await avanzarEtapa(
            form.oportunidad_id, 'contrato', userId,
            `Contrato ${cont.folio} generado — monto ${fmtMXN(monto)}`
          )
        }
      }

      toast.success(estatus === 'enviado_cliente'
        ? 'Contrato enviado al cliente ✓'
        : 'Contrato guardado ✓')

      if (!isEdit && contId) {
        navigate(`/comercial/contrato/${contId}`)
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Generar PDF ──
  const handlePDF = async () => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    document.head.appendChild(script)
    await new Promise((res, rej) => { script.onload = res; script.onerror = rej })

    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const margin = 20
    const ancho  = 210 - margin * 2
    let y = margin

    const addText = (text, size = 10, bold = false, center = false) => {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, ancho)
      lines.forEach(line => {
        if (y > 260) { doc.addPage(); y = margin }
        doc.text(line, center ? 105 : margin, y, center ? { align: 'center' } : {})
        y += size * 0.5
      })
      y += 2
    }

    // Encabezado
    addText(empresa?.razon_social || 'DINNOVAC', 11, true, true)
    if (empresa?.rfc) addText('RFC: ' + empresa.rfc, 9, false, true)
    y += 4
    addText('CONTRATO DE PRESTACIÓN DE SERVICIOS', 13, true, true)
    addText(form.folio || `CONT-${new Date().getFullYear()}`, 9, false, true)
    y += 6

    // Cláusulas
    clausulas.forEach(c => {
      addText(`CLÁUSULA ${c.numero}. ${c.titulo.toUpperCase()}`, 10, true)
      addText(c.contenido, 9)
      y += 4
    })

    // Firmas
    y += 10
    if (y > 220) { doc.addPage(); y = 30 }
    doc.line(margin, y, margin + 60, y)
    doc.line(210 - margin - 60, y, 210 - margin, y)
    addText('EL PRESTADOR', 9, true)
    addText('EL CLIENTE', 9, true)

    doc.save(`Contrato-${form.nombre_proyecto || 'OBRIX'}.pdf`)
    toast.success('PDF generado ✓')
  }

  if (loading) {
    return (
      <MainLayout title="📝 Contrato">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <RefreshCw size={22} color="#9CA3AF"
            style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </MainLayout>
    )
  }

  const VARS = [
    { key: 'var1_valor', label: 'V1 — Plazo de ejecución',
      placeholder: 'Ej: 45 días hábiles a partir del anticipo...' },
    { key: 'var2_valor', label: 'V2 — Condiciones de pago',
      placeholder: 'Ej: 40% anticipo, 50% a 60% de avance, 10% finiquito...' },
    { key: 'var3_valor', label: 'V3 — Alcance del suministro',
      placeholder: 'Ej: M.O. + materiales eléctricos. Excluye albañilería...' },
    { key: 'var4_valor', label: 'V4 — Penalización por atraso en pagos',
      placeholder: 'Ej: Suspensión de obra con 48h de aviso...' },
    { key: 'var5_valor', label: 'V5 — Garantía de obra',
      placeholder: 'Ej: 12 meses sobre instalación ejecutada...' },
  ]

  return (
    <MainLayout title={isEdit ? '📝 Editar Contrato' : '📝 Nuevo Contrato'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            <ArrowLeft size={13} /> Regresar
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setVistaPrevia(!vistaPrevia)}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 13px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            {vistaPrevia ? <EyeOff size={13} /> : <Eye size={13} />}
            {vistaPrevia ? 'Ocultar vista previa' : 'Vista previa'}
          </button>
          <button onClick={handlePDF}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 13px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            <Download size={13} /> Descargar PDF
          </button>
          <button
            onClick={() => handleGuardar('borrador')}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#fff',
              color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            <Save size={13} />
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            onClick={() => handleGuardar('enviado_cliente')}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: saving ? '#93C5FD' : '#2563EB',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer' }}>
            <FileText size={13} />
            Enviar al cliente
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* ── Columna izquierda: editor ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Datos del proyecto */}
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                margin: '0 0 12px', textTransform: 'uppercase',
                letterSpacing: '0.05em' }}>
                Datos del contrato
              </p>

              {oportunidad && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: '#EFF6FF', borderRadius: 8,
                  marginBottom: 12, fontSize: 11, color: '#1E40AF',
                }}>
                  <FileText size={13} />
                  <span>
                    Oportunidad <strong>{oportunidad.folio}</strong>
                    {cotizacion && <> · Cotización <strong>{cotizacion.folio}</strong></>}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Nombre del proyecto *</label>
                  <input style={inp} value={form.nombre_proyecto}
                    onChange={e => set('nombre_proyecto', e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Cliente</label>
                  <input style={{ ...inp, background: '#F9FAFB' }}
                    value={form.cliente_nombre} readOnly />
                </div>
                <div>
                  <label style={lbl}>Monto total (sin IVA) *</label>
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      padding: '8px 9px', background: '#F3F4F6',
                      border: '1px solid #E5E7EB', borderRight: 'none',
                      borderRadius: '8px 0 0 8px', fontSize: 12, color: '#6B7280',
                    }}>$</span>
                    <input style={{ ...inp, borderRadius: '0 8px 8px 0', flex: 1 }}
                      type="number" min={0}
                      value={form.monto_total}
                      onChange={e => set('monto_total', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Fecha del contrato</label>
                  <input style={inp} type="date"
                    value={form.fecha_contrato}
                    onChange={e => set('fecha_contrato', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Inicio estimado</label>
                  <input style={inp} type="date"
                    value={form.fecha_inicio_estimada}
                    onChange={e => set('fecha_inicio_estimada', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Fin estimado</label>
                  <input style={inp} type="date"
                    value={form.fecha_fin_estimada}
                    onChange={e => set('fecha_fin_estimada', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Tipo de suministro</label>
                  <select style={{ ...inp, cursor: 'pointer' }}
                    value={form.tipo_suministro}
                    onChange={e => set('tipo_suministro', e.target.value)}>
                    {Object.entries(SUMINISTRO_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Zona del país</label>
                  <select style={{ ...inp, cursor: 'pointer' }}
                    value={form.zona_pais}
                    onChange={e => set('zona_pais', e.target.value)}>
                    {Object.entries(ZONA_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Tamaño del proyecto</label>
                  <select style={{ ...inp, cursor: 'pointer' }}
                    value={form.tamano_proyecto}
                    onChange={e => set('tamano_proyecto', e.target.value)}>
                    <option value="pequeña">Pequeña (&lt;$500k)</option>
                    <option value="mediana">Mediana ($500k–$2M)</option>
                    <option value="grande">Grande (&gt;$2M)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox"
                    checked={form.es_foranea}
                    onChange={e => set('es_foranea', e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: '#2563EB' }} />
                  <label style={{ fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                    Obra foránea
                  </label>
                </div>
              </div>
            </div>

            {/* Motor de anticipo */}
            <PanelAnticipo
              datos={form}
              resultado={anticipoRes}
              calculando={calcAnticipo}
              onAjustar={(pct) => {
                set('pct_anticipo', pct)
                const monto = parseFloat(form.monto_total) || 0
                set('monto_anticipo', Math.round(monto * pct / 100 * 100) / 100)
              }}
            />

            {/* Variables negociables V1–V5 */}
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              }}>
                <Edit2 size={14} color="#2563EB" />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                  margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Variables negociables del contrato
                </p>
              </div>
              <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 12px' }}>
                Si dejas un campo vacío se usará el texto estándar de DINNOVAC.
                Si lo llenas, reemplaza exactamente esa cláusula.
              </p>
              {VARS.map(v => (
                <div key={v.key} style={{ marginBottom: 12 }}>
                  <label style={lbl}>{v.label}</label>
                  <textarea
                    style={txt}
                    placeholder={v.placeholder}
                    value={form[v.key]}
                    onChange={e => set(v.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Cláusulas no negociables */}
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              }}>
                <Shield size={14} color="#6B7280" />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151',
                  margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cláusulas del contrato
                </p>
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 4,
                  background: '#F3F4F6', color: '#6B7280',
                }}>
                  {clausulas.filter(c => !c.negociable).length} fijas ·{' '}
                  {clausulas.filter(c => c.negociable).length} negociables
                </span>
              </div>
              {clausulasConEstado.map((c, i) => (
                <ClausulaItem key={i} {...c} />
              ))}
            </div>
          </div>

          {/* ── Columna derecha: vista previa ── */}
          <div>
            <div style={{
              position: 'sticky', top: 16,
            }}>
              {vistaPrevia ? (
                <VistaPrevia
                  datos={{
                    ...form,
                    monto_total:    parseFloat(form.monto_total) || 0,
                    monto_anticipo: form.monto_anticipo,
                  }}
                  clausulas={clausulasConEstado}
                  empresa={empresa}
                />
              ) : (
                <div style={{
                  background: '#F9FAFB', border: '2px dashed #E5E7EB',
                  borderRadius: 12, padding: '40px 20px', textAlign: 'center',
                }}>
                  <Eye size={28} color="#D1D5DB"
                    style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', margin: '0 0 6px' }}>
                    Vista previa del contrato
                  </p>
                  <p style={{ fontSize: 11, color: '#D1D5DB', margin: '0 0 16px' }}>
                    Haz clic en "Vista previa" para ver el contrato completo con tus datos
                  </p>
                  <button
                    onClick={() => setVistaPrevia(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8,
                      border: '1px solid #E5E7EB', background: '#fff',
                      color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                    <Eye size={13} /> Activar vista previa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  )
}
