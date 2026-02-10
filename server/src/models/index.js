// ⚡ Centralisation des modèles et des associations pour éviter les boucles d'import
const sequelize = require('../config/db');

// ⚡ Import des modèles (chacun est autonome et ne définit pas d'associations globales)
const Produit = require('./Produit');
const Contact = require('./Contact');
const Commande = require('./Commande');
const CommandeProduits = require('./CommandeProduits');

// ===============================
// Définition des associations
// ===============================

// ⚡ Contact 1:N Commande
Contact.hasMany(Commande, { foreignKey: 'contactId' });
Commande.belongsTo(Contact, { foreignKey: 'contactId' });

// ⚡ Commande N:M Produit via CommandeProduits (table pivot avec colonne "quantite")
Commande.belongsToMany(Produit, { through: CommandeProduits, foreignKey: 'commandeId' });
Produit.belongsToMany(Commande, { through: CommandeProduits, foreignKey: 'produitId' });

// ⚡ Optionnel: si tu veux faire des include sur le pivot, tu peux relier explicitement le pivot aux modèles
// Cela évite les boucles car tout est défini ici, après les imports
CommandeProduits.belongsTo(Produit, { foreignKey: 'produitId' });
CommandeProduits.belongsTo(Commande, { foreignKey: 'commandeId' });
Produit.hasMany(CommandeProduits, { foreignKey: 'produitId' });
Commande.hasMany(CommandeProduits, { foreignKey: 'commandeId' });

// ===============================
// Exporter tous les modèles et sequelize pour usage global
// ===============================
module.exports = {
  sequelize,
  Produit,
  Contact,
  Commande,
  CommandeProduits
};
