import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiSearch, FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import { API_URL } from '../../../services/api';

const CatalogResourceTab = ({ resourceType, title, config, selectedDatabase, adminMode = false }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [totalItems, setTotalItems] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 50;
  const [hasMore, setHasMore] = useState(false);

  const fetchItems = async (searchQuery = '', currentSkip = 0, append = false) => {
    setLoading(true);
    try {
      const dbParam = selectedDatabase && selectedDatabase !== 'master' ? `&database_id=${selectedDatabase}` : '';
      const res = await fetch(`${API_URL}/cost360/${resourceType}?search=${encodeURIComponent(searchQuery)}&skip=${currentSkip}&limit=${limit}${dbParam}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Since backend was updated to return { total, items }
        const newItems = Array.isArray(data) ? data : data.items;
        const total = Array.isArray(data) ? data.length : data.total;
        
        if (append) {
          setItems(prev => [...prev, ...newItems]);
        } else {
          setItems(newItems);
        }
        
        setTotalItems(total || 0);
        setHasMore((currentSkip + limit) < total);
        setSkip(currentSkip);
      }
    } catch (e) {
      toast.error('Error cargando ' + title);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(search);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchItems(search, 0, false);
  };

  const handleLoadMore = () => {
    fetchItems(search, skip + limit, true);
  };

  const startEdit = (item) => {
    setEditingId(item[config.idKey]);
    const form = {};
    config.editableFields.forEach(f => {
      form[f.key] = item[f.key] || 0;
    });
    setEditForm(form);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleUpdate = async () => {
    try {
      const res = await fetch(`${API_URL}/cost360/${resourceType}/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminMode ? localStorage.getItem('arko_admin_token') : localStorage.getItem('token')}`
        },
        body: JSON.stringify(editForm)
      });
      
      if (res.ok) {
        toast.success(`${title} actualizado`);
        setEditingId(null);
        fetchItems(search);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Error al actualizar');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este insumo de la Base Maestra? Esto es irreversible.')) return;
    try {
      const res = await fetch(`${API_URL}/cost360/${resourceType}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminMode ? localStorage.getItem('arko_admin_token') : localStorage.getItem('token')}` }
      });
      if (res.ok) {
        toast.success(`${title} eliminado`);
        fetchItems(search);
      } else {
        toast.error('Error al eliminar');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Glass search */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.65)',
          boxShadow: '0 4px 32px 0 rgba(80,100,200,0.08)',
        }}
      >
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FiSearch className="text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              style={{
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(148,163,255,0.35)',
                boxShadow: 'inset 0 1px 4px rgba(80,100,200,0.06)',
              }}
              placeholder={`Buscar en ${title}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:opacity-100 hover:shadow-[0_8px_25px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
          >
            Buscar
          </button>
        </form>
        {totalItems > 0 && (
          <p className="mt-3 text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalItems)}</span>{' '}
            {search ? 'coincidencias' : `Total ${title}`}
          </p>
        )}
      </div>

      {/* Glass table */}
      <div
        className="rounded-2xl flex-1 min-h-0 overflow-y-auto flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
        }}
      >
        <div className="flex-1">
          <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
            <thead className="sticky top-0 z-10" style={{ background: '#f8fafc' }}>
              <tr style={{ background: 'linear-gradient(90deg,rgba(37,99,235,0.06),rgba(99,102,241,0.03))' }}>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                {config.editableFields.map(f => (
                  <th key={f.key} className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{f.label}</th>
                ))}
                {(selectedDatabase !== 'master' || adminMode) && (
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="100%" className="text-center py-8 text-gray-500">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="100%" className="text-center py-8 text-gray-500">No se encontraron resultados</td></tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item[config.idKey]}
                    className="group cursor-default transition-all duration-150"
                    style={{ borderLeft: '3px solid transparent' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(239,246,255,0.6)';
                      e.currentTarget.style.borderLeftColor = '#2563eb';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderLeftColor = 'transparent';
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-blue-700 font-mono">{item[config.idKey]}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 group-hover:text-slate-800">{item[config.descKey]}</td>
                    
                    {config.editableFields.map(f => (
                      <td key={f.key} className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {editingId === item[config.idKey] ? (
                          f.key === 'Descri' ? (
                            <input
                              type="text"
                              className="w-64 text-left border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2 py-1"
                              value={editForm[f.key] || ''}
                              onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                            />
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              className="w-24 text-right border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2 py-1"
                              value={editForm[f.key]}
                              onChange={(e) => setEditForm({ ...editForm, [f.key]: parseFloat(e.target.value) || 0 })}
                            />
                          )
                        ) : (
                          <span className={f.key === 'Descri' ? 'text-gray-900 text-left' : 'text-gray-900'}>
                            {f.key === 'Descri' ? (item[f.key] || '') : `$${(item[f.key] || 0).toFixed(2)}`}
                          </span>
                        )}
                      </td>
                    ))}

                    {(selectedDatabase !== 'master' || adminMode) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId === item[config.idKey] ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={handleUpdate} className="text-green-600 hover:text-green-900 bg-green-50 p-2 rounded-full transition-colors" title="Guardar"><FiCheck size={16} /></button>
                            <button onClick={cancelEdit} className="text-gray-600 hover:text-gray-900 bg-gray-100 p-2 rounded-full transition-colors" title="Cancelar"><FiX size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full transition-colors" title="Editar Precio"><FiEdit2 size={16} /></button>
                            <button onClick={() => handleDelete(item[config.idKey])} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-full transition-colors" title="Eliminar"><FiTrash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
            {hasMore && !loading && items.length > 0 && (
              <div className="flex justify-center py-4 pb-6 shrink-0">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-2.5 rounded-full text-sm font-semibold text-blue-700 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 hover:bg-white"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: '1.5px solid rgba(37,99,235,0.3)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Cargar Más
                </button>
              </div>
            )}
          </div>
        </div>
  );
};

export default CatalogResourceTab;
