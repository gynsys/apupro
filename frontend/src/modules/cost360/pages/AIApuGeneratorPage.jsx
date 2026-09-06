import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader, Loader2, Package, Wrench, Users, Calculator, Save, Sparkles, Check, CheckCircle2, Filter, Plus, Search, FileText, Trash2, AlertTriangle, Database, Layers, Printer, Bot, X, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../../../context/AuthContext';
import { generateAIApu, saveCustomApu, fetchCategoriesTree, fetchItems, fetchApuDetails } from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import Cost360SearchBar from '../components/Cost360SearchBar';
import { useCost360Search } from '../hooks/useCost360Search';
import ApuEditorUI from '../../../components/ApuEditorUI';
import coveninTreeData from '../data/covenin_tree.json';
import ExportApuExcelButton from '../components/ExportApuExcelButton';
import PrintAPUModal from '../../../components/PrintAPUModal';
import PrintAPULayout from '../../../components/PrintAPULayout';
import CreatableSelect from 'react-select/creatable';
import SubscriptionRequestModal from '../../../components/SubscriptionRequestModal';

const ACCIONES_OPCIONES = [
  { value: 'Limpieza de terreno', label: 'Limpieza de terreno' },
  { value: 'Trazo y replanteo', label: 'Trazo y replanteo' },
  { value: 'Demolición de', label: 'Demolición de' },
  { value: 'Desmontaje de', label: 'Desmontaje de' },
  { value: 'Acarreo de', label: 'Acarreo de' },
  { value: 'Eliminación de', label: 'Eliminación de' },
  { value: 'Excavación manual de', label: 'Excavación manual de' },
  { value: 'Excavación mecánica de', label: 'Excavación mecánica de' },
  { value: 'Perfilar y nivelar', label: 'Perfilar y nivelar' },
  { value: 'Relleno con material propio', label: 'Relleno con material propio' },
  { value: 'Relleno con material de préstamo', label: 'Relleno con material de préstamo' },
  { value: 'Compactación de', label: 'Compactación de' },
  { value: 'Vaciado de concreto', label: 'Vaciado de concreto' },
  { value: 'Encofrar y desencofrar', label: 'Encofrar y desencofrar' },
  { value: 'Habilitación y colocación de acero', label: 'Habilitación y colocación de acero' },
  { value: 'Construcción de estructuras de', label: 'Construcción de estructuras de' },
  { value: 'Construcción de paredes de', label: 'Construcción de paredes de' },
  { value: 'Asentado de muro de', label: 'Asentado de muro de' },
  { value: 'Tarrajeo de', label: 'Tarrajeo de' },
  { value: 'Revoque de', label: 'Revoque de' },
  { value: 'Enlucido de', label: 'Enlucido de' },
  { value: 'Pintura en', label: 'Pintura en' },
  { value: 'Suministro e instalación de pisos de', label: 'Suministro e instalación de pisos de' },
  { value: 'Revestimiento de', label: 'Revestimiento de' },
  { value: 'Suministro e instalación de', label: 'Suministro e instalación de' },
  { value: 'Canalización de tuberías para', label: 'Canalización de tuberías para' },
  { value: 'Cableado de conductores para', label: 'Cableado de conductores para' },
  { value: 'Conexión y empalme de', label: 'Conexión y empalme de' },
  { value: 'Pruebas hidráulicas de', label: 'Pruebas hidráulicas de' },
  { value: 'Pruebas eléctricas de', label: 'Pruebas eléctricas de' }
];

const MATERIALES_OPCIONES = [
  { value: "Concreto simple f'c=100 kg/cm²", label: "Concreto simple f'c=100 kg/cm²" },
  { value: "Concreto armado f'c=210 kg/cm²", label: "Concreto armado f'c=210 kg/cm²" },
  { value: "Concreto armado f'c=280 kg/cm²", label: "Concreto armado f'c=280 kg/cm²" },
  { value: 'Acero corrugado grado 60', label: 'Acero corrugado grado 60' },
  { value: 'Alambre negro recocido #16', label: 'Alambre negro recocido #16' },
  { value: 'Bloques de concreto de 15x20x40 cm', label: 'Bloques de concreto de 15x20x40 cm' },
  { value: 'Bloques de concreto de 10x20x40 cm', label: 'Bloques de concreto de 10x20x40 cm' },
  { value: 'Ladrillo de arcilla de 18 huecos', label: 'Ladrillo de arcilla de 18 huecos' },
  { value: 'Ladrillo pandereta', label: 'Ladrillo pandereta' },
  { value: 'Mortero cemento-arena proporción 1:4', label: 'Mortero cemento-arena proporción 1:4' },
  { value: 'Mortero cemento-arena proporción 1:5', label: 'Mortero cemento-arena proporción 1:5' },
  { value: 'Yeso de construcción', label: 'Yeso de construcción' },
  { value: 'Pasta fina acrílica para interiores', label: 'Pasta fina acrílica para interiores' },
  { value: 'Porcelanato de 60x60 cm alto tráfico', label: 'Porcelanato de 60x60 cm alto tráfico' },
  { value: 'Cerámica de 30x30 cm antideslizante', label: 'Cerámica de 30x30 cm antideslizante' },
  { value: 'Pintura látex lavable', label: 'Pintura látex lavable' },
  { value: 'Pintura esmalte anticorrosivo', label: 'Pintura esmalte anticorrosivo' },
  { value: 'Tubería PVC SAP clase 10 para agua', label: 'Tubería PVC SAP clase 10 para agua' },
  { value: 'Tubería PVC SAL para desagüe', label: 'Tubería PVC SAL para desagüe' },
  { value: 'Conductor de cobre tipo TW de 2.5 mm²', label: 'Conductor de cobre tipo TW de 2.5 mm²' },
  { value: 'Tablero de distribución eléctrica', label: 'Tablero de distribución eléctrica' }
];

