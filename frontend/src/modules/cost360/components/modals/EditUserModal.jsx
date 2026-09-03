import React, { useState, useEffect } from 'react';

const EditUserModal = ({ user, onClose, onSave }) => {
  const [form, setForm] = useState({
    plan: 'free',
    max_budgets: 0,
    max_items_per_budget: 0,
    has_ai_access: false,
  });

  useEffect(() => {
    if (user) {
      setForm({
        plan: user.plan || 'free',
        max_budgets: user.max_budgets || 0,
        max_items_per_budget: user.max_items_per_budget || 0,
        has_ai_access: user.has_ai_access || false,
      });
    }
  }, [user]);

  const handlePlanChange = (e) => {
    const newPlan = e.target.value;
    const newForm = { ...form, plan: newPlan };
    
    // Auto-completar límites sugeridos por plan
    if (newPlan === 'free' || newPlan === 'demo') {
      newForm.max_budgets = 1;
      newForm.max_items_per_budget = 2;
    } else if (newPlan === 'Básico') {
      newForm.max_budgets = 1000; // ilimitado (virtualmente)
      newForm.max_items_per_budget = 1000;
      newForm.has_ai_access = true;
    } else if (newPlan === 'Profesional') {
      newForm.max_budgets = 2000;
      newForm.max_items_per_budget = 2000;
      newForm.has_ai_access = true;
    } else if (newPlan === 'Experto') {
      newForm.max_budgets = 5000;
      newForm.max_items_per_budget = 5000;
      newForm.has_ai_access = true;
    }
    
    setForm(newForm);
  };

  const handleSave = () => {
    onSave({
      plan: form.plan,
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Plan del Usuario</label>
              <select
                value={form.plan}
                onChange={handlePlanChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="free">Demo / Free</option>
                <option value="Básico">Básico</option>
                <option value="Profesional">Profesional</option>
                <option value="Experto">Experto</option>
                <option value="enterprise">Enterprise (Legacy)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Limite Presupuestos</label>
                <input
                  type="number"
                  value={form.max_budgets}
                  onChange={(e) => setForm({ ...form, max_budgets: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Limite Partidas</label>
                <input
                  type="number"
                  value={form.max_items_per_budget}
                  onChange={(e) => setForm({ ...form, max_items_per_budget: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="ai-access"
                checked={form.has_ai_access}
                onChange={(e) => setForm({ ...form, has_ai_access: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="ai-access" className="text-sm font-medium text-slate-700">Permitir IA (Generación de Partidas)</label>
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
