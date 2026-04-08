// ============================================================
//  OBRIX ERP — Pantalla: Detalle / Expediente del Tercero
//  src/pages/relaciones/TerceroDetail.jsx
//  Ruta: /relaciones/terceros/:id
// ============================================================
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MainLayout } from '../../components/layout/MainLayout'
import { RequirePermission } from '../../components/auth/PermissionGuard'
import { useToast } from '../../hooks/useToast'
import * as service from '../../services/terceros.service'
import { parsearDocumento } from '../../services/documentParser.service'
import {
  ChevronLeft, CheckCircle, AlertTriangle, Shield,
  Edit3, Upload, RefreshCw, Lock, Unlock, XCircle,
  FileText, Building2, MapPin, CreditCard, Star,
  Clock, TrendingUp, Ban, Trash2, Save, X, Eye
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtFecha = (d) => {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX',
    { day: '2-digit', month: 'long', year: 'numeric' })
}
const fmtDt = (d) => d
  ? new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
  : '—'

const REGIMENES = {
  '601':'General de Ley Personas Morales','603':'Personas Morales sin Fines Lucrativos',
  '605':'Sueldos y Salarios','606':'Arrendamiento','612':'Actividades Empresariales',
  '616':'Sin obligaciones fiscales','621':'Incorporación Fiscal','626':'RESICO',
}

// ── Sub-componentes UI ────────────────────────────────────────────────────────
const Chip = ({ txt, color = '#374151', bg = '#F3F4F6' }) => (
  <span style={{ fontSize:11, fontWeight:600, padding:'2px 10px', borderRadius:20,
    color, backgroundColor:bg, display:'inline-flex', alignItems:'center' }}>
    {txt}
  </span>
)

const Campo = ({ label, valor, mono }) => (
  <div>
    <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 2px', fontWeight:500,
      textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</p>
    <p style={{ fontSize:13, color:'#111827', margin:0,
      fontFamily: mono ? 'monospace' : 'inherit', fontWeight: mono ? 600 : 400 }}>
      {valor || '—'}
    </p>
  </div>
)

