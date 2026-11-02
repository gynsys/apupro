import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Loader2, Plus, RefreshCw, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { controlObraService } from './controlObraService';

const today = () => new Date().toISOString().slice(0, 10);

function money(value, currency = 'USD') {
  return `${currency === 'USD' ? '$' : 'Bs.'} ${Number(value || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export default function ControlObraModal({ isOpen, onClose, budgetId, budgetName }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [curveData, setCurveData] = useState([]);
  const [periodForm, setPeriodForm] = useState({ name: '', start_date: today(), end_date: today() });
  const [tab, setTab] = useState('resumen');
  const [progress, setProgress] = useState({});
  const [modForm, setModForm] = useState({
    kind: 'increase', item_id: '', quantity_delta: '', unit_price: '', code: '', description: '',
  });
  const [addendumForm, setAddendumForm] = useState({ amount: '', code: '', description: '' });

  const items = data?.items || [];
  const currency = data?.currency || 'USD';
  const selectedItem = useMemo(
    () => items.find((item) => item.item_id === modForm.item_id),
    [items, modForm.item_id],
  );

  const load = async () => {
    if (!budgetId) return;
    setLoading(true);
    try {
      const [summaryData, periodsData, curve] = await Promise.all([
        controlObraService.getSummary(budgetId),
        controlObraService.getPeriods(budgetId).catch(() => []),
        controlObraService.getCurve(budgetId).catch(() => []),
      ]);
      setData(summaryData);
      setPeriods(periodsData);
      setCurveData(curve);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && budgetId) {
      setTab('resumen');
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, budgetId]);

  if (!isOpen) return null;

  const registerProgress = async (item) => {
    const state = progress[item.item_id] || {};
    const quantity = Number(state.quantity);
    if (!quantity || quantity <= 0) {
      toast.error('Ingresa una cantidad ejecutada mayor que cero.');
      return;
    }
    try {
      await controlObraService.addProgress(budgetId, {
        item_id: item.item_id,
        quantity,
        entry_date: state.date || today(),
        notes: state.notes || '',
      });
      setProgress((prev) => ({ ...prev, [item.item_id]: { ...state, quantity: '', notes: '' } }));
      toast.success('Avance registrado.');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const createModification = async () => {
    if (!modForm.kind) return;
    const line = {
      item_id: modForm.item_id || null,
      code: selectedItem?.code || modForm.code,
      description: modForm.description || selectedItem?.description || '',
      unit: selectedItem?.unit || '',
      quantity_delta: Number(modForm.quantity_delta || 0),
      unit_price: modForm.unit_price !== '' ? Number(modForm.unit_price) : selectedItem?.unit_price,
      is_new_item: modForm.kind === 'extra_work',
    };
    if (!line.quantity_delta) {
      toast.error('Ingresa una cantidad para la modificación.');
      return;
    }
    try {
      await controlObraService.createModification(budgetId, {
        kind: modForm.kind,
        code: modForm.code,
        description: modForm.description,
        lines: [line],
      });
      toast.success('Modificación creada. Revísala y apruébala.');
      setModForm({ kind: 'increase', item_id: '', quantity_delta: '', unit_price: '', code: '', description: '' });
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const createPeriod = async () => {
    if (!periodForm.name || !periodForm.start_date || !periodForm.end_date) {
      toast.error('Completa nombre, fecha inicial y fecha final.');
      return;
    }
    try {
      await controlObraService.createPeriod(budgetId, periodForm);
      toast.success('Período creado.');
      setPeriodForm({ name: '', start_date: today(), end_date: today() });
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const closePeriod = async (period) => {
    try {
      await controlObraService.closePeriod(budgetId, period.id);
      toast.success('Período cerrado.');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const reopenPeriod = async (period) => {
    const reason = window.prompt('Motivo de la reapertura:');
    if (!reason) return;
    try {
      await controlObraService.reopenPeriod(budgetId, period.id, reason);
      toast.success('Período reabierto.');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const downloadReport = async () => {
    try {
      const blob = await controlObraService.downloadReport(budgetId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `control_obra_${budgetId}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const createAddendum = async () => {
    if (!Number(addendumForm.amount)) {
      toast.error('Ingresa el monto del adendum.');
      return;
    }
    try {
      await controlObraService.createAddendum(budgetId, {
        amount: Number(addendumForm.amount),
        code: addendumForm.code,
        description: addendumForm.description,
      });
      toast.success('Adendum creado. Revísalo y apruébalo.');
      setAddendumForm({ amount: '', code: '', description: '' });
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 flex items-center justify-center">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-6xl rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="text-blue-600" size={22} />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">Control de Obra</h2>
              <p className="text-xs text-slate-500 truncate">{budgetName || data?.budget_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadReport} className="p-2 rounded-lg hover:bg-slate-200" title="Descargar Excel">
              <Download size={18} />
            </button>
            <button onClick={load} className="p-2 rounded-lg hover:bg-slate-200" title="Actualizar">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200" title="Cerrar">
              <X size={20} />
            </button>
          </div>
        </header>

        {loading && !data ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={22} /> Cargando control de obra...
          </div>
        ) : !data ? (
          <div className="flex-1 p-8 text-center text-slate-500">No se pudo cargar el control de obra.</div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-3 grid grid-cols-2 lg:grid-cols-5 gap-2 border-b border-slate-200 bg-white">
              <Card label="Original" value={money(data.original_amount, currency)} />
              <Card label="Modificado" value={money(data.modified_amount, currency)} />
              <Card label="Ejecutado" value={money(data.executed_amount, currency)} />
              <Card label="Avance físico" value={pct(data.physical_percent)} accent />
              <Card label="Avance financiero" value={pct(data.financial_percent)} accent />
            </div>

            <div className="px-4 sm:px-6 border-b border-slate-200 flex gap-1 overflow-x-auto bg-white">
              {['resumen', 'partidas', 'modificaciones', 'adendum', 'periodos', 'curva'].map((key) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {{ resumen: 'Resumen', partidas: 'Partidas', modificaciones: 'Modificaciones', adendum: 'Adendum', periodos: 'Períodos', curva: 'Curva S' }[key]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
              {tab === 'resumen' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Resumen financiero</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <Line label="Monto contractual" value={money(data.contract_amount, currency)} />
                      <Line label="Adendum aprobado" value={money(data.addendum_amount, currency)} />
                      <Line label="Disponible" value={money(data.available_amount, currency)} />
                      <Line label="Saldo por ejecutar" value={money(data.modified_amount - data.executed_amount, currency)} />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Últimas modificaciones</h3>
                    {data.modifications.length === 0 ? <p className="text-sm text-slate-500">Sin modificaciones registradas.</p> :
                      data.modifications.slice(-5).map((m) => (
                        <div key={m.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                          <span><strong>{m.code}</strong> · {m.kind}</span>
                          <span>{money(m.amount, currency)} · {m.status}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {tab === 'partidas' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Partida</th>
                        <th className="p-2 text-right">Original</th>
                        <th className="p-2 text-right">Modificada</th>
                        <th className="p-2 text-right">Ejecutada</th>
                        <th className="p-2 text-right">% Físico</th>
                        <th className="p-2 text-right">Registrar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const state = progress[item.item_id] || {};
                        return (
                          <tr key={item.item_id} className="border-t border-slate-100">
                            <td className="p-2 font-mono">{item.code}</td>
                            <td className="p-2 max-w-[320px] truncate" title={item.description}>{item.description}</td>
                            <td className="p-2 text-right">{item.original_quantity} {item.unit}</td>
                            <td className="p-2 text-right">{item.current_quantity} {item.unit}</td>
                            <td className="p-2 text-right">{item.executed_quantity} {item.unit}</td>
                            <td className="p-2 text-right font-semibold">{pct(item.physical_percent)}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-1 justify-end">
                                <input type="number" min="0" step="0.01" placeholder="Cant."
                                  value={state.quantity || ''}
                                  onChange={(e) => setProgress((p) => ({ ...p, [item.item_id]: { ...state, quantity: e.target.value } }))}
                                  className="w-16 border border-slate-300 rounded px-1 py-1" />
                                <input type="date" value={state.date || today()}
                                  onChange={(e) => setProgress((p) => ({ ...p, [item.item_id]: { ...state, date: e.target.value } }))}
                                  className="w-28 border border-slate-300 rounded px-1 py-1" />
                                <button onClick={() => registerProgress(item)}
                                  className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" title="Registrar avance">
                                  <Plus size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'modificaciones' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Nueva modificación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <select value={modForm.kind} onChange={(e) => setModForm({ ...modForm, kind: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                        <option value="increase">Aumento</option>
                        <option value="decrease">Disminución</option>
                        <option value="extra_work">Obra extra</option>
                      </select>
                      <select value={modForm.item_id} onChange={(e) => setModForm({ ...modForm, item_id: e.target.value, unit_price: '' })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                        <option value="">{modForm.kind === 'extra_work' ? 'Obra extra (nueva)' : 'Selecciona partida'}</option>
                        {items.map((item) => <option key={item.item_id} value={item.item_id}>{item.code} · {item.description.slice(0, 50)}</option>)}
                      </select>
                      <input type="number" step="0.01" placeholder="Cantidad" value={modForm.quantity_delta}
                        onChange={(e) => setModForm({ ...modForm, quantity_delta: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="number" step="0.01" placeholder="Precio unitario" value={modForm.unit_price}
                        onChange={(e) => setModForm({ ...modForm, unit_price: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="text" placeholder="Código" value={modForm.code}
                        onChange={(e) => setModForm({ ...modForm, code: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="text" placeholder="Descripción" value={modForm.description}
                        onChange={(e) => setModForm({ ...modForm, description: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm md:col-span-2" />
                      <button onClick={createModification} className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-3 py-2 hover:bg-blue-700">
                        Crear
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Modificaciones</h3>
                    {data.modifications.length === 0 ? <p className="text-sm text-slate-500">Sin modificaciones.</p> :
                      data.modifications.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0 text-sm">
                          <span><strong>{m.code}</strong> · {m.kind} · {money(m.amount, currency)}</span>
                          <span className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${m.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{m.status}</span>
                            {m.status !== 'approved' && (
                              <button onClick={async () => { try { await controlObraService.approveModification(budgetId, m.id); toast.success('Modificación aprobada'); await load(); } catch (e) { toast.error(e.message); } }}
                                className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" title="Aprobar">
                                <Check size={14} />
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {tab === 'adendum' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Nuevo adendum</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input type="number" step="0.01" placeholder="Monto adicional" value={addendumForm.amount}
                        onChange={(e) => setAddendumForm({ ...addendumForm, amount: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="text" placeholder="Código" value={addendumForm.code}
                        onChange={(e) => setAddendumForm({ ...addendumForm, code: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="text" placeholder="Descripción" value={addendumForm.description}
                        onChange={(e) => setAddendumForm({ ...addendumForm, description: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <button onClick={createAddendum} className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-3 py-2 hover:bg-blue-700">
                        Crear
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Adenda</h3>
                    {data.addenda.length === 0 ? <p className="text-sm text-slate-500">Sin adenda registrado.</p> :
                      data.addenda.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0 text-sm">
                          <span><strong>{a.code}</strong> · {money(a.amount, currency)}</span>
                          <span className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${a.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{a.status}</span>
                            {a.status !== 'approved' && (
                              <button onClick={async () => { try { await controlObraService.approveAddendum(budgetId, a.id); toast.success('Adendum aprobado'); await load(); } catch (e) { toast.error(e.message); } }}
                                className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" title="Aprobar">
                                <Check size={14} />
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {tab === 'periodos' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Nuevo período</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input type="text" placeholder="Nombre" value={periodForm.name}
                        onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="date" value={periodForm.start_date}
                        onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <input type="date" value={periodForm.end_date}
                        onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                      <button onClick={createPeriod} className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-3 py-2 hover:bg-blue-700">
                        Crear período
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Períodos</h3>
                    {periods.length === 0 ? <p className="text-sm text-slate-500">Sin períodos registrados.</p> :
                      periods.map((p) => (
                        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0 text-sm">
                          <span><strong>{p.name}</strong> · {p.start_date} a {p.end_date}</span>
                          <span className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${p.status === 'open' ? 'text-emerald-600' : 'text-amber-600'}`}>{p.status}</span>
                            {p.status === 'open' ? (
                              <button onClick={() => closePeriod(p)} className="text-xs rounded bg-slate-700 text-white px-2 py-1">Cerrar</button>
                            ) : (
                              <button onClick={() => reopenPeriod(p)} className="text-xs rounded bg-amber-600 text-white px-2 py-1">Reabrir</button>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {tab === 'curva' && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Curva S · planificado vs real</h3>
                  {curveData.length === 0 ? <p className="text-sm text-slate-500">Configura fechas de planificación para generar la curva.</p> :
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-right">Planificado</th><th className="p-2 text-right">Real</th></tr>
                        </thead>
                        <tbody>
                          {curveData.map((point) => (
                            <tr key={point.date} className="border-t border-slate-100">
                              <td className="p-2">{point.date}</td>
                              <td className="p-2 text-right">{pct(point.planned_percent)}</td>
                              <td className="p-2 text-right font-semibold">{pct(point.actual_percent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">{label}</span>
      <span className={`block mt-1 font-mono font-bold ${accent ? 'text-blue-700' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div>
      <span className="block text-[11px] text-slate-500">{label}</span>
      <span className="block font-mono font-semibold text-slate-800">{value}</span>
    </div>
  );
}
