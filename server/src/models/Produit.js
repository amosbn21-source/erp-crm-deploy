// Import des utilitaires Sequelize
const { DataTypes } = require('sequelize');
// Import de l'instance Sequelize (connexion DB)
const sequelize = require('../config/db');

// ===============================
// Définition du modèle Produit
// ===============================
// Ce modèle représente les produits disponibles dans ton ERP-CRM
const Produit = sequelize.define('Produit', {
  // ⚡ Nom du produit
  nom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // ⚡ Description du produit
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // ⚡ Prix unitaire
  prix: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  // ⚡ Stock disponible
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // ⚡ Image (nom de fichier ou URL)
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // ⚡ Code-barres unique
  codeBarres: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'Produits', // ⚡ Nom explicite de la table
  timestamps: true        // ⚡ createdAt et updatedAt activés
});

// ===============================
// Relations
// ===============================
// ⚠️ Les relations N:M avec Commande sont définies dans Commande.js
// Ici, on garde le modèle Produit simple pour éviter les boucles circulaires

// ===============================
// Export du modèle
// ===============================
module.exports = Produit;
