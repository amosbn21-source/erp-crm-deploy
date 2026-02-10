// backend/src/middleware/logger.js
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Créer le dossier logs s'il n'existe pas
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format personnalisé pour morgan
const morganFormat = (tokens, req, res) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: tokens.status(req, res),
    response_time: `${tokens['response-time'](req, res)}ms`,
    content_length: tokens.res(req, res, 'content-length'),
    user_agent: req.get('user-agent'),
    ip: req.ip,
    user_id: req.user?.id || 'anonymous',
    request_id: req.requestId || 'none'
  });
};

// Middleware de logging
const requestLogger = morgan(morganFormat, {
  stream: {
    write: (message) => {
      const log = JSON.parse(message);
      
      // Ne pas logger les requêtes de santé
      if (log.url === '/health' || log.url === '/api/health') {
        return;
      }
      
      // Écrire dans un fichier
      const logFile = path.join(logDir, 'access.log');
      fs.appendFileSync(logFile, message + '\n');
      
      // Afficher dans la console en développement
      if (process.env.NODE_ENV !== 'production') {
        const statusColor = log.status >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(
          `${log.timestamp} ${log.method} ${log.url} ${statusColor}${log.status}\x1b[0m ${log.response_time}`
        );
      }
    }
  }
});

module.exports = requestLogger;