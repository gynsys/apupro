import React from 'react';
import { createPortal } from 'react-dom';
import { Loader, Layers, Plus } from 'lucide-react';

import BudgetSettingsModal from '../../../components/modals/BudgetSettingsModal';
import BudgetPrintModal from '../../../components/modals/BudgetPrintModal';
import BudgetPrintLayout from '../../../components/print/BudgetPrintLayout';
import PrintAPUModal from '../../../components/PrintAPUModal';
import PrintAPULayout, { APUPrintSheet } from '../../../components/PrintAPULayout';
import SubscriptionRequestModal from '../../../components/SubscriptionRequestModal';
import AIApuGeneratorModal from '../../../modules/costbase/components/ai-generator/AIApuGeneratorModal';

import { useBudgetWorksheet } from './useBudgetWorksheet';
import BudgetWorksheetHeader from './BudgetWorksheetHeader';
import BudgetWorksheetToolbar from './BudgetWorksheetToolbar';
import BudgetMobileItemCard from './BudgetMobileItemCard';
import BudgetDesktopTable from './BudgetDesktopTable';
import BudgetWorksheetFooter from './BudgetWorksheetFooter';
import BudgetChapterModal from './BudgetChapterModal';
import BudgetDeleteModal from './BudgetDeleteModal';
import BudgetSearchModal from './BudgetSearchModal';

