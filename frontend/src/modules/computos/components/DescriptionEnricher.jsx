import React, { useRef, useState } from 'react';
import { Check, Database, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { enrichComputoDescription } from '../services/computosApi';

const SOURCE_LABELS = {
  covenin_ia: 'COVENIN + IA',
  ia: 'Redacción IA',
  covenin: 'Norma COVENIN',
  none: 'Sin coincidencia',
};

const MIN_DESCRIPTION_LENGTH = 3;

/**
 * Asistente de descripción en segundo plano: busca la mejor coincidencia en COVENIN y la IA
 * redacta y actualiza la descripción directamente sin producir saltos de diseño en la tabla.
 *
 * @param {Object} props
 * @param {Object} props.item Partida de la planilla.
 * @param {(itemId: string, text: string, options?: Object) => void} props.onApplyDescription Actualiza el texto en segundo plano.
 * @param {(itemId: string, candidate: Object) => void} props.onApplyCovenin Aplica la partida oficial.
 * @param {boolean} [props.showLabel] Muestra la etiqueta junto al icono (vista móvil).
 */
export default function DescriptionEnricher({ item, onApplyDescription, onApplyCovenin, showLabel = false }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [previousDescription, setPreviousDescription] = useState(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const requestIdRef = useRef(0);

  const description = (item?.description || '').trim();
  const canAnalyze = description.length >= MIN_DESCRIPTION_LENGTH;

  const handleAnalyze = async () => {
    if (!canAnalyze || isLoading) return;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    const originalText = description;
    setIsLoading(true);
    setResult(null);
    setShowAlternatives(false);
    try {
      const data = await enrichComputoDescription({ description: originalText, unit: item.unit || '' });
      if (currentRequestId !== requestIdRef.current) return;
      if (data?.suggested_description) {
        setPreviousDescription(originalText);
        onApplyDescription(item.id, data.suggested_description, { silent: true });
      }
      setResult(data);
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return;
      toast.error(error.message || 'No se pudo analizar la descripción');
    } finally {
      if (currentRequestId === requestIdRef.current) setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    requestIdRef.current += 1;
    setResult(null);
    setPreviousDescription(null);
    setShowAlternatives(false);
    setIsLoading(false);
  };

  const handleUndo = () => {
    if (previousDescription) {
      onApplyDescription(item.id, previousDescription, { silent: true });
    }
    handleDismiss();
  };

  const handleUseOfficial = (candidate) => {
    onApplyCovenin(item.id, candidate);
    handleDismiss();
  };

  const candidates = result?.candidates || [];

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!canAnalyze || isLoading}
        className={`inline-flex items-center gap-1 w-fit rounded-md border border-amber-300 bg-white/80 text-amber-800 font-bold transition-colors cursor-pointer hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed ${
          showLabel ? 'text-[11px] px-2.5 py-1 rounded-lg' : 'text-[9px] px-1 py-0.5'
        }`}
        title="Buscar en COVENIN y completar la descripción con IA en segundo plano"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-600" />}
        {showLabel && <span>{isLoading ? 'Actualizando…' : 'Completar con COVENIN + IA'}</span>}
      </button>

      {result && (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 rounded px-1.5 py-0.5">
          <Check className="w-2.5 h-2.5 text-emerald-700" />
          <span>{SOURCE_LABELS[result.source] || 'Actualizado'}</span>
          {candidates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAlternatives((prev) => !prev)}
              className="underline decoration-dotted text-emerald-950 hover:text-amber-900 cursor-pointer ml-0.5"
              title="Ver coincidencias oficiales COVENIN"
            >
              ({candidates.length} COVENIN)
            </button>
          )}
          {previousDescription && (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-0.5 text-amber-800 hover:text-red-700 cursor-pointer ml-0.5"
              title="Restaurar descripción anterior"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Deshacer</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-emerald-800 hover:text-red-700 cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      )}

      {result && showAlternatives && candidates.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 w-80 sm:w-96 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-950 shadow-lg space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-extrabold uppercase text-amber-800">
              Coincidencias COVENIN
            </span>
            <button
              type="button"
              onClick={() => setShowAlternatives(false)}
              className="text-amber-700 hover:text-red-700 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {candidates.slice(0, 3).map((candidate) => (
            <div key={candidate.cod_par} className="flex items-start justify-between gap-2 border-t border-amber-200/70 pt-1">
              <span className="leading-snug text-[10px]">
                <span className="font-mono font-bold text-emerald-800">{candidate.cov_par || candidate.cod_par}</span>{' '}
                {candidate.description}
              </span>
              <button
                type="button"
                onClick={() => handleUseOfficial(candidate)}
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold cursor-pointer hover:bg-emerald-100"
                title="Reemplazar por la partida oficial COVENIN"
              >
                <Database className="w-3 h-3" /> Usar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
