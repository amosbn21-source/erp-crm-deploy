// backend/src/controllers/contactController.js
const Contact = require('../models/Contact');
const { validationResult } = require('express-validator');
const { sanitize } = require('../utils/validation');
const { logAuditEvent, logSecurityEvent } = require('../utils/logger');
const { 
  sendAuditNotification, 
  checkQuota 
} = require('../utils/monitoring');

class ContactController {
  /**
   * Récupérer tous les contacts (avec pagination et filtres)
   */
  async getAllContacts(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Paramètres de pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      
      // Filtres de sécurité selon le rôle
      let whereClause = {};
      
      if (userRole === 'user') {
        // Un utilisateur standard ne voit que ses contacts
        whereClause.userId = userId;
      } else if (userRole === 'sales') {
        // Un commercial voit ses contacts et ceux de son équipe
        whereClause = {
          $or: [
            { userId: userId },
            { assignedTo: userId },
            { teamId: req.user.teamId }
          ]
        };
      }
      // Admin et manager voient tous les contacts
      
      // Construction de la requête
      const query = Contact.find(whereClause);
      
      // Tri
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      query.sort({ [sortBy]: sortOrder });
      
      // Pagination
      query.skip(offset).limit(limit);
      
      // Exécution
      const contacts = await query.exec();
      const total = await Contact.countDocuments(whereClause);
      
      // Log d'audit
      logAuditEvent('CONTACTS_VIEWED', {
        userId,
        userRole,
        page,
        limit,
        totalResults: contacts.length,
        ip: req.ip
      });
      
      res.json({
        success: true,
        data: contacts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        metadata: {
          requestedBy: userId,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logSecurityEvent('CONTACTS_FETCH_ERROR', {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des contacts',
        code: 'FETCH_ERROR'
      });
    }
  }

  /**
   * Récupérer un contact par ID
   */
  async getContactById(req, res) {
    try {
      const contactId = req.params.id;
      const userId = req.user.id;
      
      // La ressource a déjà été récupérée par le middleware checkOwnership
      const contact = req.resource;
      
      // Vérifier les permissions supplémentaires
      if (contact.private && req.user.role !== 'admin' && contact.userId.toString() !== userId) {
        logSecurityEvent('CONTACT_PRIVATE_ACCESS_DENIED', {
          userId,
          contactId,
          contactOwner: contact.userId,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          error: 'Ce contact est privé',
          code: 'CONTACT_PRIVATE'
        });
      }
      
      // Log d'audit
      logAuditEvent('CONTACT_VIEWED', {
        userId,
        contactId,
        contactEmail: contact.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        data: contact,
        metadata: {
          viewedAt: new Date().toISOString(),
          viewedBy: userId
        }
      });
      
    } catch (error) {
      logSecurityEvent('CONTACT_FETCH_ERROR', {
        userId: req.user?.id,
        contactId: req.params.id,
        error: error.message,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du contact',
        code: 'FETCH_ERROR'
      });
    }
  }

  /**
   * Créer un nouveau contact
   */
  async createContact(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }
      
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Vérifier les quotas (si applicable)
      if (userRole !== 'admin') {
        const quotaCheck = await checkQuota(userId, 'contacts');
        if (!quotaCheck.allowed) {
          return res.status(429).json({
            success: false,
            error: quotaCheck.message,
            code: 'QUOTA_EXCEEDED',
            limit: quotaCheck.limit,
            current: quotaCheck.current
          });
        }
      }
      
      // Nettoyer et valider les données
      const contactData = {
        ...req.body,
        userId, // Toujours associer le contact au créateur
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Nettoyage XSS
      Object.keys(contactData).forEach(key => {
        if (typeof contactData[key] === 'string') {
          contactData[key] = sanitize(contactData[key]);
        }
      });
      
      // Validation des données spécifiques
      if (contactData.email) {
        const existingContact = await Contact.findOne({ 
          email: contactData.email,
          userId // Ne vérifier que pour cet utilisateur
        });
        
        if (existingContact) {
          return res.status(409).json({
            success: false,
            error: 'Un contact avec cet email existe déjà',
            code: 'DUPLICATE_EMAIL',
            existingContactId: existingContact._id
          });
        }
      }
      
      // Création du contact
      const contact = new Contact(contactData);
      await contact.save();
      
      // Log d'audit
      logAuditEvent('CONTACT_CREATED', {
        userId,
        contactId: contact._id,
        contactEmail: contact.email,
        contactName: `${contact.firstName} ${contact.lastName}`,
        ip: req.ip
      });
      
      // Notification (si configuré)
      await sendAuditNotification('CONTACT_CREATED', {
        userId,
        contactId: contact._id
      });
      
      res.status(201).json({
        success: true,
        data: contact,
        message: 'Contact créé avec succès',
        metadata: {
          createdBy: userId,
          createdAt: contact.createdAt
        }
      });
      
    } catch (error) {
      logSecurityEvent('CONTACT_CREATION_ERROR', {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        data: req.body // Ne pas logger les données sensibles en production
      });
      
      // Gestion des erreurs MongoDB
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Données de contact invalides',
          details: error.errors,
          code: 'MONGO_VALIDATION_ERROR'
        });
      }
      
