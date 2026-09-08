import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../../../services/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('arko_admin_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const apiPost = async (endpoint, body) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  return response;
};

const apiPostFormData = async (endpoint, formData) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: formData
  });
  return response;
};

export const cleanPrice = (valStr) => {
  if (valStr === null || valStr === undefined) return NaN;
  if (typeof valStr === 'number') return valStr;

  let str = String(valStr).trim().replace(/["'\s]|(?:USD|Bs\.?|VEF|\$)/gi, '');
  if (!str) return NaN;

  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
};

export const parsePriceLines = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const updates = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let codigo = null;
    let precio = NaN;

    // Formato 1: Separado por tabuladores (Copiado directo de columnas de Excel)
    // Ejemplos: "ACA001\t59,18" o "ACA001\tAcero 3/8\t59,18" o "ACA001\tAcero\tkg\t59,18"
    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        codigo = parts[0].replace(/^["']|["']$/g, '').trim();
        const lastPartPrice = cleanPrice(parts[parts.length - 1]);
        if (!isNaN(lastPartPrice)) {
          precio = lastPartPrice;
        } else if (parts.length > 2) {
          const secondPartPrice = cleanPrice(parts[1]);
          if (!isNaN(secondPartPrice)) {
            precio = secondPartPrice;
          }
        }
      }
    }
    // Formato 2: Separado por punto y coma (CSV)
    // Ejemplos: "ACA001;59,18" o "ACA001;Acero;59,18"
    else if (line.includes(';')) {
      const parts = line.split(';').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        codigo = parts[0].replace(/^["']|["']$/g, '').trim();
        const lastPartPrice = cleanPrice(parts[parts.length - 1]);
        if (!isNaN(lastPartPrice)) {
          precio = lastPartPrice;
        } else if (parts.length > 2) {
          const secondPartPrice = cleanPrice(parts[1]);
          if (!isNaN(secondPartPrice)) {
            precio = secondPartPrice;
          }
        }
      }
    }

    // Formato 3: Expresión regular para dos puntos (:), signo igual (=), guión (-) o espacios
    // Ejemplos: "ACA001: 59,18", "ACA001 59,18", "1-1.1: $2.26 USD"
    if (!codigo || isNaN(precio)) {
      const match = line.match(/^([a-zA-Z0-9.\-_/]+)\s*[:=\-]?\s+(?:(?:USD|Bs\.?|VEF|\$)\s*)*([0-9]+(?:[.,][0-9]+)*)/i)
        || line.match(/^([a-zA-Z0-9.\-_/]+)\s*[:=]\s*(?:(?:USD|Bs\.?|VEF|\$)\s*)*([0-9]+(?:[.,][0-9]+)*)/i);
      if (match) {
        codigo = match[1].trim().replace(/^["']|["']$/g, '');
        precio = cleanPrice(match[2]);
      }
    }

    if (codigo && !isNaN(precio) && precio >= 0) {
      updates.push({ codigo, precio });
    }
  }

  return updates;
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
    parsePriceLines,
  };
};
