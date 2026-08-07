
import React from 'react';
import { FiTrash2, FiVideo, FiImage, FiCpu, FiLoader, FiAlertTriangle, FiX } from 'react-icons/fi';

/* ─────────────── Modal de Confirmación SaaS ─────────────── */
const DeleteModal = ({ projectName, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fadeIn">
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

    {/* Dialog */}
    <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full border border-gray-100 dark:border-gray-700 animate-slideDown">
      {/* Close */}
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
      >
        <FiX size={16} />
      </button>

      {/* Icon */}
      <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-5 mx-auto">
        <FiAlertTriangle className="text-red-500" size={26} />
      </div>

      {/* Content */}
      <h3 className="text-lg font-black text-gray-900 dark:text-white text-center uppercase tracking-tight mb-2">
        Eliminar Proyecto
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-1">
        ¿Estás seguro de eliminar
      </p>
      <p className="text-sm font-black text-gray-800 dark:text-white text-center mb-6 px-2 truncate">
        "{projectName}"
      </p>
      <p className="text-[10px] text-red-500 text-center uppercase tracking-widest font-bold mb-6">
        Esta acción no se puede deshacer
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-100 dark:shadow-none"
        >
          Sí, Eliminar
        </button>
      </div>
    </div>
  </div>
);


const checkIsVideoProject = (p) => {
  if (!p) return false;
  
  // 1. Check explicit type fields
  const typeStr = (p.type || p.project_type || p.gen_type || '').toLowerCase();
  if (typeStr === 'video' || typeStr === 'reel') return true;
  if (typeStr === 'carousel') return false;

  // 2. Check content object
  let contentObj = p.content;
  if (typeof contentObj === 'string') {
    try { contentObj = JSON.parse(contentObj); } catch (e) {}
  }

  if (contentObj) {
    const cType = (contentObj.type || '').toLowerCase();
    if (cType === 'video' || cType === 'reel') return true;
    if (cType === 'carousel') return false;

    if (Array.isArray(contentObj.video_slides) && contentObj.video_slides.length > 0) {
      if (!Array.isArray(contentObj.slides) || contentObj.slides.length === 0) {
        return true;
      }
    }
  }

  if (Array.isArray(p.video_slides) && p.video_slides.length > 0) {
    if (!Array.isArray(p.slides) || p.slides.length === 0) {
      return true;
    }
  }

  // 3. Fallback name heuristics if type was not in summary
  const nameStr = (p.name || '').toLowerCase();
  if (nameStr.includes('video') || nameStr.includes('reel') || nameStr.includes('mp4')) {
    return true;
  }

  return false;
};

/* ─────────────── ProjectGrid ─────────────── */
export const ProjectGrid = ({ 
  projects, 
  onLoad, 
  onDelete, 
  variant = 'full', 
  activeProjectId,
  loading = false
}) => {
  const [isDeleting, setIsDeleting] = React.useState(null);
  const [pendingDelete, setPendingDelete] = React.useState(null); // { id, name, is_backend }

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    const p = pendingDelete;
    setPendingDelete(null);
    setIsDeleting(p.id);
    try {
      await onDelete(p.id, p.is_backend);
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className={`text-center py-12 flex items-center justify-center gap-2 text-gray-400 ${variant === 'compact' ? 'px-6' : ''}`}>
        <FiLoader className="animate-spin" size={14} />
        <span className="italic text-sm">Cargando proyectos...</span>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className={`text-center py-12 text-gray-400 italic ${variant === 'compact' ? 'px-6' : ''}`}>
        No tienes proyectos guardados todavía.
      </div>
    );
  }

  return (
    <>
      {/* Modal de confirmación (portal-free, fixed position) */}
      {pendingDelete && (
        <DeleteModal
          projectName={pendingDelete.name}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* ── COMPACT (dropdown) ── */}
      {variant === 'compact' ? (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] max-h-[400px] overflow-y-auto no-scrollbar animate-slideDown">
          <div className="p-2 space-y-1">
            {projects.map(p => {
              const isVideoProject = checkIsVideoProject(p);
              return (
                <div
                  key={p.id}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group ${activeProjectId === p.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => onLoad(p)}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeProjectId === p.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-900 text-gray-500 group-hover:text-indigo-500'}`}>
                      {isVideoProject ? <FiVideo size={18} /> : <FiImage size={18} />}
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-black uppercase tracking-tight ${activeProjectId === p.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-300'}`}>{p.name}</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Reciente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded-md ${p.is_backend ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                      {p.is_backend ? 'Nube' : 'Local'}
                    </span>
                    <button
                      disabled={isDeleting === p.id}
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(p); }}
                      className={`p-2 rounded-lg transition-all ${isDeleting === p.id ? 'opacity-50' : 'hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500'}`}
                      title="Eliminar proyecto"
                    >
                      {isDeleting === p.id ? <FiCpu className="animate-spin" size={14} /> : <FiTrash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── FULL (grid) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map(p => {
            const isVideoProject = checkIsVideoProject(p);
            return (
              <div 
                key={p.id} 
                className={`bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border transition-all hover:shadow-xl hover:-translate-y-1 group relative ${activeProjectId === p.id ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-gray-100 dark:border-gray-700'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeProjectId === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'}`}>
                    {isVideoProject ? <FiVideo size={24} /> : <FiImage size={24} />}
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-[8px] px-2 py-1 rounded-lg uppercase font-black tracking-widest ${p.is_backend ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                      {p.is_backend ? 'Nube' : 'Local'}
                    </span>
                    <span className={`text-[8px] px-2 py-1 rounded-lg uppercase font-black tracking-widest ${isVideoProject ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      {isVideoProject ? 'Video' : 'Carrusel'}
                    </span>
                  </div>
                </div>
              
              <div className="mb-6">
                <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1 truncate">{p.name}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Fecha no disponible'}
                </p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => onLoad(p)}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
                >
                  Abrir Proyecto
                </button>
                <button 
                  disabled={isDeleting === p.id}
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(p); }}
                  className={`w-12 flex items-center justify-center rounded-xl transition-all ${isDeleting === p.id ? 'opacity-50 bg-gray-100' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`}
                >
                  {isDeleting === p.id ? <FiCpu className="animate-spin" size={16} /> : <FiTrash2 size={16} />}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </>
  );
};


