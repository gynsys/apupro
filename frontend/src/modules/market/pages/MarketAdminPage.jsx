import React, { useState } from 'react';
import SanitizationPanel from '../components/SanitizationPanel';
import MarketIndicatorsPanel from '../components/MarketIndicatorsPanel';

const glassStrong = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
};

export default function MarketAdminPage() {
  const [activeTab, setActiveTab] = useState('sanitization');

  return (
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden gap-4 bg-slate-50">
      <div className="rounded-2xl relative z-10" style={glassStrong}>
        <div className="px-6 py-5 flex items-center gap-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">
              Módulo de Automatización de Precios
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Web Scraping, Saneamiento de IA e Indicadores de Mercado
            </p>
          </div>
        </div>
        
        <div className="px-4 flex gap-1 pt-2">
          <button
            onClick={() => setActiveTab('sanitization')}
            className={`px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
              activeTab === 'sanitization' ? 'text-blue-700 border-blue-600 bg-blue-50/60' : 'text-slate-500 border-transparent'
            }`}
          >
            Saneamiento IA
          </button>
          <button
            onClick={() => setActiveTab('indicators')}
            className={`px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
              activeTab === 'indicators' ? 'text-blue-700 border-blue-600 bg-blue-50/60' : 'text-slate-500 border-transparent'
            }`}
          >
            Insumos Líderes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl" style={glassStrong}>
        {activeTab === 'sanitization' && <SanitizationPanel />}
        {activeTab === 'indicators' && <MarketIndicatorsPanel />}
      </div>
    </div>
  );
}
