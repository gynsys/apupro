import React from 'react';
import { FiUpload } from 'react-icons/fi';
import { useBulkUpdate } from '../../hooks/useBulkUpdate';

const BulkDescModal = ({ onSuccess, onClose }) => {
  const {
    descFile,
    setDescFile,
    submitBulkDescriptions,
  } = useBulkUpdate();

  const handleSubmit = () => {
    submitBulkDescriptions(onSuccess);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">Actualizar Descripciones en Masa</h2>
          <p className="text-sm text-slate-600 mt-1">
            Sube un archivo Excel con columnas: Codigo, Descripcion
          </p>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setDescFile(e.target.files[0])}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FiUpload size={32} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                {descFile ? descFile.name : 'Click para seleccionar archivo Excel'}
              </span>
              <span className="text-xs text-gray-400">Formato: .xlsx o .xls</span>
            </label>
          </div>
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
              Actualizar Descripciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkDescModal;
