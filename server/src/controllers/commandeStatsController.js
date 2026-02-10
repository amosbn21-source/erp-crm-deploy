// Import de Sequelize et de l'instance
const { Sequelize } = require('sequelize');
const { sequelize, Commande, CommandeProduits, Produit } = require('../models/index');
const { QueryTypes } = require('sequelize');

/**
 * GET : commandes par jour avec filtre de période
 * Exemple: /stats/commandes/par-jour?start=2025-01-01&end=2025-01-31
 */
exports.getCommandesParJour = async (req, res) => {
  try {
    const { start, end } = req.query;
    const where = {};
    if (start && end) {
      where.date = { [Sequelize.Op.between]: [start, end] };
    }

    const stats = await Commande.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('date')), 'jour'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'nb_commandes']
      ],
      where,
      group: ['jour'],
      order: [['jour', 'ASC']]
    });

    return res.json(stats);
  } catch (error) {
    console.error('Erreur stats par jour:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};


/**
 * GET : montant total des ventes
 * Retourne la somme des totaux de toutes les commandes
 */
exports.getTotalVentes = async (req, res) => {
  try {
    const total = await Commande.sum('total'); // ⚡ Somme des totaux
    return res.json({ total_ventes: total });
  } catch (error) {
    console.error('Erreur total ventes:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET : produits les plus commandés
 * Retourne le top 5 des produits par quantité totale commandée
 * ⚡ Implémentation robuste via SQL brut pour éviter les problèmes d'associations
 */
exports.getTopProduits = async (req, res) => {
  try {
    const results = await sequelize.query(
      `
      SELECT 
        cp."produitId" AS "produitId",
        SUM(cp."quantite") AS "quantite_totale",
        p."nom" AS "nom",
        p."prix" AS "prix"
      FROM "CommandeProduits" cp
      JOIN "Produits" p ON p."id" = cp."produitId"
      GROUP BY cp."produitId", p."nom", p."prix"
      ORDER BY SUM(cp."quantite") DESC
      LIMIT 5;
      `,
      { type: QueryTypes.SELECT } // ⚡ Retourne un tableau d'objets
    );

    return res.json(results);
  } catch (error) {
    console.error('Erreur top produits (SQL):', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
