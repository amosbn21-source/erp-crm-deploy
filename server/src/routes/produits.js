// routes/produits.js
// ⚡ Gestion des produits avec isolation des données par schéma utilisateur
// Version corrigée : chaque utilisateur voit uniquement ses propres données

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path'); 
const fs = require('fs');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'erpcrm',
  password: 'Jenoubliepas0987654321',
  port: 5432,
});

// ⚡ Configuration du répertoire d'upload
const uploadDir = path.resolve(__dirname, '..', '..', 'uploads');

// ⚡ Création du répertoire s'il n'existe pas
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚡ Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const filename = `${base}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ✅ Fonction utilitaire pour obtenir le schéma utilisateur
const getUserSchema = (req) => {
  // Récupère le schéma depuis le middleware enforceDataIsolation
  if (req.userSchema && req.userSchema !== 'public') {
    return req.userSchema;
  }
  
  // Fallback: construit le schéma depuis l'ID utilisateur
  if (req.user && req.user.userId) {
    return `user_${req.user.userId}`;
  }
  
  if (req.user && req.user.id) {
    return `user_${req.user.id}`;
  }
  
  // Schéma par défaut (ne devrait jamais arriver avec l'authentification)
  return 'public';
};

// ✅ Vérifier et créer la table produits si nécessaire
const ensureProduitsTable = async (schemaName) => {
  try {
    // Vérifier si le schéma existe
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = $1)`,
      [schemaName]
    );
    
    if (!schemaExists.rows[0].exists) {
      console.log(`📋 Création du schéma ${schemaName}...`);
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    }
    
    // Vérifier si la table produits existe
    const tableExists = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'produits'
      )`,
      [schemaName]
    );
    
    if (!tableExists.rows[0].exists) {
      console.log(`📋 Création de la table produits dans ${schemaName}...`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".produits (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(200) NOT NULL,
          description TEXT,
          prix DECIMAL(10, 2) NOT NULL,
          stock INTEGER DEFAULT 0,
          image VARCHAR(255),
          code_barres VARCHAR(50),
          categorie VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Erreur création table produits pour ${schemaName}:`, error);
    return false;
  }
};

// ✅ GET tous les produits avec filtres
router.get('/', async (req, res) => {
  const { categorie, search } = req.query;
  const userSchema = getUserSchema(req);
  
  console.log(`🔐 [PRODUITS] User ${req.user?.email || 'inconnu'} accède au schéma: ${userSchema}`);
  
  try {
    // S'assurer que la table existe
    await ensureProduitsTable(userSchema);
    
    let query = `SELECT * FROM "${userSchema}".produits WHERE 1=1`;
    const params = [];
    
    if (categorie && categorie !== '') {
      params.push(categorie);
      query += ` AND categorie = $${params.length}`;
    }
    
    if (search && search !== '') {
      params.push(`%${search}%`);
      query += ` AND (LOWER(nom) LIKE LOWER($${params.length}) OR LOWER(description) LIKE LOWER($${params.length}))`;
    }
    
    query += ` ORDER BY id DESC`;
    
    const result = await pool.query(query, params);
    
    console.log(`✅ [PRODUITS] ${result.rows.length} produits trouvés dans ${userSchema}`);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      schema: userSchema
    });
    
  } catch (error) {
    console.error(`❌ Erreur GET /produits pour ${userSchema}:`, error);
    
    if (error.message.includes('n\'existe pas') || error.code === '42P01') {
      // Table n'existe pas, créer et retourner vide
      await ensureProduitsTable(userSchema);
      return res.json({
        success: true,
        data: [],
        count: 0,
        schema: userSchema
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      schema: userSchema
    });
  }
});

