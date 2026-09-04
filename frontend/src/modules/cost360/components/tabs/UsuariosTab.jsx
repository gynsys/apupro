import React from 'react';
import toast from 'react-hot-toast';
import { useUsers } from '../../hooks/useUsers';
import EditUserModal from '../modals/EditUserModal';

const UsuariosTab = () => {
  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };
  
  const getDaysElapsed = (startDate) => {
    return Math.max(0, Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24)));
  };
  
  const getTotalDays = (startDate, endDate) => {
    return Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
  };
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

  const confirmDeleteUser = (user) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div>
          <p className="font-bold text-slate-800 text-sm m-0">¿Eliminar usuario?</p>
          <p className="text-xs text-slate-600 mt-1 mb-0">
            Se eliminará a <strong>{user.email}</strong> y todos sus presupuestos asociados de forma permanente.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button 
            type="button"
            onClick={() => toast.dismiss(t.id)} 
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              deleteUser(user.id);
            }} 
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    ), { duration: Infinity });
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
              <th className="p-4 border-b text-center">APUs (IA)</th>
              <th className="p-4 border-b">Período Plan</th>
              <th className="p-4 border-b text-center">Días</th>
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
                <td className="p-4 text-center">
                  {user.plan !== 'free' ? (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.ai_apus_generated >= user.max_ai_apus ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {user.ai_apus_generated} / {user.max_ai_apus}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </td>
                <td className="p-4 text-xs text-slate-600 whitespace-nowrap">
                  {user.plan !== 'free' && user.plan_started_at && user.plan_expires_at ? (
                    <>
                      <div>{formatDate(user.plan_started_at)}</div>
                      <div className="text-slate-400">al {formatDate(user.plan_expires_at)}</div>
                    </>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {user.plan !== 'free' && user.plan_started_at && user.plan_expires_at ? (
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-700">
                        {getDaysElapsed(user.plan_started_at)} / {getTotalDays(user.plan_started_at, user.plan_expires_at)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
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
                      onClick={() => confirmDeleteUser(user)}
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
