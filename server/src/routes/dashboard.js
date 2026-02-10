// src/routes/dashboard.js
// ⚡ Tableau de bord CRM (Opportunités)

const express = require('express');
const router = express.Router();
const sequelize = require('../config/db'); // Connexion Sequelize
const { QueryTypes } = require('sequelize');

router.get('/dashboard', async (req, res) => {
  try {
    // Opportunités totales
    const total = await sequelize.query(
      `SELECT COUNT(*)::int AS total FROM "Opportunites"`,
      { type: QueryTypes.SELECT }
    );

    // Opportunités gagnées
    const gagnees = await sequelize.query(
      `SELECT COUNT(*)::int AS gagnees FROM "Opportunites" WHERE etape = 'Gagné'`,
      { type: QueryTypes.SELECT }
    );

    // Opportunités en cours
    const enCours = await sequelize.query(
      `SELECT COUNT(*)::int AS encours, COALESCE(SUM(montant),0)::float AS montantencours
       FROM "Opportunites"
       WHERE etape NOT IN ('Gagné', 'Perdu')`,
      { type: QueryTypes.SELECT }
    );

    // Taux conversion
    const tauxConversion =
      total[0].total > 0
        ? ((gagnees[0].gagnees / total[0].total) * 100).toFixed(2)
        : 0;

    res.json({
      total: total[0].total,
      gagnees: gagnees[0].gagnees,
      encours: enCours[0].encours,
      montantEnCours: enCours[0].montantencours,
      tauxConversion,
    });
  } catch (err) {
    console.error('Erreur GET /dashboard', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
