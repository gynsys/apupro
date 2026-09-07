// Datos estructurados del Centro de Ayuda de CostBase
// Extraídos y enriquecidos a partir de documentacion_usuario

export const HELP_CATEGORIES = [
  { id: 'all', name: 'Todo' },
  { id: 'guias', name: 'Guías Rápidas' },
  { id: 'tutoriales', name: 'Tutoriales' },
  { id: 'faq', name: 'Preguntas Frecuentes' },
];

export const HELP_ARTICLES = [
  {
    id: 'primer-presupuesto',
    title: 'Crear tu Primer Presupuesto Paso a Paso',
    category: 'tutoriales',
    badge: 'Tutorial',
    time: '10-15 min',
    level: 'Principiante',
    icon: 'FolderPlus',
    shortDesc: 'Guía paso a paso para crear un presupuesto de obra desde cero, estructurar capítulos y configurar APUs.',
    tags: ['nuevo presupuesto', 'primer presupuesto', 'capitulos', 'partidas', 'tutorial', 'crear'],
    steps: [
      {
        title: 'Paso 1: Iniciar Creación',
        desc: 'En el menú principal o en el Gestor de Presupuestos, haz clic en el botón "+ Nuevo Presupuesto".',
      },
      {
        title: 'Paso 2: Datos Iniciales',
        desc: 'Ingresa un nombre claro (ej. "Edificio Residencial Los Samanes"), selecciona la moneda de trabajo (USD o Bs.) y define el tipo de cambio si aplica.',
      },
      {
        title: 'Paso 3: Estructuración por Capítulos',
        desc: 'Organiza tu obra por capítulos lógicos (ej. Obras Preliminares, Estructuras, Albañilería, Instalaciones). Dentro de cada capítulo podrás incorporar tus partidas.',
      },
      {
        title: 'Paso 4: Añadir Partidas y APU',
        desc: 'Puedes importar partidas desde la Base Maestra, crear partidas con la Inteligencia Artificial de CostBase o incorporar tus partidas personalizadas.',
      },
      {
        title: 'Paso 5: Configurar Factores Globales',
        desc: 'Ajusta los porcentajes de Utilidad, Administración, IVA y FCAS para obtener el total general del proyecto.',
      }
    ],
    tips: [
      'Puedes duplicar cualquier presupuesto existente usando el botón de copia rápida para reutilizar estructuras en proyectos similares.',
      'Genera siempre un backup (.cb) al terminar de estructurar tu presupuesto para tener un respaldo seguro.'
    ]
  },
  {
    id: 'backup-restauracion',
    title: 'Backup y Restauración de Presupuestos (.cb)',
    category: 'guias',
    badge: 'Guía Rápida',
    time: '2-3 min',
    level: 'Principiante',
    icon: 'CloudDownload',
    shortDesc: 'Aprende a respaldar tus proyectos en archivos encriptados .cb y restaurarlos cuando lo necesites.',
    tags: ['backup', 'restaurar', 'archivo cb', 'exportar', 'importar', 'seguridad', 'respaldo'],
    steps: [
      {
        title: '¿Qué es un archivo .cb?',
        desc: 'Es un archivo de respaldo propietario y encriptado con AES-256 que incluye partidas, insumos, análisis de precios y configuraciones.',
      },
      {
        title: 'Exportar Backup',
        desc: 'En la tarjeta de cualquier presupuesto en el Gestor de Presupuestos, haz clic en el icono de nube "Exportar Backup". Se descargará inmediatamente un archivo con extensión .cb.',
      },
      {
        title: 'Restaurar / Importar Backup',
        desc: 'En la parte superior del Gestor de Presupuestos, haz clic en "Importar Backup", selecciona tu archivo .cb y el sistema restaurará el proyecto íntegro en tu cuenta.',
      }
    ],
    tips: [
      'Los archivos .cb están protegidos y vinculados a tu cuenta para garantizar confidencialidad.',
      'Un presupuesto restaurado es 100% independiente del original; las modificaciones en uno no afectan al otro.'
    ]
  },
  {
    id: 'compartir-presupuestos',
    title: 'Compartir Presupuestos mediante Enlace',
    category: 'guias',
    badge: 'Guía Rápida',
    time: '1-2 min',
    level: 'Principiante',
    icon: 'Share2',
    shortDesc: 'Genera enlaces de vista previa para clientes y permite a otros profesionales importar tu presupuesto.',
    tags: ['compartir', 'enlace', 'link', 'cliente', 'vista previa', 'importar compartido'],
    steps: [
      {
        title: 'Generar Enlace',
        desc: 'Haz clic en el icono "Compartir" (Share2) en la tarjeta del presupuesto para crear un enlace único de acceso.',
      },
      {
        title: 'Vista Previa Segura para Clientes',
        desc: 'Los destinatarios que abren el enlace verán un resumen profesional con totales y capítulos, sin comprometer fórmulas internas o insumos confidenciales.',
      },
      {
        title: 'Importación a otra cuenta',
        desc: 'Si el destinatario es usuario de CostBase, podrá importar el presupuesto completo a su propia cuenta con un solo clic.',
      }
    ],
    tips: [
      'Los enlaces de compartición pueden ser revocados en cualquier momento desde los ajustes del proyecto.',
      'Nadie puede editar tu presupuesto original a través del enlace compartido; siempre se genera una copia.'
    ]
  },
  {
    id: 'bases-de-datos',
    title: 'Gestión de Bases de Datos e Índices de Inflación',
    category: 'guias',
    badge: 'Guía Rápida',
    time: '3-4 min',
    level: 'Intermedio',
    icon: 'Database',
    shortDesc: 'Conoce las diferencias entre la Base Maestra, bases duplicadas con inflación y tu Base Personalizada.',
    tags: ['bases de datos', 'base maestra', 'base personalizada', 'inflacion', 'cost360', 'duplicar'],
    steps: [
      {
        title: 'Base Maestra (CostBase)',
        desc: 'Base de datos oficial con miles de partidas de construcción estándar, rendimientos e insumos de referencia continuamente auditados.',
      },
      {
        title: 'Duplicar Base con Inflación',
        desc: 'En "Gestión de Bases de Datos", haz clic en "+ Nueva Base de Datos" para crear una copia aplicando factores de inflación independientes a Materiales, Equipos y Mano de Obra.',
      },
      {
        title: 'Base Personalizada (Partidas Propias)',
        desc: 'Espacio exclusivo para tus partidas creadas desde cero o generadas con Inteligencia Artificial. No se mezcla con las partidas del sistema y es totalmente privada.',
      }
    ],
    tips: [
      'Puedes activar y cambiar entre bases de datos en cualquier momento desde el selector en la esquina superior del visor.',
      'En tu Base Personalizada puedes eliminar partidas que ya no utilices directamente desde su menú de acciones.'
    ]
  },
  {
    id: 'generador-apu-ia',
    title: 'Generador y Clonador de APU con Inteligencia Artificial',
    category: 'guias',
    badge: 'Guía Rápida',
    time: '3 min',
    level: 'Principiante',
    icon: 'Cpu',
    shortDesc: 'Aprende a redactar prompts para generar APUs desde cero o clonar y adaptar partidas existentes.',
    tags: ['ia', 'apu', 'generador', 'inteligencia artificial', 'clonar', 'partidas', 'prompt'],
    steps: [
      {
        title: 'Modo Generar con IA',
        desc: 'Describe en lenguaje natural la actividad que necesitas (ej. "Construcción de losa de concreto armado e=15cm f\'c=250 kg/cm2 con malla electrosoldada"). La IA estructurará materiales, cuadrilla y equipos con rendimientos típicos.',
      },
      {
        title: 'Modo Importar / Clonar',
        desc: 'Busca una partida existente en la Base Maestra, pulsa "Usar como base" y ajústala a las especificaciones exactas de tu obra sin comenzar de cero.',
      },
      {
        title: 'Edición en Tiempo Real',
        desc: 'Añade, elimina o ajusta precios de insumos en el editor interactivo y pulsa "Guardar en Base Personalizada".',
      }
    ],
    tips: [
      'Mientras más específica sea la descripción (especificación de resistencia, espesor, dosificación o altura), más exacto será el desglose de insumos generado por la IA.',
      'Los APUs se guardan con IVA en 0% por defecto porque el impuesto se aplica al total del presupuesto.'
    ]
  },
  {
    id: 'configuracion-costos',
    title: 'Configuración Global de Costos y Factores',
    category: 'guias',
    badge: 'Guía Rápida',
    time: '2-3 min',
    level: 'Intermedio',
    icon: 'Settings',
    shortDesc: 'Ajusta los porcentajes predeterminados de Utilidad, Gastos Administrativos, IVA y FCAS.',
    tags: ['costos', 'utilidad', 'administracion', 'iva', 'fcas', 'configuracion global', 'factores'],
    steps: [
      {
        title: 'Porcentaje de Utilidad',
        desc: 'Margen de ganancia comercial sobre el costo directo más administración (típicamente entre 10% y 25%).',
      },
      {
        title: 'Gastos de Administración',
        desc: 'Costos indirectos y operativos de oficina central y obra (típicamente entre 8% y 18%).',
      },
      {
        title: 'Impuesto al Valor Agregado (IVA)',
        desc: 'Porcentaje impositivo legal aplicable en tu país (ej. 16% en Venezuela).',
      },
      {
        title: 'Factor de Costo Social (FCAS)',
        desc: 'Aporte patronal y beneficios de ley sobre salarios de mano de obra (calculado de forma precisa con nuestra calculadora integrada).',
      }
    ],
    tips: [
      'Los cambios en la configuración global definen los valores por defecto de tus próximos presupuestos sin alterar los presupuestos ya creados.',
      'Puedes modificar estos factores individualmente para cada presupuesto desde su botón de "Configuración Global".'
    ]
  },
  {
    id: 'calculadora-fcas',
    title: 'Calculadora FCAS (Costos de Mano de Obra y Salarios)',
    category: 'guias',
    badge: 'Guía Rápida',
    time: '3 min',
    level: 'Intermedio',
    icon: 'Calculator',
    shortDesc: 'Calcula el Factor de Costos de Administración y Salarios cumpliendo con la LOTTT y convenciones colectivas.',
    tags: ['fcas', 'salarios', 'prestaciones', 'mano de obra', 'lottt', 'calculadora'],
    steps: [
      {
        title: '¿Qué comprende el FCAS?',
        desc: 'Considera días efectivamente laborados vs días pagados: días feriados, domingos, vacaciones, utilidades, reposos médicos y aportes de seguridad social (IVSS, FAOV, INCES).',
      },
      {
        title: 'Uso de la Calculadora',
        desc: 'Ingresa en la sección "/fcas" desde la barra lateral, revisa los parámetros anuales y obtén el porcentaje exacto para aplicar en tus cuadrillas.',
      }
    ],
    tips: [
      'Mantén actualizado el calendario de días feriados del año en curso para obtener un factor exacto en tus licitaciones.'
    ]
  }
];

