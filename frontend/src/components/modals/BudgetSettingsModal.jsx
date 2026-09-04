import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, DollarSign, Hash, Percent, UploadCloud, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { useUserCostos } from '../../context/UserCostosContext';

export default function BudgetSettingsModal({ budget, onClose, onSave }) {
  const { costosConfig } = useUserCostos();
  const [configTab, setConfigTab] = useState('general');
  const [logoPreview, setLogoPreview] = useState(() => {
    // Cargar logo desde localStorage
    const savedLogo = localStorage.getItem(`budget_logo_${budget.id}`);
    return savedLogo || null;
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settings, setSettings] = useState({
    currency: budget.currency || 'USD',
    exchange_rate: budget.exchange_rate || 1.0,
    fcas_percent: budget.fcas_percent ?? 417.0,
    admin_percent: budget.admin_percent ?? 15.0,
    profit_percent: budget.profit_percent ?? 10.0,
    iva_percent: budget.iva_percent ?? 16.0,
    labor_bonus: budget.labor_bonus ?? 0.0,
    material_inflation: budget.material_inflation ?? 0.0,
    labor_inflation: budget.labor_inflation ?? 0.0,
    equipment_inflation: budget.equipment_inflation ?? 0.0,
    company_name: budget.company_name || '',
    company_rif: budget.company_rif || '',
    client_name: budget.client_name || '',
    project_name: budget.project_name || '',
    ubicacion: localStorage.getItem(`budget_ubicacion_${budget.id}`) || budget.ubicacion || budget.location || ''
  });

  useEffect(() => {
    // Si la calculadora de FCAS se usa mientras este modal está abierto,
    // reflejamos el cambio aquí
    if (costosConfig) {
      setSettings(prev => ({
        ...prev,
        fcas_percent: costosConfig.fcas ?? prev.fcas_percent
      }));
    }
  }, [costosConfig]);

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadingLogo(true);
      try {
        // Convertir imagen a base64
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64String = event.target.result;
          // Guardar en localStorage
          localStorage.setItem(`budget_logo_${budget.id}`, base64String);
          setLogoPreview(base64String);
          toast.success('Logo cargado exitosamente');
          setUploadingLogo(false);
        };
        reader.onerror = () => {
          toast.error('Error al leer la imagen');
          setUploadingLogo(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error('Error al cargar el logo');
        console.error(error);
        setUploadingLogo(false);
      }
    }
  };

  const clearLogo = async () => {
    try {
      // Eliminar de localStorage
      localStorage.removeItem(`budget_logo_${budget.id}`);
      setLogoPreview(null);
      toast.success('Logo eliminado');
    } catch (error) {
      toast.error('Error al eliminar el logo');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { ubicacion, ...apiSettings } = settings;
      await budgetService.update(budget.id, apiSettings);
      localStorage.setItem(`budget_ubicacion_${budget.id}`, (ubicacion || '').trim());
      toast.success('Configuración guardada exitosamente');
      onSave({ ...settings, ubicacion: (ubicacion || '').trim() });
    } catch (error) {
      toast.error('Error guardando configuración');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
            <Settings className="text-sky-600" /> Configuración del Presupuesto
          </h2>
          <button 
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex border-b border-amber-600/15 px-6 pt-4 bg-white/40">
          <button
            className={`pb-3 px-4 font-medium text-sm transition-colors border-b-2 ${configTab === 'general' ? 'border-sky-600 text-sky-700' : 'border-transparent text-amber-700 hover:text-amber-900'}`}
            onClick={() => setConfigTab('general')}
          >
            Datos Generales
          </button>
          <button
            className={`pb-3 px-4 font-medium text-sm transition-colors border-b-2 ${configTab === 'params' ? 'border-sky-600 text-sky-700' : 'border-transparent text-amber-700 hover:text-amber-900'}`}
            onClick={() => setConfigTab('params')}
          >
            Parámetros de Cálculo
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
          {configTab === 'general' ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Nombre de la Obra / Proyecto</label>
                <input 
                  type="text" 
                  value={settings.project_name}
                  onChange={e => setSettings({...settings, project_name: e.target.value})}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  placeholder="Ej. Construcción de Muro Perimetral"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900">Empresa</label>
                  <input 
                    type="text" 
                    value={settings.company_name}
                    onChange={e => setSettings({...settings, company_name: e.target.value})}
                    className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900">RIF de la Empresa</label>
                  <input 
                    type="text" 
                    value={settings.company_rif}
                    onChange={e => setSettings({...settings, company_rif: e.target.value})}
                    className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Contratante / Cliente</label>
                <input 
                  type="text" 
                  value={settings.client_name}
                  onChange={e => setSettings({...settings, client_name: e.target.value})}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Ubicación de la Obra (Opcional)</label>
                <input 
                  type="text" 
                  value={settings.ubicacion || ''}
                  onChange={e => setSettings({...settings, ubicacion: e.target.value})}
                  placeholder="Ej. Barcelona, Anzoátegui"
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                />
              </div>
              <div className="flex flex-col gap-2 w-full mt-2">
                <label className="text-[13px] font-semibold text-amber-900">Logo de la Empresa (Opcional)</label>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-4 flex-1 border-2 border-dashed border-sky-200 rounded-xl p-4 cursor-pointer bg-white/50 transition-all hover:border-sky-600 hover:bg-sky-100 group">
                    <div className="bg-sky-50 text-sky-600 p-2.5 rounded-full flex transition-colors group-hover:bg-sky-600 group-hover:text-white">
                      {uploadingLogo ? (
                        <UploadCloud size={24} className="animate-spin" />
                      ) : (
                        <UploadCloud size={24} />
                      )}
                    </div>
                    <div>
                      <p className="m-0 text-sm font-semibold text-sky-700">
                        {uploadingLogo ? 'Subiendo...' : 'Cargar imagen del logo'}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleLogoChange} disabled={uploadingLogo} />
                  </label>
                  
                  {logoPreview && (
                    <div className="flex items-center gap-3 bg-white p-2 border border-sky-200 rounded-xl">
                      <img src={logoPreview} alt="Logo preview" className="w-12 h-12 object-contain rounded-md" />
                      <button 
                        type="button" 
                        onClick={clearLogo}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar logo"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Row 1: Moneda, Tasa, FCAS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                    <DollarSign size={14}/> Moneda Base
                  </label>
                  <select 
                    value={settings.currency}
                    onChange={e => setSettings({...settings, currency: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  >
                    <option value="USD">Dólares (USD)</option>
                    <option value="BS">Bolívares (BS)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                    <Hash size={14}/> Tasa (BS/USD)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={settings.exchange_rate}
                    onChange={e => setSettings({...settings, exchange_rate: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                    <Percent size={14}/> FCAS Global
                  </label>
                  <input 
                    type="number" 
                    step="1"
                    value={settings.fcas_percent}
                    onChange={e => setSettings({...settings, fcas_percent: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
              </div>
              
              {/* Row 2: Inflación Materiales, Equipos, Mano de Obra, Bono */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1 whitespace-nowrap">
                    <Percent size={14}/> Inf. Mat.
                  </label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.material_inflation}
                    onChange={e => setSettings({...settings, material_inflation: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1 whitespace-nowrap">
                    <Percent size={14}/> Inf. Eq.
                  </label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.equipment_inflation}
                    onChange={e => setSettings({...settings, equipment_inflation: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1 whitespace-nowrap">
                    <Percent size={14}/> Inf. M.O.
                  </label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.labor_inflation}
                    onChange={e => setSettings({...settings, labor_inflation: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1 whitespace-nowrap">
                    <DollarSign size={14}/> Bono
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={settings.labor_bonus}
                    onChange={e => setSettings({...settings, labor_bonus: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
              </div>

              {/* Row 3: Admin, Utilidad, IVA */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                    <Percent size={14}/> Admin.
                  </label>
                  <input 
                    type="number" 
                    step="1"
                    value={settings.admin_percent}
                    onChange={e => setSettings({...settings, admin_percent: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                    <Percent size={14}/> Utilidad
                  </label>
                  <input 
                    type="number" 
                    step="1"
                    value={settings.profit_percent}
                    onChange={e => setSettings({...settings, profit_percent: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                    <Percent size={14}/> I.V.A
                  </label>
                  <input 
                    type="number" 
                    step="1"
                    value={settings.iva_percent}
                    onChange={e => setSettings({...settings, iva_percent: e.target.value})}
                    className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-amber-600/15 flex justify-end gap-4 bg-white/40">
          <button 
            onClick={onClose}
            className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSaveSettings}
            className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
