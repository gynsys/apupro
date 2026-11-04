import React from 'react';
import ComputosTableRow from './ComputosTableRow.jsx';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Edit3,
  Layers,
  Plus,
  Search,
  Sparkles,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import MathQuantityInput from '../../../pages/admin/budget_worksheet/MathQuantityInput';
import { COMMON_UNITS } from '../domain/units.js';
import { isItemEmpty } from '../domain/rows.js';
import { auditDescription } from '../../../utils/descriptionAuditor';
export default function ComputosTable({
  descriptionFilter,
  expandedPartials,
  filteredCapturedItems,
  handleAddPartial,
  handleClearPartials,
  handleDuplicateRow,
  handleEnrichItem,
  handleInsertRowBelow,
  handleOpenCoveninModal,
  handleRemoveChapterHeader,
  handleRemoveItem,
  handleRemovePartial,
  handleRenameChapter,
  handleToggleExpandPartials,
  handleTogglePartials,
  handleUpdateItemField,
  handleUpdatePartialField,
  setDescriptionFilter,
}) {
  return (
<div className="flex-1 min-h-0 bg-white border-2 border-gray-400 rounded-2xl shadow-md overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs text-left border-collapse border border-gray-400 min-w-[1100px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-amber-200 text-amber-950 font-black uppercase border-b border-gray-400 text-center text-[11px] tracking-wide">
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-12 bg-amber-300">
                        N° DE ITEM
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-3 py-2 text-left min-w-[380px] sm:min-w-[460px] bg-amber-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="shrink-0 text-amber-950 font-black tracking-wide">DESCRIPCIÓN</span>
                          <div className="relative flex-1 max-w-[240px] sm:max-w-[280px]">
                            <Search className="w-3.5 h-3.5 text-amber-800/60 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={descriptionFilter}
                              onChange={(e) => setDescriptionFilter(e.target.value)}
                              placeholder="Filtrar descripción..."
                              className="w-full bg-white text-slate-800 text-xs font-medium pl-7 pr-7 py-1 rounded-lg border border-amber-400/80 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 focus:outline-none normal-case placeholder:normal-case placeholder:text-amber-900/40 shadow-2xs transition-all"
                            />
                            {descriptionFilter && (
                              <button
                                type="button"
                                onClick={() => setDescriptionFilter('')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-amber-700 hover:text-red-600 rounded cursor-pointer"
                                title="Limpiar filtro"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                      <th colSpan={4} className="border border-gray-400 px-2 py-1 bg-amber-300">
                        DIMENSIONES
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-14 bg-amber-200" title="Número de repeticiones o piezas iguales">
                        N° DE VECES
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-16 bg-amber-300 text-amber-950" title="Factor de peso unitario para acero (kg/m) o factor multiplicador">
                        FACTOR
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-20 bg-amber-300 text-amber-950" title="Distancia en kilómetros para acarreos y transportes (M3-KM, TON-KM)">
                        DISTANCIA
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-16 bg-amber-300 text-amber-950" title="Volumen en metros cúbicos (M3) para botes y acarreo de material o escombros">
                        M3
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-24 bg-amber-200 text-amber-950 font-extrabold text-center" title="Cantidad total calculada">
                        TOTAL
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-3 py-2 min-w-[150px] bg-amber-200">
                        OBSERVACIONES
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-20 text-center bg-amber-300">
                        ACCIONES
                      </th>
                    </tr>
                    <tr className="bg-amber-100 text-amber-950 font-bold text-[10px] uppercase border-b-2 border-gray-500 text-center">
                      <th className="border border-gray-400 px-1 py-1 w-[84px] min-w-[84px] text-[10px] bg-amber-100 font-bold" title="Unidad de medida">UND</th>
                      <th className="border border-gray-400 px-1 py-1 w-16 bg-amber-100">Largo</th>
                      <th className="border border-gray-400 px-1 py-1 w-16 bg-amber-100">Ancho</th>
                      <th className="border border-gray-400 px-1 py-1 w-16 bg-amber-100">Alto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCapturedItems.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="text-center py-10 bg-white border border-gray-300">
                          <div className="flex flex-col items-center justify-center gap-2 text-amber-900">
                            <Search className="w-6 h-6 text-amber-600/60" />
                            <p className="font-bold text-sm">
                              No se encontraron partidas que coincidan con "{descriptionFilter}"
                            </p>
                            <button
                              type="button"
                              onClick={() => setDescriptionFilter('')}
                              className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-lg cursor-pointer"
                            >
                              Limpiar filtro
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCapturedItems.map((it, idx) => {
                        const prevItem = idx > 0 ? filteredCapturedItems[idx - 1] : null;
                        const showChapHeader = Boolean(
                          it.chapter &&
                          it.chapter.trim() &&
                          (!prevItem || (prevItem.chapter || '').trim().toUpperCase() !== it.chapter.trim().toUpperCase())
                        );
                        const isBlankTrailing = isItemEmpty(it);
                        const hasPartials = Boolean(it.partials && it.partials.length > 0);
                        return (
                          <ComputosTableRow
                            key={it.id}
                            it={it}
                            idx={idx}
                            showChapHeader={showChapHeader}
                            isBlankTrailing={isBlankTrailing}
                            hasPartials={hasPartials}
                            expandedPartials={expandedPartials}
                            handleAddPartial={handleAddPartial}
                            handleClearPartials={handleClearPartials}
                            handleDuplicateRow={handleDuplicateRow}
                            handleEnrichItem={handleEnrichItem}
                            handleInsertRowBelow={handleInsertRowBelow}
                            handleOpenCoveninModal={handleOpenCoveninModal}
                            handleRemoveChapterHeader={handleRemoveChapterHeader}
                            handleRemoveItem={handleRemoveItem}
                            handleRemovePartial={handleRemovePartial}
                            handleRenameChapter={handleRenameChapter}
                            handleToggleExpandPartials={handleToggleExpandPartials}
                            handleTogglePartials={handleTogglePartials}
                            handleUpdateItemField={handleUpdateItemField}
                            handleUpdatePartialField={handleUpdatePartialField}
                          />
                        );
                      }))}
                  </tbody>
                </table>
              </div>
            </div>
  );
}
