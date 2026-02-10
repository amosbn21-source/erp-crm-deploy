// src/utils/validation.js - VALIDATION COMPLÈTE ET SÉCURISÉE
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import xss from 'xss';

// Configuration de nettoyage HTML
const sanitizeOptions = {
  allowedTags: [], // Pas de balises HTML autorisées par défaut
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Configuration XSS
const xssOptions = {
  whiteList: {}, // Liste blanche vide par défaut
  stripIgnoreTag: true, // Supprimer les balises non autorisées
  stripIgnoreTagBody: ['script', 'style'] // Supprimer le contenu des balises dangereuses
};

/**
 * NETTOYAGE ET ÉCHAPPEMENT DES DONNÉES
 */

// Nettoyage basique (supprime HTML)
export const sanitizeInput = (input) => {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input);

  // Supprimer les balises HTML
  const clean = sanitizeHtml(input, sanitizeOptions);
  
  // Échapper les caractères spéciaux
  const escaped = xss(clean, xssOptions);
  
  return escaped.trim();
};

// Nettoyage pour les champs texte (autorise un peu de HTML limité)
export const sanitizeRichText = (input) => {
  if (!input) return '';
  
  const options = {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    disallowedTagsMode: 'escape'
  };
  
  return sanitizeHtml(input, options);
};

// Nettoyage pour les emails (plus restrictif)
export const sanitizeEmail = (email) => {
  if (!email) return '';
  
  // Convertir en minuscules et supprimer les espaces
  const clean = email.toLowerCase().trim();
  
  // Échapper les caractères spéciaux
  return xss(clean, {
    whiteList: {},
    stripIgnoreTag: true
  });
};

/**
 * VALIDATION DES DONNÉES
 */

// Validation d'email
export const validateEmail = (email) => {
  if (!email) return { isValid: false, error: 'Email requis' };
  
  const cleanEmail = sanitizeEmail(email);
  
  if (!validator.isEmail(cleanEmail)) {
    return { isValid: false, error: 'Format d\'email invalide' };
  }
  
  // Vérifier la longueur
  if (cleanEmail.length > 254) {
    return { isValid: false, error: 'Email trop long (max 254 caractères)' };
  }
  
  return { isValid: true, value: cleanEmail };
};

// Validation de mot de passe
export const validatePassword = (password) => {
  if (!password) return { isValid: false, error: 'Mot de passe requis' };
  
  const minLength = 8;
  const maxLength = 100;
  
  if (password.length < minLength) {
    return { isValid: false, error: `Le mot de passe doit contenir au moins ${minLength} caractères` };
  }
  
  if (password.length > maxLength) {
    return { isValid: false, error: `Le mot de passe ne doit pas dépasser ${maxLength} caractères` };
  }
  
  // Vérifier la complexité
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasUpperCase) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
  }
  
  if (!hasLowerCase) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins une minuscule' };
  }
  
  if (!hasNumbers) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
  }
  
  // Optionnel : caractères spéciaux
  // if (!hasSpecialChar) {
  //   return { isValid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial' };
  // }
  
  return { isValid: true };
};

// Validation de téléphone
export const validatePhone = (phone) => {
  if (!phone) return { isValid: true, value: '' }; // Téléphone optionnel
  
  const cleanPhone = phone.replace(/[^\d+]/g, ''); // Garder uniquement les chiffres et +
  
  // Validation pour les numéros français/internationaux
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  
  if (!phoneRegex.test(cleanPhone)) {
    return { isValid: false, error: 'Numéro de téléphone invalide' };
  }
  
  // Vérifier la longueur
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { isValid: false, error: 'Numéro de téléphone doit contenir 10 à 15 chiffres' };
  }
  
  return { isValid: true, value: cleanPhone };
};

// Validation de nombres
export const validateNumber = (value, fieldName, options = {}) => {
  const { min = 0, max = 9999999, required = false, isInteger = false } = options;
  
  if (!value && !required) {
    return { isValid: true, value: null };
  }
  
  if (!value && required) {
    return { isValid: false, error: `${fieldName} est requis` };
  }
  
  // Convertir en nombre
  const num = isInteger ? parseInt(value, 10) : parseFloat(value);
  
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} doit être un nombre valide` };
  }
  
  if (isInteger && !Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} doit être un nombre entier` };
  }
  
  if (num < min) {
    return { isValid: false, error: `${fieldName} doit être supérieur ou égal à ${min}` };
  }
  
  if (num > max) {
    return { isValid: false, error: `${fieldName} doit être inférieur ou égal à ${max}` };
  }
  
  return { isValid: true, value: num };
};

