import React, { useState } from 'react';
import { Plus, X, Copy, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SiteConfigContext } from '../../../App';
import { useAdminConfig } from '../hooks/useAdminConfig';
import AdminHeader from '../components/layout/AdminHeader';
import TabNavigation from '../components/layout/TabNavigation';
import DatabaseSelector from '../components/layout/DatabaseSelector';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { useDatabaseContext } from '../../../contexts/DatabaseContext';
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

  const navigate = useNavigate();

  // Costos desde contexto global (persiste en BD, compartido con Calculadora FCAS)
  const { costosConfig, updateCostosConfig } = useUserCostos();

  const siteConfig = React.useContext(SiteConfigContext);
  const config = siteConfig?.config || {};

  const { databases, refreshDatabases: reloadDatabases } = useDatabaseContext();
  const currentDbObj = databases.find(db => db.id === selectedDatabase);

  const handleTogglePublish = async () => {
    if (!currentDbObj) return;
    try {
      await cost360DatabaseService.update(currentDbObj.id, { is_published: !currentDbObj.is_published });
      toast.success(currentDbObj.is_published ? 'Base de datos oculta a usuarios' : 'Base de datos publicada a usuarios');
      reloadDatabases(); // Update global context
    } catch (error) {
      toast.error('Error al cambiar visibilidad de la base de datos');
      console.error(error);
    }
  };

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

  const handleLimitChange = async (newLimit) => {
    try {
      const parsedLimit = parseInt(newLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) return;
      
      const newConfig = { ...config, max_user_databases: parsedLimit };
      // Optimistic
      if (siteConfig?.setConfig) siteConfig.setConfig(newConfig);
      
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
        if (siteConfig?.setConfig) siteConfig.setConfig(updatedConfig);
        if (window.ARKO_SITE_CONFIG) window.ARKO_SITE_CONFIG = updatedConfig;
        toast.success(`Límite actualizado a ${parsedLimit}`);
      } else {
        if (siteConfig?.setConfig) siteConfig.setConfig(config);
        toast.error("Error al actualizar límite");
      }
    } catch (err) {
      if (siteConfig?.setConfig) siteConfig.setConfig(config);
      toast.error("Error de red al actualizar límite");
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
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
            <label className="text-xs font-semibold text-slate-600">Límite BD/Usuario:</label>
            <input 
              type="number"
              min="1"
              max="20"
              value={config?.max_user_databases || 2}
              onChange={(e) => handleLimitChange(e.target.value)}
              className="w-12 text-center text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-blue-500 py-0.5"
            />
          </div>
          {showPartidasFilters && (
            <CategoryManager config={config} onToggleCategory={toggleCategory} />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/cost360/databases')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 shadow-sm transition-all flex items-center gap-1"
              title="Ir a Gestión de Bases de Datos"
            >
              <Database size={14} />
              Gestión BD
            </button>
            <DatabaseSelector
              value={selectedDatabase}
              onChange={setSelectedDatabase}
            />
            {currentDbObj && (
              <button 
                onClick={handleTogglePublish}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border shadow-sm transition-all whitespace-nowrap ${
                  currentDbObj.is_published 
                    ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' 
                    : 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200'
                }`}
                title={currentDbObj.is_published ? "Ocultar esta base a los usuarios" : "Publicar esta base a los usuarios"}
              >
                {currentDbObj.is_published ? 'Publicada' : 'Borrador'}
              </button>
            )}
          </div>
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
              <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
                <Copy className="text-sky-600" /> Crear Nueva Versión
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateDatabase} className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">
                  Nombre de la Base de Datos <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10" placeholder="Ej. Base Octubre 2026" required />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Descripción (opcional)</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10 resize-none" rows={2} placeholder="Ej. Base con inflación aplicada" />
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Base Origen</label>
                <select value={formData.source_database_id} onChange={(e) => setFormData({ ...formData, source_database_id: e.target.value })} className="px-3 py-1.5 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10">
                  {databases.map(db => (
                    <option key={db.id} value={db.id}>{db.name} {db.is_master ? '(Maestra)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/40 p-3 rounded-xl border border-amber-600/15">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-amber-900">Inflación Materiales</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={formData.material_inflation} onChange={(e) => setFormData({ ...formData, material_inflation: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-1 border border-amber-200 rounded-lg text-sm text-amber-900 bg-white outline-none focus:border-amber-500" />
                    <span className="absolute right-3 top-1 text-amber-600 font-bold">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-amber-900">Inflación Mano Obra</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={formData.labor_inflation} onChange={(e) => setFormData({ ...formData, labor_inflation: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-1 border border-amber-200 rounded-lg text-sm text-amber-900 bg-white outline-none focus:border-amber-500" />
                    <span className="absolute right-3 top-1 text-amber-600 font-bold">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-amber-900">Inflación Equipos</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={formData.equipment_inflation} onChange={(e) => setFormData({ ...formData, equipment_inflation: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-1 border border-amber-200 rounded-lg text-sm text-amber-900 bg-white outline-none focus:border-amber-500" />
                    <span className="absolute right-3 top-1 text-amber-600 font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors">Cancelar</button>
                <button type="submit" className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]">Crear Base y Aplicar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDatabasePage;
