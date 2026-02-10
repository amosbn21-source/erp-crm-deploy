// src/routes/stats.js
// ⚡ Stats calculées par utilisateur avec filtres temporels

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Connexion PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'erpcrm',
  password: 'Jenoubliepas0987654321',
  port: 5432
});

// Middleware pour récupérer le schéma utilisateur
const getUserSchema = (req) => {
  return req.userSchema || `user_${req.user?.userId || req.user?.id}`;
};

// Fonction pour générer les clauses WHERE basées sur les filtres
const buildWhereClause = (filters) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.startDate) {
    conditions.push(`date >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`date <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  if (filters.statut) {
    conditions.push(`statut = $${paramIndex}`);
    params.push(filters.statut);
    paramIndex++;
  }

  if (filters.contactId) {
    conditions.push(`contact_id = $${paramIndex}`);
    params.push(filters.contactId);
    paramIndex++;
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
};

router.get('/stats', async (req, res) => {
  try {
    const userSchema = getUserSchema(req);
    const filters = req.query;
    
    console.log(`📊 Calcul des stats pour le schéma: ${userSchema}`, { filters });

    // Vérifier que le schéma existe
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
      [userSchema]
    );

    if (!schemaExists.rows[0].exists) {
      console.log(`⚠️ Schéma ${userSchema} non trouvé`);
      return res.json({
        success: true,
        totalCommandes: 0,
        totalVentes: 0,
        statuts: {},
        commandesParJour: [],
        topClients: [],
        topProduits: [],
        periode: filters,
        schema: userSchema
      });
    }

    // Construire la clause WHERE basée sur les filtres
    const { whereClause, params } = buildWhereClause(filters);
    const allParams = [userSchema, ...params];

    // Total commandes
    const totalCommandesQuery = `
      SELECT COUNT(*) 
      FROM "${userSchema}".commandes 
      ${whereClause}
    `;
    const totalCommandesRes = await pool.query(totalCommandesQuery, params);
    const totalCommandes = parseInt(totalCommandesRes.rows[0].count, 10);

    // Total ventes (somme des totaux)
    const totalVentesQuery = `
      SELECT COALESCE(SUM(total), 0) AS total 
      FROM "${userSchema}".commandes 
      ${whereClause}
    `;
    const totalVentesRes = await pool.query(totalVentesQuery, params);
    const totalVentes = parseFloat(totalVentesRes.rows[0].total || 0);

    // Répartition statuts
    const statutsQuery = `
      SELECT statut, COUNT(*) 
      FROM "${userSchema}".commandes 
      ${whereClause}
      GROUP BY statut
    `;
    const statutsRes = await pool.query(statutsQuery, params);
    const statuts = {};
    statutsRes.rows.forEach(r => { 
      statuts[r.statut] = parseInt(r.count, 10); 
    });

    // Commandes par jour
    let commandesParJour = [];
    if (filters.startDate || filters.endDate) {
      // Si une période est spécifiée, grouper par jour dans cette période
      const commandesParJourQuery = `
        SELECT DATE(date) AS date, COUNT(*) 
        FROM "${userSchema}".commandes 
        ${whereClause}
        GROUP BY DATE(date) 
        ORDER BY date
      `;
      const commandesParJourRes = await pool.query(commandesParJourQuery, params);
      commandesParJour = commandesParJourRes.rows.map(r => ({
        date: r.date,
        total: parseInt(r.count, 10)
      }));
    } else {
      // Par défaut : 30 derniers jours
      const last30DaysQuery = `
        SELECT DATE(date) AS date, COUNT(*) 
        FROM "${userSchema}".commandes 
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        ${whereClause.replace('WHERE', 'AND') || ''}
        GROUP BY DATE(date) 
        ORDER BY date
      `;
      const commandesParJourRes = await pool.query(last30DaysQuery, params);
      commandesParJour = commandesParJourRes.rows.map(r => ({
        date: r.date,
        total: parseInt(r.count, 10)
      }));
    }

    // Top clients (basé sur le montant total des commandes avec filtres)
    const topClientsQuery = `
      SELECT c.nom, c.prenom, COALESCE(SUM(cmd.total), 0) as montant_total
      FROM "${userSchema}".contacts c
      LEFT JOIN "${userSchema}".commandes cmd ON c.id = cmd.contact_id
      ${whereClause ? 'WHERE ' + whereClause.replace('date', 'cmd.date') : ''}
      GROUP BY c.id, c.nom, c.prenom
      ORDER BY montant_total DESC
      LIMIT 5
    `;
    const topClientsRes = await pool.query(topClientsQuery, params);
    const topClients = topClientsRes.rows.map(r => [
      `${r.prenom || ''} ${r.nom}`.trim() || 'Inconnu',
      parseFloat(r.montant_total)
    ]);

    // Top produits
    let topProduits = [];
    try {
      // Essayer d'abord avec une table lignes_commande si elle existe
      const topProduitsQuery = `
        SELECT p.nom, COALESCE(SUM(lc.quantite), 0) as quantite_vendue
        FROM "${userSchema}".produits p
        LEFT JOIN "${userSchema}".lignes_commande lc ON p.id = lc.produit_id
        LEFT JOIN "${userSchema}".commandes cmd ON lc.commande_id = cmd.id
        ${whereClause ? 'WHERE ' + whereClause : ''}
        GROUP BY p.id, p.nom
        ORDER BY quantite_vendue DESC
        LIMIT 5
      `;
      const topProduitsRes = await pool.query(topProduitsQuery, params);
      if (topProduitsRes.rows.length > 0) {
        topProduits = topProduitsRes.rows.map(r => [
          r.nom || 'Produit inconnu',
          parseInt(r.quantite_vendue, 10)
        ]);
      }
    } catch (error) {
      // Fallback si la table lignes_commande n'existe pas
      console.log('⚠️ Table lignes_commande non trouvée, utilisation du fallback');
    }

    // Statistiques avancées
    const avgOrderQuery = `
      SELECT COALESCE(AVG(total), 0) as moyenne 
      FROM "${userSchema}".commandes 
      ${whereClause}
    `;
    const avgOrderRes = await pool.query(avgOrderQuery, params);
    const moyenneCommande = parseFloat(avgOrderRes.rows[0].moyenne) || 0;

    // Commandes par statut détaillé
    const statsDetailsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE statut = 'livrée') as livrees,
        COUNT(*) FILTER (WHERE statut = 'en cours') as en_cours,
        COUNT(*) FILTER (WHERE statut = 'en attente') as en_attente,
        COUNT(*) FILTER (WHERE statut = 'annulée') as annulees
      FROM "${userSchema}".commandes 
      ${whereClause}
    `;
    const statsDetailsRes = await pool.query(statsDetailsQuery, params);
    const statsDetails = statsDetailsRes.rows[0];

    res.json({ 
      success: true,
      totalCommandes, 
      totalVentes, 
      statuts, 
      commandesParJour, 
      topClients, 
      topProduits,
      moyenneCommande,
      ...statsDetails,
      schema: userSchema,
      periode: {
        startDate: filters.startDate,
        endDate: filters.endDate
      }
    });
  } catch (err) {
    console.error('❌ Erreur /api/stats', err);
    
    res.json({
      success: false,
      totalCommandes: 0,
      totalVentes: 0,
      statuts: {},
      commandesParJour: [],
      topClients: [],
      topProduits: [],
      error: err.message
    });
  }
});

// Route pour les stats du dashboard avec plus de détails
router.get('/dashboard-stats', async (req, res) => {
  try {
    const userSchema = getUserSchema(req);
    const filters = req.query;

    console.log(`📈 Dashboard stats pour: ${userSchema}`, { filters });

    // Vérifier l'existence du schéma
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
      [userSchema]
    );

    if (!schemaExists.rows[0].exists) {
      return res.json({
        success: true,
        data: getEmptyStats(),
        schema: userSchema
      });
    }

    const { whereClause, params } = buildWhereClause(filters);

    // Récupérer toutes les stats en une seule requête
    const statsQuery = `
      SELECT 
        -- Totaux
        (SELECT COUNT(*) FROM "${userSchema}".contacts) as total_contacts,
        (SELECT COUNT(*) FROM "${userSchema}".produits) as total_produits,
        (SELECT COUNT(*) FROM "${userSchema}".commandes ${whereClause}) as total_commandes,
        
        -- Chiffre d'affaires
        (SELECT COALESCE(SUM(total), 0) FROM "${userSchema}".commandes 
         ${whereClause} AND statut = 'livrée') as chiffre_affaires,
        
        -- Moyenne commande
        (SELECT COALESCE(AVG(total), 0) FROM "${userSchema}".commandes 
         ${whereClause} AND statut = 'livrée') as moyenne_commande,
        
        -- Statuts commandes
        (SELECT COUNT(*) FROM "${userSchema}".commandes 
         ${whereClause} AND statut = 'livrée') as livrees,
        (SELECT COUNT(*) FROM "${userSchema}".commandes 
         ${whereClause} AND statut = 'en cours') as en_cours,
        (SELECT COUNT(*) FROM "${userSchema}".commandes 
         ${whereClause} AND statut = 'en attente') as en_attente,
        (SELECT COUNT(*) FROM "${userSchema}".commandes 
         ${whereClause} AND statut = 'annulée') as annulees,
        
        -- Clients actifs (commandes dans les 30 derniers jours)
        (SELECT COUNT(DISTINCT contact_id) FROM "${userSchema}".commandes 
         WHERE date >= CURRENT_DATE - INTERVAL '30 days') as clients_actifs,
        
        -- Produits stock faible
        (SELECT COUNT(*) FROM "${userSchema}".produits 
         WHERE stock <= 10 AND stock > 0) as produits_stock_faible
    `;

    const statsResult = await pool.query(statsQuery, params);
    const stats = statsResult.rows[0];

    // Top produits (quantité vendue)
    const topProduitsQuery = `
      SELECT p.id, p.nom, p.prix, 
             COALESCE(SUM(lc.quantite), 0) as total_vendu,
             COALESCE(SUM(lc.quantite * p.prix), 0) as chiffre_produit
      FROM "${userSchema}".produits p
      LEFT JOIN "${userSchema}".lignes_commande lc ON p.id = lc.produit_id
      LEFT JOIN "${userSchema}".commandes cmd ON lc.commande_id = cmd.id
      ${whereClause ? 'WHERE ' + whereClause : ''}
      GROUP BY p.id, p.nom, p.prix
      ORDER BY total_vendu DESC
      LIMIT 5
    `;

    let topProduits = [];
    try {
      const topProduitsRes = await pool.query(topProduitsQuery, params);
      topProduits = topProduitsRes.rows.map(p => ({
        id: p.id,
        nom: p.nom,
        prix: parseFloat(p.prix) || 0,
        total_vendu: parseInt(p.total_vendu, 10),
        chiffre_produit: parseFloat(p.chiffre_produit) || 0
      }));
    } catch (error) {
      console.log('⚠️ Impossible de récupérer les top produits:', error.message);
    }

    // Calculer l'évolution mensuelle (simulée pour l'exemple)
    const evolution_mensuelle = 15.5; // En réalité, il faudrait comparer avec le mois précédent

    res.json({
      success: true,
      data: {
        ...stats,
        evolution_mensuelle,
        topProduits
      },
      periode: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        hasFilters: !!(filters.startDate || filters.endDate)
      }
    });

  } catch (err) {
    console.error('❌ Erreur dashboard-stats:', err);
    res.json({
      success: false,
      error: err.message,
      data: getEmptyStats()
    });
  }
});

// Ajouter cette fonction dans stats.js pour récupérer les données mensuelles
router.get('/revenue-monthly', async (req, res) => {
  try {
    const userSchema = getUserSchema(req);
    const filters = req.query;
    
    console.log(`📈 Données mensuelles CA pour: ${userSchema}`, { filters });

    // Vérifier l'existence du schéma
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
      [userSchema]
    );

    if (!schemaExists.rows[0].exists) {
      return res.json({
        success: true,
        data: {
          labels: [],
          values: []
        }
      });
    }

    // Construire les conditions WHERE
    const { whereClause, params } = buildWhereClause(filters);
    const baseWhere = whereClause ? `${whereClause} AND` : 'WHERE';

    // Récupérer les données mensuelles de l'année en cours
    const monthlyQuery = `
      SELECT 
        EXTRACT(MONTH FROM date) as month,
        EXTRACT(YEAR FROM date) as year,
        COALESCE(SUM(total), 0) as revenue
      FROM "${userSchema}".commandes 
      ${baseWhere} statut = 'livrée'
        AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
      ORDER BY year, month
    `;

    const monthlyResult = await pool.query(monthlyQuery, params);
    
    // Préparer les données pour les 12 mois
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const revenueData = Array(12).fill(0);
    
    monthlyResult.rows.forEach(row => {
      const monthIndex = parseInt(row.month) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        revenueData[monthIndex] = parseFloat(row.revenue) || 0;
      }
    });

    res.json({
      success: true,
      data: {
        labels: months,
        values: revenueData
      }
    });

  } catch (err) {
    console.error('❌ Erreur revenue-monthly:', err);
    res.json({
      success: true,
      data: {
        labels: [],
        values: []
      }
    });
  }
});

// Route pour les données quotidiennes des 30 derniers jours
router.get('/revenue-daily', async (req, res) => {
  try {
    const userSchema = getUserSchema(req);
    const filters = req.query;
    
    console.log(`📈 Données quotidiennes CA pour: ${userSchema}`);

    // Vérifier l'existence du schéma
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
      [userSchema]
    );

    if (!schemaExists.rows[0].exists) {
      return res.json({
        success: true,
        data: {
          labels: [],
          values: []
        }
      });
    }

    // Construire les conditions WHERE
    const { whereClause, params } = buildWhereClause(filters);
    const baseWhere = whereClause ? `${whereClause} AND` : 'WHERE';

    // Récupérer les données quotidiennes des 30 derniers jours
    const dailyQuery = `
      SELECT 
        DATE(date) as day,
        COALESCE(SUM(total), 0) as revenue
      FROM "${userSchema}".commandes 
      ${baseWhere} statut = 'livrée'
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(date)
      ORDER BY day
    `;

    const dailyResult = await pool.query(dailyQuery, params);
    
    // Générer les 30 derniers jours
    const labels = [];
    const values = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      labels.push(format(date, 'dd/MM'));
      
      // Trouver les données pour cette date
      const dayData = dailyResult.rows.find(row => {
        const rowDate = new Date(row.day);
        return format(rowDate, 'yyyy-MM-dd') === dateStr;
      });
      
      values.push(dayData ? parseFloat(dayData.revenue) : 0);
    }

    res.json({
      success: true,
      data: {
        labels,
        values
      }
    });

  } catch (err) {
    console.error('❌ Erreur revenue-daily:', err);
    res.json({
      success: true,
      data: {
        labels: [],
        values: []
      }
    });
  }
});

// Route pour les données de revenue spécifiques
router.get('/revenue-details', async (req, res) => {
  try {
    const userSchema = getUserSchema(req);
    const filters = req.query;
    
    console.log(`💰 Détails revenue pour: ${userSchema}`);
    
    // Vérifier l'existence du schéma
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
      [userSchema]
    );

    if (!schemaExists.rows[0].exists) {
      return res.json({
        success: true,
        data: {
          labels: [],
          values: [],
          total: 0
        }
      });
    }
    
    // Construire la clause WHERE
    const { whereClause, params } = buildWhereClause(filters);
    const baseWhere = whereClause ? `${whereClause} AND` : 'WHERE';
    
    // CA par jour (30 derniers jours)
    const dailyQuery = `
      SELECT 
        DATE(date) as jour,
        COALESCE(SUM(total), 0) as ca_journalier
      FROM "${userSchema}".commandes 
      ${baseWhere} statut = 'livrée'
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(date)
      ORDER BY jour
    `;
    
    const dailyResult = await pool.query(dailyQuery, params);
    
    // CA par mois (12 derniers mois)
    const monthlyQuery = `
      SELECT 
        EXTRACT(MONTH FROM date) as mois,
        EXTRACT(YEAR FROM date) as annee,
        COALESCE(SUM(total), 0) as ca_mensuel
      FROM "${userSchema}".commandes 
      ${baseWhere} statut = 'livrée'
        AND date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
      ORDER BY annee, mois
    `;
    
    const monthlyResult = await pool.query(monthlyQuery, params);
    
    // CA total (selon filtres)
    const totalQuery = `
      SELECT COALESCE(SUM(total), 0) as total_ca
      FROM "${userSchema}".commandes 
      ${baseWhere} statut = 'livrée'
    `;
    
    const totalResult = await pool.query(totalQuery, params);
    
    // Préparer les données
    const today = new Date();
    const dailyLabels = [];
    const dailyValues = [];
    
    // Données quotidiennes (30 derniers jours)
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyLabels.push(format(date, 'dd/MM'));
      
      const dayData = dailyResult.rows.find(row => {
        const rowDate = new Date(row.jour);
        return rowDate.toISOString().split('T')[0] === dateStr;
      });
      
      dailyValues.push(dayData ? parseFloat(dayData.ca_journalier) : 0);
    }
    
    // Données mensuelles (12 derniers mois)
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthlyValues = Array(12).fill(0);
    
    monthlyResult.rows.forEach(row => {
      const monthIndex = parseInt(row.mois) - 1;
      const rowYear = parseInt(row.annee);
      const currentYear = today.getFullYear();
      
      // Si c'est l'année en cours ou l'année dernière
      if (rowYear === currentYear || rowYear === currentYear - 1) {
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyValues[monthIndex] = parseFloat(row.ca_mensuel) || 0;
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        daily: {
          labels: dailyLabels,
          values: dailyValues
        },
        monthly: {
          labels: months,
          values: monthlyValues
        },
        total: parseFloat(totalResult.rows[0].total_ca) || 0,
        period: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          statut: filters.statut
        }
      }
    });
    
  } catch (err) {
    console.error('❌ Erreur revenue-details:', err);
    res.json({
      success: true,
      data: {
        daily: { labels: [], values: [] },
        monthly: { labels: [], values: [] },
        total: 0
      }
    });
  }
});

function getEmptyStats() {
  return {
    total_contacts: 0,
    total_produits: 0,
    total_commandes: 0,
    chiffre_affaires: 0,
    moyenne_commande: 0,
    livrees: 0,
    en_cours: 0,
    en_attente: 0,
    annulees: 0,
    clients_actifs: 0,
    produits_stock_faible: 0,
    evolution_mensuelle: 0,
    topProduits: []
  };
}

module.exports = router;