// Validation de date
export const validateDate = (dateString, fieldName) => {
  if (!dateString) {
    return { isValid: false, error: `${fieldName} est requis` };
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, error: `${fieldName} invalide` };
  }
  
  // Vérifier que la date n'est pas dans le futur (pour certaines dates)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date > today) {
    return { isValid: false, error: `${fieldName} ne peut pas être dans le futur` };
  }
  
  return { isValid: true, value: date.toISOString() };
};

// Validation de fichiers
export const validateFile = (file, options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize = 5 * 1024 * 1024, // 5MB par défaut
    required = false
  } = options;
  
  if (!file && !required) {
    return { isValid: true };
  }
  
  if (!file && required) {
    return { isValid: false, error: 'Fichier requis' };
  }
  
  // Vérifier le type MIME
  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes.map(t => t.split('/')[1]).join(', ');
    return { isValid: false, error: `Type de fichier non autorisé. Types autorisés: ${allowedExtensions}` };
  }
  
  // Vérifier la taille
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    return { isValid: false, error: `Fichier trop volumineux. Taille max: ${maxSizeMB}MB` };
  }
  
  // Vérifier le nom du fichier (prévenir les attaques par chemin)
  const fileName = file.name;
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
  
  if (invalidChars.test(fileName)) {
    return { isValid: false, error: 'Nom de fichier invalide' };
  }
  
  // Vérifier l'extension
  const fileExtension = fileName.split('.').pop().toLowerCase();
  const allowedExtensions = allowedTypes.map(t => t.split('/')[1]);
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, error: `Extension de fichier non autorisée` };
  }
  
  return { isValid: true };
};

/**
 * VALIDATIONS SPÉCIFIQUES AUX MODÈLES
 */