export default function BudgetWorksheetView() {
  const ws = useBudgetWorksheet();

  if (ws.loading || !ws.budget) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  const { subtotalPresupuesto, ivaAmount, totalGeneral } = ws.calculateBudgetTotal();

  return (
    <div className="absolute inset-0 p-2 sm:p-4 md:p-6 flex flex-col overflow-hidden w-full max-w-7xl mx-auto no-print">
      <div className="flex-1 flex flex-col relative min-h-0">

        {/* SETTINGS MODAL */}
        {ws.showSettings && (
          <BudgetSettingsModal
            budget={ws.budget}
            onClose={() => ws.setShowSettings(false)}
            onSave={(newSettings) => {
              ws.setBudget(prev => ({ 
                ...prev, 
                ...newSettings,
                name: newSettings.name || newSettings.project_name || prev.name,
                project_name: newSettings.project_name || newSettings.name || prev.project_name
              }));
              ws.setShowSettings(false);
            }}
          />
        )}

        {/* PRINT MODAL */}
        {ws.showPrintModal && (
          <BudgetPrintModal 
            onClose={() => ws.setShowPrintModal(false)}
            onPrint={(config) => {
              ws.setShowPrintModal(false);
              ws.setPrintConfig(config);
            }}
            initialCurrency={ws.budget.currency || 'USD'}
            initialUbicacion={ws.budget.ubicacion || ''}
            budgetId={ws.id}
          />
        )}
        
        {/* PRINT LAYOUT */}
        {ws.printConfig && (
          <BudgetPrintLayout 
            budget={ws.budget}
            config={ws.printConfig}
          />
        )}

        {/* APU PRINT MODAL */}
        {ws.showApuPrintModal && ws.apuToPrint && (
          <PrintAPUModal
            isOpen={ws.showApuPrintModal}
            onClose={() => { ws.setShowApuPrintModal(false); ws.setApuToPrint(null); }}
            onPrint={(options) => {
              ws.setShowApuPrintModal(false);
              ws.setApuPrintOptions(options);
            }}
            budgetName={ws.budget.company_name || ''}
          />
        )}

        {/* APU PRINT LAYOUT — Ficha individual */}
        {ws.apuPrintOptions && ws.apuPrintOptions.scope !== 'all' && ws.apuToPrint && (
          <PrintAPULayout
            partida={{ 
              ...ws.apuToPrint, 
              fcas_percent: ws.budget.fcas_percent, 
              admin_percent: ws.budget.admin_percent, 
              util_percent: ws.budget.profit_percent, 
              rendimiento: ws.apuToPrint.performance, 
              cantidad: ws.apuToPrint.quantity 
            }}
            materiales={ws.apuToPrint.materials || []}
            equipos={ws.apuToPrint.equipments || []}
            mano_obra={ws.apuToPrint.labors || []}
            options={{ ...ws.apuPrintOptions, companyName: ws.budget.company_name || ws.budget.project_name || ws.budget.name }}
          />
        )}

        {/* APU PRINT LAYOUT — Todos los APU del presupuesto */}
        {ws.apuPrintOptions && ws.apuPrintOptions.scope === 'all' && ws.budget && createPortal(
          <div
            id="print-apu-layout"
            className="print-only"
            style={{
              display: 'none',
              backgroundColor: '#fff',
              color: '#000',
              fontFamily: 'Arial, sans-serif',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {(ws.budget.items || []).filter(i => !i.is_chapter).map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  pageBreakBefore: idx === 0 ? 'auto' : 'always',
                  breakBefore: idx === 0 ? 'auto' : 'page',
                  paddingTop: idx === 0 ? 0 : '10mm',
                  boxSizing: 'border-box',
                }}
              >
                <APUPrintSheet
                  partida={{
                    ...item,
                    fcas_percent: ws.budget.fcas_percent,
                    admin_percent: ws.budget.admin_percent,
                    util_percent: ws.budget.profit_percent,
                    rendimiento: item.performance ?? item.rendimiento ?? 1,
                    cantidad: item.quantity,
                    obra: ws.budget.project_name || ws.budget.name || '',
                    contratante: ws.budget.client_name || '',
                  }}
                  materiales={item.materials || []}
                  equipos={item.equipments || []}
                  mano_obra={item.labors || []}
                  options={{
                    ...ws.apuPrintOptions,
                    companyName: ws.budget.company_name || ws.budget.project_name || ws.budget.name,
                    admin_percent: ws.budget.admin_percent,
                    profit_percent: ws.budget.profit_percent,
                    fcas_percent: ws.budget.fcas_percent,
                    obra: ws.budget.project_name || ws.budget.name || '',
                    contratante: ws.budget.client_name || '',
                  }}
                />
              </div>
            ))}
          </div>,
          document.body
        )}

        {/* WORKSHEET CONTAINER */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col relative overflow-hidden">
          {/* HEADER BAR */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 min-w-0">
              <BudgetWorksheetHeader
                budget={ws.budget}
                syncing={ws.syncing}
                onSyncPrices={ws.handleSyncPrices}
                showSettings={ws.showSettings}
                setShowSettings={ws.setShowSettings}
                setShowPrintModal={ws.setShowPrintModal}
              />
              <BudgetWorksheetToolbar
                onOpenSearchModal={ws.handleOpenSearchModal}
                onOpenChapterModal={() => { ws.setChapterName(""); ws.setShowChapterModal(true); }}
                onExportExcel={ws.handleExportBudgetToExcel}
                exportingExcel={ws.exportingBudgetExcel}
                showSettings={ws.showSettings}
                setShowSettings={ws.setShowSettings}
                setShowPrintModal={ws.setShowPrintModal}
              />
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto min-h-0 relative">
            {/* MOBILE VIEW (< md) */}
            <div className="md:hidden p-3 space-y-3">
              {ws.budget.items.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 my-4">
                  <Layers className="mx-auto mb-3 text-slate-300" size={36} />
                  <p className="text-sm font-medium">No hay partidas en este presupuesto.</p>
                  <button 
                    onClick={ws.handleOpenSearchModal}
                    className="mt-3 text-blue-600 font-semibold hover:underline text-sm inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={16} /> Buscar e incluir la primera partida
                  </button>
                </div>
              ) : (
                (() => {
                  let mobileItemNumber = 0;
                  return ws.budget.items.map((item, idx) => {
                    const isSelected = ws.selectedItemId === item.id;
                    if (!item.is_chapter) mobileItemNumber++;
                    return (
                      <BudgetMobileItemCard
                        key={item.id}
                        item={item}
                        idx={idx}
                        totalItems={ws.budget.items.length}
                        isSelected={isSelected}
                        onSelect={() => ws.setSelectedItemId(isSelected ? null : item.id)}
                        budget={ws.budget}
                        pu={ws.calculatePU(item)}
                        onMoveItem={ws.handleMoveItem}
                        onDeleteItem={ws.handleDeleteItem}
                        editingChapterId={ws.editingChapterId}
                        setEditingChapterId={ws.setEditingChapterId}
                        editingChapterName={ws.editingChapterName}
                        setEditingChapterName={ws.setEditingChapterName}
                        onSaveChapterEdit={ws.handleSaveChapterEdit}
                        onQuantityChange={ws.handleQuantityChange}
                        onSaveQuantity={ws.saveQuantity}
                        onPrintApu={(it) => { ws.setApuToPrint(it); ws.setShowApuPrintModal(true); }}
                        itemNumber={mobileItemNumber}
                      />
                    );
                  });
                })()
              )}
            </div>

            {/* DESKTOP VIEW (>= md) */}
            <BudgetDesktopTable
              budget={ws.budget}
              selectedItemId={ws.selectedItemId}
              setSelectedItemId={ws.setSelectedItemId}
              onDragEnd={ws.handleDragEnd}
              onDeleteItem={ws.handleDeleteItem}
              editingChapterId={ws.editingChapterId}
              setEditingChapterId={ws.setEditingChapterId}
              editingChapterName={ws.editingChapterName}
              setEditingChapterName={ws.setEditingChapterName}
              onSaveChapterEdit={ws.handleSaveChapterEdit}
              calculatePU={ws.calculatePU}
              onQuantityChange={ws.handleQuantityChange}
              onSaveQuantity={ws.saveQuantity}
              onPrintApu={(it) => { ws.setApuToPrint(it); ws.setShowApuPrintModal(true); }}
              onOpenSearchModal={ws.handleOpenSearchModal}
            />
          </div>
        </div>

        {/* FOOTER */}
        <BudgetWorksheetFooter
          budget={ws.budget}
          notesText={ws.notesText}
          setNotesText={ws.setNotesText}
          onSaveNotes={ws.handleSaveNotes}
          subtotalPresupuesto={subtotalPresupuesto}
          ivaAmount={ivaAmount}
          totalGeneral={totalGeneral}
        />
      </div>

      {/* MODALS */}
      <BudgetSearchModal
        isOpen={ws.showSearchModal}
        onClose={() => ws.setShowSearchModal(false)}
        activeDatabase={ws.activeDatabase}
        setActiveDatabase={ws.setActiveDatabase}
        databases={ws.databases}
        availableBudgets={ws.availableBudgets}
        currentBudgetId={ws.id}
        onOpenAIApuModal={() => ws.setShowAIApuModal(true)}
        searchQuery={ws.searchQuery}
        setSearchQuery={ws.setSearchQuery}
        searchCovenin={ws.searchCovenin}
        setSearchCovenin={ws.setSearchCovenin}
        searchDesc={ws.searchDesc}
        setSearchDesc={ws.setSearchDesc}
        searchInsumos={ws.searchInsumos}
        setSearchInsumos={ws.setSearchInsumos}
        searching={ws.searching}
        searchDatabase={ws.searchDatabase}
        totalSearchResults={ws.totalSearchResults}
        searchResults={ws.searchResults}
        hasMoreSearchResults={ws.hasMoreSearchResults}
        loadMoreSearchResults={ws.loadMoreSearchResults}
        onAddItem={ws.handleAddItem}
      />

      <SubscriptionRequestModal 
        isOpen={ws.showSubscriptionModal} 
        onClose={() => ws.setShowSubscriptionModal(false)}
        limitType="apu"
      />

      <BudgetChapterModal
        isOpen={ws.showChapterModal}
        onClose={() => ws.setShowChapterModal(false)}
        chapterName={ws.chapterName}
        setChapterName={ws.setChapterName}
        onAddChapter={ws.handleAddChapter}
      />

      <BudgetDeleteModal
        itemToDelete={ws.itemToDelete}
        onConfirm={ws.confirmDelete}
        onCancel={() => ws.setItemToDelete(null)}
      />

      {ws.showAIApuModal && (
        <AIApuGeneratorModal
          isOpen={ws.showAIApuModal}
          onClose={() => ws.setShowAIApuModal(false)}
          onInsertToBudget={ws.handleInsertAIApu}
          budgetSettings={ws.settings}
        />
      )}
    </div>
  );
}
