// routes/produits.js
// ⚡ Gestion des produits avec isolation des données par schéma utilisateur
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ⚡ Configuration du répertoire d'upload (défini dans server.js, on l'utilise tel quel)
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

const upload = multer({ storage: storage });


// ✅ Middleware pour obtenir le schéma utilisateur (déjà défini par enforceDataIsolation)
router.use((req, res, next) => {
  console.log('📦 produits.js - User schema:', req.userSchema);
  console.log('📦 produits.js - User ID:', req.user?.id);
  
  if (!req.userSchema) {
    console.warn('⚠️  Aucun schéma utilisateur défini, utilisation par défaut');
    req.userSchema = `user_${req.user?.id || 1}`;
  }
  
  next();
});

// Middleware pour valider les IDs numériques
const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'ID invalide. Doit être un nombre.'
    });
  }
  req.params.id = parseInt(id, 10);
  next();
};

// ✅ Vérifier et créer la table produits si nécessaire (utilise req.app.locals.pool)
const ensureProduitsTable = async (schemaName, pool) => {
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
          image TEXT,
          code_barres VARCHAR(50),
          categorie VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Après la création, s'assurer que le type est TEXT
    await pool.query(`
      ALTER TABLE "${schemaName}".produits 
      ALTER COLUMN image TYPE TEXT
    `);
    
    
    return true;
  } catch (error) {
    console.error(`❌ Erreur création table produits pour ${schemaName}:`, error);
    return false;
  }
};