// Validation d'un contact
export const validateContact = (contactData) => {
  const errors = [];
  const sanitizedData = {};
  
  // Nettoyer et valider le nom
  const nom = sanitizeInput(contactData.nom || '');
  if (!nom || nom.length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  } else if (nom.length > 100) {
    errors.push('Le nom ne doit pas dépasser 100 caractères');
  } else {
    sanitizedData.nom = nom;
  }
  
  // Nettoyer et valider le prénom
  const prenom = sanitizeInput(contactData.prenom || '');
  if (prenom && prenom.length > 100) {
    errors.push('Le prénom ne doit pas dépasser 100 caractères');
  } else {
    sanitizedData.prenom = prenom;
  }
  
  // Valider l'email
  const emailValidation = validateEmail(contactData.email);
  if (!emailValidation.isValid) {
    errors.push(emailValidation.error);
  } else {
    sanitizedData.email = emailValidation.value;
  }
  
  // Valider le téléphone
  const phoneValidation = validatePhone(contactData.telephone);
  if (!phoneValidation.isValid) {
    errors.push(phoneValidation.error);
  } else {
    sanitizedData.telephone = phoneValidation.value;
  }
  
  // Nettoyer l'entreprise
  const entreprise = sanitizeInput(contactData.entreprise || '');
  if (entreprise && entreprise.length > 200) {
    errors.push('Le nom de l\'entreprise ne doit pas dépasser 200 caractères');
  } else {
    sanitizedData.entreprise = entreprise;
  }
  
  // Nettoyer le compte
  const compte = sanitizeInput(contactData.compte || '');
  if (compte && compte.length > 100) {
    errors.push('Le compte ne doit pas dépasser 100 caractères');
  } else {
    sanitizedData.compte = compte;
  }
  
  // Valider le type de contact
  const typeContact = sanitizeInput(contactData.typeContact || '');
  const allowedTypes = ['client', 'prospect'];
  if (!allowedTypes.includes(typeContact)) {
    errors.push(`Type de contact invalide. Types autorisés: ${allowedTypes.join(', ')}`);
  } else {
    sanitizedData.typeContact = typeContact;
  }
  
  // Nettoyer l'adresse
  sanitizedData.adresse = sanitizeRichText(contactData.adresse || '');
  if (sanitizedData.adresse.length > 500) {
    errors.push('L\'adresse ne doit pas dépasser 500 caractères');
  }
  
  // Nettoyer la ville
  const ville = sanitizeInput(contactData.ville || '');
  if (ville && ville.length > 100) {
    errors.push('La ville ne doit pas dépasser 100 caractères');
  } else {
    sanitizedData.ville = ville;
  }
  
  // Nettoyer le code postal
  const codePostal = sanitizeInput(contactData.codePostal || '');
  if (codePostal && !/^\d{5}$/.test(codePostal)) {
    errors.push('Le code postal doit contenir exactement 5 chiffres');
  } else {
    sanitizedData.codePostal = codePostal;
  }
  
  // Nettoyer le pays
  const pays = sanitizeInput(contactData.pays || '');
  if (pays && pays.length > 100) {
    errors.push('Le pays ne doit pas dépasser 100 caractères');
  } else {
    sanitizedData.pays = pays;
  }
  
  // Nettoyer les notes
  sanitizedData.notes = sanitizeRichText(contactData.notes || '');
  if (sanitizedData.notes.length > 2000) {
    errors.push('Les notes ne doivent pas dépasser 2000 caractères');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

// Validation d'un produit
export const validateProduct = (productData) => {
  const errors = [];
  const sanitizedData = {};
  
  // Nettoyer et valider le nom
  const nom = sanitizeInput(productData.nom || '');
  if (!nom || nom.length < 2) {
    errors.push('Le nom du produit doit contenir au moins 2 caractères');
  } else if (nom.length > 200) {
    errors.push('Le nom du produit ne doit pas dépasser 200 caractères');
  } else {
    sanitizedData.nom = nom;
  }
  
  // Valider le prix
  const priceValidation = validateNumber(productData.prix, 'Prix', {
    min: 0,
    max: 1000000,
    required: true
  });
  
  if (!priceValidation.isValid) {
    errors.push(priceValidation.error);
  } else {
    sanitizedData.prix = priceValidation.value;
  }
  
  // Valider le stock
  const stockValidation = validateNumber(productData.stock, 'Stock', {
    min: 0,
    max: 100000,
    required: false,
    isInteger: true
  });
  
  if (!stockValidation.isValid) {
    errors.push(stockValidation.error);
  } else {
    sanitizedData.stock = stockValidation.value || 0;
  }
  
  // Nettoyer la description
  sanitizedData.description = sanitizeRichText(productData.description || '');
  if (sanitizedData.description.length > 2000) {
    errors.push('La description ne doit pas dépasser 2000 caractères');
  }
  
  // Nettoyer le code barres
  const codeBarres = sanitizeInput(productData.codeBarres || '');
  if (codeBarres && codeBarres.length > 50) {
    errors.push('Le code barres ne doit pas dépasser 50 caractères');
  } else {
    sanitizedData.codeBarres = codeBarres;
  }
  
  // Nettoyer la catégorie
  const categorie = sanitizeInput(productData.categorie || '');
  if (!categorie || categorie.length < 2) {
    errors.push('La catégorie est requise (min 2 caractères)');
  } else if (categorie.length > 100) {
    errors.push('La catégorie ne doit pas dépasser 100 caractères');
  } else {
    sanitizedData.categorie = categorie;
  }
  
  // Validation de l'image (si fournie)
  if (productData.imageFile) {
    const fileValidation = validateFile(productData.imageFile, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 10 * 1024 * 1024, // 10MB
      required: false
    });
    
    if (!fileValidation.isValid) {
      errors.push(fileValidation.error);
    } else {
      sanitizedData.imageFile = productData.imageFile;
    }
  }
  
  // Si une image URL est fournie (existant)
  if (productData.image && typeof productData.image === 'string') {
    const imageUrl = sanitizeInput(productData.image);
    if (imageUrl.length > 500) {
      errors.push('L\'URL de l\'image est trop longue');
    } else {
      sanitizedData.image = imageUrl;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

// Validation d'une commande
export const validateOrder = (orderData) => {
  const errors = [];
  const sanitizedData = {};
  
  // Valider la date
  const dateValidation = validateDate(orderData.date, 'Date de commande');
  if (!dateValidation.isValid) {
    errors.push(dateValidation.error);
  } else {
    sanitizedData.date = dateValidation.value;
  }
  
  // Valider le statut
  const statut = sanitizeInput(orderData.statut || '');
  const allowedStatus = ['en attente', 'en cours', 'livrée', 'annulée'];
  if (!allowedStatus.includes(statut)) {
    errors.push(`Statut invalide. Statuts autorisés: ${allowedStatus.join(', ')}`);
  } else {
    sanitizedData.statut = statut;
  }
  
  // Valider le contact ID
  const contactIdValidation = validateNumber(orderData.contactId, 'ID Contact', {
    min: 1,
    required: true,
    isInteger: true
  });
  
  if (!contactIdValidation.isValid) {
    errors.push(contactIdValidation.error);
  } else {
    sanitizedData.contactId = contactIdValidation.value;
  }
  
  // Valider les produits
  if (!orderData.produits || !Array.isArray(orderData.produits) || orderData.produits.length === 0) {
    errors.push('Au moins un produit est requis');
  } else {
    sanitizedData.produits = [];
    
    orderData.produits.forEach((produit, index) => {
      // Valider l'ID du produit
      const produitIdValidation = validateNumber(produit.produitId, `Produit ${index + 1} ID`, {
        min: 1,
        required: true,
        isInteger: true
      });
      
      if (!produitIdValidation.isValid) {
        errors.push(`Produit ${index + 1}: ${produitIdValidation.error}`);
        return;
      }
      
      // Valider la quantité
      const quantiteValidation = validateNumber(produit.quantite, `Produit ${index + 1} Quantité`, {
        min: 1,
        max: 1000,
        required: true,
        isInteger: true
      });
      
      if (!quantiteValidation.isValid) {
        errors.push(`Produit ${index + 1}: ${quantiteValidation.error}`);
        return;
      }
      
      // Valider le prix unitaire
      const prixUnitaireValidation = validateNumber(produit.prixUnitaire, `Produit ${index + 1} Prix`, {
        min: 0,
        max: 1000000,
        required: true
      });
      
      if (!prixUnitaireValidation.isValid) {
        errors.push(`Produit ${index + 1}: ${prixUnitaireValidation.error}`);
        return;
      }
      
      sanitizedData.produits.push({
        produitId: produitIdValidation.value,
        quantite: quantiteValidation.value,
        prixUnitaire: prixUnitaireValidation.value
      });
    });
  }
  
  // Calculer les totaux (ou valider si fournis)
  if (orderData.total !== undefined) {
    const totalValidation = validateNumber(orderData.total, 'Total', {
      min: 0,
      max: 10000000,
      required: false
    });
    
    if (!totalValidation.isValid) {
      errors.push(totalValidation.error);
    } else {
      sanitizedData.total = totalValidation.value;
    }
  }
  
  if (orderData.totalHT !== undefined) {
    const totalHTValidation = validateNumber(orderData.totalHT, 'Total HT', {
      min: 0,
      max: 10000000,
      required: false
    });
    
    if (!totalHTValidation.isValid) {
      errors.push(totalHTValidation.error);
    } else {
      sanitizedData.totalHT = totalHTValidation.value;
    }
  }
  
  if (orderData.tva !== undefined) {
    const tvaValidation = validateNumber(orderData.tva, 'TVA', {
      min: 0,
      max: 10000000,
      required: false
    });
    
    if (!tvaValidation.isValid) {
      errors.push(tvaValidation.error);
    } else {
      sanitizedData.tva = tvaValidation.value;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

/**
 * FONCTIONS UTILITAIRES
 */

// Valider un objet entier avec un schéma
export const validateWithSchema = (data, schema) => {
  const errors = [];
  const sanitizedData = {};
  
  Object.keys(schema).forEach(field => {
    const fieldConfig = schema[field];
    const value = data[field];
    
    // Vérifier si le champ est requis
    if (fieldConfig.required && (!value && value !== 0)) {
      errors.push(`${fieldConfig.label || field} est requis`);
      return;
    }
    
    // Nettoyer la valeur
    const sanitizedValue = fieldConfig.sanitize 
      ? fieldConfig.sanitize(value) 
      : sanitizeInput(value || '');
    
    // Valider selon le type
    let validationResult;
    
    switch (fieldConfig.type) {
      case 'email':
        validationResult = validateEmail(sanitizedValue);
        break;
      case 'number':
        validationResult = validateNumber(
          sanitizedValue, 
          fieldConfig.label || field, 
          fieldConfig.options || {}
        );
        break;
      case 'phone':
        validationResult = validatePhone(sanitizedValue);
        break;
      case 'text':
        if (fieldConfig.maxLength && sanitizedValue.length > fieldConfig.maxLength) {
          validationResult = { 
            isValid: false, 
            error: `${fieldConfig.label || field} ne doit pas dépasser ${fieldConfig.maxLength} caractères` 
          };
        } else {
          validationResult = { isValid: true, value: sanitizedValue };
        }
        break;
      default:
        validationResult = { isValid: true, value: sanitizedValue };
    }
    
    if (!validationResult.isValid) {
      errors.push(validationResult.error);
    } else if (validationResult.value !== undefined) {
      sanitizedData[field] = validationResult.value;
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

// Exporter tous les validators
export default {
  sanitizeInput,
  sanitizeRichText,
  sanitizeEmail,
  validateEmail,
  validatePassword,
  validatePhone,
  validateNumber,
  validateDate,
  validateFile,
  validateContact,
  validateProduct,
  validateOrder,
  validateWithSchema
};