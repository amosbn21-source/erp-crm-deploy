// src/services/api.js - VERSION SANS IA
import axios from 'axios';

// Configuration
export const get = (url, params) => api.get(url, { params });
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

axios.get(`${API_BASE}/api/dashboard/stats`);

// Instance Axios
const api = axios.create({
  baseURL: `${API_BASE}/api`,  // ← Le /api est AJOUTÉ ICI une seule fois
  headers: {
    'Content-Type': 'application/json',
  },
});

// Ajouter le token automatiquement
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==================== FONCTIONS DE BASE ====================

export const secureGet = async (url, config = {}) => {
  console.log(`🔍 [API] GET: ${url}`);
  
  try {
    const response = await api.get(url, config);
    return response;
  } catch (error) {
    console.error(`❌ [API] GET error for ${url}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

export const securePost = async (url, data, config = {}) => {
  console.log(`📝 [API] POST: ${url}`, data);
  
  try {
    const response = await api.post(url, data, config);
    return response;
  } catch (error) {
    console.error(`❌ [API] POST error for ${url}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

export const securePut = async (url, data, config = {}) => {
  console.log(`✏️ [API] PUT: ${url}`, data);
  
  try {
    const response = await api.put(url, data, config);
    return response;
  } catch (error) {
    console.error(`❌ [API] PUT error for ${url}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

export const secureDelete = async (url, config = {}) => {
  console.log(`🗑️ [API] DELETE: ${url}`);
  
  try {
    const response = await api.delete(url, config);
    return response;
  } catch (error) {
    console.error(`❌ [API] DELETE error for ${url}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

export const securePatch = async (url, data, config = {}) => {
  console.log(`🔧 [API] PATCH: ${url}`, data);
  
  try {
    const response = await api.patch(url, data, config);
    return response;
  } catch (error) {
    console.error(`❌ [API] PATCH error for ${url}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

export const secureUpload = async (url, formData, config = {}) => {
  console.log(`📤 [API] UPLOAD: ${url}`);
  
  try {
    const response = await api.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      }
    });
    return response;
  } catch (error) {
    console.error(`❌ [API] UPLOAD error for ${url}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

// ==================== MÉTHODES UTILITAIRES ====================

/**
 * Formater les paramètres de date pour l'API
 */
export const formatDateForAPI = (date) => {
  if (!date) return null;
  
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  
  return date;
};

/**
 * Gérer le téléchargement de fichier blob
 */
export const handleBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * Construire une URL avec filtres
 */
export const buildFilterUrl = (baseUrl, filters = {}) => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(`${key}[]`, v));
      } else {
        params.append(key, value);
      }
    }
  });
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
};

export default api;
