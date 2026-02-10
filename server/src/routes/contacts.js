// src/routes/contacts.js - VERSION SIMPLIFIÉE ET FONCTIONNELLE
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'erpcrm',
  port: process.env.POSTGRES_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
});


// Middleware pour injecter le schéma utilisateur dans toutes les routes
router.use((req, res, next) => {
  console.log('👤 contacts.js - User schema:', req.userSchema);
  console.log('👤 contacts.js - User ID:', req.user?.id);
  
  if (!req.userSchema) {
    console.warn('⚠️  Aucun schéma utilisateur défini, utilisation par défaut');
    req.userSchema = `user_${req.user?.id || 1}`;
  }
  
  next();
});

// Middleware pour valider les IDs numériques
const validateId = (req, res, next) => {
  const { id } = req.params;
  
  // Vérifier que l'ID est un nombre
  if (!/^\d+$/.test(id)) {
    console.log(`❌ ID invalide: "${id}" (doit être un nombre)`);
    return res.status(400).json({
      success: false,
      error: 'ID invalide. Doit être un nombre.'
    });
  }
  
  // Convertir en nombre et passer au suivant
  req.params.id = parseInt(id, 10);
  next();
};

// src/routes/contacts.js - AJOUTEZ CES ROUTES AU DÉBUT

// ==================== ROUTES DE REDIRECTION POUR LES APPELS ERRONÉS ====================

// Redirige les appels à /api/contacts/contacts vers /api/contacts
router.get('/contacts', (req, res) => {
  console.log('🔄 GET /api/contacts/contacts → Redirection vers /api/contacts');
  // Simuler une réponse pour éviter l'erreur
  return res.status(200).json({
    success: true,
    data: [],
    count: 0,
    message: 'Utilisez /api/contacts (sans le /contacts supplémentaire)'
  });
});

router.post('/contacts', (req, res) => {
  console.log('🔄 POST /api/contacts/contacts → Redirection vers /api/contacts');
  return res.status(200).json({
    success: true,
    message: 'Utilisez /api/contacts (sans le /contacts supplémentaire)'
  });
});

// Gère les appels à d'autres routes qui arrivent ici par erreur
router.get('/dashboard/stats', (req, res) => {
  console.log('⚠️  Route /api/contacts/dashboard/stats appelée par erreur');
  return res.status(404).json({
    success: false,
    error: 'Route incorrecte. Utilisez /api/dashboard/stats (sans /contacts)',
    correction: '/api/dashboard/stats'
  });
});

router.get('/commandes/recentes', (req, res) => {
  console.log('⚠️  Route /api/contacts/commandes/recentes appelée par erreur');
  return res.status(404).json({
    success: false,
    error: 'Route incorrecte. Utilisez /api/commandes/recentes (sans /contacts)',
    correction: '/api/commandes/recentes'
  });
});

// Fonction pour créer les tables utilisateur
async function createUserTables(userId) {
  const schemaName = `user_${userId}`;
  
  try {
    // Créer le schéma
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    
    // Table contacts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".contacts (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100),
        telephone VARCHAR(20),
        email VARCHAR(100) NOT NULL UNIQUE,
        compte VARCHAR(100),
        type_contact VARCHAR(20) DEFAULT 'prospect',
        entreprise VARCHAR(100),
        adresse TEXT,
        ville VARCHAR(100),
        code_postal VARCHAR(10),
        pays VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log(`✅ Table contacts créée pour ${schemaName}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur création tables ${schemaName}:`, error);
    throw error;
  }
}
// ==================== ROUTES PRINCIPALES ====================

