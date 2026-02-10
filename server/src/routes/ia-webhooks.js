/**
 * IA-WEBHOOKS.JS
 * Route dédiée pour les webhooks IA
 * Minimaliste - réutilise votre infrastructure existante
 */

const express = require('express');
const router = express.Router();
const IACRMMotor = require('../ia/ia-engine');

/**
 * POST /api/webhook/ai/:userId/:accountId
 * Webhook IA générique pour toutes les plateformes
 */
router.post('/ai/:userId/:accountId', async (req, res) => {
  try {
    const { userId, accountId } = req.params;
    const userSchema = `user_${userId}`;
    
    console.log(`🤖 Webhook IA pour user ${userId}, compte ${accountId}`);
    
    // Initialiser le moteur IA
    const iaMotor = new IACRMMotor(
      req.app.locals.pool,
      userSchema,
      parseInt(userId)
    );
    
    // Traiter le message selon la plateforme
    const platform = req.headers['x-platform'] || 'generic';
    const messageData = extractMessageData(platform, req.body);
    
    if (!messageData) {
      return res.status(400).json({ error: 'Message data missing' });
    }
    
    // Traiter avec l'IA
    const response = await iaMotor.processMessage(
      `social_${accountId}_${messageData.from}`,
      messageData.text,
      {
        platform: platform,
        account_id: accountId,
        source: 'webhook'
      }
    );
    
    // Retourner la réponse (sera envoyée par le webhook principal)
    res.json({
      success: true,
      response: response.response || response.message,
      confidence: response.confidence || 0
    });
    
  } catch (error) {
    console.error('❌ Erreur webhook IA:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function extractMessageData(platform, payload) {
  // Logique simple d'extraction
  // Vous pouvez étendre selon vos besoins
  return {
    from: payload.from || payload.sender || 'unknown',
    text: payload.text || payload.body || payload.message || '',
    platform: platform
  };
}

module.exports = router;