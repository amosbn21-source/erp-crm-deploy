// Fichier: src/ia/ia-engine.js - VERSION LÉGÈRE SANS DEPENDANCES
const STOP_WORDS_FR = [
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 
  'mais', 'où', 'donc', 'car', 'ni', 'or', 'que', 'qui', 'quoi', 
  'dont', 'parce', 'pour', 'dans', 'avec', 'sans', 'sous', 'sur', 
  'chez', 'jusque', 'vers', 'pendant', 'depuis', 'contre', 'à', 'au', 
  'aux', 'en', 'y', 'ce', 'cet', 'cette', 'ces', 'mon', 'ton', 'son', 
  'ma', 'ta', 'sa', 'mes', 'tes', 'ses', 'notre', 'votre', 'leur', 
  'nos', 'vos', 'leurs', 'on', 'nous', 'vous', 'ils', 'elles', 'je', 
  'tu', 'il', 'elle', 'me', 'te', 'se', 'lui', 'leur', 'moi', 'toi', 
  'soi', 'eux', 'celui', 'celle', 'ceux', 'celles', 'aucun', 'aucune', 
  'certains', 'certaines', 'plusieurs', 'tout', 'toute', 'tous', 
  'toutes', 'autre', 'autres', 'même', 'mêmes', 'quel', 'quelle', 
  'quels', 'quelles', 'chaque', 'plus', 'moins', 'très', 'trop', 
  'assez', 'peu', 'beaucoup', 'bien', 'mal', 'vraiment', 'si', 'aussi', 
  'comme', 'sans', 'sous', 'sur', 'par', 'pour', 'avec', 'sans', 
  'avant', 'après', 'pendant', 'depuis', 'jusque', 'vers', 'chez', 
  'dans', 'entre', 'parmi', 'hors', 'sauf', 'excepté', 'outre', 
  'voici', 'voilà', 'alors', 'ainsi', 'donc', 'pourtant', 'cependant', 
  'néanmoins', 'toutefois', 'par ailleurs', 'd ailleurs', 'par contre', 
  'en revanche', 'sinon', 'autrement', 'puis', 'ensuite', 'alors', 
  'finalement', 'enfin', 'bref', 'bref', 'en somme', 'en résumé'
];

class IACRMMotor {
  constructor(pool, userSchema, userId) {
    this.pool = pool;
    this.userSchema = userSchema;
    this.userId = userId;
    
    this.config = {
      similarityThreshold: 0.3,
      maxHistory: 5,
      autoCreateOrderConfidence: 0.8
    };
  }

  // ==================== MÉTHODES PRINCIPALES ====================

