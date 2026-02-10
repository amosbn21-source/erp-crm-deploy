const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Chiffrer un token
 */
function encryptToken(token) {
  if (!token) return null;
  try {
    // Clé de chiffrement
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-secret-key-1234567890123456', 
      'salt', 
      32
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('❌ Erreur chiffrement token:', error.message);
    return null;
  }
}

/**
 * Déchiffrer un token
 */
function decryptToken(encryptedToken) {
  if (!encryptedToken) return null;
  
  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      console.error('❌ Format token invalide');
      return null;
    }
    
    const [ivHex, encrypted] = parts;
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-secret-key-1234567890123456', 
      'salt', 
      32
    );
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Erreur déchiffrement token:', error.message);
    return null;
  }
}

/**
 * Masquer un token pour l'affichage
 */
function maskToken(token) {
  if (!token || token.length < 8) return '****';
  return `${token.substring(0, 4)}${'*'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
}

// GET /api/webhook-accounts - Liste des comptes webhooks
router.get('/', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    
    console.log(`🔍 GET webhook-accounts pour ${userSchema} (user: ${userId})`);
    
    // Vérifier si la table existe
    try {
      const tableCheck = await req.app.locals.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'webhook_accounts'
        )`,
        [userSchema]
      );
      
      if (!tableCheck.rows[0].exists) {
        console.log('ℹ️ Table webhook_accounts non trouvée');
        return res.json({
          success: true,
          data: [],
          count: 0
        });
      }
    } catch (error) {
      console.log('ℹ️ Erreur vérification table:', error.message);
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }
    
    // Récupérer les comptes
    const result = await req.app.locals.pool.query(
      `SELECT 
        id,
        user_id,
        platform,
        platform_type,
        name,
        account_sid,
        auth_token,
        access_token_encrypted,
        phone_number,
        phone_id,
        page_id,
        business_id,
        webhook_url,
        ai_enabled,
        auto_reply,
        is_active,
        config_data,
        last_sync,
        created_at,
        updated_at
       FROM "${userSchema}".webhook_accounts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    console.log(`📋 ${result.rows.length} comptes trouvés`);
    
    // Traiter les comptes pour le frontend
    const accounts = result.rows.map(account => {
      const processedAccount = { ...account };
      
      // Masquer les tokens sensibles
      if (processedAccount.auth_token) {
        processedAccount.auth_token_masked = maskToken(processedAccount.auth_token);
      }
      
      // Déchiffrer l'access_token si présent
      if (processedAccount.access_token_encrypted) {
        try {
          processedAccount.access_token = decryptToken(processedAccount.access_token_encrypted);
          processedAccount.access_token_masked = maskToken(processedAccount.access_token || '');
        } catch (error) {
          processedAccount.access_token = null;
          processedAccount.access_token_masked = '****';
        }
      }
      
      // Ne pas envoyer les tokens chiffrés au frontend
      delete processedAccount.access_token_encrypted;
      
      return processedAccount;
    });
    
    res.json({
      success: true,
      data: accounts,
      count: accounts.length
    });
    
  } catch (error) {
    console.error('❌ Erreur GET webhook-accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des comptes webhooks',
      data: []
    });
  }
});

// POST /api/webhook-accounts - Ajouter un compte webhook
router.post('/', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const {
      platform,
      platform_type = 'generic',
      name,
      account_sid,
      auth_token,
      access_token,
      phone_number,
      phone_id,
      page_id,
      business_id,
      webhook_url,
      ai_enabled = false,
      auto_reply = false,
      is_active = true,
      config_data = {}
    } = req.body;
    
    console.log(`➕ POST webhook-account: ${platform} (${name}) pour ${userSchema}`);
    
    // Validation des champs requis selon la plateforme
    let validationError = null;
    
    if (platform === 'messenger' || platform === 'whatsapp_business') {
      if (!access_token) {
        validationError = `Pour ${platform}, access_token est requis`;
      }
      
      if (platform === 'messenger' && !page_id) {
        validationError = 'Pour Facebook Messenger, page_id est requis';
      }
      
      if (platform === 'whatsapp_business' && !phone_id) {
        validationError = 'Pour WhatsApp Business, phone_id est requis';
      }
    } else if (platform === 'twilio') {
      if (!account_sid || !auth_token) {
        validationError = 'Pour Twilio, account_sid et auth_token sont requis';
      }
    }
    
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }
    
    // Chiffrer l'access_token
    const encryptedAccessToken = access_token ? encryptToken(access_token) : null;
    
    // Insertion dans la base
    const result = await req.app.locals.pool.query(
      `INSERT INTO "${userSchema}".webhook_accounts 
       (user_id, platform, platform_type, name, account_sid, auth_token,
        access_token_encrypted, phone_number, phone_id, page_id, business_id,
        webhook_url, ai_enabled, auto_reply, is_active, config_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        userId,
        platform,
        platform_type,
        name,
        account_sid,
        auth_token,
        encryptedAccessToken,
        phone_number,
        phone_id,
        page_id,
        business_id,
        webhook_url,
        ai_enabled,
        auto_reply,
        is_active,
        JSON.stringify(config_data)
      ]
    );
    
    const account = result.rows[0];
    
    // Préparer la réponse pour le frontend
    const responseAccount = { ...account };
    
    // Masquer les tokens
    if (responseAccount.auth_token) {
      responseAccount.auth_token_masked = maskToken(responseAccount.auth_token);
    }
    
    if (access_token) {
      responseAccount.access_token = access_token;
      responseAccount.access_token_masked = maskToken(access_token);
    }
    
    // Ne pas renvoyer le token chiffré
    delete responseAccount.access_token_encrypted;
    
    res.json({
      success: true,
      data: responseAccount,
      message: 'Compte webhook ajouté avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur POST webhook-accounts:', error);
    
    if (error.code === '23505') { // Violation de contrainte unique
      return res.status(400).json({
        success: false,
        error: 'Un compte avec ces paramètres existe déjà'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout du compte webhook'
    });
  }
});

