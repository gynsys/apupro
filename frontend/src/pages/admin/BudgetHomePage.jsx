import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder, FolderOpen, Plus, FileText, Trash2, Edit3, Copy, Search,
  Settings, Printer, FileSpreadsheet, CloudDownload, Upload,
  MoreVertical, Clock, DollarSign, Loader
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import BudgetSettingsModal from '../../components/modals/BudgetSettingsModal';
import CreateBudgetModal from '../../components/modals/CreateBudgetModal';
import BudgetPrintModal from '../../components/modals/BudgetPrintModal';
import BudgetPrintLayout from '../../components/print/BudgetPrintLayout';

export default function BudgetHomePage() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const fileInputRef = useRef(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [limitReachedReason, setLimitReachedReason] = useState('');
  const [newBudgetName, setNewBudgetName] = useState('');
  
  const [duplicatingBudget, setDuplicatingBudget] = useState(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [renamingBudget, setRenamingBudget] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [settingsBudget, setSettingsBudget] = useState(null);
  const [printBudget, setPrintBudget] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState(null);
  const [printBudgetData, setPrintBudgetData] = useState(null);
  
  const navigate = useNavigate();

  const [budgetTotals, setBudgetTotals] = useState({});

  useEffect(() => {
    loadBudgets();
  }, []);

  const calculatePU = (item, budget) => {
    if (item.is_chapter) return 0;
    const exRate = budget?.currency === 'BS' ? (budget?.exchange_rate || 1.0) : 1.0;
    
    const matCost = (item.materials || []).reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad || 0);
      const w = parseFloat(curr.desperdicio || 0);
      const p = parseFloat(curr.precio_unitario || 0) * exRate;
      return acc + (q * (1 + w / 100) * p);
    }, 0);
    const eqCost = (item.equipments || []).reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad || 0);
      const d = parseFloat(curr.depreciacion ?? 1.0);
      const p = parseFloat(curr.precio_unitario || 0) * exRate;
      return acc + (q * d * p);
    }, 0) / (item.performance || 1);
    const totJornal = (item.labors || []).reduce((acc, curr) => acc + (parseFloat(curr.cantidad || 0) * parseFloat(curr.jornal || 0) * exRate), 0);
    const totBono = (item.labors || []).reduce((acc, curr) => acc + (parseFloat(curr.cantidad || 0) * parseFloat(curr.bono || 0) * exRate), 0);
    const labCost = (totJornal + totBono + (totJornal * ((budget.fcas_percent ?? 417) / 100))) / (item.performance || 1);
    const subtotal = matCost + eqCost + labCost;
    const subtotalB = subtotal + (subtotal * ((budget.admin_percent ?? 15.0) / 100));
    return subtotalB + (subtotalB * ((budget.profit_percent ?? 10.0) / 100));
  };

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const data = await budgetService.getAll();
      setBudgets(data);
      
      data.forEach(async (b) => {
        try {
          const fullBudget = await budgetService.getById(b.id);
          const totalItems = fullBudget.items?.filter(i => !i.is_chapter).length || 0;
          const subtotalPresupuesto = fullBudget.items?.reduce((sum, item) => sum + (calculatePU(item, fullBudget) * item.quantity), 0) || 0;
          const ivaAmount = subtotalPresupuesto * ((fullBudget.iva_percent ?? 16.0) / 100);
          const totalGeneral = subtotalPresupuesto + ivaAmount;
          
          setBudgetTotals(prev => ({
            ...prev,
            [b.id]: { items: totalItems, amount: totalGeneral }
          }));
        } catch (e) {
          console.error("Error loading details for budget", b.id, e);
        }
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = budgets.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const confirmDelete = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-slate-800">¿Estás seguro de eliminar este presupuesto?</p>
        <div className="flex gap-2 justify-end">
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await budgetService.delete(id);
                toast.success('Presupuesto eliminado');
                loadBudgets();
              } catch (error) {
                toast.error('Error al eliminar');
              }
            }} 
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
          >
            Eliminar
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleExportToExcel = async (budget) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${apiUrl}/budgets/${budget.id}/export-excel`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al generar el Excel');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${budget.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Presupuesto exportado exitosamente');
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error('Error al exportar el presupuesto');
    }
  };

  const handleBackupExport = async (budget) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${apiUrl}/budgets/${budget.id}/backup`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al generar el backup');
      }

      const result = await response.json();

      // Convertir hex string a bytes y descargar
      const backupData = new Uint8Array(result.backup_data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const blob = new Blob([backupData], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${budget.name.replace(/[^a-z0-9]/gi, '_')}_backup.cb`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(result.message || 'Backup descargado exitosamente', { duration: 2000 });
    } catch (error) {
      console.error('Error al exportar backup:', error);
      toast.error('Error al exportar el backup');
    }
  };

  const handleCreateBudget = async () => {
    try {
      const newBudget = await budgetService.create({
        name: 'Nuevo Presupuesto',
        currency: 'USD',
        exchange_rate: 1.0
      });
      setIsModalOpen(false);
      navigate(`/budgets/${newBudget.id}`);
    } catch (error) {
      if (error.isLimitError) {
        setLimitReachedReason('budgets');
        setPaymentModalOpen(true);
      } else {
        toast.error(error.message || 'Error al crear presupuesto');
      }
    }
  };

  const handleBackupImport = async (file) => {
    try {
      setImportingBackup(true);
      const result = await budgetService.importBackup(file);
      toast.success(`Backup importado exitosamente: ${result.budget_name}`);
      loadBudgets(); // Recargar presupuestos
    } catch (error) {
      console.error('Error al importar backup:', error);
      toast.error(error.message || 'Error al importar el backup');
    } finally {
      setImportingBackup(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.cb')) {
        toast.error('Solo se permiten archivos .cb');
        return;
      }
      handleBackupImport(file);
    }
  };

  const handleDuplicate = async (e) => {
    e.preventDefault();
    if (!duplicateName.trim()) return;
    
    try {
      const newBudget = await budgetService.duplicateBudget(duplicatingBudget.id, duplicateName);
      toast.success('Presupuesto duplicado exitosamente');
      setDuplicatingBudget(null);
      setDuplicateName('');
      loadBudgets();
    } catch (error) {
      toast.error('Error al duplicar presupuesto');
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameName.trim()) return;
    try {
      await budgetService.update(renamingBudget.id, { name: renameName });
      toast.success('Nombre actualizado');
      setRenamingBudget(null);
      setRenameName('');
      loadBudgets();
    } catch (error) {
      toast.error('Error al actualizar nombre');
    }
  };

  const handleDelete = async () => {
    try {
      await budgetService.delete(deletingId);
      toast.success('Presupuesto eliminado');
      setDeletingId(null);
      loadBudgets();
    } catch (error) {
      toast.error('Error al eliminar presupuesto');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto flex-1">
        {/* HEADER SECTION */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                Gestor de Presupuestos
              </h1>
              <p className="text-slate-500 mt-1">Administra, crea y organiza todos tus proyectos</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 ease-out"
            >
              <Plus size={20} className="group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300" />
              Nuevo Presupuesto
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importingBackup}
              className="group flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={20} className="group-hover:scale-110 transition-transform duration-300" />
              {importingBackup ? 'Importando...' : 'Importar Backup'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cb"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm border-2 border-slate-300 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar presupuestos por nombre..."
            className="w-full bg-transparent outline-none py-2 pl-12 pr-4 text-slate-700 placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* BUDGETS GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-pulse">
          <Loader size={40} className="animate-spin mb-4" />
          <p>Cargando presupuestos...</p>
        </div>
      ) : filteredBudgets.length === 0 ? (
        <div className="text-center py-20 bg-white/50 rounded-3xl border border-slate-200/50">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No hay presupuestos</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            {searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'Comienza creando tu primer presupuesto para gestionar tus proyectos.'}
          </p>
          {!searchTerm && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-6 text-blue-600 font-medium hover:underline"
            >
              Crear mi primer presupuesto
            </button>
          )}
        </div>
      ) : (
        <div className="w-full" style={{ overflowY: 'auto' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredBudgets.map(budget => (
              <div
                key={budget.id}
                onClick={() => navigate(`/budgets/${budget.id}`)}
                className="tarjeta-presupuesto-ambar cursor-pointer group"
              >
                <div className="tarjeta-header flex justify-between items-center">
                  <h3 className="tarjeta-titulo-ambar truncate flex-1" title={budget.name}>
                    {budget.name}
                  </h3>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-amber-700 font-semibold">
                      Partidas: {budgetTotals[budget.id] ? budgetTotals[budget.id].items : '...'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-slate-400"/>
                      <span className="text-xs text-slate-500">
                        {new Date(budget.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {budgetTotals[budget.id] ? (
                      <span className="text-sm font-bold text-amber-900">
                        {budget.currency === 'USD' ? '$' : 'Bs.'} {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(budgetTotals[budget.id].amount)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700/50">Calculando...</span>
                    )}
                  </div>
                  <div className="acciones-rapidas">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDuplicatingBudget(budget); setDuplicateName(budget.name + ' (Copia)'); }}
                      className="btn-accion"
                      title="Duplicar"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSettingsBudget(budget); }}
                      className="btn-accion"
                      title="Configuración Global"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPrintBudget(budget); setPrintModalOpen(true); }}
                      className="btn-accion"
                      title="Imprimir"
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportToExcel(budget); }}
                      className="btn-accion"
                      title="Exportar a Excel"
                    >
                      <FileSpreadsheet size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBackupExport(budget); }}
                      className="btn-accion"
                      title="Exportar Backup"
                    >
                      <CloudDownload size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingBudget(budget); setRenameName(budget.name); }}
                      className="btn-accion"
                      title="Editar"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); confirmDelete(budget.id); }}
                      className="btn-accion"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW BUDGET MODAL */}
      {isModalOpen && (
        <CreateBudgetModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={(newBudget) => {
            setIsModalOpen(false);
            navigate(`/budgets/${newBudget.id}`);
          }}
        />
      )}
      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Eliminar Presupuesto</h2>
              <p className="text-sm text-slate-600 mb-6">¿Estás seguro que deseas eliminar este presupuesto de forma permanente?</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-red-500/30"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renamingBudget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="flex flex-col gap-2 px-6 pt-6 pb-2">
              <h2 className="m-0 text-xl font-bold text-amber-900">Renombrar Presupuesto</h2>
              <p className="text-[13px] text-amber-700 m-0">Ingresa el nuevo nombre para este proyecto.</p>
            </div>
            
            <form onSubmit={handleRename} className="px-6 pb-6 pt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Nombre del Proyecto</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                />
              </div>
              <div className="flex justify-end gap-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setRenamingBudget(null)}
                  className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DUPLICATE MODAL */}
      {duplicatingBudget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="flex flex-col gap-2 px-6 pt-6 pb-2">
              <h2 className="m-0 text-xl font-bold text-amber-900">Duplicar Presupuesto</h2>
              <p className="text-[13px] text-amber-700 m-0">Se creará una copia exacta con todas sus partidas y APUs.</p>
            </div>
            
            <form onSubmit={handleDuplicate} className="px-6 pb-6 pt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Nombre de la Copia</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                />
              </div>
              <div className="flex justify-end gap-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setDuplicatingBudget(null)}
                  className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
                >
                  Crear Copia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {settingsBudget && (
        <BudgetSettingsModal
          budget={settingsBudget}
          onClose={() => setSettingsBudget(null)}
          onSave={() => {
            setSettingsBudget(null);
            loadBudgets();
          }}
        />
      )}
      
      {printModalOpen && printBudget && (
        <BudgetPrintModal
          onClose={() => {
            setPrintModalOpen(false);
            setPrintBudget(null);
          }}
          onPrint={async (config) => {
            setPrintModalOpen(false);
            try {
              const budgetData = await budgetService.getById(printBudget.id);
              setPrintBudgetData(budgetData);
              setPrintConfig(config);
              // Esperar a que el layout se renderice y luego imprimir
              setTimeout(() => {
                window.print();
              }, 500);
            } catch (error) {
              console.error('Error al cargar presupuesto:', error);
              toast.error('Error al cargar el presupuesto para impresión');
            }
          }}
          initialCurrency={printBudget.currency || 'USD'}
          budgetId={printBudget.id}
        />
      )}
      
      {/* Layout de impresión */}
      {printConfig && printBudgetData && (
        <BudgetPrintLayout
          budget={printBudgetData}
          config={printConfig}
        />
      )}

      {/* Modal de Pago */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Actualiza tu Plan</h2>
              <p className="text-sm text-slate-600 mb-6">
                {limitReachedReason === 'budgets' ? 'Has alcanzado el límite de presupuestos de tu plan.' : 'Has alcanzado el límite de partidas de tu presupuesto.'}
              </p>

              <div className="space-y-3 mb-6">
                <div className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-slate-800">Plan Básico</h3>
                      <p className="text-xs text-slate-500">5 presupuestos • 10 partidas • Sin IA</p>
                    </div>
                    <span className="text-blue-600 font-bold">$9.99/mes</span>
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-slate-800">Plan Pro</h3>
                      <p className="text-xs text-slate-500">20 presupuestos • 50 partidas • IA incluida</p>
                    </div>
                    <span className="text-emerald-600 font-bold">$29.99/mes</span>
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg hover:border-purple-300 transition-colors cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-slate-800">Plan Enterprise</h3>
                      <p className="text-xs text-slate-500">Ilimitado • IA completa • Soporte 24/7</p>
                    </div>
                    <span className="text-purple-600 font-bold">$99.99/mes</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setPaymentModalOpen(false);
                    toast.success('Proceso de pago simulado. En producción se redirigiría a pasarela.');
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/30"
                >
                  Proceder al Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
