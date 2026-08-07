import { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL, getMyLandingSiteConfig, updateMyLandingSiteConfig } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { 
  FiUpload, FiUser, FiSettings, FiFileText, FiGrid, FiSave, 
  FiPlus, FiTrash2, FiEdit, FiCheck, FiX, FiChevronDown, FiChevronUp, 
  FiLink, FiPhone, FiMail, FiMapPin, FiMessageSquare, FiStar, FiSliders, FiAlertCircle 
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const DEFAULT_HERO_STATS = [
  { id: 'hs-1', number: '15+', label: 'Años de Experiencia' },
  { id: 'hs-2', number: '200+', label: 'Proyectos Entregados' },
  { id: 'hs-3', number: '100%', label: 'Garantía de Calidad' }
];

const DEFAULT_ABOUT_STATS = [
  { id: 'as-1', number: 200, suffix: '+', label: 'Proyectos Completados' },
  { id: 'as-2', number: 500, suffix: '+', label: 'Clientes Satisfechos' },
  { id: 'as-3', number: 15, suffix: '', label: 'Años de Experiencia' },
  { id: 'as-4', number: 50, suffix: '+', label: 'Colaboradores Expertos' }
];

const DEFAULT_ABOUT_FEATURES = [
  { id: 'af-1', icon: 'CheckCircle', title: 'Calidad Garantizada', desc: 'Utilizamos materiales certificados y técnicas constructivas de vanguardia.' },
  { id: 'af-2', icon: 'Award', title: 'Empresa Certificada', desc: 'Contamos con todas las certificaciones y registros necesarios para operar.' },
  { id: 'af-3', icon: 'Users', title: 'Equipo Especializado', desc: 'Ingenieros, arquitectos y técnicos con años de experiencia.' },
  { id: 'af-4', icon: 'ShieldCheck', title: 'Cumplimiento de Plazos', desc: 'Entregamos a tiempo sin sacrificar calidad.' }
];

const DEFAULT_PORTFOLIO_PROJECTS = [
  {
    id: 1,
    title: 'Residencia Las Acacias',
    category: 'Residencial',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    description: 'Construcción de vivienda unifamiliar de 320m² con diseño moderno, 4 habitaciones, 3 baños, área de servicio y jardín interior. Materiales de primera calidad con acabados importados.',
    duration: '8 meses',
    area: '320 m²',
    year: '2024'
  },
  {
    id: 2,
    title: 'Remodelación Oficinas Central',
    category: 'Comercial',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    description: 'Transformación integral de 5 pisos de oficinas corporativas. Nuevo diseño open-space, salas de reuniones, área lounge y modernización de instalaciones eléctricas y de red.',
    duration: '4 meses',
    area: '1,200 m²',
    year: '2024'
  },
  {
    id: 3,
    title: 'Conjunto Residencial Torres',
    category: 'Residencial',
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    description: 'Desarrollo de conjunto residencial de 24 apartamentos, 2 torres de 6 niveles con áreas comunes, gimnasio, piscina y parque infantil.',
    duration: '18 meses',
    area: '4,800 m²',
    year: '2023'
  },
  {
    id: 4,
    title: 'Restaurante Gourmet Nova',
    category: 'Comercial',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    description: 'Construcción y acondicionamiento de restaurante gourmet de 2 niveles con cocina industrial, barra de cócteles, terraza exterior y baños premium.',
    duration: '3 meses',
    area: '480 m²',
    year: '2023'
  },
  {
    id: 5,
    title: 'Villa Mediterránea',
    category: 'Residencial',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80',
    description: 'Diseño y construcción de villa estilo mediterráneo con piscina desbordante, jardines paisajistas, sala de cine, bodega de vinos y sistema domótico completo.',
    duration: '12 meses',
    area: '650 m²',
    year: '2022'
  },
  {
    id: 6,
    title: 'Refuerzo Estructural Edificio Caracas',
    category: 'Estructural',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
    description: 'Evaluación y refuerzo estructural de edificio de 12 pisos. Instalación de muros de corte, vigas de amarre, nuevas columnas y sistemas anti-sísmicos.',
    duration: '6 meses',
    area: '2,400 m²',
    year: '2022'
  }
];

export default function ProfilePage() {
  const { logout } = useContext(AuthContext);
  const location = useLocation();
  
  // Extraer el slug de la URL actual
  const pathParts = location.pathname.split('/').filter(Boolean);
  const isTenantRoute = pathParts.length >= 2 && pathParts[1] === 'admin' && pathParts[0] !== 'admin';
  const urlSlug = isTenantRoute ? pathParts[0] : null;

  const [activeTab, setActiveTab] = useState('identidad');
  const [activeContentSection, setActiveContentSection] = useState('hero');
  const [siteConfig, setSiteConfig] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Estados para CRUD de sub-elementos
  const [showCrudModal, setShowCrudModal] = useState(false);
  const [crudType, setCrudType] = useState(''); // 'service' | 'step' | 'testimonial'
  const [crudIndex, setCrudIndex] = useState(-1); // -1 para nuevo
  const [crudData, setCrudData] = useState({});

  // Cargar configuración del sitio al montar
  useEffect(() => {
    fetchSiteConfig();
  }, []);

  const fetchSiteConfig = async () => {
    try {
      if (urlSlug) {
        const token = localStorage.getItem('arko_admin_token');
        const config = await getMyLandingSiteConfig(token);
        if (config) setSiteConfig(config);
      } else {
        const response = await fetch(`${API_URL}/arko/config`);
        if (response.ok) {
          const config = await response.json();
          setSiteConfig(config);
        }
      }
    } catch (error) {
      if (error.message === 'Unauthorized') logout();
      console.error('Error fetching site config:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem('arko_admin_token');
      let result;

      if (urlSlug) {
        result = await updateMyLandingSiteConfig(token, siteConfig);
      } else {
        const response = await fetch(`${API_URL}/arko/admin/config`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(siteConfig)
        });

        if (response.status === 401) {
          logout();
          return;
        }
        
        if (!response.ok) throw new Error('Error saving config');
        result = await response.json();
        result = result.config || siteConfig;
      }

      setSiteConfig(result);
      toast.success('Configuración guardada exitosamente');
        
        // Aplicar el color dinámicamente si cambió
        if (siteConfig.branding?.primaryColor) {
          document.documentElement.style.setProperty('--primary-color', siteConfig.branding.primaryColor);
          localStorage.setItem('arko_primary_color', siteConfig.branding.primaryColor);
        }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper para actualizar valores anidados en el estado
  const updateConfigValue = (path, value) => {
    setSiteConfig(prev => {
      if (!prev) return prev;
      const copy = { ...prev };
      const parts = path.split('.');
      let current = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  // Manejar subida de archivos/imágenes
  const handleImageUpload = async (e, path) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = localStorage.getItem('arko_admin_token');
      const uploadEndpoint = urlSlug 
        ? `${API_URL}/arko/landing_sites/me/upload`
        : `${API_URL}/arko/admin/upload`;
        
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.status === 401) {
        logout();
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        updateConfigValue(path, data.image_url);
      } else {
        toast.error('Error al subir la imagen');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Error al subir la imagen');
    }
  };

  // Abrir Modal CRUD
  const openCrudModal = (type, index = -1) => {
    setCrudType(type);
    setCrudIndex(index);
    setShowCrudModal(true);
    
    if (type === 'service') {
      const currentList = siteConfig.services?.list || [];
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `srv-${Date.now()}`, icon: 'Building2', title: '', desc: '' });
    } else if (type === 'step') {
      const currentList = siteConfig.process?.steps || [];
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `prc-${Date.now()}`, icon: 'Settings', title: '', desc: '' });
    } else if (type === 'testimonial') {
      const currentList = siteConfig.testimonials?.list || [];
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `tst-${Date.now()}`, text: '', name: '', role: '', avatar: '', stars: 5 });
    } else if (type === 'portfolio') {
      const currentList = (siteConfig.portfolioProjects?.length > 0) ? siteConfig.portfolioProjects : DEFAULT_PORTFOLIO_PROJECTS;
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `prj-${Date.now()}`, title: '', category: 'Residencial', image: '', description: '', duration: '', area: '', year: '' });
    } else if (type === 'herostat') {
      const currentList = siteConfig.hero?.stats?.length > 0 ? siteConfig.hero.stats : DEFAULT_HERO_STATS;
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `hs-${Date.now()}`, number: '', label: '' });
    } else if (type === 'aboutstat') {
      const currentList = siteConfig.aboutUs?.stats?.length > 0 ? siteConfig.aboutUs.stats : DEFAULT_ABOUT_STATS;
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `as-${Date.now()}`, number: '', suffix: '', label: '' });
    } else if (type === 'aboutfeature') {
      const currentList = siteConfig.aboutUs?.features?.length > 0 ? siteConfig.aboutUs.features : DEFAULT_ABOUT_FEATURES;
      setCrudData(index >= 0 ? { ...currentList[index] } : { id: `af-${Date.now()}`, icon: 'CheckCircle', title: '', desc: '' });
    }
  };

  // Guardar elemento del CRUD (Servicio, Testimonio o Paso de Proceso)
  const saveCrudItem = () => {
    if (crudType === 'service') {
      const currentList = [...(siteConfig.services?.list || [])];
      if (crudIndex >= 0) {
        currentList[crudIndex] = crudData;
      } else {
        currentList.push(crudData);
      }
      updateConfigValue('services.list', currentList);
    } else if (crudType === 'step') {
      const currentList = [...(siteConfig.process?.steps || [])];
      if (crudIndex >= 0) {
        currentList[crudIndex] = crudData;
      } else {
        currentList.push(crudData);
      }
      updateConfigValue('process.steps', currentList);
    } else if (crudType === 'testimonial') {
      const currentList = [...(siteConfig.testimonials?.list || [])];
      if (crudIndex >= 0) {
        currentList[crudIndex] = crudData;
      } else {
        currentList.push(crudData);
      }
      updateConfigValue('testimonials.list', currentList);
    } else if (crudType === 'portfolio') {
      const currentList = (siteConfig.portfolioProjects?.length > 0) ? [...siteConfig.portfolioProjects] : [...DEFAULT_PORTFOLIO_PROJECTS];
      if (crudIndex >= 0) {
        currentList[crudIndex] = crudData;
      } else {
        currentList.push(crudData);
      }
      updateConfigValue('portfolioProjects', currentList);
    } else if (crudType === 'herostat') {
      const currentList = siteConfig.hero?.stats?.length > 0 ? [...siteConfig.hero.stats] : [...DEFAULT_HERO_STATS];
      if (crudIndex >= 0) currentList[crudIndex] = crudData; else currentList.push(crudData);
      updateConfigValue('hero.stats', currentList);
    } else if (crudType === 'aboutstat') {
      const currentList = siteConfig.aboutUs?.stats?.length > 0 ? [...siteConfig.aboutUs.stats] : [...DEFAULT_ABOUT_STATS];
      if (crudIndex >= 0) currentList[crudIndex] = crudData; else currentList.push(crudData);
      updateConfigValue('aboutUs.stats', currentList);
    } else if (crudType === 'aboutfeature') {
      const currentList = siteConfig.aboutUs?.features?.length > 0 ? [...siteConfig.aboutUs.features] : [...DEFAULT_ABOUT_FEATURES];
      if (crudIndex >= 0) currentList[crudIndex] = crudData; else currentList.push(crudData);
      updateConfigValue('aboutUs.features', currentList);
    }
    setShowCrudModal(false);
  };

  // Eliminar elemento de una lista
  const performDelete = (type, index) => {
    if (type === 'service') {
      const currentList = [...(siteConfig.services?.list || [])];
      currentList.splice(index, 1);
      updateConfigValue('services.list', currentList);
    } else if (type === 'step') {
      const currentList = [...(siteConfig.process?.steps || [])];
      currentList.splice(index, 1);
      updateConfigValue('process.steps', currentList);
    } else if (type === 'testimonial') {
      const currentList = [...(siteConfig.testimonials?.list || [])];
      currentList.splice(index, 1);
      updateConfigValue('testimonials.list', currentList);
    } else if (type === 'portfolio') {
      const currentList = (siteConfig.portfolioProjects?.length > 0) ? [...siteConfig.portfolioProjects] : [...DEFAULT_PORTFOLIO_PROJECTS];
      currentList.splice(index, 1);
      updateConfigValue('portfolioProjects', currentList);
    } else if (type === 'herostat') {
      const currentList = siteConfig.hero?.stats?.length > 0 ? [...siteConfig.hero.stats] : [...DEFAULT_HERO_STATS];
      currentList.splice(index, 1);
      updateConfigValue('hero.stats', currentList);
    } else if (type === 'aboutstat') {
      const currentList = siteConfig.aboutUs?.stats?.length > 0 ? [...siteConfig.aboutUs.stats] : [...DEFAULT_ABOUT_STATS];
      currentList.splice(index, 1);
      updateConfigValue('aboutUs.stats', currentList);
    } else if (type === 'aboutfeature') {
      const currentList = siteConfig.aboutUs?.features?.length > 0 ? [...siteConfig.aboutUs.features] : [...DEFAULT_ABOUT_FEATURES];
      currentList.splice(index, 1);
      updateConfigValue('aboutUs.features', currentList);
    }
  };

  const deleteCrudItem = (type, index) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[250px]">
        <div className="flex items-center gap-2 text-gray-900 font-medium">
          <FiAlertCircle className="text-amber-500 flex-shrink-0" size={20} />
          <span>¿Estás seguro de que deseas eliminar este elemento?</span>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              performDelete(type, index);
              toast.dismiss(t.id);
            }}
            className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  };

  if (!siteConfig) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Cargando configuración...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'identidad', label: 'Identidad', icon: FiUser },
    { id: 'apariencia', label: 'Apariencia', icon: FiSettings },
    { id: 'contacto', label: 'Contacto', icon: FiFileText },
    { id: 'contenido', label: 'Contenido Landing', icon: FiGrid },
    { id: 'modulos', label: 'Módulos Visibles', icon: FiGrid },
    { id: 'herramientas', label: 'Herramientas', icon: FiSliders },
  ];

  const primaryColor = siteConfig.branding?.primaryColor || '#0a4275';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración de la Landing Page</h1>
          <p className="text-gray-600 mt-1">Personaliza los textos, imágenes y visibilidad de las secciones de Arko 360.</p>
        </div>
        
        {/* Guardar cambios flotante/fijo en el header */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-lg shadow transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            <FiSave className="w-5 h-5" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex flex-wrap gap-2 md:space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* IDENTIDAD */}
        {activeTab === 'identidad' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-950 mb-4">Branding e Identidad del Sitio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Sitio</label>
                  <input
                    type="text"
                    value={siteConfig.siteName || ''}
                    onChange={(e) => updateConfigValue('siteName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="Ej. Ingeniería Arko 360"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL Actual</label>
                  <input
                    type="text"
                    value={siteConfig.logoUrl || ''}
                    onChange={(e) => updateConfigValue('logoUrl', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-gray-50 text-gray-500"
                    disabled
                  />
                </div>
              </div>

              {/* Subidor de Logo */}
              <div className="mt-6 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
                <div className="flex flex-col items-center">
                  {siteConfig.logoUrl ? (
                    <img src={siteConfig.logoUrl} alt="Logo" className="h-16 object-contain mb-4 bg-gray-50 p-2 rounded border" />
                  ) : (
                    <div className="w-16 h-16 bg-indigo-50 rounded-lg flex items-center justify-center mb-4">
                      <span className="text-xl font-bold text-indigo-600">A360</span>
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mb-2">Sube un nuevo logo para el encabezado</p>
                  <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium cursor-pointer">
                    <FiUpload className="inline mr-2" /> Seleccionar Imagen
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'logoUrl')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-2">Formatos recomendados: PNG o SVG con fondo transparente</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-950 mb-4">Generador de Redes Sociales (Carruseles)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Autor</label>
                  <input
                    type="text"
                    value={siteConfig.socialAuthorName || ''}
                    onChange={(e) => updateConfigValue('socialAuthorName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="Ej. Ing. Pablo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fondo Actual</label>
                  <input
                    type="text"
                    value={siteConfig.socialBackgroundImage || ''}
                    onChange={(e) => updateConfigValue('socialBackgroundImage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-gray-50 text-gray-500"
                    disabled
                  />
                </div>
              </div>

              <div className="mt-6 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
                <div className="flex flex-col items-center">
                  {siteConfig.socialBackgroundImage ? (
                    <img src={siteConfig.socialBackgroundImage} alt="Fondo Redes" className="h-32 object-contain mb-4 bg-gray-50 p-2 rounded border" />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <FiGrid className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mb-2">Sube una nueva imagen de fondo para los carruseles</p>
                  <label className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium cursor-pointer">
                    <FiUpload className="inline mr-2" /> Seleccionar Fondo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'socialBackgroundImage')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-950 mb-4">Pie de Página (Footer)</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Footer</label>
                <textarea
                  value={siteConfig.footer?.description || ''}
                  onChange={(e) => updateConfigValue('footer.description', e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  placeholder="Transformamos espacios y construimos el futuro. Expertos en ingeniería..."
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">Texto breve que aparece debajo del logo al final de la página.</p>
              </div>
            </div>
          </div>
        )}

        {/* APARIENCIA */}
        {activeTab === 'apariencia' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-950 mb-4">Colores de Marca</h3>
            <p className="text-sm text-gray-600 mb-6">Define los colores globales para botones, acentos y textos resaltados de tu Landing Page.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <label className="block text-sm font-bold text-gray-800 mb-2">Color Primario</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={siteConfig.branding?.primaryColor || '#0a4275'}
                    onChange={(e) => {
                      updateConfigValue('branding.primaryColor', e.target.value);
                      updateConfigValue('primaryColor', e.target.value);
                    }}
                    className="w-14 h-14 border border-gray-200 rounded-lg cursor-pointer bg-white p-1"
                  />
                  <input
                    type="text"
                    value={siteConfig.branding?.primaryColor || '#0a4275'}
                    onChange={(e) => {
                      updateConfigValue('branding.primaryColor', e.target.value);
                      updateConfigValue('primaryColor', e.target.value);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase outline-none"
                    placeholder="#0a4275"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Se utiliza principalmente para botones destacados, banners y secciones principales.</p>
              </div>

              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <label className="block text-sm font-bold text-gray-800 mb-2">Color Secundario / Acento</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={siteConfig.branding?.secondaryColor || '#27ae60'}
                    onChange={(e) => {
                      updateConfigValue('branding.secondaryColor', e.target.value);
                      updateConfigValue('secondaryColor', e.target.value);
                    }}
                    className="w-14 h-14 border border-gray-200 rounded-lg cursor-pointer bg-white p-1"
                  />
                  <input
                    type="text"
                    value={siteConfig.branding?.secondaryColor || '#27ae60'}
                    onChange={(e) => {
                      updateConfigValue('branding.secondaryColor', e.target.value);
                      updateConfigValue('secondaryColor', e.target.value);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase outline-none"
                    placeholder="#27ae60"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Se utiliza para insignias (badges), textos destacados y efectos dinámicos.</p>
              </div>
            </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-950 mb-4">Imagen de Fondo (Hero Background)</h3>
              <p className="text-sm text-gray-600 mb-4">La imagen principal que se muestra en la sección superior (Hero) de tu sitio.</p>
              
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
                <div className="flex flex-col items-center">
                  {siteConfig.hero?.backgroundImage ? (
                    <div className="relative w-full max-w-md aspect-video mb-4 rounded-lg overflow-hidden border border-gray-200">
                      <img src={siteConfig.hero.backgroundImage} alt="Hero Background" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full max-w-md aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-4 border border-gray-200">
                      <span className="text-gray-400">Usando fondo por defecto (textura CSS)</span>
                    </div>
                  )}
                  <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium cursor-pointer">
                    <FiUpload className="inline mr-2" /> Subir Imagen de Fondo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'hero.backgroundImage')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-2">Recomendado: 1920x1080px (Alta resolución, oscura preferiblemente)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTACTO */}
        {activeTab === 'contacto' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-950 mb-4">Textos de la Sección</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título Principal</label>
                <input
                  type="text"
                  value={siteConfig.contact?.title || ''}
                  onChange={(e) => updateConfigValue('contact.title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="¿Listo para construir tu próximo proyecto?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo Descriptivo</label>
                <textarea
                  rows="3"
                  value={siteConfig.contact?.subtitle || ''}
                  onChange={(e) => updateConfigValue('contact.subtitle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Escríbenos y nuestro equipo de ingenieros se pondrá en contacto..."
                />
              </div>
            </div>

            <hr className="border-gray-100" />
            
            <h3 className="text-lg font-bold text-gray-950 mb-4">Información de Contacto y Enlaces</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <FiPhone /> Teléfono Público
                </label>
                <input
                  type="text"
                  value={siteConfig.global?.phone || ''}
                  onChange={(e) => updateConfigValue('global.phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej. +58 412 000 0000"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <FiMail /> Correo Electrónico
                </label>
                <input
                  type="email"
                  value={siteConfig.global?.email || ''}
                  onChange={(e) => updateConfigValue('global.email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="proyectos@arko360.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <FiMapPin /> Ubicación
                </label>
                <input
                  type="text"
                  value={siteConfig.global?.location || ''}
                  onChange={(e) => updateConfigValue('global.location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej. Caracas, Venezuela"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <FiMessageSquare /> WhatsApp Link / Número
                </label>
                <input
                  type="text"
                  value={siteConfig.global?.whatsapp || ''}
                  onChange={(e) => updateConfigValue('global.whatsapp', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej. +584120000000"
                />
                <span className="text-xs text-gray-400 mt-1">Escribe el número completo en formato internacional sin el signo "+"</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h4 className="font-bold text-gray-800 mb-4">Redes Sociales</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['instagram', 'facebook', 'linkedin', 'twitter'].map((network) => (
                  <div key={network}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{network}</label>
                    <input
                      type="text"
                      value={siteConfig.global?.social?.[network] || ''}
                      onChange={(e) => updateConfigValue(`global.social.${network}`, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="#"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO LANDING */}
        {activeTab === 'contenido' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sub-Navegación Lateral */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase px-3 mb-2">Secciones</span>
              {[
                { id: 'hero', label: '1. Inicio / Hero' },
                { id: 'aboutUs', label: '2. Nosotros' },
                { id: 'services', label: '3. Servicios' },
                { id: 'process', label: '4. Metodología' },
                { id: 'testimonials', label: '5. Testimonios' },
                { id: 'portfolio', label: '6. Portafolio' }
              ].map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveContentSection(sec.id)}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                    activeContentSection === sec.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Configuración de la sección seleccionada */}
            <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
              
              {/* HERO */}
              {activeContentSection === 'hero' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2 mb-4">Sección Inicio (Hero)</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insignia (Badge)</label>
                    <input
                      type="text"
                      value={siteConfig.hero?.badge || ''}
                      onChange={(e) => updateConfigValue('hero.badge', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título línea 1</label>
                      <input
                        type="text"
                        value={siteConfig.hero?.titleLine1 || ''}
                        onChange={(e) => updateConfigValue('hero.titleLine1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texto Destacado (Verde)</label>
                      <input
                        type="text"
                        value={siteConfig.hero?.titleAccent || ''}
                        onChange={(e) => updateConfigValue('hero.titleAccent', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título línea 2</label>
                      <input
                        type="text"
                        value={siteConfig.hero?.titleLine2 || ''}
                        onChange={(e) => updateConfigValue('hero.titleLine2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo / Introducción</label>
                    <textarea
                      rows={3}
                      value={siteConfig.hero?.subtitle || ''}
                      onChange={(e) => updateConfigValue('hero.subtitle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Texto Botón Principal</label>
                        <input
                          type="text"
                          value={siteConfig.hero?.ctaPrimary || ''}
                          onChange={(e) => updateConfigValue('hero.ctaPrimary', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enlace Botón Principal (Ej. https://wa.me/...)</label>
                        <input
                          type="text"
                          value={siteConfig.hero?.ctaPrimaryUrl || ''}
                          onChange={(e) => updateConfigValue('hero.ctaPrimaryUrl', e.target.value)}
                          placeholder="#contacto"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Texto Botón Secundario</label>
                        <input
                          type="text"
                          value={siteConfig.hero?.ctaSecondary || ''}
                          onChange={(e) => updateConfigValue('hero.ctaSecondary', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enlace Botón Secundario</label>
                        <input
                          type="text"
                          value={siteConfig.hero?.ctaSecondaryUrl || ''}
                          onChange={(e) => updateConfigValue('hero.ctaSecondaryUrl', e.target.value)}
                          placeholder="#proyectos"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Listado de Estadísticas Hero */}
                  <div className="border-t pt-4 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Estadísticas Principales ({siteConfig.hero?.stats?.length || DEFAULT_HERO_STATS.length})</h5>
                      <button
                        onClick={() => openCrudModal('herostat')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Estadística
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(siteConfig.hero?.stats?.length > 0 ? siteConfig.hero.stats : DEFAULT_HERO_STATS).map((stat, index) => (
                        <div key={stat.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{stat.number}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openCrudModal('herostat', index)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Editar"><FiEdit size={16} /></button>
                            <button onClick={() => deleteCrudItem('herostat', index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar"><FiTrash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ABOUT US */}
              {activeContentSection === 'aboutUs' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2 mb-4">Sección Nosotros</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tag Superior</label>
                      <input
                        type="text"
                        value={siteConfig.aboutUs?.tag || ''}
                        onChange={(e) => updateConfigValue('aboutUs.tag', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título de la Sección</label>
                      <input
                        type="text"
                        value={siteConfig.aboutUs?.title || ''}
                        onChange={(e) => updateConfigValue('aboutUs.title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primer Párrafo</label>
                    <textarea
                      rows={3}
                      value={siteConfig.aboutUs?.p1 || ''}
                      onChange={(e) => updateConfigValue('aboutUs.p1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Párrafo</label>
                    <textarea
                      rows={3}
                      value={siteConfig.aboutUs?.p2 || ''}
                      onChange={(e) => updateConfigValue('aboutUs.p2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  
                  {/* Carga de Imagen Nosotros */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de la Sección</label>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                      <img src={siteConfig.aboutUs?.imageUrl || ''} alt="Nosotros" className="w-32 h-20 object-cover rounded border" />
                      <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium cursor-pointer">
                        <FiUpload className="inline mr-2" /> Subir Imagen
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'aboutUs.imageUrl')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Listado de Estadísticas Nosotros */}
                  <div className="border-t pt-4 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Métricas de Empresa ({siteConfig.aboutUs?.stats?.length || DEFAULT_ABOUT_STATS.length})</h5>
                      <button
                        onClick={() => openCrudModal('aboutstat')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Métrica
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(siteConfig.aboutUs?.stats?.length > 0 ? siteConfig.aboutUs.stats : DEFAULT_ABOUT_STATS).map((stat, index) => (
                        <div key={stat.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{stat.number}{stat.suffix}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openCrudModal('aboutstat', index)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"><FiEdit size={16} /></button>
                            <button onClick={() => deleteCrudItem('aboutstat', index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><FiTrash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Listado de Pilares / Características */}
                  <div className="border-t pt-4 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Pilares / Características ({siteConfig.aboutUs?.features?.length || DEFAULT_ABOUT_FEATURES.length})</h5>
                      <button
                        onClick={() => openCrudModal('aboutfeature')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Pilar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {(siteConfig.aboutUs?.features?.length > 0 ? siteConfig.aboutUs.features : DEFAULT_ABOUT_FEATURES).map((feat, index) => (
                        <div key={feat.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{feat.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{feat.desc}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openCrudModal('aboutfeature', index)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"><FiEdit size={16} /></button>
                            <button onClick={() => deleteCrudItem('aboutfeature', index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><FiTrash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SERVICES */}
              {activeContentSection === 'services' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 border-b pb-2 mb-4">Sección Servicios</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tag Superior</label>
                        <input
                          type="text"
                          value={siteConfig.services?.tag || ''}
                          onChange={(e) => updateConfigValue('services.tag', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título de la Sección</label>
                        <input
                          type="text"
                          value={siteConfig.services?.title || ''}
                          onChange={(e) => updateConfigValue('services.title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo descriptivo</label>
                      <input
                        type="text"
                        value={siteConfig.services?.subtitle || ''}
                        onChange={(e) => updateConfigValue('services.subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  {/* Listado de Servicios */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Servicios Ofrecidos ({siteConfig.services?.list?.length || 0})</h5>
                      <button
                        onClick={() => openCrudModal('service')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Servicio
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(siteConfig.services?.list || []).map((srv, index) => (
                        <div key={srv.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{srv.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{srv.desc}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCrudModal('service', index)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Editar"
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={() => deleteCrudItem('service', index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PROCESS (METODOLOGÍA) */}
              {activeContentSection === 'process' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 border-b pb-2 mb-4">Sección Metodología / Proceso</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tag Superior</label>
                        <input
                          type="text"
                          value={siteConfig.process?.tag || ''}
                          onChange={(e) => updateConfigValue('process.tag', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título de la Sección</label>
                        <input
                          type="text"
                          value={siteConfig.process?.title || ''}
                          onChange={(e) => updateConfigValue('process.title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={siteConfig.process?.subtitle || ''}
                        onChange={(e) => updateConfigValue('process.subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  {/* Listado de Pasos */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Pasos de Trabajo ({siteConfig.process?.steps?.length || 0})</h5>
                      <button
                        onClick={() => openCrudModal('step')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Paso
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(siteConfig.process?.steps || []).map((step, index) => (
                        <div key={step.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{step.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{step.desc}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCrudModal('step', index)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Editar"
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={() => deleteCrudItem('step', index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TESTIMONIALS */}
              {activeContentSection === 'testimonials' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 border-b pb-2 mb-4">Sección Testimonios</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tag Superior</label>
                        <input
                          type="text"
                          value={siteConfig.testimonials?.tag || ''}
                          onChange={(e) => updateConfigValue('testimonials.tag', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título de la Sección</label>
                        <input
                          type="text"
                          value={siteConfig.testimonials?.title || ''}
                          onChange={(e) => updateConfigValue('testimonials.title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo descriptivo</label>
                      <input
                        type="text"
                        value={siteConfig.testimonials?.subtitle || ''}
                        onChange={(e) => updateConfigValue('testimonials.subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  {/* Listado de Testimonios */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Testimonios Activos ({siteConfig.testimonials?.list?.length || 0})</h5>
                      <button
                        onClick={() => openCrudModal('testimonial')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Testimonio
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(siteConfig.testimonials?.list || []).map((tst, index) => (
                        <div key={tst.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <img src={tst.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'} alt="Avatar" className="w-10 h-10 object-cover rounded-full border" />
                            <div>
                              <div className="font-bold text-gray-800 text-sm">{tst.name}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{tst.role}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCrudModal('testimonial', index)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Editar"
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={() => deleteCrudItem('testimonial', index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PORTAFOLIO */}
              {activeContentSection === 'portfolio' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 border-b pb-2 mb-4">Sección Portafolio</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tag Superior</label>
                        <input
                          type="text"
                          value={siteConfig.portfolio?.tag || ''}
                          onChange={(e) => updateConfigValue('portfolio.tag', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título de la Sección</label>
                        <input
                          type="text"
                          value={siteConfig.portfolio?.title || ''}
                          onChange={(e) => updateConfigValue('portfolio.title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo descriptivo</label>
                      <input
                        type="text"
                        value={siteConfig.portfolio?.subtitle || ''}
                        onChange={(e) => updateConfigValue('portfolio.subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  {/* Listado de Proyectos */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-bold text-gray-800">Proyectos Activos ({((siteConfig.portfolioProjects?.length > 0) ? siteConfig.portfolioProjects : DEFAULT_PORTFOLIO_PROJECTS).length})</h5>
                      <button
                        onClick={() => openCrudModal('portfolio')}
                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 py-1.5 px-3 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <FiPlus /> Añadir Proyecto
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {((siteConfig.portfolioProjects?.length > 0) ? siteConfig.portfolioProjects : DEFAULT_PORTFOLIO_PROJECTS).map((prj, index) => (
                        <div key={prj.id || index} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <img src={prj.image || prj.imageUrl || 'https://via.placeholder.com/150'} alt="Project" className="w-12 h-12 object-cover rounded-md border" />
                            <div>
                              <div className="font-bold text-gray-800 text-sm">{prj.title}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{prj.category} | {prj.year}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCrudModal('portfolio', index)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Editar"
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={() => deleteCrudItem('portfolio', index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* MÓDULOS VISIBLES */}
        {activeTab === 'modulos' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-950 mb-2">Visibilidad de Secciones</h3>
            <p className="text-sm text-gray-600 mb-6">Elige qué secciones de la Landing Page deseas mostrar u ocultar en producción.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'showAbout', label: 'Sobre Nosotros (Historia, Equipo, Estadísticas)' },
                { key: 'showServices', label: 'Servicios (Tarjetas de Servicios Ofrecidos)' },
                { key: 'showPortfolio', label: 'Portafolio (Galería de Proyectos Ejecutados)' },
                { key: 'showProcess', label: 'Metodología (Pasos del Flujo de Trabajo)' },
                { key: 'showTestimonials', label: 'Testimonios (Reseñas de Clientes Satisfechos)' },
                { key: 'showBiblio', label: 'Biblioteca Biblioteca BiblioARKO' },
                { key: 'showTools', label: 'Calculadoras de Ingeniería (Herramientas Técnicas)' },
                { key: 'showCotizador', label: 'Cotizador Interactivo' }
              ].map((sec) => (
                <div key={sec.key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-semibold text-gray-800">{sec.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={siteConfig.sections?.[sec.key] !== false}
                      onChange={(e) => updateConfigValue(`sections.${sec.key}`, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HERRAMIENTAS */}
        {activeTab === 'herramientas' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-950 mb-2">Visibilidad de Calculadoras de Ingeniería</h3>
            <p className="text-sm text-gray-600 mb-6">Elige cuáles calculadoras específicas deseas mostrar u ocultar en la sección de herramientas de la Landing Page.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'showCieloRaso', label: 'Cálculo de Cielo Raso' },
                { key: 'showMuroGravedad', label: 'Diseño de Muro de Gravedad' },
                { key: 'showDisenoMezclas', label: 'Diseño de Mezclas de Concreto' },
                { key: 'showDrywall', label: 'Calculadora de Drywall' },
                { key: 'showCieloRasoVisible', label: 'Cálculo de Cielo Raso (Visible)' },
                { key: 'showElectrica', label: 'Calculadora Eléctrica' },
                { key: 'showEscaleras', label: 'Calculadora de Escaleras' },
                { key: 'showLosas', label: 'Calculadora de Losas' },
                { key: 'showMamposteria', label: 'Calculadora de Mampostería' },
                { key: 'showArko3D', label: 'Módulo ARKO3D (Cálculo FEM)' },
                { key: 'showCotizadorPorcelanato', label: 'Cotizador de Instalación de Porcelanato' },
                { key: 'showCotizadorBano', label: 'Cotizador de Remodelación de Baño' },
                { key: 'showCotizadorVinil', label: 'Cotizador de Pisos de Vinil SPC' }
              ].map((calc) => (
                <div key={calc.key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-semibold text-gray-800">{calc.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={siteConfig.tools?.[calc.key] !== false}
                      onChange={(e) => updateConfigValue(`tools.${calc.key}`, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL PARA CRUD (SERVICIOS, METODOLOGÍA, TESTIMONIOS) */}
      {showCrudModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">
                {crudIndex >= 0 ? 'Editar Elemento' : 'Añadir Nuevo Elemento'} — {crudType === 'service' ? 'Servicio' : crudType === 'step' ? 'Paso de Proceso' : 'Testimonio'}
              </h3>
              <button onClick={() => setShowCrudModal(false)} className="text-gray-500 hover:text-gray-700">
                <FiX size={20} />
              </button>
            </div>

            {/* Formulario */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Para Servicios y Procesos */}
              {(crudType === 'service' || crudType === 'step') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <input
                      type="text"
                      value={crudData.title || ''}
                      onChange={(e) => setCrudData({ ...crudData, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ej. Construcción de Vivienda"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      rows={3}
                      value={crudData.desc || ''}
                      onChange={(e) => setCrudData({ ...crudData, desc: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Detalles sobre el servicio..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icono (Nombre de Lucide Icon)</label>
                    <select
                      value={crudData.icon || 'Building2'}
                      onChange={(e) => setCrudData({ ...crudData, icon: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Building2">Edificios (Building2)</option>
                      <option value="Hammer">Martillo (Hammer)</option>
                      <option value="Ruler">Regla (Ruler)</option>
                      <option value="HardHat">Casco (HardHat)</option>
                      <option value="Wrench">Llave Inglesa (Wrench)</option>
                      <option value="PenTool">Pluma Dibujo (PenTool)</option>
                      <option value="Settings">Engranaje (Settings)</option>
                      <option value="PencilRuler">Lápiz y Regla (PencilRuler)</option>
                      <option value="FileSignature">Firma (FileSignature)</option>
                      <option value="Key">Llave (Key)</option>
                      <option value="Zap">Rayo / Electricidad (Zap)</option>
                      <option value="Layers">Capas / Muros (Layers)</option>
                      <option value="Container">Contenedor / Mezcladora (Container)</option>
                      <option value="Calculator">Calculadora (Calculator)</option>
                      <option value="Grid">Cuadrícula (Grid)</option>
                    </select>
                  </div>
                </>
              )}

              {/* Para Testimonios */}
              {crudType === 'testimonial' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                      <input
                        type="text"
                        value={crudData.name || ''}
                        onChange={(e) => setCrudData({ ...crudData, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none"
                        placeholder="Carlos Mendoza"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Residencia</label>
                      <input
                        type="text"
                        value={crudData.role || ''}
                        onChange={(e) => setCrudData({ ...crudData, role: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none"
                        placeholder="Propietario"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estrellas de Calificación (1-5)</label>
                    <div className="flex gap-2 text-yellow-500 mt-1">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCrudData({ ...crudData, stars: num })}
                          className="focus:outline-none"
                        >
                          <FiStar className={`w-6 h-6 ${num <= (crudData.stars || 5) ? 'fill-yellow-500' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Testimonio (Texto)</label>
                    <textarea
                      rows={3}
                      value={crudData.text || ''}
                      onChange={(e) => setCrudData({ ...crudData, text: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none"
                      placeholder="Superó todas mis expectativas..."
                    />
                  </div>

                  {/* Foto de Cliente */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Foto / Avatar URL</label>
                    <div className="flex gap-4 items-center">
                      <img src={crudData.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'} alt="Cliente" className="w-14 h-14 object-cover rounded-full border" />
                      <label className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-250 transition-colors text-xs font-bold cursor-pointer border">
                        Subir Foto
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              const token = localStorage.getItem('arko_admin_token');
                              const uploadEndpoint = urlSlug 
                                ? `${API_URL}/arko/landing_sites/me/upload`
                                : `${API_URL}/arko/admin/upload`;
                              const response = await fetch(uploadEndpoint, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` },
                                body: formData
                              });
                              if (response.status === 401) {
                                logout();
                                return;
                              }
                              if (response.ok) {
                                const res = await response.json();
                                setCrudData({ ...crudData, avatar: res.image_url });
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Para Portafolio */}
              {crudType === 'portfolio' && (
                <>
                  {/* ... Portfolio Modal Content remains ... */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título del Proyecto</label>
                      <input
                        type="text"
                        value={crudData.title || ''}
                        onChange={(e) => setCrudData({ ...crudData, title: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Edificio Residencial Las Palmas"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                      <select
                        value={crudData.category || 'Residencial'}
                        onChange={(e) => setCrudData({ ...crudData, category: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Residencial">Residencial</option>
                        <option value="Comercial">Comercial</option>
                        <option value="Estructural">Estructural</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Remodelación">Remodelación</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                      <input
                        type="text"
                        value={crudData.year || ''}
                        onChange={(e) => setCrudData({ ...crudData, year: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none"
                        placeholder="2024"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                      <input
                        type="text"
                        value={crudData.area || ''}
                        onChange={(e) => setCrudData({ ...crudData, area: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none"
                        placeholder="350 m²"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
                      <input
                        type="text"
                        value={crudData.duration || ''}
                        onChange={(e) => setCrudData({ ...crudData, duration: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none"
                        placeholder="6 meses"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                      <textarea
                        rows={3}
                        value={crudData.description || ''}
                        onChange={(e) => setCrudData({ ...crudData, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Breve descripción del proyecto..."
                      />
                    </div>
                    {/* Imagen de Portafolio */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Imagen del Proyecto</label>
                      <div className="flex gap-4 items-center">
                        <img src={crudData.image || crudData.imageUrl || 'https://via.placeholder.com/150'} alt="Project" className="w-20 h-14 object-cover rounded border" />
                        <label className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-250 transition-colors text-xs font-bold cursor-pointer border">
                          Subir Imagen
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const formData = new FormData();
                              formData.append('file', file);
                              try {
                                const token = localStorage.getItem('arko_admin_token');
                                const uploadEndpoint = `${API_URL}/arko/landing_sites/me/upload`;
                                const response = await fetch(uploadEndpoint, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` },
                                  body: formData
                                });
                                if (response.ok) {
                                  const res = await response.json();
                                  setCrudData({ ...crudData, image: res.image_url, imageUrl: res.image_url });
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {crudType === 'herostat' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número / Valor</label>
                    <input
                      type="text"
                      value={crudData.number || ''}
                      onChange={(e) => setCrudData({ ...crudData, number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="15+"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta (Label)</label>
                    <input
                      type="text"
                      value={crudData.label || ''}
                      onChange={(e) => setCrudData({ ...crudData, label: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Años de Experiencia"
                    />
                  </div>
                </div>
              )}

              {crudType === 'aboutstat' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                      <input
                        type="text"
                        value={crudData.number || ''}
                        onChange={(e) => setCrudData({ ...crudData, number: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sufijo</label>
                      <input
                        type="text"
                        value={crudData.suffix || ''}
                        onChange={(e) => setCrudData({ ...crudData, suffix: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="+"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta (Label)</label>
                    <input
                      type="text"
                      value={crudData.label || ''}
                      onChange={(e) => setCrudData({ ...crudData, label: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Proyectos Completados"
                    />
                  </div>
                </div>
              )}

              {crudType === 'aboutfeature' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <input
                      type="text"
                      value={crudData.title || ''}
                      onChange={(e) => setCrudData({ ...crudData, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Calidad Garantizada"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      rows={3}
                      value={crudData.desc || ''}
                      onChange={(e) => setCrudData({ ...crudData, desc: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Utilizamos materiales certificados..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Icono (Lucide)</label>
                    <input
                      type="text"
                      value={crudData.icon || ''}
                      onChange={(e) => setCrudData({ ...crudData, icon: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="CheckCircle"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowCrudModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCrudItem}
                className="px-5 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 shadow transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
