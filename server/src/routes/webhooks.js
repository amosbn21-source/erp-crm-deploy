

// src/routes/webhooks.js - VERSION SANS IA
const express = require('express');
const axios = require('axios');
const router = express.Router();
const twilio = require('twilio');
const pool = require('../config/db-pg');


// Configuration
const FB_GRAPH = process.env.FB_GRAPH || 'https://graph.facebook.com/v19.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const MESSENGER_TOKEN = process.env.MESSENGER_TOKEN || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID; 
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN; 
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM;



let IACRMMotor;
try {
  IACRMMotor = require('../ia/ia-engine');
  console.log('✅ Moteur IA chargé avec succès');
} catch (error) {
  console.warn('⚠️ Moteur IA non disponible, seule la version basique fonctionnera');
  IACRMMotor = class DummyIAMotor {
    async processMessage() {
      return { success: false, error: 'IA non disponible' };
    }
  };
}

// Client Twilio (initialiser après la vérification)
let clientTwilio;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  clientTwilio = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else {
  console.warn('⚠️ Tokens Twilio manquants');
  clientTwilio = null;
}

let twilioAccount = null;

/**
 * Middleware pour initialiser l'IA pour l'utilisateur
 */
const initializeIAForWebhook = async (req, res, next) => {
  try {
    // Récupérer l'ID utilisateur depuis l'URL du webhook
    const userId = req.params.userId || extractUserIdFromWebhook(req);
    
    if (!userId) {
      console.warn('⚠️  Impossible de déterminer l\'utilisateur pour le webhook');
      return next();
    }
    
    // Créer le schéma utilisateur
    const userSchema = `user_${userId}`;
    req.userSchema = userSchema;
    
    // Initialiser le moteur IA pour cet utilisateur
    if (!req.iaMotor) {
      req.iaMotor = new IACRMMotor(
        req.app.locals.pool,
        userSchema,
        userId
      );
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Erreur initialisation IA:', error);
    next();
  }
};

/**
 * Traiter un message avec l'IA
 */
const processWithAI = async (account, messageData, userId) => {
  try {
    console.log(`🤖 Traitement IA pour compte ${account.id}`);
    
    // Vérifier si l'IA est activée pour ce compte
    if (!account.ai_enabled) {
      console.log('⏭️  IA non activée pour ce compte');
      return null;
    }
    
    // Initialiser le moteur IA
    const iaMotor = new IACRMMotor(
      req.app.locals.pool,
      `user_${userId}`,
      userId
    );
    
    // Identifier ou créer le contact
    const contact = await findOrCreateContactForMessage(account, messageData, userId);
    
    if (!contact) {
      console.error('❌ Impossible de créer le contact');
      return null;
    }
    
    // Traiter le message avec l'IA
    const aiResponse = await iaMotor.processMessage(
      contact.id,
      messageData.text || messageData.body
    );
    
    return aiResponse;
    
  } catch (error) {
    console.error('❌ Erreur traitement IA:', error);
    return null;
  }
};

/**
 * Trouver ou créer un contact pour un message
 */
const findOrCreateContactForMessage = async (account, messageData, userId) => {
  try {
    const userSchema = `user_${userId}`;
    const from = messageData.from || messageData.senderId;
    
    if (!from) {
      console.warn('⚠️  Impossible d\'identifier l\'expéditeur');
      return null;
    }
    
    // Chercher le contact existant
    const contactResult = await req.app.locals.pool.query(`
      SELECT * FROM "${userSchema}".contacts 
      WHERE (telephone = $1 OR email = $2 OR compte = $3)
      LIMIT 1
    `, [from, from, from]);
    
    if (contactResult.rows.length > 0) {
      return contactResult.rows[0];
    }
    
    // Créer un nouveau contact
    const newContact = await req.app.locals.pool.query(`
      INSERT INTO "${userSchema}".contacts 
      (nom, prenom, telephone, email, compte, type_contact, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [
      'Client ' + account.platform,
      'Utilisateur',
      account.platform === 'whatsapp' ? from : null,
      null,
      account.platform === 'messenger' ? from : null,
      'client'
    ]);
    
    return newContact.rows[0];
    
  } catch (error) {
    console.error('❌ Erreur création contact:', error);
    return null;
  }
};

const requireAuth = (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    next();
};

/* ===========================
   UTILITAIRES
   =========================== */

// Fonction pour parser JSON en toute sécurité
function safeJsonParse(str, defaultValue = {}) {
  if (!str) return defaultValue;
  if (typeof str === 'object') return str;
  
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('⚠️ Erreur JSON parse, utilisation valeur par défaut:', e.message);
    return defaultValue;
  }
}

/**
 * Trouver un compte par numéro de téléphone
 */
async function findAccountByPhone(phone, req) {
  try {
    // Nettoyer le numéro
    const cleanPhone = phone.replace('whatsapp:', '').replace(/[^\d+]/g, '');
    
    console.log(`🔍 Recherche compte pour: ${cleanPhone}`);
    
    // Recherche dans tous les schémas d'utilisateurs
    const schemasResult = await pool.query(`
      SELECT u.id as user_id, u.schema_name 
      FROM public.users u
      WHERE u.schema_name IS NOT NULL
      ORDER BY u.id
    `);
    
    const allSchemas = schemasResult.rows.map(row => ({
      schema: row.schema_name,
      user_id: row.user_id
    }));
    
    // Ajouter le schéma public
    allSchemas.unshift({ schema: 'public', user_id: 0 });
    
    for (const { schema, user_id } of allSchemas) {
      try {
        // Vérifier si la table webhook_accounts existe dans ce schéma
        const tableExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = 'webhook_accounts'
          )
        `, [schema]);
        
        if (!tableExists.rows[0].exists) {
          continue;
        }
        
        // Recherche par numéro de téléphone (exact ou partiel)
        const result = await pool.query(`
          SELECT 
            wa.*,
            $1 as schema_name,
            $2 as user_id
          FROM "${schema}".webhook_accounts wa
          WHERE (
            -- Numéro exact
            wa.phone_number = $3 
            -- Numéro sans le +
            OR REPLACE(wa.phone_number, '+', '') = REPLACE($3, '+', '')
            -- Numéro contenu dans le message
            OR $3 LIKE '%' || REPLACE(wa.phone_number, '+', '') || '%'
            -- Numéro du compte contenu dans le numéro reçu
            OR REPLACE(wa.phone_number, '+', '') LIKE '%' || REPLACE($3, '+', '') || '%'
          )
            AND wa.is_active = true
            AND (
              wa.platform = 'twilio'
              OR wa.platform = 'twilio_whatsapp'
              OR wa.platform = 'whatsapp'
              OR wa.platform = 'sms'
            )
          ORDER BY 
            -- Priorité: numéro exact
            CASE WHEN wa.phone_number = $3 THEN 0
                 WHEN REPLACE(wa.phone_number, '+', '') = REPLACE($3, '+', '') THEN 1
                 ELSE 2
            END,
            -- Priorité: WhatsApp avant SMS
            CASE WHEN wa.platform LIKE '%whatsapp%' THEN 0 ELSE 1 END
          LIMIT 1
        `, [schema, user_id, cleanPhone]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Compte trouvé dans ${schema}: ${result.rows[0].name}`);
          return result.rows[0];
        }
        
      } catch (schemaError) {
        // Erreur d'accès au schéma, continuer avec le suivant
        console.debug(`⚠️  Schéma ${schema} inaccessible:`, schemaError.message);
        continue;
      }
    }
    
    console.log(`❌ Aucun compte trouvé pour ${cleanPhone}`);
    return null;
    
  } catch (error) {
    console.error('❌ Erreur recherche compte:', error.message);
    return null;
  }
}

/**
 * Trouver un compte Twilio par numéro de téléphone
 */
async function findAccountByPhoneTwilio(phone, req) {
  try {
    // Nettoyer le numéro
    const cleanPhone = phone.replace('whatsapp:', '').replace(/[^\d+]/g, '');
    
    console.log(`🔍 Recherche compte Twilio pour: ${cleanPhone}`);
    
    // Recherche dans tous les schémas d'utilisateurs
    const schemasResult = await pool.query(`
      SELECT schema_name 
      FROM public.users 
      WHERE schema_name IS NOT NULL
    `);
    
    const allSchemas = schemasResult.rows.map(row => row.schema_name);
    
    // Ajouter le schéma public
    allSchemas.unshift('public');
    
    for (const schema of allSchemas) {
      try {
        // Recherche par numéro de téléphone
        const result = await pool.query(`
          SELECT 
            wa.*,
            $1 as schema_name,
            wa.user_id
          FROM "${schema}".webhook_accounts wa
          WHERE (
            wa.phone_number LIKE $2 
            OR $2 LIKE '%' || REPLACE(wa.phone_number, '+', '') || '%'
          )
            AND wa.is_active = true
            AND wa.platform IN ('twilio', 'twilio_whatsapp', 'whatsapp')
            AND wa.account_sid IS NOT NULL
          LIMIT 1
        `, [schema, `%${cleanPhone}%`]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Compte Twilio trouvé dans ${schema}: ${result.rows[0].name}`);
          return result.rows[0];
        }
        
        // Recherche par SID du message (pour les réponses)
        if (req.body?.AccountSid) {
          const sidResult = await pool.query(`
            SELECT 
              wa.*,
              $1 as schema_name,
              wa.user_id
            FROM "${schema}".webhook_accounts wa
            WHERE wa.account_sid = $2
              AND wa.is_active = true
            LIMIT 1
          `, [schema, req.body.AccountSid]);
          
          if (sidResult.rows.length > 0) {
            console.log(`✅ Compte Twilio trouvé par SID: ${sidResult.rows[0].name}`);
            return sidResult.rows[0];
          }
        }
        
      } catch (schemaError) {
        // Table peut ne pas exister dans ce schéma, continuer
        continue;
      }
    }
    
    console.log(`❌ Aucun compte Twilio trouvé pour ${cleanPhone}`);
    return null;
    
  } catch (error) {
    console.error('❌ Erreur recherche compte Twilio:', error.message);
    return null;
  }
}

/**
 * Trouver un compte WhatsApp Business
 */
async function findAccountByPhoneBusiness(phone, req) {
  try {
    console.log(`🔍 Recherche compte WhatsApp Business pour: ${phone}`);
    
    const schemasResult = await pool.query(`
      SELECT u.id as user_id, u.schema_name 
      FROM public.users u
      WHERE u.schema_name IS NOT NULL
    `);
    
    for (const row of schemasResult.rows) {
      try {
        const result = await pool.query(`
          SELECT 
            wa.*,
            $1 as schema_name,
            $2 as user_id
          FROM "${row.schema_name}".webhook_accounts wa
          WHERE wa.platform = 'whatsapp_business'
            AND wa.is_active = true
            AND wa.phone_id IS NOT NULL
          LIMIT 1
        `, [row.schema_name, row.user_id]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Compte WhatsApp Business trouvé: ${result.rows[0].name}`);
          return result.rows[0];
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Erreur recherche compte WhatsApp Business:', error.message);
    return null;
  }
}


/**
 * Mettre à jour les statistiques d'utilisation Twilio
 */
async function updateTwilioUsageStats(schemaName, accountId, channel) {
  try {
    const fieldName = channel === 'whatsapp' ? 'whatsapp_messages' : 'sms_messages';
    
    await pool.query(`
      UPDATE "${schemaName}".webhook_accounts 
      SET config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{twilio_stats, ${fieldName}}',
        COALESCE((config_data->'twilio_stats'->>'${fieldName}')::int, 0) + 1
      ),
      config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{twilio_stats, last_${channel}_used}',
        to_jsonb(NOW())
      ),
      last_sync = NOW()
      WHERE id = $1
    `, [accountId]);
    
    console.log(`📊 Statistiques Twilio ${channel} mises à jour`);
    
  } catch (error) {
    console.error('❌ Erreur mise à jour stats Twilio:', error.message);
  }
}

/**
 * Sauvegarder une conversation IA
 */
async function saveIAConversation(schemaName, data) {
  try {
    await pool.query(`
      INSERT INTO "${schemaName}".conversation_history 
      (contact_id, message_text, message_type, ai_response, response_type, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      data.contact_id,
      data.message_text,
      'incoming',
      data.ai_response,
      'ai_generated',
      JSON.stringify({
        account_id: data.account_id,
        platform: data.platform,
        confidence_score: data.confidence_score,
        source: 'whatsapp_webhook'
      })
    ]);
    
    console.log(`💾 Conversation IA sauvegardée dans ${schemaName}`);
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde conversation IA:', error.message);
  }
}

