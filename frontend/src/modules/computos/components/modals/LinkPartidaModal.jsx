import React, { useState, useEffect, useMemo } from 'react';
import { Link2, X, Plus, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { getRecommendedLinkTemplates, computeLinkedQuantity } from '../../domain/links.js';
import { COMMON_UNITS } from '../../domain/units.js';

export default function LinkPartidaModal({
  isOpen,
  onClose,
  sourceItem,
  availableTargetItems = [],
  chapters = [],
  activeChapter = '',
  onConfirmLink,
}) {
  if (!isOpen || !sourceItem) return null;

  const recommendedTemplates = useMemo(
    () => getRecommendedLinkTemplates(sourceItem),
    [sourceItem]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => recommendedTemplates[0]?.id || 'custom'
  );
  const [isNewRow, setIsNewRow] = useState(true);
  const [targetItemId, setTargetItemId] = useState('');
  const [newDescription, setNewDescription] = useState(
    () => recommendedTemplates[0]?.targetDescription || ''
  );
  const [newUnit, setNewUnit] = useState(
    () => recommendedTemplates[0]?.targetUnit || 'M2'
  );
  const [newChapter, setNewChapter] = useState(
    () => sourceItem.chapter || activeChapter || 'OBRAS PRELIMINARES'
  );
  const [factor, setFactor] = useState(
    () => recommendedTemplates[0]?.defaultFactor || 1.0
  );
  const [distance, setDistance] = useState(
    () => recommendedTemplates[0]?.defaultDistance || ''
  );

  const currentTemplate = useMemo(
    () => recommendedTemplates.find((t) => t.id === selectedTemplateId) || recommendedTemplates[0],
    [selectedTemplateId, recommendedTemplates]
  );

  // Al cambiar de plantilla sugerida, actualizar valores por defecto
  useEffect(() => {
    if (currentTemplate) {
      setNewDescription(currentTemplate.targetDescription);
      setNewUnit(currentTemplate.targetUnit);
      setFactor(currentTemplate.defaultFactor);
      setDistance(currentTemplate.defaultDistance || '');
    }
  }, [currentTemplate]);

  // Si elige partida existente, seleccionar la primera por defecto
  useEffect(() => {
    if (!isNewRow && availableTargetItems.length > 0 && !targetItemId) {
      setTargetItemId(availableTargetItems[0].id);
    }
  }, [isNewRow, availableTargetItems, targetItemId]);

  const previewQty = useMemo(() => {
    return computeLinkedQuantity(sourceItem.quantity, {
      factor,
      distance: currentTemplate?.hasDistance ? distance : null,
    });
  }, [sourceItem.quantity, factor, distance, currentTemplate]);

  const handleConfirm = () => {
    const linkConfig = {
      formulaType: selectedTemplateId,
      factor: Number(factor) || 1,
      distance: currentTemplate?.hasDistance && distance ? Number(distance) : null,
      label: `🔗 Vinculado a: ${(sourceItem.description || 'Ítem origen').slice(0, 30)}... (×${factor}${
        currentTemplate?.hasDistance && distance ? ` × ${distance}km` : ''
      })`,
    };

    onConfirmLink({
      sourceItemId: sourceItem.id,
      targetItemId: isNewRow ? null : targetItemId,
      linkConfig,
      isNewRow,
      newRowData: isNewRow
        ? {
            description: newDescription.trim() || 'PARTIDA VINCULADA',
            unit: newUnit,
            chapter: newChapter,
          }
        : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-amber-300 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Vincular Medición Derivada (Efecto Cascada)
              </h3>
              <p className="text-[11px] text-amber-100 font-medium">
                El cómputo derivado se recalculará automáticamente cuando cambie la partida origen
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

        {/* Contenido con scroll */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Banner partida origen */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Partida Origen:
              </span>
              <span className="font-bold text-amber-950 text-xs sm:text-sm">
                {sourceItem.description || 'Partida sin descripción'}
              </span>
            </div>
            <div className="text-right shrink-0 bg-white/80 px-3 py-1 rounded-lg border border-amber-200">
              <span className="text-[10px] text-amber-700 block font-semibold">Cantidad Origen</span>
              <span className="text-base font-black text-amber-950">
                {Number(sourceItem.quantity || 0).toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {sourceItem.unit}
              </span>
            </div>
          </div>

          {/* Plantillas sugeridas */}
          <div>
            <label className="block text-xs font-bold text-amber-950 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Selecciona la regla de vinculación aprobada:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recommendedTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                    selectedTemplateId === tmpl.id
                      ? 'bg-amber-100/90 border-amber-500 shadow-xs ring-1 ring-amber-400'
                      : 'bg-white hover:bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <span className="font-bold text-amber-950 text-[11px] flex items-center justify-between">
                    <span>{tmpl.name}</span>
                    {selectedTemplateId === tmpl.id && (
                      <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                  </span>
                  <span className="text-[10px] text-amber-800 line-clamp-1">
                    Unidad: {tmpl.targetUnit} {tmpl.hasDistance ? '• Incluye Distancia (km)' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Parámetros de la fórmula de conversión */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                {currentTemplate?.factorLabel || 'Factor Multiplicador'}
              </label>
              <input
                type="number"
                step="0.01"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            {currentTemplate?.hasDistance && (
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  Distancia de Transporte / Bote (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="ej: 5.0"
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Destino del vínculo: Nueva partida o existente */}
          <div>
            <label className="block text-xs font-bold text-amber-950 mb-1.5">
              Destino del vínculo en la planilla:
            </label>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="radio"
                  name="linkTargetType"
                  checked={isNewRow}
                  onChange={() => setIsNewRow(true)}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Crear nueva partida derivada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="radio"
                  name="linkTargetType"
                  checked={!isNewRow}
                  onChange={() => setIsNewRow(false)}
                  disabled={availableTargetItems.length === 0}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Vincular con partida existente</span>
              </label>
            </div>

            {isNewRow ? (
              <div className="space-y-2 bg-amber-50/50 border border-amber-200 rounded-xl p-3">
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                    DESCRIPCIÓN DE LA NUEVA PARTIDA
                  </label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">CAPÍTULO</label>
                    <select
                      value={newChapter}
                      onChange={(e) => setNewChapter(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      {chapters.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">UNIDAD</label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-semibold bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3">
                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                  SELECCIONA LA PARTIDA DESTINO EXISTENTE
                </label>
                <select
                  value={targetItemId}
                  onChange={(e) => setTargetItemId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-semibold bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {availableTargetItems.map((item, idx) => (
                    <option key={item.id} value={item.id}>
                      #{idx + 1} - {item.description || 'Sin descripción'} ({item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Caja de Preview Matemático en tiempo real */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Resultado Vinculado en Tiempo Real:
              </span>
              <span className="text-xs text-emerald-950 font-medium">
                {sourceItem.quantity} {sourceItem.unit} × {factor}
                {currentTemplate?.hasDistance && distance ? ` × ${distance} km` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-right">
                <span className="text-base font-black text-emerald-950">
                  {Number(previewQty).toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {isNewRow ? newUnit : availableTargetItems.find((it) => it.id === targetItemId)?.unit || newUnit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con acciones */}
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
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md cursor-pointer transition-all flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>✓ Aprobar y Vincular Partida</span>
          </button>
        </div>
      </div>
    </div>
  );
}
