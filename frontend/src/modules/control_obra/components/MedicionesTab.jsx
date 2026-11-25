import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Save,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  Calculator,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { controlObraService } from '../controlObraService';
import {
  GEOMETRY_CONFIGS,
  GEOMETRY_TYPES,
  getDefaultGeometryType,
  computeGeometryBase,
} from '../../computos/domain/geometry.js';
import { round2 } from '../../computos/domain/formulas.js';

const STORAGE_PREFIX = 'control_obra_mediciones_v1_';

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function money(val, currency = 'USD') {
  return `${currency === 'USD' ? '$' : 'Bs.'} ${Number(val || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MedicionesTab({
  budgetId,
  budgetName,
  items = [],
  currency = 'USD',
  modifiedAmount = 0,
  onMeasurementsSaved,
  onCascadeUpdate,
}) {
  const [search, setSearch] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('ALL');
  const [measurementDate, setMeasurementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Estado de mediciones por partida: { [itemId]: { quantity: number, hasPartials: boolean, partials: [] } }
  const [measurements, setMeasurements] = useState({});
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Extraer lista única de capítulos
  const chapters = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      if (it.chapter) set.add(it.chapter);
    });
    return Array.from(set);
  }, [items]);

  // Cargar estado inicial desde localStorage o desde items existentes
  useEffect(() => {
    if (!budgetId || !items.length) return;

    let saved = null;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${budgetId}`);
      if (raw) saved = JSON.parse(raw);
    } catch (_err) {
      saved = null;
    }

    const initial = {};
    const initialExpanded = new Set();

    items.forEach((it) => {
      const savedItem = saved?.[it.item_id];
      if (savedItem && Array.isArray(savedItem.partials) && savedItem.partials.length > 0) {
        initial[it.item_id] = {
          quantity: Number(savedItem.quantity ?? it.executed_quantity ?? 0),
          hasPartials: true,
          partials: savedItem.partials,
        };
        initialExpanded.add(it.item_id);
      } else {
        initial[it.item_id] = {
          quantity: Number(it.executed_quantity || 0),
          hasPartials: false,
          partials: [],
        };
      }
    });

    setMeasurements(initial);
    setExpandedItems(initialExpanded);
    setIsDirty(false);
  }, [budgetId, items]);

  // Recalcular un parcial específico
  const recalcPartial = useCallback((partial, unit) => {
    const geomType = partial.geometryType || getDefaultGeometryType(unit);
    const { baseGeom, formulaStr } = computeGeometryBase({ ...partial, geometryType: geomType }, unit);
    const timesVal = parseNum(partial.times) ?? 1;
    const partialTotal = round2((baseGeom || 0) * (timesVal > 0 ? timesVal : 1));

    let displayFormula = formulaStr;
    if (timesVal !== 1 && timesVal > 0 && formulaStr) {
      displayFormula = `${timesVal} × ${formulaStr} = ${partialTotal} ${unit}`;
    }

    return {
      ...partial,
      geometryType: geomType,
      partial: partialTotal,
      formula: displayFormula,
    };
  }, []);

  // Agregar nuevo parcial a una partida
  const handleAddPartial = (itemId, unit) => {
    setMeasurements((prev) => {
      const current = prev[itemId] || { quantity: 0, hasPartials: true, partials: [] };
      const currentPartials = current.partials || [];
      const newIndex = currentPartials.length + 1;

      const newPartial = recalcPartial(
        {
          id: `p-${Date.now()}-${newIndex}`,
          name: `Parcial ${newIndex}`,
          times: 1,
          length: '',
          width: '',
          height: '',
          geometryType: getDefaultGeometryType(unit),
        },
        unit
      );

      const updatedPartials = [...currentPartials, newPartial];
      const newTotal = round2(updatedPartials.reduce((sum, p) => sum + (Number(p.partial) || 0), 0));

      return {
        ...prev,
        [itemId]: {
          ...current,
          hasPartials: true,
          partials: updatedPartials,
          quantity: newTotal,
        },
      };
    });

    setExpandedItems((prev) => new Set([...prev, itemId]));
    setIsDirty(true);
  };

  // Actualizar un campo de un parcial
  const handleUpdatePartial = (itemId, partialId, field, val, unit) => {
    setMeasurements((prev) => {
      const current = prev[itemId];
      if (!current || !current.partials) return prev;

      const updatedPartials = current.partials.map((p) => {
        if (p.id !== partialId) return p;
        const modified = { ...p, [field]: val };
        return recalcPartial(modified, unit);
      });

      const newTotal = round2(updatedPartials.reduce((sum, p) => sum + (Number(p.partial) || 0), 0));

      return {
        ...prev,
        [itemId]: {
          ...current,
          partials: updatedPartials,
          quantity: newTotal,
        },
      };
    });

    setIsDirty(true);
  };

  // Eliminar un parcial
  const handleRemovePartial = (itemId, partialId) => {
    setMeasurements((prev) => {
      const current = prev[itemId];
      if (!current || !current.partials) return prev;

      const updatedPartials = current.partials.filter((p) => p.id !== partialId);
      const newTotal = round2(updatedPartials.reduce((sum, p) => sum + (Number(p.partial) || 0), 0));

      return {
        ...prev,
        [itemId]: {
          ...current,
          hasPartials: updatedPartials.length > 0,
          partials: updatedPartials,
          quantity: newTotal,
        },
      };
    });

    setIsDirty(true);
  };

  // Actualizar cantidad directa (para partidas sin parciales)
  const handleDirectQuantityChange = (itemId, val) => {
    const num = parseNum(val) ?? 0;
    setMeasurements((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        hasPartials: false,
        quantity: Math.max(0, num),
      },
    }));
    setIsDirty(true);
  };

  // Alternar expansión del desglose de una partida
  const toggleExpand = (itemId) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Expandir / colapsar todos
  const toggleExpandAll = () => {
    if (expandedItems.size > 0) {
      setExpandedItems(new Set());
    } else {
      setExpandedItems(new Set(items.map((it) => it.item_id)));
    }
  };

  // Cálculo en cascada en tiempo real de los avances del proyecto
  const cascadeTotals = useMemo(() => {
    let executedAmount = 0;
    let totalBudgetHours = 0;
    let executedHours = 0;

    items.forEach((it) => {
      const m = measurements[it.item_id];
      const qty = m ? Number(m.quantity || 0) : Number(it.executed_quantity || 0);
      const up = Number(it.unit_price || 0);
      executedAmount += qty * up;

      const bh = Number(it.budget_hours || 0);
      const cq = Number(it.current_quantity || 1);
      totalBudgetHours += bh;
      if (cq > 0 && bh > 0) {
        executedHours += (qty / cq) * bh;
      }
    });

    const physicalPct = modifiedAmount > 0 ? (executedAmount / modifiedAmount) * 100 : 0;
    const hhPct = totalBudgetHours > 0 ? (executedHours / totalBudgetHours) * 100 : 0;

    return {
      executedAmount: round2(executedAmount),
      physicalPercent: round2(physicalPct),
      hhPercent: round2(hhPct),
    };
  }, [items, measurements, modifiedAmount]);

  // Notificar al componente padre de la cascada
  useEffect(() => {
    if (onCascadeUpdate) {
      onCascadeUpdate(cascadeTotals);
    }
  }, [cascadeTotals, onCascadeUpdate]);

  // Guardar mediciones
  const handleSave = async () => {
    if (!budgetId) return;
    setIsSaving(true);
    try {
      const syncItems = items.map((it) => ({
        item_id: it.item_id,
        quantity: Number(measurements[it.item_id]?.quantity ?? it.executed_quantity ?? 0),
      }));

      await controlObraService.syncProgress(budgetId, {
        items: syncItems,
        entry_date: measurementDate,
        notes: `Mediciones de obra registradas al ${measurementDate}`,
      });

      // Persistir el desglose detallado en localStorage
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${budgetId}`, JSON.stringify(measurements));
      } catch (_e) {
        // ignore
      }

      setIsDirty(false);
      toast.success('Mediciones guardadas y avances recalculados con éxito.');
      if (onMeasurementsSaved) {
        await onMeasurementsSaved();
      }
    } catch (err) {
      toast.error(err.message || 'Error al guardar las mediciones.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado de partidas
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (selectedChapter !== 'ALL' && it.chapter !== selectedChapter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const code = String(it.code || '').toLowerCase();
        const desc = String(it.description || '').toLowerCase();
        if (!code.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [items, selectedChapter, search]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
      {/* Barra de Control Superior */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Capítulo */}
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          >
            <option value="ALL">Todos los Capítulos ({items.length})</option>
            {chapters.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>

          {/* Buscador */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código o texto (ej: Pintura, Marco)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-52 sm:w-64 bg-white"
            />
          </div>

          {/* Botón expandir/colapsar todos */}
          <button
            type="button"
            onClick={toggleExpandAll}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
          >
            <Layers size={13} />
            {expandedItems.size > 0 ? 'Colapsar todos' : 'Expandir todos'}
          </button>
        </div>

        {/* Acciones y Métricas en vivo */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
            <Sparkles size={14} className="text-amber-600" />
            <span className="text-xs text-amber-900 font-bold">
              Ejecutado: {money(cascadeTotals.executedAmount, currency)} ({cascadeTotals.physicalPercent}%)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={measurementDate}
              onChange={(e) => setMeasurementDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700"
              title="Fecha de corte de la medición"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all shadow-xs ${
              isDirty
                ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {isDirty ? 'Guardar Cambios' : 'Mediciones al Día'}
          </button>
        </div>
      </div>

      {/* Lista de Partidas y Desglose de Cómputos */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            No se encontraron partidas que coincidan con el filtro.
          </div>
        ) : (
          filteredItems.map((it, idx) => {
            const m = measurements[it.item_id] || { quantity: it.executed_quantity || 0, partials: [] };
            const measuredQty = Number(m.quantity || 0);
            const currentQty = Number(it.current_quantity || 0);
            const unitPrice = Number(it.unit_price || 0);
            const pctVal = currentQty > 0 ? (measuredQty / currentQty) * 100 : 0;
            const isOverContract = measuredQty > currentQty;
            const isExpanded = expandedItems.has(it.item_id);
            const partialsCount = (m.partials || []).length;

            return (
              <div
                key={it.item_id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Cabecera de la Partida */}
                <div className="p-3 sm:px-4 sm:py-3 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                      {it.code || `P${idx + 1}`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug break-words">
                        {it.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                        {it.chapter && <span className="font-medium text-slate-400">{it.chapter}</span>}
                        <span>Contratado: <strong className="text-slate-700">{currentQty} {it.unit}</strong></span>
                        <span>PU: <strong className="text-slate-700">{money(unitPrice, currency)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Panel de Medición y Avance */}
                  <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Medido:</span>
                        {partialsCount > 0 ? (
                          <span className="font-mono font-black text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {measuredQty} {it.unit}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={m.quantity === 0 ? '' : m.quantity}
                            placeholder="0.00"
                            onChange={(e) => handleDirectQuantityChange(it.item_id, e.target.value)}
                            className="font-mono font-bold text-xs text-right w-20 px-1.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        )}
                        <span className="text-xs font-semibold text-slate-500">{it.unit}</span>
                      </div>

                      <div className="flex items-center gap-2 justify-end mt-1">
                        <span className={`text-[11px] font-bold ${isOverContract ? 'text-amber-600' : 'text-slate-600'}`}>
                          {pctVal.toFixed(1)}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isOverContract ? 'bg-amber-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(100, pctVal)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Botón para Desglosar / Expandir Parciales */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isExpanded && partialsCount === 0) {
                          handleAddPartial(it.item_id, it.unit);
                        } else {
                          toggleExpand(it.item_id);
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        partialsCount > 0
                          ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                      }`}
                      title={partialsCount > 0 ? 'Ver desglose de cómputos' : 'Desglosar en filas / parciales'}
                    >
                      {partialsCount > 0 ? (
                        <>
                          <Calculator size={13} className="text-amber-700" />
                          <span>{partialsCount} {partialsCount === 1 ? 'parcial' : 'parciales'}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>Desglosar medidas</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tabla de Parciales / Mediciones de Campo (Estilo Planilla de Cómputos) */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 bg-amber-50/50 border-t border-amber-200/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-amber-950 font-bold px-1">
                      <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-800">
                        <Calculator size={13} className="text-amber-700" /> Desglose de Mediciones In-Situ ({it.unit})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddPartial(it.item_id, it.unit)}
                        className="flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:text-blue-900 bg-white border border-blue-300 hover:bg-blue-50 px-2.5 py-1 rounded-lg shadow-2xs"
                      >
                        <Plus size={13} /> Agregar fila de medida
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-amber-100 text-amber-950 text-[11px] font-black uppercase">
                          <tr>
                            <th className="px-2.5 py-1.5 w-8 text-center">N°</th>
                            <th className="px-2.5 py-1.5 min-w-[160px]">Ubicación / Tramo / Parcial</th>
                            <th className="px-2 py-1.5 min-w-[140px]">Forma Geométrica</th>
                            <th className="px-2 py-1.5 w-16 text-right" title="Nº de veces (permite decimales)">N° Veces</th>
                            <th className="px-2 py-1.5 w-16 text-right">Largo (m)</th>
                            <th className="px-2 py-1.5 w-16 text-right">Ancho (m)</th>
                            <th className="px-2 py-1.5 w-16 text-right">Alto (m)</th>
                            <th className="px-3 py-1.5 min-w-[180px]">Fórmula Resultante</th>
                            <th className="px-2.5 py-1.5 w-20 text-right">Subtotal</th>
                            <th className="px-1.5 py-1.5 w-8 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 font-medium text-slate-700">
                          {(m.partials || []).map((p, pIdx) => (
                            <tr key={p.id} className="hover:bg-amber-50/60 transition-colors">
                              <td className="px-2 py-1 text-center font-mono text-[11px] text-amber-800 font-bold">
                                {pIdx + 1}
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="text"
                                  value={p.name || ''}
                                  placeholder="Ej: Fachada norte / Eje A-B"
                                  onChange={(e) => handleUpdatePartial(it.item_id, p.id, 'name', e.target.value, it.unit)}
                                  className="w-full px-2 py-1 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-xs"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <select
                                  value={p.geometryType || getDefaultGeometryType(it.unit)}
                                  onChange={(e) => handleUpdatePartial(it.item_id, p.id, 'geometryType', e.target.value, it.unit)}
                                  className="w-full px-1.5 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  {GEOMETRY_CONFIGS.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.icon} {g.shortLabel}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={p.times === '' ? '' : p.times}
                                  placeholder="1"
                                  onChange={(e) => handleUpdatePartial(it.item_id, p.id, 'times', e.target.value, it.unit)}
                                  className="w-full text-right px-1.5 py-1 rounded border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={p.length === '' ? '' : p.length}
                                  placeholder="0.00"
                                  onChange={(e) => handleUpdatePartial(it.item_id, p.id, 'length', e.target.value, it.unit)}
                                  className="w-full text-right px-1.5 py-1 rounded border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={p.width === '' ? '' : p.width}
                                  placeholder="0.00"
                                  onChange={(e) => handleUpdatePartial(it.item_id, p.id, 'width', e.target.value, it.unit)}
                                  className="w-full text-right px-1.5 py-1 rounded border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={p.height === '' ? '' : p.height}
                                  placeholder="0.00"
                                  onChange={(e) => handleUpdatePartial(it.item_id, p.id, 'height', e.target.value, it.unit)}
                                  className="w-full text-right px-1.5 py-1 rounded border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-1 font-mono text-[11px] text-amber-900 bg-amber-50/30 truncate" title={p.formula}>
                                {p.formula || '—'}
                              </td>
                              <td className="px-2 py-1 text-right font-mono font-bold text-xs text-slate-800">
                                {p.partial || 0}
                              </td>
                              <td className="px-1 py-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePartial(it.item_id, p.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                  title="Eliminar parcial"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-100/70 border-t border-amber-200 text-xs font-bold text-amber-950">
                          <tr>
                            <td colSpan={7} className="px-3 py-1.5 text-right font-black">
                              Total Medido ({it.description.slice(0, 30)}...):
                            </td>
                            <td colSpan={3} className="px-3 py-1.5 text-right font-mono font-black text-sm text-blue-800">
                              {measuredQty} {it.unit}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
