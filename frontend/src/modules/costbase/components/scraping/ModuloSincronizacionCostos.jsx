import React, { useState, useEffect } from 'react';
import { FiBox } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { apiFetch, apiPost } from '../../../lib/apiHelper';

const ModuloSincronizacionCostos = () => {
  const [estaProcesando, setEstaProcesando] = useState(false);
  const [pendingItems, setPendingItems] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const loadPendingItems = async () => {
    setLoadingPending(true);
    try {
      const response = await apiFetch('/scraping/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingItems(data);
      }
    } catch (error) {
      console.error("Error loading pending items", error);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadPendingItems();
  }, []);

  const desencadenarVersionamientoDB = async () => {
    setEstaProcesando(true);
    try {
      const respuestaJson = await apiPost('/scraping/versionar-precios-db', { limit: 25 });

      if (respuestaJson.status === 'processing') {
        toast.success("⚡ ¡El bot ha iniciado el escaneo de 25 materiales! Los resultados aparecerán aquí al recargar la página más tarde.", {
          duration: 5000,
          position: 'top-center'
        });
      }
    } catch (error) {
      toast.error("❌ Error de comunicación con el servidor.");
    } finally {
      setEstaProcesando(false);
    }
  };

  const handleAction = async (id, action, price = null) => {
    try {
      const url = `${API_URL}/scraping/${action}/${id}`;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
        }
      };
      
      if (action === 'approve') {
        options.body = JSON.stringify({ price: price });
      }

      const response = await fetch(url, options);
      if (response.ok) {
        toast.success(action === 'approve' ? "✅ Precio aprobado y actualizado en la base maestra" : "❌ Precio descartado");
        setPendingItems(prev => prev.filter(item => item.id !== id));
      } else {
        toast.error("Error al procesar la acción");
      }
    } catch (error) {
      toast.error("Error de red");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FiBox className="text-blue-600" />
            Cola de Aprobación del Bot (Scraping Inteligente)
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            El bot escanea los materiales en EPA y MercadoLibre. Revisa y aprueba las coincidencias para actualizar tu base de datos maestra.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPendingItems}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            ↻ Refrescar Cola
          </button>
          <button
            onClick={desencadenarVersionamientoDB}
            disabled={estaProcesando}
            className={`px-4 py-2 font-bold rounded-lg text-sm text-white transition-colors flex items-center gap-2 ${estaProcesando ? 'bg-amber-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {estaProcesando ? '⏳ Ejecutando...' : '🚀 Lanzar Tanda (25 Materiales)'}
          </button>
        </div>
      </div>

      <div className="p-0">
        {loadingPending ? (
          <div className="p-8 text-center text-slate-500">Cargando resultados...</div>
        ) : pendingItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-50">
            <p className="text-lg">No hay precios pendientes de aprobación</p>
            <p className="text-sm mt-2">Lanza una tanda de scraping para llenar esta cola.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingItems.map(item => (
              <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-slate-800">{item.material_name}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{item.source}</span>
                    </div>
                    <div className="text-sm text-slate-600 mb-1">Código: {item.material_code}</div>
                    <div className="text-sm text-slate-600 mb-1">Precio escaneado: <span className="font-semibold text-emerald-600">${item.scraped_price}</span></div>
                    <div className="text-sm text-slate-600">Fecha: {new Date(item.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const price = prompt(`Confirmar precio para ${item.material_name}:`, item.scraped_price);
                        if (price) handleAction(item.id, 'approve', parseFloat(price));
                      }}
                      className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors"
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                    >
                      ❌ Descartar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuloSincronizacionCostos;
