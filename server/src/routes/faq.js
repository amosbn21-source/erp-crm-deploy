// src/routes/faq.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Pré-prompt pour contextualiser l'IA
const SYSTEM_PROMPT = "Tu es un assistant ERP-CRM. Réponds de manière concise et utile aux questions des utilisateurs.";

router.post('/faq', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Question manquante" });

  try {
    // Appel API Ollama (chat mode)
    const response = await axios.post('http://localhost:11434/api/chat', {
      model: 'mistral:7b-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: question }
      ],
      stream: false
    });

    const answer = response.data.message.content;
    res.json({ answer });
  } catch (err) {
    console.error("Erreur Ollama:", err.message);
    res.status(500).json({ error: "Impossible d'obtenir une réponse IA" });
  }
});

module.exports = router;
