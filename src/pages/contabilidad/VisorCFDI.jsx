// ============================================================
//  OBRIX ERP — Página: VisorCFDI
//  Archivo: src/pages/contabilidad/VisorCFDI.jsx
//  Versión: 1.0 | Marzo 2026
//  Ruta: /contabilidad/buzon/:uuid
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Copy, ExternalLink, ShieldCheck,
  CheckCircle, XCircle, Clock, AlertTriangle, CreditCard,
  Package, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import {
  getCfdiDetalle, verificarCfdi,
  formatMXN, formatFecha,
  TIPO_COMPROBANTE_LABEL, FORMA_PAGO_LABEL, METODO_PAGO_LABEL,
} from '../../services/buzonFiscal.service'
import { MainLayout } from '../../components/layout/MainLayout';

export default function VisorCFDI() {
  const { uuid }  = useParams();
  const navigate  = useNavigate();

  const [cfdi,      setCfdi]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [verif,     setVerif]     = useState(null);
  const [verifLoad, setVerifLoad] = useState(false);
  const [showXml,   setShowXml]   = useState(false);
  const [showConc,  setShowConc]  = useState(true);

  useEffect(() => {
    if (!uuid) return;
    getCfdiDetalle(uuid)
      .then(setCfdi)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [uuid]);

  const handleVerificar = async () => {
    if (!cfdi) return;
    setVerifLoad(true);
    try {
      const res = await verificarCfdi({
        uuidCfdi:    cfdi.uuid_cfdi,
        emisorRfc:   cfdi.emisor_rfc,
        receptorRfc: cfdi.receptor_rfc,
        total:       cfdi.total,
      });
      setVerif(res);
    } catch (e) {
      setVerif({ error: e.message });
    } finally {
      setVerifLoad(false);
    }
  };

  const copiar = (texto) => navigator.clipboard?.writeText(texto);

  // ── Loading ───────────────────────────────────────────────
  if (loading) return (
    <MainLayout title="📄 Visor CFDI">
      <div className="flex justify-center py-24">
        <RefreshCw size={24} className="text-indigo-500 animate-spin" />
      </div>
    </MainLayout>
  );

  // ── Error ─────────────────────────────────────────────────
  if (error || !cfdi) return (
    <MainLayout title="📄 Visor CFDI">
      <div className="flex justify-center py-24">
        <div className="text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-gray-600">{error ?? 'CFDI no encontrado'}</p>
          <button onClick={() => navigate(-1)}
            className="mt-3 text-sm text-indigo-600 hover:underline">
            ← Volver
          </button>
        </div>
      </div>
    </MainLayout>
  );

  const tituloVisor = `📄 ${TIPO_COMPROBANTE_LABEL[cfdi.tipo_comprobante] ?? 'CFDI'}${cfdi.serie ? ' · ' + cfdi.serie : ''}${cfdi.folio ?? ''}`

  return (
    <MainLayout title={tituloVisor}>
      <div className="max-w-5xl mx-auto space-y-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/contabilidad/buzon')}
            className="flex items-center gap-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerificar}
              disabled={verifLoad}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {verifLoad
                ? <RefreshCw size={14} className="animate-spin" />
                : <ShieldCheck size={14} className="text-green-500" />
              }
              Verificar en SAT
            </button>
            {cfdi.xml_url && (
              <a
                href={cfdi.xml_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ExternalLink size={14} />
                Ver XML
              </a>
            )}
          </div>
        </div>

        {/* Resultado verificación SAT */}
        {verif && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            verif.error
              ? 'bg-red-50 border-red-200'
              : verif.estado === 'Vigente'
              ? 'bg-green-50 border-green-200'
              : verif.estado === 'Cancelado'
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            {verif.error
              ? <AlertTriangle size={18} className="text-red-500" />
              : verif.estado === 'Vigente'
              ? <CheckCircle size={18} className="text-green-500" />
              : <XCircle size={18} className="text-red-500" />
            }
            <div>
              <p className="text-sm font-semibold text-gray-900">
                SAT: {verif.error ?? verif.estado}
              </p>
              {verif.codigoEstatus && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Código: {verif.codigoEstatus}
                  {verif.esCancelable !== 'No cancelable' && ` · ${verif.esCancelable}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Datos principales + Importes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* UUID y fechas */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos del Comprobante</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Campo label="UUID" valor={
                <button
                  onClick={() => copiar(cfdi.uuid_cfdi)}
                  className="flex items-center gap-1.5 font-mono text-xs text-indigo-600 hover:text-indigo-800"
                  title="Copiar UUID"
                >
                  {cfdi.uuid_cfdi}
                  <Copy size={11} />
                </button>
              } />
              <Campo label="Versión CFDI"        valor={cfdi.version_cfdi} />
              <Campo label="Fecha de emisión"    valor={formatFecha(cfdi.fecha_emision)} />
              <Campo label="Fecha de timbrado"   valor={formatFecha(cfdi.tfd_fecha_timbrado)} />
              <Campo label="Tipo de comprobante" valor={`${TIPO_COMPROBANTE_LABEL[cfdi.tipo_comprobante]} (${cfdi.tipo_comprobante})`} />
              <Campo label="Dirección"           valor={cfdi.direccion === 'recibida' ? '📥 Recibida' : '📤 Emitida'} />
              <Campo label="Método de pago"      valor={cfdi.metodo_pago ? `${cfdi.metodo_pago} — ${METODO_PAGO_LABEL[cfdi.metodo_pago] ?? ''}` : '—'} />
              <Campo label="Forma de pago"       valor={cfdi.forma_pago  ? `${cfdi.forma_pago} — ${FORMA_PAGO_LABEL[cfdi.forma_pago]  ?? ''}` : '—'} />
              <Campo label="Moneda"              valor={cfdi.moneda} />
              {cfdi.moneda !== 'MXN' && (
                <Campo label="Tipo de cambio"    valor={cfdi.tipo_cambio} />
              )}
              <Campo label="Lugar de expedición" valor={cfdi.lugar_expedicion ?? '—'} />
              <Campo label="Estatus SAT"         valor={
                <span className={`font-medium ${cfdi.cancelado ? 'text-red-600' : 'text-green-600'}`}>
                  {cfdi.cancelado ? '❌ Cancelado' : '✅ Vigente'} ({cfdi.estatus_sat})
                </span>
              } />
            </div>
          </div>

          {/* Importes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Importes</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium text-gray-800">{formatMXN(cfdi.subtotal)}</span>
              </div>
              {cfdi.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Descuento</span>
                  <span className="font-medium text-red-600">-{formatMXN(cfdi.descuento)}</span>
                </div>
              )}
              {cfdi.total_impuestos_tras > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA trasladado</span>
                  <span className="font-medium text-gray-800">{formatMXN(cfdi.total_impuestos_tras)}</span>
                </div>
              )}
              {cfdi.total_impuestos_ret > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Impuestos retenidos</span>
                  <span className="font-medium text-red-600">-{formatMXN(cfdi.total_impuestos_ret)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2.5 flex justify-between">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">{formatMXN(cfdi.total)}</span>
              </div>
              {cfdi.moneda !== 'MXN' && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Total MXN</span>
                  <span>{formatMXN(cfdi.total_mxn)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emisor / Receptor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ParticipanteCard
            titulo="Emisor"
            rfc={cfdi.emisor_rfc}
            nombre={cfdi.emisor_nombre}
            regimen={cfdi.emisor_regimen}
          />
          <ParticipanteCard
            titulo="Receptor"
            rfc={cfdi.receptor_rfc}
            nombre={cfdi.receptor_nombre}
            usoCfdi={cfdi.receptor_uso_cfdi}
            domicilio={cfdi.receptor_domicilio_fiscal}
          />
        </div>

        {/* Conceptos */}
        {cfdi.cfdi_conceptos?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowConc(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Package size={15} className="text-indigo-400" />
                Conceptos ({cfdi.cfdi_conceptos.length})
              </h2>
              {showConc
                ? <ChevronUp   size={15} className="text-gray-400" />
                : <ChevronDown size={15} className="text-gray-400" />
              }
            </button>
            {showConc && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#','Clave','Descripción','Cant.','Val. Unit.','Importe'].map(h => (
                        <th
                          key={h}
                          className={`px-4 py-2 text-xs text-gray-500 font-semibold uppercase ${
                            ['Cant.','Val. Unit.','Importe'].includes(h) ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cfdi.cfdi_conceptos.map((c, i) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.clave_prod_serv ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700 max-w-xs">{c.descripcion}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{c.cantidad} {c.clave_unidad ?? ''}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatMXN(c.valor_unitario)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatMXN(c.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Complemento REP */}
        {cfdi.cfdi_complementos?.[0] && cfdi.tipo_comprobante === 'P' && (
          <RepCard rep={cfdi.cfdi_complementos[0]} />
        )}

        {/* XML raw */}
        {cfdi.xml_raw && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowXml(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText size={15} className="text-gray-400" />
                XML del CFDI
              </h2>
              {showXml
                ? <ChevronUp   size={15} className="text-gray-400" />
                : <ChevronDown size={15} className="text-gray-400" />
              }
            </button>
            {showXml && (
              <pre className="px-5 py-4 text-xs font-mono text-gray-600 bg-gray-50 border-t border-gray-100 overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
                {cfdi.xml_raw}
              </pre>
            )}
          </div>
        )}

      </div>
    </MainLayout>
  );
}

// ============================================================
//  SUB-COMPONENTES
// ============================================================

function Campo({ label, valor }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{valor ?? '—'}</p>
    </div>
  );
}

function ParticipanteCard({ titulo, rfc, nombre, regimen, usoCfdi, domicilio }) {
  const esEmisor = titulo === 'Emisor';
  return (
    <div className={`bg-white rounded-xl border p-5 ${esEmisor ? 'border-blue-100' : 'border-teal-100'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${esEmisor ? 'text-blue-500' : 'text-teal-500'}`}>
        {titulo}
      </p>
      <p className="font-semibold text-gray-900 text-sm">{nombre ?? '—'}</p>
      <p className="font-mono text-xs text-gray-500 mt-0.5">{rfc}</p>
      {regimen   && <p className="text-xs text-gray-400 mt-2">Régimen: {regimen}</p>}
      {usoCfdi   && <p className="text-xs text-gray-400 mt-1">Uso CFDI: {usoCfdi}</p>}
      {domicilio && <p className="text-xs text-gray-400 mt-1">CP Fiscal: {domicilio}</p>}
    </div>
  );
}

function RepCard({ rep }) {
  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
      <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-4">
        <CreditCard size={15} />
        Complemento de Pago (REP)
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        <Campo label="Fecha de pago"         valor={formatFecha(rep.rep_fecha_pago)} />
        <Campo label="Forma de pago"         valor={rep.rep_forma_pago} />
        <Campo label="Monto pagado"          valor={formatMXN(rep.rep_monto)} />
        <Campo label="UUID doc. relacionado" valor={
          rep.rep_uuid_doc_rel
            ? <span className="font-mono text-xs">{rep.rep_uuid_doc_rel.substring(0, 20)}…</span>
            : '—'
        } />
        <Campo label="Parcialidad"           valor={rep.rep_num_parcialidad} />
        <Campo label="Saldo insoluto"        valor={formatMXN(rep.rep_imp_saldo_ins)} />
        {rep.rep_iva_traslado > 0 && (
          <Campo label="IVA pagado"    valor={formatMXN(rep.rep_iva_traslado)} />
        )}
        {rep.rep_isr_retenido > 0 && (
          <Campo label="ISR retenido"  valor={formatMXN(rep.rep_isr_retenido)} />
        )}
      </div>
    </div>
  );
}
