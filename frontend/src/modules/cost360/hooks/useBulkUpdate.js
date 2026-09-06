import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../../../services/api';

const apiPost = async (endpoint, body) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  return response;
};

const apiPostFormData = async (endpoint, formData) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  return response;
};

export const useBulkUpdate = (resourceType = 'materials', databaseId = 'master') => {
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [descFile, setDescFile] = useState(null);

  const getResourceLabel = useCallback(() => {
    switch (resourceType) {
      case 'equipments':
        return 'equipos';
      case 'labors':
        return 'mano de obra';
      default:
        return 'materiales';
    }
  }, [resourceType]);

  const parsePriceLines = useCallback((text) => {
    if (!text || typeof text !== 'string') {
      return [];
    }
    const lines = text.split('\n').filter(line => line.trim());
    const updates = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const match = line.match(/^([a-zA-Z0-9.\-_/]+)[\s:;=\t]+(?:(?:USD|Bs\.?|VEF|\$)\s*)*([\d]+(?:[.,]\d+)*)/i);
      if (match) {
        const codigo = match[1].trim();
        let precioStr = match[2].trim();

        if (precioStr.includes('.') && precioStr.includes(',')) {
          const lastDot = precioStr.lastIndexOf('.');
          const lastComma = precioStr.lastIndexOf(',');
          if (lastComma > lastDot) {
            precioStr = precioStr.replace(/\./g, '').replace(',', '.');
          } else {
            precioStr = precioStr.replace(/,/g, '');
          }
        } else if (precioStr.includes(',')) {
          precioStr = precioStr.replace(',', '.');
        }

        const precio = parseFloat(precioStr);
        if (!isNaN(precio) && precio >= 0) {
          updates.push({ codigo, precio });
        }
      }
    }
    return updates;
  }, []);

  const submitBulkPrices = useCallback(async (onSuccess) => {
    try {
      const updates = parsePriceLines(priceText);
      if (updates.length === 0) {
        toast.error('No se encontraron precios válidos para actualizar');
        return;
      }

      const queryParams = databaseId ? `?database_id=${encodeURIComponent(databaseId)}` : '';
      const response = await apiPost(`/cost360/${resourceType}/bulk-update${queryParams}`, { updates });

      if (response.ok) {
        const result = await response.json();
        const updatedCount = result.updated || 0;
        const errorCount = (result.errors || []).length;
        const label = getResourceLabel();

        if (updatedCount > 0) {
          if (errorCount > 0) {
            toast.success(`${updatedCount} precios de ${label} actualizados (${errorCount} no encontrados)`, {
              duration: 4000,
              position: 'top-center'
            });
          } else {
            toast.success(`${updatedCount} precios de ${label} actualizados correctamente`, {
              duration: 3000,
              position: 'top-center'
            });
          }
          setShowPriceModal(false);
          setPriceText('');
          if (onSuccess) setTimeout(onSuccess, 500);
        } else {
          const sampleError = result.errors?.[0] || 'Ningún código coincidió';
          toast.error(`No se actualizaron precios: ${sampleError}`, { duration: 4000 });
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.detail || `Error al actualizar precios: ${response.status}`);
      }
    } catch (err) {
      console.error('Error en submitBulkPrices:', err);
      toast.error('Error de conexión al servidor');
    }
  }, [priceText, parsePriceLines, resourceType, databaseId, getResourceLabel]);

  const submitBulkDescriptions = useCallback(async (onSuccess) => {
    if (!descFile) {
      toast.error('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', descFile);
      const queryParams = databaseId ? `?database_id=${encodeURIComponent(databaseId)}` : '';
      const response = await apiPostFormData(`/cost360/${resourceType}/bulk-update-descriptions${queryParams}`, formData);

      if (response.ok) {
        const result = await response.json();
        const updatedCount = result.updated || 0;
        const errorCount = (result.errors || []).length;
        const label = getResourceLabel();

        if (updatedCount > 0) {
          if (errorCount > 0) {
            toast.success(`${updatedCount} descripciones de ${label} actualizadas (${errorCount} no encontradas)`, {
              duration: 4000,
              position: 'top-center'
            });
          } else {
            toast.success(`${updatedCount} descripciones de ${label} actualizadas correctamente`, {
              duration: 3000,
              position: 'top-center'
            });
          }
          setShowDescModal(false);
          setDescFile(null);
          if (onSuccess) setTimeout(onSuccess, 500);
        } else {
          const sampleError = result.errors?.[0] || 'Ninguna descripción coincidió con códigos existentes';
          toast.error(`No se actualizaron descripciones: ${sampleError}`, { duration: 4000 });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.detail || `Error al actualizar descripciones: ${response.status}`);
      }
    } catch (err) {
      console.error('Error en submitBulkDescriptions:', err);
      toast.error('Error de conexión al servidor');
    }
  }, [descFile, resourceType, databaseId, getResourceLabel]);

  return {
    showPriceModal,
    setShowPriceModal,
    showDescModal,
    setShowDescModal,
    priceText,
    setPriceText,
    descFile,
    setDescFile,
    submitBulkPrices,
    submitBulkDescriptions,
  };
};