  async processMessage(contactId, message, sessionId = null) {
    try {
      console.log(`🤖 IA: Traitement message pour contact ${contactId || 'new'}`);
      
      const contactResult = await this.handleContact(contactId, message);
      const actualContactId = contactResult.contactId;
      
      const intent = this.analyzeIntent(message);
      
      const response = await this.generateResponse(message, intent, actualContactId);
      
      await this.saveConversation(actualContactId, message, response, intent);
      
      return {
        success: true,
        contactId: actualContactId,
        response,
        intent,
        contactCreated: contactResult.created,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Erreur IA:', error);
      return {
        success: false,
        response: "Je rencontre des difficultés techniques. Veuillez réessayer.",
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==================== GESTION DES CONTACTS ====================

  async handleContact(contactId, message) {
    if (contactId && contactId !== 'new') {
      return { contactId, created: false };
    }
    
    const extracted = this.extractContactInfo(message);
    
    if (!extracted.email && !extracted.telephone) {
      const tempContact = await this.createTemporaryContact();
      return { contactId: tempContact.id, created: true, temporary: true };
    }
    
    let existingContact = null;
    if (extracted.email) {
      const result = await this.pool.query(
        `SELECT id FROM "${this.userSchema}".contacts WHERE email = $1`,
        [extracted.email]
      );
      if (result.rows.length > 0) existingContact = result.rows[0];
    }
    
    if (existingContact) {
      await this.updateContact(existingContact.id, extracted);
      return { contactId: existingContact.id, created: false, existing: true };
    }
    
    const newContact = await this.createContact(extracted);
    return { contactId: newContact.id, created: true, extracted };
  }

  extractContactInfo(message) {
    const extracted = {};
    
    // Email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = message.match(emailRegex);
    if (emailMatch) extracted.email = emailMatch[0];
    
    // Téléphone
    const phoneRegex = /(0[1-9])(?:[\s.-]?[0-9]{2}){4}/;
    const phoneMatch = message.match(phoneRegex);
    if (phoneMatch) extracted.telephone = phoneMatch[0];
    
    // Nom simple
    if (message.toLowerCase().includes("je m'appelle")) {
      const parts = message.split("je m'appelle")[1].trim().split(' ');
      if (parts.length > 0) {
        extracted.nom = parts[0];
        if (parts.length > 1) extracted.prenom = parts.slice(1).join(' ');
      }
    }
    
    return extracted;
  }

  async createContact(data) {
    const result = await this.pool.query(
      `INSERT INTO "${this.userSchema}".contacts 
       (nom, prenom, email, telephone, type_contact, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING id, nom, prenom, email`,
      [
        data.nom || 'Nouveau Contact',
        data.prenom || '',
        data.email || null,
        data.telephone || null,
        'prospect'
      ]
    );
    
    console.log(`✅ Contact créé: ${result.rows[0].id}`);
    return result.rows[0];
  }

  async createTemporaryContact() {
    const result = await this.pool.query(
      `INSERT INTO "${this.userSchema}".contacts 
       (nom, type_contact, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING id`,
      ['Client Temporaire', 'prospect']
    );
    
    return result.rows[0];
  }

  // ==================== ANALYSE D'INTENTION ====================

  analyzeIntent(message) {
    const lower = message.toLowerCase();
    
    const patterns = {
      purchase: ['commander', 'acheter', 'je veux', 'je prends', 'commande', 'achat','avoir','intéressé'],
      product: ['produit', 'article', 'item', 'modèle', 'référence', 'quel produit','voir vos produits'],
      price: ['prix', 'combien coûte', 'tarif', 'coût'],
      document: ['devis', 'facture', 'document', 'pdf', 'proposition'],
      hours: ['heure', 'ouvert', 'horaires', 'fermé'],
      support: ['aide', 'problème', 'souci', 'bug', 'erreur'],
      greeting: ['bonjour', 'salut', 'hello', 'coucou','cc','slt','salam'],
      goodbye: ['au revoir', 'bye', 'à bientôt', 'merci']
    };
    
    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return {
          type,
          confidence: 0.8,
          requiresAction: ['purchase', 'product', 'price', 'document'].includes(type)
        };
      }
    }
    
    return { type: 'general', confidence: 0.5, requiresAction: false };
  }

  // ==================== GÉNÉRATION DE RÉPONSE ====================

  async generateResponse(message, intent, contactId) {
    switch (intent.type) {
      case 'purchase':
        return await this.generatePurchaseResponse(message);
      case 'product':
        return await this.generateProductResponse(message);
      case 'price':
        return "Nos prix varient selon les produits. Pourriez-vous me dire quel produit vous intéresse ?";
      case 'document':
        return "Je peux vous générer un devis ou une facture. Avez-vous déjà une commande ?";
      case 'hours':
        return `Nos horaires d'ouverture :
🕘 Lundi - Vendredi: 9h00 - 18h00
🕙 Samedi: 10h00 - 16h00
🚫 Dimanche: Fermé`;
      case 'support':
        return "Je suis désolé pour ce problème. Un technicien va vous contacter rapidement.";
      case 'greeting':
        return "Bonjour ! Comment puis-je vous aider aujourd'hui ?";
      case 'goodbye':
        return "Merci et à bientôt !";
      default:
        return "Je ne suis pas sûr de comprendre. Pourriez-vous reformuler votre demande ?";
    }
  }

  async generatePurchaseResponse(message) {
    // Recherche produits simples
    const products = await this.searchProductsInMessage(message);
    
    if (products.length > 0) {
      const product = products[0];
      return `Parfait ! Je vois que vous voulez commander ${product.nom}.
💰 Prix: ${product.prix}€
📦 Stock: ${product.stock} unités disponibles

Souhaitez-vous procéder à la commande ?`;
    }
    
    return "Je vois que vous souhaitez commander. Pourriez-vous me préciser quel produit vous intéresse ?";
  }

  async generateProductResponse(message) {
    const products = await this.searchProductsInMessage(message);
    
    if (products.length > 0) {
      const product = products[0];
      return `Voici les informations pour ${product.nom} :
💰 Prix: ${product.prix}€
📦 Stock: ${product.stock} unités disponibles

Souhaitez-vous en commander ?`;
    }
    
    // Lister quelques produits
    const result = await this.pool.query(
      `SELECT nom, prix FROM "${this.userSchema}".produits 
       WHERE actif = true 
       ORDER BY nom 
       LIMIT 3`
    );
    
    if (result.rows.length === 0) {
      return "Nous n'avons pas de produits disponibles pour le moment.";
    }
    
    let response = "Voici quelques produits disponibles :\n";
    result.rows.forEach(p => {
      response += `• ${p.nom} - ${p.prix}€\n`;
    });
    response += "\nLequel vous intéresse ?";
    
    return response;
  }

  async searchProductsInMessage(message) {
    const result = await this.pool.query(
      `SELECT id, nom, prix, stock FROM "${this.userSchema}".produits WHERE actif = true`
    );
    
    const lowerMessage = message.toLowerCase();
    return result.rows.filter(product => 
      lowerMessage.includes(product.nom.toLowerCase())
    );
  }

  // ==================== UTILITAIRES ====================

  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\sàâäéèêëîïôöùûüç]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS_FR.includes(word));
  }

  stemWord(word) {
    const suffixes = ['s', 'es', 'e', 'é', 'er', 'ir', 'oir'];
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  async saveConversation(contactId, message, response, intent) {
    try {
      await this.pool.query(
        `INSERT INTO "${this.userSchema}".conversation_history 
         (contact_id, message_text, message_type, ai_response, 
          response_type, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          contactId,
          message,
          'user',
          response,
          'ai_generated'
        ]
      );
    } catch (error) {
      console.error('❌ Erreur sauvegarde conversation:', error);
    }
  }

  async updateContact(contactId, data) {
    // Simple mise à jour
    if (data.nom || data.email) {
      await this.pool.query(
        `UPDATE "${this.userSchema}".contacts 
         SET nom = COALESCE($1, nom), 
             email = COALESCE($2, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [data.nom, data.email, contactId]
      );
    }
  }

  // Méthodes basiques supplémentaires
  async getClientProfile(contactId) {
    const result = await this.pool.query(
      `SELECT * FROM "${this.userSchema}".client_profiles WHERE contact_id = $1`,
      [contactId]
    );
    return result.rows[0] || null;
  }

  async createOrder(contactId, productId, quantity) {
    const product = await this.pool.query(
      `SELECT prix FROM "${this.userSchema}".produits WHERE id = $1`,
      [productId]
    );
    
    if (product.rows.length === 0) throw new Error('Produit non trouvé');
    
    const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const total = product.rows[0].prix * quantity;
    
    const order = await this.pool.query(
      `INSERT INTO "${this.userSchema}".commandes 
       (numero_commande, contact_id, total, statut, date)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING id, numero_commande, total`,
      [
        orderNumber,
        contactId,
        total,
        'en attente'
      ]
    );
    
    // Ligne de commande
    await this.pool.query(
      `INSERT INTO "${this.userSchema}".lignes_commande 
       (commande_id, produit_id, quantite, prix_unitaire)
       VALUES ($1, $2, $3, $4)`,
      [
        order.rows[0].id,
        productId,
        quantity,
        product.rows[0].prix
      ]
    );
    
    console.log(`✅ Commande créée: ${order.rows[0].numero_commande}`);
    return order.rows[0];
  }
}

module.exports = IACRMMotor;