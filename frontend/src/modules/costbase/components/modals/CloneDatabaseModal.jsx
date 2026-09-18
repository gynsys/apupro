import React, { useState, useEffect } from 'react';
import { X, Copy, Loader2, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cost360DatabaseService } from '../../../../services/cost360DatabaseService';

export default function CloneDatabaseModal({
  isOpen,
  onClose,
  onSuccess,
  sourceDatabaseId = 'master',
  databases = []
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSource, setSelectedSource] = useState(sourceDatabaseId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const defaultSuggested = `BD ${today.getDate()} ${monthNames[today.getMonth()]}`;
      setName(defaultSuggested);
      setDescription(`Clonada a partir de ${sourceDatabaseId === 'master' ? 'Base Maestra' : sourceDatabaseId}`);
      setSelectedSource(sourceDatabaseId || 'master');
    }
  }, [isOpen, sourceDatabaseId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre de la nueva base de datos es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        source_database_id: selectedSource || 'master',
        material_inflation: 0,
        labor_inflation: 0,
        equipment_inflation: 0
      };

      const res = await cost360DatabaseService.create(payload);
      const newDb = res.database || res;
      toast.success(`Base de datos "${name.trim()}" clonada exitosamente en modo Borrador.`);
      if (onSuccess) {
        onSuccess(newDb);
      }
      onClose();
    } catch (error) {
      console.error('Error al clonar base de datos:', error);
      toast.error(error.message || 'Error al clonar base de datos');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Copy size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Clonar Base de Datos
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Crea una copia aislada en PostgreSQL para actualizar precios sin alterar la base activa
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre de la nueva base de datos *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. BD 30 Septiembre"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">
              Se creará inicialmente en estado <strong>Borrador</strong> para que puedas editarla y luego publicarla.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Base de Datos Origen
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="master">Base Maestra Oficial</option>
              {databases
                .filter(db => db.id !== 'master')
                .map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name} {db.is_published ? '(Publicada)' : '(Borrador)'}
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Se duplicarán todos los materiales, partidas, insumos líderes y factores de dispersión.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Descripción o Notas (Opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas de la versión, motivos del reajuste..."
              rows={2}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <span>
              Al completarse la clonación, la nueva base se seleccionará automáticamente en esta pestaña para que puedas ajustar los precios de insumos líderes y publicar los cambios.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Clonando esquema...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Clonar y Empezar a Editar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
