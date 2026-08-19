import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader, Play, CheckCircle, Database } from 'lucide-react';
import { marketService } from '../services/marketService';
import { API_URL } from '../../../services/api';

export default function SanitizationPanel() {
  const [unsanitized, setUnsanitized] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [proposals, setProposals] = useState([]);

  useEffect(() => {
    fetchUnsanitized();
  }, []);

  const fetchUnsanitized = async () => {
    try {
      setLoading(true);
      const data = await marketService.getUnsanitizedMaterials(100);
      setUnsanitized(data.items || []);
    } catch (error) {
      toast.error('Error cargando materiales sin sanear');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAI = async () => {
    if (unsanitized.length === 0) return;
    try {
      setIsProcessing(true);
      const batchToProcess = unsanitized.slice(0, 50);
      toast.loading('La IA está analizando los nombres...', { id: 'ai-run' });
      
      const response = await marketService.sanitizeBatch(batchToProcess);
      
      if (response && response.results) {
        setProposals(response.results.map(r => ({...r, method: 'AI'})));
        toast.success('Análisis IA completado', { id: 'ai-run' });
      } else {
        toast.error('Error en formato de respuesta', { id: 'ai-run' });
      }
    } catch (err) {
      toast.error(err.message || 'Error al conectar con la IA', { id: 'ai-run' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunRules = async () => {
    if (unsanitized.length === 0) return;
    try {
      setIsProcessing(true);
      const batchToProcess = unsanitized.slice(0, 50).map(m => ({
        id: m.code,
        description: m.description
      }));
      toast.loading('Aplicando reglas de limpieza...', { id: 'rules-run' });
      
      const token = localStorage.getItem('arko_admin_token');
      const resp = await fetch(`${API_URL}/market/sanitize/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(batchToProcess)
      });
      if (!resp.ok) throw new Error('Error en saneamiento por reglas');
      const data = await resp.json();
      
      // Convert to proposals format
      const normalized = data.map(item => ({
        original_code: item.id,
        clean_description: item.clean,
        family: item.family,
        method: 'Reglas'
      }));
      setProposals(normalized);
      toast.success(`${normalized.length} descripciones limpiadas por reglas`, { id: 'rules-run' });
    } catch (err) {
      toast.error(err.message || 'Error en limpieza por reglas', { id: 'rules-run' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = async () => {
    if (proposals.length === 0) return;
    try {
      toast.loading('Guardando en Base de Datos...', { id: 'ai-save' });
      await marketService.applySanitization(proposals);
      toast.success('¡Lote guardado correctamente!', { id: 'ai-save' });
      setProposals([]);
      fetchUnsanitized();
    } catch (error) {
      toast.error('Error al guardar', { id: 'ai-save' });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Saneamiento con Inteligencia Artificial</h2>
          <p className="text-slate-500 mt-1">
            Extrae descripciones sucias y utiliza el LLM para generar nombres limpios y asignar familias automáticamente.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              const newKey = window.prompt("Por favor, pega aquí tu nueva clave de Gemini (API Key):");
              if (!newKey) return;
              toast.loading('Inyectando nueva API Key...', {id: 'db-upg'});
              try {
                await fetch(`${API_URL}/market/update-key?new_key=${encodeURIComponent(newKey)}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}` }
                });
                toast.success('Clave de IA Actualizada', {id: 'db-upg'});
              } catch (e) {
                toast.error('Error de red', {id: 'db-upg'});
              }
            }}
            className="px-3 py-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold"
          >
            [Dev] Inyectar Key
          </button>
          <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg border border-orange-200 flex items-center gap-2">
            <Database size={16} />
            <span className="font-bold">{loading ? '...' : unsanitized.length}+</span>
            <span className="text-sm">por sanear</span>
          </div>
          <button 
            onClick={handleRunRules}
            disabled={isProcessing || unsanitized.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
            Limpiar por Reglas (50)
          </button>
          <button 
            onClick={handleRunAI}
            disabled={isProcessing || unsanitized.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
            Analizar con IA (50)
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        {proposals.length > 0 ? (
          <>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3 w-1/3">Descripción Original</th>
                    <th className="px-4 py-3 w-1/3 text-blue-700 bg-blue-50/50">Descripción Limpia</th>
                    <th className="px-4 py-3 text-blue-700 bg-blue-50/50">Familia</th>
                    <th className="px-4 py-3 text-slate-500 bg-slate-50">Método</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {proposals.map((prop, idx) => {
                    const original = unsanitized.find(u => u.code === prop.original_code);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-500">{prop.original_code}</td>
                        <td className="px-4 py-3 text-slate-700">{original?.description || 'N/A'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 bg-blue-50/30">
                          {prop.clean_description} 
                          <span className="text-slate-400 text-xs ml-2 font-normal">({prop.clean_unit})</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold">
                            {prop.family}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            prop.method === 'AI' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {prop.method || 'Reglas'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setProposals([])}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                Descartar
              </button>
              <button 
                onClick={handleApply}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors shadow-sm shadow-green-600/20"
              >
                <CheckCircle size={18} />
                Aprobar y Guardar BD
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
            <Database size={48} className="mb-4 opacity-20" />
            <p className="text-lg">Sin propuestas todavía.</p>
            <p className="text-sm mt-1">Usa <strong className="text-emerald-700">"Limpiar por Reglas"</strong> (instantáneo) o <strong className="text-blue-700">"Analizar con IA"</strong> para procesar {unsanitized.length > 0 ? 50 : 0} insumos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
