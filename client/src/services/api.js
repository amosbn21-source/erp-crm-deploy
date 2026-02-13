import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,  // ← ICI le /api est AJOUTÉ UNE SEULE FOIS
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const get = (url, params) => api.get(url, { params });
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

// Version "sécurisée" de post avec gestion d'erreur standardisée

// Vous pouvez ajouter aussi secureGet, securePut, secureDelete si besoin
export const secureGet = async (url, params) => {
  try {
    const response = await api.get(url, { params });
    return response.data;
  } catch (error) {
    console.error(`❌ secureGet error for ${url}:`, error);
    throw error;
  }
};

export const securePost = async (url, data) => {
  try {
    const response = await api.post(url, data);
    return response.data;
  } catch (error) {
    console.error(`❌ securePost error for ${url}:`, error);
    throw error;
  }
};

export const securePut = async (url, data) => {
  try {
    const response = await api.put(url, data);
    return response.data;
  } catch (error) {
    console.error(`❌ securePut error for ${url}:`, error);
    throw error;
  }
};

export const secureDelete = async (url) => {
  try {
    const response = await api.delete(url);
    return response.data;
  } catch (error) {
    console.error(`❌ secureDelete error for ${url}:`, error);
    throw error;
  }
};





export default api;