// ✅ GET tous les produits avec filtres
router.get('/', async (req, res) => {
  const { categorie, search } = req.query;
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;
  
  console.log(`🔐 [PRODUITS] GET / pour schéma: ${userSchema}`);
  
  try {
    // S'assurer que la table existe
    await ensureProduitsTable(userSchema, pool);
    
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
    const rows = result.rows.map(row => {
      let imagesArray = [];
      try {
        imagesArray = JSON.parse(row.image || '[]');
      } catch {
        imagesArray = row.image ? [row.image] : [];
      }
      return {
        ...row,
        images: imagesArray,
        image: imagesArray[0] || null   // garde la première image pour compatibilité
      };
    });
    
    console.log(`✅ [PRODUITS] ${result.rows.length} produits trouvés dans ${userSchema}`);
    
    res.json({
      success: true,
      data: rows,
      count: result.rows.length,
      schema: userSchema
    });
    
  } catch (error) {
    console.error(`❌ Erreur GET /produits pour ${userSchema}:`, error);
    
    if (error.message.includes('n\'existe pas') || error.code === '42P01') {
      // Table n'existe pas, créer et retourner vide
      await ensureProduitsTable(userSchema, pool);
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
router.get('/:id', validateId, async (req, res) => {
  const { id } = req.params;
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;

  console.log(`🔐 [PRODUITS] GET /${id} pour schéma: ${userSchema}`);

  try {
    // S'assurer que la table existe (optionnel mais recommandé)
    await ensureProduitsTable(userSchema, pool);

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

    const product = result.rows[0];
    
    // Transformer la colonne 'image' (qui peut être JSON ou simple chaîne) en tableau 'images'
    let imagesArray = [];
    try {
      imagesArray = JSON.parse(product.image || '[]');
    } catch {
      // Si ce n'est pas du JSON valide, c'est probablement une ancienne donnée avec une seule image
      imagesArray = product.image ? [product.image] : [];
    }

    // Ajouter le champ 'images' et mettre à jour 'image' pour la compatibilité
    product.images = imagesArray;
    product.image = imagesArray[0] || null;

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error(`❌ Erreur GET /produits/${id} pour ${userSchema}:`, error);

    if (error.message.includes('n\'existe pas') || error.code === '42P01') {
      // Si la table n'existe pas, on la crée et on renvoie une erreur 404
      await ensureProduitsTable(userSchema, pool);
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
// ✅ POST: créer un nouveau produit avec plusieurs images
router.post('/', upload.array('images', 5), async (req, res) => {
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;
  const { nom, description, prix, stock, codeBarres, categorie } = req.body;

  // Validation
  if (!nom || !prix || !categorie) {
    return res.status(400).json({
      success: false,
      error: 'Nom, prix et catégorie sont obligatoires'
    });
  }

  try {
    await ensureProduitsTable(userSchema, pool);

    // Récupérer tous les noms de fichiers uploadés
    const imageFilenames = req.files ? req.files.map(f => f.filename) : [];
    // Stocker sous forme de chaîne JSON
    const imagesJson = JSON.stringify(imageFilenames);

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
        imagesJson,
        codeBarres || '',
        categorie
      ]
    );

    // Transformer le produit pour ajouter le champ 'images'
    const newProduct = result.rows[0];
    let imagesArray = [];
    try {
      imagesArray = JSON.parse(newProduct.image || '[]');
    } catch {
      imagesArray = newProduct.image ? [newProduct.image] : [];
    }
    newProduct.images = imagesArray;
    newProduct.image = imagesArray[0] || null;

    console.log(`✅ Produit créé dans ${userSchema}:`, newProduct.id);
    res.json({ success: true, data: newProduct });

  } catch (error) {
    console.error(`❌ Erreur POST /produits pour ${userSchema}:`, error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du produit' });
  }
});

// ✅ PUT: modifier un produit existant (gestion multiple images)
router.put('/:id', upload.array('images', 5), validateId, async (req, res) => {
  const { id } = req.params;
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;
  const { nom, description, prix, stock, codeBarres, categorie, existingImages } = req.body;

  // Parsing des images à conserver (envoyées par le frontend)
  let imagesToKeep = [];
  try {
    imagesToKeep = existingImages ? JSON.parse(existingImages) : [];
  } catch (e) {
    imagesToKeep = [];
  }

  console.log(`🔐 [PRODUITS] PUT /${id} pour schéma: ${userSchema}`);
  console.log('Images à conserver:', imagesToKeep);

  try {
    await ensureProduitsTable(userSchema, pool);

    // Récupérer l'ancien produit pour connaître les images actuelles
    const oldResult = await pool.query(
      `SELECT image FROM "${userSchema}".produits WHERE id = $1`,
      [id]
    );
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Produit introuvable' });
    }

    // Anciennes images (parse)
    let oldImages = [];
    try {
      oldImages = JSON.parse(oldResult.rows[0].image || '[]');
    } catch {
      oldImages = oldResult.rows[0].image ? [oldResult.rows[0].image] : [];
    }

    // Nouvelles images uploadées
    const newImageFilenames = req.files ? req.files.map(f => f.filename) : [];

    // Fusion : images conservées + nouvelles
    const updatedImages = [...imagesToKeep, ...newImageFilenames];

    // Supprimer les fichiers qui ne sont plus dans la liste finale
    const imagesToDelete = oldImages.filter(img => !updatedImages.includes(img));
    for (const img of imagesToDelete) {
      const imagePath = path.join(uploadDir, img);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️ Image supprimée: ${img}`);
      }
    }

    // Mise à jour de la base avec la nouvelle liste JSON
    const result = await pool.query(
      `UPDATE "${userSchema}".produits
       SET nom = $1,
           description = $2,
           prix = $3,
           stock = $4,
           image = $5,
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
        JSON.stringify(updatedImages),
        codeBarres || '',
        categorie,
        id
      ]
    );

    // Transformer le produit pour le frontend
    const updatedProduct = result.rows[0];
    let imagesArray = [];
    try {
      imagesArray = JSON.parse(updatedProduct.image || '[]');
    } catch {
      imagesArray = updatedProduct.image ? [updatedProduct.image] : [];
    }
    updatedProduct.images = imagesArray;
    updatedProduct.image = imagesArray[0] || null;

    console.log(`✅ Produit ${id} modifié dans ${userSchema}`);
    res.json({ success: true, data: updatedProduct });

  } catch (error) {
    console.error(`❌ Erreur PUT /produits/${id} pour ${userSchema}:`, error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification du produit' });
  }
});

// ✅ DELETE: supprimer un produit
router.delete('/:id', validateId, async (req, res) => {
  const { id } = req.params;
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;
  
  console.log(`🔐 [PRODUITS] DELETE /${id} pour schéma: ${userSchema}`);
  
  try {
    await ensureProduitsTable(userSchema, pool);
    // Récupérer l'image avant suppression
    const produitResult = await pool.query(
      `SELECT image FROM "${userSchema}".produits WHERE id = $1`,
      [id]
    );
    if (produitResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Produit introuvable' });
    }
    
    let images = [];
    try {
      images = JSON.parse(produitResult.rows[0].image || '[]');
    } catch {
      images = produitResult.rows[0].image ? [produitResult.rows[0].image] : [];
    }

    // Supprimer chaque fichier
    for (const img of images) {
      const imagePath = path.join(uploadDir, img);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️ Image supprimée: ${img}`);
      }
    }
    
    // Supprimer le produit
    const deleteResult = await pool.query(`DELETE FROM "${userSchema}".produits WHERE id = $1`, [id]);;
    
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
router.put('/:id/stock', validateId, async (req, res) => {
  const { id } = req.params;
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;
  const { quantite } = req.body;
  
  if (quantite === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Quantité requise'
    });
  }
  
  try {
    // ✅ S'assurer que la table existe
    await ensureProduitsTable(userSchema, pool);
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
  const userSchema = req.userSchema;
  const pool = req.app.locals.pool;
  
  console.log(`🔐 [CATÉGORIES] GET /categories/list pour schéma: ${userSchema}`);
  
  try {
    await ensureProduitsTable(userSchema, pool);
    
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
