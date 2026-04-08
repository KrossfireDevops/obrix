// ============================================================
//  OBRIX ERP — Página: Contabilidad Electrónica SAT
//  src/pages/contabilidad/ContabilidadElectronica.jsx
//  Versión: 1.0 | Marzo 2026
// ============================================================

import { useState, useEffect } from 'react'
import {
  Send, RefreshCw, AlertTriangle, CheckCircle, Download,
  Eye, FileText, Zap, XCircle,
  Shield, Calendar, Package, Info,
} from 'lucide-react'
import {
  getEntregas, generarEntrega, getEntregaDetalle,
  getContenidoXml, descargarXml, descargarTodosComoZip,
  enviarAlSat, marcarEnviadaManual, validarPeriodo,
  MESES, ESTATUS_ENTREGA, XML_INFO, formatBytes,
} from '../../services/contabilidadElectronica.service'
import { MainLayout } from '../../components/layout/MainLayout'

export default function ContabilidadElectronica() {
  const hoy = new Date()
  const [año,           setAño]           = useState(hoy.getFullYear())
  const [mes,           setMes]           = useState(hoy.getMonth() + 1)
  const [entregas,      setEntregas]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [paso,          setPaso]          = useState('historial')
  const [entregaActual, setEntregaActual] = useState(null)
  const [xmlPreview,    setXmlPreview]    = useState(null)
  const [validacion,    setValidacion]    = useState(null)
  const [config,        setConfig]        = useState({
    incluyeCT: false, incluyeBC: true,
    incluyePL: false, incluyeXC: false, incluyeXF: false,
    tipoEnvio: 'normal', numRequerimiento: '',
  })

  useEffect(() => { cargarHistorial() }, [])

  const cargarHistorial = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getEntregas()
      setEntregas(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleNuevaEntrega = async () => {
    setPaso('configurar'); setValidacion(null)
    try { const v = await validarPeriodo(año, mes); setValidacion(v) }
    catch (e) { setError(e.message) }
  }

  const handleGenerar = async () => {
    if (!validacion?.ok) return
    try {
      setPaso('generando'); setError(null)
      const id      = await generarEntrega({ año, mes, ...config, numRequerimiento: config.numRequerimiento || null })
      const detalle = await getEntregaDetalle(id)
      setEntregaActual(detalle); setPaso('lista'); cargarHistorial()
    } catch (e) { setError(e.message); setPaso('configurar') }
  }

  const handlePreview = async (xml) => {
    try { const d = await getContenidoXml(xml.id); setXmlPreview(d); setPaso('preview') }
    catch (e) { setError(e.message) }
  }

  const handleDescargar = async (xml) => {
    try { const d = await getContenidoXml(xml.id); descargarXml(d.contenido_xml, d.nombre_archivo) }
    catch (e) { setError(e.message) }
  }

  const handleAbrirEntrega = async (e) => {
    try { const d = await getEntregaDetalle(e.id); setEntregaActual(d); setAño(d.periodo_año); setMes(d.periodo_mes); setPaso('lista') }
    catch (err) { setError(err.message) }
  }

  const handleEnviarSat = async () => {
    if (!entregaActual?.id || !window.confirm('¿Enviar al Buzón Tributario del SAT vía e.firma?')) return
    try { await enviarAlSat(entregaActual.id); const d = await getEntregaDetalle(entregaActual.id); setEntregaActual(d); cargarHistorial() }
    catch (e) { setError(e.message) }
  }

  const handleMarcarManual = async () => {
    if (!entregaActual?.id) return
    try { await marcarEnviadaManual(entregaActual.id); const d = await getEntregaDetalle(entregaActual.id); setEntregaActual(d); cargarHistorial() }
    catch (e) { setError(e.message) }
  }

  return (
    <MainLayout title="📤 Contabilidad Electrónica SAT">
      <div className="space-y-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">Anexo 24 — Esquema XSD versión 1.3</p>
          <div className="flex items-center gap-3">
            {paso !== 'historial' && (
              <button onClick={() => { setPaso('historial'); setEntregaActual(null) }}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                ← Historial
              </button>
            )}
            {paso === 'historial' && (
              <button onClick={handleNuevaEntrega}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                <FileText size={15} /> Nueva Entrega
              </button>
            )}
            <button onClick={cargarHistorial} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle size={14} className="shrink-0" /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div>
          {paso === 'historial' && (
            <Historial entregas={entregas} loading={loading} año={año} setAño={setAño} mes={mes} setMes={setMes} onNueva={handleNuevaEntrega} onAbrir={handleAbrirEntrega} />
          )}
          {paso === 'configurar' && (
            <ConfigurarEntrega año={año} setAño={setAño} mes={mes} setMes={setMes} config={config} setConfig={setConfig} validacion={validacion} onGenerar={handleGenerar} onCancelar={() => setPaso('historial')} />
          )}
          {paso === 'generando' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <RefreshCw size={28} className="text-indigo-600 animate-spin" />
            </div>
            <p className="text-lg font-semibold text-gray-800">Generando XMLs del Anexo 24…</p>
            <p className="text-sm text-gray-500">Consultando Libro Mayor y calculando saldos</p>
          </div>
        )}
        {paso === 'lista' && entregaActual && (
          <ListaXmls entrega={entregaActual} onPreview={handlePreview} onDescargar={handleDescargar} onDescargarZip={() => descargarTodosComoZip(entregaActual.id).catch(e => setError(e.message))} onEnviarSat={handleEnviarSat} onMarcarManual={handleMarcarManual} />
        )}
        {paso === 'preview' && xmlPreview && (
          <PreviewXml xml={xmlPreview} onVolver={() => setPaso('lista')} onDescargar={() => descargarXml(xmlPreview.contenido_xml, xmlPreview.nombre_archivo)} />
        )}
        </div>
      </div>
    </MainLayout>
  )
}

