import React from 'react';
import { FiUpload, FiFileText, FiX } from 'react-icons/fi';
import { useBulkUpdate, parsePriceLines } from '../../hooks/useBulkUpdate';

const BulkPriceModal = ({ onSuccess, onClose, resourceType = 'materials', selectedDatabase = 'master', title }) => {
  const {
    priceText,
    setPriceText,
    submitBulkPrices,
    priceFile,
    setPriceFile,
    isUploadingPriceFile,
    submitBulkPricesFile,
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
    ? 'Pega desde Excel (Código [TAB] Precio, ej: EQU-868131	380,00) o adjunta tu archivo Excel (.xlsx / .xls)'
    : resourceType === 'labors'
      ? 'Pega desde Excel (Código [TAB] Jornal, ej: 1-1.1	2,26) o adjunta tu archivo Excel (.xlsx / .xls)'
      : 'Pega desde Excel (Código [TAB] Precio, ej: ACA001	59,18) o adjunta tu archivo Excel (.xlsx / .xls)';

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
            disabled={Boolean(priceFile)}
            className={`w-full h-56 p-4 border rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              priceFile ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300'
            }`}
          />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Soporta: <strong>Excel (copiar y pegar)</strong>, comas decimales (59,18), dos puntos (:) o espacios.
            </span>
            {totalLines > 0 && !priceFile && (
              <span className={`font-semibold px-2 py-0.5 rounded ${validCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {validCount} de {totalLines} {validCount === 1 ? 'válido' : 'válidos'}
              </span>
            )}
          </div>

          {validCount > 0 && !priceFile && (
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

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
            {/* Botón para adjuntar archivo Excel */}
            <div className="flex items-center gap-2">
              {priceFile ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-3 py-2 rounded-lg shadow-2xs">
                  <FiFileText size={16} className="text-emerald-600" />
                  <span className="font-semibold max-w-[180px] truncate" title={priceFile.name}>
                    {priceFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPriceFile(null)}
                    disabled={isUploadingPriceFile}
                    className="text-slate-400 hover:text-rose-600 ml-1 transition-colors"
                    title="Quitar archivo adjunto"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="bulk-price-excel-file"
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-semibold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                  title="Adjuntar archivo Excel (.xlsx o .xls) con columnas Código y Precio"
                >
                  <FiUpload size={14} />
                  <span>Adjuntar Excel</span>
                  <input
                    id="bulk-price-excel-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    disabled={isUploadingPriceFile}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setPriceFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Acciones principales a la derecha */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploadingPriceFile}
                className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>

              {priceFile ? (
                <button
                  type="button"
                  onClick={() => submitBulkPricesFile(priceFile, onSuccess)}
                  disabled={isUploadingPriceFile}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors text-sm font-medium shadow-sm cursor-pointer"
                >
                  <FiUpload size={15} className={isUploadingPriceFile ? "animate-spin" : ""} />
                  {isUploadingPriceFile ? 'Actualizando...' : 'Actualizar desde Excel'}
                </button>
              ) : (
                <button
                  type="button"
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPriceModal;
