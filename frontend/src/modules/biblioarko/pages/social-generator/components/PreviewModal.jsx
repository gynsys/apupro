
import React from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

export const PreviewModal = ({ isOpen, currentIndex, total, slides, renderSlide, onClose, onNavigate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-gray-100/95 dark:bg-black/95 backdrop-blur-md">
      {/* Slide Content */}
      <div className={`flex items-center justify-center transition-all duration-300 transform scale-[0.7] sm:scale-[0.8] md:scale-90 lg:scale-100 z-[105]`}>
        {renderSlide(slides[currentIndex], currentIndex, true)}
      </div>

      {/* Bottom Navigation Bar */}
      {total > 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-full shadow-xl border border-gray-200 dark:border-gray-700 px-2 py-1.5">
          <button 
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className={`p-2 rounded-full transition-all ${currentIndex === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 active:scale-90'}`}
          >
            <FiChevronLeft size={18} />
          </button>
          <span className="text-xs font-black text-gray-500 dark:text-gray-400 min-w-[40px] text-center">
            {currentIndex + 1} / {total}
          </span>
          <button 
            onClick={() => onNavigate(currentIndex + 1)}
            disabled={currentIndex >= total - 1}
            className={`p-2 rounded-full transition-all ${currentIndex >= total - 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 active:scale-90'}`}
          >
            <FiChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Close Button */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 text-gray-600 dark:text-white p-2.5 bg-gray-200/80 dark:bg-white/10 rounded-full hover:bg-red-500 hover:text-white transition-all z-[110] shadow-lg"
      >
        <FiX size={22} />
      </button>
    </div>
  );
};


