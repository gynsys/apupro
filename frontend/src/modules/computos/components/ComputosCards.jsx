import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
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
export default function ComputosCards({
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
<div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {/* Buscador móvil de descripciones */}
                <div className="relative">
                  <Search className="w-4 h-4 text-amber-800/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={descriptionFilter}
                    onChange={(e) => setDescriptionFilter(e.target.value)}
                    placeholder="Filtrar partida por descripción..."
                    className="w-full bg-white text-slate-800 text-xs font-semibold pl-9 pr-8 py-2 rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-xs"
                  />
                  {descriptionFilter && (
                    <button
                      type="button"
                      onClick={() => setDescriptionFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-amber-700 hover:text-red-600 rounded cursor-pointer"
                      title="Limpiar filtro"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {filteredCapturedItems.length === 0 ? (
                  <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 text-center shadow-xs">
                    <Search className="w-7 h-7 text-amber-600/60 mx-auto mb-2" />
                    <p className="font-bold text-xs sm:text-sm text-amber-950">
                      No se encontraron partidas que coincidan con "{descriptionFilter}"
                    </p>
                    <button
                      type="button"
                      onClick={() => setDescriptionFilter('')}
                      className="mt-2.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-xl cursor-pointer"
                    >
                      Limpiar filtro
                    </button>
                  </div>
                ) : (
                  filteredCapturedItems.map((it, idx) => {
                  const prevItem = idx > 0 ? filteredCapturedItems[idx - 1] : null;
                  const showChapHeader = Boolean(
                    it.chapter &&
                    it.chapter.trim() &&
                    (!prevItem || (prevItem.chapter || '').trim().toUpperCase() !== it.chapter.trim().toUpperCase())
                  );
                  const isBlankTrailing = isItemEmpty(it);
                  const hasPartials = it.partials && it.partials.length > 0;
                  const isExpanded = expandedPartials[it.id] !== false;

                  return (
                    <React.Fragment key={it.id}>
                      {showChapHeader && (
                        <div className="bg-amber-200/90 border-2 border-amber-400 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-2">
                          <span className="font-black text-amber-950 text-xs sm:text-sm tracking-wide flex items-center gap-2">
                            <Layers className="w-4 h-4 text-amber-700" />
                            CAPÍTULO: {it.chapter}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRenameChapter(it.chapter)}
                              className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Renombrar este capítulo"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                              <span>Renombrar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveChapterHeader(it.chapter)}
                              className="text-xs font-bold text-red-700 bg-white hover:bg-red-50 border border-red-300 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Eliminar encabezado del capítulo (los cómputos se conservan)"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className={`bg-white border-2 ${
                          isBlankTrailing ? 'border-dashed border-amber-400 bg-amber-50/30' : 'border-amber-300'
                        } rounded-2xl p-2.5 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3`}
                      >
                        {/* Fila Superior: N° Item, Capítulo y Acciones Rápidas */}
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                              {it.originalIndex !== undefined ? it.originalIndex + 1 : idx + 1}
                            </span>
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md truncate max-w-[150px] sm:max-w-[250px]">
                              {it.chapter}
                            </span>
                            {isBlankTrailing && (
                              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-300">
                                Fila libre
                              </span>
                            )}
                            {it.cod_par && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                                {it.cov_par || it.cod_par}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {!isBlankTrailing && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateRow(it)}
                                  className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                                  title="Duplicar partida"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(it.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar partida"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* DESCRIPCIÓN DE LA PARTIDA */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-amber-950 uppercase">
                            Descripción de la Partida
                          </label>
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) =>
                                handleUpdateItemField(it.id, 'description', e.target.value.toUpperCase())
                              }
                              placeholder={
                                isBlankTrailing
                                  ? 'Escribe aquí la partida (al llenar se agregará otra fila automáticamente)...'
                                  : 'Descripción...'
                              }
                              className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-amber-50/30 border border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-xl uppercase placeholder:text-gray-400"
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCoveninModal(it)}
                                className="text-[11px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Search className="w-3 h-3 text-sky-600" />
                                <span>Buscar en Norma COVENIN</span>
                              </button>
                              {!it.cod_par && !isBlankTrailing && it.description && it.description.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audit = auditDescription(it.description, it.cod_par, it.unit);
                                    handleEnrichItem(it.id, audit.suggestion);
                                  }}
                                  className="text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-600" />
                                  <span>Enriquecer Especificaciones</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* CONTENEDORES DE MEDIDAS APILADOS HACIA ABAJO (SIN SCROLL HORIZONTAL) */}
                        {!hasPartials ? (
                          <div className="space-y-2.5 bg-amber-50/50 border border-amber-200 rounded-xl p-3">
                            {/* Fila 1: Unidad y N° Veces */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  UNIDAD (UND)
                                </label>
                                <select
                                  value={it.unit || 'M2'}
                                  onChange={(e) => handleUpdateItemField(it.id, 'unit', e.target.value)}
                                  className="w-full px-2 py-1 text-[11px] font-semibold rounded-lg border border-amber-300 bg-white text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                >
                                  {COMMON_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  N° VECES / PIEZAS
                                </label>
                                <MathQuantityInput
                                  value={it.times ?? 1}
                                  onChange={(val) => handleUpdateItemField(it.id, 'times', val)}
                                  min={1}
                                  integerOnly
                                  className="w-full px-2.5 py-1.5 text-xs text-center font-bold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                            </div>

                            {/* Fila 2: Dimensiones Físicas (Largo, Ancho, Alto) */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  LARGO (m)
                                </label>
                                <MathQuantityInput
                                  value={it.length ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'length', val)}
                                  allowEmpty
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-xs text-right font-medium rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  ANCHO (m)
                                </label>
                                <MathQuantityInput
                                  value={it.width ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'width', val)}
                                  allowEmpty
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-xs text-right font-medium rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  ALTO (m)
                                </label>
                                <MathQuantityInput
                                  value={it.height ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'height', val)}
                                  allowEmpty
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-xs text-right font-medium rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>

                            {/* Fila 3: Factor Acero, Distancia Acarreo y M3 Botes */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label
                                  className="block text-[10px] font-bold text-amber-900 mb-0.5"
                                  title="Factor kg/m para acero"
                                >
                                  FACTOR (kg/m)
                                </label>
                                <MathQuantityInput
                                  value={it.factor ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'factor', val)}
                                  allowEmpty
                                  decimals={3}
                                  placeholder="1.000"
                                  title="Factor de peso para acero o factor multiplicador"
                                  className="w-full px-2 py-1.5 text-xs text-right font-semibold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                              <div>
                                <label
                                  className="block text-[10px] font-bold text-amber-900 mb-0.5"
                                  title="Distancia de transporte en Km"
                                >
                                  DIST. (km)
                                </label>
                                <MathQuantityInput
                                  value={it.distance ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'distance', val)}
                                  allowEmpty
                                  placeholder="—"
                                  title="Distancia de transporte en Km"
                                  className="w-full px-2 py-1.5 text-xs text-right font-semibold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                              <div>
                                <label
                                  className="block text-[10px] font-bold text-amber-900 mb-0.5"
                                  title="Volumen en M3 para bote de escombros y acarreo"
                                >
                                  M3 (BOTE)
                                </label>
                                <MathQuantityInput
                                  value={it.m3 ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'm3', val)}
                                  allowEmpty
                                  placeholder="—"
                                  title="Volumen en M3 para bote de escombros y acarreo"
                                  className="w-full px-2 py-1.5 text-xs text-right font-bold text-amber-950 rounded-lg border border-amber-300 bg-amber-50/40 focus:bg-white"
                                />
                              </div>
                            </div>

                            {/* Fila 4: Cantidad Total */}
                            <div className="pt-1">
                              <div className="bg-amber-100 p-2.5 rounded-xl border-2 border-amber-400">
                                <span className="block text-[10px] uppercase font-black text-amber-950 mb-1">
                                  CANTIDAD TOTAL ({it.unit})
                                </span>
                                <MathQuantityInput
                                  value={it.quantity}
                                  onChange={(val) => handleUpdateItemField(it.id, 'quantity', val)}
                                  className="w-full px-2 py-1 text-sm text-right font-black text-amber-950 bg-white rounded border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* SECCIÓN CUANDO TIENE PARCIALES / FILAS */
                          <div className="bg-amber-100/60 border border-amber-300 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <span className="block text-[11px] font-extrabold text-amber-950">
                                📐 Calculado mediante {it.partials.length} parciales
                              </span>
                              <span className="text-[10px] text-amber-800">
                                La cantidad total se suma automáticamente desde el desglose inferior
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-amber-700 block">Total Calculado</span>
                              <span className="text-base font-black text-amber-950">
                                {Number(it.quantity).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {it.unit}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* SECCIÓN DESGLOSE DE PARCIALES */}
                        <div className="space-y-2">
                          {!hasPartials ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePartials(it.id)}
                              className="w-full py-2 px-3 rounded-xl bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 text-amber-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Split className="w-3.5 h-3.5 text-amber-700" />
                              <span>+ Desglosar en parciales / filas</span>
                            </button>
                          ) : (
                            <div className="space-y-2 border border-amber-300 rounded-xl p-2 sm:p-3 bg-amber-50/60">
                              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpandPartials(it.id)}
                                  className="flex items-center gap-1.5 text-xs font-black text-amber-950 cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-amber-700" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-amber-700" />
                                  )}
                                  <span>🧱 Parciales ({it.partials.length})</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddPartial(it.id)}
                                    className="text-[11px] font-bold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Agregar fila</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClearPartials(it.id)}
                                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="space-y-2.5 pt-1">
                                  {it.partials.map((p, pIdx) => (
                                    <div
                                      key={p.id}
                                      className="bg-white border border-amber-200 rounded-xl p-2.5 shadow-xs space-y-2"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                                          <span className="text-[10px] font-bold text-amber-700 shrink-0">
                                            #{pIdx + 1}
                                          </span>
                                          <input
                                            type="text"
                                            value={p.description || ''}
                                            onChange={(e) =>
                                              handleUpdatePartialField(it.id, p.id, 'description', e.target.value)
                                            }
                                            placeholder={`Parcial ${pIdx + 1} (ej: Fachada, Eje 1-2, Tramo A...)`}
                                            className="w-full px-2 py-1 text-xs font-semibold bg-amber-50/30 border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePartial(it.id, p.id)}
                                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0"
                                          title="Eliminar esta fila"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-4 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Largo (m)</label>
                                          <MathQuantityInput
                                            value={p.length ?? ''}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'length', val)
                                            }
                                            allowEmpty
                                            placeholder="0.00"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Ancho (m)</label>
                                          <MathQuantityInput
                                            value={p.width ?? ''}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'width', val)
                                            }
                                            allowEmpty
                                            placeholder="0.00"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Alto (m)</label>
                                          <MathQuantityInput
                                            value={p.height ?? ''}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'height', val)
                                            }
                                            allowEmpty
                                            placeholder="0.00"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Veces</label>
                                          <MathQuantityInput
                                            value={p.times ?? 1}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'times', val)
                                            }
                                            min={1}
                                            integerOnly
                                            className="w-full px-1.5 py-1 text-xs text-center font-bold bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Factor</label>
                                          <MathQuantityInput
                                            value={p.factor ?? ''}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'factor', val)
                                            }
                                            allowEmpty
                                            decimals={3}
                                            placeholder="1.000"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Dist. (km)</label>
                                          <MathQuantityInput
                                            value={p.distance ?? ''}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'distance', val)
                                            }
                                            allowEmpty
                                            placeholder="—"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">M3 (Bote)</label>
                                          <MathQuantityInput
                                            value={p.m3 ?? ''}
                                            onChange={(val) =>
                                              handleUpdatePartialField(it.id, p.id, 'm3', val)
                                            }
                                            allowEmpty
                                            placeholder="—"
                                            title="M3 bote y acarreo de este tramo"
                                            className="w-full px-1.5 py-1 text-xs text-right font-bold text-amber-950 bg-amber-50/40 border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-amber-50/90 p-2 rounded-xl border border-amber-200/80 text-xs">
                                        <input
                                          type="text"
                                          value={p.observations ?? ''}
                                          onChange={(e) =>
                                            handleUpdatePartialField(it.id, p.id, 'observations', e.target.value)
                                          }
                                          placeholder="Notas / Eje / Detalle..."
                                          className="min-w-0 flex-1 px-2 py-1 text-[11px] bg-white border border-amber-200 rounded-lg focus:outline-none focus:border-amber-400"
                                        />
                                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 px-1 pt-0.5 sm:pt-0">
                                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Subtotal:</span>
                                          <span className="font-mono font-black text-amber-950 text-xs sm:text-sm whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-amber-200/80 shadow-2xs">
                                            {Number(p.partial || 0).toLocaleString('es-VE', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}{' '}
                                            {it.unit}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* OBSERVACIONES */}
                        <div>
                          <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                            OBSERVACIONES / UBICACIÓN
                          </label>
                          <input
                            type="text"
                            value={it.observations ?? ''}
                            onChange={(e) => handleUpdateItemField(it.id, 'observations', e.target.value)}
                            placeholder="Notas, eje, ubicación o especificaciones especiales..."
                            className="w-full px-3 py-1.5 text-xs bg-amber-50/30 border border-amber-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }))}
              </div>
  );
}
