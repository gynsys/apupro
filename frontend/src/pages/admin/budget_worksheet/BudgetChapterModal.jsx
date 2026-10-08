import React from 'react';
import { createPortal } from 'react-dom';
import { FolderPlus } from 'lucide-react';

export default function BudgetChapterModal({
  isOpen,
  onClose,
  chapterName,
  setChapterName,
  onAddChapter,
}) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-full sm:max-w-[550px] bg-amber-100 rounded-t-3xl sm:rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col gap-2 px-6 pt-6 pb-2">
          <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
            <FolderPlus className="text-sky-600" size={24} />
            Agregar Capítulo
          </h2>
        </div>
        <div className="px-6 pb-6 pt-2 flex flex-col gap-4">
          <input 
            type="text" 
            autoFocus
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            placeholder="Ej. Movimiento de Tierras"
            className="px-4 py-2.5 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddChapter();
            }}
          />
          <div className="flex justify-end gap-3 mt-2">
            <button 
              onClick={() => { onClose(); setChapterName(""); }}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2.5 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={onAddChapter}
              className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2.5 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
