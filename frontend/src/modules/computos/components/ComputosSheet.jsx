import React from 'react';
import ComputosCards from './ComputosCards.jsx';
import ComputosTable from './ComputosTable.jsx';

export default function ComputosSheet({
  descriptionFilter,
  expandedPartials,
  filteredCapturedItems,
  handleAddPartial,
  handleClearPartials,
  handleDuplicateRow,
  handleEnrichItem,
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
}) {
  const sharedProps = {
    descriptionFilter,
    expandedPartials,
    filteredCapturedItems,
    handleAddPartial,
    handleClearPartials,
    handleDuplicateRow,
    handleEnrichItem,
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
        <div className="bg-white border-2 border-amber-300 rounded-2xl py-1.5 px-4 shadow-sm text-center shrink-0">
          <h2 className="text-sm sm:text-base font-black text-amber-950 tracking-wider uppercase leading-tight">
            PLANILLA DE CÓMPUTOS MÉTRICOS
          </h2>
        </div>

        {viewMode === 'cards' ? (
          <ComputosCards {...sharedProps} />
        ) : (
          <ComputosTable {...sharedProps} />
        )}
      </div>
    </div>
  );
}
