// ============================================================
//  OBRIX ERP — Componente: TablaCFDI
//  Archivo: src/components/contabilidad/TablaCFDI.jsx
//  Versión: 1.0 | Marzo 2026
//  Usado por: BuzonFiscal.jsx en las 4 tabs
// ============================================================

import { useState } from 'react';
import {
  Search, Filter, Download, Eye, ShieldCheck,
  ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Clock, AlertCircle, Copy, ExternalLink,
} from 'lucide-react';
import { formatMXN, formatFecha, TIPO_COMPROBANTE_LABEL, verificarCfdi } from '../../services/buzonFiscal.service';

const PAGE_SIZE = 50;

// ── Helpers ────────────────────────────────────────────────

function EstatusBadge({ estatus, cancelado }) {
  if (cancelado || estatus === 'cancelado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
        <XCircle size={10} />
        Cancelado
      </span>
    );
  }
  if (estatus === 'vigente') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
        <CheckCircle size={10} />
        Vigente
      </span>
    );
  }
  if (estatus === 'cancelacion_pendiente') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
        <Clock size={10} />
        Canc. pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
      <AlertCircle size={10} />
      {estatus ?? 'N/D'}
    </span>
  );
}

function ContabilizadoBadge({ contabilizado }) {
  return contabilizado ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-200">
      <CheckCircle size={10} />
      Contabilizado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
      <Clock size={10} />
      Pendiente
    </span>
  );
}

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

