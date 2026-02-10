// src/routes/opportunites.js
// ⚡ Routes Express pour gérer les opportunités commerciales (pipeline)
// - CRUD complet : GET, POST, PUT, DELETE
// - Compatible avec le frontend PipelinePage.js (drag & drop + suppression)

const express = require('express');
const router = express.Router();
const sequelize = require('../config/db'); // Connexion Sequelize
const { QueryTypes } = require('sequelize');

// ✅ GET : récupérer toutes les opportunités ou filtrer par contactId
router.get('/opportunites', async (req, res) => {
  const { contactId } = req.query;
  try {
    let result;
    if (contactId) {
      // Opportunités liées à un contact spécifique
      result = await sequelize.query(
        `SELECT o.id, o.titre, o.montant, o.etape, o."createdAt", o."updatedAt"
         FROM "Opportunites" o
         WHERE o."contactId" = $1
         ORDER BY o.id ASC`,
        { bind: [contactId], type: QueryTypes.SELECT }
      );
    } else {
      // Toutes les opportunités avec jointure sur les contacts
      result = await sequelize.query(
        `SELECT o.id, o.titre, o.montant, o.etape, o."createdAt", o."updatedAt",
                c.nom AS "contactNom", c.prenom AS "contactPrenom"
         FROM "Opportunites" o
         JOIN "Contacts" c ON o."contactId" = c.id
         ORDER BY o.id ASC`,
        { type: QueryTypes.SELECT }
      );
    }
    res.json(result);
  } catch (err) {
    console.error('Erreur GET /opportunites', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ✅ POST : ajouter une opportunité
router.post('/opportunites', async (req, res) => {
  const { contactId, titre, montant, etape } = req.body;
  try {
    const result = await sequelize.query(
      `INSERT INTO "Opportunites" ("contactId", titre, montant, etape, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      { bind: [contactId, titre, montant, etape || 'Prospect identifié'], type: QueryTypes.INSERT }
    );
    res.json(result[0][0]); // Sequelize retourne un tableau, on prend la première ligne
  } catch (err) {
    console.error('Erreur POST /opportunites', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ✅ PUT : modifier une opportunité (utilisé par drag & drop pour changer l’étape)
router.put('/opportunites/:id', async (req, res) => {
  const { id } = req.params;
  const { titre, montant, etape } = req.body;

  try {
    const result = await sequelize.query(
      `UPDATE "Opportunites"
       SET titre=$1, montant=$2, etape=$3, "updatedAt"=NOW()
       WHERE id=$4 RETURNING *`,
      { bind: [titre, montant, etape, id], type: QueryTypes.UPDATE }
    );

    if (!result[0].length) {
      return res.status(404).json({ error: 'Opportunité introuvable' });
    }

    res.json(result[0][0]);
  } catch (err) {
    console.error('Erreur PUT /opportunites', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ✅ DELETE : supprimer une opportunité (utilisé par bouton Supprimer)
router.delete('/opportunites/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sequelize.query(
      `DELETE FROM "Opportunites" WHERE id=$1 RETURNING *`,
      { bind: [id], type: QueryTypes.DELETE }
    );

    // ⚡ Ici, result est directement un tableau de lignes supprimées
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Opportunité introuvable' });
    }

    res.json({ message: 'Opportunité supprimée', opportunite: result[0] });
  } catch (err) {
    console.error('Erreur DELETE /opportunites', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;
