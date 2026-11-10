import React, { useRef, useLayoutEffect } from 'react';
import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Edit3,
  Layers,
  Link2,
  Plus,
  Search,
  Split,
  Trash2,
  Unlink2,
} from 'lucide-react';
import MathQuantityInput from '../../../pages/admin/budget_worksheet/MathQuantityInput';
import { COMMON_UNITS } from '../domain/units.js';
import { isSteelRow, REBAR_DIAMETERS, getRebarSpec } from '../domain/steel.js';
import { GEOMETRY_CONFIGS, GEOMETRY_TYPES } from '../domain/geometry.js';
import { cleanFormulaDisplay } from '../domain/formulas.js';
import { auditDescription } from '../../../utils/descriptionAuditor';
import DescriptionEnricher from './DescriptionEnricher.jsx';

function ComputosTableRow({
  expandedPartials,
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
  hasPartials,
  idx,
  isBlankTrailing,
  it,
  showChapHeader,
}) {
  const isSteel = isSteelRow(it);
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
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
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
                                    {!isBlankTrailing && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenLinkModal && handleOpenLinkModal(it)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                        title="Vincular con otra partida (agrega parcial 'Viene de...' o crea partida derivada)"
                                      >
                                        <Link2 className="w-3 h-3 text-sky-600" />
                                        <span>🔗 Vincular</span>
                                      </button>
                                    )}
                                    {!isBlankTrailing && !it.cod_par && (
                                      <DescriptionEnricher
                                        item={it}
                                        onApplyDescription={handleEnrichItem}
                                        onApplyCovenin={handleApplyCoveninCandidate}
                                      />
                                    )}
                                    {!isBlankTrailing && it.description && it.description.trim() && (() => {
                                      const audit = auditDescription(it.description, it.cod_par, it.unit);
                                      if (audit.status === 'covenin') {
                                        return (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-100/90 rounded w-fit border border-emerald-300">
                                            <Database className="w-2.5 h-2.5 text-emerald-600" />
                                            <span>COVENIN: {it.cod_par}</span>
                                          </span>
                                        );
                                      }
                                      if (audit.status === 'warning') {
                                        return null;
                                      }
                                      return (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-sky-800 bg-sky-100/80 rounded w-fit border border-sky-300">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-sky-600" />
                                          <span>S/C Detallada</span>
                                        </span>
                                      );
                                    })()}
                                    {isSteel && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300">
                                        ⛓️ Acero
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  !isBlankTrailing && (
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePartials(it.id)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                        title="Desglosar esta partida en múltiples filas o tramos de medición"
                                      >
                                        <Split className="w-3 h-3 text-amber-700" />
                                        <span>+ Desglosar en filas / parciales</span>
                                      </button>
                                      {!it.linkedTo && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenLinkModal && handleOpenLinkModal(it)}
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                          title="Vincular con partida derivada (Bote de escombros, friso, pintura, etc.)"
                                        >
                                          <Link2 className="w-3 h-3 text-sky-600" />
                                          <span>🔗 Vincular</span>
                                        </button>
                                      )}
                                      {!isSteel && (
                                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-950 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs">
                                          <span className="text-amber-700">Forma:</span>
                                          <select
                                            value={it.geometryType || GEOMETRY_TYPES.RECTANGLE}
                                            onChange={(e) => handleUpdateItemField(it.id, 'geometryType', e.target.value)}
                                            className="bg-transparent font-bold text-amber-950 focus:outline-none cursor-pointer"
                                            title="Seleccione forma geométrica para fórmulas automáticas"
                                          >
                                            {GEOMETRY_CONFIGS.map((g) => (
                                              <option key={g.id} value={g.id}>
                                                {g.icon} {g.shortLabel}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                      {!isBlankTrailing && !it.cod_par && (
                                        <DescriptionEnricher
                                          item={it}
                                          onApplyDescription={handleEnrichItem}
                                          onApplyCovenin={handleApplyCoveninCandidate}
                                        />
                                      )}
                                      {!isBlankTrailing && it.description && it.description.trim() && (() => {
                                        const audit = auditDescription(it.description, it.cod_par, it.unit);
                                        if (audit.status === 'covenin') {
                                          return (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-100/90 rounded w-fit border border-emerald-300">
                                              <Database className="w-2.5 h-2.5 text-emerald-600" />
                                              <span>COVENIN: {it.cod_par}</span>
                                            </span>
                                          );
                                        }
                                        if (audit.status === 'warning') {
                                          return null;
                                        }
                                        return (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-sky-800 bg-sky-100/80 rounded w-fit border border-sky-300">
                                            <CheckCircle2 className="w-2.5 h-2.5 text-sky-600" />
                                            <span>S/C Detallada</span>
                                          </span>
                                        );
                                      })()}
                                      {isSteel && (
                                        <>
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300">
                                            ⛓️ Acero
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenStirrupModal && handleOpenStirrupModal(it, null)}
                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                            title="Micro-calculadora geométrica de estribo"
                                          >
                                            <Calculator className="w-3 h-3 text-indigo-600" />
                                            <span>📐 Estribo</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )
                                )}
                                {cleanFormulaDisplay(it.formula) && !isBlankTrailing && (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded bg-amber-100/90 border border-amber-300 text-[10px] font-mono text-amber-950 w-fit shadow-2xs">
                                    <span className="text-amber-800 font-bold">📐 Fórmula:</span>
                                    <span>{cleanFormulaDisplay(it.formula)}</span>
                                  </div>
                                )}
                                {it.linkedTo && (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-md bg-sky-100 border border-sky-300 text-[10px] font-semibold text-sky-900 w-fit">
                                    <Link2 className="w-3 h-3 text-sky-700 shrink-0" />
                                    <span className="truncate max-w-[280px]">
                                      {it.linkedTo.label || `Vinculado a: ${it.linkedTo.sourceDescription}`}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkRow && handleUnlinkRow(it.id)}
                                      className="p-0.5 text-sky-700 hover:text-red-700 hover:bg-sky-200 rounded transition-colors cursor-pointer"
                                      title="Desvincular y editar libremente"
                                    >
                                      <Unlink2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
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
                                  placeholder={
                                    isSteel ? 'Long. m' :
                                    it.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Diám. Ø' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Base m' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado A m' :
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base May. B' :
                                    it.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado May.' :
                                    it.geometryType === GEOMETRY_TYPES.TRENCH ? 'Long. m' : '—'
                                  }
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title={
                                    isSteel ? 'Longitud de corte de la barra (m)' :
                                    it.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Diámetro del cilindro / pilote en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Base del triángulo en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado A del triángulo en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base Mayor del trapecio en metros (B)' :
                                    it.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado de base mayor en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRENCH ? 'Longitud de la zanja en metros' : 'Longitud / Largo (m)'
                                  }
                                />
                              )}
                            </td>

                            {/* ANCHO / DIÁMETRO REBAR */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : isSteel ? (
                                <select
                                  value={it.rebarDiameter || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const spec = getRebarSpec(val);
                                    handleUpdateItemField(it.id, 'rebarDiameter', val);
                                    if (spec) {
                                      handleUpdateItemField(it.id, 'factor', spec.weightKgM);
                                    }
                                  }}
                                  className="w-full px-1 py-1 text-xs font-bold text-center text-indigo-950 bg-indigo-50/70 border border-indigo-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  title="Seleccione diámetro comercial COVENIN / ASTM"
                                >
                                  <option value="">Ø Diám...</option>
                                  {REBAR_DIAMETERS.map((d) => (
                                    <option key={d.inches} value={d.inches}>
                                      {d.label} ({d.weightKgM} kg/m)
                                    </option>
                                  ))}
                                </select>
                              ) : it.geometryType === GEOMETRY_TYPES.CYLINDER ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="No aplica para sección circular">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.width ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'width', val)}
                                  allowEmpty
                                  placeholder={
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Alt. Triáng.' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado B m' :
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base Men. b' :
                                    it.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado Men.' :
                                    it.geometryType === GEOMETRY_TYPES.TRENCH ? 'Ancho m' : '—'
                                  }
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title={
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Altura del triángulo en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado B del triángulo en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base Menor del trapecio en metros (b)' :
                                    it.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado de base menor en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRENCH ? 'Ancho de la zanja en metros' : 'Ancho (m)'
                                  }
                                />
                              )}
                            </td>

                            {/* ALTO / BARRAS */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.height ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'height', val)}
                                  allowEmpty
                                  placeholder={
                                    isSteel ? 'Barras' :
                                    it.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Altura H' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Largo m' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado C m' :
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Altura h' :
                                    it.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Altura H' :
                                    it.geometryType === GEOMETRY_TYPES.TRENCH ? 'Prof. H' : '—'
                                  }
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title={
                                    isSteel ? 'Número de barras por elemento' :
                                    it.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Altura o profundidad del cilindro en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Longitud del tramo a 2 aguas en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado C del triángulo en metros (o vacío para isósceles C=A)' :
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Altura del trapecio en metros (h)' :
                                    it.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Altura de la zapata piramidal en metros' :
                                    it.geometryType === GEOMETRY_TYPES.TRENCH ? 'Profundidad de la zanja en metros' : 'Alto (m)'
                                  }
                                />
                              )}
                            </td>

                            {/* N° DE VECES / PIEZAS */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.times ?? 1}
                                  onChange={(val) => handleUpdateItemField(it.id, 'times', val)}
                                  integerOnly
                                  className="w-full px-1 py-1 text-xs text-center font-bold bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title={isSteel ? 'Número de piezas / elementos iguales' : 'Número de repeticiones (admite negativos para deducciones)'}
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
                                  placeholder={isSteel ? 'kg/m' : '1.000'}
                                  className={`w-full px-1 py-1 text-xs text-right font-semibold rounded ${
                                    isSteel ? 'text-indigo-950 bg-indigo-50/40 font-bold' : 'text-amber-950 bg-transparent'
                                  } focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500`}
                                  title={isSteel ? 'Factor nominal de peso kg/m según diámetro de cabilla' : 'Factor multiplicador'}
                                />
                              )}
                            </td>

                            {/* DISTANCIA (Km Acarreo) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/30">
                              {hasPartials || isSteel ? (
                                <span className="block text-center text-xs text-gray-300 font-bold select-none" title={isSteel ? 'No aplica a acero' : 'Desglosado en parciales'}>—</span>
                              ) : (
                                <MathQuantityInput
                                  value={it.distance ?? ''}
                                  onChange={(val) => handleUpdateItemField(it.id, 'distance', val)}
                                  allowEmpty
                                  placeholder={(it.geometryType === GEOMETRY_TYPES.TRAPEZOID || it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES) && it.unit === 'M3' ? (it.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Long. L' : 'Esp. H') : '—'}
                                  className="w-full px-1 py-1 text-xs text-right font-semibold text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title={
                                    it.geometryType === GEOMETRY_TYPES.TRAPEZOID && it.unit === 'M3'
                                      ? 'Longitud del tramo trapecial en metros (L) para volumen M3'
                                      : it.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES && it.unit === 'M3'
                                      ? 'Espesor o longitud en metros (H) para volumen M3'
                                      : 'Distancia en kilómetros para partidas de transporte y acarreo (M3-KM, TON-KM)'
                                  }
                                />
                              )}
                            </td>

                            {/* M3 (Botes y Acarreo) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/20">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-amber-800 font-bold select-none" title="Volumen M3 total desglosado en parciales">
                                  {it.m3 !== '' && it.m3 != null ? it.m3 : '—'}
                                </span>
                              ) : isSteel ? (
                                <span className="block text-center text-xs text-gray-300 font-bold select-none" title="No aplica a acero">—</span>
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
                                      <span className="text-[10px] font-bold text-amber-800 shrink-0 flex items-center gap-1">
                                        {p.linkedTo ? (
                                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 text-[9px] font-extrabold">
                                            <Link2 className="w-2.5 h-2.5 text-sky-600" />
                                            <span>Vinculado:</span>
                                          </span>
                                        ) : (
                                          'Parcial:'
                                        )}
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
                                      {!isSteel && (
                                        <select
                                          value={p.geometryType || GEOMETRY_TYPES.RECTANGLE}
                                          onChange={(e) => handleUpdatePartialField(it.id, p.id, 'geometryType', e.target.value)}
                                          className="text-[10px] font-bold bg-amber-50 text-amber-950 border border-amber-300 rounded px-1 py-0.5 cursor-pointer shrink-0"
                                          title="Forma geométrica de este parcial"
                                        >
                                          {GEOMETRY_CONFIGS.map((g) => (
                                            <option key={g.id} value={g.id}>
                                              {g.icon} {g.shortLabel}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                      {isSteel && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenStirrupModal && handleOpenStirrupModal(it, p)}
                                          className="text-[9px] font-bold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs flex items-center gap-1 shrink-0"
                                          title="Micro-calculadora geométrica de estribo"
                                        >
                                          <Calculator className="w-2.5 h-2.5 text-indigo-600" />
                                          <span>Estribo</span>
                                        </button>
                                      )}
                                    </div>
                                    {cleanFormulaDisplay(p.formula) && (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 mt-0.5 rounded bg-amber-100/70 border border-amber-200 text-[9.5px] font-mono text-amber-950 w-fit">
                                        <span className="text-amber-800 font-bold">📐</span>
                                        <span>{cleanFormulaDisplay(p.formula)}</span>
                                      </div>
                                    )}
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
                                      placeholder={
                                        isSteel ? 'Long. m' :
                                        p.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Diám. Ø' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Base m' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado A m' :
                                        p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base May. B' :
                                        p.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado May.' :
                                        p.geometryType === GEOMETRY_TYPES.TRENCH ? 'Long. m' : '0.00'
                                      }
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                      title={
                                        isSteel ? 'Longitud de corte (m)' :
                                        p.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Diámetro del cilindro / pilote en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Base del triángulo en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado A del triángulo en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base Mayor del trapecio en metros (B)' :
                                        p.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado de base mayor en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRENCH ? 'Longitud de la zanja en metros' : 'Largo (m)'
                                      }
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    {isSteel ? (
                                      <select
                                        value={p.rebarDiameter || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const spec = getRebarSpec(val);
                                          handleUpdatePartialField(it.id, p.id, 'rebarDiameter', val);
                                          if (spec) {
                                            handleUpdatePartialField(it.id, p.id, 'factor', spec.weightKgM);
                                          }
                                        }}
                                        className="w-full px-1 py-0.5 text-xs font-bold text-center text-indigo-950 bg-indigo-50/70 border border-indigo-200 rounded cursor-pointer"
                                        title="Seleccione diámetro de cabilla"
                                      >
                                        <option value="">Ø Diám...</option>
                                        {REBAR_DIAMETERS.map((d) => (
                                          <option key={d.inches} value={d.inches}>
                                            {d.label} ({d.weightKgM} kg/m)
                                          </option>
                                        ))}
                                      </select>
                                    ) : p.geometryType === GEOMETRY_TYPES.CYLINDER ? (
                                      <span className="block text-center text-xs text-gray-400 font-bold select-none" title="No aplica para sección circular">—</span>
                                    ) : (
                                      <MathQuantityInput
                                        value={p.width ?? ''}
                                        onChange={(val) =>
                                          handleUpdatePartialField(it.id, p.id, 'width', val)
                                        }
                                        allowEmpty
                                        placeholder={
                                          p.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Alt. Triáng.' :
                                          p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado B m' :
                                          p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base Men. b' :
                                          p.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado Men.' :
                                          p.geometryType === GEOMETRY_TYPES.TRENCH ? 'Ancho m' : '0.00'
                                        }
                                        className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                        title={
                                          p.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Altura del triángulo en metros' :
                                          p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado B del triángulo en metros' :
                                          p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Base Menor del trapecio en metros (b)' :
                                          p.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Lado de base menor en metros' :
                                          p.geometryType === GEOMETRY_TYPES.TRENCH ? 'Ancho de la zanja en metros' : 'Ancho (m)'
                                        }
                                      />
                                    )}
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <MathQuantityInput
                                      value={p.height ?? ''}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'height', val)
                                      }
                                      allowEmpty
                                      placeholder={
                                        isSteel ? 'Barras' :
                                        p.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Altura H' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Largo m' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado C m' :
                                        p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Altura h' :
                                        p.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Altura H' :
                                        p.geometryType === GEOMETRY_TYPES.TRENCH ? 'Prof. H' : '0.00'
                                      }
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                      title={
                                        isSteel ? 'Número de barras' :
                                        p.geometryType === GEOMETRY_TYPES.CYLINDER ? 'Altura o profundidad del cilindro en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE ? 'Longitud del tramo a 2 aguas en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES ? 'Lado C del triángulo en metros (o vacío para isósceles C=A)' :
                                        p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Altura del trapecio en metros (h)' :
                                        p.geometryType === GEOMETRY_TYPES.TRUNCATED_PYRAMID ? 'Altura de la zapata piramidal en metros' :
                                        p.geometryType === GEOMETRY_TYPES.TRENCH ? 'Profundidad de la zanja en metros' : 'Alto / Espesor (m)'
                                      }
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <MathQuantityInput
                                      value={p.times ?? 1}
                                      onChange={(val) =>
                                        handleUpdatePartialField(it.id, p.id, 'times', val)
                                      }
                                      integerOnly
                                      className="w-full px-1 py-0.5 text-xs text-center font-bold bg-white border border-amber-200 rounded"
                                      title={isSteel ? 'Número de piezas iguales' : 'Veces (admite negativos para deducciones)'}
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
                                      placeholder={isSteel ? 'kg/m' : '1.000'}
                                      className={`w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded ${
                                        isSteel ? 'font-bold text-indigo-950 bg-indigo-50/30' : ''
                                      }`}
                                      title={isSteel ? 'Factor nominal kg/m' : 'Factor multiplicador'}
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    {isSteel ? (
                                      <span className="block text-center text-xs text-gray-300 font-bold select-none" title="No aplica a acero">—</span>
                                    ) : (
                                      <MathQuantityInput
                                        value={p.distance ?? ''}
                                        onChange={(val) =>
                                          handleUpdatePartialField(it.id, p.id, 'distance', val)
                                        }
                                        allowEmpty
                                        placeholder={(p.geometryType === GEOMETRY_TYPES.TRAPEZOID || p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES) && it.unit === 'M3' ? (p.geometryType === GEOMETRY_TYPES.TRAPEZOID ? 'Long. L' : 'Esp. H') : '—'}
                                        title={
                                          p.geometryType === GEOMETRY_TYPES.TRAPEZOID && it.unit === 'M3'
                                            ? 'Longitud del tramo trapecial en metros (L) para volumen M3'
                                            : p.geometryType === GEOMETRY_TYPES.TRIANGLE_3_SIDES && it.unit === 'M3'
                                            ? 'Espesor o longitud en metros (H) para volumen M3'
                                            : 'Distancia en kilómetros'
                                        }
                                        className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                      />
                                    )}
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    {isSteel ? (
                                      <span className="block text-center text-xs text-gray-300 font-bold select-none" title="No aplica a acero">—</span>
                                    ) : (
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
                                    )}
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
