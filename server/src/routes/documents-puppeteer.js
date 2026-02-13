// src/routes/documents-puppeteer.js - VERSION CORRIGÉE (utilise req.app.locals.pool)
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

// Dossier uploads
const UPLOADS_PATH = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
  console.log(`📁 Dossier uploads créé: ${UPLOADS_PATH}`);
}

// Middleware pour forcer le schéma utilisateur
router.use((req, res, next) => {
  console.log('📄 documents-puppeteer.js - Début middleware');
  
  if (!req.userSchema && req.user) {
    const userId = req.user.userId || req.user.id;
    if (userId) {
      req.userSchema = `user_${userId}`;
      console.log(`✅ Schéma calculé depuis user.id: ${req.userSchema}`);
    }
  }
  
  if (!req.userSchema) {
    req.userSchema = 'public';
    console.warn('⚠️  Utilisation du schéma public (admin ou fallback)');
  }
  
  console.log(`📄 documents-puppeteer.js - Schéma final: ${req.userSchema}`);
  console.log(`📄 User: ${req.user?.email || 'inconnu'}, Role: ${req.user?.role || 'inconnu'}`);
  
  next();
});

// Fonction pour créer les tables de documents si nécessaire (accepte un pool)
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
      console.log(`📋 Création schéma ${schemaName} pour documents...`);
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    }
    
    // 1. Table documents
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
    }
    
    // 2. Table document_lignes
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

// Helper HTML simplifié (inchangé)
const generateSimpleHTML = (doc, lignes) => {
  const rows = lignes.map(l => {
    const prixUnitaire = Number(l.prix_unitaire) || 0;
    const totalLigne = Number(l.total_ligne) || 0;
    
    return `
    <tr>
      <td>${escapeHtml(l.description || 'Produit')}</td>
      <td style="text-align:center">${l.quantite || 1}</td>
      <td style="text-align:right">${prixUnitaire.toFixed(2)} Fcfa</td>
      <td style="text-align:right">${totalLigne.toFixed(2)} Fcfa</td>
    </tr>
  `}).join('');
  
  const subtotal = lignes.reduce((s, l) => {
    const quantite = Number(l.quantite) || 0;
    const prixUnitaire = Number(l.prix_unitaire) || 0;
    return s + (quantite * prixUnitaire);
  }, 0);
  
  const tvaRate = Number(doc.tva_rate) || 20;
  const tva = (subtotal * tvaRate) / 100;
  const total = subtotal + tva;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${doc.type?.toUpperCase() || 'DOCUMENT'} - ${doc.reference || doc.id}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 15px; }
    .header { text-align: center; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #000; padding: 6px; text-align: left; }
    th { background-color: #f0f0f0; }
    .totals { width: 250px; float: right; margin-top: 15px; }
    .footer { margin-top: 30px; font-size: 9px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${doc.type?.toUpperCase() || 'DOCUMENT'}</h2>
    <h3>${doc.reference || `REF-${doc.id}`}</h3>
  </div>
  
  <div><strong>Client:</strong> ${escapeHtml(doc.client_nom || 'Non spécifié')}</div>
  <div><strong>Date:</strong> ${new Date(doc.date_emission || Date.now()).toLocaleDateString('fr-FR')}</div>
  
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qté</th>
        <th>Prix U.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  
  <table class="totals">
    <tr><td>Sous-total HT:</td><td style="text-align:right">${subtotal.toFixed(2)} Fcfa</td></tr>
    <tr><td>TVA ${tvaRate}%:</td><td style="text-align:right">${tva.toFixed(2)} Fcfa</td></tr>
    <tr><td><strong>Total TTC:</strong></td><td style="text-align:right"><strong>${total.toFixed(2)} Fcfa</strong></td></tr>
  </table>
  
  ${doc.notes ? `<div style="margin-top: 20px;"><strong>Notes:</strong><br>${escapeHtml(doc.notes)}</div>` : ''}
  
  <div class="footer">
    Généré le ${new Date().toLocaleDateString('fr-FR')}
  </div>
</body>
</html>`;
};

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Route de génération PDF
router.post('/:id/generate-pdf-puppeteer', async (req, res) => {
  const { id } = req.params;
  const schemaName = req.userSchema;
  const userId = req.user?.userId || req.user?.id;
  const pool = req.app.locals.pool; // Utiliser le pool partagé
  
  console.log(`📄 Génération PDF pour document #${id}`);
  
  let client;
  let browser = null;
  
  try {
    // Acquérir un client du pool partagé
    client = await pool.connect();
    
    // Assurer que les tables existent
    await ensureDocumentTables(schemaName, userId, pool);
    
    // Récupérer le document
    const docRes = await client.query(
      `SELECT * FROM "${schemaName}".documents WHERE id = $1`,
      [id]
    );
    
    if (docRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ 
        success: false,
        error: 'Document introuvable'
      });
    }
    
    const doc = docRes.rows[0];
    
    // Récupérer les lignes
    const lignesRes = await client.query(
      `SELECT * FROM "${schemaName}".document_lignes WHERE document_id = $1`,
      [id]
    );
    
    const lignes = lignesRes.rows;
    
    // Libérer le client avant de lancer Puppeteer (pour éviter de bloquer)
    client.release();
    client = null;
    
    // Générer le HTML
    const html = generateSimpleHTML(doc, lignes);
    
    // Générer le PDF
    const filename = `${doc.type || 'document'}_${doc.reference || id}_${Date.now()}.pdf`;
    const outPath = path.join(UPLOADS_PATH, filename);
    
    console.log(`📄 Lancement Puppeteer...`);
    
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ],
      timeout: 60000
    });
    
    const page = await browser.newPage();
    
    // Désactiver les ressources inutiles
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    await page.pdf({ 
      path: outPath, 
      format: 'A4',
      printBackground: false,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      timeout: 30000
    });
    
    await browser.close();
    browser = null;
    
    // Réacquérir un client pour mettre à jour le document
    client = await pool.connect();
    
    await client.query(
      `UPDATE "${schemaName}".documents 
       SET pdf_filename = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [filename, id]
    );
    
    client.release();
    
    console.log(`✅ PDF généré avec succès: ${filename}`);
    
    res.json({
      success: true,
      pdfUrl: `/uploads/${filename}`,
      filename: filename,
      message: 'PDF généré avec succès'
    });
    
  } catch (err) {
    // Nettoyage
    if (browser) {
      try { await browser.close(); } catch (closeErr) { console.error('❌ Erreur fermeture browser:', closeErr); }
    }
    if (client) {
      try { client.release(); } catch (releaseErr) { console.error('❌ Erreur libération client:', releaseErr); }
    }
    
    console.error('❌ Erreur génération PDF:', err.message);
    
    if (err.name === 'TimeoutError') {
      return res.status(504).json({
        success: false,
        error: 'Timeout lors de la génération du PDF',
        suggestion: 'Le document est trop complexe ou Puppeteer rencontre un problème'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération du PDF',
      details: err.message
    });
  }
});

module.exports = router;
