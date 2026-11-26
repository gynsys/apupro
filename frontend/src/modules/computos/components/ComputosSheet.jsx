import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, Copy, ClipboardPaste, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import ComputosCards from './ComputosCards.jsx';
import ComputosTable from './ComputosTable.jsx';
import PerimeterWallModal from './PerimeterWallModal.jsx';
import PasteComputosModal from './modals/PasteComputosModal.jsx';
import { serializeRowsToTsv, parseTabularComputosClipboard, KOSTOS360_CLIPBOARD_KEY } from '../domain/clipboard.js';
import { isItemEmpty } from '../domain/rows.js';

export default function ComputosSheet({
  descriptionFilter,
  expandedPartials,
  filteredCapturedItems,
  handleAddPartial,
  handleClearPartials,
  handleDuplicateRow,
  handleEnrichItem,
  handleApplyCoveninCandidate,
  handleInsertRowBelow,
  handleOpenCoveninModal,
  handleOpenLinkModal,
  handleOpenStirrupModal,
  handleRemoveChapterHeader,
  handleRemoveItem,
  handleRemovePartial,
  handleRenameChapter,
  handleToggleExpandPartials,
  handleTogglePartials,
  handleUnlinkRow,
  handleUpdateItemField,
  handleUpdatePartialField,
  setDescriptionFilter,
  viewMode,
  onAddMacroRows,
  macroInstances = [],
  onPasteRows,
  handlePasteIntoRow,
}) {
  const [showWallModal, setShowWallModal] = useState(false);
  const [wallEditing, setWallEditing] = useState(null);

  // Estados de selección independiente: Mediciones (ITEM) y Descripción
  const [selectedMeasurementIds, setSelectedMeasurementIds] = useState(new Set());
  const [selectedDescriptionIds, setSelectedDescriptionIds] = useState(new Set());
  const [activeRowId, setActiveRowId] = useState(null);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const onToggleSelectMeasurement = useCallback((rowId) => {
    setSelectedMeasurementIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
    setActiveRowId(rowId);
  }, []);

  const onToggleSelectDescription = useCallback((rowId) => {
    setSelectedDescriptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
    setActiveRowId(rowId);
  }, []);

  const onSelectAllMeasurements = useCallback((selectAll) => {
    if (selectAll) {
      const ids = filteredCapturedItems.filter((r) => !isItemEmpty(r)).map((r) => r.id);
      setSelectedMeasurementIds(new Set(ids));
    } else {
      setSelectedMeasurementIds(new Set());
    }
  }, [filteredCapturedItems]);

  const onSelectAllDescriptions = useCallback((selectAll) => {
    if (selectAll) {
      const ids = filteredCapturedItems.filter((r) => !isItemEmpty(r)).map((r) => r.id);
      setSelectedDescriptionIds(new Set(ids));
    } else {
      setSelectedDescriptionIds(new Set());
    }
  }, [filteredCapturedItems]);

  const handleCopySelected = useCallback(async () => {
    const measIds = new Set(selectedMeasurementIds);
    const descIds = new Set(selectedDescriptionIds);

    // Si no hay checkboxes marcados pero hay fila activa, copiar las mediciones de esa fila
    let targetRows = filteredCapturedItems.filter(
      (r) => !isItemEmpty(r) && (measIds.has(r.id) || descIds.has(r.id))
    );
    if (targetRows.length === 0 && activeRowId) {
      const activeRow = filteredCapturedItems.find((r) => r.id === activeRowId);
      if (activeRow && !isItemEmpty(activeRow)) {
        targetRows = [activeRow];
        measIds.add(activeRow.id);
      }
    }

    if (targetRows.length === 0) {
      toast('Selecciona al menos una partida para copiar.');
      return;
    }

    const firstRow = targetRows[0];
    const hasMeas = measIds.has(firstRow.id) || measIds.size === 0;
    const hasDesc = descIds.has(firstRow.id);
    const copyMode = hasMeas && hasDesc ? 'full' : hasMeas ? 'measurements' : 'description';

    const copiedPayload = {
      type: 'KOSTOS360_COMPUTOS_CLIPBOARD_V2',
      copiedAt: new Date().toISOString(),
      copyMode,
      sourceRowId: firstRow.id,
      copiedItem: {
        copyMode,
        description: firstRow.description,
        cod_par: firstRow.cod_par,
        unit: firstRow.unit,
        length: firstRow.length,
        width: firstRow.width,
        height: firstRow.height,
        times: firstRow.times,
        factor: firstRow.factor,
        distance: firstRow.distance,
        m3: firstRow.m3,
        geometryType: firstRow.geometryType,
        partials: Array.isArray(firstRow.partials) ? firstRow.partials.map((p) => ({ ...p })) : null,
      },
      rows: targetRows.map((r) => ({
        copyMode: measIds.has(r.id) && descIds.has(r.id) ? 'full' : measIds.has(r.id) ? 'measurements' : 'description',
        ...r,
      })),
    };

    try {
      localStorage.setItem(KOSTOS360_CLIPBOARD_KEY, JSON.stringify(copiedPayload));
    } catch (_e) {}

    try {
      const tsvText = serializeRowsToTsv(targetRows);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsvText);
      }
    } catch (_e) {}

    // Deseleccionar origen tras copiar para que el usuario pueda elegir el destino limpiamente
    setSelectedMeasurementIds(new Set());
    setSelectedDescriptionIds(new Set());
    setActiveRowId(null);

    const partialCount = Array.isArray(firstRow.partials) ? firstRow.partials.length : 0;
    if (copyMode === 'measurements') {
      if (partialCount > 0) {
        toast.success(`✓ Mediciones copiadas (${partialCount} parciales). Selecciona la partida destino y presiona Ctrl+V.`);
      } else {
        toast.success('✓ Mediciones copiadas. Selecciona la partida destino y presiona Ctrl+V.');
      }
    } else if (copyMode === 'full') {
      toast.success(`✓ Partida completa copiada (descripción + ${partialCount} parciales). Selecciona destino y presiona Ctrl+V.`);
    } else {
      toast.success('✓ Descripción copiada. Selecciona destino y presiona Ctrl+V.');
    }
  }, [selectedMeasurementIds, selectedDescriptionIds, filteredCapturedItems, activeRowId]);

  const handlePasteDirect = useCallback(async () => {
    // 1. Portapapeles interno de Kostos360 (DIRECTO, SIN MODAL)
    let stored = null;
    try {
      const raw = localStorage.getItem(KOSTOS360_CLIPBOARD_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (_e) {}

    if (stored && stored.type === 'KOSTOS360_COMPUTOS_CLIPBOARD_V2' && stored.copiedItem) {
      let targetId = activeRowId;
      if (!targetId && selectedMeasurementIds.size > 0) {
        targetId = Array.from(selectedMeasurementIds)[0];
      }
      if (!targetId && selectedDescriptionIds.size > 0) {
        targetId = Array.from(selectedDescriptionIds)[0];
      }

      if (targetId) {
        if (typeof handlePasteIntoRow === 'function') {
          handlePasteIntoRow(targetId, stored.copiedItem);
        }
        if (Array.isArray(stored.copiedItem.partials) && stored.copiedItem.partials.length > 0) {
          handleToggleExpandPartials?.(targetId);
        }
        const targetRow = filteredCapturedItems.find((r) => r.id === targetId);
        const pCount = stored.copiedItem.partials?.length || 0;
        if (stored.copyMode === 'measurements') {
          toast.success(`✓ ${pCount > 0 ? `${pCount} parciales pegados` : 'Mediciones pegadas'} en "${targetRow?.description || 'Partida'}". Total recalculado.`);
        } else if (stored.copyMode === 'full') {
          toast.success(`✓ Partida y ${pCount} parciales pegados en el destino.`);
        } else {
          toast.success('✓ Descripción pegada.');
        }
        // Limpiar selección porque ya terminó la operación
        setActiveRowId(null);
        setSelectedMeasurementIds(new Set());
        setSelectedDescriptionIds(new Set());
        return;
      }

      if (Array.isArray(stored.rows) && stored.rows.length > 0) {
        if (typeof onPasteRows === 'function') {
          onPasteRows(stored.rows, 'append');
        }
        toast.success(`✓ ${stored.rows.length} partida(s) anexadas.`);
        setActiveRowId(null);
        setSelectedMeasurementIds(new Set());
        setSelectedDescriptionIds(new Set());
        return;
      }
    }

    // 2. Portapapeles externo de Excel / texto
    if (navigator?.clipboard?.readText) {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && (clipText.includes('\t') || clipText.includes('\n'))) {
          const { rows } = parseTabularComputosClipboard(clipText);
          if (rows.length > 0) {
            if (activeRowId) {
              const partialsFromExcel = rows.map((r, pIdx) => ({
                id: `part-xl-${pIdx}-${Date.now()}`,
                description: r.description || `Parcial ${pIdx + 1}`,
                length: r.length ?? '',
                width: r.width ?? '',
                height: r.height ?? '',
                times: r.times ?? 1,
                factor: r.factor ?? '',
                distance: r.distance ?? '',
                m3: r.m3 ?? '',
                partial: r.quantity ?? 0,
              }));
              if (typeof handlePasteIntoRow === 'function') {
                handlePasteIntoRow(activeRowId, {
                  copyMode: 'measurements',
                  partials: partialsFromExcel,
                });
                handleToggleExpandPartials?.(activeRowId);
                toast.success(`✓ ${partialsFromExcel.length} parciales pegados desde Excel.`);
                setActiveRowId(null);
                setSelectedMeasurementIds(new Set());
                setSelectedDescriptionIds(new Set());
                return;
              }
            } else if (typeof onPasteRows === 'function') {
              onPasteRows(rows, 'append');
              toast.success(`✓ ${rows.length} partida(s) pegadas.`);
              setActiveRowId(null);
              setSelectedMeasurementIds(new Set());
              setSelectedDescriptionIds(new Set());
              return;
            }
          }
        }
      } catch (_e) {}
    }

    // Modal de pegado solo si no se pudo pegar directamente
    setShowPasteModal(true);
  }, [activeRowId, selectedMeasurementIds, selectedDescriptionIds, filteredCapturedItems, handlePasteIntoRow, handleToggleExpandPartials, onPasteRows]);

  const handleApplyPasteModalRows = useCallback((parsedRows, mode = 'append') => {
    if (!parsedRows || parsedRows.length === 0) return;
    if (typeof onPasteRows === 'function') {
      onPasteRows(parsedRows, mode);
    } else if (typeof handleInsertRowBelow === 'function') {
      parsedRows.forEach((r) => handleInsertRowBelow(r));
      toast.success(`${parsedRows.length} partida(s) pegadas.`);
    }
  }, [onPasteRows, handleInsertRowBelow]);

  // Capturar atajos de teclado globales Ctrl+C y Ctrl+V
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        const hasSelection = isInput && activeEl.selectionStart !== activeEl.selectionEnd;
        if (!hasSelection) {
          e.preventDefault();
          handleCopySelected();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (!isInput) {
          e.preventDefault();
          handlePasteDirect();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopySelected, handlePasteDirect]);

  const sharedProps = {
    descriptionFilter,
    expandedPartials,
    filteredCapturedItems,
    handleAddPartial,
    handleClearPartials,
    handleDuplicateRow,
    handleEnrichItem,
    handleApplyCoveninCandidate,
    handleInsertRowBelow,
    handleOpenCoveninModal,
    handleOpenLinkModal,
    handleOpenStirrupModal,
    handleRemoveChapterHeader,
    handleRemoveItem,
    handleRemovePartial,
    handleRenameChapter,
    handleToggleExpandPartials,
    handleTogglePartials,
    handleUnlinkRow,
    handleUpdateItemField,
    handleUpdatePartialField,
    setDescriptionFilter,
    selectedMeasurementIds,
    onToggleSelectMeasurement,
    selectedDescriptionIds,
    onToggleSelectDescription,
    onSelectAllMeasurements,
    onSelectAllDescriptions,
    activeRowId,
    onSetActiveRow: setActiveRowId,
    onCopySelected: handleCopySelected,
    onPasteSelected: handlePasteDirect,
    onClearSelection: () => {
      setSelectedMeasurementIds(new Set());
      setSelectedDescriptionIds(new Set());
    },
    onOpenPasteModal: () => setShowPasteModal(true),
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 space-y-2.5 sm:space-y-3 bg-[#FEF3C7] overflow-hidden">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col flex-1 min-h-0 space-y-3">
        {/* Barra de Acciones de Copiar/Pegar y Macro Actividades */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePasteDirect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-2xs cursor-pointer transition-all"
              title="Pegar mediciones copiadas directamente en la partida seleccionada (Ctrl+V)"
            >
              <ClipboardPaste size={14} className="text-white" />
              <span>Pegar en Destino (Ctrl+V)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-400 bg-white hover:bg-amber-100 text-amber-950 font-extrabold text-xs shadow-2xs cursor-pointer transition-all"
              title="Importar y previsualizar datos tabulares desde Excel o archivo externo"
            >
              <FileSpreadsheet size={14} className="text-emerald-700" />
              <span>Pegar desde Excel...</span>
            </button>

            {(selectedMeasurementIds.size > 0 || selectedDescriptionIds.size > 0) && (
              <button
                type="button"
                onClick={handleCopySelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500 bg-amber-300 hover:bg-amber-400 text-amber-950 font-black text-xs shadow-2xs cursor-pointer animate-in fade-in transition-all"
                title="Copiar al portapapeles (Ctrl+C)"
              >
                <Copy size={14} className="text-amber-900" />
                <span>Copiar ({selectedMeasurementIds.size + selectedDescriptionIds.size})</span>
              </button>
            )}

            {macroInstances.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-amber-300">
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Macro:</span>
                {macroInstances.map((macro) => (
                  <button
                    key={macro.id}
                    type="button"
                    onClick={() => { setWallEditing(macro); setShowWallModal(true); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100"
                    title="Editar macro actividad y recalcular"
                  >
                    {macro.name} · {macro.rowCount} partidas
                    <Pencil className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {onAddMacroRows && (
            <button
              type="button"
              onClick={() => { setWallEditing(null); setShowWallModal(true); }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-extrabold text-amber-900 shadow-xs hover:bg-amber-100 cursor-pointer"
              title="Incluir macro actividad de pared perimetral"
            >
              <Plus className="h-4 w-4 text-amber-700" />
              <span>Incluir pared perimetral</span>
            </button>
          )}
        </div>

        {viewMode === 'cards' ? (
          <ComputosCards {...sharedProps} />
        ) : (
          <ComputosTable {...sharedProps} />
        )}
      </div>

      <PerimeterWallModal
        isOpen={showWallModal}
        initialInput={wallEditing?.input || null}
        instanceId={wallEditing?.id || null}
        onClose={() => { setShowWallModal(false); setWallEditing(null); }}
        onApply={onAddMacroRows}
      />

      <PasteComputosModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onPasteRows={handleApplyPasteModalRows}
      />
    </div>
  );
}