const UBICACION_OPCIONES = [
  { value: 'En zapatas', label: 'En zapatas' },
  { value: 'En cimientos corridos', label: 'En cimientos corridos' },
  { value: 'En sobrecimientos', label: 'En sobrecimientos' },
  { value: 'En vigas de cimentación', label: 'En vigas de cimentación' },
  { value: 'En losa de cimentación', label: 'En losa de cimentación' },
  { value: 'En columnas', label: 'En columnas' },
  { value: 'En vigas peraltadas', label: 'En vigas peraltadas' },
  { value: 'En losas aligeradas', label: 'En losas aligeradas' },
  { value: 'En losas macizas', label: 'En losas macizas' },
  { value: 'En escaleras', label: 'En escaleras' },
  { value: 'En muros interiores', label: 'En muros interiores' },
  { value: 'En muros exteriores (fachadas)', label: 'En muros exteriores (fachadas)' },
  { value: 'En vigas y columnas aisladas', label: 'En vigas y columnas aisladas' },
  { value: 'En techos y cielorrasos', label: 'En techos y cielorrasos' },
  { value: 'En pisos y rampas', label: 'En pisos y rampas' },
  { value: 'Empotrado en piso', label: 'Empotrado en piso' },
  { value: 'Empotrado en pared', label: 'Empotrado en pared' },
  { value: 'A la vista sobre bandejas', label: 'A la vista sobre bandejas' },
  { value: 'Enterrado en zanjas externas', label: 'Enterrado en zanjas externas' },
  { value: 'En ductos técnicos', label: 'En ductos técnicos' }
];

const INCLUYE_OPCIONES = [
  { value: 'Incluye vibrado mecánico, curado con agua y aditivo desencofrante', label: 'Incluye vibrado mecánico, curado con agua y aditivo desencofrante' },
  { value: 'Incluye andamiaje certificado, limpieza de superficie y protección de áreas adyacentes', label: 'Incluye andamiaje certificado, limpieza de superficie y protección de áreas adyacentes' },
  { value: 'Incluye preparación de la mezcla, humedecido previo y juntas de dilatación', label: 'Incluye preparación de la mezcla, humedecido previo y juntas de dilatación' },
  { value: 'Incluye acarreo interno de materiales, herramientas menores y mano de obra calificada', label: 'Incluye acarreo interno de materiales, herramientas menores y mano de obra calificada' },
  { value: 'Incluye accesorios de conexión, pegamento especial, pruebas de presión y certificación técnica', label: 'Incluye accesorios de conexión, pegamento especial, pruebas de presión y certificación técnica' },
  { value: 'Incluye clasificación de residuos, carguío y transporte hacia el botadero autorizado', label: 'Incluye clasificación de residuos, carguío y transporte hacia el botadero autorizado' }
];

