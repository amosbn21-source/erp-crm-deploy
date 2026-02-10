// backend/src/middleware/security.js
const helmet = require('helmet');

// Configuration des headers de sécurité
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  noSniff: true,
  xssFilter: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false }
});

// Middleware pour vérifier les webhooks
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!secret) {
    console.warn('⚠️ WEBHOOK_SECRET non configuré');
    return next();
  }
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      error: 'Signature webhook manquante',
      code: 'MISSING_SIGNATURE'
    });
  }
  
  // Ici, vous devriez vérifier la signature HMAC
  // Pour l'exemple, on fait une vérification simple
  const expectedSignature = `sha256=${require('crypto')
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex')}`;
  
  if (signature !== expectedSignature) {
    console.warn('❌ Signature webhook invalide');
    return res.status(403).json({
      success: false,
      error: 'Signature webhook invalide',
      code: 'INVALID_SIGNATURE'
    });
  }
  
  next();
};

// Middleware pour limiter la taille des requêtes
const limitRequestBody = (maxSize = '1mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']) || 0;
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        error: `Taille de requête trop grande. Maximum: ${maxSize}`,
        code: 'REQUEST_TOO_LARGE'
      });
    }
    
    next();
  };
};

// Fonction utilitaire pour parser les tailles (1mb, 5mb, etc.)
function parseSize(size) {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i);
  if (!match) return 1024 * 1024; // 1MB par défaut
  
  const [, value, unit] = match;
  return parseFloat(value) * units[unit.toLowerCase()];
}

module.exports = {
  securityHeaders,
  verifyWebhookSignature,
  limitRequestBody
};