// ✅ GET un produit par ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userSchema = getUserSchema(req);
  
  console.log(`🔐 [PRODUITS] GET /${id} pour schéma: ${userSchema}`);
  
  try {
    const result = await pool.query(
      `SELECT * FROM "${userSchema}".produits WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Produit introuvable',
        schema: userSchema
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error(`❌ Erreur GET /produits/${id} pour ${userSchema}:`, error);
    
    if (error.message.includes('n\'existe pas') || error.code === '42P01') {
      await ensureProduitsTable(userSchema);
      return res.status(404).json({
        success: false,
        error: 'Produit introuvable',
        schema: userSchema
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// ✅ POST: créer un nouveau produit avec image optionnelle
router.post('/', upload.single('image'), async (req, res) => {
  const userSchema = getUserSchema(req);
  const { nom, description, prix, stock, codeBarres, categorie } = req.body;
  
  console.log(`🔐 [PRODUITS] POST / pour schéma: ${userSchema}`);
  console.log('📦 Données reçues:', { nom, description, prix, stock, codeBarres, categorie });
  
  if (!nom || !prix || !categorie) {
    return res.status(400).json({
      success: false,
      error: 'Nom, prix et catégorie sont obligatoires'
    });
  }
  
  try {
    // S'assurer que la table existe
    await ensureProduitsTable(userSchema);
    
    const imageFilename = req.file ? req.file.filename : null;
    
    const result = await pool.query(
      `INSERT INTO "${userSchema}".produits 
       (nom, description, prix, stock, image, code_barres, categorie, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        nom,
        description || '',
        parseFloat(prix) || 0,
        parseInt(stock) || 0,
        imageFilename,
        codeBarres || '',
        categorie
      ]
    );
    
    console.log(`✅ Produit créé dans ${userSchema}:`, result.rows[0].id);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error(`❌ Erreur POST /produits pour ${userSchema}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du produit'
    });
  }
});

// ✅ PUT: modifier un produit existant
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const userSchema = getUserSchema(req);
  const { nom, description, prix, stock, codeBarres, categorie } = req.body;
  const newImage = req.file ? req.file.filename : null;
  
  console.log(`🔐 [PRODUITS] PUT /${id} pour schéma: ${userSchema}`);
  
  try {
    // Si nouvelle image, supprimer l'ancienne
    if (newImage) {
      const oldResult = await pool.query(
        `SELECT image FROM "${userSchema}".produits WHERE id = $1`,
        [id]
      );
      
      if (oldResult.rows.length > 0 && oldResult.rows[0].image) {
        const oldImagePath = path.join(uploadDir, oldResult.rows[0].image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`🗑️ Ancienne image supprimée: ${oldResult.rows[0].image}`);
        }
      }
    }
    
    const result = await pool.query(
      `UPDATE "${userSchema}".produits
       SET nom = $1,
           description = $2,
           prix = $3,
           stock = $4,
           image = COALESCE($5, image),
           code_barres = $6,
           categorie = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        nom,
        description || '',
        parseFloat(prix) || 0,
        parseInt(stock) || 0,
        newImage,
        codeBarres || '',
        categorie,
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Produit introuvable'
      });
    }
    
    console.log(`✅ Produit ${id} modifié dans ${userSchema}`);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error(`❌ Erreur PUT /produits/${id} pour ${userSchema}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du produit'
    });
  }
});

// ✅ DELETE: supprimer un produit
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userSchema = getUserSchema(req);
  
  console.log(`🔐 [PRODUITS] DELETE /${id} pour schéma: ${userSchema}`);
  
  try {
    // Récupérer l'image avant suppression
    const produitResult = await pool.query(
      `SELECT image FROM "${userSchema}".produits WHERE id = $1`,
      [id]
    );
    
    if (produitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Produit introuvable'
      });
    }
    
    // Supprimer le produit
    const deleteResult = await pool.query(
      `DELETE FROM "${userSchema}".produits WHERE id = $1 RETURNING *`,
      [id]
    );
    
    // Supprimer l'image associée si elle existe
    if (produitResult.rows[0].image) {
      const imagePath = path.join(uploadDir, produitResult.rows[0].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️ Image supprimée: ${produitResult.rows[0].image}`);
      }
    }
    
    console.log(`✅ Produit ${id} supprimé de ${userSchema}`);
    
    res.json({
      success: true,
      message: 'Produit supprimé avec succès',
      data: deleteResult.rows[0]
    });
    
  } catch (error) {
    console.error(`❌ Erreur DELETE /produits/${id} pour ${userSchema}:`, error);
    
    if (error.code === '23503') { // Violation de clé étrangère
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer ce produit car il est utilisé dans des commandes'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du produit'
    });
  }
});

// ✅ PUT: Mettre à jour le stock d'un produit
router.put('/:id/stock', async (req, res) => {
  const { id } = req.params;
  const userSchema = getUserSchema(req);
  const { quantite } = req.body;
  
  if (!quantite) {
    return res.status(400).json({
      success: false,
      error: 'Quantité requise'
    });
  }
  
  try {
    const result = await pool.query(
      `UPDATE "${userSchema}".produits 
       SET stock = GREATEST(0, stock + $1), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [parseInt(quantite), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Produit introuvable'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error(`❌ Erreur PUT /produits/${id}/stock pour ${userSchema}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du stock'
    });
  }
});

// ✅ GET: Catégories disponibles
router.get('/categories/list', async (req, res) => {
  const userSchema = getUserSchema(req);
  
  console.log(`🔐 [CATÉGORIES] GET /categories/list pour schéma: ${userSchema}`);
  
  try {
    await ensureProduitsTable(userSchema);
    
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
    console.error(`❌ Erreur GET /categories/list pour ${userSchema}:`, error);
    res.json({
      success: true,
      data: [],
      count: 0
    });
  }
});

module.exports = router;