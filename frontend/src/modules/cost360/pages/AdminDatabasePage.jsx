import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiLayers, FiArrowRight, FiBox, FiTool, FiUsers, FiDatabase, FiEdit2, FiTrash2, FiSave, FiX, FiDownload, FiCpu, FiUpload, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import cost360Service from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { SiteConfigContext } from '../../../App';
import { API_URL } from '../../../services/api';
import CatalogResourceTab from '../components/CatalogResourceTab';
import PDFUpdaterTab from '../components/PDFUpdaterTab';
import Cost360SearchBar from '../components/Cost360SearchBar';
import { useCost360Search } from '../hooks/useCost360Search';
import coveninTreeData from '../data/covenin_tree.json';
import { ScrapingDashboardProvider } from '../context/ScrapingDashboardContext';
import { ControlBar } from '../components/scraping/ControlBar';
import { LogConsole } from '../components/scraping/LogConsole';
import { ConfigPanel } from '../components/scraping/ConfigPanel';

const ScrapingDashboard = () => {
  const [botStatus, setBotStatus] = useState('idle');

  return (
    <div className="flex flex-col gap-4 h-full">
      <ControlBar status={botStatus} onStatusChange={setBotStatus} />
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1">
          <LogConsole />
        </div>
        <div className="w-80">
          <ConfigPanel />
        </div>
      </div>
    </div>
  );

};

const ModuloSincronizacionCostos = () => {
  const [estaProcesando, setEstaProcesando] = useState(false);
  const [pendingItems, setPendingItems] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const loadPendingItems = async () => {
    setLoadingPending(true);
    try {
      const response = await fetch(`${API_URL}/scraping/pending`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingItems(data);
      }
    } catch (error) {
      console.error("Error loading pending items", error);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadPendingItems();
  }, []);

  const desencadenarVersionamientoDB = async () => {
    setEstaProcesando(true);
    try {
      const urlAPI = `${API_URL}/scraping/versionar-precios-db`;
      const consulta = await fetch(urlAPI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
        },
        body: JSON.stringify({ limit: 25 })
      });
      
      const respuestaJson = await consulta.json();
      if (respuestaJson.status === 'processing') {
        toast.success("⚡ ¡El bot ha iniciado el escaneo de 25 materiales! Los resultados aparecerán aquí al recargar la página más tarde.", {
          duration: 5000,
          position: 'top-center'
        });
      }
    } catch (error) {
      toast.error("❌ Error de comunicación con el servidor.");
    } finally {
      setEstaProcesando(false);
    }
  };

  const handleAction = async (id, action, price = null) => {
    try {
      const url = `${API_URL}/scraping/${action}/${id}`;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
        }
      };
      
      if (action === 'approve') {
        options.body = JSON.stringify({ price: price });
      }

      const response = await fetch(url, options);
      if (response.ok) {
        toast.success(action === 'approve' ? "✅ Precio aprobado y actualizado en la base maestra" : "❌ Precio descartado");
        setPendingItems(prev => prev.filter(item => item.id !== id));
      } else {
        toast.error("Error al procesar la acción");
      }
    } catch (error) {
      toast.error("Error de red");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FiBox className="text-blue-600" />
            Cola de Aprobación del Bot (Scraping Inteligente)
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            El bot escanea los materiales en EPA y MercadoLibre. Revisa y aprueba las coincidencias para actualizar tu base de datos maestra.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPendingItems}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            ↻ Refrescar Cola
          </button>
          <button
            onClick={desencadenarVersionamientoDB}
            disabled={estaProcesando}
            className={`px-4 py-2 font-bold rounded-lg text-sm text-white transition-colors flex items-center gap-2 ${estaProcesando ? 'bg-amber-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {estaProcesando ? '⏳ Ejecutando...' : '🚀 Lanzar Tanda (25 Materiales)'}
          </button>
        </div>
      </div>

      <div className="p-0">
        {loadingPending ? (
          <div className="p-8 text-center text-slate-500">Cargando resultados...</div>
        ) : pendingItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <h5 className="text-slate-700 font-bold mb-1">¡Todo al día!</h5>
            <p className="text-slate-500 text-sm">No hay precios pendientes de aprobación.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-4 border-b">Material Original (BD)</th>
                  <th className="p-4 border-b">Producto Encontrado (Bot)</th>
                  <th className="p-4 border-b text-center">Precio DB</th>
                  <th className="p-4 border-b text-center">Nuevo Precio</th>
                  <th className="p-4 border-b text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="font-mono text-xs text-blue-600 mb-1">{item.material_id}</div>
                      <div className="font-medium text-slate-800 line-clamp-2" title={item.db_desc}>{item.db_desc}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.fuente === 'mercadolibre' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          {item.fuente.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">{item.fecha}</span>
                      </div>
                      <div className="font-medium text-slate-700 line-clamp-2" title={item.titulo_scraped}>{item.titulo_scraped || 'Sin título'}</div>
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-500">
                      ${item.db_price.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-emerald-600 font-bold text-base mr-2">${item.scraped_price.toFixed(2)}</span>
                        {item.scraped_price > item.db_price ? (
                          <span className="text-red-500 text-xs font-bold" title="El precio subió">↑</span>
                        ) : item.scraped_price < item.db_price ? (
                          <span className="text-green-500 text-xs font-bold" title="El precio bajó">↓</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleAction(item.id, 'approve', item.scraped_price)}
                          className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded transition-colors"
                          title="Aprobar y guardar"
                        >
                          <FiSave size={16} />
                        </button>
                        <button
                          onClick={() => {
                            const editedPrice = prompt("Edita el precio antes de aprobarlo:", item.scraped_price);
                            if (editedPrice !== null && !isNaN(parseFloat(editedPrice))) {
                              handleAction(item.id, 'approve', parseFloat(editedPrice));
                            }
                          }}
                          className="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                          title="Editar precio y guardar"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                          title="Rechazar y descartar"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Shared glass style ─────────────────────────────────── */
const glass = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 4px 32px 0 rgba(80,100,200,0.08)',
};

const glassStrong = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
};

const AdminDatabasePage = () => {
  const [activeTab, setActiveTab] = useState('partidas');
  const [onlyCoded, setOnlyCoded] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [isCatMenuOpen, setIsCatMenuOpen] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState('master');
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPriceText, setBulkPriceText] = useState('');
  const [showBulkDescModal, setShowBulkDescModal] = useState(false);
  const [bulkDescFile, setBulkDescFile] = useState(null);
  const [promptText, setPromptText] = useState('');
  const catMenuRef = useRef(null);

  // Cargar bases de datos disponibles
  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const dbs = await cost360DatabaseService.getAll();
        const loadedDbs = dbs.databases || [];
        if (!loadedDbs.find(db => db.id === 'personalizada')) {
          loadedDbs.push({ id: 'personalizada', name: 'Base Personalizada', is_master: false });
        }
        setDatabases(loadedDbs);
      } catch (error) {
        console.error("Error al cargar bases de datos:", error);
      }
    };
    loadDatabases();
  }, []);

  // Cargar prompt guardado
  useEffect(() => {
    const savedPrompt = localStorage.getItem('apu_prompt');
    if (savedPrompt) {
      setPromptText(savedPrompt);
    } else {
      // Prompt actual del backend (ai_apu_service.py)
      setPromptText(`# ROL
Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU).
Recibes un payload con rendimientos históricos calculados a partir de partidas similares
reales de la base de datos, un catálogo de insumos filtrado y advertencias.
Tu trabajo es construir un APU técnico y completo basándote estrictamente en esta data.

