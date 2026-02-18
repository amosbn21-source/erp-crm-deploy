// routes/commandes.js - VERSION CORRIGÉE
const express = require('express');
const router = express.Router();
const pool = require('../db'); // Import du pool global

// ==================== FONCTIONS UTILITAIRES ====================

// Fonction pour corriger les tables existantes (accepte le pool)
async function fixExistingTables(schemaName, poolInstance) {
  try {
    // Vérifier si la colonne numero_commande existe
    const columnCheck = await poolInstance.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = $1 
        AND table_name = 'commandes' 
        AND column_name = 'numero_commande'
      )
    `, [schemaName]);
    
    if (columnCheck.rows[0].exists) {
      // Vérifier s'il y a des valeurs NULL dans numero_commande
      const nullCheck = await poolInstance.query(`
        SELECT COUNT(*) as null_count 
        FROM "${schemaName}".commandes 
        WHERE numero_commande IS NULL
      `);
      
      if (nullCheck.rows[0].null_count > 0) {
        console.log(`🔄 Correction des ${nullCheck.rows[0].null_count} commandes sans numéro dans ${schemaName}...`);
        
        // Générer des numéros uniques pour chaque commande
        const commandesSansNumero = await poolInstance.query(`
          SELECT id, created_at FROM "${schemaName}".commandes 
          WHERE numero_commande IS NULL 
          ORDER BY id
        `);
        
        for (const cmd of commandesSansNumero.rows) {
          const date = new Date(cmd.created_at);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          
          const numeroCommande = `CMD-${year}${month}-${String(cmd.id).padStart(5, '0')}`;
          
          await poolInstance.query(
            `UPDATE "${schemaName}".commandes 
             SET numero_commande = $1 
             WHERE id = $2`,
            [numeroCommande, cmd.id]
          );
        }
        
        console.log(`✅ Numéros de commande corrigés pour ${schemaName}`);
      }
    }
  } catch (error) {
    console.error(`❌ Erreur correction tables ${schemaName}:`, error.message);
  }
}

// Fonction pour créer les tables si nécessaire (accepte le pool)
async function ensureUserTables(schemaName, userId, poolInstance) {
  try {
    // Vérifier si le schéma existe
    const schemaExists = await poolInstance.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = $1
      )
    `, [schemaName]);
    
    if (!schemaExists.rows[0].exists) {
      console.log(`📋 Schéma ${schemaName} non trouvé, création complète...`);
      await createUserTables(userId, poolInstance);
      return;
    }
    
    // Liste des tables REQUISES
    const requiredTables = ['contacts', 'produits', 'commandes', 'commande_produits'];
    
    for (const tableName of requiredTables) {
      const tableExists = await poolInstance.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        )
      `, [schemaName, tableName]);
      
      if (!tableExists.rows[0].exists) {
        console.log(`📋 Table ${tableName} non trouvée dans ${schemaName}, création complète...`);
        await createUserTables(userId, poolInstance);
        return;
      }
    }
    
    console.log(`✅ Toutes les tables existent dans ${schemaName}`);
    
  } catch (error) {
    console.error(`❌ Erreur vérification tables ${schemaName}:`, error.message);
  }
}

// Fonction pour créer toutes les tables utilisateur (accepte le pool)
async function createUserTables(userId, poolInstance) {
  const schemaName = `user_${userId}`;
  
  console.log(`🔧 Création COMPLÈTE des tables pour: ${schemaName}`);
  
  try {
    // 1. Créer le schéma
    await poolInstance.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    
    // 2. Table contacts
    await poolInstance.query(`
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
    
    // 3. Table produits
    await poolInstance.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".produits (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(200) NOT NULL,
        description TEXT,
        prix DECIMAL(10, 2) NOT NULL,
        stock INTEGER DEFAULT 0,
        code_barres VARCHAR(50),
        categorie VARCHAR(100),
        image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 4. Table commandes - AVEC NUMÉRO DE COMMANDE
    await poolInstance.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".commandes (
        id SERIAL PRIMARY KEY,
        numero_commande VARCHAR(50) UNIQUE NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        statut VARCHAR(20) DEFAULT 'en attente',
        total DECIMAL(12, 2) DEFAULT 0,
        total_ht DECIMAL(12, 2) DEFAULT 0,
        tva DECIMAL(12, 2) DEFAULT 0,
        contact_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 5. Table commande_produits
    await poolInstance.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".commande_produits (
        id SERIAL PRIMARY KEY,
        commande_id INTEGER REFERENCES "${schemaName}".commandes(id) ON DELETE CASCADE,
        produit_id INTEGER REFERENCES "${schemaName}".produits(id) ON DELETE CASCADE,
        quantite INTEGER NOT NULL DEFAULT 1,
        prix_unitaire DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log(`✅ Tables COMPLÈTES créées pour ${schemaName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur création tables ${schemaName}:`, error.message);
    return false;
  }
}

