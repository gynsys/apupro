import React from 'react';
import { TABS } from '../../constants/tabs.config';

const TabNavigation = ({ activeTab, onTabChange, showPartidasFilters, onlyCoded, onToggleOnlyCoded, config, onToggleGlobalCoded }) => {
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