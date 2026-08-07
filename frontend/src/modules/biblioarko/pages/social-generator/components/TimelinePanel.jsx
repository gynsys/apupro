import React, { useState, useRef, useEffect } from 'react';
import { FiClock, FiAlignLeft, FiType, FiImage, FiMusic, FiTrash2 } from 'react-icons/fi';

const Track = ({ id, label, icon, startTime, endTime, maxDuration, customTimeText, onChange, onDelete }) => {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null); // 'start', 'end', 'move'
  const [dragOffset, setDragOffset] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dragContext = useRef({ maxDuration: maxDuration, rectWidth: 1 });

  const startPercent = (startTime / maxDuration) * 100;
  const widthPercent = ((endTime - startTime) / maxDuration) * 100;

  const getPos = (clientX) => {
    if (!trackRef.current) return 0;
    // Use cached values if dragging, else get current
    const width = isDragging ? dragContext.current.rectWidth : trackRef.current.getBoundingClientRect().width;
    const duration = isDragging ? dragContext.current.maxDuration : maxDuration;
    
    // We get the current rect to know the left offset since it might scroll, 
    // but the ratio of pixels to seconds should remain constant during the drag.
    const rect = trackRef.current.getBoundingClientRect();
    const px = Math.max(0, clientX - rect.left);
    return (px / width) * duration;
  };

  const handlePointerDown = (e, type) => {
    e.stopPropagation();
    setIsDragging(type);
    if (trackRef.current) {
      dragContext.current = {
        maxDuration: maxDuration,
        rectWidth: trackRef.current.getBoundingClientRect().width
      };
    }
    if (type === 'move') {
      const pos = getPos(e.clientX || e.touches[0].clientX);
      setDragOffset(pos - startTime);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (!clientX) return;
      
      const pos = getPos(clientX);

      if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(pos, endTime - 0.1));
        onChange(id, newStart, endTime);
      } else if (isDragging === 'end') {
        const newEnd = Math.max(pos, startTime + 0.1);
        onChange(id, startTime, newEnd);
      } else if (isDragging === 'move') {
        const dur = endTime - startTime;
        let newStart = Math.max(0, pos - dragOffset);
        let newEnd = newStart + dur;

        onChange(id, newStart, newEnd);
      }
    };

    const handlePointerUp = () => setIsDragging(null);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, startTime, endTime, maxDuration, dragOffset, id, onChange]);

  return (
    <div className="flex items-center gap-4 mb-2 group">
      <div className="w-24 shrink-0 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      
      <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg relative cursor-crosshair overflow-hidden border border-gray-200 dark:border-gray-700" ref={trackRef}>
        {/* Track Bar */}
        <div 
          className="absolute top-0 bottom-0 bg-indigo-500/80 hover:bg-indigo-500 rounded-md border border-indigo-600 cursor-grab active:cursor-grabbing flex items-center justify-between"
          style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
          onMouseDown={(e) => handlePointerDown(e, 'move')}
          onTouchStart={(e) => handlePointerDown(e, 'move')}
        >
          {/* Start Handle */}
          <div 
            className="w-3 h-full cursor-ew-resize hover:bg-white/30 flex items-center justify-center shrink-0"
            onMouseDown={(e) => handlePointerDown(e, 'start')}
            onTouchStart={(e) => handlePointerDown(e, 'start')}
          >
            <div className="w-0.5 h-3 bg-white/70 rounded-full pointer-events-none"></div>
          </div>
          
          {confirmDelete ? (
            /* ── Toast de confirmación ── */
            <div
              className="flex-1 flex items-center justify-between px-2 gap-2 pointer-events-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] text-white font-semibold whitespace-nowrap">¿Eliminar audio?</span>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(id); setConfirmDelete(false); }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-red-500 hover:bg-red-600 text-white rounded cursor-pointer transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-white/20 hover:bg-white/30 text-white rounded cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between px-1 overflow-hidden pointer-events-none">
              <span className="text-[10px] text-white font-mono truncate">
                {customTimeText || `${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`}
              </span>
            </div>
          )}

          {!confirmDelete && onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} 
              className="p-1 shrink-0 text-white/70 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors mr-1 cursor-pointer pointer-events-auto"
              title="Eliminar audio"
            >
              <FiTrash2 size={12} />
            </button>
          )}

          {/* End Handle */}
          <div 
            className="w-3 h-full cursor-ew-resize hover:bg-white/30 flex items-center justify-center shrink-0"
            onMouseDown={(e) => handlePointerDown(e, 'end')}
            onTouchStart={(e) => handlePointerDown(e, 'end')}
          >
            <div className="w-0.5 h-3 bg-white/70 rounded-full pointer-events-none"></div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export const TimelinePanel = ({ slide, slideIndex, slideDuration, totalVideoDuration = null, currentTime, onUpdateTiming, onScrub, extraElements = [], imagePositions = {}, globalAudio = null, onDeleteTrack }) => {
  if (!slide) return null;

  const tStart = slide.titleStartTime !== undefined ? slide.titleStartTime : 0;
  const tEnd = slide.titleEndTime !== undefined ? slide.titleEndTime : slideDuration;

  const cStart = slide.contentStartTime !== undefined ? slide.contentStartTime : 0;
  const cEnd = slide.contentEndTime !== undefined ? slide.contentEndTime : slideDuration;

  // Calculate the actual timeline duration dynamically based on the max end time of all elements
  let maxElementTime = slideDuration;
  if (tEnd > maxElementTime) maxElementTime = tEnd;
  if (cEnd > maxElementTime) maxElementTime = cEnd;
  if (slide.audioEndTime !== undefined && slide.audioEndTime > maxElementTime) maxElementTime = slide.audioEndTime;
  
  extraElements.forEach(el => {
    if (el.endTime !== undefined && el.endTime > maxElementTime) maxElementTime = el.endTime;
  });
  
  if (slide.customImages) {
    slide.customImages.forEach((img, imgIdx) => {
      const pos = imagePositions[`${slideIndex}-${imgIdx}`] || {};
      if (pos.endTime !== undefined && pos.endTime > maxElementTime) maxElementTime = pos.endTime;
    });
  }
  
  // Use the maximum of base slideDuration and the farthest element
  const actualDuration = Math.ceil(maxElementTime);

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-40">
      <div className="max-w-4xl mx-auto">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FiClock /> Línea de Tiempo
        </h4>
        
        <div className="relative">
          {/* Timeline Ruler */}
          <div 
            className="flex ml-[6.5rem] mb-2 border-b border-gray-200 dark:border-gray-700 relative h-6 cursor-text select-none"
            onPointerDown={(e) => {
              if (onScrub) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const time = Math.max(0, Math.min(actualDuration, (x / rect.width) * actualDuration));
                onScrub(time);
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1 && onScrub) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const time = Math.max(0, Math.min(actualDuration, (x / rect.width) * actualDuration));
                onScrub(time);
              }
            }}
          >
            {Array.from({ length: actualDuration + 1 }).map((_, i) => (
              <div 
                key={i} 
                className="absolute top-0 bottom-0 border-l border-gray-300 dark:border-gray-600 text-[10px] font-bold text-gray-600 dark:text-gray-400 pl-1"
                style={{ left: `${(i / actualDuration) * 100}%` }}
              >
                {i}s
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div className="relative z-10 space-y-1 pb-2 max-h-40 overflow-y-auto pr-2">
            {globalAudio && (
              <Track 
                id="globalAudio" 
                label={`Fondo: ${globalAudio.startsWith('User-') ? 'Subido' : (globalAudio === 'Custom' ? 'Personalizado' : globalAudio)}`} 
                icon={<FiMusic className="text-purple-500" />} 
                startTime={0} 
                endTime={slideDuration} 
                maxDuration={actualDuration}
                customTimeText={`0.0s - ${(totalVideoDuration || slideDuration).toFixed(1)}s (Global)`}
                onChange={() => {}} // Global audio cannot be trimmed per slide
                onDelete={onDeleteTrack}
              />
            )}
            {slide.audio && (
              <Track 
                id="audio" 
                label={slide.audio.startsWith('User-') ? 'Audio Subido' : (slide.audio === 'Custom' ? 'Audio Personalizado' : `Audio: ${slide.audio}`)} 
                icon={<FiMusic className="text-pink-500" />} 
                startTime={slide.audioStartTime !== undefined ? slide.audioStartTime : 0} 
                endTime={slide.audioEndTime !== undefined ? slide.audioEndTime : slideDuration} 
                maxDuration={actualDuration}
                onChange={onUpdateTiming}
                onDelete={onDeleteTrack}
              />
            )}
            {slide.title && String(slide.title).trim() !== '' && (
              <Track 
                id="title" 
                label="Título" 
                icon={<FiType />} 
                startTime={tStart} 
                endTime={tEnd} 
                maxDuration={actualDuration}
                onChange={onUpdateTiming}
              />
            )}
            {(slide.content || slide.text) && String(slide.content || slide.text).trim() !== '' && (
              <Track 
                id="content" 
                label="Contenido" 
                icon={<FiAlignLeft />} 
                startTime={cStart} 
                endTime={cEnd} 
                maxDuration={actualDuration}
                onChange={onUpdateTiming}
              />
            )}
            {extraElements.map((el) => (
              <Track 
                key={el.id}
                id={`extra-${el.id}`} 
                label={el.type === 'text' ? (el.content || 'Texto Libre') : (el.type === 'shape' ? 'Forma' : 'Ícono')} 
                icon={<FiType className="text-amber-500" />} 
                startTime={el.startTime !== undefined ? el.startTime : 0} 
                endTime={el.endTime !== undefined ? el.endTime : actualDuration} 
                maxDuration={actualDuration}
                onChange={onUpdateTiming}
              />
            ))}
            {slide.customImages?.map((img, imgIdx) => {
              const imgId = `${slideIndex}-${imgIdx}`;
              const pos = imagePositions[imgId] || {};
              return (
                <Track
                  key={imgId}
                  id={`img-${imgId}`}
                  label={(img?.startsWith('data:video') || img?.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)) ? `Video ${imgIdx + 1}` : `Imagen ${imgIdx + 1}`}
                  icon={(img?.startsWith('data:video') || img?.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)) ? <FiClock className="text-purple-500" /> : <FiImage className="text-indigo-500" />} 
                  startTime={pos.startTime !== undefined ? pos.startTime : 0}
                  endTime={pos.endTime !== undefined ? pos.endTime : actualDuration}
                  maxDuration={actualDuration}
                  onChange={onUpdateTiming}
                />
              );
            })}
          </div>

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 pointer-events-none"
            style={{ 
              left: `calc(6.5rem + ${Math.min(100, Math.max(0, (currentTime / actualDuration) * 100))}%)`,
              display: currentTime !== undefined && currentTime >= 0 ? 'block' : 'none'
            }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
