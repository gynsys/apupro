import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  FolderOpen,
  Save,
  Copy,
  GitBranch,
  Database,
  Printer,
  X,
  Loader2,
  ArrowUpRight,
  Edit3,
  UserCheck,
  Building2,
  FileText,
  ListFilter,
  ListChecks,
  LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { budgetReviewService } from '../services/budgetReviewService';
import { budgetService } from '../../../services/budgetService';
import { useDatabase } from '../../../contexts/DatabaseContext';
import BudgetImportChoiceModal from '../../../components/modals/BudgetImportChoiceModal';

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
    label: 'Catálogo Histórico',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    cardClass: 'border-sky-200 bg-sky-50/40',
  },
};

const REVIEW_STATUS_CONFIG = {
  EN_REVISION: {
    label: 'En Revisión',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  CON_OBSERVACIONES: {
    label: 'Con Observaciones (Devuelto)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  CORREGIDO: {
    label: 'Corregido en Verificación',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  APROBADO: {
    label: 'Aprobado / Conforme',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  RECHAZADO: {
    label: 'Rechazado',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
};

const FINDING_STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente por corregir' },
  { value: 'CORREGIDO', label: 'Corregido / Subsanado' },
  { value: 'JUSTIFICADO', label: 'Justificado técnicamente' },
  { value: 'RECHAZADO', label: 'No aceptado / Rechazado' },
];

const ORIGIN_LABELS = {
  MAPREX_BASE_OR_EDIFICACIONES: 'Base Referencial Estándar (CodPar exacto)',
  COVENIN_MANTENIMIENTO_M: 'Norma COVENIN Mantenimiento (M)',
  COVENIN_URBANISMO_U: 'Norma COVENIN Urbanismo (U)',
  LULOWIN_IP3_REPARACIONES_R: 'Catálogo Reparaciones Vialidad/Obras (R)',
  LULOWIN_IP3_VIALIDAD_AMBIENTAL_A: 'Catálogo Vialidad y Ambiental (A)',
  CADAFE_REDES_ELECTRICAS_RA: 'Redes Eléctricas de Distribución (RA)',
  TORRES_TELECOM_ELECTRICIDAD: 'Catálogo Torres / Telecom (TOR)',
  CORPORATIVO_BANCA: 'Edificaciones Corporativas / Banca',
  SIN_CODIGO_COVENIN: 'Sin Codificación COVENIN (S/C)',
};

const RULE_HEADLINES = {
  // Mano de Obra
  'LAB-001': 'Cuadrilla alterada',
  'LAB-002': 'Categoría laboral omitida',
  // Materiales
  'MAT-001': 'Material maestro omitido',
  'MAT-002': 'Sobreconsumo de material',
  'MAT-003': 'Desperdicio excesivo de material',
  'MAT-004': 'Discrepancia en código de material',
  // Equipos y Depreciaciones
  'EQU-001': 'Equipo maestro omitido',
  'EQU-002': 'Equipo atípico en APU',
  'EQU-003': 'Omisión de depreciación',
  'EQU-004': 'Discrepancia en depreciación',
  // Rendimientos
  'REN-001': 'Rendimiento atípico / reducido',
  'REN-002': 'Rendimiento inflado',
  // Estructura y Duplicidad
  'EST-001': 'Falta de unidad de medida',
  'EST-002': 'Cómputo métrico inválido',
  'EST-003': 'Rendimiento nulo o inválido',
  'EST-004': 'Insumo duplicado en APU',
  'EST-005': 'Omisión total de materiales',
  'EST-006': 'Omisión total de mano de obra',
  'EST-007': 'Duplicidad de partida',
  'DUP-001': 'Duplicidad explícita',
  'COL-001': 'Colisión de código de partida',
  // Aritmética y Coherencia
  'ARI-001': 'Error aritmético en capítulo',
  'COH-001': 'Descuadre aritmético en APU',
  'UNC-001': 'APU no codificado observado',
};

const getFindingHeadline = (f) => {
  if (f.rule_id && RULE_HEADLINES[f.rule_id]) return RULE_HEADLINES[f.rule_id];
  if (f.category === 'MANO_OBRA') return 'Cuadrilla alterada';
  if (f.category === 'MATERIALES') return 'Desviación en consumo de material';
  if (f.category === 'EQUIPOS') return 'Discrepancia en equipo / depreciación';
  if (f.category === 'RENDIMIENTO') return 'Rendimiento atípico';
  if (f.category === 'COHERENCIA') return 'Error aritmético';
  if (f.category === 'SIN_CODIGO') return 'APU no codificado';
  if (f.category === 'ESTRUCTURA') return 'Duplicidad / estructura de partida';
  return 'Desviación técnica';
};

const cleanMessage = (msg) => (msg || '').trim().replace(/\.+$/, '');

const getEffectiveItemCode = (f, itemMap) => {
  if (f?.rule_id === 'ARI-001' && f?.item_code) return f.item_code;
  let covCode = f?.covenin_code;
  if (!covCode && itemMap && f?.review_item_id) {
    const it = itemMap.get(f.review_item_id);
    if (it && it.covenin_code && it.covenin_code.toUpperCase() !== 'S/C') {
      covCode = it.covenin_code;
    }
  }
  if (!covCode && itemMap && f?.item_code) {
    const it = itemMap.get(f.item_code) || itemMap.get(String(f.item_code).toUpperCase());
    if (it && it.covenin_code && it.covenin_code.toUpperCase() !== 'S/C') {
      covCode = it.covenin_code;
    }
  }
  return covCode || f?.item_code || '';
};

const getItemRef = (f, itemMap) => {
  if (f?.rule_id === 'ARI-001' && f?.item_code) return `Capítulo ${f.item_code}`;
  const code = getEffectiveItemCode(f, itemMap);
  return code ? `Partida ${code}` : 'Presupuesto General';
};

export default function BudgetReviewPage() {
  const { activeDatabase, databases } = useDatabase();

  // Filtrar bases de datos válidas para contraste (excluir 'personalizada' si se desea o mantener todas)
  const contrastDatabases = (databases || []).filter((d) => d.id !== 'personalizada');
  const hasBaseAgosto = contrastDatabases.some((d) => d.id === 'base_agosto');
  const availableDatabases = hasBaseAgosto
    ? contrastDatabases
    : [
        ...contrastDatabases,
        { id: 'base_agosto', name: 'Base Agosto', description: 'Base oficial Corte Agosto' },
      ];

  const [selectedDbId, setSelectedDbId] = useState(
    activeDatabase?.id && activeDatabase.id !== 'personalizada' ? activeDatabase.id : 'base_agosto'
  );
  const [snapshots, setSnapshots] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'items' | 'uncoded' | 'versions'
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [showUnchangedByItem, setShowUnchangedByItem] = useState({});

  // Estados de Modales CRUD (Abrir, Guardar, Guardar Como, Nueva Versión Corregida)
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openSearchQuery, setOpenSearchQuery] = useState('');
  const [openStatusFilter, setOpenStatusFilter] = useState('ALL');

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsMode, setSaveAsMode] = useState(false); // false = Guardar, true = Guardar Como
  const [formName, setFormName] = useState('');
  const [formProject, setFormProject] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formStatus, setFormStatus] = useState('EN_REVISION');
  const [formNotes, setFormNotes] = useState('');
  const [formReportCode, setFormReportCode] = useState('');
  const [formReviewerName, setFormReviewerName] = useState('');
  const [formReviewerCiv, setFormReviewerCiv] = useState('');
  const [formDocRef, setFormDocRef] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formConclusion, setFormConclusion] = useState('');
  const [findingViewMode, setFindingViewMode] = useState('executive'); // 'executive' (H-01...) | 'detailed'

  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionBudgetId, setNewVersionBudgetId] = useState('');
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [showImportChoiceModal, setShowImportChoiceModal] = useState(false);

  const fileInputRef = useRef(null);
  const correctionFileInputRef = useRef(null);

  const itemMap = useMemo(() => {
    const map = new Map();
    if (activeReport?.items) {
      activeReport.items.forEach((it) => {
        if (it.id) map.set(it.id, it);
        if (it.original_code) {
          map.set(it.original_code, it);
          map.set(it.original_code.toUpperCase(), it);
        }
        if (it.covenin_code) {
          map.set(it.covenin_code, it);
          map.set(it.covenin_code.toUpperCase(), it);
        }
      });
    }
    return map;
  }, [activeReport?.items]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const syncFormWithReport = (report) => {
    if (!report) return;
    setFormName(report.name || '');
    setFormProject(report.project_name || '');
    setFormClient(report.client_name || '');
    setFormStatus(report.review_status || 'EN_REVISION');
    setFormNotes(report.auditor_notes || '');
    setFormReportCode(report.report_code || '');
    setFormReviewerName(report.reviewer_name || '');
    setFormReviewerCiv(report.reviewer_civ || '');
    setFormDocRef(report.document_reference || '');
    setFormInstitution(report.institution_name || '');
    setFormConclusion(report.conclusion_text || '');
  };

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
        syncFormWithReport(latestDetail);
      }
    } catch (error) {
      console.error('Error cargando datos iniciales de auditoría:', error);
    } finally {
      setLoadingList(false);
    }
  };

  const getDatabaseLabel = (dbId) => {
    if (!dbId) return 'Base Maestra';
    if (dbId === 'base_agosto') return 'Base Agosto';
    if (dbId === 'master') return 'Base Maestra';
    const found = availableDatabases.find((d) => d.id === dbId);
    return found ? found.name : dbId;
  };

  const handleAuditExistingBudget = async () => {
    if (!selectedBudgetId) {
      toast.error('Selecciona un presupuesto para auditar');
      return;
    }
    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.auditExistingBudget(selectedBudgetId, selectedDbId);
      setActiveReport(detail);
      syncFormWithReport(detail);
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      toast.success(`Auditoría completada contra ${getDatabaseLabel(selectedDbId)}`);
    } catch (error) {
      toast.error(error.message || 'Error ejecutando la auditoría');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleImportChoiceSelect = async (file, mode) => {
    setShowImportChoiceModal(false);
    if (!file) return;

    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.auditUploadedFile(file, selectedDbId, {
        mode: mode || 'budget',
      });
      setActiveReport(detail);
      syncFormWithReport(detail);
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      toast.success(`Archivo "${file.name}" auditado contra ${getDatabaseLabel(selectedDbId)}`);
    } catch (error) {
      toast.error(error.message || 'Error al procesar el archivo para auditoría');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleImportChoiceSelect(file, 'budget');
  };

  // Subir o Auditar Nueva Versión Corregida (v2, v3...)
  const handleCorrectionFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeReport) return;

    setShowNewVersionModal(false);
    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.auditUploadedFile(
        file,
        activeReport.database_id || selectedDbId,
        {
          parentSnapshotId: activeReport.id,
          projectName: activeReport.project_name,
          clientName: activeReport.client_name,
          auditorNotes: newVersionNotes || undefined,
        }
      );
      setActiveReport(detail);
      syncFormWithReport(detail);
      setNewVersionNotes('');
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      toast.success(`Nueva versión v${detail.version_number} generada y comparada contra v${activeReport.version_number}`);
    } catch (error) {
      toast.error(error.message || 'Error al auditar la versión corregida');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleCorrectionExistingBudget = async () => {
    const targetBudgetId = newVersionBudgetId || activeReport?.source_budget_id;
    if (!targetBudgetId || !activeReport) {
      toast.error('Selecciona el presupuesto corregido a evaluar');
      return;
    }
    setShowNewVersionModal(false);
    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.auditExistingBudget(
        targetBudgetId,
        activeReport.database_id || selectedDbId,
        {
          parentSnapshotId: activeReport.id,
          projectName: activeReport.project_name,
          clientName: activeReport.client_name,
          auditorNotes: newVersionNotes || undefined,
        }
      );
      setActiveReport(detail);
      syncFormWithReport(detail);
      setNewVersionNotes('');
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      toast.success(`Nueva versión v${detail.version_number} auditada y comparada contra v${activeReport.version_number}`);
    } catch (error) {
      toast.error(error.message || 'Error al auditar la versión corregida');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleSelectSnapshot = async (snapshotId) => {
    setShowOpenModal(false);
    setRunningAudit(true);
    try {
      const detail = await budgetReviewService.getSnapshotDetail(snapshotId);
      setActiveReport(detail);
      syncFormWithReport(detail);
    } catch (error) {
      toast.error(error.message || 'Error al abrir el informe');
    } finally {
      setRunningAudit(false);
    }
  };

  const openSaveDialog = (isSaveAs = false) => {
    if (!activeReport) return;
    setSaveAsMode(isSaveAs);
    setFormName(isSaveAs ? `${activeReport.name} (Copia)` : activeReport.name || '');
    setFormProject(activeReport.project_name || '');
    setFormClient(activeReport.client_name || '');
    setFormStatus(activeReport.review_status || 'EN_REVISION');
    setFormNotes(activeReport.auditor_notes || '');
    setFormReportCode(isSaveAs ? '' : activeReport.report_code || '');
    setFormReviewerName(activeReport.reviewer_name || '');
    setFormReviewerCiv(activeReport.reviewer_civ || '');
    setFormDocRef(activeReport.document_reference || '');
    setFormInstitution(activeReport.institution_name || '');
    setFormConclusion(activeReport.conclusion_text || '');
    setShowSaveModal(true);
  };

  const handleConfirmSave = async (e) => {
    e.preventDefault();
    if (!activeReport) return;
    if (!formName.trim()) {
      toast.error('El nombre de la auditoría es obligatorio');
      return;
    }
    setSavingMeta(true);
    try {
      const payload = {
        name: formName.trim(),
        project_name: formProject.trim() || null,
        client_name: formClient.trim() || null,
        review_status: formStatus,
        auditor_notes: formNotes || null,
        report_code: formReportCode.trim() || null,
        reviewer_name: formReviewerName.trim() || null,
        reviewer_civ: formReviewerCiv.trim() || null,
        document_reference: formDocRef.trim() || null,
        institution_name: formInstitution.trim() || null,
        conclusion_text: formConclusion.trim() || null,
      };
      const updatedDetail = saveAsMode
        ? await budgetReviewService.saveSnapshotAs(activeReport.id, payload)
        : await budgetReviewService.saveSnapshot(activeReport.id, payload);

      setActiveReport(updatedDetail);
      syncFormWithReport(updatedDetail);
      const updatedSnaps = await budgetReviewService.listSnapshots();
      setSnapshots(updatedSnaps || []);
      setShowSaveModal(false);
      toast.success(
        saveAsMode
          ? `Auditoría guardada como "${updatedDetail.name}"`
          : 'Datos del informe y revisor guardados correctamente'
      );
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la auditoría');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleFindingStatusChange = async (findingId, newStatus) => {
    if (!activeReport) return;
    try {
      const updatedFinding = await budgetReviewService.updateFinding(activeReport.id, findingId, {
        finding_status: newStatus,
      });
      setActiveReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: (prev.findings || []).map((f) =>
            f.id === findingId ? { ...f, finding_status: updatedFinding.finding_status } : f
          ),
        };
      });
      toast.success('Estado del hallazgo actualizado');
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el estado del hallazgo');
    }
  };

  const handleDeleteSnapshot = async (snapshotId, event) => {
    if (event) event.stopPropagation();
    try {
      await budgetReviewService.deleteSnapshot(snapshotId);
      const remaining = snapshots.filter((s) => s.id !== snapshotId);
      setSnapshots(remaining);
      if (activeReport?.id === snapshotId) {
        if (remaining.length > 0) {
          const nextDetail = await budgetReviewService.getSnapshotDetail(remaining[0].id);
          setActiveReport(nextDetail);
          syncFormWithReport(nextDetail);
        } else {
          setActiveReport(null);
        }
      }
      toast.success('Auditoría eliminada');
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar');
    }
  };

  const handleDownloadExcel = async () => {
    if (!activeReport) return;
    setDownloadingExcel(true);
    try {
      const safeName = (activeReport.name || 'Presupuesto').replace(/[^a-zA-Z0-9_-]+/g, '_');
      await budgetReviewService.downloadExcelReport(
        activeReport.id,
        `Auditoria_${safeName}_v${activeReport.version_number || 1}.xlsx`
      );
      toast.success('Informe Excel descargado');
    } catch (error) {
      toast.error(error.message || 'Error al descargar el informe Excel');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const uniqueFindings = useMemo(() => {
    const raw = activeReport?.findings || [];
    const seen = new Set();
    const result = [];
    for (const f of raw) {
      // Deduplicar hallazgos idénticos sobre la misma regla e ítem (ej: EST-007 por código repetido en varias filas)
      const key = `${f.rule_id || ''}-${f.item_code || ''}-${f.component_code || ''}-${(f.message || '').trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(f);
      }
    }
    return result;
  }, [activeReport?.findings]);

  const filteredFindings = uniqueFindings.filter((f) => {
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

  const filteredOpenSnapshots = snapshots.filter((s) => {
    if (openStatusFilter !== 'ALL' && (s.review_status || 'EN_REVISION') !== openStatusFilter) {
      return false;
    }
    if (openSearchQuery.trim()) {
      const q = openSearchQuery.trim().toLowerCase();
      const text = `${s.name || ''} ${s.project_name || ''} ${s.client_name || ''} ${s.database_id || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const healthColor = (score = 100) => {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const currentStatusBadge =
    REVIEW_STATUS_CONFIG[activeReport?.review_status || 'EN_REVISION'] ||
    REVIEW_STATUS_CONFIG.EN_REVISION;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5">
      {/* =========================================================================
          1. VISTA INTERACTIVA WEB (OCULTA AUTOMÁTICAMENTE AL IMPRIMIR / PDF)
         ========================================================================= */}
      <div className="print:hidden space-y-5">
        {/* Encabezado Principal + Selector de Base de Datos + Acciones de Nueva Auditoría */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                <ShieldAlert size={22} />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
                Revisor de Presupuestos
              </h1>
            </div>
          </div>

          {/* Controles de Base de Datos y Nueva Auditoría en una sola fila */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 sm:gap-2.5">
            {/* Selector de Base de Datos de Contraste */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 shrink-0">
              <Database size={15} className="text-blue-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 leading-none">
                  Base de Contraste
                </span>
                <select
                  value={selectedDbId}
                  onChange={(e) => setSelectedDbId(e.target.value)}
                  disabled={runningAudit}
                  className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {availableDatabases.map((dbItem) => (
                    <option key={dbItem.id} value={dbItem.id}>
                      {dbItem.id === 'base_agosto'
                        ? 'Base Agosto (12.652 partidas)'
                        : dbItem.id === 'master'
                        ? `${dbItem.name} (18.880 partidas)`
                        : dbItem.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Presupuesto existente + Auditar + Cargar (Agrupados para que Cargar nunca quede aislado) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={selectedBudgetId}
                onChange={(e) => setSelectedBudgetId(e.target.value)}
                disabled={runningAudit}
                className="px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-44 truncate"
              >
                <option value="">Presupuesto en sistema...</option>
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
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {runningAudit ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />}
                <span>Auditar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImportChoiceModal(true)}
                disabled={runningAudit}
                title="Cargar archivo Excel, LuloWin o PDF"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <UploadCloud size={16} />
                <span>Cargar</span>
              </button>
            </div>

            {/* Cargar Archivo input nativo */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS CRUD DE AUDITORÍAS (Abrir, Guardar, Guardar Como, Revisar Corrección, Exportar) */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOpenModal(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FolderOpen size={15} className="text-blue-600" />
              <span>Abrir Auditoría ({snapshots.length})</span>
            </button>

            {activeReport && (
              <>
                <button
                  type="button"
                  onClick={() => openSaveDialog(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Save size={15} className="text-emerald-600" />
                  <span>Guardar</span>
                </button>

                <button
                  type="button"
                  onClick={() => openSaveDialog(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Copy size={15} className="text-indigo-600" />
                  <span>Guardar Como...</span>
                </button>
              </>
            )}
          </div>

          {activeReport && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewVersionBudgetId(activeReport.source_budget_id || '');
                  setShowNewVersionModal(true);
                }}
                title={`Revisar Corrección (Nueva Versión v${(activeReport.version_number || 1) + 1})`}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center cursor-pointer shadow-2xs transition"
              >
                <GitBranch size={16} />
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={downloadingExcel}
                title="Descargar Informe Excel (.xlsx)"
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer shadow-2xs transition"
              >
                {downloadingExcel ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const prevTitle = document.title;
                  document.title = activeReport?.report_code
                    ? `Informe_${activeReport.report_code}`
                    : 'Informe_Revision_Presupuesto';
                  window.print();
                  setTimeout(() => {
                    document.title = prevTitle;
                  }, 800);
                }}
                title="Imprimir / Exportar a PDF"
                className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer shadow-2xs transition"
              >
                <Printer size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Estado de Carga o Vacío */}
      {(loadingList || runningAudit) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center justify-center gap-3 text-slate-600">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm font-semibold">
            Analizando partidas, rendimientos, depreciaciones y recetas APU contra{' '}
            {getDatabaseLabel(selectedDbId)}...
          </p>
        </div>
      )}

      {!loadingList && !runningAudit && !activeReport && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <FileSpreadsheet size={40} className="mx-auto text-slate-400" />
          <h2 className="text-base font-bold text-slate-800">
            Selecciona o importa un presupuesto para iniciar la auditoría
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Elige la base de datos de referencia arriba (ej. <strong>Base Agosto</strong> o{' '}
            <strong>Base Maestra</strong>), selecciona un presupuesto o sube el archivo Excel/PDF entregado por la contratista.
          </p>
        </div>
      )}

      {/* Panel del Informe Activo */}
      {!runningAudit && activeReport && (
        <>
          {/* TARJETA OFICIAL: INFORME DE REVISIÓN TÉCNICA DE PRESUPUESTO */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  INFORME DE REVISIÓN TÉCNICA DE PRESUPUESTO
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono font-black text-sm text-slate-900 border-2 border-slate-900 px-3 py-1 rounded-lg bg-slate-50 shadow-2xs">
                    {activeReport.report_code || `RT-${new Date(activeReport.created_at).getFullYear()}-001`}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-bold">
                    Versión {activeReport.version_number || 1} · {new Date(activeReport.created_at).toLocaleDateString('es-VE')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openSaveDialog(false)}
                  className="px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                >
                  <Edit3 size={14} className="text-blue-700" />
                  <span className="hidden sm:inline">Editar Datos del Revisor / Informe</span>
                </button>
              </div>
            </div>

            {/* Metadatos Ejecutivos en Viñetas (Sin duplicar el código de informe) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-800 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1.5">
                <div>
                  <span className="font-bold text-slate-900">• Obra:</span>{' '}
                  <span className="font-medium">{activeReport.project_name || 'Sin especificar'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">• Empresa:</span>{' '}
                  <span className="font-medium">{activeReport.client_name || 'Sin especificar'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">• Estado del Dictamen:</span>{' '}
                  <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${currentStatusBadge.badgeClass}`}>
                    {currentStatusBadge.label} (v{activeReport.version_number || 1})
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="font-bold text-slate-900">• Documento:</span>{' '}
                  <span className="font-medium">{activeReport.document_reference || activeReport.source_filename || `Presupuesto de Obra — v${activeReport.version_number}`}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">• Revisión:</span>{' '}
                  <span>
                    {new Date(activeReport.created_at).toLocaleDateString('es-VE')} |{' '}
                    <strong>{activeReport.reviewer_name || 'Ing. Revisor'}</strong>
                    {activeReport.reviewer_civ ? `, CIV ${activeReport.reviewer_civ}` : ''}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">• Base de Contraste:</span>{' '}
                  <span className="font-bold text-blue-700">{getDatabaseLabel(activeReport.database_id)}</span>
                </div>
                {activeReport.institution_name && (
                  <div>
                    <span className="font-bold text-slate-900">• Institución:</span>{' '}
                    <span className="font-medium">{activeReport.institution_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Alcance de la Revisión */}
            <div className="px-4 py-2.5 rounded-xl bg-blue-50/50 border border-blue-200 text-xs sm:text-sm text-blue-950 font-medium">
              Se revisó el <strong>100%</strong> del presupuesto (<strong>{activeReport.chapters_count || 0}</strong> capítulos,{' '}
              <strong>{activeReport.total_items}</strong> partidas y <strong>{activeReport.total_items}</strong> APUs analizados).
            </div>

            {/* Matriz de Hallazgos Técnicos */}
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <ListFilter size={16} className="text-blue-600" />
                <span>Matriz de hallazgos técnicos</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-500 block text-[11px] font-bold uppercase">• Partidas revisadas:</span>
                  <span className="text-base font-black text-slate-900">{activeReport.total_items}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-500 block text-[11px] font-bold uppercase">• APUs analizados:</span>
                  <span className="text-base font-black text-slate-900">{activeReport.total_items}</span>{' '}
                  <span className="text-xs text-slate-600">
                    ({activeReport.coded_items_count} codificados COVENIN / {activeReport.uncoded_items_count} sin codificación)
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-500 block text-[11px] font-bold uppercase">• Errores / Desviaciones:</span>
                  <span className="text-base font-black text-red-700">
                    {activeReport.critical_findings_count + activeReport.high_findings_count + activeReport.medium_findings_count}
                  </span>{' '}
                  <span className="text-xs text-slate-600">
                    ({activeReport.critical_findings_count} Críticas, {activeReport.high_findings_count} Altas, {activeReport.medium_findings_count} Medias)
                  </span>
                </div>
              </div>
            </div>

            {/* Conclusión preliminar / dictamen técnico */}
            <div className={`p-4 rounded-xl border-l-4 text-xs sm:text-sm leading-relaxed ${
              activeReport.critical_findings_count > 0 || activeReport.high_findings_count > 0
                ? 'bg-amber-50/80 border-amber-500 text-amber-950'
                : 'bg-emerald-50/80 border-emerald-500 text-emerald-950'
            }`}>
              <span className="font-extrabold uppercase tracking-wide block mb-1">
                Conclusión preliminar / Dictamen Técnico:
              </span>
              <p className="m-0 font-medium">
                {activeReport.conclusion_text || 'Sin dictamen registrado.'}
              </p>
            </div>

            {/* Selector de Versiones del mismo Expediente (v1, v2, v3...) */}
            {activeReport.version_history && activeReport.version_history.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 p-2 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase px-1">
                  Historial de Versiones:
                </span>
                {activeReport.version_history.map((ver) => {
                  const isCurr = ver.id === activeReport.id;
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => handleSelectSnapshot(ver.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        isCurr
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>v{ver.version_number}</span>
                      <span className="text-[10px] opacity-85">({ver.health_score}%)</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Banner de Comparativa Automática entre Versiones */}
            {activeReport.version_comparison && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900 uppercase">
                    <GitBranch size={15} className="text-emerald-700" />
                    <span>
                      Verificación de Correcciones vs. Versión Anterior (v
                      {activeReport.version_comparison.previous_version_number})
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    Índice de salud pasó de{' '}
                    <strong>{activeReport.version_comparison.previous_health_score}%</strong> a{' '}
                    <strong>{activeReport.health_score}%</strong> (
                    <span
                      className={
                        activeReport.version_comparison.health_delta >= 0
                          ? 'text-emerald-700 font-bold'
                          : 'text-red-700 font-bold'
                      }
                    >
                      {activeReport.version_comparison.health_delta >= 0
                        ? `+${activeReport.version_comparison.health_delta}%`
                        : `${activeReport.version_comparison.health_delta}%`}
                    </span>
                    ).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold border border-emerald-300">
                    ✓ {activeReport.version_comparison.resolved_findings_count} Corregidos
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-extrabold border border-amber-300">
                    ⚠ {activeReport.version_comparison.persistent_findings_count} Sin Corregir
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-900 font-extrabold border border-red-300">
                    + {activeReport.version_comparison.new_findings_count} Nuevos
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('versions')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Detalle de Correcciones</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

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
                Catálogo Histórico
              </span>
              <div className="text-2xl font-black text-sky-700 mt-1">
                {activeReport.info_findings_count}
              </div>
              <span className="text-[11px] text-slate-500">Dif. entre bases de fechas</span>
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
                  Partidas Especiales / APUs No Codificados ({uncodedItems.length})
                </button>
                {activeReport.version_comparison && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('versions')}
                    className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                      activeTab === 'versions'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Correcciones Subsanadas (
                    {activeReport.version_comparison.resolved_findings_count})
                  </button>
                )}
              </div>

              {activeTab === 'findings' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 sm:pb-1">
                  <div className="flex flex-wrap items-center gap-2">
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
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar código o insumo..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFindingViewMode('executive')}
                        title="Detalle de correcciones (H-01...)"
                        className={`p-1.5 rounded-md flex items-center justify-center transition cursor-pointer ${
                          findingViewMode === 'executive'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <ListChecks size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFindingViewMode('detailed')}
                        title="Fichas técnicas con valores de presupuesto vs base de contraste"
                        className={`p-1.5 rounded-md flex items-center justify-center transition cursor-pointer ${
                          findingViewMode === 'detailed'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <LayoutGrid size={15} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!filteredFindings.length) return;
                        const text = filteredFindings
                          .map((f, i) => {
                            const hCode = `H-${String(i + 1).padStart(2, '0')}`;
                            const sev = SEVERITY_CONFIG[f.severity]?.label || 'Media';
                            const headline = getFindingHeadline(f);
                            const itemRef = getItemRef(f, itemMap);
                            return `• ${hCode} (${sev}) — ${headline} (${itemRef}): ${cleanMessage(f.message)}.`;
                          })
                          .join('\n');
                        navigator.clipboard.writeText(`Detalle de correcciones:\n\n${text}`);
                        toast.success('Lista copiada al portapapeles');
                      }}
                      className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer transition shadow-2xs"
                      title="Copiar lista de correcciones al portapapeles"
                    >
                      <Copy size={15} />
                    </button>
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
                ) : findingViewMode === 'executive' ? (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-wide uppercase">
                          Detalle de correcciones:
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {filteredFindings.length} hallazgo{filteredFindings.length !== 1 ? 's' : ''} registrado{filteredFindings.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 divide-y divide-slate-100 space-y-1">
                      {filteredFindings.map((f, i) => {
                        const hCode = `H-${String(i + 1).padStart(2, '0')}`;
                        const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.MEDIA;
                        const headline = getFindingHeadline(f);
                        const itemRef = getItemRef(f, itemMap);
                        return (
                          <div
                            key={f.id}
                            className="pt-3 pb-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs sm:text-sm leading-relaxed"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div>
                                <span className="text-slate-400 font-black mr-1.5">•</span>
                                <span className="font-extrabold text-slate-900 mr-1.5">{hCode}</span>
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase mr-1.5 border ${sev.badgeClass}`}
                                >
                                  ({sev.label})
                                </span>
                                <span className="font-extrabold text-slate-900 mr-1">
                                  — {headline}
                                </span>
                                <span className="font-bold text-blue-700 mr-1.5">
                                  ({itemRef}):
                                </span>
                                <span className="text-slate-700 font-medium">
                                  {cleanMessage(f.message)}.
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-start">
                              <select
                                value={f.finding_status || 'PENDIENTE'}
                                onChange={(e) => handleFindingStatusChange(f.id, e.target.value)}
                                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-slate-50 text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                {FINDING_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                              Partida: {getEffectiveItemCode(f, itemMap) || 'S/C'}
                            </span>
                            {f.component_code && (
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                Insumo: {f.component_code}{' '}
                                {f.component_description ? `— ${f.component_description}` : ''}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
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

                            {/* Selector de Estado de Revisión del Hallazgo */}
                            <select
                              value={f.finding_status || 'PENDIENTE'}
                              onChange={(e) => handleFindingStatusChange(f.id, e.target.value)}
                              className="px-2 py-0.5 text-[11px] font-bold rounded-md border border-slate-300 bg-white text-slate-800 cursor-pointer"
                            >
                              {FINDING_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
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
                              Valor en {getDatabaseLabel(activeReport.database_id)}
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
                      Mostrando únicamente las <strong>{discrepantItems.length}</strong> partida(s) con
                      discrepancias detectadas. Se omitieron <strong>{cleanItemsCount}</strong>{' '}
                      partida(s) que coinciden sin fallas con {getDatabaseLabel(activeReport.database_id)}.
                    </span>
                  </div>
                )}

                {discrepantItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    Las {nonChapterItems.length} partidas del presupuesto coinciden al 100% con la
                    estructura de {getDatabaseLabel(activeReport.database_id)} (0 discrepancias).
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
                        Math.abs(Number(it.performance || 0) - Number(it.master_performance || 0)) >
                          0.001;

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
                                    Base: {it.matched_master_code} (
                                    {Math.round(it.description_similarity * 100)}% sim.)
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
                                    ? `(Base: ${it.master_unit})`
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
                                  Rendimiento (Imp / Base)
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
                                  <strong>Descripción en Base ({it.matched_master_code}):</strong>{' '}
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
                                      Todos los insumos del APU coinciden con la base (la discrepancia de
                                      esta partida está en rendimiento, unidad o cabecera).
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-600 text-left">
                                            <th className="p-2 font-bold">Tipo</th>
                                            <th className="p-2 font-bold">Código Imp.</th>
                                            <th className="p-2 font-bold">Código Base</th>
                                            <th className="p-2 font-bold">Descripción</th>
                                            <th className="p-2 font-bold text-right">Cant. Imp.</th>
                                            <th className="p-2 font-bold text-right">Cant. Base</th>
                                            <th className="p-2 font-bold text-right">
                                              Desp. / Deprec Imp.
                                            </th>
                                            <th className="p-2 font-bold text-right">
                                              Desp. / Deprec Base
                                            </th>
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
                                                  {comp.master_quantity ?? 'Extra (No en base)'}
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
                                  Esta partida fue cargada desde hoja resumen sin desglose interno de
                                  insumos APU.
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

            {/* PESTAÑA 3: PARTIDAS ESPECIALES Y APUs NO CODIFICADOS */}
            {activeTab === 'uncoded' && (
              <div className="p-4 space-y-3">
                {uncodedItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    Todas las partidas de este presupuesto tienen código reconocido en la base de
                    referencia.
                  </div>
                ) : (
                  uncodedItems.map((it) => {
                    const isObserved = it.ai_audit_status === 'OBSERVADO';
                    return (
                      <div
                        key={it.id}
                        className={`rounded-2xl border p-4 space-y-2.5 transition ${
                          isObserved
                            ? 'border-amber-200 bg-amber-50/40'
                            : 'border-emerald-200 bg-emerald-50/30'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-extrabold text-xs">
                              Fila #{it.row_number} · {it.original_code || 'S/C'} ({it.unit})
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-md border text-xs font-bold ${
                                isObserved
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                            >
                              {isObserved
                                ? 'APU Especial Observado'
                                : 'APU Especial Conforme'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-600">
                            Rendimiento: {it.performance} {it.unit}/día
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                          {it.description}
                        </p>

                        <div className="text-xs rounded-xl p-3 bg-white border border-slate-200 text-slate-800 space-y-1">
                          <div className="font-extrabold flex items-center gap-1.5 text-slate-900">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isObserved ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            ></span>
                            <span>Dictamen de Estructura APU:</span>
                          </div>
                          <p className="m-0 text-slate-700 leading-relaxed font-medium">
                            {it.ai_audit_summary ||
                              'APU especial técnicamente estructurado y justificado con insumos coherentes.'}
                          </p>
                        </div>

                        {it.components && it.components.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-2 text-[11px] text-slate-600">
                            <span className="font-bold text-slate-700">Composición APU:</span>
                            <span>
                              {it.components.filter((c) => c.component_type === 'material').length}{' '}
                              materiales
                            </span>
                            <span>•</span>
                            <span>
                              {it.components.filter((c) => c.component_type === 'labor').length}{' '}
                              mano de obra
                            </span>
                            <span>•</span>
                            <span>
                              {it.components.filter((c) => c.component_type === 'equipment').length}{' '}
                              equipos
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* PESTAÑA 4: CORRECCIONES SUBSANADAS ENTRE VERSIONES */}
            {activeTab === 'versions' && activeReport.version_comparison && (
              <div className="p-4 space-y-3">
                {(activeReport.version_comparison.resolved_findings || []).length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    No se detectaron hallazgos subsanados respecto a la versión v
                    {activeReport.version_comparison.previous_version_number}.
                  </div>
                ) : (
                  activeReport.version_comparison.resolved_findings.map((rf, idx) => (
                    <div
                      key={`${rf.rule_id}-${rf.item_code}-${idx}`}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-extrabold">
                            CORREGIDO EN v{activeReport.version_number}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            Partida: {getEffectiveItemCode(rf, itemMap) || rf.item_code} · Regla {rf.rule_id} ({rf.category})
                          </span>
                          {rf.component_code && (
                            <span className="text-xs font-semibold text-emerald-800">
                              Insumo: {rf.component_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-700">{rf.message}</p>
                      <div className="text-[11px] text-slate-600 flex flex-wrap gap-4">
                        <span>
                          <strong>Valor en v{activeReport.version_comparison.previous_version_number}:</strong>{' '}
                          {rf.previous_imported_value || '-'}
                        </span>
                        <span>
                          <strong>Valor Base Exigido:</strong> {rf.master_value || '-'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL 1: ABRIR AUDITORÍA (CRUD Read / Open / Delete) */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Abrir Expediente de Auditoría ({snapshots.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 bg-slate-50">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={openSearchQuery}
                  onChange={(e) => setOpenSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, obra, contratista o base de datos..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={openStatusFilter}
                onChange={(e) => setOpenStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-semibold text-slate-700"
              >
                <option value="ALL">Todos los estados</option>
                {Object.entries(REVIEW_STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredOpenSnapshots.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No se encontraron auditorías guardadas con ese criterio.
                </div>
              ) : (
                filteredOpenSnapshots.map((snap) => {
                  const stCfg =
                    REVIEW_STATUS_CONFIG[snap.review_status || 'EN_REVISION'] ||
                    REVIEW_STATUS_CONFIG.EN_REVISION;
                  const isCurrent = activeReport?.id === snap.id;
                  return (
                    <div
                      key={snap.id}
                      onClick={() => handleSelectSnapshot(snap.id)}
                      className={`p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition ${
                        isCurrent ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-extrabold">
                            v{snap.version_number || 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${stCfg.badgeClass}`}
                          >
                            {stCfg.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                            {getDatabaseLabel(snap.database_id)}
                          </span>
                          <span className="font-extrabold text-sm text-slate-900 truncate">
                            {snap.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                          {snap.project_name && <span>Obra: {snap.project_name}</span>}
                          {snap.client_name && <span>Contratista: {snap.client_name}</span>}
                          <span>{snap.total_items} partidas</span>
                          <span>{new Date(snap.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Salud
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {snap.health_score}%
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                          title="Eliminar auditoría"
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GUARDAR / GUARDAR COMO (CRUD Update & Clone) */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmSave}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {saveAsMode ? (
                  <Copy size={18} className="text-indigo-600" />
                ) : (
                  <Save size={18} className="text-emerald-600" />
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {saveAsMode ? 'Guardar Auditoría Como (Nueva Copia)' : 'Guardar Datos Oficiales del Informe'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configura los datos del informe ejecutivo, revisor técnico y dictamen institucional.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs sm:text-sm overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Código de Informe Oficial
                  </label>
                  <input
                    type="text"
                    value={formReportCode}
                    onChange={(e) => setFormReportCode(e.target.value)}
                    placeholder="Ej. RT-2026-018"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Documento Evaluado (Ref. / Fecha)
                  </label>
                  <input
                    type="text"
                    value={formDocRef}
                    onChange={(e) => setFormDocRef(e.target.value)}
                    placeholder="Ej. Presupuesto de Obra — Versión 03 (28/10/2026)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre del Registro / Expediente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Institución / Ente Contratante
                  </label>
                  <input
                    type="text"
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    placeholder="Ej. Gobernación / Alcaldía / Ente Público..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Obra / Proyecto</label>
                  <input
                    type="text"
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    placeholder="Ej. Rehabilitación de Edificio Administrativo..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Empresa / Contratista
                  </label>
                  <input
                    type="text"
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    placeholder="Ej. Constructora Ejemplo, C.A."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ing. Revisor Técnico
                  </label>
                  <input
                    type="text"
                    value={formReviewerName}
                    onChange={(e) => setFormReviewerName(e.target.value)}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    CIV del Ingeniero Revisor
                  </label>
                  <input
                    type="text"
                    value={formReviewerCiv}
                    onChange={(e) => setFormReviewerCiv(e.target.value)}
                    placeholder="Ej. 184.920"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Estado Oficial del Expediente
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                >
                  {Object.entries(REVIEW_STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Conclusión Preliminar del Informe Técnico
                </label>
                <textarea
                  rows={3}
                  value={formConclusion}
                  onChange={(e) => setFormConclusion(e.target.value)}
                  placeholder="Texto oficial de conclusión (se genera automáticamente con los hallazgos o puedes redactar tu propio dictamen)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dictamen / Observaciones Adicionales
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Anota observaciones particulares, requerimientos para la próxima entrega o instrucciones..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingMeta}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {savingMeta ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saveAsMode ? 'Guardar Nueva Copia' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: NUEVA VERSIÓN / RE-AUDITAR CORRECCIONES ENTREGADAS POR LA EMPRESA */}
      {showNewVersionModal && activeReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch size={18} className="text-amber-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Auditar Correcciones (Crear Versión v{(activeReport.version_number || 1) + 1})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewVersionModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              <p className="text-slate-600">
                Cuando la empresa contratista entrega el presupuesto corregido, cárgpalo aquí. El sistema lo
                evaluará contra <strong>{getDatabaseLabel(activeReport.database_id)}</strong> y comparará
                automáticamente qué hallazgos de la <strong>v{activeReport.version_number}</strong> fueron
                subsanados y cuáles persisten.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nota de recepción de correcciones (opcional)
                </label>
                <input
                  type="text"
                  value={newVersionNotes}
                  onChange={(e) => setNewVersionNotes(e.target.value)}
                  placeholder="Ej. Segunda entrega corregida por el contratista..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50">
                <span className="font-bold text-slate-800 block">
                  Opción A: Subir archivo Excel / PDF corregido por la contratista
                </span>
                <input
                  ref={correctionFileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.xls,.csv,.pdf"
                  onChange={handleCorrectionFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => correctionFileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UploadCloud size={16} />
                  <span>Seleccionar Archivo Corregido y Comparar</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50">
                <span className="font-bold text-slate-800 block">
                  Opción B: Evaluar presupuesto corregido dentro del sistema
                </span>
                <div className="flex gap-2">
                  <select
                    value={newVersionBudgetId}
                    onChange={(e) => setNewVersionBudgetId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="">Seleccionar presupuesto...</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCorrectionExistingBudget}
                    disabled={!newVersionBudgetId}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    Re-Auditar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal compartido: Importar Presupuesto desde Archivo (Libro de APUs / Presupuesto / Cómputos) */}
      <BudgetImportChoiceModal
        isOpen={showImportChoiceModal}
        onClose={() => setShowImportChoiceModal(false)}
        onSelectMode={handleImportChoiceSelect}
      />
    </div>
    {/* FIN DE VISTA INTERACTIVA WEB (print:hidden) */}

    {/* =========================================================================
        2. INFORME TÉCNICO EJECUTIVO OFICIAL (EXCLUSIVO PARA IMPRESIÓN Y PDF)
       ========================================================================= */}
    {activeReport && (
      <div
        id="print-budget-review-layout"
        className="hidden print:block w-full bg-white text-slate-900 font-sans text-xs leading-normal p-[14mm]"
      >
        {/* Configuración de página e impresión sin encabezados de navegador */}
        <style>{`
          @page {
            size: letter portrait;
            margin: 0;
          }
          @media print {
            html, body, #root, #root > div, main {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color: #0f172a !important;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
            }
            #print-budget-review-layout {
              display: block !important;
              padding: 14mm !important;
              background: #ffffff !important;
              color: #0f172a !important;
              width: 100% !important;
            }
            .print-avoid-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>

        {/* Encabezado Oficial */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 print-avoid-break">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                INFORME DE REVISIÓN TÉCNICA DE PRESUPUESTO
              </h1>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-black text-sm text-slate-900 border-2 border-slate-900 px-3 py-1 rounded-lg bg-slate-50">
                {activeReport.report_code || `RT-${new Date(activeReport.created_at).getFullYear()}-001`}
              </div>
              <span className="text-[10px] text-slate-600 block mt-0.5 font-bold">
                Versión {activeReport.version_number || 1} · {new Date(activeReport.created_at).toLocaleDateString('es-VE')}
              </span>
            </div>
          </div>
        </div>

        {/* Ficha de Identificación del Expediente (Viñetas Oficiales sin duplicar código) */}
        <div className="border border-slate-300 rounded-lg p-3.5 mb-4 print-avoid-break bg-slate-50/60">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <div>
              <span className="font-bold text-slate-900">• Obra:</span>{' '}
              <span className="font-medium">{activeReport.project_name || 'Sin especificar'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">• Documento:</span>{' '}
              <span className="font-medium">
                {activeReport.document_reference || activeReport.source_filename || `Presupuesto de Obra — v${activeReport.version_number}`}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-900">• Empresa:</span>{' '}
              <span className="font-medium">{activeReport.client_name || 'Sin especificar'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">• Revisión:</span>{' '}
              <span>
                {new Date(activeReport.created_at).toLocaleDateString('es-VE')} |{' '}
                <strong>{activeReport.reviewer_name || 'Ing. Revisor'}</strong>
                {activeReport.reviewer_civ ? `, CIV ${activeReport.reviewer_civ}` : ''}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-900">• Estado del Dictamen:</span>{' '}
              <span className="font-bold uppercase text-slate-900">
                {currentStatusBadge.label}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-900">• Base de Contraste:</span>{' '}
              <span className="font-bold text-slate-900">{getDatabaseLabel(activeReport.database_id)}</span>
            </div>
            {activeReport.institution_name && (
              <div>
                <span className="font-bold text-slate-900">• Institución:</span>{' '}
                <span className="font-medium">{activeReport.institution_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Alcance de la Revisión */}
        <div className="mb-4 print-avoid-break">
          <div className="border-l-4 border-slate-900 bg-slate-100/70 px-3 py-1.5 text-xs text-slate-900 font-medium">
            Se revisó el <strong>100%</strong> del presupuesto (<strong>{activeReport.chapters_count || 0}</strong> capítulos,{' '}
            <strong>{activeReport.total_items}</strong> partidas y <strong>{activeReport.total_items}</strong> APUs analizados).
          </div>
        </div>

        {/* Matriz de Hallazgos Técnicos */}
        <div className="border border-slate-300 rounded-lg p-3 mb-4 print-avoid-break">
          <div className="font-black text-[11px] uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
            Matriz de hallazgos técnicos
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">• Partidas revisadas:</span>
              <span className="text-base font-black text-slate-900">{activeReport.total_items}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">• APUs analizados:</span>
              <span className="text-base font-black text-slate-900">{activeReport.total_items}</span>{' '}
              <span className="text-[10px] text-slate-600 block">
                ({activeReport.coded_items_count} codificados COVENIN / {activeReport.uncoded_items_count} sin codificación)
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">• Errores detectados:</span>
              <span className="text-base font-black text-red-700">
                {activeReport.critical_findings_count + activeReport.high_findings_count + activeReport.medium_findings_count}
              </span>{' '}
              <span className="text-[10px] text-slate-600 block">
                ({activeReport.critical_findings_count} Críticas, {activeReport.high_findings_count} Altas, {activeReport.medium_findings_count} Medias)
              </span>
            </div>
          </div>
        </div>

        {/* Conclusión preliminar / Dictamen Técnico */}
        <div className="border-l-4 border-slate-900 bg-slate-50 p-3 mb-4 print-avoid-break text-xs">
          <span className="font-black uppercase tracking-wider text-slate-900 block mb-1">
            Conclusión preliminar:
          </span>
          <p className="m-0 leading-relaxed text-slate-800 font-medium">
            {activeReport.conclusion_text ||
              'El presupuesto no es apto para aprobación inmediata. Presenta desviaciones estructurales que deben ser subsanadas previo a su tramitación contractual o financiera.'}
          </p>
        </div>

        {/* Detalle de Correcciones */}
        <div className="mb-6">
          <div className="font-black text-xs uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 print-avoid-break">
            Detalle de correcciones:
          </div>

          <div className="space-y-2 text-xs">
            {uniqueFindings && uniqueFindings.length > 0 ? (
              uniqueFindings.map((f, i) => {
                const hCode = `H-${String(i + 1).padStart(2, '0')}`;
                const sev = SEVERITY_CONFIG[f.severity]?.label || 'Media';
                const headline = getFindingHeadline(f);
                const itemRef = getItemRef(f, itemMap);
                return (
                  <div
                    key={f.id}
                    className="print-avoid-break pb-2 border-b border-slate-200 text-xs leading-relaxed"
                  >
                    <div>
                      <span className="font-black text-slate-900 mr-1">• {hCode}</span>
                      <span className="font-bold text-slate-700 uppercase mr-1">({sev})</span>
                      <span className="font-extrabold text-slate-900 mr-1">— {headline}</span>
                      <span className="font-bold text-blue-900 mr-1.5">({itemRef}):</span>
                      <span className="text-slate-800 font-medium">{cleanMessage(f.message)}.</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 italic py-2">
                No se detectaron discrepancias técnicas con respecto a la base de contraste seleccionada.
              </div>
            )}
          </div>
        </div>

        {/* Firmas y Conformidad Técnica */}
        <div className="pt-8 mt-6 border-t-2 border-slate-400 print-avoid-break">
          <div className="grid grid-cols-2 gap-10 text-center text-xs">
            <div>
              <div className="border-b border-slate-900 w-3/4 mx-auto mb-2 h-14 flex items-end justify-center">
                {/* Firma manuscrita */}
              </div>
              <div className="font-black text-slate-900 text-sm">
                {activeReport.reviewer_name || 'Ingeniero Revisor'}
              </div>
              <div className="font-mono text-slate-700 text-xs font-semibold">
                {activeReport.reviewer_civ ? `CIV: ${activeReport.reviewer_civ}` : 'Colegio de Ingenieros de Venezuela'}
              </div>
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                Revisor Técnico / Auditor de Presupuesto
              </div>
            </div>

            <div>
              <div className="border-b border-slate-900 w-3/4 mx-auto mb-2 h-14 flex items-end justify-center">
                {/* Sello institucional */}
              </div>
              <div className="font-black text-slate-900 text-sm">
                {activeReport.institution_name || 'Ente Contratante / Institución'}
              </div>
              <div className="text-slate-700 text-xs font-semibold">
                Dirección de Control de Obras y Proyectos
              </div>
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                Firma y Sello Oficial de Conformidad
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
