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
    if (dbId === 'master') return 'Base Maestra CostBase';
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
        if (presetMode === 'custom') {
          payload = {
            ...payload,
            update_partida_performance: customOptions.update_partida_performance,
            update_partida_desc: customOptions.update_partida_desc,
            update_material_prices: customOptions.update_material_prices,
            update_equipment_prices: customOptions.update_equipment_prices,
            update_equipment_depreciation: customOptions.update_equipment_depreciation,
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
          {/* TAB 1: ACTUALIZACIÓN CON BASE DE DATOS (Maprex)                */}
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
                          ? 'Base Maestra CostBase (18.880 partidas)'
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
                  Se sustituirán los valores de los insumos y partidas coincidentes con los de la base seleccionada.
                </span>
              </div>

              {/* Modos rápidos (Presets) */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Modo de Actualización:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Preset 1: Solo Precios */}
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      presetMode === 'preset_prices'
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="presetMode"
                      value="preset_prices"
                      checked={presetMode === 'preset_prices'}
                      onChange={() => {
                        setPresetMode('preset_prices');
                        setShowCustomOptions(false);
                      }}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1">
                        <Sparkles size={14} className="text-amber-500" />
                        Solo Precios de Insumos (Recomendado)
                      </div>
                      <p className="text-[11px] text-slate-600 m-0 mt-0.5 leading-snug">
                        Actualiza únicamente precios unitarios, jornales y bonos. Rendimientos y cantidades permanecen intactos.
                      </p>
                    </div>
                  </label>

                  {/* Preset 2: Precios + Factores */}
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      presetMode === 'preset_factors'
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="presetMode"
                      value="preset_factors"
                      checked={presetMode === 'preset_factors'}
                      onChange={() => {
                        setPresetMode('preset_factors');
                        setShowCustomOptions(false);
                      }}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1">
                        <RefreshCw size={14} className="text-blue-600" />
                        Precios + Depreciación Equipos
                      </div>
                      <p className="text-[11px] text-slate-600 m-0 mt-0.5 leading-snug">
                        Actualiza precios y sincroniza los factores de depreciación / COP de maquinaria según la base.
                      </p>
                    </div>
                  </label>

                  {/* Preset 3: Receta Completa */}
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      presetMode === 'preset_full'
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="presetMode"
                      value="preset_full"
                      checked={presetMode === 'preset_full'}
                      onChange={() => {
                        setPresetMode('preset_full');
                        setShowCustomOptions(false);
                      }}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1">
                        <Layers size={14} className="text-purple-600" />
                        Receta Técnica Completa
                      </div>
                      <p className="text-[11px] text-slate-600 m-0 mt-0.5 leading-snug">
                        Reemplaza descripciones, rendimientos, consumos y composiciones de cuadrilla según la base.
                      </p>
                    </div>
                  </label>

                  {/* Preset 4: Personalizado (Maprex Granular) */}
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      presetMode === 'custom'
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="presetMode"
                      value="custom"
                      checked={presetMode === 'custom'}
                      onChange={() => {
                        setPresetMode('custom');
                        setShowCustomOptions(true);
                      }}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1">
                        <Sliders size={14} className="text-slate-700" />
                        Personalizado (Opciones Maprex)
                      </div>
                      <p className="text-[11px] text-slate-600 m-0 mt-0.5 leading-snug">
                        Control granular por casilla: fijar bonos uniformes, depreciaciones o consumos específicos.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Panel Personalizado (Maprex Granular) */}
              {presetMode === 'custom' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5 text-xs">
                  <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                    Selección Granular de Rubros:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Partidas */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <span className="font-bold text-blue-900 block border-b pb-1">
                        Partidas
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_partida_performance}
                          onChange={(e) =>
                            handleCustomOptionChange('update_partida_performance', e.target.checked)
                          }
                        />
                        <span>Actualizar Rendimiento</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_partida_desc}
                          onChange={(e) =>
                            handleCustomOptionChange('update_partida_desc', e.target.checked)
                          }
                        />
                        <span>Descripción y Unidad COVENIN</span>
                      </label>
                    </div>

                    {/* Materiales */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <span className="font-bold text-amber-900 block border-b pb-1">
                        Materiales
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_material_prices}
                          onChange={(e) =>
                            handleCustomOptionChange('update_material_prices', e.target.checked)
                          }
                        />
                        <span>Precios Unitarios</span>
                      </label>
                    </div>

                    {/* Equipos */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <span className="font-bold text-indigo-900 block border-b pb-1">
                        Equipos
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_equipment_prices}
                          onChange={(e) =>
                            handleCustomOptionChange('update_equipment_prices', e.target.checked)
                          }
                        />
                        <span>Costo Diario / Alquiler</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_equipment_depreciation}
                          onChange={(e) =>
                            handleCustomOptionChange('update_equipment_depreciation', e.target.checked)
                          }
                        />
                        <span>Factor COP / Depreciación</span>
                      </label>
                    </div>

                    {/* Mano de Obra */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <span className="font-bold text-emerald-900 block border-b pb-1">
                        Mano de Obra
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_labor_jornal}
                          onChange={(e) =>
                            handleCustomOptionChange('update_labor_jornal', e.target.checked)
                          }
                        />
                        <span>Jornal Básico (Tabulador)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={customOptions.update_labor_bonus}
                          onChange={(e) =>
                            handleCustomOptionChange('update_labor_bonus', e.target.checked)
                          }
                        />
                        <span>Bono de Asistencia de la Base</span>
                      </label>

                      <div className="pt-1 border-t border-slate-100 space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={customOptions.enable_fixed_bonus}
                            onChange={(e) =>
                              handleCustomOptionChange('enable_fixed_bonus', e.target.checked)
                            }
                          />
                          <span>Fijar Bono Uniforme para todos:</span>
                        </label>
                        {customOptions.enable_fixed_bonus && (
                          <div className="flex items-center gap-2 pl-5 pt-0.5">
                            <span className="font-bold text-slate-600">$</span>
                            <DecimalInput
                              value={customOptions.fixed_labor_bonus}
                              onChange={(val) =>
                                handleCustomOptionChange('fixed_labor_bonus', val)
                              }
                              placeholder="0.00"
                              className="w-24 px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-500">/ día</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
