const express = require('express');
const router = express.Router();

// Fonction utilitaire pour vérifier si une table existe
async function checkTableExists(pool, schema, table) {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      )`,
      [schema, table]
    );
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

// Fonction utilitaire pour s'assurer que la table user_settings existe
async function ensureUserSettingsTable(pool, schema, userId) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        preferences JSONB DEFAULT '{}',
        ui_settings JSONB DEFAULT '{}',
        notification_settings JSONB DEFAULT '{}',
        export_settings JSONB DEFAULT '{}',
        automation_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Créer l'entrée si elle n'existe pas
    await pool.query(
      `INSERT INTO "${schema}".user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    
  } catch (error) {
    console.error('❌ Erreur création table user_settings:', error);
  }
}

// ==================== ROUTES PRINCIPALES ====================

// GET /api/users/:id - Récupérer les informations utilisateur
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userSchema = req.userSchema || `user_${userId}`;
    
    console.log(`🔍 Récupération utilisateur ${userId} dans schéma ${userSchema}`);
    
    // Récupérer depuis la table users globale
    const userResult = await req.app.locals.pool.query(
      'SELECT id, email, name, role, created_at, last_login FROM public.users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    const user = userResult.rows[0];
    
    // Récupérer les informations supplémentaires du schéma utilisateur
    let phone = '';
    let department = 'Général';
    
    try {
      const settingsResult = await req.app.locals.pool.query(
        `SELECT preferences FROM "${userSchema}".user_settings WHERE user_id = $1`,
        [userId]
      );
      
      if (settingsResult.rows.length > 0 && settingsResult.rows[0].preferences) {
        const prefs = settingsResult.rows[0].preferences;
        phone = prefs.phone || '';
        department = prefs.department || 'Général';
      }
    } catch (error) {
      console.error('⚠️ Erreur récupération préférences:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.name,
        phone: phone,
        role: user.role,
        department: department,
        createdAt: user.created_at
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// PUT /api/users/:id - Mettre à jour les informations utilisateur
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, phone, role, department } = req.body;
    
    console.log(`✏️ Mise à jour utilisateur ${userId}:`, { name, email });
    
    // Vérifier que l'utilisateur met à jour son propre profil
    if (parseInt(userId) !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorisé'
      });
    }
    
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }
    
    if (email !== undefined) {
        // Vérifier si l'email existe déjà pour un autre utilisateur
        const emailCheck = await req.app.locals.pool.query(
            'SELECT id FROM public.users WHERE email = $1 AND id != $2',
            [email, userId]
        );
        
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({
            success: false,
            error: 'Cet email est déjà utilisé par un autre compte'
            });
        }
        
        updateFields.push(`email = $${paramIndex}`);
        updateValues.push(email);
        paramIndex++;
        }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucune donnée à mettre à jour'
      });
    }
    
    updateValues.push(userId);
    
    const query = `
      UPDATE public.users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, created_at, last_login
    `;
    
    const result = await req.app.locals.pool.query(query, updateValues);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    const updatedUser = result.rows[0];
    
    // Mettre à jour les infos dans le schéma utilisateur si nécessaire
    if (phone || department) {
      try {
        const userSchema = `user_${userId}`;
        await ensureUserSettingsTable(req.app.locals.pool, userSchema, userId);
        
        await req.app.locals.pool.query(
          `INSERT INTO "${userSchema}".user_settings (user_id, preferences)
           VALUES ($1, $2)
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             preferences = jsonb_set(
               COALESCE(user_settings.preferences, '{}'::jsonb),
               '{profile}',
               $2::jsonb
             ),
             updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            JSON.stringify({ phone, department })
          ]
        );
      } catch (error) {
        console.error('⚠️ Erreur mise à jour settings:', error.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        createdAt: updatedUser.created_at,
        lastLogin: updatedUser.last_login
      },
      message: 'Profil mis à jour avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur mise à jour utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// ==================== ROUTES STATISTIQUES ====================

// GET /api/users/me/stats - Statistiques pour l'utilisateur connecté
router.get('/me/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const userSchema = req.userSchema || `user_${userId}`;
    
    console.log(`📊 Statistiques pour utilisateur connecté ${userId}`);
    
    let totalConversations = 0;
    let activeConversations = 0;
    let totalMessages = 0;
    let lastActivity = null;
    let automationEnabled = true;
    
    try {
      // Vérifier si la table conversations existe
      const conversationsExists = await checkTableExists(req.app.locals.pool, userSchema, 'conversations');
      
      if (conversationsExists) {
        // Récupérer les conversations
        const conversationsResult = await req.app.locals.pool.query(
          `SELECT COUNT(*) as total,
                  COUNT(CASE WHEN statut = 'active' THEN 1 END) as active,
                  MAX(derniere_interaction) as last_interaction
           FROM "${userSchema}".conversations`
        );
        
        totalConversations = parseInt(conversationsResult.rows[0].total) || 0;
        activeConversations = parseInt(conversationsResult.rows[0].active) || 0;
        lastActivity = conversationsResult.rows[0].last_interaction;
        
        // Récupérer les messages
        const messagesResult = await req.app.locals.pool.query(
          `SELECT COUNT(*) as total FROM "${userSchema}".messages`
        );
        totalMessages = parseInt(messagesResult.rows[0].total) || 0;
      }
      
      // Vérifier les paramètres d'automation
      const settingsResult = await req.app.locals.pool.query(
        `SELECT automation_enabled FROM "${userSchema}".user_settings WHERE user_id = $1`,
        [userId]
      );
      
      if (settingsResult.rows.length > 0) {
        automationEnabled = settingsResult.rows[0].automation_enabled !== false;
      }
      
    } catch (error) {
      console.error('⚠️ Erreur statistiques:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        totalConversations,
        activeConversations,
        totalMessages,
        lastActivity,
        automationEnabled
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur stats utilisateur connecté:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// GET /api/users/:id/stats - Statistiques utilisateur
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = req.params.id;
    const userSchema = req.userSchema || `user_${userId}`;
    
    console.log(`📊 Statistiques pour utilisateur ${userId}`);
    
    let totalConversations = 0;
    let activeConversations = 0;
    let totalMessages = 0;
    let lastActivity = null;
    let automationEnabled = true;
    
    try {
      // Vérifier si la table conversations existe
      const conversationsExists = await checkTableExists(req.app.locals.pool, userSchema, 'conversations');
      
      if (conversationsExists) {
        // Récupérer les conversations
        const conversationsResult = await req.app.locals.pool.query(
          `SELECT COUNT(*) as total,
                  COUNT(CASE WHEN statut = 'active' THEN 1 END) as active,
                  MAX(derniere_interaction) as last_interaction
           FROM "${userSchema}".conversations`
        );
        
        totalConversations = parseInt(conversationsResult.rows[0].total) || 0;
        activeConversations = parseInt(conversationsResult.rows[0].active) || 0;
        lastActivity = conversationsResult.rows[0].last_interaction;
        
        // Récupérer les messages
        const messagesResult = await req.app.locals.pool.query(
          `SELECT COUNT(*) as total FROM "${userSchema}".messages`
        );
        totalMessages = parseInt(messagesResult.rows[0].total) || 0;
      }
      
      // Vérifier les paramètres d'automation
      const settingsResult = await req.app.locals.pool.query(
        `SELECT automation_enabled FROM "${userSchema}".user_settings WHERE user_id = $1`,
        [userId]
      );
      
      if (settingsResult.rows.length > 0) {
        automationEnabled = settingsResult.rows[0].automation_enabled !== false;
      }
      
    } catch (error) {
      console.error('⚠️ Erreur statistiques:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        totalConversations,
        activeConversations,
        totalMessages,
        lastActivity,
        automationEnabled
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur statistiques utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;