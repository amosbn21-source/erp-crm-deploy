// src/routes/documents.js - VERSION CORRIGÉE (utilise req.app.locals.pool)
const express = require('express');
const router = express.Router();

// Fonction pour réparer automatiquement la structure de la table
async function repairDocumentTable(schemaName, pool) {
  try {
    console.log(`🔧 Réparation de la table documents dans ${schemaName}...`);
    
    // Créer la table si elle n'existe pas
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'documents'
      )
    `, [schemaName]);
    
    if (!tableExists.rows[0].exists) {
      console.log(`📋 Table documents n'existe pas dans ${schemaName}, création...`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
          id SERIAL PRIMARY KEY,
          reference VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          statut VARCHAR(50) DEFAULT 'brouillon',
          client_nom VARCHAR(200),
          client_email VARCHAR(200),
          client_adresse TEXT,
          date_emission DATE DEFAULT CURRENT_DATE,
          date_validite DATE,
          total_ht DECIMAL(12, 2) DEFAULT 0,
          tva_rate DECIMAL(5, 2) DEFAULT 20.00,
          total_tva DECIMAL(12, 2) DEFAULT 0,
          total_ttc DECIMAL(12, 2) DEFAULT 0,
          notes TEXT,
          pdf_filename VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER NOT NULL DEFAULT 0
        )
      `);
      return true;
    }
    
    // Liste des colonnes à vérifier/ajouter
    const columnsToCheck = [
      { name: 'tva_rate', type: 'DECIMAL(5, 2)', default: '20.00' },
      { name: 'date_emission', type: 'DATE', default: 'CURRENT_DATE' },
      { name: 'date_validite', type: 'DATE' },
      { name: 'client_nom', type: 'VARCHAR(200)' },
      { name: 'client_email', type: 'VARCHAR(200)' },
      { name: 'client_adresse', type: 'TEXT' },
      { name: 'total_ht', type: 'DECIMAL(12, 2)', default: '0' },
      { name: 'total_tva', type: 'DECIMAL(12, 2)', default: '0' },
      { name: 'total_ttc', type: 'DECIMAL(12, 2)', default: '0' },
      { name: 'notes', type: 'TEXT' },
      { name: 'pdf_filename', type: 'VARCHAR(255)' }
    ];
    
    let columnsAdded = 0;
    
    for (const column of columnsToCheck) {
      const columnExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 
          AND table_name = 'documents'
          AND column_name = $2
        )
      `, [schemaName, column.name]);
      
      if (!columnExists.rows[0].exists) {
        console.log(`➕ Ajout colonne ${column.name} à ${schemaName}.documents...`);
        
        const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
        await pool.query(`
          ALTER TABLE "${schemaName}".documents 
          ADD COLUMN ${column.name} ${column.type}${defaultClause}
        `);
        
        columnsAdded++;
      }
    }
    
    if (columnsAdded > 0) {
      console.log(`✅ ${columnsAdded} colonne(s) ajoutée(s) à ${schemaName}.documents`);
    } else {
      console.log(`✅ Toutes les colonnes sont présentes dans ${schemaName}.documents`);
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur réparation table ${schemaName}.documents:`, error.message);
    return false;
  }
}

// Middleware pour obtenir le schéma utilisateur
router.use((req, res, next) => {
  console.log('📄 documents.js - User:', req.user?.email);
  
  if (!req.userSchema && req.user) {
    const userId = req.user.userId || req.user.id;
    if (userId) {
      req.userSchema = `user_${userId}`;
      console.log(`✅ Schéma calculé: ${req.userSchema}`);
    }
  }
  
  if (!req.userSchema) {
    req.userSchema = 'public';
    console.warn('⚠️  Utilisation schéma public (fallback)');
  }
  
  next();
});

// Route de debug (inchangée)
router.get('/debug/:id', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  const db = req.app.locals.pool;
  
  try {
    const result = await db.query(
      `SELECT * FROM "${schemaName}".documents WHERE id = $1`,
      [id]
    );
    
    console.log('🔍 DEBUG document:', {
      row: result.rows[0],
      columns: result.fields.map(f => f.name),
      client_nom: result.rows[0]?.client_nom,
      client_email: result.rows[0]?.client_email,
      client_adresse: result.rows[0]?.client_adresse
    });
    
    res.json({
      success: true,
      debug: {
        rawData: result.rows[0],
        hasClientNom: !!result.rows[0]?.client_nom,
        clientFields: {
          nom: result.rows[0]?.client_nom,
          email: result.rows[0]?.client_email,
          adresse: result.rows[0]?.client_adresse
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fonction pour créer les tables de documents si nécessaire (avec pool)
async function ensureDocumentTables(schemaName, userId, pool) {
  try {
    // Vérifier si le schéma existe
    const schemaExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = $1
      )
    `, [schemaName]);
    
    if (!schemaExists.rows[0].exists && userId) {
      console.log(`📋 Création schéma ${schemaName}...`);
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    }
    
    // Table documents
    const documentsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'documents'
      )
    `, [schemaName]);
    
    if (!documentsExists.rows[0].exists) {
      console.log(`📋 Création table documents dans ${schemaName}...`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
          id SERIAL PRIMARY KEY,
          reference VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          statut VARCHAR(50) DEFAULT 'brouillon',
          client_nom VARCHAR(200),
          client_email VARCHAR(200),
          client_adresse TEXT,
          date_emission DATE DEFAULT CURRENT_DATE,
          date_validite DATE,
          total_ht DECIMAL(12, 2) DEFAULT 0,
          tva_rate DECIMAL(5, 2) DEFAULT 20.00,
          total_tva DECIMAL(12, 2) DEFAULT 0,
          total_ttc DECIMAL(12, 2) DEFAULT 0,
          notes TEXT,
          pdf_filename VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER NOT NULL DEFAULT 0
        )
      `);
      await repairDocumentTable(schemaName, pool);
    }
    
    // Table document_lignes
    const lignesExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'document_lignes'
      )
    `, [schemaName]);
    
    if (!lignesExists.rows[0].exists) {
      console.log(`📋 Création table document_lignes dans ${schemaName}...`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".document_lignes (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL REFERENCES "${schemaName}".documents(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          quantite INTEGER DEFAULT 1,
          prix_unitaire DECIMAL(10, 2) NOT NULL,
          total_ligne DECIMAL(12, 2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    console.log(`✅ Tables documents créées dans ${schemaName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur création tables documents ${schemaName}:`, error.message);
    return false;
  }
}

// Fonction pour vérifier et ajouter les colonnes manquantes
async function fixMissingColumns(schemaName, pool) {
  try {
    console.log(`🔧 Vérification des colonnes manquantes pour ${schemaName}.documents...`);
    
    // Liste des colonnes requises et leurs définitions
    const requiredColumns = [
      { name: 'tva_rate', type: 'DECIMAL(5, 2)', defaultValue: '20.00' },
      { name: 'client_nom', type: 'VARCHAR(200)' },
      { name: 'client_email', type: 'VARCHAR(200)' },
      { name: 'client_adresse', type: 'TEXT' },
      { name: 'date_validite', type: 'DATE' },
      { name: 'total_ht', type: 'DECIMAL(12, 2)', defaultValue: '0' },
      { name: 'total_tva', type: 'DECIMAL(12, 2)', defaultValue: '0' },
      { name: 'total_ttc', type: 'DECIMAL(12, 2)', defaultValue: '0' },
      { name: 'notes', type: 'TEXT' },
      { name: 'pdf_filename', type: 'VARCHAR(255)' }
    ];
    
    for (const column of requiredColumns) {
      const columnExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 
          AND table_name = 'documents'
          AND column_name = $2
        )
      `, [schemaName, column.name]);
      
      if (!columnExists.rows[0].exists) {
        console.log(`➕ Ajout colonne ${column.name} à ${schemaName}.documents...`);
        
        const defaultValue = column.defaultValue ? ` DEFAULT ${column.defaultValue}` : '';
        await pool.query(`
          ALTER TABLE "${schemaName}".documents 
          ADD COLUMN ${column.name} ${column.type}${defaultValue}
        `);
      }
    }
    
    console.log(`✅ Colonnes vérifiées pour ${schemaName}.documents`);
    
  } catch (error) {
    console.error(`❌ Erreur vérification colonnes ${schemaName}:`, error.message);
  }
}

