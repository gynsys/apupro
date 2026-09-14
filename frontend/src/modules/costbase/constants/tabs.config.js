import { FiDatabase, FiActivity, FiCpu, FiFileText } from 'react-icons/fi';

export const TABS = [
  { key: 'visor_bd',        label: 'Visor de BD',     Icon: FiDatabase },
  { key: 'diagnostico_rag', label: 'Diagnóstico RAG', Icon: FiActivity },
  { key: 'scraping',        label: 'Scraping',        Icon: FiCpu      },
  { key: 'pdfs',            label: 'Update PDFs',     Icon: FiFileText },
  { key: 'prompt',          label: 'Prompt IA - APU', Icon: FiCpu      },
];