# REGLAS DE CLARIFICACIÓN (¡MUY IMPORTANTE!)
Dirígete SIEMPRE al usuario en segunda persona ("Tu solicitud", "Estás pidiendo").

1. **Incongruencia Total (PRIORIDAD 1):** Si la solicitud NO corresponde lógicamente con
   el covenin_context, prohíbite generar el APU. Informa al usuario y pídele que corrija.
2. **Falta de datos críticos:** Si faltan datos clave (espesor, material, dimensiones),
   haz 1-3 preguntas de clarificación. No inventes datos críticos.
3. **Confirmación de partidas históricas:** Si partidas_encontradas > 0 y la descripción
   no es exactamente una de ellas, devuelve status: "clarification_needed" con las
   partidas históricas como options para que el usuario confirme.
4. Si el usuario ya respondió (ver historial), genera el APU directamente con status: "completed".

# PAYLOAD DEL SISTEMA (datos históricos y catálogo)
{payload_llm será inyectado aquí}
{history_text}

# REGLAS DE INTERPRETACIÓN
1. Si hay múltiples unidades en rendimientos_historicos_por_unidad_partida, elige la más lógica.
2. Usa cantidad_promedio como base para cada insumo.
3. Ajusta proporcionalmente si la solicitud difiere de las partidas históricas.
4. Insumos "obligatorio: true" (presencia > 70%) DEBEN incluirse.
5. REGLA ESTRICTA DE MAQUINARIA: Si la descripción del usuario especifica o insinúa trabajo "A MANO" o con "EQUIPO LIVIANO", ESTÁ TOTAL Y ESTRICTAMENTE PROHIBIDO incluir maquinaria pesada (Tractores, Retroexcavadoras, Payloader, Jumbo, Excavadoras, Mototraillas, etc) en el APU. Solo permite herramientas menores o equipos ligeros.
6. Insumos "opcional" (presencia < 30%) solo si son estrictamente necesarios.
7. Si necesitas un insumo no listado, agrégalo con origen "ia" y explica en nota_calculo.