// Helper pour calculer totaux (inchangé)
const computeTotals = (lignes = [], tvaRate = 20) => {
  const total_ht = lignes.reduce((sum, l) => {
    const quantite = Number(l.quantite || 1);
    const prix = Number(l.prix_unitaire || 0);
    return sum + (quantite * prix);
  }, 0);
  
  const tva_rate = Number(tvaRate || 20);
  const total_tva = (total_ht * tva_rate) / 100;
  const total_ttc = total_ht + total_tva;
  
  return { total_ht, tva_rate, total_tva, total_ttc };
};

// ==================== ROUTES ====================

// GET: Liste de tous les documents de l'utilisateur
router.get('/', async (req, res) => {
  const schemaName = req.userSchema;
  const userId = req.user?.userId || req.user?.id;
  const db = req.app.locals.pool;
  
  console.log(`📄 GET /api/documents - Schéma: ${schemaName}, UserID: ${userId}`);
  
  try {
    // Assurer que les tables existent
    await ensureDocumentTables(schemaName, userId, db);
    
    const result = await db.query(
      `SELECT 
        id, 
        reference, 
        type, 
        statut, 
        client_nom,
        client_email,
        client_adresse,
        date_emission,
        date_validite,
        total_ht,
        tva_rate,
        total_tva,
        total_ttc,
        notes,
        pdf_filename,
        created_at,
        updated_at,
        user_id
       FROM "${schemaName}".documents 
       ORDER BY id DESC
       LIMIT 100`
    );
    
    console.log(`✅ ${result.rows.length} document(s) trouvé(s) dans ${schemaName}`);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      schema: schemaName
    });
    
  } catch (error) {
    console.error(`❌ Erreur GET /api/documents pour ${schemaName}:`, error);
    
    if (error.message.includes('n\'existe pas') || error.code === '42P01') {
      // Table n'existe pas, créer et retourner vide
      await ensureDocumentTables(schemaName, userId, db);
      return res.json({
        success: true,
        data: [],
        count: 0,
        schema: schemaName
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      schema: schemaName
    });
  }
});

