import React, { useRef, useEffect } from 'react';
import coveninTreeData from '../data/covenin_tree.json';

const CategoryManager = ({ config, onToggleCategory }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span>Visibilidad de Capítulos</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && coveninTreeData && (
        <div className="absolute top-full right-0 mt-1 w-[400px] z-[100] bg-white border border-slate-200 rounded-xl shadow-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {coveninTreeData.map(cat => {
            const hiddenCategories = config?.hiddenCategories || [];
            const isVisible = !hiddenCategories.includes(cat.code);
            return (
              <div key={cat.code} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${isVisible ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-100 opacity-60 hover:opacity-100'}`}>
                <input
                  type="checkbox"
                  id={`cat_${cat.code}`}
                  checked={isVisible}
                  onChange={(e) => onToggleCategory(cat.code, e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor={`cat_${cat.code}`} className="text-xs font-bold text-slate-700 cursor-pointer select-none leading-tight" title={cat.name}>
                  {cat.code} <span className="font-normal block truncate w-full max-w-[80px]" title={cat.name}>{cat.name}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
