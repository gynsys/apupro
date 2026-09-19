import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Clock, AlertTriangle, Play, Plus, RefreshCw, 
  Trash2, Edit3, Link2, CheckCircle, ShieldAlert, Layers, ChevronRight, 
  HelpCircle, Eye, Sliders, X, BarChart3, Table as TableIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Gantt, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

import { scheduleService } from '../../services/scheduleService';
import { budgetService } from '../../services/budgetService';

export default function SchedulePage() {
  const { id: budgetId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [activeTab, setActiveTab] = useState('gantt'); // 'gantt' | 'table'
  const [ganttViewMode, setGanttViewMode] = useState(ViewMode.Day);

  // Modales
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);

  // Formulario nueva dependencia
  const [depForm, setDepForm] = useState({
    predecessor_id: '',
    type: 'FS',
    lag: 0
  });

  // Formulario nueva actividad manual
  const [newActivityForm, setNewActivityForm] = useState({
    name: '',
    code: '',
    duration: 1,
    cuadrillas: 1
  });

  // Cargar cronograma inicial
  useEffect(() => {
    loadSchedule();
  }, [budgetId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await scheduleService.getOrCreateByBudget(budgetId);
      setSchedule(data);
    } catch (err) {
      toast.error(err.message || 'Error al cargar cronograma');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateCPM = async () => {
    if (!schedule) return;
    try {
      setCalculating(true);
      const result = await scheduleService.calculate(schedule.id);
      setSchedule(prev => ({
        ...prev,
        total_duration: result.total_duration,
        end_date: result.end_date,
        activities: result.activities
      }));
      toast.success(`Ruta crítica calculada: ${result.total_duration} días laborables (${result.critical_path.length} tareas críticas)`);
    } catch (err) {
      toast.error(err.message || 'Error en el cálculo CPM', { duration: 5000 });
    } finally {
      setCalculating(false);
    }
  };

  const handleUpdateScheduleMeta = async (fields) => {
    if (!schedule) return;
    try {
      const updated = await scheduleService.updateSchedule(schedule.id, fields);
      setSchedule(updated);
      toast.success('Configuración de cronograma actualizada');
    } catch (err) {
      toast.error(err.message || 'Error al actualizar configuración');
    }
  };

  const handleImportBudgetItems = async () => {
    if (!schedule) return;
    try {
      setLoading(true);
      const updated = await scheduleService.importBudgetItems(schedule.id, { round_up: true, default_cuadrillas: 1.0 });
      setSchedule(updated);
      toast.success('Partidas del presupuesto importadas con éxito');
    } catch (err) {
      toast.error(err.message || 'Error al importar partidas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();
    if (!newActivityForm.name.trim()) {
      toast.error('El nombre de la actividad es requerido');
      return;
    }
    try {
      const created = await scheduleService.createActivity(schedule.id, {
        name: newActivityForm.name.trim(),
        code: newActivityForm.code.trim() || undefined,
        duration: Number(newActivityForm.duration) || 1,
        cuadrillas: Number(newActivityForm.cuadrillas) || 1,
        order: (schedule.activities?.length || 0) + 1
      });
      setSchedule(prev => ({
        ...prev,
        activities: [...(prev.activities || []), created]
      }));
      setIsNewActivityModalOpen(false);
      setNewActivityForm({ name: '', code: '', duration: 1, cuadrillas: 1 });
      toast.success('Actividad creada exitosamente');
      // Recalcular
      handleCalculateCPM();
    } catch (err) {
      toast.error(err.message || 'Error al crear actividad');
    }
  };

  const handleUpdateActivityDuration = async (activity, newDuration) => {
    const val = Number(newDuration);
    if (isNaN(val) || val <= 0) {
      toast.error('La duración debe ser mayor a 0');
      return;
    }
    try {
      const updated = await scheduleService.updateActivity(schedule.id, activity.id, {
        duration: val
      });
      setSchedule(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === activity.id ? updated : a)
      }));
      toast.success('Duración actualizada');
      handleCalculateCPM();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar duración');
    }
  };

  const handleUpdateCuadrillas = async (activity, newCuadrillas) => {
    const val = Number(newCuadrillas);
    if (isNaN(val) || val <= 0) {
      toast.error('El número de cuadrillas debe ser mayor a 0');
      return;
    }
    try {
      const updated = await scheduleService.updateActivity(schedule.id, activity.id, {
        cuadrillas: val
      });
      setSchedule(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === activity.id ? updated : a)
      }));
      toast.success('Cuadrillas y duración recalculadas');
      handleCalculateCPM();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar cuadrillas');
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!window.confirm('¿Está seguro de eliminar esta actividad y sus dependencias asociadas?')) return;
    try {
      await scheduleService.deleteActivity(schedule.id, activityId);
      setSchedule(prev => ({
        ...prev,
        activities: prev.activities.filter(a => a.id !== activityId),
        dependencies: prev.dependencies.filter(d => d.predecessor_id !== activityId && d.successor_id !== activityId)
      }));
      toast.success('Actividad eliminada');
      handleCalculateCPM();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar actividad');
    }
  };

  const handleOpenDependencies = (activity) => {
    setSelectedActivity(activity);
    setDepForm({
      predecessor_id: '',
      type: 'FS',
      lag: 0
    });
    setIsDepModalOpen(true);
  };

  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!depForm.predecessor_id) {
      toast.error('Seleccione una actividad predecesora');
      return;
    }
    try {
      const created = await scheduleService.createDependency(schedule.id, {
        predecessor_id: depForm.predecessor_id,
        successor_id: selectedActivity.id,
        type: depForm.type,
        lag: Number(depForm.lag) || 0
      });
      setSchedule(prev => ({
        ...prev,
        dependencies: [...(prev.dependencies || []), created]
      }));
      toast.success('Dependencia agregada exitosamente');
      setDepForm({ predecessor_id: '', type: 'FS', lag: 0 });
      handleCalculateCPM();
    } catch (err) {
      toast.error(err.message || 'Error al agregar dependencia', { duration: 5000 });
    }
  };

  const handleDeleteDependency = async (dependencyId) => {
    try {
      await scheduleService.deleteDependency(schedule.id, dependencyId);
      setSchedule(prev => ({
        ...prev,
        dependencies: prev.dependencies.filter(d => d.id !== dependencyId)
      }));
      toast.success('Dependencia eliminada');
      handleCalculateCPM();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar dependencia');
    }
  };

  // Mapear tareas para el componente Gantt
  const ganttTasks = useMemo(() => {
    if (!schedule || !schedule.activities || schedule.activities.length === 0) return [];

    const baseStart = schedule.start_date ? new Date(schedule.start_date) : new Date();

    return schedule.activities.map(act => {
      // Si la actividad tiene calendar_start y calendar_end
      let start = act.calendar_start ? new Date(act.calendar_start + 'T00:00:00') : new Date(baseStart);
      let end = act.calendar_end ? new Date(act.calendar_end + 'T23:59:59') : new Date(start);

      // Asegurar que end sea al menos posterior a start
      if (end <= start) {
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1000);
      }

      // Predecesoras de esta actividad
      const actDeps = (schedule.dependencies || [])
        .filter(d => d.successor_id === act.id)
        .map(d => d.predecessor_id);

      const isCritical = act.is_critical;

      return {
        id: act.id,
        name: `${act.code ? act.code + ' ' : ''}${act.name} (${act.duration}d)`,
        start,
        end,
        type: 'task',
        progress: isCritical ? 100 : 0,
        dependencies: actDeps,
        isDisabled: true, // Sólo lectura interactiva
        styles: {
          backgroundColor: isCritical ? '#dc2626' : '#2563eb',
          backgroundSelectedColor: isCritical ? '#991b1b' : '#1d4ed8',
          progressColor: isCritical ? '#ef4444' : '#3b82f6',
          progressSelectedColor: isCritical ? '#b91c1c' : '#1e40af'
        }
      };
    });
  }, [schedule]);

  const criticalCount = useMemo(() => {
    return (schedule?.activities || []).filter(a => a.is_critical).length;
  }, [schedule]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-10 h-10 text-primary-600 animate-spin" />
        <p className="text-gray-500 font-medium">Cargando cronograma de obra y ruta crítica...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Barra de Navegación y Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <button 
            onClick={() => navigate(`/budgets/${budgetId}`)}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Volver a la Hoja de Presupuesto
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {schedule?.name || 'Cronograma de Obra'}
              </h1>
              <p className="text-xs text-gray-500">
                Planificación y control de tiempos con el Método de la Ruta Crítica (CPM)
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleImportBudgetItems}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all shadow-sm"
            title="Importar partidas con cantidad mayor a cero que no estén en el cronograma"
          >
            <Layers className="w-4 h-4 text-gray-500" />
            Sincronizar Partidas
          </button>

          <button
            onClick={() => setIsNewActivityModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-gray-500" />
            Nueva Tarea
          </button>

          <button
            onClick={handleCalculateCPM}
            disabled={calculating}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-all shadow-md shadow-red-200 disabled:opacity-50"
          >
            {calculating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            Calcular Ruta Crítica (CPM)
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Planificación */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Duración Total */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Duración Total</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-gray-900">{schedule?.total_duration || 0}</span>
              <span className="text-xs font-semibold text-gray-500">días hábiles</span>
            </div>
          </div>
        </div>

        {/* Tareas Críticas */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Ruta Crítica</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-red-600">{criticalCount}</span>
              <span className="text-xs font-semibold text-gray-500">de {schedule?.activities?.length || 0} tareas</span>
            </div>
          </div>
        </div>

        {/* Fecha Inicio */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Inicio</p>
            <input
              type="date"
              value={schedule?.start_date || ''}
              onChange={(e) => handleUpdateScheduleMeta({ start_date: e.target.value })}
              className="text-sm font-semibold text-gray-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Jornada / Días por Semana */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Sliders className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Jornada Laboral</p>
            <select
              value={schedule?.work_days_per_week || 5}
              onChange={(e) => handleUpdateScheduleMeta({ work_days_per_week: Number(e.target.value) })}
              className="text-sm font-semibold text-gray-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
            >
              <option value={5}>5 Días (Lunes a Viernes)</option>
              <option value={6}>6 Días (Lunes a Sábado)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas: Gantt vs Tabla */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('gantt')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'gantt'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Diagrama de Gantt & Ruta Crítica
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'table'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            Tabla de Actividades & Precedencias ({schedule?.activities?.length || 0})
          </button>
        </div>

        {/* Controles de Escala para el Gantt */}
        {activeTab === 'gantt' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Escala:</span>
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setGanttViewMode(ViewMode.Day)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  ganttViewMode === ViewMode.Day ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Día
              </button>
              <button
                onClick={() => setGanttViewMode(ViewMode.Week)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  ganttViewMode === ViewMode.Week ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setGanttViewMode(ViewMode.Month)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  ganttViewMode === ViewMode.Month ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VISTA 1: DIAGRAMA DE GANTT */}
      {activeTab === 'gantt' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          {/* Leyenda Visual */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-600 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-red-600 inline-block shadow-sm"></span>
              <span className="font-semibold text-gray-900">Ruta Crítica (Holgura = 0)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block shadow-sm"></span>
              <span className="font-semibold text-gray-900">Tarea con Holgura (No Crítica)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold">→</span>
              <span>Relación de Dependencia (FS, SS, FF, SF)</span>
            </div>
          </div>

          {ganttTasks.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <Gantt
                tasks={ganttTasks}
                viewMode={ganttViewMode}
                locale="es"
                listCellWidth="280px"
                columnWidth={ganttViewMode === ViewMode.Month ? 250 : ganttViewMode === ViewMode.Week ? 150 : 65}
                barFill={65}
                barCornerRadius={4}
              />
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 space-y-3">
              <Layers className="w-12 h-12 mx-auto text-gray-300" />
              <p className="text-sm font-medium">No hay actividades en el cronograma todavía.</p>
              <button
                onClick={handleImportBudgetItems}
                className="px-4 py-2 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all"
              >
                Importar automáticamente partidas del presupuesto
              </button>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: TABLA DE ACTIVIDADES Y PRECEDENCIAS */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3 w-16">EDT</th>
                  <th className="py-3 px-4 min-w-[220px]">Actividad</th>
                  <th className="py-3 px-2 w-20 text-center">Cant.</th>
                  <th className="py-3 px-2 w-20 text-center">Rend.</th>
                  <th className="py-3 px-2 w-20 text-center">Cuad.</th>
                  <th className="py-3 px-3 w-24 text-center">Duración</th>
                  <th className="py-3 px-4 min-w-[160px]">Predecesoras</th>
                  <th className="py-3 px-2 text-center">ES</th>
                  <th className="py-3 px-2 text-center">EF</th>
                  <th className="py-3 px-2 text-center">LS</th>
                  <th className="py-3 px-2 text-center">LF</th>
                  <th className="py-3 px-2 text-center">Holgura</th>
                  <th className="py-3 px-2 text-center">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {(schedule?.activities || []).map((act, idx) => {
                  // Predecesoras asociadas a esta actividad
                  const actDeps = (schedule?.dependencies || []).filter(d => d.successor_id === act.id);

                  return (
                    <tr 
                      key={act.id} 
                      className={`hover:bg-gray-50/80 transition-colors ${
                        act.is_critical ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-gray-400">
                        {act.code || `${idx + 1}`}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {act.name}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-600 font-mono">
                        {act.quantity ? act.quantity.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-600 font-mono">
                        {act.rendimiento ? act.rendimiento.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          defaultValue={act.cuadrillas || 1}
                          onBlur={(e) => handleUpdateCuadrillas(act, e.target.value)}
                          className="w-14 text-center py-1 px-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            defaultValue={act.duration}
                            onBlur={(e) => handleUpdateActivityDuration(act, e.target.value)}
                            className={`w-16 text-center py-1 px-1 text-xs font-bold rounded-lg border ${
                              act.is_critical 
                                ? 'border-red-300 text-red-700 bg-red-50/50' 
                                : 'border-gray-200 text-gray-800'
                            }`}
                          />
                          <span className="text-[10px] text-gray-400">d</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {actDeps.map(dep => {
                            const predAct = schedule.activities.find(a => a.id === dep.predecessor_id);
                            return (
                              <span
                                key={dep.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-100"
                              >
                                {predAct?.code || predAct?.name?.slice(0, 10)} 
                                <strong className="text-blue-900">{dep.type}</strong>
                                {dep.lag !== 0 && (
                                  <span className="text-blue-600 font-bold">
                                    {dep.lag > 0 ? `+${dep.lag}` : dep.lag}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          <button
                            onClick={() => handleOpenDependencies(act)}
                            className="inline-flex items-center p-1 text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                            title="Editar dependencias"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-gray-600">{act.early_start}</td>
                      <td className="py-3 px-2 text-center font-mono text-gray-600">{act.early_finish}</td>
                      <td className="py-3 px-2 text-center font-mono text-gray-400">{act.late_start}</td>
                      <td className="py-3 px-2 text-center font-mono text-gray-400">{act.late_finish}</td>
                      <td className="py-3 px-2 text-center font-mono font-bold">
                        <span className={act.total_float === 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {act.total_float}d
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {act.is_critical ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 uppercase tracking-wider animate-pulse">
                            Crítica
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteActivity(act.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar actividad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDITOR DE DEPENDENCIAS */}
      {isDepModalOpen && selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Precedencias & Dependencias</h3>
                <p className="text-xs text-gray-500">
                  Actividad: <strong className="text-gray-900">{selectedActivity.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsDepModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de Dependencias Actuales */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Predecesoras actuales:
              </p>
              {schedule?.dependencies?.filter(d => d.successor_id === selectedActivity.id).length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl text-center">
                  Esta actividad no tiene predecesoras (inicia al principio del proyecto).
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {schedule.dependencies
                    .filter(d => d.successor_id === selectedActivity.id)
                    .map(dep => {
                      const pred = schedule.activities.find(a => a.id === dep.predecessor_id);
                      return (
                        <div
                          key={dep.id}
                          className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-gray-800">{pred?.name}</span>
                            <span className="font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                              {dep.type}
                            </span>
                            {dep.lag !== 0 && (
                              <span className="font-mono text-gray-500 font-bold">
                                {dep.lag > 0 ? `+${dep.lag}` : dep.lag}d lag
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteDependency(dep.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Eliminar dependencia"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Formulario para Agregar Nueva Predecesora */}
            <form onSubmit={handleAddDependency} className="space-y-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Agregar nueva predecesora:
              </p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Actividad Previa</label>
                  <select
                    value={depForm.predecessor_id}
                    onChange={(e) => setDepForm(prev => ({ ...prev, predecessor_id: e.target.value }))}
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    required
                  >
                    <option value="">Seleccione una actividad...</option>
                    {schedule?.activities
                      ?.filter(a => a.id !== selectedActivity.id)
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ''}{a.name} ({a.duration}d)
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de Relación</label>
                    <select
                      value={depForm.type}
                      onChange={(e) => setDepForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="FS">FS (Fin a Inicio - Estándar)</option>
                      <option value="SS">SS (Inicio a Inicio)</option>
                      <option value="FF">FF (Fin a Fin)</option>
                      <option value="SF">SF (Inicio a Fin)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desfase / Lag (Días)</label>
                    <input
                      type="number"
                      step="1"
                      value={depForm.lag}
                      onChange={(e) => setDepForm(prev => ({ ...prev, lag: Number(e.target.value) }))}
                      className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDepModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm"
                >
                  Agregar Predecesora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA ACTIVIDAD MANUAL */}
      {isNewActivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Nueva Tarea de Cronograma</h3>
              <button
                onClick={() => setIsNewActivityModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Código / EDT (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: ACT-15 o 2.01"
                  value={newActivityForm.code}
                  onChange={(e) => setNewActivityForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre de la Actividad *</label>
                <input
                  type="text"
                  placeholder="Ej: Desencofrado y curado de losa"
                  required
                  value={newActivityForm.name}
                  onChange={(e) => setNewActivityForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duración (Días Hábiles) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={newActivityForm.duration}
                    onChange={(e) => setNewActivityForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cuadrillas Asignadas</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newActivityForm.cuadrillas}
                    onChange={(e) => setNewActivityForm(prev => ({ ...prev, cuadrillas: Number(e.target.value) }))}
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewActivityModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm"
                >
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
