import { API_URL } from './api';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json'
});

export const alliesService = {
  // Obtener lista pública de aliados para la landing page (Home)
  getAllies: async () => {
    const response = await fetch(`${API_URL}/allies`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener aliados estratégicos');
    }
    return response.json();
  },

  // Obtener lista completa de aliados para super admin
  getAdminAllies: async () => {
    const response = await fetch(`${API_URL}/allies/admin`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener aliados en administración');
    }
    return response.json();
  },

  // Crear un nuevo aliado
  createAlly: async (data) => {
    const response = await fetch(`${API_URL}/allies`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al crear aliado estratégico');
    }
    return response.json();
  },

  // Actualizar un aliado existente
  updateAlly: async (id, data) => {
    const response = await fetch(`${API_URL}/allies/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar aliado estratégico');
    }
    return response.json();
  },

  // Eliminar un aliado
  deleteAlly: async (id) => {
    const response = await fetch(`${API_URL}/allies/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al eliminar aliado estratégico');
    }
    return response.json();
  },

  // Subir archivo de logo
  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/allies/upload-logo`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al subir logo');
    }
    return response.json();
  }
};

export default alliesService;
