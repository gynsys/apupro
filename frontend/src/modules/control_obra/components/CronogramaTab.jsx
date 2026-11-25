import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Download,
  Save,
  Sparkles,
  BarChart3,
  CalendarRange,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { controlObraService } from '../controlObraService';
import CronogramaGantt from './CronogramaGantt';

function money(val, currency = 'USD') {
  return `${currency === 'USD' ? '$' : 'Bs.'} ${Number(val || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(val) {
  return `${Number(val || 0).toFixed(2)}%`;
}

export default function CronogramaTab({
  budgetId,
  budgetName,
  currency = 'USD',
  onReloadSummary,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dataset, setDataset] = useState(null);
  const [viewMode, setViewMode] = useState('gantt'); // 'gantt' | 'mensual'

  // Formulario de parámetros del cronograma
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalWeeks, setTotalWeeks] = useState(13);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Cargar cronograma desde backend
  const loadSchedule = async (sDate = startDate, weeks = totalWeeks) => {
    if (!budgetId) return;
    setLoading(true);
    try {
      const data = await controlObraService.getSchedule(budgetId, {
        start_date: sDate,
        total_weeks: weeks,
      });
      setDataset(data);
      if (data.start_date) setStartDate(data.start_date);
      if (data.total_weeks) setTotalWeeks(data.total_weeks);
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error(error.message || 'No se pudo cargar el cronograma.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId]);

  // Manejo de cambio de semanas por partida
  const handleItemWeekChange = (itemId, startW, endW) => {
    if (!dataset) return;
    const s = Math.max(1, Math.min(totalWeeks, startW));
    const e = Math.max(s, Math.min(totalWeeks, endW));

    const updatedItems = dataset.items.map(it => {
      if (it.item_id === itemId) {
        return { ...it, start_week: s, end_week: e };
      }
      return it;
    });

    setDataset({ ...dataset, items: updatedItems });
    setHasUnsavedChanges(true);
  };

  // Guardar semanas en backend
  const handleSaveSchedule = async () => {
    if (!dataset || !dataset.items) return;
    setSaving(true);
    try {
      const itemsPayload = dataset.items.map(it => ({
        item_id: it.item_id,
        start_week: it.start_week,
        end_week: it.end_week,
      }));

      await controlObraService.saveSchedule(budgetId, {
        start_date: startDate,
        total_weeks: totalWeeks,
        items: itemsPayload,
      });

      toast.success('Cronograma guardado exitosamente.');
      await loadSchedule(startDate, totalWeeks);
      if (onReloadSummary) onReloadSummary();
    } catch (error) {
      toast.error(error.message || 'Error al guardar el cronograma.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-programación desde rendimientos
  const handleAutoPlan = async () => {
    if (!startDate) {
      toast.error('Selecciona una fecha de inicio.');
      return;
    }
    setLoading(true);
    try {
      const res = await controlObraService.autoPlan(budgetId, {
        start_date: startDate,
        mode: 'chapters',
      });
      toast.success(`Planificación generada para ${res.planned_count} partidas.`);
      await loadSchedule(startDate, totalWeeks);
      if (onReloadSummary) onReloadSummary();
    } catch (error) {
      toast.error(error.message || 'No se pudo auto-programar.');
    } finally {
      setLoading(false);
    }
  };

  // Descarga del archivo oficial Excel (4 pestañas dinámicas estilo UKATIRA INA)
  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const blob = await controlObraService.downloadCronograma(budgetId, {
        start_date: startDate,
        total_weeks: totalWeeks,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (budgetName || 'CRONOGRAMA').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `CRONOGRAMA_GENERAL_${cleanName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Libro de Cronograma Excel descargado exitosamente.');
    } catch (error) {
      toast.error(error.message || 'Error al descargar el archivo Excel.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !dataset) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <Loader2 className="animate-spin text-blue-600" size={30} />
        <p className="text-sm font-medium">Cargando cronograma general y Curva S...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR DE PARÁMETROS Y ACCIONES */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Parámetros de obra */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-blue-600" /> Inicio de Obra
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  loadSchedule(e.target.value, totalWeeks);
                }}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <CalendarRange size={13} className="text-blue-600" /> Duración
              </label>
              <select
                value={totalWeeks}
                onChange={e => {
                  const w = Number(e.target.value);
                  setTotalWeeks(w);
                  loadSchedule(startDate, w);
                }}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white"
              >
                {[4, 6, 8, 10, 12, 13, 16, 20, 24, 26, 52].map(w => (
                  <option key={w} value={w}>{w} Semanas ({Math.round(w * 7 / 30)} meses)</option>
                ))}
              </select>
            </div>

            <div className="pt-4 flex items-center gap-1.5">
              <button
                onClick={handleAutoPlan}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                title="Calcula fechas y semanas automáticamente desde los rendimientos COVENIN y HH"
              >
                <Sparkles size={14} /> Auto-programar
              </button>

              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveSchedule}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Semanas'}
                </button>
              )}
            </div>
          </div>

          {/* Vistas y Botón de Descarga Excel Oficial */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-1 rounded-md transition-all ${
                  viewMode === 'gantt' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Gantt & Curva S
              </button>
              <button
                onClick={() => setViewMode('mensual')}
                className={`px-3 py-1 rounded-md transition-all ${
                  viewMode === 'mensual' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Prorrateo Mensual
              </button>
            </div>

            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-98"
              title="Descarga el libro Excel idéntico al estándar oficial con sus 4 pestañas y fórmulas dinámicas"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={15} />
              )}
              <span>Descargar Cronograma Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO SEGÚN VISTA SELECCIONADA */}
      {viewMode === 'gantt' ? (
        <CronogramaGantt
          dataset={dataset}
          currency={currency}
          onItemWeekChange={handleItemWeekChange}
        />
      ) : (
        /* VISTA: PRORRATEO MENSUAL */
        <div className="space-y-4">
          {/* Tarjetas de desembolso mensual */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(dataset?.month_ranges || []).map((m, idx) => {
              const mAmt = dataset.monthly_totals ? dataset.monthly_totals[idx] : 0;
              const mPct = dataset.monthly_percents ? dataset.monthly_percents[idx] : 0;
              const mCum = dataset.monthly_cumulative ? dataset.monthly_cumulative[idx] : 0;
              return (
                <div key={m.code} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {m.label}
                  </div>
                  <div className="text-base font-bold text-slate-800 font-mono">
                    {money(mAmt, currency)}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Mes: <strong>{pct(mPct)}</strong></span>
                    <span className="text-amber-700 font-semibold">Acum: {pct(mCum)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabla de Capítulos x Mes */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Distribución Valorizada por Mes Calendario (Fórmulas SUMPRODUCT)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Prorrateo exacto por días hábiles y de calendario
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-700 text-white font-semibold">
                    <th className="px-3 py-2 text-center w-12 border-r border-slate-600">N°</th>
                    <th className="px-3 py-2 text-left min-w-[220px] border-r border-slate-600">Capítulo</th>
                    {(dataset?.month_ranges || []).map(m => (
                      <th key={m.code} className="px-3 py-2 text-right border-r border-slate-600">
                        {m.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right w-24 border-r border-slate-600">Total $</th>
                    <th className="px-3 py-2 text-right w-16">Peso %</th>
                  </tr>
                </thead>
                <tbody>
                  {(dataset?.chapters || []).map((chap, cIdx) => {
                    const rowAmounts = dataset.monthly_chapter_amounts ? dataset.monthly_chapter_amounts[cIdx] : [];
                    return (
                      <tr key={chap.name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-center text-slate-400 border-r border-slate-100">{chap.num}</td>
                        <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-100">{chap.name}</td>
                        {rowAmounts.map((mAmt, mIdx) => (
                          <td key={mIdx} className="px-3 py-2 text-right font-mono text-slate-700 border-r border-slate-100">
                            {money(mAmt, currency)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                          {money(chap.amount, currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {pct(chap.weight_percent)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Fila Total Mensual */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td colSpan={2} className="px-3 py-2 text-right border-r border-slate-200">
                      TOTAL MENSUAL ($)
                    </td>
                    {(dataset?.monthly_totals || []).map((mTot, idx) => (
                      <td key={idx} className="px-3 py-2 text-right font-mono text-slate-900 border-r border-slate-200">
                        {money(mTot, currency)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono text-slate-900 border-r border-slate-200">
                      {money(dataset?.total_budget_amount, currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900">
                      100.00%
                    </td>
                  </tr>

                  {/* Fila Curva S Mensual */}
                  <tr className="bg-amber-100/70 font-bold border-b-2 border-amber-300">
                    <td colSpan={2} className="px-3 py-2 text-right text-amber-900 border-r border-amber-200">
                      CURVA S MENSUAL (ACUMULADO)
                    </td>
                    {(dataset?.monthly_cumulative || []).map((mCum, idx) => (
                      <td key={idx} className="px-3 py-2 text-right font-mono text-amber-900 border-r border-amber-200">
                        {pct(mCum)}
                      </td>
                    ))}
                    <td className="border-r border-amber-200" />
                    <td className="px-3 py-2 text-right font-mono text-amber-900">
                      100.00%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
