// Importation de Sequelize (ORM pour gérer PostgreSQL) src/config/db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'erpcrm',      // Nom de la base
  process.env.DB_USER || 'postgres',    // Utilisateur
  String(process.env.DB_PASS || ''),    // ⚡ Force en string
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

module.exports = sequelize;
