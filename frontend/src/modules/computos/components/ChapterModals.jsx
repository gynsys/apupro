import React from 'react';
import { Edit3, Layers, X } from 'lucide-react';

const SUGGESTIONS = [
  'OBRAS PRELIMINARES',
  'MOVIMIENTO DE TIERRAS',
  'ESTRUCTURAS',
  'ALBAÑILERÍA',
  'INSTALACIONES ELÉCTRICAS',
  'INSTALACIONES SANITARIAS',
  'ACABADOS',
  'IMPERMEABILIZACIÓN',
];

function SuggestionButtons({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onChange(suggestion)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            value === suggestion
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
          }`}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

export function AddChapterModal({ isOpen, value, onChange, onClose, onSubmit }) {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-amber-950 font-bold text-base leading-tight">Agregar Capítulo a la Planilla</h3>
              <p className="text-xs text-amber-800">Crea una nueva sección para agrupar partidas</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-amber-950 mb-1">Nombre del Capítulo:</label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ej. ESTRUCTURAS, ALBAÑILERÍA..."
              autoFocus
              className="w-full px-3 py-2 text-sm font-bold border-2 border-amber-300 rounded-xl bg-amber-50/30 text-amber-950 focus:outline-none focus:border-amber-500 uppercase"
            />
          </div>

          <div>
            <p className="text-[11px] font-bold text-amber-800 mb-1.5">Capítulos frecuentes:</p>
            <SuggestionButtons value={value} onChange={onChange} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={!value.trim()} className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer">
              + Agregar a la Planilla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RenameChapterModal({ isOpen, value, onChange, onClose, onSubmit }) {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-amber-950 font-bold text-base leading-tight">Renombrar Capítulo</h3>
              <p className="text-xs text-amber-800">Actualiza el título del capítulo en la planilla</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-amber-950 mb-1">Nuevo nombre para este capítulo:</label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ej. ESTRUCTURAS DE CONCRETO..."
              autoFocus
              className="w-full px-3 py-2 text-sm font-bold border-2 border-amber-300 rounded-xl bg-amber-50/30 text-amber-950 focus:outline-none focus:border-amber-500 uppercase"
            />
          </div>

          <div>
            <p className="text-[11px] font-bold text-amber-800 mb-1.5">Sugerencias rápidas:</p>
            <SuggestionButtons value={value} onChange={onChange} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={!value.trim()} className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer">
              Guardar Nombre
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
