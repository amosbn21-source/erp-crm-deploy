import api from './api';

/**
 * Service pour interagir avec l'API IA du backend
 * Tous les appels sont préfixés par `/ia` (car l'instance `api` a déjà `/api` dans sa baseURL)
 */
const iaService = {
  // ========== STATISTIQUES ==========
  getStats: async () => {
    try {
      const response = await api.get('/ia/stats');
      return response.data;
    } catch (error) {
      console.error('Erreur stats IA:', error);
      throw error;
    }
  },

  // ========== PARAMÈTRES IA ==========
  getSettings: async () => {
    try {
      const response = await api.get('/ia/settings');
      return response.data;
    } catch (error) {
      console.error('Erreur chargement paramètres IA:', error);
      // Retourne des valeurs par défaut en cas d'erreur
      return {
        success: true,
        enabled: true,
        confidence_threshold: 0.7,
        max_context_length: 10,
        learning_enabled: true,
        rule_based_responses: true,
        product_recommendations: true,
        sentiment_analysis: true,
        language: 'fr'
      };
    }
  },

  updateSettings: async (settings) => {
    try {
      const response = await api.post('/ia/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Erreur mise à jour paramètres IA:', error);
      throw error;
    }
  },

  // ========== RÈGLES MÉTIER ==========
  getRules: async () => {
    try {
      const response = await api.get('/ia/rules');
      return response.data;
    } catch (error) {
      console.error('Erreur récupération règles:', error);
      throw error;
    }
  },

  createRule: async (ruleData) => {
    try {
      const response = await api.post('/ia/rules', ruleData);
      return response.data;
    } catch (error) {
      console.error('Erreur création règle:', error);
      throw error;
    }
  },

  updateRule: async (ruleId, updates) => {
    try {
      const response = await api.put(`/ia/rules/${ruleId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Erreur mise à jour règle:', error);
      throw error;
    }
  },

  deleteRule: async (ruleId) => {
    try {
      const response = await api.delete(`/ia/rules/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error('Erreur suppression règle:', error);
      throw error;
    }
  },

  // ========== INTENTIONS D'ACHAT ==========
  getIntents: async (status = null, limit = 20) => {
    try {
      const params = { limit };
      if (status) params.status = status;
      const response = await api.get('/ia/intents', { params });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération intentions:', error);
      throw error;
    }
  },

  convertIntentToOrder: async (intentId, productId = null, quantity = 1) => {
    try {
      const response = await api.post(`/ia/intents/${intentId}/convert`, {
        productId,
        quantity
      });
      return response.data;
    } catch (error) {
      console.error('Erreur conversion intention:', error);
      throw error;
    }
  },

  // ========== PROFILS CLIENTS ==========
  getProfile: async (contactId) => {
    try {
      const response = await api.get(`/ia/profiles/${contactId}`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      throw error;
    }
  },

  updateProfile: async (contactId, updates) => {
    try {
      const response = await api.put(`/ia/profiles/${contactId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      throw error;
    }
  },

  // ========== HISTORIQUE CONVERSATIONS ==========
  getConversations: async (contactId, limit = 20) => {
    try {
      const response = await api.get(`/ia/conversations/${contactId}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération conversations:', error);
      throw error;
    }
  },

  // ========== CHAT IA ==========
  chat: async (contactId, message) => {
    try {
      const response = await api.post('/ia/chat', { contactId, message });
      return response.data;
    } catch (error) {
      console.error('Erreur chat IA:', error);
      throw error;
    }
  },

  // ========== FEEDBACK / APPRENTISSAGE ==========
  submitFeedback: async (conversationId, correctedResponse, feedbackType = 'correction') => {
    try {
      const response = await api.post('/ia/feedback', {
        conversationId,
        correctedResponse,
        feedbackType
      });
      return response.data;
    } catch (error) {
      console.error('Erreur soumission feedback:', error);
      throw error;
    }
  },

  // ========== COMMANDES (via IA) ==========
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/ia/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Erreur création commande:', error);
      throw error;
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const response = await api.put(`/ia/orders/${orderId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      throw error;
    }
  },

  addOrderItem: async (orderId, productId, quantity) => {
    try {
      const response = await api.post(`/ia/orders/${orderId}/items`, {
        productId,
        quantity
      });
      return response.data;
    } catch (error) {
      console.error('Erreur ajout produit:', error);
      throw error;
    }
  },

  getCustomerOrders: async (contactId, filters = {}) => {
    try {
      const response = await api.get(`/ia/customer/${contactId}/orders`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Erreur commandes client:', error);
      throw error;
    }
  },

  // ========== PRODUITS ==========
  getProductDetails: async (productId) => {
    try {
      const response = await api.get(`/ia/products/${productId}`);
      return response.data;
    } catch (error) {
      console.error('Erreur détails produit:', error);
      throw error;
    }
  },

  searchProducts: async (filters = {}) => {
    try {
      const response = await api.get('/ia/products', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Erreur recherche produits:', error);
      throw error;
    }
  },

  // ========== DOCUMENTS ==========
  generateInvoice: async (orderId, contactId) => {
    try {
      const response = await api.post('/ia/documents/invoice', {
        orderId,
        contactId
      });
      return response.data;
    } catch (error) {
      console.error('Erreur génération facture:', error);
      throw error;
    }
  },

  // ========== ANALYSE AVANCÉE ==========
  analyzeIntent: async (message, contactId = null) => {
    try {
      const response = await api.post('/ia/analyze', { message, contactId });
      return response.data;
    } catch (error) {
      console.error('Erreur analyse:', error);
      throw error;
    }
  }
};

export default iaService;
