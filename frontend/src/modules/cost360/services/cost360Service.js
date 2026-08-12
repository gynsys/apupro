import axios from 'axios';

// Get the base API URL from environment variables, fallback to generic
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const cost360ApiClient = axios.create({
  baseURL: `${API_URL}/cost360`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch a list of cost items (Partidas)
 * @param {number} skip - Offset for pagination
 * @param {number} limit - Limit of items to fetch
 * @param {string} search - Search keyword
 * @param {string} chapter - Chapter prefix filter (e.g., 'E', 'I')
 * @returns {Promise<Array>} List of items
 */
export const fetchItems = async (skip = 0, limit = 50, search = '', chapter = '', database_id = 'master', search_desc = true, search_insumos = false, covenin = '') => {
  try {
    const params = { skip, limit, database_id, search_desc, search_insumos };
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

export const saveCustomApu = async (payload) => {
  const response = await cost360ApiClient.post('/custom-apus', payload);
  return response.data;
};

export default {
  fetchItems,
  fetchApuDetails,
  fetchCategoriesTree,
  generateAIApu,
  saveCustomApu,
};
