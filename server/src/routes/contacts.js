// src/routes/contacts.js - VERSION CORRIGÉE (utilise le pool partagé)
const express = require('express');
const router = express.Router();

// Middleware pour injecter le schéma utilisateur (optionnel si déjà fait)
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
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ success: false, error: 'ID invalide. Doit être un nombre.' });
  }
  req.params.id = parseInt(id, 10);
  next();
};

// Fonction pour créer les tables utilisateur (avec le pool fourni)
async function createUserTables(userId, pool) {
  const schemaName = `user_${userId}`;
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
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

// GET : tous les contacts
router.get('/', async (req, res) => {
  console.log('📞 GET /api/contacts appelé, userSchema:', req.userSchema);
  const pool = req.app.locals.pool; // récupération du pool partagé
  try {
    const schemaName = req.userSchema;
    
    // Vérifier si le schéma existe
    const schemaExists = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = $1)`,
      [schemaName]
    );
    
    if (!schemaExists.rows[0].exists) {
      console.log('📋 Schéma utilisateur non trouvé, création...');
      await createUserTables(req.user.id, pool);
    } else {
      // Vérifier si la table contacts existe
      const tableExists = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'contacts')`,
        [schemaName]
      );
      if (!tableExists.rows[0].exists) {
        console.log('📋 Table contacts non trouvée, création...');
        await createUserTables(req.user.id, pool);
      }
    }
    
    const result = await pool.query(`SELECT * FROM "${schemaName}".contacts ORDER BY id DESC`);
    console.log(`✅ ${result.rows.length} contacts récupérés de ${schemaName}`);
    
    res.json({ success: true, data: result.rows, count: result.rows.length, schema: schemaName });
  } catch (err) {
    console.error('❌ Erreur GET /api/contacts:', err.message);
    res.status(500).json({ success: false, error: 'Erreur serveur', details: err.message });
  }
});

// POST : créer un nouveau contact
router.post('/', async (req, res) => {
  console.log('📞 POST /api/contacts appelé, données:', req.body);
  const pool = req.app.locals.pool;
  try {
    const schemaName = req.userSchema;
    const { nom, prenom, email, telephone, entreprise, typeContact = 'prospect', compte, adresse, ville, codePostal, pays, notes } = req.body;

    if (!nom || !email) {
      return res.status(400).json({ success: false, error: 'Le nom et l\'email sont obligatoires' });
    }

    // Vérifier/Créer la table si nécessaire
    const tableExists = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'contacts')`,
      [schemaName]
    );
    if (!tableExists.rows[0].exists) {
      await createUserTables(req.user.id, pool);
    }

    const result = await pool.query(
      `INSERT INTO "${schemaName}".contacts (nom, prenom, email, telephone, entreprise, type_contact, compte, adresse, ville, code_postal, pays, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`,
      [nom, prenom || null, email, telephone || null, entreprise || null, typeContact, compte || null, adresse || null, ville || null, codePostal || null, pays || null, notes || null]
    );

    console.log(`✅ Contact créé dans ${schemaName}:`, result.rows[0].id);
    res.status(201).json({ success: true, data: result.rows[0], message: 'Contact créé avec succès' });
  } catch (error) {
    console.error('❌ ERREUR création contact:', error.message);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Un contact avec cet email existe déjà' });
    }
    res.status(500).json({ success: false, error: 'Erreur lors de la création du contact' });
  }
});

// GET : contact par ID
router.get('/:id', validateId, async (req, res) => {
  const id = req.params.id;
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(`SELECT * FROM "${req.userSchema}".contacts WHERE id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Contact introuvable' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(`❌ Erreur GET /api/contacts/${id}:`, err.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PUT : modifier un contact
router.put('/:id', validateId, async (req, res) => {
  const id = req.params.id;
  const pool = req.app.locals.pool;
  const { nom, prenom, telephone, email, compte, typeContact, entreprise, adresse, ville, codePostal, pays, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE "${req.userSchema}".contacts SET nom=$1, prenom=$2, telephone=$3, email=$4, compte=$5, type_contact=$6,
       entreprise=$7, adresse=$8, ville=$9, code_postal=$10, pays=$11, notes=$12, updated_at=NOW() 
       WHERE id=$13 RETURNING *`,
      [nom, prenom || null, telephone || null, email, compte || null, typeContact || 'prospect', entreprise || null, adresse || null, ville || null, codePostal || null, pays || null, notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Contact introuvable' });
    res.json({ success: true, data: result.rows[0], message: 'Contact mis à jour' });
  } catch (err) {
    console.error('❌ Erreur PUT /api/contacts/:id', err.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// DELETE : supprimer un contact
router.delete('/:id', validateId, async (req, res) => {
  const id = req.params.id;
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(`DELETE FROM "${req.userSchema}".contacts WHERE id=$1 RETURNING id, nom, prenom`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Contact introuvable' });
    res.json({ success: true, message: 'Contact supprimé', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ Erreur DELETE /api/contacts/:id', err.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET : statistiques des contacts
router.get('/stats/all', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const totalResult = await pool.query(`SELECT COUNT(*) FROM "${req.userSchema}".contacts`);
    const typeResult = await pool.query(`SELECT type_contact, COUNT(*) as count FROM "${req.userSchema}".contacts GROUP BY type_contact ORDER BY count DESC`);
    const by_type = typeResult.rows.reduce((acc, row) => { acc[row.type_contact] = parseInt(row.count); return acc; }, {});
    res.json({ success: true, data: { total: parseInt(totalResult.rows[0].count) || 0, by_type } });
  } catch (err) {
    console.error('❌ Erreur stats contacts:', err.message);
    res.json({ success: true, data: { total: 0, by_type: {} } });
  }
});

// POST : recherche de contacts
router.post('/search', async (req, res) => {
  const { query } = req.body;
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      `SELECT * FROM "${req.userSchema}".contacts WHERE nom ILIKE $1 OR prenom ILIKE $1 OR email ILIKE $1 OR telephone ILIKE $1 ORDER BY nom LIMIT 50`,
      [`%${query}%`]
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('❌ Erreur recherche contacts:', err.message);
    res.json({ success: true, data: [], count: 0 });
  }
});

// Routes de redirection pour les appels erronés
router.get('/contacts', (req, res) => {
  console.log('🔄 GET /api/contacts/contacts → Redirection');
  return res.status(200).json({ success: true, data: [], count: 0, message: 'Utilisez /api/contacts (sans le /contacts supplémentaire)' });
});

router.post('/contacts', (req, res) => {
  console.log('🔄 POST /api/contacts/contacts → Redirection');
  return res.status(200).json({ success: true, message: 'Utilisez /api/contacts (sans le /contacts supplémentaire)' });
});

// Route 404 pour les autres routes non matchées (doit être en dernier)
router.use((req, res) => {
  console.log(`⚠️  Route non trouvée dans contacts.js: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    available_routes: [
      'GET    /api/contacts',
      'POST   /api/contacts',
      'GET    /api/contacts/:id',
      'PUT    /api/contacts/:id',
      'DELETE /api/contacts/:id',
      'GET    /api/contacts/stats/all',
      'POST   /api/contacts/search'
    ]
  });
});

module.exports = router;
