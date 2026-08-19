import React, { useState, useEffect } from 'react';
import { marketService } from '../services/marketService';

const ItemMergerPanel = () => {
  const [itemType, setItemType] = useState('material');
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  
  const [oldItem, setOldItem] = useState(null);
  const [newItem, setNewItem] = useState(null);
  
  const [loadingOld, setLoadingOld] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOld, setErrorOld] = useState('');
  const [errorNew, setErrorNew] = useState('');
  
  const [merging, setMerging] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Debounced fetch for old item
  useEffect(() => {
    if (!oldCode.trim()) {
      setOldItem(null);
      setErrorOld('');
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingOld(true);
      setErrorOld('');
      try {
        const item = await marketService.getItemDetails(itemType, oldCode.trim());
        setOldItem(item);
      } catch (err) {
        setOldItem(null);
        setErrorOld(err.message);
      } finally {
        setLoadingOld(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [oldCode, itemType]);

  // Debounced fetch for new item
  useEffect(() => {
    if (!newCode.trim()) {
      setNewItem(null);
      setErrorNew('');
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingNew(true);
      setErrorNew('');
      try {
        const item = await marketService.getItemDetails(itemType, newCode.trim());
        setNewItem(item);
      } catch (err) {
        setNewItem(null);
        setErrorNew(err.message);
      } finally {
        setLoadingNew(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newCode, itemType]);

  const handleMerge = async () => {
    if (!oldItem || !newItem) return;
    if (!window.confirm(`¿Estás 100% seguro de unificar ${oldItem.code} con ${newItem.code}? Esta acción no se puede deshacer y borrará el insumo original.`)) return;

    setMerging(true);
    setSuccessMsg('');
    try {
      await marketService.mergeItems(itemType, oldItem.code, newItem.code);
      setSuccessMsg(`¡Éxito! El insumo ${oldItem.code} fue fusionado y purgado.`);
      setOldCode('');
      setOldItem(null);
      // Opcionalmente dejar el nuevo para que vean que quedó
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setMerging(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
      {/* Dynamic Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
          Unificador de Insumos
        </h2>
        <p className="text-indigo-200/60 mb-8">
          Busca y unifica insumos duplicados o huérfanos. Las partidas se actualizarán automáticamente.
        </p>

        {successMsg && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 text-green-300 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            {successMsg}
          </div>
        )}

        {/* Tipo de Insumo */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-indigo-200/80 mb-2">Tipo de Insumo</label>
          <div className="flex gap-4">
            {['material', 'equipment', 'labor'].map(type => (
              <label key={type} className="flex-1 cursor-pointer">
                <input 
                  type="radio" 
                  name="itemType" 
                  value={type} 
                  checked={itemType === type}
                  onChange={() => {
                    setItemType(type);
                    setOldCode('');
                    setNewCode('');
                  }}
                  className="peer sr-only"
                />
                <div className="text-center py-3 px-4 rounded-xl border border-white/10 bg-white/5 peer-checked:bg-indigo-500/20 peer-checked:border-indigo-400/50 peer-checked:text-indigo-300 transition-all">
                  {type === 'material' ? 'Materiales' : type === 'equipment' ? 'Equipos' : 'Mano de Obra'}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Cajas de Códigos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative">
          
          {/* Arrow Icon in the middle for desktop */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-400/30 z-20">
            <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>

          {/* Izquierda: Insumo a Eliminar */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 relative">
            <div className="absolute top-0 right-0 px-3 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded-bl-lg rounded-tr-xl">SE BORRARÁ</div>
            <label className="block text-sm font-medium text-red-200 mb-2">Código Incorrecto / Huérfano</label>
            <input 
              type="text" 
              value={oldCode}
              onChange={e => setOldCode(e.target.value.toUpperCase())}
              placeholder="Ej: MAT0428"
              className="w-full bg-black/20 border border-red-500/30 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all uppercase"
            />
            
            <div className="mt-4 min-h-[120px]">
              {loadingOld && <p className="text-red-300/50 text-sm animate-pulse">Buscando...</p>}
              {errorOld && <p className="text-red-400 text-sm">{errorOld}</p>}
              {oldItem && (
                <div className="text-sm">
                  <p className="text-red-100 font-medium mb-1 line-clamp-2" title={oldItem.description}>{oldItem.description}</p>
                  <div className="flex justify-between items-center mt-3 text-red-200/70">
                    <span className="font-mono">{oldItem.unit}</span>
                    <span className="font-bold text-red-300 text-lg">{formatPrice(oldItem.price)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Derecha: Insumo Destino */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 relative">
            <div className="absolute top-0 right-0 px-3 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded-bl-lg rounded-tr-xl">SE CONSERVARÁ</div>
            <label className="block text-sm font-medium text-green-200 mb-2">Código Sano / Equivalente</label>
            <input 
              type="text" 
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="Ej: ELE087"
              className="w-full bg-black/20 border border-green-500/30 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-all uppercase"
            />

            <div className="mt-4 min-h-[120px]">
              {loadingNew && <p className="text-green-300/50 text-sm animate-pulse">Buscando...</p>}
              {errorNew && <p className="text-green-400 text-sm">{errorNew}</p>}
              {newItem && (
                <div className="text-sm">
                  <p className="text-green-100 font-medium mb-1 line-clamp-2" title={newItem.description}>{newItem.description}</p>
                  <div className="flex justify-between items-center mt-3 text-green-200/70">
                    <span className="font-mono">{newItem.unit}</span>
                    <span className="font-bold text-green-300 text-lg">{formatPrice(newItem.price)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Boton Accion */}
        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleMerge}
            disabled={!oldItem || !newItem || merging || oldItem.code === newItem.code}
            className="group relative px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden transition-all hover:scale-[1.02] active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative flex items-center gap-2">
              {merging ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fusionando...
                </>
              ) : 'Unificar Insumos y Purgar'}
            </span>
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default ItemMergerPanel;
