import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========== FONCTIONS DE BASE ==========
export const get = (url, params) => api.get(url, { params });
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

// ========== VERSIONS SÉCURISÉES (AVEC TRY/CATCH) ==========
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

// ========== FONCTION SPÉCIALE POUR UPLOAD DE FICHIERS ==========
export const secureUpload = async (url, formData, onUploadProgress) => {
  try {
    const response = await api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return response.data;
  } catch (error) {
    console.error(`❌ secureUpload error for ${url}:`, error);
    throw error;
  }
};

export default api;
