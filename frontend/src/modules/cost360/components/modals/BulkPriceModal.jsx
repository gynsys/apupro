import React from 'react';
import { useBulkUpdate } from '../../hooks/useBulkUpdate';

const BulkPriceModal = ({ onSuccess, onClose, resourceType = 'materials', selectedDatabase = 'master', title }) => {
  const {
    priceText,
    setPriceText,
    submitBulkPrices,
  } = useBulkUpdate(resourceType, selectedDatabase);

  const handleSubmit = () => {
    submitBulkPrices(onSuccess);
  };

  const lineCount = priceText.split('\n').filter(line => line.trim()).length;

  const modalTitle = title
    ? `Actualizar Precios de ${title} en Masa`
    : resourceType === 'equipments'
      ? 'Actualizar Precios de Equipos en Masa'
      : resourceType === 'labors'
        ? 'Actualizar Salarios de Mano de Obra en Masa'
        : 'Actualizar Precios de Materiales en Masa';

  const formatHelp = resourceType === 'equipments'
    ? 'Pega los costos diarios (CosDia) en formato: ALB001: $55.06 (uno por línea o copiado de Excel)'
    : resourceType === 'labors'
      ? 'Pega los jornales/salarios en formato: 1-1.1: $2.26 (uno por línea o copiado de Excel)'
      : 'Pega los precios en formato: ACA134: $0.45 (uno por línea o copiado de Excel)';

  const placeholderText = resourceType === 'equipments'
    ? 'ALB000: $22.01 USD\nALB001: $55.06 USD\nALB002: $4.68 USD'
    : resourceType === 'labors'
      ? '1-1.1: $2.26 USD\n1-1.2: $2.46 USD\n11-2.4: $2.55 USD'
      : 'ACA134: $0.45 USD\nCEM041: $8.50 USD\nCAB012: $12.00 USD';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">{modalTitle}</h2>
          <p className="text-sm text-slate-600 mt-1">
            {formatHelp}
          </p>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-4">
          <textarea
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder={placeholderText}
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