/**
 * Sauvegarder une conversation basique
 */
async function saveBasicConversation(schemaName, data) {
  try {
    // Vérifier si la table messages existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'messages'
      )
    `, [schemaName]);
    
    if (tableExists.rows[0].exists) {
      await pool.query(`
        INSERT INTO "${schemaName}".messages 
        (contact_id, type, contenu, metadata, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        data.contact_id,
        'incoming',
        data.message_text,
        JSON.stringify({
          account_id: data.account_id,
          source: data.source,
          response: data.response
        })
      ]);
      
      console.log(`💾 Conversation basique sauvegardée`);
    }
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde conversation basique:', error.message);
  }
}


/**
 * Sauvegarder une conversation avec information du compte
 */
async function saveBasicConversationWithAccount(schemaName, data) {
  try {
    // Vérifier si la table messages existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'messages'
      )
    `, [schemaName]);
    
    if (tableExists.rows[0].exists) {
      await pool.query(`
        INSERT INTO "${schemaName}".messages 
        (contact_id, type, contenu, metadata, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        data.contact_id,
        'outgoing',
        data.response,
        JSON.stringify({
          account_id: data.account_id,
          original_message: data.message_text,
          intent: data.intent,
          channel: data.channel,
          source: data.source
        })
      ]);
      
      // Sauvegarder aussi le message entrant
      await pool.query(`
        INSERT INTO "${schemaName}".messages 
        (contact_id, type, contenu, metadata, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        data.contact_id,
        'incoming',
        data.message_text,
        JSON.stringify({
          account_id: data.account_id,
          channel: data.channel,
          source: data.source
        })
      ]);
      
      console.log(`💾 Conversation sauvegardée avec compte ${data.account_id}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde conversation avec compte:', error.message);
  }
}

/**
 * Mettre à jour les statistiques IA
 */
async function updateAIStats(schemaName, accountId, confidence) {
  try {
    // Incrémenter le compteur d'utilisation
    await pool.query(`
      UPDATE "${schemaName}".webhook_accounts 
      SET config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{ai_stats, usage_count}',
        COALESCE((config_data->'ai_stats'->>'usage_count')::int, 0) + 1
      ),
      config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{ai_stats, last_used}',
        to_jsonb(NOW())
      ),
      last_sync = NOW()
      WHERE id = $1
    `, [accountId]);
    
    console.log(`📊 Statistiques IA mises à jour pour compte ${accountId}`);
    
  } catch (error) {
    console.error('❌ Erreur mise à jour stats IA:', error.message);
  }
}

/**
 * Envoi de fallback via Twilio
 */
async function sendTwilioFallback(account, to, message) {
  try {
    const twilio = require('twilio');
    const client = twilio(account.account_sid, account.auth_token);
    
    await client.messages.create({
      from: account.phone_number,
      to: to,
      body: message.substring(0, 1600) // Limite Twilio
    });
    
    console.log('✅ Fallback Twilio envoyé');
    
  } catch (error) {
    console.error('❌ Erreur fallback Twilio:', error.message);
    throw error;
  }
}

/**
 * Envoyer un WhatsApp avec le compte spécifique de l'utilisateur
 */
async function sendWhatsAppWithUserAccount(account, to, message, contactId) {
  try {
    console.log(`📤 Envoi WhatsApp avec compte utilisateur: ${account.name}`);
    
    const client = require('twilio')(account.account_sid, account.auth_token);
    
    // Formater les numéros
    let formattedTo = to;
    if (!formattedTo.includes('whatsapp:')) {
      formattedTo = `whatsapp:${formattedTo.replace('whatsapp:', '')}`;
    }
    
    let formattedFrom = account.phone_number;
    if (!formattedFrom.includes('whatsapp:')) {
      formattedFrom = `whatsapp:${formattedFrom}`;
    }
    
    // Vérifier la session WhatsApp
    const withinWindow = await whatsAppSessionManager.isWithin24HourWindow(contactId);
    
    if (!withinWindow) {
      console.warn('⚠️  Hors fenêtre des 24h - risque erreur 63015');
      
      // Ajouter une note au message
      message += '\n\n💡 Votre session WhatsApp a expiré. Répondez "Bonjour" pour la renouveler.';
    }
    
    const twilioMessage = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      body: message.substring(0, 4000)
    });
    
    console.log(`✅ WhatsApp envoyé avec compte utilisateur, SID: ${twilioMessage.sid}`);
    
    // Mettre à jour les statistiques du compte
    await updateAccountMessageStats(account.schema_name, account.id, 'whatsapp_sent');
    
    return twilioMessage;
    
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp avec compte utilisateur:', error.message);
    
    // Fallback au compte Twilio par défaut
    if (error.code === 20003 || error.code === 20404) {
      // Invalid credentials or account not found
      console.log('🔄 Fallback au compte Twilio par défaut');
      return await sendTwilioWhatsApp(to, message);
    }
    
    throw error;
  }
}

/**
 * Envoyer un SMS avec le compte spécifique de l'utilisateur
 */
async function sendSmsWithUserAccount(account, to, message) {
  try {
    console.log(`📤 Envoi SMS avec compte utilisateur: ${account.name}`);
    
    const client = require('twilio')(account.account_sid, account.auth_token);
    
    const twilioMessage = await client.messages.create({
      from: account.phone_number,
      to: to,
      body: message.substring(0, 1600)
    });
    
    console.log(`✅ SMS envoyé avec compte utilisateur, SID: ${twilioMessage.sid}`);
    
    // Mettre à jour les statistiques du compte
    await updateAccountMessageStats(account.schema_name, account.id, 'sms_sent');
    
    return twilioMessage;
    
  } catch (error) {
    console.error('❌ Erreur envoi SMS avec compte utilisateur:', error.message);
    
    // Fallback au compte Twilio par défaut
    if (error.code === 20003 || error.code === 20404) {
      console.log('🔄 Fallback au compte Twilio par défaut');
      return await sendTwilioSms(to, message);
    }
    
    throw error;
  }
}

/**
 * Mettre à jour les statistiques du système basique
 */
async function updateBasicSystemStats(schemaName, accountId, channel, intentAction) {
  try {
    const statsField = `${channel}_messages`;
    const intentField = `intent_${intentAction}`;
    
    await pool.query(`
      UPDATE "${schemaName}".webhook_accounts 
      SET config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{basic_stats, ${statsField}}',
        COALESCE((config_data->'basic_stats'->>'${statsField}')::int, 0) + 1
      ),
      config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{basic_stats, ${intentField}}',
        COALESCE((config_data->'basic_stats'->>'${intentField}')::int, 0) + 1
      ),
      config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{basic_stats, last_activity}',
        to_jsonb(NOW())
      ),
      updated_at = NOW()
      WHERE id = $1
    `, [accountId]);
    
    console.log(`📊 Statistiques basiques mises à jour pour ${channel}: ${intentAction}`);
    
  } catch (error) {
    console.error('❌ Erreur mise à jour stats basiques:', error.message);
  }
}

/**
 * Mettre à jour les statistiques de messages du compte
 */
async function updateAccountMessageStats(schemaName, accountId, statType) {
  try {
    await pool.query(`
      UPDATE "${schemaName}".webhook_accounts 
      SET config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{message_stats, ${statType}}',
        COALESCE((config_data->'message_stats'->>'${statType}')::int, 0) + 1
      ),
      config_data = jsonb_set(
        COALESCE(config_data, '{}'::jsonb),
        '{message_stats, last_message_sent}',
        to_jsonb(NOW())
      )
      WHERE id = $1
    `, [accountId]);
    
  } catch (error) {
    console.error('❌ Erreur mise à jour stats messages:', error.message);
  }
}

/**
 * Déterminer si une intervention humaine est nécessaire
 */
function shouldEscalateToHuman(intent) {
  // Intentions qui nécessitent une intervention humaine
  const humanInterventionIntents = [
    'urgent_help',
    'complaint',
    'refund_request',
    'technical_issue',
    'billing_dispute'
  ];
  
  // Messages contenant des mots-clés urgents
  const urgentKeywords = [
    'urgence',
    'urgent',
    'problème grave',
    'insatisfait',
    'mécontent',
    'remboursement',
    'plainte',
    'réclamation'
  ];
  
  // Vérifier l'intention
  if (humanInterventionIntents.includes(intent.action)) {
    return true;
  }
  
  // Vérifier la confiance (trop basse)
  if (intent.confidence < 0.3) {
    return true;
  }
  
  return false;
}

/**
 * Notifier qu'une intervention humaine est nécessaire
 */