// Fonction pour générer un numéro de commande unique
async function generateUniqueNumeroCommande(schemaName) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  try {
    // Récupérer le dernier numéro pour ce mois
    const lastCommande = await pool.query(`
      SELECT numero_commande 
      FROM "${schemaName}".commandes 
      WHERE numero_commande LIKE $1 
      ORDER BY id DESC 
      LIMIT 1
    `, [`CMD-${year}${month}-%`]);
    
    let nextNumber = 1;
    
    if (lastCommande.rows.length > 0) {
      const lastNum = lastCommande.rows[0].numero_commande;
      // Extraire le numéro séquentiel
      const parts = lastNum.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2]);
        if (!isNaN(lastSeq)) {
          nextNumber = lastSeq + 1;
        }
      }
    }
    
    // Formatter : CMD-YYYYMM-XXXXX (5 chiffres)
    return `CMD-${year}${month}-${String(nextNumber).padStart(5, '0')}`;
    
  } catch (error) {
    // Fallback si erreur
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    return `CMD-${year}${month}-${random}`;
  }
}

// Fonctions de notification (simulées)
async function notifyWhatsApp(telephone, message) {
  console.log(`📱 WhatsApp à ${telephone}: ${message}`);
  return true;
}

async function notifyMessenger(compte, message) {
  console.log(`💬 Messenger à ${compte}: ${message}`);
  return true;
}

// Fonction helper pour récupérer une commande avec ses produits
async function getCommandeAvecProduits(commandeId, schemaName, poolInstance) {
  const result = await poolInstance.query(
    `SELECT 
      c.*,
      ct.nom AS "contact_nom",
      ct.prenom AS "contact_prenom",
      ct.email AS "contact_email",
      ct.telephone AS "contact_telephone",
      COALESCE(
        json_agg(
          json_build_object(
            'id', cp.id,
            'produitId', cp.produit_id,
            'produitNom', p.nom,
            'quantite', cp.quantite,
            'prixUnitaire', cp.prix_unitaire,
            'sousTotal', cp.quantite * cp.prix_unitaire
          )
        ) FILTER (WHERE cp.id IS NOT NULL),
        '[]'::json
      ) AS produits
    FROM "${schemaName}".commandes c
    LEFT JOIN "${schemaName}".contacts ct ON c.contact_id = ct.id
    LEFT JOIN "${schemaName}".commande_produits cp ON c.id = cp.commande_id
    LEFT JOIN "${schemaName}".produits p ON cp.produit_id = p.id
    WHERE c.id = $1
    GROUP BY c.id, ct.id`,
    [commandeId]
  );
  
  return result.rows[0] || null;
}

// ==================== MIDDLEWARE ====================

