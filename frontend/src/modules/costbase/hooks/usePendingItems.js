import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { apiFetch, apiPost } from '../../../lib/apiHelper';

export const usePendingItems = () => {
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadPendingItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/scraping/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingItems(data);
      }
    } catch (error) {
      console.error("Error loading pending items", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingItems();
  }, [loadPendingItems]);

  const triggerVersioning = useCallback(async () => {
    setProcessing(true);
    try {
      const response = await apiPost('/scraping/versionar-precios-db', { limit: 25 });
      const data = await response.json();
      if (data.status === 'processing') {
        toast.success("⚡ ¡El bot ha iniciado el escaneo de 25 materiales! Los resultados apareceran aqui al recargar la pagina mas tarde.", {
          duration: 5000,
          position: 'top-center'
        });
      }
    } catch (error) {
      toast.error("❌ Error de comunicacion con el servidor.");
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleAction = useCallback(async (id, action, price = null) => {
    try {
      const body = action === 'approve' && price !== null ? { price } : undefined;
      const response = await apiPost(`/scraping/${action}/${id}`, body);
      if (response.ok) {
        toast.success(action === 'approve' ? "✅ Precio aprobado y actualizado en la base maestra" : "❌ Precio descartado");
        setPendingItems(prev => prev.filter(item => item.id !== id));
      } else {
        toast.error("Error al procesar la accion");
      }
    } catch (error) {
      toast.error("Error de red");
    }
  }, []);

  return {
    pendingItems,
    loading,
    processing,
    loadPendingItems,
    triggerVersioning,
    handleAction,
  };
};
