import React from 'react';
import { useUserCostos } from '../../context/UserCostosContext';
import CalculadoraFCAS from '../../components/tools/CalculadoraFCAS';
import toast from 'react-hot-toast';

export default function CalculadoraFCASPage() {
  const { costosConfig, updateCostosConfig } = useUserCostos();

  const handleSaveProfile = async (name, configToSave) => {
    try {
      const currentProfiles = costosConfig?.fcasSavedProfiles || {};
      const updatedProfiles = {
        ...currentProfiles,
        [name]: configToSave
      };
      
      await updateCostosConfig({
        ...costosConfig,
        fcasSavedProfiles: updatedProfiles
      });
      toast.success(`Perfil '${name}' guardado exitosamente`);
    } catch (error) {
      toast.error('Error al guardar el perfil');
    }
  };

  return (
    <div className="absolute inset-0 p-4 md:p-6 overflow-hidden flex flex-col bg-slate-50 print:static print:h-auto print:overflow-visible print:bg-white print:p-0">
      <CalculadoraFCAS
        isPage={true}
        initialSalarioBase={costosConfig?.fcasSalarioBase}
        initialBonoCestaticket={costosConfig?.fcasBonoCestaticket}
        initialMetodo={costosConfig?.fcasMetodo}
        savedProfiles={costosConfig?.fcasSavedProfiles || {}}
        onSaveProfile={handleSaveProfile}
        onUseFCAS={async (fcasValue, configToSave) => {
          try {
            await updateCostosConfig({
              ...costosConfig,
              fcas: fcasValue,
              fcasSalarioBase: configToSave?.salarioBase,
              fcasBonoCestaticket: configToSave?.bonoCestaticket,
              fcasMetodo: configToSave?.metodo,
            });
            toast.success('FCAS guardado en la configuración de usuario');
          } catch (error) {
            toast.error('Error al actualizar el FCAS');
          }
        }}
      />
    </div>
  );
}
