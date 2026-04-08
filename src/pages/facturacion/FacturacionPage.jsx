// ============================================================
//  OBRIX — Listado de Facturación
//  src/pages/facturacion/FacturacionPage.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { supabase } from '../../config/supabase'
import {
  Plus, Search, Filter, Download, Send,
  FileText, AlertCircle, CheckCircle, Clock,
  XCircle, RefreshCw, ChevronRight, Eye
} from 'lucide-react'

const fmt = (n) => Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtM = (n) => {
  const v = Number(n||0)
  return v >= 1_000_000 ? `$${(v/1_000_000).toFixed(2)}M` : `$${fmt(v)}`
}
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—'

const TIPO_LABEL = { I:'Factura', E:'Nota Cred.', P:'Comp. Pago', T:'Traslado' }
const TIPO_COLOR = {
  I: { bg:'var(--color-background-success)', color:'var(--color-text-success)' },
  E: { bg:'var(--color-background-warning)', color:'var(--color-text-warning)' },
  P: { bg:'var(--color-background-info)',    color:'var(--color-text-info)' },
}

const ESTATUS_CFG = {
  borrador:             { label:'Borrador',         icon:Clock,        bg:'var(--color-background-secondary)', color:'var(--color-text-tertiary)' },
  por_timbrar:          { label:'Procesando',        icon:RefreshCw,    bg:'var(--color-background-warning)',   color:'var(--color-text-warning)' },
  timbrado:             { label:'Timbrada',           icon:CheckCircle,  bg:'var(--color-background-success)',   color:'var(--color-text-success)' },
  cancelacion_solicitada:{ label:'Cancelando',       icon:Clock,        bg:'var(--color-background-warning)',   color:'var(--color-text-warning)' },
  cancelado:            { label:'Cancelada',          icon:XCircle,      bg:'var(--color-background-danger)',    color:'var(--color-text-danger)' },
  error:                { label:'Error PAC',          icon:AlertCircle,  bg:'var(--color-background-danger)',    color:'var(--color-text-danger)' },
}

const C = { borde:'var(--color-border-tertiary)', bg:'var(--color-background-primary)', bgSec:'var(--color-background-secondary)' }

