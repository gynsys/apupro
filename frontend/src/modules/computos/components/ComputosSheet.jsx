import React, { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import ComputosCards from './ComputosCards.jsx';
import ComputosTable from './ComputosTable.jsx';
import PerimeterWallModal from './PerimeterWallModal.jsx';

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
}) {
  const [showWallModal, setShowWallModal] = useState(false);
  const [wallEditing, setWallEditing] = useState(null);
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
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 space-y-2.5 sm:space-y-3 bg-[#FEF3C7] overflow-hidden">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col flex-1 min-h-0 space-y-3">
        {onAddMacroRows && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/70 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Macro actividades:</span>
              {macroInstances.length === 0 ? (
                <span className="text-[11px] text-amber-700">Ninguna incluida</span>
              ) : (
                macroInstances.map((macro) => (
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
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => { setWallEditing(null); setShowWallModal(true); }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-extrabold text-amber-900 shadow-xs hover:bg-amber-100"
              title="Incluir macro actividad de pared perimetral"
            >
              <Plus className="h-4 w-4 text-amber-700" />
              Incluir pared perimetral
            </button>
          </div>
        )}

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
    </div>
  );
}