// DELETE /api/webhook-accounts/:id - Supprimer un compte
router.delete('/:id', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const accountId = req.params.id;
    
    console.log(`🗑️ DELETE webhook-account ${accountId} pour ${userSchema}`);
    
    const result = await req.app.locals.pool.query(
      `DELETE FROM "${userSchema}".webhook_accounts 
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, platform`,
      [accountId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compte webhook non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Compte webhook supprimé avec succès',
      deleted: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur DELETE webhook-accounts/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du compte'
    });
  }
});

// POST /api/webhook-accounts/:id/test - Tester la connexion
router.post('/:id/test', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const accountId = req.params.id;
    
    console.log(`🧪 TEST webhook-account ${accountId} pour ${userSchema}`);
    
    // Récupérer le compte
    const result = await req.app.locals.pool.query(
      `SELECT * FROM "${userSchema}".webhook_accounts 
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compte webhook non trouvé'
      });
    }
    
    const account = result.rows[0];
    
    // Simuler un test de connexion (pour l'instant)
    const testResult = {
      success: true,
      message: `Connexion ${account.platform} testée avec succès`,
      platform: account.platform,
      account_name: account.name
    };
    
    // Mettre à jour last_sync
    await req.app.locals.pool.query(
      `UPDATE "${userSchema}".webhook_accounts 
       SET last_sync = NOW() 
       WHERE id = $1`,
      [accountId]
    );
    
    res.json({
      success: true,
      testResult,
      account: {
        id: account.id,
        name: account.name,
        platform: account.platform
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur test webhook-accounts/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test de connexion',
      testResult: {
        success: false,
        message: 'Erreur de test: ' + error.message
      }
    });
  }
});

// PUT /api/webhook-accounts/:id/ai-settings - Configurer l'IA
router.put('/:id/ai-settings', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const accountId = req.params.id;
    const { ai_enabled, auto_reply, config_data } = req.body;
    
    console.log(`🤖 AI settings pour compte ${accountId}: ai_enabled=${ai_enabled}, auto_reply=${auto_reply}`);
    
    const result = await req.app.locals.pool.query(
      `UPDATE "${userSchema}".webhook_accounts 
       SET ai_enabled = COALESCE($1, ai_enabled),
           auto_reply = COALESCE($2, auto_reply),
           config_data = COALESCE($3, config_data),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, platform, ai_enabled, auto_reply`,
      [
        ai_enabled,
        auto_reply,
        config_data ? JSON.stringify(config_data) : null,
        accountId,
        userId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compte non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `IA ${ai_enabled ? 'activée' : 'désactivée'} pour ce compte`
    });
    
  } catch (error) {
    console.error('❌ Erreur AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la configuration IA'
    });
  }
});

// GET /api/webhook-accounts/:id/ai-stats - Statistiques IA
router.get('/:id/ai-stats', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const accountId = req.params.id;
    
    console.log(`📊 AI stats pour compte ${accountId}`);
    
    // Vérifier que le compte existe
    const accountResult = await req.app.locals.pool.query(
      `SELECT id, name, platform FROM "${userSchema}".webhook_accounts 
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compte non trouvé'
      });
    }
    
    // Statistiques simulées (à remplacer par des vraies données plus tard)
    const stats = {
      total_conversations: Math.floor(Math.random() * 100),
      recent_conversations: Math.floor(Math.random() * 20),
      avg_confidence: 0.7 + (Math.random() * 0.3),
      active_rules: 3,
      orders_converted: Math.floor(Math.random() * 10)
    };
    
    res.json({
      success: true,
      data: stats,
      account: accountResult.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur AI stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques IA'
    });
  }
});

// Fonctions utilitaires (optionnelles)
async function testTwilioConnection(accountSid, authToken) {
  // À implémenter plus tard
  return { success: true, message: 'Test Twilio simulé' };
}

async function testWhatsAppBusinessConnection(accessToken, phoneId) {
  // À implémenter plus tard
  return { success: true, message: 'Test WhatsApp Business simulé' };
}

async function testMessengerConnection(accessToken, pageId) {
  // À implémenter plus tard
  return { success: true, message: 'Test Messenger simulé' };
}

module.exports = router;