import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { budgetService } from '../services/budgetService';
import { getCatalogConfig } from '../utils/componentCatalogConfig';
import { useDatabaseContext } from '../contexts/DatabaseContext';

const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 560;
const MAX_RESULTS = 8;
const PANEL_MAX_HEIGHT = 320;

const moneyFormat = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Autocompletado inline para materiales, equipos y mano de obra.
 * Busca en el catálogo de la base activa y muestra un panel flotante
 * anclado debajo del input (portal para evitar el clipping de la tabla).
 */
export default function CatalogAutocomplete({
  type,
  value,
  onChange,
  onBlur,
  onSelect,
  placeholder,
  inputClassName,
  autoFocus = false,
  openOnFocus = true,
  disabled = false,
}) {
  const config = getCatalogConfig(type);
  const { activeDatabase } = useDatabaseContext();
  const databaseId = activeDatabase?.id || 'master';
  const listboxId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: MIN_PANEL_WIDTH });

  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());
  const blurTimerRef = useRef(null);
  const selectedRef = useRef(false);
  const selectResetTimerRef = useRef(null);
  const optionRefs = useRef([]);

  const fetchResults = useCallback(async (search) => {
    const cacheKey = `${type}|${databaseId}|${search}`;
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey));
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const data = await budgetService.searchComponents(
        type,
        search,
        databaseId,
        MAX_RESULTS,
        controller.signal,
      );
      const items = Array.isArray(data) ? data : (data.items || []);
      const limited = items.slice(0, MAX_RESULTS);
      cacheRef.current.set(cacheKey, limited);
      setResults(limited);
      setActiveIndex(-1);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(`Error searching ${type}:`, err);
      setError('No se pudo buscar en el catálogo.');
      setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [type, databaseId]);

  // Búsqueda con debounce. Con el input vacío muestra los primeros del catálogo.
  useEffect(() => {
    if (!isOpen) return undefined;
    const trimmed = (value || '').trim();

    if (trimmed.length === 1) {
      setResults([]);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return undefined;
    }

    const timer = setTimeout(() => fetchResults(trimmed), trimmed ? 250 : 0);
    return () => clearTimeout(timer);
  }, [value, isOpen, fetchResults]);

  // Posición del panel flotante.
  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(
        Math.max(rect.width, MIN_PANEL_WIDTH),
        Math.min(MAX_PANEL_WIDTH, window.innerWidth - 16),
      );
      const openUp = window.innerHeight - rect.bottom < 280;
      setPanelStyle({
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight: openUp ? Math.max(120, Math.min(PANEL_MAX_HEIGHT, rect.top - 16)) : PANEL_MAX_HEIGHT,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Cierre al hacer clic fuera.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (inputRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Scroll de la opción activa.
  useEffect(() => {
    if (activeIndex >= 0 && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (selectResetTimerRef.current) clearTimeout(selectResetTimerRef.current);
  }, []);

  useEffect(() => {
    if (!autoFocus) return undefined;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      setIsOpen(true);
    }, 40);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const handleSelect = (rawItem) => {
    const mapped = config.mapItem(rawItem);
    selectedRef.current = true;
    if (selectResetTimerRef.current) clearTimeout(selectResetTimerRef.current);
    selectResetTimerRef.current = setTimeout(() => {
      selectedRef.current = false;
    }, 300);
    setIsOpen(false);
    setResults([]);
    setActiveIndex(-1);
    onSelect?.(mapped);
    onChange?.(mapped.descripcion || '');
  };

  const handleFocus = () => {
    if (disabled || !openOnFocus) return;
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      if (selectedRef.current) return;
      setIsOpen(false);
      onBlur?.(value);
    }, 160);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (results.length === 0) return;
      setActiveIndex((previous) => Math.min(previous + 1, results.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => Math.max(previous - 1, 0));
      return;
    }

    if (event.key === 'Enter' && isOpen) {
      const choice = results[activeIndex >= 0 ? activeIndex : 0];
      if (choice) {
        event.preventDefault();
        handleSelect(choice);
      }
    }
  };

  const trimmedValue = (value || '').trim();
  const showHint = trimmedValue.length === 1;
  const showEmpty = !loading && !error && results.length === 0 && !showHint && isOpen;

  const panel = isOpen ? createPortal(
    <div
      ref={panelRef}
      id={listboxId}
      role="listbox"
      aria-label={`Resultados de ${config.plural}`}
      style={{
        position: 'fixed',
        top: panelStyle.top,
        bottom: panelStyle.bottom,
        left: panelStyle.left,
        width: panelStyle.width,
        maxHeight: panelStyle.maxHeight,
        zIndex: 9999,
      }}
      className="overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      {loading && (
        <div className="flex items-center gap-2 px-3 py-3 text-xs font-semibold text-slate-500">
          <Loader2 size={14} className={`animate-spin ${config.theme.spinner}`} />
          Buscando en {config.plural}...
        </div>
      )}

      {!loading && error && (
        <div className="px-3 py-3 text-xs font-semibold text-red-600">{error}</div>
      )}

      {!loading && !error && showHint && (
        <div className="px-3 py-3 text-xs text-slate-500">Escribe al menos 2 caracteres para buscar.</div>
      )}

      {!loading && !error && showEmpty && (
        <div className="px-3 py-3 text-xs text-slate-500">
          Sin coincidencias. Usa la lupita para la búsqueda avanzada.
        </div>
      )}

      {!loading && !error && results.map((rawItem, index) => {
        const mapped = config.mapItem(rawItem);
        const price = mapped.precio_unitario ?? mapped.jornal ?? 0;
        const isActive = index === activeIndex;
        return (
          <button
            key={`${mapped.codigo}-${index}`}
            id={`${listboxId}-option-${index}`}
            ref={(element) => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleSelect(rawItem)}
            className={`flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 transition-colors ${
              isActive ? 'bg-slate-100' : config.theme.rowHover
            }`}
          >
            <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${config.theme.codeTag}`}>
              {mapped.codigo || 'S/C'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {mapped.descripcion || 'Sin descripción'}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                {mapped.unidad || 'und'} · ${moneyFormat.format(price)}
              </span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={(event) => {
          onChange?.(event.target.value);
          setIsOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || config.placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        className={inputClassName || 'w-full bg-transparent px-1 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500'}
      />
      {panel}
    </div>
  );
}