// Middleware pour obtenir le schéma utilisateur
router.use(async (req, res, next) => {
  console.log('👤 commandes.js - User schema:', req.userSchema);
  console.log('👤 commandes.js - User ID:', req.user?.id);
  
  if (!req.userSchema) {
    console.warn('⚠️  Aucun schéma utilisateur défini dans commandes.js');
    if (req.user?.role !== 'admin') {
      const userId = req.user?.userId || req.user?.id;
      if (userId) {
        req.userSchema = `user_${userId}`;
      } else {
        req.userSchema = 'public';
      }
    } else {
      req.userSchema = 'public';
    }
  }
  
  console.log(`✅ commandes.js utilisera le schéma: ${req.userSchema}`);
  
  // Corriger les tables existantes si nécessaire (passer req.app.locals.pool)
  if (req.userSchema && req.userSchema.startsWith('user_')) {
    await fixExistingTables(req.userSchema, req.app.locals.pool);
  }
  
  next();
});

// ==================== ROUTES PRINCIPALES ====================

// GET: toutes les commandes avec produits imbriqués
router.get('/', async (req, res) => {
  try {
    const schemaName = req.userSchema;
    const db = req.app.locals.pool;
    
    console.log(`🔍 Début GET /api/commandes pour schéma: ${schemaName}`);
    
    await ensureUserTables(schemaName, req.user?.id, db);
    
    const result = await db.query(`
      SELECT 
        c.id, 
        c.numero_commande,
        c.date, 
        c.statut, 
        c.total,
        c.total_ht,
        c.tva,
        c.contact_id,
        ct.nom AS "contact_nom", 
        ct.prenom AS "contact_prenom", 
        ct.email AS "contact_email",
        ct.telephone AS "contact_telephone",
        c.created_at,
        c.updated_at
      FROM "${schemaName}".commandes c
      LEFT JOIN "${schemaName}".contacts ct ON c.contact_id = ct.id
      ORDER BY c.id DESC
    `);
    
    console.log(`📊 ${result.rows.length} commande(s) trouvée(s) dans ${schemaName}`);
    const commandes = result.rows;

    for (const cmd of commandes) {
      const produitsRes = await db.query(
        `SELECT 
           cp.id,
           cp.commande_id,
           cp.produit_id,
           p.nom AS "produit_nom",
           p.prix,
           p.stock,
           cp.quantite,
           cp.prix_unitaire,
           (cp.quantite * cp.prix_unitaire) AS "sousTotal"
         FROM "${schemaName}".commande_produits cp
         JOIN "${schemaName}".produits p ON cp.produit_id = p.id
         WHERE cp.commande_id = $1`,
        [cmd.id]
      );

      cmd.produits = produitsRes.rows || [];
      
      if (!cmd.total_ht && cmd.produits.length > 0) {
        const totalHT = cmd.produits.reduce((sum, p) => sum + (p.sousTotal || 0), 0);
        const tva = totalHT * 0.20;
        cmd.total_ht = totalHT;
        cmd.tva = tva;
        cmd.total = totalHT + tva;
      }
      
      console.log(`🛒 Commande ${cmd.numero_commande}: ${cmd.produits.length} produit(s)`);
    }

    res.json({
      success: true,
      data: commandes,
      count: commandes.length,
      schema: schemaName
    });
  } catch (err) {
    console.error('❌ Erreur GET /commandes', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur',
      message: err.message
    });
  }
});

