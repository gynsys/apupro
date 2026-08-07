import { API_URL } from './api';

export const cost360DatabaseService = {
  // Obtener todas las bases de datos
  getAll: async () => {
    const response = await fetch(`${API_URL}/cost360/databases`);
    if (!response.ok) throw new Error('Error al cargar bases de datos');
    return response.json();
  },

  // Obtener una base de datos por ID
  getById: async (databaseId) => {
    const response = await fetch(`${API_URL}/cost360/databases/${databaseId}`);
    if (!response.ok) throw new Error('Error al cargar base de datos');
    return response.json();
  },

  // Crear una nueva base de datos duplicando con índices de inflación
  create: async (data) => {
    const response = await fetch(`${API_URL}/cost360/databases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al crear base de datos');
    return response.json();
  },

  // Actualizar metadatos de una base de datos
  update: async (databaseId, data) => {
    const response = await fetch(`${API_URL}/cost360/databases/${databaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al actualizar base de datos');
    return response.json();
  },

  // Eliminar una base de datos
  delete: async (databaseId) => {
    const response = await fetch(`${API_URL}/cost360/databases/${databaseId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar base de datos');
    return response.json();
  }
};
