import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, DollarSign, Hash, Percent, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { useUserCostos } from '../../context/UserCostosContext';

export default function CreateBudgetModal({ onClose, onSuccess }) {
  const { costosConfig } = useUserCostos();
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    company_rif: '',
    client_name: '',
    currency: 'USD',
    exchange_rate: 1.0,
    fcas_percent: costosConfig?.fcas ?? 417.0,
    labor_bonus: 0.0,
    admin_percent: costosConfig?.porcentajeAdministracion ?? 15.0,
    profit_percent: costosConfig?.porcentajeUtilidad ?? 10.0,
    iva_percent: costosConfig?.iva ?? 16.0
  });

  useEffect(() => {
    // Si la calculadora actualiza el config mientras el modal está abierto,
    // reflejar el nuevo FCAS (u otros valores) en el formulario.
    if (costosConfig) {
      setFormData(prev => ({
        ...prev,
        fcas_percent: costosConfig.fcas ?? prev.fcas_percent,
        admin_percent: costosConfig.porcentajeAdministracion ?? prev.admin_percent,
        profit_percent: costosConfig.porcentajeUtilidad ?? prev.profit_percent,
        iva_percent: costosConfig.iva ?? prev.iva_percent
      }));
    }
  }, [costosConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('El nombre del proyecto es obligatorio');
      return;
    }
    
    try {
      setLoading(true);
      // Pass all the form data so the backend can save it upon creation
      const newBudget = await budgetService.create({ 
        ...formData,
        name: formData.name.trim(),
        project_name: formData.name.trim() // Usually the name is the project name
      });
      toast.success('Presupuesto creado con éxito. Redirigiendo a edición...', {
        duration: 2000,
      });
      setTimeout(() => {
        onSuccess(newBudget);
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      toast.error('Error al crear el presupuesto');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
      setFormData(prev => ({ ...prev, logo: file }));
    }
  };

  const clearLogo = () => {
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo: null }));
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[90vh]">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <h2 className="m-0 text-xl font-bold text-amber-900">Nuevo Presupuesto</h2>
          <button 
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
          
          {/* Línea 1: Nombre del Proyecto */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-[13px] font-semibold text-amber-900">
              Nombre del Proyecto <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="name"
              autoFocus
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej. Construcción Casa Modelo A"
              className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
            />
          </div>

          {/* Línea 2: Empresa y RIF */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900">Empresa</label>
              <input 
                type="text" 
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900">RIF / ID</label>
              <input 
                type="text" 
                name="company_rif"
                value={formData.company_rif}
                onChange={handleChange}
                className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
          </div>

          {/* Línea 3: Contratante / Cliente */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-[13px] font-semibold text-amber-900">Contratante / Cliente</label>
            <input 
              type="text" 
              name="client_name"
              value={formData.client_name}
              onChange={handleChange}
              className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
            />
          </div>

          {/* Línea 4: Cuatro Columnas */}
          <div className="grid grid-cols-4 gap-4 w-full">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900 whitespace-nowrap">$ Moneda</label>
              <select 
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              >
                <option value="USD">USD</option>
                <option value="BS">BS</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900 whitespace-nowrap"># Tasa</label>
              <input 
                type="number" step="0.01" name="exchange_rate"
                value={formData.exchange_rate} onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900 whitespace-nowrap">% FCAS</label>
              <input 
                type="number" step="1" name="fcas_percent"
                value={formData.fcas_percent} onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900 whitespace-nowrap">$ Bono M.O.</label>
              <input 
                type="number" step="0.01" name="labor_bonus"
                value={formData.labor_bonus} onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
          </div>

          {/* Línea 5: Tres Columnas alineadas a la izquierda */}
          <div className="grid grid-cols-4 gap-4 w-full">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900">% Admin.</label>
              <input 
                type="number" step="1" name="admin_percent"
                value={formData.admin_percent} onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900">% Utilidad</label>
              <input 
                type="number" step="1" name="profit_percent"
                value={formData.profit_percent} onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900">% I.V.A</label>
              <input 
                type="number" step="1" name="iva_percent"
                value={formData.iva_percent} onChange={handleChange}
                className="px-2 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>
            {/* 4to espacio vacío para alinear a la izquierda */}
            <div></div>
          </div>

          {/* Zona de Logo */}
          <div className="flex flex-col gap-2 w-full mt-2">
            <label className="text-[13px] font-semibold text-amber-900">Logo de la Empresa (Opcional)</label>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-4 flex-1 border-2 border-dashed border-sky-200 rounded-xl p-4 cursor-pointer bg-white/50 transition-all hover:border-sky-600 hover:bg-sky-100 group">
                <div className="bg-sky-50 text-sky-600 p-2.5 rounded-full flex transition-colors group-hover:bg-sky-600 group-hover:text-white">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <p className="m-0 text-sm font-semibold text-sky-700">Cargar imagen del logo</p>
                </div>
                <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleLogoChange} />
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
          
          {/* Acciones Inferiores */}
          <div className="flex justify-end gap-4 mt-3">
            <button 
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? 'Creando...' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
