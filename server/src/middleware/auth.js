// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { logSecurityEvent } = require('../utils/logger');

/**
 * Middleware pour vérifier le token JWT
 */
const authenticateToken = (req, res, next) => {
  // 1. Récupérer le token depuis différents emplacements
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : req.cookies?.authToken || req.query?.token;

  // 2. Vérifier la présence du token
  if (!token) {
    logSecurityEvent('AUTH_FAILED_NO_TOKEN', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(401).json({ 
      success: false,
      error: 'Accès non autorisé. Token manquant.',
      code: 'NO_TOKEN'
    });
  }

  // 3. Vérifier le token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      logSecurityEvent('AUTH_FAILED_INVALID_TOKEN', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        error: err.message
      });
      
      // Différencier les types d'erreurs
      let statusCode = 403;
      let errorMessage = 'Token invalide';
      let errorCode = 'INVALID_TOKEN';
      
      if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorMessage = 'Token expiré. Veuillez vous reconnecter.';
        errorCode = 'TOKEN_EXPIRED';
      } else if (err.name === 'JsonWebTokenError') {
        errorMessage = 'Token malformé';
        errorCode = 'TOKEN_MALFORMED';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }

    // 4. Token valide - attacher l'utilisateur à la requête
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || []
    };

    // 5. Ajouter des informations de traçabilité
    req.requestId = req.headers['x-request-id'] || require('crypto').randomBytes(8).toString('hex');
    req.authenticatedAt = new Date().toISOString();

    logSecurityEvent('AUTH_SUCCESS', {
      userId: req.user.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
      requestId: req.requestId
    });

    next();
  });
};

/**
 * Middleware pour vérifier les permissions spécifiques
 */
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Utilisateur non authentifié' 
      });
    }

    // Vérifier si l'utilisateur a la permission requise
    if (!req.user.permissions.includes(requiredPermission) && req.user.role !== 'admin') {
      logSecurityEvent('PERMISSION_DENIED', {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
        method: req.method,
        requiredPermission,
        userPermissions: req.user.permissions
      });
      
      return res.status(403).json({
        success: false,
        error: `Permission insuffisante. Requise: ${requiredPermission}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Middleware pour limiter l'accès par IP (en plus du rate limiting)
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Si la whitelist est vide, autoriser toutes les IPs
    if (allowedIPs.length === 0) {
      return next();
    }
    
    // Vérifier si l'IP est autorisée
    if (!allowedIPs.includes(clientIP)) {
      logSecurityEvent('IP_NOT_WHITELISTED', {
        ip: clientIP,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé depuis cette adresse IP',
        code: 'IP_NOT_ALLOWED'
      });
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier l'origine de la requête (CORS)
 */
const checkOrigin = (req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000'];
  
  const origin = req.headers.origin;
  
  if (origin && !allowedOrigins.includes(origin)) {
    logSecurityEvent('INVALID_ORIGIN', {
      origin,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(403).json({
      success: false,
      error: 'Origine non autorisée',
      code: 'INVALID_ORIGIN'
    });
  }
  
  next();
};

/**
 * Middleware pour valider le token de rafraîchissement
 */
const authenticateRefreshToken = (req, res, next) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token manquant',
      code: 'NO_REFRESH_TOKEN'
    });
  }
  
  // Vérifier le refresh token (stocké en base de données)
  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
    if (err) {
      logSecurityEvent('REFRESH_TOKEN_INVALID', {
        error: err.message,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: 'Refresh token invalide',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    // Vérifier si le refresh token existe en base de données
    // et n'a pas été révoqué
    try {
      // Ici, vous devriez vérifier en base de données
      // const tokenExists = await RefreshToken.findOne({ token: refreshToken, userId: decoded.userId });
      
      // Pour l'exemple, on suppose qu'il est valide
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      logSecurityEvent('REFRESH_TOKEN_CHECK_FAILED', {
        userId: decoded.userId,
        error: error.message
      });
      
      return res.status(500).json({
        success: false,
        error: 'Erreur de vérification du token',
        code: 'TOKEN_CHECK_ERROR'
      });
    }
  });
};

module.exports = {
  authenticateToken,
  checkPermission,
  ipWhitelist,
  checkOrigin,
  authenticateRefreshToken
};