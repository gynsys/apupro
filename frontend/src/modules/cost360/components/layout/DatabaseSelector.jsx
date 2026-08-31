import React, { useState, useEffect } from 'react';
import { cost360DatabaseService } from '../../../../services/cost360DatabaseService';

const DatabaseSelector = ({ value, onChange }) => {
  const [databases, setDatabases] = useState([]);

  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const dbs = await cost360DatabaseService.getAll();
        const loadedDbs = dbs.databases || [];
        if (!loadedDbs.find(db => db.id === 'personalizada')) {
          loadedDbs.push({ id: 'personalizada', name: 'Base Personalizada', is_master: false });
        }
        setDatabases(loadedDbs);
      } catch (error) {
        console.error("Error al cargar bases de datos:", error);
      }
    };
    loadDatabases();
  }, []);

  return (
    <div className="px-4 flex justify-end">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border-2 border-slate-300 text-slate-700 text-sm font-medium rounded-lg px-4 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm transition-all w-48 appearance-none"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
          paddingRight: '2.5rem',
        }}
      >
        <option value="master">Base Maestra</option>
        <option value="personalizada">Base Personalizada</option>
        <option value="provisional">Base Provisional</option>
        {databases.filter(db => db.id !== 'master' && db.is_master !== true).map(db => (
          <option key={db.id} value={db.id}>{db.name}</option>
        ))}
      </select>
    </div>
  );
};

export default DatabaseSelector;
