import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, Download, User, Calendar, DollarSign, 
  Layers, ArrowLeft, Loader2, CheckCircle2, AlertCircle, LogIn 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import LoginModal from '../../components/landing/LoginModal';

export default function SharedBudgetPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (token) {
      loadSharedPreview();
    }
  }, [token]);

  const loadSharedPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/shared/${token}`, {
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else if (res.status === 404) {
        setError('El enlace de este presupuesto ha caducado o ha sido revocado por su creador.');
      } else {
        setError('Error al consultar el presupuesto compartido.');
      }
    } catch (err) {
      console.error('Error fetching shared budget:', err);
      setError('Error de conexión al obtener el presupuesto.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!token) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setImporting(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/shared/${token}/import`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('¡Presupuesto importado exitosamente a tu cuenta!');
        if (data.budget_id) {
          navigate(`/budgets/${data.budget_id}`);
        } else {
          navigate('/budgets');
        }
      } else {
        toast.error(data.detail || 'No se pudo importar el presupuesto');
      }
    } catch (err) {
      console.error('Error importing shared budget:', err);
      toast.error('Error al procesar la importación del presupuesto');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto">
        
        {/* Botón regresar */}
        <button
          onClick={() => navigate('/budgets')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={18} />
          Volver a Mis Presupuestos
        </button>

        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-slate-200 shadow-xl flex flex-col items-center justify-center gap-4">
            <Loader2 size={36} className="text-amber-500 animate-spin" />
            <p className="text-slate-600 font-medium">Cargando presupuesto compartido...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center border-2 border-red-200 shadow-xl space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Enlace No Disponible</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => navigate('/budgets')}
              className="mt-2 inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-md"
            >
              Ir a Gestor de Presupuestos
            </button>
          </div>
        ) : preview ? (
          /* Tarjeta principal con la paleta ámbar */
          <div className="bg-amber-50/95 border-2 border-amber-400 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Header del Presupuesto Compartido con color #B5DCB0 */}
            <div className="px-8 py-6 flex items-center justify-between shadow-sm" style={{ backgroundColor: '#B5DCB0' }}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/40 text-[#143d1a] rounded-2xl shadow-sm">
                  <FileText size={28} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1e5229] block">
                    Presupuesto Compartido
                  </span>
                  <h1 className="text-2xl font-bold text-[#143d1a] tracking-tight mt-0.5">
                    {preview.name}
                  </h1>
                </div>
              </div>
            </div>

            {/* Contenido / Métricas en tonos ámbar */}
            <div className="p-8 space-y-6">
              
              {/* Información del emisor */}
              <div className="flex items-center gap-3 bg-white/90 border border-amber-200 rounded-2xl p-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base">
                  <User size={20} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Compartido por</span>
                  <p className="text-sm font-bold text-amber-950">{preview.owner_name}</p>
                </div>
                {preview.client_name && (
                  <div className="ml-auto text-right">
                    <span className="text-xs text-slate-400 block font-medium">Cliente</span>
                    <p className="text-sm font-semibold text-slate-700">{preview.client_name}</p>
                  </div>
                )}
              </div>

              {/* Grid de métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-white/90 border border-amber-200 rounded-2xl p-4 text-center shadow-sm">
                  <div className="flex items-center justify-center text-amber-700 mb-1">
                    <Layers size={18} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium block">Total Partidas</span>
                  <span className="text-lg font-bold text-slate-800">{preview.items_count}</span>
                </div>

                <div className="bg-white/90 border border-amber-200 rounded-2xl p-4 text-center shadow-sm">
                  <div className="flex items-center justify-center text-amber-700 mb-1">
                    <DollarSign size={18} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium block">Monto Estimado</span>
                  <span className="text-lg font-bold text-amber-900">
                    {preview.currency === 'USD' ? '$' : 'Bs.'}{' '}
                    {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(preview.total_amount)}
                  </span>
                </div>

                <div className="bg-white/90 border border-amber-200 rounded-2xl p-4 text-center shadow-sm col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-center text-amber-700 mb-1">
                    <Calendar size={18} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium block">Fecha Original</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {preview.created_at ? new Date(preview.created_at).toLocaleDateString('es-VE') : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Nota de clonación */}
              <div className="bg-amber-100/70 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-950">Clonación 100% en la Nube</p>
                  <p className="text-amber-900/80 mt-0.5 leading-relaxed">
                    Al importar, se creará un nuevo proyecto en tu lista de presupuestos con todas sus partidas, análisis de precios unitarios (materiales, equipos y mano de obra) para que puedas trabajar en él de manera independiente.
                  </p>
                </div>
              </div>

              {/* Botón de importación principal con color #B5DCB0 */}
              <button
                onClick={handleImport}
                disabled={importing}
                style={{ backgroundColor: '#B5DCB0' }}
                className="w-full py-3.5 px-6 text-[#143d1a] hover:brightness-95 text-base font-bold rounded-2xl shadow-xl shadow-[#B5DCB0]/30 hover:shadow-2xl hover:shadow-[#B5DCB0]/40 border border-[#9ecc98] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Importando y clonando presupuesto...</span>
                  </>
                ) : !isAuthenticated ? (
                  <>
                    <LogIn size={20} />
                    <span>Iniciar Sesión para Importar</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Importar a Mis Presupuestos</span>
                  </>
                )}
              </button>

            </div>
          </div>
        ) : null}

      </div>

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}
