import React from 'react';
import { useUserCostos } from '../../context/UserCostosContext';
import CalculadoraFCAS from '../../components/tools/CalculadoraFCAS';
import toast from 'react-hot-toast';

export default function CalculadoraFCASPage() {
  const { updateCostosConfig } = useUserCostos();

  return (
    <div className="absolute inset-0 p-4 md:p-6 overflow-hidden flex flex-col bg-slate-50 print:static print:h-auto print:overflow-visible print:bg-white print:p-0">
      <CalculadoraFCAS
        isPage={true}
        onUseFCAS={async (fcasValue) => {
          try {
            await updateCostosConfig({ fcas: fcasValue });
            toast.success('FCAS actualizado en la configuración global');
          } catch (error) {
            toast.error('Error al actualizar el FCAS');
          }
        }}
      />
    </div>
  );
}
