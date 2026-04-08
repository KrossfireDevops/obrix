// ============================================================
//  OBRIX — Editor de Nueva Factura CFDI 4.0
//  src/pages/facturacion/NuevaFactura.jsx
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { supabase } from '../../config/supabase'
import {
  Plus, Trash2, Save, Send, AlertCircle,
  ChevronDown, Search, Building2, FileText
} from 'lucide-react'

const r2 = (n) => Math.round((n||0) * 100) / 100
const fmt2 = (n) => r2(n).toFixed(2)

// Catálogos SAT más comunes en construcción
const USO_CFDI = [
  { clave:'G01', desc:'Adquisición de mercancias' },
  { clave:'G03', desc:'Gastos en general' },
  { clave:'I01', desc:'Construcciones' },
  { clave:'I02', desc:'Mobilario y equipo de oficina' },
  { clave:'P01', desc:'Por definir' },
]
const FORMA_PAGO = [
  { clave:'01', desc:'Efectivo' },
  { clave:'02', desc:'Cheque nominativo' },
  { clave:'03', desc:'Transferencia electrónica' },
  { clave:'04', desc:'Tarjeta de crédito' },
  { clave:'28', desc:'Tarjeta de débito' },
  { clave:'99', desc:'Por definir' },
]
const REGIMEN_FISCAL = [
  { clave:'601', desc:'General de Ley Personas Morales' },
  { clave:'603', desc:'Personas Morales con Fines no Lucrativos' },
  { clave:'612', desc:'Personas Físicas con Actividades Empresariales' },
  { clave:'616', desc:'Sin obligaciones fiscales' },
  { clave:'626', desc:'Régimen Simplificado de Confianza' },
]
const IVA_TASAS = [
  { valor:0.16, label:'IVA 16%' },
  { valor:0.08, label:'IVA 8% (zona fronteriza)' },
  { valor:0,    label:'Exento' },
]
const CLAVE_PROD_CONSTRUCCION = [
  { clave:'72154001', desc:'Servicios de construcción de edificios' },
  { clave:'72151500', desc:'Servicios de construcción de carreteras' },
  { clave:'72151600', desc:'Instalaciones especializadas' },
  { clave:'72150000', desc:'Servicios de construcción en general' },
]

const C = { borde:'var(--color-border-tertiary)' }
const cardStyle = { background:'var(--color-background-primary)', border:`0.5px solid ${C.borde}`, borderRadius:'var(--border-radius-lg)', padding:'16px 18px' }

// Concepto vacío
const nuevoConcepto = () => ({
  _id: crypto.randomUUID(),
  claveProdServ: '72154001',
  descripcion: '',
  cantidad: 1,
  claveUnidad: 'E48',
  unidad: 'Servicio',
  valorUnitario: 0,
  ivaRate: 0.16,
  objetoImp: '02',
})

