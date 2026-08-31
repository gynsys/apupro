import axios from 'axios';

// Get the base API URL from environment variables, fallback to generic
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const cost360ApiClient = axios.create({
  baseURL: `${API_URL}/cost360`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include httpOnly cookies
});

/**
 * Fetch a list of cost items (Partidas)
 * @param {number} skip - Offset for pagination
 * @param {number} limit - Limit of items to fetch
 * @param {string} search - Search keyword
 * @param {string} chapter - Chapter prefix filter (e.g., 'E', 'I')
 * @returns {Promise<Array>} List of items
 */
export const fetchItems = async (skip = 0, limit = 50, search = '', chapter = '', database_id = 'master', search_desc = true, search_insumos = false, covenin = '', only_coded = null) => {
  try {
    let final_only_coded = only_coded;
    if (final_only_coded === null && database_id === 'master') {
      final_only_coded = window.ARKO_SITE_CONFIG?.forceOnlyCodedMaster === true;
    }
    const hidden_categories = window.ARKO_SITE_CONFIG?.hiddenCategories?.join(',') || '';
    const params = { skip, limit, database_id, search_desc, search_insumos, only_coded: final_only_coded, hidden_categories };
    if (search) params.search = search;
    if (chapter) params.chapter = chapter;
    if (covenin) params.covenin = covenin;
    
    const response = await cost360ApiClient.get('/items', { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching cost items:", error);
    throw error;
  }
};

/**
 * Fetch detailed APU (Análisis de Precio Unitario) for a specific item
 * @param {string} itemCode - The unique code of the item (CodPar)
 * @returns {Promise<Object>} APU details including materials, labor, and equipment
 */
export const fetchApuDetails = async (itemCode, database_id = 'master') => {
  const response = await cost360ApiClient.get(`/items/${itemCode}/apu`, {
    params: { database_id }
  });
  return response.data;
};

export const fetchCategoriesTree = async () => {
  const response = await cost360ApiClient.get('/categories_tree');
  return response.data;
};

export const generateAIApu = async (description, coveninPrefix = '', coveninContext = '', history = [], onlyPreprocess = false) => {
  const response = await cost360ApiClient.post('/generate-ai-apu', {
    description,
    covenin_prefix: coveninPrefix,
    covenin_context: coveninContext,
    history,
    only_preprocess: onlyPreprocess
  });
  return response.data;
};

export const smartSelect = async (description, coveninPrefix, coveninContext, answers = {}) => {
  const response = await cost360ApiClient.post('/smart-select', {
    description,
    covenin_prefix: coveninPrefix,
    covenin_context: coveninContext,
    answers,
  });
  return response.data;
};

export const generateAIApuFromBase = async (description, coveninPrefix, coveninContext, basePartidaCode, smartAnswers = {}) => {
  const response = await cost360ApiClient.post('/generate-ai-apu', {
    description,
    covenin_prefix: coveninPrefix,
    covenin_context: coveninContext,
    base_partida_code: basePartidaCode,
    smart_answers: smartAnswers,
    history: [],
  });
  return response.data;
};

export const saveCustomApu = async (payload) => {
  const response = await cost360ApiClient.post('/custom-apus', payload);
  return response.data;
};

export const updateMasterItem = async (itemCode, data) => {
  const response = await cost360ApiClient.put(`/items/${itemCode}`, data);
  return response.data;
};

export const deleteMasterItem = async (itemCode) => {
  const response = await cost360ApiClient.delete(`/items/${itemCode}`);
  return response.data;
};

export const exportApuExcelCustom = async (payload) => {
  const response = await cost360ApiClient.post('/apu/export-excel-custom', payload, {
    responseType: 'blob'
  });
  
  // Download the file
  const blob = response.data;
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  
  // Get filename from headers if possible, otherwise fallback
  let filename = `APU_${payload.item?.CodPar || payload.item?.cod_par || 'Export'}.xlsx`;
  const contentDisposition = response.headers['content-disposition'];
  if (contentDisposition && contentDisposition.includes('filename=')) {
    filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
  }
  
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return true;
};

export default {
  fetchItems,
  fetchApuDetails,
  fetchCategoriesTree,
  generateAIApu,
  generateAIApuFromBase,
  smartSelect,
  saveCustomApu,
  updateMasterItem,
  deleteMasterItem,
  exportApuExcelCustom
};
