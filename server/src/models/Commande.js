const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Contact = require('./Contact');
const Produit = require('./Produit');
const CommandeProduits = require('./CommandeProduits');

const Commande = sequelize.define('Commande', {
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  statut: { type: DataTypes.STRING, defaultValue: 'en cours' },
  total: { type: DataTypes.FLOAT, defaultValue: 0 },
  contact: { type: DataTypes.INTEGER, references: { model: Contact, key: 'contact.Id' } }
}, {
  tableName: 'Commandes'
});

// ⚡ Relations
Contact.hasMany(Commande, { foreignKey: 'id' });
Commande.belongsTo(Contact, { foreignKey: 'id' });

Commande.belongsToMany(Produit, { through: CommandeProduits, foreignKey: 'commandeId' });
Produit.belongsToMany(Commande, { through: CommandeProduits, foreignKey: 'produitId' });

module.exports = Commande;
