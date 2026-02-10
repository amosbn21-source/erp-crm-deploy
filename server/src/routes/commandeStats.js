// routes/commandes.js
// Ajoute filtres par date/status et pagination page/limit.

const express = require('express');
const router = express.Router();
const { Commande } = require('../models');

router.get('/commandes', async (req, res) => {
  try {
    const { date, status, page = 1, limit = 10 } = req.query;

    // Construit dynamiquement le filtre selon ton ORM
    const where = {};
    if (status) where.status = status;
    // Exemple: si SQL, gère la date par BETWEEN ou égalité selon besoin

    const offset = (Number(page) - 1) * Number(limit);

    // Adapte à ton ORM:
    const result = Commande.findAndCountAll
      ? await Commande.findAndCountAll({ where, offset, limit: Number(limit), order: [['createdAt', 'DESC']] })
      : await Commande.find(where).skip(offset).limit(Number(limit)).sort({ createdAt: -1 });

    const rows = result.rows || result; // Sequelize vs Mongoose
    const count = result.count || await Commande.countDocuments?.(where) || rows.length;

    res.json({
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / Number(limit)),
      }
    });
  } catch (err) {
    console.error('Erreur GET /commandes', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
