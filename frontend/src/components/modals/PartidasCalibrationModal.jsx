import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowRight,
  X,
  Search,
  Check,
  RotateCcw,
  Info,
  Layers,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auditDescription } from '../../utils/descriptionAuditor';

/**
 * Modal de Calibración y Afinación de Descripciones Técnicas
 * Paso previo a la generación de presupuestos con IA para resolver la ambigüedad
 * de materiales y evitar alucinaciones.
 */
export default function PartidasCalibrationModal({
  isOpen,
  items = [],
  onClose,
  onConfirm,
  onOpenCoveninSearch,
}) {
  const [calibratedItems, setCalibratedItems] = useState([]);
  const [activeTab, setActiveTab] = useState('incomplete'); // 'incomplete' | 'all'

  React.useEffect(() => {
    if (isOpen && items && items.length > 0) {
      // Inicializar con la auditoría de cada partida y detección de variantes de materiales
      const audited = items.map((it, idx) => {
        const audit = auditDescription(it.description, it.cod_par, it.unit);
        return {
          ...it,
          originalIndex: idx,
          currentDescription: it.description || '',
          suggestedDescription: audit.suggestion || it.description || '',
          auditStatus: audit.status,
          missing: audit.missing || [],
          isCovenin: audit.isCovenin,
          materialDomain: audit.materialDomain,
          materialVariants: audit.materialVariants || [],
          isModified: false,
        };
      });
      setCalibratedItems(audited);
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const incompleteItems = calibratedItems.filter((it) => it.auditStatus === 'warning');
  const coveninItems = calibratedItems.filter((it) => it.isCovenin);
  const completeScItems = calibratedItems.filter((it) => it.auditStatus === 'complete');

  const handleApplySuggestion = (id) => {
    setCalibratedItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const audit = auditDescription(it.suggestedDescription, it.cod_par, it.unit);
          return {
            ...it,
            currentDescription: it.suggestedDescription,
            auditStatus: audit.status,
            missing: audit.missing,
            materialDomain: audit.materialDomain,
            materialVariants: audit.materialVariants || [],
            isModified: true,
          };
        }
        return it;
      })
    );
    toast.success('Sugerencia técnica aplicada');
  };

  const handleSelectMaterialVariant = (id, variant) => {
    setCalibratedItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const audit = auditDescription(variant.text, it.cod_par, it.unit);
          return {
            ...it,
            currentDescription: variant.text,
            suggestedDescription: variant.text,
            auditStatus: audit.status,
            missing: audit.missing,
            isModified: true,
          };
        }
        return it;
      })
    );
    toast.success(`Material seleccionado: ${variant.name}`);
  };

  const handleApplyAllSuggestions = () => {
    setCalibratedItems((prev) =>
      prev.map((it) => {
        if (it.auditStatus === 'warning') {
          const audit = auditDescription(it.suggestedDescription, it.cod_par, it.unit);
          return {
            ...it,
            currentDescription: it.suggestedDescription,
            auditStatus: audit.status,
            missing: audit.missing,
            materialDomain: audit.materialDomain,
            materialVariants: audit.materialVariants || [],
            isModified: true,
          };
        }
        return it;
      })
    );
    toast.success('Todas las sugerencias técnicas recomendadas fueron aplicadas');
  };

  const handleTextChange = (id, newText) => {
    setCalibratedItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const audit = auditDescription(newText, it.cod_par, it.unit);
          return {
            ...it,
            currentDescription: newText,
            auditStatus: audit.status,
            missing: audit.missing,
            materialDomain: audit.materialDomain,
            materialVariants: audit.materialVariants || [],
            isModified: true,
          };
        }
        return it;
      })
    );
  };

  const handleConfirmAndProceed = () => {
    const updated = calibratedItems.map((it) => ({
      ...it,
      description: it.currentDescription.trim(),
    }));
    onConfirm(updated);
  };

  const displayedList = activeTab === 'incomplete' ? incompleteItems : calibratedItems;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Calibración de Partidas y Materiales
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/25 text-amber-50">
                  Anti-alucinación IA
                </span>
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                Resuelve la ambigüedad de materiales y dimensiones para garantizar rendimientos e insumos reales.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS & SUMMARY BANNER */}
        <div className="px-6 py-3.5 bg-amber-50/70 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>{coveninItems.length} COVENIN Oficial (Directo de BD)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-800 rounded-lg border border-sky-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
              <span>{completeScItems.length} S/C Detalladas</span>
            </div>
            {incompleteItems.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-lg border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{incompleteItems.length} Requieren afinación</span>
              </div>
            )}
          </div>

          {incompleteItems.length > 0 && (
            <button
              type="button"
              onClick={handleApplyAllSuggestions}
              className="text-xs font-bold text-amber-900 bg-amber-200/90 hover:bg-amber-300 border border-amber-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Aplicar todas las sugerencias ({incompleteItems.length})</span>
            </button>
          )}
        </div>

        {/* TABS SELECTOR */}
        <div className="px-6 pt-3 pb-1 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <button
              type="button"
              onClick={() => setActiveTab('incomplete')}
              className={`px-3 py-1.5 rounded-t-lg transition-all border-b-2 cursor-pointer ${
                activeTab === 'incomplete'
                  ? 'border-amber-600 text-amber-800 bg-amber-50/50 font-bold'
                  : 'border-transparent hover:text-gray-800'
              }`}
            >
              Partidas a revisar ({incompleteItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-t-lg transition-all border-b-2 cursor-pointer ${
                activeTab === 'all'
                  ? 'border-amber-600 text-amber-800 bg-amber-50/50 font-bold'
                  : 'border-transparent hover:text-gray-800'
              }`}
            >
              Todas las partidas ({calibratedItems.length})
            </button>
          </div>
          <span className="text-[11px] text-gray-400 hidden sm:inline">
            💡 Las partidas COVENIN se procesan directamente sin consumir cuota de IA.
          </span>
        </div>

        {/* LIST / BODY */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          {displayedList.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-emerald-200 shadow-xs space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-800">
                ¡Todas las partidas cuentan con especificaciones técnicas completas!
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No se detectaron ambigüedades en los materiales ni descripciones. Puedes proceder directamente con la generación del presupuesto.
              </p>
            </div>
          ) : (
            displayedList.map((it) => {
              const isWarning = it.auditStatus === 'warning';
              const isCov = it.isCovenin;
              const hasVariants = it.materialVariants && it.materialVariants.length > 0;

              return (
                <div
                  key={it.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCov
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isWarning
                      ? 'bg-white border-amber-300 shadow-sm'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        #{it.originalIndex + 1}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        {it.chapter ? `[${it.chapter}]` : ''}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {it.unit || 'UND'} • {it.quantity || 1}
                      </span>
                      {isCov && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <Database className="w-3 h-3 text-emerald-600" />
                          COVENIN {it.cod_par}
                        </span>
                      )}
                      {!isCov && !isWarning && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                          <Check className="w-3 h-3 text-sky-600" />
                          S/C Detallada
                        </span>
                      )}
                      {isWarning && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {hasVariants ? `Material ambiguo (${it.materialDomain})` : `Requiere detalles (${it.missing.join(', ')})`}
                        </span>
                      )}
                    </div>

                    {onOpenCoveninSearch && (
                      <button
                        type="button"
                        onClick={() => onOpenCoveninSearch(it)}
                        className="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        title="Vincular a una partida oficial COVENIN"
                      >
                        <Search className="w-3 h-3 text-sky-600" />
                        <span className="hidden sm:inline">Buscar en COVENIN</span>
                      </button>
                    )}
                  </div>

                  {/* DESCRIPCIÓN EDITABLE */}
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={it.currentDescription}
                      onChange={(e) => handleTextChange(it.id, e.target.value)}
                      placeholder="Escribe la descripción técnica completa..."
                      disabled={isCov}
                      className={`w-full px-3 py-2 text-xs font-semibold rounded-lg border uppercase transition-colors resize-none ${
                        isCov
                          ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                          : isWarning
                          ? 'bg-amber-50/30 border-amber-300 text-amber-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                      }`}
                    />

                    {/* VARIANTES DE MATERIALES PARA RESOLVER AMBIGÜEDAD */}
                    {hasVariants && (
                      <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Opciones de material para desambiguar:</span>
                          <span className="text-[10px] text-gray-500 font-normal">
                            (Haz clic en la opción correcta para actualizar el APU)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {it.materialVariants.map((v, vIdx) => {
                            const isSelected = it.currentDescription.trim() === v.text.trim();
                            return (
                              <button
                                key={vIdx}
                                type="button"
                                onClick={() => handleSelectMaterialVariant(it.id, v)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                    : 'bg-white hover:bg-amber-100 text-slate-700 hover:text-amber-950 border-amber-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                <span>{v.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* CAJA DE SUGERENCIA RECOMENDADA (SI NO ES NINGUNA VARIANTE O ES OTRA ACTIVIDAD) */}
                    {isWarning && !hasVariants && it.suggestedDescription && it.suggestedDescription !== it.currentDescription && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-950">
                            <span className="font-bold text-amber-900">Sugerencia recomendada: </span>
                            <span className="font-medium italic">{it.suggestedDescription}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplySuggestion(it.id)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                          <Check className="w-3 h-3" />
                          <span>Usar sugerencia</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-300"
          >
            Volver a la planilla
          </button>

          <button
            type="button"
            onClick={handleConfirmAndProceed}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
          >
            <span>Generar Presupuesto con Partidas Calibradas</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