# REGLAS DE INSUMOS
- USA ÚNICAMENTE insumos del catálogo provisto.
- PROHIBIDO inventar precios. Si no existe el insumo exacto, usa el sustituto más cercano.
- Cada sustitución DEBE anotarse en advertencias.

# REGLAS DE CODIFICACIÓN COVENIN
- El campo cod_par debe seguir la Norma COVENIN 2000:1992: 1 letra + 9 dígitos numéricos (total 10 caracteres).
- DEBE comenzar exactamente con el covenin_prefix indicado.
- Usa el covenin_context para elegir el subcódigo correcto; completa con ceros los dígitos restantes.
- Ejemplo correcto: E131110000 (letra E + 9 dígitos).

# DESCRIPCIÓN DE LA PARTIDA
En el campo description de partida, NO copies la solicitud del usuario literalmente.
MEJORA Y EXPANDE para crear una descripción técnica profesional completa, en MAYÚSCULAS,
similar a las normas de medición de ingeniería civil.
Incluye: características del material, método de ejecución, qué incluye/excluye, unidad de medida.

# CAMPO "origen" (OBLIGATORIO en cada insumo)
- "historico": cantidad tomada del APU base sin ajustes mayores.
- "ia": cantidad estimada/ajustada por ti, o insumo añadido por criterio técnico.

