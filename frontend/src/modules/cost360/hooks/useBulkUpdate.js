import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../../../services/api';

const apiPost = async (endpoint, body) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
    },
    body: JSON.stringify(body)
  });
  return response;
};

const apiPostFormData = async (endpoint, formData) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
    },
    body: formData
  });
  return response;
};

export const useBulkUpdate = () => {
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [descFile, setDescFile] = useState(null);

  const parsePriceLines = useCallback((text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const updates = [];

    for (const line of lines) {
      const match = line.match(/([A-Z]+\d+)[:\t]\s*\$?([\d.,]+)/);
      if (match) {
        const codigo = match[1];
        let precioStr = match[2];
        if (precioStr.includes('.') && precioStr.includes(',')) {
          precioStr = precioStr.replace(/\./g, '').replace(',', '.');
        } else {
          precioStr = precioStr.replace(/,/g, '');
        }
        const precio = parseFloat(precioStr);
        if (!isNaN(precio)) {
          updates.push({ codigo, precio });
        }
      }
    }
    return updates;
  }, []);

  const submitBulkPrices = useCallback(async (onSuccess) => {
    const updates = parsePriceLines(priceText);
    if (updates.length === 0) {
      toast.error('No se encontraron precios validos para actualizar');
      return;
    }

    try {
      const response = await apiPost('/cost360/materials/bulk-update', { updates });
      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.updated || updates.length} precios actualizados correctamente`, {
          duration: 3000,
          position: 'top-center'
        });
        setShowPriceModal(false);
        setPriceText('');
        if (onSuccess) setTimeout(onSuccess, 1000);
      } else {
        toast.error(`Error al actualizar precios: ${response.status}`);
      }
    } catch (err) {
      toast.error('Error de conexion al servidor');
    }
  }, [priceText, parsePriceLines]);

  const submitBulkDescriptions = useCallback(async (onSuccess) => {
    if (!descFile) {
      toast.error('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', descFile);
      const response = await apiPostFormData('/cost360/materials/bulk-update-descriptions', formData);
      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.updated || 0} descripciones actualizadas correctamente`, {
          duration: 3000,
          position: 'top-center'
        });
        setShowDescModal(false);
        setDescFile(null);
        if (onSuccess) setTimeout(onSuccess, 1000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || `Error al actualizar descripciones: ${response.status}`);
      }
    } catch (err) {
      toast.error('Error de conexion al servidor');
    }
  }, [descFile]);

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
