import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, Copy, ClipboardPaste } from 'lucide-react';
import toast from 'react-hot-toast';
import ComputosCards from './ComputosCards.jsx';
import ComputosTable from './ComputosTable.jsx';
import PerimeterWallModal from './PerimeterWallModal.jsx';
import PasteComputosModal from './modals/PasteComputosModal.jsx';
import { copyRowsToClipboard, parseTabularComputosClipboard } from '../domain/clipboard.js';
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
}) {
  const [showWallModal, setShowWallModal] = useState(false);
  const [wallEditing, setWallEditing] = useState(null);

  // Estado de filas sombreadas / seleccionadas para copiar
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState(null);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const onToggleSelectRow = useCallback((rowId, isShift) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      const currentIdx = filteredCapturedItems.findIndex((r) => r.id === rowId);

      if (isShift && lastSelectedIdx !== null && currentIdx !== -1) {
        const start = Math.min(lastSelectedIdx, currentIdx);
        const end = Math.max(lastSelectedIdx, currentIdx);
        for (let i = start; i <= end; i++) {
          const item = filteredCapturedItems[i];
          if (item && !isItemEmpty(item)) {
            next.add(item.id);
          }
        }
      } else {
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
      }

      setLastSelectedIdx(currentIdx);
      return next;
    });
  }, [filteredCapturedItems, lastSelectedIdx]);

  const onSelectAllRows = useCallback((selectAll) => {
    if (selectAll) {
      const allIds = filteredCapturedItems
        .filter((r) => !isItemEmpty(r))
        .map((r) => r.id);
      setSelectedRowIds(new Set(allIds));
    } else {
      setSelectedRowIds(new Set());
    }
  }, [filteredCapturedItems]);

  const handleCopySelected = useCallback(async () => {
    const selectedRows = filteredCapturedItems.filter((r) => selectedRowIds.has(r.id));
    if (selectedRows.length === 0) {
      toast('Sombrea al menos una partida para copiar.');
      return;
    }
    const res = await copyRowsToClipboard(selectedRows);
    if (res.success) {
      toast.success(`✓ ${res.count} partida(s) sombreada(s) copiadas al portapapeles.`);
    }
  }, [filteredCapturedItems, selectedRowIds]);

  const handleApplyPasteRows = useCallback((parsedRows, mode = 'append') => {
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
        if (!hasSelection && selectedRowIds.size > 0) {
          e.preventDefault();
          handleCopySelected();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (!isInput) {
          if (navigator?.clipboard?.readText) {
            navigator.clipboard.readText()
              .then((clipText) => {
                if (clipText && (clipText.includes('\t') || clipText.includes('\n'))) {
                  const { rows } = parseTabularComputosClipboard(clipText);
                  if (rows.length > 0) {
                    e.preventDefault();
                    handleApplyPasteRows(rows, 'append');
                    return;
                  }
                }
                setShowPasteModal(true);
              })
              .catch(() => {
                setShowPasteModal(true);
              });
          } else {
            setShowPasteModal(true);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRowIds, handleCopySelected, handleApplyPasteRows]);

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
    selectedRowIds,
    onToggleSelectRow,
    onSelectAllRows,
    onCopySelected: handleCopySelected,
    onClearSelection: () => setSelectedRowIds(new Set()),
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
              onClick={() => setShowPasteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-400 bg-white hover:bg-amber-100 text-amber-950 font-extrabold text-xs shadow-2xs cursor-pointer transition-all"
              title="Pegar partidas sombreadas de Excel u otra planilla (Ctrl+V)"
            >
              <ClipboardPaste size={14} className="text-amber-700" />
              <span>Pegar (Ctrl+V)</span>
            </button>

            {selectedRowIds.size > 0 && (
              <button
                type="button"
                onClick={handleCopySelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500 bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-xs shadow-2xs cursor-pointer animate-in fade-in transition-all"
                title="Copiar partidas sombreadas al portapapeles (Ctrl+C)"
              >
                <Copy size={14} className="text-amber-800" />
                <span>Copiar ({selectedRowIds.size})</span>
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
        onPasteRows={handleApplyPasteRows}
      />
    </div>
  );
}