const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    borderRadius: '0.75rem',
    border: state.isFocused ? '1px solid #3b82f6' : '1px solid #cbd5e1',
    boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
    backgroundColor: '#f8fafc',
    padding: '0.1rem',
    fontSize: '0.875rem',
    '&:hover': {
      border: '1px solid #94a3b8'
    }
  })
};

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
  
  // Guided Builder States
  const [isGuidedMode, setIsGuidedMode] = useState(true);
  const [guidedAccion, setGuidedAccion] = useState(null);
  const [guidedUbicacion, setGuidedUbicacion] = useState(null);
  const [guidedMaterial, setGuidedMaterial] = useState(null);
  const [guidedIncluye, setGuidedIncluye] = useState(null);
  const [guidedUnidad, setGuidedUnidad] = useState(null);
  
  const chatEndRef = useRef(null);
  
  // Actualizar el prompt oculto cuando cambia el builder
  useEffect(() => {
    if (isGuidedMode) {
      const parts = [];
      if (guidedAccion && guidedAccion !== 'Omitir' && guidedAccion !== 'Ninguno' && guidedAccion !== 'Ninguno / Omitir') parts.push(guidedAccion);
      if (guidedUbicacion && guidedUbicacion !== 'Omitir' && guidedUbicacion !== 'Ninguno' && guidedUbicacion !== 'Ninguno / Omitir') parts.push(guidedUbicacion);
      if (guidedMaterial && guidedMaterial !== 'Omitir' && guidedMaterial !== 'Ninguno' && guidedMaterial !== 'Ninguno / Omitir') parts.push(guidedMaterial);
      if (guidedIncluye && guidedIncluye !== 'Omitir' && guidedIncluye !== 'Ninguno' && guidedIncluye !== 'Ninguno / Omitir') parts.push(guidedIncluye);
      if (guidedUnidad && guidedUnidad !== 'Sugerir por IA' && guidedUnidad !== 'Omitir' && guidedUnidad !== 'Ninguno' && guidedUnidad !== 'Ninguno / Omitir') parts.push(`unidad ${guidedUnidad}`);
      setPrompt(parts.join(' ').trim());
    }
  }, [guidedAccion, guidedUbicacion, guidedMaterial, guidedIncluye, guidedUnidad, isGuidedMode]);
  
  // Conversational AI States
  const [chatHistory, setChatHistory] = useState([]);
  const [aiClarificationMessage, setAiClarificationMessage] = useState("");
  const [aiOptions, setAiOptions] = useState([]);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiGuiaRedaccion, setAiGuiaRedaccion] = useState(null);
  const [isClarifying, setIsClarifying] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Match Exacto Interactivo
  const [exactMatchCandidate, setExactMatchCandidate] = useState(null);

  // Smart Selector States
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [smartData, setSmartData] = useState(null);
  const [smartAnswers, setSmartAnswers] = useState({});
  const [basePrompt, setBasePrompt] = useState("");
  const [smartCustomInput, setSmartCustomInput] = useState("");
  const [showSmartCustomInput, setShowSmartCustomInput] = useState(false);

  const [chatbotLoadingStage, setChatbotLoadingStage] = useState(0);

  
  // Obtenemos el usuario del contexto de autenticación
  const { user } = React.useContext(AuthContext);
  const isAdmin = user?.is_superadmin === true || user?.is_admin === true || user?.role === 'admin' || user?.role === 'superadmin' || user?.email === 'admin@arko360.net';

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionErrorMsg, setSubscriptionErrorMsg] = useState(null);

  const [guidedMessages, setGuidedMessages] = useState([]);
  
  // Initialize greeting with user name when component mounts or user changes
  useEffect(() => {
    const userName = user?.full_name || user?.email?.split('@')[0] || '';
    const greetingName = userName ? ` ${userName}` : '';
    setGuidedMessages([
      { 
        id: 'msg-bot0', 
        sender: 'bot', 
        step: 0,
        text: `¡Hola${greetingName}! Construir una descripción detallada de una partida es lo esencial para evitar ambigüedades al momento de la ejecución en campo, y es la clave para que la Inteligencia Artificial encuentre exactamente lo que necesitas.\n\nEn 5 pasos rápidos armaremos la mejor descripción basándonos en la información suministrada. ¿Comenzamos?`, 
        chips: ["Sí, comenzar"] 
      }
    ]);
  }, [user]);

  const [currentChatStep, setCurrentChatStep] = useState(0);
  const [chatInputValue, setChatInputValue] = useState("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guidedMessages, chatbotLoadingStage]);
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
      
      setIsGuidedMode(false);
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

  const getStepValue = (step) => {
    if (step === 1) return guidedAccion;
    if (step === 2) return guidedUbicacion;
    if (step === 3) return guidedMaterial;
    if (step === 4) return guidedIncluye;
    if (step === 5) return guidedUnidad;
    return '';
  };

  const handleGoBack = (targetStep = null) => {
    if (chatbotLoadingStage > 0) return;
    const prevStep = targetStep !== null ? targetStep : currentChatStep - 1;
    if (prevStep < 0) return;

    if (prevStep === 0) {
      setCurrentChatStep(0);
      setGuidedAccion(null);
      setGuidedUbicacion(null);
      setGuidedMaterial(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      setChatInputValue('');
      setGuidedMessages(prev => prev.filter(m => m.id === 'msg-bot0'));
      return;
    }

    setCurrentChatStep(prevStep);

    // Limpiar campos posteriores
    if (prevStep < 5) setGuidedUnidad(null);
    if (prevStep < 4) setGuidedIncluye(null);
    if (prevStep < 3) setGuidedMaterial(null);
    if (prevStep < 2) setGuidedUbicacion(null);
    if (prevStep < 1) setGuidedAccion(null);

    const prevVal = getStepValue(prevStep);
    setChatInputValue(prevVal && prevVal !== 'Omitir' && prevVal !== 'Ninguno' && prevVal !== 'Ninguno / Omitir' ? prevVal : '');

    // Rebobinar mensajes: mantener los previos y el mensaje de pregunta del bot del paso activo
    setGuidedMessages(prev => {
      return prev.filter(m => {
        if (m.step === 0 || m.id === 'msg-bot0') return true;
        if (m.step < prevStep) return true;
        if (m.step === prevStep && m.sender === 'bot') return true;
        return false;
      });
    });
  };

  const handleChatSubmit = (text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    
    const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
    
    let currentAccion = guidedAccion;
    let currentUbicacion = guidedUbicacion;
    let currentMaterial = guidedMaterial;
    let currentIncluye = guidedIncluye;
    let currentUnidad = guidedUnidad;

    if (currentChatStep === 1) {
      setGuidedAccion(cleanText);
      currentAccion = cleanText;
    } else if (currentChatStep === 2) {
      setGuidedUbicacion(cleanText);
      currentUbicacion = cleanText;
    } else if (currentChatStep === 3) {
      setGuidedMaterial(cleanText);
      currentMaterial = cleanText;
    } else if (currentChatStep === 4) {
      setGuidedIncluye(cleanText);
      currentIncluye = cleanText;
    } else if (currentChatStep === 5) {
      setGuidedUnidad(cleanText);
      currentUnidad = cleanText;
    }
    
    const nextStep = currentChatStep === 0 ? 1 : currentChatStep + 1;
    setCurrentChatStep(nextStep);
    
    let nextBotMsg = null;
    if (nextStep === 1) {
      nextBotMsg = { 
        id: `bot-step-1-${Date.now()}`, 
        sender: 'bot', 
        step: 1,
        text: 'Paso 1 de 5: La Acción\n¿Qué acción o proceso constructivo se va a realizar?', 
        chips: [
          'Construcción',
          'Suministro',
          'Instalación',
          'Colocación',
          'Demolición',
          'Excavación',
          'Acarreo',
          'Carga',
          'Transporte',
          'Pintura',
          'Reparación',
          'Mantenimiento',
          'Remoción',
          'Desmontaje',
          'Limpieza'
        ] 
      };
    } else if (nextStep === 2) {
      nextBotMsg = { 
        id: `bot-step-2-${Date.now()}`, 
        sender: 'bot', 
        step: 2,
        text: 'Paso 2 de 5: El Elemento o Ubicación\n¿En qué elemento, estructura o lugar se aplicará?', 
        chips: [
          'Paredes',
          'Losas',
          'Columnas',
          'Vigas',
          'Zapatas',
          'Fundaciones',
          'Techos',
          'Cubiertas',
          'Pisos',
          'Exteriores',
          'Omitir'
        ] 
      };
    } else if (nextStep === 3) {
      nextBotMsg = { 
        id: `bot-step-3-${Date.now()}`, 
        sender: 'bot', 
        step: 3,
        text: 'Paso 3 de 5: El Material y Especificación\n¿Con qué material, resistencia o tipo específico?', 
        chips: [
          "Concreto f'c=210 kg/cm²",
          "Concreto f'c=250 kg/cm²",
          "Acero Fy=4200 kg/cm²",
          'Bloque de arcilla',
          'Bloque de concreto',
          'Tubería PVC',
          'Omitir'
        ] 
      };
    } else if (nextStep === 4) {
      nextBotMsg = { 
        id: `bot-step-4-${Date.now()}`, 
        sender: 'bot', 
        step: 4,
        text: 'Paso 4 de 5: Alcance y Condiciones\n¿Qué incluye o excluye la partida?', 
        chips: [
          'Solo mano de obra',
          'Incluye transporte',
          'Incluye acarreo',
          'No incluye suministro de materiales ni equipos',
          'Todo incluido (Mat + MO + Eq)',
          'Incluye encofrado',
          'Incluye andamios',
          'Omitir'
        ] 
      };
    } else if (nextStep === 5) {
      nextBotMsg = { 
        id: `bot-step-5-${Date.now()}`, 
        sender: 'bot', 
        step: 5,
        text: 'Paso 5 de 5: Unidad de Medida\n¿En qué unidad de medida se computará la partida?', 
        chips: [
          'm³',
          'm²',
          'ml',
          'kg',
          'ton',
          'und',
          'pto',
          'viaje',
          'Sugerir por IA'
        ] 
      };
    } else if (nextStep === 6) {
      setChatbotLoadingStage(1);
      setTimeout(() => setChatbotLoadingStage(2), 1500);
      setTimeout(() => setChatbotLoadingStage(3), 3000);
      setTimeout(() => setChatbotLoadingStage(4), 4500);
      setTimeout(() => {
        const parts = [
          currentAccion,
          currentUbicacion,
          currentMaterial,
          currentIncluye,
          (cleanText && cleanText !== 'Sugerir por IA' && cleanText !== 'Ninguno / Omitir' && cleanText !== 'Ninguno' && cleanText !== 'Omitir') ? `unidad ${cleanText}` : ''
        ].filter(p => p && p !== 'Omitir' && p !== 'Ninguno' && p !== 'Ninguno / Omitir');
        
        const finalPrompt = parts.join(' ').trim();
        handleGenerate(finalPrompt);
      }, 5000);
    }
    
    if (nextBotMsg) {
      setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
    } else {
      setGuidedMessages(prev => [...prev, newUserMsg]);
    }
    setChatInputValue("");
  };

  const handleGeneratePreprocess = () => {
    handleGenerate(null, true);
  };

  const handleGenerate = async (overridePrompt = null, onlyPreprocess = false, bypassSmart = false, bypassExactMatch = false, acceptExactMatchCode = null) => {
    const textToSubmit = overridePrompt !== null ? overridePrompt : prompt;
    if (!textToSubmit.trim()) {
      toast.error("Ingresa una descripción para generar el APU");
      return;
    }
    setLoading(true);
    setItem(null);
    setExactMatchCandidate(null);
    try {
      let context = "Generación Libre de APU (Búsqueda Híbrida Inteligente)";
      const prefixToSend = "";

      // Si el usuario aceptó la partida de Match Exacto
      if (acceptExactMatchCode) {
        const response = await generateAIApu(textToSubmit, prefixToSend, context, [], false, false, acceptExactMatchCode);
        processAIResponse(response, textToSubmit);
        return;
      }

      const newHistory = isClarifying ? [...chatHistory, { role: 'user', content: textToSubmit }] : [{ role: 'user', content: textToSubmit }];
      
      // Generación directa con IA y RAG Híbrido
      const response = await generateAIApu(textToSubmit, prefixToSend, context, newHistory, onlyPreprocess, bypassExactMatch);
      processAIResponse(response, textToSubmit);
      
    } catch (error) {
      console.error("Error en generación APU con IA:", error);
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 403) {
        const errorMsg = detail || "No tienes una suscripción activa o permiso para utilizar el Generador de APU asistido por IA.";
        toast.error(errorMsg, { duration: 7000, icon: '🔒' });
        setSubscriptionErrorMsg(errorMsg);
        setShowSubscriptionModal(true);
      } else if (status === 401) {
        toast.error("Tu sesión ha expirado o no estás autenticado. Por favor inicia sesión nuevamente.", { duration: 5000 });
      } else {
        toast.error(detail || "Error al generar APU con IA. Inténtalo nuevamente.");
      }
    } finally {
      setLoading(false);
      setChatbotLoadingStage(0);
    }
  };

  const handleAcceptExactMatch = async () => {
    if (!exactMatchCandidate) return;
    const itemCode = exactMatchCandidate.cod_par;
    const textPrompt = basePrompt || prompt;
    setExactMatchCandidate(null);
    await handleGenerate(textPrompt, false, true, false, itemCode);
  };

  const handleRejectExactMatch = async () => {
    const textPrompt = basePrompt || prompt;
    setExactMatchCandidate(null);
    // Forzar generación con IA omitiendo el match exacto
    await handleGenerate(textPrompt, false, true, true, null);
  };

  const processAIResponse = (response, textToSubmit) => {
    let currentDebug = null;
    if (response.debug_rag_trace || response.debug_base_apu) {
      currentDebug = {
        message: "Generación asistida por RAG Híbrido y Adaptación de Partida Base",
        solicitud_usuario: textToSubmit,
        rag_trace: response.debug_rag_trace || null,
        base_apu: response.debug_base_apu || null,
        prompt_enviado_al_llm: response.prompt_enviado_al_llm || null,
        respuesta_cruda_llm: {
          partida: response.partida,
          notas_adaptacion: response.notas_adaptacion || [],
          advertencias: response.advertencias,
          conteo_materiales: (response.materials || []).length,
          conteo_equipos: (response.equipments || []).length,
          conteo_mano_obra: (response.labors || []).length
        }
      };
      setDebugInfo(currentDebug);
    } else if (response.debug_preprocesamiento) {
      currentDebug = response.debug_preprocesamiento;
      setDebugInfo(currentDebug);
    } else {
      setDebugInfo(null);
    }

    // Auto-descarga de Debug JSON si está habilitado desde Utilitarios de Administrador
    const shouldDownloadDebug = localStorage.getItem('auto_download_debug_json') === 'true';
    if (shouldDownloadDebug && currentDebug) {
      try {
        const blob = new Blob([JSON.stringify(currentDebug, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug_apu_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Debug JSON descargado automáticamente", { icon: '📥' });
      } catch (err) {
        console.error("Error al auto-descargar Debug JSON:", err);
      }
    }

    if (response.status === 'exact_match_candidate') {
      setExactMatchCandidate(response.matched_item);
      setBasePrompt(textToSubmit);
      setIsClarifying(false);
      setIsGuidedMode(false);
      setCurrentChatStep(0);
      setGuidedAccion(null);
      setGuidedUbicacion(null);
      setGuidedMaterial(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      setChatbotLoadingStage(0);
      toast("Existe una partida que coincide con tu descripción", { icon: '🎯' });
      return;
    }

    if (response.status === 'clarification_needed') {
      const newHistory = isClarifying ? [...chatHistory, { role: 'user', content: textToSubmit }] : [{ role: 'user', content: textToSubmit }];
      setChatHistory(newHistory);
      setAiClarificationMessage(response.clarification_message || "No se pudo interpretar una partida técnica válida.");
      setAiOptions(response.options || []);
      setAiQuestions(response.questions || []);
      setAiGuiaRedaccion(response.guia_redaccion || null);
      setIsClarifying(true);
      setIsGuidedMode(false);
      setCurrentChatStep(0);
      setGuidedAccion(null);
      setGuidedUbicacion(null);
      setGuidedMaterial(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      setChatbotLoadingStage(0);
      setPrompt('');
      toast.error("Descripción no válida o ambigua. Revisa las preguntas de clarificación.", { icon: '⚠️' });
    } else {
      setIsClarifying(false);
      setIsGuidedMode(false);
      setChatHistory([]);
      setAiClarificationMessage("");
      setAiOptions([]);
      setAiQuestions([]);
      setAiGuiaRedaccion(null);
      setExactMatchCandidate(null);
      setCurrentChatStep(0);
      setGuidedAccion(null);
      setGuidedUbicacion(null);
      setGuidedMaterial(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      setChatbotLoadingStage(0);

      // Filtrar advertencias para la vista pública:
      // Excluir notas técnicas de adaptación interna y mantener solo alertas de cotización o precio referencial
      const rawAdvertencias = response.advertencias || [];
      const advertenciasPublicas = rawAdvertencias.filter(adv => {
        const lower = adv.toLowerCase();
        if (
          lower.includes('adaptado desde la partida base') || 
          lower.includes('apu adaptado') || 
          lower.includes('se mantuvieron rendimientos') || 
          lower.includes('se eliminaron los insumos')
        ) {
          return false;
        }
        return true;
      });

      // Map response to the format expected by the editor
      setItem({
        ...response.partida,
        materials: response.materials || [],
        equipments: response.equipments || [],
        labors: response.labors || [],
        advertencias: advertenciasPublicas
      });
      toast.success("APU generado con éxito");
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

      {creationMode === 'ia' && !item && (() => {
        const isSelectorsComplete = true;
        
        return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* COVENIN selectors removed per user request */}

          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
              {isSmartMode ? "Smart Selector: Selecciona las características" :
               isClarifying ? "Responde a la IA para continuar" : 
               "Descripción Estructurada (APU Builder)"}
            </label>
            
            {!isSmartMode && !isClarifying && (
              <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button
                  onClick={() => { 
                    setIsGuidedMode(true); 
                    setCurrentChatStep(0); 
                    setGuidedAccion(null);
                    setGuidedUbicacion(null);
                    setGuidedMaterial(null);
                    setGuidedIncluye(null);
                    setGuidedUnidad(null);
                    setChatbotLoadingStage(0);
                    setPrompt(''); 
                    const userName = user?.full_name || user?.email?.split('@')[0] || '';
                    const greetingName = userName ? ` ${userName}` : '';
                    setGuidedMessages([
                      { 
                        id: 'msg-bot0', 
                        sender: 'bot', 
                        step: 0,
                        text: `¡Hola${greetingName}! Construir una descripción detallada de una partida es lo esencial para evitar ambigüedades al momento de la ejecución en campo, y es la clave para que la Inteligencia Artificial encuentre exactamente lo que necesitas.\n\nEn 5 pasos rápidos armaremos la mejor descripción basándonos en la información suministrada. ¿Comenzamos?`, 
                        chips: ["Sí, comenzar"] 
                      }
                    ]);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${isGuidedMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Asistente IA
                </button>
                <button
                  onClick={() => setIsGuidedMode(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!isGuidedMode ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Modo Libre
                </button>
              </div>
            )}
          </div>
          
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

          {/* MATCH EXACTO INTERACTIVO */}
          {exactMatchCandidate && (
            <div className="mb-6 p-5 bg-emerald-50/95 border-2 border-emerald-300 rounded-2xl shadow-md animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 shadow-sm shadow-emerald-600/30">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h4 className="text-emerald-950 font-bold text-base leading-tight">
                    Existe una partida que coincide casi al 100% con tu descripción:
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 font-medium">
                    Encontramos una partida certificada en la base de datos maestra con estructura técnica y costos comprobados.
                  </p>
                </div>
              </div>

              <div className="my-3 bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg font-mono tracking-wide">
                    {exactMatchCandidate.cov_par || exactMatchCandidate.cod_par}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Unidad: {exactMatchCandidate.unit}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Rendimiento: {exactMatchCandidate.performance || exactMatchCandidate.ren_par || 1.0} {exactMatchCandidate.unit}/día
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 uppercase leading-snug">
                  {exactMatchCandidate.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-emerald-200/70">
                <button
                  onClick={handleAcceptExactMatch}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
                >
                  <Check size={18} /> Sí, es esa
                </button>
                <button
                  onClick={handleRejectExactMatch}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles size={16} className="text-amber-500" /> No es esa (Generar con IA)
                </button>
              </div>
            </div>
          )}

          {!isSmartMode && isClarifying && (aiQuestions.length > 0 || aiClarificationMessage) && (
            <div className="mb-6 p-5 bg-amber-50/90 border-2 border-amber-200 rounded-2xl shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 shadow-sm shadow-amber-500/30">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-amber-950 font-bold text-base leading-tight">
                    {aiClarificationMessage || "No fue posible interpretar una partida técnica válida"}
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 font-medium">
                    Para asegurar que tu presupuesto sea confiable y no inventar costos erróneos, la IA necesita que definas estos puntos clave:
                  </p>
                </div>
              </div>
              
              {aiQuestions.length > 0 && (
                <div className="my-3 bg-white/90 border border-amber-200 rounded-xl p-3.5 shadow-xs">
                  <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wide">REDACCION RECOMENDADA:</p>
                  <ul className="text-sm text-slate-700 space-y-1.5 font-medium">
                    {aiQuestions.map((q, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold shrink-0">•</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {aiOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-amber-200">
                  {aiOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPrompt(opt);
                        handleGenerate(opt);
                      }}
                      className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-amber-200/70 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setIsClarifying(false);
                      setIsGuidedMode(true);
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles size={14} /> Usar Asistente Guiado Paso a Paso
                  </button>
                  <button
                    onClick={() => {
                      setIsClarifying(false);
                      setChatHistory([]);
                      setAiClarificationMessage("");
                      setAiOptions([]);
                      setAiQuestions([]);
                      setAiGuiaRedaccion(null);
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors shadow-sm"
                  >
                    Editar Texto Libre
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsClarifying(false);
                    setChatHistory([]);
                    setAiClarificationMessage("");
                    setAiOptions([]);
                    setAiQuestions([]);
                    setAiGuiaRedaccion(null);
                    setPrompt('');
                    setSelectedTipoObra('');
                    setSelectedCapitulo('');
                    setSelectedSubcapitulo('');
                    setSelectedPartida('');
                  }}
                  className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors"
                >
                  Reiniciar Categorías
                </button>
              </div>
            </div>
          )}
          
          {isGuidedMode && !isSmartMode && !isClarifying && !item ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden animate-in fade-in duration-200">
              <div className="bg-[#FEF3C7] border-2 border-[#FEF3C7] rounded-xl p-4 md:p-6 relative flex flex-col max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200" style={{ minHeight: '400px', maxHeight: '80vh' }}>
                <button 
                  onClick={() => setIsGuidedMode(false)}
                  className="absolute top-4 right-4 text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-full p-1.5 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-3 border-b border-amber-200/50 pb-3 flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
                    <Sparkles size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-amber-900">Asistente CostBase</h3>
                    <p className="text-xs text-amber-800 truncate">Te guiaré paso a paso para crear tu APU.</p>
                  </div>
                </div>

                {/* Stepper Interactivo de 5 Pasos */}
                {currentChatStep > 0 && chatbotLoadingStage === 0 && (
                  <div className="mb-3 pb-3 border-b border-amber-200/50 flex-shrink-0">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      {[
                        { step: 1, label: 'Acción' },
                        { step: 2, label: 'Ubicación' },
                        { step: 3, label: 'Material' },
                        { step: 4, label: 'Alcance' },
                        { step: 5, label: 'Unidad' },
                      ].map(({ step, label }) => {
                        const isDone = currentChatStep > step;
                        const isCurrent = currentChatStep === step;
                        return (
                          <button
                            key={step}
                            type="button"
                            disabled={!isDone}
                            onClick={() => isDone && handleGoBack(step)}
                            className={`flex-1 flex flex-col items-center py-1 px-1 rounded-lg transition-all ${
                              isCurrent
                                ? 'bg-amber-500 text-white font-bold shadow-xs'
                                : isDone
                                ? 'bg-amber-200/80 text-amber-900 font-semibold hover:bg-amber-300/80 cursor-pointer'
                                : 'text-amber-800/40 cursor-not-allowed'
                            }`}
                            title={isDone ? `Volver al paso ${step}: ${label}` : label}
                          >
                            <span className="flex items-center gap-0.5">
                              {isDone && <Check size={10} className="text-amber-900" />}
                              <span>{step}. {label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              <div className="flex-1 overflow-y-auto pr-2 space-y-6 flex flex-col pb-4 scrollbar-thin scrollbar-thumb-amber-200">
                {guidedMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-3 ${msg.sender === 'user' ? 'items-end' : ''}`}>
                    <div className={`flex items-end gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.sender === 'bot' && (
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center text-white mb-1 shadow-sm shadow-amber-500/20">
                          <Bot size={18} />
                        </div>
                      )}
                      {msg.sender === 'user' && msg.step > 0 && chatbotLoadingStage === 0 && (
                        <button
                          type="button"
                          onClick={() => handleGoBack(msg.step)}
                          title={`Editar o cambiar respuesta del paso ${msg.step}`}
                          className="opacity-70 hover:opacity-100 p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 rounded-full transition-all cursor-pointer shrink-0"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      <div className={`${msg.sender === 'bot' ? 'bg-white border border-amber-200 rounded-2xl rounded-bl-none p-4' : 'bg-amber-600 text-white rounded-2xl rounded-br-none px-4 py-2.5'} shadow-sm w-fit max-w-[280px] sm:max-w-[400px]`}>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.sender === 'bot' ? 'text-amber-950' : 'text-white'}`}>{msg.text}</p>
                      </div>
                    </div>
                    {msg.sender === 'bot' && msg.chips && (msg.step === currentChatStep || idx === guidedMessages.length - 1) && (
                      <div className="pl-10 flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {msg.chips.map(chip => (
                          <button 
                            key={chip}
                            type="button"
                            onClick={() => handleChatSubmit(chip)}
                            className="bg-white border border-amber-300 hover:border-amber-600 hover:bg-amber-100 text-amber-950 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
                          >
                            {chip}
                          </button>
                        ))}
                        {currentChatStep === 0 && (
                          <button 
                            type="button"
                            onClick={() => setIsGuidedMode(false)}
                            className="bg-transparent border border-amber-400 hover:bg-amber-200/60 text-amber-800 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                          >
                            Escribir libremente
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {chatbotLoadingStage > 0 && (
                  <div className="flex items-end gap-2 mt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center text-white mb-1 shadow-sm shadow-amber-500/20">
                      <Bot size={18} />
                    </div>
                    <div className="bg-white border border-amber-200 rounded-2xl rounded-bl-none p-4 shadow-sm w-fit max-w-[280px] sm:max-w-[400px]">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-amber-700 font-bold">
                          <Loader2 className="animate-spin flex-shrink-0" size={20} />
                          <span className="text-sm">
                            {chatbotLoadingStage === 1 && "Working..."}
                            {chatbotLoadingStage === 2 && "Iniciando preproceso semántico..."}
                            {chatbotLoadingStage === 3 && "Buscando en la BD Maestra con RAG Híbrido..."}
                            {chatbotLoadingStage === 4 && "Construyendo y adaptando APU con IA..."}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden mt-1">
                          <div 
                            className="h-full bg-amber-500 transition-all duration-500 ease-out" 
                            style={{ width: `${(chatbotLoadingStage / 4) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              {chatbotLoadingStage === 0 && (
                <div className="mt-4 pt-4 border-t border-amber-200 flex-shrink-0">
                  <div className="flex gap-2 items-center">
                    {currentChatStep > 0 && (
                      <button 
                        type="button"
                        onClick={() => handleGoBack()}
                        title="Volver al paso anterior"
                        className="bg-white border-2 border-amber-300 hover:bg-amber-100 text-amber-900 rounded-full px-3 py-2 text-xs font-bold flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer active:scale-95"
                      >
                        <ArrowLeft size={14} />
                        <span className="hidden sm:inline">Atrás</span>
                      </button>
                    )}
                    <input 
                      type="text"
                      value={chatInputValue}
                      onChange={e => setChatInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleChatSubmit(chatInputValue);
                      }}
                      placeholder="Escribe tu respuesta..."
                      className="flex-1 bg-white border-2 border-amber-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-amber-900 placeholder:text-amber-700/50"
                    />
                    <button 
                      onClick={() => handleChatSubmit(chatInputValue)}
                      disabled={!chatInputValue.trim()}
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-full p-2.5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-xs cursor-pointer"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => {
                if (!isGuidedMode) {
                  setPrompt(e.target.value);
                  if (subscriptionErrorMsg) setSubscriptionErrorMsg(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (isSelectorsComplete && prompt.trim() && !isSmartMode) {
                    handleGenerate();
                  }
                }
              }}
              disabled={!isSelectorsComplete || (isClarifying && aiOptions.length > 0) || isSmartMode || isGuidedMode}
              placeholder={
                !isSelectorsComplete ? "Selecciona la categoría primero..." : 
                isSmartMode ? "Responde las preguntas del filtro inteligente arriba..." :
                (isClarifying && aiOptions.length > 0) ? "Por favor selecciona una de las opciones arriba..." : 
                isClarifying ? "Ej: El espesor es 15cm y el concreto de 210 kg/cm2..." : 
                isGuidedMode ? "Usa los selectores de arriba para formar la descripción..." :
                "Modo experto: Escribe la partida libremente..."
              }
              className={`w-full h-24 p-4 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm mb-4 disabled:opacity-50 disabled:cursor-not-allowed ${isClarifying || isSmartMode ? 'bg-blue-50/50 border-blue-300 focus:border-blue-500 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 focus:bg-white focus:border-red-500 focus:ring-red-500/20'}`}
            />
          )}

          {subscriptionErrorMsg && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-200/70 text-amber-800 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900 leading-snug">{subscriptionErrorMsg}</p>
                  <p className="text-xs text-amber-800/80 mt-0.5">El Generador APU con IA es una función premium. Activa o renueva tu suscripción para obtener acceso ilimitado.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubscriptionModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg shadow-sm shrink-0 transition-all cursor-pointer"
              >
                Ver Planes
              </button>
            </div>
          )}
          
          {!(isGuidedMode && !isSmartMode && !isClarifying) && (
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
                onClick={() => handleGenerate()}
                disabled={loading || !prompt.trim() || !isSelectorsComplete || isSmartMode}
                className={`flex items-center gap-2 text-white px-6 py-3 rounded-xl transition-all shadow-sm font-bold disabled:opacity-50 ${isClarifying ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'}`}
              >
                {loading ? <Loader className="animate-spin" size={18} /> : (isClarifying ? <Check size={18} /> : <Sparkles size={18} />)}
                {loading ? (isClarifying ? 'Pensando...' : 'Generando...') : (isClarifying ? 'Responder' : 'Generar APU')}
              </button>
            </div>
          )}
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
          options={{ ...settings, ...printOptions }} 
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setItem(null);
                  setIsGuidedMode(true);
                  setCurrentChatStep(0);
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title="Volver al Asistente IA"
              >
                <ArrowLeft size={16} />
                <span>Volver al Asistente</span>
              </button>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calculator size={20} className="text-blue-500" />
                APU EN EDICIÓN
              </h3>
            </div>
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
          
          {item.advertencias && item.advertencias.filter(adv => {
            const l = adv.toLowerCase();
            return !l.includes('adaptado desde la partida base') && !l.includes('apu adaptado') && !l.includes('se mantuvieron rendimientos') && !l.includes('se eliminaron los insumos');
          }).length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm">
              <h4 className="text-amber-800 font-bold mb-2 flex items-center gap-2">⚠️ Advertencias del Análisis</h4>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                {item.advertencias
                  .filter(adv => {
                    const l = adv.toLowerCase();
                    return !l.includes('adaptado desde la partida base') && !l.includes('apu adaptado') && !l.includes('se mantuvieron rendimientos') && !l.includes('se eliminaron los insumos');
                  })
                  .map((adv, idx) => (
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

      {/* MODAL DE SOLICITUD DE SUSCRIPCIÓN / PLANES */}
      <SubscriptionRequestModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        limitType="apu"
      />
    </div>
  );
}
