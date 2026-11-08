import React, { useState } from 'react';
import { Plus } from 'lucide-react';
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
}) {
  const [showWallModal, setShowWallModal] = useState(false);
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
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowWallModal(true)}
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
        onClose={() => setShowWallModal(false)}
        onApply={onAddMacroRows}
      />
    </div>
  );
}
