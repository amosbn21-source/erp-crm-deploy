const express = require('express');
const router = express.Router();

// GET /api/automation/settings - Récupérer les paramètres automation
router.get('/settings', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    
    console.log(`⚙️ Récupération paramètres automation pour ${userSchema}`);
    
    // Vérifier si la table existe
    const tableExists = await checkTableExists(req.app.locals.pool, userSchema, 'automation_settings');
    
    if (!tableExists) {
      // Retourner des paramètres par défaut
      return res.json({
        success: true,
        data: getDefaultAutomationSettings()
      });
    }
    
    const result = await req.app.locals.pool.query(
      `SELECT * FROM "${userSchema}".automation_settings 
       WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: getDefaultAutomationSettings()
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération paramètres automation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// POST /api/automation/settings - Sauvegarder les paramètres automation
router.post('/settings', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const settings = req.body;
    
    console.log(`💾 Sauvegarde paramètres automation pour ${userSchema}`);
    
    // Créer la table si elle n'existe pas
    await ensureAutomationSettingsTable(req.app.locals.pool, userSchema);
    
    const result = await req.app.locals.pool.query(
      `INSERT INTO "${userSchema}".automation_settings 
       (user_id, auto_responder, auto_create_contacts, auto_update_conversations, 
        auto_process_orders, auto_generate_quotes, working_hours_only, 
        working_hours_start, working_hours_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         auto_responder = EXCLUDED.auto_responder,
         auto_create_contacts = EXCLUDED.auto_create_contacts,
         auto_update_conversations = EXCLUDED.auto_update_conversations,
         auto_process_orders = EXCLUDED.auto_process_orders,
         auto_generate_quotes = EXCLUDED.auto_generate_quotes,
         working_hours_only = EXCLUDED.working_hours_only,
         working_hours_start = EXCLUDED.working_hours_start,
         working_hours_end = EXCLUDED.working_hours_end,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        settings.autoResponder !== false,
        settings.autoCreateContacts !== false,
        settings.autoUpdateConversations !== false,
        settings.autoProcessOrders !== false,
        settings.autoGenerateQuotes || false,
        settings.workingHoursOnly || false,
        settings.workingHoursStart || '08:00',
        settings.workingHoursEnd || '18:00'
      ]
    );
    
    // Mettre à jour également dans user_settings
    try {
      await req.app.locals.pool.query(
        `UPDATE "${userSchema}".user_settings 
         SET automation_enabled = true,
             preferences = jsonb_set(
               COALESCE(preferences, '{}'::jsonb), 
               '{automation}', 
               $1::jsonb
             )
         WHERE user_id = $2`,
        [JSON.stringify(settings), userId]
      );
    } catch (error) {
      console.error('⚠️ Erreur mise à jour user_settings:', error.message);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Paramètres automation sauvegardés'
    });
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde paramètres automation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// POST /api/automation/toggle - Activer/désactiver l'automation
router.post('/toggle', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const { enabled } = req.body;
    
    console.log(`🔌 ${enabled ? 'Activation' : 'Désactivation'} automation pour ${userSchema}`);
    
    // Mettre à jour dans user_settings
    await req.app.locals.pool.query(
      `INSERT INTO "${userSchema}".user_settings (user_id, automation_enabled)
       VALUES ($1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET automation_enabled = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, enabled !== false]
    );
    
    // Mettre à jour également dans automation_settings si la table existe
    try {
      await req.app.locals.pool.query(
        `UPDATE "${userSchema}".automation_settings 
         SET updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );
    } catch (error) {
      // La table peut ne pas exister, c'est normal
    }
    
    res.json({
      success: true,
      data: { enabled: enabled !== false },
      message: `Automation ${enabled ? 'activée' : 'désactivée'} avec succès`
    });
    
  } catch (error) {
    console.error('❌ Erreur toggle automation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Fonctions utilitaires
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

function getDefaultAutomationSettings() {
  return {
    autoResponder: true,
    autoCreateContacts: true,
    autoUpdateConversations: true,
    autoProcessOrders: true,
    autoGenerateQuotes: false,
    workingHoursOnly: false,
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00'
  };
}

async function ensureAutomationSettingsTable(pool, schema) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".automation_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        auto_responder BOOLEAN DEFAULT true,
        auto_create_contacts BOOLEAN DEFAULT true,
        auto_update_conversations BOOLEAN DEFAULT true,
        auto_process_orders BOOLEAN DEFAULT true,
        auto_generate_quotes BOOLEAN DEFAULT false,
        working_hours_only BOOLEAN DEFAULT false,
        working_hours_start TIME DEFAULT '08:00',
        working_hours_end TIME DEFAULT '18:00',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
      )
    `);
    
    console.log(`✅ Table automation_settings créée/vérifiée pour ${schema}`);
    
  } catch (error) {
    console.error(`❌ Erreur création table automation_settings pour ${schema}:`, error);
  }
}

module.exports = router;