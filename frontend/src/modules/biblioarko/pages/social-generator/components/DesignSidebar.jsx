
import React, { useState } from 'react';
import { FiType, FiBox, FiPlusCircle } from 'react-icons/fi';
import { SHAPES_CONFIG } from '../lib/svgIcons';

export const DesignSidebar = ({ currentSlide, onAddElement }) => {
  const [activeTab, setActiveTab] = useState('text');

  return (
    <div className="w-64 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex overflow-hidden min-h-[500px]">
      <div className="w-16 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700 flex flex-col items-center py-6 gap-6">
        <button 
          onClick={() => setActiveTab('text')} 
          className={`p-3 rounded-xl transition-all ${activeTab === 'text' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-indigo-400'}`}
        ><FiType size={20}/></button>
        <button 
          onClick={() => setActiveTab('shapes')} 
          className={`p-3 rounded-xl transition-all ${activeTab === 'shapes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-indigo-400'}`}
        ><FiBox size={20}/></button>
      </div>
      <div className="flex-1 p-5 overflow-y-auto">
        {activeTab === 'text' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Texto</p>
              <button 
                onClick={() => onAddElement(currentSlide, 'text', 'Nuevo Texto')} 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <FiPlusCircle /> Agregar texto
              </button>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-black uppercase text-gray-400 mb-3">Estilos rápidos</p>
              <div className="space-y-2">
                <button onClick={() => onAddElement(currentSlide, 'text', 'Añadir un título')} className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-black text-sm">Añadir un título</button>
                <button onClick={() => onAddElement(currentSlide, 'text', 'Añadir un subtítulo')} className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-bold text-xs">Añadir un subtítulo</button>
                <button onClick={() => onAddElement(currentSlide, 'text', 'Añadir cuerpo')} className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-[10px]">Añadir cuerpo</button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'shapes' && (
          <div className="space-y-6 animate-fadeIn">
            <p className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Elementos</p>
            <div className="grid grid-cols-2 gap-3">
              {SHAPES_CONFIG.map(shape => (
                <button 
                  key={shape.id}
                  onClick={() => onAddElement(currentSlide, 'shape', shape.id)} 
                  className="aspect-square bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-all group p-2" 
                  title={shape.label}
                >
                  <div className="group-hover:scale-110 transition-transform">
                    {shape.icon}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


