import React, { useRef, useLayoutEffect } from 'react';
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
} from 'lucide-react';
import MathQuantityInput from '../../../pages/admin/budget_worksheet/MathQuantityInput';
import { COMMON_UNITS } from '../domain/units.js';
import { auditDescription } from '../../../utils/descriptionAuditor';

function ComputosTableRow({
  expandedPartials,
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
  hasPartials,
  idx,
  isBlankTrailing,
  it,
  showChapHeader,
}) {
  const descInputRef = useRef(null);
  const cursorRef = useRef(null);

  const handleDescriptionChange = (e) => {
    const input = e.target;
    cursorRef.current = {
      start: input.selectionStart,
      end: input.selectionEnd,
    };
    handleUpdateItemField(it.id, 'description', input.value.toUpperCase());
  };

  useLayoutEffect(() => {
    if (cursorRef.current && descInputRef.current && document.activeElement === descInputRef.current) {
      const { start, end } = cursorRef.current;
      try {
        descInputRef.current.setSelectionRange(start, end);
      } catch (_e) {
        // ignore
      }
      cursorRef.current = null;
    }
  });

  return (
<React.Fragment key={it.id}>
                          {showChapHeader && (
                            <tr className="bg-amber-200/70 border-b border-gray-400">
                              <td colSpan={13} className="px-3 py-1.5 font-black text-amber-950 text-[11px] tracking-wide border border-gray-400">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                                    CAPÍTULO: {it.chapter}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleRenameChapter(it.chapter)}
                                      className="text-[10px] font-bold text-amber-900 bg-white/90 hover:bg-white border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shadow-xs"
                                      title="Renombrar este capítulo"
                                    >
                                      <Edit3 className="w-3 h-3 text-amber-700" />
                                      <span>Renombrar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChapterHeader(it.chapter)}
                                      className="text-[10px] font-bold text-red-700 bg-white/90 hover:bg-red-50 border border-red-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shadow-xs hover:text-red-900"
                                      title="Eliminar encabezado del capítulo (los cómputos se conservan)"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-600" />
                                      <span>Eliminar</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                            className={`transition-colors border-b border-gray-300 text-amber-950 ${
                              isBlankTrailing ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-amber-50/80'
                            }`}
                          >
                            {/* N° DE ITEM */}
                            <td className="border border-gray-300 px-2 py-1 text-center font-bold text-xs bg-amber-50/40">
                              {it.originalIndex !== undefined ? it.originalIndex + 1 : idx + 1}
                            </td>

                            {/* DESCRIPCIÓN */}
                            <td className="border border-gray-300 px-1 py-1">
                              <div className="flex flex-col gap-0.5">
                                <input
                                  ref={descInputRef}
                                  type="text"
                                  value={it.description}
                                  onChange={handleDescriptionChange}
                                  placeholder={isBlankTrailing ? 'Escribe aquí la partida...' : 'Descripción de la partida...'}
                                  className="w-full px-2 py-1 text-xs font-semibold bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded uppercase placeholder:text-gray-400"
                                />
                                {hasPartials ? (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleExpandPartials(it.id)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-1.5 py-0.5 rounded cursor-pointer"
                                      title="Mostrar / Ocultar desglose de filas"
                                    >
                                      <span>🧱 {it.partials.length} parciales</span>
                                      {expandedPartials[it.id] !== false ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddPartial(it.id)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                      title="Agregar otra fila o tramo de medición a esta partida"
                                    >
                                      <Plus className="w-3 h-3 text-emerald-700" />
                                      <span>+ Agregar fila</span>
                                    </button>
                                  </div>
                                ) : (
                                  !isBlankTrailing && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePartials(it.id)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                        title="Desglosar esta partida en múltiples filas o tramos de medición"
                                      >
                                        <Split className="w-3 h-3 text-amber-700" />
                                        <span>+ Desglosar en filas / parciales</span>
                                      </button>
                                    </div>
                                  )
                                )}
                                {!isBlankTrailing && it.description && it.description.trim() && (() => {
                                  const audit = auditDescription(it.description, it.cod_par, it.unit);
                                  if (audit.status === 'covenin') {
                                    return (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-100/90 rounded w-fit border border-emerald-300">
                                        <Database className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>COVENIN: {it.cod_par}</span>
                                      </div>
                                    );
                                  }
                                  if (audit.status === 'warning') {
                                    const hasVariants = audit.materialVariants && audit.materialVariants.length > 0;
                                    return (
                                      <div className="flex flex-col gap-1 px-1.5 py-1 text-[9px] font-semibold text-amber-900 bg-amber-100/90 rounded border border-amber-300">
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1 truncate">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                            <span className="truncate">
                                              {hasVariants ? `Material ambiguo (${audit.materialDomain})` : `Falta detalle (${audit.missing.join(', ')})`}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleEnrichItem(it.id, audit.suggestion)}
                                            className="text-[9px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
                                            title="Completar con especificación técnica estándar"
                                          >
                                            <Sparkles className="w-2.5 h-2.5" />
                                            <span>Enriquecer</span>
                                          </button>
                                        </div>
                                        {hasVariants && (
                                          <div className="flex flex-wrap items-center gap-1 pt-0.5 border-t border-amber-200/80">
                                            <span className="text-[8px] text-amber-800 font-bold shrink-0">Opciones:</span>
                                            {audit.materialVariants.slice(0, 4).map((v, vIdx) => (
                                              <button
                                                key={vIdx}
                                                type="button"
                                                onClick={() => handleEnrichItem(it.id, v.text)}
                                                className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-amber-200 text-amber-950 border border-amber-300 cursor-pointer transition-colors shadow-2xs"
                                                title={v.text}
                                              >
                                                {v.name}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-sky-800 bg-sky-100/80 rounded w-fit border border-sky-300">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-sky-600" />
                                      <span>S/C Detallada</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>

                            {/* UNIDAD */}
                            <td className="border border-gray-300 px-1 py-1 w-[84px] min-w-[84px]">
                              <select
                                value={it.unit}
                                onChange={(e) => handleUpdateItemField(it.id, 'unit', e.target.value)}
                                className="w-full px-1 py-1 text-xs font-bold text-center text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded cursor-pointer"
                              >
                                {COMMON_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* LARGO */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.length ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'length', val)}
                                  allowEmpty
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* ANCHO */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.width ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'width', val)}
                                  allowEmpty
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* ALTO */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.height ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'height', val)}
                                  allowEmpty
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* N° DE VECES */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.times ?? 1}
                                  onChange={(val) => handleUpdateItemField(it.id, 'times', val)}
                                  min={1}
                                  integerOnly
                                  className="w-full px-1 py-1 text-xs text-center font-bold bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* FACTOR (Acero kg/m o Multiplicador) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/30">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.factor ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'factor', val)}
                                  allowEmpty
                                  decimals={3}
                                  placeholder="1.000"
                                  className="w-full px-1 py-1 text-xs text-right font-semibold text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title='Factor de peso para acero (ej: 0.994 kg/m para 1/2", 1.552 para 5/8") o factor de conversión'
                                />
                              )}
                            </td>

                            {/* DISTANCIA (Km Acarreo) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/30">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.distance ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'distance', val)}
                                  allowEmpty
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-semibold text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title="Distancia en kilómetros para partidas de transporte y acarreo (M3-KM, TON-KM)"
                                />
                              )}
                            </td>

                            {/* M3 (Botes y Acarreo) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/20">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-amber-800 font-bold select-none" title="Volumen M3 total desglosado en parciales">
                                  {it.m3 !== '' && it.m3 != null ? it.m3 : '—'}
                                </span>
                              ) : (
                                <MathQuantityInput
                                  value={it.m3 ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'm3', val)}
                                  allowEmpty
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-semibold text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title="Volumen en metros cúbicos (M3) para bote de escombros y acarreo"
                                />
                              )}
                            </td>

                            {/* CANTIDAD TOTAL */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-100/60">
                              {hasPartials ? (
                                <span
                                  className="block w-full px-1.5 py-1 text-xs text-right font-extrabold text-amber-950 bg-amber-100/50 rounded cursor-default select-none border border-amber-300"
                                  title="Total calculado automáticamente por la suma de parciales"
                                >
                                  {Number(it.quantity || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <MathQuantityInput
                                  value={it.quantity}
                                  onChange={(val) => handleUpdateItemField(it.id, 'quantity', val)}
                                  className="w-full px-1.5 py-1 text-xs text-right font-extrabold text-amber-950 bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              )}
                            </td>

                            {/* OBSERVACIONES */}
                            <td className="border border-gray-300 px-1 py-1">
                              <input
                                type="text"
                                value={it.observations ?? ''}
                                onChange={(e) => handleUpdateItemField(it.id, 'observations', e.target.value)}
                                placeholder="Notas, eje, ubicación..."
                                className="w-full px-2 py-1 text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                              />
                            </td>

                            {/* ACCIONES */}
                            <td className="border border-gray-300 px-1 py-1 text-center bg-amber-50/40">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleInsertRowBelow(it)}
                                  className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                                  title="Agregar fila debajo"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCoveninModal(it)}
                                  className="p-1 text-sky-700 hover:text-sky-950 hover:bg-sky-100 rounded transition-colors cursor-pointer"
                                  title="Buscar y seleccionar partida según Norma COVENIN"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePartials(it.id)}
                                  disabled={isBlankTrailing}
                                  className={`p-1 rounded transition-colors cursor-pointer disabled:opacity-30 ${
                                    it.partials && it.partials.length > 0
                                      ? 'text-amber-800 bg-amber-200 hover:bg-amber-300'
                                      : 'text-amber-700 hover:text-amber-950 hover:bg-amber-100'
                                  }`}
                                  title={
                                    it.partials && it.partials.length > 0
                                      ? 'Ver/Gestionar desglose de parciales'
                                      : 'Desglosar en varios parciales / filas'
                                  }
                                >
                                  <Split className="w-3.5 h-3.5" />
                                </button>
                                {!it.cod_par && !isBlankTrailing && it.description && it.description.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audit = auditDescription(it.description, it.cod_par, it.unit);
                                      handleEnrichItem(it.id, audit.suggestion);
                                    }}
                                    className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                    title="Enriquecer descripción técnica"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateRow(it)}
                                  disabled={isBlankTrailing}
                                  className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-200 rounded transition-colors cursor-pointer disabled:opacity-30"
                                  title="Duplicar partida"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(it.id)}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors cursor-pointer"
                                  title="Eliminar partida"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* FILAS HIJAS DE SUB-PARCIALES / PAREDES EN LA TABLA */}
                          {it.partials && it.partials.length > 0 && expandedPartials[it.id] !== false && (
                            <>
                              {it.partials.map((p, pIdx) => (
                                <tr
                                  key={p.id}
                                  className="bg-amber-50/70 border-b border-amber-200 text-amber-950 text-xs hover:bg-amber-100/50"
                                >
                                  <td className="border border-amber-200 px-2 py-1 text-center font-bold text-[10px] text-amber-700 bg-amber-100/40">
                                    ↳ {pIdx + 1}
                                  </td>
                                  <td className="border border-amber-200 px-2 py-1 pl-6">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-amber-800 shrink-0">
                                        Parcial:
                                      </span>
                                      <input
                                        type="text"
                                        value={p.description || ''}
                                        onChange={(e) =>
                                          handleUpdatePartialField(
                                            it.id,
                                            p.id,
                                            'description',
                                            e.target.value
                                          )
                                        }
                                        placeholder={`Parcial ${pIdx + 1} (ej: Fachada, Eje 1-2, Tramo A...)`}
                                        className="flex-1 px-1.5 py-0.5 text-xs font-semibold bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 w-[84px] min-w-[84px] text-center text-xs font-bold text-amber-900 bg-amber-50/30">
                                    {it.unit || 'M2'}
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <MathQuantityInput
                                      value={p.length ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'length', val)
                                      }
                                      allowEmpty
                                      placeholder="0.00"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <MathQuantityInput
                                      value={p.width ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'width', val)
                                      }
                                      allowEmpty
                                      placeholder="0.00"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <MathQuantityInput
                                      value={p.height ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'height', val)
                                      }
                                      allowEmpty
                                      placeholder="0.00"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <MathQuantityInput
                                      value={p.times ?? 1}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'times', val)
                                      }
                                      min={1}
                                      integerOnly
                                      className="w-full px-1 py-0.5 text-xs text-center font-bold bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    <MathQuantityInput
                                      value={p.factor ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'factor', val)
                                      }
                                      allowEmpty
                                      decimals={3}
                                      placeholder="1.000"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    <MathQuantityInput
                                      value={p.distance ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'distance', val)
                                      }
                                      allowEmpty
                                      placeholder="—"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    <MathQuantityInput
                                      value={p.m3 ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'm3', val)
                                      }
                                      allowEmpty
                                      placeholder="—"
                                      className="w-full px-1 py-0.5 text-xs text-right font-semibold text-amber-950 bg-white border border-amber-200 rounded"
                                      title="M3 bote y acarreo de este tramo"
                                    />
                                  </td>
                                  {/* TOTAL DEL PARCIAL */}
                                  <td className="border border-amber-200 px-2 py-1 text-right font-bold text-xs text-amber-950 bg-amber-100/60">
                                    {Number(p.partial || 0).toLocaleString('es-VE', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <input
                                      type="text"
                                      value={p.observations ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(
                                          it.id,
                                          p.id,
                                          'observations',
                                          e.target.value
                                        )
                                      }
                                      placeholder="Eje, tramo, detalle..."
                                      className="w-full px-1.5 py-0.5 text-xs bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 text-center bg-amber-100/30">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePartial(it.id, p.id)}
                                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors cursor-pointer"
                                      title="Eliminar esta fila"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-amber-100/50 border-b border-amber-300">
                                <td colSpan={13} className="px-4 py-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleAddPartial(it.id)}
                                      className="text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3 text-amber-700" />
                                      <span>Agregar fila</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleClearPartials(it.id)}
                                      className="text-[10px] text-red-600 hover:underline cursor-pointer"
                                    >
                                      Quitar desglose
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </>
                          )}
                        </React.Fragment>
  );
}

export default React.memo(ComputosTableRow);
