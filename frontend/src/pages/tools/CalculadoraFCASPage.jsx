import React, { useContext, useEffect, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useUserCostos } from '../../context/UserCostosContext';
import CalculadoraFCAS from '../../components/tools/CalculadoraFCAS';
import toast from 'react-hot-toast';

export default function CalculadoraFCASPage() {
  const { user } = useContext(AuthContext) || {};
  const { costosConfig, updateCostosConfig } = useUserCostos();

  // Clave de almacenamiento local aislada por usuario
  const userStorageKey = useMemo(() => {
    return `fcas_profiles_${user?.id || 'guest'}`;
  }, [user?.id]);

  // Obtener perfiles combinando backend y fallback local
  const effectiveProfiles = useMemo(() => {
    const backendProfiles = costosConfig?.fcasSavedProfiles;
    if (backendProfiles && Object.keys(backendProfiles).length > 0) {
      return backendProfiles;
    }
    // Fallback de localStorage si backend aún no tiene perfiles
    try {
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignorar error de parsing local
    }
    return backendProfiles || {};
  }, [costosConfig?.fcasSavedProfiles, userStorageKey]);

  // Sincronizar perfiles del backend hacia localStorage para disponibilidad offline
  useEffect(() => {
    if (costosConfig?.fcasSavedProfiles && Object.keys(costosConfig.fcasSavedProfiles).length > 0) {
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(costosConfig.fcasSavedProfiles));
      } catch {
        // Ignorar límites de almacenamiento
      }
    }
  }, [costosConfig?.fcasSavedProfiles, userStorageKey]);

  const handleSaveProfile = async (name, configToSave) => {
    try {
      const currentProfiles = effectiveProfiles || {};
      const updatedProfiles = {
        ...currentProfiles,
        [name]: configToSave,
      };

      // Guardado local inmediato
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(updatedProfiles));
      } catch {
        // Continuar si localStorage falla
      }

      // Guardado en backend persistente en base de datos
      await updateCostosConfig({
        ...costosConfig,
        fcasSavedProfiles: updatedProfiles,
      });

      toast.success(`Cálculo "${name}" guardado exitosamente`);
    } catch (error) {
      toast.error('Error al guardar el cálculo');
    }
  };

  const handleDeleteProfile = async (name) => {
    try {
      const currentProfiles = { ...(effectiveProfiles || {}) };
      delete currentProfiles[name];

      // Actualizar localStorage
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(currentProfiles));
      } catch {
        // Continuar si localStorage falla
      }

      // Actualizar backend
      await updateCostosConfig({
        ...costosConfig,
        fcasSavedProfiles: currentProfiles,
      });

      toast.success(`Cálculo "${name}" eliminado`);
    } catch (error) {
      toast.error('Error al eliminar el cálculo');
    }
  };

  const handleUseFCAS = async (fcasValue, configToSave) => {
    try {
      const roundedFCAS = parseFloat(Number(fcasValue).toFixed(2));
      await updateCostosConfig({
        ...costosConfig,
        fcas: roundedFCAS,
        fcasSalarioBase: configToSave?.salarioBase,
        fcasBonoCestaticket: configToSave?.bonoCestaticket,
        fcasMetodo: configToSave?.metodo,
      });
      toast.success(`FCAS predeterminado establecido en ${roundedFCAS}% para futuros presupuestos`);
    } catch (error) {
      toast.error('Error al actualizar el FCAS predeterminado');
    }
  };

  return (
    <div className="absolute inset-0 p-4 md:p-6 overflow-hidden flex flex-col bg-slate-50 print:static print:h-auto print:overflow-visible print:bg-white print:p-0">
      <CalculadoraFCAS
        isPage={true}
        initialSalarioBase={costosConfig?.fcasSalarioBase}
        initialBonoCestaticket={costosConfig?.fcasBonoCestaticket}
        initialMetodo={costosConfig?.fcasMetodo}
        savedProfiles={effectiveProfiles}
        onSaveProfile={handleSaveProfile}
        onDeleteProfile={handleDeleteProfile}
        onUseFCAS={handleUseFCAS}
      />
    </div>
  );
}
