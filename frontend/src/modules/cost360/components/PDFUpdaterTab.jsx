import React, { useState, useRef } from 'react';
import { FiUpload, FiCheck, FiX, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

// Fallback to generic API_URL if not defined differently
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const PDFUpdaterTab = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [exchangeRate, setExchangeRate] = useState(1);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResults([]);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_URL}/pdf-updater/analyze-quote`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Error procesando el documento');
      }
      
      const data = await response.json();
      setResults(data.items || []);
      
      // Auto-select ones that have matches
      const initialSelection = {};
      data.items.forEach((item, index) => {
        if (item.matched_codmat) {
          initialSelection[index] = true;
        }
      });
      setSelectedItems(initialSelection);
      toast.success('Análisis completado');
      
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (index) => {
    setSelectedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleApprove = async () => {
    const itemsToApprove = results.filter((item, idx) => selectedItems[idx] && item.matched_codmat).map(item => ({
      original_desc: item.original_desc,
      matched_codmat: item.matched_codmat,
      new_price: parseFloat(item.new_price) / parseFloat(exchangeRate || 1)
    }));

    if (itemsToApprove.length === 0) {
      toast.error('No hay items seleccionados y emparejados válidos para actualizar.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/pdf-updater/approve-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemsToApprove })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al actualizar');
      }

      const data = await res.json();
      toast.success(data.message);
      
      // Clear approved items from list
      const remainingItems = results.filter((item, idx) => !selectedItems[idx] || !item.matched_codmat);
      setResults(remainingItems);
      setSelectedItems({});
      
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col p-6">
       {!file && results.length === 0 && (
        <div 
          className="border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center hover:bg-blue-50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="bg-blue-100 text-blue-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FiUpload size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Sube tu Lista de Precios</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Sube un PDF o imagen (JPG/PNG). La Inteligencia Artificial de Gemini 1.5 cruzará los datos con tus 8.506 materiales.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
          />
          <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-colors">
            Seleccionar Archivo
          </button>
        </div>
      )}

      {file && results.length === 0 && (
        <div className="text-center p-8 border border-slate-200 rounded-2xl">
          <h3 className="text-xl font-bold text-slate-800 mb-2">{file.name}</h3>
          <p className="text-slate-500 mb-6">Archivo listo para ser analizado.</p>
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => setFile(null)}
              className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button 
              onClick={processFile}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={isProcessing}
            >
              {isProcessing ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
              {isProcessing ? 'Analizando con IA...' : 'Analizar Documento'}
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Tasa de Cambio (Si está en Bs)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={exchangeRate} 
                    onChange={(e) => setExchangeRate(e.target.value)} 
                    placeholder="Ej: 36.5" 
                  />
                  <span className="text-sm text-gray-500 font-medium">VES/USD</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Deja en 1 si la cotización ya está en dólares.</p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                Resultados del Análisis ({results.length} items)
              </h2>
              <button 
                onClick={handleApprove}
                className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl shadow-md hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FiCheck /> Actualizar Precios Seleccionados
              </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase text-xs font-bold">
                  <tr>
                    <th className="px-4 py-3 text-center">✔</th>
                    <th className="px-4 py-3">Texto Original (Factura)</th>
                    <th className="px-4 py-3">Precio Orig.</th>
                    <th className="px-4 py-3">Precio en $</th>
                    <th className="px-4 py-3">Cruce Semántico IA (Catálogo)</th>
                    <th className="px-4 py-3">Precisión</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((item, idx) => (
                  <tr key={idx} className={selectedItems[idx] ? 'bg-blue-50/30' : ''}>
                    <td className="px-4 py-3 text-center align-middle">
                      {item.matched_codmat && (
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-600 rounded border-gray-300"
                          checked={selectedItems[idx] || false}
                          onChange={() => toggleSelection(idx)}
                        />
                      )}
                    </td>
                      <td className="px-4 py-3">
                        {item.original_desc}
                      </td>
                      <td className="px-4 py-3 font-bold text-blue-600 whitespace-nowrap">
                        $ {Number(item.new_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">
                        $ {(Number(item.new_price) / (exchangeRate || 1)).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                      {item.matched_codmat ? (
                        <div>
                          <div className="font-bold text-indigo-700">{item.matched_codmat}</div>
                          <div className="text-xs text-slate-500">{item.matched_descri}</div>
                        </div>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1 text-xs font-medium bg-amber-50 px-2 py-1 rounded-md max-w-max">
                          <FiAlertCircle /> Sin Coincidencia Segura
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs italic text-slate-400">
                      {item.match_reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default PDFUpdaterTab;