export default function TablaCFDI({
  cfdis,
  total,
  loading,
  tab,
  page,
  pageSize = PAGE_SIZE,
  onPageChange,
  onFiltrosChange,
  onVerDetalle,
}) {
  const [busqueda,      setBusqueda]      = useState('');
  const [verificando,   setVerificando]   = useState(null);  // uuid en verificación
  const [verifyResult,  setVerifyResult]  = useState({});    // uuid → resultado

  const totalPaginas = Math.ceil(total / pageSize);

  // ── Búsqueda local (filtra por RFC, folio, razón social) ──
  const handleBusqueda = (val) => {
    setBusqueda(val);
    // Detectar si es RFC (formato alfanumérico sin espacios) o folio/UUID o texto libre
    const esRfcOUuid = val && /^[A-Z0-9&Ñ-]{3,}$/i.test(val.trim())
    onFiltrosChange({
      rfc:   esRfcOUuid ? val || undefined : undefined,
      folio: val || undefined,  // siempre busca por folio/UUID también
    });
  };

  // ── Verificar un CFDI en el SAT ───────────────────────────
  const handleVerificar = async (cfdi) => {
    setVerificando(cfdi.uuid_cfdi);
    try {
      const res = await verificarCfdi({
        uuidCfdi:    cfdi.uuid_cfdi,
        emisorRfc:   cfdi.emisor_rfc,
        receptorRfc: cfdi.receptor_rfc,
        total:       cfdi.total,
      });
      setVerifyResult(prev => ({ ...prev, [cfdi.uuid_cfdi]: res }));
    } catch (e) {
      setVerifyResult(prev => ({ ...prev, [cfdi.uuid_cfdi]: { error: e.message } }));
    } finally {
      setVerificando(null);
    }
  };

  // ── Copiar UUID al portapapeles ───────────────────────────
  const copiarUUID = (uuid) => {
    navigator.clipboard?.writeText(uuid);
  };

  // ── Exportar tabla como CSV ───────────────────────────────
  const exportarCSV = () => {
    const headers = ['UUID','Fecha','Emisor RFC','Emisor Nombre','Receptor RFC','Receptor Nombre','Serie-Folio','Total MXN','Estatus'];
    const rows = cfdis.map(c => [
      c.uuid_cfdi,
      formatFecha(c.fecha_emision),
      c.emisor_rfc,
      c.emisor_nombre ?? '',
      c.receptor_rfc,
      c.receptor_nombre ?? '',
      `${c.serie ?? ''}${c.folio ?? ''}`,
      c.total_mxn ?? c.total,
      c.estatus_sat,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cfdis_${tab}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar RFC, folio, UUID…"
              value={busqueda}
              onChange={e => handleBusqueda(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-64"
            />
          </div>
          <span className="text-sm text-gray-400">
            {total.toLocaleString('es-MX')} registros
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportarCSV}
            disabled={cfdis.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Cargando…</span>
          </div>
        ) : cfdis.length === 0 ? (
          <EmptyState tab={tab} busqueda={busqueda} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {tab === 'emitidas' ? 'Receptor' : 'Emisor'}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Serie / Folio</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total MXN</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estatus</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contab.</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cfdis.map(cfdi => {
                const contraparte = tab === 'emitidas'
                  ? { rfc: cfdi.receptor_rfc, nombre: cfdi.receptor_nombre ?? cfdi.terceros?.razon_social }
                  : { rfc: cfdi.emisor_rfc,   nombre: cfdi.emisor_nombre  ?? cfdi.terceros?.razon_social };

                const vr = verifyResult[cfdi.uuid_cfdi];

                return (
                  <tr
                    key={cfdi.id}
                    className={`hover:bg-gray-50 transition-colors ${cfdi.cancelado ? 'opacity-60' : ''}`}
                  >
                    {/* Fecha */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatFecha(cfdi.fecha_emision)}
                    </td>

                    {/* Contraparte */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900 truncate text-xs">
                        {contraparte.nombre ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">{contraparte.rfc}</p>
                    </td>

                    {/* Serie / Folio */}
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {cfdi.serie ?? ''}{cfdi.folio ?? '—'}
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {TIPO_COMPROBANTE_LABEL[cfdi.tipo_comprobante] ?? cfdi.tipo_comprobante}
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {formatMXN(cfdi.total_mxn ?? cfdi.total)}
                      {cfdi.moneda !== 'MXN' && (
                        <span className="block text-xs text-gray-400 font-normal">
                          {cfdi.moneda}
                        </span>
                      )}
                    </td>

                    {/* Estatus */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <EstatusBadge estatus={cfdi.estatus_sat} cancelado={cfdi.cancelado} />
                        {vr && !vr.error && (
                          <span className="text-xs text-gray-400">SAT: {vr.estado}</span>
                        )}
                        {vr?.error && (
                          <span className="text-xs text-red-500">{vr.error}</span>
                        )}
                      </div>
                    </td>

                    {/* Contabilizado */}
                    <td className="px-4 py-3">
                      <ContabilizadoBadge contabilizado={cfdi.contabilizado} />
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Ver detalle */}
                        <button
                          onClick={() => onVerDetalle(cfdi.uuid_cfdi)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Copiar UUID */}
                        <button
                          onClick={() => copiarUUID(cfdi.uuid_cfdi)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={`Copiar UUID: ${cfdi.uuid_cfdi}`}
                        >
                          <Copy size={14} />
                        </button>

                        {/* Verificar en SAT */}
                        <button
                          onClick={() => handleVerificar(cfdi)}
                          disabled={verificando === cfdi.uuid_cfdi}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                          title="Verificar estatus en el SAT"
                        >
                          {verificando === cfdi.uuid_cfdi
                            ? <div className="w-3.5 h-3.5 border border-green-400 border-t-transparent rounded-full animate-spin" />
                            : <ShieldCheck size={14} />
                          }
                        </button>

                        {/* Ver XML original */}
                        {cfdi.xml_url && (
                          <a
                            href={cfdi.xml_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver XML original"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPaginas} · {total.toLocaleString('es-MX')} registros
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {/* Páginas cercanas */}
            {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => {
              const pg = Math.max(1, Math.min(page - 2, totalPaginas - 4)) + i;
              return pg <= totalPaginas ? (
                <button
                  key={pg}
                  onClick={() => onPageChange(pg)}
                  className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                    pg === page
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pg}
                </button>
              ) : null;
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPaginas}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab, busqueda }) {
  const mensajes = {
    recibidas:     'No hay facturas recibidas en este período',
    emitidas:      'No hay facturas emitidas en este período',
    rep:           'No hay REPs / Complementos de Pago en este período',
    cancelaciones: 'No hay CFDIs cancelados en este período',
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
        <Search size={20} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">
        {busqueda ? `Sin resultados para "${busqueda}"` : mensajes[tab]}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Usa el botón "Sincronizar SAT" para descargar CFDIs
      </p>
    </div>
  );
}