import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GitMerge, Layers, Plus, X } from 'lucide-react';
import { mergeComputosDrafts } from '../domain/mergeComputos.js';

export default function MergeComputosModal({ isOpen, savedList = [], onClose, onConfirmMerge }) {
  const [baseId, setBaseId] = useState('');
  const [incomingId, setIncomingId] = useState('');
  const [strategy, setStrategy] = useState('combine');
  const [targetName, setTargetName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const first = savedList[0]?.id || '';
    const second = savedList[1]?.id || '';
    setBaseId(first);
    setIncomingId(second);
    setStrategy('combine');
    setTargetName(savedList[0]?.budgetName ? `${savedList[0].budgetName} (Unificada)` : 'Planilla Unificada');
  }, [isOpen, savedList]);

  const baseDraft = useMemo(() => savedList.find((d) => String(d.id) === String(baseId)), [savedList, baseId]);
  const incomingDraft = useMemo(
    () => savedList.find((d) => String(d.id) === String(incomingId)),
    [savedList, incomingId]
  );

  const preview = useMemo(() => {
    if (!baseDraft || !incomingDraft || String(baseDraft.id) === String(incomingDraft.id)) return null;
    return mergeComputosDrafts(baseDraft, incomingDraft, {
      conflictStrategy: strategy,
      targetName: targetName.trim() || `${baseDraft.budgetName} (Unificada)`,
    });
  }, [baseDraft, incomingDraft, strategy, targetName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-amber-100 w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-lg rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-amber-600/20 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-600/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center">
              <GitMerge size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950">Unificar Planillas de Cómputos</h2>
              <p className="text-xs text-amber-900/70">Combina trabajo paralelo sin perder las originales</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-amber-900/60 hover:text-amber-950 rounded-lg hover:bg-amber-200/50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          <div>
            <label className="block font-bold text-amber-950 mb-1">1. Planilla Principal (Base):</label>
            <select
              value={baseId}
              onChange={(e) => {
                const nextId = e.target.value;
                setBaseId(nextId);
                const found = savedList.find((d) => String(d.id) === String(nextId));
                if (found) setTargetName(`${found.budgetName} (Unificada)`);
              }}
              className="w-full rounded-xl border border-amber-600/25 bg-white px-3 py-2 text-slate-800 font-semibold"
            >
              {savedList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.budgetName} ({d.itemCount || d.items?.length || 0} partidas)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-amber-950 mb-1">2. Planilla Secundaria (A incorporar):</label>
            <select
              value={incomingId}
              onChange={(e) => setIncomingId(e.target.value)}
              className="w-full rounded-xl border border-amber-600/25 bg-white px-3 py-2 text-slate-800 font-semibold"
            >
              {savedList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.budgetName} ({d.itemCount || d.items?.length || 0} partidas)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-amber-950 mb-1">3. Si una partida existe en ambas:</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded-xl border border-amber-600/25 bg-white px-3 py-2 text-slate-800 font-medium"
            >
              <option value="combine">Combinar mediciones (sumar parciales no duplicados)</option>
              <option value="keep_base">Conservar las de la planilla principal (solo traer nuevas)</option>
              <option value="use_incoming">Reemplazar con las de la planilla secundaria</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-amber-950 mb-1">Nombre de la nueva planilla unificada:</label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="w-full rounded-xl border border-amber-600/25 bg-white px-3 py-2 text-slate-800 font-semibold"
            />
          </div>

          {String(baseId) === String(incomingId) ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-medium">
              Selecciona dos planillas distintas para poder unificarlas.
            </div>
          ) : preview ? (
            <div className="p-3.5 rounded-xl bg-white/85 border border-emerald-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <CheckCircle2 size={15} />
                <span>Vista previa de la unificación:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-700">
                <span className="flex items-center gap-1">
                  <Layers size={12} className="text-amber-600" /> Capítulos nuevos: <strong>+{preview.stats.chaptersAdded}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Plus size={12} className="text-emerald-600" /> Partidas nuevas: <strong>+{preview.stats.itemsAdded}</strong>
                </span>
                <span>Partidas combinadas: <strong>{preview.stats.itemsMerged}</strong></span>
                <span>Total final: <strong>{preview.draft.itemCount}</strong> filas</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-6 py-3.5 border-t border-amber-600/15 flex items-center justify-end gap-2 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/80 border border-amber-600/20 text-xs font-semibold text-amber-950 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!preview}
            onClick={() => preview && onConfirmMerge(preview)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <GitMerge size={14} />
            <span>Crear Planilla Unificada</span>
          </button>
        </div>
      </div>
    </div>
  );
}
