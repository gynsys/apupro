import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function SmartFilterCard({
  smartData,
  onAnswer,
  onCancel,
  onSkip
}) {
  const [smartCustomInput, setSmartCustomInput] = useState('');
  const [showSmartCustomInput, setShowSmartCustomInput] = useState(false);

  if (!smartData || smartData.ready_to_generate) return null;

  const q = smartData.questions && smartData.questions.length > 0 ? smartData.questions[0] : null;

  return (
    <div className="mb-4 p-5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-sm animate-in fade-in zoom-in duration-300">
      <h4 className="text-indigo-800 font-bold mb-3 flex items-center gap-2">
        <Sparkles size={18} />
        Filtro Inteligente: Selecciona para encontrar la mejor partida base
      </h4>
      <p className="text-indigo-600 text-sm mb-4">
        El sistema detectó {smartData.candidates_count} partidas en esta categoría. Responde para elegir la más parecida:
      </p>
      
      {q && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
            <p className="font-semibold text-slate-700 mb-3">{q.question}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setShowSmartCustomInput(false);
                    setSmartCustomInput('');
                    onAnswer(q.id, opt.value);
                  }}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-medium rounded-lg transition-colors border border-indigo-200 hover:border-indigo-600 cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setShowSmartCustomInput(true)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors border border-slate-200 cursor-pointer"
              >
                Ninguno / Otro
              </button>
            </div>
            
            {showSmartCustomInput && (
              <div className="mt-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
                <input 
                  type="text" 
                  placeholder="Escribe la característica principal (ej: manual)..."
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={smartCustomInput}
                  onChange={e => setSmartCustomInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && smartCustomInput.trim()) {
                      onAnswer(q.id, smartCustomInput.trim());
                      setSmartCustomInput('');
                      setShowSmartCustomInput(false);
                    }
                  }}
                  autoFocus
                />
                <button 
                  onClick={() => {
                    if (smartCustomInput.trim()) {
                      onAnswer(q.id, smartCustomInput.trim());
                      setSmartCustomInput('');
                      setShowSmartCustomInput(false);
                    }
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-between items-center border-t border-indigo-200 pt-4">
        <button 
          onClick={onCancel} 
          className="text-sm text-slate-500 font-bold hover:text-slate-700 cursor-pointer"
        >
          Cancelar
        </button>
        <button 
          onClick={onSkip} 
          className="text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
        >
          Omitir y generar APU desde cero
        </button>
      </div>
    </div>
  );
}
