// backend/src/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Créer le dossier logs s'il n'existe pas
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuration du logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'erp-crm-backend' },
  transports: [
    // Fichier d'erreurs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Fichier de logs combinés
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// En développement, ajouter aussi la console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Fonctions utilitaires
const logSecurityEvent = (event, metadata = {}) => {
  // Masquer les données sensibles
  const safeMetadata = { ...metadata };
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'ssn'];
  
  sensitiveFields.forEach(field => {
    if (safeMetadata[field]) {
      safeMetadata[field] = '***MASKED***';
    }
  });
  
  logger.warn(`SECURITY: ${event}`, safeMetadata);
};

const logAuditEvent = (action, details = {}) => {
  logger.info(`AUDIT: ${action}`, details);
};

const logError = (error, context = {}) => {
  logger.error(`ERROR: ${error.message}`, {
    ...context,
    stack: error.stack
  });
};

const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Ne pas logger les requêtes de santé
    if (req.path === '/health' || req.path === '/api/health') {
      return;
    }
    
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous'
    };
    
    if (res.statusCode >= 400) {
      logger.warn('REQUEST_ERROR', logData);
    } else {
      logger.info('REQUEST', logData);
    }
  });
  
  next();
};

module.exports = {
  logger,
  logSecurityEvent,
  logAuditEvent,
  logError,
  logRequest
};