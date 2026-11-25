import React, { useState, useEffect, useReducer, useRef, useMemo, useCallback } from 'react';
import {
  Save,
  RotateCcw,
  Undo2,
  Redo2,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { controlObraService } from '../controlObraService';
import ComputosSheet from '../../computos/components/ComputosSheet.jsx';
import { createRowsState, rowsReducer } from '../../computos/state/rowsReducer.js';
import { createBlankRow, isItemEmpty, normalizeRowsWithSingleTrailingBlank } from '../../computos/domain/rows.js';
import { round2, cleanFormulaDisplay } from '../../computos/domain/formulas.js';
import LinkPartidaModal from '../../computos/components/modals/LinkPartidaModal.jsx';
import StirrupCalculatorModal from '../../computos/components/modals/StirrupCalculatorModal.jsx';
import { AddChapterModal, RenameChapterModal } from '../../computos/components/ChapterModals.jsx';

const today = () => new Date().toISOString().slice(0, 10);

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRowsFromBudgetItems(budgetItems, savedRows = null) {
  if (!budgetItems || budgetItems.length === 0) {
    return [createBlankRow('GENERAL')];
  }

  const savedMap = new Map();
  if (Array.isArray(savedRows)) {
    savedRows.forEach((r) => {
      if (r && r.item_id) savedMap.set(r.item_id, r);
    });
  }

  const firstChap = budgetItems[0]?.chapter || 'GENERAL';

  const rows = budgetItems.map((it, idx) => {
    const saved = savedMap.get(it.item_id);
    if (saved) {
      return {
        ...saved,
        item_id: it.item_id,
        cod_par: it.code || saved.cod_par || '',
        cov_par: it.code || saved.cov_par || '',
        description: it.description || saved.description || '',
        unit: (it.unit || saved.unit || 'UND').toUpperCase(),
        chapter: it.chapter || saved.chapter || 'GENERAL',
        unit_price: Number(it.unit_price || 0),
        budget_quantity: Number(it.current_quantity || it.original_quantity || 0),
        budget_hours: Number(it.budget_hours || 0),
      };
    }

    const chap = it.chapter || 'GENERAL';
    const base = createBlankRow(chap);
    return {
      ...base,
      id: `item-${it.item_id || idx}`,
      item_id: it.item_id,
      cod_par: it.code || '',
      cov_par: it.code || '',
      description: it.description || '',
      unit: (it.unit || 'UND').toUpperCase(),
      chapter: chap,
      quantity: Number(it.executed_quantity || 0),
      partial: 0,
      unit_price: Number(it.unit_price || 0),
      budget_quantity: Number(it.current_quantity || it.original_quantity || 0),
      budget_hours: Number(it.budget_hours || 0),
      isDefaultQty: false,
    };
  });

  return normalizeRowsWithSingleTrailingBlank(rows, firstChap);
}

export default function MedicionesTab({
  budgetId,
  budgetName,
  items = [],
  currency = 'USD',
  modifiedAmount = 0,
  onMeasurementsSaved,
  onCascadeUpdate,
}) {
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [expandedPartials, setExpandedPartials] = useState({});
  const [measurementDate, setMeasurementDate] = useState(today());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modales
  const [linkModalItem, setLinkModalItem] = useState(null);
  const [stirrupModalTarget, setStirrupModalTarget] = useState(null);
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [chapterModalInput, setChapterModalInput] = useState('');
  const [renameChapterTarget, setRenameChapterTarget] = useState(null);

  // Inicializar estado del reducer con partidas del presupuesto y borrador local previo
  const [rowsState, rowsDispatch] = useReducer(rowsReducer, null, () => {
    let saved = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage && budgetId) {
        const raw = window.localStorage.getItem(`control_obra_mediciones_${budgetId}`);
        if (raw) saved = JSON.parse(raw);
      }
    } catch (_e) {
      saved = null;
    }
    const initialRows = buildRowsFromBudgetItems(items, saved);
    const activeChap = items[0]?.chapter || 'GENERAL';
    return createRowsState(initialRows, activeChap);
  });

  const activeChapter = rowsState.activeChapter || items[0]?.chapter || 'GENERAL';
  const capturedItems = rowsState.rows;
  const canUndo = (rowsState.history?.length || 0) > 0;
  const canRedo = (rowsState.future?.length || 0) > 0;

  // Sincronizar filas iniciales si items llega asíncronamente
  const initializedItemsRef = useRef(false);
  useEffect(() => {
    if (!items || items.length === 0 || initializedItemsRef.current) return;

    const currentItemIds = new Set(capturedItems.filter((r) => r.item_id).map((r) => r.item_id));
    const hasItemsLoaded = items.some((it) => currentItemIds.has(it.item_id));

    if (!hasItemsLoaded) {
      let saved = null;
      try {
        const raw = localStorage.getItem(`control_obra_mediciones_${budgetId}`);
        if (raw) saved = JSON.parse(raw);
      } catch (_e) {
        saved = null;
      }
      const initialRows = buildRowsFromBudgetItems(items, saved);
      rowsDispatch({
        type: 'SET_ROWS',
        payload: {
          rows: initialRows,
          activeChapter: items[0]?.chapter || 'GENERAL',
        },
      });
    }
    initializedItemsRef.current = true;
  }, [items, budgetId, capturedItems]);

  // Refs para evitar bucles infinitos de renderizado con onCascadeUpdate
  const onCascadeUpdateRef = useRef(onCascadeUpdate);
  useEffect(() => {
    onCascadeUpdateRef.current = onCascadeUpdate;
  }, [onCascadeUpdate]);
  const lastCascadeRef = useRef(null);

  // Recálculo en cascada automático hacia la cabecera del Control de Obra
  useEffect(() => {
    if (!items || items.length === 0) return;

    const itemsMap = new Map();
    items.forEach((it) => itemsMap.set(it.item_id, it));

    let totalExecutedAmount = 0;
    let totalBudgetHours = 0;
    let totalExecutedHours = 0;

    capturedItems.forEach((row) => {
      if (!row.item_id) return;
      const budgetItem = itemsMap.get(row.item_id);
      if (!budgetItem) return;

      const execQty = Number(row.quantity || 0);
      const unitPrice = Number(budgetItem.unit_price || 0);
      const currentQty = Number(budgetItem.current_quantity || 1);

      totalExecutedAmount += execQty * unitPrice;

      if (budgetItem.budget_hours) {
        totalBudgetHours += Number(budgetItem.budget_hours);
        totalExecutedHours += Number(budgetItem.budget_hours) * (execQty / (currentQty || 1));
      }
    });

    const physicalPercent = modifiedAmount > 0 ? (totalExecutedAmount / modifiedAmount) * 100 : 0;
    const hhPercent = totalBudgetHours > 0 ? (totalExecutedHours / totalBudgetHours) * 100 : physicalPercent;

    const nextTotals = {
      executedAmount: round2(totalExecutedAmount),
      physicalPercent: round2(physicalPercent),
      hhPercent: round2(hhPercent),
    };

    const prevTotals = lastCascadeRef.current;
    const hasChanged =
      !prevTotals ||
      prevTotals.executedAmount !== nextTotals.executedAmount ||
      prevTotals.physicalPercent !== nextTotals.physicalPercent ||
      prevTotals.hhPercent !== nextTotals.hhPercent;

    if (hasChanged && typeof onCascadeUpdateRef.current === 'function') {
      lastCascadeRef.current = nextTotals;
      onCascadeUpdateRef.current(nextTotals);
    }

    // Persistir localmente para no perder trabajo
    const nonBlank = capturedItems.filter((r) => !isItemEmpty(r));
    if (nonBlank.length > 0 && budgetId) {
      try {
        localStorage.setItem(`control_obra_mediciones_${budgetId}`, JSON.stringify(nonBlank));
      } catch (_e) {
        // ignore
      }
    }
  }, [capturedItems, items, modifiedAmount, budgetId]);

  // Filtrado de partidas por descripción, código o capítulo
  const filteredCapturedItems = useMemo(() => {
    if (!descriptionFilter.trim()) return capturedItems;
    const q = descriptionFilter.toLowerCase().trim();
    return capturedItems.filter((it) => {
      if (!it.description && !it.cod_par) return false;
      return (
        (it.description || '').toLowerCase().includes(q) ||
        (it.cod_par || '').toLowerCase().includes(q) ||
        (it.chapter || '').toLowerCase().includes(q)
      );
    });
  }, [capturedItems, descriptionFilter]);

  // Handlers para ComputosSheet
  const handleUpdateItemField = (itemId, field, value) => {
    rowsDispatch({
      type: 'UPDATE_FIELD',
      payload: { itemId, field, value, activeChapter },
    });
  };

  const handleUpdatePartialField = (itemId, partialId, field, value) => {
    rowsDispatch({
      type: 'UPDATE_PARTIAL_FIELD',
      payload: { itemId, partialId, field, value, activeChapter },
    });
  };

  const handleAddPartial = (itemId) => {
    rowsDispatch({
      type: 'ADD_PARTIAL',
      payload: { itemId, activeChapter },
    });
    setExpandedPartials((prev) => ({ ...prev, [itemId]: true }));
  };

  const handleClearPartials = (itemId) => {
    rowsDispatch({
      type: 'CLEAR_PARTIALS',
      payload: { itemId, activeChapter },
    });
  };

  const handleTogglePartials = (itemId) => {
    rowsDispatch({
      type: 'TOGGLE_PARTIALS',
      payload: { itemId, activeChapter },
    });
    setExpandedPartials((prev) => ({ ...prev, [itemId]: true }));
  };

  const handleRemovePartial = (itemId, partialId) => {
    rowsDispatch({
      type: 'REMOVE_PARTIAL',
      payload: { itemId, partialId, activeChapter },
    });
  };

  const handleToggleExpandPartials = (itemId) => {
    setExpandedPartials((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleDuplicateRow = (item) => {
    rowsDispatch({
      type: 'DUPLICATE_ROW',
      payload: { item, activeChapter },
    });
  };

  const handleInsertRowBelow = (targetItem) => {
    rowsDispatch({
      type: 'INSERT_ROW_BELOW',
      payload: { targetItem, activeChapter },
    });
  };

  const handleRemoveItem = (itemId) => {
    rowsDispatch({
      type: 'REMOVE_ROW',
      payload: { itemId, activeChapter },
    });
  };

  const handleRemoveChapterHeader = (chapterName) => {
    rowsDispatch({
      type: 'REMOVE_CHAPTER',
      payload: { chapterName, activeChapter },
    });
  };

  const handleRenameChapter = (oldName) => {
    setRenameChapterTarget(oldName);
  };

  const handleConfirmRenameChapter = (newName) => {
    if (!renameChapterTarget || !newName) return;
    rowsDispatch({
      type: 'RENAME_CHAPTER',
      payload: { oldName: renameChapterTarget, newName, activeChapter },
    });
    setRenameChapterTarget(null);
  };

  const handlePasteRows = useCallback((pastedRows, mode = 'append') => {
    if (!pastedRows || pastedRows.length === 0) return;
    if (mode === 'merge') {
      rowsDispatch({
        type: 'MERGE_OR_APPEND_ROWS',
        payload: { rows: pastedRows, activeChapter },
      });
      toast.success(`${pastedRows.length} partida(s) procesadas con éxito.`);
    } else {
      rowsDispatch({
        type: 'ADD_ROWS',
        payload: { rows: pastedRows, activeChapter },
      });
      toast.success(`${pastedRows.length} partida(s) pegadas.`);
    }
  }, [activeChapter]);

  const handlePasteIntoRow = useCallback((targetItemId, copiedData) => {
    rowsDispatch({
      type: 'PASTE_INTO_ROW',
      payload: { targetItemId, copiedData, activeChapter },
    });
  }, [activeChapter]);

  const handleUnlinkRow = (itemId) => {
    rowsDispatch({
      type: 'UNLINK_ROW',
      payload: { itemId, activeChapter },
    });
  };

  const handleOpenLinkModal = (item) => {
    setLinkModalItem(item);
  };

  const handleConfirmLink = (linkData) => {
    rowsDispatch({
      type: 'LINK_ROWS',
      payload: { ...linkData, activeChapter },
    });
    if (linkData?.targetItemId) {
      setExpandedPartials((prev) => ({ ...prev, [linkData.targetItemId]: true }));
    }
    toast.success('Partida vinculada exitosamente con actualización en cascada');
    setLinkModalItem(null);
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

  const handleEnrichItem = (itemId, newDescription) => {
    handleUpdateItemField(itemId, 'description', newDescription);
  };

  const handleApplyCoveninCandidate = (itemId, candidate) => {
    if (!candidate) return;
    if (candidate.code) handleUpdateItemField(itemId, 'cod_par', candidate.code);
    if (candidate.unit) handleUpdateItemField(itemId, 'unit', candidate.unit);
  };

  const handleOpenCoveninModal = () => {
    toast('El catálogo COVENIN está disponible en la Hoja de Presupuesto.');
  };

  const handleAddMacroRows = (macroRows, meta = {}) => {
    if (!Array.isArray(macroRows) || macroRows.length === 0) return;
    const instanceId = meta.instanceId || `macro-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const enriched = macroRows.map((row) => ({
      ...row,
      macro_instance_id: instanceId,
      macro_template_id: 'pared_perimetral',
      macro_input: meta.input || null,
    }));
    rowsDispatch({
      type: meta.instanceId ? 'REPLACE_MACRO_ROWS' : 'ADD_ROWS',
      payload: { rows: enriched, instanceId, activeChapter },
    });
    toast.success(`${enriched.length} partida(s) de pared perimetral agregadas`);
  };

  const macroInstances = useMemo(() => {
    const map = new Map();
    capturedItems.forEach((row) => {
      if (!row.macro_instance_id || !row.macro_input) return;
      if (!map.has(row.macro_instance_id)) {
        map.set(row.macro_instance_id, {
          id: row.macro_instance_id,
          templateId: row.macro_template_id,
          input: row.macro_input,
          name: row.macro_template_id === 'pared_perimetral' ? 'Pared perimetral' : 'Macro actividad',
          rowCount: 0,
        });
      }
      map.get(row.macro_instance_id).rowCount += 1;
    });
    return [...map.values()];
  }, [capturedItems]);

  const handleUndo = useCallback(() => {
    if ((rowsState.history?.length || 0) === 0) return;
    rowsDispatch({ type: 'UNDO' });
    toast.success('Cambio deshecho');
  }, [rowsState.history?.length]);

  const handleRedo = useCallback(() => {
    if ((rowsState.future?.length || 0) === 0) return;
    rowsDispatch({ type: 'REDO' });
    toast.success('Cambio rehecho');
  }, [rowsState.future?.length]);

  const handleResetToBudget = () => {
    if (!window.confirm('¿Deseas reiniciar las mediciones con las cantidades originales del presupuesto?')) return;
    try {
      localStorage.removeItem(`control_obra_mediciones_${budgetId}`);
    } catch (_e) {
      // ignore
    }
    const initialRows = buildRowsFromBudgetItems(items, null);
    rowsDispatch({
      type: 'SET_ROWS',
      payload: {
        rows: initialRows,
        activeChapter: items[0]?.chapter || 'GENERAL',
      },
    });
    toast.success('Mediciones reiniciadas con valores base.');
  };

  // Guardar mediciones en backend (syncProgress) y en localStorage
  const handleSaveMediciones = async () => {
    if (!budgetId) return;
    setIsSaving(true);
    try {
      const nonBlank = capturedItems.filter((r) => r.item_id && !isItemEmpty(r));
      const syncItems = nonBlank.map((r) => ({
        item_id: r.item_id,
        quantity: Number(r.quantity || 0),
      }));

      if (syncItems.length === 0) {
        toast.error('No hay partidas con mediciones válidas para guardar.');
        setIsSaving(false);
        return;
      }

      await controlObraService.syncProgress(budgetId, {
        items: syncItems,
        entry_date: measurementDate || today(),
        notes: `Mediciones de obra actualizadas (${nonBlank.length} partidas)`,
      });

      try {
        localStorage.setItem(`control_obra_mediciones_${budgetId}`, JSON.stringify(nonBlank));
      } catch (_e) {
        // ignore
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      toast.success('¡Mediciones guardadas y avances recalculados!');

      if (typeof onMeasurementsSaved === 'function') {
        await onMeasurementsSaved();
      }
    } catch (err) {
      toast.error(err.message || 'Error al guardar mediciones en Control de Obra.');
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar Excel nativo con soporte para transporte (Distancia, M3)
  const handleExportExcel = () => {
    const validItems = capturedItems.filter((it) => !isItemEmpty(it));
    if (validItems.length === 0) {
      toast.error('No hay partidas para exportar');
      return;
    }

    const cleanName = (budgetName || 'Planilla_Mediciones_Control_Obra').trim().replace(/[/\\?%*:|"<>]/g, '_');
    const todayStr = new Date().toLocaleDateString('es-VE');

    let rowsHtml = '';
    let currentChapter = null;
    let itemNumber = 1;

    validItems.forEach((it) => {
      const chap = (it.chapter || 'GENERAL').trim().toUpperCase();
      if (chap !== currentChapter) {
        currentChapter = chap;
        rowsHtml += `
          <tr style="background-color: #fef3c7; font-weight: bold; font-size: 12px;">
            <td colspan="12" style="padding: 8px; border: 1px solid #d97706; color: #78350f;">
              CAPÍTULO: ${escapeHtml(chap)}
            </td>
          </tr>
        `;
      }

      const hasPartials = it.partials && it.partials.length > 0;
      rowsHtml += `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
          <td style="text-align: center; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc; vertical-align: top;">${itemNumber}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: 600; width: 500px; white-space: normal; vertical-align: top;">
            ${escapeHtml(it.description || '')}
            ${cleanFormulaDisplay(it.formula) ? `<br/><span style="font-family: monospace; font-size: 9px; color: #78350f; background-color: #fef3c7;">📐 ${escapeHtml(cleanFormulaDisplay(it.formula))}</span>` : ''}
          </td>
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
              <td style="border: 1px solid #cbd5e1; padding-left: 20px; font-style: italic; color: #78350f; width: 500px; white-space: normal; vertical-align: top;">
                ${escapeHtml(p.description || `Parcial ${pIdx + 1}`)}
                ${cleanFormulaDisplay(p.formula) ? `<br/><span style="font-family: monospace; font-size: 8.5px; color: #78350f; background-color: #fef3c7;">📐 ${escapeHtml(cleanFormulaDisplay(p.formula))}</span>` : ''}
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
          <style>
            th { background-color: #d97706; color: #ffffff; border: 1px solid #b45309; padding: 6px 3px; font-size: 9px; vertical-align: middle; white-space: nowrap; text-align: center; }
            td { padding: 5px; vertical-align: top; }
          </style>
        </head>
        <body>
          <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
            <tr>
              <td colspan="12" style="font-size: 20px; font-weight: bold; text-align: center; padding: 14px 6px; color: #1e293b;">
                Planilla de Mediciones de Obra — ${escapeHtml(budgetName || 'Control de Obra')}
              </td>
            </tr>
            <tr>
              <td colspan="12" style="padding: 4px 6px; font-size: 11px; text-align: left; font-weight: bold; color: #1e293b;">
                Fecha de medición: ${todayStr}
              </td>
            </tr>
            <tr><td colspan="12" style="height: 8px;"></td></tr>
            <thead>
              <tr>
                <th style="width: 35px;">N°</th>
                <th style="width: 500px; text-align: left;">DESCRIPCIÓN DE LA PARTIDA</th>
                <th style="width: 55px;">UND</th>
                <th style="width: 75px;">LARGO</th>
                <th style="width: 75px;">ANCHO</th>
                <th style="width: 75px;">ALTO</th>
                <th style="width: 65px;">VECES</th>
                <th style="width: 75px;">FACTOR</th>
                <th style="width: 80px;">DIST. (km)</th>
                <th style="width: 85px;">M3 (BOTE)</th>
                <th style="width: 85px;">CANTIDAD MEDIDA</th>
                <th style="width: 200px; text-align: left;">OBSERVACIONES</th>
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

  const validItemsCount = capturedItems.filter((it) => !isItemEmpty(it)).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FEF3C7] overflow-hidden">
      {/* BARRA DE HERRAMIENTAS Y ACCIONES DE LA PLANILLA */}
      <div className="px-3 sm:px-6 py-2.5 bg-amber-100/90 border-b border-amber-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 rounded-xl bg-amber-200 border border-amber-300 text-amber-900 shadow-2xs shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-amber-950 truncate">
                Planilla de Cómputos y Mediciones
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300 shadow-2xs">
                {validItemsCount} partidas vinculadas
              </span>
            </div>
            <p className="text-[11px] text-amber-800 font-medium hidden sm:block">
              Ingresa dimensiones, transportes (km) o desgloses. Los avances de obra se recalculan automáticamente en cascada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Selector de Fecha de Corte */}
          <div className="hidden md:flex items-center gap-1 bg-white border border-amber-300 rounded-xl px-2 py-1 shadow-2xs text-xs font-semibold text-amber-950">
            <Calendar size={13} className="text-amber-700" />
            <span className="text-[10px] text-amber-700 font-bold uppercase">Fecha:</span>
            <input
              type="date"
              value={measurementDate}
              onChange={(e) => setMeasurementDate(e.target.value)}
              className="text-xs bg-transparent border-none focus:outline-none font-bold text-amber-950"
            />
          </div>

          {/* Toggle Vista Tabla / Tarjetas */}
          <div className="flex items-center bg-white border border-amber-300 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-amber-300 text-amber-950 shadow-2xs' : 'text-amber-800 hover:bg-amber-50'
              }`}
              title="Vista de Tabla Clásica"
            >
              <TableIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-amber-300 text-amber-950 shadow-2xs' : 'text-amber-800 hover:bg-amber-50'
              }`}
              title="Vista de Tarjetas / Móvil"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Deshacer / Rehacer */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-40 shadow-2xs cursor-pointer"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-40 shadow-2xs cursor-pointer"
            title="Rehacer (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>

          {/* Exportar a Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-50 shadow-2xs cursor-pointer"
            title="Exportar planilla a Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            <span>Excel</span>
          </button>

          {/* Reiniciar */}
          <button
            type="button"
            onClick={handleResetToBudget}
            className="p-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 shadow-2xs cursor-pointer"
            title="Restablecer mediciones"
          >
            <RotateCcw size={15} />
          </button>

          {/* BOTÓN PRINCIPAL: Guardar Mediciones en Control de Obra */}
          <button
            type="button"
            onClick={handleSaveMediciones}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-60"
            title="Guardar mediciones e impactar los avances de obra en el servidor"
          >
            {isSaving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-300 animate-pulse" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Guardar Mediciones</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* COMPONENTE RECICLADO DE LA PLANILLA DE CÓMPUTOS */}
      <ComputosSheet
        descriptionFilter={descriptionFilter}
        expandedPartials={expandedPartials}
        filteredCapturedItems={filteredCapturedItems}
        handleAddPartial={handleAddPartial}
        handleClearPartials={handleClearPartials}
        handleDuplicateRow={handleDuplicateRow}
        handleEnrichItem={handleEnrichItem}
        handleApplyCoveninCandidate={handleApplyCoveninCandidate}
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
        onAddMacroRows={handleAddMacroRows}
        macroInstances={macroInstances}
        onPasteRows={handlePasteRows}
        handlePasteIntoRow={handlePasteIntoRow}
      />

      {/* MODALES DE SOPORTE INTEGRADOS */}
      {linkModalItem && (
        <LinkPartidaModal
          isOpen={Boolean(linkModalItem)}
          item={linkModalItem}
          allItems={capturedItems}
          onClose={() => setLinkModalItem(null)}
          onConfirm={handleConfirmLink}
        />
      )}

      {stirrupModalTarget && (
        <StirrupCalculatorModal
          isOpen={Boolean(stirrupModalTarget)}
          target={stirrupModalTarget}
          onClose={() => setStirrupModalTarget(null)}
          onApply={handleApplyStirrup}
        />
      )}

      {showAddChapterModal && (
        <AddChapterModal
          isOpen={showAddChapterModal}
          chapterName={chapterModalInput}
          onChange={(e) => setChapterModalInput(e.target.value)}
          onClose={() => setShowAddChapterModal(false)}
          onAdd={() => {
            if (chapterModalInput.trim()) {
              rowsDispatch({
                type: 'ADD_ROWS',
                payload: {
                  rows: [createBlankRow(chapterModalInput.trim())],
                  activeChapter: chapterModalInput.trim(),
                },
              });
              setChapterModalInput('');
              setShowAddChapterModal(false);
              toast.success(`Capítulo "${chapterModalInput.trim()}" agregado`);
            }
          }}
        />
      )}

      {renameChapterTarget && (
        <RenameChapterModal
          isOpen={Boolean(renameChapterTarget)}
          oldName={renameChapterTarget}
          onClose={() => setRenameChapterTarget(null)}
          onRename={handleConfirmRenameChapter}
        />
      )}
    </div>
  );
}
