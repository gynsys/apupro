import React from 'react';
import { TABS } from '../../constants/tabs.config';
import { apiPut } from '../../../../lib/apiHelper';

const TabNavigation = ({ activeTab, onTabChange, showPartidasFilters, onlyCoded, onToggleOnlyCoded, config, onToggleGlobalCoded, costosConfig, onCostosConfigChange }) => {
  const handleCostoChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    onCostosConfigChange({ ...costosConfig, [key]: numValue });
  };

  const handleSaveCostos = async () => {
    try {
      await apiPut('/arko/admin/config', {
        ...config,
        costos: costosConfig
      });
      alert('Configuración de costos guardada exitosamente');
    } catch (error) {
      console.error('Error guardando costos:', error);
      alert('Error al guardar la configuración de costos');
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
            value={costosConfig?.porcentajeUtilidad || 0}
            onChange={(e) => handleCostoChange('porcentajeUtilidad', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Admin</label>
          <input
            type="number"
            value={costosConfig?.porcentajeAdministracion || 0}
            onChange={(e) => handleCostoChange('porcentajeAdministracion', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IVA %</label>
          <input
            type="number"
            value={costosConfig?.iva || 0}
            onChange={(e) => handleCostoChange('iva', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">F.C.A.S %</label>
          <input
            type="number"
            value={costosConfig?.fcas || 0}
            onChange={(e) => handleCostoChange('fcas', e.target.value)}
            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          onClick={handleSaveCostos}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Guardar
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
