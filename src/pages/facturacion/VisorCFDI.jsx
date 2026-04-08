// ============================================================
//  OBRIX — Visor de CFDI (Detalle + Timbrado + PDF)
//  src/pages/facturacion/VisorCFDI.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { supabase } from '../../config/supabase'
import {
  Download, Send, XCircle, CheckCircle, AlertCircle,
  Clock, RefreshCw, FileText, Copy, ExternalLink,
  Building2, User, ChevronLeft, Zap
} from 'lucide-react'

const fmt = (n) => Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDt = (d) => d ? new Date(d).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : '—'
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—'

const TIPO_LABEL = { I:'Factura de Ingreso', E:'Nota de Crédito', P:'Complemento de Pago' }
const ESTATUS_CFG = {
  borrador:   { label:'Borrador', icon:Clock, color:'var(--color-text-tertiary)', bg:'var(--color-background-secondary)' },
  por_timbrar:{ label:'Procesando', icon:RefreshCw, color:'var(--color-text-warning)', bg:'var(--color-background-warning)' },
  timbrado:   { label:'Timbrado ✓', icon:CheckCircle, color:'var(--color-text-success)', bg:'var(--color-background-success)' },
  cancelado:  { label:'Cancelado', icon:XCircle, color:'var(--color-text-danger)', bg:'var(--color-background-danger)' },
  error:      { label:'Error PAC', icon:AlertCircle, color:'var(--color-text-danger)', bg:'var(--color-background-danger)' },
}
const C = { borde:'var(--color-border-tertiary)' }
const cardStyle = { background:'var(--color-background-primary)', border:`0.5px solid ${C.borde}`, borderRadius:'var(--border-radius-lg)', padding:'16px 18px', marginBottom:12 }
const labelStyle = { fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', display:'block', marginBottom:3 }

export default function VisorCFDI() {
  const { id } = useParams()
  const nav    = useNavigate()
  const [cfdi, setCfdi]         = useState(null)
  const [conceptos, setConceptos] = useState([])
  const [impuestos, setImpuestos] = useState([])
  const [log, setLog]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [timbrando, setTimbrando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError]       = useState('')
  const [copiado, setCopiado]   = useState('')
  const [userId, setUserId]     = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user } }) => user && setUserId(user.id))
    cargar()
  }, [id])

  const cargar = async () => {
    setLoading(true)
    const [{ data: c }, { data: conceptosD }, { data: impD }, { data: logD }] = await Promise.all([
      supabase.from('cfdi_documentos').select('*').eq('id', id).single(),
      supabase.from('cfdi_conceptos').select('*').eq('cfdi_id', id).order('orden'),
      supabase.from('cfdi_impuestos').select('*').eq('cfdi_id', id),
      supabase.from('cfdi_log').select('*').eq('cfdi_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    setCfdi(c)
    setConceptos(conceptosD || [])
    setImpuestos(impD || [])
    setLog(logD || [])
    setLoading(false)
  }

  const copiar = (texto, campo) => {
    navigator.clipboard.writeText(texto)
    setCopiado(campo)
    setTimeout(() => setCopiado(''), 2000)
  }

  const timbrar = async () => {
    if (!cfdi) return
    setTimbrando(true); setError('')
    try {
      // Construir cfdi_input para la Edge Function
      const cfdi_input = {
        tipo:            cfdi.tipo_comprobante,
        serie:           cfdi.serie,
        folio:           cfdi.folio,
        fecha:           new Date().toISOString().slice(0,19),
        lugarExpedicion: cfdi.lugar_expedicion,
        metodoPago:      cfdi.metodo_pago,
        formaPago:       cfdi.forma_pago,
        moneda:          cfdi.moneda || 'MXN',
        emisor: {
          rfc:           cfdi.emisor_rfc,
          nombre:        cfdi.emisor_nombre,
          regimenFiscal: cfdi.emisor_regimen,
        },
        receptor: {
          rfc:             cfdi.receptor_rfc,
          nombre:          cfdi.receptor_nombre,
          usoCfdi:         cfdi.receptor_uso_cfdi,
          regimenFiscal:   cfdi.receptor_regimen_fiscal || '601',
          domicilioFiscal: cfdi.receptor_domicilio_cp || cfdi.receptor_domicilio_fiscal || '',
        },
        conceptos: conceptos.map(c => {
          const imp = impuestos.filter(i => i.cfdi_concepto_id === c.id)
          return {
            claveProdServ:    c.clave_prod_serv || '72154001',
            cantidad:         Number(c.cantidad),
            claveUnidad:      c.clave_unidad || 'E48',
            unidad:           c.unidad,
            descripcion:      c.descripcion,
            valorUnitario:    Number(c.valor_unitario),
            importe:          Number(c.importe),
            descuento:        Number(c.descuento || 0),
            objetoImp:        c.objeto_imp || '02',
            impuestos: imp.length ? {
              traslados: imp.filter(i => i.tipo === 'traslado').map(i => ({
                base:       Number(i.base_impuesto),
                impuesto:   i.impuesto,
                tipoFactor: i.tipo_factor,
                tasaOCuota: Number(i.tasa_cuota),
                importe:    Number(i.importe_impuesto),
              }))
            } : undefined,
          }
        })
      }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('timbrar-cfdi', {
        body: { cfdi_id: id, cfdi_input },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (res.error || !res.data?.ok) {
        throw new Error(res.data?.error || res.error?.message || 'Error al timbrar')
      }
      await cargar()
    } catch (e) {
      setError(`Error: ${e.message}`)
    } finally {
      setTimbrando(false)
    }
  }

  const enviarEmail = async () => {
    if (!cfdi?.tercero_id) return
    // Obtener email del tercero
    const { data: tercero } = await supabase.from('terceros').select('email').eq('id', cfdi.tercero_id).single()
    if (!tercero?.email) { setError('El cliente no tiene email registrado'); return }

    await supabase.from('cfdi_documentos').update({ enviado_email: true, enviado_at: new Date().toISOString(), enviado_a: tercero.email }).eq('id', id)
    await cargar()
    alert(`XML y PDF enviados a ${tercero.email}`)
  }

  if (loading) return (
    <MainLayout title="Cargando factura...">
      <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
        <div style={{ width:32,height:32,border:'2px solid var(--color-border-secondary)',borderTopColor:'var(--color-text-primary)',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  )

  if (!cfdi) return <MainLayout title="No encontrado"><p style={{ color:'var(--color-text-secondary)', padding:20 }}>CFDI no encontrado</p></MainLayout>

  const est = ESTATUS_CFG[cfdi.estatus_emision] || ESTATUS_CFG.borrador
  const EstIcon = est.icon
  const esBorrador = cfdi.estatus_emision === 'borrador' || cfdi.estatus_emision === 'error'
  const esTimbrado = cfdi.estatus_emision === 'timbrado'

  return (
    <MainLayout title={`${TIPO_LABEL[cfdi.tipo_comprobante] || 'Documento'} ${cfdi.serie || ''}${cfdi.folio || ''}`}>
      <div style={{ maxWidth:880 }}>

        {/* Header estatus */}
        <div style={{ ...cardStyle, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => nav('/facturacion')} style={{ padding:'5px 8px', cursor:'pointer', borderRadius:'var(--border-radius-md)', display:'flex' }}>
              <ChevronLeft size={15}/>
            </button>
            <div>
              <p style={{ fontSize:14, fontWeight:500, margin:'0 0 3px' }}>
                {TIPO_LABEL[cfdi.tipo_comprobante]} · {cfdi.serie}{cfdi.folio}
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:est.bg, color:est.color, fontWeight:500, display:'inline-flex', alignItems:'center', gap:4 }}>
                  <EstIcon size={10}/>{est.label}
                </span>
                {cfdi.pac_proveedor && (
                  <span style={{ fontSize:10, color:'var(--color-text-tertiary)', fontFamily:'monospace' }}>
                    PAC: {cfdi.pac_proveedor.replace('_',' ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display:'flex', gap:8 }}>
            {esBorrador && (
              <button onClick={timbrar} disabled={timbrando}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', fontSize:12, fontWeight:500, cursor:'pointer',
                  background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none', borderRadius:'var(--border-radius-md)' }}>
                <Zap size={13}/>{timbrando ? 'Timbrando...' : 'Timbrar CFDI'}
              </button>
            )}
            {esTimbrado && (
              <>
                {cfdi.xml_url && (
                  <a href={cfdi.xml_url} download target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', fontSize:12, cursor:'pointer', borderRadius:'var(--border-radius-md)', textDecoration:'none', border:`0.5px solid ${C.borde}`, color:'var(--color-text-primary)' }}>
                    <Download size={13}/> XML
                  </a>
                )}
                {cfdi.pdf_url && (
                  <a href={cfdi.pdf_url} download target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', fontSize:12, cursor:'pointer', borderRadius:'var(--border-radius-md)', textDecoration:'none', border:`0.5px solid ${C.borde}`, color:'var(--color-text-primary)' }}>
                    <Download size={13}/> PDF
                  </a>
                )}
                <button onClick={enviarEmail}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', fontSize:12, cursor:'pointer', borderRadius:'var(--border-radius-md)', border:`0.5px solid ${C.borde}` }}>
                  <Send size={13}/> {cfdi.enviado_email ? 'Reenviar' : 'Enviar al cliente'}
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div style={{ ...cardStyle, background:'var(--color-background-danger)', border:`0.5px solid var(--color-border-danger)`, display:'flex', gap:8 }}>
            <AlertCircle size={14} style={{ color:'var(--color-text-danger)', flexShrink:0 }}/>
            <p style={{ fontSize:12, color:'var(--color-text-danger)', margin:0 }}>{error}</p>
          </div>
        )}

        {/* UUID (si está timbrado) */}
        {esTimbrado && cfdi.uuid_cfdi && (
          <div style={{ ...cardStyle, background:'var(--color-background-success)' }}>
            <p style={{ fontSize:11, fontWeight:500, color:'var(--color-text-success)', margin:'0 0 6px' }}>UUID de Timbrado</p>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <code style={{ fontSize:12, fontFamily:'monospace', color:'var(--color-text-success)', flex:1, wordBreak:'break-all' }}>{cfdi.uuid_cfdi}</code>
              <button onClick={() => copiar(cfdi.uuid_cfdi, 'uuid')}
                style={{ padding:'4px 8px', borderRadius:'var(--border-radius-md)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <Copy size={11}/>{copiado === 'uuid' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p style={{ fontSize:10, color:'var(--color-text-success)', margin:'6px 0 0' }}>
              Timbrado: {fmtDt(cfdi.tfd_fecha_timbrado)}
              {cfdi.enviado_email && ` · Enviado a ${cfdi.enviado_a} el ${fmtDt(cfdi.enviado_at)}`}
            </p>
          </div>
        )}

        {/* Emisor / Receptor */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <Building2 size={13} style={{ color:'var(--color-text-tertiary)' }}/>
              <p style={{ fontSize:12, fontWeight:500, margin:0 }}>Emisor</p>
            </div>
            {[
              { label:'RFC', valor: cfdi.emisor_rfc },
              { label:'Razón Social', valor: cfdi.emisor_nombre },
              { label:'Régimen Fiscal', valor: cfdi.emisor_regimen },
              { label:'CP Fiscal', valor: cfdi.lugar_expedicion },
            ].map(({ label, valor }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`0.5px solid ${C.borde}` }}>
                <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{label}</span>
                <span style={{ fontSize:11, fontWeight:500, color:'var(--color-text-primary)' }}>{valor || '—'}</span>
              </div>
            ))}
          </div>
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <User size={13} style={{ color:'var(--color-text-tertiary)' }}/>
              <p style={{ fontSize:12, fontWeight:500, margin:0 }}>Receptor</p>
            </div>
            {[
              { label:'RFC', valor: cfdi.receptor_rfc },
              { label:'Nombre', valor: cfdi.receptor_nombre },
              { label:'Uso CFDI', valor: cfdi.receptor_uso_cfdi },
              { label:'CP Fiscal', valor: cfdi.receptor_domicilio_cp || cfdi.receptor_domicilio_fiscal },
            ].map(({ label, valor }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`0.5px solid ${C.borde}` }}>
                <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{label}</span>
                <span style={{ fontSize:11, fontWeight:500, color:'var(--color-text-primary)' }}>{valor || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conceptos */}
        <div style={cardStyle}>
          <p style={{ fontSize:12, fontWeight:500, margin:'0 0 12px' }}>Conceptos</p>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ background:'var(--color-background-secondary)', borderBottom:`1px solid ${C.borde}` }}>
                {['#','Clave SAT','Descripción','Cant.','Precio unit.','Importe'].map(h => (
                  <th key={h} style={{ padding:'8px 10px', textAlign: h==='Cant.'||h==='Precio unit.'||h==='Importe' ? 'right':'left', fontWeight:500, color:'var(--color-text-tertiary)', fontSize:10, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conceptos.map((c, i) => (
                <tr key={c.id} style={{ borderBottom:`0.5px solid ${C.borde}`, background: i%2===0 ? 'transparent':'var(--color-background-secondary)' }}>
                  <td style={{ padding:'8px 10px', color:'var(--color-text-tertiary)' }}>{i+1}</td>
                  <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:10, color:'var(--color-text-info)' }}>{c.clave_prod_serv}</td>
                  <td style={{ padding:'8px 10px', color:'var(--color-text-primary)' }}>{c.descripcion}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right' }}>{c.cantidad}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right' }}>${fmt(c.valor_unitario)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:500 }}>${fmt(c.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div style={{ marginTop:12, display:'flex', justifyContent:'flex-end' }}>
            <div style={{ minWidth:220 }}>
              {[
                { label:'Subtotal', valor: cfdi.subtotal },
                { label:'IVA', valor: cfdi.total_impuestos_tras },
                { label:'Retenciones', valor: cfdi.total_impuestos_ret },
              ].map(({ label, valor }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:`0.5px solid ${C.borde}` }}>
                  <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>{label}</span>
                  <span style={{ fontSize:11, fontWeight:500 }}>${fmt(valor)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', marginTop:4 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>Total</span>
                <span style={{ fontSize:16, fontWeight:500, color:'var(--color-text-info)' }}>${fmt(cfdi.total)} MXN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Datos de timbrado */}
        {esTimbrado && (
          <div style={cardStyle}>
            <p style={{ fontSize:12, fontWeight:500, margin:'0 0 10px' }}>Datos del Timbre Fiscal Digital</p>
            {[
              { label:'No. Certificado SAT', valor: cfdi.tfd_no_certificado_sat },
              { label:'Fecha Timbrado', valor: fmtDt(cfdi.tfd_fecha_timbrado) },
              { label:'Sello SAT (primeros 40 chars)', valor: cfdi.tfd_sello_sat?.slice(0,40) + '...' },
            ].map(({ label, valor }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`0.5px solid ${C.borde}` }}>
                <span style={{ fontSize:11, color:'var(--color-text-tertiary)', flexShrink:0 }}>{label}</span>
                <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--color-text-primary)', textAlign:'right', wordBreak:'break-all' }}>{valor || '—'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Log de intentos */}
        {log.length > 0 && (
          <div style={cardStyle}>
            <p style={{ fontSize:12, fontWeight:500, margin:'0 0 10px' }}>Bitácora del proceso</p>
            {log.map(l => (
              <div key={l.id} style={{ display:'flex', gap:10, padding:'7px 0', borderBottom:`0.5px solid ${C.borde}` }}>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, flexShrink:0, marginTop:1,
                  background: l.estatus==='exito' ? 'var(--color-background-success)' : 'var(--color-background-danger)',
                  color: l.estatus==='exito' ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
                  {l.estatus}
                </span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:11, margin:'0 0 2px', color:'var(--color-text-primary)' }}>
                    {l.accion} · PAC: {l.pac?.replace('_',' ')} · {l.duracion_ms}ms
                  </p>
                  {l.error_msg && <p style={{ fontSize:10, color:'var(--color-text-danger)', margin:0 }}>{l.error_msg}</p>}
                </div>
                <span style={{ fontSize:10, color:'var(--color-text-tertiary)', flexShrink:0 }}>{fmtDt(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </MainLayout>
  )
}