function Historial({ entregas, loading, año, setAño, mes, setMes, onNueva, onAbrir }) {
  const aceptadas  = entregas.filter(e => e.estatus === 'aceptada').length
  const pendientes = entregas.filter(e => ['pendiente','lista'].includes(e.estatus)).length
  const rechazadas = entregas.filter(e => e.estatus === 'rechazada').length
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl"><p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Aceptadas SAT</p><p className="text-3xl font-bold text-green-700">{aceptadas}</p></div>
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl"><p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Por enviar</p><p className="text-3xl font-bold text-indigo-700">{pendientes}</p></div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl"><p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Rechazadas</p><p className="text-3xl font-bold text-red-700">{rechazadas}</p></div>
      </div>
      <div className="flex items-center gap-3">
        <select value={año} onChange={e => setAño(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <button onClick={onNueva} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <FileText size={14} /> Generar entrega {MESES[mes-1]} {año}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50"><p className="text-sm font-medium text-gray-700">Historial de Entregas</p></div>
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-indigo-400" /></div>
        ) : entregas.length === 0 ? (
          <div className="py-16 text-center"><Send size={32} className="text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">Aún no hay entregas registradas</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">{['Período','Tipo','XMLs','Estatus','Método','Fecha',''].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {entregas.map(e => {
                const est = ESTATUS_ENTREGA[e.estatus] ?? ESTATUS_ENTREGA.pendiente
                const xmls = e.xmls_generados ?? []
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{MESES[e.periodo_mes-1]} {e.periodo_año}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${e.tipo_envio === 'normal' ? 'bg-gray-100 text-gray-600' : e.tipo_envio === 'complemento' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{e.tipo_envio}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{xmls.map(x => <span key={x.id} className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded font-mono font-semibold">{x.tipo_xml}</span>)}{xmls.length === 0 && <span className="text-xs text-gray-400">—</span>}</div></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${est.color}`}>{est.label}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{e.metodo_envio ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.updated_at ? new Date(e.updated_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => onAbrir(e)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"><Eye size={12} /> Abrir</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ConfigurarEntrega({ año, setAño, mes, setMes, config, setConfig, validacion, onGenerar, onCancelar }) {
  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={15} className="text-indigo-500" /> Período a reportar</h2>
        <div className="flex gap-3">
          <select value={año} onChange={e => setAño(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">{Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a}>{a}</option>)}</select>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">{MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
        </div>
      </div>
      {validacion && (
        <div className={`rounded-xl border p-4 ${validacion.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {validacion.ok ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
            <p className={`text-sm font-semibold ${validacion.ok ? 'text-green-800' : 'text-red-800'}`}>{validacion.ok ? 'Período listo para generar' : 'Hay errores que corregir'}</p>
          </div>
          <div className="space-y-1 text-xs ml-6">
            <p className="text-gray-600"><span className="font-medium">{validacion.totalPolizas}</span> pólizas · RFC: <span className="font-mono font-medium">{validacion.rfcEmisor ?? 'No configurado'}</span></p>
            {validacion.errores?.map((e, i) => <p key={i} className="text-red-600 flex items-center gap-1"><AlertTriangle size={10} /> {e}</p>)}
            {validacion.alertas?.map((a, i) => <p key={i} className="text-amber-600 flex items-center gap-1"><Info size={10} /> {a}</p>)}
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Package size={15} className="text-indigo-500" /> XMLs a generar</h2>
        <div className="space-y-3">
          {Object.entries(XML_INFO).map(([tipo, info]) => {
            const key = `incluye${tipo}`; const checked = config[key]; const esBC = tipo === 'BC'
            return (
              <label key={tipo} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                <input type="checkbox" checked={checked} disabled={esBC} onChange={e => set(key, e.target.checked)} className="mt-0.5 rounded" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{info.icon}</span>
                    <span className="text-sm font-semibold text-gray-800">{tipo} — {info.label}</span>
                    {esBC && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Obligatoria</span>}
                    <span className="ml-auto text-xs px-2 py-0.5 font-mono font-bold bg-indigo-100 text-indigo-700 rounded">{tipo}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 ml-6">{info.desc}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Send size={15} className="text-indigo-500" /> Tipo de envío</h2>
        <div className="flex gap-3">
          {[{v:'normal',l:'Normal',desc:'Envío mensual ordinario'},{v:'complemento',l:'Complementaria',desc:'Corrección de un envío anterior'},{v:'requerimiento',l:'Requerimiento',desc:'Respuesta a solicitud del SAT'}].map(opt => (
            <label key={opt.v} className={`flex-1 p-3 rounded-xl border cursor-pointer text-center transition-colors ${config.tipoEnvio === opt.v ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="tipoEnvio" value={opt.v} checked={config.tipoEnvio === opt.v} onChange={() => set('tipoEnvio', opt.v)} className="sr-only" />
              <p className="text-sm font-semibold text-gray-800">{opt.l}</p><p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
            </label>
          ))}
        </div>
        {config.tipoEnvio === 'requerimiento' && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de orden del requerimiento *</label>
            <input type="text" value={config.numRequerimiento} onChange={e => set('numRequerimiento', e.target.value)} placeholder="Ej: ABC1234567/2026" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancelar} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
        <button onClick={onGenerar} disabled={!validacion?.ok} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <Zap size={15} /> Generar XMLs
        </button>
      </div>
    </div>
  )
}

function ListaXmls({ entrega, onPreview, onDescargar, onDescargarZip, onEnviarSat, onMarcarManual }) {
  const est = ESTATUS_ENTREGA[entrega.estatus] ?? ESTATUS_ENTREGA.pendiente
  const xmls = entrega.xmls_generados ?? []
  const esLista = entrega.estatus === 'lista'
  const yaEnviada = ['enviada','aceptada'].includes(entrega.estatus)
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Entrega generada</p>
            <h2 className="text-xl font-bold text-gray-900">{MESES[entrega.periodo_mes-1]} {entrega.periodo_año}</h2>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">Tipo: {entrega.tipo_envio}</p>
          </div>
          <span className={`px-3 py-1.5 text-sm rounded-full font-semibold ${est.color}`}>{est.label}</span>
        </div>
        {entrega.acuse_recibo && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg"><p className="text-xs font-semibold text-green-700 flex items-center gap-1.5"><CheckCircle size={12} /> Acuse recibido · {entrega.fecha_acuse ? new Date(entrega.fecha_acuse).toLocaleString('es-MX') : '—'}</p></div>}
        {entrega.motivo_rechazo && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-xs font-semibold text-red-700 flex items-center gap-1.5"><XCircle size={12} /> Rechazado: {entrega.motivo_rechazo}</p></div>}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">{xmls.length} archivo{xmls.length !== 1 ? 's' : ''} XML</p>
          {xmls.length > 1 && <button onClick={onDescargarZip} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"><Download size={12} /> Descargar ZIP</button>}
        </div>
        {xmls.map(xml => {
          const info = XML_INFO[xml.tipo_xml] ?? {}
          return (
            <div key={xml.id} className="flex items-center gap-4 px-4 py-4 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-lg shrink-0">{info.icon ?? '📄'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{xml.nombre_archivo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{info.label} · {formatBytes(xml.tamaño_bytes)}{xml.num_cuentas > 0 && ` · ${xml.num_cuentas} cuentas`}{xml.num_polizas > 0 && ` · ${xml.num_polizas} pólizas`}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onPreview(xml)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"><Eye size={12} /> Ver</button>
                <button onClick={() => onDescargar(xml)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"><Download size={12} /> Descargar</button>
              </div>
            </div>
          )
        })}
      </div>
      {!yaEnviada && esLista && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Send size={15} className="text-indigo-500" /> Enviar al SAT</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onEnviarSat} className="flex flex-col items-center gap-2 p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"><Shield size={22} /><span className="text-sm font-semibold">Envío automático</span><span className="text-xs opacity-80 text-center">Firma y envía vía e.firma</span></button>
            <button onClick={onMarcarManual} className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"><Download size={22} className="text-gray-500" /><span className="text-sm font-semibold">Envío manual</span><span className="text-xs text-gray-500 text-center">Descarga y sube al portal SAT</span></button>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">sat.gob.mx → Empresas → Contabilidad Electrónica → Envío de Información</p>
        </div>
      )}
      {yaEnviada && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={20} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">{entrega.estatus === 'aceptada' ? 'Aceptada por el SAT' : 'Enviada correctamente'}</p>
            <p className="text-xs text-green-600 mt-0.5">Método: {entrega.metodo_envio === 'automatico' ? 'Automático vía e.firma' : 'Manual por portal SAT'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewXml({ xml, onVolver, onDescargar }) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Vista previa</p>
          <h2 className="text-lg font-semibold text-gray-900 font-mono">{xml.nombre_archivo}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onVolver} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">← Volver</button>
          <button onClick={onDescargar} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"><Download size={14} /> Descargar XML</button>
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
          <span className="text-xs text-gray-400 font-mono">{xml.nombre_archivo}</span>
          <span className="text-xs text-gray-500">{xml.contenido_xml?.split('\n').length} líneas</span>
        </div>
        <pre className="p-4 text-xs font-mono text-green-400 overflow-x-auto max-h-[60vh] overflow-y-auto leading-relaxed">{xml.contenido_xml}</pre>
      </div>
    </div>
  )
}