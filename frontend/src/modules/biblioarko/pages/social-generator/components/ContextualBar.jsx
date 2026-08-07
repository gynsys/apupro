import React, { useState, useEffect, useRef } from 'react';
import { 
  FiTrash2, FiX, FiBold, FiItalic, FiType, 
  FiLayers, FiMove, FiMaximize, FiMinimize, 
  FiCornerUpLeft, FiSquare, FiCircle, FiImage,
  FiEye, FiCopy, FiPlay, FiPause, FiCrop, FiVideo
} from 'react-icons/fi';

export const ContextualBar = ({ 
  selectedId, 
  canvas, 
  updateElement, 
  removeElement, 
  deselectElement,
  isMobile = false,
  isImage = false,
  isVideo = false,
  imagePositions = {},
  updateImage,
  onRemoveImage,
  onCropImage,
  onEditVideo
}) => {
  if (!selectedId) return null;

  const [isPlaying, setIsPlaying] = useState(true);
  const colorInputRef = useRef(null);

  const handleOpenColorPicker = (e) => {
    e.stopPropagation();
    if (colorInputRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      colorInputRef.current.style.top = `${rect.top}px`;
      colorInputRef.current.style.left = `${rect.left}px`;
      if (colorInputRef.current.showPicker) {
        try {
          colorInputRef.current.showPicker();
        } catch (err) {
          colorInputRef.current.click();
        }
      } else {
        colorInputRef.current.click();
      }
    }
  };

  useEffect(() => {
    if (isVideo && selectedId) {
      const vid = document.getElementById(`video-${selectedId}`);
      if (vid) {
        setIsPlaying(!vid.paused);
      }
    }
  }, [selectedId, isVideo]);

  const togglePlay = () => {
    const vid = document.getElementById(`video-${selectedId}`);
    if (vid) {
      if (vid.paused) {
        vid.play();
        setIsPlaying(true);
      } else {
        vid.pause();
        setIsPlaying(false);
      }
    }
  };

  const [slideIdx, elId] = selectedId.split('-');
  let el = null;
  let currentZIndex = 0;
  let isText = false;
  let isShape = false;
  
  if (isImage) {
    const pos = imagePositions[selectedId] || { zIndex: 20 };
    currentZIndex = pos.zIndex || 20;
  } else {
    el = canvas.extraElements[slideIdx]?.find(e => e.id === elId);
    if (!el) return null;
    currentZIndex = el.zIndex || 0;
    isText = el.type === 'text' || el.type === 'title';
    isShape = el.type === 'shape';
  }

  const containerClasses = isMobile 
    ? "fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-[150] p-3 pb-safe shadow-2xl animate-slideUp overflow-hidden"
    : "absolute top-1/2 right-full mr-4 -translate-y-1/2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 z-[60] p-3 rounded-[28px] shadow-2xl flex flex-col items-center gap-2.5 animate-fadeIn pointer-events-auto min-w-[56px]";

  if (isMobile) {
    return (
      <div data-contextual-bar="true" className={containerClasses}>
        {/* Fila 1: Tipo + Color + Bold/Italic */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center flex-shrink-0">
            {isText ? <FiType size={14} /> : isShape ? <FiSquare size={14} /> : <FiImage size={14} />}
          </div>

          {/* Color del elemento */}
          {!isImage && (
            <button
              type="button"
              onClick={handleOpenColorPicker}
              className="relative flex items-center justify-center w-8 h-8 rounded-xl border-2 border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm bg-white flex-shrink-0 cursor-pointer"
              title="Color del elemento"
            >
              <div 
                className="w-full h-full rounded-lg"
                style={{ backgroundColor: el?.color || '#000000' }}
              />
            </button>
          )}

          {isText && (
            <>
              <button
                onClick={() => updateElement(parseInt(slideIdx), elId, { bold: !el.bold })}
                className={`p-2 rounded-xl transition-all flex-shrink-0 ${el.bold ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-500'}`}
              >
                <FiBold size={14} />
              </button>
              <button
                onClick={() => updateElement(parseInt(slideIdx), elId, { italic: !el.italic })}
                className={`p-2 rounded-xl transition-all flex-shrink-0 ${el.italic ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-500'}`}
              >
                <FiItalic size={14} />
              </button>
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-2 py-1 flex-shrink-0">
                <button
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => {
                    const currentSize = Math.round((el.height || 40) * 0.8);
                    const newSize = Math.max(8, currentSize - 1);
                    const newHeight = newSize / 0.8;
                    const ratio = newHeight / (el.height || 40);
                    updateElement(parseInt(slideIdx), elId, { height: newHeight, width: (el.width || 150) * ratio });
                  }}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 font-black text-sm"
                >−</button>
                <span className="text-xs font-black text-indigo-600 w-6 text-center">{Math.round((el?.height || 40) * 0.8)}</span>
                <button
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => {
                    const currentSize = Math.round((el.height || 40) * 0.8);
                    const newSize = Math.min(120, currentSize + 1);
                    const newHeight = newSize / 0.8;
                    const ratio = newHeight / (el.height || 40);
                    updateElement(parseInt(slideIdx), elId, { height: newHeight, width: (el.width || 150) * ratio });
                  }}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 font-black text-sm"
                >+</button>
              </div>
            </>
          )}

          {isImage && (
            <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-2 py-1 flex-shrink-0">
              <FiEye size={16} className="text-gray-400" />
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.1"
                value={imagePositions[selectedId]?.opacity !== undefined ? imagePositions[selectedId].opacity : 1}
                onChange={(e) => updateImage(selectedId, { opacity: parseFloat(e.target.value) })}
                className="w-16 cursor-pointer"
              />
            </div>
          )}

          {isVideo && (
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl transition-all flex-shrink-0 bg-gray-50 dark:bg-gray-900 text-indigo-600 hover:bg-indigo-100"
              title={isPlaying ? "Pausar video" : "Reproducir video"}
            >
              {isPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!isImage && (
              <button
                onClick={() => {
                  if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) {
                     document.activeElement.blur();
                  }
                  setTimeout(() => {
                    if (canvas.duplicateExtraElement) canvas.duplicateExtraElement(parseInt(slideIdx), elId);
                  }, 50);
                }}
                className="p-2 text-blue-500 bg-blue-50 rounded-xl"
                title="Duplicar"
              >
                <FiCopy size={14} />
              </button>
            )}
            <button
              onClick={() => {
                if (isImage) updateImage(selectedId, { zIndex: currentZIndex + 5 });
                else updateElement(parseInt(slideIdx), elId, { zIndex: currentZIndex + 5 });
              }}
              className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 rounded-xl"
              title="Subir capa"
            >
              <FiLayers size={14} />
            </button>
            <button
              onClick={() => removeElement(parseInt(slideIdx), elId)}
              className="p-2 bg-red-50 text-red-500 rounded-xl"
            >
              <FiTrash2 size={14} />
            </button>
            <button
              onClick={() => deselectElement(null, null)}
              className="p-2 bg-gray-100 dark:bg-gray-900 text-gray-400 rounded-xl"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-contextual-bar="true" className={containerClasses}>
      {/* Type Icon */}
      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center flex-shrink-0" title={isText ? "Texto" : isShape ? "Forma" : "Imagen"}>
        {isText ? <FiType size={18} /> : isShape ? <FiSquare size={18} /> : <FiImage size={18} />}
      </div>

      <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 my-0.5"></div>

      {/* Common: Color Picker */}
      {!isImage && (
        <button
          type="button"
          onClick={handleOpenColorPicker}
          className="relative flex items-center justify-center w-10 h-10 rounded-2xl border-2 border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm bg-white flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
          title="Color del elemento"
        >
          <div 
            className="w-full h-full rounded-xl"
            style={{ backgroundColor: el?.color || '#000000' }}
          />
        </button>
      )}

      {/* Invisible fixed input positioned on-the-fly at the button's screen coordinates */}
      {!isImage && (
        <input
          ref={colorInputRef}
          type="color"
          value={el?.color || '#000000'}
          onChange={(e) => updateElement(parseInt(slideIdx), elId, { color: e.target.value })}
          onInput={(e) => updateElement(parseInt(slideIdx), elId, { color: e.target.value })}
          className="fixed z-[9999] opacity-0 pointer-events-none w-8 h-8"
        />
      )}

      {/* Text Specific Controls */}
      {isText && (
        <>
          <button 
            onClick={() => updateElement(parseInt(slideIdx), elId, { bold: !el.bold })}
            className={`p-2.5 rounded-2xl transition-all flex-shrink-0 cursor-pointer ${el?.bold ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}
            title="Negrita"
          >
            <FiBold size={18} />
          </button>
          <button 
            onClick={() => updateElement(parseInt(slideIdx), elId, { italic: !el.italic })}
            className={`p-2.5 rounded-2xl transition-all flex-shrink-0 cursor-pointer ${el?.italic ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}
            title="Cursiva"
          >
            <FiItalic size={18} />
          </button>
          
          {/* Size Step Controls */}
          <div className="flex flex-col items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-2xl p-1.5 flex-shrink-0">
            <button
              onClick={() => {
                const currentSize = Math.round((el?.height || 40) * 0.8);
                const newSize = Math.min(140, currentSize + 2);
                const newHeight = newSize / 0.8;
                const ratio = newHeight / (el?.height || 40);
                updateElement(parseInt(slideIdx), elId, { height: newHeight, width: (el?.width || 150) * ratio });
              }}
              className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-black text-sm shadow-sm hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
              title="Aumentar Tamaño"
            >+</button>
            <span className="text-xs font-black text-indigo-600 py-0.5">{Math.round((el?.height || 40) * 0.8)}</span>
            <button
              onClick={() => {
                const currentSize = Math.round((el?.height || 40) * 0.8);
                const newSize = Math.max(8, currentSize - 2);
                const newHeight = newSize / 0.8;
                const ratio = newHeight / (el?.height || 40);
                updateElement(parseInt(slideIdx), elId, { height: newHeight, width: (el?.width || 150) * ratio });
              }}
              className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-black text-sm shadow-sm hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
              title="Reducir Tamaño"
            >−</button>
          </div>
        </>
      )}

      {/* Opacidad / Transparencia para todos los elementos (Imágenes, Formas, Textos) */}
      <div className="flex flex-col items-center gap-1.5 bg-gray-50 dark:bg-gray-900 rounded-2xl p-2 flex-shrink-0" title="Opacidad / Transparencia">
        <FiEye size={16} className="text-gray-400" />
        <input 
          type="range" 
          min="0.1" 
          max="1" 
          step="0.1"
          value={
            isImage 
              ? (imagePositions[selectedId]?.opacity !== undefined ? imagePositions[selectedId].opacity : 1)
              : (el?.opacity !== undefined ? el.opacity : 1)
          }
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (isImage) updateImage(selectedId, { opacity: val });
            else updateElement(parseInt(slideIdx), elId, { opacity: val });
          }}
          className="w-12 h-1.5 accent-indigo-600 cursor-pointer"
        />
      </div>

      {/* Image Specific Crop Control */}
      {isImage && !isVideo && (
        <button
          onClick={() => onCropImage && onCropImage(parseInt(slideIdx), parseInt(elId))}
          className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-sm"
          title="Recortar Imagen"
        >
          <FiCrop size={18} />
        </button>
      )}

      {/* Video Specific Controls */}
      {isVideo && (
        <button
          onClick={togglePlay}
          className="p-2.5 rounded-2xl transition-all flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 hover:bg-indigo-100 cursor-pointer"
          title={isPlaying ? "Pausar Video" : "Reproducir Video"}
        >
          {isPlaying ? <FiPause size={18} /> : <FiPlay size={18} />}
        </button>
      )}

      {/* Layers / Z-Index */}
      <div className="flex flex-col items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-2xl p-1 flex-shrink-0">
        <button 
          onClick={() => {
            if (isImage) updateImage(selectedId, { zIndex: currentZIndex + 20 });
            else updateElement(parseInt(slideIdx), elId, { zIndex: currentZIndex + 5 });
          }}
          className="p-2 text-gray-400 hover:text-indigo-600 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
          title="Traer al frente"
        >
          <FiLayers size={16} />
        </button>
        <button 
          onClick={() => {
            if (isImage) updateImage(selectedId, { zIndex: currentZIndex - 20 });
            else updateElement(parseInt(slideIdx), elId, { zIndex: currentZIndex - 5 });
          }}
          className="p-2 text-gray-400 hover:text-indigo-600 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
          title="Enviar al fondo"
        >
          <FiCornerUpLeft size={16} className="rotate-270" />
        </button>
      </div>

      <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 my-0.5"></div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        {isVideo && (
          <button
            onClick={() => {
              if (onEditVideo) onEditVideo(parseInt(slideIdx), parseInt(elId));
            }}
            className="p-2.5 bg-indigo-50 text-indigo-500 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer"
            title="Editar Video (Recortar/Velocidad)"
          >
            <FiVideo size={18} />
          </button>
        )}
        {!isImage && (
          <button
            onClick={() => {
              if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) {
                 document.activeElement.blur();
              }
              setTimeout(() => {
                if (canvas.duplicateExtraElement) canvas.duplicateExtraElement(parseInt(slideIdx), elId);
              }, 50);
            }}
            className="p-2.5 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
            title="Duplicar Elemento"
          >
            <FiCopy size={18} />
          </button>
        )}
        <button
          onClick={() => {
            if (isImage) {
              onRemoveImage(parseInt(slideIdx), parseInt(elId));
              deselectElement(null, null);
            } else {
              removeElement(parseInt(slideIdx), elId);
            }
          }}
          className="p-2.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all cursor-pointer"
          title="Eliminar Elemento"
        >
          <FiTrash2 size={18} />
        </button>
        <button
          onClick={() => deselectElement(null, null)}
          className="p-2.5 bg-gray-100 dark:bg-gray-900 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all cursor-pointer"
          title="Desseleccionar"
        >
          <FiX size={18} />
        </button>
      </div>
    </div>
  );
};


