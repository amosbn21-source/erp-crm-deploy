// src/utils/validation.js - Version simplifiée
export const validateEmail = (email) => {
  if (!email) return { isValid: false, error: 'Email requis' };
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Email invalide' };
  }
  
  return { isValid: true, value: email.toLowerCase().trim() };
};

export const validatePhone = (phone) => {
  if (!phone) return { isValid: true, value: '' };
  
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 10 || clean.length > 15) {
    return { isValid: false, error: 'Téléphone invalide' };
  }
  
  return { isValid: true, value: clean };
};

export const sanitizeInput = (input) => {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);
  
  // Nettoyer HTML
  const clean = input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`;=]/g, '')
    .trim();
    
  return clean;
};

export const validateNumber = (value, min = 0, max = 9999999) => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
};

// src/utils/validation.js - Ajoutez cette fonction

export const validateContact = (contactData) => {
  const errors = [];
  const sanitizedData = {};

  // Validation et nettoyage de chaque champ
  if (!contactData.nom?.trim()) {
    errors.push('Le nom est requis');
  } else {
    sanitizedData.nom = sanitizeInput(contactData.nom);
  }

  // Prénom (optionnel)
  sanitizedData.prenom = contactData.prenom ? sanitizeInput(contactData.prenom) : '';

  // Email (requis)
  const emailValidation = validateEmail(contactData.email);
  if (!emailValidation.isValid) {
    errors.push(emailValidation.error);
  } else {
    sanitizedData.email = emailValidation.value;
  }

  // Téléphone (optionnel)
  const phoneValidation = validatePhone(contactData.telephone);
  if (phoneValidation.isValid) {
    sanitizedData.telephone = phoneValidation.value;
  } else if (contactData.telephone) {
    errors.push(phoneValidation.error);
  }

  // Nettoyage des autres champs optionnels
  sanitizedData.compte = contactData.compte ? sanitizeInput(contactData.compte) : '';
  sanitizedData.typeContact = contactData.typeContact || 'prospect';
  sanitizedData.entreprise = contactData.entreprise ? sanitizeInput(contactData.entreprise) : '';
  sanitizedData.adresse = contactData.adresse ? sanitizeInput(contactData.adresse) : '';
  sanitizedData.ville = contactData.ville ? sanitizeInput(contactData.ville) : '';
  sanitizedData.codePostal = contactData.codePostal ? sanitizeInput(contactData.codePostal) : '';
  sanitizedData.pays = contactData.pays ? sanitizeInput(contactData.pays) : '';
  sanitizedData.notes = contactData.notes ? sanitizeInput(contactData.notes) : '';

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};