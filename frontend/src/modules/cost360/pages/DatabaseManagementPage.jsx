import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Database, Plus, Trash2, Edit2, Copy, 
  TrendingUp, DollarSign, Users, Settings,
  AlertTriangle, CheckCircle, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { useDatabaseContext } from '../../../contexts/DatabaseContext';

export default function DatabaseManagementPage() {
  const navigate = useNavigate();
  const { refreshDatabases: reloadDatabases } = useDatabaseContext();
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState(null);
  
  // Form state for creating database
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_database_id: 'master',
    material_inflation: 0,
    labor_inflation: 0,
    equipment_inflation: 0
  });

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    try {
      setLoading(true);
      const data = await cost360DatabaseService.getAll();
      setDatabases(data.databases || []);
    } catch (error) {
      toast.error('Error cargando bases de datos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      await cost360DatabaseService.create(formData);
      toast.success('Base de datos creada exitosamente');
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        source_database_id: 'master',
        material_inflation: 0,
        labor_inflation: 0,
        equipment_inflation: 0
      });
      loadDatabases();
      reloadDatabases(); // Actualizar el contexto global
    } catch (error) {
      toast.error('Error al crear base de datos');
      console.error(error);
    }
  };

  const handleDeleteDatabase = async () => {
    if (!databaseToDelete) return;

    try {
      await cost360DatabaseService.delete(databaseToDelete.id);
      toast.success('Base de datos eliminada exitosamente');
      setShowDeleteModal(false);
      setDatabaseToDelete(null);
      loadDatabases();
      reloadDatabases(); // Actualizar el contexto global
    } catch (error) {
      toast.error('Error al eliminar base de datos');
      console.error(error);
    }
  };

  const confirmDelete = (database) => {
    if (database.is_master) {
      toast.error('No se puede eliminar la base de datos maestra');
      return;
    }
    setDatabaseToDelete(database);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <Settings className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* ── PAGE HEADER ─── glass style ───────────────────────── */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 1px 24px 0 rgba(80,100,200,0.07)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="p-2.5 rounded-xl shadow-sm"
                style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff' }}
              >
                <Database size={22} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Gestión de Bases de Datos</h1>
                <p className="text-sm text-blue-600/80 font-medium mt-0.5">Administra y duplica bases de datos de CostBase</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="relative overflow-hidden group bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
            >
              <div className="absolute inset-0 bg-[#e0f2fe] transform scale-x-0 origin-left transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-x-100"></div>
              <div className="relative z-10 flex items-center gap-2 font-medium text-white group-hover:text-[#1e3a8a] transition-colors">
                <Plus size={18} />
                <span>Nueva Base de Datos</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {databases.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.65)',
              boxShadow: '0 4px 32px 0 rgba(80,100,200,0.08)',
            }}
          >
            <Database className="mx-auto mb-4 text-slate-400" size={48} />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay bases de datos personalizadas</h3>
            <p className="text-slate-500 mb-4">Crea tu primera base de datos duplicando la Base Maestra</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 font-bold transition-all duration-300 hover:text-blue-700 hover:drop-shadow-md hover:-translate-y-0.5"
            >
              Crear Base de Datos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {databases.map((db) => (
              <div
                key={db.id}
                className="tarjeta-presupuesto-ambar group cursor-default"
              >
                {/* Header */}
                <div className="tarjeta-header">
                  <div className="flex items-center gap-3">
                    <div className="icono-archivo-ambar">
                      <Database size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="tarjeta-titulo-ambar">{db.name}</h3>
                      {db.is_master && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                          Base Maestra
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {!db.is_master && (
                    <div className="acciones-rapidas">
                      <button
                        onClick={() => confirmDelete(db)}
                        className="btn-accion"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="tarjeta-body flex-1">
                  {db.description && (
                    <p className="text-sm text-slate-600 mb-2">{db.description}</p>
                  )}

                  {/* Inflation Stats */}
                  {(db.material_inflation > 0 || db.labor_inflation > 0 || db.equipment_inflation > 0) && (
                    <div className="rounded-xl p-3.5 space-y-2.5 mb-2 caja-inflacion">
                      <div className="text-xs font-medium text-slate-500 mb-2">Índices de Inflación Aplicados</div>
                      
                      {db.material_inflation > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-slate-600">
                            <DollarSign size={14} /> Materiales
                          </span>
                          <span className="font-medium text-green-600">+{db.material_inflation}%</span>
                        </div>
                      )}
                      
                      {db.labor_inflation > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-slate-600">
                            <Users size={14} /> Mano de Obra
                          </span>
                          <span className="font-medium text-green-600">+{db.labor_inflation}%</span>
                        </div>
                      )}
                      
                      {db.equipment_inflation > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-slate-600">
                            <Settings size={14} /> Equipos
                          </span>
                          <span className="font-medium text-green-600">+{db.equipment_inflation}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="tarjeta-detalles flex-col items-start gap-1 mt-auto">
                    <div className="detalle-fecha">
                      <Copy size={13} className="mini-icono" />
                      Origen: {db.source_database_id || 'master'}
                    </div>
                    <div className="detalle-fecha">
                      Creado: {db.created_at ? new Date(db.created_at).toLocaleDateString('es-VE') : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Footer (Activa indicator) */}
                <div className={`flex items-center gap-2 text-sm pt-2 border-t border-slate-100 ${
                  db.is_active ? 'text-green-600' : 'text-slate-400'
                }`}>
                  {db.is_active ? (
                    <>
                      <CheckCircle size={16} />
                      Activa
                    </>
                  ) : (
                    <>
                      <X size={16} />
                      Inactiva
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[90vh]">
            
            {/* Encabezado */}
            <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
              <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
                <Copy className="text-sky-600" /> Duplicar Base de Datos
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateDatabase} className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
              
              {/* Nombre de la Base de Datos */}
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">
                  Nombre de la Base de Datos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                  placeholder="Ej. Base Julio 2024"
                  required
                />
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Descripción (opcional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10 resize-none"
                  rows={2}
                  placeholder="Ej. Base de datos con precios actualizados a julio 2024"
                />
              </div>

              {/* Base de Datos Origen */}
              <div className="flex flex-col gap-2 w-full">
                <label className="text-[13px] font-semibold text-amber-900">Base de Datos Origen</label>
                <select
                  value={formData.source_database_id}
                  onChange={(e) => setFormData({ ...formData, source_database_id: e.target.value })}
                  className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                >
                  <option value="master">Base Maestra</option>
                  {databases.filter(db => !db.is_master).map(db => (
                    <option key={db.id} value={db.id}>{db.name}</option>
                  ))}
                </select>
              </div>

              {/* Índices de Inflación */}
              <div className="bg-white/40 rounded-xl p-5 border border-sky-200 mt-2">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-sky-600" size={20} />
                  <h3 className="font-semibold text-amber-900 text-[14px]">Índices de Inflación</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                      <DollarSign size={14} /> Materiales (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.material_inflation}
                      onChange={(e) => setFormData({ ...formData, material_inflation: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                      <Users size={14} /> Mano de Obra (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.labor_inflation}
                      onChange={(e) => setFormData({ ...formData, labor_inflation: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                      <Settings size={14} /> Equipos (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.equipment_inflation}
                      onChange={(e) => setFormData({ ...formData, equipment_inflation: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-1 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 mt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
                >
                  Crear Base de Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && databaseToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Eliminar Base de Datos</h2>
              </div>
              <p className="text-slate-600 mb-6">
                ¿Estás seguro de que deseas eliminar la base de datos <strong>"{databaseToDelete.name}"</strong>? 
                Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDatabaseToDelete(null);
                  }}
                  className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteDatabase}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-red-500/30 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
