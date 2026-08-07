import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', unidad: '', precio_usd: 0 });
  const [showAdd, setShowAdd] = useState(false);

  const fetchMaterials = async () => {
    try {
      const res = await fetch(`${API_URL}/materials/`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      } else {
        toast.error('Error al cargar materiales');
      }
    } catch (e) {
      toast.error('Error de red al cargar materiales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/materials/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        toast.success('Material agregado');
        setShowAdd(false);
        setEditForm({ nombre: '', unidad: '', precio_usd: 0 });
        fetchMaterials();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Error al agregar');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/materials/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        toast.success('Material actualizado');
        setEditingId(null);
        setEditForm({ nombre: '', unidad: '', precio_usd: 0 });
        fetchMaterials();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Error al actualizar');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este material?')) return;
    try {
      const res = await fetch(`${API_URL}/materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Material eliminado');
        fetchMaterials();
      } else {
        toast.error('Error al eliminar');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  const startEdit = (mat) => {
    setEditingId(mat.id);
    setEditForm({ nombre: mat.nombre, unidad: mat.unidad, precio_usd: mat.precio_usd });
    setShowAdd(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAdd(false);
    setEditForm({ nombre: '', unidad: '', precio_usd: 0 });
  };

  if (loading) return <div className="p-8 text-center">Cargando materiales...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Precios de Materiales</h1>
          <p className="mt-2 text-sm text-gray-700">
            Base de datos global de precios utilizada por todas las calculadoras (Losa de Fundación, Mampostería, etc).
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setEditForm({ nombre: '', unidad: '', precio_usd: 0 }); }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Añadir Material
          </button>
        </div>
      </div>

      {(showAdd || editingId) && (
        <div className="mt-6 bg-white shadow rounded-lg p-6 sticky top-4 z-10 border-2 border-blue-400">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{showAdd ? 'Nuevo Material' : 'Editar Material'}</h3>
          <form onSubmit={showAdd ? handleAddSubmit : handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input required type="text" value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Ej: Cemento Portland" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unidad</label>
                <input required type="text" value={editForm.unidad} onChange={e => setEditForm({...editForm, unidad: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Ej: sacos, m³, kg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Precio USD</label>
                <input required type="number" step="0.01" value={editForm.precio_usd} onChange={e => setEditForm({...editForm, precio_usd: parseFloat(e.target.value)})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={cancelEdit} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">Cancelar</button>
              <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">{showAdd ? 'Guardar' : 'Actualizar'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">ID</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Nombre</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Unidad</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio (USD)</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {materials.map((mat) => (
                    <tr key={mat.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{mat.id}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{mat.nombre}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{mat.unidad}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-bold">${mat.precio_usd.toFixed(2)}</td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button onClick={() => startEdit(mat)} className="text-blue-600 hover:text-blue-900 mr-4">Editar</button>
                        <button onClick={() => handleDelete(mat.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr><td colSpan="5" className="text-center py-6 text-gray-500">No hay materiales registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
