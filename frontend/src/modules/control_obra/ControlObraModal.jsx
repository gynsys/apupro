import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Loader2, Plus, RefreshCw, X, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { controlObraService } from './controlObraService';
import MedicionesTab from './components/MedicionesTab';
import CronogramaTab from './components/CronogramaTab';

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
  const [planStart, setPlanStart] = useState(today());
  const [planMode, setPlanMode] = useState('chapters');
  const [planDrafts, setPlanDrafts] = useState({});
  const [planningBusy, setPlanningBusy] = useState(false);

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

  const downloadCronograma = async () => {
    try {
      const blob = await controlObraService.downloadCronograma(budgetId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (budgetName || data?.budget_name || 'CRONOGRAMA').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `CRONOGRAMA_GENERAL_${cleanName}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Cronograma Excel descargado exitosamente.');
    } catch (error) {
      toast.error(error.message || 'Error al descargar el cronograma.');
    }
  };

  const editProgress = async (entry) => {
    const rawQuantity = window.prompt('Nueva cantidad ejecutada:', entry.quantity);
    if (rawQuantity === null) return;
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Cantidad inválida.');
      return;
    }
    const entryDate = window.prompt('Fecha (AAAA-MM-DD):', entry.entry_date) || entry.entry_date;
    try {
      await controlObraService.updateProgress(budgetId, entry.id, {
        quantity,
        entry_date: entryDate,
        notes: entry.notes || '',
      });
      toast.success('Avance corregido.');
      await load();
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

  const runAutoPlan = async () => {
    if (!planStart) {
      toast.error('Selecciona una fecha de inicio.');
      return;
    }
    setPlanningBusy(true);
    try {
      const res = await controlObraService.autoPlan(budgetId, {
        start_date: planStart,
        mode: planMode,
      });
      toast.success(`Planificación generada para ${res.planned_count} partidas.`);
      setPlanDrafts({});
      await load();
    } catch (error) {
      toast.error(error.message || 'No se pudo auto-programar.');
    } finally {
      setPlanningBusy(false);
    }
  };

  const saveItemPlan = async (item) => {
    const draft = planDrafts[item.item_id] || {};
    const planned_start = draft.planned_start ?? item.planned_start;
    const planned_end = draft.planned_end ?? item.planned_end;
    if (!planned_start || !planned_end) {
      toast.error('Indica fecha de inicio y fin.');
      return;
    }
    try {
      await controlObraService.planItem(budgetId, {
        item_id: item.item_id,
        planned_start,
        planned_end,
      });
      toast.success('Fechas guardadas.');
      await load();
    } catch (error) {
      toast.error(error.message || 'No se pudieron guardar las fechas.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 lg:p-6 flex items-center justify-center">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-[95vw] xl:max-w-[1440px] 2xl:max-w-[1600px] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="text-blue-600" size={22} />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">Control de Obra</h2>
              <p className="text-xs text-slate-500 truncate">{budgetName || data?.budget_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadCronograma} className="p-2 rounded-lg hover:bg-blue-100 text-blue-700" title="Descargar Cronograma General (Excel)">
              <FileSpreadsheet size={18} />
            </button>
            <button onClick={downloadReport} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600" title="Descargar Reporte Control de Obra">
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
            <div className="px-4 sm:px-6 py-3 grid grid-cols-2 lg:grid-cols-6 gap-2 border-b border-slate-200 bg-white shrink-0">
              <Card label="Original" value={money(data.original_amount, currency)} />
              <Card label="Modificado" value={money(data.modified_amount, currency)} />
              <Card label="Ejecutado" value={money(data.executed_amount, currency)} />
              <Card label="Avance físico" value={pct(data.physical_percent)} accent />
              <Card label="Avance financiero" value={pct(data.financial_percent)} accent />
              <Card label="Avance HH" value={pct(data.physical_percent_hh)} accent />
            </div>

            <div className="px-4 sm:px-6 border-b border-slate-200 flex gap-1 overflow-x-auto bg-white shrink-0 min-h-[38px]">
              {['resumen', 'cronograma', 'mediciones', 'partidas', 'avances', 'modificaciones', 'adendum', 'periodos', 'curva'].map((key) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg ${tab === key ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                  {{ resumen: 'Resumen', cronograma: 'Cronograma', mediciones: 'Mediciones', partidas: 'Partidas', avances: 'Avances', modificaciones: 'Modificaciones', adendum: 'Adendum', periodos: 'Períodos', curva: 'Curva S' }[key]}
                </button>
              ))}
            </div>

            <div className={`flex-1 min-h-0 ${tab === 'mediciones' ? 'flex flex-col overflow-hidden p-0' : 'overflow-y-auto p-4 sm:p-6'} bg-slate-50`}>
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

              {tab === 'cronograma' && (
                <CronogramaTab
                  budgetId={budgetId}
                  budgetName={budgetName || data?.budget_name}
                  currency={currency}
                  onReloadSummary={load}
                />
              )}

              {tab === 'mediciones' && (
                <MedicionesTab
                  budgetId={budgetId}
                  budgetName={budgetName || data?.budget_name}
                  items={items}
                  currency={currency}
                  modifiedAmount={data.modified_amount}
                  onMeasurementsSaved={load}
                  onCascadeUpdate={(liveTotals) => {
                    setData((prev) =>
                      prev
                        ? {
                            ...prev,
                            executed_amount: liveTotals.executedAmount,
                            physical_percent: liveTotals.physicalPercent,
                            physical_percent_hh: liveTotals.hhPercent,
                          }
                        : prev
                    );
                  }}
                />
              )}

              {tab === 'partidas' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Código</th>
                        <th className="px-3 py-2 text-left">Partida</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Original</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Modificada</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Ejecutada</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">% Físico</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap" title="% de obra programada financiero (peso de la partida respecto al monto total vigente)">% Obra prog. fin.</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">HH pres.</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">HH ejec.</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">% HH</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Peso HH</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Registrar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const state = progress[item.item_id] || {};
                        return (
                          <tr key={item.item_id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono whitespace-nowrap">{item.code}</td>
                            <td className="px-3 py-2 max-w-[360px] truncate" title={item.description}>{item.description}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{item.original_quantity} {item.unit}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{item.current_quantity} {item.unit}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{item.executed_quantity} {item.unit}</td>
                            <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{pct(item.physical_percent)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-indigo-700 whitespace-nowrap">
                              {pct(
                                item.financial_weight ??
                                  (data.modified_amount > 0 ? (item.current_amount / data.modified_amount) * 100 : 0)
                              )}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{item.budget_hours}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{item.executed_hours}</td>
                            <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{pct(item.physical_percent_hh)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{pct(item.hours_weight)}</td>
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

              {tab === 'avances' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-2 text-left">Fecha</th>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Partida</th>
                        <th className="p-2 text-right">Cantidad</th>
                        <th className="p-2 text-left">Nota</th>
                        <th className="p-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.entries || []).map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100">
                          <td className="p-2">{entry.entry_date}</td>
                          <td className="p-2 font-mono">{entry.code}</td>
                          <td className="p-2 max-w-[380px] truncate" title={entry.description}>{entry.description}</td>
                          <td className="p-2 text-right">{entry.quantity}</td>
                          <td className="p-2">{entry.notes}</td>
                          <td className="p-2 text-center">
                            <button onClick={() => editProgress(entry)} className="text-blue-600 hover:underline font-semibold">
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(data.entries || []).length === 0 && <p className="p-4 text-sm text-slate-500">Sin avances registrados.</p>}
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
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Auto-programación desde HH / Rendimiento</h3>
                        <p className="text-xs text-slate-500">
                          Calcula automáticamente la duración de cada partida (cantidad / rendimiento o HH teóricas) y programa la obra por capítulos.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Inicio de obra</label>
                          <input
                            type="date"
                            value={planStart}
                            onChange={(e) => setPlanStart(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Secuencia</label>
                          <select
                            value={planMode}
                            onChange={(e) => setPlanMode(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                          >
                            <option value="chapters">Por capítulos (partidas en paralelo)</option>
                            <option value="sequential">Secuencial partida a partida</option>
                          </select>
                        </div>
                        <button
                          onClick={runAutoPlan}
                          disabled={planningBusy || items.length === 0}
                          className="rounded-lg bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 hover:bg-blue-700 disabled:opacity-50"
                        >
                          {planningBusy ? 'Programando...' : 'Auto-programar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-700">Curva S · planificado vs real</h3>
                      {curveData.length > 0 && (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                            <span className="w-4 h-0.5 bg-blue-600 inline-block" /> Planificado
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <span className="w-4 h-0.5 bg-emerald-600 inline-block" /> Real
                          </span>
                        </div>
                      )}
                    </div>
                    {curveData.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Usa <strong>Auto-programar</strong> arriba o configura fechas de planificación abajo para generar la curva.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {curveData.length >= 2 && (
                          <div className="w-full overflow-x-auto">
                            <svg viewBox="0 0 720 220" className="w-full max-w-3xl h-52 mx-auto">
                              {[0, 25, 50, 75, 100].map((v) => {
                                const y = 190 - (v / 100) * 165;
                                return (
                                  <g key={v}>
                                    <line x1="48" y1={y} x2="695" y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                    <text x="40" y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{v}%</text>
                                  </g>
                                );
                              })}
                              {(() => {
                                const n = curveData.length;
                                const xAt = (i) => 48 + (i / Math.max(1, n - 1)) * (695 - 48);
                                const yAt = (val) => 190 - (Math.min(100, Math.max(0, Number(val || 0))) / 100) * 165;
                                const plannedPts = curveData.map((p, i) => `${xAt(i)},${yAt(p.planned_percent)}`).join(' ');
                                const actualPts = curveData.map((p, i) => `${xAt(i)},${yAt(p.actual_percent)}`).join(' ');
                                return (
                                  <>
                                    <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5,4" points={plannedPts} />
                                    <polyline fill="none" stroke="#059669" strokeWidth="2.5" points={actualPts} />
                                    {curveData.map((p, i) => (
                                      <g key={p.date}>
                                        <circle cx={xAt(i)} cy={yAt(p.planned_percent)} r="3" fill="#2563eb" />
                                        <circle cx={xAt(i)} cy={yAt(p.actual_percent)} r="3" fill="#059669" />
                                        {(i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) && (
                                          <text x={xAt(i)} y="208" textAnchor="middle" fontSize="9" fill="#64748b">
                                            {p.date.slice(5)}
                                          </text>
                                        )}
                                      </g>
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        )}
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
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Cronograma por capítulos y partidas</h3>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-2 text-left">Capítulo</th>
                          <th className="p-2 text-left">Partida</th>
                          <th className="p-2 text-right whitespace-nowrap">Duración teór.</th>
                          <th className="p-2 text-left">Inicio plan.</th>
                          <th className="p-2 text-left">Fin plan.</th>
                          <th className="p-2 text-right">Guardar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const draft = planDrafts[item.item_id] || {};
                          const startVal = draft.planned_start ?? item.planned_start ?? '';
                          const endVal = draft.planned_end ?? item.planned_end ?? '';
                          return (
                            <tr key={item.item_id} className="border-t border-slate-100">
                              <td className="p-2 text-slate-500 max-w-[180px] truncate" title={item.chapter_name}>
                                {item.chapter_name || 'General'}
                              </td>
                              <td className="p-2 max-w-[280px] truncate" title={item.description}>
                                <span className="font-mono text-slate-500 mr-1.5">{item.code}</span>
                                {item.description}
                              </td>
                              <td className="p-2 text-right whitespace-nowrap font-medium text-slate-700">
                                {item.estimated_days || 1} d
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={startVal}
                                  onChange={(e) =>
                                    setPlanDrafts((prev) => ({
                                      ...prev,
                                      [item.item_id]: { ...prev[item.item_id], planned_start: e.target.value },
                                    }))
                                  }
                                  className="border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={endVal}
                                  onChange={(e) =>
                                    setPlanDrafts((prev) => ({
                                      ...prev,
                                      [item.item_id]: { ...prev[item.item_id], planned_end: e.target.value },
                                    }))
                                  }
                                  className="border border-slate-300 rounded px-1.5 py-1 text-xs"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <button
                                  onClick={() => saveItemPlan(item)}
                                  className="px-2.5 py-1 rounded bg-slate-800 text-white hover:bg-slate-700 text-[11px] font-semibold"
                                >
                                  Guardar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