// GET: Un document spécifique avec ses lignes
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  const userId = req.user?.userId || req.user?.id;
  const db = req.app.locals.pool;
  
  console.log(`📄 GET /api/documents/${id} - Schéma: ${schemaName}`);
  
  try {
    // Assurer que les tables existent
    await ensureDocumentTables(schemaName, userId, db);
    
    // Récupérer le document
    const docRes = await db.query(
      `SELECT * FROM "${schemaName}".documents WHERE id = $1`,
      [id]
    );
    
    if (docRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document introuvable',
        schema: schemaName
      });
    }
    
    const doc = docRes.rows[0];
    
    // Récupérer les lignes
    const lignesRes = await db.query(
      `SELECT * FROM "${schemaName}".document_lignes WHERE document_id = $1`,
      [id]
    );
    
    doc.lignes = lignesRes.rows || [];
    
    res.json({
      success: true,
      data: doc,
      schema: schemaName
    });
    
  } catch (error) {
    console.error(`❌ Erreur GET /api/documents/${id} pour ${schemaName}:`, error);
    
    if (error.message.includes('n\'existe pas') || error.code === '42P01') {
      await ensureDocumentTables(schemaName, userId, db);
      return res.status(404).json({
        success: false,
        error: 'Document introuvable',
        schema: schemaName
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      schema: schemaName
    });
  }
});

