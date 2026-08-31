import React from 'react';
import { useBulkUpdate } from '../../hooks/useBulkUpdate';

const BulkPriceModal = ({ onSuccess, onClose }) => {
  const {
    priceText,
    setPriceText,
    submitBulkPrices,
  } = useBulkUpdate();

  const handleSubmit = () => {
    submitBulkPrices(onSuccess);
  };

  const lineCount = priceText.split('\n').filter(line => line.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">Actualizar Precios en Masa</h2>
          <p className="text-sm text-slate-600 mt-1">
            Pega los precios en formato: MAT1234: $1000 (uno por linea)
          </p>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-4">
          <textarea
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="MAT1347: $950 USD&#10;MAT1348: $1,350 USD&#10;MAT1349: $1,700 USD"
            className="w-full h-64 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Actualizar {lineCount} Precios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPriceModal;
