// db-pg.js - Pool PostgreSQL dédié pour les webhooks
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'erpcrm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de connexion
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL:', err.message);
  } else {
    console.log('✅ PostgreSQL Pool connecté pour webhooks');
  }
});

module.exports = pool;