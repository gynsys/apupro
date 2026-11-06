import React, { useState } from 'react';
import { FolderOpen, History, Plus, RotateCcw, Trash2, X } from 'lucide-react';

export default function SavedComputosModal({
  isOpen,
  savedList,
  onClose,
  onCreate,
  onLoad,
  onDelete,
}) {
  const [expandedDraftId, setExpandedDraftId] = useState(null);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-amber-950 font-bold text-base leading-tight">Cómputos Guardados</h3>
              <p className="text-xs text-amber-800">Selecciona un archivo guardado para continuar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-900">
            {savedList.length} archivo(s) disponible(s)
          </span>
          <button
            type="button"
            onClick={onCreate}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Cómputo</span>
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {savedList.length === 0 ? (
            <div className="py-8 text-center text-amber-800 text-xs">
              <FolderOpen className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="font-bold">No hay cómputos guardados en tu cuenta.</p>
              <p className="text-amber-700 mt-1">
                Presiona el botón <strong>Guardar</strong> en la parte inferior para almacenar tus planillas y sincronizarlas entre tu teléfono y tu PC.
              </p>
            </div>
          ) : (
            savedList.map((item) => {
              const versions = Array.isArray(item.versions) ? item.versions : [];
              const isExpanded = expandedDraftId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border border-amber-200 hover:border-amber-400 bg-amber-50/50 transition-all space-y-2"
                >
                  <div
                    onClick={() => onLoad(item)}
                    className="flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-extrabold text-amber-950 truncate group-hover:text-amber-900">
                        {item.budgetName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-amber-800">
                        {item.projectName && (
                          <span>
                            Obra: <strong>{item.projectName}</strong>
                          </span>
                        )}
                        <span>• {item.itemCount || item.items?.length || 0} partida(s)</span>
                        <span>
                          • {new Date(item.savedAt).toLocaleDateString('es-VE')}{' '}
                          {new Date(item.savedAt).toLocaleTimeString('es-VE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {versions.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDraftId(isExpanded ? null : item.id);
                          }}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Ver puntos de restauración anteriores"
                        >
                          <History className="w-3.5 h-3.5 text-amber-700" />
                          <span>Versiones ({versions.length})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onLoad(item)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(item.id, e)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar de la lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && versions.length > 0 && (
                    <div className="pt-2 border-t border-amber-200 space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase text-amber-800">
                        Puntos de restauración anteriores:
                      </span>
                      {versions.map((ver, vIdx) => (
                        <div
                          key={`${item.id}-ver-${vIdx}`}
                          className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-[11px]"
                        >
                          <div className="text-amber-950 font-medium">
                            <span className="font-bold">Versión #{vIdx + 1}:</span>{' '}
                            {new Date(ver.savedAt).toLocaleDateString('es-VE')}{' '}
                            {new Date(ver.savedAt).toLocaleTimeString('es-VE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            • {ver.itemCount || ver.items?.length || 0} partida(s)
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onLoad({
                                ...item,
                                savedAt: new Date().toISOString(),
                                items: ver.items,
                                itemCount: ver.items?.length || 0,
                              })
                            }
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restaurar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-amber-200 pt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
