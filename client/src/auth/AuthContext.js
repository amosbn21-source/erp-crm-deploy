// src/auth/AuthContext.js - AVEC PERMISSIONS POUR LES NOUVELLES FONCTIONNALITÉS
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
// Configuration axios
axios.defaults.baseURL = 'http://localhost:5000';

// Définition des rôles et permissions
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  VIEWER: 'viewer'
};


const PERMISSIONS = {
  // Permissions IA
  AI_MANAGEMENT: 'ai_management',
  AI_TRAINING: 'ai_training',
  AI_ANALYSIS: 'ai_analysis',
  AI_WORKFLOWS: 'ai_workflows',
  AI_DIALOGS: 'ai_dialogs',
  
  // Permissions données
  VIEW_STATS: 'view_stats',
  MANAGE_CONTACTS: 'manage_contacts',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_ORDERS: 'manage_orders',
  
  // Permissions système
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  SYSTEM_SETTINGS: 'system_settings'
};

// Mapping rôles → permissions
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.AI_MANAGEMENT,
    PERMISSIONS.AI_TRAINING,
    PERMISSIONS.AI_ANALYSIS,
    PERMISSIONS.AI_WORKFLOWS,
    PERMISSIONS.AI_DIALOGS,
    PERMISSIONS.VIEW_STATS,
    PERMISSIONS.MANAGE_CONTACTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.SYSTEM_SETTINGS
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.AI_MANAGEMENT,
    PERMISSIONS.AI_ANALYSIS,
    PERMISSIONS.AI_WORKFLOWS,
    PERMISSIONS.AI_DIALOGS,
    PERMISSIONS.VIEW_STATS,
    PERMISSIONS.MANAGE_CONTACTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.IMPORT_DATA
  ],
  [ROLES.USER]: [
    PERMISSIONS.AI_DIALOGS,
    PERMISSIONS.VIEW_STATS,
    PERMISSIONS.MANAGE_CONTACTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_ORDERS
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_STATS
  ]
};

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vérifier l'authentification au chargement
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Vérifier le token avec le backend
      const response = await api.get('/auth/verify')

      console.log('✅ Vérification token:', response.data);

      if (response.data.valid || response.data.success) {
        const userData = response.data.user;
        setUser(userData);
        // Calculer les permissions
        const userPermissions = calculatePermissions(userData.role);
        setPermissions(userPermissions);
        
        // Configurer axios pour les requêtes futures
        axios.defaults.headers.common['horization'] = `Bearer ${token}`;
      } else {
        // Token invalide, nettoyer
        localStorage.removeItem('hToken');
        localStorage.removeItem('user');
      }
    } catch (err) {
      console.log('⚠️ Impossible de vérifier le token, utilisation du cache');
      
      // Fallback: utiliser le cache
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('hToken');
      
      if (savedUser && token) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        const userPermissions = calculatePermissions(userData.role);
        setPermissions(userPermissions);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculer les permissions basées sur le rôle
  const calculatePermissions = (role) => {
    const basePermissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLES.VIEWER];
    
    // Ajouter les permissions personnalisées si disponibles
    const customPermissions = user?.customPermissions || [];
    
    return [...new Set([...basePermissions, ...customPermissions])];
  };

  // Vérifier une permission spécifique
  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true; // Admins ont toutes les permissions
    
    return permissions.includes(permission);
  };

  // Vérifier plusieurs permissions
  const hasAllPermissions = (requiredPermissions) => {
    return requiredPermissions.every(permission => hasPermission(permission));
  };

  // Vérifier au moins une permission
  const hasAnyPermission = (possiblePermissions) => {
    return possiblePermissions.some(permission => hasPermission(permission));
  };

  // Connexion
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔐 Tentative de connexion...');

      const response = await api.post('/auth/login', { email, password });
      
      

      console.log('✅ Réponse login:', response.data);

      if (response.data.token && response.data.user) {
        const { token, user: userData } = response.data;
        
        // Sauvegarder
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Calculer les permissions
        const userPermissions = calculatePermissions(userData.role);
        
        // Configurer axios
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Mettre à jour l'état
        setUser(userData);
        setPermissions(userPermissions);
        
        return { success: true, user: userData, permissions: userPermissions };
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (err) {
      console.error('❌ Erreur login:', err);
      
      let errorMessage = 'Erreur de connexion';
      
      if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Data:', err.response.data);
        errorMessage = err.response.data?.error || err.response.data?.message || `Erreur ${err.response.status}`;
      } else if (err.request) {
        console.error('Pas de réponse du serveur');
        errorMessage = 'Serveur non disponible';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion
  const logout = async () => {
    try {
      // Appeler l'API logout si disponible
      await api.post('/auth/logout');
    } catch (err) {
      console.log('Logout API non disponible, déconnexion locale');
    } finally {
      // Nettoyer localement
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setPermissions([]);
      setError(null);
    }
  };

  // Vérifier si connecté
  const isAuthenticated = () => {
    return !!user;
  };

  // Obtenir le rôle de l'utilisateur
  const getUserRole = () => {
    return user?.role || ROLES.VIEWER;
  };

  // Obtenir le schéma de l'utilisateur
  const getUserSchema = () => {
    return user?.schema || `user_${user?.id || 'unknown'}`;
  };

  // Mettre à jour les permissions
  const updatePermissions = (newPermissions) => {
    if (!user) return;
    
    const updatedPermissions = [...new Set([...permissions, ...newPermissions])];
    setPermissions(updatedPermissions);
    
    // Mettre à jour le stockage local
    const updatedUser = { ...user, customPermissions: newPermissions };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // Vérifications spécifiques pour les fonctionnalités IA
  const canManageAI = () => hasPermission(PERMISSIONS.AI_MANAGEMENT);
  const canTrainAI = () => hasPermission(PERMISSIONS.AI_TRAINING);
  const canUseAIDialogs = () => hasPermission(PERMISSIONS.AI_DIALOGS);
  const canCreateWorkflows = () => hasPermission(PERMISSIONS.AI_WORKFLOWS);
  const canAnalyzeBusinessData = () => hasPermission(PERMISSIONS.AI_ANALYSIS);
  const canExportData = () => hasPermission(PERMISSIONS.EXPORT_DATA);

  // Vérifications pour les fonctionnalités de gestion
  const canManageContacts = () => hasPermission(PERMISSIONS.MANAGE_CONTACTS);
  const canManageProducts = () => hasPermission(PERMISSIONS.MANAGE_PRODUCTS);
  const canManageOrders = () => hasPermission(PERMISSIONS.MANAGE_ORDERS);

  const value = {
    user,
    permissions,
    loading,
    error,
    login,
    logout,
    isAuthenticated,
    
    // Méthodes de vérification de permissions
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    getUserRole,
    getUserSchema,
    updatePermissions,
    
    // Méthodes spécifiques pour l'IA
    canManageAI,
    canTrainAI,
    canUseAIDialogs,
    canCreateWorkflows,
    canAnalyzeBusinessData,
    canExportData,
    
    // Méthodes spécifiques pour la gestion
    canManageContacts,
    canManageProducts,
    canManageOrders,
    
    // Constantes exportées
    ROLES,
    PERMISSIONS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
