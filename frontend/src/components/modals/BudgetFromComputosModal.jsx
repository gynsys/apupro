import React, { useState, useRef, useEffect, useContext, useMemo, useCallback, useReducer } from 'react';
import { toast } from 'react-hot-toast';
import {
  Send,
  X,
  Sparkles,
  CheckCircle2,
  FolderPlus,
  Calculator,
  ClipboardList,
  Trash2,
  Loader2,
  Layers,
  FileCheck2,
  RefreshCw,
  HelpCircle,
  RotateCcw,
  Table,
  Edit3,
  Plus,
  Save,
  Copy,
  Info,
  FolderOpen,
  Search,
  Database,
  AlertTriangle,
  Check,
  Printer,
  FileSpreadsheet,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Split,
} from 'lucide-react';
import BudgetSearchModal from '../../pages/admin/budget_worksheet/BudgetSearchModal';
import MathQuantityInput from '../../pages/admin/budget_worksheet/MathQuantityInput';
import PartidasCalibrationModal from './PartidasCalibrationModal';
import { auditDescription, generateEnrichedSuggestion } from '../../utils/descriptionAuditor';
import { useDatabaseContext } from '../../contexts/DatabaseContext';
import { useCostbaseSearch as useCost360Search } from '../../modules/costbase/hooks/useCostbaseSearch';
import { SiteConfigContext } from '../../App';

import {
  COMMON_UNITS,
  normalizeUnitStr,
  inferUnitFromDescription,
} from '../../modules/computos/domain/units.js';
import {
  CHAPTER_PREFIX_RE,
  PURE_UNIT_LINE_RE,
  MEASURE_TRAILING_RE,
} from '../../modules/computos/domain/patterns.js';
import {
  recomputeRow,
} from '../../modules/computos/domain/formulas.js';
import {
  createBlankRow,
  isItemEmpty,
  extractCoveninSearchKeywords,
  normalizeRowsWithSingleTrailingBlank,
} from '../../modules/computos/domain/rows.js';
import {
  DRAFT_STORAGE_KEY,
  SAVED_LIST_STORAGE_KEY,
  getSavedComputosList,
  hasOpenedComputos,
  markComputosOpened,
} from '../../modules/computos/services/computosStorage.js';
import {
  getAllBudgets,
  getComputosDrafts,
  saveComputosDraft,
  deleteComputosDraft,
  exportComputosExcel,
  resolveComputo,
  commitComputoImport,
} from '../../modules/computos/services/computosApi.js';
import { createRowsState, rowsReducer } from '../../modules/computos/state/rowsReducer.js';
import SavedComputosModal from '../../modules/computos/components/SavedComputosModal.jsx';
import { AddChapterModal, RenameChapterModal } from '../../modules/computos/components/ChapterModals.jsx';
import ProjectInfoModal from '../../modules/computos/components/ProjectInfoModal.jsx';
import GenerationProgressModal from '../../modules/computos/components/GenerationProgressModal.jsx';
import ComputosSheet from '../../modules/computos/components/ComputosSheet.jsx';
import LinkPartidaModal from '../../modules/computos/components/modals/LinkPartidaModal.jsx';
import StirrupCalculatorModal from '../../modules/computos/components/modals/StirrupCalculatorModal.jsx';


