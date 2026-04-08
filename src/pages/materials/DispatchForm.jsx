// src/pages/materials/DispatchForm.jsx
import { useState, useEffect } from 'react';
import { getStockForRequest, createDispatch, getDispatchesByRequest } from '../../services/dispatches.service';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const fmtNum = (n) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * DispatchForm
 *
 * Props:
 *   request   – objeto de la solicitud RECIBIDA (debe tener id, folio, project_id, company_id)
 *   onClose   – función para cerrar el modal
 *   onSuccess – callback cuando el despacho se creó correctamente
 */
export default function DispatchForm({ request, onClose, onSuccess }) {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('dispatch'); // 'dispatch' | 'history'

  // ── Carga de stock + historial ───────────────────────────────────────────
  useEffect(() => {
    if (!request?.id) return;
    (async () => {
      setLoading(true);
      try {
        const [stockData, histData] = await Promise.all([
          getStockForRequest(request.id),
          getDispatchesByRequest(request.id),
        ]);
        setItems(stockData);
        setHistory(histData);
      } catch (err) {
        showToast(`Error al cargar datos: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [request?.id]);

  // ── Actualizar cantidad a despachar ──────────────────────────────────────
  const handleQtyChange = (index, value) => {
    const qty = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const clamped = Math.min(Math.max(0, qty), item.stock_available);
        return { ...item, quantity_to_dispatch: clamped };
      })
    );
  };

  // ── Calcular totales en tiempo real ─────────────────────────────────────
  const totals = items.reduce(
    (acc, item) => {
      const qty = item.quantity_to_dispatch || 0;
      const cost = (item.unit_price || 0) * qty;
      const sale = (item.sale_price_obra || 0) * qty;
      return {
        cost: acc.cost + cost,
        sale: acc.sale + sale,
        margin: acc.margin + (sale - cost),
      };
    },
    { cost: 0, sale: 0, margin: 0 }
  );

  const hasItems = items.some((i) => (i.quantity_to_dispatch || 0) > 0);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!hasItems) {
      showToast('Ingresa al menos una cantidad mayor a 0.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const dispatchItems = items
        .filter((i) => i.quantity_to_dispatch > 0)
        .map((i) => ({
          material_id: i.material_id,
          warehouse_id: i.warehouse_id,
          quantity: i.quantity_to_dispatch,
          unit_cost: i.unit_price,
          sale_price_obra: i.sale_price_obra,
        }));

      const dispatch = await createDispatch({
        companyId: request.company_id,
        requestId: request.id,
        projectId: request.project_id,
        dispatchedBy: userProfile.id,
        notes,
        items: dispatchItems,
      });

      showToast(`Despacho ${dispatch.folio} registrado correctamente.`, 'success');
      onSuccess?.(dispatch);
      onClose();
    } catch (err) {
      showToast(`Error al registrar despacho: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-700 to-blue-600">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Despacho a Obra
            </h2>
            <p className="text-blue-200 text-sm mt-0.5">
              Solicitud: <span className="font-semibold text-white">{request?.folio}</span>
              {request?.project?.name && (
                <span className="ml-3 text-blue-200">
                  Proyecto: <span className="text-white">{request.project.name}</span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors text-2xl font-light leading-none"
          >
            ×
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b bg-gray-50 px-6">
          {[
            { key: 'dispatch', label: 'Nuevo Despacho' },
            { key: 'history', label: `Historial (${history.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Cargando stock...
            </div>
          ) : tab === 'dispatch' ? (

            /* ── TAB: Nuevo Despacho ── */
            <div className="p-6 space-y-6">

              {/* Tabla de materiales */}
              {items.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  No se encontraron ítems en esta solicitud.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Código', 'Material', 'Almacén', 'Stock Disp.', 'P. Costo', 'P. Venta Obra', 'Margen %', 'Qty a Despachar', 'Total Venta'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, idx) => {
                        const qty = item.quantity_to_dispatch || 0;
                        const totalSale = qty * (item.sale_price_obra || 0);
                        const stockOk = item.stock_available > 0;

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${qty > 0 ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'}`}
                          >
                            <td className="px-3 py-2.5">
                              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                {item.material?.material_code ?? '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[180px] truncate">
                              {item.material?.name}
                              <div className="text-xs text-gray-400 font-normal">{item.material?.unit}</div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{item.warehouse_name}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`font-semibold ${
                                  item.stock_available <= 0
                                    ? 'text-red-500'
                                    : item.stock_available < 5
                                    ? 'text-amber-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {fmtNum(item.stock_available)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{fmt(item.unit_price)}</td>
                            <td className="px-3 py-2.5 font-semibold text-blue-700">
                              {fmt(item.sale_price_obra)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  (item.margin_pct || 0) >= 10
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {fmtNum(item.margin_pct)}%
                              </span>
                            </td>
                            <td className="px-3 py-2.5 w-32">
                              <input
                                type="number"
                                min="0"
                                max={item.stock_available}
                                step="0.01"
                                value={qty === 0 ? '' : qty}
                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                disabled={!stockOk}
                                placeholder={stockOk ? '0' : 'Sin stock'}
                                className={`w-full text-right border rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
                                  !stockOk
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                    : qty > 0
                                    ? 'border-blue-400 bg-white text-blue-700'
                                    : 'border-gray-300 bg-white text-gray-700'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                              {qty > 0 ? fmt(totalSale) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas del despacho <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej: Entrega en bodega principal de obra, turno matutino..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Panel de totales */}
              {hasItems && (
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">
                    Resumen del Despacho
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Costo Total</p>
                      <p className="text-lg font-bold text-gray-700">{fmt(totals.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Venta Total Obra</p>
                      <p className="text-lg font-bold text-blue-700">{fmt(totals.sale)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Margen</p>
                      <p className={`text-lg font-bold ${totals.margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {fmt(totals.margin)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          ) : (

            /* ── TAB: Historial ── */
            <div className="p-6 space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  No hay despachos previos para esta solicitud.
                </div>
              ) : (
                history.map((d) => (
                  <div key={d.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">
                          {d.folio}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(d.created_at).toLocaleString('es-MX')}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-green-700">{fmt(d.total_sale)}</span>
                    </div>

                    {d.dispatched_by_profile && (
                      <p className="text-xs text-gray-500 mb-2">
                        Despachado por:{' '}
                        <span className="font-medium text-gray-700">
                          {d.dispatched_by_profile.full_name}
                        </span>
                      </p>
                    )}

                    <div className="space-y-1">
                      {d.dispatch_items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                          <span>
                            <span className="font-mono text-gray-400">{item.material?.material_code}</span>
                            {' '}
                            {item.material?.name}
                          </span>
                          <span className="font-semibold">
                            {fmtNum(item.quantity)} {item.material?.unit} — {fmt(item.total_sale)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {d.notes && (
                      <p className="mt-2 text-xs text-gray-400 italic">{d.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            {tab === 'dispatch' && hasItems
              ? `${items.filter((i) => i.quantity_to_dispatch > 0).length} material(es) seleccionado(s)`
              : 'Selecciona las cantidades a despachar a obra'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            {tab === 'dispatch' && (
              <button
                onClick={handleSubmit}
                disabled={!hasItems || saving}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                  hasItems && !saving
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Registrando...
                  </span>
                ) : (
                  'Registrar Despacho'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}