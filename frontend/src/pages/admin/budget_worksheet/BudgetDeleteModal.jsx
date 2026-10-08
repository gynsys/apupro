import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

export default function BudgetDeleteModal({
  itemToDelete,
  onConfirm,
  onCancel,
}) {
  if (!itemToDelete) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-full sm:max-w-sm shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 text-center">
        <div className="w-14 sm:w-16 h-14 sm:h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <Trash2 className="text-red-600" size={28} />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">
          Eliminar {itemToDelete.is_chapter ? 'capítulo' : 'partida'}
        </h3>
        <p className="text-slate-500 mb-6 sm:mb-8 text-xs sm:text-sm leading-relaxed">
          ¿Estás seguro de que deseas eliminar este elemento del presupuesto? Esta acción actualizará los totales y no se puede deshacer.
        </p>
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <button 
            onClick={onConfirm}
            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors w-full shadow-lg shadow-red-500/30 text-sm cursor-pointer"
          >
            Sí, eliminar
          </button>
          <button 
            onClick={onCancel}
            className="px-5 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors w-full text-sm cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
