import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../services/api';

export default function NotificationBell() {
  const { token, isAuthenticated } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const fetchIdRef = useRef(0);
  const intervalRef = useRef(null);

  // Función para obtener notificaciones con manejo de concurrencia
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const storedToken = token || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch(`${API_URL}/notifications/`, {
        headers,
        credentials: 'include'
      });
      if (res.ok && currentFetchId === fetchIdRef.current) {
        const data = await res.json();
        // Ordenar por fecha descendente (más recientes primero)
        const sortedData = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setNotifications(sortedData);
        setUnreadCount(sortedData.filter(n => !n.is_read).length);
      } else if (!res.ok) {
        console.error('Error fetching notifications:', res.status);
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        console.error('Error fetching notifications:', err);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [token, isAuthenticated]);

  // Efecto para cargar notificaciones al inicio y configurar polling
  useEffect(() => {
    fetchNotifications();

    const startInterval = () => {
      intervalRef.current = setInterval(fetchNotifications, 5 * 60 * 1000);
    };

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Pausar el intervalo cuando la pestaña no está visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        // Al volver a estar visible, recargar inmediatamente y reiniciar intervalo
        fetchNotifications();
        startInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startInterval();

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotifications]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Marcar una notificación como leída
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const storedToken = token || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        setNotifications(prev => {
          const updated = prev.map(n => n.id === id ? { ...n, is_read: true } : n);
          // Recalcular el contador de no leídos basado en el estado actualizado
          setUnreadCount(updated.filter(n => !n.is_read).length);
          return updated;
        });
      } else {
        console.error('Error marking notification as read:', res.status);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Marcar todas como leídas
  const handleMarkAllAsRead = async () => {
    try {
      const storedToken = token || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      } else {
        console.error('Error marking all notifications as read:', res.status);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // Formatear fecha
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50"
          role="menu"
          aria-label="Panel de notificaciones"
        >
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                title="Marcar todas como leídas"
              >
                <Check size={14} /> Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex justify-center items-center text-slate-500">
                <Loader2 className="animate-spin" size={24} />
                <span className="ml-2">Cargando...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                  role="menuitem"
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className={`text-sm ${!notif.is_read ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
                        {notif.message}
                      </p>
                      <span className="text-xs text-slate-400 block mt-1">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100 transition-colors h-fit"
                        title="Marcar como leída"
                        aria-label="Marcar notificación como leída"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