async function notifyHumanInterventionNeeded(account, contactId, contactName, message, intentAnalysis) {
  try {
    if (!account) return;
    
    const schemaName = account.schema_name || `user_${account.user_id}`;
    
    // Créer une notification dans la table notifications de l'utilisateur
    await pool.query(`
      INSERT INTO "${schemaName}".notifications 
      (user_id, type, title, message, priority, action_url, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      account.user_id,
      'human_intervention',
      `Intervention humaine requise - ${contactName}`,
      `Le client ${contactName} a envoyé un message nécessitant une intervention humaine.\n\nMessage: ${message.substring(0, 200)}...\n\nIntention détectée: ${intentAnalysis.intent.action} (confiance: ${intentAnalysis.intent.confidence})`,
      'high',
      `/contacts/${contactId}`,
      JSON.stringify({
        contact_id: contactId,
        contact_name: contactName,
        original_message: message,
        intent: intentAnalysis.intent,
        account_id: account.id,
        timestamp: new Date().toISOString()
      })
    ]);
    
    console.log(`🚨 Notification d'intervention humaine créée pour ${contactName}`);
    
  } catch (error) {
    console.error('❌ Erreur création notification intervention humaine:', error.message);
  }
}

/**
 * Fonction utilitaire pour nettoyer les numéros de téléphone
 */
function cleanPhoneNumber(phone) {
  return phone.replace('whatsapp:', '').replace(/[^\d+]/g, '');
}

/**
 * Traitement d'un message SANS IA (système basique)
 * Utilisé comme fallback quand l'IA n'est pas disponible ou désactivée
 */
async function processWithoutAI(req, res, body, from, channel) {
  try {
    console.log(`🔄 Traitement sans IA (${channel}) pour: ${from}`);
    
    // ==================== ÉTAPE 1 : IDENTIFIER LE COMPTE UTILISATEUR ====================
    let account = null;
    let userId = null;
    let userSchema = null;
    
    // Rechercher le compte associé au numéro
    if (channel === 'whatsapp' || channel === 'sms') {
      account = await findAccountByPhone(from, req);
    } else if (channel === 'whatsapp_business') {
      account = await findAccountByPhoneBusiness(from, req);
    }
    
    if (account) {
      userId = account.user_id;
      userSchema = account.schema_name || `user_${userId}`;
      console.log(`📋 Compte trouvé: ${account.name} (User: ${userId})`);
    }

    // ==================== ÉTAPE 2 : GESTION DU CONTACT ====================
    const { contactId, contactName } = await ensureContact(pool, channel, from);
    
    if (!contactId) {
      console.error('❌ Impossible de créer/récupérer le contact');
      return res.status(500).send('Contact error');
    }
    
    console.log(`👤 Contact: ${contactId} (${contactName})`);

    // ==================== ÉTAPE 3 : ANALYSE DU MESSAGE ====================
    const intentAnalysis = await executionManager.intentManager.analyzeMessage(
      body, 
      contactId, 
      channel
    );
    
    console.log(`🎯 Intention détectée:`, {
      action: intentAnalysis.intent.action,
      confidence: intentAnalysis.intent.confidence,
      source: intentAnalysis.intent.source,
      isVirtual: intentAnalysis.isVirtual || false
    });

    // ==================== ÉTAPE 4 : EXÉCUTION DE L'INTENTION ====================
    const reply = await executionManager.executeIntent(
      contactId, 
      intentAnalysis, 
      channel, 
      body
    );
    
    console.log(`📤 Réponse générée (${reply.length} caractères): ${reply.substring(0, 100)}...`);

    // ==================== ÉTAPE 5 : SAUVEGARDE DE LA CONVERSATION ====================
    if (userId && userSchema) {
      await saveBasicConversationWithAccount(userSchema, {
        contact_id: contactId,
        account_id: account.id,
        message_text: body,
        response: reply,
        intent: intentAnalysis.intent,
        channel: channel,
        source: 'basic_system'
      });
    } else {
      // Sauvegarde dans le schéma public si pas de compte utilisateur
      await saveBasicConversation('public', {
        contact_id: contactId,
        message_text: body,
        response: reply,
        channel: channel,
        source: 'basic_system_no_account'
      });
    }

    // ==================== ÉTAPE 6 : ENVOI DE LA RÉPONSE ====================
    let sendResult = null;
    
    switch (channel) {
      case 'whatsapp':
        if (account && account.account_sid && account.auth_token) {
          // Utiliser le compte Twilio spécifique de l'utilisateur
          sendResult = await sendWhatsAppWithUserAccount(account, from, reply, contactId);
        } else {
          // Utiliser le compte Twilio par défaut
          sendResult = await sendTwilioWhatsApp(from, reply);
        }
        break;
        
      case 'sms':
        if (account && account.account_sid && account.auth_token) {
          sendResult = await sendSmsWithUserAccount(account, from, reply);
        } else {
          sendResult = await sendTwilioSms(from, reply);
        }
        break;
        
      case 'whatsapp_business':
        sendResult = await notifyWhatsApp(from, reply);
        break;
        
      default:
        console.warn(`⚠️  Canal non supporté: ${channel}`);
        return res.status(400).send('Channel not supported');
    }

    // ==================== ÉTAPE 7 : MISE À JOUR DES STATISTIQUES ====================
    if (account) {
      await updateBasicSystemStats(userSchema, account.id, channel, intentAnalysis.intent.action);
    }

    // ==================== ÉTAPE 8 : NOTIFICATION SI BESOIN D'INTERVENTION HUMAINE ====================
    if (shouldEscalateToHuman(intentAnalysis.intent)) {
      await notifyHumanInterventionNeeded(account, contactId, contactName, body, intentAnalysis);
    }

    console.log(`✅ Traitement sans IA terminé pour ${from}`);
    return res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Erreur dans processWithoutAI:', error.message, error.stack);
    
    // Envoyer un message d'erreur générique
    try {
      const errorMessage = `Désolé, une erreur technique est survenue. Notre équipe en a été informée.`;
      
      if (channel === 'whatsapp' || channel === 'sms') {
        await sendTwilioWhatsApp(from, errorMessage);
      } else if (channel === 'whatsapp_business') {
        await notifyWhatsApp(from, errorMessage);
      }
    } catch (sendError) {
      console.error('❌ Impossible d\'envoyer le message d\'erreur:', sendError.message);
    }
    
    // Toujours répondre OK pour éviter les retries
    return res.status(200).send('OK');
  }
}





/* ===========================
   GESTIONNAIRE DE SESSION WHATSAPP
   =========================== */

class WhatsAppSessionManager {
  constructor(dbPool) {
    this.db = dbPool;
    this.sessions = new Map(); // Cache des sessions actives
  }
  
  async isWithin24HourWindow(contactId) {
    const client = await this.db.connect();
    try {
      const result = await client.query(
        `SELECT MAX("createdAt") as last_message 
         FROM "Messages" 
         WHERE "contactId" = $1 
           AND type = 'incoming'`,
        [contactId]
      );
      
      if (result.rows[0] && result.rows[0].last_message) {
        const lastMessageTime = new Date(result.rows[0].last_message);
        const now = new Date();
        const hoursDiff = (now - lastMessageTime) / (1000 * 60 * 60);
        
        console.log(`⏰ Dernier message: ${lastMessageTime}, Diff: ${hoursDiff.toFixed(2)}h`);
        return hoursDiff <= 24;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Erreur vérification session:', error.message);
      return false;
    } finally {
      client.release();
    }
  }
  
  async sendWithSessionCheck(to, message, contactId) {
    const withinWindow = await this.isWithin24HourWindow(contactId);
    
    if (!withinWindow) {
      console.warn('⚠️  Hors fenêtre des 24h - risque erreur 63015');
      console.log('💡 Tentative d\'envoi normal (peut échouer)');
      
      // Essayer quand même, mais avec gestion d'erreur améliorée
      try {
        return await sendTwilioWhatsApp(to, message);
      } catch (error) {
        if (error.code === 63015) {
          console.error('❌ ERREUR 63015 confirmée - Session expirée');
          return await this.handleExpiredSession(to, message, contactId);
        }
        throw error;
      }
    }
    
    // Dans la fenêtre des 24h, envoyer normalement
    return await sendTwilioWhatsApp(to, message);
  }
  
  async handleExpiredSession(to, message, contactId) {
    console.log('🔧 Gestion session expirée pour contact:', contactId);
    
    // Option 1: Essayer d'envoyer un SMS à la place
    try {
      const cleanTo = to.replace('whatsapp:', '');
      const smsMessage = `Pharmacie: ${message.substring(0, 100)}...\n\n`
        + `(Votre session WhatsApp a expiré. Répondez "Bonjour" dans WhatsApp pour la renouveler.)`;
      
      console.log('📱 Tentative d\'envoi SMS fallback');
      return await sendTwilioSms(cleanTo, smsMessage);
      
    } catch (smsError) {
      console.error('❌ Échec SMS fallback:', smsError.message);
      
      // Option 2: Logger l'erreur pour suivi
      await this.logSessionError(contactId, '63015', 'Session WhatsApp expirée');
      
      throw new Error('Session WhatsApp expirée et SMS fallback échoué');
    }
  }
  
  async logSessionError(contactId, errorCode, errorMessage) {
    const client = await this.db.connect();
    try {
      await client.query(
        `INSERT INTO "SessionErrors" 
         ("contactId", error_code, error_message, "createdAt")
         VALUES ($1, $2, $3, NOW())`,
        [contactId, errorCode, errorMessage]
      );
    } catch (error) {
      console.error('❌ Erreur log session:', error.message);
    } finally {
      client.release();
    }
  }
}

/* ===========================
   GESTIONNAIRE DE CONTACT
   =========================== */

async function ensureContact(dbPool, channel, externalId) {
  const client = await dbPool.connect();
  
  try {
    console.log(`👤 Recherche contact: canal=${channel}, id=${externalId}`);
    
    if (channel === 'whatsapp' || channel === 'sms') {
      const cleanPhone = cleanPhoneNumber(externalId);
      
      const q = await client.query(
        'SELECT id, nom, prenom FROM "Contacts" WHERE telephone = $1 LIMIT 1', 
        [cleanPhone]
      );
      
      if (q.rows.length > 0) {
        const contact = q.rows[0];
        console.log(`✅ Contact existant trouvé: ${contact.id} - ${contact.prenom} ${contact.nom}`);
        return { 
          contactId: contact.id, 
          contactName: contact.prenom || contact.nom || 'Utilisateur' 
        };
      }

      console.log(`📝 Création nouveau contact WhatsApp/SMS: ${cleanPhone}`);
      const ins = await client.query(
        `INSERT INTO "Contacts" (nom, prenom, telephone, "createdAt", "updatedAt", "typeContact")
         VALUES ($1, $2, $3, NOW(), NOW(), $4)
         RETURNING id, nom, prenom`,
        ['Client WhatsApp', 'Utilisateur', cleanPhone, 'prospect']
      );
      
      const newContact = ins.rows[0];
      return { 
        contactId: newContact.id, 
        contactName: newContact.prenom || newContact.nom || 'Utilisateur' 
      };
    }

    if (channel === 'messenger') {
      const q = await client.query(
        'SELECT id, nom, prenom FROM "Contacts" WHERE compte = $1 LIMIT 1', 
        [externalId]
      );
      
      if (q.rows.length > 0) {
        const contact = q.rows[0];
        console.log(`✅ Contact Messenger existant trouvé: ${contact.id}`);
        return { 
          contactId: contact.id, 
          contactName: contact.prenom || contact.nom || 'Utilisateur' 
        };
      }

      console.log(`📝 Création nouveau contact Messenger: ${externalId}`);
      const ins = await client.query(
        `INSERT INTO "Contacts" (nom, prenom, compte, "createdAt", "updatedAt", "typeContact")
         VALUES ($1, $2, $3, NOW(), NOW(), $4)
         RETURNING id, nom, prenom`,
        ['Client Messenger', 'Utilisateur', externalId, 'prospect']
      );
      
      const newContact = ins.rows[0];
      return { 
        contactId: newContact.id, 
        contactName: newContact.prenom || newContact.nom || 'Utilisateur' 
      };
    }

    throw new Error(`Canal inconnu: ${channel}`);
    
  } catch (error) {
    console.error('❌ Erreur ensureContact:', error.message);
    // Retourner un contact par défaut pour éviter de bloquer
    return { 
      contactId: 0, 
      contactName: 'Utilisateur' 
    };
  } finally {
    client.release();
  }
}

/* ===========================
   GESTIONNAIRE DE CONVERSATION
   =========================== */

class ConversationManager {
  constructor(dbPool) {
    this.db = dbPool;
  }

  async getOrCreateConversation(contactId, channel) {
    const client = await this.db.connect();
    
    try {
      console.log(`💬 Recherche conversation: contact=${contactId}, canal=${channel}`);
      
      // D'abord vérifier si la table existe
      const tableExists = await this.checkTableExists('Conversations');
      if (!tableExists) {
        console.warn('⚠️ Table Conversations non trouvée, création conversation virtuelle');
        return this.createVirtualConversation(contactId, channel);
      }
      
      // Rechercher une conversation active (moins de 24h)
      const query = await client.query(
        `SELECT id, contexte, "derniereInteraction", statut 
         FROM "Conversations" 
         WHERE "contactId" = $1 
           AND canal = $2 
           AND "derniereInteraction" > NOW() - INTERVAL '24 hours'
           AND statut = 'active'
         ORDER BY "derniereInteraction" DESC 
         LIMIT 1`,
        [contactId, channel]
      );

      if (query.rows.length > 0) {
        const conv = query.rows[0];
        console.log(`✅ Conversation existante trouvée: ${conv.id}`);
        
        // Parser le contexte en toute sécurité
        let context = {};
        if (conv.contexte) {
          context = safeJsonParse(conv.contexte);
        }
        
        // Mettre à jour la dernière interaction
        await client.query(
          `UPDATE "Conversations" 
           SET "derniereInteraction" = NOW(), "updatedAt" = NOW()
           WHERE id = $1`,
          [conv.id]
        );
        
        return {
          id: conv.id,
          contexte: context,
          derniereInteraction: conv.derniereInteraction,
          statut: conv.statut
        };
      }

      console.log(`📝 Création nouvelle conversation pour contact ${contactId}`);
      
      // Créer une nouvelle conversation
      const newContext = { 
        step: 'welcome', 
        data: {},
        createdAt: new Date().toISOString()
      };
      
      const insert = await client.query(
        `INSERT INTO "Conversations" 
         ("contactId", canal, contexte, "derniereInteraction", statut, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), 'active', NOW(), NOW())
         RETURNING id, contexte, "derniereInteraction", statut`,
        [contactId, channel, JSON.stringify(newContext)]
      );

      const newConv = insert.rows[0];
      console.log(`✅ Nouvelle conversation créée: ${newConv.id}`);
      
      return {
        id: newConv.id,
        contexte: newContext,
        derniereInteraction: newConv.derniereInteraction,
        statut: newConv.statut
      };
      
    } catch (error) {
      console.error('❌ Erreur getOrCreateConversation:', error.message);
      // Retourner une conversation virtuelle en cas d'erreur
      return this.createVirtualConversation(contactId, channel);
    } finally {
      client.release();
    }
  }

  async updateConversationContext(conversationId, newContext) {
    if (!conversationId) {
      console.warn('⚠️ updateConversationContext: ID manquant');
      return;
    }
    
    const client = await this.db.connect();
    try {
      await client.query(
        `UPDATE "Conversations" 
         SET contexte = $1, "updatedAt" = NOW() 
         WHERE id = $2`,
        [JSON.stringify(newContext), conversationId]
      );
      console.log(`📝 Contexte conversation ${conversationId} mis à jour`);
    } catch (error) {
      console.error('❌ Erreur updateConversationContext:', error.message);
    } finally {
      client.release();
    }
  }

  async saveMessage(conversationId, contactId, type, content) {
    if (!conversationId) {
      console.warn('⚠️ saveMessage: ID conversation manquant');
      return;
    }
    
    const client = await this.db.connect();
    try {
      // Vérifier si la table Messages existe
      const tableExists = await this.checkTableExists('Messages');
      if (!tableExists) {
        console.warn('⚠️ Table Messages non trouvée, skip sauvegarde');
        return;
      }
      
      await client.query(
        `INSERT INTO "Messages" 
         ("conversationId", "contactId", type, contenu, "createdAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        [conversationId, contactId, type, content]
      );
      console.log(`💾 Message sauvegardé: ${type} pour conversation ${conversationId}`);
    } catch (error) {
      console.error('❌ Erreur saveMessage:', error.message);
    } finally {
      client.release();
    }
  }

  async checkTableExists(tableName) {
    const client = await this.db.connect();
    try {
      await client.query(`SELECT 1 FROM "${tableName}" LIMIT 1`);
      return true;
    } catch (error) {
      return false;
    } finally {
      client.release();
    }
  }

  createVirtualConversation(contactId, channel) {
    console.log(`🔄 Création conversation virtuelle pour contact ${contactId}`);
    return {
      id: `virtual_${contactId}_${channel}_${Date.now()}`,
      contexte: { step: 'welcome', data: {} },
      derniereInteraction: new Date(),
      statut: 'active',
      isVirtual: true
    };
  }
}

/* ===========================
   GESTIONNAIRE D'INTENTIONS BASIQUE
   =========================== */

class IntentManager {
  constructor(dbPool) {
    this.db = dbPool;
    this.conversationManager = new ConversationManager(dbPool);
  }

  async analyzeMessage(message, contactId, channel) {
    console.log(`🔍 Analyse message: "${message.substring(0, 100)}..."`);
    
    try {
      // Récupérer ou créer la conversation
      const conversation = await this.conversationManager.getOrCreateConversation(contactId, channel);
      
      const context = conversation.contexte || {};
      
      // Détecter l'intention
      let detectedIntent = this.detectIntent(message);
      
      // Mettre à jour le contexte
      context.lastMessage = message;
      context.lastUpdate = new Date().toISOString();
      context.messageCount = (context.messageCount || 0) + 1;
      
      // Sauvegarder seulement si ce n'est pas une conversation virtuelle
      if (!conversation.isVirtual && conversation.id) {
        await this.conversationManager.updateConversationContext(conversation.id, context);
        await this.conversationManager.saveMessage(
          conversation.id, 
          contactId, 
          'incoming', 
          message
        );
      }
      
      console.log(`🎯 Intention détectée: ${detectedIntent.action}`);
      
      return {
        intent: detectedIntent,
        context: context,
        conversationId: conversation.id,
        isVirtual: conversation.isVirtual || false
      };
      
    } catch (error) {
      console.error('❌ Erreur analyzeMessage:', error.message);
      
      // Retourner une intention par défaut en cas d'erreur
      return {
        intent: {
          action: 'unknown',
          data: {},
          confidence: 0.1,
          source: 'error_fallback'
        },
        context: {},
        conversationId: null,
        isVirtual: true
      };
    }
  }

  detectIntent(message) {
    const messageLower = message.toLowerCase().trim();
    
    // Détection par patterns simples
    const patterns = [
      {
        regex: /(bonjour|salut|coucou|hello|hi|yo|bonsoir|hey)/i,
        action: 'greeting',
        confidence: 0.95
      },
      {
        regex: /(aide|help|sos|que peux-tu|tu fais quoi|fonctionnalités)/i,
        action: 'help',
        confidence: 0.9
      },
      {
        regex: /(catalogue|produits?|articles?|voir.*produit|liste.*produit)/i,
        action: 'list_products',
        confidence: 0.85
      },
      {
        regex: /(commander|acheter|prendre|je veux|je voudrais|achetons)/i,
        action: 'create_order',
        confidence: 0.8,
        extractor: (msg) => this.extractOrderDetails(msg)
      },
      {
        regex: /(statut|suivre|où en est|ma commande|commande.*\d+)/i,
        action: 'track_order',
        confidence: 0.75,
        extractor: (msg) => {
          const match = msg.match(/\d+/);
          return { orderId: match ? parseInt(match[0]) : null };
        }
      },
      {
        regex: /(devis|prix|combien.*coûte|tarif)/i,
        action: 'generate_quote',
        confidence: 0.7
      },
      {
        regex: /(facture|reçu|paiement|payer)/i,
        action: 'generate_invoice',
        confidence: 0.7
      },
      {
        regex: /(merci|ok|d'accord|parfait|super)/i,
        action: 'acknowledge',
        confidence: 0.9
      },
      {
        regex: /(au revoir|bye|à plus|ciao)/i,
        action: 'goodbye',
        confidence: 0.95
      }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(messageLower)) {
        const intent = {
          action: pattern.action,
          confidence: pattern.confidence,
          source: 'pattern'
        };
        
        if (pattern.extractor) {
          intent.data = pattern.extractor(message);
        }
        
        return intent;
      }
    }
    
    return {
      action: 'unknown',
      confidence: 0.1,
      source: 'no_pattern_match'
    };
  }

  extractOrderDetails(message) {
    // Extraire le produit et la quantité du message
    const productKeywords = [
      'paracétamol', 'doliprane', 'ibuprofène', 'advil', 'vitamine', 
      'masque', 'gel', 'sirop', 'antibiotique', 'antidouleur',
      'médicament', 'produit', 'article'
    ];
    
    let produit = null;
    let quantite = 1;
    
    // Chercher un produit
    for (const keyword of productKeywords) {
      if (message.toLowerCase().includes(keyword)) {
        produit = keyword;
        break;
      }
    }
    
    // Chercher une quantité
    const qtyMatch = message.match(/(\d+)\s*(boîte|boite|pack|unité|pièce|s|x)?/i);
    if (qtyMatch) {
      quantite = parseInt(qtyMatch[1]);
    }
    
    return {
      produit: produit,
      quantite: quantite,
      message: message.substring(0, 100)
    };
  }
}

/* ===========================
   GESTIONNAIRE D'EXÉCUTION
   =========================== */

class ExecutionManager {
  constructor(dbPool) {
    this.db = dbPool;
    this.intentManager = new IntentManager(dbPool);
  }

  async executeIntent(contactId, intentAnalysis, channel, originalMessage) {
    const { intent, context, conversationId } = intentAnalysis;
    
    console.log(`🚀 Exécution intention: ${intent.action} pour contact ${contactId}`);
    
    try {
      // Récupérer les infos du contact
      const client = await this.db.connect();
      const contactResult = await client.query(
        `SELECT nom, prenom, telephone, email 
         FROM "Contacts" 
         WHERE id = $1`,
        [contactId]
      );
      client.release();
      
      const contact = contactResult.rows[0] || { 
        prenom: 'Utilisateur', 
        nom: 'Client' 
      };
      
      const contactName = contact.prenom || contact.nom || 'cher client';
      
      // Exécuter l'action appropriée
      let response;
      switch (intent.action) {
        case 'greeting':
          response = await this.handleGreeting(contact, contactName);
          break;
          
        case 'list_products':
          response = await this.handleListProducts();
          break;
          
        case 'create_order':
          response = await this.handleCreateOrder(contactId, intent.data, contactName);
          break;
          
        case 'track_order':
          response = await this.handleTrackOrder(contactId, intent.data);
          break;
          
        case 'generate_quote':
          response = await this.handleGenerateQuote(contactId, intent.data, contactName);
          break;
          
        case 'generate_invoice':
          response = await this.handleGenerateInvoice(contactId, intent.data);
          break;
          
        case 'help':
          response = this.handleHelp();
          break;
          
        case 'acknowledge':
          response = this.handleAcknowledge(contactName);
          break;
          
        case 'goodbye':
          response = this.handleGoodbye(contactName);
          break;
          
        default:
          response = await this.handleUnknown(contactId, contactName, originalMessage);
      }
      
      // Sauvegarder la réponse si conversation réelle
      if (conversationId && !intentAnalysis.isVirtual) {
        await this.intentManager.conversationManager.saveMessage(
          conversationId, 
          contactId, 
          'outgoing', 
          response
        );
      }
      
      console.log(`📤 Réponse générée (${response.length} caractères)`);
      return response;
      
    } catch (error) {
      console.error('❌ Erreur executeIntent:', error.message);
      return this.handleError(contactId, error);
    }
  }

  async handleGreeting(contact, contactName) {
    const client = await this.db.connect();
    
    try {
      // Vérifier si c'est un client existant
      const orderCountResult = await client.query(
        `SELECT COUNT(*) as count FROM "Commandes" WHERE "contactId" = $1`,
        [contact.id || 0]
      );
      
      const orderCount = parseInt(orderCountResult.rows[0].count);
      
      let greeting = `Bonjour ${contactName} ! 👋\n\n`;
      
      if (orderCount > 0) {
        // Client existant
        greeting += `Content de vous revoir ! Vous avez ${orderCount} commande${orderCount > 1 ? 's' : ''} avec nous.\n\n`;
        
        // Vérifier la dernière commande
        const lastOrderResult = await client.query(
          `SELECT statut FROM "Commandes" 
           WHERE "contactId" = $1 
           ORDER BY "createdAt" DESC 
           LIMIT 1`,
          [contact.id || 0]
        );
        
        if (lastOrderResult.rows.length > 0) {
          greeting += `Votre dernière commande est actuellement "${lastOrderResult.rows[0].statut}".\n`;
        }
      } else {
        // Nouveau client
        greeting += `Bienvenue ! Je suis votre assistant virtuel pour la pharmacie.\n`;
      }
      
      greeting += `\nJe peux vous aider avec :\n`;
      greeting += `• 📋 Voir le catalogue produits\n`;
      greeting += `• 🛒 Passer une commande\n`;
      greeting += `• 🚚 Suivre une commande\n`;
      greeting += `• 💰 Obtenir un devis\n`;
      greeting += `• 🧾 Générer une facture\n\n`;
      greeting += `Que souhaitez-vous faire ?`;
      
      return greeting;
      
    } catch (error) {
      console.warn('⚠️ Erreur dans handleGreeting, utilisation version simplifiée:', error.message);
      return `Bonjour ${contactName} ! 👋\n\nJe suis votre assistant. Comment puis-je vous aider ?`;
    } finally {
      client.release();
    }
  }

  async handleListProducts() {
    const client = await this.db.connect();
    
    try {
      // Vérifier si la table Produits existe
      const tableExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'Produits'
        )`
      );
      
      if (!tableExists.rows[0].exists) {
        return "Le catalogue produits n'est pas encore disponible. Veuillez nous contacter directement.";
      }
      
      // Récupérer les produits
      const productsResult = await client.query(
        `SELECT nom, prix, description 
         FROM "Produits" 
         WHERE actif = true 
         ORDER BY nom 
         LIMIT 15`
      );
      
      if (productsResult.rows.length === 0) {
        return "Aucun produit disponible pour le moment. Notre catalogue est en cours de mise à jour.";
      }
      
      let response = "🎯 **Produits disponibles** :\n\n";
      
      productsResult.rows.forEach((product, index) => {
        response += `${index + 1}. **${product.nom}**\n`;
        response += `   💰 Prix: ${product.prix} FCFA\n`;
        
        if (product.description) {
          const shortDesc = product.description.length > 60 
            ? product.description.substring(0, 60) + '...' 
            : product.description;
          response += `   📝 ${shortDesc}\n`;
        }
        
        response += '\n';
      });
      
      response += "Pour commander, dites par exemple :\n";
      response += '"Je veux commander du Paracétamol" ou\n';
      response += '"Je prends 2 boîtes de Doliprane"';
      
      return response;
      
    } catch (error) {
      console.error('❌ Erreur handleListProducts:', error.message);
      return "Désolé, je ne peux pas accéder au catalogue pour le moment. Notre équipe technique est prévenue.";
    } finally {
      client.release();
    }
  }

  async handleCreateOrder(contactId, orderData, contactName) {
    if (!orderData || !orderData.produit) {
      return `Quel produit souhaitez-vous commander ${contactName} ?\n\nExemples :\n• "Je veux du Paracétamol"\n• "Commande pour 2 boîtes de Doliprane"\n• "Je prends un masque chirurgical"`;
    }
    
    const client = await this.db.connect();
    
    try {
      // Chercher le produit
      const productResult = await client.query(
        `SELECT id, nom, prix, stock 
         FROM "Produits" 
         WHERE LOWER(nom) LIKE LOWER($1) 
            OR LOWER(nom) LIKE LOWER($2)
         LIMIT 1`,
        [`%${orderData.produit}%`, `${orderData.produit}%`]
      );
      
      if (productResult.rows.length === 0) {
        // Suggestions
        const suggestionsResult = await client.query(
          `SELECT nom FROM "Produits" 
           WHERE actif = true 
           ORDER BY nom 
           LIMIT 5`
        );
        
        if (suggestionsResult.rows.length > 0) {
          const suggestions = suggestionsResult.rows.map(r => `• ${r.nom}`).join('\n');
          return `Produit "${orderData.produit}" non trouvé.\n\nSuggestions :\n${suggestions}\n\nDites "catalogue" pour voir tous les produits.`;
        }
        
        return `Produit "${orderData.produit}" non trouvé. Dites "catalogue" pour voir nos produits.`;
      }
      
      const product = productResult.rows[0];
      const quantity = Math.max(1, parseInt(orderData.quantite) || 1);
      
      // Vérifier le stock
      if (product.stock !== null && product.stock < quantity) {
        return `Stock insuffisant pour "${product.nom}".\nDisponible : ${product.stock}\nDemandé : ${quantity}\n\nVeuillez choisir une autre quantité ou un autre produit.`;
      }
      
      // Créer la commande
      await client.query('BEGIN');
      
      try {
        const orderResult = await client.query(
          `INSERT INTO "Commandes" 
           (date, statut, total, "contactId", "createdAt", "updatedAt")
           VALUES (NOW(), 'nouvelle', $1, $2, NOW(), NOW())
           RETURNING id`,
          [product.prix * quantity, contactId]
        );
        
        const orderId = orderResult.rows[0].id;
        
        await client.query(
          `INSERT INTO "CommandeProduits" 
           ("commandeId", "produitId", quantite, "prixUnitaire")
           VALUES ($1, $2, $3, $4)`,
          [orderId, product.id, quantity, product.prix]
        );
        
        // Mettre à jour le stock si disponible
        if (product.stock !== null) {
          await client.query(
            `UPDATE "Produits" SET stock = stock - $1 WHERE id = $2`,
            [quantity, product.id]
          );
        }
        
        await client.query('COMMIT');
        
        let response = `✅ **Commande créée avec succès !**\n\n`;
        response += `📋 Référence : #${orderId}\n`;
        response += `📦 Produit : ${product.nom}\n`;
        response += `🔢 Quantité : ${quantity}\n`;
        response += `💰 Total : ${product.prix * quantity} FCFA\n\n`;
        response += `Merci pour votre commande ${contactName} !\n\n`;
        response += `Pour suivre cette commande, dites : "statut commande ${orderId}"`;
        
        return response;
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      console.error('❌ Erreur handleCreateOrder:', error.message);
      return `Désolé ${contactName}, une erreur est survenue lors de la création de la commande. Notre équipe est prévenue.`;
    } finally {
      client.release();
    }
  }

  async handleTrackOrder(contactId, data) {
    const client = await this.db.connect();
    
    try {
      let orderId = data.orderId;
      
      // Si pas d'ID, chercher la dernière commande
      if (!orderId) {
        const lastOrderResult = await client.query(
          `SELECT id FROM "Commandes" 
           WHERE "contactId" = $1 
           ORDER BY "createdAt" DESC 
           LIMIT 1`,
          [contactId]
        );
        
        if (lastOrderResult.rows.length === 0) {
          return "Vous n'avez pas de commandes récentes.";
        }
        
        orderId = lastOrderResult.rows[0].id;
      }
      
      // Récupérer les détails de la commande
      const orderResult = await client.query(
        `SELECT c.id, c.date, c.statut, c.total, 
                p.nom as produit, cp.quantite
         FROM "Commandes" c
         LEFT JOIN "CommandeProduits" cp ON c.id = cp."commandeId"
         LEFT JOIN "Produits" p ON cp."produitId" = p.id
         WHERE c.id = $1 AND c."contactId" = $2`,
        [orderId, contactId]
      );
      
      if (orderResult.rows.length === 0) {
        return `Commande #${orderId} introuvable ou ne vous appartient pas.`;
      }
      
      const order = orderResult.rows[0];
      
      let response = `📍 **Suivi commande #${orderId}**\n\n`;
      response += `📋 Statut : ${order.statut}\n`;
      response += `📅 Date : ${new Date(order.date).toLocaleDateString('fr-FR')}\n`;
      response += `💰 Total : ${order.total} FCFA\n`;
      
      if (order.produit) {
        response += `📦 Produit : ${order.produit} x${order.quantite || 1}\n`;
      }
      
      // Ajouter des informations supplémentaires selon le statut
      switch (order.statut) {
        case 'nouvelle':
          response += `\n🔄 Votre commande est en attente de traitement.`;
          break;
        case 'en cours':
          response += `\n🚚 Votre commande est en cours de préparation.`;
          break;
        case 'expédiée':
          response += `\n📦 Votre commande a été expédiée.`;
          break;
        case 'livrée':
          response += `\n✅ Votre commande a été livrée.`;
          break;
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Erreur handleTrackOrder:', error.message);
      return "Désolé, je ne peux pas accéder aux informations de commande pour le moment.";
    } finally {
      client.release();
    }
  }

  async handleGenerateQuote(contactId, data, contactName) {
    return `📄 **Demande de devis enregistrée**\n\nMerci ${contactName} !\n\nVotre demande de devis a été transmise à notre équipe commerciale. Vous recevrez une réponse sous 24 heures ouvrables.\n\nPour toute urgence, contactez-nous au 01 23 45 67 89.`;
  }

  async handleGenerateInvoice(contactId, data) {
    const client = await this.db.connect();
    
    try {
      let orderId = data.orderId;
      
      if (!orderId) {
        // Chercher la dernière commande payée
        const lastOrderResult = await client.query(
          `SELECT id FROM "Commandes" 
           WHERE "contactId" = $1 
             AND statut IN ('livrée', 'expédiée')
           ORDER BY "createdAt" DESC 
           LIMIT 1`,
          [contactId]
        );
        
        if (lastOrderResult.rows.length === 0) {
          return "Aucune commande éligible pour facturation trouvée.";
        }
        
        orderId = lastOrderResult.rows[0].id;
      }
      
      return `🧾 **Facture commande #${orderId}**\n\nVotre facture sera générée et envoyée à votre adresse email enregistrée.\n\nSi vous n'avez pas reçu la facture sous 1 heure, contactez notre service comptabilité.`;
      
    } catch (error) {
      console.error('❌ Erreur handleGenerateInvoice:', error.message);
      return "Désolé, je ne peux pas générer de facture pour le moment.";
    } finally {
      client.release();
    }
  }

  handleHelp() {
    return `🛠️ **Comment puis-je vous aider ?**\n\n`;
  }

  handleAcknowledge(contactName) {
    const responses = [
      `Avec plaisir ${contactName} ! 😊`,
      `Je suis là pour ça ${contactName} ! 👍`,
      `De rien ${contactName} ! N'hésitez pas si vous avez d'autres questions.`,
      `C'est normal ${contactName} ! Comment puis-je vous aider d'autre ?`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  handleGoodbye(contactName) {
    const goodbyes = [
      `Au revoir ${contactName} ! À bientôt 👋`,
      `Bonne journée ${contactName} ! N'hésitez pas à revenir 😊`,
      `À la prochaine ${contactName} ! Portez-vous bien 👍`,
      `Merci et à bientôt ${contactName} ! 👋`
    ];
    
    return goodbyes[Math.floor(Math.random() * goodbyes.length)];
  }

  async handleUnknown(contactId, contactName, originalMessage) {
    console.log(`🤔 Message non compris: "${originalMessage.substring(0, 50)}..."`);
    
    // Essayer de deviner l'intention
    const guess = this.guessIntention(originalMessage);
    
    if (guess) {
      return `Je pense que vous voulez ${guess}. Est-ce correct ${contactName} ?`;
    }
    
    // Réponse par défaut
    const responses = [
      `Je ne suis pas sûr de comprendre "${originalMessage.substring(0, 30)}...". Pouvez-vous reformuler ${contactName} ?`,
      `Désolé ${contactName}, je n'ai pas compris. Je peux vous aider avec les produits, commandes, suivi, devis ou factures.`,
      `Pourriez-vous préciser votre demande ${contactName} ? Je peux vous aider avec : catalogue, commande, suivi, devis ou facture.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  guessIntention(message) {
    const lowerMsg = message.toLowerCase();
    
    if (/(produit|article|médicament)/i.test(lowerMsg)) {
      return "voir nos produits (dites 'catalogue')";
    }
    
    if (/(prix|coût|tarif|combien)/i.test(lowerMsg)) {
      return "un devis ou connaître les prix";
    }
    
    if (/(livraison|délai|quand|temps)/i.test(lowerMsg)) {
      return "connaître les délais de livraison";
    }
    
    if (/(adresse|localisation|où|trouver)/i.test(lowerMsg)) {
      return "connaître notre adresse";
    }
    
    if (/(contact|téléphone|mail|email)/i.test(lowerMsg)) {
      return "nos coordonnées";
    }
    
    return null;
  }

  handleError(contactId, error) {
    console.error(`❌ Erreur pour contact ${contactId}:`, error.message);
    
    const errorMessages = [
      "Désolé, je rencontre un problème technique. Notre équipe est prévenue.",
      "Oups ! Une erreur s'est produite. Veuillez réessayer dans quelques instants.",
      "Je ne peux pas traiter votre demande pour le moment. Notre équipe technique intervient."
    ];
    
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  }
}

/* ===========================
   INITIALISATION
   =========================== */

const executionManager = new ExecutionManager(pool);
const whatsAppSessionManager = new WhatsAppSessionManager(pool);

/* ===========================
   FONCTIONS D'ENVOI AMÉLIORÉES
   =========================== */

async function sendTwilioWhatsApp(to, text) {
  try {
    console.log(`📤 Envoi WhatsApp Twilio à ${to}...`);
    
    // Format Twilio correct
    let formattedTo = to;
    
    // Si le numéro n'a PAS déjà "whatsapp:", l'ajouter
    if (!formattedTo.includes('whatsapp:')) {
      formattedTo = `whatsapp:${formattedTo.replace('whatsapp:', '').replace('+', '').replace(/\s/g, '')}`;
    }
    
    // Nettoyer pour ne garder que chiffres après "whatsapp:"
    formattedTo = formattedTo.replace(/whatsapp:([^\d+]*)([\d+]+)/, 'whatsapp:$2');
    
    // Ajouter le + si absent
    if (!formattedTo.includes('+') && !formattedTo.includes('whatsapp:+')) {
      formattedTo = formattedTo.replace('whatsapp:', 'whatsapp:+');
    }
    
    // Vérifier les tokens Twilio (utiliser ceux du compte ou les variables d'environnement)
    const accountSid = twilioAccount?.account_sid || TWILIO_ACCOUNT_SID;
    const authToken = twilioAccount?.auth_token || TWILIO_AUTH_TOKEN;
    const fromNumber = twilioAccount?.phone_number || TWILIO_WHATSAPP_FROM;
    
    if (!accountSid || !authToken) {
      throw new Error('Tokens Twilio manquants!');
    }
    
    let formattedFrom = fromNumber;
    if (!formattedFrom.includes('whatsapp:')) {
      formattedFrom = `whatsapp:${formattedFrom}`;
    }
    
    console.log(`📞 De: ${formattedFrom}`);
    console.log(`📞 À: ${formattedTo}`);
    console.log(`📝 Message (${text.length} chars): ${text.substring(0, 100)}...`);
    
    // Vérifier la longueur du message
    if (text.length > 4000) {
      console.warn('⚠️ Message trop long pour WhatsApp, troncation');
      text = text.substring(0, 4000) + '...';
    }
    
    // Créer le client Twilio avec les credentials du compte
    const client = require('twilio')(accountSid, authToken);
    
    // Envoyer le message
    const message = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      body: text
    });
    
    console.log(`✅ WhatsApp envoyé avec succès!`);
    console.log(`📋 SID: ${message.sid}`);
    console.log(`📋 Status: ${message.status}`);
    
    // Vérifier l'état après 10 secondes
    setTimeout(async () => {
      try {
        const updatedMessage = await client.messages(message.sid).fetch();
        console.log(`📊 Statut final: ${updatedMessage.status}`);
        
        if (updatedMessage.status === 'failed' && updatedMessage.errorCode === 63015) {
          console.error('❌ ERREUR 63015: Session WhatsApp expirée');
          
          // Enregistrer l'erreur pour suivi
          if (userSchema && accountId) {
            await pool.query(`
              INSERT INTO "${userSchema}".webhook_errors 
              (account_id, error_code, error_message, metadata, created_at)
              VALUES ($1, $2, $3, $4, NOW())
            `, [
              accountId,
              63015,
              'Session WhatsApp expirée',
              JSON.stringify({
                to: formattedTo,
                message_sid: message.sid,
                timestamp: new Date().toISOString()
              })
            ]);
          }
        }
      } catch (fetchError) {
        console.warn('⚠️ Impossible de récupérer le statut final:', fetchError.message);
      }
    }, 10000);
    
    return message;
    
  } catch (error) {
    console.error('❌ ERREUR envoi WhatsApp Twilio:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    
    // Gestion spécifique des erreurs WhatsApp
    if (error.code === 63015) {
      console.error('🔧 ERREUR 63015: Hors fenêtre des 24h');
      console.error('💡 Solution: L\'utilisateur doit initier la conversation');
    } else if (error.code === 21612) {
      console.error('🔧 ERREUR 21612: Utilisateur non inscrit au sandbox');
      console.error('💡 Solution: Envoyer "join fully-satisfy" à +14155238886');
    }
    
    throw error;
  }
}

/**
 * Fonction d'envoi SMS Twilio
 */
async function sendTwilioSms(to, text) {
  try {
    console.log(`📤 Envoi SMS à ${to.substring(0, 20)}...`);
    
    // Utiliser les credentials du compte ou les variables d'environnement
    const accountSid = twilioAccount?.account_sid || TWILIO_ACCOUNT_SID;
    const authToken = twilioAccount?.auth_token || TWILIO_AUTH_TOKEN;
    const fromNumber = twilioAccount?.phone_number || TWILIO_SMS_FROM;
    
    const client = require('twilio')(accountSid, authToken);
    
    const message = await client.messages.create({
      from: fromNumber,
      to: to,
      body: text.substring(0, 1600) // Limite SMS
    });
    
    console.log(`✅ SMS envoyé, SID: ${message.sid}`);
    return message;
    
  } catch (error) {
    console.error('❌ Erreur envoi SMS:', error.message);
    throw error;
  }
}

async function checkMessageStatus(messageSid) {
  try {
    const message = await clientTwilio.messages(messageSid).fetch();
    
    console.log(`📊 Statut message ${messageSid}:`);
    console.log(`   Status: ${message.status}`);
    console.log(`   Error Code: ${message.errorCode || 'none'}`);
    console.log(`   Error Message: ${message.errorMessage || 'none'}`);
    
    return message.status;
    
  } catch (error) {
    console.error('❌ Erreur vérification statut:', error.message);
    return null;
  }
}

/* ===========================
   WEBHOOKS PRINCIPAUX
   =========================== */

router.post('/webhook/twilio', async (req, res) => {
  console.log('📱 Twilio Webhook reçu:', JSON.stringify(req.body, null, 2));
  
  try {
    const body = req.body?.Body || '';
    const from = req.body?.From || '';
    
    if (!body || !from) {
      console.warn('⚠️ Données manquantes dans webhook Twilio');
      return res.status(400).send('Missing Body or From');
    }
    
    const isWhatsApp = from.includes('whatsapp');
    const channel = isWhatsApp ? 'whatsapp' : 'sms';
    
    console.log(`📱 Canal: ${channel}, De: ${from}, Message: "${body.substring(0, 100)}..."`);
    
    // ==================== DÉTECTER LES MESSAGES D'INSCRIPTION ====================
    const lowerBody = body.toLowerCase();
    if (isWhatsApp && (lowerBody.includes('join') || lowerBody.includes('rejoindre'))) {
      console.log('🎉 Message d\'inscription détecté!');
      
      const welcomeMessage = `🎉 Bienvenue dans notre service de pharmacie !\n\n`
        + `Vous êtes maintenant inscrit à notre assistant WhatsApp.\n\n`
        + `Je peux vous aider avec :\n`
        + `• 📋 Voir nos produits\n`
        + `• 🛒 Passer une commande\n`
        + `• 🚚 Suivre une livraison\n`
        + `• 💰 Obtenir un devis\n\n`
        + `Dites "Bonjour" pour commencer !`;
      
      await sendTwilioWhatsApp(from, welcomeMessage);
      return res.status(200).send('OK');
    }
    
    // ==================== ÉTAPE 1 : IDENTIFIER LE COMPTE UTILISATEUR ====================
    const account = await findAccountByPhoneTwilio(from, req);
    
    let useAI = false;
    let userId = null;
    let userSchema = null;
    let twilioAccount = null;
    
    if (account && account.ai_enabled && account.auto_reply) {
      useAI = true;
      userId = account.user_id;
      userSchema = account.schema_name || `user_${userId}`;
      twilioAccount = account;
      console.log(`🤖 IA ACTIVÉE pour compte ${account.name} (User: ${userId})`);
    } else if (account) {
      console.log(`ℹ️  Compte Twilio trouvé mais IA désactivée: ${account.name}`);
      twilioAccount = account;
    } else {
      console.log(`⚠️  Aucun compte Twilio trouvé pour ${from}`);
      // Utiliser le compte Twilio par défaut si configuré
      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        twilioAccount = {
          account_sid: TWILIO_ACCOUNT_SID,
          auth_token: TWILIO_AUTH_TOKEN,
          phone_number: TWILIO_WHATSAPP_FROM,
          name: 'Compte Twilio par défaut'
        };
      }
    }

    // ==================== ÉTAPE 2 : GESTION DU CONTACT ====================
    const { contactId, contactName } = await ensureContact(pool, channel, from);
    
    if (!contactId) {
      console.error('❌ Impossible de créer/récupérer le contact');
      return res.status(500).send('Contact error');
    }
    
    console.log(`👤 Contact: ${contactId} (${contactName})`);

    // ==================== ÉTAPE 3 : TRAITEMENT DU MESSAGE ====================
    let reply = null;
    let aiResponse = null;
    let confidence = 0;
    let processedByAI = false;

    if (useAI && userId && userSchema) {
      // ==================== OPTION A : TRAITEMENT AVEC IA ====================
      try {
        console.log(`🤖 Traitement avec IA pour user ${userId}`);
        
        // Initialiser le moteur IA pour cet utilisateur
        const iaMotor = new IACRMMotor(pool, userSchema, userId);
        
        // Traiter le message avec l'IA
        aiResponse = await iaMotor.processMessage(
          contactId,
          body,
          {
            platform: channel,
            account_id: account.id,
            contact_name: contactName,
            source: 'twilio_webhook',
            is_whatsapp: isWhatsApp
          }
        );
        
        if (aiResponse && aiResponse.success !== false && aiResponse.response) {
          reply = aiResponse.response || aiResponse.message;
          confidence = aiResponse.confidence || 0;
          processedByAI = true;
          
          console.log(`✅ Réponse IA générée (confiance: ${confidence.toFixed(2)})`);
          
          // Enregistrer la conversation dans l'historique IA
          await saveIAConversation(userSchema, {
            contact_id: contactId,
            account_id: account.id,
            message_text: body,
            ai_response: reply,
            confidence_score: confidence,
            platform: channel,
            is_whatsapp: isWhatsApp
          });
          
        } else {
          console.warn(`⚠️  IA n'a pas généré de réponse valide, fallback au système basique`);
          useAI = false; // Fallback au système basique
        }
        
      } catch (iaError) {
        console.error('❌ Erreur traitement IA:', iaError.message);
        console.log('🔄 Fallback au système basique');
        useAI = false; // Fallback au système basique
      }
    }

    if (!useAI || !reply) {
      // ==================== OPTION B : SYSTÈME BASIQUE EXISTANT ====================
      console.log('🔄 Utilisation du système basique');
      
      // Analyse du message avec le système existant
      const intentAnalysis = await executionManager.intentManager.analyzeMessage(
        body, 
        contactId, 
        channel
      );
      
      console.log(`🎯 Intention analysée:`, intentAnalysis.intent);
      
      // Exécution et réponse
      reply = await executionManager.executeIntent(
        contactId, 
        intentAnalysis, 
        channel, 
        body
      );
      
      console.log(`📤 Réponse basique générée (${reply.length} caractères)`);
      
      // Enregistrer dans les logs si on a un compte
      if (account && userSchema) {
        await saveBasicConversation(userSchema, {
          contact_id: contactId,
          account_id: account.id,
          message_text: body,
          response: reply,
          source: 'basic_system',
          channel: channel
        });
      }
    }

    // ==================== ÉTAPE 4 : ENVOI DE LA RÉPONSE ====================
    if (reply) {
      console.log(`📤 Envoi réponse via ${channel.toUpperCase()}...`);
      
      try {
        if (isWhatsApp) {
          // Envoi WhatsApp avec gestion de session
          await whatsAppSessionManager.sendWithSessionCheck(from, reply, contactId);
        } else {
          // Envoi SMS normal
          await sendTwilioSms(from, reply);
        }
        
        console.log(`✅ Réponse ${channel.toUpperCase()} envoyée`);
        
        // Mettre à jour les statistiques si IA utilisée
        if (processedByAI && account) {
          await updateAIStats(userSchema, account.id, confidence);
          
          // Incrémenter le compteur d'utilisation Twilio
          await updateTwilioUsageStats(userSchema, account.id, channel);
        }
        
      } catch (sendError) {
        console.error(`❌ Erreur envoi ${channel}:`, sendError.message);
        
        // Gestion spécifique des erreurs WhatsApp
        if (isWhatsApp && sendError.code === 63015) {
          console.error('🔧 ERREUR 63015: Hors fenêtre des 24h');
          
          // Tentative d'envoi SMS fallback
          try {
            const cleanFrom = from.replace('whatsapp:', '');
            const smsMessage = `${reply.substring(0, 100)}...\n\n`
              + `(Votre session WhatsApp a expiré. Répondez "Bonjour" dans WhatsApp pour continuer.)`;
            
            await sendTwilioSms(cleanFrom, smsMessage);
            console.log('📱 SMS fallback envoyé');
            
          } catch (smsError) {
            console.error('❌ Échec SMS fallback:', smsError.message);
          }
        }
      }
    } else {
      console.warn('⚠️  Aucune réponse générée');
      
      // Envoyer un message par défaut
      const defaultMessage = `Merci pour votre message ${contactName} ! Notre équipe vous répondra bientôt.`;
      if (isWhatsApp) {
        await sendTwilioWhatsApp(from, defaultMessage);
      } else {
        await sendTwilioSms(from, defaultMessage);
      }
    }

    console.log('✅ Webhook Twilio traité avec succès');
    return res.status(200).send('OK');
    
  } catch (err) {
    console.error('❌ Erreur webhook Twilio:', err.message, err.stack);
    
    // IMPORTANT: Toujours répondre 200 pour éviter les retries Twilio
    return res.status(200).send('OK');
  }
});

router.post('/webhook/whatsapp', async (req, res) => {
  console.log('📱 WhatsApp Webhook reçu:', JSON.stringify(req.body, null, 2));
  
  try {
    const msg = req.body?.messages?.[0];
    const text = msg?.text?.body;
    const from = msg?.from;

    if (!text || !from) {
      console.warn('⚠️ Données manquantes dans webhook WhatsApp');
      return res.sendStatus(400);
    }

    console.log(`📱 Message WhatsApp de ${from}: "${text.substring(0, 100)}..."`);

    // ==================== ÉTAPE 1 : IDENTIFIER LE COMPTE UTILISATEUR ====================
    const account = await findAccountByPhone(from, req);
    
    let useAI = false;
    let userId = null;
    let userSchema = null;
    
    if (account && account.ai_enabled && account.auto_reply) {
      useAI = true;
      userId = account.user_id;
      userSchema = account.schema_name || `user_${userId}`;
      console.log(`🤖 IA ACTIVÉE pour compte ${account.name} (User: ${userId})`);
    } else if (account) {
      console.log(`ℹ️  Compte trouvé mais IA désactivée: ${account.name}`);
    } else {
      console.log(`⚠️  Aucun compte trouvé pour ${from}`);
    }

    // ==================== ÉTAPE 2 : GESTION DU CONTACT ====================
    const { contactId, contactName } = await ensureContact(pool, 'whatsapp', from);
    
    if (!contactId) {
      console.error('❌ Impossible de créer/récupérer le contact WhatsApp');
      return res.sendStatus(500);
    }
    
    console.log(`👤 WhatsApp Contact: ${contactId} (${contactName})`);

    // ==================== ÉTAPE 3 : TRAITEMENT DU MESSAGE ====================
    let reply = null;
    let aiResponse = null;
    let confidence = 0;

    if (useAI && userId && userSchema) {
      // ==================== OPTION A : TRAITEMENT AVEC IA ====================
      try {
        console.log(`🤖 Traitement avec IA pour user ${userId}`);
        
        // Initialiser le moteur IA pour cet utilisateur
        const iaMotor = new IACRMMotor(pool, userSchema, userId);
        
        // Traiter le message avec l'IA
        aiResponse = await iaMotor.processMessage(
          contactId,
          text,
          {
            platform: 'whatsapp',
            account_id: account.id,
            contact_name: contactName,
            source: 'webhook'
          }
        );
        
        if (aiResponse && aiResponse.success !== false) {
          reply = aiResponse.response || aiResponse.message;
          confidence = aiResponse.confidence || 0;
          
          console.log(`✅ Réponse IA générée (confiance: ${confidence.toFixed(2)})`);
          
          // Enregistrer la conversation dans l'historique IA
          await saveIAConversation(userSchema, {
            contact_id: contactId,
            account_id: account.id,
            message_text: text,
            ai_response: reply,
            confidence_score: confidence,
            platform: 'whatsapp'
          });
          
        } else {
          console.warn(`⚠️  IA n'a pas généré de réponse valide, fallback au système basique`);
          useAI = false; // Fallback au système basique
        }
        
      } catch (iaError) {
        console.error('❌ Erreur traitement IA:', iaError.message);
        console.log('🔄 Fallback au système basique');
        useAI = false; // Fallback au système basique
      }
    }

    if (!useAI || !reply) {
      // ==================== OPTION B : SYSTÈME BASIQUE EXISTANT ====================
      console.log('🔄 Utilisation du système basique');
      
      // Analyse du message avec le système existant
      const intentAnalysis = await executionManager.intentManager.analyzeMessage(
        text, 
        contactId, 
        'whatsapp'
      );
      
      // Exécution et réponse
      reply = await executionManager.executeIntent(
        contactId, 
        intentAnalysis, 
        'whatsapp', 
        text
      );
      
      // Enregistrer dans les logs si on a un compte
      if (account) {
        await saveBasicConversation(userSchema || 'public', {
          contact_id: contactId,
          account_id: account.id,
          message_text: text,
          response: reply,
          source: 'basic_system'
        });
      }
    }

    // ==================== ÉTAPE 4 : ENVOI DE LA RÉPONSE ====================
    if (reply) {
      console.log(`📤 Envoi réponse (${reply.length} caractères)...`);
      
      // Envoi via WhatsApp Business API
      try {
        await notifyWhatsApp(from, reply);
        console.log('✅ Réponse WhatsApp envoyée');
        
        // Mettre à jour les statistiques si IA utilisée
        if (useAI && account) {
          await updateAIStats(userSchema, account.id, confidence);
        }
        
      } catch (sendError) {
        console.error('❌ Erreur envoi WhatsApp:', sendError.message);
        
        // Tentative de fallback avec Twilio si disponible
        if (account && account.account_sid && account.auth_token) {
          console.log('🔄 Tentative de fallback avec Twilio...');
          try {
            await sendTwilioFallback(account, from, reply);
          } catch (twilioError) {
            console.error('❌ Échec fallback Twilio:', twilioError.message);
          }
        }
      }
    } else {
      console.warn('⚠️  Aucune réponse générée');
    }

    return res.sendStatus(200);
    
  } catch (err) {
    console.error('❌ Erreur webhook WhatsApp:', err.message, err.stack);
    
    // Toujours répondre 200 pour éviter les retries
    return res.sendStatus(200);
  }
});

router.post('/webhook/messenger', async (req, res) => {
  console.log('📱 Messenger Webhook reçu:', JSON.stringify(req.body, null, 2));
  
  try {
    const entry = req.body?.entry?.[0]?.messaging?.[0];
    const text = entry?.message?.text;
    const senderId = entry?.sender?.id;

    if (!text || !senderId) {
      console.warn('⚠️ Données manquantes dans webhook Messenger');
      return res.sendStatus(400);
    }

    // Gestion du contact
    const { contactId, contactName } = await ensureContact(pool, 'messenger', senderId);
    
    if (!contactId) {
      console.error('❌ Impossible de créer/récupérer le contact Messenger');
      return res.sendStatus(500);
    }
    
    console.log(`👤 Messenger Contact: ${contactId} (${contactName})`);
    
    // Analyse du message
    const intentAnalysis = await executionManager.intentManager.analyzeMessage(
      text, 
      contactId, 
      'messenger'
    );
    
    // Exécution et réponse
    const reply = await executionManager.executeIntent(
      contactId, 
      intentAnalysis, 
      'messenger', 
      text
    );
    
    // Envoi via Messenger API
    await notifyMessenger(senderId, reply);
    
    console.log('✅ Réponse Messenger envoyée');
    return res.sendStatus(200);
    
  } catch (err) {
    console.error('❌ Erreur webhook Messenger:', err.message);
    return res.sendStatus(500);
  }
});

/* ===========================
   ROUTES DE GESTION WHATSAPP
   =========================== */

router.post('/webhook/whatsapp/renew-session', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Numéro requis' });
    }
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = `whatsapp:+${cleanNumber}`;
    
    console.log(`🔄 Renouvellement session pour: ${formattedNumber}`);
    
    // Message spécial pour renouveler la session
    const sessionMessage = `🔄 RENOUVELLEMENT DE SESSION\n\n`
      + `Pour continuer à recevoir nos messages WhatsApp, `
      + `veuillez répondre à ce message avec "OK" ou "Bonjour".\n\n`
      + `Cela réinitialisera votre session de 24 heures.`;
    
    try {
      const message = await sendTwilioWhatsApp(formattedNumber, sessionMessage);
      
      res.json({
        success: true,
        message: 'Message de renouvellement envoyé',
        sid: message.sid,
        status: message.status,
        note: 'L\'utilisateur doit répondre dans les 24h pour continuer'
      });
      
    } catch (error) {
      console.error('❌ Erreur renouvellement:', error.message);
      
      if (error.code === 63015) {
        res.status(400).json({
          success: false,
          error: 'ERREUR 63015: Session expirée',
          solution: [
            '1. Demandez à l\'utilisateur d\'envoyer un message FIRST',
            '2. Configurez un template WhatsApp Business',
            '3. Passez en mode Production WhatsApp'
          ]
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhook/whatsapp/force-join', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Numéro requis' });
    }
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = `whatsapp:+${cleanNumber}`;
    
    console.log(`🔗 Tentative d\'inscription sandbox: ${formattedNumber}`);
    
    // Instructions pour s'inscrire
    const instructions = `Pour recevoir des messages de notre pharmacie:\n\n`
      + `1. Ouvrez WhatsApp\n`
      + `2. Envoyez "join fully-satisfy" à +14155238886\n`
      + `3. Attendez la confirmation\n\n`
      + `Après cela, vous pourrez recevoir nos messages.`;
    
    try {
      const message = await sendTwilioWhatsApp(formattedNumber, instructions);
      
      res.json({
        success: true,
        message: 'Instructions envoyées',
        phone: `+${cleanNumber}`,
        instructions: 'Demandez à l\'utilisateur d\'envoyer "join fully-satisfy" à +14155238886'
      });
      
    } catch (sendError) {
      console.error('❌ Erreur envoi instructions:', sendError.message);
      
      res.json({
        success: false,
        error: sendError.message,
        manual_instructions: `Demandez à +${cleanNumber} d'envoyer "join fully-satisfy" à +14155238886 sur WhatsApp`
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur force-join:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/webhook/whatsapp/sandbox-info', async (req, res) => {
  try {
    console.log('🔧 Informations Sandbox WhatsApp:');
    
    const sandboxWords = [
      'fully-satisfy',
      'picture-pie',
      'XXXX-XXXX',
    ];
    
    // Vérifier avec Twilio API
    const messages = await clientTwilio.messages.list({
      from: TWILIO_WHATSAPP_FROM,
      limit: 5
    });
    
    res.json({
      sandbox_number: '+14155238886',
      possible_sandbox_words: sandboxWords,
      recent_messages: messages.map(m => ({
        to: m.to,
        body: m.body?.substring(0, 50) || '',
        status: m.status,
        date: m.dateCreated
      })),
      instructions: 'Envoyez "join [mot]" à +14155238886'
    });
    
  } catch (error) {
    console.error('❌ Erreur sandbox-info:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================
   FONCTIONS D'ENVOI API
   =========================== */

async function notifyWhatsApp(toPhone, text) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.warn('⚠️ Tokens WhatsApp manquants, skip envoi');
    return;
  }
  
  try {
    const response = await axios.post(
      `${FB_GRAPH}/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { body: text }
      },
      { 
        headers: { 
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    console.log('✅ WhatsApp Business API réponse:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Erreur WhatsApp Business API:', error.response?.data || error.message);
    throw error;
  }
}

async function notifyMessenger(recipientId, text) {
  if (!MESSENGER_TOKEN) {
    console.warn('⚠️ Token Messenger manquant, skip envoi');
    return;
  }
  
  try {
    const response = await axios.post(
      `${FB_GRAPH}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: text },
        messaging_type: 'RESPONSE'
      },
      { 
        headers: { 
          'Authorization': `Bearer ${MESSENGER_TOKEN}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    console.log('✅ Messenger API réponse:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Erreur Messenger API:', error.response?.data || error.message);
    throw error;
  }
}

/* ===========================
   ROUTES DE TEST
   =========================== */

router.get('/webhook/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Webhook endpoint fonctionnel',
    timestamp: new Date().toISOString(),
    services: {
      twilio: !!TWILIO_ACCOUNT_SID,
      whatsapp: !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID),
      messenger: !!MESSENGER_TOKEN,
      database: 'connected'
    }
  });
});

router.post('/webhook/test/message', async (req, res) => {
  try {
    const { message, channel = 'whatsapp', contactId = 1 } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }
    
    console.log(`🧪 Test message: "${message}" (channel: ${channel})`);
    
    const intentAnalysis = await executionManager.intentManager.analyzeMessage(
      message, 
      contactId, 
      channel
    );
    
    const reply = await executionManager.executeIntent(
      contactId, 
      intentAnalysis, 
      channel, 
      message
    );
    
    res.json({
      success: true,
      original: message,
      intent: intentAnalysis.intent,
      context: intentAnalysis.context,
      response: reply
    });
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhook/test/whatsapp', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        error: 'Paramètres manquants',
        exemple: { to: "+1234567890", message: "Test message" }
      });
    }
    
    console.log(`🧪 Test envoi WhatsApp manuel à ${to}`);
    
    // Formater le numéro
    let formattedTo = to;
    if (!formattedTo.includes('whatsapp:')) {
      formattedTo = `whatsapp:${formattedTo}`;
    }
    
    console.log(`📱 Numéro formaté: ${formattedTo}`);
    
    // Envoyer le message
    const result = await sendTwilioWhatsApp(formattedTo, message);
    
    res.json({
      success: true,
      message: 'Message envoyé',
      sid: result.sid,
      status: result.status,
      to: formattedTo,
      from: TWILIO_WHATSAPP_FROM
    });
    
  } catch (error) {
    console.error('❌ Erreur test WhatsApp:', error.message);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: error.moreInfo 
    });
  }
});



// ==================== CONFIGURATION WEBHOOK ====================

// GET /api/webhook/config - Récupérer la configuration webhook
router.get('/config', requireAuth, async (req, res) => {
    try {
        console.log('📋 Récupération config webhook pour user:', req.user.id);
        
        const userSchema = `user_${req.user.id}`;
        
        // Vérifier si la table existe
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = $1 
                AND table_name = 'webhook_config'
            )
        `, [userSchema]);
        
        if (tableExists.rows[0].exists) {
            const result = await pool.query(`
                SELECT * FROM "${userSchema}".webhook_config 
                WHERE user_id = $1
                LIMIT 1
            `, [req.user.id]);
            
            if (result.rows.length > 0) {
                const configData = result.rows[0].config_data || {};
                res.json({
                    success: true,
                    ai_webhook_url: configData.ai_webhook_url || `${req.protocol}://${req.get('host')}/api/webhook/ai/${req.user.id}/{accountId}`,
                    webhook_secret: configData.webhook_secret || '',
                    verify_token: configData.verify_token || '',
                    webhook_enabled: configData.webhook_enabled !== false,
                    auto_setup: configData.auto_setup !== false,
                    created_at: result.rows[0].created_at
                });
                return;
            }
        }
        
        // Configuration par défaut
        res.json({
            success: true,
            ai_webhook_url: `${req.protocol}://${req.get('host')}/api/webhook/ai/${req.user.id}/{accountId}`,
            webhook_secret: '',
            verify_token: '',
            webhook_enabled: true,
            auto_setup: true,
            created_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération config webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération configuration',
            message: error.message
        });
    }
});

// POST /api/webhook/config - Sauvegarder la configuration webhook
router.post('/config', requireAuth, async (req, res) => {
    try {
        const configData = req.body;
        console.log('💾 Sauvegarde config webhook:', configData);
        
        const userSchema = `user_${req.user.id}`;
        
        // Créer la table si nécessaire
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "${userSchema}".webhook_config (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                config_data JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            )
        `);
        
        // Vérifier si une configuration existe déjà
        const checkResult = await pool.query(`
            SELECT id FROM "${userSchema}".webhook_config 
            WHERE user_id = $1
            LIMIT 1
        `, [req.user.id]);
        
        let result;
        
        if (checkResult.rows.length > 0) {
            // Mettre à jour
            result = await pool.query(`
                UPDATE "${userSchema}".webhook_config 
                SET config_data = $1, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = $2 
                RETURNING *
            `, [JSON.stringify(configData), req.user.id]);
        } else {
            // Créer
            result = await pool.query(`
                INSERT INTO "${userSchema}".webhook_config 
                (user_id, config_data, created_at, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `, [req.user.id, JSON.stringify(configData)]);
        }
        
        res.json({
            success: true,
            message: 'Configuration webhook sauvegardée',
            config: configData,
            id: result.rows[0].id
        });
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde config webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur sauvegarde configuration',
            message: error.message
        });
    }
});



/* ===========================
   FONCTIONS DE DÉBOGAGE
   =========================== */

async function debugTwilioConfiguration() {
  console.log('\n🔍 DÉBOGAGE CONFIGURATION TWILIO');
  console.log('='.repeat(50));
  
  console.log('📋 Variables d\'environnement:');
  console.log(`   TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID ? '✓ Présent' : '✗ MANQUANT'}`);
  console.log(`   TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN ? '✓ Présent' : '✗ MANQUANT'}`);
  console.log(`   TWILIO_WHATSAPP_FROM: ${TWILIO_WHATSAPP_FROM || '✗ MANQUANT'}`);
  
  if (TWILIO_WHATSAPP_FROM) {
    if (!TWILIO_WHATSAPP_FROM.includes('whatsapp:')) {
      console.warn('⚠️ TWILIO_WHATSAPP_FROM doit commencer par "whatsapp:"');
    }
    
    if (TWILIO_WHATSAPP_FROM.includes('14155238886')) {
      console.log('ℹ️  Utilisation du numéro sandbox Twilio standard');
      console.log('ℹ️  Pour envoyer des messages, le destinataire doit d\'abord envoyer "join [mot]" au sandbox');
    }
  }
  
  try {
    console.log('\n🔗 Test connexion Twilio API...');
    const account = await clientTwilio.api.accounts(TWILIO_ACCOUNT_SID).fetch();
    console.log(`✅ Connexion Twilio OK - Compte: ${account.friendlyName}`);
    
  } catch (error) {
    console.error(`❌ Erreur connexion Twilio: ${error.message}`);
  }
  
  console.log('='.repeat(50));
}

function checkWhatsAppSandboxInstructions() {
  console.log('\n🔧 INSTRUCTIONS SANDBOX WHATSAPP');
  console.log('='.repeat(50));
  console.log('1. Pour recevoir des messages:');
  console.log('   - Envoyez "join fully-satisfy" à +14155238886');
  console.log('2. Pour renouveler la session (erreur 63015):');
  console.log('   - Envoyez "Bonjour" au bot pour réinitialiser les 24h');
  console.log('3. En production:');
  console.log('   - Configurez des templates WhatsApp Business');
  console.log('   - Passez en mode Production API');
  console.log('='.repeat(50));
}

// Appel des fonctions de débogage au chargement
debugTwilioConfiguration();
checkWhatsAppSandboxInstructions();

module.exports = router;