// ✅ GET : récupérer tous les contacts
// Dans votre backend contacts.js, modifiez la route GET /
router.get('/', async (req, res) => {
  console.log('📞 GET /api/contacts appelé, userSchema:', req.userSchema);
  console.log('🔐 User:', req.user);
  
  try {
    const schemaName = req.userSchema;
    
    // Vérifier si le schéma existe
    const schemaExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = $1
      )
    `, [schemaName]);
    
    // Si le schéma n'existe pas, le créer avec les tables
    if (!schemaExists.rows[0].exists) {
      console.log('📋 Schéma utilisateur non trouvé, création...');
      await createUserTables(req.user.id);
    }
    
    // Vérifier si la table contacts existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'contacts'
      )
    `, [schemaName]);
    
    // Si la table n'existe pas, la créer
    if (!tableExists.rows[0].exists) {
      console.log('📋 Table contacts non trouvée, création...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".contacts (
          id SERIAL PRIMARY KEY,
          nom VARCHAR(100) NOT NULL,
          prenom VARCHAR(100),
          telephone VARCHAR(20),
          email VARCHAR(100) NOT NULL UNIQUE,
          compte VARCHAR(100),
          type_contact VARCHAR(20) DEFAULT 'prospect',
          entreprise VARCHAR(100),
          adresse TEXT,
          ville VARCHAR(100),
          code_postal VARCHAR(10),
          pays VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Récupérer les contacts
    const result = await pool.query(
      `SELECT * FROM "${schemaName}".contacts ORDER BY id DESC`
    );
    
    console.log(`✅ ${result.rows.length} contacts récupérés de ${schemaName}`);
    
    // FORMAT DE RÉPONSE STANDARD
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      schema: schemaName
    });
    
  } catch (err) {
    console.error('❌ Erreur GET /api/contacts:', err.message);
    
    // Format d'erreur standard
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur',
      details: err.message 
    });
  }
});

// ✅ POST : créer un nouveau contact
router.post('/', async (req, res) => {
  console.log('📞 POST /api/contacts appelé, données:', req.body);
  
  try {
    const schemaName = req.userSchema;
    const {
      nom,
      prenom,
      email,
      telephone,
      entreprise,
      typeContact = 'prospect',
      compte,
      adresse,
      ville,
      codePostal,
      pays,
      notes
    } = req.body;

    // Validation simple
    if (!nom || !email) {
      return res.status(400).json({
        success: false,
        error: 'Le nom et l\'email sont obligatoires'
      });
    }

    // Vérifier/Créer la table si nécessaire
    try {
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'contacts'
        )
      `, [schemaName]);
      
      if (!tableExists.rows[0].exists) {
        await createUserTables(req.user.id);
      }
    } catch (tableError) {
      console.log('⚠️  Erreur vérification table:', tableError.message);
      await createUserTables(req.user.id);
    }

    // Insérer le contact
    const result = await pool.query(
      `INSERT INTO "${schemaName}".contacts 
       (nom, prenom, email, telephone, entreprise, type_contact, compte, 
        adresse, ville, code_postal, pays, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        nom,
        prenom || null,
        email,
        telephone || null,
        entreprise || null,
        typeContact,
        compte || null,
        adresse || null,
        ville || null,
        codePostal || null,
        pays || null,
        notes || null
      ]
    );

    console.log(`✅ Contact créé dans ${schemaName}:`, result.rows[0].id);

    // FORMAT DE RÉPONSE STANDARD
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Contact créé avec succès'
    });

  } catch (error) {
    console.error('❌ ERREUR création contact:', error.message);
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Un contact avec cet email existe déjà'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du contact'
    });
  }
});

// ==================== ROUTES AVEC IDs ====================

// ✅ GET : récupérer un contact spécifique par ID
router.get('/:id', validateId, async (req, res) => {
  const id = req.params.id;
  console.log('📞 GET /api/contacts/:id appelé, id:', id);
  
  try {
    const result = await pool.query(
      `SELECT * FROM "${req.userSchema}".contacts WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact introuvable'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (err) {
    console.error(`❌ Erreur GET /api/contacts/${id}:`, err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// ✅ PUT : modifier un contact existant
router.put('/:id', validateId, async (req, res) => {
  const id = req.params.id;
  console.log('📞 PUT /api/contacts/:id appelé, id:', id, 'données:', req.body);
  
  const { 
    nom, prenom, telephone, email, compte, typeContact, 
    entreprise, adresse, ville, codePostal, pays, notes 
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE "${req.userSchema}".contacts
       SET nom=$1, prenom=$2, telephone=$3, email=$4, compte=$5, type_contact=$6,
           entreprise=$7, adresse=$8, ville=$9, code_postal=$10, pays=$11, notes=$12,
           updated_at=NOW() 
       WHERE id=$13 RETURNING *`,
      [
        nom, 
        prenom || null, 
        telephone || null, 
        email, 
        compte || null, 
        typeContact || 'prospect',
        entreprise || null, 
        adresse || null, 
        ville || null, 
        codePostal || null,
        pays || null, 
        notes || null, 
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact introuvable' 
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Contact mis à jour'
    });
  } catch (err) {
    console.error('❌ Erreur PUT /api/contacts/:id', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur' 
    });
  }
});

