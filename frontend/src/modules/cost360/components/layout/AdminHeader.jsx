import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDatabase } from 'react-icons/fi';
import GlassCard from '../../../../components/shared/GlassCard';
import { apiPost } from '../../../../lib/apiHelper';
import toast from 'react-hot-toast';

const updateRAGBrain = async () => {
  const response = await apiPost('/admin/update-rag-brain', {});
  if (!response.ok) throw new Error('Failed to update RAG brain');
  return response.json();
};

const AdminHeader = () => {
  const navigate = useNavigate();

  const handleUpdateRAGBrain = async () => {
    const confirm = window.confirm("¿Estas seguro de que deseas actualizar el Cerebro RAG? Este proceso toma de 5 a 15 minutos en segundo plano y consumira CPU del servidor.");
    if (!confirm) return;

    const toastId = toast.loading('Iniciando actualizacion del Cerebro IA...');
    try {
      await updateRAGBrain();
      toast.success('El Cerebro RAG se esta actualizando en el servidor. Estara listo en unos minutos.', { id: toastId, duration: 8000 });
    } catch (err) {
      toast.error('Error al iniciar la actualizacion del Cerebro RAG', { id: toastId });
    }
  };

  return (
    <GlassCard strength="strong" className="rounded-2xl relative z-10">
      <div
        className="px-6 py-5 flex items-center gap-4"
        style={{
          background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(99,102,241,0.04) 100%)',
          borderBottom: '1px solid rgba(148,163,255,0.2)',
        }}
      >
        <div
          className="p-2.5 rounded-xl shadow-sm"
          style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff' }}
        >
          <FiDatabase size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">
            Explora las Bases de Datos, Insumos, Materiales o Personal
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleUpdateRAGBrain}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <FiDatabase className="w-4 h-4" />
            Actualizar Cerebro RAG
          </button>
          <button
            onClick={() => navigate('/cost360/market-admin')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Automatizacion IA
          </button>
        </div>
      </div>
    </GlassCard>
  );
};

export default AdminHeader;
