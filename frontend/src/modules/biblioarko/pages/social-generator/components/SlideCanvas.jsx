import React, { useRef, useEffect } from 'react';
import { Resizable } from 're-resizable';
import { FiMaximize2, FiEdit3, FiPlusCircle, FiCopy, FiCheck, FiTrash2, FiRefreshCw, FiLayers, FiImage } from 'react-icons/fi';
import { SVGIcons } from '../lib/svgIcons';
import { ContextualBar } from './ContextualBar';

// Function to get SVG path for each icon type
const getIconPath = (iconType) => {
  const iconPaths = {
    arrow: "M16.01 11H4v2h12.01v3L20 12l-3.99-4z",
    arrowLeft: "M7.99 11H20v2H7.99v3L4 12l3.99-4z",
    arrowUp: "M13 7.99V20h-2V7.99H8L12 4l4 3.99z",
    arrowDown: "M11 16.01V4h2v12.01h3L12 20l-4-3.99z",
    star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    bubble: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
    bulletCheck: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    stetho: "M12 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm8-10h-2c0-4.4-3.6-8-8-8s-8 3.6-8 8H2c0 5.5 4.5 10 10 10s10-4.5 10-10z",
    dna: "M18.8 15.6c-.6-.6-1.5-.6-2.1 0l-1.1 1.1-1.1-1.1c-.6-.6-1.5-.6-2.1 0s-.6 1.5 0 2.1l1.1 1.1-1.1 1.1c-.6.6-.6 1.5 0 2.1.3.3.7.4 1.1.4s.8-.1 1.1-.4l1.1-1.1 1.1 1.1c.3.3.7.4 1.1.4s.8-.1 1.1-.4c.6-.6.6-1.5 0-2.1l-1.1-1.1 1.1-1.1c.5-.6.5-1.5-.1-2.1zM5.2 8.4c.6.6 1.5.6 2.1 0l1.1-1.1 1.1 1.1c.6.6 1.5.6 2.1 0s.6-1.5 0-2.1l-1.1-1.1 1.1-1.1c.6-.6.6-1.5 0-2.1-.3-.3-.7-.4-1.1-.4s-.8.1-1.1.4l-1.1 1.1-1.1-1.1c-.3-.3-.7-.4-1.1-.4s-.8.1-1.1.4c-.6.6-.6 1.5 0 2.1l1.1 1.1-1.1 1.1c-.6.6-.6 1.5 0 2.1z",
    utero: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8 0-1.5.4-2.8 1.1-4 .6 1.1 1.6 2 2.9 2.6-.1.5-.2 1.1-.2 1.6 0 2.2 1.8 4 4 4s4-1.8 4-4c0-.5-.1-1.1-.2-1.6 1.3-.6 2.3-1.5 2.9-2.6.7 1.2 1.1 2.5 1.1 4 0 4.4-3.6 8-8 8z",
    blob1: "M44.7,-76.4C58.1,-69.2,69.2,-58.1,76.4,-44.7C83.7,-31.3,87.1,-15.7,85.2,-0.9C83.3,13.8,76.1,27.7,67.6,40.1C59.1,52.5,49.3,63.5,37.3,71.1C25.3,78.7,11.1,82.9,-3.4,88.7C-17.9,94.5,-32.7,101.9,-45.3,97.7C-57.9,93.5,-68.3,77.7,-76.1,62.3C-83.9,46.9,-89.1,31.9,-90.1,16.8C-91.1,1.7,-87.9,-13.5,-82,-27.1C-76.1,-40.7,-67.5,-52.7,-56.3,-62C-45.1,-71.3,-31.3,-77.9,-17.1,-80.9C-2.9,-83.9,11.7,-83.3,44.7,-76.4Z",
    sparkle: "M12 2l2.4 7.2L22 11.6l-7.6 2.4L12 22l-2.4-7.6L2 11.6l7.6-2.4L12 2z",
    circle: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z",
    square: "M2 2h20v20H2z",
    roundedSquare: "M2 2h20v20H2z",
    line: "M2 11h20v2H2z",
    bullet: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"
  };
  return iconPaths[iconType] || iconPaths.circle;
};

