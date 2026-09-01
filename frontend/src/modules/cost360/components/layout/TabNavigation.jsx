import React, { useState } from 'react';
import { TABS } from '../../constants/tabs.config';
import { useUserCostos } from '../../../../context/UserCostosContext';
import toast from 'react-hot-toast';

const TabNavigation = ({ activeTab, onTabChange, showPartidasFilters, onlyCoded, onToggleOnlyCoded, config, onToggleGlobalCoded }) => {
  // Costos desde contexto global — persisten en BD por usuario
  const { costosConfig, updateCostosConfig, loading } = useUserCostos();

  // Estado local para edición en curso (antes de guardar)
  const [draft, setDraft] = useState(null);
  const currentCostos = draft ?? costosConfig;

  const handleCostoChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    setDraft(prev => ({ ...(prev ?? costosConfig), [key]: numValue }));
  };

  const handleSaveCostos = async () => {
    if (!draft) return;
    try {
      await updateCostosConfig(draft);
      setDraft(null);
      toast.success('Configuración de costos guardada');
    } catch (error) {
      toast.error('Error al guardar la configuración de costos');
    }
  };

  return (
    <div className="px-4 flex justify-between items-end pt-2 pb-0">
      <div className="flex gap-1">
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all duration-200 btn-borde-azul-redondeado ${
                active
                  ? 'text-blue-700 border-blue-600 bg-blue-50/60'
                  : 'text-slate-500 border-transparent'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Inputs de costos */}
      <div className="flex gap-2 items-end pb-2">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Utilidad</label>
          <input
            type="number"
            value={currentCostos?.porcentajeUtilidad ?? 0}
            onChange={(e) => handleCostoChange('porcentajeUtilidad', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Admin</label>
          <input
            type="number"
            value={currentCostos?.porcentajeAdministracion ?? 0}
            onChange={(e) => handleCostoChange('porcentajeAdministracion', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IVA %</label>
          <input
            type="number"
            value={currentCostos?.iva ?? 0}
            onChange={(e) => handleCostoChange('iva', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">F.C.A.S %</label>
          <input
            type="number"
            value={currentCostos?.fcas ?? 0}
            onChange={(e) => handleCostoChange('fcas', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          onClick={handleSaveCostos}
          disabled={!draft || loading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {showPartidasFilters && (
        <div className="pb-2 flex flex-col sm:flex-row items-end gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg" title="Afecta a todos los usuarios del sistema">
            <input
              type="checkbox"
              id="globalCoded"
              checked={config?.forceOnlyCodedMaster === true}
              onChange={(e) => onToggleGlobalCoded(e.target.checked)}
              className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="globalCoded" className="text-sm font-bold text-indigo-900 cursor-pointer">
              Filtro Publico Global
            </label>
          </div>
          <div className="flex items-center gap-2 px-3 py-2">
            <input
              type="checkbox"
              id="onlyCoded"
              checked={onlyCoded}
              onChange={(e) => onToggleOnlyCoded(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="onlyCoded" className="text-sm font-medium text-slate-700 cursor-pointer">
              Filtro Local (Tu vista)
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabNavigation;
