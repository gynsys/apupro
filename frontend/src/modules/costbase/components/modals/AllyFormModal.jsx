import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Globe, Building2, Image as ImageIcon, Hash, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import alliesService from '../../../../services/alliesService';
import { API_URL } from '../../../../services/api';

export default function AllyFormModal({ isOpen, onClose, onSaved, ally = null }) {
  const isEditing = Boolean(ally && ally.id);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    website_url: '',
    description: '',
    order: 0,
    is_active: true,
    logo_url: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ally) {
      setFormData({
        name: ally.name || '',
        category: ally.category || '',
        website_url: ally.website_url || '',
        description: ally.description || '',
        order: ally.order ?? 0,
        is_active: ally.is_active ?? true,
        logo_url: ally.logo_url || ''
      });
      setFilePreview(null);
      setSelectedFile(null);
    } else {
      setFormData({
        name: '',
        category: '',
        website_url: '',
        description: '',
        order: 0,
        is_active: true,
        logo_url: ''
      });
      setFilePreview(null);
      setSelectedFile(null);
    }
  }, [ally, isOpen]);

  // Clean up preview object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (< 5MB)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato no soportado. Usa PNG, JPG, SVG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5 MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
  };

  const getEffectiveLogoPreview = () => {
    if (filePreview) return filePreview;
    if (formData.logo_url) {
      if (formData.logo_url.startsWith('http://') || formData.logo_url.startsWith('https://') || formData.logo_url.startsWith('data:')) {
        return formData.logo_url;
      }
      if (formData.logo_url.startsWith('/uploads')) {
        return `${API_URL.replace('/api/v1', '')}${formData.logo_url}`;
      }
      return formData.logo_url;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalLogoUrl = (formData.logo_url || '').trim();

      // Si seleccionó un archivo local, subirlo primero
      if (selectedFile) {
        const uploadResult = await alliesService.uploadLogo(selectedFile);
        const uploadedUrl = uploadResult?.url || uploadResult?.logo_url;
        if (uploadedUrl) {
          finalLogoUrl = uploadedUrl;
        }
      }

      const payload = {
        name: trimmedName,
        category: formData.category ? formData.category.trim() : null,
        website_url: formData.website_url ? formData.website_url.trim() : null,
        description: formData.description ? formData.description.trim() : null,
        order: parseInt(formData.order, 10) || 0,
        is_active: Boolean(formData.is_active),
        logo_url: finalLogoUrl || null
      };

      let result;
      if (isEditing) {
        result = await alliesService.updateAlly(ally.id, payload);
        toast.success('Aliado actualizado exitosamente');
      } else {
        result = await alliesService.createAlly(payload);
        toast.success('Aliado registrado exitosamente');
      }

      if (onSaved) {
        onSaved(result);
      }
      onClose();
    } catch (err) {
      console.error('Error al guardar aliado:', err);
      toast.error(err.message || 'Error al guardar aliado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectivePreview = getEffectiveLogoPreview();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isEditing ? 'Editar Aliado Estratégico' : 'Nuevo Aliado Estratégico'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Modifica los datos del colaborador' : 'Agrega una empresa o proveedor a la red'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre de la Empresa *
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ej: PALL FERRETERIA, C.A."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Categoría y Orden */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Categoría / Rubro
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Ej: Ferretería y Materiales"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Orden de Visualización
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="order"
                  value={formData.order}
                  onChange={handleInputChange}
                  min={0}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                />
                <Hash size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Sitio Web o Red Social */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Sitio Web o Red Social
            </label>
            <div className="relative">
              <input
                type="url"
                name="website_url"
                value={formData.website_url}
                onChange={handleInputChange}
                placeholder="https://instagram.com/empresa o https://empresa.com"
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
              />
              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Logo Upload & Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Logo de la Empresa
            </label>

            <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {/* Preview Box */}
              <div className="w-20 h-20 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-xs">
                {effectivePreview ? (
                  <img
                    src={effectivePreview}
                    alt="Vista previa"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon size={28} className="text-slate-300" />
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{selectedFile ? 'Cambiar archivo' : 'Subir imagen'}</span>
                </button>
                {selectedFile && (
                  <p className="text-[11px] text-blue-600 truncate font-medium">
                    {selectedFile.name}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  PNG, JPG, SVG o WebP transparente recomendado (máx. 5MB).
                </p>
              </div>
            </div>

            {/* URL manual opcional */}
            <div>
              <span className="text-[11px] text-slate-500">O ingresa una URL / ruta del logo:</span>
              <input
                type="text"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleInputChange}
                placeholder="/images/allies/pall-ferreteria.png o https://..."
                className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
              />
            </div>
          </div>

          {/* Descripción opcional */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Descripción o Notas (Opcional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={2}
              placeholder="Breve reseña sobre la colaboración o cobertura comercial..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400 resize-none"
            />
          </div>

          {/* Toggle Activo */}
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">
                Visible en la página principal (Home)
              </span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>{isEditing ? 'Guardar Cambios' : 'Registrar Aliado'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
