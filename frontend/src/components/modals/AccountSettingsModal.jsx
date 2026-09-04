import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, Mail, Shield, Sparkles, Key, Eye, EyeOff, Loader2, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { updateMyUserProfile } from '../../services/api';

export default function AccountSettingsModal({ 
  isOpen, 
  onClose, 
  user, 
  onRefreshUser,
  onOpenReportPayment 
}) {
  const [fullName, setFullName] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const planName = (() => {
    switch (user?.plan) {
      case 'pro': return 'Plan Profesional';
      case 'basic': return 'Plan Básico';
      case 'enterprise': return 'Plan Corporativo';
      default: return 'Plan Gratuito';
    }
  })();

  const aiMax = Number(user?.max_ai_apus || 0);
  const aiUsed = Number(user?.ai_apus_generated || 0);
  const aiPercent = aiMax > 0 ? Math.min(100, Math.round((aiUsed / aiMax) * 100)) : 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    // Validaciones
    if (!fullName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    if (showPasswordSection && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword) {
        toast.error('Debes ingresar tu contraseña actual para cambiarla');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        toast.error('La nueva contraseña debe tener al menos 6 caracteres');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('La confirmación de la contraseña no coincide');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        full_name: fullName.trim()
      };

      if (showPasswordSection && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      await updateMyUserProfile(payload);
      toast.success('Perfil actualizado correctamente');

      if (onRefreshUser) {
        await onRefreshUser();
      }

      // Limpiar campos de contraseña
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);

      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-amber-50/95 border-2 border-[#B5DCB0] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[#B5DCB0] flex items-center justify-between bg-amber-100/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shadow-sm">
              <User size={20} />
            </div>
            <div>
              <h2 className="m-0 text-lg font-bold text-amber-900 leading-tight">
                Configuración de la Cuenta
              </h2>
              <p className="m-0 text-xs text-amber-700/80">
                Datos de usuario y capacidad del plan
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-amber-700 hover:text-amber-900 rounded-xl hover:bg-white/40 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* DATOS DE USUARIO */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <Shield size={14} className="text-sky-600" /> Información Personal
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-amber-900">
                Nombre de Usuario
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ej. Ing. Juan Pérez"
                className="px-3 py-2 border border-sky-200 rounded-xl text-sm text-sky-900 bg-sky-50/70 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-amber-900">
                Correo Electrónico
              </label>
              <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white/70 text-slate-700 text-sm">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <span className="flex-1 font-mono text-xs text-slate-700 truncate">{user?.email || 'N/A'}</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                  Verificado
                </span>
              </div>
            </div>
          </div>

          {/* PLAN Y MÉTRICA IA */}
          <div className="flex flex-col gap-3 pt-2 border-t border-amber-200/70">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" /> Plan y Consumo
              </h3>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                {planName}
              </span>
            </div>

            {/* Métrica Única Solicitada: Generador APU con IA */}
            <div className="bg-white/80 border border-sky-200/90 rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-sky-600" /> Generador APU con Inteligencia Artificial
                </span>
                <span className="font-bold text-slate-900">
                  {aiUsed} / {aiMax} APUs
                </span>
              </div>

              {/* Barra de Progreso */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    aiPercent >= 100 
                      ? 'bg-red-500' 
                      : aiPercent >= 80 
                        ? 'bg-amber-500' 
                        : 'bg-gradient-to-r from-sky-500 to-indigo-600'
                  }`}
                  style={{ width: `${aiPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Consumo mensual de tu plan</span>
                <span>{aiPercent}% utilizado</span>
              </div>
            </div>

            {/* Botón Reportar Pago / Mejorar Plan */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenReportPayment) onOpenReportPayment();
                }}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 hover:underline"
              >
                <CreditCard size={13} /> Reportar Pago o Renovar Suscripción
              </button>
            </div>
          </div>

          {/* CAMBIAR CONTRASEÑA (ACORDEÓN) */}
          <div className="flex flex-col gap-2 pt-2 border-t border-amber-200/70">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center justify-between w-full py-1 text-xs font-bold text-amber-900 hover:text-sky-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Key size={14} className="text-amber-700" /> Seguridad (Cambiar Contraseña)
              </span>
              {showPasswordSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showPasswordSection && (
              <div className="flex flex-col gap-3 p-3 bg-white/60 rounded-xl border border-amber-200 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-amber-900">
                    Contraseña Actual
                  </label>
                  <div className="relative">
                    <input 
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Tu contraseña actual"
                      className="w-full px-3 py-1.5 pr-9 border border-sky-200 rounded-lg text-xs text-sky-900 bg-white outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-medium text-amber-900">
                      Nueva Contraseña
                    </label>
                    <div className="relative">
                      <input 
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full px-3 py-1.5 pr-9 border border-sky-200 rounded-lg text-xs text-sky-900 bg-white outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-medium text-amber-900">
                      Confirmar Nueva Contraseña
                    </label>
                    <input 
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="w-full px-3 py-1.5 border border-sky-200 rounded-lg text-xs text-sky-900 bg-white outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BOTONES ACCIÓN */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-200/70">
            <button 
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-800 text-sm font-semibold px-5 py-2 cursor-pointer rounded-xl hover:bg-white/40 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px] disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
