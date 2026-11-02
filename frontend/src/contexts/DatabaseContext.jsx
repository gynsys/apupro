import React, { createContext, useContext, useState, useEffect } from 'react';
import { costbaseDatabaseService } from '../services/costbaseDatabaseService';

const DatabaseContext = createContext(null);

// Default databases fallback
const DEFAULT_DATABASES = [
  { id: 'master', name: 'Base Maestra', description: 'Base de datos oficial de CostBase', is_master: true, is_active: true },
  { id: 'personalizada', name: 'Base Personalizada', description: 'Partidas y APUs creados por el usuario', is_master: false, is_active: true }
];

export const DatabaseProvider = ({ children }) => {
  const [activeDatabase, setActiveDatabase] = useState(DEFAULT_DATABASES[0]);
  const [databases, setDatabases] = useState(DEFAULT_DATABASES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    try {
      const data = await costbaseDatabaseService.getAll();
      let dbList = data.databases || [];
      
      // Ensure master database is always included
      const hasMaster = dbList.some(db => db.id === 'master' || db.is_master);
      if (!hasMaster) {
        dbList = [DEFAULT_DATABASES[0], ...dbList];
      }

      // Ensure personalizada database is always included
      const hasPersonalizada = dbList.some(db => db.id === 'personalizada');
      if (!hasPersonalizada) {
        dbList.push(DEFAULT_DATABASES[1]);
      }

      // Ensure master is always first, then personalizada, then others
      const masterDbs = dbList.filter(db => db.id === 'master' || db.is_master);
      const personalDbs = dbList.filter(db => db.id === 'personalizada');
      const otherDbs = dbList.filter(db => db.id !== 'master' && !db.is_master && db.id !== 'personalizada');
      const sortedDatabases = [...masterDbs, ...personalDbs, ...otherDbs];
      
      if (sortedDatabases.length > 0) {
        setDatabases(sortedDatabases);
        setActiveDatabase(prev => {
          if (prev && sortedDatabases.some(d => d.id === prev.id)) {
            return sortedDatabases.find(d => d.id === prev.id);
          }
          return sortedDatabases[0];
        });
      } else {
        // If no databases returned, use default
        setDatabases(DEFAULT_DATABASES);
        setActiveDatabase(DEFAULT_DATABASES[0]);
      }
    } catch (error) {
      console.error('Error loading databases:', error);
      // Keep default databases on error
      setDatabases(DEFAULT_DATABASES);
      setActiveDatabase(DEFAULT_DATABASES[0]);
    } finally {
      setLoading(false);
    }
  };

  const refreshDatabases = () => {
    loadDatabases();
  };

  const value = {
    activeDatabase,
    setActiveDatabase,
    databases,
    loading,
    refreshDatabases,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

// Alias for consistency
export const useDatabaseContext = useDatabase;
