import React from 'react';
import { useUserCostos } from '../../context/UserCostosContext';
import CalculadoraFCAS from '../../components/tools/CalculadoraFCAS';
import toast from 'react-hot-toast';

export default function CalculadoraFCASPage() {
  const { costosConfig, updateCostosConfig } = useUserCostos();

  return (
    <div className="absolute inset-0 p-4 md:p-6 overflow-hidden flex flex-col bg-slate-50 print:static print:h-auto print:overflow-visible print:bg-white print:p-0">
      <CalculadoraFCAS
        isPage={true}
        initialSalarioBase={costosConfig?.fcasSalarioBase}
        initialBonoCestaticket={costosConfig?.fcasBonoCestaticket}
        initialMetodo={costosConfig?.fcasMetodo}
        onUseFCAS={async (fcasValue, configToSave) => {
          try {
            await updateCostosConfig({
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
