import React, { useState } from 'react';
import { SiteConfigContext } from '../../../App';
import { useAdminConfig } from '../hooks/useAdminConfig';
import AdminHeader from '../components/layout/AdminHeader';
import TabNavigation from '../components/layout/TabNavigation';
import DatabaseSelector from '../components/layout/DatabaseSelector';
import PartidasTab from '../components/tabs/PartidasTab';
import CatalogTab from '../components/tabs/CatalogTab';
import ScrapingTab from '../components/tabs/ScrapingTab';
import PDFsTab from '../components/tabs/PDFsTab';
import UsuariosTab from '../components/tabs/UsuariosTab';
import CategoryManager from '../components/CategoryManager';
import { TABS } from '../constants/tabs.config';
import { DEFAULT_APU_PROMPT } from '../constants/prompts.default';
import GlassCard from '../../../components/shared/GlassCard';
import { FiCpu } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { apiPut } from '../../../lib/apiHelper';
import { useUserCostos } from '../../../context/UserCostosContext';

const glass = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
};

const glassStrong = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
};

const AdminDatabasePage = () => {
  const [activeTab, setActiveTab] = useState('partidas');
  const [onlyCoded, setOnlyCoded] = useState(true);
  const [selectedDatabase, setSelectedDatabase] = useState('master');
  const [promptText, setPromptText] = useState(DEFAULT_APU_PROMPT);

  // Costos desde contexto global (persiste en BD, compartido con Calculadora FCAS)
  const { costosConfig, updateCostosConfig } = useUserCostos();

  const siteConfig = React.useContext(SiteConfigContext);
  const config = siteConfig?.config || {};


  const toggleGlobalCoded = async (isChecked) => {
    try {
      const newConfig = { ...config, forceOnlyCodedMaster: isChecked };
      const response = await apiPut('/admin/config', newConfig);
      if (response.ok) {
        const result = await response.json();
        const updatedConfig = result.config || newConfig;
        if (siteConfig?.setConfig) {
          siteConfig.setConfig(updatedConfig);
        }
        if (window.ARKO_SITE_CONFIG) {
          window.ARKO_SITE_CONFIG = updatedConfig;
        }
        toast.success(isChecked ? "Filtro publico ACTIVADO" : "Filtro publico DESACTIVADO");
      }
    } catch (err) {
      toast.error("Error al actualizar la configuracion publica");
    }
  };

  const toggleCategory = async (code, isVisible) => {
    try {
      const hiddenCategories = config?.hiddenCategories || [];
      let newHidden;
      
      if (isVisible) {
        newHidden = hiddenCategories.filter(c => c !== code);
      } else {
        newHidden = [...hiddenCategories, code];
      }

      const newConfig = { ...config, hiddenCategories: newHidden };

      // Optimistic UI update
      if (siteConfig?.setConfig) {
        siteConfig.setConfig(newConfig);
      }

      const response = await fetch(`${siteConfig?.API_URL || process.env.VITE_API_URL}/arko/admin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
        },
        body: JSON.stringify(newConfig)
      });
      
      if (response.ok) {
        const result = await response.json();
        const updatedConfig = result.config || newConfig;
        if (siteConfig?.setConfig) {
          siteConfig.setConfig(updatedConfig);
        }
        if (window.ARKO_SITE_CONFIG) {
          window.ARKO_SITE_CONFIG = updatedConfig;
        }
        toast.success(`Categoria ${code} ${isVisible ? 'ACTIVADA' : 'OCULTADA'}`);
      } else {
        // Revert on failure
        if (siteConfig?.setConfig) siteConfig.setConfig(config);
        toast.error("Error al actualizar categorias en servidor");
      }
    } catch (err) {
      if (siteConfig?.setConfig) siteConfig.setConfig(config);
      toast.error("Error de red al actualizar categorias");
    }
  };

  const showPartidasFilters = activeTab === 'partidas';

  return (
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden gap-4">
      <AdminHeader />

      <div className="rounded-2xl relative z-10" style={glassStrong}>
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="flex justify-between items-center px-4 -mt-2">
        <div className="flex gap-4 items-center">
          {showPartidasFilters && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg" title="Afecta a todos los usuarios del sistema">
                <input
                  type="checkbox"
                  id="globalCoded"
                  checked={config?.forceOnlyCodedMaster === true}
                  onChange={(e) => toggleGlobalCoded(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="globalCoded" className="text-sm font-bold text-indigo-900 cursor-pointer">
                  Filtro Publico Global
                </label>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
                <input
                  type="checkbox"
                  id="onlyCoded"
                  checked={onlyCoded}
                  onChange={(e) => setOnlyCoded(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="onlyCoded" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Filtro Local (Tu vista)
                </label>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-4 items-center">
          {showPartidasFilters && (
            <CategoryManager config={config} onToggleCategory={toggleCategory} />
          )}
          <DatabaseSelector
            value={selectedDatabase}
            onChange={setSelectedDatabase}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 min-h-0 mt-2">
        {activeTab === 'partidas' && (
          <PartidasTab onlyCoded={onlyCoded} />
        )}

        {activeTab === 'materiales' && (
          <CatalogTab
            title="Materiales"
            resourceType="materials"
            selectedDatabase={selectedDatabase}
            config={config}
          />
        )}

        {activeTab === 'equipos' && (
          <CatalogTab
            title="Equipos"
            resourceType="equipments"
            selectedDatabase={selectedDatabase}
            config={config}
          />
        )}

        {activeTab === 'mano_obra' && (
          <CatalogTab
            title="Mano de Obra"
            resourceType="labors"
            selectedDatabase={selectedDatabase}
            config={config}
          />
        )}

        {activeTab === 'scraping' && <ScrapingTab />}

        {activeTab === 'pdfs' && <PDFsTab />}

        {activeTab === 'prompt' && (
          <GlassCard className="rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto max-h-full">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Prompt IA - APU</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Configura el prompt que usa la IA para generar Partidas APU (Solo Admin)
                </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 min-h-0">
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-sm font-medium text-slate-700">Prompt para generación de APU:</label>
                <button
                  onClick={() => {
                    setPromptText(DEFAULT_APU_PROMPT);
                    toast.success('Prompt restaurado al valor del backend');
                  }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-slate-700 px-3 py-1 rounded transition-colors"
                >
                  Restaurar Backend
                </button>
              </div>

              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="flex-1 w-full p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={20}
              />

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    localStorage.setItem('admin_apu_prompt', promptText);
                    toast.success('Prompt guardado en localStorage');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar en LocalStorage
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(promptText);
                    toast.success('Prompt copiado al portapapeles');
                  }}
                  className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        {activeTab === 'usuarios' && <UsuariosTab />}
      </div>
    </div>
  );
};

export default AdminDatabasePage;
