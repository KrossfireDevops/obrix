// ============================================================
//  OBRIX ERP — Componente: SyncPanel
//  Archivo: src/components/contabilidad/SyncPanel.jsx
//  Versión: 1.0 | Marzo 2026
//  Modal para iniciar descarga manual de CFDIs del SAT.
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
  X, Download, CheckCircle, AlertTriangle, Clock,
  RefreshCw, Package, FileText, ChevronRight, Loader,
} from 'lucide-react';
import {
  solicitarDescarga, verificarSolicitud, descargarPaquete,
  getSolicitudesDescarga, formatFecha,
} from '../../services/buzonFiscal.service';

const TIPO_COMP_OPCIONES = [
  { value: '',  label: 'Todos los tipos' },
  { value: 'I', label: 'Ingreso (Facturas)' },
  { value: 'E', label: 'Egreso (Notas de crédito)' },
  { value: 'P', label: 'Pago (REP)' },
];

const TIPO_DESCARGA_OPCIONES = [
  { value: 'ambas',    label: 'Emitidas y Recibidas' },
  { value: 'emitidas', label: 'Solo Emitidas' },
  { value: 'recibidas',label: 'Solo Recibidas' },
];

// Estado de solicitud → ícono + color
function EstadoSolicitud({ estado }) {
  const cfg = {
    pendiente:   { icon: Clock,        color: 'text-gray-400',  label: 'Pendiente'   },
    en_proceso:  { icon: Loader,       color: 'text-blue-500 animate-spin', label: 'Procesando' },
    lista:       { icon: CheckCircle,  color: 'text-green-500', label: 'Lista'       },
    error:       { icon: AlertTriangle,color: 'text-red-500',   label: 'Error'       },
    vencida:     { icon: AlertTriangle,color: 'text-amber-500', label: 'Vencida'     },
    rechazada:   { icon: AlertTriangle,color: 'text-red-500',   label: 'Rechazada'   },
  };
  const { icon: Icon, color, label } = cfg[estado] ?? cfg.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

export default function SyncPanel({ config, onClose, onSuccess }) {
  // ── Formulario ────────────────────────────────────────────
  const hoy    = new Date().toISOString().split('T')[0];
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    fechaInicio:    hace30,
    fechaFin:       hoy,
    tipoDescarga:   'ambas',
    tipoComprobante: '',
  });

  // ── Estado del proceso ────────────────────────────────────
  const [paso,         setPaso]         = useState('form');  // 'form' | 'procesando' | 'resultado'
  const [solicitudId,  setSolicitudId]  = useState(null);
  const [resultado,    setResultado]    = useState(null);
  const [error,        setError]        = useState(null);
  const [polling,      setPolling]      = useState(false);

  // ── Historial de descargas recientes ─────────────────────
  const [historial,    setHistorial]    = useState([]);
  const [loadHist,     setLoadHist]     = useState(true);

  useEffect(() => {
    getSolicitudesDescarga(5)
      .then(setHistorial)
      .catch(() => {})
      .finally(() => setLoadHist(false));
  }, []);

  // ── Iniciar descarga ──────────────────────────────────────
  const handleIniciar = async () => {
    setError(null);
    setPaso('procesando');
    try {
      const res = await solicitarDescarga({
        fechaInicio:     form.fechaInicio,
        fechaFin:        form.fechaFin,
        tipoDescarga:    form.tipoDescarga,
        tipoComprobante: form.tipoComprobante || null,
      });
      setSolicitudId(res.solicitud_id);
      setResultado({ fase: 'solicitado', idSat: res.id_solicitud_sat });
      // Iniciar polling automático
      iniciarPolling(res.solicitud_id);
    } catch (e) {
      setError(e.message);
      setPaso('form');
    }
  };

  // ── Polling: verifica la solicitud cada 10 segundos ──────
  const iniciarPolling = (solId) => {
    setPolling(true);
    let intentos = 0;
    const MAX    = 30;  // 30 intentos × 10s = 5 min máximo en UI

    const tick = async () => {
      if (intentos++ >= MAX) {
        setPolling(false);
        setResultado(prev => ({ ...prev, fase: 'timeout' }));
        return;
      }
      try {
        const verif = await verificarSolicitud(solId);
        setResultado(prev => ({ ...prev, fase: verif.estado, ...verif }));

        if (verif.estado === 'lista') {
          setPolling(false);
          // Descargar paquetes automáticamente
          await descargarTodosPaquetes(verif.ids_paquetes ?? [], solId);
        } else if (verif.estado === 'error') {
          setPolling(false);
          setPaso('resultado');
        } else {
          setTimeout(tick, 10000);
        }
      } catch (e) {
        setPolling(false);
        setError(e.message);
      }
    };

    setTimeout(tick, 5000);
  };

  // ── Descargar todos los paquetes ──────────────────────────
  const descargarTodosPaquetes = async (idsPaquetes, solId) => {
    // Obtener IDs de paquetes de BD (por solicitud)
    const { data: paquetes } = await supabase
      .from('sat_paquetes_descarga')
      .select('id, id_paquete_sat, numero_paquete')
      .eq('solicitud_id', solId);

    let totalInsertados = 0;
    const paquetesProc  = [];

    for (const paq of (paquetes ?? [])) {
      try {
        setResultado(prev => ({
          ...prev,
          fase:         'descargando',
          paqueteActual: paq.numero_paquete,
          totalPaquetes: paquetes.length,
        }));
        const res = await descargarPaquete(paq.id);
        totalInsertados += res.insertados ?? 0;
        paquetesProc.push({ ...paq, ...res, ok: true });
      } catch (e) {
        paquetesProc.push({ ...paq, ok: false, error: e.message });
      }
    }

    setResultado(prev => ({
      ...prev,
      fase:           'completado',
      totalInsertados,
      paquetes:       paquetesProc,
    }));
    setPaso('resultado');
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sincronizar con el SAT</h2>
            <p className="text-xs text-gray-500 mt-0.5">RFC: {config?.rfc_emisor ?? '—'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── PASO: Formulario ── */}
          {paso === 'form' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Descarga masiva de CFDIs desde el servicio SOAP del SAT.
                El proceso puede tardar entre 1 y 5 minutos dependiendo del volumen.
              </p>

              {/* Advertencia si no hay e.firma */}
              {(!config?.efirma_cer_url) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    La e.firma no está configurada. Ve a <strong>Configuración → Empresa</strong> y sube el archivo .cer y .key.
                  </p>
                </div>
              )}

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    max={form.fechaFin}
                    onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    min={form.fechaInicio}
                    max={hoy}
                    onChange={e => setForm(p => ({ ...p, fechaFin: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* Tipo de descarga */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de descarga</label>
                <select
                  value={form.tipoDescarga}
                  onChange={e => setForm(p => ({ ...p, tipoDescarga: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {TIPO_DESCARGA_OPCIONES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de comprobante */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de comprobante</label>
                <select
                  value={form.tipoComprobante}
                  onChange={e => setForm(p => ({ ...p, tipoComprobante: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {TIPO_COMP_OPCIONES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {!config?.efirma_cer_url && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">e.firma no configurada</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Para descargar CFDIs del SAT necesitas cargar la e.firma de la empresa
                      (archivo .cer + .key) en <strong>Ajustes → Empresa → e.firma</strong>.
                      La e.firma es diferente al CSD — la emite el SAT para el representante legal.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Historial reciente */}
              {!loadHist && historial.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Descargas recientes</p>
                  <div className="space-y-1.5">
                    {historial.map(sol => (
                      <div key={sol.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                        <span className="text-gray-600">
                          {formatFecha(sol.fecha_inicio)} — {formatFecha(sol.fecha_fin)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400">{sol.total_cfdi_nuevos ?? 0} nuevos</span>
                          <EstadoSolicitud estado={sol.estado_solicitud} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PASO: Procesando ── */}
          {paso === 'procesando' && resultado && (
            <div className="py-4 space-y-5">
              <ProgresoStep
                activo={resultado.fase === 'solicitado' || resultado.fase === 'en_proceso'}
                completado={['lista','descargando','descargando_paquetes','completado'].includes(resultado.fase)}
                numero={1}
                titulo="Solicitud enviada al SAT"
                subtitulo={resultado.idSat ? `ID: ${resultado.idSat.substring(0,20)}…` : 'Enviando…'}
              />
              <ProgresoStep
                activo={resultado.fase === 'en_proceso'}
                completado={['lista','descargando','completado'].includes(resultado.fase)}
                numero={2}
                titulo="SAT procesando solicitud"
                subtitulo={resultado.fase === 'en_proceso' ? 'Verificando cada 10 segundos…' : resultado.num_cfdis ? `${resultado.num_cfdis} CFDIs encontrados` : ''}
              />
              <ProgresoStep
                activo={resultado.fase === 'descargando'}
                completado={resultado.fase === 'completado'}
                numero={3}
                titulo="Descargando paquetes"
                subtitulo={
                  resultado.fase === 'descargando'
                    ? `Paquete ${resultado.paqueteActual ?? 1} de ${resultado.totalPaquetes ?? '?'}…`
                    : resultado.fase === 'completado'
                    ? `${resultado.totalInsertados ?? 0} CFDIs importados`
                    : ''
                }
              />
            </div>
          )}

          {/* ── PASO: Resultado ── */}
          {paso === 'resultado' && resultado && (
            <div className="py-2 space-y-4">
              {resultado.fase === 'completado' ? (
                <>
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle size={24} className="text-green-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">Sincronización completada</p>
                      <p className="text-sm text-green-700 mt-0.5">
                        {resultado.totalInsertados ?? 0} CFDIs importados correctamente
                      </p>
                    </div>
                  </div>

                  {/* Detalle por paquete */}
                  {resultado.paquetes?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Detalle por paquete</p>
                      {resultado.paquetes.map((paq, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-gray-400" />
                            <span className="text-gray-600">Paquete {paq.numero_paquete}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{paq.insertados ?? 0} nuevos</span>
                            <span>{paq.duplicados ?? 0} duplicados</span>
                            {paq.con_error > 0 && (
                              <span className="text-red-500">{paq.con_error} errores</span>
                            )}
                            {paq.ok
                              ? <CheckCircle size={12} className="text-green-500" />
                              : <AlertTriangle size={12} className="text-red-500" />
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={24} className="text-red-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800">Error en la sincronización</p>
                    <p className="text-sm text-red-700 mt-0.5">{error ?? 'Revisa el estado en la tabla de solicitudes.'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          {paso === 'form' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              {!config?.efirma_cer_url ? (
                <a
                  href="/settings/company"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                  onClick={onClose}
                >
                  ⚙️ Configurar e.firma en Ajustes
                </a>
              ) : (
                <button
                  onClick={handleIniciar}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Download size={15} />
                  Iniciar descarga
                </button>
              )}
            </>
          )}

          {paso === 'procesando' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cerrar (continúa en segundo plano)
            </button>
          )}

          {paso === 'resultado' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={onSuccess}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                Ver CFDIs importados
                <ChevronRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente: Paso de progreso ─────────────────────────
function ProgresoStep({ numero, titulo, subtitulo, activo, completado }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`
        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5
        ${completado ? 'bg-green-500 text-white'
          : activo    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
          :             'bg-gray-100 text-gray-400'}
      `}>
        {completado ? <CheckCircle size={14} /> : numero}
      </div>
      <div>
        <p className={`text-sm font-medium ${activo ? 'text-indigo-700' : completado ? 'text-green-700' : 'text-gray-400'}`}>
          {titulo}
        </p>
        {subtitulo && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}