// POST: Créer un nouveau document avec ses lignes
router.post('/', async (req, res) => {
  const schemaName = req.userSchema;
  const userId = req.user?.userId || req.user?.id;
  const db = req.app.locals.pool;
  const { 
    type = 'devis', 
    tva_rate = 20, 
    notes = '', 
    lignes = [],
    client_nom = '',
    client_email = '',
    client_adresse = '',
    date_emission = new Date().toISOString().split('T')[0]
  } = req.body;
  
  console.log(`📄 POST /api/documents - Schéma: ${schemaName}`);
  console.log('📦 Données reçues:', { type, tva_rate, lignes: lignes.length });
  
  const client = await db.connect();
  
  try {
    // Assurer que les tables existent
    await ensureDocumentTables(schemaName, userId, db);

    await fixMissingColumns(schemaName, db);
    
    await client.query('BEGIN');
    
    // Calculer les totaux
    const { total_ht, total_tva, total_ttc } = computeTotals(lignes, tva_rate);
    
    // Générer une référence unique
    const reference = `${type.toUpperCase().substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Créer le document
    const insertDoc = await client.query(
      `INSERT INTO "${schemaName}".documents 
      (reference, type, statut, tva_rate, total_ht, total_tva, total_ttc, notes,
        client_nom, client_email, client_adresse, date_emission, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, reference, type, total_ttc`,
      [
        reference,
        type,
        'brouillon',
        tva_rate,
        total_ht,
        total_tva,
        total_ttc,
        notes,
        client_nom,
        client_email,
        client_adresse,
        date_emission,
        userId || req.user?.id || 0
      ]
    );
    
    const documentId = insertDoc.rows[0].id;
    
    // Ajouter les lignes
    if (lignes && Array.isArray(lignes)) {
      for (const ligne of lignes) {
        await client.query(
          `INSERT INTO "${schemaName}".document_lignes 
           (document_id, description, quantite, prix_unitaire, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [
            documentId,
            ligne.description || 'Produit',
            ligne.quantite || 1,
            ligne.prix_unitaire || 0
          ]
        );
      }
    }
    
    await client.query('COMMIT');
    
    client.release();
    
    console.log(`✅ Document créé: ${reference} (ID: ${documentId}) dans ${schemaName}`);
    
    res.status(201).json({
      success: true,
      data: {
        id: documentId,
        reference,
        type,
        total_ht,
        total_tva,
        total_ttc,
        schema: schemaName
      },
      message: 'Document créé avec succès'
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    
    console.error(`❌ Erreur POST /api/documents pour ${schemaName}:`, error);
    
    if (error.message.includes('n\'existe pas') || error.code === '42703') {
      console.log(`🔄 Tentative de réparation pour ${schemaName}...`);
      try {
        await repairDocumentTable(schemaName, db);
        return res.status(503).json({
          success: false,
          error: 'Table réparée, veuillez réessayer',
          retry: true
        });
      } catch (repairError) {
        console.error('❌ Échec réparation:', repairError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du document',
      details: error.message,
      schema: schemaName
    });
  }
});

// PUT: Mettre à jour un document
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  const userId = req.user?.userId || req.user?.id;
  const db = req.app.locals.pool;
  const { 
    type, 
    tva_rate, 
    notes, 
    lignes,
    client_nom,
    client_email,
    client_adresse,
    date_emission,
    statut
  } = req.body;
  
  console.log(`📄 PUT /api/documents/${id} - Schéma: ${schemaName}`);
  
  const client = await db.connect();
  
  try {
    await ensureDocumentTables(schemaName, userId, db);
    
    await client.query('BEGIN');
    
    // Vérifier que le document existe et appartient à l'utilisateur
    const docExists = await client.query(
      `SELECT id FROM "${schemaName}".documents WHERE id = $1`,
      [id]
    );
    
    if (docExists.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        error: 'Document introuvable',
        schema: schemaName
      });
    }
    
    let total_ht, total_tva, total_ttc;
    
    // Si des lignes sont fournies, recalculer les totaux
    if (lignes && Array.isArray(lignes)) {
      const totals = computeTotals(lignes, tva_rate);
      total_ht = totals.total_ht;
      total_tva = totals.total_tva;
      total_ttc = totals.total_ttc;
    }
    
    // Mettre à jour le document
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (type !== undefined) {
      updateFields.push(`type = $${paramCount++}`);
      updateValues.push(type);
    }
    
    if (statut !== undefined) {
      updateFields.push(`statut = $${paramCount++}`);
      updateValues.push(statut);
    }
    
    if (tva_rate !== undefined) {
      updateFields.push(`tva_rate = $${paramCount++}`);
      updateValues.push(tva_rate);
    }
    
    if (total_ht !== undefined) {
      updateFields.push(`total_ht = $${paramCount++}`);
      updateValues.push(total_ht);
    }
    
    if (total_tva !== undefined) {
      updateFields.push(`total_tva = $${paramCount++}`);
      updateValues.push(total_tva);
    }
    
    if (total_ttc !== undefined) {
      updateFields.push(`total_ttc = $${paramCount++}`);
      updateValues.push(total_ttc);
    }
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(notes);
    }
    
    if (client_nom !== undefined) {
      updateFields.push(`client_nom = $${paramCount++}`);
      updateValues.push(client_nom);
    }
    
    if (client_email !== undefined) {
      updateFields.push(`client_email = $${paramCount++}`);
      updateValues.push(client_email);
    }
    
    if (client_adresse !== undefined) {
      updateFields.push(`client_adresse = $${paramCount++}`);
      updateValues.push(client_adresse);
    }
    
    if (date_emission !== undefined) {
      updateFields.push(`date_emission = $${paramCount++}`);
      updateValues.push(date_emission);
    }
    
    // Toujours mettre à jour updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    updateValues.push(id);
    
    if (updateFields.length > 0) {
      await client.query(
        `UPDATE "${schemaName}".documents 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount}`,
        updateValues
      );
    }
    
    // Si des lignes sont fournies, les mettre à jour
    if (lignes && Array.isArray(lignes)) {
      // Supprimer les anciennes lignes
      await client.query(
        `DELETE FROM "${schemaName}".document_lignes WHERE document_id = $1`,
        [id]
      );
      
      // Ajouter les nouvelles lignes
      for (const ligne of lignes) {
        await client.query(
          `INSERT INTO "${schemaName}".document_lignes 
           (document_id, description, quantite, prix_unitaire, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [id, ligne.description || 'Produit', ligne.quantite || 1, ligne.prix_unitaire || 0]
        );
      }
    }
    
    await client.query('COMMIT');
    client.release();
    
    console.log(`✅ Document ${id} mis à jour dans ${schemaName}`);
    
    res.json({
      success: true,
      message: 'Document mis à jour avec succès',
      schema: schemaName
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    
    console.error(`❌ Erreur PUT /api/documents/${id} pour ${schemaName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du document',
      schema: schemaName
    });
  }
});

