import { FiLayers, FiBox, FiTool, FiUsers, FiCpu, FiFileText } from 'react-icons/fi';

export const TABS = [
  { key: 'partidas',   label: 'APU', Icon: FiLayers },
  { key: 'materiales', label: 'Mat',      Icon: FiBox   },
  { key: 'equipos',    label: 'Equ',         Icon: FiTool  },
  { key: 'mano_obra',  label: 'M. Obra',    Icon: FiUsers },
  { key: 'scraping',   label: 'Scraping',        Icon: FiCpu   },
  { key: 'pdfs',       label: 'Update PDFs',      Icon: FiFileText },
  { key: 'prompt',     label: 'Prompt IA - APU', Icon: FiCpu   },
  { key: 'usuarios',   label: 'Usuarios',        Icon: FiUsers },
];
