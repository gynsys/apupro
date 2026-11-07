import React, { useEffect, useState, useRef } from 'react';
import {
  ShieldAlert,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  FolderCheck,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { budgetReviewService } from '../services/budgetReviewService';
import { budgetService } from '../../../services/budgetService';
import { useDatabase } from '../../../contexts/DatabaseContext';

const SEVERITY_CONFIG = {
  CRITICA: {
    label: 'Crítica',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    cardClass: 'border-red-200 bg-red-50/40',
  },
  ALTA: {
    label: 'Alta',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    cardClass: 'border-amber-200 bg-amber-50/40',
  },
  MEDIA: {
    label: 'Media',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cardClass: 'border-yellow-200 bg-yellow-50/30',
  },
  INFO_MAPREX: {
    label: 'Nativo Maprex',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    cardClass: 'border-sky-200 bg-sky-50/40',
  },
};

const ORIGIN_LABELS = {
  MAPREX_BASE_OR_EDIFICACIONES: 'Base Original Maprex (CodPar exacto)',
  COVENIN_MANTENIMIENTO_M: 'Norma COVENIN Mantenimiento (M)',
  COVENIN_URBANISMO_U: 'Norma COVENIN Urbanismo (U)',
  LULOWIN_IP3_REPARACIONES_R: 'LULOWin / IP3 Reparaciones (R)',
  LULOWIN_IP3_VIALIDAD_AMBIENTAL_A: 'LULOWin / IP3 Vialidad y Ambiental (A)',
  CADAFE_REDES_ELECTRICAS_RA: 'Redes Eléctricas CADAFE (RA)',
  TORRES_TELECOM_ELECTRICIDAD: 'Catálogo Torres / Telecom (TOR)',
  CORPORATIVO_BANCA: 'Edificaciones Corporativas / Banca',
  SIN_CODIGO_COVENIN: 'Sin Codificación COVENIN (S/C)',
};

export default function BudgetReviewPage() {
  const { selectedDatabase } = useDatabase();
  const databaseId = selectedDatabase?.id || 'master';

  const [snapshots, setSnapshots] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);

  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'items' | 'uncoded'
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [showUnchangedByItem, setShowUnchangedByItem] = useState({});

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingList(true);
    try {
      const [snaps, userBudgets] = await Promise.all([
        budgetReviewService.listSnapshots().catch(() => []),
        budgetService.getAll().catch(() => []),
      ]);
      setSnapshots(snaps || []);
      setBudgets(userBudgets || []);
      if (snaps && snaps.length > 0 && !activeReport) {
        const latestDetail = await budgetReviewService.getSnapshotDetail(snaps[0].id);
        setActiveReport(latestDetail);
      }
    } catch (error) {
      console.error('Error cargando datos iniciales de auditoría:', error);
    } finally {
      setLoadingList(false);
    }
  };

  const handleAuditExistingBudget = async () => {
    if (!selectedBudgetId) {
      toast.error('Selecciona un presupuesto para auditar');
      return;
    }
    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.auditExistingBudget(selectedBudgetId, databaseId);
      setActiveReport(detail);
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      toast.success('Auditoría completada sobre copia aislada');
    } catch (error) {
      toast.error(error.message || 'Error ejecutando la auditoría');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.auditUploadedFile(file, databaseId);
      setActiveReport(detail);
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      toast.success(`Archivo "${file.name}" importado y auditado con éxito`);
    } catch (error) {
      toast.error(error.message || 'Error al procesar el archivo para auditoría');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleSelectSnapshot = async (snapshotId) => {
    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.getSnapshotDetail(snapshotId);
      setActiveReport(detail);
    } catch (error) {
      toast.error(error.message || 'Error al abrir el informe');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId, event) => {
    event.stopPropagation();
    try {
      await budgetReviewService.deleteSnapshot(snapshotId);
      const remaining = snapshots.filter((s) => s.id !== snapshotId);
      setSnapshots(remaining);
      if (activeReport?.id === snapshotId) {
        if (remaining.length > 0) {
          const nextDetail = await budgetReviewService.getSnapshotDetail(remaining[0].id);
          setActiveReport(nextDetail);
        } else {
          setActiveReport(null);
        }
      }
      toast.success('Informe eliminado');
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar');
    }
  };

  const filteredFindings = (activeReport?.findings || []).filter((f) => {
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const target = `${f.item_code || ''} ${f.component_code || ''} ${f.component_description || ''} ${f.message || ''}`.toLowerCase();
      if (!target.includes(q)) return false;
    }
    return true;
  });

  const nonChapterItems = (activeReport?.items || []).filter((it) => !it.is_chapter);
  const discrepantItems = nonChapterItems.filter((it) => (it.findings?.length || 0) > 0);
  const cleanItemsCount = nonChapterItems.length - discrepantItems.length;
  const uncodedItems = nonChapterItems.filter((it) => it.is_uncoded);

  const isComponentDiscrepant = (comp) => {
    if (comp.code === 'OMITIDO') return true;
    if (comp.master_quantity === null || comp.master_quantity === undefined) return true;
    if (Math.abs(Number(comp.quantity || 0) - Number(comp.master_quantity || 0)) > 0.001) return true;
    if (
      comp.master_waste_or_deprec !== null &&
      comp.master_waste_or_deprec !== undefined &&
      Math.abs(Number(comp.waste_or_deprec || 0) - Number(comp.master_waste_or_deprec || 0)) > 0.0005
    ) {
      return true;
    }
    return false;
  };

  const healthColor = (score = 100) => {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                <ShieldAlert size={22} />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Revisor y Auditor Forense de Presupuestos (Maprex ↔ CostBase)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5">
              Trabaja sobre una copia aislada sin modificar tus presupuestos. Detecta rendimientos alterados,
              cantidades de materiales manipuladas, depreciaciones de equipos distorsionadas, colisiones Maprex vs. CostBase y partidas S/C.
            </p>
          </div>

          {/* Controles de Nueva Auditoría */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex items-center gap-2">
              <select
                value={selectedBudgetId}
                onChange={(e) => setSelectedBudgetId(e.target.value)}
                disabled={runningAudit}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[210px]"
              >
                <option value="">Seleccionar presupuesto existente...</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAuditExistingBudget}
                disabled={runningAudit || !selectedBudgetId}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {runningAudit ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                <span>Auditar Presupuesto</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={runningAudit}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UploadCloud size={16} />
              <span>Subir Excel Maprex / Archivo</span>
            </button>
          </div>
        </div>

        {/* Historial de Snapshots de Revisión */}
        {snapshots.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Revisiones guardadas:
            </span>
            {snapshots.map((snap) => {
              const isSelected = activeReport?.id === snap.id;
              return (
                <div
                  key={snap.id}
                  onClick={() => handleSelectSnapshot(snap.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition shrink-0 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FolderCheck size={14} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="truncate max-w-[160px]">{snap.name}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold">
                    {snap.health_score}%
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                    title="Eliminar revisión"
                    className="text-slate-400 hover:text-red-600 p-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Estado de Carga o Vacío */}
      {(loadingList || runningAudit) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-3 text-slate-600">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm font-semibold">
            Analizando partidas, rendimientos, depreciaciones y recetas APU contra la base maestra...
          </p>
        </div>
      )}

      {!loadingList && !runningAudit && !activeReport && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <FileSpreadsheet size={40} className="mx-auto text-slate-400" />
          <h2 className="text-base font-bold text-slate-800">
            Aún no has ejecutado una auditoría de presupuesto
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Selecciona un presupuesto existente arriba o sube un archivo Excel de APUs exportado desde Maprex o CostBase para generar el diagnóstico forense completo.
          </p>
        </div>
      )}

      {/* Panel del Informe Activo */}
      {!runningAudit && activeReport && (
        <>
          {/* Tarjetas Resumen Ejecutivo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={`rounded-2xl border p-3.5 ${healthColor(activeReport.health_score)}`}>
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Índice de Salud
              </span>
              <div className="text-2xl font-black mt-1">{activeReport.health_score} / 100</div>
              <span className="text-[11px] font-medium">
                {activeReport.total_items} partidas evaluadas
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('findings');
                setSeverityFilter(severityFilter === 'CRITICA' ? 'ALL' : 'CRITICA');
              }}
              className={`text-left rounded-2xl border p-3.5 transition cursor-pointer ${
                severityFilter === 'CRITICA'
                  ? 'ring-2 ring-red-500 bg-red-50 border-red-300'
                  : 'bg-white border-slate-200 hover:bg-red-50/30'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                Críticas
              </span>
              <div className="text-2xl font-black text-red-700 mt-1">
                {activeReport.critical_findings_count}
              </div>
              <span className="text-[11px] text-slate-500">Manipulación / Error grave</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('findings');
                setSeverityFilter(severityFilter === 'ALTA' ? 'ALL' : 'ALTA');
              }}
              className={`text-left rounded-2xl border p-3.5 transition cursor-pointer ${
                severityFilter === 'ALTA'
                  ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-300'
                  : 'bg-white border-slate-200 hover:bg-amber-50/30'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Severidad Alta
              </span>
              <div className="text-2xl font-black text-amber-700 mt-1">
                {activeReport.high_findings_count}
              </div>
              <span className="text-[11px] text-slate-500">Cantidades / Rendimiento</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('findings');
                setSeverityFilter(severityFilter === 'MEDIA' ? 'ALL' : 'MEDIA');
              }}
              className={`text-left rounded-2xl border p-3.5 transition cursor-pointer ${
                severityFilter === 'MEDIA'
                  ? 'ring-2 ring-yellow-500 bg-yellow-50 border-yellow-300'
                  : 'bg-white border-slate-200 hover:bg-yellow-50/30'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-700">
                Severidad Media
              </span>
              <div className="text-2xl font-black text-yellow-700 mt-1">
                {activeReport.medium_findings_count}
              </div>
              <span className="text-[11px] text-slate-500">Equipos / Equivalencias</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('findings');
                setSeverityFilter(severityFilter === 'INFO_MAPREX' ? 'ALL' : 'INFO_MAPREX');
              }}
              className={`text-left rounded-2xl border p-3.5 transition cursor-pointer ${
                severityFilter === 'INFO_MAPREX'
                  ? 'ring-2 ring-sky-500 bg-sky-50 border-sky-300'
                  : 'bg-white border-slate-200 hover:bg-sky-50/30'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Nativo Maprex
              </span>
              <div className="text-2xl font-black text-sky-700 mt-1">
                {activeReport.info_findings_count}
              </div>
              <span className="text-[11px] text-slate-500">Dif. catálogo Maprex/CostBase</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('uncoded')}
              className={`text-left rounded-2xl border p-3.5 transition cursor-pointer ${
                activeTab === 'uncoded'
                  ? 'ring-2 ring-violet-500 bg-violet-50 border-violet-300'
                  : 'bg-white border-slate-200 hover:bg-violet-50/30'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                Partidas S/C
              </span>
              <div className="text-2xl font-black text-violet-700 mt-1">
                {activeReport.uncoded_items_count}
              </div>
              <span className="text-[11px] text-slate-500">
                {activeReport.coded_items_count} codificadas
              </span>
            </button>
          </div>

          {/* Desglose de Origen Maprex vs CostBase + Botón Exportar Excel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Layers size={15} className="text-blue-600" />
                <span>Trazabilidad de Origen del Presupuesto ({activeReport.name})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(activeReport.origin_breakdown || {}).map(([originKey, count]) => (
                  <span
                    key={originKey}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    {ORIGIN_LABELS[originKey] || originKey}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>

            <a
              href={budgetReviewService.getExportExcelUrl(activeReport.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shrink-0 shadow-xs transition"
            >
              <Download size={16} />
              <span>Descargar Informe Excel (.xlsx)</span>
            </a>
          </div>

          {/* Barra de Pestañas y Filtros */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 px-4 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('findings')}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'findings'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hallazgos Detectados ({activeReport.findings?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('items')}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'items'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Partidas con Discrepancias APU ({discrepantItems.length} de {nonChapterItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('uncoded')}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'uncoded'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  APUs Sin Código COVENIN y Equivalentes ({uncodedItems.length})
                </button>
              </div>

              {activeTab === 'findings' && (
                <div className="flex flex-wrap items-center gap-2 pb-2 sm:pb-1">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-700"
                  >
                    <option value="ALL">Todas las categorías</option>
                    <option value="RENDIMIENTO">Rendimientos</option>
                    <option value="MATERIALES">Materiales</option>
                    <option value="EQUIPOS">Equipos y Depreciación</option>
                    <option value="MANO_OBRA">Mano de Obra</option>
                    <option value="ESTRUCTURA">Estructura / Colisión</option>
                    <option value="COHERENCIA">Coherencia Matemática</option>
                    <option value="SIN_CODIGO">Sin Código (S/C)</option>
                  </select>

                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar código o insumo..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PESTAÑA 1: HALLAZGOS */}
            {activeTab === 'findings' && (
              <div className="p-4 space-y-3">
                {filteredFindings.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    No hay hallazgos que coincidan con el filtro actual.
                  </div>
                ) : (
                  filteredFindings.map((f) => {
                    const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.MEDIA;
                    return (
                      <div
                        key={f.id}
                        className={`rounded-xl border p-3.5 sm:p-4 transition ${sev.cardClass}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-md border text-[11px] font-extrabold uppercase ${sev.badgeClass}`}
                            >
                              {sev.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                              {f.rule_id} · {f.category}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900">
                              Partida: {f.item_code || 'S/C'}
                            </span>
                            {f.component_code && (
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                Insumo: {f.component_code} {f.component_description ? `— ${f.component_description}` : ''}
                              </span>
                            )}
                          </div>

                          {f.diff_percent !== null && f.diff_percent !== undefined && (
                            <span
                              className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                                Math.abs(f.diff_percent) > 20
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              Diferencia: {f.diff_percent > 0 ? `+${f.diff_percent}` : f.diff_percent}%
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-slate-800">{f.message}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-200/60 text-xs">
                          <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-slate-200/80">
                            <span className="text-slate-400 font-bold uppercase text-[10px] block">
                              Valor en Presupuesto
                            </span>
                            <span className="font-bold text-slate-900">{f.imported_value || '-'}</span>
                          </div>
                          <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-slate-200/80">
                            <span className="text-slate-400 font-bold uppercase text-[10px] block">
                              Valor Maestro CostBase
                            </span>
                            <span className="font-bold text-emerald-700">{f.master_value || '-'}</span>
                          </div>
                          <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-slate-200/80">
                            <span className="text-slate-400 font-bold uppercase text-[10px] block">
                              Recomendación
                            </span>
                            <span className="font-medium text-slate-700">{f.suggestion || '-'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* PESTAÑA 2: PARTIDAS CON DISCREPANCIAS Y RECETAS APU */}
            {activeTab === 'items' && (
              <div>
                {cleanItemsCount > 0 && (
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Mostrando únicamente las <strong>{discrepantItems.length}</strong> partida(s) con discrepancias detectadas. Se omitieron <strong>{cleanItemsCount}</strong> partida(s) que coinciden sin fallas con la base maestra.
                    </span>
                  </div>
                )}

                {discrepantItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    Las {nonChapterItems.length} partidas del presupuesto coinciden al 100% con la estructura de la base maestra (0 discrepancias).
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {discrepantItems.map((it) => {
                      const isExpanded =
                        expandedItemId === it.id ||
                        (expandedItemId === null && discrepantItems.length <= 5);
                      const itemFindingsCount = it.findings?.length || 0;
                      const allComps = it.components || [];
                      const discrepantComps = allComps.filter(isComponentDiscrepant);
                      const unchangedCompsCount = allComps.length - discrepantComps.length;
                      const showAllComps = Boolean(showUnchangedByItem[it.id]);
                      const visibleComps = showAllComps ? allComps : discrepantComps;
                      const perfDiffers =
                        it.master_performance !== null &&
                        it.master_performance !== undefined &&
                        Math.abs(Number(it.performance || 0) - Number(it.master_performance || 0)) > 0.001;

                      return (
                        <div key={it.id} className="p-3.5 sm:p-4 hover:bg-slate-50/60 transition">
                          <div
                            onClick={() =>
                              setExpandedItemId(
                                expandedItemId === it.id ? '__COLLAPSED__' : it.id
                              )
                            }
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-bold">
                                  #{it.row_number} · {it.original_code || 'S/C'}
                                </span>
                                {it.matched_master_code && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                    Maestro: {it.matched_master_code} ({Math.round(it.description_similarity * 100)}% sim.)
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                                  {ORIGIN_LABELS[it.origin_source] || it.origin_source}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  {itemFindingsCount} discrepancia(s)
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2">
                                {it.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-4 text-xs shrink-0">
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                  Unidad
                                </span>
                                <span className="font-bold text-slate-800">
                                  {it.unit}{' '}
                                  {it.master_unit && it.master_unit !== it.unit
                                    ? `(Maestro: ${it.master_unit})`
                                    : ''}
                                </span>
                              </div>
                              <div
                                className={
                                  perfDiffers
                                    ? 'bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg'
                                    : ''
                                }
                              >
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                  Rendimiento (Imp / Maestro)
                                </span>
                                <span
                                  className={`font-bold ${
                                    perfDiffers ? 'text-red-700' : 'text-slate-800'
                                  }`}
                                >
                                  {it.performance}{' '}
                                  {it.master_performance ? `/ ${it.master_performance}` : ''}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                  P.U. Calc
                                </span>
                                <span className="font-bold text-slate-900">
                                  ${Number(it.calculated_unit_price || 0).toFixed(2)}
                                </span>
                              </div>
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                              {it.master_description && (
                                <div className="bg-slate-100 rounded-xl p-2.5 text-xs text-slate-700">
                                  <strong>Descripción Maestra ({it.matched_master_code}):</strong>{' '}
                                  {it.master_description}
                                </div>
                              )}

                              {allComps.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-700">
                                      Insumos con discrepancia en este APU: {discrepantComps.length}
                                    </span>
                                    {unchangedCompsCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowUnchangedByItem((prev) => ({
                                            ...prev,
                                            [it.id]: !prev[it.id],
                                          }))
                                        }
                                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                                      >
                                        {showAllComps
                                          ? 'Ocultar insumos sin cambios'
                                          : `Ver también ${unchangedCompsCount} insumo(s) sin cambios`}
                                      </button>
                                    )}
                                  </div>

                                  {visibleComps.length === 0 ? (
                                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                                      Todos los insumos del APU coinciden con el maestro (la discrepancia de esta partida está en rendimiento, unidad o cabecera).
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-600 text-left">
                                            <th className="p-2 font-bold">Tipo</th>
                                            <th className="p-2 font-bold">Código Imp.</th>
                                            <th className="p-2 font-bold">Código Maestro</th>
                                            <th className="p-2 font-bold">Descripción</th>
                                            <th className="p-2 font-bold text-right">Cant. Imp.</th>
                                            <th className="p-2 font-bold text-right">Cant. Maestra</th>
                                            <th className="p-2 font-bold text-right">Desp. / Deprec Imp.</th>
                                            <th className="p-2 font-bold text-right">Desp. / Deprec Maestro</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {visibleComps.map((comp) => {
                                            const isDiff = isComponentDiscrepant(comp);
                                            const isOmitted = comp.code === 'OMITIDO';
                                            return (
                                              <tr
                                                key={comp.id}
                                                className={
                                                  isOmitted
                                                    ? 'bg-red-50/70'
                                                    : isDiff
                                                    ? 'bg-amber-50/70'
                                                    : ''
                                                }
                                              >
                                                <td className="p-2 font-semibold uppercase text-[11px]">
                                                  {comp.component_type}
                                                </td>
                                                <td className="p-2 font-mono font-bold">
                                                  {isOmitted ? (
                                                    <span className="text-red-700">OMITIDO</span>
                                                  ) : (
                                                    comp.code
                                                  )}
                                                </td>
                                                <td className="p-2 font-mono text-slate-600">
                                                  {comp.resolved_master_code || '-'}
                                                </td>
                                                <td className="p-2 truncate max-w-[260px]">
                                                  {comp.description}
                                                </td>
                                                <td className="p-2 text-right font-bold text-red-700">
                                                  {comp.quantity}
                                                </td>
                                                <td className="p-2 text-right text-emerald-700 font-semibold">
                                                  {comp.master_quantity ?? 'Extra (No en maestro)'}
                                                </td>
                                                <td className="p-2 text-right font-semibold">
                                                  {comp.waste_or_deprec}
                                                </td>
                                                <td className="p-2 text-right text-slate-600">
                                                  {comp.master_waste_or_deprec ?? '-'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">
                                  Esta partida fue cargada desde hoja resumen sin desglose interno de insumos APU.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 3: PARTIDAS SIN CÓDIGO COVENIN (S/C) */}
            {activeTab === 'uncoded' && (
              <div className="p-4 space-y-3">
                {uncodedItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    Todas las partidas de este presupuesto tienen código reconocido en la base maestra.
                  </div>
                ) : (
                  uncodedItems.map((it) => (
                    <div
                      key={it.id}
                      className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-violet-100 text-violet-900 font-extrabold text-xs">
                          Fila #{it.row_number} · Código declarado: {it.original_code || 'S/C'} ({it.unit})
                        </span>
                        {it.suggested_equivalent_code && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs">
                            Candidato Maestro: {it.suggested_equivalent_code} (Similitud:{' '}
                            {Math.round((it.suggested_equivalent_score || 0) * 100)}%)
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900">{it.description}</p>
                      {it.suggested_equivalent_desc ? (
                        <div className="text-xs bg-white rounded-lg p-2.5 border border-violet-200 text-slate-700">
                          <strong className="text-emerald-700">
                            Partida Codificada Sugerida ({it.suggested_equivalent_code}):
                          </strong>{' '}
                          {it.suggested_equivalent_desc}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-800 flex items-center gap-1.5">
                          <Info size={14} />
                          <span>
                            Partida especial sin equivalente cercano en el catálogo COVENIN/Maprex. Requiere revisión manual de insumos.
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
