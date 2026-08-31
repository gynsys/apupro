import { FiLayers, FiBox, FiTool, FiUsers, FiCpu, FiFileText } from 'react-icons/fi';

export const TABS = [
  { key: 'partidas',   label: 'Partidas (APU)', Icon: FiLayers },
  { key: 'materiales', label: 'Materiales',      Icon: FiBox   },
  { key: 'equipos',    label: 'Equipos',         Icon: FiTool  },
  { key: 'mano_obra',  label: 'Mano de Obra',    Icon: FiUsers },
  { key: 'scraping',   label: 'Scraping',        Icon: FiCpu   },
  { key: 'pdfs',       label: 'Update PDFs',      Icon: FiFileText },
  { key: 'prompt',     label: 'Prompt IA - APU', Icon: FiCpu   },
  { key: 'usuarios',   label: 'Usuarios',        Icon: FiUsers },
];