// DELETE: Supprimer un document
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  const userId = req.user?.userId || req.user?.id;
  const db = req.app.locals.pool;
  
  console.log(`📄 DELETE /api/documents/${id} - Schéma: ${schemaName}`);
  
  const client = await db.connect();
  
  try {
    await ensureDocumentTables(schemaName, userId, db);
    
    await client.query('BEGIN');
    
    // Vérifier que le document existe
    const docExists = await client.query(
      `SELECT id, pdf_filename FROM "${schemaName}".documents WHERE id = $1`,
      [id]
    );
    
    if (docExists.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        error: 'Document introuvable',
        schema: schemaName
      });
    }
    
    // Supprimer les lignes (CASCADE devrait le faire automatiquement)
    await client.query(
      `DELETE FROM "${schemaName}".document_lignes WHERE document_id = $1`,
      [id]
    );
    
    // Supprimer le document
    await client.query(
      `DELETE FROM "${schemaName}".documents WHERE id = $1`,
      [id]
    );
    
    await client.query('COMMIT');
    client.release();
    
    console.log(`✅ Document ${id} supprimé de ${schemaName}`);
    
    res.json({
      success: true,
      message: 'Document supprimé avec succès',
      schema: schemaName
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (client) client.release();
    
    console.error(`❌ Erreur DELETE /api/documents/${id} pour ${schemaName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du document',
      schema: schemaName
    });
  }
});

// Route proxy pour génération PDF (inchangée)
router.post('/:id/generate-pdf-puppeteer', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  
  console.log(`📄 Génération PDF via documents.js pour doc #${id}`);
  
  try {
    const proxyRes = await fetch(`http://localhost:${process.env.PORT || 5000}/api/documents-puppeteer/${id}/generate-pdf-puppeteer`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await proxyRes.json();
    res.status(proxyRes.status).json(data);
    
  } catch (error) {
    console.error('❌ Erreur proxy PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération PDF'
    });
  }
});

module.exports = router;
