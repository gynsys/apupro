import React, { useState, useEffect } from 'react';
import { Layers, Sliders, CheckCircle2, Info } from 'lucide-react';

export default function CompoundSubpartidasPanel({
  subPartidas = [],
  compoundTrace = [],
  supuestosTecnicos = [],
  totalTons = null,
  onApplyIndications,
}) {
  const [editableFactors, setEditableFactors] = useState({});

  useEffect(() => {
    const initial = {};
    const traceMap = {};
    (compoundTrace || []).forEach(t => {
      traceMap[t.actividad] = t.f_por_ton;
    });
    (subPartidas || []).forEach(s => {
      const val = traceMap[s.actividad] ?? 1.0;
      initial[s.actividad] = Number(parseFloat(val).toFixed(4));
    });
    setEditableFactors(initial);
  }, [subPartidas, compoundTrace]);

  if (!Array.isArray(subPartidas) || subPartidas.length === 0) {
    return null;
  }

  const handleFactorChange = (tag, value) => {
    setEditableFactors(prev => ({
      ...prev,
      [tag]: value,
    }));
  };

  const handleApply = () => {
    if (onApplyIndications) {
      onApplyIndications(editableFactors);
    }
  };

  const totalDirectCostPerTon = subPartidas.reduce((acc, s) => {
    const f = parseFloat(editableFactors[s.actividad]) || 0;
    const pu = parseFloat(s.costo_directo_unitario) || 0;
    return acc + f * pu;
  }, 0);

  return (
    <div className="mb-6 bg-white border border-indigo-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 via-white to-slate-50 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                Macro-Partida Compuesta: Sub-Partidas e Indicaciones hacia Toneladas (Motor v3.0)
              </h4>
              {totalTons && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {Number(totalTons).toLocaleString()} ton totales
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Etapa 1: P.U. individual en su unidad real COVENIN · Etapa 2: Indicación editable (unidades/ton) para fusión exacta.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-center"
        >
          <Sliders size={14} />
          <span>Recalcular con Indicaciones</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
              <th className="py-2.5 px-3">Sub-Partida / Fase</th>
              <th className="py-2.5 px-3">Base Referencia</th>
              <th className="py-2.5 px-3 text-center">Unidad</th>
              <th className="py-2.5 px-3 text-right">Rend. (8h)</th>
              <th className="py-2.5 px-3 text-right">P.U. Sub-Partida</th>
              <th className="py-2.5 px-3 text-right">Indicación (u / ton)</th>
              <th className="py-2.5 px-3 text-right">Aporte ($ / ton)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subPartidas.map((s) => {
              const f = parseFloat(editableFactors[s.actividad]) || 0;
              const pu = parseFloat(s.costo_directo_unitario) || 0;
              const aporte = f * pu;
              return (
                <tr key={s.actividad} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-800">{s.actividad}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1" title={s.descripcion_actividad}>
                      {s.descripcion_actividad}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      s.partida_base && s.partida_base !== 'NONE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {s.partida_base && s.partida_base !== 'NONE' ? s.partida_base : 'SÍNTESIS V3'}
                    </span>
                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={s.base_descripcion}>
                      {s.base_descripcion}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                    {s.unidad_resultante}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {Number(s.rendimiento || 0).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                    ${pu.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={editableFactors[s.actividad] ?? ''}
                      onChange={(e) => handleFactorChange(s.actividad, e.target.value)}
                      className="w-24 px-2 py-1 text-right font-mono text-xs font-bold border border-indigo-300 rounded-lg bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      title={s.indicacion || 'Factor de conversión hacia toneladas'}
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                    ${aporte.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-50/60 border-t border-indigo-200 font-bold text-slate-800">
              <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px]">
                Costo Directo Maestro Fusionado (Σ fᵢ × P.U.ᵢ):
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-sm text-indigo-800">
                ${totalDirectCostPerTon.toFixed(2)} / ton
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Array.isArray(supuestosTecnicos) && supuestosTecnicos.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600">
          <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
            <Info size={13} className="text-indigo-600" />
            <span>Indicaciones y Supuestos Técnicos de Literatura Aplicados:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
            {supuestosTecnicos.map((sup, i) => (
              <li key={i}>{sup}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
