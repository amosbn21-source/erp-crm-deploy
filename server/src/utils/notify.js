// src/utils/notify.js
// Utilitaires d'envoi de notifications
const axios = require('axios');
const FB_GRAPH = process.env.FB_GRAPH || 'https://graph.facebook.com/v19.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const MESSENGER_TOKEN = process.env.MESSENGER_TOKEN || '';

async function notifyWhatsApp(toPhone, text) {
  return axios.post(
    `${FB_GRAPH}/${WHATSAPP_PHONE_ID}/messages`,
    { messaging_product: 'whatsapp', to: toPhone, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

async function notifyMessenger(recipientId, text) {
  return axios.post(
    `${FB_GRAPH}/me/messages`,
    { recipient: { id: recipientId }, message: { text } },
    { headers: { Authorization: `Bearer ${MESSENGER_TOKEN}` } }
  );
}

module.exports = { notifyWhatsApp, notifyMessenger };
