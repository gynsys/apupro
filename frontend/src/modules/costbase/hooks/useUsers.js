import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../../../services/api';

const apiFetch = async (endpoint) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    credentials: 'include' // Use httpOnly cookie
  });
  return response;
};

const apiPut = async (endpoint, body) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  return response;
};

const apiDelete = async (endpoint) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return response;
};

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

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/users/');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleUserStatus = useCallback(async (userId, currentStatus) => {
    try {
      const response = await apiPut(`/users/${userId}`, { is_active: !currentStatus });
      if (response.ok) {
        toast.success('Usuario actualizado');
        fetchUsers();
      } else {
        toast.error('Error al actualizar usuario');
      }
    } catch (error) {
      toast.error('Error al actualizar usuario');
    }
  }, [fetchUsers]);

  const updateUserPlan = useCallback(async (userId, planData) => {
    try {
      const response = await apiPut(`/users/${userId}`, planData);
      if (response.ok) {
        toast.success('Plan actualizado');
        fetchUsers();
        return true;
      } else {
        toast.error('Error al actualizar plan');
        return false;
      }
    } catch (error) {
      toast.error('Error al actualizar plan');
      return false;
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId) => {
    try {
      const response = await apiDelete(`/users/${userId}`);
      if (response.ok) {
        toast.success('Usuario eliminado exitosamente');
        fetchUsers();
      } else {
        toast.error('Error al eliminar usuario');
      }
    } catch (error) {
      toast.error('Error al eliminar usuario');
    }
  }, [fetchUsers]);

  const createDemoBudget = useCallback(async () => {
    try {
      const response = await apiPost('/users/demo-budget');
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
      } else {
        toast.error('Error al crear presupuesto de ejemplo');
      }
    } catch (error) {
      toast.error('Error al crear presupuesto de ejemplo');
    }
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    toggleUserStatus,
    updateUserPlan,
    deleteUser,
    createDemoBudget,
  };
};
