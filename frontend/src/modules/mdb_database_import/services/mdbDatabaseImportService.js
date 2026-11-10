import { API_URL } from '../../../services/api';
import { checkLocalBridge, convertWithLocalBridge } from '../../mdb_import/services/mdbImportService';

const getAuthHeaders = () => {
  const token =
    localStorage.getItem('arko_admin_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Importa un archivo Maprex (.mdb, .accdb, .prx o .zip) para crear una nueva base de datos CostBase completa.
 * @param {File} file Archivo a importar
 * @param {string} name Nombre legible para la nueva base de datos
 * @param {string} description Descripción opcional
 * @param {boolean} isPublished Si la base debe estar publicada para todos
 * @returns {Promise<Object>} Resumen de creación con conteos de entidades
 */
export async function importMdbDatabase(file, name, description = '', isPublished = true) {
  if (!file) {
    throw new Error('Debes seleccionar un archivo Maprex.');
  }
  if (!name || !name.trim()) {
    throw new Error('El nombre de la base de datos es obligatorio.');
  }

  let uploadFile = file;
  const isZip = /\.zip$/i.test(file.name);

  // Si no es ZIP y el puente local está disponible, convertir primero
  if (!isZip) {
    try {
      const isBridgeOnline = await checkLocalBridge();
      if (isBridgeOnline) {
        const zipBlob = await convertWithLocalBridge(file);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        uploadFile = new File([zipBlob], `${baseName}_csv.zip`, {
          type: 'application/zip',
        });
      }
    } catch (bridgeErr) {
      // Si falla el puente local, intentamos la subida directa del archivo original al backend
      console.warn('Fallo en puente local, intentando subida directa:', bridgeErr);
    }
  }

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('name', name.trim());
  if (description) {
    formData.append('description', description.trim());
  }
  formData.append('is_published', isPublished ? 'true' : 'false');

  const response = await fetch(`${API_URL}/costbase/databases/import-mdb`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: formData,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_e) {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : 'Error al importar la base de datos desde Access/Maprex.'
    );
  }

  return data;
}

export { checkLocalBridge };
