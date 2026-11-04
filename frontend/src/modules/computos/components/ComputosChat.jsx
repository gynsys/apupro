import React from 'react';
import { Bot, Edit3, Save, Sparkles, Table, Trash2, User } from 'lucide-react';
import MathQuantityInput from '../../../pages/admin/budget_worksheet/MathQuantityInput';

export default function ComputosChat({
  validCount,
  setActiveTab,
  messages,
  capturedItems,
  editingItemId,
  editForm,
  setEditForm,
  handleCancelEdit,
  handleEditFormFieldChange,
  handleSaveEdit,
  handleStartEdit,
  handleRemoveItem,
  messagesEndRef,
}) {
  return (
<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FEF3C7]">
          <div className="max-w-3xl mx-auto space-y-4">
            {validCount > 0 && (
              <div className="sticky top-0 z-10 p-2.5 rounded-xl bg-amber-100/95 backdrop-blur-xs border border-amber-300 flex items-center justify-between gap-2 shadow-xs">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-amber-600" />
                  <strong>{validCount}</strong> partida(s) en la planilla de cómputos
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('sheet')}
                  className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-50 px-3 py-1 rounded-lg border border-amber-300 shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <span>Ver Planilla de Cómputos</span>
                  <Table className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {messages.map((msg) => {
              const isBot = msg.role === 'bot';
              const relatedItem = msg.itemId
                ? capturedItems.find((it) => it.id === msg.itemId)
                : null;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 sm:gap-3 ${isBot ? 'items-start' : 'items-end justify-end'}`}
                >
                  {isBot && (
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-1 shadow-sm text-white">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] sm:max-w-[85%] ${
                      isBot
                        ? 'bg-white border border-amber-200 rounded-2xl rounded-bl-none p-4 text-amber-950 text-sm leading-relaxed shadow-sm space-y-3'
                        : 'bg-amber-600 text-white rounded-2xl rounded-br-none px-4 py-3 text-sm shadow-sm whitespace-pre-wrap'
                    }`}
                  >
                    {msg.type === 'welcome' ? (
                      <div className="space-y-3">
                        <p className="font-medium text-amber-950">{msg.content}</p>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                          <p className="font-bold text-amber-950 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            Ejemplo de escritura rápida en inspección:
                          </p>
                          <pre className="font-mono text-xs bg-white p-2.5 rounded-lg border border-amber-200 text-amber-950 whitespace-pre-wrap">
{`Capitulo Impermeabilizacion
Remoción de manto asfáltico en losa de techo
10.50*7.50 m
M2`}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Tarjeta de Cómputo Anotado en el Chat con Edición en Vivo */}
                    {msg.type === 'item_captured' && relatedItem && (
                      <div className="pt-1">
                        {editingItemId === relatedItem.id && editForm ? (
                          /* FORMULARIO DE EDICIÓN EN VIVO DENTRO DEL CHAT */
                          <div className="p-3.5 rounded-xl bg-amber-100/90 border-2 border-amber-400 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between border-b border-amber-300 pb-1.5">
                              <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                                Editando Cómputo
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-amber-800 hover:text-amber-950 text-xs font-bold cursor-pointer"
                              >
                                ✕ Cancelar
                              </button>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                Descripción
                              </label>
                              <input
                                type="text"
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    description: e.target.value.toUpperCase(),
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-300 bg-white text-amber-950 focus:outline-none focus:border-amber-500 uppercase"
                              />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Largo
                                </label>
                                <MathQuantityInput
                                  value={editForm.length ?? ''}
                                  onChange={(val) => handleEditFormFieldChange('length', val)}
                                  allowEmpty
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Ancho
                                </label>
                                <MathQuantityInput
                                  value={editForm.width ?? ''}
                                  onChange={(val) => handleEditFormFieldChange('width', val)}
                                  allowEmpty
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Alto
                                </label>
                                <MathQuantityInput
                                  value={editForm.height ?? ''}
                                  onChange={(val) => handleEditFormFieldChange('height', val)}
                                  allowEmpty
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  N° Veces
                                </label>
                                <MathQuantityInput
                                  value={editForm.times ?? 1}
                                  onChange={(val) => handleEditFormFieldChange('times', val)}
                                  min={1}
                                  integerOnly
                                  className="w-full px-2 py-1 text-xs text-center font-bold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5" title="Factor de peso para acero (ej: 0.994 kg/m para cabilla 1/2&quot;)">
                                  Factor (kg/m)
                                </label>
                                <MathQuantityInput
                                  value={editForm.factor ?? ''}
                                  onChange={(val) => handleEditFormFieldChange('factor', val)}
                                  allowEmpty
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="1.000"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5" title="Distancia en kilómetros para acarreos y transportes">
                                  Distancia (km)
                                </label>
                                <MathQuantityInput
                                  value={editForm.distance ?? ''}
                                  onChange={(val) => handleEditFormFieldChange('distance', val)}
                                  allowEmpty
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="—"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Parcial
                                </label>
                                <div className="px-2 py-1 text-xs text-right font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                                  {editForm.partial > 0
                                    ? Number(editForm.partial).toLocaleString('es-VE', { maximumFractionDigits: 3 })
                                    : '—'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Total *
                                </label>
                                <MathQuantityInput
                                  value={editForm.quantity}
                                  onChange={(val) => handleEditFormFieldChange('quantity', val)}
                                  className="w-full px-2 py-1 text-xs text-right font-extrabold rounded-lg border border-amber-400 bg-white text-amber-950"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Unidad
                                </label>
                                <select
                                  value={editForm.unit}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                                  className="w-full px-2 py-1 text-xs font-bold rounded-lg border border-amber-300 bg-white text-amber-950 cursor-pointer"
                                >
                                  {COMMON_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                Observaciones
                              </label>
                              <input
                                type="text"
                                value={editForm.observations ?? ''}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, observations: e.target.value }))}
                                placeholder="Eje, ubicación, detalles..."
                                className="w-full px-2.5 py-1 text-xs rounded-lg border border-amber-300 bg-white text-amber-950"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-3 py-1 rounded-lg border border-amber-300 text-amber-900 bg-white text-xs font-bold hover:bg-amber-50 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="px-3.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* TARJETA VISIBLE CON BOTÓN EDITAR */
                          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950">
                                {relatedItem.chapter}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(relatedItem)}
                                  className="text-xs text-amber-800 hover:text-amber-950 inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 cursor-pointer"
                                  title="Editar medidas o datos de esta partida"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(relatedItem.id)}
                                  className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 font-semibold px-2 py-0.5 cursor-pointer"
                                  title="Quitar cómputo"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Quitar
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-bold text-amber-950">{relatedItem.description}</p>
                            </div>

                            {/* Desglose de dimensiones, factor y distancia si están presentes */}
                            {(relatedItem.length ||
                              relatedItem.width ||
                              relatedItem.height ||
                              (relatedItem.times && relatedItem.times > 1) ||
                              relatedItem.factor ||
                              relatedItem.distance) && (
                              <div className="flex flex-wrap gap-2 text-[11px] text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200 font-medium">
                                {relatedItem.length && <span>Largo: <strong>{relatedItem.length}</strong></span>}
                                {relatedItem.width && <span>Ancho: <strong>{relatedItem.width}</strong></span>}
                                {relatedItem.height && <span>Alto: <strong>{relatedItem.height}</strong></span>}
                                {relatedItem.times && <span>Veces: <strong>{relatedItem.times}</strong></span>}
                                {relatedItem.factor && <span>Factor: <strong>{relatedItem.factor} kg/m</strong></span>}
                                {relatedItem.distance && <span>Distancia: <strong>{relatedItem.distance} km</strong></span>}
                                {relatedItem.partial > 0 && (
                                  <span>• Parcial: <strong>{Number(relatedItem.partial).toLocaleString('es-VE', { maximumFractionDigits: 3 })}</strong></span>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-white p-2 rounded-lg border border-amber-200">
                                <span className="block text-[10px] uppercase font-bold text-amber-700">
                                  Cantidad Total
                                </span>
                                <span className="text-xs font-extrabold text-amber-950">
                                  {Number(relatedItem.quantity).toLocaleString('es-VE', {
                                    maximumFractionDigits: 3,
                                  })}
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-amber-200">
                                <span className="block text-[10px] uppercase font-bold text-amber-700">
                                  Unidad
                                </span>
                                <span className="text-xs font-extrabold text-amber-950">
                                  {relatedItem.unit}
                                </span>
                              </div>
                            </div>

                            {relatedItem.observations && (
                              <p className="text-[11px] text-amber-800 italic bg-white/60 p-1.5 rounded border border-amber-200">
                                Obs: {relatedItem.observations}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isBot && (
                    <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0 mt-1 text-amber-900">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>
  );
}