const parseHighlightedText = (text, highlightColor, highlightSize, bulletColor = '#10b981') => {
  if (!text) return '';
  
  return text.split('\n').map((line, lineIdx) => {
    let bulletNode = null;
    let restOfLine = line;
    const bulletMatch = line.match(/^([•✔✅✓-]\s?)(.*)$/);
    
    if (bulletMatch) {
      bulletNode = (
        <span key={`bullet-${lineIdx}`} style={{ color: bulletColor, fontWeight: 'bold' }}>
          {bulletMatch[1]}
        </span>
      );
      restOfLine = bulletMatch[2];
    }
    
    const parts = restOfLine.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_)/g);
    const lineContent = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span 
            key={i} 
            style={{ 
              color: highlightColor || '#ff0000', 
              fontSize: highlightSize ? highlightSize + 'px' : 'inherit',
              fontStyle: 'italic', 
              fontWeight: '900' 
            }}
          >
            {part.slice(2, -2)}
          </span>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <span key={i} style={{ fontWeight: 'bold' }}>{part.slice(1, -1)}</span>;
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <span key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</span>;
      }
      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {bulletNode}
        {lineContent}
        {lineIdx < text.split('\n').length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
};

export const SlideCanvas = ({
  slide,
  index,
  isPreview,
  isExport = false,
  doctor,
  doctorLogo,
  siteConfig,
  design,
  canvas,
  transform,
  handlers,
  watermark,
  onEdit,
  onPreview,
  onCopy,
  onRemove,
  onClearMainContent,
  onDuplicateMainContent,
  onAddImage,
  onRemoveImage,
  onCropImage,
  isVideoMode = false,
  showGrid = false,
  showBgImage = true,
  currentTime = 0,
  isPlaying = false,
  onEditVideo
}) => {
  const { 
    imagePositions, imageSizes, imageRotations, 
    contentPositions, contentSizes, contentRotations 
  } = transform;

  const { 
    fontSize, titleFontSize, titleColor, contentColor, headerColor, headerFontSize,
    logoPos, doctorNamePos, dividerPos, dividerColor, dividerHeight, dividerWidth,
    imageBorderRadius
  } = design;

  const {
    extraElements, selectElement, selectedExtraId, selectedImageId, selectedContentIndex,
    selectedLogo, selectedDoctorName
  } = canvas;

  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const isSelected = !isPreview && !isExport && (canvas.currentSlidePage === index || isVideoMode);

  const { handleDragStart, handleTransformStart } = handlers;

  useEffect(() => {
    if (isVideoMode && currentTime !== undefined) {
      slide?.customImages?.forEach((img, imgIdx) => {
        if (img && (img.startsWith('data:video') || img.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i))) {
          const imgId = `${index}-${imgIdx}`;
          const pos = imagePositions[imgId] || {};
          const vStart = pos.startTime !== undefined ? pos.startTime : 0;
          const vEnd = pos.endTime !== undefined ? pos.endTime : 9999;
          
          const speed = pos.speed || 1.0;
          const trimStart = pos.trimStart || 0;
          const trimEnd = pos.trimEnd !== undefined ? pos.trimEnd : 9999;
          
          const vidNode = videoRefs.current[imgId];
          if (vidNode) {
            vidNode.playbackRate = speed;
            
            if (currentTime >= vStart && currentTime <= vEnd) {
              const targetTime = trimStart + (currentTime - vStart) * speed;
              
              if (targetTime <= trimEnd) {
                if (isPlaying) {
                  if (vidNode.paused) {
                    vidNode.currentTime = targetTime;
                    vidNode.play().catch(e => console.log('video play error', e));
                  }
                  // Se removió la sincronización agresiva (> 0.5) porque setInterval se desincroniza 
                  // del reloj físico del navegador y causa tirones (stuttering). El navegador mantendrá 
                  // la reproducción fluida por sí solo.
                } else {
                  if (!vidNode.paused) vidNode.pause();
                  if (Math.abs(vidNode.currentTime - targetTime) > 0.1) {
                    vidNode.currentTime = targetTime;
                  }
                }
              } else {
                if (!vidNode.paused) vidNode.pause();
                // Rewind if invisible
                if (Math.abs(vidNode.currentTime - trimStart) > 0.1) {
                  vidNode.currentTime = trimStart;
                }
              }
            } else {
              if (!vidNode.paused) vidNode.pause();
              // Rewind if invisible
              if (Math.abs(vidNode.currentTime - trimStart) > 0.1) {
                vidNode.currentTime = trimStart;
              }
            }
          }
        }
      });
    }
  }, [currentTime, isPlaying, isVideoMode, slide, imagePositions, index]);

  const profileBgUrl = siteConfig?.socialBackgroundImage || siteConfig?.social_background_image || doctor?.social_background_image || doctor?.socialBackgroundImage;

  return (
    <div 
      ref={containerRef}
      className={`relative w-[410px] ${isVideoMode ? 'h-[728px]' : 'h-[410px]'} overflow-visible shadow-2xl transition-all duration-500 ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-gray-50' : ''}`}
      style={{ 
        backgroundColor: design.bgColor,
        backgroundImage: (showBgImage && profileBgUrl) 
          ? `url(${profileBgUrl})` 
          : (design.useBgGradient 
            ? `linear-gradient(to bottom right, ${design.bgColor}, ${design.bgColor2}, ${design.bgColor3})` 
            : 'none'),
        backgroundSize: (showBgImage && profileBgUrl) ? '100% 100%' : 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        userSelect: isSelected ? 'none' : 'auto'
      }}
      onClick={() => isSelected && selectElement(null, null)}
      onDoubleClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(index); }}
    >
      {/* Inner container for slide content */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Cuadrícula / Grid Overlay */}
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none z-[100]"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)
              `,
              backgroundSize: '10% 10%',
              mixBlendMode: 'difference'
            }}
          >
            {/* Líneas centrales */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/40 -translate-x-1/2"></div>
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/40 -translate-y-1/2"></div>
            
            {/* Regla de los tercios */}
            <div className="absolute top-0 bottom-0 left-1/3 w-[1px] border-l-[1.5px] border-dashed border-white/30 -translate-x-1/2"></div>
            <div className="absolute top-0 bottom-0 left-2/3 w-[1px] border-l-[1.5px] border-dashed border-white/30 -translate-x-1/2"></div>
            <div className="absolute left-0 right-0 top-1/3 h-[1px] border-t-[1.5px] border-dashed border-white/30 -translate-y-1/2"></div>
            <div className="absolute left-0 right-0 top-2/3 h-[1px] border-t-[1.5px] border-dashed border-white/30 -translate-y-1/2"></div>
          </div>
        )}

        {/* Logo Section */}
        {doctorLogo && !isVideoMode && (
        <div 
          className="absolute z-30"
          style={{
            left: logoPos.x + '%',
            top: logoPos.y + '%',
            width: 0, height: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible'
          }}
        >
          <div 
            className={`transition-shadow shrink-0 ${isSelected && selectedLogo ? 'border-[1.5px] border-dashed border-indigo-500 rounded-xl p-2 bg-white/5' : ''}`}
            style={{
              cursor: isSelected ? 'grab' : 'default',
              flexShrink: 0
            }}
            onMouseDown={(e) => isSelected && handleDragStart(e, index, 'logo', 'global-logo', containerRef.current, logoPos)}
            onTouchStart={(e) => { 
              if (isSelected) {
                selectElement('logo', 'global-logo');
                handleDragStart(e, index, 'logo', 'global-logo', containerRef.current, logoPos);
              }
            }}
            onClick={(e) => { e.stopPropagation(); isSelected && selectElement('logo', 'global-logo'); }}
          >
            <div 
              className="w-[2.5rem] h-[2.5rem] bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${doctorLogo})`,
                backgroundSize: 'contain'
              }}
            />
          </div>
        </div>
      )}

      {/* Content Section */}
      {(slide?.title || slide?.content || slide?.text || slide?.overlayText) ? (
        <div 
          className="absolute z-10 pointer-events-auto"
          style={{
            left: (contentPositions[index]?.x ?? 50) + '%',
            top: (contentPositions[index]?.y ?? (isVideoMode ? 50 : 60)) + '%',
            width: 0, height: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible'
          }}
        >
          <div 
            className={`transition-shadow shrink-0 px-4 ${isSelected && selectedContentIndex === index ? 'border-[1.5px] border-dashed border-indigo-500 rounded-2xl p-4 bg-white/10 backdrop-blur-sm' : ''}`}
            style={{
              transform: `rotate(${contentRotations[index] || 0}deg)`,
              width: contentSizes && contentSizes[index] ? `${contentSizes[index]}px` : '346px',
              cursor: isSelected ? 'grab' : 'default',
              flexShrink: 0
            }}
            onMouseDown={(e) => isSelected && handleDragStart(e, index, 'content', index, containerRef.current, contentPositions[index] || { x: 50, y: 60 })}
            onTouchStart={(e) => {
              if (isSelected) {
                selectElement('content', index);
                handleDragStart(e, index, 'content', index, containerRef.current, contentPositions[index] || { x: 50, y: 60 });
              }
            }}
            onClick={(e) => { e.stopPropagation(); isSelected && selectElement('content', index); }}
          >
        {/* Main Content Handles */}
        {isSelected && selectedContentIndex === index && (
          <>
            <div className="absolute -top-4 -left-4 w-7 h-7 bg-white rounded-full shadow-lg border-2 border-indigo-500 flex items-center justify-center cursor-alias text-indigo-600 z-50 hover:scale-110 transition-transform" 
              onMouseDown={(e) => handleTransformStart(e, index, 'rotate', 'content', index, containerRef.current, { x: 50, y: 60, rotation: contentRotations[index] || 0 })}
              onTouchStart={(e) => handleTransformStart(e, index, 'rotate', 'content', index, containerRef.current, { x: 50, y: 60, rotation: contentRotations[index] || 0 })}><FiRefreshCw size={12}/></div>
            
            <div className="absolute -top-4 -right-4 flex flex-col gap-2 z-[999]">
              <div className="w-7 h-7 bg-red-50 rounded-full shadow-lg border-2 border-red-500 flex items-center justify-center cursor-pointer text-red-600 hover:scale-110 hover:bg-red-500 hover:text-white transition-all" 
                onMouseDown={(e) => e.stopPropagation()} 
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof onClearMainContent === 'function') {
                    onClearMainContent(index);
                  }
                }}
                title="Eliminar Texto Principal"><FiTrash2 size={12}/></div>
              <div className="w-7 h-7 bg-blue-50 rounded-full shadow-lg border-2 border-blue-500 flex items-center justify-center cursor-pointer text-blue-600 hover:scale-110 hover:bg-blue-500 hover:text-white transition-all" 
                onMouseDown={(e) => e.stopPropagation()} 
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof onDuplicateMainContent === 'function') {
                    onDuplicateMainContent(index);
                  }
                }}
                title="Duplicar como elemento extra"><FiCopy size={12}/></div>
            </div>
              
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white cursor-e-resize z-[999] shadow-md hover:scale-125 transition-transform"
              title="Ensanchar cajón"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleTransformStart(e, index, 'resize-w', 'content', index, containerRef.current, { 
                  width: contentSizes && contentSizes[index] ? contentSizes[index] : 346 
                });
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTransformStart(e, index, 'resize-w', 'content', index, containerRef.current, { 
                  width: contentSizes && contentSizes[index] ? contentSizes[index] : 346 
                });
              }}></div>
          </>
        )}

        <div className="relative w-full" style={{ fontFamily: design.fontFamily || 'Manrope', textAlign: slide?.textAlign || 'center' }}>
          <h4 data-export-id="title" className="font-black mb-3 uppercase leading-tight transition-opacity duration-300" 
              style={{ 
                fontSize: titleFontSize + 'px', 
                color: titleColor,
                opacity: (isVideoMode && currentTime !== undefined && ((slide?.titleStartTime !== undefined && currentTime < slide.titleStartTime) || (slide?.titleEndTime !== undefined && currentTime > slide.titleEndTime))) ? 0 : 1
              }}>
            {parseHighlightedText(slide?.title || '', design.headerColor, design.headerFontSize, design.bulletColor)}
          </h4>
          <p data-export-id="content" className="font-bold leading-relaxed whitespace-pre-wrap transition-opacity duration-300" 
             style={{ 
               fontSize: fontSize + 'px', 
               color: contentColor,
               opacity: (isVideoMode && currentTime !== undefined && ((slide?.contentStartTime !== undefined && currentTime < slide.contentStartTime) || (slide?.contentEndTime !== undefined && currentTime > slide.contentEndTime))) ? 0 : 1
             }}>
            {parseHighlightedText(slide?.content || slide?.text || '', design.headerColor, design.headerFontSize, design.bulletColor)}
          </p>
          {slide?.overlayText && (
            <p className="mt-4 font-bold tracking-tight whitespace-pre-wrap transition-opacity duration-300" 
               style={{ 
                 fontSize: Math.max(14, fontSize * 0.4) + 'px', 
                 color: contentColor,
                 opacity: (isVideoMode && currentTime !== undefined && ((slide?.contentStartTime !== undefined && currentTime < slide.contentStartTime) || (slide?.contentEndTime !== undefined && currentTime > slide.contentEndTime))) ? 0 : 0.8
               }}>
              {slide.overlayText}
            </p>
          )}
        </div>
      </div>
      </div>
      ) : null}
      
      {/* Images Layer */}
      {slide?.customImages?.map((img, imgIdx) => {
        const imgId = `${index}-${imgIdx}`;
        const pos = imagePositions[imgId] || { x: 50, y: 70 };
        const sizeVal = imageSizes[imgId] || 100;
        const width = typeof sizeVal === 'object' ? sizeVal.width : sizeVal;
        const height = typeof sizeVal === 'object' ? sizeVal.height : sizeVal;
        const rot = imageRotations[imgId] || 0;
        const isCurrentImgSelected = isSelected && selectedImageId === imgId;
        
        return (
          <Resizable
            key={imgId}
            size={{ width, height }}
            lockAspectRatio={true}
            onResizeStart={(e) => {
              e.stopPropagation();
            }}
            onResizeStop={(e, direction, ref, d) => {
              const newW = Math.max(30, Math.round(width + d.width));
              const newH = Math.max(30, Math.round(height + d.height));
              if (handlers.updateImageSize) {
                handlers.updateImageSize(imgId, { width: newW, height: newH });
              }
            }}
            enable={isCurrentImgSelected ? {
              top: true, right: true, bottom: true, left: true,
              topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
            } : false}
            handleStyles={{
              top: { cursor: 'ns-resize', height: '2px', top: '-1px' },
              bottom: { cursor: 'ns-resize', height: '2px', bottom: '-1px' },
              left: { cursor: 'ew-resize', width: '2px', left: '-1px' },
              right: { cursor: 'ew-resize', width: '2px', right: '-1px' },
              topLeft: { cursor: 'nwse-resize', width: '6px', height: '6px', top: '-3px', left: '-3px' },
              topRight: { cursor: 'nesw-resize', width: '6px', height: '6px', top: '-3px', right: '-3px' },
              bottomLeft: { cursor: 'nesw-resize', width: '6px', height: '6px', bottom: '-3px', left: '-3px' },
              bottomRight: { cursor: 'nwse-resize', width: '6px', height: '6px', bottom: '-3px', right: '-3px' },
            }}
            handleClasses={{
              top: 'bg-indigo-500/60 hover:bg-indigo-600 transition-colors z-40',
              bottom: 'bg-indigo-500/60 hover:bg-indigo-600 transition-colors z-40',
              left: 'bg-indigo-500/60 hover:bg-indigo-600 transition-colors z-40',
              right: 'bg-indigo-500/60 hover:bg-indigo-600 transition-colors z-40',
              topLeft: 'bg-indigo-600 border border-white rounded-full shadow-sm z-50 hover:scale-125 transition-transform',
              topRight: 'bg-indigo-600 border border-white rounded-full shadow-sm z-50 hover:scale-125 transition-transform',
              bottomLeft: 'bg-indigo-600 border border-white rounded-full shadow-sm z-50 hover:scale-125 transition-transform',
              bottomRight: 'bg-indigo-600 border border-white rounded-full shadow-md z-50 hover:scale-125 transition-transform',
            }}
            className={`absolute transition-shadow ${isCurrentImgSelected ? 'ring-1 ring-indigo-500/60 shadow-md z-30' : ''}`}
            style={{
              zIndex: pos.zIndex !== undefined ? pos.zIndex : 20,
              opacity: (isVideoMode && currentTime !== undefined && ((pos.startTime !== undefined && currentTime < pos.startTime) || (pos.endTime !== undefined && currentTime > pos.endTime))) ? 0 : (pos.opacity !== undefined ? pos.opacity : 1),
              left: pos.x + '%',
              top: pos.y + '%',
              marginLeft: `-${width / 2}px`,
              marginTop: `-${height / 2}px`,
              transform: `rotate(${rot}deg)`,
              cursor: isSelected ? 'grab' : 'default',
              borderRadius: imageBorderRadius,
              overflow: 'visible'
            }}
            onMouseDown={(e) => {
              if (e.target.closest('[class*="handle"]') || e.target.closest('.react-resizable-handle')) {
                e.stopPropagation();
                return;
              }
              if (isSelected) handleDragStart(e, index, 'image', imgId, containerRef.current, pos);
            }}
            onTouchStart={(e) => {
              if (e.target.closest('[class*="handle"]') || e.target.closest('.react-resizable-handle')) {
                e.stopPropagation();
                return;
              }
              if (isSelected) {
                selectElement('image', imgId);
                handleDragStart(e, index, 'image', imgId, containerRef.current, pos);
              }
            }}
            onClick={(e) => { e.stopPropagation(); isSelected && selectElement('image', imgId); }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onCropImage && img && !(img.startsWith('data:video') || img.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i))) {
                onCropImage(index, imgIdx, img);
              }
            }}
          >
            <div data-export-id={`img-${imgId}`} className="w-full h-full relative overflow-hidden" style={{ borderRadius: imageBorderRadius }}>
              {img && (img.startsWith('data:video') || img.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)) ? (
                <video
                  id={`video-${imgId}`}
                  ref={(el) => videoRefs.current[imgId] = el}
                  src={img}
                  muted
                  playsInline
                  className="w-full h-full object-contain pointer-events-none"
                  style={{ borderRadius: imageBorderRadius }}
                  onLoadedMetadata={(e) => {
                    if (pos.endTime === undefined && transform.setImagePositions) {
                      const dur = e.target.duration;
                      if (dur && !isNaN(dur) && dur > 0) {
                        transform.setImagePositions(prev => ({
                          ...prev,
                          [imgId]: {
                            ...(prev[imgId] || { x: 50, y: 70 }),
                            endTime: (pos.startTime || 0) + dur,
                            trimEnd: dur
                          }
                        }));
                      }
                    }
                  }}
                />
              ) : (
                <div 
                  className="w-full h-full pointer-events-none" 
                  style={{ 
                    backgroundImage: `url(${img})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center', 
                    backgroundRepeat: 'no-repeat', 
                    borderRadius: imageBorderRadius 
                  }} 
                />
              )}
            </div>

            {isCurrentImgSelected && (
              <>
                {/* Rotate Handle */}
                <div className="absolute -top-3 -left-3 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-indigo-500 flex items-center justify-center cursor-alias text-indigo-600 z-50 hover:scale-110 transition-transform" 
                  onMouseDown={(e) => handleTransformStart(e, index, 'rotate', 'image', imgId, containerRef.current, { x: pos.x, y: pos.y, width, height, rotation: rot })}
                  onTouchStart={(e) => handleTransformStart(e, index, 'rotate', 'image', imgId, containerRef.current, { x: pos.x, y: pos.y, width, height, rotation: rot })}>
                  <FiRefreshCw size={12}/>
                </div>
              </>
            )}
          </Resizable>
        );
      })}

      {/* Extra Elements Layer */}
      {(extraElements[index] || []).map((el) => {
        const elId = `${index}-${el.id}`;
        const isElSelected = isSelected && selectedExtraId === elId;
        const IconComp = (el.type === 'shape' || el.type === 'icon') ? SVGIcons[el.content] : null;

        return (
          <div
            key={elId}
            data-export-id={`extra-${el.id}`}
            className="absolute transition-opacity duration-300"
            style={{
              zIndex: el.zIndex || 30,
              opacity: (isVideoMode && currentTime !== undefined && ((el.startTime !== undefined && currentTime < el.startTime) || (el.endTime !== undefined && currentTime > el.endTime))) ? 0 : (el.opacity !== undefined ? el.opacity : 1),
              left: el.fullWidth ? '0px' : (el.x + '%'),
              top: el.y + '%',
              width: el.fullWidth ? '410px' : 0,
              height: 0,
              display: 'flex', alignItems: 'center', justifyContent: el.fullWidth ? 'flex-start' : 'center', overflow: 'visible'
            }}
          >
            <div
              data-element="extra"
              data-text-el={el.type === 'text' ? el.id : undefined}
              data-slide-element="true"
              className={`transition-all ${isElSelected ? 'border-[2px] border-indigo-500 ring-4 ring-indigo-500/20 bg-white/5' : ''}`}
              style={{
                transform: `rotate(${el.rotation}deg)`,
                cursor: isSelected ? 'grab' : 'default',
                width: el.type === 'text' ? 'max-content' : (el.fullWidth ? '410px' : (el.width + 'px')),
                height: el.height + 'px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              onMouseDown={(e) => isSelected && handleDragStart(e, index, 'extra', elId, containerRef.current, { x: el.x, y: el.y })}
              onTouchStart={(e) => {
                if (isSelected) {
                  selectElement('extra', elId);
                  handleDragStart(e, index, 'extra', elId, containerRef.current, { x: el.x, y: el.y });
                }
              }}
              onClick={(e) => { e.stopPropagation(); isSelected && selectElement('extra', elId); }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
            {el.type === 'text' ? (
              <div 
                data-text-inner="true"
                contentEditable={isElSelected}
                suppressContentEditableWarning={true}
                className="font-bold whitespace-nowrap outline-none px-2 leading-none"
                style={{ 
                  fontSize: (el.height * 0.8) + 'px',
                  lineHeight: 1,
                  color: el.color,
                  background: el.useGradient ? `linear-gradient(${el.gradientDir}, ${el.color}, ${el.color2}, ${el.color3})` : 'transparent',
                  WebkitBackgroundClip: el.useGradient ? 'text' : 'initial',
                  WebkitTextFillColor: el.useGradient ? 'transparent' : 'initial',
                  fontWeight: el.bold ? '900' : '500',
                  fontStyle: el.italic ? 'italic' : 'normal',
                  fontFamily: el.fontFamily || 'Arial',
                  cursor: isElSelected ? 'text' : 'default'
                }}
                onBlur={(e) => {
                  if (isElSelected && canvas.updateExtraElement) {
                    const newContent = e.target.innerText || e.target.textContent;
                    canvas.updateExtraElement(parseInt(index), el.id, { content: newContent });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                  }
                }}
                dangerouslySetInnerHTML={{ __html: el.content }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', color: el.color || '#000000', fill: el.color || '#000000' }} className="flex items-center justify-center">
                {(() => {
                  if (IconComp) {
                    return (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ 
                          color: el.useGradient ? 'inherit' : (el.color || '#000000'),
                          fill: el.useGradient ? 'inherit' : (el.color || '#000000'),
                          ...(el.type === 'icon' ? { fontSize: `${Math.min(el.width, el.height) * 0.8}px` } : {})
                        }}
                      >
                        {el.useGradient && (
                          <svg width="0" height="0" style={{ position: 'absolute' }}>
                            <defs>
                              <linearGradient id={`grad-${elId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{stopColor: el.color}} />
                                <stop offset="50%" style={{stopColor: el.color2 || el.color}} />
                                <stop offset="100%" style={{stopColor: el.color3 || el.color}} />
                              </linearGradient>
                            </defs>
                          </svg>
                        )}
                        <IconComp 
                          preserveAspectRatio={el.type === 'shape' ? 'none' : undefined}
                          style={{ 
                            width: '100%', 
                            height: '100%',
                            color: el.useGradient ? 'inherit' : (el.color || '#000000'),
                            fill: el.useGradient ? `url(#grad-${elId})` : (el.color || 'currentColor')
                          }} 
                        />
                      </div>
                    );
                  } else {
                    return (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="100%" 
                        height="100%" 
                        viewBox="0 0 24 24"
                        className="w-full h-full"
                        preserveAspectRatio="none"
                        style={{ display: 'block', color: el.color || '#000000', fill: el.color || '#000000' }}
                      >
                        {el.useGradient ? (
                          <>
                            <defs>
                              <linearGradient id={`grad-${elId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{stopColor: el.color}} />
                                <stop offset="50%" style={{stopColor: el.color2 || el.color}} />
                                <stop offset="100%" style={{stopColor: el.color3 || el.color}} />
                              </linearGradient>
                            </defs>
                            <path 
                              d={getIconPath(el.content)}
                              fill={`url(#grad-${elId})`}
                            />
                          </>
                        ) : (
                          <path 
                            d={getIconPath(el.content)}
                            fill={el.color || '#000000'}
                          />
                        )}
                      </svg>
                    );
                  }
                })()}
              </div>
            )}

            {isElSelected && (
              <>
                {/* Transform Handles */}
                <div className="absolute -top-4 -left-4 w-7 h-7 bg-white rounded-full shadow-lg border-2 border-indigo-500 flex items-center justify-center cursor-alias text-indigo-600 z-50 hover:scale-110 transition-transform" 
                  onMouseDown={(e) => handleTransformStart(e, index, 'rotate', 'extra', elId, containerRef.current, { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })}
                  onTouchStart={(e) => handleTransformStart(e, index, 'rotate', 'extra', elId, containerRef.current, { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })}><FiRefreshCw size={12}/></div>
                
                {/* Delete Handle */}
                <div className="absolute -top-4 -right-4 w-7 h-7 bg-red-50 rounded-full shadow-lg border-2 border-red-500 flex items-center justify-center cursor-pointer text-red-600 z-50 hover:scale-110 hover:bg-red-500 hover:text-white transition-all" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canvas.removeExtraElement) {
                      canvas.removeExtraElement(parseInt(index), el.id);
                    }
                  }}
                  title="Eliminar Elemento"><FiTrash2 size={12}/></div>



                <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white cursor-e-resize z-50 shadow-md"
                  onMouseDown={(e) => handleTransformStart(e, index, 'resize', 'extra', elId, containerRef.current, { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })}
                  onTouchStart={(e) => handleTransformStart(e, index, 'resize', 'extra', elId, containerRef.current, { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })}></div>

                {/* Resize Handle (Invisible Icon) */}
                <div className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-se-resize z-50 group" 
                  onMouseDown={(e) => handleTransformStart(e, index, 'resize', 'extra', elId, containerRef.current, { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })}
                  onTouchStart={(e) => handleTransformStart(e, index, 'resize', 'extra', elId, containerRef.current, { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })}>
                  <div className="w-4 h-4 bg-indigo-600 rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-125"></div>
                </div>
              </>
            )}
          </div>
        </div>
        );
      })}

      {/* Watermark Section */}
      {watermark && (
        <div className="absolute bottom-4 left-4 z-40 opacity-30 pointer-events-none">
          <div 
            className="w-12 h-12" 
            style={{ 
              backgroundImage: `url(${watermark})`, 
              backgroundSize: 'contain', 
              backgroundPosition: 'center', 
              backgroundRepeat: 'no-repeat' 
            }} 
          />
        </div>
      )}
      </div>

      {/* Left-side Vertical Contextual Properties Bar */}
      {isSelected && (selectedExtraId || selectedImageId) && (
        <ContextualBar 
          selectedId={selectedExtraId || selectedImageId}
          canvas={canvas}
          updateElement={canvas.updateExtraElement}
          removeElement={(sIdx, elId) => canvas.removeExtraElement && canvas.removeExtraElement(sIdx, elId)}
          deselectElement={selectElement}
          isImage={!!selectedImageId}
          isVideo={(() => {
            if (!selectedImageId) return false;
            const imgIdx = selectedImageId.split('-')[1];
            const img = slide?.customImages?.[imgIdx];
            return img?.startsWith('data:video') || img?.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i);
          })()}
          imagePositions={imagePositions}
          updateImage={handlers.updateImage}
          onRemoveImage={(sIdx, imgIdx) => onRemoveImage && onRemoveImage(sIdx, imgIdx)}
          onCropImage={(sIdx, imgIdx) => {
            if (onCropImage && slide?.customImages?.[imgIdx]) {
              onCropImage(sIdx, imgIdx, slide.customImages[imgIdx]);
            }
          }}
          onEditVideo={(sIdx, imgIdx) => {
            if (onEditVideo && slide?.customImages?.[imgIdx]) {
              onEditVideo(sIdx, imgIdx, slide.customImages[imgIdx]);
            }
          }}
        />
      )}

      {isSelected && (
        <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 slide-actions z-[60] flex flex-col gap-2 pointer-events-auto">
          <button onClick={(e) => { e.stopPropagation(); onPreview(index); }} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl border border-indigo-500/30 transition-all transform hover:scale-110 flex items-center justify-center cursor-pointer" title="Vista Previa"><FiMaximize2 size={15}/></button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(index); }} className="p-2.5 bg-indigo-600 text-amber-300 rounded-xl hover:bg-indigo-700 shadow-xl border border-indigo-500/30 transition-all transform hover:scale-110 flex items-center justify-center cursor-pointer" title="Editar Contenido"><FiEdit3 size={15}/></button>
          <label className="p-2.5 bg-indigo-600 text-emerald-300 rounded-xl hover:bg-indigo-700 shadow-xl border border-indigo-500/30 cursor-pointer transition-all transform hover:scale-110 flex items-center justify-center" title="Insertar Multimedia">
            <FiPlusCircle size={15} />
            <input type="file" className="hidden" accept="image/*,video/*" onChange={onAddImage} />
          </label>
          <button onClick={(e) => { e.stopPropagation(); onCopy(index); }} className="p-2.5 bg-indigo-600 text-indigo-100 rounded-xl hover:bg-indigo-700 shadow-xl border border-indigo-500/30 transition-all transform hover:scale-110 flex items-center justify-center cursor-pointer" title="Duplicar Diapositiva"><FiCopy size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="p-2.5 bg-indigo-600 text-red-300 hover:bg-red-600 hover:text-white rounded-xl shadow-xl border border-indigo-500/30 transition-all transform hover:scale-110 flex items-center justify-center cursor-pointer" title="Eliminar"><FiTrash2 size={15} /></button>
        </div>
      )}
    </div>
  );
};


