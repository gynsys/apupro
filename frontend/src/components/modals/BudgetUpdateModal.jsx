import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Database,
  TrendingUp,
  Maximize2,
  RefreshCw,
  Sparkles,
  Sliders,
  Layers,
  Wrench,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { useDatabaseContext } from '../../contexts/DatabaseContext';
import DecimalInput from '../DecimalInput';

export default function BudgetUpdateModal({ isOpen, onClose, budget, onSuccess }) {
  const { databases = [] } = useDatabaseContext();

  const [activeTab, setActiveTab] = useState('database'); // 'database' | 'inflation' | 'multiplier'
  const [selectedDbId, setSelectedDbId] = useState('master');
  const [presetMode, setPresetMode] = useState('preset_prices'); // 'preset_prices' | 'preset_factors' | 'preset_full' | 'custom'

  // Correcciones técnicas opcionales (Rendimientos, Depreciaciones, COVENIN)
  const [correctPerformance, setCorrectPerformance] = useState(false);
  const [correctDepreciation, setCorrectDepreciation] = useState(false);
  const [correctDescription, setCorrectDescription] = useState(false);

  // Opciones personalizadas (Modo Maprex)
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [customOptions, setCustomOptions] = useState({
    update_partida_performance: false,
    update_partida_desc: false,
    update_material_prices: true,
    update_equipment_prices: true,
    update_equipment_depreciation: false,
    update_labor_jornal: true,
    update_labor_bonus: true,
    enable_fixed_bonus: false,
    fixed_labor_bonus: 0.0,
  });

  // Pestaña 2: Inflación / Ajuste %
  const [inflationType, setInflationType] = useState('global'); // 'global' | 'by_rubro'
  const [inflationGlobal, setInflationGlobal] = useState(0.0);
  const [inflationMaterials, setInflationMaterials] = useState(0.0);
  const [inflationEquipments, setInflationEquipments] = useState(0.0);
  const [inflationLabor, setInflationLabor] = useState(0.0);

  // Pestaña 3: Multiplicador de Cantidades
  const [quantityMultiplier, setQuantityMultiplier] = useState(1.0);

  // Versionamiento Seguro
  const [createNewVersion, setCreateNewVersion] = useState(true);
  const [newVersionName, setNewVersionName] = useState('');
  const [isNameCustomized, setIsNameCustomized] = useState(false);

  // Estados de ejecución
  const [isUpdating, setIsUpdating] = useState(false);

  // Filtrar bases de datos disponibles válidas para contraste (excluyendo "personalizada" o vacías)
  const availableDatabases = databases.filter(
    (d) => d && d.id && d.id !== 'personalizada' && d.id !== 'compartidos'
  );

  const getDbLabel = (dbId) => {
    const found = availableDatabases.find((d) => d.id === dbId);
    if (found) return found.name;
    if (dbId === 'master') return 'Base Maestra Kosto';
    if (dbId === 'base_septiembre') return 'Base Septiembre 2026';
    if (dbId === 'base_agosto') return 'Base Agosto 2026';
    if (dbId === 'base_junio') return 'Base Junio 2026';
    if (dbId === 'base_mayo') return 'Base Mayo 2026';
    return (dbId || '').replace('base_', 'Base ').toUpperCase();
  };

  useEffect(() => {
    if (!isOpen) {
      setIsNameCustomized(false);
      return;
    }
    if (budget && isOpen && !isNameCustomized) {
      const baseName = budget.project_name || budget.name || 'Presupuesto';
      const dbLabel = getDbLabel(selectedDbId);
      if (activeTab === 'database') {
        setNewVersionName(`${baseName} — Act. ${dbLabel}`);
      } else if (activeTab === 'inflation') {
        setNewVersionName(`${baseName} — Ajuste ${inflationGlobal >= 0 ? '+' : ''}${inflationGlobal}%`);
      } else if (activeTab === 'multiplier') {
        setNewVersionName(`${baseName} — Escala x${quantityMultiplier}`);
      }
    }
  }, [budget, isOpen, selectedDbId, activeTab, inflationGlobal, quantityMultiplier, isNameCustomized]);

  if (!isOpen || !budget) return null;

  const handleCustomOptionChange = (key, val) => {
    setCustomOptions((prev) => ({ ...prev, [key]: val }));
  };

  const handleExecuteUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      let payload = {
        create_new_version: createNewVersion,
        new_version_name: newVersionName.trim() || undefined,
      };

      if (activeTab === 'database') {
        payload.target_database_id = selectedDbId;
        payload.mode = presetMode;

        // Flags para correcciones técnicas opcionales
        const isPerfActive = presetMode === 'custom'
          ? !!customOptions.update_partida_performance
          : (presetMode === 'preset_full' || correctPerformance);

        const isDeprecActive = presetMode === 'custom'
          ? !!customOptions.update_equipment_depreciation
          : (presetMode === 'preset_full' || presetMode === 'preset_factors' || correctDepreciation);

        const isDescActive = presetMode === 'custom'
          ? !!customOptions.update_partida_desc
          : (presetMode === 'preset_full' || correctDescription);

        payload.update_partida_performance = isPerfActive;
        payload.update_equipment_depreciation = isDeprecActive;
        payload.update_partida_desc = isDescActive;

        if (presetMode === 'custom') {
          payload = {
            ...payload,
            update_material_prices: customOptions.update_material_prices,
            update_equipment_prices: customOptions.update_equipment_prices,
            update_labor_jornal: customOptions.update_labor_jornal,
            update_labor_bonus: customOptions.update_labor_bonus,
            fixed_labor_bonus: customOptions.enable_fixed_bonus
              ? parseFloat(customOptions.fixed_labor_bonus) || 0.0
              : null,
          };
        }
      } else if (activeTab === 'inflation') {
        payload.mode = 'inflation_adjust';
        if (inflationType === 'global') {
          payload.inflation_global = parseFloat(inflationGlobal) || 0.0;
        } else {
          payload.inflation_materials = parseFloat(inflationMaterials) || 0.0;
          payload.inflation_equipments = parseFloat(inflationEquipments) || 0.0;
          payload.inflation_labor = parseFloat(inflationLabor) || 0.0;
        }
      } else if (activeTab === 'multiplier') {
        payload.mode = 'scale_quantities';
        payload.quantity_multiplier = parseFloat(quantityMultiplier) || 1.0;
        if (payload.quantity_multiplier <= 0) {
          toast.error('El factor multiplicador debe ser mayor a cero');
          setIsUpdating(false);
          return;
        }
      }

      const res = await budgetService.syncAdvanced(budget.id, payload);
      toast.success(res.message || 'Presupuesto actualizado correctamente', { duration: 5000 });
      onClose();
      if (typeof onSuccess === 'function') {
        onSuccess(res);
      }
    } catch (err) {
      console.error('Error al actualizar presupuesto:', err);
      toast.error(err.message || 'Error al actualizar el presupuesto');
    } finally {
      setIsUpdating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* ENCABEZADO */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs shrink-0">
              <RefreshCw size={20} className={isUpdating ? 'animate-spin' : ''} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Actualización de Presupuesto
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Revaloriza precios con bases históricas, ajusta por inflación o escala metrados.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS SUPERIORES */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 pt-2.5 gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`px-3.5 py-2 font-bold text-xs sm:text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'database'
                ? 'border-blue-600 text-blue-900 bg-white shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database size={15} />
            <span>Base de Datos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inflation')}
            className={`px-3.5 py-2 font-bold text-xs sm:text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'inflation'
                ? 'border-blue-600 text-blue-900 bg-white shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={15} />
            <span>Ajuste % / Inflación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('multiplier')}
            className={`px-3.5 py-2 font-bold text-xs sm:text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'multiplier'
                ? 'border-blue-600 text-blue-900 bg-white shadow-2xs font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Maximize2 size={15} />
            <span>Multiplicador Cantidades</span>
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          
          {/* ============================================================== */}
          {/* TAB 1: ACTUALIZACIÓN CON BASE DE DATOS                          */}
          {/* ============================================================== */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              {/* Selector de base de datos */}
              <div>
                <label className="block font-bold text-slate-800 mb-1 text-xs uppercase tracking-wider">
                  Base de Datos de Referencia:
                </label>
                <div className="relative">
                  <select
                    value={selectedDbId}
                    onChange={(e) => setSelectedDbId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {availableDatabases.map((dbItem) => (
                      <option key={dbItem.id} value={dbItem.id}>
                        {dbItem.id === 'master'
                          ? 'Base Maestra Kosto (17.320 partidas)'
                          : dbItem.id === 'base_septiembre'
                          ? 'Base Septiembre 2026 (13.608 partidas)'
                          : dbItem.id === 'base_agosto'
                          ? 'Base Agosto 2026 (12.652 partidas)'
                          : dbItem.id === 'base_junio'
                          ? 'Base Junio 2026'
                          : dbItem.id === 'base_mayo'
                          ? 'Base Mayo 2026'
                          : dbItem.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Se actualizarán los precios unitarios de los insumos coincidentes con la base seleccionada.
                </span>
              </div>

              {/* Tarjeta única, clara y directa: Solo Precios de Insumos */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/90 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500 shrink-0" />
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                    Actualización Exclusiva de Precios de Insumos
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  Actualiza únicamente los precios unitarios vigentes de materiales, equipos y jornales básicos. Todo lo demás se conserva intacto:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-700">
                  <div className="flex items-center gap-2 p-2 bg-white/90 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-emerald-600 font-black text-xs">✓</span>
                    <span><strong>Solo Precios:</strong> Materiales, equipos y jornales.</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white/90 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-emerald-600 font-black text-xs">✓</span>
                    <span><strong>Rendimientos y Cantidades:</strong> 100% intactos.</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white/90 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-emerald-600 font-black text-xs">✓</span>
                    <span><strong>Descripciones y Unidades:</strong> Sin alteraciones.</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white/90 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-emerald-600 font-black text-xs">✓</span>
                    <span><strong>Sin Bonos Inventados:</strong> Si el APU no tiene bono, se mantiene en 0.</span>
                  </div>
                </div>
              </div>

              {/* Opciones avanzadas discretas (Colapsadas por defecto para no saturar) */}
              <details className="group border border-slate-200 rounded-xl bg-slate-50/60 overflow-hidden text-xs">
                <summary className="p-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-between select-none transition">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Sliders size={13} className="text-slate-400" />
                    Opciones técnicas avanzadas (Opcional)
                  </span>
                  <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3.5 border-t border-slate-200 space-y-2.5 bg-white">
                  <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={correctPerformance}
                      onChange={(e) => setCorrectPerformance(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span>Sustituir rendimientos de partidas por los valores de la base (por defecto desactivado)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={correctDepreciation}
                      onChange={(e) => setCorrectDepreciation(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span>Sincronizar factores de depreciación / COP de equipos (por defecto desactivado)</span>
                  </label>
                </div>
              </details>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: AJUSTE PORCENTUAL / INFLACIÓN                           */}
          {/* ============================================================== */}
          {activeTab === 'inflation' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                Aplica un ajuste porcentual directo sobre los precios unitarios actuales del presupuesto, sin requerir una base externa.
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs sm:text-sm">
                  <input
                    type="radio"
                    name="inflationType"
                    value="global"
                    checked={inflationType === 'global'}
                    onChange={() => setInflationType('global')}
                  />
                  <span>Ajuste Global Uniforme</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs sm:text-sm">
                  <input
                    type="radio"
                    name="inflationType"
                    value="by_rubro"
                    checked={inflationType === 'by_rubro'}
                    onChange={() => setInflationType('by_rubro')}
                  />
                  <span>Diferenciado por Rubro</span>
                </label>
              </div>

              {inflationType === 'global' ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Porcentaje de Variación a TODO el presupuesto (%):
                  </label>
                  <div className="flex items-center gap-2">
                    <DecimalInput
                      value={inflationGlobal}
                      onChange={(val) => setInflationGlobal(val)}
                      allowNegative={true}
                      placeholder="0.00"
                      className="w-32 px-3 py-2 text-sm font-extrabold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="font-extrabold text-slate-600">%</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Ej: +10% incrementa todos los precios; -5% aplica un descuento general.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <label className="block text-xs font-bold text-amber-900">
                      Materiales (%):
                    </label>
                    <DecimalInput
                      value={inflationMaterials}
                      onChange={(val) => setInflationMaterials(val)}
                      allowNegative={true}
                      className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-extrabold border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <label className="block text-xs font-bold text-indigo-900">
                      Equipos (%):
                    </label>
                    <DecimalInput
                      value={inflationEquipments}
                      onChange={(val) => setInflationEquipments(val)}
                      allowNegative={true}
                      className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-extrabold border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <label className="block text-xs font-bold text-emerald-900">
                      Mano de Obra (%):
                    </label>
                    <DecimalInput
                      value={inflationLabor}
                      onChange={(val) => setInflationLabor(val)}
                      allowNegative={true}
                      className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-extrabold border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: MULTIPLICADOR DE CANTIDADES                              */}
          {/* ============================================================== */}
          {activeTab === 'multiplier' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950 leading-relaxed">
                Escala todas las cantidades métricas de las partidas por un factor multiplicador. Ideal para duplicar o recortar el alcance de la obra.
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Factor Multiplicador de Cantidades:
                </label>
                <div className="flex items-center gap-2">
                  <DecimalInput
                    value={quantityMultiplier}
                    onChange={(val) => setQuantityMultiplier(val)}
                    placeholder="1.00"
                    className="w-32 px-3 py-2 text-sm font-extrabold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="font-extrabold text-slate-600">x</span>
                </div>
                <span className="text-[11px] text-slate-500 block leading-tight">
                  Ejemplos: <strong>2.0</strong> duplica todas las cantidades métricas; <strong>0.5</strong> reduce el presupuesto al 50%; <strong>1.15</strong> añade un 15% de volumen.
                </span>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODO SEGURO: VERSIONAMIENTO (Guardar copia v2 vs Sobrescribir)   */}
          {/* ============================================================== */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={createNewVersion}
                onChange={(e) => setCreateNewVersion(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-black text-slate-900 block text-xs sm:text-sm">
                  Guardar como Nueva Versión / Copia (Recomendado)
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight">
                  {createNewVersion
                    ? 'Conserva el presupuesto actual intacto y crea un nuevo presupuesto con los precios actualizados.'
                    : 'Atención: Se sobrescribirán directamente los valores de este presupuesto.'}
                </span>
              </div>
            </label>

            {createNewVersion && (
              <div className="pl-6 pt-1">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Título de la Nueva Versión:
                </label>
                <input
                  type="text"
                  value={newVersionName}
                  onChange={(e) => {
                    setIsNameCustomized(true);
                    setNewVersionName(e.target.value);
                  }}
                  placeholder="Nombre del nuevo presupuesto"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* BOTONES INFERIORES */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecuteUpdate}
            disabled={isUpdating}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer shadow-xs transition"
          >
            {isUpdating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Actualizando presupuesto...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>
                  {createNewVersion ? 'Crear Versión Actualizada' : 'Actualizar Presupuesto'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
