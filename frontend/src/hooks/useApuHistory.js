import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Historial de comandos reversibles para el editor de APU.
 * No guarda snapshots: cada comando ejecuta su propia operación inversa
 * contra la API, de modo que el guardado instantáneo se mantiene.
 */
export default function useApuHistory(resetKey) {
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const applyingRef = useRef(false);
  const [snapshot, setSnapshot] = useState({ canUndo: false, canRedo: false, busy: false });

  const sync = useCallback((busy = false) => {
    setSnapshot({
      canUndo: undoRef.current.length > 0,
      canRedo: redoRef.current.length > 0,
      busy,
    });
  }, []);

  const push = useCallback((command) => {
    if (!command || typeof command.undo !== 'function' || typeof command.redo !== 'function') return;
    undoRef.current.push(command);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    sync(false);
  }, [sync]);

  const clear = useCallback(() => {
    undoRef.current = [];
    redoRef.current = [];
    applyingRef.current = false;
    sync(false);
  }, [sync]);

  useEffect(() => {
    clear();
  }, [resetKey, clear]);

  const undo = useCallback(async () => {
    const command = undoRef.current[undoRef.current.length - 1];
    if (!command || applyingRef.current) return false;
    applyingRef.current = true;
    sync(true);
    try {
      await command.undo();
      undoRef.current.pop();
      redoRef.current.push(command);
      return true;
    } finally {
      applyingRef.current = false;
      sync(false);
    }
  }, [sync]);

  const redo = useCallback(async () => {
    const command = redoRef.current[redoRef.current.length - 1];
    if (!command || applyingRef.current) return false;
    applyingRef.current = true;
    sync(true);
    try {
      await command.redo();
      redoRef.current.pop();
      undoRef.current.push(command);
      return true;
    } finally {
      applyingRef.current = false;
      sync(false);
    }
  }, [sync]);

  return {
    push,
    undo,
    redo,
    clear,
    applyingRef,
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    busy: snapshot.busy,
  };
}
