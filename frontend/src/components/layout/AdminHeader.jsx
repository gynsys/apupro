import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdDashboard, MdLogout, MdHome, MdMenu } from 'react-icons/md';

export const AdminHeader = ({ showDashboardButton = true, onMenuClick, doctor, isDarkTheme }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Name */}
          <div className="flex items-center gap-4">
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset transition-all"
              >
                <MdMenu className="h-6 w-6" />
              </button>
            )}
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => navigate('/admin')}
            >
              <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-lg bg-indigo-100 text-indigo-600">
                A
              </div>
              <div className="hidden md:block">
                <h1 className="text-xl font-sans font-semibold px-3 py-1 rounded-xl text-gray-900">
                  Arko 360
                </h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5 ml-3">
                  Ingeniería y Construcción
                </p>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <MdHome className="text-lg" />
              <span className="hidden md:inline">Inicio</span>
            </button>
            {showDashboardButton && (
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium flex items-center gap-2 transition-colors"
                title="Panel Principal"
              >
                <MdDashboard className="text-lg" />
                <span className="hidden md:inline">Panel Principal</span>
              </button>
            )}

            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
            <button
              onClick={handleLogout}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium flex items-center gap-2 transition-colors"
              title="Cerrar Sesión"
            >
              <MdLogout className="text-lg" />
              <span className="hidden md:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
