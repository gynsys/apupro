import { useState, useMemo, useCallback } from 'react';

/**
 * Hook para gestionar filtros y ordenamiento estilo Excel en la tabla de presupuesto.
 * Opera 100% en el cliente sobre los datos en memoria para respuesta instantánea (0 ms).
 * 
 * @param {Array} items - Listado completo de partidas y capítulos del presupuesto
 * @param {Function} calculatePU - Función para calcular el precio unitario del item
 * @returns {Object} Estado y manipuladores de filtros y ordenamiento
 */
export function useBudgetTableFilters(items = [], calculatePU = () => 0) {
  // Estado de ordenación: { column: string, direction: 'asc' | 'desc' } | null
  const [sortState, setSortState] = useState(null);

  // Estado de filtros individuales por columna
  const [filters, setFilters] = useState({
    code: '', // Búsqueda de texto en código (cod_par / cov_par)
    description: '', // Búsqueda de texto en descripción
    unit: new Set(), // Set de unidades seleccionadas (vacío = todas)
    quantity: 'all', // 'all' | 'zero' | 'non_zero'
    status: 'all', // 'all' | 'pending' | 'completed'
  });

  // Columna cuyo menú de filtro Excel está actualmente abierto
  const [openDropdown, setOpenDropdown] = useState(null);

  // 1. Estadísticas de Unidades Únicas y conteo
  const unitStats = useMemo(() => {
    const counts = {};
    (items || []).forEach(it => {
      if (!it.is_chapter && it.unit) {
        const u = it.unit.trim();
        counts[u] = (counts[u] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => a.unit.localeCompare(b.unit));
  }, [items]);

  // 2. Estadísticas de Estado Pendiente vs Completado
  const statusStats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    (items || []).forEach(it => {
      if (!it.is_chapter) {
        if (it.is_pending) pending++;
        else completed++;
      }
    });
    return { pending, completed, total: pending + completed };
  }, [items]);

  // 3. Estadísticas de Cantidades (Cero vs Mayor a cero)
  const quantityStats = useMemo(() => {
    let zero = 0;
    let nonZero = 0;
    (items || []).forEach(it => {
      if (!it.is_chapter) {
        const q = parseFloat(it.quantity) || 0;
        if (q === 0) zero++;
        else nonZero++;
      }
    });
    return { zero, nonZero, total: zero + nonZero };
  }, [items]);

  // Verificar si una columna específica tiene filtro activo
  const isColFiltered = useCallback((col) => {
    if (col === 'cod_par') return Boolean(filters.code.trim());
    if (col === 'description') return Boolean(filters.description.trim());
    if (col === 'unit') return filters.unit.size > 0;
    if (col === 'quantity') return filters.quantity !== 'all';
    if (col === 'status') return filters.status !== 'all';
    return false;
  }, [filters]);

  // Verificar si hay algún filtro activo
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(filters.code.trim()) ||
      Boolean(filters.description.trim()) ||
      filters.unit.size > 0 ||
      filters.quantity !== 'all' ||
      filters.status !== 'all'
    );
  }, [filters]);

  const hasActiveSort = sortState !== null;
  const hasActiveFiltersOrSort = hasActiveFilters || hasActiveSort;

  // Setters de filtros
  const setCodeFilter = useCallback((val) => {
    setFilters(prev => ({ ...prev, code: val }));
  }, []);

  const setDescriptionFilter = useCallback((val) => {
    setFilters(prev => ({ ...prev, description: val }));
  }, []);

  const toggleUnitFilter = useCallback((unit) => {
    setFilters(prev => {
      const next = new Set(prev.unit);
      if (next.has(unit)) {
        next.delete(unit);
      } else {
        next.add(unit);
      }
      return { ...prev, unit: next };
    });
  }, []);

  const selectAllUnits = useCallback(() => {
    setFilters(prev => ({ ...prev, unit: new Set() }));
  }, []);

  const setQuantityFilter = useCallback((val) => {
    setFilters(prev => ({ ...prev, quantity: val }));
  }, []);

  const setStatusFilter = useCallback((val) => {
    setFilters(prev => ({ ...prev, status: val }));
  }, []);

  const clearColFilter = useCallback((col) => {
    setFilters(prev => {
      if (col === 'cod_par') return { ...prev, code: '' };
      if (col === 'description') return { ...prev, description: '' };
      if (col === 'unit') return { ...prev, unit: new Set() };
      if (col === 'quantity') return { ...prev, quantity: 'all' };
      if (col === 'status') return { ...prev, status: 'all' };
      return prev;
    });
  }, []);

  const clearAllFiltersAndSort = useCallback(() => {
    setFilters({
      code: '',
      description: '',
      unit: new Set(),
      quantity: 'all',
      status: 'all',
    });
    setSortState(null);
    setOpenDropdown(null);
  }, []);

  const handleSort = useCallback((column, direction) => {
    setSortState({ column, direction });
  }, []);

  const clearSort = useCallback(() => {
    setSortState(null);
  }, []);

  // Predicado para determinar si una partida cumple con los filtros activos
  const matchesFilter = useCallback((item) => {
    if (item.is_chapter) return false;

    // Filtro por Código
    if (filters.code.trim()) {
      const q = filters.code.toLowerCase().trim();
      const codeStr = `${item.cov_par || ''} ${item.cod_par || ''}`.toLowerCase();
      if (!codeStr.includes(q)) return false;
    }

    // Filtro por Descripción
    if (filters.description.trim()) {
      const q = filters.description.toLowerCase().trim();
      const descStr = (item.description || '').toLowerCase();
      if (!descStr.includes(q)) return false;
    }

    // Filtro por Unidad
    if (filters.unit.size > 0) {
      const u = (item.unit || '').trim();
      if (!filters.unit.has(u)) return false;
    }

    // Filtro por Cantidad
    if (filters.quantity === 'zero') {
      const q = parseFloat(item.quantity) || 0;
      if (q !== 0) return false;
    } else if (filters.quantity === 'non_zero') {
      const q = parseFloat(item.quantity) || 0;
      if (q <= 0) return false;
    }

    // Filtro por Estado (Pendientes / Completadas)
    if (filters.status === 'pending') {
      if (!item.is_pending) return false;
    } else if (filters.status === 'completed') {
      if (item.is_pending) return false;
    }

    return true;
  }, [filters]);

  // Generar lista de partidas/capítulos filtrados y ordenados
  const displayItems = useMemo(() => {
    if (!hasActiveFiltersOrSort) {
      return items || [];
    }

    // Si hay ordenamiento personalizado por columna:
    if (hasActiveSort) {
      const matched = (items || []).filter(matchesFilter);

      matched.sort((a, b) => {
        let valA, valB;
        if (sortState.column === 'number') {
          valA = a.order ?? 0;
          valB = b.order ?? 0;
        } else if (sortState.column === 'cod_par') {
          valA = (a.cov_par || a.cod_par || '').toLowerCase();
          valB = (b.cov_par || b.cod_par || '').toLowerCase();
          return sortState.direction === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else if (sortState.column === 'description') {
          valA = (a.description || '').toLowerCase();
          valB = (b.description || '').toLowerCase();
          return sortState.direction === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else if (sortState.column === 'unit') {
          valA = (a.unit || '').toLowerCase();
          valB = (b.unit || '').toLowerCase();
          return sortState.direction === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else if (sortState.column === 'quantity') {
          valA = parseFloat(a.quantity) || 0;
          valB = parseFloat(b.quantity) || 0;
        } else if (sortState.column === 'pu') {
          valA = calculatePU(a);
          valB = calculatePU(b);
        } else if (sortState.column === 'total') {
          valA = calculatePU(a) * (parseFloat(a.quantity) || 0);
          valB = calculatePU(b) * (parseFloat(b.quantity) || 0);
        } else {
          return 0;
        }

        return sortState.direction === 'asc' ? valA - valB : valB - valA;
      });

      return matched;
    }

    // Solo filtros activos (sin orden personalizado): Preservar capítulos que tengan partidas coincidentes
    const result = [];
    let currentChapter = null;
    let currentChapterHasItems = false;
    let pendingChapterItems = [];

    for (const it of (items || [])) {
      if (it.is_chapter) {
        if (currentChapter && currentChapterHasItems) {
          result.push(currentChapter);
          result.push(...pendingChapterItems);
        }
        currentChapter = it;
        currentChapterHasItems = false;
        pendingChapterItems = [];
      } else {
        if (matchesFilter(it)) {
          currentChapterHasItems = true;
          pendingChapterItems.push(it);
        }
      }
    }

    if (currentChapter && currentChapterHasItems) {
      result.push(currentChapter);
      result.push(...pendingChapterItems);
    } else if (!currentChapter && pendingChapterItems.length > 0) {
      result.push(...pendingChapterItems);
    }

    return result;
  }, [items, hasActiveFiltersOrSort, hasActiveSort, sortState, matchesFilter, calculatePU]);

  // Conteos
  const filteredNonChapterCount = useMemo(() => {
    return displayItems.filter(it => !it.is_chapter).length;
  }, [displayItems]);

  const totalNonChapterCount = useMemo(() => {
    return (items || []).filter(it => !it.is_chapter).length;
  }, [items]);

  return {
    sortState,
    filters,
    openDropdown,
    setOpenDropdown,
    unitStats,
    statusStats,
    quantityStats,
    isColFiltered,
    hasActiveFilters,
    hasActiveSort,
    hasActiveFiltersOrSort,
    setCodeFilter,
    setDescriptionFilter,
    toggleUnitFilter,
    selectAllUnits,
    setQuantityFilter,
    setStatusFilter,
    clearColFilter,
    clearAllFiltersAndSort,
    handleSort,
    clearSort,
    displayItems,
    filteredNonChapterCount,
    totalNonChapterCount,
  };
}
