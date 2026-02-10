// src/routes/categories.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'erpcrm',
  password: 'Jenoubliepas0987654321',
  port: 5432,
});

// ✅ GET: Liste des catégories depuis les produits
router.get('/', async (req, res) => {
  try {
    const userSchema = req.userSchema || 'public';
    
    console.log(`🔐 [CATÉGORIES] GET / pour schéma: ${userSchema}`);
    
    // Vérifier si la table produits existe
    const tableExists = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'produits'
      )`,
      [userSchema]
    );
    
    if (!tableExists.rows[0].exists) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }
    
    // Récupérer les catégories distinctes
    const result = await pool.query(
      `SELECT DISTINCT categorie 
       FROM "${userSchema}".produits 
       WHERE categorie IS NOT NULL AND categorie != ''
       ORDER BY categorie`
    );
    
    const categories = result.rows.map(row => row.categorie);
    
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
    
  } catch (error) {
    console.error('❌ Erreur GET /categories:', error);
    res.json({
      success: true,
      data: [],
      count: 0
    });
  }
});

// ✅ POST: Créer une nouvelle catégorie
router.post('/', async (req, res) => {
  try {
    const { nom } = req.body;
    const userSchema = req.userSchema || 'public';
    
    console.log(`🔐 [CATÉGORIES] POST / pour schéma: ${userSchema}`, { nom });
    
    if (!nom || nom.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nom de catégorie requis'
      });
    }
    
    // Note: Dans cette implémentation simple, on ne stocke pas les catégories
    // dans une table séparée. Les catégories sont extraites des produits.
    // Vous pourriez créer une table categories si nécessaire.
    
    res.json({
      success: true,
      data: { nom: nom.trim() },
      message: 'Catégorie créée avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur POST /categories:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// ✅ GET: Vérifier si une catégorie existe
router.get('/exists/:nom', async (req, res) => {
  try {
    const { nom } = req.params;
    const userSchema = req.userSchema || 'public';
    
    // Vérifier si la table produits existe
    const tableExists = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'produits'
      )`,
      [userSchema]
    );
    
    if (!tableExists.rows[0].exists) {
      return res.json({
        success: true,
        exists: false
      });
    }
    
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM "${userSchema}".produits 
        WHERE LOWER(categorie) = LOWER($1)
      )`,
      [nom]
    );
    
    res.json({
      success: true,
      exists: result.rows[0].exists
    });
    
  } catch (error) {
    console.error('❌ Erreur GET /categories/exists/:nom:', error);
    res.json({
      success: false,
      exists: false
    });
  }
});

module.exports = router;