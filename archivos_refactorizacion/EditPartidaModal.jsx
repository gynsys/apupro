import React from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { updateMasterItem } from '../../services/adminService';

const EditPartidaModal = ({ item, onClose, onUpdated }) => {
  const [form, setForm] = React.useState({
    Descri: item?.Descri || '',
    UniPar: item?.UniPar || '',
    RenPar: item?.RenPar || 0,
  });

  React.useEffect(() => {
    if (item) {
      setForm({
        Descri: item.Descri || '',
        UniPar: item.UniPar || '',
        RenPar: item.RenPar || 0,
      });
    }
  }, [item]);

  const handleSave = async () => {
    try {
      await updateMasterItem(item.CodPar, {
        Descri: form.Descri,
        UniPar: form.UniPar,
        RenPar: form.RenPar,
      });
      toast.success("Partida actualizada");
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error("Error al actualizar");
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Editar Partida {item.CodPar}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Descripcion</label>
            <textarea
              value={form.Descri}
              onChange={(e) => setForm({ ...form, Descri: e.target.value })}
              className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unidad</label>
              <input
                type="text"
                value={form.UniPar}
                onChange={(e) => setForm({ ...form, UniPar: e.target.value })}
                className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Rendimiento</label>
              <input
                type="number"
                value={form.RenPar}
                onChange={(e) => setForm({ ...form, RenPar: parseFloat(e.target.value) || 0 })}
                className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <FiSave size={16} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPartidaModal;