import React from 'react';
import { useUsers } from '../../hooks/useUsers';
import EditUserModal from '../modals/EditUserModal';

const UsuariosTab = () => {
  const { users, loading, toggleUserStatus, updateUserPlan, deleteUser, createDemoBudget } = useUsers();
  const [editingUser, setEditingUser] = React.useState(null);

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleSaveUserPlan = async (planData) => {
    const success = await updateUserPlan(editingUser.id, planData);
    if (success) {
      setEditingUser(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800">Administración de Usuarios</h2>
        <p className="text-sm text-slate-600 mt-1">Gestiona planes, límites y estado de los usuarios</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold text-sm">
            <tr>
              <th className="p-4 border-b">Email</th>
              <th className="p-4 border-b">Plan</th>
              <th className="p-4 border-b">Estado</th>
              <th className="p-4 border-b">Límites</th>
              <th className="p-4 border-b">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-800">{user.email}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    {user.plan || 'free'}
                  </span>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => toggleUserStatus(user.id, user.is_active)}
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-4 text-sm text-slate-600">
                  {user.max_budgets} presup • {user.max_items_per_budget} partidas
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-semibold hover:bg-blue-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUserPlan}
        />
      )}
    </div>
  );
};

export default UsuariosTab;
