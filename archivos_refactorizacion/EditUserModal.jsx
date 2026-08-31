import React, { useState, useEffect } from 'react';

const EditUserModal = ({ user, onClose, onSave }) => {
  const [form, setForm] = useState({
    max_budgets: 0,
    max_items_per_budget: 0,
    has_ai_access: false,
  });

  useEffect(() => {
    if (user) {
      setForm({
        max_budgets: user.max_budgets || 0,
        max_items_per_budget: user.max_items_per_budget || 0,
        has_ai_access: user.has_ai_access || false,
      });
    }
  }, [user]);

  const handleSave = () => {
    onSave({
      max_budgets: form.max_budgets,
      max_items_per_budget: form.max_items_per_budget,
      has_ai_access: form.has_ai_access,
    });
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Editar Usuario</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limite de Presupuestos</label>
              <input
                type="number"
                value={form.max_budgets}
                onChange={(e) => setForm({ ...form, max_budgets: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limite de Partidas</label>
              <input
                type="number"
                value={form.max_items_per_budget}
                onChange={(e) => setForm({ ...form, max_items_per_budget: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ai-access"
                checked={form.has_ai_access}
                onChange={(e) => setForm({ ...form, has_ai_access: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="ai-access" className="text-sm text-slate-700">Acceso a IA</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;