export const HELP_FAQS = [
  {
    id: 'faq-1',
    category: 'General',
    q: '¿Qué es CostBase?',
    a: 'CostBase es una plataforma SaaS profesional para la gestión de presupuestos de construcción, generación interactiva de Análisis de Precios Unitarios (APU) asistida por IA y actualización de bases de datos de costos en tiempo real.'
  },
  {
    id: 'faq-2',
    category: 'Presupuestos',
    q: '¿Cómo exporto mi presupuesto a Microsoft Excel?',
    a: 'En el Gestor de Presupuestos, localiza el presupuesto deseado y haz clic en el icono "Exportar a Excel" (hoja de cálculo verde). Se generará automáticamente un archivo .xlsx formateado con capítulos, partidas, subtotales y fórmulas.'
  },
  {
    id: 'faq-3',
    category: 'Backup',
    q: '¿Qué es un archivo con extensión .cb?',
    a: 'Es un respaldo criptográfico de CostBase que contiene todas las partidas, cuadrillas, equipos, materiales y cálculos de tu presupuesto. Solo tu cuenta puede restaurarlo para proteger tu información.'
  },
  {
    id: 'faq-4',
    category: 'Backup',
    q: '¿Los backups .cb tienen fecha de caducidad?',
    a: 'No. Los archivos .cb son permanentes. Puedes almacenarlos en tu disco duro, nube o correo y restaurarlos en cualquier momento.'
  },
  {
    id: 'faq-5',
    category: 'Compartir',
    q: '¿Un cliente puede modificar mi presupuesto si le envío un enlace?',
    a: 'No. Los enlaces compartidos ofrecen una vista de solo lectura de alto nivel. Para editar, el destinatario debe tener una cuenta e importar el presupuesto, lo cual crea una copia totalmente aislada de tu original.'
  },
  {
    id: 'faq-6',
    category: 'Cost360',
    q: '¿Puedo editar los precios de la Base Maestra directamente?',
    a: 'La Base Maestra es de solo lectura para garantizar consistencia referencial. Si deseas personalizar precios, puedes duplicarla aplicando índices de inflación o guardar tus partidas en tu Base Personalizada.'
  },
  {
    id: 'faq-7',
    category: 'Cost360',
    q: '¿Dónde encuentro las partidas que he creado con IA?',
    a: 'Todas las partidas que creas desde cero o generas con el Asistente IA se almacenan automáticamente en tu "Base Personalizada", accesible desde la sección "Visor Bases de Datos" o seleccionando la base personalizada en el menú.'
  },
  {
    id: 'faq-8',
    category: 'APU e IA',
    q: '¿Cómo formulo un buen prompt para generar un APU?',
    a: 'Incluye la actividad principal, los materiales principales con sus especificaciones técnicas (dosificación, resistencia f\'c, calibres, espesores) y condiciones de instalación. Por ejemplo: "Construcción de pared de bloques de arcilla de 15cm con mortero 1:4, friso liso ambas caras a 2.80m de altura".'
  },
  {
    id: 'faq-9',
    category: 'Costos',
    q: '¿Por qué el IVA aparece en 0% dentro de los APUs?',
    a: 'Siguiendo las mejores prácticas de ingeniería de costos, el IVA se aplica al pie de presupuesto sobre el subtotal general. Los APUs individuales reflejan el costo unitario antes de impuestos.'
  },
  {
    id: 'faq-10',
    category: 'Planes',
    q: '¿Cómo solicito un plan o aumento de límite de presupuestos?',
    a: 'Haz clic en el icono de la corona (Planes y Suscripción) en la parte inferior de la barra lateral para ver los planes disponibles o contactar al equipo de soporte para activación inmediata.'
  }
];

// Mapeo para sugerencias contextuales según la URL
export const CONTEXTUAL_SUGGESTIONS = {
  '/budgets': [
    'primer-presupuesto',
    'backup-restauracion',
    'compartir-presupuestos'
  ],
  '/cost360': [
    'bases-de-datos',
    'configuracion-costos',
    'generador-apu-ia'
  ],
  '/cost360/databases': [
    'bases-de-datos',
    'configuracion-costos'
  ],
  '/cost360/ai-generator': [
    'generador-apu-ia',
    'bases-de-datos'
  ],
  '/fcas': [
    'calculadora-fcas',
    'configuracion-costos'
  ]
};
