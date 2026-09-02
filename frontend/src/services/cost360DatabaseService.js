import { API_URL } from './api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('arko_admin_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const cost360DatabaseService = {
  // Obtener todas las bases de datos
  getAll: async () => {
    const token = localStorage.getItem('arko_admin_token') || localStorage.getItem('token');
    if (!token) return { databases: [] }; // No intentar fetch si no hay sesion
    
    const response = await fetch(`${API_URL}/cost360/databases`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al cargar bases de datos');
    return response.json();
  },

  // Obtener una base de datos por ID
  getById: async (databaseId) => {
    const response = await fetch(`${API_URL}/cost360/databases/${databaseId}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al cargar base de datos');
    return response.json();
  },

  // Crear una nueva base de datos duplicando con índices de inflación
  create: async (data) => {
    const response = await fetch(`${API_URL}/cost360/databases`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al crear base de datos');
    return response.json();
  },

  // Actualizar metadatos de una base de datos
  update: async (databaseId, data) => {
    const response = await fetch(`${API_URL}/cost360/databases/${databaseId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al actualizar base de datos');
    return response.json();
  },

  // Eliminar una base de datos
  delete: async (databaseId) => {
    const response = await fetch(`${API_URL}/cost360/databases/${databaseId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al eliminar base de datos');
    return response.json();
  }
};
