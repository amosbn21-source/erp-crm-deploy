// src/api/statsApi.js
import axios from 'axios';

// ⚡ URL de ton backend
const API_URL = "http://localhost:5000/stats/commandes";

/**
 * Récupère les commandes par jour
 * @param {string} start - date de début (YYYY-MM-DD)
 * @param {string} end - date de fin (YYYY-MM-DD)
 */
export const getOrdersPerDay = async (start, end) => {
  const params = {};
  if (start && end) params.start = start, params.end = end;
  const res = await axios.get(`${API_URL}/par-jour`, { params });
  return res.data;
};

/**
 * Récupère le montant total des ventes
 */
export const getTotalSales = async () => {
  const res = await axios.get(`${API_URL}/total-ventes`);
  return res.data;
};

/**
 * Récupère les produits les plus commandés
 */
export const getTopProducts = async () => {
  const res = await axios.get(`${API_URL}/top-produits`);
  return res.data;
};
