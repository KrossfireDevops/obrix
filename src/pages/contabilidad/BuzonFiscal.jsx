// ============================================================
//  OBRIX ERP — Módulo 2: Buzón Fiscal SAT
//  Archivo: src/pages/contabilidad/BuzonFiscal.jsx
//  Versión: 1.0 | Marzo 2026
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, Send, CreditCard, XCircle, RefreshCw,
  AlertTriangle, CheckCircle, Clock, Download,
  TrendingUp, TrendingDown, FileText, Wifi, WifiOff,
  ChevronDown, Settings, Calendar,
} from 'lucide-react';
import {
  getBuzonStats, getCfdis, getConfigFiscal,
  getRangoUltimos30Dias, formatMXN,
} from '../../services/buzonFiscal.service';
import TablaCFDI from '../../components/contabilidad/TablaCFDI';
import SyncPanel from '../../components/contabilidad/SyncPanel';
import { MainLayout } from '../../components/layout/MainLayout';

// ── Constantes ───────────────────────────────────────────────
const TABS = [
  { id: 'recibidas',     label: 'Recibidas',     icon: Inbox,    tipo: 'I', dir: 'recibida',  color: 'blue'   },
  { id: 'emitidas',      label: 'Emitidas',      icon: Send,     tipo: 'I', dir: 'emitida',   color: 'teal'   },
  { id: 'rep',           label: 'REP / Pagos',   icon: CreditCard, tipo: 'P', dir: null,      color: 'amber'  },
  { id: 'cancelaciones', label: 'Cancelaciones', icon: XCircle,  tipo: null, dir: null, cancelado: true, color: 'red' },
];

const COLOR_MAP = {
  blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200',  dot: 'bg-blue-500'  },
  teal:  { bg: 'bg-teal-50',  text: 'text-teal-700',  border: 'border-teal-200',  dot: 'bg-teal-500'  },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  red:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200',   dot: 'bg-red-500'   },
};

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================

export default function BuzonFiscal() {
  const navigate = useNavigate();

  // ── Estado ────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState('recibidas');
  const [showSync,    setShowSync]    = useState(false);
  const [stats,       setStats]       = useState(null);
  const [config,      setConfig]      = useState(null);
  const [cfdis,       setCfdis]       = useState([]);
  const [totalCfdis,  setTotalCfdis]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingTab,  setLoadingTab]  = useState(false);
  const [error,       setError]       = useState(null);
  const [page,        setPage]        = useState(1);
  const [filtros,     setFiltros]     = useState({});

  const { fechaDesde, fechaHasta } = getRangoUltimos30Dias();
  const [rango, setRango] = useState({ desde: fechaDesde, hasta: fechaHasta });

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    cargarCfdis();
  }, [activeTab, page, filtros, rango]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [statsData, configData] = await Promise.all([
        getBuzonStats(rango.desde, rango.hasta),
        getConfigFiscal(),
      ]);
      setStats(statsData);
      setConfig(configData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarCfdis = useCallback(async () => {
    try {
      setLoadingTab(true);
      const tab = TABS.find(t => t.id === activeTab);
      const { data, count } = await getCfdis({
        direccion:        tab.dir,
        tipo_comprobante: tab.tipo,
        cancelado:        tab.cancelado,
        fecha_desde:      rango.desde,
        fecha_hasta:      rango.hasta,
        page,
        pageSize: 50,
        ...filtros,
      });
      setCfdis(data);
      setTotalCfdis(count);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingTab(false);
    }
  }, [activeTab, page, filtros, rango]);

  const handleRefresh = () => {
    cargarDatos();
    cargarCfdis();
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <MainLayout title="📥 Buzón Fiscal SAT">
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <RefreshCw size={28} className="text-indigo-500 animate-spin" />
        <p className="text-sm text-gray-500">Cargando Buzón Fiscal…</p>
      </div>
    </MainLayout>
  );

  if (error) return (
    <MainLayout title="📥 Buzón Fiscal SAT">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="bg-white p-8 rounded-xl border border-red-200 max-w-md text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Error al cargar el buzón</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={cargarDatos}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
            Reintentar
          </button>
        </div>
      </div>
    </MainLayout>
  );

  const tabActual = TABS.find(t => t.id === activeTab);

  return (
    <MainLayout title="📥 Buzón Fiscal SAT">
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* RFC emisor */}
          {config?.rfc_emisor && (
            <p className="text-sm text-gray-500 flex-1">
              RFC: <span className="font-mono font-medium text-gray-700">{config.rfc_emisor}</span>
              {' · '}{config.razon_social_emisor}
              {config.sat_ultimo_sync && (
                <span className="ml-3 text-xs text-gray-400">
                  Último sync: {new Date(config.sat_ultimo_sync).toLocaleString('es-MX')}
                </span>
              )}
            </p>
          )}
          <SyncStatusBadge config={config} />
          <RangoSelector rango={rango} onChange={r => { setRango(r); setPage(1); }} />
          <button
            onClick={() => setShowSync(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download size={15} /> Sincronizar SAT
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── KPIs ── */}
        {stats && <KpisRow stats={stats} onTabClick={setActiveTab} />}

        {/* ── Alertas ── */}
        <AlertasBuzon stats={stats} />

        {/* ── Tabs ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <nav className="flex gap-1 px-4 border-b border-gray-100" aria-label="Tabs">
            {TABS.map(tab => {
              const Icon    = tab.icon;
              const colors  = COLOR_MAP[tab.color];
              const activo  = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setPage(1); setFiltros({}); }}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activo
                      ? `border-indigo-600 text-indigo-600`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon size={15} />
                  {tab.label}
                  <ContadorTab stats={stats} tabId={tab.id} />
                </button>
              );
            })}
          </nav>

          {/* ── Tabla de CFDIs ── */}
          <div className="p-4">
            <TablaCFDI
              cfdis={cfdis}
              total={totalCfdis}
              loading={loadingTab}
              tab={activeTab}
              page={page}
              pageSize={50}
              onPageChange={setPage}
              onFiltrosChange={f => { setFiltros(f); setPage(1); }}
              onVerDetalle={uuid => navigate(`/contabilidad/buzon/${uuid}`)}
            />
          </div>
        </div>

        {/* ── Panel Sincronización (modal) ── */}
        {showSync && (
          <SyncPanel
            config={config}
            onClose={() => setShowSync(false)}
            onSuccess={() => { setShowSync(false); handleRefresh(); }}
          />
        )}
      </div>
    </MainLayout>
  );
}

