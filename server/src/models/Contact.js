// Importation des types de données Sequelize
const { DataTypes } = require('sequelize');

// Import de la connexion DB (config/db.js)
const sequelize = require('../config/db');

// Définition du modèle Contact
// ⚡ Ici on définit uniquement la structure de la table "Contacts"
const Contact = sequelize.define('Contact', {

  

  contactId: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },

  nom: { 
    type: DataTypes.STRING, 
    allowNull: false // Nom obligatoire
  },
  prenom: { 
    type: DataTypes.STRING // Prénom optionnel
  },
  telephone: { 
    type: DataTypes.STRING // Numéro de téléphone
  },
  email: { 
    type: DataTypes.STRING // Adresse email
  },
  compte: { 
    type: DataTypes.STRING // Identifiant ou compte client
  }
});

// ⚡ Très important : on exporte uniquement le modèle
module.exports = Contact;