# FORMATO DE SALIDA OBLIGATORIO
Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin texto extra antes o después):
{
    "status": "completed",
    "clarification_message": "mensaje si aplica, si no null",
    "options": [],
    "questions": [],
    "partida": {
        "cod_par": "E340000000",
        "description": "DESCRIPCIÓN TÉCNICA COMPLETA EN MAYÚSCULAS. INCLUYE MATERIALES, EQUIPOS Y MANO DE OBRA.",
        "unit": "m2",
        "quantity": 1.0,
        "performance": 10.5
    },
    "materials": [
        {"id":"m-1","codigo":"...","descripcion":"...","unidad":"...","cantidad":0.0,"desperdicio":5,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "equipments": [
        {"id":"e-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"depreciacion":1.0,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "labors": [
        {"id":"l-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"jornal":0.0,"bono":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "advertencias": ["lista de advertencias que generes"]
}`);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) {
        setIsCatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const navigate = useNavigate();
  const { config, setConfig } = useContext(SiteConfigContext);
  
  const {
    searchQuery: search,
    setSearchQuery: setSearch,
    searchCovenin, setSearchCovenin,
    searchDesc, setSearchDesc,
    searchInsumos, setSearchInsumos,
    results: items,
    totalResults: totalItems,
    isSearching: loading,
    hasMore,
    loadMore: handleLoadMore,
    forceSearch: handleSearch
  } = useCost360Search({
    databaseId: 'master',
    limit: 100,
    onlyCoded: onlyCoded,
    autoSearch: true
  });

  const handleToggleGlobalCoded = async (e) => {
    const isChecked = e.target.checked;
    const newConfig = { ...config, forceOnlyCodedMaster: isChecked };
    try {
      const token = localStorage.getItem('arko_admin_token');
      const response = await fetch(`${API_URL}/arko/admin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newConfig)
      });
      if (response.ok) {
        const result = await response.json();
        const updatedConfig = result.config || newConfig;
        setConfig(updatedConfig);
        window.ARKO_SITE_CONFIG = updatedConfig;
        toast.success(isChecked ? "Filtro público ACTIVADO" : "Filtro público DESACTIVADO (El público verá basura)");
      } else {
        toast.error("Error al actualizar la configuración pública");
      }
    } catch(err) {
       toast.error("Error de red");
    }
  };

  const handleToggleCategory = async (code, isVisible) => {
    const hiddenCategories = config?.hiddenCategories || [];
    let newHidden = [...hiddenCategories];
    
    if (isVisible) {
      newHidden = newHidden.filter(c => c !== code);
    } else {
      if (!newHidden.includes(code)) {
        newHidden.push(code);
      }
    }
    
    const newConfig = { ...config, hiddenCategories: newHidden };
    try {
      const token = localStorage.getItem('arko_admin_token');
      const response = await fetch(`${API_URL}/arko/admin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newConfig)
      });
      if (response.ok) {
        const result = await response.json();
        const updatedConfig = result.config || newConfig;
        setConfig(updatedConfig);
        window.ARKO_SITE_CONFIG = updatedConfig;
        toast.success(`Categoría ${code} ${isVisible ? 'ACTIVADA' : 'OCULTADA'} en el Buscador Público`);
      } else {
        toast.error("Error al actualizar la configuración de categorías");
      }
    } catch(err) {
       toast.error("Error de red");
    }
  };

  const handleExportToCsv = async () => {
    if (totalItems === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const toastId = toast.loading('Obteniendo todas las partidas para exportar...');
    let exportItems = [];
    try {
      const response = await cost360Service.fetchItems(0, 50000, search, '', 'master', searchDesc, searchInsumos, searchCovenin, onlyCoded);
      exportItems = response.items || [];
    } catch (err) {
      toast.error('Error al obtener los datos completos', { id: toastId });
      return;
    }
    toast.success('Datos obtenidos, generando Excel...', { id: toastId });

    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sDesc">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sNormal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sNumber">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Partidas">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="100"/>
   <Column ss:Width="450"/>
   <Column ss:Width="60"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">N°</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Código Covenin</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Descripción</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Unidad</Data></Cell>
   </Row>
   ${exportItems.map((item, index) => {
     const descri = (item.Descri || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
     const cov = (item.CovPar || item.CodPar || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     const uni = (item.UniPar || item.Unidad || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     return `<Row ss:Height="24">
    <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="sNormal"><Data ss:Type="String">${cov}</Data></Cell>
    <Cell ss:StyleID="sDesc"><Data ss:Type="String">${descri}</Data></Cell>
    <Cell ss:StyleID="sNormal"><Data ss:Type="String">${uni}</Data></Cell>
   </Row>`;
   }).join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Listado_Partidas_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Listado exportado correctamente a Excel con formato');
  };

  const handleUpdateRAGBrain = async () => {
    const confirm = window.confirm("¿Estás seguro de que deseas actualizar el Cerebro RAG? Este proceso toma de 5 a 15 minutos en segundo plano y consumirá CPU del servidor.");
    if (!confirm) return;
    
    const toastId = toast.loading('Iniciando actualización del Cerebro IA...');
    try {
      const token = localStorage.getItem('arko_admin_token');
      const response = await fetch(`${API_URL}/cost360/rag/update-brain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        toast.success('El Cerebro RAG se está actualizando en el servidor. Estará listo en unos minutos.', { id: toastId, duration: 8000 });
      } else {
        toast.error('Error al iniciar la actualización del Cerebro RAG', { id: toastId });
      }
    } catch(err) {
      toast.error('Error de conexión al servidor', { id: toastId });
    }
  };

  const TABS = [
    { key: 'partidas',   label: 'Partidas (APU)', Icon: FiLayers },
    { key: 'materiales', label: 'Materiales',      Icon: FiBox   },
    { key: 'equipos',    label: 'Equipos',         Icon: FiTool  },
    { key: 'mano_obra',  label: 'Mano de Obra',    Icon: FiUsers },
    { key: 'scraping',   label: 'Scraping',        Icon: FiCpu   },
    { key: 'pdfs',       label: 'Update PDFs',      Icon: FiFileText },
    { key: 'prompt',     label: 'Prompt IA - APU', Icon: FiCpu   },
  ];

  return (
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden gap-4">

      <div className="rounded-2xl relative z-10" style={glassStrong}>
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{
            background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(99,102,241,0.04) 100%)',
            borderBottom: '1px solid rgba(148,163,255,0.2)',
          }}
        >
          <div
            className="p-2.5 rounded-xl shadow-sm"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff' }}
          >
            <FiDatabase size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Explora las Bases de Datos, Insumos, Materiales o Personal</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleUpdateRAGBrain}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <FiDatabase className="w-4 h-4" />
              Actualizar Cerebro RAG
            </button>
            <button 
              onClick={() => navigate('/cost360/market-admin')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Automatización IA
            </button>
          </div>
        </div>

        {/* Selector de Bases de Datos - Justo antes de las pestañas */}
        <div className="px-4 flex justify-end">
          <select
            value={selectedDatabase}
            onChange={(e) => setSelectedDatabase(e.target.value)}
            className="bg-white border-2 border-slate-300 text-slate-700 text-sm font-medium rounded-lg px-4 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm transition-all w-48 appearance-none"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
              paddingRight: '2.5rem',
            }}
          >
            <option value="master">Base Maestra</option>
            <option value="personalizada">Base Personalizada</option>
            <option value="provisional">Base Provisional</option>
            {databases.filter(db => db.id !== 'master' && db.is_master !== true).map(db => (
              <option key={db.id} value={db.id}>{db.name}</option>
            ))}
          </select>
        </div>

        <div className="px-4 flex justify-between items-end pt-2 pb-0">
          <div className="flex gap-1">
            {TABS.map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all duration-200 btn-borde-azul-redondeado ${
                    active
                      ? 'text-blue-700 border-blue-600 bg-blue-50/60'
                      : 'text-slate-500 border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
          {activeTab === 'partidas' && (
            <div className="pb-2 flex flex-col sm:flex-row items-end gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg" title="Afecta a todos los usuarios del sistema">
                <input 
                  type="checkbox" 
                  id="globalCoded" 
                  checked={config?.forceOnlyCodedMaster === true} 
                  onChange={handleToggleGlobalCoded} 
                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="globalCoded" className="text-sm font-bold text-indigo-900 cursor-pointer">
                  Filtro Público Global
                </label>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <input 
                  type="checkbox" 
                  id="onlyCoded" 
                  checked={onlyCoded} 
                  onChange={(e) => setOnlyCoded(e.target.checked)} 
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="onlyCoded" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Filtro Local (Tu vista)
                </label>
              </div>
            </div>
          )}
        </div>
        {activeTab === 'partidas' && (
          <div className="px-6 pb-3 pt-2 bg-slate-50/50 border-t border-slate-200/50 flex flex-col gap-2 relative" ref={catMenuRef}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Gestión de Categorías:</span>
              <button 
                onClick={() => setIsCatMenuOpen(!isCatMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Configurar Visibilidad</span>
                <svg className={`w-4 h-4 transition-transform ${isCatMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
            
            {isCatMenuOpen && (
              <div className="absolute top-full left-6 mt-1 w-[400px] z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {coveninTreeData.map(cat => {
                  const isVisible = !(config?.hiddenCategories || []).includes(cat.code);
                  return (
                    <div key={cat.code} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${isVisible ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-100 opacity-60 hover:opacity-100'}`}>
                      <input 
                        type="checkbox" 
                        id={`cat_${cat.code}`}
                        checked={isVisible}
                        onChange={(e) => handleToggleCategory(cat.code, e.target.checked)}
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
        )}
        <div className="h-px" style={{ background: 'linear-gradient(90deg,rgba(148,163,255,0.4),transparent)' }} />
      </div>

      {activeTab === 'partidas' && (
        <>
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={glass}>
            <Cost360SearchBar
              searchQuery={search}
              setSearchQuery={setSearch}
              searchCovenin={searchCovenin}
              setSearchCovenin={setSearchCovenin}
              searchDesc={searchDesc}
              setSearchDesc={setSearchDesc}
              searchInsumos={searchInsumos}
              setSearchInsumos={setSearchInsumos}
              isSearching={loading}
              onSearch={handleSearch}
            />

            {totalItems > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">
                  <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalItems)}</span>{' '}
                  {search ? 'coincidencias' : 'Total Partidas'}
                </p>
                <button
                  onClick={handleExportToCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <FiDownload size={12} />
                  Exportar a Excel
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl overflow-y-auto flex-1 min-h-0 flex flex-col" style={glassStrong}>
            <div className="flex-1">
            {items.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'rgba(148,163,255,0.15)' }}>
                {items.map((item) => (
                  <li
                    key={item.CodPar}
                    className="group transition-all duration-200 border-l-4 border-transparent hover:border-blue-600 hover:bg-blue-50/90 hover:shadow-md hover:translate-x-1"
                  >
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/cost360/apu/${item.CodPar}`)}>
                        <div
                          className="mt-0.5 p-2 rounded-lg shrink-0 transition-colors duration-150"
                          style={{ background: 'rgba(219,234,254,0.8)', color: '#2563eb' }}
                        >
                          <FiLayers size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 font-mono mb-1">{item.CovPar || item.CodPar}</p>
                          <p className="text-sm text-slate-700 font-medium line-clamp-2 max-w-3xl group-hover:text-slate-900 transition-colors">{item.Descri}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(241,245,249,0.9)', color: '#475569', border: '1px solid rgba(148,163,184,0.3)' }}
                        >
                          {item.UniPar}
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition"
                            title="Editar Partida"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm("¿Estás seguro de eliminar esta partida maestra? Esto es irreversible y afectará a todos.")) {
                                try {
                                  await cost360Service.deleteMasterItem(item.CodPar);
                                  toast.success("Partida eliminada");
                                  handleSearch();
                                } catch (err) {
                                  toast.error("Error al eliminar partida");
                                }
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition"
                            title="Eliminar Partida"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !loading ? (
              <div className="py-20 text-center">
                <FiLayers size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400 text-sm">No se encontraron partidas con ese criterio.</p>
              </div>
            ) : null}

            {loading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            )}
          </div>

            {hasMore && !loading && items.length > 0 && (
              <div className="flex justify-center py-4 pb-8 shrink-0">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-2.5 rounded-full text-sm font-semibold text-blue-700 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 hover:bg-white"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: '1.5px solid rgba(37,99,235,0.3)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Cargar Más Partidas
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'materiales' && (
        <>
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={glass}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 font-medium">
                Actualización en masa
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkPriceModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
                >
                  <FiDownload size={16} />
                  Actualizar Precios
                </button>
                <button
                  onClick={() => setShowBulkDescModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
                >
                  <FiUpload size={16} />
                  Actualizar Descripciones
                </button>
              </div>
            </div>
          </div>

          <CatalogResourceTab
            key={`mat-${selectedDatabase}`}
            title="Materiales"
            resourceType="materials"
            selectedDatabase={selectedDatabase}
            adminMode={true}
            config={{
              idKey: 'CodMat', descKey: 'Descri',
              editableFields: [
                { key: 'Descri', label: 'Descripción', type: 'text' },
                { key: 'UniMat', label: 'Unidad', type: 'text' },
                { key: 'CosMat', label: 'Precio Unitario ($)' }
              ]
            }}
          />

          {showBulkPriceModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-slate-800">Actualizar Precios en Masa</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Pega los precios en formato: MAT1234: $1000 (uno por línea)
                  </p>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <textarea
                    value={bulkPriceText}
                    onChange={(e) => setBulkPriceText(e.target.value)}
                    placeholder="MAT1347: $950 USD&#10;MAT1348: $1,350 USD&#10;MAT1349: $1,700 USD"
                    className="w-full h-64 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowBulkPriceModal(false);
                        setBulkPriceText('');
                      }}
                      className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        // Procesar el texto
                        const lines = bulkPriceText.split('\n').filter(line => line.trim());
                        const updates = [];

                        for (const line of lines) {
                          // Match format: MATXXXX: $YYYY USD o MATXXXX: $YYYY o TAB format: MATXXXX	$YYYY
                          // Soporta formato europeo ($3.214,06) y americano ($3,214.06)
                          const match = line.match(/([A-Z]+\d+)[:\t]\s*\$?([\d.,]+)/);
                          if (match) {
                            const codigo = match[1];
                            let precioStr = match[2];
                            // Convertir formato europeo a americano: 3.214,06 -> 3214.06
                            if (precioStr.includes('.') && precioStr.includes(',')) {
                              precioStr = precioStr.replace(/\./g, '').replace(',', '.');
                            } else {
                              precioStr = precioStr.replace(/,/g, '');
                            }
                            const precio = parseFloat(precioStr);
                            if (!isNaN(precio)) {
                              updates.push({ codigo, precio });
                            }
                          }
                        }

                        if (updates.length === 0) {
                          toast.error('No se encontraron precios válidos para actualizar');
                          return;
                        }

                        try {
                          const token = localStorage.getItem('arko_admin_token');

                          const response = await fetch(`${API_URL}/cost360/materials/bulk-update`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ updates })
                          });

                          if (response.ok) {
                            const result = await response.json();

                            // Mostrar toast de éxito
                            toast.success(`${result.updated || updates.length} precios actualizados correctamente`, {
                              duration: 3000, // 3 segundos para que el usuario pueda verlo
                            position: 'top-center'
                            });

                            // Cerrar modal y limpiar texto
                            setShowBulkPriceModal(false);
                            setBulkPriceText('');

                            // Recargar solo los datos de materiales, no la página completa
                            setTimeout(() => {
                              handleSearch(); // Recargar búsqueda de materiales
                            }, 1000); // Retraso de 1 segundo para que el usuario vea el toast

                          } else {
                            const errorText = await response.text();
                            toast.error(`Error al actualizar precios: ${response.status}`);
                          }
                        } catch (err) {
                          toast.error('Error de conexión al servidor');
                        }
                      }}
                      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Actualizar {bulkPriceText.split('\n').filter(line => line.trim()).length} Precios
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showBulkDescModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-slate-800">Actualizar Descripciones en Masa</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Sube un archivo Excel con columnas: Código, Descripción
                  </p>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setBulkDescFile(e.target.files[0])}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label
                      htmlFor="excel-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <FiUpload size={32} className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {bulkDescFile ? bulkDescFile.name : 'Click para seleccionar archivo Excel'}
                      </span>
                      <span className="text-xs text-gray-400">Formato: .xlsx o .xls</span>
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowBulkDescModal(false);
                        setBulkDescFile(null);
                      }}
                      className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        if (!bulkDescFile) {
                          toast.error('Por favor selecciona un archivo Excel');
                          return;
                        }

                        try {
                          const formData = new FormData();
                          formData.append('file', bulkDescFile);

                          const token = localStorage.getItem('arko_admin_token');

                          const response = await fetch(`${API_URL}/cost360/materials/bulk-update-descriptions`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`
                            },
                            body: formData
                          });

                          if (response.ok) {
                            const result = await response.json();

                            toast.success(`${result.updated || 0} descripciones actualizadas correctamente`, {
                              duration: 3000,
                              position: 'top-center'
                            });

                            setShowBulkDescModal(false);
                            setBulkDescFile(null);

                            setTimeout(() => {
                              handleSearch();
                            }, 1000);

                          } else {
                            const errorData = await response.json();
                            toast.error(errorData.detail || `Error al actualizar descripciones: ${response.status}`);
                          }
                        } catch (err) {
                          toast.error('Error de conexión al servidor');
                        }
                      }}
                      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Actualizar Descripciones
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'equipos' && (
        <CatalogResourceTab
          key={`eq-${selectedDatabase}`}
          title="Equipos"
          resourceType="equipments"
          selectedDatabase={selectedDatabase}
          adminMode={true}
          config={{
            idKey: 'CodEqu', descKey: 'Descri',
            editableFields: [{ key: 'CosDia', label: 'Costo Diario ($)' }]
          }}
        />
      )}

      {activeTab === 'mano_obra' && (
        <CatalogResourceTab
          key={`mo-${selectedDatabase}`}
          title="Mano de Obra"
          resourceType="labors"
          selectedDatabase={selectedDatabase}
          adminMode={true}
          config={{
            idKey: 'CodMan', descKey: 'Descri',
            editableFields: [
              { key: 'Jornal', label: 'Jornal Base ($)' },
              { key: 'Bono', label: 'Bono ($)' }
            ]
          }}
        />
      )}

      {activeTab === 'scraping' && (
        <ScrapingDashboardProvider>
          <ScrapingDashboard />
        </ScrapingDashboardProvider>
      )}

      {activeTab === 'pdfs' && (
        <PDFUpdaterTab />
      )}

      {activeTab === 'prompt' && (
        <div className="rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto max-h-full" style={glass}>
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Prompt IA - APU</h2>
              <p className="text-sm text-slate-600 mt-1">
                Configura el prompt que usa la IA para generar Partidas APU (Solo Admin)
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-slate-700">Prompt para generación de APU:</label>
              <button
                onClick={() => {
                  const backendPrompt = `# ROL
Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU).
Recibes un payload con rendimientos históricos calculados a partir de partidas similares
reales de la base de datos, un catálogo de insumos filtrado y advertencias.
Tu trabajo es construir un APU técnico y completo basándote estrictamente en esta data.

# REGLAS DE CLARIFICACIÓN (¡MUY IMPORTANTE!)
Dirígete SIEMPRE al usuario en segunda persona ("Tu solicitud", "Estás pidiendo").

1. **Incongruencia Total (PRIORIDAD 1):** Si la solicitud NO corresponde lógicamente con
   el covenin_context, prohíbite generar el APU. Informa al usuario y pídele que corrija.
2. **Falta de datos críticos:** Si faltan datos clave (espesor, material, dimensiones),
   haz 1-3 preguntas de clarificación. No inventes datos críticos.
3. **Confirmación de partidas históricas:** Si partidas_encontradas > 0 y la descripción
   no es exactamente una de ellas, devuelve status: "clarification_needed" con las
   partidas históricas como options para que el usuario confirme.
4. Si el usuario ya respondió (ver historial), genera el APU directamente con status: "completed".

# PAYLOAD DEL SISTEMA (datos históricos y catálogo)
{payload_llm será inyectado aquí}
{history_text}

# REGLAS DE INTERPRETACIÓN
1. Si hay múltiples unidades en rendimientos_historicos_por_unidad_partida, elige la más lógica.
2. Usa cantidad_promedio como base para cada insumo.
3. Ajusta proporcionalmente si la solicitud difiere de las partidas históricas.
4. Insumos "obligatorio: true" (presencia > 70%) DEBEN incluirse.
5. REGLA ESTRICTA DE MAQUINARIA: Si la descripción del usuario especifica o insinúa trabajo "A MANO" o con "EQUIPO LIVIANO", ESTÁ TOTAL Y ESTRICTAMENTE PROHIBIDO incluir maquinaria pesada (Tractores, Retroexcavadoras, Payloader, Jumbo, Excavadoras, Mototraillas, etc) en el APU. Solo permite herramientas menores o equipos ligeros.
6. Insumos "opcional" (presencia < 30%) solo si son estrictamente necesarios.
7. Si necesitas un insumo no listado, agrégalo con origen "ia" y explica en nota_calculo.

# REGLAS DE INSUMOS
- USA ÚNICAMENTE insumos del catálogo provisto.
- PROHIBIDO inventar precios. Si no existe el insumo exacto, usa el sustituto más cercano.
- Cada sustitución DEBE anotarse en advertencias.

# REGLAS DE CODIFICACIÓN COVENIN
- El campo cod_par debe seguir la Norma COVENIN 2000:1992: 1 letra + 9 dígitos numéricos (total 10 caracteres).
- DEBE comenzar exactamente con el covenin_prefix indicado.
- Usa el covenin_context para elegir el subcódigo correcto; completa con ceros los dígitos restantes.
- Ejemplo correcto: E131110000 (letra E + 9 dígitos).

# DESCRIPCIÓN DE LA PARTIDA
En el campo description de partida, NO copies la solicitud del usuario literalmente.
MEJORA Y EXPANDE para crear una descripción técnica profesional completa, en MAYÚSCULAS,
similar a las normas de medición de ingeniería civil.
Incluye: características del material, método de ejecución, qué incluye/excluye, unidad de medida.

# CAMPO "origen" (OBLIGATORIO en cada insumo)
- "historico": cantidad tomada del APU base sin ajustes mayores.
- "ia": cantidad estimada/ajustada por ti, o insumo añadido por criterio técnico.

# FORMATO DE SALIDA OBLIGATORIO
Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin texto extra antes o después):
{
    "status": "completed",
    "clarification_message": "mensaje si aplica, si no null",
    "options": [],
    "questions": [],
    "partida": {
        "cod_par": "E340000000",
        "description": "DESCRIPCIÓN TÉCNICA COMPLETA EN MAYÚSCULAS. INCLUYE MATERIALES, EQUIPOS Y MANO DE OBRA.",
        "unit": "m2",
        "quantity": 1.0,
        "performance": 10.5
    },
    "materials": [
        {"id":"m-1","codigo":"...","descripcion":"...","unidad":"...","cantidad":0.0,"desperdicio":5,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "equipments": [
        {"id":"e-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"depreciacion":1.0,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "labors": [
        {"id":"l-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"jornal":0.0,"bono":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "advertencias": ["lista de advertencias que generas"]
}`;
                  setPromptText(backendPrompt);
                  toast.success('Prompt restaurado al valor del backend');
                }}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-slate-700 px-3 py-1 rounded transition-colors"
              >
                Restaurar Backend
              </button>
            </div>

            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full h-96 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Escribe tu prompt aquí..."
            />

            <div className="flex gap-2 justify-end shrink-0">
              <button
                onClick={() => {
                  localStorage.setItem('apu_prompt', promptText);
                  toast.success('Prompt guardado exitosamente');
                }}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Guardar Prompt
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(promptText);
                  toast.success('Prompt copiado al portapapeles');
                }}
                className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Editar Partida {editingItem.CodPar}</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Descripción</label>
                <textarea
                  value={editingItem.Descri}
                  onChange={(e) => setEditingItem({...editingItem, Descri: e.target.value})}
                  className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unidad</label>
                  <input
                    type="text"
                    value={editingItem.UniPar}
                    onChange={(e) => setEditingItem({...editingItem, UniPar: e.target.value})}
                    className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Rendimiento</label>
                  <input
                    type="number"
                    value={editingItem.RenPar}
                    onChange={(e) => setEditingItem({...editingItem, RenPar: parseFloat(e.target.value) || 0})}
                    className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await cost360Service.updateMasterItem(editingItem.CodPar, {
                      Descri: editingItem.Descri,
                      UniPar: editingItem.UniPar,
                      RenPar: editingItem.RenPar
                    });
                    toast.success("Partida actualizada");
                    setEditingItem(null);
                    handleSearch();
                  } catch (err) {
                    toast.error("Error al actualizar");
                  }
                }}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                <FiSave size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDatabasePage;

