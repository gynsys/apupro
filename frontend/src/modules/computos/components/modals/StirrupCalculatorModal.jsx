import React, { useState, useMemo } from 'react';
import { X, CheckCircle, Calculator, Compass } from 'lucide-react';
import { calculateStirrupCutLength } from '../../domain/steel.js';

export default function StirrupCalculatorModal({
  isOpen,
  onClose,
  targetItem,
  targetPartial,
  onApplyStirrup,
}) {
  if (!isOpen) return null;

  const [colWidthCm, setColWidthCm] = useState(30);
  const [colHeightCm, setColHeightCm] = useState(40);
  const [coverCm, setCoverCm] = useState(2.5);
  const [hookCm, setHookCm] = useState(10);
  const [beamLengthM, setBeamLengthM] = useState('');
  const [spacingCm, setSpacingCm] = useState(15);

  const cutLengthM = useMemo(() => {
    return calculateStirrupCutLength(colWidthCm, colHeightCm, coverCm, hookCm);
  }, [colWidthCm, colHeightCm, coverCm, hookCm]);

  const estimatedCount = useMemo(() => {
    const lM = parseFloat(String(beamLengthM).replace(',', '.'));
    const sCm = parseFloat(String(spacingCm).replace(',', '.'));
    if (!isNaN(lM) && lM > 0 && !isNaN(sCm) && sCm > 0) {
      return Math.round((lM * 100) / sCm) + 1;
    }
    return null;
  }, [beamLengthM, spacingCm]);

  const handleApply = () => {
    onApplyStirrup({
      cutLengthM,
      count: estimatedCount,
      colWidthCm,
      colHeightCm,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-amber-300 overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Micro-Calculadora de Estribos (Acero)
              </h3>
              <p className="text-[11px] text-amber-100 font-medium">
                Calcula la longitud de corte exacta y cantidad de estribos con ganchos sísmicos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                Ancho Viga / Columna (cm)
              </label>
              <input
                type="number"
                value={colWidthCm}
                onChange={(e) => setColWidthCm(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                Alto Viga / Columna (cm)
              </label>
              <input
                type="number"
                value={colHeightCm}
                onChange={(e) => setColHeightCm(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                Recubrimiento libre (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={coverCm}
                onChange={(e) => setCoverCm(e.target.value)}
                placeholder="2.5"
                className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-500">Típico: 2.5 cm (vigas/col.)</span>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                Ganchos sísmicos 135° (cm)
              </label>
              <input
                type="number"
                value={hookCm}
                onChange={(e) => setHookCm(e.target.value)}
                placeholder="10"
                className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-500">2 ganchos de 10 cm c/u</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <span className="block text-[11px] font-bold text-amber-900 mb-2">
              Opcional: estimar cantidad de estribos por tramo
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Longitud del elemento (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={beamLengthM}
                  onChange={(e) => setBeamLengthM(e.target.value)}
                  placeholder="ej: 4.80"
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Separación estribos (cm)
                </label>
                <input
                  type="number"
                  value={spacingCm}
                  onChange={(e) => setSpacingCm(e.target.value)}
                  placeholder="ej: 15"
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Longitud de Corte Resultante:
              </span>
              <span className="text-xl font-black text-amber-950">
                {cutLengthM} m
              </span>
              <span className="text-[10px] text-amber-700 block">
                (2 × ({Math.max(0, colWidthCm - 2 * coverCm)} + {Math.max(0, colHeightCm - 2 * coverCm)}) cm + {2 * hookCm} cm de ganchos)
              </span>
            </div>
            {estimatedCount && (
              <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-700 block font-semibold">Cant. Estribos</span>
                <span className="text-base font-black text-amber-950">{estimatedCount} uds</span>
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md cursor-pointer transition-all flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Aplicar a la Fila</span>
          </button>
        </div>
      </div>
    </div>
  );
}
