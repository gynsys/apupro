import React, { useState } from 'react';
import { X, Calendar, Bell, Mail, CheckCircle2, Database, Loader2 } from 'lucide-react';

export default function PublishDatabaseModal({
  isOpen,
  onClose,
  onConfirm,
  databaseName = '',
  isSubmitting = false
}) {
  const [selectedScope, setSelectedScope] = useState('quincenal');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    onConfirm(selectedScope);
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
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Publicar Base de Datos
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {databaseName ? `"${databaseName}"` : 'Base de datos seleccionada'}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Ciclo de Actualización de Precios
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Selecciona el alcance para enviar la notificación en la campana y el correo a los usuarios con suscripción activa:
            </p>

            <div className="space-y-3">
              {/* Opción 1: Quincenal */}
              <div
                onClick={() => setSelectedScope('quincenal')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedScope === 'quincenal'
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={18} className={selectedScope === 'quincenal' ? 'text-emerald-600' : 'text-slate-500'} />
                    <span className="font-bold text-slate-800 text-sm">
                      Actualización Quincenal
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Profesional y Experto
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 ml-7">
                  Notifica a usuarios con planes de revisión quincenal. No incluye al plan Básico.
                </p>
                <div className="flex items-center gap-3 mt-3 ml-7 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1"><Bell size={13} className="text-emerald-600" /> Campana (Push)</span>
                  <span className="flex items-center gap-1"><Mail size={13} className="text-emerald-600" /> Correo Electrónico</span>
                </div>
              </div>

              {/* Opción 2: Mensual */}
              <div
                onClick={() => setSelectedScope('mensual')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedScope === 'mensual'
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={18} className={selectedScope === 'mensual' ? 'text-blue-600' : 'text-slate-500'} />
                    <span className="font-bold text-slate-800 text-sm">
                      Actualización Mensual
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Básico, Profesional y Experto
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 ml-7">
                  Notifica a todos los usuarios con suscripción activa (incluyendo los suscriptores del Plan Básico).
                </p>
                <div className="flex items-center gap-3 mt-3 ml-7 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1"><Bell size={13} className="text-blue-600" /> Campana (Push)</span>
                  <span className="flex items-center gap-1"><Mail size={13} className="text-blue-600" /> Correo Electrónico</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
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
              className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Publicando y notificando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Publicar y Notificar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