const Seccion = ({ titulo, icono, children, borde = '#E5E7EB' }) => (
  <div style={{ border:`1px solid ${borde}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
    <div style={{ padding:'10px 16px', backgroundColor:'#F9FAFB',
      borderBottom:`1px solid ${borde}`, display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:15 }}>{icono}</span>
      <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>{titulo}</p>
    </div>
    <div style={{ padding:16 }}>{children}</div>
  </div>
)

// ── Badge de score ────────────────────────────────────────────────────────────
const ScoreBadge = ({ score, semaforo }) => {
  const cfg = {
    verde:    { bg:'#D1FAE5', color:'#065F46', dot:'#10B981' },
    amarillo: { bg:'#FEF9C3', color:'#B45309', dot:'#F59E0B' },
    rojo:     { bg:'#FEE2E2', color:'#991B1B', dot:'#EF4444' },
  }
  const c = cfg[semaforo] || cfg.rojo
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8,
      padding:'8px 14px', borderRadius:10, backgroundColor:c.bg }}>
      <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:c.dot }} />
      <span style={{ fontSize:22, fontWeight:800, color:c.color }}>{score ?? '—'}</span>
      <span style={{ fontSize:11, color:c.color, fontWeight:600 }}>
        / 100 · {semaforo?.toUpperCase() || 'SIN SCORE'}
      </span>
    </div>
  )
}

// ── Card de documento ─────────────────────────────────────────────────────────
const DocCard = ({ tipo, label, icono, path, onUpload, uploading, rfcEsperado }) => {
  const cargado = !!path
  return (
    <div style={{ border:`1px solid ${cargado?'#D1FAE5':'#E5E7EB'}`, borderRadius:10,
      padding:'12px 14px', backgroundColor: cargado?'#F0FDF4':'#F9FAFB',
      display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:20 }}>{icono}</span>
        <div>
          <p style={{ fontSize:12, fontWeight:700, color:'#374151', margin:'0 0 2px' }}>{label}</p>
          <p style={{ fontSize:11, color: cargado?'#059669':'#9CA3AF', margin:0 }}>
            {cargado ? '✓ Documento cargado' : 'Pendiente de carga'}
          </p>
        </div>
      </div>
      <label style={{ cursor:'pointer' }}>
        <input type="file" accept=".pdf" style={{ display:'none' }}
          onChange={e => e.target.files[0] && onUpload(tipo, e.target.files[0])} />
        <div style={{ display:'flex', alignItems:'center', gap:5,
          padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600,
          backgroundColor: cargado?'#fff':'#1E40AF',
          color: cargado?'#059669':'#fff',
          border:`1px solid ${cargado?'#6EE7B7':'#1E40AF'}`,
          transition:'all .15s', cursor: uploading?'not-allowed':'pointer' }}>
          {uploading ? <RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }} />
                     : <Upload size={12} />}
          {cargado ? 'Actualizar' : 'Subir'}
        </div>
      </label>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export const TerceroDetail = () => {
  const { id }    = useParams()
  const nav       = useNavigate()
  const { toast } = useToast()

  const [tercero,   setTercero]   = useState(null)
  const [relacion,  setRelacion]  = useState(null)
  const [banderas,  setBanderas]  = useState([])
  const [historial, setHistorial] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('expediente') // expediente|documentos|score|acciones
  const [uploading, setUploading] = useState(null)

  // Modo edición
  const [editando,  setEditando]  = useState(false)
  const [formEdit,  setFormEdit]  = useState({})
  const [saving,    setSaving]    = useState(false)

  // Modal baja/suspensión
  const [modalAccion, setModalAccion] = useState(null) // 'suspender' | 'baja'
  const [motivoAccion, setMotivoAccion] = useState('')

  useEffect(() => { cargar() }, [id])

  const cargar = async () => {
    setLoading(true)
    try {
      const [{ data: t }, { data: h }] = await Promise.all([
        service.getTerceroById(id),
        service.getHistorialScore(id),
      ])
      if (!t) { toast.error('Tercero no encontrado'); nav('/relaciones/terceros'); return }

      setTercero(t)
      setRelacion(t.tercero_relaciones?.[0] || null)
      setBanderas(t.tercero_banderas || [])
      setHistorial(h || [])
      setFormEdit({
        email:            t.email || '',
        telefono:         t.telefono || '',
        uso_cfdi_default: t.uso_cfdi_default || 'G03',
        nombre_comercial: t.nombre_comercial || '',
        tipo:             t.tercero_relaciones?.[0]?.tipo || 'proveedor',
      })
    } catch (e) {
      toast.error('Error al cargar el expediente')
    } finally {
      setLoading(false)
    }
  }

  // ── Guardar edición de datos de contacto ─────────────────────────────────
  const guardarEdicion = async () => {
    setSaving(true)
    try {
      await service.upsertTercero({
        rfc:              tercero.rfc,
        razon_social:     tercero.razon_social,
        regimen_fiscal:   tercero.regimen_fiscal,
        codigo_postal:    tercero.codigo_postal,
        ...formEdit,
      })
      toast.success('Datos actualizados correctamente')
      setEditando(false)
      cargar()
    } catch (e) {
      toast.error('Error al guardar: ' + (e.message || 'Intenta de nuevo'))
    } finally {
      setSaving(false)
    }
  }

  // ── Subir documento ──────────────────────────────────────────────────────
  const subirDocumento = async (tipo, file) => {
    setUploading(tipo)
    try {
      const { success, resultado } = await parsearDocumento(file, tipo.toUpperCase(), tercero.rfc)
      const datosExtraidos = success && resultado?.es_documento_correcto
        ? resultado.datos_extraidos : null

      const { error } = await service.uploadDocumento(id, tipo, file, datosExtraidos)
      if (error) throw error

      toast.success(`${tipo.replace('_',' ')} cargado correctamente`)
      cargar()
    } catch (e) {
      toast.error('Error al subir el documento: ' + (e.message || 'Intenta de nuevo'))
    } finally {
      setUploading(null)
    }
  }

  // ── Recalcular score ─────────────────────────────────────────────────────
  const recalcular = async () => {
    try {
      await service.recalcularScore(id, 'Recálculo manual desde expediente')
      toast.success('Score recalculado')
      cargar()
    } catch (e) { toast.error('Error al recalcular score') }
  }

  // ── Suspender / Dar de baja ──────────────────────────────────────────────
  const ejecutarAccion = async () => {
    if (!motivoAccion.trim()) { toast.error('Ingresa el motivo'); return }
    try {
      if (modalAccion === 'suspender') {
        await service.bloquearTercero(id, `SUSPENSIÓN: ${motivoAccion}`)
        toast.success('Tercero suspendido')
      } else {
        // Baja: desactivar + bloquear
        await service.bloquearTercero(id, `BAJA: ${motivoAccion}`)
        toast.success('Tercero dado de baja')
      }
      setModalAccion(null); setMotivoAccion('')
      cargar()
    } catch (e) { toast.error('Error al ejecutar la acción') }
  }

  const desbloquear = async () => {
    try {
      await service.desbloquearTercero(id)
      toast.success('Tercero reactivado')
      cargar()
    } catch (e) { toast.error('Error al reactivar') }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <MainLayout title="Cargando expediente...">
      <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
        <div style={{ width:36, height:36, border:'3px solid #E5E7EB',
          borderTopColor:'#1E40AF', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  )

  if (!tercero) return null

  const bloqueado = relacion?.bloqueado
  const docs = tercero.tercero_documentos || []
  const docPath = (tipo) => docs.find(d => d.tipo_documento === tipo)?.archivo_path

  // Tabs
  const TABS = [
    { id:'expediente', label:'📋 Expediente',   },
    { id:'documentos', label:'📁 Documentos',   },
    { id:'score',      label:'📊 Score',         },
    { id:'acciones',   label:'⚙️ Acciones',      },
  ]

  const tabStyle = (t) => ({
    padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer',
    border:'none', borderBottom: tab===t ? '2px solid #1E40AF' : '2px solid transparent',
    backgroundColor:'transparent', color: tab===t ? '#1E40AF' : '#6B7280',
    transition:'all .15s',
  })

  return (
    <RequirePermission module="fiscal" action="view">
      <MainLayout title={`📋 ${tercero.razon_social}`}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* ── Header ── */}
        <div style={{ marginBottom:16 }}>

          {/* Barra superior */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
            marginBottom:14 }}>
            <button onClick={() => nav('/relaciones/terceros')}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px',
                borderRadius:8, border:'1px solid #E5E7EB', background:'#fff',
                color:'#374151', fontSize:13, cursor:'pointer' }}>
              <ChevronLeft size={15}/> Directorio
            </button>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {bloqueado && (
                <Chip txt={relacion?.motivo_bloqueo?.startsWith('BAJA') ? '❌ BAJA' : '🔒 SUSPENDIDO'}
                  color="#991B1B" bg="#FEE2E2" />
              )}
              <button onClick={recalcular}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px',
                  borderRadius:8, border:'1px solid #E5E7EB', background:'#fff',
                  color:'#374151', fontSize:12, cursor:'pointer' }}>
                <RefreshCw size={13}/> Recalcular Score
              </button>
            </div>
          </div>

          {/* Card de identidad */}
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14,
            padding:'16px 20px', display:'flex', gap:20, alignItems:'flex-start',
            borderLeft:`4px solid ${relacion?.score_semaforo==='verde'?'#10B981':
              relacion?.score_semaforo==='amarillo'?'#F59E0B':'#EF4444'}` }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#1E40AF',
                  fontFamily:'monospace', backgroundColor:'#EFF6FF',
                  padding:'3px 10px', borderRadius:6 }}>{tercero.rfc}</span>
                <Chip txt={relacion?.tipo?.charAt(0).toUpperCase()+(relacion?.tipo?.slice(1)||'')|| 'Proveedor'}
                  color="#1E40AF" bg="#EFF6FF"/>
                <Chip txt={`N${tercero.nivel_completado||1}`}
                  color={tercero.nivel_completado>=2?'#065F46':'#6B7280'}
                  bg={tercero.nivel_completado>=2?'#D1FAE5':'#F3F4F6'} />
                {tercero.estatus_padron && (
                  <Chip txt={tercero.estatus_padron}
                    color={tercero.estatus_padron==='ACTIVO'?'#065F46':'#991B1B'}
                    bg={tercero.estatus_padron==='ACTIVO'?'#D1FAE5':'#FEE2E2'} />
                )}
              </div>
              <h1 style={{ fontSize:20, fontWeight:800, color:'#111827', margin:'0 0 4px' }}>
                {tercero.razon_social}
              </h1>
              {tercero.nombre_comercial && (
                <p style={{ fontSize:13, color:'#6B7280', margin:0 }}>
                  "{tercero.nombre_comercial}"
                </p>
              )}
              <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'#6B7280' }}>
                  📍 CP {tercero.codigo_postal}
                </span>
                {tercero.email && (
                  <span style={{ fontSize:12, color:'#6B7280' }}>✉️ {tercero.email}</span>
                )}
                {tercero.telefono && (
                  <span style={{ fontSize:12, color:'#6B7280' }}>📞 {tercero.telefono}</span>
                )}
                <span style={{ fontSize:12, color:'#6B7280' }}>
                  🏷️ {REGIMENES[tercero.regimen_fiscal]||tercero.regimen_fiscal||'—'}
                </span>
              </div>
            </div>
            <div style={{ flexShrink:0 }}>
              <ScoreBadge score={relacion?.score_fiscal} semaforo={relacion?.score_semaforo} />
            </div>
          </div>

          {/* Banderas activas */}
          {banderas.length > 0 && (
            <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
              {banderas.map(b => (
                <div key={b.id} style={{ display:'flex', gap:8, padding:'8px 12px',
                  borderRadius:8, alignItems:'flex-start',
                  backgroundColor: b.nivel_urgencia==='critica'?'#FEF2F2':
                    b.nivel_urgencia==='alta'?'#FEF2F2':'#FFFBEB',
                  border:`1px solid ${b.nivel_urgencia==='media'?'#FDE68A':'#FECACA'}` }}>
                  <AlertTriangle size={14} color={b.nivel_urgencia==='media'?'#D97706':'#DC2626'}
                    style={{ flexShrink:0, marginTop:1 }} />
                  <p style={{ fontSize:12, color:'#374151', margin:0 }}>{b.mensaje}</p>
                  <span style={{ fontSize:10, color:'#9CA3AF', marginLeft:'auto', flexShrink:0 }}>
                    {fmtDt(b.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderBottom:'1px solid #E5E7EB', marginBottom:16,
          display:'flex', gap:0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════ TAB: EXPEDIENTE ══════════ */}
        {tab === 'expediente' && (
          <div>
            {/* Botón editar datos de contacto */}
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
              {editando ? (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setEditando(false)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                      borderRadius:8, border:'1px solid #E5E7EB', background:'#fff',
                      color:'#374151', fontSize:13, cursor:'pointer' }}>
                    <X size={13}/> Cancelar
                  </button>
                  <button onClick={guardarEdicion} disabled={saving}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                      borderRadius:8, border:'none', background:'#059669',
                      color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {saving ? <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/>
                             : <Save size={13}/>}
                    Guardar cambios
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditando(true)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                    borderRadius:8, border:'1px solid #E5E7EB', background:'#fff',
                    color:'#374151', fontSize:13, cursor:'pointer' }}>
                  <Edit3 size={13}/> Editar datos de contacto
                </button>
              )}
            </div>

            {/* Datos Fiscales SAT (solo lectura) */}
            <Seccion titulo="Datos Fiscales — CSF SAT" icono="🏛️" borde="#BFDBFE">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
                <Campo label="RFC" valor={tercero.rfc} mono />
                <Campo label="Régimen Fiscal"
                  valor={REGIMENES[tercero.regimen_fiscal]
                    ? `${tercero.regimen_fiscal} — ${REGIMENES[tercero.regimen_fiscal]}`
                    : tercero.regimen_fiscal} />
                <Campo label="Régimen de Capital" valor={tercero.regimen_capital} />
                <Campo label="Nombre Comercial" valor={tercero.nombre_comercial} />
                <Campo label="CP Fiscal" valor={tercero.codigo_postal} />
                <Campo label="Inicio de Operaciones" valor={fmtFecha(tercero.csf_fecha_inicio_ops)} />
                <Campo label="Estatus en el Padrón" valor={tercero.estatus_padron} />
                <Campo label="Último Cambio de Estado" valor={fmtFecha(tercero.fecha_ultimo_cambio)} />
              </div>
              <p style={{ fontSize:11, color:'#9CA3AF', margin:'12px 0 0',
                display:'flex', alignItems:'center', gap:4 }}>
                <Lock size={10}/> Datos extraídos de la CSF — para modificarlos carga una CSF actualizada en la pestaña Documentos
              </p>
            </Seccion>

            {/* Datos de contacto — editables */}
            <Seccion titulo="Datos de Contacto" icono="📬" borde={editando?'#6EE7B7':'#E5E7EB'}>
              {editando ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { key:'email',    label:'Correo Electrónico', type:'email',   ph:'facturacion@empresa.com' },
                    { key:'telefono', label:'Teléfono',           type:'tel',     ph:'10 dígitos' },
                    { key:'nombre_comercial', label:'Nombre Comercial', type:'text', ph:'Opcional' },
                  ].map(({ key, label, type, ph }) => (
                    <div key={key}>
                      <p style={{ fontSize:12, fontWeight:600, color:'#374151', margin:'0 0 4px' }}>{label}</p>
                      <input type={type} value={formEdit[key]} placeholder={ph}
                        onChange={e => setFormEdit(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width:'100%', padding:'8px 12px', fontSize:13,
                          border:'1px solid #D1FAE5', borderRadius:8, outline:'none',
                          boxSizing:'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <p style={{ fontSize:12, fontWeight:600, color:'#374151', margin:'0 0 4px' }}>Tipo de relación</p>
                    <div style={{ display:'flex', gap:6 }}>
                      {[['proveedor','🏭 Proveedor'],['cliente','🤝 Cliente'],['ambos','🔄 Ambos']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setFormEdit(f => ({ ...f, tipo: v }))}
                          style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                            border: formEdit.tipo===v ? '2px solid #1E40AF' : '1px solid #E5E7EB',
                            backgroundColor: formEdit.tipo===v ? '#EFF6FF' : '#fff',
                            color: formEdit.tipo===v ? '#1E40AF' : '#6B7280' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
                  <Campo label="Correo Electrónico" valor={tercero.email} />
                  <Campo label="Teléfono" valor={tercero.telefono} />
                  <Campo label="Tipo de relación"
                    valor={relacion?.tipo ? relacion.tipo.charAt(0).toUpperCase()+relacion.tipo.slice(1) : '—'} />
                  <Campo label="Uso CFDI por Defecto" valor={tercero.uso_cfdi_default} />
                </div>
              )}
            </Seccion>

            {/* Dirección Fiscal */}
            {(() => {
              const dir = tercero.tercero_direcciones?.find(d => d.tipo === 'fiscal')
              if (!dir) return (
                <Seccion titulo="Dirección Fiscal" icono="📍">
                  <p style={{ fontSize:13, color:'#9CA3AF' }}>Sin dirección registrada.</p>
                </Seccion>
              )
              return (
                <Seccion titulo="Dirección Fiscal — Cédula SAT" icono="📍">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14 }}>
                    <Campo label="Tipo de Vialidad" valor={dir.tipo_vialidad} />
                    <Campo label="Vialidad" valor={dir.nombre_vialidad} />
                    <Campo label="Número Exterior" valor={dir.numero_exterior} />
                    <Campo label="Número Interior" valor={dir.numero_interior} />
                    <Campo label="Colonia" valor={dir.colonia} />
                    <Campo label="Localidad" valor={dir.localidad} />
                    <Campo label="Municipio" valor={dir.municipio} />
                    <Campo label="Entidad Federativa" valor={dir.estado} />
                    <Campo label="Código Postal" valor={dir.codigo_postal} />
                    <Campo label="Entre Calle" valor={dir.entre_calle} />
                    <Campo label="Y Calle" valor={dir.y_calle} />
                  </div>
                </Seccion>
              )
            })()}
          </div>
        )}

        {/* ══════════ TAB: DOCUMENTOS ══════════ */}
        {tab === 'documentos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ backgroundColor:'#EFF6FF', borderRadius:10, padding:'12px 14px',
              display:'flex', gap:8, marginBottom:4 }}>
              <Shield size={15} color="#1E40AF" style={{ flexShrink:0, marginTop:1 }}/>
              <p style={{ fontSize:13, color:'#1E40AF', margin:0 }}>
                Sube los documentos del expediente. Cada documento que cargues
                <strong> aumenta el score fiscal</strong> y elimina banderas de alerta.
              </p>
            </div>

            {[
              { tipo:'csf',                label:'Constancia de Situación Fiscal (CSF)', icono:'📄' },
              { tipo:'opinion_32d',        label:'Opinión de Cumplimiento 32-D',         icono:'✅' },
              { tipo:'caratula_bancaria',  label:'Carátula Bancaria',                    icono:'🏦' },
              { tipo:'comprobante_domicilio', label:'Comprobante de Domicilio',          icono:'🏠' },
              { tipo:'csd',                label:'Certificado de Sello Digital (CSD)',   icono:'🔏' },
            ].map(doc => (
              <DocCard key={doc.tipo} {...doc}
                path={docPath(doc.tipo)}
                uploading={uploading === doc.tipo}
                onUpload={subirDocumento}
                rfcEsperado={tercero.rfc} />
            ))}
          </div>
        )}

        {/* ══════════ TAB: SCORE ══════════ */}
        {tab === 'score' && (
          <div>
            <Seccion titulo="Score Fiscal Actual" icono="📊">
              <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16 }}>
                <ScoreBadge score={relacion?.score_fiscal} semaforo={relacion?.score_semaforo} />
                <div>
                  <p style={{ fontSize:12, color:'#6B7280', margin:'0 0 2px' }}>Última actualización</p>
                  <p style={{ fontSize:13, fontWeight:600, margin:0 }}>
                    {fmtDt(relacion?.score_calculado_at)}
                  </p>
                </div>
                <button onClick={recalcular}
                  style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5,
                    padding:'7px 14px', borderRadius:8, border:'1px solid #E5E7EB',
                    background:'#fff', color:'#374151', fontSize:12, cursor:'pointer' }}>
                  <RefreshCw size={12}/> Recalcular ahora
                </button>
              </div>

              {/* Factores del score */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:'CSF cargada',         ok: !!tercero.csf_parseada,       pts:20 },
                  { label:'Opinión 32-D positiva',ok: tercero.opinion_32d_estatus==='positiva', pts:25 },
                  { label:'CSD vigente',          ok: tercero.csd_estatus==='vigente', pts:20 },
                  { label:'CLABE verificada',     ok: !!tercero.clabe_verificada,   pts:15 },
                  { label:'Comprobante domicilio',ok: !!docPath('comprobante_domicilio'), pts:10 },
                  { label:'Carátula bancaria',    ok: !!docPath('caratula_bancaria'), pts:10 },
                ].map(({ label, ok, pts }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:10,
                    padding:'8px 12px', borderRadius:8,
                    backgroundColor: ok?'#F0FDF4':'#F9FAFB',
                    border:`1px solid ${ok?'#D1FAE5':'#E5E7EB'}` }}>
                    {ok
                      ? <CheckCircle size={15} color="#059669" style={{ flexShrink:0 }}/>
                      : <XCircle    size={15} color="#D1D5DB" style={{ flexShrink:0 }}/>}
                    <span style={{ flex:1, fontSize:12, color:'#374151' }}>{label}</span>
                    <span style={{ fontSize:11, fontWeight:700,
                      color: ok?'#059669':'#9CA3AF' }}>+{pts} pts</span>
                  </div>
                ))}
              </div>
            </Seccion>

            {/* Historial */}
            {historial.length > 0 && (
              <Seccion titulo="Historial de Score" icono="📈">
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {historial.slice(0,10).map((h, i) => (
                    <div key={i} style={{ display:'flex', gap:12, padding:'7px 0',
                      borderBottom:'1px solid #F3F4F6', alignItems:'center' }}>
                      <span style={{ fontSize:16, fontWeight:800,
                        color: h.score_nuevo > (h.score_anterior||0) ? '#059669' : '#EF4444',
                        minWidth:36 }}>{h.score_nuevo}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:12, color:'#374151', margin:'0 0 1px' }}>
                          {h.motivo || 'Recálculo'}
                        </p>
                        <p style={{ fontSize:11, color:'#9CA3AF', margin:0 }}>
                          {fmtDt(h.created_at)}
                          {h.score_anterior != null &&
                            ` · Antes: ${h.score_anterior}`}
                        </p>
                      </div>
                      <span style={{ fontSize:11, fontWeight:600,
                        color: h.score_nuevo > (h.score_anterior||0) ? '#059669':'#EF4444' }}>
                        {h.score_nuevo > (h.score_anterior||0) ? '↑' : '↓'}
                        {Math.abs(h.score_nuevo - (h.score_anterior||0))} pts
                      </span>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}
          </div>
        )}

        {/* ══════════ TAB: ACCIONES ══════════ */}
        {tab === 'acciones' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Reactivar si está bloqueado */}
            {bloqueado && (
              <div style={{ backgroundColor:'#FEF2F2', border:'1px solid #FECACA',
                borderRadius:12, padding:'16px 18px' }}>
                <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <Lock size={16} color="#DC2626" style={{ flexShrink:0, marginTop:1 }}/>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'#991B1B', margin:'0 0 3px' }}>
                      {relacion?.motivo_bloqueo?.startsWith('BAJA') ? 'Tercero dado de baja' : 'Tercero suspendido'}
                    </p>
                    <p style={{ fontSize:12, color:'#DC2626', margin:0 }}>
                      {relacion?.motivo_bloqueo}
                    </p>
                  </div>
                </div>
                <button onClick={desbloquear}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
                    borderRadius:8, border:'none', backgroundColor:'#059669',
                    color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  <Unlock size={14}/> Reactivar Tercero
                </button>
              </div>
            )}

            {/* Suspender actividades */}
            {!bloqueado && (
              <div style={{ backgroundColor:'#FFFBEB', border:'1px solid #FDE68A',
                borderRadius:12, padding:'16px 18px' }}>
                <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <Ban size={16} color="#D97706" style={{ flexShrink:0, marginTop:1 }}/>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'#B45309', margin:'0 0 3px' }}>
                      Suspender Actividades
                    </p>
                    <p style={{ fontSize:12, color:'#92400E', margin:0 }}>
                      El tercero quedará bloqueado temporalmente. No podrá usarse en nuevas operaciones
                      pero conserva su historial. Puede reactivarse en cualquier momento.
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalAccion('suspender')}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
                    borderRadius:8, border:'1px solid #FDE68A', backgroundColor:'#fff',
                    color:'#B45309', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  <Ban size={14}/> Suspender Tercero
                </button>
              </div>
            )}

            {/* Dar de Baja */}
            {!bloqueado && (
              <div style={{ backgroundColor:'#FEF2F2', border:'1px solid #FECACA',
                borderRadius:12, padding:'16px 18px' }}>
                <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <Trash2 size={16} color="#DC2626" style={{ flexShrink:0, marginTop:1 }}/>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'#991B1B', margin:'0 0 3px' }}>
                      Dar de Baja
                    </p>
                    <p style={{ fontSize:12, color:'#DC2626', margin:0 }}>
                      Marca al tercero como dado de baja definitiva. Se registra el motivo en el
                      expediente. El historial y documentos se conservan para auditoría.
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalAccion('baja')}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
                    borderRadius:8, border:'none', backgroundColor:'#DC2626',
                    color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  <Trash2 size={14}/> Dar de Baja
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Modal Suspender / Baja ── */}
        {modalAccion && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
            <div style={{ background:'#fff', borderRadius:16, padding:24,
              width:'100%', maxWidth:420, margin:16 }}>
              <h3 style={{ fontSize:16, fontWeight:700, color:'#111827', margin:'0 0 6px' }}>
                {modalAccion === 'suspender' ? '🔒 Suspender Tercero' : '❌ Dar de Baja'}
              </h3>
              <p style={{ fontSize:13, color:'#6B7280', margin:'0 0 16px' }}>
                <strong>{tercero.razon_social}</strong> — {tercero.rfc}
              </p>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151',
                  display:'block', marginBottom:6 }}>
                  {modalAccion === 'suspender' ? 'Motivo de suspensión *' : 'Razón de baja *'}
                </label>
                <textarea value={motivoAccion}
                  onChange={e => setMotivoAccion(e.target.value)}
                  rows={3} placeholder="Describe el motivo..."
                  style={{ width:'100%', padding:'8px 12px', fontSize:13,
                    border:'1px solid #E5E7EB', borderRadius:8, outline:'none',
                    resize:'vertical', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => { setModalAccion(null); setMotivoAccion('') }}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #E5E7EB',
                    background:'#fff', color:'#374151', fontSize:13, cursor:'pointer' }}>
                  Cancelar
                </button>
                <button onClick={ejecutarAccion}
                  style={{ padding:'8px 16px', borderRadius:8, border:'none',
                    background: modalAccion==='suspender' ? '#D97706' : '#DC2626',
                    color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {modalAccion === 'suspender' ? 'Confirmar Suspensión' : 'Confirmar Baja'}
                </button>
              </div>
            </div>
          </div>
        )}

      </MainLayout>
    </RequirePermission>
  )
}

export default TerceroDetail