export default function NuevaFactura() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [companyId, setCompanyId]   = useState(null)
  const [userId, setUserId]         = useState(null)
  const [empresa, setEmpresa]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [timbrando, setTimbrando]   = useState(false)

  // Busqueda de cliente
  const [busqCliente, setBusqCliente] = useState('')
  const [clientesSug, setClientesSug] = useState([])
  const [clienteSel, setClienteSel]   = useState(null)

  // Campos del CFDI
  const [tipoCfdi, setTipoCfdi]         = useState('I')
  const [metodoPago, setMetodoPago]     = useState('PPD')
  const [formaPago, setFormaPago]       = useState('03')
  const [usoCfdi, setUsoCfdi]           = useState('G03')
  const [regimenRec, setRegimenRec]     = useState('601')
  const [cpReceptor, setCpReceptor]     = useState('')
  const [condPago, setCondPago]         = useState('30 días neto')
  const [conceptos, setConceptos]       = useState([nuevoConcepto()])
  const [notas, setNotas]               = useState('')

  // Anticipo vinculado (si viene de un contrato)
  const anticipoId = params.get('anticipo_id')
  const contratoId = params.get('contrato_id')

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('users_profiles').select('company_id').eq('id', user.id).single()
        .then(({ data: p }) => {
          if (!p) return
          setCompanyId(p.company_id)
          // Cargar datos del emisor
          supabase.from('company_settings')
            .select('rfc, razon_social, regimen_fiscal_emisor, codigo_postal_fiscal')
            .eq('company_id', p.company_id).single()
            .then(({ data: e }) => setEmpresa(e))
        })
    })
  }, [])

  // Precargar anticipo si viene de parámetro
  useEffect(() => {
    if (!anticipoId || !companyId) return
    supabase.from('anticipos_comerciales')
      .select('*, contratos_comerciales(nombre_proyecto, cliente_id, monto_total), terceros(*)')
      .eq('id', anticipoId).single()
      .then(({ data: ant }) => {
        if (!ant) return
        // Pre-llenar receptor
        if (ant.terceros) {
          setClienteSel(ant.terceros)
          setBusqCliente(ant.terceros.razon_social)
          setCpReceptor(ant.terceros.codigo_postal || '')
        }
        // Pre-llenar concepto
        const monto = Number(ant.monto_recibido || 0)
        const base  = r2(monto / 1.16)
        const iva   = r2(monto - base)
        setConceptos([{
          ...nuevoConcepto(),
          descripcion: `Anticipo — ${ant.contratos_comerciales?.nombre_proyecto || 'Contrato'}`,
          valorUnitario: base,
          cantidad: 1,
          ivaRate: 0.16,
        }])
        setUsoCfdi('G03')
        setMetodoPago('PUE')
        setFormaPago('03')
      })
  }, [anticipoId, companyId])

  // Buscar clientes
  useEffect(() => {
    if (busqCliente.length < 2) { setClientesSug([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('terceros')
        .select('id, rfc, razon_social, codigo_postal, regimen_fiscal, uso_cfdi_default, email')
        .eq('company_id', companyId)
        .or(`razon_social.ilike.%${busqCliente}%,rfc.ilike.%${busqCliente}%`)
        .limit(8)
      setClientesSug(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [busqCliente, companyId])

  const selCliente = (c) => {
    setClienteSel(c)
    setBusqCliente(c.razon_social)
    setCpReceptor(c.codigo_postal || '')
    setRegimenRec(c.regimen_fiscal || '601')
    setUsoCfdi(c.uso_cfdi_default || 'G03')
    setClientesSug([])
  }

  // Calcular totales
  const calcConcepto = useCallback((c) => {
    const importe = r2(c.cantidad * c.valorUnitario)
    const iva     = c.ivaRate > 0 ? r2(importe * c.ivaRate) : 0
    return { importe, iva, total: importe + iva }
  }, [])

  const totales = conceptos.reduce((acc, c) => {
    const { importe, iva } = calcConcepto(c)
    return { subtotal: acc.subtotal + importe, iva: acc.iva + iva }
  }, { subtotal: 0, iva: 0 })
  const total = r2(totales.subtotal + totales.iva)

  const actualizarConcepto = (id, campo, valor) => {
    setConceptos(cs => cs.map(c => c._id === id ? { ...c, [campo]: valor } : c))
  }

  // ── Guardar borrador ────────────────────────────────────────
  const guardarBorrador = async () => {
    if (!clienteSel) { setError('Selecciona un cliente'); return }
    if (conceptos.some(c => !c.descripcion)) { setError('Todos los conceptos deben tener descripción'); return }
    setGuardando(true); setError('')

    try {
      const fecha = new Date().toISOString().replace('T',' ').slice(0,19)
      const { data: folioDat } = await supabase.rpc('get_siguiente_folio', {
        p_company_id: companyId,
        p_tipo: tipoCfdi === 'E' ? 'nc' : 'factura',
      })

      const doc = {
        company_id:              companyId,
        tipo_comprobante:        tipoCfdi,
        direccion:               'emitida',
        serie:                   folioDat?.serie || 'A',
        folio:                   String(folioDat?.folio || 1),
        fecha_emision:           new Date().toISOString(),
        lugar_expedicion:        empresa?.codigo_postal_fiscal || '',
        emisor_rfc:              empresa?.rfc || '',
        emisor_nombre:           empresa?.razon_social || '',
        emisor_regimen:          empresa?.regimen_fiscal_emisor || '601',
        receptor_rfc:            clienteSel.rfc,
        receptor_nombre:         clienteSel.razon_social,
        receptor_uso_cfdi:       usoCfdi,
        receptor_domicilio_fiscal: cpReceptor,
        receptor_regimen_fiscal: regimenRec,
        receptor_domicilio_cp:   cpReceptor,
        metodo_pago:             metodoPago,
        forma_pago:              formaPago,
        condiciones_pago:        condPago,
        subtotal:                r2(totales.subtotal),
        total_impuestos_tras:    r2(totales.iva),
        total:                   total,
        moneda:                  'MXN',
        tipo_cambio:             1,
        estatus_emision:         'borrador',
        estatus_sat:             'no_timbrado',
        origen_cfdi:             anticipoId ? 'anticipo' : 'manual',
        anticipo_id:             anticipoId || null,
        contrato_id:             contratoId || null,
        creado_por:              userId,
        tercero_id:              clienteSel.id,
      }

      const { data: cfdiNew, error: errCfdi } = await supabase
        .from('cfdi_documentos').insert(doc).select().single()
      if (errCfdi) throw errCfdi

      // Insertar conceptos
      const conceptosInsert = conceptos.map((c, idx) => {
        const { importe, iva } = calcConcepto(c)
        return {
          cfdi_id:         cfdiNew.id,
          company_id:      companyId,
          clave_prod_serv: c.claveProdServ,
          cantidad:        c.cantidad,
          clave_unidad:    c.claveUnidad,
          unidad:          c.unidad,
          descripcion:     c.descripcion,
          valor_unitario:  r2(c.valorUnitario),
          importe:         importe,
          objeto_imp:      c.objetoImp,
          orden:           idx + 1,
        }
      })
      const { data: conceptosNew } = await supabase
        .from('cfdi_conceptos').insert(conceptosInsert).select()

      // Insertar impuestos por concepto
      const impuestosInsert = []
      conceptos.forEach((c, idx) => {
        const { importe, iva } = calcConcepto(c)
        if (c.ivaRate > 0 && iva > 0 && conceptosNew?.[idx]) {
          impuestosInsert.push({
            cfdi_id:          cfdiNew.id,
            cfdi_concepto_id: conceptosNew[idx].id,
            company_id:       companyId,
            tipo:             'traslado',
            impuesto:         '002',
            tipo_factor:      'Tasa',
            tasa_cuota:       c.ivaRate,
            base_impuesto:    importe,
            importe_impuesto: iva,
          })
        }
      })
      if (impuestosInsert.length) {
        await supabase.from('cfdi_impuestos').insert(impuestosInsert)
      }

      nav(`/facturacion/${cfdiNew.id}`)
    } catch (e) {
      setError(`Error al guardar: ${e.message || JSON.stringify(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  const inputStyle = { width:'100%', fontSize:13 }
  const labelStyle = { fontSize:11, fontWeight:500, color:'var(--color-text-secondary)', display:'block', marginBottom:4 }

  return (
    <MainLayout title="Nueva Factura CFDI 4.0">
      <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:900 }}>

        {/* Tipo de documento */}
        <div style={cardStyle}>
          <p style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Tipo de documento</p>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { tipo:'I', label:'Factura de Ingreso', sub:'Venta de servicios de construcción' },
              { tipo:'E', label:'Nota de Crédito', sub:'Devolución o descuento' },
              { tipo:'P', label:'Complemento de Pago', sub:'Registrar cobro de factura PPD' },
            ].map(({ tipo, label, sub }) => (
              <div key={tipo} onClick={() => setTipoCfdi(tipo)}
                style={{ flex:1, padding:'12px 14px', borderRadius:'var(--border-radius-md)', cursor:'pointer',
                  border:`${tipoCfdi === tipo ? '1.5px' : '0.5px'} solid ${tipoCfdi === tipo ? 'var(--color-border-primary)' : C.borde}`,
                  background: tipoCfdi === tipo ? 'var(--color-background-info)' : 'var(--color-background-secondary)' }}>
                <p style={{ fontSize:12, fontWeight:500, color: tipoCfdi === tipo ? 'var(--color-text-info)' : 'var(--color-text-primary)', margin:'0 0 3px' }}>{label}</p>
                <p style={{ fontSize:10, color:'var(--color-text-tertiary)', margin:0 }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Receptor */}
        <div style={cardStyle}>
          <p style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Cliente (Receptor)</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1', position:'relative' }}>
              <label style={labelStyle}>Buscar cliente</label>
              <div style={{ position:'relative' }}>
                <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)' }}/>
                <input value={busqCliente} onChange={e => { setBusqCliente(e.target.value); setClienteSel(null) }}
                  placeholder="Nombre o RFC del cliente..."
                  style={{ ...inputStyle, paddingLeft:30 }}/>
              </div>
              {clientesSug.length > 0 && (
                <div style={{ position:'absolute', zIndex:100, top:'100%', left:0, right:0, background:'var(--color-background-primary)', border:`0.5px solid ${C.borde}`, borderRadius:'var(--border-radius-md)', boxShadow:'0 8px 24px rgba(0,0,0,.12)', marginTop:2 }}>
                  {clientesSug.map(c => (
                    <div key={c.id} onClick={() => selCliente(c)}
                      style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`0.5px solid ${C.borde}` }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--color-background-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <p style={{ fontSize:12, fontWeight:500, margin:'0 0 2px' }}>{c.razon_social}</p>
                      <p style={{ fontSize:10, color:'var(--color-text-tertiary)', fontFamily:'monospace', margin:0 }}>{c.rfc} · CP {c.codigo_postal}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>RFC Receptor</label>
              <input value={clienteSel?.rfc || ''} readOnly style={{ ...inputStyle, background:'var(--color-background-secondary)' }}/>
            </div>
            <div>
              <label style={labelStyle}>CP Fiscal Receptor</label>
              <input value={cpReceptor} onChange={e => setCpReceptor(e.target.value)} style={inputStyle} placeholder="66220"/>
            </div>
            <div>
              <label style={labelStyle}>Régimen Fiscal Receptor</label>
              <select value={regimenRec} onChange={e => setRegimenRec(e.target.value)} style={inputStyle}>
                {REGIMEN_FISCAL.map(r => <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Uso CFDI</label>
              <select value={usoCfdi} onChange={e => setUsoCfdi(e.target.value)} style={inputStyle}>
                {USO_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Método de Pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputStyle}>
                <option value="PUE">PUE — Pago en una sola exhibición</option>
                <option value="PPD">PPD — Pago en parcialidades o diferido</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Forma de Pago</label>
              <select value={formaPago} onChange={e => setFormaPago(e.target.value)} style={inputStyle}>
                {FORMA_PAGO.map(f => <option key={f.clave} value={f.clave}>{f.clave} — {f.desc}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Condiciones de Pago</label>
              <input value={condPago} onChange={e => setCondPago(e.target.value)} style={inputStyle} placeholder="30 días neto"/>
            </div>
          </div>
        </div>

        {/* Conceptos */}
        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ fontSize:13, fontWeight:500, margin:0 }}>Conceptos</p>
            <button onClick={() => setConceptos(cs => [...cs, nuevoConcepto()])}
              style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'5px 10px', borderRadius:'var(--border-radius-md)', cursor:'pointer' }}>
              <Plus size={12}/> Agregar concepto
            </button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {conceptos.map((c, idx) => {
              const { importe, iva, total: tot } = calcConcepto(c)
              return (
                <div key={c._id} style={{ padding:'12px 14px', background:'var(--color-background-secondary)', borderRadius:'var(--border-radius-md)', border:`0.5px solid ${C.borde}` }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:10, alignItems:'end', marginBottom:8 }}>
                    <div>
                      <label style={labelStyle}>Descripción</label>
                      <input value={c.descripcion} onChange={e => actualizarConcepto(c._id,'descripcion',e.target.value)}
                        style={inputStyle} placeholder="Servicios de construcción..."/>
                    </div>
                    <div>
                      <label style={labelStyle}>Cantidad</label>
                      <input type="number" value={c.cantidad} min="0.001" step="0.001"
                        onChange={e => actualizarConcepto(c._id,'cantidad',Number(e.target.value))}
                        style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Precio unitario</label>
                      <input type="number" value={c.valorUnitario} min="0" step="0.01"
                        onChange={e => actualizarConcepto(c._id,'valorUnitario',Number(e.target.value))}
                        style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>IVA</label>
                      <select value={c.ivaRate} onChange={e => actualizarConcepto(c._id,'ivaRate',Number(e.target.value))} style={inputStyle}>
                        {IVA_TASAS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                      </select>
                    </div>
                    <button onClick={() => setConceptos(cs => cs.filter(x => x._id !== c._id))}
                      disabled={conceptos.length === 1}
                      style={{ padding:'6px 8px', borderRadius:'var(--border-radius-md)', cursor:'pointer', opacity: conceptos.length===1?.4:1 }}>
                      <Trash2 size={13} style={{ color:'var(--color-text-danger)' }}/>
                    </button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
                    <div>
                      <label style={labelStyle}>Clave Prod/Serv SAT</label>
                      <select value={c.claveProdServ} onChange={e => actualizarConcepto(c._id,'claveProdServ',e.target.value)} style={inputStyle}>
                        {CLAVE_PROD_CONSTRUCCION.map(cp => <option key={cp.clave} value={cp.clave}>{cp.clave} — {cp.desc}</option>)}
                      </select>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:10, color:'var(--color-text-tertiary)', margin:'0 0 4px' }}>Subtotal</p>
                      <p style={{ fontSize:13, fontWeight:500, margin:0 }}>${fmt2(importe)}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:10, color:'var(--color-text-tertiary)', margin:'0 0 4px' }}>IVA</p>
                      <p style={{ fontSize:13, fontWeight:500, margin:0, color:'var(--color-text-secondary)' }}>${fmt2(iva)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totales */}
          <div style={{ marginTop:14, padding:'12px 14px', background:'var(--color-background-info)', borderRadius:'var(--border-radius-md)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }}>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--color-text-secondary)', margin:'0 0 4px' }}>Subtotal</p>
              <p style={{ fontSize:16, fontWeight:500, margin:0 }}>${fmt2(totales.subtotal)}</p>
            </div>
            <div style={{ textAlign:'center', borderLeft:`0.5px solid ${C.borde}`, borderRight:`0.5px solid ${C.borde}` }}>
              <p style={{ fontSize:11, color:'var(--color-text-secondary)', margin:'0 0 4px' }}>IVA</p>
              <p style={{ fontSize:16, fontWeight:500, margin:0 }}>${fmt2(totales.iva)}</p>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--color-text-secondary)', margin:'0 0 4px' }}>Total</p>
              <p style={{ fontSize:20, fontWeight:500, margin:0, color:'var(--color-text-info)' }}>${fmt2(total)}</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'var(--color-background-danger)', borderRadius:'var(--border-radius-md)', border:`0.5px solid var(--color-border-danger)` }}>
            <AlertCircle size={15} style={{ color:'var(--color-text-danger)', flexShrink:0 }}/>
            <p style={{ fontSize:12, color:'var(--color-text-danger)', margin:0 }}>{error}</p>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={() => nav(-1)} style={{ padding:'9px 16px', fontSize:13, cursor:'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardarBorrador} disabled={guardando}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', fontSize:13, fontWeight:500, cursor:'pointer',
              background:'var(--color-background-success)', color:'var(--color-text-success)', border:'0.5px solid var(--color-border-success)', borderRadius:'var(--border-radius-md)' }}>
            <Save size={14}/>
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
        </div>

      </div>
    </MainLayout>
  )
}
