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
      let newHidden = [...hiddenCategories];

      if (isVisible) {
        newHidden = newHidden.filter(c => c !== code);
      } else {
        if (!newHidden.includes(code)) {
          newHidden.push(code);
        }
      }

      const newConfig = { ...config, hiddenCategories: newHidden };
      const response = await fetch(`${siteConfig?.API_URL || process.env.VITE_API_URL}/admin/config`, {
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
      }
    } catch (err) {
      toast.error("Error al actualizar categorias");
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
          showPartidasFilters={showPartidasFilters}
          onlyCoded={onlyCoded}
          onToggleOnlyCoded={setOnlyCoded}
          config={config}
          onToggleGlobalCoded={toggleGlobalCoded}
        />
      </div>

      <DatabaseSelector
        value={selectedDatabase}
        onChange={setSelectedDatabase}
      />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {activeTab === 'partidas' && (
          <>
            <PartidasTab onlyCoded={onlyCoded} />
            <CategoryManager config={config} onToggleCategory={toggleCategory} />
          </>
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