      if (error.code === 11000) { // Duplicate key
        return res.status(409).json({
          success: false,
          error: 'Contact déjà existant',
          code: 'DUPLICATE_KEY'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du contact',
        code: 'CREATION_ERROR'
      });
    }
  }

  /**
   * Mettre à jour un contact
   */
  async updateContact(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }
      
      const contactId = req.params.id;
      const userId = req.user.id;
      const contact = req.resource; // Récupéré par checkOwnership
      
      // Sauvegarder l'ancien état pour le log d'audit
      const oldState = { ...contact.toObject() };
      
      // Nettoyer les données
      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          updates[key] = typeof req.body[key] === 'string' 
            ? sanitize(req.body[key]) 
            : req.body[key];
        }
      });
      
      // Empêcher la modification de certains champs
      delete updates.userId;
      delete updates.createdBy;
      delete updates.createdAt;
      
      // Ajouter les métadonnées de mise à jour
      updates.updatedAt = new Date();
      updates.updatedBy = userId;
      
      // Appliquer les mises à jour
      Object.assign(contact, updates);
      
      // Validation avant sauvegarde
      await contact.validate();
      
      // Sauvegarder
      await contact.save();
      
      // Log d'audit détaillé
      logAuditEvent('CONTACT_UPDATED', {
        userId,
        contactId,
        updates: Object.keys(updates),
        oldState: oldState,
        newState: contact.toObject(),
        ip: req.ip
      });
      
      res.json({
        success: true,
        data: contact,
        message: 'Contact mis à jour avec succès',
        metadata: {
          updatedBy: userId,
          updatedAt: contact.updatedAt
        }
      });
      
    } catch (error) {
      logSecurityEvent('CONTACT_UPDATE_ERROR', {
        userId: req.user?.id,
        contactId: req.params.id,
        error: error.message,
        ip: req.ip
      });
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Données de mise à jour invalides',
          details: error.errors,
          code: 'UPDATE_VALIDATION_ERROR'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour du contact',
        code: 'UPDATE_ERROR'
      });
    }
  }

  /**
   * Supprimer un contact (soft delete)
   */
  async deleteContact(req, res) {
    try {
      const contactId = req.params.id;
      const userId = req.user.id;
      const contact = req.resource;
      
      // Soft delete au lieu de suppression physique
      contact.deleted = true;
      contact.deletedAt = new Date();
      contact.deletedBy = userId;
      
      await contact.save();
      
      // Log d'audit
      logAuditEvent('CONTACT_DELETED', {
        userId,
        contactId,
        contactEmail: contact.email,
        ip: req.ip
      });
      
      // Notification
      await sendAuditNotification('CONTACT_DELETED', {
        userId,
        contactId
      });
      
      res.json({
        success: true,
        message: 'Contact supprimé avec succès',
        metadata: {
          deletedBy: userId,
          deletedAt: contact.deletedAt,
          note: 'Suppression logique (soft delete)'
        }
      });
      
    } catch (error) {
      logSecurityEvent('CONTACT_DELETION_ERROR', {
        userId: req.user?.id,
        contactId: req.params.id,
        error: error.message,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression du contact',
        code: 'DELETION_ERROR'
      });
    }
  }

  /**
   * Recherche avancée de contacts
   */
  async searchContacts(req, res) {
    try {
      // Implémentation sécurisée de la recherche
      // Limiter les champs de recherche pour éviter l'injection
      const allowedSearchFields = ['name', 'email', 'phone', 'company'];
      const searchQuery = {};
      
      Object.keys(req.query).forEach(key => {
        if (allowedSearchFields.includes(key) && req.query[key]) {
          // Utiliser une regex sécurisée
          searchQuery[key] = { 
            $regex: sanitize(req.query[key]), 
            $options: 'i' 
          };
        }
      });
      
      // Ajouter les restrictions de sécurité
      if (req.user.role !== 'admin') {
        searchQuery.$or = [
          { userId: req.user.id },
          { isPublic: true },
          { teamId: { $in: req.user.teams || [] } }
        ];
      }
      
      const contacts = await Contact.find(searchQuery).limit(100);
      
      res.json({
        success: true,
        data: contacts,
        count: contacts.length,
        metadata: {
          searchFields: Object.keys(searchQuery),
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logSecurityEvent('CONTACT_SEARCH_ERROR', {
        userId: req.user?.id,
        error: error.message,
        query: req.query,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la recherche',
        code: 'SEARCH_ERROR'
      });
    }
  }

  /**
   * Abonnement newsletter (publique)
   */
  async subscribeToNewsletter(req, res) {
    try {
      const { email, name } = req.body;
      
      // Validation basique
      if (!email || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'Email invalide'
        });
      }
      
      // Vérifier si déjà abonné
      const existing = await Contact.findOne({ 
        email: email.toLowerCase(),
        newsletterSubscribed: true 
      });
      
      if (existing) {
        return res.status(200).json({
          success: true,
          message: 'Déjà abonné à la newsletter'
        });
      }
      
      // Créer un contact limité
      const contact = new Contact({
        email: email.toLowerCase(),
        firstName: name ? sanitize(name) : undefined,
        newsletterSubscribed: true,
        source: 'newsletter',
        createdAt: new Date()
      });
      
      await contact.save();
      
      // Log (sans informations sensibles)
      logAuditEvent('NEWSLETTER_SUBSCRIPTION', {
        emailHash: require('crypto').createHash('sha256').update(email).digest('hex'),
        source: 'public_form'
      });
      
      res.status(201).json({
        success: true,
        message: 'Inscription à la newsletter réussie'
      });
      
    } catch (error) {
      // Ne pas révéler d'erreurs internes pour les routes publiques
      console.error('Newsletter subscription error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'inscription'
      });
    }
  }
}

module.exports = new ContactController();