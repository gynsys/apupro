import { useState, useRef, useEffect, useCallback } from 'react';
import cost360Service from '../services/cost360Service';

export const useCost360Search = ({
  databaseId = 'master',
  onlyCoded = null,
  limit = 50,
  autoSearch = true,
  debounceMs = 400
} = {}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCovenin, setSearchCovenin] = useState('');
  const [searchDesc, setSearchDesc] = useState(true);
  const [searchInsumos, setSearchInsumos] = useState(false);
  
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSkip, setSearchSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  const searchTimeoutRef = useRef(null);

  const fetchResults = useCallback(async (currentSkip = 0, append = false) => {
    try {
      setIsSearching(true);
      const response = await cost360Service.fetchItems(
        currentSkip,
        limit,
        searchQuery ? searchQuery.trim() : '',
        '', // chapter (obsoleto)
        databaseId,
        searchDesc,
        searchInsumos,
        searchCovenin,
        onlyCoded
      );
      
      const newItems = response.items || [];
      const total = response.total || 0;
      
      if (append) {
        setResults(prev => [...prev, ...newItems]);
      } else {
        setResults(newItems);
      }
      
      setTotalResults(total);
      setSearchSkip(currentSkip + limit);
      setHasMore(newItems.length === limit && (currentSkip + limit) < total);
    } catch (error) {
      console.error('Error fetching Cost360 items:', error);
      throw error; // Re-lanzar para que el componente maneje toasts si quiere
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchDesc, searchInsumos, searchCovenin, databaseId, onlyCoded, limit]);

  useEffect(() => {
    if (autoSearch) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        // Encerramos en un try catch para evitar errores no controlados si el frontend no los captura
        fetchResults(0, false).catch(e => console.error(e));
      }, debounceMs);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    }
  }, [fetchResults, autoSearch, debounceMs]);

  const loadMore = () => {
    if (!isSearching && hasMore) {
      fetchResults(searchSkip, true).catch(e => console.error(e));
    }
  };

  const forceSearch = () => fetchResults(0, false).catch(e => console.error(e));

  return {
    searchQuery, setSearchQuery,
    searchCovenin, setSearchCovenin,
    searchDesc, setSearchDesc,
    searchInsumos, setSearchInsumos,
    results, setResults,
    totalResults,
    isSearching,
    hasMore,
    loadMore,
    forceSearch
  };
};
