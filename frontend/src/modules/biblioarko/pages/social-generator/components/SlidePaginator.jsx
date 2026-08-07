
import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export const SlidePaginator = ({ current, total, onChange }) => {
  if (total <= 0) return null;

  return (
    <div className="flex items-center gap-6 bg-white dark:bg-gray-800 px-8 py-0 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
      <button 
        onClick={() => onChange(Math.max(0, current - 1))}
        disabled={current === 0}
        className="p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-all"
      >
        <FiChevronLeft size={24}/>
      </button>
      <div className="flex flex-col items-center">
        <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Diapositiva</span>
        <span className="text-xl font-black text-indigo-600">
          {current + 1} <span className="text-gray-300 mx-1">/</span> {total}
        </span>
      </div>
      <button 
        onClick={() => onChange(Math.min(total - 1, current + 1))}
        disabled={current === total - 1}
        className="p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-all"
      >
        <FiChevronRight size={24}/>
      </button>
    </div>
  );
};


