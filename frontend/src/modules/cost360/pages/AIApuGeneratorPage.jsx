import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, Package, Wrench, Users, Calculator, Save, Sparkles, Check, Filter, Plus, Search, FileText, Trash2, AlertTriangle, Database, Layers, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateAIApu, saveCustomApu, fetchCategoriesTree, fetchItems, fetchApuDetails, smartSelect, generateAIApuFromBase } from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import Cost360SearchBar from '../components/Cost360SearchBar';
import { useCost360Search } from '../hooks/useCost360Search';
import ApuEditorUI from '../../../components/ApuEditorUI';
import coveninTreeData from '../data/covenin_tree.json';
import ExportApuExcelButton from '../components/ExportApuExcelButton';
import PrintAPUModal from '../../../components/PrintAPUModal';
import PrintAPULayout from '../../../components/PrintAPULayout';

export default function AIApuGeneratorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  
  const [creationMode, setCreationMode] = useState(modeParam || 'ia'); // 'ia', 'manual', 'import'
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(null);
  const searchTimeoutRef = useRef(null);
  
  // Conversational AI States
  const [chatHistory, setChatHistory] = useState([]);
  const [aiClarificationMessage, setAiClarificationMessage] = useState("");
  const [aiOptions, setAiOptions] = useState([]);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [isClarifying, setIsClarifying] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Smart Selector States
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [smartData, setSmartData] = useState(null);
  const [smartAnswers, setSmartAnswers] = useState({});
  const [basePrompt, setBasePrompt] = useState("");
  const [smartCustomInput, setSmartCustomInput] = useState("");
  const [showSmartCustomInput, setShowSmartCustomInput] = useState(false);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

  useEffect(() => {
    if (printOptions) {
      const handleAfterPrint = () => {
        setPrintOptions(null);
        setPrintModalOpen(false);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      setTimeout(() => {
        window.print();
      }, 300);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
    }
  }, [printOptions]);

  const [coveninTree] = useState(coveninTreeData);
  const [selectedTipoObra, setSelectedTipoObra] = useState('');
  const [selectedCapitulo, setSelectedCapitulo] = useState('');
  const [selectedSubcapitulo, setSelectedSubcapitulo] = useState('');
  const [selectedPartida, setSelectedPartida] = useState('');
  const [matchCount, setMatchCount] = useState(null);
  const [categoryHints, setCategoryHints] = useState([]);
  const [previewItems, setPreviewItems] = useState([]);
  const currentPrefix = selectedPartida || selectedSubcapitulo || selectedCapitulo || selectedTipoObra;
  
  useEffect(() => {
    if (currentPrefix) {
      fetchItems(0, 100, '', currentPrefix)
        .then(res => {
          setMatchCount(res.total);
          const items = res.items || [];
          setPreviewItems(items);
          if (items.length > 0) {
            // Stopwords generales + dominio de la construcción
            const stopWords = new Set([
              'de','la','el','en','con','sin','para','y','o','los','las','del',
              'a','un','una','segun','se','su','por','uso','que','al','sus','este',
              'esta','como','no','mas','pero','son','fue','han','ha','me','te','mi',
              // Palabras técnicas genéricas (aparecen en casi todo)
              'area','medido','medida','incluye','incluir','incluyen','incluyendo',
              'utilizando','utilizando','materiales','material','construccion',
              'infraestructura','recuperacion','correspondiente','dimensiones',
              'nivel','segun','area','piso','tipo','clase','diametro','espesor',
              'metros','metro','largo','ancho','alto','total','general',
            ]);

            const totalDocs = items.length;
            // Contar en cuántos documentos aparece cada palabra (document frequency)
            const docFreq = {};
            items.forEach(item => {
              if (!item.Descri) return;
              const uniqueWords = new Set(
                item.Descri.toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
                  .replace(/[^a-z]/g, ' ')
                  .split(/\s+/)
                  .filter(w => w.length > 3 && !stopWords.has(w))
              );
              uniqueWords.forEach(w => {
                docFreq[w] = (docFreq[w] || 0) + 1;
              });
            });

            // Calcular IDF-like score: palabras que aparecen en 10%-75% de los docs
            // son las más distintivas. Las que aparecen en el 100% son genéricas.
            const minDocs = Math.max(1, Math.ceil(totalDocs * 0.10)); // al menos 10%
            const maxDocs = Math.ceil(totalDocs * 0.75);              // máximo 75%

            const keywords = Object.entries(docFreq)
              .filter(([, count]) => count >= minDocs && count <= maxDocs)
              .sort((a, b) => {
                // Favorece palabras en rango óptimo (~33% de docs)
                const idealRatio = 0.33;
                const ratioA = a[1] / totalDocs;
                const ratioB = b[1] / totalDocs;
                return Math.abs(ratioA - idealRatio) - Math.abs(ratioB - idealRatio);
              })
              .slice(0, 10)
              .map(entry => entry[0]);

            setCategoryHints(keywords);
          } else {
            setCategoryHints([]);
          }
        })
        .catch(() => {
          setMatchCount(0);
          setCategoryHints([]);
          setPreviewItems([]);
        });
    } else {
      setMatchCount(null);
      setCategoryHints([]);
      setPreviewItems([]);
    }
  }, [currentPrefix]);
  
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState('master');
  
  const {
    searchQuery, setSearchQuery,
    searchCovenin, setSearchCovenin,
    searchDesc, setSearchDesc,
    searchInsumos, setSearchInsumos,
    results: searchResults,
    totalResults: totalMatches,
    isSearching,
    forceSearch: triggerSearch
  } = useCost360Search({
    databaseId: selectedDatabase,
    onlyCoded: window.ARKO_SITE_CONFIG?.only_coded_items || false,
    limit: 50,
    autoSearch: creationMode === 'import'
  });

  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const dbs = await cost360DatabaseService.getAll();
        const loadedDbs = dbs.databases || [];
        if (!loadedDbs.find(db => db.id === 'personalizada')) {
          loadedDbs.push({ id: 'personalizada', name: 'Base Personalizada', is_master: false });
        }
        setDatabases(loadedDbs);
      } catch (err) {
        console.error("Error loading databases", err);
      }
    };
    loadDatabases();
  }, []);

  // Defaults for calculations
  const [settings, setSettings] = useState({
    fcas_percent: 417,
    admin_percent: 15.0,
    profit_percent: 10.0,
    iva_percent: 16.0,
    labor_bonus: 0,
    currency: 'USD'
  });

  const handleCreateManual = () => {
    setItem({
      cod_par: "CUST-" + Math.floor(Math.random() * 10000),
      description: "Nueva Partida Personalizada",
      unit: "und",
      performance: 1,
      materials: [],
      equipments: [],
      labors: [],
      advertencias: []
    });
  };

  useEffect(() => {
    if (modeParam === 'manual') {
      setCreationMode('manual');
      handleCreateManual();
    } else if (modeParam === 'import') {
      setCreationMode('import');
      setItem(null);
    } else if (modeParam === 'ia') {
      setCreationMode('ia');
      setItem(null);
    }
  }, [modeParam]);

  // Removed manual triggerSearch and useEffect since useCost360Search handles it
  const handleImportApu = async (itemCode) => {
    try {
      setLoading(true);
      const data = await fetchApuDetails(itemCode, selectedDatabase);
      
      setItem({
        cod_par: data.partida.CodPar,
        description: data.partida.Descri,
        unit: data.partida.UniPar,
        performance: data.partida.RenPar || 1,
        materials: (data.materiales || []).map(m => ({ id: m.codigo, codigo: m.codigo, descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, precio_unitario: m.precio_unitario, desperdicio: m.desperdicio || 5, origen: 'historico' })),
        equipments: (data.equipos || []).map(e => ({ id: e.codigo, codigo: e.codigo, descripcion: e.descripcion, unidad: 'día', cantidad: e.cantidad, precio_unitario: e.precio_unitario, depreciacion: e.depreciacion || 1.0, origen: 'historico' })),
        labors: (data.mano_obra || []).map(l => ({ id: l.codigo, codigo: l.codigo, descripcion: l.descripcion, unidad: 'día', cantidad: l.cantidad, jornal: l.jornal, bono: l.bono, origen: 'historico' })),
        advertencias: []
      });
      toast.success('APU importado correctamente. Ahora puedes editarlo.');
      setSearchQuery('');
    } catch(err) {
      console.error(err);
      toast.error('Error importando APU');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreprocess = () => {
    handleGenerate(null, true);
  };

  const handleGenerate = async (overridePrompt = null, onlyPreprocess = false, bypassSmart = false) => {
    const textToSubmit = overridePrompt !== null ? overridePrompt : prompt;
    if (!textToSubmit.trim()) {
      toast.error("Ingresa una descripción para generar el APU");
      return;
    }
    if (!selectedSubcapitulo) {
      toast.error("Debes seleccionar al menos el Subcapítulo para guiar a la IA");
      return;
    }
    const currentSub = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.find(c => c.code === selectedSubcapitulo);
    const hasFourthLevel = currentSub?.children?.length > 0;
    if (hasFourthLevel && !selectedPartida) {
      toast.error("Debes seleccionar la Partida Base para guiar a la IA");
      return;
    }
    setLoading(true);
    setItem(null);
    try {
      const tipo = coveninTree.find(c => c.code === selectedTipoObra);
      const cap = tipo?.children?.find(c => c.code === selectedCapitulo);
      const sub = cap?.children?.find(c => c.code === selectedSubcapitulo);
      const par = sub?.children?.find(c => c.code === selectedPartida);
      
      let context = `${tipo?.name || ''} > ${cap?.name || ''} > ${sub?.name || ''}`;
      if (par) {
        context += ` > ${par.name || ''}`;
      }
      
      const nodeForChildren = par || sub;
      
      if (nodeForChildren?.children && nodeForChildren.children.length > 0) {
        context += `\n\nSubcategorías COVENIN disponibles para asignar el código:\n`;
        nodeForChildren.children.forEach(child => {
          context += `- ${child.code}: ${child.name}\n`;
        });
      }

      const prefixToSend = selectedPartida || selectedSubcapitulo;

      // ---- SMART SELECTOR LOGIC ----
      if (!onlyPreprocess && !bypassSmart && !isClarifying && !isSmartMode) {
        const smartRes = await smartSelect(textToSubmit, prefixToSend, context, smartAnswers);
        
        if (!smartRes.ready_to_generate && smartRes.questions && smartRes.questions.length > 0) {
          setSmartData(smartRes);
          setIsSmartMode(true);
          setBasePrompt(textToSubmit);
          setLoading(false);
          return; // Pausar para esperar respuesta del usuario
        }
        
        // Si ya está listo (porque hubo match o respondio todo) y hay un best_match
        if (smartRes.ready_to_generate && smartRes.best_match) {
          const response = await generateAIApuFromBase(textToSubmit, prefixToSend, context, smartRes.best_match.codpar, smartAnswers);
          processAIResponse(response, textToSubmit);
          setIsSmartMode(false);
          setSmartData(null);
          return;
        }
      }
      
      const newHistory = isClarifying ? [...chatHistory, { role: 'user', content: textToSubmit }] : [{ role: 'user', content: textToSubmit }];
      
      // Llamada normal (sin partida base o bypass)
      const response = await generateAIApu(textToSubmit, prefixToSend, context, newHistory, onlyPreprocess);
      processAIResponse(response, textToSubmit);
      
    } catch (error) {
      console.error(error);
      toast.error("Error al generar APU con IA");
    } finally {
      setLoading(false);
    }
  };

  const processAIResponse = (response, textToSubmit) => {
    if (response.debug_preprocesamiento) {
      setDebugInfo(response.debug_preprocesamiento);
    } else if (response.debug_base_apu) {
      setDebugInfo({ message: "APU adaptado desde partida base (Smart Selector)", base_apu: response.debug_base_apu });
    } else {
      setDebugInfo(null);
    }
    
    if (response.status === 'clarification_needed') {
      const newHistory = isClarifying ? [...chatHistory, { role: 'user', content: textToSubmit }] : [{ role: 'user', content: textToSubmit }];
      setChatHistory(newHistory);
      setAiClarificationMessage(response.clarification_message || "La IA necesita clarificación:");
      setAiOptions(response.options || []);
      setAiQuestions(response.questions || []);
      setIsClarifying(true);
      setPrompt('');
      toast.error("La IA detectó un problema o necesita más detalles", { icon: '🤔' });
    } else {
      setIsClarifying(false);
      setChatHistory([]);
      setAiClarificationMessage("");
      setAiOptions([]);
      setAiQuestions([]);
      // Map response to the format expected by the editor
      setItem({
        ...response.partida,
        materials: response.materials || [],
        equipments: response.equipments || [],
        labors: response.labors || [],
        advertencias: response.advertencias || []
      });
      toast.success("APU generado con IA");
    }
  };

  const handleSmartAnswer = async (questionId, optionValue) => {
    const newAnswers = { ...smartAnswers, [questionId]: optionValue };
    setSmartAnswers(newAnswers);
    
    // Disparar validación de nuevo
    setLoading(true);
    try {
      const prefixToSend = selectedPartida || selectedSubcapitulo;
      const smartRes = await smartSelect(basePrompt, prefixToSend, "", newAnswers);
      
      if (!smartRes.ready_to_generate && smartRes.questions && smartRes.questions.length > 0) {
        setSmartData(smartRes);
      } else {
        // Listo para generar!
        if (smartRes.best_match) {
          const response = await generateAIApuFromBase(basePrompt, prefixToSend, "", smartRes.best_match.codpar, newAnswers);
          processAIResponse(response, basePrompt);
        } else {
          // Fallback a generación normal
          const response = await generateAIApu(basePrompt, prefixToSend, "", [], false);
          processAIResponse(response, basePrompt);
        }
        setIsSmartMode(false);
        setSmartData(null);
        setSmartAnswers({});
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar respuesta");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await saveCustomApu({
        description: item.description,
        unit: item.unit,
        performance: item.performance,
        apu_data: JSON.stringify(item)
      });
      toast.success("APU guardado exitosamente");
      // Se mantiene en la pantalla de clonación para seguir editando o crear otra
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar APU");
    } finally {
      setSaving(false);
    }
  };

  const handleComponentChange = (type, compId, field, value) => {
    setItem(prev => {
      const updated = { ...prev };
      updated[type] = updated[type].map(c => {
        if (c.id === compId) {
          // If it's a numeric field, parse it
          const isNumeric = ['cantidad', 'precio_unitario', 'desperdicio', 'depreciacion', 'jornal'].includes(field);
          return { ...c, [field]: isNumeric ? (parseFloat(value) || 0) : value };
        }
        return c;
      });
      return updated;
    });
  };

  const handleAddRow = (type) => {
    setItem(prev => {
      const updated = { ...prev };
      const newRow = {
        id: "NEW-" + Math.floor(Math.random() * 100000),
        codigo: "",
        descripcion: "",
        cantidad: 1,
        precio_unitario: 0,
      };
      
      if (type === 'materials') {
        newRow.unidad = "und";
        newRow.desperdicio = 0;
      } else if (type === 'equipments') {
        newRow.depreciacion = 1.0;
      } else if (type === 'labors') {
        newRow.jornal = 0;
      }
      
      updated[type] = [...(updated[type] || []), newRow];
      return updated;
    });
  };

  const handleRemoveRow = (type, rowId) => {
    setItem(prev => {
      const updated = { ...prev };
      updated[type] = updated[type].filter(c => c.id !== rowId);
      return updated;
    });
  };

  const renderOrigenTag = (origen) => {
    if (origen === 'historico') return <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[9px] font-bold rounded shadow-sm border border-green-200" title="Cantidad basada en promedio de partidas históricas">HISTÓRICO</span>;
    if (origen === 'ia') return <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-bold rounded shadow-sm border border-yellow-200" title="Cantidad ajustada/estimada por IA. Revisar.">ESTIMADO IA</span>;
    if (origen === 'faltante') return <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold rounded shadow-sm border border-red-200" title="Insumo no existe en catálogo. Precio = 0. Agregar antes de usar.">FALTANTE</span>;
    return null;
  };

  // Calculations
  const calculateMaterialTotal = () => {
    return item?.materials?.reduce((sum, mat) => {
      return sum + (mat.cantidad * mat.precio_unitario * (1 + (mat.desperdicio || 0) / 100));
    }, 0) || 0;
  };

  const calculateEquipmentTotalDay = () => {
    return item?.equipments?.reduce((sum, eq) => {
      return sum + (eq.cantidad * (eq.depreciacion ?? 1.0) * eq.precio_unitario);
    }, 0) || 0;
  };

  const calculateLaborTotalJornalDay = () => {
    return item?.labors?.reduce((sum, lab) => {
      return sum + (lab.cantidad * lab.jornal);
    }, 0) || 0;
  };

  const calculateLaborTotalBonoDay = () => {
    return item?.labors?.reduce((sum, lab) => {
      return sum + (lab.cantidad * settings.labor_bonus);
    }, 0) || 0;
  };

  const calculateLaborTotalDay = () => {
    const totJornal = calculateLaborTotalJornalDay();
    const totBono = calculateLaborTotalBonoDay();
    const fcasMonto = totJornal * (settings.fcas_percent / 100);
    return totJornal + totBono + fcasMonto;
  };

  const calculateCostosDirectos = () => {
    const matTotal = calculateMaterialTotal();
    const eqTotal = calculateEquipmentTotalDay() / (item?.performance || 1);
    const labTotal = calculateLaborTotalDay() / (item?.performance || 1);
    
    return {
      materiales: matTotal,
      equipos: eqTotal,
      manoObra: labTotal,
      subtotalA: matTotal + eqTotal + labTotal
    };
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/cost360')}
            className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {creationMode === 'manual' ? <Plus size={20} className="text-blue-600" /> : creationMode === 'import' ? <FileText size={20} className="text-indigo-600" /> : <Sparkles size={20} className="text-red-500" />}
            {creationMode === 'manual' ? 'Nuevo APU (Desde Cero)' : creationMode === 'import' ? 'Importar / Clonar APU' : 'Generador de APU con IA'}
          </h2>
        </div>
      </div>


      {creationMode === 'import' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(248, 250, 252, 0.5)' }}>
            {/* Database and Mode Selectors Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-bold text-slate-500 mb-1">Explora las Bases de Datos, Insumos, Materiales o Personal</label>
                <select
                  value={selectedDatabase}
                  onChange={(e) => setSelectedDatabase(e.target.value)}
                  className="block w-full sm:w-64 px-4 py-2.5 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all appearance-none font-medium bg-white/60 border border-indigo-200/50 shadow-sm"
                  style={{
                    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.2em 1.2em',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="master">Base Maestra (Defecto)</option>
                  {databases.map(db => (
                    <option key={db.id} value={db.id}>{db.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <Cost360SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchCovenin={searchCovenin}
              setSearchCovenin={setSearchCovenin}
              searchDesc={searchDesc}
              setSearchDesc={setSearchDesc}
              searchInsumos={searchInsumos}
              setSearchInsumos={setSearchInsumos}
              isSearching={isSearching}
              onSearch={triggerSearch}
              hideSearchButton={false}
            />
          </div>

          <div className="mt-2 text-xs text-slate-500 font-medium">
            {totalMatches > 0 ? new Intl.NumberFormat('es-VE').format(totalMatches) : 0} coincidencias
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <ul className="divide-y divide-slate-100">
                {searchResults.map((res) => (
                  <li key={res.CodPar} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-slate-800 font-mono mb-1">{res.CovPar || res.CodPar}</p>
                      <p className="text-xs text-slate-600 line-clamp-1">{res.Descri}</p>
                    </div>
                    <button
                      onClick={() => handleImportApu(res.CodPar)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 shrink-0 transition-colors"
                    >
                      Usar como base
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {creationMode === 'ia' && (() => {
        const currentSub = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.find(c => c.code === selectedSubcapitulo);
        const hasFourthLevel = currentSub?.children?.length > 0;
        const isSelectorsComplete = selectedTipoObra && selectedCapitulo && selectedSubcapitulo && (!hasFourthLevel || selectedPartida);
        
        return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* FILTERS */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Obra</label>
              <select 
                value={selectedTipoObra}
                onChange={(e) => {
                  setSelectedTipoObra(e.target.value);
                  setSelectedCapitulo('');
                  setSelectedSubcapitulo('');
                  setSelectedPartida('');
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="">Selecciona el Tipo...</option>
                {coveninTree.map(cat => (
                  <option key={cat.code} value={cat.code}>{cat.code} - {cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capítulo</label>
              <select 
                value={selectedCapitulo}
                onChange={(e) => {
                  setSelectedCapitulo(e.target.value);
                  setSelectedSubcapitulo('');
                  setSelectedPartida('');
                }}
                disabled={!selectedTipoObra}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
              >
                <option value="">Selecciona el Capítulo...</option>
                {selectedTipoObra && coveninTree.find(c => c.code === selectedTipoObra)?.children?.map(cap => (
                  <option key={cap.code} value={cap.code}>{cap.code} - {cap.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subcapítulo</label>
              <select 
                value={selectedSubcapitulo}
                onChange={(e) => {
                  setSelectedSubcapitulo(e.target.value);
                  setSelectedPartida('');
                }}
                disabled={!selectedCapitulo}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
              >
                <option value="">Selecciona el Subcapítulo...</option>
                {selectedCapitulo && coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.map(sub => (
                  <option key={sub.code} value={sub.code}>{sub.code} - {sub.name}</option>
                ))}
              </select>
            </div>
            
            {/* 4TO SELECTOR SIEMPRE VISIBLE */}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Partida Base</label>
              <select 
                value={selectedPartida}
                onChange={(e) => setSelectedPartida(e.target.value)}
                disabled={!selectedSubcapitulo || !hasFourthLevel}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
              >
                {!selectedSubcapitulo ? (
                  <option value="">Selecciona el Subcapítulo...</option>
                ) : !hasFourthLevel ? (
                  <option value="">No aplica (sin desglose)</option>
                ) : (
                  <>
                    <option value="">Selecciona la Partida...</option>
                    {currentSub.children.map(par => (
                      <option key={par.code} value={par.code}>{par.code} - {par.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Código Base COVENIN:</span>
            <code className="px-2 py-1 bg-slate-100 text-blue-700 rounded text-sm font-mono border border-slate-200">
              {currentPrefix || '---'}
            </code>
            {matchCount !== null && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200 animate-in fade-in zoom-in duration-300">
                {matchCount} {matchCount === 1 ? 'partida' : 'partidas'} en BD
              </span>
            )}
            {categoryHints.length > 0 && (
              <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 animate-in fade-in zoom-in duration-300 shadow-sm flex items-center gap-1">
                <Sparkles size={12} />
                Keywords: {categoryHints.join(', ')}
              </span>
            )}
          </div>

          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            {isSelectorsComplete ? (
              isSmartMode ? "Smart Selector: Selecciona las características" :
              isClarifying ? "Responde a la IA para continuar" : 
              "Describe la partida a generar"
            ) : (
              <>
                <AlertTriangle className="text-amber-500" size={16} />
                Completa los selectores arriba para habilitar la descripción
              </>
            )}
          </label>
          
          {isSmartMode && smartData && !smartData.ready_to_generate && (
            <div className="mb-4 p-5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-sm animate-in fade-in zoom-in duration-300">
              <h4 className="text-indigo-800 font-bold mb-3 flex items-center gap-2">
                <Sparkles size={18} />
                Filtro Inteligente: Selecciona para encontrar la mejor partida base
              </h4>
              <p className="text-indigo-600 text-sm mb-4">
                El sistema detectó {smartData.candidates_count} partidas en esta categoría. Responde para elegir la más parecida:
              </p>
              
              <div className="space-y-4">
                {smartData.questions.length > 0 && (
                  (() => {
                    const q = smartData.questions[0];
                    return (
                      <div key={q.id} className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                        <p className="font-semibold text-slate-700 mb-3">{q.question}</p>
                        <div className="flex flex-wrap gap-2">
                          {q.options.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setShowSmartCustomInput(false);
                                setSmartCustomInput("");
                                handleSmartAnswer(q.id, opt.value);
                              }}
                              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-medium rounded-lg transition-colors border border-indigo-200 hover:border-indigo-600"
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            onClick={() => setShowSmartCustomInput(true)}
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors border border-slate-200"
                          >
                            Ninguno / Otro
                          </button>
                        </div>
                        
                        {showSmartCustomInput && (
                          <div className="mt-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                              type="text" 
                              placeholder="Escribe la característica principal (ej: manual)..."
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={smartCustomInput}
                              onChange={e => setSmartCustomInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && smartCustomInput.trim()) {
                                  handleSmartAnswer(q.id, smartCustomInput.trim());
                                  setSmartCustomInput("");
                                  setShowSmartCustomInput(false);
                                }
                              }}
                              autoFocus
                            />
                            <button 
                              onClick={() => {
                                if (smartCustomInput.trim()) {
                                  handleSmartAnswer(q.id, smartCustomInput.trim());
                                  setSmartCustomInput("");
                                  setShowSmartCustomInput(false);
                                }
                              }}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"
                            >
                              Aplicar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
              

              
              <div className="mt-5 flex justify-between items-center border-t border-indigo-200 pt-4">
                <button 
                  onClick={() => { setIsSmartMode(false); setSmartData(null); setSmartAnswers({}); }} 
                  className="text-sm text-slate-500 font-bold hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleGenerate(basePrompt, false, true)} 
                  className="text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1"
                >
                  Omitir y generar APU desde cero
                </button>
              </div>
            </div>
          )}

          {!isSmartMode && isClarifying && (aiQuestions.length > 0 || aiClarificationMessage) && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm animate-in fade-in zoom-in duration-300">
              <h4 className="text-blue-800 font-bold mb-2 flex items-center gap-2">🤔 {aiClarificationMessage || "La IA necesita clarificación:"}</h4>
              
              {aiQuestions.length > 0 && (
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-2 font-medium mb-3">
                  {aiQuestions.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              )}
              
              {aiOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-blue-200">
                  {aiOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPrompt(opt);
                        handleGenerate(opt);
                      }}
                      className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors shadow-sm"
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setIsClarifying(false);
                      setChatHistory([]);
                      setAiClarificationMessage("");
                      setAiOptions([]);
                      setAiQuestions([]);
                      setPrompt('');
                      setSelectedTipoObra('');
                      setSelectedCapitulo('');
                      setSelectedSubcapitulo('');
                      setSelectedPartida('');
                    }}
                    className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors shadow-sm"
                  >
                    Elegir otra Categoría
                  </button>
                  <button
                    onClick={() => {
                      setIsClarifying(false);
                      setChatHistory([]);
                      setAiClarificationMessage("");
                      setAiOptions([]);
                      setAiQuestions([]);
                      setPrompt('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors shadow-sm"
                  >
                    Corregir Descripción
                  </button>
                </div>
              )}
            </div>
          )}
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isSelectorsComplete && prompt.trim() && !isSmartMode) {
                  handleGenerate();
                }
              }
            }}
            disabled={!isSelectorsComplete || (isClarifying && aiOptions.length > 0) || isSmartMode}
            placeholder={
              !isSelectorsComplete ? "Selecciona la categoría primero..." : 
              isSmartMode ? "Responde las preguntas del filtro inteligente arriba..." :
              (isClarifying && aiOptions.length > 0) ? "Por favor selecciona una de las opciones arriba..." : 
              isClarifying ? "Ej: El espesor es 15cm y el concreto de 210 kg/cm2..." : 
              "Ej: Fundición de losa de entrepiso de concreto f'c=210 kg/cm2, espesor 15 cm..."
            }
            className={`w-full h-24 p-4 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm mb-4 disabled:opacity-50 disabled:cursor-not-allowed ${isClarifying || isSmartMode ? 'bg-blue-50/50 border-blue-300 focus:border-blue-500 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-red-500 focus:ring-red-500/20'}`}
          />
          
          {debugInfo && (
            <div className="mb-4 p-4 bg-slate-800 rounded-xl shadow-sm overflow-x-auto text-xs text-green-400 font-mono">
              <h4 className="text-white font-bold mb-2">🔍 Debug de Preprocesamiento</h4>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            {isClarifying && (
              <button
                onClick={() => { setIsClarifying(false); setChatHistory([]); setAiClarificationMessage(""); setAiOptions([]); setAiQuestions([]); setPrompt(''); }}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={() => handleGeneratePreprocess()}
              disabled={loading || !prompt.trim() || !isSelectorsComplete || isClarifying || isSmartMode}
              className="flex items-center gap-2 text-slate-600 bg-slate-100 px-4 py-3 rounded-xl hover:bg-slate-200 transition-all font-bold disabled:opacity-50 text-sm border border-slate-200"
              title="Muestra cómo la IA buscará en la base de datos sin consumir saldo"
            >
              <Search size={18} />
              Preproceso
            </button>
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !prompt.trim() || !isSelectorsComplete || isSmartMode}
              className={`flex items-center gap-2 text-white px-6 py-3 rounded-xl transition-all shadow-sm font-bold disabled:opacity-50 ${isClarifying ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'}`}
            >
              {loading ? <Loader className="animate-spin" size={18} /> : (isClarifying ? <Check size={18} /> : <Sparkles size={18} />)}
              {loading ? (isClarifying ? 'Pensando...' : 'Generando...') : (isClarifying ? 'Responder' : 'Generar APU')}
            </button>
          </div>
        </div>
        );
      })()}

      {creationMode === 'ia' && !item && previewItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Database size={18} className="text-blue-500" />
              Vista Previa de Partidas en BD
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-600">
              {matchCount} resultados
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {previewItems.map(p => (
                <li key={p.CodPar} className="p-4 hover:bg-blue-50/50 transition-colors flex items-start gap-4 group">
                  <div className="mt-0.5 p-2 rounded-lg bg-blue-100 text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 font-mono mb-1">{p.CovPar || p.CodPar}</p>
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{p.Descri}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {printOptions && item && (
        <PrintAPULayout 
          partida={item} 
          materiales={item.materials || []} 
          equipos={item.equipments || []} 
          mano_obra={item.labors || []} 
          options={printOptions} 
        />
      )}
      
      {printModalOpen && (
        <PrintAPUModal 
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)} 
          onPrint={(options) => setPrintOptions(options)} 
        />
      )}

      {item && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calculator size={20} className="text-blue-500" />
              APU EN EDICIÓN
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPrintModalOpen(true)}
                className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 hover:border-blue-400 hover:shadow-md transition-all duration-200 shadow-sm"
                title="Imprimir"
              >
                <Printer size={20} />
              </button>
              <ExportApuExcelButton
                item={item}
                settings={settings}
              />
            </div>
          </div>
          
          {item.advertencias && item.advertencias.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm">
              <h4 className="text-amber-800 font-bold mb-2 flex items-center gap-2">⚠️ Advertencias del Análisis</h4>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                {item.advertencias.map((adv, idx) => (
                  <li key={idx}>{adv}</li>
                ))}
              </ul>
            </div>
          )}
          <ApuEditorUI
            item={item}
            settings={settings}
            onHeaderChange={(field, value) => setItem({ ...item, [field]: value })}
            onHeaderBlur={() => {}} // Not strictly needed here, local state
            onComponentChange={handleComponentChange}
            onComponentBlur={() => {}} // Changes are saved when they click "Guardar APU"
            onRemoveRow={handleRemoveRow}
            onAddBlankRow={handleAddRow}
            onAddSearchRow={() => { toast.error("La búsqueda no está disponible en este modo, usa fila en blanco"); }} // Optional: connect to ComponentSearchModal later
            onSettingsChange={(field, value) => setSettings({ ...settings, [field]: value })}
          />

          {/* SAVE BUTTON */}
          <div className="flex justify-end pt-6 border-t border-slate-200 mt-6">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow font-bold disabled:opacity-50"
            >
              {saving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? 'Guardando...' : 'Guardar APU Generado'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
