import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  TableProperties,
  X,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { controlObraService } from '../controlObraService';
import MedicionesTab from '../components/MedicionesTab';
import CronogramaTab from '../components/CronogramaTab';

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

export default function ControlObraPage() {
  const { id: budgetId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'resumen';
  const setTab = (newTab) => setSearchParams({ tab: newTab });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [curveData, setCurveData] = useState([]);
  const [periodForm, setPeriodForm] = useState({ name: '', start_date: today(), end_date: today() });
  const [progress, setProgress] = useState({});
  const [modForm, setModForm] = useState({
    kind: 'increase',
    item_id: '',
    quantity_delta: '',
    unit_price: '',
    code: '',
    description: '',
  });
  const [addendumForm, setAddendumForm] = useState({ amount: '', code: '', description: '' });

  const items = data?.items || [];
  const currency = data?.currency || 'USD';
  const selectedItem = useMemo(
    () => items.find((item) => item.item_id === modForm.item_id),
    [items, modForm.item_id]
  );

  const load = useCallback(async () => {
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
      toast.error(error.message || 'Error al cargar el control de obra.');
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    load();
  }, [load]);

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
    const reason = window.prompt('Motivo de reapertura (obligatorio):');
    if (!reason || reason.trim().length < 3) {
      toast.error('Debes indicar un motivo válido.');
      return;
    }
    try {
      await controlObraService.reopenPeriod(budgetId, period.id, { reason: reason.trim() });
      toast.success('Período reabierto.');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const approveMod = async (modId) => {
    try {
      await controlObraService.approveModification(budgetId, modId);
      toast.success('Modificación aprobada.');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const approveAdd = async (addId) => {
    try {
      await controlObraService.approveAddendum(budgetId, addId);
      toast.success('Adendum aprobado.');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const downloadReport = async () => {
    try {
      const blob = await controlObraService.downloadReport(budgetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `control_obra_${data?.budget_name || budgetId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || 'No se pudo descargar el reporte.');
    }
  };

  const downloadCronograma = async () => {
    try {
      const blob = await controlObraService.downloadCronograma(budgetId, {
        contractor_name: data?.company_name || 'CONSTRUCTORA',
        contractee_name: data?.client_name || 'ENTE CONTRATANTE',
        location: data?.ubicacion || 'OBRA',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRONOGRAMA_GENERAL_${(data?.budget_name || 'OBRA').replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || 'No se pudo descargar el cronograma Excel.');
    }
  };

  const editProgress = async (entry) => {
    const raw = window.prompt('Nueva cantidad ejecutada:', entry.quantity);
    if (raw === null) return;
    const quantity = Number(raw);
    if (isNaN(quantity) || quantity < 0) {
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
      toast.success('Adendum creado. Revísala y apruébala.');
      setAddendumForm({ amount: '', code: '', description: '' });
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-sm font-semibold">Cargando módulo de Control de Obra...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-600 p-6">
        <p className="text-base font-bold">No se pudo cargar la información de la obra.</p>
        <button
          onClick={() => navigate('/budgets')}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-700"
        >
          Volver a Presupuestos
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-100 overflow-hidden">
      {/* Barra de Encabezado Principal */}
      <header className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Breadcrumb + Título */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(`/budgets/${budgetId}`)}
              className="p-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl hover:bg-slate-50 transition-colors shrink-0 text-slate-600 shadow-2xs"
              title="Volver a la hoja de presupuesto"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate mb-0.5">
                <span
                  onClick={() => navigate('/budgets')}
                  className="hover:text-blue-600 hover:underline cursor-pointer"
                >
                  Presupuestos
                </span>
                <ChevronRight size={12} className="text-slate-400" />
                <span
                  onClick={() => navigate(`/budgets/${budgetId}`)}
                  className="hover:text-blue-600 hover:underline cursor-pointer truncate max-w-[240px]"
                  title={data.budget_name}
                >
                  {data.budget_name}
                </span>
                <ChevronRight size={12} className="text-slate-400" />
                <span className="text-blue-700 font-bold">Control de Obra</span>
              </div>
              <h1 className="text-lg font-black text-slate-800 leading-tight truncate">
                {data.budget_name}
              </h1>
            </div>
          </div>

          {/* Acciones Superiores */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(`/budgets/${budgetId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-all shadow-2xs"
              title="Ir a la hoja de presupuesto y análisis de precios unitarios"
            >
              <TableProperties size={14} />
              <span>Hoja de Presupuesto (APUs)</span>
            </button>

            <button
              onClick={downloadCronograma}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-all shadow-2xs"
              title="Descargar Cronograma General en Excel"
            >
              <FileSpreadsheet size={14} className="text-emerald-700" />
              <span className="hidden sm:inline">Cronograma Excel</span>
            </button>

            <button
              onClick={downloadReport}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 shadow-2xs"
              title="Descargar Reporte Control de Obra"
            >
              <Download size={16} />
            </button>

            <button
              onClick={load}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 shadow-2xs"
              title="Actualizar datos"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Banner de Métricas Principales (KPIs) */}
      <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        <Card label="Original" value={money(data.original_amount, currency)} />
        <Card label="Modificado" value={money(data.modified_amount, currency)} />
        <Card label="Ejecutado" value={money(data.executed_amount, currency)} />
        <Card label="Avance Físico" value={pct(data.physical_percent)} accent />
        <Card label="Avance Financiero" value={pct(data.financial_percent)} accent />
        <Card label="Avance HH" value={pct(data.physical_percent_hh)} accent />
      </div>

      {/* Barra de Pestañas de Navegación */}
      <div className="px-4 sm:px-6 border-b border-slate-200 flex gap-1 overflow-x-auto bg-white shrink-0 min-h-[42px] shadow-2xs">
        {[
          { key: 'resumen', label: 'Resumen' },
          { key: 'cronograma', label: 'Cronograma' },
          { key: 'mediciones', label: 'Mediciones (Cómputos)' },
          { key: 'partidas', label: 'Partidas' },
          { key: 'avances', label: 'Avances' },
          { key: 'modificaciones', label: 'Modificaciones' },
          { key: 'adendum', label: 'Adendum' },
          { key: 'periodos', label: 'Períodos' },
          { key: 'curva', label: 'Curva S' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap rounded-t-lg transition-all border-b-2 ${
              tab === key
                ? 'bg-blue-50/70 text-blue-700 border-blue-600 font-black'
                : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Área de Contenido de la Pestaña Activa */}
      <div className={`flex-1 min-h-0 ${tab === 'mediciones' ? 'flex flex-col overflow-hidden p-0' : 'overflow-y-auto p-4 sm:p-6'} bg-slate-100`}>
        {tab === 'resumen' && (
          <div className="space-y-4 max-w-[1400px] mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Resumen Financiero y Contractual</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Line label="Monto contractual" value={money(data.contract_amount, currency)} />
                <Line label="Adendum aprobado" value={money(data.addendum_amount, currency)} />
                <Line label="Monto total vigente" value={money(data.modified_amount, currency)} />
                <Line label="Saldo por ejecutar" value={money(data.modified_amount - data.executed_amount, currency)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Últimas Modificaciones Aprobadas</h3>
                {data.modifications.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin modificaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {data.modifications.slice(-5).map((m) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
                        <span><strong>{m.code}</strong> · {m.kind}</span>
                        <span className="font-mono font-bold text-slate-700">{money(m.amount, currency)} · {m.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Períodos de Valuación</h3>
                {periods.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin períodos de corte creados.</p>
                ) : (
                  <div className="space-y-2">
                    {periods.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
                        <span><strong>{p.name}</strong> ({p.start_date} al {p.end_date})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'cronograma' && (
          <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col">
            <CronogramaTab
              budgetId={budgetId}
              budgetName={data?.budget_name}
              currency={currency}
              onReloadSummary={load}
            />
          </div>
        )}

        {tab === 'mediciones' && (
          <MedicionesTab
            budgetId={budgetId}
            budgetName={data?.budget_name}
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto max-w-[1600px] mx-auto w-full">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">Código</th>
                  <th className="px-3 py-2.5 text-left">Partida</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Original</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Modificada</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Ejecutada</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">% Físico</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">% Ponderado</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">HH Pres.</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">HH Ejec.</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Registro Rápido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const state = progress[item.item_id] || {};
                  return (
                    <tr key={item.item_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-mono font-bold text-slate-600 whitespace-nowrap">{item.code}</td>
                      <td className="px-3 py-2 max-w-[360px] truncate font-medium text-slate-800" title={item.description}>{item.description}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{item.original_quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-bold">{item.current_quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-blue-700">{item.executed_quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right font-bold whitespace-nowrap">{pct(item.physical_percent)}</td>
                      <td className="px-3 py-2 text-right font-bold text-indigo-700 whitespace-nowrap">
                        {pct(item.financial_weight ?? (data.modified_amount > 0 ? (item.current_amount / data.modified_amount) * 100 : 0))}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{item.budget_hours}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{item.executed_hours}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5 justify-end">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Cant."
                            value={state.quantity || ''}
                            onChange={(e) => setProgress((p) => ({ ...p, [item.item_id]: { ...state, quantity: e.target.value } }))}
                            className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs text-right bg-white"
                          />
                          <input
                            type="date"
                            value={state.date || today()}
                            onChange={(e) => setProgress((p) => ({ ...p, [item.item_id]: { ...state, date: e.target.value } }))}
                            className="w-28 border border-slate-300 rounded-lg px-1.5 py-1 text-xs bg-white text-slate-700"
                          />
                          <button
                            onClick={() => registerProgress(item)}
                            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-2xs"
                            title="Registrar avance"
                          >
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto max-w-[1400px] mx-auto w-full">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Partida</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3 text-left">Nota</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.entries || []).map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-slate-600">{entry.entry_date}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{entry.code}</td>
                    <td className="p-3 max-w-[380px] truncate font-medium text-slate-800" title={entry.description}>{entry.description}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700">{entry.quantity}</td>
                    <td className="p-3 text-slate-600">{entry.notes}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => editProgress(entry)} className="text-blue-600 hover:underline font-bold">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data.entries || []).length === 0 && <p className="p-6 text-sm text-slate-400 text-center">Sin avances registrados.</p>}
          </div>
        )}

        {tab === 'modificaciones' && (
          <div className="space-y-4 max-w-[1400px] mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Registrar Nueva Modificación</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <select
                  value={modForm.kind}
                  onChange={(e) => setModForm({ ...modForm, kind: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                >
                  <option value="increase">Aumento</option>
                  <option value="decrease">Disminución</option>
                  <option value="extra_work">Obra Extra</option>
                </select>
                <select
                  value={modForm.item_id}
                  onChange={(e) => setModForm({ ...modForm, item_id: e.target.value, unit_price: '' })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                >
                  <option value="">{modForm.kind === 'extra_work' ? 'Obra extra (nueva partida)' : 'Selecciona partida'}</option>
                  {items.map((item) => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.code} · {item.description.slice(0, 50)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Cantidad"
                  value={modForm.quantity_delta}
                  onChange={(e) => setModForm({ ...modForm, quantity_delta: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Precio unitario"
                  value={modForm.unit_price}
                  onChange={(e) => setModForm({ ...modForm, unit_price: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Código"
                  value={modForm.code}
                  onChange={(e) => setModForm({ ...modForm, code: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Descripción"
                  value={modForm.description}
                  onChange={(e) => setModForm({ ...modForm, description: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white md:col-span-2"
                />
                <button
                  onClick={createModification}
                  className="rounded-xl bg-blue-600 text-white text-xs font-bold px-4 py-2 hover:bg-blue-700 shadow-2xs"
                >
                  Crear Modificación
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Historial de Modificaciones</h3>
              {data.modifications.length === 0 ? (
                <p className="text-xs text-slate-400">Sin modificaciones registradas.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.modifications.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{m.code}</span> · <span className="uppercase text-slate-500 font-semibold">{m.kind}</span>
                        <p className="text-slate-600 text-[11px] mt-0.5">{m.description || 'Sin notas adicionales'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-700">{money(m.amount, currency)}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {m.status}
                        </span>
                        {m.status !== 'approved' && (
                          <button
                            onClick={() => approveMod(m.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                          >
                            Aprobar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'adendum' && (
          <div className="space-y-4 max-w-[1400px] mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Crear Adendum Contractual</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  placeholder="Código (ej: AD-01)"
                  value={addendumForm.code}
                  onChange={(e) => setAddendumForm({ ...addendumForm, code: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto"
                  value={addendumForm.amount}
                  onChange={(e) => setAddendumForm({ ...addendumForm, amount: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Descripción / Justificación"
                  value={addendumForm.description}
                  onChange={(e) => setAddendumForm({ ...addendumForm, description: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white md:col-span-2"
                />
              </div>
              <button
                onClick={createAddendum}
                className="mt-3 rounded-xl bg-blue-600 text-white text-xs font-bold px-4 py-2 hover:bg-blue-700 shadow-2xs"
              >
                Crear Adendum
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Adendums Registrados</h3>
              {data.addenda.length === 0 ? (
                <p className="text-xs text-slate-400">Sin adendums registrados.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.addenda.map((ad) => (
                    <div key={ad.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{ad.code}</span>
                        <p className="text-slate-600 text-[11px] mt-0.5">{ad.description || 'Sin descripción'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-700">{money(ad.amount, currency)}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ad.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {ad.status}
                        </span>
                        {ad.status !== 'approved' && (
                          <button
                            onClick={() => approveAdd(ad.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                          >
                            Aprobar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'periodos' && (
          <div className="space-y-4 max-w-[1400px] mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Nuevo Período / Valuación</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  placeholder="Nombre (ej: Valuación N° 1)"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white md:col-span-2"
                />
                <input
                  type="date"
                  value={periodForm.start_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <input
                  type="date"
                  value={periodForm.end_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                />
              </div>
              <button
                onClick={createPeriod}
                className="mt-3 rounded-xl bg-blue-600 text-white text-xs font-bold px-4 py-2 hover:bg-blue-700 shadow-2xs"
              >
                Crear Período
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Períodos de Obra</h3>
              {periods.length === 0 ? (
                <p className="text-xs text-slate-400">Sin períodos registrados.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {periods.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <p className="text-slate-500 text-[11px] mt-0.5">Del {p.start_date} al {p.end_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${p.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                        {p.status === 'open' ? (
                          <button
                            onClick={() => closePeriod(p)}
                            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
                          >
                            Cerrar
                          </button>
                        ) : (
                          <button
                            onClick={() => reopenPeriod(p)}
                            className="px-2.5 py-1 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'curva' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs max-w-[1600px] mx-auto w-full space-y-6">
            {/* Cabecera y Leyenda */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-600" />
                  <span>Curva S: Avance Físico Programado vs. Avance Real</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  La curva de avance real (verde) se genera automáticamente a partir de las mediciones registradas en la obra.
                </p>
              </div>

              {/* Leyenda de la gráfica */}
              <div className="flex items-center gap-4 text-xs font-bold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-1 bg-blue-600 rounded-full inline-block border-t-2 border-dashed border-blue-600" />
                  <span className="text-blue-700">Programado (Plan)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-1 bg-emerald-600 rounded-full inline-block" />
                  <span className="text-emerald-700">Real (Mediciones)</span>
                </div>
              </div>
            </div>

            {curveData.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <TrendingUp size={36} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-700">Sin datos suficientes para graficar la curva S.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Asegúrate de tener fechas planificadas en la pestaña <strong>Cronograma</strong> y de guardar mediciones en la pestaña <strong>Mediciones</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Gráfica SVG */}
                <div className="w-full overflow-x-auto bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <div className="min-w-[650px]">
                    <svg viewBox="0 0 800 260" className="w-full h-64 overflow-visible">
                      <defs>
                        <linearGradient id="curveActualGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="curvePlannedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Guías horizontales 0%, 25%, 50%, 75%, 100% */}
                      {[0, 25, 50, 75, 100].map((v) => {
                        const y = 220 - (v / 100) * 190;
                        return (
                          <g key={v}>
                            <line x1="50" y1={y} x2="770" y2={y} stroke="#e2e8f0" strokeDasharray={v === 0 || v === 100 ? '0' : '3 3'} strokeWidth="1" />
                            <text x="42" y={y + 4} textAnchor="end" fontSize="10" className="fill-slate-400 font-mono font-bold">
                              {v}%
                            </text>
                          </g>
                        );
                      })}

                      {(() => {
                        const n = curveData.length;
                        const xAt = (i) => 50 + (i / Math.max(1, n - 1)) * (770 - 50);
                        const yAt = (val) => 220 - (Math.min(100, Math.max(0, Number(val || 0))) / 100) * 190;

                        const plannedPts = curveData.map((p, i) => `${xAt(i)},${yAt(p.planned_percent)}`).join(' ');
                        const actualPts = curveData.map((p, i) => `${xAt(i)},${yAt(p.actual_percent)}`).join(' ');

                        const firstX = xAt(0);
                        const lastX = xAt(n - 1);
                        const baselineY = yAt(0);
                        const plannedArea = `${firstX},${baselineY} ${plannedPts} ${lastX},${baselineY}`;
                        const actualArea = `${firstX},${baselineY} ${actualPts} ${lastX},${baselineY}`;

                        return (
                          <>
                            {/* Áreas bajo la curva */}
                            <polygon points={plannedArea} fill="url(#curvePlannedGradient)" />
                            <polygon points={actualArea} fill="url(#curveActualGradient)" />

                            {/* Líneas de las curvas */}
                            <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5,4" points={plannedPts} strokeLinecap="round" />
                            <polyline fill="none" stroke="#059669" strokeWidth="3" points={actualPts} strokeLinecap="round" />

                            {/* Puntos y Etiquetas */}
                            {curveData.map((p, i) => {
                              const px = xAt(i);
                              const pyPlan = yAt(p.planned_percent);
                              const pyAct = yAt(p.actual_percent);
                              return (
                                <g key={p.date}>
                                  {/* Punto Planificado */}
                                  <circle cx={px} cy={pyPlan} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                                  {/* Punto Real */}
                                  <circle cx={px} cy={pyAct} r="4" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />

                                  {/* Fechas en eje X */}
                                  {(i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) && (
                                    <text x={px} y="242" textAnchor="middle" fontSize="10" className="fill-slate-600 font-medium">
                                      {p.date}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

                {/* Tabla Detallada de Comparación y Desviaciones */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-left">Fecha de Corte</th>
                        <th className="p-3 text-right">Avance Real Ejecutado (%)</th>
                        <th className="p-3 text-right">Avance Programado Plan (%)</th>
                        <th className="p-3 text-right">Desviación</th>
                        <th className="p-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {curveData.map((pt, idx) => {
                        const dev = (Number(pt.actual_percent) || 0) - (Number(pt.planned_percent) || 0);
                        const isAhead = dev > 0.05;
                        const isBehind = dev < -0.05;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-semibold text-slate-700">{pt.date}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-700">{pct(pt.actual_percent)}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-700">{pct(pt.planned_percent)}</td>
                            <td className={`p-3 text-right font-mono font-bold ${isAhead ? 'text-emerald-600' : isBehind ? 'text-red-600' : 'text-slate-600'}`}>
                              {dev > 0 ? `+${pct(dev)}` : pct(dev)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isAhead
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isBehind
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {isAhead ? 'Adelantado' : isBehind ? 'Atrasado' : 'A Tiempo'}
                              </span>
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
        )}
      </div>
    </div>
  );
}

function Card({ label, value, accent }) {
  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl px-3 py-2 transition-all">
      <span className="text-[10px] uppercase tracking-wide font-black text-slate-400">{label}</span>
      <span className={`block mt-0.5 font-mono font-black text-xs sm:text-sm ${accent ? 'text-blue-700' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div>
      <span className="block text-[11px] text-slate-500 font-medium">{label}</span>
      <span className="block font-mono font-bold text-slate-800 mt-0.5">{value}</span>
    </div>
  );
}
