const express = require('express');
const router = express.Router();

// GET /api/users/me/stats - Statistiques personnelles de l'utilisateur
router.get('/users/me/stats', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    
    console.log(`👤 GET user stats pour ${userSchema} (user: ${userId})`);
    
    // 1. Total des conversations
    let totalConversations = 0;
    let activeConversations = 0;
    
    try {
      const conversationsQuery = await req.app.locals.pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
         FROM "${userSchema}".conversations
         WHERE user_id = $1`,
        [userId]
      );
      
      if (conversationsQuery.rows.length > 0) {
        totalConversations = parseInt(conversationsQuery.rows[0].total) || 0;
        activeConversations = parseInt(conversationsQuery.rows[0].active) || 0;
      }
    } catch (error) {
      console.log('ℹ️ Table conversations non trouvée:', error.message);
    }
    
    // 2. Total des messages
    let totalMessages = 0;
    
    try {
      const messagesQuery = await req.app.locals.pool.query(
        `SELECT COUNT(*) as total
         FROM "${userSchema}".messages
         WHERE user_id = $1`,
        [userId]
      );
      
      if (messagesQuery.rows.length > 0) {
        totalMessages = parseInt(messagesQuery.rows[0].total) || 0;
      }
    } catch (error) {
      console.log('ℹ️ Table messages non trouvée:', error.message);
    }
    
    // 3. Dernière activité
    let lastActivity = null;
    
    try {
      const lastActivityQuery = await req.app.locals.pool.query(
        `SELECT MAX(created_at) as last_activity
         FROM "${userSchema}".messages
         WHERE user_id = $1`,
        [userId]
      );
      
      if (lastActivityQuery.rows.length > 0 && lastActivityQuery.rows[0].last_activity) {
        lastActivity = lastActivityQuery.rows[0].last_activity;
      }
    } catch (error) {
      console.log('ℹ️ Erreur récupération dernière activité:', error.message);
    }
    
    // 4. Pages Facebook connectées
    let facebookPages = 0;
    let facebookConnected = false;
    
    try {
      const facebookQuery = await req.app.locals.pool.query(
        `SELECT COUNT(*) as count
         FROM "${userSchema}".webhook_accounts
         WHERE user_id = $1 AND platform = 'facebook_messenger' AND is_active = true`,
        [userId]
      );
      
      if (facebookQuery.rows.length > 0) {
        facebookPages = parseInt(facebookQuery.rows[0].count) || 0;
        facebookConnected = facebookPages > 0;
      }
    } catch (error) {
      console.log('ℹ️ Erreur récupération pages Facebook:', error.message);
    }
    
    // 5. Automation activée
    let automationEnabled = true; // Par défaut
    
    try {
      const automationQuery = await req.app.locals.pool.query(
        `SELECT value
         FROM "${userSchema}".user_settings
         WHERE user_id = $1 AND setting_key = 'automation_enabled'`,
        [userId]
      );
      
      if (automationQuery.rows.length > 0) {
        automationEnabled = automationQuery.rows[0].value === 'true';
      }
    } catch (error) {
      console.log('ℹ️ Erreur récupération paramètres automation:', error.message);
    }
    
    // 6. Statistiques IA
    let aiStats = {
      total_conversations: 0,
      orders_converted: 0,
      active_rules: 0,
      avg_intent_confidence: 0,
      clients_profiled: 0
    };
    
    try {
      const aiStatsQuery = await req.app.locals.pool.query(
        `SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN order_converted = true THEN 1 END) as orders_converted,
          COUNT(DISTINCT rule_id) as active_rules,
          COALESCE(AVG(intent_confidence), 0) as avg_intent_confidence,
          COUNT(DISTINCT contact_id) as clients_profiled
         FROM "${userSchema}".ai_conversations
         WHERE user_id = $1`,
        [userId]
      );
      
      if (aiStatsQuery.rows.length > 0) {
        aiStats = {
          total_conversations: parseInt(aiStatsQuery.rows[0].total_conversations) || 0,
          orders_converted: parseInt(aiStatsQuery.rows[0].orders_converted) || 0,
          active_rules: parseInt(aiStatsQuery.rows[0].active_rules) || 0,
          avg_intent_confidence: parseFloat(aiStatsQuery.rows[0].avg_intent_confidence) || 0,
          clients_profiled: parseInt(aiStatsQuery.rows[0].clients_profiled) || 0
        };
      }
    } catch (error) {
      console.log('ℹ️ Table ai_conversations non trouvée:', error.message);
    }
    
    // 7. Webhooks et comptes
    let totalWebhookAccounts = 0;
    let activeWebhookAccounts = 0;
    
    try {
      const webhooksQuery = await req.app.locals.pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active
         FROM "${userSchema}".webhook_accounts
         WHERE user_id = $1`,
        [userId]
      );
      
      if (webhooksQuery.rows.length > 0) {
        totalWebhookAccounts = parseInt(webhooksQuery.rows[0].total) || 0;
        activeWebhookAccounts = parseInt(webhooksQuery.rows[0].active) || 0;
      }
    } catch (error) {
      console.log('ℹ️ Erreur récupération webhooks:', error.message);
    }
    
    // Formater la réponse
    const stats = {
      totalConversations,
      activeConversations,
      totalMessages,
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      automationEnabled,
      facebookConnected,
      facebookPages,
      totalWebhookAccounts,
      activeWebhookAccounts,
      aiStats
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur GET /users/me/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques utilisateur',
      data: {
        totalConversations: 0,
        activeConversations: 0,
        totalMessages: 0,
        lastActivity: null,
        automationEnabled: true,
        facebookConnected: false,
        facebookPages: 0,
        totalWebhookAccounts: 0,
        activeWebhookAccounts: 0
      }
    });
  }
});

module.exports = router;