// backend/src/config/security.js
module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    accessTokenExpiry: '24h',
    refreshTokenExpiry: '7d',
    algorithm: 'HS256'
  },
  
  // Password Policy
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAgeDays: 90, // Changement obligatoire tous les 90 jours
    historySize: 5 // Ne pas réutiliser les 5 derniers mots de passe
  },
  
  // Rate Limiting Configuration
  rateLimiting: {
    // Global limits
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000
    },
    // Authentication limits (brute force protection)
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5, // 5 tentatives max
      message: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.'
    },
    // API specific limits
    api: {
      windowMs: 60 * 60 * 1000, // 1 heure
      max: 10000
    }
  },
  
  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'],
    credentials: true,
    maxAge: 86400 // 24 heures
  },
  
  // Input Validation
  validation: {
    maxStringLength: {
      name: 100,
      email: 254,
      phone: 20,
      address: 500,
      description: 2000
    },
    minStringLength: {
      name: 2,
      password: 8
    }
  },
  
  // File Upload Security
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    scanForViruses: process.env.NODE_ENV === 'production'
  },
  
  // Security Headers
  headers: {
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL]
    }
  },
  
  // Audit Logging
  auditLogging: {
    enabled: true,
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    sensitiveFields: ['password', 'token', 'creditCard', 'ssn']
  }
};