// GET: statistiques des commandes - DOIT ÊTRE AVANT /:id
router.get('/stats', async (req, res) => {
  try {
    const schemaName = req.userSchema;
    const db = req.app.locals.pool;
    
    console.log(`📊 GET /api/commandes/stats pour schéma: ${schemaName}`);
    
    await ensureUserTables(schemaName, req.user?.id, db);
    
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_commandes,
        COALESCE(SUM(CASE WHEN statut = 'livrée' THEN total_ht ELSE 0 END), 0) as chiffre_affaires,
        COALESCE(AVG(total), 0) as moyenne_commande,
        COUNT(CASE WHEN statut = 'livrée' THEN 1 END) as livrees,
        COUNT(CASE WHEN statut = 'en cours' THEN 1 END) as en_cours,
        COUNT(CASE WHEN statut = 'en attente' THEN 1 END) as en_attente,
        COUNT(CASE WHEN statut = 'annulée' THEN 1 END) as annulees,
        MIN(date) as premiere_commande,
        MAX(date) as derniere_commande
      FROM "${schemaName}".commandes
    
    const topProduits = await db.query(`
      SELECT 
        p.id,
        p.nom,
        p.prix,
        COALESCE(SUM(cp.quantite), 0) as total_vendu,
        COALESCE(SUM(cp.quantite * cp.prix_unitaire), 0) as chiffre_produit
      FROM "${schemaName}".produits p
      LEFT JOIN "${schemaName}".commande_produits cp ON p.id = cp.produit_id
      GROUP BY p.id, p.nom, p.prix
      ORDER BY total_vendu DESC
      LIMIT 10
    `);
    
    const evolution = await db.query(`
      SELECT 
        DATE_TRUNC('month', date) as mois,
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') as mois_format,
        COUNT(*) as nb_commandes,
        SUM(total) as total_mois,
        SUM(total_ht) as total_ht_mois,
        SUM(tva) as tva_mois
      FROM "${schemaName}".commandes
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY mois DESC
      LIMIT 12
    `);
    
    const topClients = await db.query(`
      SELECT 
        c.id,
        c.nom,
        c.prenom,
        c.entreprise,
        COUNT(co.id) as nb_commandes,
        SUM(co.total) as total_achats,
        AVG(co.total) as moyenne_achat
      FROM "${schemaName}".contacts c
      LEFT JOIN "${schemaName}".commandes co ON c.id = co.contact_id
      GROUP BY c.id, c.nom, c.prenom, c.entreprise
      HAVING COUNT(co.id) > 0
      ORDER BY total_achats DESC
      LIMIT 10
    `);
    
    const ruptureStock = await db.query(`
      SELECT 
        id,
        nom,
        prix,
        stock
      FROM "${schemaName}".produits
      WHERE stock <= 5
      ORDER BY stock ASC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        topProduits: topProduits.rows,
        evolution: evolution.rows,
        topClients: topClients.rows,
        ruptureStock: ruptureStock.rows,
        schema: schemaName,
        generated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('❌ Erreur GET /commandes/stats', err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      schema: req.userSchema,
      message: err.message
    });
  }
});

// GET: commandes récentes (pour dashboard)
router.get('/recentes', async (req, res) => {
  try {
    const schemaName = req.userSchema;
    const db = req.app.locals.pool;
    console.log(`📊 GET /api/commandes/recentes pour schéma: ${schemaName}`);
    
    await ensureUserTables(schemaName, req.user?.id, db);
    
    const result = await db.query(`
      SELECT 
        c.id, 
        c.numero_commande,
        c.date, 
        c.statut, 
        c.total,
        c.total_ht,
        c.tva,
        c.contact_id,
        ct.nom AS "contact_nom", 
        ct.prenom AS "contact_prenom", 
        ct.email AS "contact_email",
        ct.telephone AS "contact_telephone",
        c.created_at,
        c.updated_at
      FROM "${schemaName}".commandes c
      LEFT JOIN "${schemaName}".contacts ct ON c.contact_id = ct.id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 ${result.rows.length} commande(s) récente(s) trouvée(s) dans ${schemaName}`);
    
    for (const cmd of result.rows) {
      const produitsRes = await db.query(
        `SELECT 
           cp.id,
           cp.commande_id,
           cp.produit_id,
           p.nom AS "produit_nom",
           p.prix,
           p.stock,
           cp.quantite,
           cp.prix_unitaire,
           (cp.quantite * cp.prix_unitaire) AS "sousTotal"
         FROM "${schemaName}".commande_produits cp
         JOIN "${schemaName}".produits p ON cp.produit_id = p.id
         WHERE cp.commande_id = $1`,
        [cmd.id]
      );

      cmd.produits = produitsRes.rows || [];
    }

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      schema: schemaName
    });
  } catch (err) {
    console.error('❌ Erreur GET /commandes/recentes', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur',
      message: err.message
    });
  }
});

// GET: une commande spécifique par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schemaName = req.userSchema;
    const db = req.app.locals.pool;
    
    console.log(`🔍 GET /api/commandes/${id} pour schéma: ${schemaName}`);
    
    await ensureUserTables(schemaName, req.user?.id, db);
    
    const commande = await getCommandeAvecProduits(id, schemaName, db);
    
    if (!commande) {
      return res.status(404).json({
        success: false,
        error: 'Commande introuvable'
      });
    }
    
    res.json({
      success: true,
      data: commande,
      schema: schemaName
    });
  } catch (err) {
    console.error(`❌ Erreur GET /commandes/${req.params.id}`, err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur',
      message: err.message
    });
  }
});

// POST: crée une commande complète avec produits
router.post('/', async (req, res) => {
  const { date, statut, total, contactId, produits } = req.body;
  const schemaName = req.userSchema;
  const db = req.app.locals.pool;
  
  console.log(`📝 Création commande dans schéma: ${schemaName}`);
  
  const totalProduits = (produits || []).reduce((sum, p) => 
    sum + (p.quantite * p.prixUnitaire), 0
  );
  const totalHT = totalProduits;
  const tva = totalProduits * 0.20;
  const totalTTC = totalHT + tva;
  
  if (new Date(date) > new Date()) {
    return res.status(400).json({ 
      success: false,
      error: 'La date ne peut pas être future' 
    });
  }
  
  await ensureUserTables(schemaName, req.user?.id, db);
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const produit of (produits || [])) {
      const checkStock = await client.query(
        `SELECT stock, nom FROM "${schemaName}".produits WHERE id = $1`,
        [produit.produitId]
      );
      
      if (checkStock.rows.length === 0) {
        throw new Error(`Produit ${produit.produitId} introuvable`);
      }
      
      const stockActuel = checkStock.rows[0].stock;
      if (stockActuel < produit.quantite) {
        throw new Error(`Stock insuffisant pour "${checkStock.rows[0].nom}". Stock disponible: ${stockActuel}, Quantité demandée: ${produit.quantite}`);
      }
    }
    
    const numeroCommande = await generateUniqueNumeroCommande(schemaName);
    console.log(`🔢 Numéro de commande généré: ${numeroCommande}`);
    
    const commandeResult = await client.query(
      `INSERT INTO "${schemaName}".commandes 
       (numero_commande, date, statut, total, total_ht, tva, contact_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
       RETURNING *`,
      [numeroCommande, date, statut || 'en attente', totalTTC, totalHT, tva, contactId]
    );
    
    const commandeId = commandeResult.rows[0].id;
    
    if (produits && Array.isArray(produits)) {
      for (const produit of produits) {
        await client.query(
          `INSERT INTO "${schemaName}".commande_produits 
           (commande_id, produit_id, quantite, prix_unitaire, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [commandeId, produit.produitId, produit.quantite, produit.prixUnitaire]
        );
        
        await client.query(
          `UPDATE "${schemaName}".produits 
           SET stock = stock - $1, 
               updated_at = NOW()
           WHERE id = $2`,
          [produit.quantite, produit.produitId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    const commandeComplete = await getCommandeAvecProduits(commandeId, schemaName, db);
    
    res.status(201).json({
      success: true,
      data: commandeComplete,
      message: 'Commande créée avec succès'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur POST /commandes', err);
    
    if (err.message.includes('Stock insuffisant')) {
      res.status(400).json({ 
        success: false,
        error: 'Stock insuffisant', 
        details: err.message 
      });
    } else if (err.message.includes('numero_commande') && err.message.includes('unique')) {
      try {
        const numeroCommandeRetry = await generateUniqueNumeroCommande(schemaName);
        console.log(`🔄 Retry avec numéro: ${numeroCommandeRetry}`);
        res.status(409).json({ 
          success: false,
          error: 'Conflit de numéro de commande', 
          details: 'Veuillez réessayer',
          suggestedRetry: true
        });
      } catch (retryErr) {
        res.status(500).json({ 
          success: false,
          error: 'Erreur serveur', 
          details: retryErr.message 
        });
      }
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Erreur serveur', 
        details: err.message 
      });
    }
  } finally {
    client.release();
  }
});

// PUT: modifie une commande existante
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { date, statut, contactId, produits } = req.body;
  const schemaName = req.userSchema;
  const db = req.app.locals.pool;
  
  console.log(`✏️ PUT /api/commandes/${id} pour schéma: ${schemaName}`);
  console.log('📦 Données reçues:', { date, statut, contactId, produits: produits?.length });
  
  if (date && new Date(date) > new Date()) {
    return res.status(400).json({ 
      success: false,
      error: 'La date ne peut pas être future' 
    });
  }
  
  await ensureUserTables(schemaName, req.user?.id, db);
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const commandeExistante = await client.query(
      `SELECT statut, contact_id FROM "${schemaName}".commandes WHERE id = $1`,
      [id]
    );
    
    if (commandeExistante.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false,
        error: 'Commande introuvable' 
      });
    }
    
    const ancienStatut = commandeExistante.rows[0].statut;
    
    if (ancienStatut === 'livrée') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false,
        error: 'Impossible de modifier une commande livrée' 
      });
    }
    
    let totalTTC = 0;
    let totalHT = 0;
    let tva = 0;
    
    if (produits && Array.isArray(produits) && produits.length > 0) {
      totalHT = produits.reduce((sum, p) => sum + (p.quantite * p.prixUnitaire), 0);
      tva = totalHT * 0.20;
      totalTTC = totalHT + tva;
    }
    
    const commandeResult = await client.query(
      `UPDATE "${schemaName}".commandes
       SET date = COALESCE($1, date),
           statut = COALESCE($2, statut),
           total = COALESCE($3, total),
           total_ht = COALESCE($4, total_ht),
           tva = COALESCE($5, tva),
           contact_id = COALESCE($6, contact_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        date || null,
        statut || null,
        totalTTC || null,
        totalHT || null,
        tva || null,
        contactId || null,
        id
      ]
    );
    
    if (produits && Array.isArray(produits)) {
      const anciensProduits = await client.query(
        `SELECT produit_id, quantite FROM "${schemaName}".commande_produits WHERE commande_id = $1`,
        [id]
      );
      
      for (const ancien of anciensProduits.rows) {
        await client.query(
          `UPDATE "${schemaName}".produits 
           SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [ancien.quantite, ancien.produit_id]
        );
      }
      
      await client.query(`DELETE FROM "${schemaName}".commande_produits WHERE commande_id = $1`, [id]);
      
      for (const produit of produits) {
        const checkStock = await client.query(
          `SELECT stock, nom FROM "${schemaName}".produits WHERE id = $1`,
          [produit.produitId]
        );
        
        if (checkStock.rows.length === 0) {
          throw new Error(`Produit ${produit.produitId} introuvable`);
        }
        
        const stockActuel = checkStock.rows[0].stock;
        if (stockActuel < produit.quantite) {
          throw new Error(
            `Stock insuffisant pour "${checkStock.rows[0].nom}". Stock disponible: ${stockActuel}, Quantité demandée: ${produit.quantite}`
          );
        }
      }
      
      for (const produit of produits) {
        await client.query(
          `INSERT INTO "${schemaName}".commande_produits 
           (commande_id, produit_id, quantite, prix_unitaire, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [id, produit.produitId, produit.quantite, produit.prixUnitaire]
        );
        
        await client.query(
          `UPDATE "${schemaName}".produits 
           SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [produit.quantite, produit.produitId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    const commandeComplete = await getCommandeAvecProduits(id, schemaName, db);
    
    res.json({
      success: true,
      data: commandeComplete,
      message: 'Commande mise à jour avec succès'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Erreur PUT /commandes/${id}:`, err);
    
    if (err.message.includes('Stock insuffisant')) {
      res.status(400).json({ 
        success: false,
        error: 'Stock insuffisant', 
        details: err.message 
      });
    } else if (err.message.includes('Impossible de modifier')) {
      res.status(400).json({ 
        success: false,
        error: err.message 
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Erreur serveur', 
        details: err.message 
      });
    }
  } finally {
    client.release();
  }
});

// PATCH: met à jour partiellement une commande (ex: statut seulement)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  const schemaName = req.userSchema;
  const db = req.app.locals.pool;
  
  console.log(`🔄 PATCH /api/commandes/${id} pour schéma: ${schemaName}`);
  console.log('📦 Nouveau statut:', statut);
  
  if (!statut) {
    return res.status(400).json({
      success: false,
      error: 'Le statut est requis'
    });
  }
  
  const statutsValides = ['en attente', 'en cours', 'livrée', 'annulée'];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({
      success: false,
      error: `Statut invalide. Valeurs acceptées: ${statutsValides.join(', ')}`
    });
  }
  
  await ensureUserTables(schemaName, req.user?.id, db);
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const commandeExistante = await client.query(
      `SELECT statut FROM "${schemaName}".commandes WHERE id = $1`,
      [id]
    );
    
    if (commandeExistante.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Commande introuvable'
      });
    }
    
    const ancienStatut = commandeExistante.rows[0].statut;
    
    if (ancienStatut === 'livrée' && statut !== 'livrée') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Impossible de changer le statut d\'une commande livrée'
      });
    }
    
    if (ancienStatut === 'annulée' && statut !== 'annulée') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Impossible de changer le statut d\'une commande annulée'
      });
    }
    
    const result = await client.query(
      `UPDATE "${schemaName}".commandes 
       SET statut = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [statut, id]
    );
    
    if (statut === 'annulée' && ancienStatut !== 'annulée') {
      const produitsCommande = await client.query(
        `SELECT produit_id, quantite FROM "${schemaName}".commande_produits WHERE commande_id = $1`,
        [id]
      );
      
      for (const produit of produitsCommande.rows) {
        await client.query(
          `UPDATE "${schemaName}".produits 
           SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [produit.quantite, produit.produit_id]
        );
      }
      
      console.log(`📦 Stock restauré pour commande ${id} (annulation)`);
    }
    
    if (ancienStatut === 'annulée' && statut !== 'annulée') {
      const produitsCommande = await client.query(
        `SELECT produit_id, quantite FROM "${schemaName}".commande_produits WHERE commande_id = $1`,
        [id]
      );
      
      for (const produit of produitsCommande.rows) {
        const checkStock = await client.query(
          `SELECT stock, nom FROM "${schemaName}".produits WHERE id = $1`,
          [produit.produit_id]
        );
        
        if (checkStock.rows.length > 0) {
          const stockActuel = checkStock.rows[0].stock;
          if (stockActuel < produit.quantite) {
            throw new Error(
              `Stock insuffisant pour "${checkStock.rows[0].nom}". Stock disponible: ${stockActuel}, Quantité demandée: ${produit.quantite}`
            );
          }
        }
      }
      
      for (const produit of produitsCommande.rows) {
        await client.query(
          `UPDATE "${schemaName}".produits 
           SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [produit.quantite, produit.produit_id]
        );
      }
      
      console.log(`📦 Stock déduit pour commande ${id} (réactivation)`);
    }
    
    await client.query('COMMIT');
    
    const commandeComplete = await getCommandeAvecProduits(id, schemaName, db);
    
    if (statut === 'livrée') {
      const contactInfo = await db.query(
        `SELECT telephone, compte FROM "${schemaName}".contacts 
         WHERE id = (SELECT contact_id FROM "${schemaName}".commandes WHERE id = $1)`,
        [id]
      );
      
      if (contactInfo.rows.length > 0) {
        const contact = contactInfo.rows[0];
        const message = `Votre commande #${commandeComplete.numero_commande} a été livrée. Merci pour votre confiance!`;
        
        if (contact.telephone) {
          await notifyWhatsApp(contact.telephone, message);
        }
        
        if (contact.compte) {
          await notifyMessenger(contact.compte, message);
        }
      }
    }
    
    res.json({
      success: true,
      data: commandeComplete,
      message: `Statut de la commande mis à jour: ${statut}`
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Erreur PATCH /commandes/${id}:`, err);
    
    if (err.message.includes('Stock insuffisant')) {
      res.status(400).json({
        success: false,
        error: 'Stock insuffisant',
        details: err.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        details: err.message
      });
    }
  } finally {
    client.release();
  }
});

// DELETE: supprime une commande
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  const db = req.app.locals.pool;
  
  console.log(`🗑️ DELETE /api/commandes/${id} pour schéma: ${schemaName}`);
  
  await ensureUserTables(schemaName, req.user?.id, db);
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const commandeExistante = await client.query(
      `SELECT statut, numero_commande FROM "${schemaName}".commandes WHERE id = $1`,
      [id]
    );
    
    if (commandeExistante.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Commande introuvable'
      });
    }
    
    const numeroCommande = commandeExistante.rows[0].numero_commande;
    const statut = commandeExistante.rows[0].statut;
    
    if (statut === 'livrée') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer une commande livrée'
      });
    }
    
    if (statut !== 'annulée') {
      const produitsCommande = await client.query(
        `SELECT produit_id, quantite FROM "${schemaName}".commande_produits WHERE commande_id = $1`,
        [id]
      );
      
      for (const produit of produitsCommande.rows) {
        await client.query(
          `UPDATE "${schemaName}".produits 
           SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [produit.quantite, produit.produit_id]
        );
      }
      
      console.log(`📦 Stock restauré pour suppression commande ${numeroCommande}`);
    }
    
    await client.query(`DELETE FROM "${schemaName}".commande_produits WHERE commande_id = $1`, [id]);
    await client.query(`DELETE FROM "${schemaName}".commandes WHERE id = $1`, [id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Commande ${numeroCommande} supprimée avec succès`,
      details: statut !== 'annulée' ? 
        'Les produits associés ont été supprimés et le stock a été restauré' :
        'Les produits associés ont été supprimés'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Erreur DELETE /commandes/${id}:`, err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// POST: annuler une commande (alias pour PATCH avec statut annulée)
router.post('/:id/annuler', async (req, res) => {
  req.body = { statut: 'annulée' };
  const originalId = req.params.id;
  console.log(`⏹️ POST /api/commandes/${originalId}/annuler - Redirection vers PATCH`);
  
  const patchHandler = router.stack.find(layer => 
    layer.route && layer.route.path === '/:id' && layer.route.methods.patch
  );
  
  if (patchHandler && patchHandler.route.stack && patchHandler.route.stack[0]) {
    return patchHandler.route.stack[0].handle(req, res);
  } else {
    req.body = { statut: 'annulée' };
    return router.patch('/:id', req, res);
  }
});

// GET: vérifier la disponibilité des produits pour une commande
router.get('/:id/check-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const schemaName = req.userSchema;
    const db = req.app.locals.pool;
    
    console.log(`📦 GET /api/commandes/${id}/check-stock pour schéma: ${schemaName}`);
    
    await ensureUserTables(schemaName, req.user?.id, db);
    
    const produitsCommande = await db.query(`
      SELECT 
        cp.produit_id,
        p.nom,
        p.stock as stock_actuel,
        cp.quantite as quantite_commandee,
        (p.stock - cp.quantite) as stock_reste
      FROM "${schemaName}".commande_produits cp
      JOIN "${schemaName}".produits p ON cp.produit_id = p.id
      WHERE cp.commande_id = $1
    `, [id]);
    
    const produitsEnRupture = produitsCommande.rows.filter(p => p.stock_actuel < p.quantite_commandee);
    const produitsFaibleStock = produitsCommande.rows.filter(p => 
      p.stock_actuel >= p.quantite_commandee && (p.stock_actuel - p.quantite_commandee) <= 5
    );
    
    res.json({
      success: true,
      data: {
        produits: produitsCommande.rows,
        disponible: produitsEnRupture.length === 0,
        produitsEnRupture: produitsEnRupture,
        produitsFaibleStock: produitsFaibleStock,
        schema: schemaName
      }
    });
  } catch (err) {
    console.error(`❌ Erreur GET /commandes/${req.params.id}/check-stock`, err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: err.message
    });
  }
});

module.exports = router;
