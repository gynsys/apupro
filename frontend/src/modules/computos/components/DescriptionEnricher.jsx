import React, { useRef, useState } from 'react';
import { Check, Database, Loader2, Sparkles, X } from 'lucide-react';
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
 * Asistente discreto de descripción: busca la mejor coincidencia en COVENIN y la IA
 * redacta la descripción final. Nunca modifica la partida sin confirmación del usuario.
 *
 * @param {Object} props
 * @param {Object} props.item Partida de la planilla.
 * @param {(itemId: string, text: string) => void} props.onApplyDescription Aplica solo el texto.
 * @param {(itemId: string, candidate: Object) => void} props.onApplyCovenin Aplica la partida oficial.
 * @param {boolean} [props.showLabel] Muestra la etiqueta junto al icono (vista móvil).
 */
export default function DescriptionEnricher({ item, onApplyDescription, onApplyCovenin, showLabel = false }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const requestIdRef = useRef(0);

  const description = (item?.description || '').trim();
  const canAnalyze = description.length >= MIN_DESCRIPTION_LENGTH;

  const handleAnalyze = async () => {
    if (!canAnalyze || isLoading) return;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    setIsLoading(true);
    setResult(null);
    try {
      const data = await enrichComputoDescription({ description, unit: item.unit || '' });
      if (currentRequestId !== requestIdRef.current) return;
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
    setIsLoading(false);
  };

  const handleApply = () => {
    if (!result?.suggested_description) return;
    onApplyDescription(item.id, result.suggested_description);
    setResult(null);
  };

  const handleUseOfficial = (candidate) => {
    onApplyCovenin(item.id, candidate);
    setResult(null);
  };

  const alternatives = (result?.candidates || []).filter(
    (candidate) => candidate.cod_par !== result?.base_candidate?.cod_par
  );

  return (
    <>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!canAnalyze || isLoading}
        className={`inline-flex items-center gap-1 w-fit rounded-md border border-amber-300 bg-white/80 text-amber-800 font-bold transition-colors cursor-pointer hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed ${
          showLabel ? 'text-[11px] px-2.5 py-1 rounded-lg' : 'text-[9px] px-1 py-0.5'
        }`}
        title="Buscar en COVENIN y completar la descripción con IA"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-600" />}
        {showLabel && <span>{isLoading ? 'Analizando…' : 'Completar con COVENIN + IA'}</span>}
      </button>

      {result && (
        <div className="basis-full w-full rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-950 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-extrabold text-[10px] uppercase text-amber-800">
              <Sparkles className="w-3 h-3" />
              {SOURCE_LABELS[result.source] || 'Sugerencia'}
              {result.base_candidate && (
                <span className="font-mono normal-case text-emerald-800 bg-emerald-100 border border-emerald-300 rounded px-1">
                  {result.base_candidate.cov_par || result.base_candidate.cod_par}
                </span>
              )}
            </span>
            <button type="button" onClick={handleDismiss} className="text-amber-700 hover:text-red-700 cursor-pointer" title="Descartar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {result.suggested_description ? (
            <p className="font-semibold leading-snug break-words">{result.suggested_description}</p>
          ) : (
            <p className="italic text-amber-800">No se encontró una redacción confiable para esta partida.</p>
          )}

          {result.reasoning && <p className="text-[10px] text-amber-800">{result.reasoning}</p>}
          {(result.warnings || []).map((warning) => (
            <p key={warning} className="text-[10px] text-red-700">{warning}</p>
          ))}

          {result.suggested_description && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
              >
                <Check className="w-3 h-3" /> Aplicar
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2 py-0.5 rounded border border-amber-300 bg-white text-amber-900 font-bold cursor-pointer hover:bg-amber-100"
              >
                Descartar
              </button>
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="border-t border-amber-200 pt-1 space-y-1">
              <span className="text-[9px] font-bold uppercase text-amber-800">Otras coincidencias COVENIN</span>
              {alternatives.slice(0, 3).map((candidate) => (
                <div key={candidate.cod_par} className="flex items-start justify-between gap-2">
                  <span className="leading-snug">
                    <span className="font-mono text-emerald-800">{candidate.cov_par || candidate.cod_par}</span>{' '}
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
      )}
    </>
  );
}