export default function FacturacionPage() {
  const nav = useNavigate()
  const [facturas, setFacturas]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [companyId, setCompanyId]   = useState(null)
  const [busqueda, setBusqueda]     = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEst, setFiltroEst]   = useState('todos')
  const [resumen, setResumen]       = useState(null)
  const [año, setAño]               = useState(new Date().getFullYear())

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user } }) => {
      if (!user) return
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data }) => data && setCompanyId(data.company_id))
    })
  }, [])

  useEffect(() => {
    if (!companyId) return
    cargarFacturas()
    cargarResumen()
  }, [companyId, año])

  const cargarFacturas = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cfdi_documentos')
      .select(`
        id, tipo_comprobante, serie, folio, uuid_cfdi,
        fecha_emision, receptor_nombre, receptor_rfc,
        subtotal, total, estatus_emision, estatus_sat,
        cancelado, enviado_email, origen_cfdi,
        direccion, pac_proveedor
      `)
      .eq('company_id', companyId)
      .eq('direccion', 'emitida')
      .gte('fecha_emision', `${año}-01-01`)
      .lte('fecha_emision', `${año}-12-31`)
      .order('fecha_emision', { ascending: false })
      .limit(200)
    setFacturas(data || [])
    setLoading(false)
  }

  const cargarResumen = async () => {
    const { data } = await supabase.rpc('get_resumen_facturacion', { p_company_id: companyId, p_año: año })
    setResumen(data)
  }

  const filtradas = facturas.filter(f => {
    const matchBusq = !busqueda || [f.receptor_nombre, f.receptor_rfc, f.folio, f.uuid_cfdi]
      .some(v => v?.toLowerCase().includes(busqueda.toLowerCase()))
    const matchTipo = filtroTipo === 'todos' || f.tipo_comprobante === filtroTipo
    const matchEst  = filtroEst === 'todos' || f.estatus_emision === filtroEst
    return matchBusq && matchTipo && matchEst
  })

  const borde = { border: `0.5px solid ${C.borde}`, borderRadius: 'var(--border-radius-lg)' }

  return (
    <MainLayout title="Facturación CFDI 4.0">
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* KPIs */}
        {resumen && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { label:'Facturado', valor: fmtM(resumen.monto_facturado), sub:`${resumen.total_emitidas} facturas` },
              { label:'Cobrado',   valor: fmtM(resumen.monto_cobrado),   sub:'complementos de pago' },
              { label:'Por cobrar',valor: fmtM(resumen.pendiente_cobro), sub:'saldo pendiente' },
              { label:'Canceladas',valor: resumen.canceladas,             sub:'en el período' },
            ].map(({ label, valor, sub }) => (
              <div key={label} style={{ ...borde, background:C.bg, padding:'12px 14px' }}>
                <p style={{ fontSize:11, color:'var(--color-text-tertiary)', fontWeight:500, textTransform:'uppercase', letterSpacing:'.06em', margin:'0 0 6px' }}>{label}</p>
                <p style={{ fontSize:22, fontWeight:500, color:'var(--color-text-primary)', margin:0 }}>{valor}</p>
                <p style={{ fontSize:11, color:'var(--color-text-secondary)', margin:'3px 0 0' }}>{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Barra de acciones */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:200, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)' }}/>
            <input
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, RFC, folio o UUID..."
              style={{ width:'100%', paddingLeft:32, fontSize:13 }}
            />
          </div>

          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ fontSize:12 }}>
            <option value="todos">Todos los tipos</option>
            <option value="I">Facturas</option>
            <option value="E">Notas de Crédito</option>
            <option value="P">Comp. de Pago</option>
          </select>

          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)} style={{ fontSize:12 }}>
            <option value="todos">Todos los estatus</option>
            <option value="timbrado">Timbradas</option>
            <option value="borrador">Borrador</option>
            <option value="cancelado">Canceladas</option>
            <option value="error">Con error</option>
          </select>

          <select value={año} onChange={e => setAño(Number(e.target.value))} style={{ fontSize:12 }}>
            {[2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button
            onClick={() => nav('/facturacion/nueva')}
            style={{ display:'flex', alignItems:'center', gap:6, background:'var(--color-text-primary)', color:'var(--color-background-primary)', border:'none', padding:'8px 14px', borderRadius:'var(--border-radius-md)', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            <Plus size={14}/> Nueva factura
          </button>
        </div>

        {/* Tabla */}
        <div style={{ ...borde, background:C.bg, overflow:'hidden' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
              <div style={{ width:28, height:28, border:'2px solid var(--color-border-secondary)', borderTopColor:'var(--color-text-primary)', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding:48, textAlign:'center' }}>
              <FileText size={32} style={{ color:'var(--color-text-tertiary)', margin:'0 auto 12px' }}/>
              <p style={{ fontSize:14, color:'var(--color-text-secondary)' }}>No hay facturas que coincidan con los filtros</p>
              <button onClick={() => nav('/facturacion/nueva')}
                style={{ marginTop:12, padding:'8px 16px', borderRadius:'var(--border-radius-md)', fontSize:13, cursor:'pointer' }}>
                Crear primera factura
              </button>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:C.bgSec, borderBottom:`1px solid ${C.borde}` }}>
                  {['Tipo','Folio','Cliente','Fecha','Total','Estatus','PAC',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:500, fontSize:11, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f, i) => {
                  const est = ESTATUS_CFG[f.estatus_emision] || ESTATUS_CFG.borrador
                  const EstIcon = est.icon
                  const tipoCfg = TIPO_COLOR[f.tipo_comprobante] || TIPO_COLOR.I
                  return (
                    <tr key={f.id}
                      onClick={() => nav(`/facturacion/${f.id}`)}
                      style={{ borderBottom:`0.5px solid ${C.borde}`, cursor:'pointer', background: i%2===0 ? C.bg : C.bgSec,
                        transition:'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--color-background-info)'}
                      onMouseLeave={e => e.currentTarget.style.background= i%2===0 ? C.bg : C.bgSec}>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:tipoCfg.bg, color:tipoCfg.color, fontWeight:500 }}>
                          {TIPO_LABEL[f.tipo_comprobante] || f.tipo_comprobante}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:500, color:'var(--color-text-primary)' }}>
                        {f.serie}{f.folio || '—'}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <p style={{ margin:0, fontWeight:500, color:'var(--color-text-primary)', fontSize:12 }}>{f.receptor_nombre || '—'}</p>
                        <p style={{ margin:0, fontSize:10, color:'var(--color-text-tertiary)', fontFamily:'monospace' }}>{f.receptor_rfc}</p>
                      </td>
                      <td style={{ padding:'10px 14px', color:'var(--color-text-secondary)' }}>{fmtFecha(f.fecha_emision)}</td>
                      <td style={{ padding:'10px 14px', fontWeight:500, color:'var(--color-text-primary)' }}>${fmt(f.total)}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, padding:'2px 8px', borderRadius:20, background:est.bg, color:est.color, fontWeight:500 }}>
                          <EstIcon size={10}/>{est.label}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:10, color:'var(--color-text-tertiary)', fontFamily:'monospace' }}>
                        {f.pac_proveedor?.replace('_',' ') || '—'}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <ChevronRight size={14} style={{ color:'var(--color-text-tertiary)' }}/>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ fontSize:11, color:'var(--color-text-tertiary)', textAlign:'right' }}>
          {filtradas.length} documento{filtradas.length !== 1 ? 's' : ''} · Año {año}
        </p>
      </div>
    </MainLayout>
  )
}
