import React from 'react';
import { useBulkUpdate, parsePriceLines } from '../../hooks/useBulkUpdate';

const BulkPriceModal = ({ onSuccess, onClose, resourceType = 'materials', selectedDatabase = 'master', title }) => {
  const {
    priceText,
    setPriceText,
    submitBulkPrices,
  } = useBulkUpdate(resourceType, selectedDatabase);

  const handleSubmit = () => {
    submitBulkPrices(onSuccess);
  };

  const totalLines = priceText.split('\n').filter(line => line.trim()).length;
  const parsedItems = parsePriceLines(priceText);
  const validCount = parsedItems.length;

  const modalTitle = title
    ? `Actualizar Precios de ${title} en Masa`
    : resourceType === 'equipments'
      ? 'Actualizar Precios de Equipos en Masa'
      : resourceType === 'labors'
        ? 'Actualizar Salarios de Mano de Obra en Masa'
        : 'Actualizar Precios de Materiales en Masa';

  const formatHelp = resourceType === 'equipments'
    ? 'Pega desde Excel (Código [TAB] Precio, ej: EQU-868131	380,00) o en formato: EQU-868131: $380.00'
    : resourceType === 'labors'
      ? 'Pega desde Excel (Código [TAB] Jornal, ej: 1-1.1	2,26) o en formato: 1-1.1: $2.26'
      : 'Pega desde Excel (Código [TAB] Precio, ej: ACA001	59,18) o en formato: ACA001: $59.18';

  const placeholderText = resourceType === 'equipments'
    ? 'EQU-868131\t380,00\nALB001\t450,00\nALB002\t120,50'
    : resourceType === 'labors'
      ? '1-1.1\t2,26\n1-1.2\t2,46\n11-2.4\t2,55'
      : 'ACA001\t59,18\nACA134\t0,45\nCEM041\t8,50';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">{modalTitle}</h2>
          <p className="text-sm text-slate-600 mt-1">
            {formatHelp}
          </p>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
          <textarea
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-56 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Soporta: <strong>Excel (copiar y pegar)</strong>, comas decimales (59,18), dos puntos (:) o espacios.
            </span>
            {totalLines > 0 && (
              <span className={`font-semibold px-2 py-0.5 rounded ${validCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {validCount} de {totalLines} {validCount === 1 ? 'válido' : 'válidos'}
              </span>
            )}
          </div>

          {validCount > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 max-h-24 overflow-y-auto text-xs font-mono text-slate-700">
              <div className="font-semibold text-slate-500 mb-1">Vista previa detectada ({validCount} items):</div>
              <div className="flex flex-wrap gap-2">
                {parsedItems.slice(0, 8).map((item, idx) => (
                  <span key={idx} className="bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                    <strong className="text-blue-700">{item.codigo}</strong>: ${item.precio.toFixed(2)}
                  </span>
                ))}
                {validCount > 8 && (
                  <span className="text-slate-400 self-center">... y {validCount - 8} más</span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={validCount === 0}
              className={`px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium ${
                validCount === 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
              }`}
            >
              Actualizar {validCount > 0 ? `${validCount} ${validCount === 1 ? 'Precio' : 'Precios'}` : 'Precios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPriceModal;
