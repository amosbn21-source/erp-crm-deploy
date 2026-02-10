// backend/src/middleware/rateLimit.js
// ⚡ Middleware de limitation de taux complet et sécurisé
// Protection contre les attaques DDoS, brute force et abus

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const { logSecurityEvent } = require('../utils/logger');

// Configuration Redis (optionnel - pour clustering)
let redisClient = null;
let useRedis = false;

try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    redisClient.on('connect', () => {
      console.log('✅ Redis connecté pour le rate limiting');
      useRedis = true;
    });
    
    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis non disponible, utilisation mémoire:', err.message);
      useRedis = false;
    });
  }
} catch (error) {
  console.warn('⚠️ Redis non configuré:', error.message);
}

// Store pour le rate limiting
const createStore = () => {
  if (useRedis && redisClient) {
    return new RedisStore({
      client: redisClient,
      prefix: 'rate_limit:',
      expiry: 900, // 15 minutes en secondes
      resetExpiryOnChange: true
    });
  }
  return undefined; // Utilise le store mémoire par défaut
};


const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Génère une clé unique pour le rate limiting
 * Compatible IPv4 et IPv6
 */
const createKeyGenerator = (prefix = '') => {
  return (req) => {
    // Utilise la fonction ipKeyGenerator officielle pour IPv6
    const ip = ipKeyGenerator(req);
    
    // Ajoute un préfixe si fourni
    if (prefix) {
      return `${prefix}:${ip}`;
    }
    
    return ip;
  };
};

/**
 * Génère une clé pour l'authentification (par email)
 */
const authKeyGenerator = (req) => {
  const ip = ipKeyGenerator(req);
  const email = req.body?.email || 'unknown';
  
  // Nettoyer l'email pour éviter des clés trop longues
  const cleanEmail = email.toLowerCase().trim();
  
  return `${ip}:auth:${cleanEmail}`;
};

/**
 * Génère une clé par utilisateur
 */
const userKeyGenerator = (req) => {
  const ip = ipKeyGenerator(req);
  
  if (req.user) {
    return `user:${req.user.id}:${ip}`;
  }
  
  return `anon:${ip}`;
};

/**
 * Génère une clé pour un endpoint spécifique
 */
const endpointKeyGenerator = (endpointName) => {
  return (req) => {
    const ip = ipKeyGenerator(req);
    return `${endpointName}:${ip}`;
  };
};

// ==================== CONFIGURATIONS SPÉCIFIQUES ====================

/**
 * 1. Limiteur global - Protection contre les attaques DDoS basiques
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requêtes max par IP
  message: {
    success: false,
    error: 'Trop de requêtes. Veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_GLOBAL'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Ne pas limiter les webhooks, health checks et IPs de confiance
    return req.path.includes('/webhook/') || 
           req.path === '/health' ||
           req.path === '/api/health' ||
           process.env.TRUSTED_IPS?.split(',').includes(req.ip);
  },
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_GLOBAL_EXCEEDED', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent')
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * 2. Limiteur d'authentification - Protection brute force
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Seulement 5 tentatives de login
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    code: 'RATE_LIMIT_AUTH'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne compte que les échecs
  store: createStore(), // Utilise Redis si disponible
  keyGenerator: (req) => {
    // Utilise l'email pour identifier les tentatives de login
    const email = req.body?.email || 'unknown';
    return `${req.ip}:auth:${email}`;
  },
  handler: (req, res, next, options) => {
    const email = req.body?.email || 'unknown';
    
    logSecurityEvent('RATE_LIMIT_AUTH_EXCEEDED', {
      ip: req.ip,
      email: email,
      path: req.path,
      method: req.method
    });
    
    // Bloquer temporairement l'IP après plusieurs échecs
    if (req.rateLimit.remaining === 0) {
      console.warn(`🚫 IP temporairement bloquée pour tentatives de login: ${req.ip}`);
    }
    
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * 3. Limiteur d'API - Pour les endpoints critiques
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 500, // 500 requêtes max par IP par heure
  message: {
    success: false,
    error: 'Limite de requêtes API atteinte. Veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_API'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  skip: (req) => {
    // Les admins ont des limites plus élevées
    return req.user?.role === 'admin' || req.user?.role === 'super_admin';
  },
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_API_EXCEEDED', {
      ip: req.ip,
      userId: req.user?.id,
      userRole: req.user?.role,
      path: req.path,
      method: req.method
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * 4. Limiteur de création - Pour éviter le spam
 */
const creationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 50, // 50 créations max par IP par heure
  message: {
    success: false,
    error: 'Trop de créations. Veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_CREATION'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  skip: (req) => {
    // Ne pas limiter les admins
    return req.user?.role === 'admin' || req.user?.role === 'super_admin';
  },
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_CREATION_EXCEEDED', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      resourceType: req.path.split('/').pop()
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * 5. Limiteur d'upload - Pour les fichiers
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 uploads max par IP par heure
  message: {
    success: false,
    error: 'Trop de fichiers uploadés. Veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_UPLOAD'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_UPLOAD_EXCEEDED', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      fileCount: req.files?.length || 1
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * 6. Limiteur d'export - Pour les gros exports
 */
const exportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 heures
  max: 10, // 10 exports max par IP par jour
  message: {
    success: false,
    error: 'Limite d\'exports quotidienne atteinte. Réessayez demain.',
    code: 'RATE_LIMIT_EXPORT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_EXPORT_EXCEEDED', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      exportType: req.query.type || 'unknown'
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Middleware de protection DDoS avancé
 */
const ddosProtection = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || 'Unknown';
  
  // Liste noire dynamique
  const blacklist = process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : [];
  const userAgentBlacklist = ['Python', 'curl', 'wget', 'scan', 'bot', 'crawler'];
  
  // Vérifier l'IP
  if (blacklist.includes(clientIP)) {
    logSecurityEvent('IP_BLACKLISTED', {
      ip: clientIP,
      path: req.path,
      method: req.method,
      reason: 'Liste noire statique'
    });
    
    return res.status(403).json({
      success: false,
      error: 'Accès refusé',
      code: 'IP_BLOCKED'
    });
  }
  
  // Détection de bots/user-agents suspects
  const isSuspiciousUA = userAgentBlacklist.some(ua => 
    userAgent.toLowerCase().includes(ua.toLowerCase())
  );
  
  if (isSuspiciousUA && !req.path.includes('/webhook/')) {
    logSecurityEvent('SUSPICIOUS_USER_AGENT', {
      ip: clientIP,
      userAgent: userAgent,
      path: req.path,
      method: req.method
    });
    
    // Ralentir les requêtes suspectes (slow down)
    setTimeout(next, 1000); // 1 seconde de délai
    return;
  }
  
  // Protection contre les requêtes trop rapides
  req._requestStartTime = Date.now();
  
  const checkRequestSpeed = () => {
    const requestTime = Date.now() - req._requestStartTime;
    
    // Si la requête est trop rapide (< 100ms), c'est suspect
    if (requestTime < 100 && req.method === 'POST') {
      logSecurityEvent('TOO_FAST_REQUEST', {
        ip: clientIP,
        requestTime: `${requestTime}ms`,
        path: req.path,
        method: req.method
      });
      
      // Ajouter un délai aléatoire
      const delay = Math.floor(Math.random() * 500) + 100;
      setTimeout(next, delay);
      return;
    }
    
    next();
  };
  
  // Vérifier après un petit délai
  setTimeout(checkRequestSpeed, 50);
};

/**
 * Middleware pour limiter par utilisateur
 */
const userRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    message: {
      success: false,
      error: 'Limite de requêtes atteinte pour votre compte.',
      code: 'USER_RATE_LIMIT'
    }
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  return rateLimit({
    ...mergedOptions,
    store: createStore(),
    handler: (req, res, next, opts) => {
      logSecurityEvent('USER_RATE_LIMIT_EXCEEDED', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        method: req.method,
        limit: opts.max,
        window: opts.windowMs / 60000 + ' minutes'
      });
      
      res.status(opts.statusCode).json(opts.message);
    }
  });
};

/**
 * Middleware pour limiter par endpoint spécifique
 */
const endpointRateLimit = (endpoint, maxRequests, windowMinutes = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => {
      return req.user ? `${endpoint}:user:${req.user.id}` : `${endpoint}:ip:${req.ip}`;
    },
    message: {
      success: false,
      error: `Limite atteinte pour ${endpoint}. Réessayez plus tard.`,
      code: `RATE_LIMIT_${endpoint.toUpperCase()}`
    },
    store: createStore(),
    skip: (req) => {
      return req.user?.role === 'admin' || req.user?.role === 'super_admin';
    }
  });
};

/**
 * Réinitialiser le compteur pour une IP/Utilisateur
 */
const resetRateLimit = async (key) => {
  if (useRedis && redisClient) {
    try {
      await redisClient.del(`rate_limit:${key}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur reset Redis rate limit:', error);
      return false;
    }
  }
  return false;
};

/**
 * Obtenir les statistiques de rate limiting
 */
const getRateLimitStats = async (key) => {
  if (useRedis && redisClient) {
    try {
      const data = await redisClient.get(`rate_limit:${key}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('❌ Erreur get Redis stats:', error);
    }
  }
  return null;
};

/**
 * Middleware pour surveiller les abus
 */
const abuseDetection = (req, res, next) => {
  const suspiciousPatterns = [
    // Injection SQL
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
    // XSS
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/gi,
    // Path traversal
    /\.\.\//gi,
    // Command injection
    /;|\|&/gi
  ];
  
  // Vérifier les headers
  Object.keys(req.headers).forEach(header => {
    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(req.headers[header])) {
        logSecurityEvent('SUSPICIOUS_HEADER', {
          ip: req.ip,
          header: header,
          value: req.headers[header].substring(0, 100),
          pattern: pattern.toString()
        });
      }
    });
  });
  
  // Vérifier le body
  if (req.body && typeof req.body === 'object') {
    const bodyStr = JSON.stringify(req.body);
    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(bodyStr)) {
        logSecurityEvent('SUSPICIOUS_BODY', {
          ip: req.ip,
          path: req.path,
          pattern: pattern.toString(),
          sample: bodyStr.substring(0, 200)
        });
      }
    });
  }
  
  // Vérifier les query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(req.query[key])) {
          logSecurityEvent('SUSPICIOUS_QUERY', {
            ip: req.ip,
            key: key,
            value: req.query[key],
            pattern: pattern.toString()
          });
        }
      });
    });
  }
  
  next();
};

// ==================== CONFIGURATION D'EXPORT ====================

module.exports = {
  // Limiteurs prédéfinis
  globalLimiter,
  authLimiter,
  apiLimiter,
  creationLimiter,
  uploadLimiter,
  exportLimiter,
  
  // Fonctions utilitaires
  ddosProtection,
  userRateLimit,
  endpointRateLimit,
  abuseDetection,
  
  // Gestion
  resetRateLimit,
  getRateLimitStats,
  
  // Configuration
  useRedis,
  redisClient
};