// backend/src/middleware/roles.js
const { logSecurityEvent } = require('../utils/logger');

/**
 * Rôles disponibles dans l'application
 */
const ROLES = {
  SUPER_ADMIN: 'super_admin',    // Accès total
  ADMIN: 'admin',               // Administration système
  MANAGER: 'manager',           // Gestion équipe
  SALES: 'sales',               // Commercial
  SUPPORT: 'support',           // Support client
  USER: 'user',                 // Utilisateur standard
  GUEST: 'guest'                // Invité (lecture seule)
};

/**
 * Permissions associées à chaque rôle
 */
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    '*', // Toutes les permissions
  ],
  [ROLES.ADMIN]: [
    'users:read',
    'users:write',
    'users:delete',
    'contacts:read',
    'contacts:write',
    'contacts:delete',
    'products:read',
    'products:write',
    'products:delete',
    'orders:read',
    'orders:write',
    'orders:delete',
    'documents:read',
    'documents:write',
    'documents:delete',
    'reports:read',
    'settings:write'
  ],
  [ROLES.MANAGER]: [
    'contacts:read',
    'contacts:write',
    'products:read',
    'orders:read',
    'orders:write',
    'documents:read',
    'reports:read'
  ],
  [ROLES.SALES]: [
    'contacts:read',
    'contacts:write',
    'products:read',
    'orders:read',
    'orders:write',
    'documents:read'
  ],
  [ROLES.SUPPORT]: [
    'contacts:read',
    'contacts:write',
    'orders:read'
  ],
  [ROLES.USER]: [
    'profile:read',
    'profile:write',
    'orders:read'
  ],
  [ROLES.GUEST]: [
    'public:read'
  ]
};

/**
 * Vérifie si un rôle a une permission spécifique
 */
const hasPermission = (role, permission) => {
  if (!role || !ROLE_PERMISSIONS[role]) {
    return false;
  }
  
  // Le super admin a toutes les permissions
  if (role === ROLES.SUPER_ADMIN) {
    return true;
  }
  
  // Vérifier la permission exacte
  if (ROLE_PERMISSIONS[role].includes(permission)) {
    return true;
  }
  
  // Vérifier les permissions avec wildcard
  const permissionParts = permission.split(':');
  if (permissionParts.length === 2) {
    const wildcardPermission = `${permissionParts[0]}:*`;
    if (ROLE_PERMISSIONS[role].includes(wildcardPermission)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Middleware pour vérifier le rôle
 */
const checkRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié',
        code: 'UNAUTHENTICATED'
      });
    }
    
    // Convertir en tableau si ce n'est pas déjà le cas
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // Vérifier si l'utilisateur a un des rôles requis
    if (!roles.includes(req.user.role)) {
      logSecurityEvent('ROLE_CHECK_FAILED', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        error: `Rôle insuffisant. Rôles requis: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    
    // Ajouter les permissions de l'utilisateur à la requête
    req.user.permissions = ROLE_PERMISSIONS[req.user.role] || [];
    
    next();
  };
};

/**
 * Middleware pour vérifier une permission spécifique
 */
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié',
        code: 'UNAUTHENTICATED'
      });
    }
    
    // Récupérer les permissions de l'utilisateur
    const userPermissions = req.user.permissions || ROLE_PERMISSIONS[req.user.role] || [];
    
    // Vérifier si l'utilisateur a la permission
    const hasPerm = userPermissions.includes(requiredPermission) || 
                   userPermissions.includes('*') ||
                   hasPermission(req.user.role, requiredPermission);
    
    if (!hasPerm) {
      logSecurityEvent('PERMISSION_CHECK_FAILED', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermission,
        userPermissions,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        error: `Permission insuffisante. Requise: ${requiredPermission}`,
        code: 'INSUFFICIENT_PERMISSION',
        requiredPermission,
        userRole: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier la propriété (ownership)
 * Par exemple : un utilisateur ne peut modifier que ses propres données
 */
const checkOwnership = (modelName, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam];
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: 'ID de ressource manquant',
          code: 'MISSING_RESOURCE_ID'
        });
      }
      
      // Import dynamique du modèle (selon votre structure)
      let Model;
      switch (modelName) {
        case 'contact':
          Model = require('../models/Contact');
          break;
        case 'order':
          Model = require('../models/Commande');
          break;
        case 'product':
          Model = require('../models/Produit');
          break;
        case 'user':
          Model = require('../models/User');
          break;
        default:
          return res.status(500).json({
            success: false,
            error: 'Modèle non trouvé',
            code: 'MODEL_NOT_FOUND'
          });
      }
      
      // Récupérer la ressource
      const resource = await Model.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Ressource non trouvée',
          code: 'RESOURCE_NOT_FOUND'
        });
      }
      
      // Vérifier la propriété
      // Dépend de votre structure de données
      const isOwner = resource.userId?.toString() === req.user.id;
      const isAdmin = req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;
      
      if (!isOwner && !isAdmin) {
        logSecurityEvent('OWNERSHIP_CHECK_FAILED', {
          userId: req.user.id,
          userRole: req.user.role,
          resourceId,
          resourceType: modelName,
          resourceOwner: resource.userId,
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        
        return res.status(403).json({
          success: false,
          error: 'Vous n\'êtes pas autorisé à accéder à cette ressource',
          code: 'NOT_OWNER',
          resourceOwner: resource.userId
        });
      }
      
      // Attacher la ressource à la requête pour éviter une seconde requête
      req.resource = resource;
      
      next();
    } catch (error) {
      logSecurityEvent('OWNERSHIP_CHECK_ERROR', {
        userId: req.user.id,
        resourceId: req.params[idParam],
        error: error.message,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification de propriété',
        code: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware pour les ressources partagées (équipe)
 */
const checkTeamAccess = (teamField = 'teamId') => {
  return async (req, res, next) => {
    try {
      // Ici, vous devriez vérifier si l'utilisateur fait partie de l'équipe
      // qui a accès à la ressource
      
      // Pour l'exemple, on vérifie simplement si l'utilisateur est manager ou admin
      const allowedRoles = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.MANAGER];
      
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Accès réservé aux managers et administrateurs',
          code: 'TEAM_ACCESS_DENIED'
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erreur de vérification d\'accès équipe',
        code: 'TEAM_CHECK_ERROR'
      });
    }
  };
};

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  checkRole,
  checkPermission,
  checkOwnership,
  checkTeamAccess,
  hasPermission
};