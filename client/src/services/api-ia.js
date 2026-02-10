// Fichier: src/services/api-ia.js
import api from './api';

const iaService = {

    getStats: async () => {
        const response = await api.get('/api/ia/stats');
        return response.data;
    },
    
    getIntents: async (status = null, limit = 20) => {
        const params = { limit };
        if (status) params.status = status;
        const response = await api.get('/api/ia/intents', { params });
        return response.data;
    },
    
    getRules: async () => {
        const response = await api.get('/api/ia/rules');
        return response.data;
    },
    // Chat
    chat: async (contactId, message) => {
        try {
            const response = await api.post('/api/ia/chat', {
                contactId,
                message
            });
            return response.data;
        } catch (error) {
            console.error('Erreur chat IA:', error);
            throw error;
        }
    },
    
    // Règles
    getRules: async () => {
        try {
            const response = await api.get('/api/ia/rules');
            return response.data;
        } catch (error) {
            console.error('Erreur récupération règles:', error);
            throw error;
        }
    },
    
    createRule: async (ruleData) => {
        try {
            const response = await api.post('/api/ia/rules', ruleData);
            return response.data;
        } catch (error) {
            console.error('Erreur création règle:', error);
            throw error;
        }
    },
    
    updateRule: async (ruleId, updates) => {
        try {
            const response = await api.put(`/api/ia/rules/${ruleId}`, updates);
            return response.data;
        } catch (error) {
            console.error('Erreur mise à jour règle:', error);
            throw error;
        }
    },
    
    deleteRule: async (ruleId) => {
        try {
            const response = await api.delete(`/api/ia/rules/${ruleId}`);
            return response.data;
        } catch (error) {
            console.error('Erreur suppression règle:', error);
            throw error;
        }
    },
    
    // Profils
    getProfile: async (contactId) => {
        try {
            const response = await api.get(`/api/ia/profiles/${contactId}`);
            return response.data;
        } catch (error) {
            console.error('Erreur récupération profil:', error);
            throw error;
        }
    },
    
    updateProfile: async (contactId, updates) => {
        try {
            const response = await api.put(`/api/ia/profiles/${contactId}`, updates);
            return response.data;
        } catch (error) {
            console.error('Erreur mise à jour profil:', error);
            throw error;
        }
    },
    
    // Historique
    getConversations: async (contactId, limit = 20) => {
        try {
            const response = await api.get(`/api/ia/conversations/${contactId}`, {
                params: { limit }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur récupération conversations:', error);
            throw error;
        }
    },
    
    // Intentions
    getIntents: async (status = null, limit = 20) => {
        try {
            const params = { limit };
            if (status) params.status = status;
            
            const response = await api.get('/api/ia/intents', { params });
            return response.data;
        } catch (error) {
            console.error('Erreur récupération intentions:', error);
            throw error;
        }
    },
    
    convertIntentToOrder: async (intentId, productId = null, quantity = 1) => {
        try {
            const response = await api.post(`/api/ia/intents/${intentId}/convert`, {
                productId,
                quantity
            });
            return response.data;
        } catch (error) {
            console.error('Erreur conversion intention:', error);
            throw error;
        }
    },
    
    // Feedback
    submitFeedback: async (conversationId, correctedResponse, feedbackType = 'correction') => {
        try {
            const response = await api.post('/api/ia/feedback', {
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
    
    // Statistiques
    getStats: async () => {
        try {
            const response = await api.get('/api/ia/stats');
            return response.data;
        } catch (error) {
            console.error('Erreur statistiques IA:', error);
            throw error;
        }
    },



    // Commandes
    createOrder: async (orderData) => {
        try {
            const response = await api.post('/api/ia/orders', orderData);
            return response.data;
        } catch (error) {
            console.error('Erreur création commande:', error);
            throw error;
        }
    },

    updateOrderStatus: async (orderId, status) => {
        try {
            const response = await api.put(`/api/ia/orders/${orderId}/status`, { status });
            return response.data;
        } catch (error) {
            console.error('Erreur mise à jour statut:', error);
            throw error;
        }
    },

    addOrderItem: async (orderId, productId, quantity) => {
        try {
            const response = await api.post(`/api/ia/orders/${orderId}/items`, {
                productId,
                quantity
            });
            return response.data;
        } catch (error) {
            console.error('Erreur ajout produit:', error);
            throw error;
        }
    },

    // Produits
    getProductDetails: async (productId) => {
        try {
            const response = await api.get(`/api/ia/products/${productId}`);
            return response.data;
        } catch (error) {
            console.error('Erreur détails produit:', error);
            throw error;
        }
    },

    searchProducts: async (filters = {}) => {
        try {
            const response = await api.get('/api/ia/products', { params: filters });
            return response.data;
        } catch (error) {
            console.error('Erreur recherche produits:', error);
            throw error;
        }
    },

    // Documents
    generateInvoice: async (orderId, contactId) => {
        try {
            const response = await api.post('/api/ia/documents/invoice', {
                orderId,
                contactId
            });
            return response.data;
        } catch (error) {
            console.error('Erreur génération facture:', error);
            throw error;
        }
    },

    // Commandes client
    getCustomerOrders: async (contactId, filters = {}) => {
        try {
            const response = await api.get(`/api/ia/customer/${contactId}/orders`, {
                params: filters
            });
            return response.data;
        } catch (error) {
            console.error('Erreur commandes client:', error);
            throw error;
        }
    },

    // Analyse avancée
    analyzeIntent: async (message, contactId = null) => {
        try {
            const response = await api.post('/api/ia/analyze', {
                message,
                contactId
            });
            return response.data;
        } catch (error) {
            console.error('Erreur analyse:', error);
            throw error;
        }
    }


};

export default iaService;