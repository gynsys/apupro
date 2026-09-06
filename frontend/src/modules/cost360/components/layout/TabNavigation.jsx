import React, { useState } from 'react';
import { TABS } from '../../constants/tabs.config';
import { useUserCostos } from '../../../../context/UserCostosContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FiDatabase, FiTool } from 'react-icons/fi';
import { apiPost } from '../../../../lib/apiHelper';
import UtilitiesModal from '../modals/UtilitiesModal';



const updateRAGBrain = async () => {
  const response = await apiPost('/admin/update-rag-brain', {});
  if (!response.ok) throw new Error('Failed to update RAG brain');
  return response.json();
};

const TabNavigation = ({
  activeTab,
  onTabChange,
  config,
  onToggleGlobalCoded,
  onlyCoded,
  onToggleOnlyCoded,
  onToggleCategory,
  onLimitChange,
}) => {
  // Costos desde contexto global — persisten en BD por usuario
  const { costosConfig, updateCostosConfig, loading } = useUserCostos();

  // Estado local para edición en curso (antes de guardar)
  const [draft, setDraft] = useState(null);
  const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(false);
  const currentCostos = draft ?? costosConfig;

  const navigate = useNavigate();

  const handleUpdateRAGBrain = async () => {
    const confirm = window.confirm("¿Estas seguro de que deseas actualizar el Cerebro RAG? Este proceso toma de 5 a 15 minutos en segundo plano y consumira CPU del servidor.");
    if (!confirm) return;

    const toastId = toast.loading('Iniciando actualizacion del Cerebro IA...');
    try {
      await updateRAGBrain();
      toast.success('El Cerebro RAG se esta actualizando en el servidor. Estara listo en unos minutos.', { id: toastId, duration: 8000 });
    } catch (err) {
      toast.error('Error al iniciar la actualizacion del Cerebro RAG', { id: toastId });
    }
  };


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

      
      {/* Botón de Utilitarios Integrado (Agrupa RAG, Auto IA, Filtros y Debug JSON) */}
      <div className="flex gap-2 items-center pb-2 ml-4 mr-auto">
          <button
            onClick={() => setIsUtilitiesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02] border border-slate-700"
            title="Utilitarios del Administrador (RAG, Auto IA, Filtros de Catálogo y Debug JSON)"
          >
            <FiTool className="w-3.5 h-3.5 text-amber-400" />
            Utilitarios
            {(config?.forceOnlyCodedMaster || onlyCoded) && (
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" title="Filtros de catálogo activos" />
            )}
          </button>
      </div>

      {/* Inputs de costos */}
      <div className="flex gap-2 items-end pb-2">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Utilidad</label>
          <input
            type="number"
            value={currentCostos?.porcentajeUtilidad ?? 0}
            onChange={(e) => handleCostoChange('porcentajeUtilidad', e.target.value)}
            className="w-14 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 text-center hide-spinners focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Admin</label>
          <input
            type="number"
            value={currentCostos?.porcentajeAdministracion ?? 0}
            onChange={(e) => handleCostoChange('porcentajeAdministracion', e.target.value)}
            className="w-14 px-2 py-1.5 text-center hide-spinners bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IVA %</label>
          <input
            type="number"
            value={currentCostos?.iva ?? 0}
            onChange={(e) => handleCostoChange('iva', e.target.value)}
            className="w-14 px-2 py-1.5 text-center hide-spinners bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">F.C.A.S %</label>
          <input
            type="number"
            value={currentCostos?.fcas ?? 0}
            onChange={(e) => handleCostoChange('fcas', e.target.value)}
            className="w-14 px-2 py-1.5 text-center hide-spinners bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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

      <UtilitiesModal
        isOpen={isUtilitiesOpen}
        onClose={() => setIsUtilitiesOpen(false)}
        config={config}
        onToggleGlobalCoded={onToggleGlobalCoded}
        onlyCoded={onlyCoded}
        onToggleOnlyCoded={onToggleOnlyCoded}
        onToggleCategory={onToggleCategory}
        onLimitChange={onLimitChange}
        onUpdateRAGBrain={handleUpdateRAGBrain}
      />
    </div>
  );
};

export default TabNavigation;
