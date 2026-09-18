import React, { useState, useEffect, useRef } from 'react';
import { 
  FiUpload, FiCheck, FiX, FiRefreshCw, FiAlertCircle, FiFileText, 
  FiShoppingBag, FiLayers, FiDollarSign, FiSearch, FiCheckCircle 
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

// Fallback to generic API_URL if not defined differently
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Definición canónica de los 24 materiales de referencia de table_update_bd.xlsx
const DEFAULT_REFERENCE_ITEMS = [
  { codmat: 'ELE128', name: 'CABLE THW 12 AWG COBRE (0,050 KG/M)', unit: 'm', vendor: 'Pall Ferretería', family_id: 'FAM-18E7577F' },
  { codmat: 'PLOA83', name: 'CANILLA FLEXIBLE ACERO INOX. 1/2" X 5/8"', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-B1D67CE6' },
  { codmat: 'ACE019', name: 'CABILLA* D=3/8" FY=4200 KGF/CM2 0,559 K', unit: 'kgf', vendor: 'Pall Ferretería', family_id: 'FAM-1E916DC4' },
  { codmat: 'MT3029', name: 'RAMPLUG PLASTICO 5/16" COLOR AZUL', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-E914CF58' },
  { codmat: 'MAT-80EE53', name: 'BLOQUE PARED ENTERO NORMAL CONCRETO 15X20X40 CM.', unit: 'PZA', vendor: 'Pall Ferretería', family_id: 'FAM-FAE5C031' },
  { codmat: 'MAT-179B0B', name: 'PINTURA ALUMINIO', unit: 'gal', vendor: 'Pall Ferretería', family_id: 'FAM-633C4CDE' },
  { codmat: 'PLO915', name: 'LLAVE DE ARRESTO PARA PIEZAS SANITARIAS', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-9F8CC197' },
  { codmat: 'ACA075', name: 'DISCO ABRASIVO PARA ESMERIL 7"', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-4EEF21F9' },
  { codmat: 'ACA015', name: 'RAMPLUG PLÁSTICO 1/4" COLOR VERDE', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-A4C7539E' },
  { codmat: 'ELE347', name: 'LÁMPARA DE EMERGENCIA EN CAJA PLÁSTICA CON 2 FAROS DIRECCIONALES', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-D97847CD' },
  { codmat: 'PIN034', name: 'PINTURA DE ESMALTE TIPO A #', unit: 'gln', vendor: 'Pall Ferretería', family_id: 'FAM-633C4CDE' },
  { codmat: 'MAT2318', name: 'SIFON PLASTICO D=1 1/2" P/BATEA FREGADERO', unit: 'pieza', vendor: 'Pall Ferretería', family_id: 'FAM-3C9FDDC7' },
  { codmat: 'ASF119', name: 'CEMENTO PLÁSTICO (ASFALTO) IPA 5 GALONES O SIMILAR', unit: 'cuñ', vendor: 'Pall Ferretería', family_id: 'FAM-D07354C8' },
  { codmat: 'ARC078', name: 'BLOQUE DE ARCILLA PARA PLATABANDA 15 X 20 X 40 CM (8 UNIDADES / M2)', unit: 'pza', vendor: 'Pall Ferretería', family_id: 'FAM-7C69BC65' },
  { codmat: 'AGR018', name: 'ARENA LAVADA', unit: 'm3', vendor: 'Pall Ferretería', family_id: 'FAM-E96F7D07' },
  { codmat: 'CEM041', name: 'CEMENTO GRIS PORTLAND SACO DE 42,5 KG', unit: 'sco', vendor: 'Pall Ferretería', family_id: 'FAM-90B54703' },
  { codmat: 'VID023', name: 'VIDRIO PLANO E=5 MM', unit: 'm2', vendor: 'Pall Ferretería', family_id: 'FAM-C005F7AF' },
  { codmat: 'MT558', name: 'TIERRA NEGRA ABONADA / JARDINERIA', unit: 'm3', vendor: 'Pall Ferretería', family_id: 'FAM-E181000F' },
  { codmat: 'ENC001', name: 'CUARTON DE MADERA AURORA 5 X 10 CM X L=3', unit: 'm3', vendor: 'Pall Ferretería', family_id: 'FAM-C2645CBB' },
  { codmat: 'ACA014', name: 'LÁMINA DE YESO 4\' X 8\' X 1/2" (1,2 X 2,4 M)', unit: 'm2', vendor: 'Matos Suplidores', family_id: 'FAM-DRYWALL' },
  { codmat: 'APA025', name: 'MANOMETRO RANGO 0-200 PSI', unit: 'und', vendor: 'Pall Ferretería', family_id: 'FAM-15781C45' },
  { codmat: 'MEC348', name: 'FORMULA MECANICA EN SPRAY / ACEITE LUBRI', unit: 'env', vendor: 'Pall Ferretería', family_id: 'FAM-4295CE6B' },
  { codmat: 'MAT3160', name: 'VARILLAS DE PLATA AL 5% P/REFRIGERACION', unit: 'pieza', vendor: 'Pall Ferretería', family_id: 'FAM-38241F3B' },
  { codmat: 'MAT1623', name: 'LAMINA DE POLIESTIRENO 1,20X0,60M E= 5/8"', unit: 'pieza', vendor: 'Matos Suplidores', family_id: 'FAM-ANIME' }
];

const PDFUpdaterTab = ({ selectedDatabase = 'master', onSuccess }) => {
  const [items, setItems] = useState(DEFAULT_REFERENCE_ITEMS);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newPrices, setNewPrices] = useState({});
  const [itemSources, setItemSources] = useState({});
  
  // File upload state
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vendorType, setVendorType] = useState('auto'); // 'auto' | 'pall' | 'matos'
  const [exchangeRate, setExchangeRate] = useState(1);
  const [bcvRate, setBcvRate] = useState(null);
  const [loadingBcv, setLoadingBcv] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('all'); // 'all' | 'pall' | 'matos'
  const fileInputRef = useRef(null);

  // Cargar precios vigentes de la base de datos seleccionada
  useEffect(() => {
    fetchReferenceItems(selectedDatabase);
  }, [selectedDatabase]);

  // Cargar tasa BCV oficial en tiempo real
  useEffect(() => {
    fetchBcvRate();
  }, []);

  const fetchBcvRate = async () => {
    setLoadingBcv(true);
    try {
      const res = await fetch(`${API_URL}/pdf-updater/bcv-rate`);
      if (res.ok) {
        const data = await res.json();
        if (data.bcv_rate) {
          setBcvRate(Number(data.bcv_rate));
        }
      }
    } catch (err) {
      console.error('Error consultando tasa BCV:', err);
    } finally {
      setLoadingBcv(false);
    }
  };

  const handleVendorSelect = (type) => {
    setVendorType(type);
    if (type === 'pall') {
      setExchangeRate(1);
    } else if (type === 'matos') {
      if (bcvRate) {
        setExchangeRate(bcvRate);
        toast.success(`Tasa BCV oficial aplicada para Matos: ${bcvRate} VES/USD`);
      }
    }
  };

  const fetchReferenceItems = async (dbId = selectedDatabase) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`${API_URL}/pdf-updater/reference-items?database_id=${encodeURIComponent(dbId || 'master')}`);
      if (!res.ok) {
        throw new Error('Error al cargar insumos de referencia');
      }
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setItems(data.items);
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron consultar los precios actuales de la base seleccionada');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async () => {
    if (!file) {
      toast.error('Selecciona un archivo PDF o imagen primero.');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    const queryParams = new URLSearchParams({
      vendor_type: vendorType,
      database_id: selectedDatabase || 'master',
      exchange_rate: exchangeRate || 1
    }).toString();

    try {
      const response = await fetch(`${API_URL}/pdf-updater/analyze-vendor-quote?${queryParams}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Error analizando cotización');
      }

      const data = await response.json();
      const matches = data.matches || [];

      // Sincronizar tasa si el backend aplicó automáticamente la tasa BCV oficial
      if (data.auto_bcv_used && data.applied_exchange_rate) {
        setExchangeRate(data.applied_exchange_rate);
        toast.success(
          `Cotización en Bolívares detectada. Precios convertidos a USD con Tasa BCV Oficial: ${Number(data.applied_exchange_rate).toFixed(2)} VES/USD`,
          { duration: 6000 }
        );
      }

      if (matches.length === 0) {
        toast('No se encontraron líneas correspondientes a los 24 insumos en este archivo.', {
          icon: 'ℹ️'
        });
      } else {
        // Carga acumulativa: actualiza los que coincidieron sin borrar los anteriores
        setNewPrices(prev => {
          const next = { ...prev };
          matches.forEach(m => {
            next[m.codmat] = m.new_price;
          });
          return next;
        });

        setItemSources(prev => {
          const next = { ...prev };
          matches.forEach(m => {
            const vendorLabel = data.vendor_type === 'pall' 
              ? 'Cotización Pall' 
              : data.vendor_type === 'matos' 
                ? 'Cotización Matos' 
                : 'Cotización PDF';
            next[m.codmat] = {
              vendor: vendorLabel,
              original_desc: m.original_desc,
              original_price: m.original_price
            };
          });
          return next;
        });

        toast.success(`Se encontraron y rellenaron ${matches.length} precios en la tabla.`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error procesando documento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePriceChange = (codmat, val) => {
    setNewPrices(prev => ({
      ...prev,
      [codmat]: val
    }));

    // Si no tenía origen o se edita a mano, registrar origen manual
    setItemSources(prev => ({
      ...prev,
      [codmat]: {
        ...(prev[codmat] || {}),
        vendor: prev[codmat]?.vendor?.startsWith('Cotización') ? `${prev[codmat].vendor} (Ajustado)` : 'Edición Manual'
      }
    }));
  };

  const handleClearAllDrafts = () => {
    if (Object.keys(newPrices).length === 0) return;
    if (window.confirm('¿Deseas limpiar todos los nuevos precios ingresados en la tabla?')) {
      setNewPrices({});
      setItemSources({});
      toast.success('Precios nuevos restablecidos.');
    }
  };

  const handleSaveAll = async () => {
    // Filtrar los items que tienen precio nuevo numérico y mayor a 0
    const itemsToUpdate = Object.entries(newPrices)
      .filter(([cod, p]) => p !== '' && !isNaN(parseFloat(p)) && parseFloat(p) > 0)
      .map(([codmat, p]) => ({
        codmat,
        new_price: parseFloat(p),
        vendor: itemSources[codmat]?.vendor || 'Manual',
        original_desc: itemSources[codmat]?.original_desc || null
      }));

    if (itemsToUpdate.length === 0) {
      toast.error('No hay precios nuevos válidos para guardar en la base de datos.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/pdf-updater/batch-update-reference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToUpdate,
          database_id: selectedDatabase || 'master'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al actualizar base de datos');
      }

      const data = await res.json();
      toast.success(data.message || 'Base de datos actualizada con éxito');

      // Limpiar drafts y refrescar precios actuales de la base
      setNewPrices({});
      setItemSources({});
      handleClearFile();
      await fetchReferenceItems(selectedDatabase);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error guardando en la base de datos');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado de la tabla para búsqueda o por proveedor
  const filteredItems = items.filter(it => {
    const matchesSearch = 
      it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.codmat.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.vendor.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterVendor === 'pall') {
      return matchesSearch && it.vendor.toLowerCase().includes('pall');
    }
    if (filterVendor === 'matos') {
      return matchesSearch && it.vendor.toLowerCase().includes('matos');
    }
    return matchesSearch;
  });

  const modifiedCount = Object.entries(newPrices).filter(([_, p]) => p !== '' && !isNaN(parseFloat(p)) && parseFloat(p) > 0).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-5 sm:p-6 gap-6">
      {/* Header Superior con Información y Botón de Acción Directa */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">
              Actualización por Listas de Proveedores & Cotizaciones (PDF)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Correlación directa de los 24 materiales de referencia (esquema <span className="font-semibold text-slate-700">table_update_bd.xlsx</span>).
            Sube las listas de <strong>Pall Ferretería</strong> y <strong>Matos Suplidores</strong> de forma acumulativa o edita manualmente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 px-3.5 py-1.5 rounded-xl text-xs">
            <span className="text-indigo-700 font-medium">Base activa:</span>
            <span className="font-bold text-indigo-900 bg-white px-2.5 py-0.5 rounded-md shadow-2xs border border-indigo-100 font-mono">
              {selectedDatabase}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving || modifiedCount === 0}
            className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
              modifiedCount > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
            title="Aplica todos los precios nuevos ingresados a la base de datos seleccionada y dispersa en cascada"
          >
            {isSaving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheckCircle className="w-4 h-4" />}
            <span>ACTUALIZAR BD SELECCIONADA {modifiedCount > 0 ? `(${modifiedCount})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Componente Compacto de Carga de Archivos y Filtros de Proveedor (Sustituye la tarjeta gigante de 1182x335) */}
      <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Selector de Proveedor Objetivo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1">
              Proveedor a Subir:
            </span>
            <button
              type="button"
              onClick={() => handleVendorSelect('auto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                vendorType === 'auto'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              ✨ Todos / Detección Auto
            </button>
            <button
              type="button"
              onClick={() => handleVendorSelect('pall')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                vendorType === 'pall'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              <FiShoppingBag className="w-3.5 h-3.5" />
              <span>Pall Ferretería (22 insumos)</span>
            </button>
            <button
              type="button"
              onClick={() => handleVendorSelect('matos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                vendorType === 'matos'
                  ? 'bg-purple-600 text-white shadow-sm font-bold'
                  : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <FiLayers className="w-3.5 h-3.5" />
              <span>Matos Suplidores (Drywall/Anime)</span>
            </button>
          </div>

          {/* Tasa de cambio VES/USD */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Tasa de Cambio:</label>
            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 border border-slate-200 rounded-xl shadow-2xs">
              <input
                type="number"
                step="0.01"
                className="w-20 text-xs font-bold text-slate-800 outline-none"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="1.0"
              />
              <span className="text-[10px] font-semibold text-slate-400">VES/USD</span>
            </div>
            {bcvRate && (
              <button
                type="button"
                onClick={() => {
                  setExchangeRate(bcvRate);
                  toast.success(`Tasa BCV oficial aplicada: ${bcvRate} VES/USD`);
                }}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Hacer clic para usar la tasa oficial del Banco Central de Venezuela"
              >
                <span>BCV: <strong>{Number(bcvRate).toFixed(2)}</strong></span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Selección de Archivo y Botón de Procesamiento */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <FiUpload className="w-4 h-4" />
              <span>{file ? 'Cambiar Archivo' : 'Seleccionar Cotización (PDF / Imagen)'}</span>
            </button>

            {file && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <FiFileText className="text-blue-600 w-4 h-4" />
                <span className="text-xs font-medium text-slate-700 max-w-[200px] truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                  title="Quitar archivo"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {modifiedCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllDrafts}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                Limpiar borradores
              </button>
            )}

            <button
              type="button"
              onClick={processFile}
              disabled={!file || isProcessing}
              className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                file && !isProcessing
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSearch className="w-4 h-4" />}
              <span>{isProcessing ? 'Analizando con IA...' : 'Analizar y Rellenar Precios'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros de la Tabla */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en la tabla..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none w-56 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setFilterVendor('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterVendor === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterVendor('pall')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterVendor === 'pall' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Pall (22)
            </button>
            <button
              type="button"
              onClick={() => setFilterVendor('matos')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterVendor === 'matos' ? 'bg-white text-purple-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Matos (2)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchReferenceItems(selectedDatabase)}
            disabled={loadingItems}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
            title="Recargar precios actuales de la base"
          >
            <FiRefreshCw className={`w-4 h-4 ${loadingItems ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs text-slate-500">
            Mostrando <strong>{filteredItems.length}</strong> de {items.length} materiales de referencia
          </span>
        </div>
      </div>

      {/* Tabla Permanente idéntica a table_update_bd.xlsx */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center text-slate-400">#</th>
                <th className="py-3.5 px-4 w-28">Código</th>
                <th className="py-3.5 px-6">Material / Descripción</th>
                <th className="py-3.5 px-4 w-20">Unidad</th>
                <th className="py-3.5 px-4 w-44">Proveedor</th>
                <th className="py-3.5 px-4 w-36 text-right">Precio Actual ($)</th>
                <th className="py-3.5 px-4 w-44 text-right">Precio Nuevo ($)</th>
                <th className="py-3.5 px-4 w-44 text-center">Estado / Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, index) => {
                const hasNewPrice = newPrices[item.codmat] !== undefined && newPrices[item.codmat] !== '';
                const source = itemSources[item.codmat];
                const isPall = item.vendor.toLowerCase().includes('pall');

                return (
                  <tr 
                    key={item.codmat} 
                    className={`transition-colors ${
                      hasNewPrice 
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/60' 
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3 px-4 text-center text-xs font-mono text-slate-400">
                      {index + 1}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60">
                        {item.codmat}
                      </span>
                    </td>

                    <td className="py-3 px-6">
                      <div className="font-semibold text-slate-800 text-sm">
                        {item.name}
                      </div>
                      {source?.original_desc && (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-md" title={source.original_desc}>
                          Línea PDF: "{source.original_desc}"
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded uppercase">
                        {item.unit}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                        isPall 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {isPall ? <FiShoppingBag className="w-3 h-3" /> : <FiLayers className="w-3 h-3" />}
                        <span>{item.vendor}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-slate-700 font-mono text-sm">
                        $ {Number(item.current_price || 0).toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span className="text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newPrices[item.codmat] !== undefined ? newPrices[item.codmat] : ''}
                          onChange={(e) => handlePriceChange(item.codmat, e.target.value)}
                          className={`w-28 px-3 py-1.5 border rounded-xl text-sm font-bold font-mono text-right outline-none transition-all ${
                            hasNewPrice
                              ? 'border-emerald-500 bg-white text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-700'
                          }`}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {hasNewPrice ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <FiCheck className="w-3 h-3 text-emerald-600" />
                          <span>{source?.vendor || 'Modificado'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Sin cambio
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer de la Tabla con Resumen y Botón de Guardado */}
        <div className="bg-slate-50/80 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            {modifiedCount > 0 ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <FiCheckCircle className="w-4 h-4" />
                {modifiedCount} materiales listos para ser actualizados en la base de datos "{selectedDatabase}".
              </span>
            ) : (
              <span className="text-slate-500">
                Ingresa los precios en la columna "Precio Nuevo ($)" o sube las cotizaciones en PDF de Pall y Matos.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving || modifiedCount === 0}
            className={`w-full sm:w-auto px-6 py-3 text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              modifiedCount > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheckCircle className="w-4 h-4" />}
            <span>ACTUALIZAR BD SELECCIONADA {modifiedCount > 0 ? `(${modifiedCount})` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFUpdaterTab;
