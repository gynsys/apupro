import React, { useState, useMemo, useEffect } from 'react';
import {
  Clipboard,
  ClipboardCheck,
  X,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { parseTabularComputosClipboard } from '../../domain/clipboard.js';

export default function PasteComputosModal({
  isOpen,
  onClose,
  onPasteRows,
  activeChapter = 'GENERAL',
}) {
  const [pastedText, setPastedText] = useState('');
  const [targetMode, setTargetMode] = useState('append'); // 'append' | 'merge'

  useEffect(() => {
    if (isOpen) {
      setPastedText('');
      setTargetMode('append');

      // Intentar leer el portapapeles automáticamente al abrir si el navegador lo permite
      if (navigator?.clipboard?.readText) {
        navigator.clipboard.readText()
          .then((text) => {
            if (text && text.trim().length > 0) {
              setPastedText(text);
            }
          })
          .catch(() => {
            // Permiso no concedido o no disponible, el usuario pegará manualmente
          });
      }
    }
  }, [isOpen]);

  // Parsear texto en tiempo real para previsualización
  const { parsedRows, detectedChapter } = useMemo(() => {
    if (!pastedText.trim()) return { parsedRows: [], detectedChapter: activeChapter };
    const res = parseTabularComputosClipboard(pastedText, activeChapter);
    return { parsedRows: res.rows || [], detectedChapter: res.chapter || activeChapter };
  }, [pastedText, activeChapter]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (parsedRows.length === 0) return;
    onPasteRows(parsedRows, targetMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-5 py-4 bg-amber-100 border-b border-amber-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200 rounded-xl text-amber-900 border border-amber-300 shadow-2xs">
              <Clipboard size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-950">
                Pegar Cómputos desde Excel o Planilla
              </h3>
              <p className="text-xs text-amber-800">
                Sombrea y copia filas en Excel o en otra planilla (Ctrl+C), y pégalas aquí (Ctrl+V).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Área de Pegado */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileSpreadsheet size={15} className="text-emerald-600" />
                <span>Pega aquí tus datos copiados (Ctrl+V):</span>
              </label>
              {pastedText && (
                <button
                  type="button"
                  onClick={() => setPastedText('')}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Haz clic aquí y presiona Ctrl + V para pegar las celdas copiadas de Excel..."
              className="w-full text-xs font-mono p-3 rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 bg-amber-50/30 text-slate-800 placeholder:text-slate-400 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Opciones de Inserción */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">Modo de pegado:</span>
            <label className="flex items-center gap-1.5 font-medium cursor-pointer text-slate-800">
              <input
                type="radio"
                name="pasteMode"
                value="append"
                checked={targetMode === 'append'}
                onChange={() => setTargetMode('append')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Agregar como partidas nuevas al final</span>
            </label>
            <label className="flex items-center gap-1.5 font-medium cursor-pointer text-slate-800">
              <input
                type="radio"
                name="pasteMode"
                value="merge"
                checked={targetMode === 'merge'}
                onChange={() => setTargetMode('merge')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Actualizar medidas en partidas coincidentes (por código/descripción)</span>
            </label>
          </div>

          {/* Previsualización en Vivo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-600" />
                <span>Previsualización ({parsedRows.length} partidas detectadas)</span>
              </h4>
              {detectedChapter && (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  Capítulo: {detectedChapter}
                </span>
              )}
            </div>

            {parsedRows.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                <ClipboardCheck size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="font-semibold">Sin datos detectados aún.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Copia un rango de celdas en Excel (incluyendo descripción, unidad y medidas) y pégalas arriba.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-amber-100 text-amber-950 font-bold border-b border-amber-200 sticky top-0">
                    <tr>
                      <th className="p-2 w-10 text-center">N°</th>
                      <th className="p-2">Descripción</th>
                      <th className="p-2 text-center w-14">Und</th>
                      <th className="p-2 text-right w-16">Largo</th>
                      <th className="p-2 text-right w-16">Ancho</th>
                      <th className="p-2 text-right w-16">Alto</th>
                      <th className="p-2 text-center w-14">Veces</th>
                      <th className="p-2 text-right w-20">Dist. (km)</th>
                      <th className="p-2 text-right w-16">M3</th>
                      <th className="p-2 text-right w-20 font-black">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/50">
                        <td className="p-2 text-center font-bold text-slate-500">{r.cod_par || idx + 1}</td>
                        <td className="p-2 font-medium text-slate-800 max-w-[300px] truncate" title={r.description}>
                          {r.description}
                        </td>
                        <td className="p-2 text-center font-bold text-blue-700">{r.unit}</td>
                        <td className="p-2 text-right text-slate-600">{r.length || '—'}</td>
                        <td className="p-2 text-right text-slate-600">{r.width || '—'}</td>
                        <td className="p-2 text-right text-slate-600">{r.height || '—'}</td>
                        <td className="p-2 text-center text-slate-600">{r.times || 1}</td>
                        <td className="p-2 text-right font-bold text-amber-800">{r.distance || '—'}</td>
                        <td className="p-2 text-right font-bold text-amber-800">{r.m3 || '—'}</td>
                        <td className="p-2 text-right font-black text-amber-950 bg-amber-50/60">
                          {Number(r.quantity || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Acciones Inferior */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={parsedRows.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Check size={16} />
            <span>Insertar {parsedRows.length > 0 ? `${parsedRows.length} Partidas` : 'en la Planilla'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
