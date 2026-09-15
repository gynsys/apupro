import React from 'react';
import { Database, Layers } from 'lucide-react';

export default function DatabasePreviewList({ previewItems = [], matchCount = 0 }) {
  if (!previewItems || previewItems.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Database size={18} className="text-blue-500" />
          Vista Previa de Partidas en BD
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-600">
          {matchCount} resultados
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {previewItems.map(p => (
            <li key={p.CodPar} className="p-4 hover:bg-blue-50/50 transition-colors flex items-start gap-4 group">
              <div className="mt-0.5 p-2 rounded-lg bg-blue-100 text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Layers size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 font-mono mb-1">{p.CovPar || p.CodPar}</p>
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{p.Descri}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