// ============================================================
//  SUB-COMPONENTES
// ============================================================

function KpisRow({ stats, onTabClick }) {
  const kpis = [
    {
      label:    'Recibidas',
      valor:    stats.total_recibidas ?? 0,
      monto:    stats.monto_recibidas_mxn,
      icon:     Inbox,
      color:    'blue',
      tabId:    'recibidas',
      trend:    'down',
    },
    {
      label:    'Emitidas',
      valor:    stats.total_emitidas ?? 0,
      monto:    stats.monto_emitidas_mxn,
      icon:     Send,
      color:    'teal',
      tabId:    'emitidas',
      trend:    'up',
    },
    {
      label:    'REP / Pagos',
      valor:    stats.total_rep ?? 0,
      monto:    null,
      icon:     CreditCard,
      color:    'amber',
      tabId:    'rep',
    },
    {
      label:    'Canceladas',
      valor:    stats.total_canceladas ?? 0,
      monto:    null,
      icon:     XCircle,
      color:    'red',
      tabId:    'cancelaciones',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
      {kpis.map(kpi => {
        const Icon   = kpi.icon;
        const colors = COLOR_MAP[kpi.color];
        return (
          <button
            key={kpi.tabId}
            onClick={() => onTabClick(kpi.tabId)}
            className={`
              text-left p-4 rounded-xl border transition-all hover:shadow-md
              ${colors.bg} ${colors.border}
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                {kpi.label}
              </span>
              <Icon size={16} className={colors.text} />
            </div>
            <p className={`text-3xl font-bold ${colors.text}`}>
              {kpi.valor.toLocaleString('es-MX')}
            </p>
            {kpi.monto != null && (
              <p className={`text-sm mt-1 font-medium ${colors.text} opacity-80`}>
                {formatMXN(kpi.monto)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function AlertasBuzon({ stats }) {
  if (!stats) return null;
  const alertas = [];

  if (stats.cfdi_sin_tercero > 0) {
    alertas.push({
      tipo:   'warning',
      texto:  `${stats.cfdi_sin_tercero} CFDI${stats.cfdi_sin_tercero > 1 ? 's' : ''} sin tercero vinculado`,
      accion: 'Ir a Directorio de Terceros',
    });
  }
  if (stats.cfdi_sin_contabilizar > 0) {
    alertas.push({
      tipo:   'info',
      texto:  `${stats.cfdi_sin_contabilizar} CFDI${stats.cfdi_sin_contabilizar > 1 ? 's' : ''} pendientes de contabilizar`,
      accion: null,
    });
  }

  if (alertas.length === 0) return null;

  return (
    <div className="px-6 py-2 flex flex-wrap gap-2">
      {alertas.map((a, i) => (
        <div
          key={i}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-sm
            ${a.tipo === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
            }
          `}
        >
          <AlertTriangle size={14} />
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

function ContadorTab({ stats, tabId }) {
  if (!stats) return null;
  const mapa = {
    recibidas:     stats.total_recibidas,
    emitidas:      stats.total_emitidas,
    rep:           stats.total_rep,
    cancelaciones: stats.total_canceladas,
  };
  const n = mapa[tabId];
  if (!n) return null;
  return (
    <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
      {n.toLocaleString('es-MX')}
    </span>
  );
}

function SyncStatusBadge({ config }) {
  if (!config) return null;
  return config.sat_sync_activo ? (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700">
      <Wifi size={12} />
      Sync activo
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-500">
      <WifiOff size={12} />
      Sync inactivo
    </div>
  );
}

function RangoSelector({ rango, onChange }) {
  const opciones = [
    { label: 'Últimos 30 días', dias: 30 },
    { label: 'Mes actual',      dias: null, mesActual: true },
    { label: 'Últimos 3 meses', dias: 90  },
    { label: 'Últimos 6 meses', dias: 180 },
  ];

  const seleccionar = (op) => {
    const hoy    = new Date();
    let   inicio = new Date();
    if (op.mesActual) {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else {
      inicio.setDate(hoy.getDate() - op.dias);
    }
    onChange({
      desde: inicio.toISOString().split('T')[0],
      hasta: hoy.toISOString().split('T')[0],
    });
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors">
        <Calendar size={14} />
        {new Date(rango.desde).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
        {' — '}
        {new Date(rango.hasta).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
        <ChevronDown size={13} />
      </button>
      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
        {opciones.map(op => (
          <button
            key={op.label}
            onClick={() => seleccionar(op)}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── fin BuzonFiscal ──