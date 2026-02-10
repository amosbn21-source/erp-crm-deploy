const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// ⚡ Définition du modèle pivot
const CommandeProduits = sequelize.define('CommandeProduits', {
  quantite: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'CommandeProduits', // ⚡ Nom explicite
  timestamps: false
});

module.exports = CommandeProduits;
