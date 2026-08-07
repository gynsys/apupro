import { useState, useCallback, useRef } from 'react';

export const useDragTransform = (onUpdateElement, scale = 1, globalSetters = {}) => {
  const [imagePositions, setImagePositions] = useState({});
  const [imageSizes, setImageSizes] = useState({});
  const [imageRotations, setImageRotations] = useState({});
  const [contentPositions, setContentPositions] = useState({});
  const [contentSizes, setContentSizes] = useState({});
  const [contentRotations, setContentRotations] = useState({});
  const [extraElements, setExtraElements] = useState({});

  const state = {
    imagePositions, imageSizes, imageRotations,
    contentPositions, contentSizes, contentRotations,
    extraElements,
    setImagePositions
  };

  const draggingRef = useRef(null);
  const rafRef = useRef(null);

  const handleDragStart = (e, index, type, id, container, initialPos) => {
    const isEditable = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
    
    // Si estamos editando texto, NO iniciar el drag
    if (isEditable) return;

    if (!e.touches) e.preventDefault();
    e.stopPropagation();
    
    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const startX = clientX;
    const startY = clientY;
    const rect = container.getBoundingClientRect();

    draggingRef.current = {
      type, id, index,
      startX, startY,
      initialX: initialPos.x,
      initialY: initialPos.y,
      rect
    };

    const handleMouseMove = (moveEvent) => {
      // Prevent scrolling during drag
      if (moveEvent.cancelable) moveEvent.preventDefault();
      
      if (!draggingRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const { type, id, index, startX, startY, initialX, initialY, rect } = draggingRef.current;
        
        // Handle both mouse and touch events
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
        
        const dx = (clientX - startX) / scale;
        const dy = (clientY - startY) / scale;

        const newX = initialX + (dx / rect.width) * 100 * scale;
        const newY = initialY + (dy / rect.height) * 100 * scale;

        if (type === 'image') {
          setImagePositions(prev => ({ ...prev, [id]: { ...(prev[id] || {}), x: newX, y: newY } }));
        } else if (type === 'content') {
          setContentPositions(prev => ({ ...prev, [index]: { x: newX, y: newY } }));
        } else if (type === 'logo') {
          globalSetters.setLogoPos({ x: newX, y: newY });
        } else if (type === 'doctorName') {
          globalSetters.setDoctorNamePos({ x: newX, y: newY });
        } else if (type === 'divider') {
          globalSetters.setDividerPos({ x: newX, y: newY });
        } else if (type === 'extra') {
          const [sIdx, elId] = id.split('-');
          onUpdateElement(parseInt(sIdx), elId, { x: newX, y: newY });
        }
      });
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp, { passive: false });
  };

  const handleTransformStart = (e, index, action, type, id, container, initialData) => {
    // Only prevent default on mouse events at the start
    if (!e.touches) e.preventDefault();
    e.stopPropagation();

    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const startX = clientX;
    const startY = clientY;
    const rect = container.getBoundingClientRect();

    const transformData = {
      action, type, id, index,
      startX, startY,
      ...initialData,
      rect
    };

    const handleMouseMove = (moveEvent) => {
      // Prevent scrolling during transform
      if (moveEvent.cancelable) moveEvent.preventDefault();

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        // Handle both mouse and touch events
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
        
        const dx = (clientX - startX) / scale;
        const dy = (clientY - startY) / scale;

        if (action === 'rotate') {
          const centerX = rect.left + (transformData.x / 100) * rect.width;
          const centerY = rect.top + (transformData.y / 100) * rect.height;
          
          // Handle both mouse and touch events for rotation
          const moveClientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
          const moveClientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
          
          const angle = Math.atan2(moveClientY - centerY, moveClientX - centerX) * (180 / Math.PI);
          const newRotation = angle + 90;

          if (type === 'image') setImageRotations(prev => ({ ...prev, [id]: newRotation }));
          else if (type === 'content') setContentRotations(prev => ({ ...prev, [index]: newRotation }));
          else if (type === 'extra') {
            const [sIdx, elId] = id.split('-');
            onUpdateElement(parseInt(sIdx), elId, { rotation: newRotation });
          }
        } else if (action === 'resize' || action === 'resize-w' || action === 'resize-h') {
          const newWidth = Math.min(600, Math.max(20, transformData.width + dx * 2));
          const newHeight = Math.min(600, Math.max(20, transformData.height + dy * 2));

          if (type === 'image') setImageSizes(prev => ({ ...prev, [id]: newWidth }));
          else if (type === 'content') setContentSizes(prev => ({ ...prev, [index]: newWidth }));
          else if (type === 'extra') {
            const [sIdx, elId] = id.split('-');
            const updates = { fullWidth: false };
            if (action === 'resize' || action === 'resize-w') updates.width = newWidth;
            if (action === 'resize' || action === 'resize-h') updates.height = newHeight;
            onUpdateElement(parseInt(sIdx), elId, updates);
          }
        }
      });
    };

    const handleMouseUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp, { passive: false });
  };

  return {
    state,
    handlers: {
      handleDragStart,
      handleTransformStart,
      updateImage: (id, updates) => setImagePositions(prev => ({ ...prev, [id]: { ...(prev[id] || { x: 50, y: 70 }), ...updates } })),
      updateImageSize: (id, size) => setImageSizes(prev => ({ ...prev, [id]: size })),
      updateImageRotation: (id, rot) => setImageRotations(prev => ({ ...prev, [id]: rot }))
    },
    loadState: (newState) => {
      setImagePositions(newState.imagePositions || {});
      setImageSizes(newState.imageSizes || {});
      setImageRotations(newState.imageRotations || {});
      setContentPositions(newState.contentPositions || {});
      setContentSizes(newState.contentSizes || {});
      setContentRotations(newState.contentRotations || {});
      setExtraElements(newState.extraElements || {});
    }
  };
};

