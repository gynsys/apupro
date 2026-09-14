import React from 'react';
import { useDatabaseContext } from '../../../../contexts/DatabaseContext';

const DatabaseSelector = ({ value, onChange }) => {
  const { databases, loading } = useDatabaseContext();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="bg-white border-2 border-slate-300 text-slate-700 text-sm font-medium rounded-lg px-4 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm transition-all w-48 appearance-none"
      style={{
        backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1.5em 1.5em',
        paddingRight: '2.5rem',
      }}
    >
      {loading ? (
        <option value={value}>Cargando...</option>
      ) : (
        databases.map(db => (
          <option key={db.id} value={db.id}>
            {db.name} {db.is_master && db.id !== 'master' ? '(Maestra)' : ''}
          </option>
        ))
      )}
    </select>
  );
};

export default DatabaseSelector;