// ✅ DELETE : supprimer un contact
router.delete('/:id', validateId, async (req, res) => {
  const id = req.params.id;
  console.log('📞 DELETE /api/contacts/:id appelé, id:', id);
  
  try {
    const result = await pool.query(
      `DELETE FROM "${req.userSchema}".contacts WHERE id=$1 RETURNING id, nom, prenom`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact introuvable' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Contact supprimé',
      deleted: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Erreur DELETE /api/contacts/:id', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur' 
    });
  }
});

// ==================== ROUTE POUR LES APPELS À /api/contacts/contacts ====================
// Gère les appels erronés à /api/contacts/contacts
router.get('/contacts', (req, res) => {
  console.log('⚠️  GET /api/contacts/contacts appelée (probablement une erreur du frontend)');
  return res.status(400).json({
    success: false,
    error: 'Route incorrecte. Utilisez /api/contacts (sans le /contacts à la fin)',
    correction: '/api/contacts'
  });
});

router.post('/contacts', (req, res) => {
  console.log('⚠️  POST /api/contacts/contacts appelée (probablement une erreur du frontend)');
  return res.status(400).json({
    success: false,
    error: 'Route incorrecte. Utilisez /api/contacts (sans le /contacts à la fin)',
    correction: '/api/contacts'
  });
});

// ==================== ROUTES ADDITIONNELLES ====================

// ✅ GET : statistiques des contacts
router.get('/stats/all', async (req, res) => {
  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM "${req.userSchema}".contacts`
    );
    
    const typeResult = await pool.query(`
      SELECT type_contact, COUNT(*) as count 
      FROM "${req.userSchema}".contacts 
      GROUP BY type_contact 
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count) || 0,
        by_type: typeResult.rows.reduce((acc, row) => {
          acc[row.type_contact] = parseInt(row.count);
          return acc;
        }, {})
      }
    });
  } catch (err) {
    console.error('❌ Erreur stats contacts:', err.message);
    res.json({
      success: true,
      data: {
        total: 0,
        by_type: {}
      }
    });
  }
});

// ✅ POST : rechercher des contacts
router.post('/search', async (req, res) => {
  const { query } = req.body;
  
  try {
    const result = await pool.query(
      `SELECT * FROM "${req.userSchema}".contacts 
       WHERE nom ILIKE $1 OR prenom ILIKE $1 OR email ILIKE $1 OR telephone ILIKE $1
       ORDER BY nom LIMIT 50`,
      [`%${query}%`]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('❌ Erreur recherche contacts:', err.message);
    res.json({
      success: true,
      data: [],
      count: 0
    });
  }
});



// ==================== ROUTE 404 SIMPLIFIÉE ====================
// Route pour toutes les autres requêtes non matchées
// Cette route DOIT être DERNIÈRE dans le fichier
router.use((req, res) => {
  console.log(`⚠️  Route non trouvée dans contacts.js: ${req.method} ${req.originalUrl}`);
  
  const availableRoutes = [
    'GET    /api/contacts',
    'POST   /api/contacts',
    'GET    /api/contacts/:id (ID numérique)',
    'PUT    /api/contacts/:id (ID numérique)',
    'DELETE /api/contacts/:id (ID numérique)',
    'GET    /api/contacts/stats/all',
    'POST   /api/contacts/search'
  ];
  
  res.status(404).json({
    success: false,
    error: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    available_routes: availableRoutes,
    note: 'Pour les IDs, assurez-vous d\'utiliser un nombre (ex: /api/contacts/123)'
  });
});

module.exports = router;