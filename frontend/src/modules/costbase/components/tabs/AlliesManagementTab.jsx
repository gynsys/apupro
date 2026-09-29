import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Globe, 
  Loader2,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import alliesService from '../../../../services/alliesService';
import { API_URL } from '../../../../services/api';
import AllyFormModal from '../modals/AllyFormModal';

export default function AlliesManagementTab() {
  const [allies, setAllies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlly, setSelectedAlly] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchAllies = async () => {
    setLoading(true);
    try {
      const data = await alliesService.getAdminAllies();
      setAllies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando aliados:', err);
      toast.error('Error al cargar la lista de aliados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllies();
  }, []);

  const handleOpenCreate = () => {
    setSelectedAlly(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ally) => {
    setSelectedAlly(ally);
    setIsModalOpen(true);
  };

  const handleSaved = (savedAlly) => {
    fetchAllies();
  };

  const handleToggleActive = async (ally) => {
    const newActive = !ally.is_active;
    setTogglingId(ally.id);

    // Optimistic update
    setAllies(prev => prev.map(a => a.id === ally.id ? { ...a, is_active: newActive } : a));

    try {
      await alliesService.updateAlly(ally.id, { is_active: newActive });
      toast.success(newActive ? `${ally.name} ahora es visible en el Home` : `${ally.name} ha sido ocultado`);
    } catch (err) {
      console.error('Error al cambiar visibilidad:', err);
      toast.error('No se pudo actualizar el estado');
      // Revert optimistic update
      setAllies(prev => prev.map(a => a.id === ally.id ? { ...a, is_active: ally.is_active } : a));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = (ally) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div>
          <p className="font-bold text-slate-800 text-sm m-0">¿Eliminar aliado?</p>
          <p className="text-xs text-slate-600 mt-1 mb-0">
            Se eliminará a <strong>{ally.name}</strong> de la red de aliados y de la página principal.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button 
            type="button"
            onClick={() => toast.dismiss(t.id)} 
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await alliesService.deleteAlly(ally.id);
                toast.success('Aliado eliminado exitosamente');
                setAllies(prev => prev.filter(a => a.id !== ally.id));
              } catch (err) {
                toast.error('Error al eliminar aliado');
              }
            }} 
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const getFullLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.includes('/uploads/')) {
      const filename = url.split('/').pop();
      return `${API_URL}/allies/logo/${filename}`;
    }
    if (url.startsWith('/api/v1/')) {
      const baseHost = API_URL.replace('/api/v1', '');
      return `${baseHost}${url}`;
    }
    return url;
  };

  // Filtrado reactivo por texto de búsqueda
  const filteredAllies = useMemo(() => {
    if (!searchQuery.trim()) return allies;
    const q = searchQuery.toLowerCase();
    return allies.filter(a => 
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q)) ||
      (a.description && a.description.toLowerCase().includes(q))
    );
  }, [allies, searchQuery]);

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Building2 size={18} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Gestión de Aliados Estratégicos
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administra las empresas y proveedores colaboradores que enriquecen la base de datos de precios.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Buscador */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar aliado o rubro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 w-48 sm:w-64"
            />
          </div>

          {/* Botón Refrescar */}
          <button
            onClick={fetchAllies}
            title="Recargar lista"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Botón Nuevo Aliado */}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Nuevo Aliado</span>
          </button>
        </div>
      </div>

      {/* Contenedor Principal con Scroll */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
            <p className="text-xs font-medium">Cargando aliados estratégicos...</p>
          </div>
        ) : filteredAllies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Building2 size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">
              {searchQuery ? 'No se encontraron aliados que coincidan' : 'Aún no hay aliados registrados'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              {searchQuery 
                ? 'Intenta con otro término de búsqueda o limpia el filtro.' 
                : 'Agrega las empresas y proveedores colaboradores para mostrarlos en el banner del Home.'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            ) : (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>Agregar Primer Aliado</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Orden</th>
                  <th className="py-3 px-4">Logo</th>
                  <th className="py-3 px-4">Empresa / Aliado</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Sitio / Red Social</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAllies.map((ally) => {
                  const logoSrc = getFullLogoUrl(ally.logo_url);
                  const isToggling = togglingId === ally.id;

                  return (
                    <tr key={ally.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Orden */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400 font-semibold">
                        #{ally.order ?? 0}
                      </td>

                      {/* Logo Thumbnail */}
                      <td className="py-3.5 px-4">
                        <div className="w-14 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={ally.name}
                              className="max-h-full max-w-full object-contain"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon size={18} className="text-slate-300" />
                          )}
                        </div>
                      </td>

                      {/* Nombre y Descripción */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{ally.name}</div>
                        {ally.description && (
                          <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                            {ally.description}
                          </div>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="py-3.5 px-4">
                        {ally.category ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100">
                            {ally.category}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Sin categoría</span>
                        )}
                      </td>

                      {/* Sitio Web / Instagram */}
                      <td className="py-3.5 px-4">
                        {ally.website_url ? (
                          <a
                            href={ally.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Globe size={13} className="shrink-0" />
                            <span className="truncate max-w-[160px]">
                              {ally.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                            </span>
                            <ExternalLink size={11} className="shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 italic">No especificado</span>
                        )}
                      </td>

                      {/* Estado / Visibilidad */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(ally)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            ally.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={ally.is_active ? 'Visible en el Home. Clic para ocultar' : 'Oculto. Clic para publicar'}
                        >
                          {isToggling ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : ally.is_active ? (
                            <Eye size={12} />
                          ) : (
                            <EyeOff size={12} />
                          )}
                          <span>{ally.is_active ? 'Activo' : 'Oculto'}</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ally)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar datos del aliado"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(ally)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar aliado"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Crear / Editar */}
      <AllyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        ally={selectedAlly}
      />
    </div>
  );
}