function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function BudgetFromComputosModal({ isOpen, onClose, onCreated, initialBudget = null, onSendToPartidas = null }) {
  const [activeChapter, setActiveChapter] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.activeChapter !== undefined && parsed.activeChapter !== null) {
            return parsed.activeChapter;
          }
        }
      }
    } catch (_e) {
      // ignore
    }
    return '';
  });

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );


  const [saveStatus, setSaveStatus] = useState(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterModalInput, setChapterModalInput] = useState('');
  const [renameChapterTarget, setRenameChapterTarget] = useState(null);
  const [renameChapterInput, setRenameChapterInput] = useState('');
  const [showProjectInfoModal, setShowProjectInfoModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [coveninTargetItemId, setCoveninTargetItemId] = useState(null);
  const [linkModalItem, setLinkModalItem] = useState(null);
  const [stirrupModalTarget, setStirrupModalTarget] = useState(null);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [pendingBudgetItems, setPendingBudgetItems] = useState([]);
  const [availableBudgets, setAvailableBudgets] = useState([]);

  // Base de datos y configuración del catálogo COVENIN
  const dbContext = useDatabaseContext?.() || {};
  const { activeDatabase = { id: 'master', name: 'Base Maestra' }, setActiveDatabase, databases = [] } = dbContext;
  const siteConfig = useContext(SiteConfigContext) || {};
  const config = siteConfig.config;

  const {
    searchQuery,
    setSearchQuery,
    searchCovenin,
    setSearchCovenin,
    searchDesc,
    setSearchDesc,
    searchInsumos,
    setSearchInsumos,
    results: searchResults,
    totalResults: totalSearchResults,
    isSearching: searching,
    forceSearch: searchDatabase,
    hasMore: hasMoreSearchResults,
    loadMore: loadMoreSearchResults,
  } = useCost360Search({
    databaseId: activeDatabase?.id || 'master',
    onlyCoded: config?.forceOnlyCodedMaster === true,
    limit: 30,
    autoSearch: showCatalogModal,
  });
  const [savedList, setSavedList] = useState(getSavedComputosList);
  const [currentDraftId, setCurrentDraftId] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) return parsed.id;
        }
      }
    } catch (_e) {
      // ignore
    }
    return `draft-${Date.now()}`;
  });

  // Lista de partidas en la Planilla de Cómputos (inicializada con borrador previo o con 1 fila libre)
  const [rowsState, rowsDispatch] = useReducer(rowsReducer, null, () => {
    let initialRows = [createBlankRow('')];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            const chap = parsed.activeChapter !== undefined && parsed.activeChapter !== null ? parsed.activeChapter : '';
            initialRows = parsed.items.map((it) => {
              if ((!it.partials || it.partials.length === 0) && it.m3 && it.distance) {
                return recomputeRow(it, 'distance', it.distance);
              }
              return it;
            });
          }
        }
      }
    } catch (e) {
      console.error('Error cargando borrador previo de cómputos:', e);
    }
    return createRowsState(initialRows, activeChapter);
  });
  const capturedItems = rowsState.rows;
  const setCapturedItems = useCallback((nextRows) => {
    rowsDispatch({
      type: 'SET_ROWS',
      payload: { rows: nextRows, activeChapter },
    });
  }, [activeChapter]);

  // Bandera para rastrear si el usuario ha realizado modificaciones locales no guardadas
  const isDirtyRef = useRef(false);
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isOpen || !initialBudget?.items) return;

    // La primera vez que se abre desde Control de Obra, la planilla nace en
    // cero para que los ingenieros capturen los cómputos ejecutados. En
    // aperturas posteriores se conserva el borrador de la planilla.
    if (hasOpenedComputos(initialBudget.id)) return;

    // Verificar si ya existe un borrador previo guardado para este presupuesto (local o nube)
    const existingDraft = (getSavedComputosList() || []).find(
      (d) =>
        d.budgetId === initialBudget.id ||
        d.budgetName === `Cómputos - ${initialBudget.name}` ||
        (d.projectName && (initialBudget.project_name || initialBudget.name) && d.projectName === (initialBudget.project_name || initialBudget.name))
    ) || (readDraft()?.budgetId === initialBudget.id ? readDraft() : null);

    if (existingDraft && Array.isArray(existingDraft.items) && existingDraft.items.length > 0) {
      executeLoadSavedComputo(existingDraft, { notify: false });
      markComputosOpened(initialBudget.id);
      isDirtyRef.current = false;
      return;
    }

    const chapter = 'GENERAL';
    const rows = initialBudget.items.map((item, index) => ({
      ...createBlankRow(chapter),
      id: `budget-${item.item_id || item.id || index}`,
      item_id: item.item_id || item.id || null,
      cod_par: item.code || item.cod_par || '',
      cov_par: item.code || item.cov_par || '',
      description: item.description || '',
      unit: String(item.unit || 'M2').toUpperCase(),
      quantity: 0,
      partial: 0,
      isDefaultQty: true,
      observations: 'Cantidad inicial en cero para cómputos de obra',
    }));
    setCapturedItems(normalizeRowsWithSingleTrailingBlank(rows, chapter));
    setActiveChapter(chapter);
    setBudgetName(initialBudget.name ? `Cómputos - ${initialBudget.name}` : 'Planilla de Cómputos');
    setProjectName(initialBudget.project_name || initialBudget.name || '');
    setClientName(initialBudget.client_name || '');
    markComputosOpened(initialBudget.id);
    isDirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialBudget?.id]);

  // Datos del presupuesto para guardar
  const [budgetName, setBudgetName] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.budgetName) return parsed.budgetName;
        }
      }
    } catch (_e) {
      // ignore
    }
    const today = new Date().toLocaleDateString('es-VE');
    return `Presupuesto de Cómputos - ${today}`;
  });

  const [projectName, setProjectName] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.projectName) return parsed.projectName;
        }
      }
    } catch (_e) {
      // ignore
    }
    return '';
  });

  const [clientName, setClientName] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.clientName) return parsed.clientName;
        }
      }
    } catch (_e) {
      // ignore
    }
    return '';
  });

  const [currency, setCurrency] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.currency) return parsed.currency;
        }
      }
    } catch (_e) {
      // ignore
    }
    return 'USD';
  });

  // Estado del proceso de confirmación y generación
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgressText, setCommitProgressText] = useState('');
  const [commitStepInfo, setCommitStepInfo] = useState({ current: 0, total: 0 });
  const [commitError, setCommitError] = useState(null);

  // Modo de visualización automático según dispositivo: 'cards' en móviles/tablets (<1024px) o 'table' en escritorio
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'cards';
    }
    return 'table';
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setViewMode(window.innerWidth < 1024 ? 'cards' : 'table');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [expandedPartials, setExpandedPartials] = useState({});



  // Auto-guardado en segundo plano de borradores para no perder nada si se cierra inesperadamente
  useEffect(() => {
    // Si el usuario no ha realizado modificaciones locales en esta sesión, NO auto-guardar
    // para no sobrescribir datos de otros dispositivos ni inventar timestamps falsos
    if (!isDirtyRef.current) return;

    const timer = setTimeout(() => {
      try {
        const nonBlank = capturedItems.filter((it) => !isItemEmpty(it));
        if (nonBlank.length > 0 || projectName || clientName) {
          const draftPayload = {
            id: currentDraftId,
            budgetId: initialBudget?.id || null,
            savedAt: new Date().toISOString(),
            budgetName: (budgetName || '').trim() || 'Planilla de Cómputos',
            projectName: (projectName || '').trim(),
            clientName: (clientName || '').trim(),
            currency,
            activeChapter,
            items: nonBlank,
          };
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
        }
      } catch (e) {
        // noop
      }
    }, 500);

    // Auto-sincronización multidispositivo en la nube (Móvil <-> PC)
    const cloudTimer = setTimeout(() => {
      try {
        const nonBlank = capturedItems.filter((it) => !isItemEmpty(it));
        if (nonBlank.length > 0 || projectName || clientName) {
          const draftPayload = {
            id: currentDraftId,
            budgetId: initialBudget?.id || null,
            savedAt: new Date().toISOString(),
            budgetName: (budgetName || '').trim() || 'Planilla de Cómputos',
            projectName: (projectName || '').trim(),
            clientName: (clientName || '').trim(),
            currency,
            activeChapter,
            items: nonBlank,
          };
          saveComputosDraft(draftPayload).catch((err) => {
            console.warn('Auto-sync nube no crítico:', err);
          });
        }
      } catch (_e) {
        // noop
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(cloudTimer);
    };
  }, [capturedItems, budgetName, projectName, clientName, currency, activeChapter, currentDraftId, initialBudget?.id]);

  useEffect(() => {
    if (isOpen) {
      getAllBudgets()
        .then((res) => {
          if (Array.isArray(res)) setAvailableBudgets(res);
          else if (Array.isArray(res?.data)) setAvailableBudgets(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  // Cantidad real de partidas cargadas (sin contar la fila vacía de edición)
  const validItems = capturedItems.filter((it) => !isItemEmpty(it));
  const validCount = validItems.length;

  // Filtro de búsqueda por descripción en la planilla de cómputos
  const [descriptionFilter, setDescriptionFilter] = useState('');

  // Partidas enriquecidas con su índice original para preservar la numeración de ítems
  const chapters = useMemo(() => {
    return Array.from(
      new Set(
        capturedItems
          .map((it) => (it.chapter || '').trim())
          .filter(Boolean)
      )
    );
  }, [capturedItems]);

  const itemsWithOriginalIndex = useMemo(() => {
    return capturedItems.map((it, idx) => ({ ...it, originalIndex: idx }));
  }, [capturedItems]);

  // Lista filtrada de partidas según el término de búsqueda
  const filteredCapturedItems = useMemo(() => {
    const q = (descriptionFilter || '').trim();
    if (!q) return itemsWithOriginalIndex;
    const cleanQ = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return itemsWithOriginalIndex.filter((it) => {
      const desc = (it.description || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (desc.includes(cleanQ)) return true;
      if (it.cod_par && it.cod_par.toLowerCase().includes(cleanQ)) return true;
      if (it.observations && it.observations.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(cleanQ)) return true;
      if (it.partials && it.partials.length > 0) {
        return it.partials.some((p) => {
          const pDesc = (p.description || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          const pObs = (p.observations || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          return pDesc.includes(cleanQ) || pObs.includes(cleanQ);
        });
      }
      return false;
    });
  }, [itemsWithOriginalIndex, descriptionFilter]);

  /**
   * Guarda explícitamente el borrador actual en localStorage y en la lista de guardados (con sincronización en la nube)
   */
  const handleSaveDraft = async () => {
    try {
      const nonBlank = capturedItems.filter((it) => !isItemEmpty(it));
      const cleanName =
        (budgetName || '').trim() ||
        `Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`;
      const nowIso = new Date().toISOString();

      const draftPayload = {
        id: currentDraftId,
        budgetId: initialBudget?.id || null,
        savedAt: nowIso,
        budgetName: cleanName,
        projectName: (projectName || '').trim(),
        clientName: (clientName || '').trim(),
        currency,
        activeChapter,
        items: nonBlank,
        itemCount: nonBlank.length,
      };

      // 1. Guardar de inmediato en el borrador activo local
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));

      // 2. Guardar o actualizar en la lista histórica local
      const existingList = getSavedComputosList();
      const updatedList = [
        draftPayload,
        ...existingList.filter((item) => item.id !== currentDraftId && item.budgetName !== cleanName),
      ];
      localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      setSavedList(updatedList);
      isDirtyRef.current = false;

      const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      setSaveStatus(`Guardado ${timeStr}`);
      toast.success(`Cómputo guardado correctamente (${timeStr})`);
      setTimeout(() => {
        setSaveStatus(null);
      }, 3500);

      // 3. Sincronizar en la cuenta (nube) para que esté disponible en PC y móvil
      try {
        const res = await saveComputosDraft(draftPayload);
        if (res && Array.isArray(res.drafts)) {
          setSavedList(res.drafts);
          try {
            localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(res.drafts));
          } catch (_e) {
            // ignore
          }
        }
      } catch (cloudErr) {
        console.warn('Aviso: Guardado local exitoso, pero falló sincronización en la nube:', cloudErr);
      }
    } catch (err) {
      console.error('Error al guardar borrador de cómputos:', err);
      toast.error('No se pudo guardar el borrador en el almacenamiento local.');
    }
  };

  /**
   * Carga un cómputo guardado previamente
   */
  const executeLoadSavedComputo = (savedItem, { notify = true } = {}) => {
    if (!savedItem) return;
    setCurrentDraftId(savedItem.id || `draft-${Date.now()}`);
    setBudgetName(savedItem.budgetName || `Presupuesto de Cómputos`);
    setProjectName(savedItem.projectName || '');
    setClientName(savedItem.clientName || '');
    setCurrency(savedItem.currency || 'USD');
    setActiveChapter(savedItem.activeChapter || 'OBRAS PRELIMINARES');

    if (Array.isArray(savedItem.items) && savedItem.items.length > 0) {
      setCapturedItems(
        normalizeRowsWithSingleTrailingBlank(
          savedItem.items,
          savedItem.activeChapter || 'OBRAS PRELIMINARES'
        )
      );
    } else {
      setCapturedItems([createBlankRow(savedItem.activeChapter || 'OBRAS PRELIMINARES')]);
    }

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedItem));
    } catch (_e) {
      // ignore
    }

    isDirtyRef.current = false;
    setShowOpenModal(false);
    if (notify) {
      toast.success(`Cómputo "${savedItem.budgetName}" cargado en pantalla`);
    }
  };

  const handleLoadSavedComputo = (savedItem) => {
    if (!savedItem) return;
    if (validCount > 0) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2.5 py-1">
            <p className="font-semibold text-slate-800 text-sm leading-snug">
              ¿Deseas abrir el cómputo &ldquo;{savedItem.budgetName}&rdquo;?
            </p>
            <p className="text-xs text-slate-500">
              Se reemplazarán las partidas actuales en pantalla.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  executeLoadSavedComputo(savedItem);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Abrir cómputo
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'toast-load-saved-computo' }
      );
      return;
    }

    executeLoadSavedComputo(savedItem);
  };

  /**
   * Abre la ventana modal de cómputos guardados refrescando la lista desde la nube
   */
  const handleOpenLoadModal = async () => {
    setShowOpenModal(true);
    try {
      const serverDrafts = await getComputosDrafts();
      if (Array.isArray(serverDrafts)) {
        const localList = getSavedComputosList();
        const draftMap = new Map();
        serverDrafts.forEach((d) => {
          if (d && d.id) draftMap.set(d.id, d);
        });
        localList.forEach((d) => {
          if (d && d.id && !draftMap.has(d.id)) {
            draftMap.set(d.id, d);
          }
        });
        const merged = Array.from(draftMap.values()).sort(
          (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)
        );
        setSavedList(merged);
        try {
          localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(merged));
        } catch (_e) {
          // ignore
        }
      }
    } catch (_err) {
      // ignore
    }
  };

  /**
   * Sincronización multidispositivo (Nube <-> Local) al abrir el modal principal
   */
  const syncCloudAndLocalDrafts = useCallback(async (options = {}) => {
    const { force = false } = options;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const localList = getSavedComputosList();
      let localDraft = null;
      try {
        const rawActive = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (rawActive) {
          localDraft = JSON.parse(rawActive);
          if (localDraft?.id && Array.isArray(localDraft.items) && localDraft.items.length > 0) {
            if (!localList.some((d) => d.id === localDraft.id)) {
              localList.unshift(localDraft);
            }
          }
        }
      } catch (_e) {
        // ignore
      }

      const serverDrafts = await getComputosDrafts().catch(() => null);
      if (!Array.isArray(serverDrafts)) {
        if (force) {
          toast.error('No se pudo conectar con el servidor para sincronizar');
        }
        return;
      }

      const draftMap = new Map();
      serverDrafts.forEach((d) => {
        if (d && d.id) draftMap.set(d.id, d);
      });

      // Detectar borradores locales que no estén en la nube para subirlos (ej. guardados sin conexión)
      const unsyncedLocals = [];
      localList.forEach((d) => {
        if (d && d.id) {
          if (!draftMap.has(d.id)) {
            draftMap.set(d.id, d);
            unsyncedLocals.push(d);
          }
        }
      });

      const merged = Array.from(draftMap.values()).sort(
        (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)
      );

      try {
        localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(merged));
      } catch (_e) {
        // ignore
      }
      setSavedList(merged);

      // Buscar el borrador más relevante para el contexto actual:
      let matchingDraft = null;
      if (initialBudget?.id) {
        matchingDraft = merged.find(
          (d) =>
            d.budgetId === initialBudget.id ||
            d.budgetName === `Cómputos - ${initialBudget.name}` ||
            (d.projectName && (initialBudget.project_name || initialBudget.name) && d.projectName === (initialBudget.project_name || initialBudget.name))
        );
      }
      if (!matchingDraft && currentDraftId) {
        matchingDraft = merged.find((d) => d.id === currentDraftId);
      }
      if (!matchingDraft && merged.length > 0) {
        matchingDraft = merged[0];
      }

      if (matchingDraft) {
        const cloudTime = new Date(matchingDraft.savedAt || 0).getTime();
        const localTime = new Date(localDraft?.savedAt || 0).getTime();
        const currentNonBlank = capturedItems.filter((it) => !isItemEmpty(it));

        if (force) {
          executeLoadSavedComputo(matchingDraft, { notify: false });
          isDirtyRef.current = false;
          toast.success(`Planilla sincronizada con "${matchingDraft.budgetName}"`);
        } else if (!isDirtyRef.current) {
          if (currentNonBlank.length === 0 || cloudTime > localTime + 1000) {
            executeLoadSavedComputo(matchingDraft, { notify: false });
            isDirtyRef.current = false;
          }
        } else if (localTime > cloudTime + 2000 && localDraft && localDraft.items?.length > 0 && isDirtyRef.current) {
          saveComputosDraft(localDraft).catch(() => {});
        }
      }

      // Subir borradores locales pendientes a la nube en segundo plano
      if (unsyncedLocals.length > 0) {
        for (const localDraftItem of unsyncedLocals) {
          saveComputosDraft(localDraftItem).catch((err) => {
            console.warn('Aviso: Sincronización de borrador local a la nube:', err);
          });
        }
      }
    } catch (err) {
      console.warn('Error sincronizando cómputos en la nube:', err);
      if (force) {
        toast.error('Error al sincronizar con la nube');
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [capturedItems, currentDraftId, initialBudget]);

  // Sincronización periódica en segundo plano (cada 8 segundos)
  // Permite que si el usuario añade partidas en PC, aparezcan en el móvil automáticamente
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      if (!isDirtyRef.current) {
        syncCloudAndLocalDrafts({ isBackground: true });
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isOpen, syncCloudAndLocalDrafts]);

  useEffect(() => {
    if (!isOpen) return;

    syncCloudAndLocalDrafts({ isBackground: true });

    const handleWindowFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (!isDirtyRef.current) {
          syncCloudAndLocalDrafts({ isBackground: true });
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, [isOpen, syncCloudAndLocalDrafts]);

  /**
   * Elimina un cómputo de la lista de guardados y de la nube
   */
  const handleDeleteSavedComputo = (savedId, e) => {
    e.stopPropagation();
    toast(
      (t) => (
        <div className="flex flex-col gap-2.5 py-1">
          <p className="font-semibold text-slate-800 text-sm leading-snug">
            ¿Deseas eliminar este cómputo guardado de la lista?
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                const existingList = getSavedComputosList();
                const updated = existingList.filter((it) => it.id !== savedId);
                try {
                  localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(updated));
                } catch (_e) {
                  // ignore
                }
                setSavedList(updated);
                toast.success('Cómputo eliminado de la lista');

                try {
                  const res = await deleteComputosDraft(savedId);
                  if (res && Array.isArray(res.drafts)) {
                    setSavedList(res.drafts);
                    try {
                      localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(res.drafts));
                    } catch (_e) {
                      // ignore
                    }
                  }
                } catch (cloudErr) {
                  console.warn('Aviso: Eliminado localmente, pero falló en la nube:', cloudErr);
                }
              }}
              className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: `toast-del-${savedId}` }
    );
  };

  /**
   * Crea un nuevo cómputo en blanco
   */
  const executeCreateNewComputo = () => {
    const newId = `draft-${Date.now()}`;
    setCurrentDraftId(newId);
    setCapturedItems([createBlankRow('OBRAS PRELIMINARES')]);
    setBudgetName(`Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setSaveStatus(null);
    setShowOpenModal(false);
    toast.success('Nueva planilla en blanco iniciada');
  };

  const handleCreateNewComputo = () => {
    if (validCount > 0) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2.5 py-1">
            <p className="font-semibold text-slate-800 text-sm leading-snug">
              ¿Deseas comenzar un nuevo cómputo en blanco?
            </p>
            <p className="text-xs text-slate-500">
              Asegúrate de haber guardado el actual si deseas conservarlo.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  executeCreateNewComputo();
                }}
                className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Nuevo cómputo
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'toast-create-new-computo' }
      );
      return;
    }
    executeCreateNewComputo();
  };

  /**
   * Agrega un nuevo capítulo a la planilla de cómputos y lo deja listo con una fila libre
   */
  const handleAddChapterToSheet = (newChapName) => {
    const name = (newChapName || '').trim().toUpperCase();
    if (!name) return;

    setActiveChapter(name);

    setCapturedItems((prev) => {
      const items = [...prev];
      // Si la última fila era una fila vacía no utilizada, le asignamos el nuevo capítulo
      if (items.length > 0 && isItemEmpty(items[items.length - 1])) {
        items[items.length - 1] = {
          ...items[items.length - 1],
          chapter: name,
        };
        return items;
      }
      // Si la última fila ya tenía datos, agregamos una fila libre con el nuevo capítulo
      return [...items, createBlankRow(name)];
    });

    setShowChapterModal(false);
    setChapterModalInput('');
  };

  /**
   * Abre modal para renombrar un capítulo directamente desde su encabezado en la tabla
   */
  const handleRenameChapter = (oldName) => {
    if (!oldName) return;
    setRenameChapterTarget(oldName);
    setRenameChapterInput(oldName);
  };

  /**
   * Confirma y aplica el renombre del capítulo
   */
  const handleConfirmRenameChapter = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!renameChapterTarget) return;

    const clean = (renameChapterInput || '').trim().toUpperCase();
    if (!clean) {
      toast.error('El nombre del capítulo no puede estar vacío');
      return;
    }

    if (clean === renameChapterTarget) {
      setRenameChapterTarget(null);
      setRenameChapterInput('');
      return;
    }

    setCapturedItems((prev) =>
      prev.map((it) => (it.chapter === renameChapterTarget ? { ...it, chapter: clean } : it))
    );
    if (activeChapter === renameChapterTarget) {
      setActiveChapter(clean);
    }
    toast.success(`Capítulo renombrado a "${clean}"`);
    setRenameChapterTarget(null);
    setRenameChapterInput('');
  };

  /**
   * Elimina únicamente el texto/encabezado del capítulo, conservando intactos todos los cómputos y mediciones.
   */
  const handleRemoveChapterHeader = (chapterName) => {
    if (!chapterName) return;
    const targetChap = chapterName.trim().toUpperCase();

    setCapturedItems((prev) => {
      // Encontrar el primer elemento con este capítulo
      const firstIdx = prev.findIndex(
        (it) => (it.chapter || '').trim().toUpperCase() === targetChap
      );
      if (firstIdx === -1) return prev;

      // Si hay un capítulo anterior en la lista antes de este bloque, las partidas pasan al capítulo anterior.
      // Si era el primer capítulo, el capítulo queda vacío ("") para ocultar el encabezado.
      let fallbackChapter = '';
      if (firstIdx > 0 && prev[firstIdx - 1]?.chapter) {
        fallbackChapter = prev[firstIdx - 1].chapter;
      }

      const updated = prev.map((it) => {
        if ((it.chapter || '').trim().toUpperCase() === targetChap) {
          return { ...it, chapter: fallbackChapter };
        }
        return it;
      });

      // Actualizar activeChapter si correspondía al capítulo eliminado
      let nextActiveChapter = activeChapter;
      if ((activeChapter || '').trim().toUpperCase() === targetChap) {
        const remainingChapters = Array.from(
          new Set(updated.map((it) => (it.chapter || '').trim()).filter(Boolean))
        );
        nextActiveChapter = fallbackChapter || remainingChapters[0] || '';
        setActiveChapter(nextActiveChapter);
      }

      const finalItems = normalizeRowsWithSingleTrailingBlank(updated, nextActiveChapter);

      // Persistencia INMEDIATA en localStorage para que F5 / recarga nunca restaure el capítulo eliminado
      try {
        const nonBlank = finalItems.filter((it) => !isItemEmpty(it));
        const draftPayload = {
          id: currentDraftId,
          savedAt: new Date().toISOString(),
          budgetName: (budgetName || '').trim(),
          projectName: (projectName || '').trim(),
          clientName: (clientName || '').trim(),
          currency,
          activeChapter: nextActiveChapter,
          items: nonBlank,
          itemCount: nonBlank.length,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));

        const existingList = getSavedComputosList();
        const updatedList = [
          draftPayload,
          ...existingList.filter((item) => item.id !== currentDraftId && item.budgetName !== draftPayload.budgetName),
        ];
        localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(updatedList));
        setSavedList(updatedList);
      } catch (_e) {
        // ignore
      }

      return finalItems;
    });

    toast.success(`Encabezado "${chapterName}" eliminado (cómputos conservados)`);
  };

  /**
   * Registra un cómputo tanto en la Planilla como en el Chat
   */
  /**
   * Actualiza directamente cualquier celda de la Planilla de Cómputos
   * y garantiza que SIEMPRE exista una fila libre al final
   */
  const handleUpdateItemField = (itemId, field, value) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'UPDATE_FIELD',
      payload: { itemId, field, value, activeChapter },
    });
  };

  /**
   * Duplica una partida existente
   */
  const handleDuplicateRow = (item) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'DUPLICATE_ROW',
      payload: { item, activeChapter },
    });
  };

  /**
   * Inserta una nueva fila vacía justo debajo de la fila actual
   */
  const handleInsertRowBelow = (targetItem) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'INSERT_ROW_BELOW',
      payload: { targetItem, activeChapter },
    });
  };

  /**
   * Habilita el desglose de sub-cómputos/parciales (múltiples paredes/tramos) para una partida
   */
  const handleTogglePartials = (itemId) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'TOGGLE_PARTIALS',
      payload: { itemId, activeChapter },
    });
    setExpandedPartials((prev) => ({ ...prev, [itemId]: true }));
    toast.success('Desglose de parciales activado');
  };

  /**
   * Remueve completamente el desglose de parciales de una partida
   */
  const handleClearPartials = (itemId) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'CLEAR_PARTIALS',
      payload: { itemId, activeChapter },
    });
    toast.success('Desglose de parciales removido');
  };

  /**
   * Agrega un nuevo parcial / fila adicional a una partida
   */
  const handleAddPartial = (itemId) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'ADD_PARTIAL',
      payload: { itemId, activeChapter },
    });
    setExpandedPartials((prev) => ({ ...prev, [itemId]: true }));
  };

  /**
   * Actualiza un campo de un parcial individual y recalcula automáticamente la cantidad total de la partida
   */
  const handleUpdatePartialField = (itemId, partialId, field, value) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'UPDATE_PARTIAL_FIELD',
      payload: { itemId, partialId, field, value, activeChapter },
    });
  };

  /**
   * Elimina un tramo / pared individual del desglose
   */
  const handleRemovePartial = (itemId, partialId) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'REMOVE_PARTIAL',
      payload: { itemId, partialId, activeChapter },
    });
  };

  /**
   * Expande o colapsa el panel de paredes/parciales de una partida
   */
  const handleOpenLinkModal = (item) => {
    setLinkModalItem(item);
  };

  const handleConfirmLink = (linkData) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'LINK_ROWS',
      payload: { ...linkData, activeChapter },
    });
    toast.success('Partida vinculada exitosamente con actualización en cascada');
    setLinkModalItem(null);
  };

  const handleUnlinkRow = (itemId) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'UNLINK_ROW',
      payload: { itemId, activeChapter },
    });
    toast.success('Vínculo eliminado');
  };

  const handleOpenStirrupModal = (item, partial = null) => {
    setStirrupModalTarget({ item, partial });
  };

  const handleApplyStirrup = ({ cutLengthM, count, colWidthCm, colHeightCm }) => {
    if (!stirrupModalTarget) return;
    const { item, partial } = stirrupModalTarget;
    if (partial) {
      handleUpdatePartialField(item.id, partial.id, 'length', cutLengthM);
      if (count) {
        handleUpdatePartialField(item.id, partial.id, 'times', count);
      }
      const obsNote = `Estribo ${colWidthCm}x${colHeightCm}cm`;
      const currentObs = partial.observations ? `${partial.observations} | ${obsNote}` : obsNote;
      handleUpdatePartialField(item.id, partial.id, 'observations', currentObs);
    } else {
      handleUpdateItemField(item.id, 'length', cutLengthM);
      if (count) {
        handleUpdateItemField(item.id, 'times', count);
      }
      const obsNote = `Estribo ${colWidthCm}x${colHeightCm}cm`;
      const currentObs = item.observations ? `${item.observations} | ${obsNote}` : obsNote;
      handleUpdateItemField(item.id, 'observations', currentObs);
    }
    toast.success(`Estribo de corte ${cutLengthM}m aplicado correctamente`);
    setStirrupModalTarget(null);
  };

  const handleToggleExpandPartials = (itemId) => {
    setExpandedPartials((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  /**
   * Exportación de contingencia en el navegador en caso de estar sin conexión
   */
  const exportExcelComputosFallback = (validItems) => {
    const cleanName = (budgetName || 'Planilla_de_Computos').trim().replace(/[/\\?%*:|"<>]/g, '_');
    const today = new Date().toLocaleDateString('es-VE');

    let rowsHtml = '';
    let currentChapter = null;
    let itemNumber = 1;

    validItems.forEach((it) => {
      const chap = (it.chapter || 'GENERAL').trim().toUpperCase();
      if (chap !== currentChapter) {
        currentChapter = chap;
        rowsHtml += `
          <tr style="background-color: #fef3c7; font-weight: bold; font-size: 12px;">
            <td colspan="13" style="padding: 8px; border: 1px solid #d97706; color: #78350f;">
              CAPÍTULO: ${escapeHtml(chap)}
            </td>
          </tr>
        `;
      }

      const hasPartials = it.partials && it.partials.length > 0;
      rowsHtml += `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
          <td style="text-align: center; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc; vertical-align: top;">${itemNumber}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: 600; width: 550px; white-space: normal; word-wrap: break-word; vertical-align: top; mso-line-break-rule: exactly;">${escapeHtml(it.description || '')}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; color: #1e293b; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.length || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.width || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.height || '')}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.times || 1)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.factor || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.distance || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #78350f; vertical-align: top;">${hasPartials ? (it.m3 || '—') : (it.m3 || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: bold; background-color: #fef3c7; vertical-align: top;">${it.quantity || 0}</td>
          <td style="border: 1px solid #cbd5e1; vertical-align: top;">${escapeHtml(it.observations || '')}</td>
        </tr>
      `;

      if (hasPartials) {
        it.partials.forEach((p, pIdx) => {
          rowsHtml += `
            <tr style="border-bottom: 1px dashed #cbd5e1; font-size: 10px; background-color: #fffbeb;">
              <td style="text-align: center; border: 1px solid #cbd5e1; color: #d97706; vertical-align: top;">↳ ${pIdx + 1}</td>
              <td style="border: 1px solid #cbd5e1; padding-left: 20px; font-style: italic; color: #78350f; width: 550px; white-space: normal; word-wrap: break-word; vertical-align: top;">
                ${escapeHtml(p.description || `Pared ${pIdx + 1}`)}
              </td>
              <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 10px; color: #64748b; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.length || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.width || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.height || ''}</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; vertical-align: top;">${p.times || 1}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.factor || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.distance || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #78350f; vertical-align: top;">${p.m3 || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #b45309; background-color: #fef3c7; vertical-align: top;">${p.partial || 0}</td>
              <td style="border: 1px solid #cbd5e1; font-style: italic; color: #64748b; vertical-align: top;">${escapeHtml(p.observations || '')}</td>
            </tr>
          `;
        });
      }

      itemNumber += 1;
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Cómputos Métricos</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            th { background-color: #d97706; color: #ffffff; border: 1px solid #b45309; padding: 6px 3px; font-size: 9px; vertical-align: middle; white-space: nowrap; text-align: center; }
            td { padding: 5px; vertical-align: top; }
          </style>
        </head>
        <body>
          <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
            <tr>
              <td colspan="13" style="font-size: 22px; font-weight: bold; text-align: center; padding: 14px 6px; color: #1e293b; border: none;">
                Planilla de Cómputos Métricos
              </td>
            </tr>
            <tr>
              <td colspan="13" style="padding: 4px 6px; font-size: 11px; text-align: left; font-weight: bold; color: #1e293b; border: none;">
                Obra: <span style="font-weight: normal;">${escapeHtml(projectName || budgetName || '—')}</span>
              </td>
            </tr>
            <tr>
              <td colspan="13" style="padding: 4px 6px; font-size: 11px; text-align: left; font-weight: bold; color: #1e293b; border: none;">
                Fecha: <span style="font-weight: normal;">${today}</span>
              </td>
            </tr>
            <tr><td colspan="12" style="height: 8px; border: none;"></td></tr>
            <thead>
              <tr>
                <th style="width: 35px; font-size: 10px; text-align: center;">N°</th>
                <th style="width: 550px; text-align: left; font-size: 11px; white-space: normal;">DESCRIPCIÓN DE LA PARTIDA</th>
                <th style="width: 55px; font-size: 11px; font-weight: bold; text-align: center;">UND</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">LARGO</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">ANCHO</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">ALTO</th>
                <th style="width: 65px; font-size: 9px; white-space: nowrap; text-align: center;">VECES</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">FACTOR</th>
                <th style="width: 80px; font-size: 9px; white-space: nowrap; text-align: center;">DIST. (km)</th>
                <th style="width: 85px; font-size: 9px; white-space: nowrap; text-align: center;">M3 (BOTE)</th>
                <th style="width: 85px; font-size: 9px; white-space: nowrap; text-align: center;">TOTAL</th>
                <th style="width: 220px; font-size: 9px; text-align: left; white-space: nowrap;">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanName}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Planilla exportada a Excel');
  };

  /**
   * Exporta la Planilla de Cómputos Métricos a un archivo Excel (.xlsx) nativo genuino
   * con encabezados en negrita y centrados tanto vertical como horizontalmente sin advertencias de Excel.
   */
  const handleExportExcelComputos = async () => {
    const validItems = capturedItems.filter((it) => !isItemEmpty(it));
    if (validItems.length === 0) {
      toast.error('No hay datos en la planilla para exportar.');
      return;
    }

    const payload = {
      budgetName: budgetName || 'Planilla de Cómputos Métricos',
      projectName: projectName || '',
      items: validItems,
    };

    const toastId = toast.loading('Generando archivo Excel (.xlsx)...');
    try {
      await exportComputosExcel(payload);
      toast.success('Planilla exportada a Excel (.xlsx) con éxito', { id: toastId });
    } catch (err) {
      console.warn('Fallo exportación nativa por backend, usando exportación de contingencia:', err);
      toast.dismiss(toastId);
      exportExcelComputosFallback(validItems);
    }
  };

  /**
   * Envía las cantidades de la planilla a la pestaña Partidas del control de obra.
   * No crea un presupuesto nuevo ni duplica el historial de avance.
   */
  const handleSendToPartidas = () => {
    if (!onSendToPartidas) return;
    const rows = capturedItems
      .filter((it) => !isItemEmpty(it) && Number(it.quantity) > 0)
      .map((it) => ({
        item_id: it.item_id || null,
        cod_par: it.cod_par || it.code || '',
        description: it.description || '',
        unit: it.unit || '',
        chapter: it.chapter || '',
        quantity: Number(it.quantity),
      }));
    if (rows.length === 0) {
      toast.error('No hay cantidades de cómputos para llevar a Partidas.');
      return;
    }
    onSendToPartidas(rows);
  };

  /**
   * Imprime la Planilla de Cómputos Métricos en formato técnico de ingeniería
   */
  const handlePrintComputos = () => {
    const validItems = capturedItems.filter((it) => !isItemEmpty(it));
    if (validItems.length === 0) {
      toast.error('No hay datos en la planilla para imprimir.');
      return;
    }

    const today = new Date().toLocaleDateString('es-VE');
    let rowsHtml = '';
    let currentChapter = null;
    let itemNumber = 1;

    validItems.forEach((it) => {
      const chap = (it.chapter || 'GENERAL').trim().toUpperCase();
      if (chap !== currentChapter) {
        currentChapter = chap;
        rowsHtml += `
          <tr class="chapter-row">
            <td colspan="13">CAPÍTULO: ${escapeHtml(chap)}</td>
          </tr>
        `;
      }

      const hasPartials = it.partials && it.partials.length > 0;
      rowsHtml += `
        <tr class="item-row">
          <td class="text-center font-bold" style="vertical-align: top;">${itemNumber}</td>
          <td class="font-bold text-left" style="width: 500px; white-space: normal; word-wrap: break-word; vertical-align: top;">${escapeHtml(it.description || '')}</td>
          <td class="text-center font-bold" style="font-size: 11px; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.length || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.width || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.height || '')}</td>
          <td class="text-center" style="vertical-align: top;">${hasPartials ? '—' : (it.times || 1)}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.factor || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.distance || '')}</td>
          <td class="text-right font-bold text-amber-900" style="vertical-align: top;">${hasPartials ? (it.m3 || '—') : (it.m3 || '')}</td>
          <td class="text-right font-black bg-amber-50" style="vertical-align: top;">${it.quantity || 0}</td>
          <td style="vertical-align: top;">${escapeHtml(it.observations || '')}</td>
        </tr>
      `;

      if (hasPartials) {
        it.partials.forEach((p, pIdx) => {
          rowsHtml += `
            <tr class="partial-row">
              <td class="text-center text-amber-700" style="vertical-align: top;">↳ ${pIdx + 1}</td>
              <td class="partial-name" style="width: 500px; white-space: normal; word-wrap: break-word; vertical-align: top;">${escapeHtml(p.description || `Pared ${pIdx + 1}`)}</td>
              <td class="text-center text-muted" style="font-size: 10px; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
              <td class="text-right" style="vertical-align: top;">${p.length || ''}</td>
              <td class="text-right" style="vertical-align: top;">${p.width || ''}</td>
              <td class="text-right" style="vertical-align: top;">${p.height || ''}</td>
              <td class="text-center" style="vertical-align: top;">${p.times || 1}</td>
              <td class="text-right" style="vertical-align: top;">${p.factor || ''}</td>
              <td class="text-right" style="vertical-align: top;">${p.distance || ''}</td>
              <td class="text-right font-bold text-amber-900" style="vertical-align: top;">${p.m3 || ''}</td>
              <td class="text-right font-bold text-amber-900 bg-amber-50" style="vertical-align: top;">${p.partial || 0}</td>
              <td class="text-muted text-xs" style="vertical-align: top;">${escapeHtml(p.observations || '')}</td>
            </tr>
          `;
        });
      }

      itemNumber += 1;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Por favor permite ventanas emergentes para imprimir la planilla.');
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Planilla de Cómputos Métricos - ${escapeHtml(budgetName || 'APUPro')}</title>
          <style>
            @page {
              size: landscape;
              margin: 12mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10px;
              color: #1e293b;
              margin: 0;
              padding: 10px;
            }
            .header {
              border-bottom: 2px solid #b45309;
              padding-bottom: 8px;
              margin-bottom: 12px;
              text-align: center;
            }
            .header h1 {
              font-size: 22px;
              color: #1e293b;
              margin: 0 0 6px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .meta-left {
              text-align: left;
              font-size: 11px;
              color: #1e293b;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 4px 6px;
            }
            th {
              background-color: #d97706;
              color: white;
              font-size: 8.5px;
              text-transform: uppercase;
              text-align: center;
              white-space: nowrap;
            }
            .chapter-row td {
              background-color: #fef3c7;
              font-weight: bold;
              font-size: 11px;
              color: #78350f;
              border-color: #d97706;
            }
            .item-row td {
              font-size: 10px;
            }
            .partial-row td {
              background-color: #fffbeb;
              font-size: 9px;
              border-bottom: 1px dashed #e2e8f0;
            }
            .partial-name {
              padding-left: 18px !important;
              font-style: italic;
              color: #78350f;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .text-muted { color: #94a3b8; }
            .signatures {
              margin-top: 30px;
              display: flex;
              justify-content: space-around;
              page-break-inside: avoid;
            }
            .sig-box {
              width: 200px;
              border-top: 1px solid #475569;
              text-align: center;
              padding-top: 6px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Planilla de Cómputos Métricos</h1>
            <div class="meta-left">
              <div><strong>Obra:</strong> ${escapeHtml(projectName || budgetName || '—')}</div>
              <div><strong>Fecha:</strong> ${today}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">N°</th>
                <th style="width: 500px; text-align: left;">DESCRIPCIÓN DE LA PARTIDA</th>
                <th style="width: 45px; font-size: 8px;">UND</th>
                <th style="width: 55px;">LARGO</th>
                <th style="width: 55px;">ANCHO</th>
                <th style="width: 55px;">ALTO</th>
                <th style="width: 50px;">VECES</th>
                <th style="width: 55px;">FACTOR</th>
                <th style="width: 60px;">DIST. (km)</th>
                <th style="width: 60px;">M3 (BOTE)</th>
                <th style="width: 75px;">TOTAL</th>
                <th style="width: 140px;">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="signatures">
            <div class="sig-box">Elaborado por (Ingeniero Inspector)</div>
            <div class="sig-box">Revisado por (Ingeniero Residente)</div>
            <div class="sig-box">Aprobado por (Cliente / Ente Contratante)</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  /**
   * Abre el modal de búsqueda de partidas COVENIN para reemplazar o ajustar la descripción
   */
  const handleOpenCoveninModal = (targetItem) => {
    setCoveninTargetItemId(targetItem.id);
    const keywords = extractCoveninSearchKeywords(targetItem.description);
    setSearchQuery(keywords);
    setSearchCovenin('');
    setShowCatalogModal(true);
  };

  /**
   * Aplica la partida COVENIN seleccionada en la fila objetivo
   */
  const handleSelectCoveninPartida = (coveninItem) => {
    if (!coveninTargetItemId || !coveninItem) return;
    isDirtyRef.current = true;
    const cleanDesc = (coveninItem.Descri || '').trim().toUpperCase();
    const cleanUnit = normalizeUnitStr(coveninItem.UniPar) || 'UND';

    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== coveninTargetItemId) return it;
        return {
          ...it,
          description: cleanDesc,
          unit: cleanUnit,
          cod_par: coveninItem.CodPar || '',
          cov_par: coveninItem.CovPar || coveninItem.CodPar || '',
          coveninCode: coveninItem.CovPar || coveninItem.CodPar || '',
        };
      });
      return normalizeRowsWithSingleTrailingBlank(updated, activeChapter);
    });

    setPendingBudgetItems((prev) =>
      prev.map((it) => {
        if (it.id !== coveninTargetItemId) return it;
        return {
          ...it,
          description: cleanDesc,
          unit: cleanUnit,
          cod_par: coveninItem.CodPar || '',
          cov_par: coveninItem.CovPar || coveninItem.CodPar || '',
          coveninCode: coveninItem.CovPar || coveninItem.CodPar || '',
        };
      })
    );

    toast.success(`Partida actualizada según COVENIN: "${cleanDesc.slice(0, 35)}..."`);
    setShowCatalogModal(false);
    setCoveninTargetItemId(null);
  };

  const handleRemoveItem = (itemId) => {
    isDirtyRef.current = true;
    rowsDispatch({
      type: 'REMOVE_ROW',
      payload: { itemId, activeChapter },
    });
  };

  const executeClearAll = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // noop
    }
    setCapturedItems([createBlankRow('OBRAS PRELIMINARES')]);
    setLastCapturedItemId(null);
    setEditingItemId(null);
    setEditForm(null);
    setInputText('');
    setBudgetName(`Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setSaveStatus(null);
    toast.success('Planilla reiniciada');
  };

  const handleClearAll = (force = false) => {
    if (!force && validCount > 0) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2.5 py-1">
            <p className="font-semibold text-slate-800 text-sm leading-snug">
              ¿Deseas limpiar todos los cómputos y reiniciar la planilla?
            </p>
            <p className="text-xs text-slate-500">
              Esta acción vaciará la tabla y no se puede deshacer si no has guardado.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  executeClearAll();
                }}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Limpiar todo
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'toast-clear-all-computos' }
      );
      return;
    }

    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // noop
    }
    setCapturedItems([createBlankRow('OBRAS PRELIMINARES')]);
    setLastCapturedItemId(null);
    setEditingItemId(null);
    setEditForm(null);
    setInputText('');
    setBudgetName(`Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setSaveStatus(null);
  };

  /**
   * Enriquecer la descripción de una partida con especificaciones técnicas estándar
   */
  const handleEnrichItem = (id, enrichedText) => {
    handleUpdateItemField(id, 'description', (enrichedText || '').toUpperCase());
    toast.success('Descripción enriquecida con especificaciones técnicas');
  };

  /**
   * Proceso de Confirmar y Generar Presupuesto con Validación Previa Anti-alucinación
   */
  const handleConfirmAndGenerateBudget = async () => {
    const finalItems = capturedItems.filter((it) => !isItemEmpty(it) && it.description.trim());
    if (finalItems.length === 0 || isCommitting) {
      if (validCount === 0) {
        toast.error('Debes ingresar al menos una partida antes de generar el presupuesto.');
      } else {
        toast.error('Las partidas en la planilla deben tener una descripción válida.');
      }
      return;
    }

    // Verificar si hay partidas S/C con descripciones incompletas o ambiguas
    const itemsNeedingCalibration = finalItems.filter((it) => {
      const audit = auditDescription(it.description, it.cod_par, it.unit);
      return audit.status === 'warning';
    });

    if (itemsNeedingCalibration.length > 0) {
      setPendingBudgetItems(finalItems);
      setIsCalibrationOpen(true);
      return;
    }

    await executeBudgetGeneration(finalItems);
  };

  /**
   * Confirmación desde el modal de calibración de partidas
   */
  const handleCalibrationConfirmed = async (calibratedList) => {
    setIsCalibrationOpen(false);

    // Actualizar capturedItems con las descripciones calibradas para persistir cambios en el borrador
    setCapturedItems((prev) =>
      prev.map((it) => {
        const match = calibratedList.find((c) => c.id === it.id);
        return match ? { ...it, description: match.description } : it;
      })
    );

    await executeBudgetGeneration(calibratedList);
  };

  /**
   * Ejecuta la resolución y commit del presupuesto en el backend
   */
  const executeBudgetGeneration = async (itemsToProcess) => {
    const cleanBudgetName =
      (budgetName || '').trim() ||
      `Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`;

    setIsCommitting(true);
    setCommitError(null);
    setCommitStepInfo({ current: 0, total: itemsToProcess.length });

    try {
      const payloadItems = [];
      let lastChapter = null;
      let scCounter = 1;

      const formatDescWithPartials = (baseDesc, item) => {
        const cleanBase = (baseDesc || '').trim().toUpperCase();
        if (!item.partials || item.partials.length === 0) return cleanBase;
        const breakdown = item.partials
          .map((p) => {
            const name = (p.description || 'Pared').trim();
            const dims = [
              p.length ? `L=${p.length}` : '',
              p.width ? `A=${p.width}` : '',
              p.height ? `H=${p.height}` : '',
              p.times && p.times > 1 ? `x${p.times}` : '',
            ]
              .filter(Boolean)
              .join('×');
            return `${name}${dims ? ` (${dims})` : ''}: ${p.partial || 0}`;
          })
          .join(', ');
        const combined = `${cleanBase} [Desglose: ${breakdown}]`;
        return combined.length <= 580 ? combined : cleanBase;
      };

      for (let i = 0; i < itemsToProcess.length; i += 1) {
        const it = itemsToProcess[i];
        const chapName = (it.chapter || 'GENERAL').trim().toUpperCase();
        if (chapName && chapName !== lastChapter) {
          payloadItems.push({
            description: chapName,
            unit: '',
            quantity: 0,
            is_chapter: true,
          });
          lastChapter = chapName;
        }

        // Si la partida ya fue seleccionada de la norma COVENIN (tiene cod_par),
        // se toma directamente de la base de datos sin necesidad de llamar a IA ni resolver.
        if (it.cod_par) {
          payloadItems.push({
            description: formatDescWithPartials(it.description, it),
            unit: (it.unit || 'M2').toUpperCase(),
            quantity: Number(it.quantity) || 0,
            performance: 1.0,
            is_chapter: false,
            cod_par: it.cod_par,
            cov_par: it.cov_par || it.cod_par,
            code: '',
            materials: [],
            equipments: [],
            labors: [],
          });
          continue;
        }

        setCommitStepInfo({ current: i + 1, total: itemsToProcess.length });
        setCommitProgressText(
          `Buscando en BD o generando APU (${i + 1}/${itemsToProcess.length}): ${it.description}`
        );

        let resolved = null;
        try {
          resolved = await resolveComputo({
            description: it.description,
            unit: it.unit || 'M2',
            sc_index: scCounter,
            auto_generate_sc: true,
            quantity: Number(it.quantity) || 1.0,
          });
        } catch (errResolve) {
          console.error('Error resolviendo partida de cómputo:', errResolve);
        }

        if (resolved && resolved.resolution_type === 'covenin' && resolved.cod_par) {
          payloadItems.push({
            description: formatDescWithPartials(resolved.matched_description || it.description, it),
            unit: (resolved.matched_unit || it.unit || 'M2').toUpperCase(),
            quantity: Number(it.quantity) || 0,
            performance: Number(resolved.performance) || 1.0,
            is_chapter: false,
            cod_par: resolved.cod_par,
            cov_par: resolved.cov_par || resolved.cod_par,
            code: '',
            materials: [],
            equipments: [],
            labors: [],
          });
        } else {
          const scCode = `S/C ${String(scCounter).padStart(2, '0')}`;
          scCounter += 1;

          payloadItems.push({
            description: formatDescWithPartials(resolved?.matched_description || it.description, it),
            unit: (resolved?.matched_unit || it.unit || 'M2').toUpperCase(),
            quantity: Number(it.quantity) || 0,
            performance: Number(resolved?.performance) || 1.0,
            is_chapter: false,
            cod_par: scCode,
            cov_par: scCode,
            code: scCode,
            materials: resolved?.materials || [],
            equipments: resolved?.equipments || [],
            labors: resolved?.labors || [],
          });
        }
      }

      setCommitProgressText('Guardando presupuesto y abriendo hoja de trabajo...');

      const result = await commitComputoImport({
        name: cleanBudgetName,
        project_name: (projectName || cleanBudgetName).trim(),
        client_name: clientName.trim() || null,
        currency,
        items: payloadItems,
        source_filename: 'Planilla de Cómputos Métricos',
      });

      // Limpiar borrador local tras crear el presupuesto con éxito
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (_e) {
        // ignore
      }

      handleClearAll(true);
      if (onCreated) {
        onCreated(result);
      } else if (onClose) {
        onClose();
      }
    } catch (err) {
      setCommitError(err.message || 'No se pudo generar el presupuesto. Inténtalo de nuevo.');
    } finally {
      setIsCommitting(false);
      setCommitProgressText('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#FEF3C7] flex flex-col overflow-hidden select-none sm:select-auto">
      <GenerationProgressModal
        isOpen={isCommitting}
        text={commitProgressText}
        stepInfo={commitStepInfo}
      />

      <SavedComputosModal
        isOpen={showOpenModal}
        savedList={savedList}
        onClose={() => setShowOpenModal(false)}
        onCreate={handleCreateNewComputo}
        onLoad={handleLoadSavedComputo}
        onDelete={handleDeleteSavedComputo}
      />

      <AddChapterModal
        isOpen={showChapterModal}
        value={chapterModalInput}
        onChange={setChapterModalInput}
        onClose={() => setShowChapterModal(false)}
        onSubmit={handleAddChapterToSheet}
      />

      <RenameChapterModal
        isOpen={Boolean(renameChapterTarget)}
        value={renameChapterInput}
        onChange={setRenameChapterInput}
        onClose={() => { setRenameChapterTarget(null); setRenameChapterInput(''); }}
        onSubmit={handleConfirmRenameChapter}
      />

      <ProjectInfoModal
        isOpen={showProjectInfoModal}
        budgetName={budgetName}
        projectName={projectName}
        clientName={clientName}
        currency={currency}
        onBudgetNameChange={(val) => {
          isDirtyRef.current = true;
          setBudgetName(val);
        }}
        onProjectNameChange={(val) => {
          isDirtyRef.current = true;
          setProjectName(val);
        }}
        onClientNameChange={(val) => {
          isDirtyRef.current = true;
          setClientName(val);
        }}
        onCurrencyChange={(val) => {
          isDirtyRef.current = true;
          setCurrency(val);
        }}
        onClose={() => setShowProjectInfoModal(false)}
      />

      <LinkPartidaModal
        isOpen={Boolean(linkModalItem)}
        sourceItem={linkModalItem}
        availableTargetItems={capturedItems.filter((it) => it.id !== linkModalItem?.id && !isItemEmpty(it))}
        chapters={chapters}
        activeChapter={activeChapter}
        onClose={() => setLinkModalItem(null)}
        onConfirmLink={handleConfirmLink}
      />

      <StirrupCalculatorModal
        isOpen={Boolean(stirrupModalTarget)}
        targetItem={stirrupModalTarget?.item}
        targetPartial={stirrupModalTarget?.partial}
        onClose={() => setStirrupModalTarget(null)}
        onApplyStirrup={handleApplyStirrup}
      />

      {/* Modal de Búsqueda e Inclusión COVENIN (sin opciones IA ni Compartir) */}
      <BudgetSearchModal
        isOpen={showCatalogModal}
        onClose={() => {
          setShowCatalogModal(false);
          setCoveninTargetItemId(null);
        }}
        zIndexClass="z-[160]"
        activeDatabase={activeDatabase}
        setActiveDatabase={setActiveDatabase}
        databases={databases}
        availableBudgets={availableBudgets}
        showAiOption={false}
        showSharedOption={false}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchCovenin={searchCovenin}
        setSearchCovenin={setSearchCovenin}
        searchDesc={searchDesc}
        setSearchDesc={setSearchDesc}
        searchInsumos={searchInsumos}
        setSearchInsumos={setSearchInsumos}
        searching={searching}
        searchDatabase={searchDatabase}
        totalSearchResults={totalSearchResults}
        searchResults={searchResults}
        hasMoreSearchResults={hasMoreSearchResults}
        loadMoreSearchResults={loadMoreSearchResults}
        onAddItem={handleSelectCoveninPartida}
      />

      {/* Modal de Calibración Técnica de Partidas antes de Generar con IA */}
      <PartidasCalibrationModal
        isOpen={isCalibrationOpen}
        items={pendingBudgetItems}
        onClose={() => setIsCalibrationOpen(false)}
        onConfirm={handleCalibrationConfirmed}
        onOpenCoveninSearch={(item) => {
          handleOpenCoveninModal(item);
        }}
      />

      {/* Header Principal con Selector de Modo (Planilla vs Asistente/Chat) */}
      <header className="border-b border-amber-200 bg-[#FEF3C7] shrink-0 shadow-sm">
        {/* --- VISTA DESKTOP (>= sm) --- */}
        <div className="hidden sm:flex items-center justify-between px-4 sm:px-6 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-amber-900 font-bold text-base sm:text-lg leading-tight truncate">
                  Cómputos Métricos
                </h2>
                <span
                  className={`hidden sm:inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    isOnline
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-200 text-amber-900 border-amber-400 animate-pulse'
                  }`}
                >
                  {isOnline ? '● En línea' : '⚡ Modo Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Indicador de Partidas en Planilla */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-200/80 rounded-xl border border-amber-300 text-xs font-extrabold text-amber-900 shrink-0">
            <Table className="w-4 h-4 text-amber-800" />
            <span>Planilla ({validCount})</span>
          </div>

          {/* Acciones de Cabecera Desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowProjectInfoModal(true)}
              disabled={isCommitting}
              className="p-1.5 sm:p-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs"
              title="Datos del Presupuesto (Nombre, Proyecto, Cliente, Moneda)"
            >
              <Edit3 className="w-4 h-4 text-amber-700" />
            </button>

            <button
              type="button"
              onClick={() => {
                setChapterModalInput('');
                setShowChapterModal(true);
              }}
              disabled={isCommitting}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs"
              title="Agregar un nuevo capítulo a la planilla"
            >
              <FolderPlus className="w-4 h-4 text-amber-700" />
              <span className="hidden sm:inline">+ Capítulo</span>
            </button>

            <button
              type="button"
              onClick={handlePrintComputos}
              disabled={isCommitting || validCount === 0}
              className="p-1.5 sm:p-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs disabled:opacity-40"
              title="Imprimir planilla de cómputos en formato técnico"
            >
              <Printer className="w-4 h-4 text-amber-700" />
            </button>

            <button
              type="button"
              onClick={handleExportExcelComputos}
              disabled={isCommitting || validCount === 0}
              className="p-1.5 sm:p-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs disabled:opacity-40"
              title="Exportar planilla de cómputos a Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
            </button>

            {onSendToPartidas && (
              <button
                type="button"
                onClick={handleSendToPartidas}
                disabled={isCommitting || validCount === 0}
                className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-sm disabled:opacity-40"
                title="Llevar las cantidades de la planilla a la pestaña Partidas"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Llevar a Partidas</span>
              </button>
            )}

            <div className="h-5 w-px bg-amber-300 mx-0.5 hidden sm:block" />

            <button
              type="button"
              onClick={() => syncCloudAndLocalDrafts({ force: true })}
              disabled={isCommitting || isSyncing}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-xs disabled:opacity-50"
              title="Sincronizar planilla con la nube (Móvil / PC)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isSyncing ? 'Sincronizando...' : 'Actualizar'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLoadModal}
              disabled={isCommitting}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-xs"
              title="Abrir cómputos guardados"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>Abrir{savedList.length > 0 ? ` (${savedList.length})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => handleClearAll()}
              disabled={isCommitting}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-xs"
              title="Limpiar planilla y reiniciar"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden md:inline">Reiniciar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-full p-2 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* --- VISTA MÓVIL (< sm) --- */}
        <div className="sm:hidden flex flex-col p-2 gap-2 bg-[#FEF3C7] border-b border-amber-200">
          {/* Fila 1 Móvil: Botón Cerrar visible + Título compacto + Barra de Herramientas Deslizable sin desbordes */}
          <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isCommitting}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 shadow-xs cursor-pointer touch-target flex items-center justify-center"
                title="Cerrar Planilla"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowProjectInfoModal(true)}
                className="flex items-center gap-1 text-left min-w-0 cursor-pointer"
                title="Toca para editar datos del presupuesto"
              >
                <span className="font-extrabold text-amber-950 text-xs truncate max-w-[85px]">
                  {budgetName || 'Cómputos'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  title={isOnline ? 'En línea' : 'Offline'}
                />
              </button>
            </div>

            {/* Barra de Herramientas Móvil: estrictamente dentro del ancho (flex-1 min-w-0) con scroll horizontal */}
            <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center justify-end gap-1 pl-1 py-0.5">
              <button
                type="button"
                onClick={() => setShowProjectInfoModal(true)}
                disabled={isCommitting}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0"
                title="Datos del Presupuesto (Nombre, Obra, Cliente)"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setChapterModalInput('');
                  setShowChapterModal(true);
                }}
                disabled={isCommitting}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0"
                title="Agregar Capítulo"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-700" />
              </button>

              <button
                type="button"
                onClick={() => syncCloudAndLocalDrafts({ force: true })}
                disabled={isCommitting || isSyncing}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
                title="Sincronizar con la nube (Móvil / PC)"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleOpenLoadModal}
                disabled={isCommitting}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0 flex items-center gap-0.5 text-[11px] font-bold"
                title="Abrir cómputos guardados"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
                {savedList.length > 0 && <span className="text-[10px] text-amber-800 font-extrabold">{savedList.length}</span>}
              </button>

              <button
                type="button"
                onClick={handleExportExcelComputos}
                disabled={isCommitting || validCount === 0}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0 disabled:opacity-40"
                title="Exportar a Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
              </button>

              <button
                type="button"
                onClick={handlePrintComputos}
                disabled={isCommitting || validCount === 0}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0 disabled:opacity-40"
                title="Imprimir Planilla"
              >
                <Printer className="w-3.5 h-3.5 text-amber-700" />
              </button>

              {onSendToPartidas && (
                <button
                  type="button"
                  onClick={handleSendToPartidas}
                  disabled={isCommitting || validCount === 0}
                  className="p-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer shrink-0 disabled:opacity-40"
                  title="Llevar a Partidas"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleClearAll()}
                disabled={isCommitting}
                className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer shrink-0"
                title="Reiniciar Planilla"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <ComputosSheet
        descriptionFilter={descriptionFilter}
        expandedPartials={expandedPartials}
        filteredCapturedItems={filteredCapturedItems}
        handleAddPartial={handleAddPartial}
        handleClearPartials={handleClearPartials}
        handleDuplicateRow={handleDuplicateRow}
        handleEnrichItem={handleEnrichItem}
        handleInsertRowBelow={handleInsertRowBelow}
        handleOpenCoveninModal={handleOpenCoveninModal}
        handleOpenLinkModal={handleOpenLinkModal}
        handleOpenStirrupModal={handleOpenStirrupModal}
        handleRemoveChapterHeader={handleRemoveChapterHeader}
        handleRemoveItem={handleRemoveItem}
        handleRemovePartial={handleRemovePartial}
        handleRenameChapter={handleRenameChapter}
        handleToggleExpandPartials={handleToggleExpandPartials}
        handleTogglePartials={handleTogglePartials}
        handleUnlinkRow={handleUnlinkRow}
        handleUpdateItemField={handleUpdateItemField}
        handleUpdatePartialField={handleUpdatePartialField}
        setDescriptionFilter={setDescriptionFilter}
        viewMode={viewMode}
      />

      {/* BARRA INFERIOR DE ACCIÓN (Siempre accesible en ambas vistas con botón Guardar y Generar) */}
      <div className="p-2 sm:p-4 pb-safe bg-[#FEF3C7] border-t border-amber-200 shrink-0">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {commitError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {commitError}
            </div>
          )}

          {/* Barra de Guardar Borrador y Confirmación del Presupuesto */}
          {/* --- VERSIÓN MÓVIL TIPO APP (< sm) --- */}
          <div className="sm:hidden flex items-center justify-between gap-2 bg-amber-100/95 backdrop-blur border border-amber-300 rounded-2xl p-2 shadow-xs">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isCommitting}
              className="px-3 py-2 rounded-xl bg-white hover:bg-amber-50 active:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 touch-target"
              title="Guardar borrador"
            >
              {saveStatus ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="text-emerald-700 font-extrabold text-[11px]">{saveStatus}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-amber-700" />
                  <span className="text-[11px]">Guardar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleConfirmAndGenerateBudget}
              disabled={isCommitting || validCount === 0}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/30 disabled:opacity-50 transition-all cursor-pointer touch-target min-w-0"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Generar Presupuesto ({validCount})</span>
                </>
              )}
            </button>
          </div>

          {/* --- VERSIÓN ESCRITORIO CON CAMPO DE NOMBRE COMPLETO (>= sm) --- */}
          <div className="hidden sm:flex items-center justify-between gap-2.5 bg-amber-100/90 border border-amber-300 rounded-2xl p-2.5 shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileCheck2 className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                disabled={isCommitting}
                placeholder="Nombre del presupuesto..."
                className="flex-1 min-w-0 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-950 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isCommitting}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Guardar borrador de la planilla para pausar y continuar después"
              >
                {saveStatus ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span className="text-emerald-700 font-extrabold">{saveStatus}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-amber-700" />
                    <span>Guardar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleConfirmAndGenerateBudget}
                disabled={isCommitting || validCount === 0}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-amber-600/25 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando Presupuesto...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Generar Presupuesto ({validCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
