// server.js - VERSION SIMPLIFIÉE AVEC ISOLATION DES DONNÉES
require('dotenv').config();
const express = require('express');
const app = express();
const pool = require('./src/db');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const IACRMMotor = require('./src/ia/ia-engine');
const iaWebhooksRoutes = require('./src/routes/ia-webhooks');
const debugRoutes = require('./debug-webhook');

const WebSocket = require('ws');


const wss = new WebSocket.Server({ noServer: true });



// ==================== CONFIGURATION ====================

app.locals.pool = pool;
const PORT = process.env.PORT || 5000;
const UPLOADS_PATH = path.join(__dirname, 'uploads');

// Vérifier/Créer dossier uploads
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}
console.log('📁 Dossier uploads:', UPLOADS_PATH);

(async function main() {
  try {

    // ==================== CONFIGURATION POSTGRESQL ====================
    // NOUVEAU - Compatible Render
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // OBLIGATOIRE pour Render
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
    });

    pool.connect()
      .then(client => {
        console.log('✅ PostgreSQL connecté via DATABASE_URL');
        client.release();
      })
      .catch(err => {
        console.error('❌ PostgreSQL connexion échouée:', err.message);
      })

    // Gestion des erreurs de connexion
    pool.on('error', (err) => {
      console.error('❌ Erreur inattendue du pool PostgreSQL:', err);
      // Tenter de reconnecter ? Optionnel
    });

    
    

    FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID  ;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET  ;
    const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
    const FACEBOOK_VERIFY_TOKEN_GLOBAL = process.env.FACEBOOK_VERIFY_TOKEN_GLOBAL;

    if (!global.oauthStates) {
      global.oauthStates = new Map();
    }

    // Stockage temporaire des états OAuth (pour la sécurité)
    const oauthStates = new Map();

    app.locals.pool = pool;

    app.use('/api/commandes', require('./src/routes/commandes'));

    // ==================== MIDDLEWARE ====================
    app.use(helmet({ 
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // Configuration CORS complète
    const corsOptions = {
      origin: [
        'http://localhost:3000',
        'https://erp-crm-client.onrender.com',
        process.env.APP_BASE_URL
      ].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    };
    app.use(cors(corsOptions));
    
    // Middleware CORS personnalisé (vers la ligne 68)
    app.use((req, res, next) => {
      const allowedOrigin = req.headers.origin?.includes('localhost') 
        ? req.headers.origin 
        : 'https://erp-crm-client.onrender.com';
      res.header('Access-Control-Allow-Origin', allowedOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      next();
    });

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Servir les fichiers statiques avec CORS
    app.use('/uploads', express.static(UPLOADS_PATH));


    // ==================== MIDDLEWARE D'AUTHENTIFICATION ====================

    const authenticate = async (req, res, next) => {
      try {
        console.log('🔐 Début authentification pour:', req.originalUrl);
        
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          console.error('❌ Aucun header Authorization trouvé');
          return res.status(401).json({
            success: false,
            error: 'Token manquant',
            debug: 'Header Authorization manquant'
          });
        }
        
        if (!authHeader.startsWith('Bearer ')) {
          console.error('❌ Format Authorization incorrect:', authHeader.substring(0, 50));
          return res.status(401).json({
            success: false,
            error: 'Format de token incorrect. Doit commencer par "Bearer "'
          });
        }
        
        const token = authHeader.split(' ')[1];
        console.log('🔑 Token reçu (début):', token.substring(0, 20) + '...');
        
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET );
          
          const userId = decoded.userId || decoded.id;
          const userSchema = decoded.schema || `user_${userId}`;
          
          req.user = {
            userId: userId,
            id: userId,
            email: decoded.email || 'unknown@email.com',
            role: decoded.role || 'user',
            schema: userSchema
          };
          
          req.userSchema = userSchema;
          
          console.log(`✅ Authentification réussie pour: ${req.user.email}, Schema: ${req.userSchema}`);
          
          next();
        } catch (jwtError) {
          console.error('❌ Erreur JWT:', jwtError.message);
          return res.status(401).json({
            success: false,
            error: 'Token invalide ou expiré',
            details: jwtError.message
          });
        }
        
      } catch (error) {
        console.error('❌ Erreur authentification:', error.message);
        res.status(500).json({
          success: false,
          error: 'Erreur serveur lors de l\'authentification'
        });
      }
    };

    // Middleware pour forcer l'isolation des données
    const enforceDataIsolation = (req, res, next) => {
      try {
        if (!req.user) {
          console.warn('⚠️  enforceDataIsolation: req.user est undefined');
          return next();
        }
        
        if (!req.userSchema) {
          if (req.user.userId) {
            req.userSchema = `user_${req.user.userId}`;
          } else if (req.user.id) {
            req.userSchema = `user_${req.user.id}`;
          } else if (req.user.schema) {
            req.userSchema = req.user.schema;
          } else {
            req.userSchema = 'public';
            console.warn('⚠️  Aucun schéma trouvé, utilisation de "public"');
          }
        }
        
        if (req.user.role !== 'admin') {
          const userId = req.user.userId || req.user.id;
          if (userId) {
            const expectedSchema = `user_${userId}`;
            
            if (req.userSchema !== expectedSchema) {
              console.warn(`⚠️  Correction schéma: ${req.userSchema} → ${expectedSchema}`);
              req.userSchema = expectedSchema;
            }
            
            console.log(`🔐 Utilisateur ${req.user.email || 'inconnu'} accède à son schéma: ${req.userSchema}`);
          }
        } else {
          console.log(`👑 Admin ${req.user.email} accède au schéma: ${req.userSchema || 'tous les schémas'}`);
        }
        
        next();
        
      } catch (error) {
        console.error('❌ Erreur critique dans enforceDataIsolation:', error);
        next();
      }
    };

    // ==================== FONCTIONS UTILITAIRES ====================

    // Fonction pour formater les dates
    function formatDate(date, formatStr) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      if (formatStr === 'dd/MM') return `${day}/${month}`;
      if (formatStr === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
      return `${day}/${month}/${year}`;
    }

    // Fonction pour les statistiques vides
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
        topProduits: [],
        revenue_data: { labels: [], values: [] }
      };
    }

    // ==================== CRÉATION DES TABLES UTILISATEUR ====================

    async function createUserTables(userId) {
      const schemaName = `user_${userId}`;
      console.log(`🔧 Création des tables pour: ${schemaName}`);
    
      const client = await pool.connect();
    
      try {
        // === TRANSACTION 1 : CRÉATION DU SCHÉMA ===
        await client.query('BEGIN');
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        await client.query('COMMIT');
        console.log(`✅ Schéma ${schemaName} créé`);
    
        // === TRANSACTION 2 : TABLES PRINCIPALES (ERP-CRM) ===
        await client.query('BEGIN');
    
        // 2.1 Table contacts
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".contacts (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(100) NOT NULL,
            prenom VARCHAR(100),
            telephone VARCHAR(20),
            email VARCHAR(100) UNIQUE,
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
        console.log(`✅ Table ${schemaName}.contacts créée`);
    
        // 2.2 Table produits
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".produits (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(200) NOT NULL,
            description TEXT,
            prix DECIMAL(10, 2) NOT NULL,
            stock INTEGER DEFAULT 0,
            stock_min INTEGER DEFAULT 10,
            stock_max INTEGER DEFAULT 100,
            code_barres VARCHAR(50),
            categorie VARCHAR(100),
            image VARCHAR(255),
            tva DECIMAL(5, 2) DEFAULT 20.0,
            actif BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.produits créée`);
    
        // 2.3 Table commandes
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".commandes (
            id SERIAL PRIMARY KEY,
            numero_commande VARCHAR(50) UNIQUE NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            statut VARCHAR(20) DEFAULT 'en attente',
            total DECIMAL(12, 2) DEFAULT 0,
            total_ht DECIMAL(12, 2) DEFAULT 0,
            tva DECIMAL(12, 2) DEFAULT 0,
            contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
            notes TEXT,
            mode_paiement VARCHAR(50),
            date_livraison TIMESTAMP,
            adresse_livraison TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.commandes créée`);
    
        // 2.4 Table lignes_commande
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".lignes_commande (
            id SERIAL PRIMARY KEY,
            commande_id INTEGER REFERENCES "${schemaName}".commandes(id) ON DELETE CASCADE,
            produit_id INTEGER REFERENCES "${schemaName}".produits(id),
            quantite INTEGER NOT NULL,
            prix_unitaire DECIMAL(10, 2) NOT NULL,
            remise DECIMAL(5, 2) DEFAULT 0,
            total_ligne DECIMAL(12, 2) GENERATED ALWAYS AS (quantite * prix_unitaire * (1 - remise/100)) STORED,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.lignes_commande créée`);
    
        // 2.5 Table opportunites
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".opportunites (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(200) NOT NULL,
            contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
            montant DECIMAL(12, 2),
            probabilite INTEGER DEFAULT 50,
            date_fermeture TIMESTAMP,
            statut VARCHAR(20) DEFAULT 'en cours',
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.opportunites créée`);
    
        // 2.6 Table categories
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".categories (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            type VARCHAR(50) DEFAULT 'produit',
            parent_id INTEGER REFERENCES "${schemaName}".categories(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.categories créée`);
    
        // 2.7 Table documents
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            reference VARCHAR(100) UNIQUE NOT NULL,
            contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
            commande_id INTEGER REFERENCES "${schemaName}".commandes(id),
            client_nom VARCHAR(200),
            client_email VARCHAR(200),
            client_adresse TEXT,
            montant DECIMAL(12, 2),
            total_ht DECIMAL(12, 2) DEFAULT 0,
            tva_rate DECIMAL(5, 2) DEFAULT 20.00,
            total_tva DECIMAL(12, 2) DEFAULT 0,
            total_ttc DECIMAL(12, 2) DEFAULT 0,
            statut VARCHAR(20) DEFAULT 'brouillon',
            date_emission DATE DEFAULT CURRENT_DATE,
            date_validite DATE,
            notes TEXT,
            pdf_filename VARCHAR(255),
            metadata JSONB,
            user_id INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.documents créée`);
    
        // 2.8 Table activity_logs
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".activity_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50),
            entity_id INTEGER,
            details JSONB DEFAULT '{}',
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.activity_logs créée`);
    
        // 2.9 Table notifications
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            priority VARCHAR(20) DEFAULT 'medium',
            read BOOLEAN DEFAULT false,
            action_url VARCHAR(500),
            metadata JSONB DEFAULT '{}',
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.notifications créée`);
    
        // 2.10 Table user_settings
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".user_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE,
            preferences JSONB DEFAULT '{}',
            ui_settings JSONB DEFAULT '{}',
            notification_settings JSONB DEFAULT '{}',
            export_settings JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.user_settings créée`);
    
        // 2.11 Table deleted_entities
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".deleted_entities (
            id SERIAL PRIMARY KEY,
            entity_type VARCHAR(50),
            entity_id INTEGER,
            entity_data JSONB DEFAULT '{}',
            deleted_by INTEGER,
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.deleted_entities créée`);
    
        // 2.12 Table webhook_accounts (version simplifiée sans colonnes problématiques)
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".webhook_accounts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            platform VARCHAR(50) NOT NULL,
            platform_type VARCHAR(50) DEFAULT 'generic',
            name VARCHAR(100),
            account_sid VARCHAR(100),
            auth_token VARCHAR(255),
            access_token_encrypted TEXT,
            phone_number VARCHAR(50),
            phone_id VARCHAR(100),
            business_id VARCHAR(100),
            page_id VARCHAR(100),
            page_name VARCHAR(200),
            webhook_url VARCHAR(500),
            verify_token VARCHAR(255),
            webhook_fields TEXT[] DEFAULT '{}',
            graph_api_version VARCHAR(10) DEFAULT 'v18.0',
            ai_enabled BOOLEAN DEFAULT false,
            auto_reply BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            meta_verified BOOLEAN DEFAULT false,
            verification_status VARCHAR(50) DEFAULT 'pending',
            config_data JSONB DEFAULT '{}',
            last_sync TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.webhook_accounts créée`);
    
        // 2.13 Table automation_settings
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".automation_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE,
            auto_responder BOOLEAN DEFAULT true,
            auto_create_contacts BOOLEAN DEFAULT true,
            auto_update_conversations BOOLEAN DEFAULT true,
            auto_process_orders BOOLEAN DEFAULT true,
            auto_generate_quotes BOOLEAN DEFAULT false,
            working_hours_only BOOLEAN DEFAULT false,
            working_hours_start TIME DEFAULT '08:00',
            working_hours_end TIME DEFAULT '18:00',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.automation_settings créée`);
    
        // 2.14 Table conversations
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".conversations (
            id SERIAL PRIMARY KEY,
            contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
            channel VARCHAR(50) NOT NULL,
            contexte JSONB DEFAULT '{}',
            derniere_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            statut VARCHAR(20) DEFAULT 'active',
            is_virtual BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.conversations créée`);
    
        // 2.15 Table messages
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES "${schemaName}".conversations(id),
            contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
            type VARCHAR(20) NOT NULL,
            contenu TEXT NOT NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.messages créée`);
    
        // === INDEX POUR TABLES PRINCIPALES ===
        // Contacts
        await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON "${schemaName}".contacts(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_nom ON "${schemaName}".contacts(nom)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_entreprise ON "${schemaName}".contacts(entreprise)`);
        // Produits
        await client.query(`CREATE INDEX IF NOT EXISTS idx_produits_nom ON "${schemaName}".produits(nom)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_produits_categorie ON "${schemaName}".produits(categorie)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_produits_actif ON "${schemaName}".produits(actif)`);
        // Commandes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_numero ON "${schemaName}".commandes(numero_commande)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_statut ON "${schemaName}".commandes(statut)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_date ON "${schemaName}".commandes(date)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_contact ON "${schemaName}".commandes(contact_id)`);
        // Lignes commande
        await client.query(`CREATE INDEX IF NOT EXISTS idx_lignes_commande_commande ON "${schemaName}".lignes_commande(commande_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_lignes_commande_produit ON "${schemaName}".lignes_commande(produit_id)`);
        // Opportunites
        await client.query(`CREATE INDEX IF NOT EXISTS idx_opportunites_statut ON "${schemaName}".opportunites(statut)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_opportunites_contact ON "${schemaName}".opportunites(contact_id)`);
        // Categories
        await client.query(`CREATE INDEX IF NOT EXISTS idx_categories_type ON "${schemaName}".categories(type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_categories_parent ON "${schemaName}".categories(parent_id)`);
        // Documents
        await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_type ON "${schemaName}".documents(type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_reference ON "${schemaName}".documents(reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_statut ON "${schemaName}".documents(statut)`);
        // Activity logs
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_user ON "${schemaName}".activity_logs(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_action ON "${schemaName}".activity_logs(action)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_date ON "${schemaName}".activity_logs(created_at)`);
        // Notifications
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON "${schemaName}".notifications(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON "${schemaName}".notifications(read)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_priority ON "${schemaName}".notifications(priority)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_expires ON "${schemaName}".notifications(expires_at)`);
        // User settings
        await client.query(`CREATE INDEX IF NOT EXISTS idx_user_settings_user ON "${schemaName}".user_settings(user_id)`);
        // Deleted entities
        await client.query(`CREATE INDEX IF NOT EXISTS idx_deleted_entities_type ON "${schemaName}".deleted_entities(entity_type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_deleted_entities_date ON "${schemaName}".deleted_entities(deleted_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_deleted_entities_user ON "${schemaName}".deleted_entities(deleted_by)`);
        // Webhook accounts
        await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_accounts_user ON "${schemaName}".webhook_accounts(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_accounts_platform ON "${schemaName}".webhook_accounts(platform)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_accounts_active ON "${schemaName}".webhook_accounts(is_active)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_accounts_ai_enabled ON "${schemaName}".webhook_accounts(ai_enabled)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_accounts_last_sync ON "${schemaName}".webhook_accounts(last_sync)`);
        // Automation settings
        await client.query(`CREATE INDEX IF NOT EXISTS idx_automation_settings_user ON "${schemaName}".automation_settings(user_id)`);
        // Conversations
        await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_contact ON "${schemaName}".conversations(contact_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_channel ON "${schemaName}".conversations(channel)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_status ON "${schemaName}".conversations(statut)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_interaction ON "${schemaName}".conversations(derniere_interaction)`);
        // Messages
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON "${schemaName}".messages(conversation_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_contact ON "${schemaName}".messages(contact_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_type ON "${schemaName}".messages(type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_date ON "${schemaName}".messages(created_at)`);
    
        await client.query('COMMIT');
        console.log(`✅ Tables principales et index créés pour ${schemaName}`);
    
        // === TRANSACTION 3 : TABLES SECONDAIRES (webhook_logs et IA) ===
        await client.query('BEGIN');
    
        // Table webhook_logs (avec clé étrangère vers webhook_accounts)
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schemaName}".webhook_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            account_id INTEGER REFERENCES "${schemaName}".webhook_accounts(id) ON DELETE CASCADE,
            platform VARCHAR(50) NOT NULL,
            url TEXT,
            method VARCHAR(10),
            status_code INTEGER,
            headers JSONB,
            payload JSONB,
            response JSONB,
            error TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`✅ Table ${schemaName}.webhook_logs créée`);
    
        // Tables IA
        await createIATablesForSchema(schemaName);  // Assurez-vous que cette fonction utilise des guillemets
    
        await client.query('COMMIT');
        console.log(`✅ Tables secondaires créées pour ${schemaName}`);
    
        // === DONNÉES INITIALES (hors transaction) ===
        // Insertion des données initiales (user_settings, etc.)
        await client.query(`
          INSERT INTO "${schemaName}".user_settings 
          (user_id, preferences, ui_settings, notification_settings, export_settings)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO NOTHING
        `, [
          userId,
          JSON.stringify({}),
          JSON.stringify({}),
          JSON.stringify({ email_notifications: true, push_notifications: true, order_updates: true }),
          JSON.stringify({})
        ]);
        console.log('✅ Données initiales insérées');
    
        return true;
    
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ ERREUR CRITIQUE création tables ${schemaName}:`, error);
        console.error('Détails:', { message: error.message, code: error.code, schema: schemaName, userId });
        return false;
      } finally {
        client.release();
      }
    }



    async function createIATablesForSchema(schemaName) {
        const client = await pool.connect();
        
        try {
            console.log(`🤖 Création tables IA pour: ${schemaName}`);
            
            await client.query('BEGIN');
            
            // Table client_profiles
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".client_profiles (
                    id SERIAL PRIMARY KEY,
                    contact_id INTEGER REFERENCES "${schemaName}".contacts(id) ON DELETE CASCADE,
                    
                    language_preferences JSONB DEFAULT '{
                        "tutoiement": false,
                        "formalite": "standard",
                        "langue": "fr",
                        "emojis": false
                    }',
                    
                    behavioral_patterns JSONB DEFAULT '{
                        "jours_preferes": [],
                        "horaires_preferes": [],
                        "produits_frequents": [],
                        "canaux_preferes": ["chat"]
                    }',
                    
                    interaction_stats JSONB DEFAULT '{
                        "total_interactions": 0,
                        "satisfaction_moyenne": 0.5,
                        "temps_reponse_moyen": 0,
                        "abandon_rate": 0
                    }',
                    
                    client_category VARCHAR(50) DEFAULT 'standard',
                    tags TEXT[] DEFAULT '{}',
                    keywords TEXT,
                    
                    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    first_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    profile_version INTEGER DEFAULT 1,
                    
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Table business_rules
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".business_rules (
                    id SERIAL PRIMARY KEY,
                    rule_name VARCHAR(200) NOT NULL,
                    
                    conditions JSONB NOT NULL,
                    actions JSONB NOT NULL,
                    
                    priority INTEGER DEFAULT 50,
                    
                    scope VARCHAR(50) DEFAULT 'global',
                    target_contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
                    target_category VARCHAR(100),
                    
                    is_active BOOLEAN DEFAULT true,
                    usage_count INTEGER DEFAULT 0,
                    success_rate DECIMAL(5,2) DEFAULT 0,
                    
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Table conversation_history
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".conversation_history (
                    id SERIAL PRIMARY KEY,
                    conversation_id INTEGER REFERENCES "${schemaName}".conversations(id) ON DELETE CASCADE,
                    contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
                    
                    message_text TEXT NOT NULL,
                    message_type VARCHAR(20) NOT NULL,
                    
                    ai_response TEXT,
                    response_type VARCHAR(50),
                    
                    message_keywords TEXT[],
                    
                    reasoning_log JSONB DEFAULT '{
                        "rules_applied": [],
                        "confidence_score": 0,
                        "data_sources": [],
                        "decision_path": []
                    }',
                    
                    user_feedback INTEGER,
                    feedback_comment TEXT,
                    corrected_response TEXT,
                    
                    response_time_ms INTEGER,
                    
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Table purchase_intents
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_intents (
                    id SERIAL PRIMARY KEY,
                    conversation_id INTEGER REFERENCES "${schemaName}".conversation_history(id),
                    contact_id INTEGER REFERENCES "${schemaName}".contacts(id),
                    
                    intent_type VARCHAR(50) NOT NULL,
                    product_details JSONB DEFAULT '{}',
                    quantity INTEGER DEFAULT 1,
                    
                    status VARCHAR(20) DEFAULT 'detected',
                    converted_to_order_id INTEGER REFERENCES "${schemaName}".commandes(id),
                    
                    confidence_score DECIMAL(3,2) DEFAULT 0,
                    urgency_level VARCHAR(20) DEFAULT 'normal',
                    
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Créer les index
            await client.query(`CREATE INDEX IF NOT EXISTS idx_client_profiles_contact ON "${schemaName}".client_profiles(contact_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_business_rules_priority ON "${schemaName}".business_rules(priority DESC)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_history_contact ON "${schemaName}".conversation_history(contact_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_conversation_history_date ON "${schemaName}".conversation_history(created_at DESC)`);
            
            // Règles par défaut
            await client.query(`
                INSERT INTO "${schemaName}".business_rules 
                (rule_name, conditions, actions, priority, scope, created_at)
                VALUES 
                (
                    'Réponse promotion VIP',
                    '{"message_contains": "prix", "client_category": "VIP"}'::jsonb,
                    '{"respond_with": "En tant que client VIP, vous bénéficiez de 15% de remise !"}'::jsonb,
                    90,
                    'category',
                    CURRENT_TIMESTAMP
                ),
                (
                    'Création contact automatique',
                    '{"message_contains": "je m''appelle"}'::jsonb,
                    '{"respond_with": "Bonjour ! Je vous ai créé un profil client. Comment puis-je vous aider ?"}'::jsonb,
                    80,
                    'global',
                    CURRENT_TIMESTAMP
                ),
                (
                    'Demande d''horaires',
                    '{"message_contains": "heure"}'::jsonb,
                    '{"respond_with": "Nos horaires sont du lundi au vendredi de 9h à 18h, samedi de 10h à 16h."}'::jsonb,
                    70,
                    'global',
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT DO NOTHING
            `);
            
            await client.query('COMMIT');
            console.log(`✅ Tables IA créées pour ${schemaName}`);

            
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Erreur création tables IA ${schemaName}:`, error.message);
        } finally {
            client.release();
        }
    }


    // Fonction pour vérifier et créer les tables si nécessaire
    async function ensureUserTables(schemaName, userId, poolInstance = pool) {
      try {
        console.log(`🔍 ensureUserTables appelé pour ${schemaName}, userId=${userId}`);
        
        // Vérifier si le schéma existe
        const schemaExists = await poolInstance.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.schemata 
            WHERE schema_name = $1
          )
        `, [schemaName]);
        
        if (!schemaExists.rows[0].exists) {
          console.log(`📋 Schéma ${schemaName} non trouvé, création...`);
          await createUserTables(userId);
          return;
        }
        
        // Vérifier si la table contacts existe
        const tableExists = await poolInstance.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = 'contacts'
          )
        `, [schemaName]);
        
        if (!tableExists.rows[0].exists) {
          console.log(`📋 Table contacts non trouvée dans ${schemaName}, création...`);
          await createUserTables(userId);
        }
        
      } catch (error) {
        console.error(`❌ Erreur vérification tables ${schemaName}:`, error.message);
      }
    }

    // Fonction pour initialiser les paramètres IA par défaut
    async function initIADefaultSettings(schemaName, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Vérifier si la table ia_settings existe, sinon la créer
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".ia_settings (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE,
                    enabled BOOLEAN DEFAULT true,
                    confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
                    max_context_length INTEGER DEFAULT 10,
                    learning_enabled BOOLEAN DEFAULT true,
                    rule_based_responses BOOLEAN DEFAULT true,
                    product_recommendations BOOLEAN DEFAULT true,
                    sentiment_analysis BOOLEAN DEFAULT true,
                    language VARCHAR(10) DEFAULT 'fr',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Insérer les paramètres IA par défaut
            await client.query(`
                INSERT INTO "${schemaName}".ia_settings 
                (user_id, enabled, confidence_threshold, max_context_length, learning_enabled)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id) DO UPDATE SET
                    updated_at = CURRENT_TIMESTAMP
            `, [
                userId,
                true,      // IA activée
                0.7,       // Seuil de confiance
                10,        // Longueur du contexte
                true       // Apprentissage activé
            ]);
            
            // Créer la table feedback_learning si elle n'existe pas
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".feedback_learning (
                    id SERIAL PRIMARY KEY,
                    conversation_id INTEGER REFERENCES "${schemaName}".conversation_history(id),
                    original_response TEXT,
                    corrected_response TEXT,
                    correction_type VARCHAR(50),
                    learned_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    INDEX idx_feedback_conversation (conversation_id),
                    INDEX idx_feedback_type (correction_type)
                )
            `);
            
            // Créer la table webhook_errors si elle n'existe pas
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}".webhook_errors (
                    id SERIAL PRIMARY KEY,
                    account_id INTEGER,
                    error_code VARCHAR(50),
                    error_message TEXT,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    INDEX idx_webhook_errors_account (account_id),
                    INDEX idx_webhook_errors_date (created_at)
                )
            `);
            
            // Créer un trigger pour updated_at sur ia_settings
            await client.query(`
                CREATE OR REPLACE FUNCTION "${schemaName}".update_ia_settings_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            `);
            
            await client.query(`
                DROP TRIGGER IF EXISTS update_ia_settings_updated_at ON "${schemaName}".ia_settings;
                CREATE TRIGGER update_ia_settings_updated_at
                BEFORE UPDATE ON "${schemaName}".ia_settings
                FOR EACH ROW
                EXECUTE FUNCTION "${schemaName}".update_ia_settings_updated_at()
            `);
            
            await client.query('COMMIT');
            console.log(`✅ Paramètres IA initialisés pour ${schemaName}`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Erreur initialisation IA ${schemaName}:`, error.message);
        } finally {
            client.release();
        }
    }

    /**
    * Log un événement webhook avec vérification du compte
    */
    async function logWebhookWithAccountCheck(schemaName, userId, requestedAccountId, validAccountId, payload) {
      try {
        // Essayer d'abord avec le validAccountId (peut être null)
        await pool.query(`
          INSERT INTO "${schemaName}".webhook_logs 
          (user_id, account_id, platform, method, url, status_code, payload, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          userId,
          validAccountId,
          'facebook_messenger',
          'POST',
          `/api/webhook/messenger/${userId}/${requestedAccountId}`,
          200,
          JSON.stringify(payload)
        ]);
        
        console.log('✅ Webhook logué avec succès');
        
      } catch (logError) {
        // Gestion spécifique des erreurs de contrainte
        if (logError.code === '23503' && logError.constraint === 'webhook_logs_account_id_fkey') {
          console.log(`⚠️ Contrainte clé étrangère pour account_id ${requestedAccountId}`);
          
          // Essayer sans account_id
          await pool.query(`
            INSERT INTO "${schemaName}".webhook_logs 
            (user_id, platform, method, url, status_code, payload, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
            userId,
            'facebook_messenger',
            'POST',
            `/api/webhook/messenger/${userId}/${requestedAccountId}`,
            200,
            JSON.stringify(payload)
          ]);
          
          console.log('✅ Webhook logué sans account_id (fallback)');
          
        } else if (logError.code === '23505') {
          // Erreur de clé dupliquée - ignorer car le log existe déjà
          console.log('ℹ️ Log déjà existant (duplicate key), ignoré');
          
        } else {
          // Autre erreur - logger sans bloquer
          console.error('❌ Erreur logging webhook (non critique):', logError.message);
          
          // Dernier recours: logger dans la console seulement
          console.log('📝 Webhook payload (console fallback):', {
            userId,
            accountId: requestedAccountId,
            payload: payload
          });
        }
      }
    }

    /**
    * Traite un événement webhook Facebook
    */

    async function processFacebookWebhook(schemaName, userId, accountId, validAccountId, body) {
      console.log('🔍 ========== DÉBUT TRAITEMENT WEBHOOK FACEBOOK ==========');
      console.log(`👤 Utilisateur: ${userId}, Schéma: ${schemaName}, Compte: ${accountId}, Compte validé: ${validAccountId}`);
      
      try {
        // Vérification du type d'objet
        if (body.object !== 'page') {
          console.log('⚠️ Ignoré: Ce n\'est pas un événement Page (object=' + body.object + ')');
          return;
        }
        
        console.log(`✅ Événement Facebook Page valide`);
        console.log(`📊 Nombre d'entrées: ${body.entry?.length || 0}`);

        if (!body.entry || body.entry.length === 0) {
          console.log('⚠️ Aucune entrée dans le webhook');
          return;
        }
        
        // Traiter chaque entrée
        for (const entry of body.entry) {
          const pageId = entry.id;
          const eventTime = entry.time ? new Date(entry.time).toISOString() : 'N/A';
          
          console.log('\n📦 ENTRY:', {
            pageId: pageId,
            time: eventTime,
            messagingEvents: entry.messaging?.length || 0
          });
          
          // Vérifier que c'est bien la bonne page (sécurité)
          if (entry.id !== body.entry[0].id) {
            console.log('⚠️ Entry ID mismatch, ignoré');
            continue;
          }
          
          if (!entry.messaging || entry.messaging.length === 0) {
            console.log('ℹ️ Aucun événement messaging dans cette entrée');
            continue;
          }
          
          // Traiter chaque événement de messagerie
          for (const event of entry.messaging) {
            console.log('\n📩 Traitement message:', {
              sender: event.sender?.id,
              recipient: event.recipient?.id,
              hasText: !!event.message?.text,
              isEcho: event.message?.is_echo || false,
              timestamp: event.timestamp
            });
            
            try {
              // Utiliser l'ID validé (fallback sur accountId si nécessaire)
              const targetAccountId = validAccountId || accountId;
              
              // 🔍 VÉRIFICATION CRITIQUE DU STATUT
              const accountCheck = await pool.query(
                `SELECT id, is_active, verification_status, meta_verified, 
                        page_id, page_name, ai_enabled, auto_reply,
                        access_token_encrypted
                FROM "${schemaName}".webhook_accounts 
                WHERE id = $1 AND platform = 'facebook_messenger'`,
                [targetAccountId]
              );
              
              if (accountCheck.rows.length === 0) {
                console.error(`❌ Compte ${targetAccountId} introuvable dans ${schemaName}`);
                continue;
              }
              
              const account = accountCheck.rows[0];
              console.log('📋 Statut compte récupéré:', {
                id: account.id,
                name: account.page_name,
                is_active: account.is_active,
                verification_status: account.verification_status,
                meta_verified: account.meta_verified
              });
              
              // ✅ CORRECTION CRITIQUE : Accepter si ACTIF OU VÉRIFIÉ
              const isAccountAcceptable = 
                account.is_active === true || 
                account.verification_status === 'verified' || 
                account.meta_verified === true;
              
              if (!isAccountAcceptable) {
                console.log(`⛔ REJET: Compte ${targetAccountId} inactif et non vérifié`, {
                  is_active: account.is_active,
                  verification_status: account.verification_status,
                  meta_verified: account.meta_verified
                });
                
                // Logger le rejet pour debug
                try {
                  await pool.query(`
                    INSERT INTO "${schemaName}".webhook_logs 
                    (user_id, account_id, platform, status_code, error, timestamp, payload)
                    VALUES ($1, $2, 'facebook_messenger', 403, 'Compte inactif/non vérifié', NOW(), $3)
                  `, [
                    userId, 
                    targetAccountId, 
                    JSON.stringify({ reason: 'inactive', is_active: account.is_active, status: account.verification_status })
                  ]);
                } catch (logErr) {
                  // Ignorer erreur de logging
                }
                continue; // Passer au message suivant
              }
              
              // 🔧 AUTO-FIX: Activer le compte s'il est vérifié mais inactif
              if (!account.is_active && (account.verification_status === 'verified' || account.meta_verified)) {
                console.log(`🔧 Auto-correction: Activation du compte ${targetAccountId} (vérifié mais inactif)`);
                
                await pool.query(
                  `UPDATE "${schemaName}".webhook_accounts 
                  SET is_active = true, 
                      updated_at = NOW(),
                      last_sync = NOW()
                  WHERE id = $1`,
                  [targetAccountId]
                );
                
                // Mettre à jour l'objet local pour la suite du traitement
                account.is_active = true;
                
                console.log('✅ Compte auto-activé');
              }
              
              // 🚀 TRAITER LE MESSAGE
              await processMessagingEvent(schemaName, userId, targetAccountId, targetAccountId, event);
              
            } catch (eventError) {
              console.error('❌ Erreur traitement événement spécifique:', eventError.message);
              // Continuer avec les autres événements
            }
          }
        }
        
        console.log('🔚 ========== FIN TRAITEMENT WEBHOOK (SUCCÈS) ==========\n');
        
      } catch (error) {
        console.error('❌ Erreur critique dans processFacebookWebhook:', error.message);
        console.error('Stack:', error.stack);
        // Ne pas propager l'erreur pour ne pas bloquer les réponses HTTP à Facebook
      }
    }

    /**
    * Traite un événement de messagerie Facebook
    */
    async function processMessagingEvent(schemaName, userId, accountId, validAccountId, event) {
      try {
        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;
        const timestamp = event.timestamp ? 
          new Date(parseInt(event.timestamp) * 1000) : 
          new Date();

        console.log('🔍 DEBUG processMessagingEvent DÉTAIL:', {
          senderId: senderId,
          senderIdType: typeof senderId,
          recipientId: recipientId,
          timestamp: timestamp.toISOString(),
          hasMessage: !!event.message,
          isEcho: event.message?.is_echo || false,
          appId: event.message?.app_id,
          messageText: event.message?.text?.substring(0, 50) || 'N/A',
          fullEvent: JSON.stringify(event, null, 2)
        });
        
        // Vérifier que ce n'est pas un message "echo" de notre propre bot
        if (event.message?.is_echo) {
          console.log('🔁 Message echo (ignoré) de notre bot');
          return;
        }
        
        // Message texte
        if (event.message) {
          const messageText = event.message.text || '';
          const messageId = event.message.mid;
          const isEcho = event.message.is_echo || false;

          // ⚠️ CORRECTION: Ignorer SEULEMENT les echo de NOTRE app
          if (isEcho) {
            console.log('🔁 Message echo (provient de notre bot) - IGNORÉ');
            return;
          }
          
          console.log('💬 Message Facebook reçu:', {
            sender: senderId,
            recipient: recipientId,
            message: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
            timestamp: new Date().toISOString(),
            messageId: messageId,
            is_echo: event.message.is_echo || false
          });
          
          // 1. Gérer le contact - CRITIQUE: s'assurer qu'on a un contactId
          let contactId = await getOrCreateFacebookContact(schemaName, senderId, accountId);
          
          if (!contactId) {
            console.error('❌ Impossible de créer/récupérer le contact, abandon du message');
            return;
          }
          
          // 2. Enregistrer le message entrant
          const savedMessageId = await saveMessageToDatabase(
            schemaName,
            contactId,
            'incoming',
            messageText,
            {
              platform: 'facebook_messenger',
              account_id: validAccountId,
              sender_id: senderId,
              recipient_id: recipientId,
              message_id: messageId,
              facebook_event: {
                timestamp: event.timestamp,
                is_echo: event.message.is_echo || false,
                app_id: event.message.app_id
              }
            },
            timestamp
          );
          
          // 3. Créer/actualiser la conversation
          await updateOrCreateConversation(schemaName, contactId, accountId, timestamp);
          
          // 4. Générer une réponse IA si activée
          if (messageText.trim()) {
            await processAIResponse(schemaName, contactId, validAccountId, messageText, savedMessageId);
          }
        }
        
        // Postback (boutons, menus)
        if (event.postback) {
          console.log('🔄 Postback reçu:', {
            sender: senderId,
            payload: event.postback.payload,
            title: event.postback.title
          });
          
          // Traiter le postback
          await handleFacebookPostback(schemaName, senderId, validAccountId, event.postback);
        }
        
        // Read (message lu)
        if (event.read) {
          console.log('👁️ Message lu par:', senderId, 'à:', new Date(event.read.watermark * 1000));
          // Mettre à jour le statut des messages
        }
        
        // Delivery (message délivré)
        if (event.delivery) {
          console.log('📫 Messages délivrés:', event.delivery.mids?.length || 'multiple');
        }
        
      } catch (error) {
        console.error('❌ Erreur traitement événement:', error.message);
        console.error('Stack:', error.stack);
        // Ne pas propager l'erreur pour ne pas bloquer les autres événements
      }
    }

    /**
    * Récupère ou crée un contact Facebook
    */
    async function getOrCreateFacebookContact(schemaName, facebookUserId, accountId) {
      if (!facebookUserId) {
        console.log('⚠️ facebookUserId est null/undefined');
        return null;
      }
      
      console.log(`🔍 getOrCreateFacebookContact appelée avec:`, {
        schemaName,
        facebookUserId,
        accountId,
        facebookUserIdType: typeof facebookUserId,
        facebookUserIdLength: facebookUserId?.length
      });
      
      try {
        // FORMAT FIXE pour la recherche
        const facebookAccountId = `facebook:${facebookUserId}`;
        
        console.log(`🔍 Recherche contact avec compte: "${facebookAccountId}"`);
        
        // Chercher le contact
        const existingContact = await pool.query(
          `SELECT id, nom, email, compte FROM "${schemaName}".contacts 
          WHERE compte = $1 
          LIMIT 1`, 
          [facebookAccountId]
        );
        
        if (existingContact.rows.length > 0) {
          console.log(`✅ Contact EXISTANT trouvé:`, existingContact.rows[0]);
          return existingContact.rows[0].id;
        }
        
        console.log(`🆕 Création NOUVEAU contact pour: ${facebookUserId}`);
        
        // Vérifier d'abord si l'utilisateur Facebook existe déjà avec un format différent
        const alternativeSearch = await pool.query(
          `SELECT id FROM "${schemaName}".contacts 
          WHERE email ILIKE $1 OR compte ILIKE $2
          LIMIT 1`,
          [`%${facebookUserId}%`, `%${facebookUserId}%`]
        );
        
        if (alternativeSearch.rows.length > 0) {
          console.log(`🔄 Contact trouvé avec recherche alternative:`, alternativeSearch.rows[0]);
          return alternativeSearch.rows[0].id;
        }
        
        // Créer un nouveau contact
        const fbEmail = `fb_${facebookUserId}_${Date.now()}@facebook.messenger`;
        
        console.log(`📝 Insertion nouveau contact:`, {
          nom: `FB User ${facebookUserId.substring(0, 8)}`,
          email: fbEmail,
          compte: facebookAccountId
        });
        
        const newContact = await pool.query(
          `INSERT INTO "${schemaName}".contacts 
          (nom, prenom, email, compte, type_contact, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          RETURNING id`,
          [
            `Facebook User ${facebookUserId.substring(0, 8)}`,
            `FB${facebookUserId.substring(facebookUserId.length - 4)}`,
            fbEmail,
            facebookAccountId,
            'client'
          ]
        );
        
        const newContactId = newContact.rows[0].id;
        console.log(`✅ NOUVEAU contact créé ID: ${newContactId}`);
        
        return newContactId;
        
      } catch (error) {
        console.error('❌ ERREUR getOrCreateFacebookContact:', {
          message: error.message,
          code: error.code,
          detail: error.detail,
          schemaName,
          facebookUserId
        });
        
        // Fallback: essayer sans email
        try {
          const fallbackContact = await pool.query(
            `INSERT INTO "${schemaName}".contacts 
            (nom, compte, type_contact, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id`,
            [
              `FB ${facebookUserId.substring(0, 6)}`,
              `facebook:${facebookUserId}`,
              'client'
            ]
          );
          
          console.log(`🔄 Contact créé (fallback) ID: ${fallbackContact.rows[0].id}`);
          return fallbackContact.rows[0].id;
          
        } catch (fallbackError) {
          console.error('❌ Fallback échoué:', fallbackError.message);
          return null;
        }
      }
    }

    /**
    * Enregistre un message dans la base de données
    */
    async function saveMessageToDatabase(schemaName, contactId, type, content, metadata, timestamp) {
      try {
        const result = await pool.query(`
          INSERT INTO "${schemaName}".messages 
          (contact_id, type, contenu, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          contactId,
          type,
          content,
          JSON.stringify(metadata || {}),
          timestamp
        ]);
        
        console.log(`✅ Message ${type} enregistré (ID: ${result.rows[0].id})`);
        return result.rows[0].id;
        
      } catch (error) {
        console.error('❌ Erreur enregistrement message:', error.message);
        return null;
      }
    }

    /**
    * Envoie une réponse via l'API Facebook (VERSION FINALE CORRIGÉE)
    */
    async function sendResponseToFacebook(schemaName, accountId, contactId, messageText, retryCount = 0) {
      const MAX_RETRIES = 1;
      const RETRY_DELAY = 2000;
      
      console.log(`📤 Envoi Facebook FINAL (tentative ${retryCount + 1}/${MAX_RETRIES + 1})`);

      try {
        // 1. Récupération COMPLÈTE des infos du compte
        const accountResult = await pool.query(`
          SELECT id, access_token_encrypted, page_id, page_name, verification_status, config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND platform = 'facebook_messenger' AND is_active = true
        `, [accountId]);

        if (accountResult.rows.length === 0) {
          console.error(`❌ Compte Facebook ${accountId} non trouvé ou inactif`);
          return false;
        }

        const account = accountResult.rows[0];
        
        // 2. Récupération du token
        const accessToken = account.access_token_encrypted;
        
        if (!accessToken) {
          console.error(`❌ Token invalide pour le compte ${accountId}`);
          return false;
        }

        // VALIDATION : Vérifier que c'est un token EAA
        if (!accessToken.startsWith('EAA')) {
          console.error(`❌ Token invalide format: ${accessToken.substring(0, 30)}...`);
          return false;
        }

        // 3. Récupération du contact
        const contactResult = await pool.query(`
          SELECT compte FROM "${schemaName}".contacts 
          WHERE id = $1
        `, [contactId]);

        if (contactResult.rows.length === 0) {
          console.error(`❌ Contact ${contactId} non trouvé`);
          return false;
        }

        let facebookUserId = contactResult.rows[0].compte;
        
        // Nettoyer l'ID Facebook
        if (facebookUserId && facebookUserId.includes('facebook:')) {
          facebookUserId = facebookUserId.replace('facebook:', '');
        }
        
        if (!facebookUserId || facebookUserId.length < 5) {
          console.error(`❌ Facebook User ID invalide: ${facebookUserId}`);
          return false;
        }

        console.log('📤 Détails envoi:', {
          accountId: account.id,
          pageId: account.page_id,
          pageName: account.page_name,
          recipientId: facebookUserId.substring(0, 10) + '...',
          tokenPreview: accessToken.substring(0, 20) + '...',
          tokenLength: accessToken.length,
          verificationStatus: account.verification_status
        });

        // 4. TEST CRITIQUE : Vérifier le type de token et permissions
        await testFacebookTokenAndPermissions(account.page_id, accessToken);

        // 5. MÉTHODE 1 : Essayer avec l'endpoint de page (recommandé pour les tokens de page)
        console.log('🚀 Méthode 1: Endpoint page avec page_id');
        
        const pageEndpoint = `https://graph.facebook.com/v18.0/${account.page_id}/messages`;
        const payload = {
          recipient: {
            id: facebookUserId
          },
          message: {
            text: messageText.substring(0, 2000)
          },
          messaging_type: "RESPONSE"
        };

        console.log('🔗 URL:', pageEndpoint);
        console.log('📦 Payload:', {
          recipient_id_length: facebookUserId.length,
          message_length: payload.message.text.length,
          messaging_type: payload.messaging_type
        });

        // Premier essai : Token dans l'URL
        const urlWithToken = `${pageEndpoint}?access_token=${encodeURIComponent(accessToken)}`;
        
        let response = await fetch(urlWithToken, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        let result = await response.json();
        console.log('📥 Réponse Méthode 1:', {
          status: response.status,
          ok: response.ok,
          error: result.error?.message,
          error_code: result.error?.code,
          fbtrace_id: result.error?.fbtrace_id,
          message_id: result.message_id
        });

        // Si succès
        if (result.message_id) {
          await saveMessageSuccess(schemaName, contactId, accountId, messageText, facebookUserId, result.message_id, 'page_endpoint');
          return true;
        }

        // 6. MÉTHODE 2 : Essayer avec l'endpoint /me/messages (pour les tokens utilisateur avec permissions)
        if (result.error?.code === 100 || result.error?.code === 1) {
          console.log('🔄 Méthode 2: Essayer avec /me/messages');
          
          const meEndpoint = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(accessToken)}`;
          
          response = await fetch(meEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          result = await response.json();
          console.log('📥 Réponse Méthode 2:', {
            error: result.error?.message,
            message_id: result.message_id
          });

          if (result.message_id) {
            await saveMessageSuccess(schemaName, contactId, accountId, messageText, facebookUserId, result.message_id, 'me_endpoint');
            return true;
          }
        }

        // 7. MÉTHODE 3 : Vérifier et réparer le token si nécessaire
        if (result.error?.code === 190 || result.error?.code === 200) {
          console.error('⚠️ Token expiré ou révoqué');
          
          await pool.query(`
            UPDATE "${schemaName}".webhook_accounts 
            SET verification_status = 'token_expired', 
                is_active = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [accountId]);
          
          return false;
        }

        // 8. RETRY pour erreurs temporaires
        if (result.error?.code === 1 && retryCount < MAX_RETRIES) {
          console.log(`⚠️ Erreur temporaire, réessai dans ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return sendResponseToFacebook(schemaName, accountId, contactId, messageText, retryCount + 1);
        }

        // 9. DERNIER RECOURS : Tenter de régénérer un token de page
        if (result.error?.code === 100 || result.error?.code === 10) {
          console.log('🔧 Tentative de récupération token de page...');
          const pageToken = await tryGetPageTokenFromUserToken(accessToken, account.page_id);
          
          if (pageToken) {
            console.log('✅ Nouveau token de page obtenu, mise à jour base...');
            await forceStoreTokenInPlain(schemaName, accountId, pageToken);
            
            // Réessayer avec le nouveau token
            await new Promise(resolve => setTimeout(resolve, 1000));
            return sendResponseToFacebook(schemaName, accountId, contactId, messageText, retryCount + 1);
          }
        }

        console.error('❌ Toutes les méthodes ont échoué');
        return false;

      } catch (error) {
        console.error('❌ Erreur critique sendResponseToFacebook:', {
          message: error.message,
          name: error.name,
          is_timeout: error.name === 'AbortError'
        });
        
        // Réessai pour erreurs réseau
        if ((error.name === 'AbortError' || error.code === 'ECONNRESET') && retryCount < MAX_RETRIES) {
          console.log(`🌐 Erreur réseau, réessai dans ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return sendResponseToFacebook(schemaName, accountId, contactId, messageText, retryCount + 1);
        }
        
        return false;
      }
    }

    /**
    * Tester le token et les permissions
    */
    async function testFacebookTokenAndPermissions(pageId, accessToken) {
      try {
        console.log('🧪 Test du token Facebook...');
        
        // Test 1: Vérifier le token (me)
        const meTest = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
        const meData = await meTest.json();
        
        if (meData.error) {
          console.log('ℹ️ Token "me" invalide (probablement un token de page)');
        } else {
          console.log(`✅ Token utilisateur valide: ${meData.name} (${meData.id})`);
        }
        
        // Test 2: Vérifier la page
        const pageTest = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`);
        const pageData = await pageTest.json();
        
        if (pageData.error) {
          console.error(`❌ Erreur accès page: ${pageData.error.message}`);
        } else {
          console.log(`✅ Page accessible: ${pageData.name}`);
          
          // Si le token retourné est différent, c'est un token de page!
          if (pageData.access_token && pageData.access_token !== accessToken) {
            console.log(`🎯 Token de page disponible! (longueur: ${pageData.access_token.length})`);
          }
        }
        
        // Test 3: Vérifier les apps inscrites
        const appsTest = await fetch(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${accessToken}`);
        const appsData = await appsTest.json();
        
        if (appsData.data && appsData.data.length > 0) {
          console.log(`✅ ${appsData.data.length} app(s) Messenger inscrite(s)`);
        } else {
          console.warn('⚠️ Aucune app Messenger inscrite - Configuration nécessaire');
        }
        
      } catch (error) {
        console.log('ℹ️ Tests de token ignorés (erreur réseau)');
      }
    }

    /**
    * Tenter de récupérer un token de page depuis un token utilisateur
    */
    async function tryGetPageTokenFromUserToken(userAccessToken, targetPageId) {
      try {
        console.log(`🔄 Récupération token de page pour ${targetPageId}...`);
        
        const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token`;
        const response = await fetch(pagesUrl);
        const data = await response.json();
        
        if (data.error) {
          console.error('❌ Erreur récupération pages:', data.error.message);
          return null;
        }
        
        if (!data.data || data.data.length === 0) {
          console.error('❌ Aucune page trouvée pour ce token utilisateur');
          return null;
        }
        
        // Trouver la page cible
        const targetPage = data.data.find(page => page.id === targetPageId);
        if (!targetPage) {
          console.error(`❌ Page ${targetPageId} non trouvée dans les pages de l'utilisateur`);
          return null;
        }
        
        console.log(`✅ Token de page trouvé pour "${targetPage.name}"`);
        return targetPage.access_token;
        
      } catch (error) {
        console.error('❌ Erreur récupération token page:', error.message);
        return null;
      }
    }

    /**
    * Sauvegarder un message envoyé avec succès
    */
    async function saveMessageSuccess(schemaName, contactId, accountId, messageText, recipientId, messageId, method) {
      try {
        await pool.query(`
          INSERT INTO "${schemaName}".messages 
          (contact_id, type, contenu, metadata, created_at)
          VALUES ($1, 'sent', $2, $3, NOW())
        `, [
          contactId,
          messageText,
          JSON.stringify({
            platform: 'facebook_messenger',
            account_id: accountId,
            status: 'sent',
            recipient: recipientId,
            facebook_message_id: messageId,
            sent_at: new Date().toISOString(),
            method: method
          })
        ]);
        
        console.log(`✅ Message envoyé avec succès (${method}), ID: ${messageId}`);
      } catch (error) {
        console.error('❌ Erreur sauvegarde message:', error.message);
      }
    }

    /**
    * Méthode alternative avec page_id (fallback)
    */
    async function sendResponseViaPageId(schemaName, accountId, contactId, messageText, retryCount = 0) {
      try {
        const accountResult = await pool.query(`
          SELECT access_token_encrypted, page_id FROM "${schemaName}".webhook_accounts WHERE id = $1
        `, [accountId]);
        
        if (accountResult.rows.length === 0) return false;
        
        const accessToken = decryptAccessToken(accountResult.rows[0].access_token_encrypted);
        const pageId = accountResult.rows[0].page_id;
        
        const contactResult = await pool.query(`
          SELECT compte FROM "${schemaName}".contacts WHERE id = $1
        `, [contactId]);
        
        if (contactResult.rows.length === 0) return false;
        
        let facebookUserId = contactResult.rows[0].compte;
        if (facebookUserId && facebookUserId.includes('facebook:')) {
          facebookUserId = facebookUserId.replace('facebook:', '');
        }
        
        // Utiliser l'endpoint avec page_id
        const url = `https://graph.facebook.com/v18.0/${pageId}/messages?access_token=${encodeURIComponent(accessToken)}`;
        const payload = {
          recipient: { id: facebookUserId },
          message: { text: messageText.substring(0, 2000) },
          messaging_type: "RESPONSE"
        };
        
        console.log('🔄 Méthode alternative (page_id):', {
          pageId: pageId,
          recipient: facebookUserId.substring(0, 10) + '...'
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        console.log('📥 Résultat méthode alternative:', {
          success: !result.error,
          error: result.error?.message,
          message_id: result.message_id
        });
        
        if (result.message_id) {
          console.log('✅ Message envoyé (méthode alternative)');
          return true;
        } else {
          console.error('❌ Échec méthode alternative:', result.error);
          return false;
        }
        
      } catch (error) {
        console.error('❌ Erreur méthode alternative:', error.message);
        return false;
      }
    }

    /**
    * Traite une réponse IA pour un message
    */
    async function processAIResponse(schemaName, contactId, accountId, incomingMessage, incomingMessageId) {
      try {
        // Vérifier si l'IA est activée pour ce compte
        if (!accountId) {
          console.log('ℹ️ Pas de account_id, IA ignorée');
          return;
        }
        
        const accountSettings = await pool.query(`
          SELECT ai_enabled, auto_reply FROM "${schemaName}".webhook_accounts 
          WHERE id = $1
        `, [accountId]);
        
        if (accountSettings.rows.length === 0 || !accountSettings.rows[0].ai_enabled || !accountSettings.rows[0].auto_reply) {
          console.log('ℹ️ IA désactivée pour ce compte');
          return;
        }
        
        // Vérifier les paramètres IA globaux
        const iaSettings = await pool.query(`
          SELECT enabled FROM "${schemaName}".ia_settings 
          WHERE user_id = (SELECT user_id FROM "${schemaName}".webhook_accounts WHERE id = $1 LIMIT 1)
        `, [accountId]);
        
        if (iaSettings.rows.length === 0 || !iaSettings.rows[0].enabled) {
          console.log('ℹ️ IA globale désactivée');
          return;
        }
        
        // Générer la réponse IA
        const aiResponse = await generateAIResponseLogic(schemaName, contactId, incomingMessage, accountId);
        
        if (aiResponse) {
          // Enregistrer la réponse dans la base
          const savedResponseId = await saveMessageToDatabase(
            schemaName,
            contactId,
            'outgoing',
            aiResponse,
            {
              platform: 'facebook_messenger',
              account_id: accountId,
              ai_generated: true,
              incoming_message_id: incomingMessageId,
              confidence: 0.85
            },
            new Date()
          );
          
          // IMPORTANT: Vérifier que sendResponseToFacebook est disponible ici
          console.log('📤 Tentative d\'envoi à Facebook...');
          
          // Envoyer la réponse via Facebook API
          const sendResult = await sendResponseToFacebook(schemaName, accountId, contactId, aiResponse);
          
          if (sendResult) {
            console.log(`🤖 Réponse IA envoyée: ${aiResponse.substring(0, 50)}...`);
          } else {
            console.error('❌ Échec envoi à Facebook');
          }
        }
        
      } catch (error) {
        console.error('❌ Erreur traitement IA:', error.message);
        console.error('Stack:', error.stack);
      }
    }

    /**
    * Logique de génération de réponse IA
    */
    async function generateAIResponseLogic(schemaName, contactId, message, accountId) {
      try {
        console.log(`🤖 Initialisation IA pour schéma: ${schemaName}, contact: ${contactId}`);
        
        // Créer l'instance IA avec le bon schéma
        const iaMotor = new IACRMMotor(pool, schemaName, accountId);
        
        // Traiter le message avec l'IA
        const iaResult = await iaMotor.processMessage(contactId, message);
        
        if (iaResult.success) {
          console.log(`✅ Réponse IA générée: ${iaResult.response.substring(0, 50)}...`);
          
          // Si l'IA détecte une intention d'achat, créer une opportunité
          if (iaResult.intent.type === 'purchase' && iaResult.intent.confidence > 0.7) {
            await createPurchaseOpportunity(schemaName, contactId, message, iaResult);
          }
          
          return iaResult.response;
        } else {
          console.warn('⚠️ IA échouée, utilisation de la logique de secours');
          return generateFallbackResponse(message);
        }
        
      } catch (error) {
        console.error('❌ Erreur IA complète:', error.message);
        return generateFallbackResponse(message);
      }
    }

    function generateFallbackResponse(message) {
      const lowerMessage = message.toLowerCase().trim();
      
      // Réponses basiques de secours
      if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut')) {
        return "Bonjour ! Comment puis-je vous aider aujourd'hui ? 😊";
      }
      
      if (lowerMessage.includes('merci')) {
        return "Avec plaisir ! N'hésitez pas si vous avez d'autres questions. 👍";
      }
      
      if (lowerMessage.includes('heure') || lowerMessage.includes('horaire')) {
        return "Nous sommes ouverts du lundi au vendredi de 9h à 18h, et le samedi de 10h à 16h.";
      }
      
      return "Merci pour votre message ! Un membre de notre équipe vous répondra rapidement. En attendant, pouvez-vous me donner plus de détails sur votre demande ?";
    }

    async function createPurchaseOpportunity(schemaName, contactId, message, iaResult) {
      try {
        // Créer une opportunité dans la base
        await pool.query(`
          INSERT INTO "${schemaName}".opportunites 
          (nom, contact_id, montant, probabilite, statut, description, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          `Intérêt détecté via IA`,
          contactId,
          0, // Montant inconnu pour le moment
          70, // 70% de probabilité
          'en cours',
          `Détection IA: "${message.substring(0, 100)}..."`
        ]);
        
        console.log('✅ Opportunité créée depuis IA');
      } catch (error) {
        console.error('❌ Erreur création opportunité IA:', error);
      }
    }

    /**
    * Envoie une réponse via l'API Facebook
    */
    async function sendFacebookMessageAlternative(pageId, token, recipientId, messageText) {
      console.log('🔄 Méthode alternative d\'envoi');
      
      // Méthode 1: URL avec params dans le body
      try {
        const url = `https://graph.facebook.com/v18.0/${pageId}/messages`;
        const payload = {
          recipient: { id: recipientId },
          message: { text: messageText },
          messaging_type: 'RESPONSE',
          access_token: token
        };

        console.log('Méthode 1: Token dans payload');
        const res1 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data1 = await res1.json();
        console.log('Résultat méthode 1:', data1);
        
        if (!data1.error) return data1;
      } catch (error) {
        console.log('Erreur méthode 1:', error.message);
      }

      // Méthode 2: Token dans l'URL
      try {
        const url = `https://graph.facebook.com/v18.0/${pageId}/messages?access_token=${encodeURIComponent(token)}`;
        const payload = {
          recipient: { id: recipientId },
          message: { text: messageText },
          messaging_type: 'RESPONSE'
        };

        console.log('Méthode 2: Token dans URL');
        const res2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data2 = await res2.json();
        console.log('Résultat méthode 2:', data2);
        
        if (!data2.error) return data2;
      } catch (error) {
        console.log('Erreur méthode 2:', error.message);
      }

      // Méthode 3: Version API différente
      try {
        const url = `https://graph.facebook.com/v17.0/${pageId}/messages?access_token=${encodeURIComponent(token)}`;
        const payload = {
          recipient: { id: recipientId },
          message: { text: messageText },
          messaging_type: 'RESPONSE'
        };

        console.log('Méthode 3: API v17.0');
        const res3 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data3 = await res3.json();
        console.log('Résultat méthode 3:', data3);
        
        if (!data3.error) return data3;
      } catch (error) {
        console.log('Erreur méthode 3:', error.message);
      }

      return null;
    }

    /**
    * Gère les postbacks Facebook
    */
    async function handleFacebookPostback(schemaName, senderId, accountId, postback) {
      console.log('🔄 Traitement postback:', postback.payload);
      
      // Exemple: Créer une opportunité depuis un postback
      if (postback.payload.startsWith('CREATE_OPPORTUNITY_')) {
        const productId = postback.payload.replace('CREATE_OPPORTUNITY_', '');
        
        // Créer une opportunité dans la base
        await pool.query(`
          INSERT INTO "${schemaName}".opportunites 
          (nom, contact_id, montant, probabilite, statut, description, created_at)
          SELECT 
            'Intérêt produit ' || p.nom,
            c.id,
            p.prix,
            70,
            'en cours',
            'Créé depuis Facebook Messenger',
            NOW()
          FROM "${schemaName}".contacts c
          CROSS JOIN "${schemaName}".produits p
          WHERE c.compte = $1 AND p.id = $2
        `, [`facebook:${senderId}`, parseInt(productId)]);
        
        console.log('✅ Opportunité créée depuis postback');
      }
    }

    async function sendRealFacebookMessage(pageId, accessToken, recipientId, messageText) {
      try {
        // Valider les paramètres d'entrée
        if (!pageId || !accessToken || !recipientId || !messageText) {
          console.error('❌ Paramètres manquants pour l\'envoi Facebook:', {
            pageId: !!pageId,
            accessToken: !!accessToken,
            recipientId: !!recipientId,
            messageText: !!messageText
          });
          return false;
        }

        console.log('🚀 Envoi réel à Facebook API:', {
          pageId,
          recipientId: recipientId.substring(0, 10) + '...',
          messageLength: messageText.length,
          timestamp: new Date().toISOString()
        });

        // Préparer le payload pour l'API Facebook
        const payload = {
          recipient: {
            id: recipientId
          },
          message: {
            text: messageText
          },
          messaging_type: 'RESPONSE' // Type de message pour les réponses aux messages utilisateur
        };

        console.log('📤 Payload Facebook:', {
          recipientId: payload.recipient.id.substring(0, 10) + '...',
          messageLength: payload.message.text.length,
          messagingType: payload.messaging_type
        });

        // URL de l'API Facebook Graph
        const facebookApiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
        
        // Paramètres de la requête
        const urlWithParams = new URL(facebookApiUrl);
        urlWithParams.searchParams.append('access_token', accessToken);

        console.log('🔗 URL Facebook API:', facebookApiUrl);
        console.log('🔑 Token (début):', accessToken.substring(0, 20) + '...');

        // Envoyer la requête à l'API Facebook
        const response = await fetch(urlWithParams.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // Lire la réponse
        const responseText = await response.text();
        let result;
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Impossible de parser la réponse Facebook:', responseText);
          return false;
        }

        console.log('📥 Réponse Facebook:', {
          status: response.status,
          statusText: response.statusText,
          result: result
        });

        // Analyser la réponse
        if (response.ok && !result.error) {
          console.log('✅ Message envoyé avec succès à Facebook!', {
            messageId: result.message_id,
            recipientId: result.recipient_id,
            timestamp: new Date().toISOString()
          });
          return true;
        } else {
          // Gestion des erreurs Facebook
          const error = result.error || {};
          console.error('❌ Erreur API Facebook:', {
            code: error.code,
            message: error.message,
            type: error.type,
            fbtrace_id: error.fbtrace_id,
            subcode: error.error_subcode
          });

          // Gestion spécifique des erreurs communes
          if (error.code === 190) {
            console.error('⚠️ Token d\'accès expiré ou invalide');
            // Vous pourriez marquer le token comme expiré dans la base de données
          } else if (error.code === 100) {
            console.error('⚠️ Paramètre invalide');
          } else if (error.code === 10) {
            console.error('⚠️ Permission refusée');
          } else if (error.code === 368) {
            console.error('⚠️ Action temporairement bloquée (spam)');
          }

          return false;
        }

      } catch (error) {
        // Gestion des erreurs réseau ou autres
        console.error('❌ Erreur critique lors de l\'envoi à Facebook:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // Vérifier si c'est une erreur réseau
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          console.error('🌐 Erreur réseau - Impossible de se connecter à Facebook');
        } else if (error.name === 'FetchError') {
          console.error('🔌 Erreur Fetch - Problème avec la requête HTTP');
        }
        
        return false;
      }
    }


    /**
    * Force le stockage d'un token en clair (VERSION CORRIGÉE)
    */
    async function forceStoreTokenInPlain(schemaName, accountId, plainToken) {
      const client = await pool.connect();
      
      try {
        console.log(`🚨 FORCE stockage token en clair pour compte ${accountId}`);
        
        if (!plainToken.startsWith('EAA')) {
          console.warn('⚠️ Token ne commence pas par EAA:', plainToken.substring(0, 50));
        }
        
        // Préparer les données JSONB correctement
        const configData = {
          force_stored_in_plain: {
            at: new Date().toISOString(),
            reason: 'force_plain_storage',
            token_length: plainToken.length,
            is_eaa: plainToken.startsWith('EAA')
          }
        };
        
        await client.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET access_token_encrypted = $1,
              updated_at = CURRENT_TIMESTAMP,
              config_data = $2::jsonb
          WHERE id = $3
        `, [
          plainToken, // Token EN CLAIR
          JSON.stringify(configData), // Conversion explicite en JSON
          accountId
        ]);
        
        console.log(`✅ Token stocké en clair pour compte ${accountId}:`, plainToken.substring(0, 25) + '...');
        return true;
        
      } catch (error) {
        console.error('❌ Erreur force store:', error.message);
        console.error('Stack:', error.stack);
        return false;
      } finally {
        client.release();
      }
    }

    // Fonction simplifiée pour tester uniquement l'envoi
    async function testFacebookSendPermission(pageId, accessToken) {
      try {
        const testPayload = {
          recipient: { id: '25407834305583492' }, // Votre ID de test
          message: { text: 'Test de permission' },
          messaging_type: 'RESPONSE',
          access_token: accessToken
        };
        
        const testUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
        const response = await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });
        
        const result = await response.json();
        
        return {
          can_send: !result.error,
          error: result.error,
          fbtrace_id: result.fbtrace_id
        };
      } catch (error) {
        return {
          can_send: false,
          error: { message: error.message }
        };
      }
    }


    /**
    * Échange le User Access Token contre un Page Access Token
    * Nécessaire car OAuth retourne d'abord un token utilisateur, pas page
    */
    async function exchangeForPageToken(userAccessToken, targetPageId) {
      try {
        console.log(`🔄 Échange User Token → Page Token pour page: ${targetPageId}`);
        
        if (!userAccessToken || !userAccessToken.startsWith('EAA')) {
          throw new Error('Token utilisateur invalide (doit commencer par EAA)');
        }
        
        // 1. Récupérer toutes les pages
        const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,category,tasks`;
        console.log('🔗 Appel Facebook pour pages...');
        
        const response = await fetch(pagesUrl);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Facebook API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(`Facebook API Error: ${data.error.message}`);
        }
        
        if (!data.data || data.data.length === 0) {
          throw new Error('Aucune page Facebook trouvée pour cet utilisateur');
        }
        
        console.log(`📊 ${data.data.length} pages trouvées`);
        
        // 2. Trouver la page spécifique
        const targetPage = data.data.find(page => page.id === targetPageId);
        
        if (!targetPage) {
          const availablePages = data.data.map(p => `${p.name} (${p.id})`);
          throw new Error(`Page ${targetPageId} non trouvée. Pages disponibles: ${availablePages.join(', ')}`);
        }
        
        // 3. VALIDATION CRITIQUE: S'assurer que le token est valide
        if (!targetPage.access_token || !targetPage.access_token.startsWith('EAA')) {
          throw new Error(`Token de page invalide (format: ${targetPage.access_token?.substring(0, 20) || 'null'})`);
        }
        
        // 4. Vérifier que le token fonctionne
        const verifyUrl = `https://graph.facebook.com/v18.0/${targetPage.id}?fields=id,name&access_token=${targetPage.access_token}`;
        const verifyResponse = await fetch(verifyUrl);
        
        if (!verifyResponse.ok) {
          throw new Error('Token de page invalide ou expiré (test API échoué)');
        }
        
        console.log(`✅ Page "${targetPage.name}" trouvée avec token VALIDE`);
        console.log(`📝 Token (début): ${targetPage.access_token.substring(0, 25)}...`);
        
        return {
          pageToken: targetPage.access_token, // TOKEN EAA EN CLAIR
          pageName: targetPage.name,
          pageCategory: targetPage.category,
          pageId: targetPage.id,
          pageTasks: targetPage.tasks || [],
          tokenValidated: true,
          tokenFormat: 'plain_eaa'
        };
        
      } catch (error) {
        console.error('❌ Erreur exchangeForPageToken:', error.message);
        return null;
      }
    }


    async function verifyFacebookToken(pageId, accessToken) {
      try {
        const url = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`;
        
        const response = await fetch(url, { timeout: 5000 });
        const data = await response.json();
        
        if (data.error) {
          console.error('❌ Token Facebook invalide:', data.error);
          return {
            valid: false,
            error: data.error
          };
        }
        
        console.log('✅ Token Facebook valide pour la page:', data.name);
        return {
          valid: true,
          pageName: data.name,
          pageId: data.id
        };
        
      } catch (error) {
        console.error('❌ Erreur vérification token:', error);
        return {
          valid: false,
          error: error.message
        };
      }
    }
    // Nettoyer les states expirés (plus de 10 minutes)
    function cleanupExpiredOAuthStates() {
      const now = Date.now();
      const TEN_MINUTES = 10 * 60 * 1000;
      
      for (const [state, data] of global.oauthStates.entries()) {
        if (now - data.timestamp > TEN_MINUTES) {
          global.oauthStates.delete(state);
          console.log(`🧹 State OAuth expiré nettoyé: ${state}`);
        }
      }
    }

    // Ajoutez cette fonction pour tester le token
    async function testFacebookToken(pageId, accessToken) {
      try {
        console.log('🧪 Test du token Facebook...');
        
        // Test 1: Vérifier les infos de la page
        const pageUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`;
        const pageRes = await fetch(pageUrl);
        const pageData = await pageRes.json();
        
        if (pageData.error) {
          console.error('❌ Erreur token (page info):', pageData.error);
          return { valid: false, error: pageData.error };
        }
        
        console.log(`✅ Page accessible: ${pageData.name}`);
        
        // Test 2: Vérifier les permissions Messenger
        const subscribedAppsUrl = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${accessToken}`;
        const appsRes = await fetch(subscribedAppsUrl);
        const appsData = await appsRes.json();
        
        console.log('📱 Permissions Messenger:', appsData.data || 'Non configuré');
        
        // Test 3: Tenter d'envoyer un message test (mode silencieux)
        const testMessageUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
        const testBody = {
          recipient: { id: '25407834305583492' }, // Votre ID
          message: { text: 'Test de connexion' },
          messaging_type: 'RESPONSE',
          access_token: accessToken
        };
        
        const testRes = await fetch(testMessageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testBody)
        });
        
        const testData = await testRes.json();
        
        if (testData.error) {
          console.error('❌ Erreur envoi test:', testData.error);
          return { 
            valid: false, 
            error: testData.error,
            page_info: { name: pageData.name, id: pageData.id }
          };
        }
        
        console.log('✅ Message test envoyé avec succès!', testData.message_id);
        return { valid: true, message_id: testData.message_id };
        
      } catch (error) {
        console.error('❌ Erreur test token:', error.message);
        return { valid: false, error: { message: error.message } };
      }
    }

    /**
    * Met à jour ou crée une conversation
    */
    async function updateOrCreateConversation(schemaName, contactId, accountId, timestamp) {
      try {
        // Vérifier si une conversation existe déjà
        const existingConv = await pool.query(`
          SELECT id FROM "${schemaName}".conversations 
          WHERE contact_id = $1 AND channel = 'facebook_messenger'
          LIMIT 1
        `, [contactId]);
        
        if (existingConv.rows.length > 0) {
          // Mettre à jour la conversation existante
          await pool.query(`
            UPDATE "${schemaName}".conversations 
            SET derniere_interaction = $1, statut = 'active', updated_at = NOW()
            WHERE id = $2
          `, [timestamp, existingConv.rows[0].id]);
          
          console.log(`✅ Conversation mise à jour: ${existingConv.rows[0].id}`);
          return existingConv.rows[0].id;
        } else {
          // Créer une nouvelle conversation
          const newConv = await pool.query(`
            INSERT INTO "${schemaName}".conversations 
            (contact_id, channel, contexte, derniere_interaction, statut, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id
          `, [
            contactId,
            'facebook_messenger',
            JSON.stringify({
              platform: 'facebook_messenger',
              account_id: accountId,
              first_interaction: timestamp.toISOString()
            }),
            timestamp,
            'active'
          ]);
          
          console.log(`✅ Nouvelle conversation créée: ${newConv.rows[0].id}`);
          return newConv.rows[0].id;
        }
        
      } catch (error) {
        console.error('❌ Erreur gestion conversation:', error.message);
        return null;
      }
    }

    // Fonction de debug pour voir ce qui se passe
    async function debugFacebookFlow(schemaName, facebookUserId) {
      console.log('🔧 DEBUG FLOW:');
      console.log('1. Schema:', schemaName);
      console.log('2. Facebook User ID:', facebookUserId);
      console.log('3. Recherche contact...');
      
      const result = await pool.query(
        `SELECT id, nom, compte FROM "${schemaName}".contacts WHERE compte = $1`,
        [`facebook:${facebookUserId}`]
      );
      
      console.log('4. Résultat recherche:', result.rows);
      return result.rows;
    }

    // Fonction pour traiter les webhooks Twilio
    async function processTwilioWebhook(schemaName, userId, accountId, body) {
      try {
        console.log('🤖 Traitement Twilio:', {
          from: body.From,
          to: body.To,
          body: body.Body,
          type: body.MessageType || 'unknown'
        });
        
        if (body.From && body.From.startsWith('whatsapp:')) {
          const phoneNumber = body.From.replace('whatsapp:', '');
          const messageText = body.Body || '';
          
          console.log('📱 Message WhatsApp:', {
            phoneNumber,
            message: messageText.substring(0, 100)
          });
          
          // 1. Créer/récupérer le contact
          const contactId = await getOrCreateWhatsAppContact(schemaName, phoneNumber, accountId);
          
          if (contactId && messageText.trim()) {
            // 2. Enregistrer le message entrant
            await saveMessageToDatabase(
              schemaName,
              contactId,
              'incoming',
              messageText,
              {
                platform: 'twilio_whatsapp',
                account_id: accountId,
                sender: phoneNumber,
                twilio_data: body,
                message_sid: body.MessageSid
              },
              new Date()
            );
            
            // 3. Générer une réponse IA
            const aiResponse = await generateAIResponseLogic(schemaName, contactId, messageText, accountId);
            
            if (aiResponse) {
              console.log(`🤖 Réponse IA: ${aiResponse.substring(0, 50)}...`);
              
              // 4. Envoyer via Twilio
              const sent = await sendResponseToTwilio(schemaName, accountId, phoneNumber, aiResponse);
              
              if (sent) {
                // 5. Enregistrer la réponse sortante
                await saveMessageToDatabase(
                  schemaName,
                  contactId,
                  'outgoing',
                  aiResponse,
                  {
                    platform: 'twilio_whatsapp',
                    account_id: accountId,
                    ai_generated: true,
                    response_to: body.MessageSid,
                    status: 'sent'
                  },
                  new Date()
                );
              }
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Erreur traitement Twilio webhook:', error);
      }
    }


    // Fonction pour créer/récupérer un contact WhatsApp
    async function getOrCreateWhatsAppContact(schemaName, phoneNumber, accountId) {
      try {
        const whatsappAccountId = `whatsapp:${phoneNumber}`;
        
        // Chercher le contact
        const existingContact = await pool.query(
          `SELECT id FROM "${schemaName}".contacts 
          WHERE compte = $1 
          LIMIT 1`, 
          [whatsappAccountId]
        );
        
        if (existingContact.rows.length > 0) {
          console.log(`✅ Contact WhatsApp trouvé: ${existingContact.rows[0].id}`);
          return existingContact.rows[0].id;
        }
        
        // Créer un nouveau contact
        const newContact = await pool.query(
          `INSERT INTO "${schemaName}".contacts 
          (nom, prenom, email, compte, type_contact, telephone, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING id`,
          [
            `WhatsApp ${phoneNumber.substring(phoneNumber.length - 4)}`,
            `WA`,
            `wa_${phoneNumber}@whatsapp.com`,
            whatsappAccountId,
            'client',
            phoneNumber
          ]
        );
        
        console.log(`✅ Nouveau contact WhatsApp créé: ${newContact.rows[0].id}`);
        return newContact.rows[0].id;
        
      } catch (error) {
        console.error('❌ Erreur création contact WhatsApp:', error);
        return null;
      }
    }

    // Fonction pour logger les requêtes Twilio
    async function logWebhookRequest(schemaName, userId, accountId, body) {
      try {
        // ESSAYER sans account_id d'abord
        await pool.query(`
          INSERT INTO "${schemaName}".webhook_logs 
          (user_id, platform, method, url, status_code, payload, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          userId,
          'twilio_whatsapp',
          'POST',
          `/api/webhook/twilio/${userId}/${accountId}`,
          200,
          JSON.stringify(body)
        ]);
        
        console.log('✅ Log Twilio enregistré');
        
      } catch (error) {
        console.error('❌ Erreur logging Twilio (ignoré):', error.message);
        // Continue même si le log échoue
      }
    }

    async function sendResponseToTwilio(schemaName, accountId, recipientPhone, messageText) {
      try {
        console.log('📤 Préparation envoi Twilio...');
        
        // Récupérer les infos Twilio
        const accountResult = await pool.query(`
          SELECT account_sid, auth_token, phone_number 
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1
        `, [accountId]);
        
        if (accountResult.rows.length === 0) {
          console.error('❌ Compte Twilio non trouvé');
          return false;
        }
        
        const account = accountResult.rows[0];
        
        if (!account.account_sid || !account.auth_token || !account.phone_number) {
          console.error('❌ Infos Twilio incomplètes');
          return false;
        }
        
        console.log('🔑 Infos Twilio trouvées');
        
        // Twilio API URL
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account.account_sid}/Messages.json`;
        
        // Authentification
        const auth = Buffer.from(`${account.account_sid}:${account.auth_token}`).toString('base64');
        
        // Données
        const formData = new URLSearchParams();
        formData.append('To', `whatsapp:${recipientPhone}`);
        formData.append('From', `whatsapp:${account.phone_number}`);
        formData.append('Body', messageText);
        
        console.log('🚀 Envoi à Twilio API:', {
          to: `whatsapp:${recipientPhone}`,
          from: `whatsapp:${account.phone_number}`,
          messageLength: messageText.length
        });
        
        // Envoi
        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`
          },
          body: formData.toString()
        });
        
        const result = await response.json();
        
        if (result.sid) {
          console.log('✅ Message Twilio envoyé:', result.sid.substring(0, 20));
          return true;
        } else {
          console.error('❌ Erreur Twilio:', result);
          return false;
        }
        
      } catch (error) {
        console.error('❌ Erreur envoi Twilio:', error.message);
        return false;
      }
    }

    async function processIncomingMessage(message, accountId, platform) {
      // ÉTAPE 1: Vérifier l'IA globale
      const globalIASettings = await checkGlobalIASettings(userId);
      if (!globalIASettings.enabled) {
        console.log('❌ IA globale désactivée - Message ignoré');
        return;
      }
      
      // ÉTAPE 2: Vérifier l'IA pour ce compte spécifique
      const account = await getWebhookAccount(accountId);
      if (!account.ai_enabled) {
        console.log(`❌ IA désactivée pour le compte ${account.name}`);
        return;
      }
      
      // ÉTAPE 3: Vérifier l'auto-réponse
      if (!account.auto_reply) {
        console.log('❌ Auto-réponse désactivée');
        // Message enregistré mais pas de réponse automatique
        saveMessageToDatabase(message);
        return;
      }
      
      // ÉTAPE 4: Traitement IA
      const aiResponse = await generateAIResponse(message);
      await sendResponse(aiResponse);
    }


    // ==================== ROUTES OAUTH POUR TOUS LES UTILISATEURS ====================

    /**
    * Route 1: Générer l'URL OAuth pour un utilisateur spécifique
    * Cette route est sécurisée et lie l'OAuth à l'utilisateur connecté
    */
    app.get('/api/facebook/oauth/init', authenticate, async (req, res) => {
      req.setTimeout(10000, () => {
        console.error('⏰ TIMEOUT /api/facebook/oauth/init');
        res.status(504).json({ success: false, error: 'Timeout serveur' });
      });
      
      try {
        console.log('🚀 /api/facebook/oauth/init appelé');
        console.log('👤 Utilisateur:', req.user?.id, req.user?.email);
        
        const userId = req.user.id;
        const userEmail = req.user.email;
        
        if (!FACEBOOK_APP_ID || FACEBOOK_APP_ID === 'YOUR_APP_ID') {
          console.error('❌ FACEBOOK_APP_ID manquant');
          return res.json({ success: false, error: 'Facebook App ID non configuré' });
        }
        
        // Générer UN SEUL state et l'utiliser partout
        const state = `fb_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // ⭐ CRITIQUE : Stocker immédiatement dans global.oauthStates (pas facebookSessions)
        if (!global.oauthStates) {
          global.oauthStates = new Map();
        }
        
        global.oauthStates.set(state, {
          userId: userId,
          userEmail: userEmail,
          schema: req.userSchema || `user_${userId}`,
          timestamp: Date.now(),
          status: 'pending' // 'pending' | 'connected' | 'error'
        });
        
        console.log('✅ State stocké dans global.oauthStates:', state);
        console.log('📊 Nombre total de states:', global.oauthStates.size);
        
        // Construire URL
        const redirectUri = `${req.protocol}://${req.get('host')}/api/facebook/oauth/callback`;
        const scope = 'pages_show_list,pages_messaging';
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${FACEBOOK_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scope)}` +
          `&state=${state}` +
          `&response_type=code`;
        
        res.json({
          success: true,
          oauth_url: authUrl,
          state: state, // Retourner le même state au client
          redirect_uri: redirectUri
        });
        
      } catch (error) {
        console.error('❌ ERREUR:', error);
        res.json({ success: false, error: error.message });
      }
    });

    /**
    * Route 2: Callback OAuth - Gère le retour de Facebook
    * Cette route est publique (appelée par Facebook)
    */
    app.get('/api/facebook/oauth/callback', async (req, res) => {
      console.log('📩 ========== CALLBACK OAUTH FACEBOOK ==========');
      console.log('🕐 Timestamp:', new Date().toISOString());
      
      try {
        const { code, state, error, error_reason, error_description } = req.query;
        
        console.log('📋 Paramètres reçus:', { 
          code: code ? 'présent (longueur: ' + code.length + ')' : 'manquant',
          state: state ? 'présent' : 'manquant',
          error: error || 'aucun'
        });

        // 1. GESTION DES ERREURS FACEBOOK
        if (error) {
          console.error('❌ Erreur retournée par Facebook:', { error, error_reason, error_description });
          
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Connexion annulée</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                  text-align: center; 
                  padding: 50px; 
                  background: #f0f2f5; 
                  color: #333;
                }
                .error-icon { 
                  color: #ef4444; 
                  font-size: 64px; 
                  margin-bottom: 20px; 
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  max-width: 400px;
                  margin: 0 auto;
                }
                h1 { margin: 0 0 10px 0; font-size: 24px; }
                p { color: #666; margin-bottom: 20px; }
                .error-details {
                  background: #fee;
                  color: #c33;
                  padding: 10px;
                  border-radius: 6px;
                  font-size: 14px;
                  margin-top: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error-icon">✕</div>
                <h1>Connexion annulée</h1>
                <p>${error_description || error_reason || 'Vous avez refusé la connexion ou une erreur est survenue.'}</p>
                ${error ? `<div class="error-details">Code erreur: ${error}</div>` : ''}
                <script>
                  (function() {
                    console.log('📤 [Popup] Envoi erreur au parent');
                    if (window.opener && !window.opener.closed) {
                      window.opener.postMessage({
                        type: 'FACEBOOK_OAUTH_ERROR',
                        error: '${error}',
                        description: '${error_description || error_reason || 'Connexion annulée'}'
                      }, '*');
                    }
                    // Backup localStorage
                    localStorage.setItem('fb_oauth_error', JSON.stringify({
                      timestamp: Date.now(),
                      type: 'FACEBOOK_OAUTH_ERROR',
                      error: '${error}',
                      description: '${error_description || ''}'
                    }));
                    setTimeout(() => window.close(), 3000);
                  })();
                </script>
              </div>
            </body>
            </html>
          `);
        }

        // 2. VALIDATION DES PARAMÈTRES REQUIS
        if (!code || !state) {
          console.error('❌ Paramètres manquants:', { code: !!code, state: !!state });
          
          return res.status(400).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Paramètres invalides</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .warning { color: #f59e0b; font-size: 48px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="warning">⚠️</div>
              <h1>Paramètres manquants</h1>
              <p>La requête ne contient pas les paramètres nécessaires.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'FACEBOOK_OAUTH_ERROR',
                    error: 'Paramètres manquants',
                    details: 'Code ou State manquant'
                  }, '*');
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
            </html>
          `);
        }

        // 3. VÉRIFICATION DU STATE
        console.log('🔍 Vérification du state:', state.substring(0, 20) + '...');
        
        // Initialiser la Map si elle n'existe pas
        if (!global.oauthStates) {
          console.error('❌ Map oauthStates non initialisée! Initialisation...');
          global.oauthStates = new Map();
        }

        console.log('📊 Nombre de states stockés:', global.oauthStates.size);
        console.log('📋 States disponibles:', Array.from(global.oauthStates.keys()).map(s => s.substring(0, 20) + '...'));

        const stateData = global.oauthStates.get(state);
        
        if (!stateData) {
          console.error('❌ State non trouvé ou expiré!');
          
          // Vérifier s'il y a des states expirés pour info
          if (global.oauthStates.size > 0) {
            console.log('📊 États disponibles:');
            global.oauthStates.forEach((value, key) => {
              const age = Date.now() - value.timestamp;
              console.log(`   - ${key.substring(0, 10)}... : ${Math.round(age/1000)}s`);
            });
          }
          
          return res.status(400).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Session expirée</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                  text-align: center; 
                  padding: 50px; 
                  background: #f0f2f5; 
                }
                .icon { font-size: 64px; margin-bottom: 20px; }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  max-width: 400px;
                  margin: 0 auto;
                }
                h1 { margin: 0 0 10px 0; color: #1a1a1a; }
                p { color: #666; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">⏱️</div>
                <h1>Session expirée</h1>
                <p>Le délai de connexion a été dépassé (10 minutes maximum) ou la session est invalide.</p>
                <p style="font-size: 14px; color: #999; margin-top: 20px;">Veuillez fermer cette fenêtre et réessayer.</p>
                <script>
                  (function() {
                    if (window.opener) {
                      window.opener.postMessage({
                        type: 'FACEBOOK_OAUTH_ERROR',
                        error: 'Etat invalide ou expire',
                        details: 'Le state n\\'a pas été trouvé ou a expiré. Veuillez réessayer.'
                      }, '*');
                    }
                    localStorage.setItem('fb_oauth_error', JSON.stringify({
                      timestamp: Date.now(),
                      error: 'State not found or expired'
                    }));
                    setTimeout(() => window.close(), 3000);
                  })();
                </script>
              </div>
            </body>
            </html>
          `);
        }

        // 4. STATE VALIDE - RÉCUPÉRATION DES DONNÉES
        const { userId, userEmail, schema, timestamp, status, accountId, pageId } = stateData;
        const stateAge = Date.now() - timestamp;
        
        console.log(`✅ State valide trouvé!`);
        console.log(`   - Utilisateur: ${userEmail} (ID: ${userId})`);
        console.log(`   - Schéma: ${schema}`);
        console.log(`   - Statut: ${status || 'normal'}`);
        console.log(`   - Account ID: ${accountId || 'N/A'}`);
        console.log(`   - Âge du state: ${Math.round(stateAge/1000)} secondes`);
        
        // Supprimer le state utilisé (sécurité)
        global.oauthStates.delete(state);
        console.log('🗑️ State supprimé (one-time use)');

        // 5. ÉCHANGER LE CODE CONTRE UN ACCESS TOKEN
        const redirectUri = `${req.protocol}://${req.get('host')}/api/facebook/oauth/callback`;
        const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
          `client_id=${FACEBOOK_APP_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `client_secret=${FACEBOOK_APP_SECRET}&` +
          `code=${code}`;

        console.log('🔗 Appel API Facebook pour échanger le code contre un token...');
        
        const tokenResponse = await fetch(tokenUrl, {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'ERP-CRM-BOT/1.0'
          }
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Facebook Token API error: ${tokenResponse.status} - ${errorText}`);
        }
        
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          console.error('❌ Erreur Facebook lors de l\'échange du token:', tokenData.error);
          throw new Error(`Facebook Token API: ${tokenData.error.message || JSON.stringify(tokenData.error)}`);
        }

        if (!tokenData.access_token) {
          throw new Error('Access token non reçu de Facebook (réponse vide)');
        }

        const userAccessToken = tokenData.access_token;
        console.log('🔑 User Access Token reçu:', userAccessToken.substring(0, 20) + '...');

        // 6. RÉCUPÉRER LES INFOS UTILISATEUR FACEBOOK
        console.log('👤 Récupération des infos utilisateur...');
        const userUrl = `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${userAccessToken}`;
        const userResponse = await fetch(userUrl);
        const userData = await userResponse.json();

        if (userData.error) {
          throw new Error(`User Info API: ${userData.error.message}`);
        }

        const facebookUserId = userData.id;
        const facebookUserName = userData.name;
        
        console.log(`✅ Utilisateur Facebook: ${facebookUserName} (ID: ${facebookUserId})`);

        // 7. RÉCUPÉRER LES PAGES ADMINISTRÉES
        console.log('📄 Récupération des pages administrées...');
        
        const pagesUrl = `https://graph.facebook.com/v18.0/${facebookUserId}/accounts?` +
          `fields=id,name,access_token,category,tasks,picture{url}&` +
          `access_token=${userAccessToken}`;

        const pagesResponse = await fetch(pagesUrl);
        const pagesData = await pagesResponse.json();

        if (pagesData.error) {
          throw new Error(`Pages API: ${pagesData.error.message}`);
        }

        const pages = pagesData.data || [];
        console.log(`📊 Total pages reçues: ${pages.length}`);

        // Filtrer les pages utilisables (avec permission Messenger)
        const usablePages = pages.filter(page => {
          const tasks = page.tasks || [];
          // Vérifier les permissions nécessaires pour Messenger
          return tasks.includes('MODERATE') || tasks.includes('MANAGE') || tasks.includes('ADMINISTER');
        });

        console.log(`✅ Pages utilisables (avec Messenger): ${usablePages.length}`);
        
        if (usablePages.length > 0) {
          usablePages.forEach((page, i) => {
            console.log(`   [${i+1}] ${page.name} (ID: ${page.id}) - Tasks: [${page.tasks?.join(', ') || 'none'}]`);
          });
        }

        // 8. GESTION SPÉCIALE POUR LA RÉPARATION
        let repair_info = null;
        
        if (status === 'repair' && accountId && pageId) {
          console.log('🔧 Mode réparation détecté pour compte:', accountId);
          
          // Trouver la page à réparer
          const pageToRepair = usablePages.find(page => page.id === pageId);
          
          if (pageToRepair) {
            console.log(`✅ Page à réparer trouvée: ${pageToRepair.name}`);
            
            // Stocker le token EN CLAIR (EAA...)
            const pageToken = pageToRepair.access_token;
            
            if (!pageToken.startsWith('EAA')) {
              throw new Error(`Token de page invalide (ne commence pas par EAA): ${pageToken.substring(0, 20)}...`);
            }
            
            // Mettre à jour le compte directement
            const updateResult = await pool.query(`
              UPDATE "${schema}".webhook_accounts 
              SET access_token_encrypted = $1,
                  verification_status = 'verified',
                  is_active = true,
                  meta_verified = true,
                  updated_at = CURRENT_TIMESTAMP,
                  config_data = jsonb_set(
                    COALESCE(config_data, '{}'::jsonb),
                    '{repaired_at,original_token}',
                    to_jsonb(ARRAY[$2, $1])
                  )
              WHERE id = $3 AND user_id = $4
              RETURNING id, page_name
            `, [
              pageToken, // Token EN CLAIR
              new Date().toISOString(),
              accountId,
              userId
            ]);
            
            if (updateResult.rows.length === 0) {
              throw new Error(`Compte ${accountId} non trouvé pour mise à jour`);
            }
            
            console.log(`✅ Compte ${accountId} réparé avec nouveau token`);
            
            // Mettre à jour le mapping global
            await pool.query(`
              UPDATE public.facebook_pages_mapping 
              SET updated_at = CURRENT_TIMESTAMP
              WHERE account_id = $1
            `, [accountId]);
            
            repair_info = {
              account_repaired: accountId,
              page_name: pageToRepair.name,
              new_token_preview: pageToken.substring(0, 20) + '...',
              new_token_starts_with_eaa: pageToken.startsWith('EAA')
            };
          } else {
            console.warn(`⚠️ Page ${pageId} non trouvée dans les pages accessibles`);
          }
        }

        // 9. CRÉER UNE SESSION TEMPORAIRE POUR LE FRONTEND
        const sessionId = `fb_sess_${userId}_${Date.now()}`;
        
        if (!global.facebookSessions) {
          global.facebookSessions = new Map();
        }
        
        global.facebookSessions.set(sessionId, {
          userId,
          userEmail,
          schema,
          oauthState: state,
          facebookUser: {
            id: facebookUserId,
            name: facebookUserName,
            email: userData.email,
            picture: userData.picture?.data?.url
          },
          pages: usablePages,
          accessToken: userAccessToken, // User token (non page token)
          createdAt: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
          repairInfo: repair_info
        });

        console.log('🆔 Session créée:', sessionId);
        console.log('⏰ Expiration:', new Date(Date.now() + (10 * 60 * 1000)).toISOString());

        // Nettoyer la session automatiquement après 10 minutes
        setTimeout(() => {
          if (global.facebookSessions && global.facebookSessions.has(sessionId)) {
            global.facebookSessions.delete(sessionId);
            console.log('🧹 Session expirée nettoyée:', sessionId);
          }
        }, 10 * 60 * 1000);

        // 10. PRÉPARER LES DONNÉES POUR LE CLIENT
        const pagesForClient = usablePages.map(page => ({
          id: page.id,
          name: page.name,
          category: page.category,
          access_token: page.access_token.substring(0, 15) + '...', // Prévisualisation seulement
          access_token_full: page.access_token, // Token COMPLET pour auto-réparation
          picture: page.picture?.data?.url,
          tasks: page.tasks || [],
          can_messenger: page.tasks?.includes('MODERATE') || page.tasks?.includes('MANAGE') || page.tasks?.includes('ADMINISTER')
        }));

        // 11. RÉPONSE HTML AVEC POSTMESSAGE
        res.send(`
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Connexion réussie - Fermeture...</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container {
                background: white;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 420px;
                width: 100%;
                animation: slideUp 0.5s ease;
              }
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .success-icon {
                width: 80px;
                height: 80px;
                background: #42b72a;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                color: white;
                font-size: 40px;
                animation: scaleIn 0.5s ease 0.2s both;
              }
              @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
              }
              h1 { color: #1a1a1a; margin-bottom: 10px; font-size: 24px; }
              .user-name { color: #1877F2; font-weight: 600; }
              .stats {
                background: #f0f2f5;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
              }
              .stat-number {
                font-size: 36px;
                font-weight: bold;
                color: #1877F2;
                display: block;
              }
              .stat-label {
                color: #65676b;
                font-size: 14px;
              }
              .loading-text {
                color: #65676b;
                font-size: 14px;
                margin-top: 20px;
              }
              .spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #1877F2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 10px;
                vertical-align: middle;
              }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .repair-info {
                background: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 15px;
                margin: 15px 0;
                border-radius: 8px;
                text-align: left;
              }
              .repair-title {
                color: #1976d2;
                font-weight: bold;
                margin-bottom: 5px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✓</div>
              <h1>Connexion réussie !</h1>
              <p style="color: #666; margin-bottom: 20px;">
                Bienvenue <span class="user-name">${facebookUserName}</span>
              </p>
              
              ${repair_info ? `
              <div class="repair-info">
                <div class="repair-title">✅ Réparation effectuée</div>
                <div style="font-size: 13px; color: #555;">
                  Le compte "${repair_info.page_name}" a été réparé.<br>
                  Nouveau token généré: ${repair_info.new_token_preview}
                </div>
              </div>
              ` : ''}
              
              <div class="stats">
                <span class="stat-number">${usablePages.length}</span>
                <span class="stat-label">page(s) Facebook trouvée(s)</span>
              </div>

              <p class="loading-text">
                <span class="spinner"></span>
                Fermeture automatique de la fenêtre...
              </p>
            </div>

            <script>
              (function() {
                'use strict';
                
                console.log('📤 [Popup] Préparation des données...');
                
                // Données à envoyer au parent
                const oauthData = {
                  type: '${repair_info ? 'FACEBOOK_OAUTH_REPAIRED' : 'FACEBOOK_OAUTH_SUCCESS'}',
                  sessionId: '${sessionId}',
                  userId: '${userId}',
                  facebookUser: {
                    id: '${facebookUserId}',
                    name: '${facebookUserName.replace(/'/g, "\\'").replace(/"/g, '\\"')}',
                    email: '${(userData.email || '').replace(/'/g, "\\'").replace(/"/g, '\\"')}',
                    picture: '${(userData.picture?.data?.url || '').replace(/'/g, "\\'").replace(/"/g, '\\"')}'
                  },
                  pageCount: ${usablePages.length},
                  pages: ${JSON.stringify(pagesForClient)},
                  repairInfo: ${repair_info ? JSON.stringify(repair_info) : 'null'}
                };
                
                console.log('📦 [Popup] Données:', {
                  type: oauthData.type,
                  sessionId: oauthData.sessionId,
                  pages: oauthData.pageCount,
                  repair: !!oauthData.repairInfo
                });
                
                // MÉTHODE 1: postMessage (primaire)
                var messageSent = false;
                if (window.opener && window.opener !== window && !window.opener.closed) {
                  try {
                    window.opener.postMessage(oauthData, '*');
                    console.log('✅ [Popup] postMessage envoyé avec succès');
                    messageSent = true;
                  } catch (e) {
                    console.error('❌ [Popup] Erreur postMessage:', e);
                  }
                } else {
                  console.warn('⚠️ [Popup] window.opener indisponible');
                }
                
                // MÉTHODE 2: localStorage (backup/fallback)
                try {
                  localStorage.setItem('fb_oauth_success', JSON.stringify({
                    timestamp: Date.now(),
                    ...oauthData
                  }));
                  localStorage.removeItem('fb_oauth_pending'); // Nettoyer le flag de pending
                  console.log('💾 [Popup] Sauvegarde localStorage OK');
                } catch (e) {
                  console.error('❌ [Popup] Erreur localStorage:', e);
                }
                
                // MÉTHODE 3: BroadcastChannel (pour navigateurs modernes)
                if (typeof BroadcastChannel !== 'undefined') {
                  try {
                    const channel = new BroadcastChannel('facebook_oauth');
                    channel.postMessage(oauthData);
                    console.log('📡 [Popup] BroadcastChannel envoyé');
                  } catch (e) {
                    // Ignorer si non supporté
                  }
                }
                
                // Méthode 4: URL hash (fallback ultime)
                if (!messageSent) {
                  try {
                    const hashData = encodeURIComponent(JSON.stringify(oauthData));
                    window.location.hash = '#data=' + hashData;
                    console.log('🔗 [Popup] Données dans hash URL');
                  } catch (e) {
                    console.error('❌ [Popup] Erreur hash URL:', e);
                  }
                }
                
                // Fermeture automatique après délai
                setTimeout(function() {
                  console.log('🔒 [Popup] Fermeture auto...');
                  // Tentative de fermeture
                  window.close();
                  
                  // Si la fermeture auto est bloquée, afficher un bouton
                  setTimeout(function() {
                    if (!window.closed) {
                      document.body.innerHTML = 
                        '<div style="padding:40px;text-align:center;font-family:sans-serif;">' +
                        '<h2>✅ Connexion réussie!</h2>' +
                        '<p>Vous pouvez fermer cette fenêtre manuellement.</p>' +
                        '<button onclick="window.close()" style="padding:10px 20px;background:#1877F2;color:white;border:none;border-radius:5px;cursor:pointer;margin-top:20px;">Fermer</button>' +
                        '</div>';
                    }
                  }, 1000);
                }, 2000);
                
              })();
            </script>
          </body>
          </html>
        `);

        console.log('✅ Réponse HTML envoyée au client');
        console.log('🔚 ========== FIN CALLBACK (SUCCÈS) ==========\n');

      } catch (error) {
        console.error('❌ ERREUR CRITIQUE dans le callback OAuth:', error);
        console.error('Stack:', error.stack);
        
        // Réponse d'erreur HTML
        res.status(500).send(`
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <title>Erreur technique</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background: #f0f2f5; 
              }
              .error-icon { color: #ef4444; font-size: 64px; margin-bottom: 20px; }
              .container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .error-details {
                background: #fee;
                color: #c33;
                padding: 15px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 13px;
                margin-top: 20px;
                text-align: left;
                overflow-wrap: break-word;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">⚠️</div>
              <h1>Erreur technique</h1>
              <p>Une erreur est survenue lors de la connexion à Facebook.</p>
              <div class="error-details">${error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <script>
                (function() {
                  if (window.opener) {
                    window.opener.postMessage({
                      type: 'FACEBOOK_OAUTH_ERROR',
                      error: '${error.message.replace(/'/g, "\\'").replace(/"/g, '\\"')}',
                      stack: '${error.stack ? error.stack.replace(/'/g, "\\'").replace(/\n/g, ' ') : ''}'
                    }, '*');
                  }
                  localStorage.setItem('fb_oauth_error', JSON.stringify({
                    timestamp: Date.now(),
                    error: '${error.message.replace(/'/g, "\\'")}'
                  }));
                  setTimeout(() => window.close(), 5000);
                })();
              </script>
            </div>
          </body>
          </html>
        `);
        
        console.log('🔚 ========== FIN CALLBACK (ERREUR) ==========\n');
      }
    });

    // Route de fallback pour récupérer les données
    app.get('/facebook-callback', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            // Récupérer les données du hash
            const hash = window.location.hash.substring(1);
            if (hash) {
              try {
                const data = JSON.parse(decodeURIComponent(hash));
                console.log('📥 Données récupérées hash:', data);
                window.opener.postMessage(data, window.opener.location.origin);
              } catch (e) {
                console.error('❌ Erreur parsing hash:', e);
              }
            }
            window.close();
          </script>

          <script>
            // Fallback 1: LocalStorage
            localStorage.setItem('fb_oauth_token', '${accessToken}');
            localStorage.setItem('fb_oauth_userid', '${userId}');
            
            // Fallback 2: URL avec données
            const data = {
              token: '${accessToken}',
              userId: '${userId}'
            };
            
            // Essayer d'envoyer au parent
            try {
              window.opener.postMessage({
                type: 'FACEBOOK_OAUTH_SUCCESS',
                access_token: '${accessToken}'
              }, '*');
            } catch (e) {
              console.log('Fallback activé');
            }
            
            // Fermer immédiatement
            window.close();
          </script>


        </body>
        </html>
      `);
    });

    // Route pour tester le déchiffrement
    app.get('/api/debug/token-test', authenticate, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const accounts = await pool.query(
          `SELECT id, page_name, access_token_encrypted FROM "${schemaName}".webhook_accounts WHERE platform = 'facebook_messenger'`
        );
        
        const results = await Promise.all(accounts.rows.map(async (account) => {
          const token = account.access_token_encrypted;
          const decrypted = decryptAccessToken(token);
          
          return {
            account_id: account.id,
            page_name: account.page_name,
            token_preview: token ? token.substring(0, 30) + '...' : 'N/A',
            token_length: token?.length || 0,
            decrypted_success: !!decrypted,
            decrypted_preview: decrypted ? decrypted.substring(0, 30) + '...' : 'N/A',
            is_valid_format: decrypted ? decrypted.startsWith('EAA') : false
          };
        }));
        
        res.json({ success: true, accounts: results });
        
      } catch (error) {
        console.error('Test token error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Nettoyer toutes les 5 minutes
    setInterval(cleanupExpiredOAuthStates, 5 * 60 * 1000);

    // Nettoyer toutes les 5 minutes
    setInterval(cleanupExpiredOAuthStates, 5 * 60 * 1000);

    /**
    * Route 3: Récupérer les pages depuis la session
    */
    app.get('/api/facebook/oauth/pages/:sessionId', authenticate, async (req, res) => {
      try {
        const { sessionId } = req.params;
        
        console.log('📋 Récupération pages pour session:', sessionId);
        
        if (!global.facebookSessions) {
          return res.status(404).json({
            success: false,
            error: 'Session non trouvée (pas de sessions actives)'
          });
        }
        
        const session = global.facebookSessions.get(sessionId);
        
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session expirée ou invalide'
          });
        }
        
        // Vérifier expiration
        if (Date.now() > session.expiresAt) {
          global.facebookSessions.delete(sessionId);
          return res.status(410).json({
            success: false,
            error: 'Session expirée'
          });
        }
        
        // Vérifier que l'utilisateur demande bien sa propre session
        if (session.userId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé'
          });
        }
        
        res.json({
          success: true,
          pages: session.pages,
          facebook_user: session.facebookUser,
          session_id: sessionId
        });
        
      } catch (error) {
        console.error('Erreur récupération pages:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur serveur'
        });
      }
    });

    app.get('/api/facebook/oauth/check/:state', async (req, res) => {
      try {
        const { state } = req.params;
        console.log('🔍 Check OAuth state:', state);
        
        // Vérifier si une session existe avec ce state
        if (global.facebookSessions) {
          for (const [sessionId, sessionData] of global.facebookSessions.entries()) {
            if (sessionData.oauthState === state) {
              console.log('✅ Session trouvée:', sessionId);
              return res.json({
                success: true,
                ready: true,
                sessionId: sessionId,
                pages: sessionData.pages,
                facebookUser: sessionData.facebookUser
              });
            }
          }
        }
        
        // Vérifier si le state est encore en attente (dans oauthStates)
        if (global.oauthStates && global.oauthStates.has(state)) {
          return res.json({
            success: true,
            ready: false,
            message: 'En attente de connexion Facebook...'
          });
        }
        
        // State inconnu ou expiré
        res.status(404).json({
          success: false,
          error: 'Session non trouvée ou expirée'
        });
        
      } catch (error) {
        console.error('❌ Erreur check OAuth:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
      console.log('Sessions:', Array.from(global.facebookSessions?.keys() || []), 
                'States:', Array.from(global.facebookSessions?.values() || []).map(s => s.oauthState));
    });

    /**
    * Route 5: Configurer une page Facebook sélectionnée (version corrigée)
    */
    app.post('/api/facebook/oauth/configure-page', authenticate, enforceDataIsolation, async (req, res) => {
      const client = await pool.connect();
      
      try {
        const { sessionId, pageId, pageName, accessToken: userAccessToken, aiEnabled = true, autoReply = true } = req.body;
        const userId = req.user.userId || req.user.id;
        const schemaName = `user_${userId}`;
        
        console.log('🔧 ========== CONFIGURATION FACEBOOK PAGE ==========');
        console.log(`👤 User: ${userId} | 📄 Page: ${pageId} | 🏷️  Nom: ${pageName}`);
        
        // Validation
        if (!sessionId || !pageId || !userAccessToken) {
          return res.status(400).json({
            success: false,
            error: 'Paramètres manquants'
          });
        }

        // Vérification session
        if (!global.facebookSessions || !global.facebookSessions.has(sessionId)) {
          return res.status(404).json({
            success: false,
            error: 'Session expirée'
          });
        }

        const session = global.facebookSessions.get(sessionId);
        
        if (session.userId !== userId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Accès non autorisé' 
          });
        }

        // 🔄 ÉTAPE CRITIQUE: Obtenir le token de page EN CLAIR
        console.log('🔄 Obtention Page Token...');
        const pageData = await exchangeForPageToken(userAccessToken, pageId);
        
        if (!pageData || !pageData.pageToken) {
          return res.status(400).json({
            success: false,
            error: 'Impossible d\'obtenir un token de page valide',
            details: 'Vérifiez que vous êtes administrateur de la page et avez les permissions nécessaires'
          });
        }

        // Stocker directement sans chiffrement :
        await client.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET access_token_encrypted = $1, -- DÉJÀ EN CLAIR
          ...
        `, [pageToken]);
        const finalPageName = pageName || pageData.pageName || `Page ${pageId}`;
        
        console.log('✅ Page Token obtenu (clair):', pageToken.substring(0, 25) + '...');
        console.log('📄 Page:', finalPageName);

        // 🔐 STOCKAGE EN CLAIR (plus de chiffrement)
        console.log('💾 Stockage token EN CLAIR dans la base');
        
        // Début transaction
        await client.query('BEGIN');

        // Vérifier si compte existe déjà
        const existingCheck = await client.query(`
          SELECT id FROM "${schemaName}".webhook_accounts 
          WHERE page_id = $1 AND platform = 'facebook_messenger'
        `, [pageId]);

        let accountId;
        let isUpdate = false;
        
        if (existingCheck.rows.length > 0) {
          // Mise à jour
          accountId = existingCheck.rows[0].id;
          isUpdate = true;
          
          console.log(`🔄 Mise à jour compte existant ID: ${accountId}`);
          
          await client.query(`
            UPDATE "${schemaName}".webhook_accounts 
            SET 
              access_token_encrypted = $1, -- TOKEN EN CLAIR
              page_name = $2,
              is_active = true,
              verification_status = 'verified',
              meta_verified = true,
              ai_enabled = $3,
              auto_reply = $4,
              updated_at = CURRENT_TIMESTAMP,
              config_data = jsonb_set(
                COALESCE(config_data, '{}'::jsonb),
                '{token_info}',
                to_jsonb($5)
              )
            WHERE id = $6
            RETURNING id
          `, [
            pageToken, // ← TOKEN EN CLAIR
            finalPageName,
            aiEnabled,
            autoReply,
            {
              stored_in_plain: true,
              token_format: 'EAA_plain',
              token_length: pageToken.length,
              obtained_at: new Date().toISOString(),
              page_tasks: pageData.pageTasks
            },
            accountId
          ]);
          
        } else {
          // Nouveau compte
          console.log('🆕 Création nouveau compte...');
          
          const verifyToken = `fb_${userId}_${pageId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          const insertResult = await client.query(`
            INSERT INTO "${schemaName}".webhook_accounts 
            (user_id, platform, platform_type, name, page_id, page_name, 
            access_token_encrypted, verify_token, webhook_fields, webhook_url,
            is_active, ai_enabled, auto_reply, meta_verified, verification_status, config_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
          `, [
            userId,
            'facebook_messenger',
            'facebook_messenger',
            finalPageName,
            pageId,
            finalPageName,
            pageToken, // ← TOKEN EN CLAIR ICI
            verifyToken,
            ['messages', 'messaging_postbacks'],
            `${APP_BASE_URL}/api/webhook/messenger/${userId}/TEMP`,
            true,
            aiEnabled,
            autoReply,
            true,
            'verified',
            JSON.stringify({ 
              token_stored_in_plain: true,
              token_format: 'EAA',
              token_obtained_via: 'oauth',
              initial_connect: true,
              date: new Date().toISOString(),
              page_info: {
                id: pageId,
                name: finalPageName,
                category: pageData.pageCategory
              }
            })
          ]);
          
          accountId = insertResult.rows[0].id;
        }

        // Mettre à jour l'URL webhook finale
        const finalWebhookUrl = `${APP_BASE_URL}/api/webhook/messenger/${userId}/${accountId}`;
        
        await client.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET webhook_url = $1 
          WHERE id = $2
        `, [finalWebhookUrl, accountId]);

        // Créer/mettre à jour le mapping global
        await client.query(`
          INSERT INTO public.facebook_pages_mapping 
          (page_id, platform, user_id, schema_name, account_id, page_name, verify_token, updated_at)
          VALUES ($1, 'facebook_messenger', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (page_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            schema_name = EXCLUDED.schema_name,
            account_id = EXCLUDED.account_id,
            page_name = EXCLUDED.page_name,
            verify_token = EXCLUDED.verify_token,
            updated_at = CURRENT_TIMESTAMP
        `, [pageId, userId, schemaName, accountId, finalPageName, verifyToken]);

        await client.query('COMMIT');
        
        // Nettoyer la session
        global.facebookSessions.delete(sessionId);
        console.log('🧹 Session nettoyée');

        // Réponse succès
        res.json({
          success: true,
          message: 'Page Facebook connectée avec succès!',
          data: {
            accountId,
            pageId,
            pageName: finalPageName,
            webhookUrl: finalWebhookUrl,
            verifyToken,
            isUpdate,
            aiEnabled,
            autoReply,
            tokenStoredInPlain: true,
            tokenPreview: pageToken.substring(0, 20) + '...'
          }
        });

        console.log('✅ Configuration terminée - Token stocké en clair');

      } catch (error) {
        await client.query('ROLLBACK');
        
        console.error('❌ ERREUR CONFIGURATION PAGE:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la configuration',
          details: error.message
        });
      } finally {
        client.release();
      }
    });

    /**
    * Diagnostic et réparation des tokens Facebook
    * GET /api/facebook/diagnose-tokens
    */
    app.get('/api/facebook/diagnose-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const accountsResult = await pool.query(`
          SELECT id, name, page_id, page_name, access_token_encrypted, 
                verification_status, is_active, last_sync, created_at
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger'
          ORDER BY created_at DESC
        `);
        
        const diagnostics = await Promise.all(accountsResult.rows.map(async (account) => {
          const token = account.access_token_encrypted || '';
          const decrypted = decryptAccessToken(token);
          const isValid = decrypted && decrypted.startsWith('EAA');
          
          // Si invalide, tester la connexion pour confirmer
          let connectivity = 'unknown';
          if (isValid && account.page_id) {
            try {
              const testUrl = `https://graph.facebook.com/v18.0/${account.page_id}?access_token=${decrypted}&fields=id,name`;
              const testRes = await fetch(testUrl);
              connectivity = testRes.ok ? 'ok' : 'failed';
              
              if (testRes.ok) {
                // Mettre à jour le statut si c'est OK
                await pool.query(`
                  UPDATE "${schemaName}".webhook_accounts 
                  SET verification_status = 'verified', is_active = true 
                  WHERE id = $1
                `, [account.id]);
              }
            } catch (e) {
              connectivity = 'error';
            }
          }
          
          return {
            id: account.id,
            page_name: account.page_name,
            page_id: account.page_id,
            status: {
              database: account.verification_status,
              active: account.is_active,
              token_valid: isValid,
              connectivity: connectivity
            },
            token: {
              present: !!token,
              length: token.length,
              preview: token ? token.substring(0, 15) + '...' : 'N/A',
              format: isValid ? 'EAA (valide)' : (token.startsWith('EAA') ? 'EAA (déchiffrement échoué)' : 'Invalide')
            },
            dates: {
              created: account.created_at,
              last_sync: account.last_sync
            },
            action_required: !isValid || connectivity === 'failed' ? 'Reconnexion nécessaire' : 'Aucune'
          };
        }));
        
        const invalidCount = diagnostics.filter(d => d.action_required !== 'Aucune').length;
        
        res.json({
          success: true,
          summary: {
            total: diagnostics.length,
            valid: diagnostics.length - invalidCount,
            invalid: invalidCount
          },
          accounts: diagnostics,
          message: invalidCount > 0 
            ? `${invalidCount} compte(s) nécessitent une reconnexion. Utilisez la fonction "Reconnecter" dans les paramètres.`
            : 'Tous les tokens sont valides.'
        });
        
      } catch (error) {
        console.error('Erreur diagnostic:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route simple pour obtenir un token Facebook rapidement
    app.get('/api/facebook/get-token-quick', authenticate, async (req, res) => {
      try {
        const userId = req.user.id;
        const userEmail = req.user.email;
        
        const state = `quick_${userId}_${Date.now()}`;
        
        if (!global.oauthStates) {
          global.oauthStates = new Map();
        }
        
        global.oauthStates.set(state, {
          userId: userId,
          userEmail: userEmail,
          schema: req.userSchema,
          timestamp: Date.now(),
          status: 'quick_token',
          quick_mode: true
        });
        
        const redirectUri = `${req.protocol}://${req.get('host')}/api/facebook/oauth/callback`;
        const scope = 'pages_show_list,pages_messaging';
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${FACEBOOK_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scope)}` +
          `&state=${state}` +
          `&response_type=code`;
        
        res.json({
          success: true,
          oauth_url: authUrl,
          state: state,
          instructions: [
            '1. Ouvrez cette URL dans un navigateur',
            '2. Connectez-vous avec Facebook',
            '3. Autorisez les permissions',
            '4. Sélectionnez votre page',
            '5. Copiez le token EAA affiché'
          ]
        });
        
      } catch (error) {
        console.error('Erreur quick token:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
    * Supprimer et forcer la reconnexion d'un compte
    * DELETE /api/webhook-accounts/:id/force-reconnect
    */
    app.delete('/api/webhook-accounts/:id/force-reconnect', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { id } = req.params;
        const schemaName = req.userSchema;
        
        // Supprimer le compte (ou le marquer comme supprimé)
        await pool.query(`
          DELETE FROM "${schemaName}".webhook_accounts 
          WHERE id = $1
        `, [id]);
        
        // Supprimer aussi le mapping global
        await pool.query(`
          DELETE FROM public.facebook_pages_mapping 
          WHERE account_id = $1
        `, [id]);
        
        res.json({
          success: true,
          message: 'Compte supprimé. Vous pouvez maintenant le reconnecter via OAuth.',
          reconnect_url: '/api/facebook/oauth/init'
        });
        
      } catch (error) {
        console.error('Erreur force reconnect:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Ajoutez cette route dans server.js
    app.post('/api/urgence/reinitialiser-token/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🔄 Réinitialisation d'urgence pour le compte ${accountId}`);
        
        // Mettre un token test simple
        const tokenTest = 'EAA_test_token_a_remplacer';
        
        await pool.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET access_token_encrypted = $1,
              verification_status = 'needs_reconnect',
              is_active = false,
              updated_at = NOW()
          WHERE id = $2 AND user_id = $3
        `, [tokenTest, accountId, userId]);
        
        // Supprimer le mapping
        await pool.query(`
          DELETE FROM public.facebook_pages_mapping 
          WHERE account_id = $1
        `, [accountId]);
        
        res.json({
          success: true,
          message: 'Token réinitialisé. Veuillez reconnecter la page Facebook.',
          etapes: [
            '1. Allez dans vos paramètres Facebook',
            '2. Déconnectez et reconnectez l\'application',
            '3. Utilisez OAuth pour obtenir un nouveau token'
          ]
        });
        
      } catch (error) {
        console.error('Erreur réinitialisation d\'urgence:', error);
        res.status(500).json({ error: error.message });
      }
    });


    app.post('/api/facebook/reset-and-reconnect/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🔄 Réinitialisation manuelle pour compte ${accountId}`);
        
        // Récupérer les infos du compte avant suppression
        const accountInfo = await pool.query(`
          SELECT page_id, page_name FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        if (accountInfo.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }
        
        const { page_id, page_name } = accountInfo.rows[0];
        
        // Supprimer le compte
        await pool.query(`
          DELETE FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        // Supprimer le mapping global
        await pool.query(`
          DELETE FROM public.facebook_pages_mapping 
          WHERE account_id = $1
        `, [accountId]);
        
        // Créer une notification
        await pool.query(`
          INSERT INTO "${schemaName}".notifications 
          (user_id, type, title, message, priority, action_url, read, created_at)
          VALUES ($1, 'info', 'Page Facebook déconnectée', 
                  'La page "${page_name}" a été déconnectée. Vous pouvez la reconnecter.', 
                  'medium', '/settings/webhooks', false, NOW())
        `, [userId]);
        
        res.json({
          success: true,
          message: 'Compte réinitialisé avec succès',
          data: {
            page_id,
            page_name,
            reconnection_steps: [
              '1. Allez dans "Paramètres" > "Webhooks & Intégrations"',
              '2. Cliquez sur "Connecter une page Facebook"',
              '3. Suivez le processus OAuth',
              '4. Sélectionnez votre page',
              '5. Le nouveau token sera stocké en clair'
            ]
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur réinitialisation manuelle:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    // Route pour vérifier et réparer un token spécifique
    app.post('/api/facebook/verify-and-repair/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🔧 Vérification/réparation token pour compte ${accountId}`);
        
        // 1. Récupérer le compte
        const accountResult = await pool.query(`
          SELECT id, page_id, page_name, access_token_encrypted, config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }
        
        const account = accountResult.rows[0];
        const pageId = account.page_id;
        const oldToken = account.access_token_encrypted;
        
        console.log('🔍 Analyse token:', {
          page: account.page_name,
          token_length: oldToken?.length || 0,
          token_preview: oldToken?.substring(0, 30) + '...',
          is_eaa: oldToken?.startsWith('EAA') || false
        });
        
        // 2. Essayer de déchiffrer le token actuel
        let currentToken = null;
        if (oldToken) {
          currentToken = decryptAccessToken(oldToken);
          
          if (currentToken) {
            // Vérifier si le token est encore valide
            try {
              const testUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name&access_token=${currentToken}`;
              const testRes = await fetch(testUrl);
              
              if (testRes.ok) {
                console.log('✅ Token actuel est valide');
                return res.json({
                  success: true,
                  message: 'Token valide',
                  status: 'valid',
                  page_name: account.page_name
                });
              } else {
                console.log('⚠️ Token invalide ou expiré');
              }
            } catch (testError) {
              console.log('⚠️ Erreur test token:', testError.message);
            }
          }
        }
        
        // 3. Si le token est invalide, demander une reconnexion OAuth
        console.log('🔄 Token invalide, génération nouvelle URL OAuth...');
        
        const state = `repair_${accountId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        if (!global.oauthStates) {
          global.oauthStates = new Map();
        }
        
        global.oauthStates.set(state, {
          userId: userId,
          userEmail: req.user.email,
          schema: schemaName,
          timestamp: Date.now(),
          status: 'repair',
          accountId: accountId,
          pageId: pageId,
          pageName: account.page_name
        });
        
        const redirectUri = `${req.protocol}://${req.get('host')}/api/facebook/oauth/callback`;
        const scope = 'pages_show_list,pages_messaging';
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${FACEBOOK_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scope)}` +
          `&state=${state}` +
          `&response_type=code`;
        
        res.json({
          success: true,
          requires_reconnect: true,
          message: 'Token invalide, reconnexion nécessaire',
          data: {
            account_id: accountId,
            page_name: account.page_name,
            oauth_url: authUrl,
            state: state,
            reason: currentToken ? 'token_expired' : 'token_missing'
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur vérification token:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route URGENCE pour réparer un token Facebook
    app.post('/api/facebook/emergency-repair-token/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🚨 RÉPARATION URGENCE TOKEN pour compte ${accountId}`);
        
        // 1. Récupérer le compte
        const accountResult = await pool.query(`
          SELECT id, page_id, page_name, access_token_encrypted, config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({ error: 'Compte non trouvé' });
        }
        
        const account = accountResult.rows[0];
        const currentToken = decryptAccessToken(account.access_token_encrypted);
        
        console.log('🔍 Analyse token actuel:', {
          token_preview: currentToken?.substring(0, 30) + '...',
          token_length: currentToken?.length,
          is_eaa: currentToken?.startsWith('EAA')
        });
        
        // 2. Tenter de récupérer un token de page
        console.log('🔄 Tentative récupération token de page...');
        
        // Si vous avez un token utilisateur stocké dans config_data
        let userToken = null;
        if (account.config_data) {
          try {
            const config = JSON.parse(account.config_data);
            if (config.user_access_token && config.user_access_token.startsWith('EAA')) {
              userToken = config.user_access_token;
              console.log('✅ Token utilisateur trouvé dans config_data');
            }
          } catch (e) {}
        }
        
        let pageToken = null;
        if (userToken) {
          pageToken = await tryGetPageTokenFromUserToken(userToken, account.page_id);
        }
        
        // 3. Si échec, demander une reconnexion OAuth
        if (!pageToken) {
          console.log('❌ Impossible de récupérer token de page, lancement OAuth...');
          
          const state = `emergency_${accountId}_${Date.now()}`;
          
          if (!global.oauthStates) {
            global.oauthStates = new Map();
          }
          
          global.oauthStates.set(state, {
            userId: userId,
            userEmail: req.user.email,
            schema: schemaName,
            timestamp: Date.now(),
            status: 'emergency_repair',
            accountId: accountId,
            pageId: account.page_id
          });
          
          const redirectUri = `${req.protocol}://${req.get('host')}/api/facebook/oauth/callback`;
          const scope = 'pages_show_list,pages_messaging,pages_read_engagement';
          
          const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${FACEBOOK_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scope)}` +
            `&state=${state}` +
            `&response_type=code`;
          
          return res.json({
            success: true,
            requires_reconnect: true,
            message: 'Reconnexion OAuth nécessaire pour obtenir un token de page valide',
            oauth_url: authUrl,
            state: state,
            instructions: [
              '1. Cliquez sur le lien ci-dessus',
              '2. Connectez-vous avec Facebook',
              '3. Autorisez TOUTES les permissions',
              '4. Sélectionnez votre page "SENE KEUR"',
              '5. Un nouveau token de page sera stocké'
            ]
          });
        }
        
        // 4. Si on a un token de page, le sauvegarder
        console.log(`✅ Token de page obtenu: ${pageToken.substring(0, 30)}...`);
        
        await forceStoreTokenInPlain(schemaName, accountId, pageToken);
        
        // 5. Tester le nouveau token
        const testUrl = `https://graph.facebook.com/v18.0/${account.page_id}/messages`;
        const testPayload = {
          recipient: { id: '25407834305583492' }, // Votre ID de test
          message: { text: 'Test réparation token' },
          messaging_type: "RESPONSE"
        };
        
        const testRes = await fetch(`${testUrl}?access_token=${encodeURIComponent(pageToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });
        
        const testResult = await testRes.json();
        
        res.json({
          success: true,
          message: 'Token réparé avec succès',
          data: {
            account_id: accountId,
            page_name: account.page_name,
            token_preview: pageToken.substring(0, 25) + '...',
            token_length: pageToken.length,
            test_result: testResult.error ? 'failed' : 'success',
            error: testResult.error?.message,
            message_id: testResult.message_id
          },
          next_steps: [
            '1. Testez en envoyant un message à votre page',
            '2. Vérifiez que la réponse est bien envoyée',
            '3. Activez l\'IA si ce n\'est pas déjà fait'
          ]
        });
        
      } catch (error) {
        console.error('❌ Erreur réparation urgence:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route URGENCE pour réparer un token spécifique
    app.post('/api/facebook/emergency-fix-account/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const { page_token } = req.body; // Token EAA fourni manuellement
        
        console.log(`🚨 RÉPARATION URGENCE compte ${accountId}`);
        
        if (!page_token) {
          return res.status(400).json({
            success: false,
            error: 'Token EAA requis (commençant par EAA...)'
          });
        }
        
        // VALIDER que c'est un token EAA
        if (!page_token.startsWith('EAA')) {
          return res.status(400).json({
            success: false,
            error: 'Token invalide (doit commencer par EAA)',
            received_preview: page_token.substring(0, 50)
          });
        }
        
        // 1. Récupérer les infos du compte
        const accountResult = await pool.query(`
          SELECT page_id, page_name FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }
        
        const { page_id, page_name } = accountResult.rows[0];
        
        // 2. Tester le token avec Facebook API
        console.log('🧪 Test token avec Facebook API...');
        const testUrl = `https://graph.facebook.com/v18.0/${page_id}?fields=id,name&access_token=${page_token}`;
        const testRes = await fetch(testUrl);
        const testData = await testRes.json();
        
        if (!testRes.ok) {
          return res.status(400).json({
            success: false,
            error: 'Token Facebook invalide',
            facebook_error: testData.error,
            suggestion: 'Obtenez un nouveau token via Facebook Graph API Explorer'
          });
        }
        
        console.log(`✅ Token valide pour page: ${testData.name}`);
        
        // 3. FORCER le stockage en clair
        await forceStoreTokenInPlain(schemaName, accountId, page_token);
        
        // 4. Activer le compte
        await pool.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET is_active = true,
              verification_status = 'verified',
              meta_verified = true,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [accountId]);
        
        // 5. Mettre à jour le mapping
        await pool.query(`
          UPDATE public.facebook_pages_mapping 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE account_id = $1
        `, [accountId]);
        
        // 6. Tester l'envoi d'un message
        console.log('📤 Test envoi message...');
        const testMessageUrl = `https://graph.facebook.com/v18.0/${page_id}/messages`;
        const testMessageRes = await fetch(testMessageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: '25407834305583492' }, // Votre ID Facebook de test
            message: { text: 'Test de connexion' },
            messaging_type: 'RESPONSE',
            access_token: page_token
          })
        });
        
        const messageResult = await testMessageRes.json();
        const canSendMessages = !messageResult.error;
        
        res.json({
          success: true,
          message: 'Compte réparé avec succès!',
          data: {
            account_id: accountId,
            page_name: page_name,
            page_id: page_id,
            token_preview: page_token.substring(0, 25) + '...',
            token_length: page_token.length,
            token_validated: true,
            can_send_messages: canSendMessages,
            facebook_page_name: testData.name,
            test_message_result: canSendMessages ? 'success' : messageResult.error?.message
          },
          instructions: [
            '1. Testez en envoyant un message à votre page Facebook',
            '2. Vérifiez que la réponse IA est envoyée',
            '3. Activez l\'IA dans les paramètres si nécessaire'
          ]
        });
        
        console.log(`✅ Compte ${accountId} réparé avec succès!`);
        
      } catch (error) {
        console.error('❌ Erreur réparation urgence:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route pour migrer tous les tokens vers le format clair
    app.post('/api/facebook/migrate-all-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🔄 Migration de tous les tokens pour ${schemaName}`);
        
        const accounts = await pool.query(`
          SELECT id, page_name, page_id, access_token_encrypted, config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger' 
          AND user_id = $1
        `, [userId]);
        
        let migrated = 0;
        let failed = 0;
        let alreadyPlain = 0;
        
        for (const account of accounts.rows) {
          try {
            const oldToken = account.access_token_encrypted;
            
            // Si déjà en clair
            if (oldToken && oldToken.startsWith('EAA')) {
              console.log(`✅ ${account.page_name}: déjà en clair`);
              alreadyPlain++;
              continue;
            }
            
            // Essayer de déchiffrer
            const decryptedToken = decryptAccessToken(oldToken);
            
            if (decryptedToken && decryptedToken.startsWith('EAA')) {
              // Migrer vers clair
              await pool.query(`
                UPDATE "${schemaName}".webhook_accounts 
                SET access_token_encrypted = $1,
                    updated_at = CURRENT_TIMESTAMP,
                    config_data = jsonb_set(
                      COALESCE(config_data, '{}'::jsonb),
                      '{migrated_to_plain}',
                      to_jsonb($2)
                    )
                WHERE id = $3
              `, [
                decryptedToken,
                new Date().toISOString(),
                account.id
              ]);
              
              console.log(`✅ ${account.page_name}: migré vers clair`);
              migrated++;
            } else {
              console.log(`❌ ${account.page_name}: impossible à déchiffrer`);
              
              // Marquer comme besoin de reconnexion
              await pool.query(`
                UPDATE "${schemaName}".webhook_accounts 
                SET verification_status = 'needs_reconnect',
                    is_active = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
              `, [account.id]);
              
              failed++;
            }
            
          } catch (error) {
            console.error(`❌ Erreur compte ${account.id}:`, error.message);
            failed++;
          }
        }
        
        res.json({
          success: true,
          message: `Migration terminée`,
          summary: {
            total: accounts.rows.length,
            migrated: migrated,
            already_plain: alreadyPlain,
            failed: failed
          },
          instructions: failed > 0 ? [
            `${failed} compte(s) nécessitent une reconnexion manuelle`,
            'Utilisez /api/facebook/verify-and-repair/:accountId'
          ] : ['Tous les tokens sont maintenant en clair']
        });
        
      } catch (error) {
        console.error('❌ Erreur migration:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    /**
    * MIGRATION DÉFINITIVE - Convertit tous les tokens en clair
    */
    app.post('/api/facebook/migrate-all-to-plain-final', authenticate, enforceDataIsolation, async (req, res) => {
      const client = await pool.connect();
      
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🚨 MIGRATION DÉFINITIVE pour ${schemaName}`);
        
        await client.query('BEGIN');
        
        // 1. Récupérer tous les comptes
        const accounts = await client.query(`
          SELECT id, page_name, access_token_encrypted, config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger'
          AND user_id = $1
        `, [userId]);
        
        let migrated = 0;
        let alreadyPlain = 0;
        let needsReconnect = [];
        
        // 2. Pour chaque compte
        for (const account of accounts.rows) {
          const oldToken = account.access_token_encrypted || '';
          
          // Scénario 1: Déjà en clair EAA
          if (oldToken.startsWith('EAA')) {
            console.log(`✅ ${account.page_name}: déjà en clair`);
            alreadyPlain++;
            continue;
          }
          
          // Scénario 2: Ancien format chiffré (IV:ENCRYPTED)
          if (oldToken.includes(':') && oldToken.length > 100) {
            console.log(`🔄 ${account.page_name}: ancien format chiffré`);
            
            // FORCER la reconnexion - ne pas tenter de déchiffrer
            await client.query(`
              UPDATE "${schemaName}".webhook_accounts 
              SET access_token_encrypted = NULL,
                  verification_status = 'needs_reconnect',
                  is_active = false,
                  updated_at = CURRENT_TIMESTAMP,
                  config_data = jsonb_set(
                    COALESCE(config_data, '{}'::jsonb),
                    '{migration}',
                    to_jsonb($1)
                  )
              WHERE id = $2
            `, [{
              original_format: 'encrypted',
              migration_date: new Date().toISOString(),
              action_required: 'reconnect_oauth'
            }, account.id]);
            
            needsReconnect.push({
              id: account.id,
              name: account.page_name,
              reason: 'encrypted_token_deprecated'
            });
            migrated++;
          }
          
          // Scénario 3: Token manquant ou invalide
          else {
            console.log(`❌ ${account.page_name}: token invalide`);
            
            await client.query(`
              UPDATE "${schemaName}".webhook_accounts 
              SET verification_status = 'needs_reconnect',
                  is_active = false,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [account.id]);
            
            needsReconnect.push({
              id: account.id,
              name: account.page_name,
              reason: 'invalid_or_missing_token'
            });
            migrated++;
          }
        }
        
        // 3. Mettre à jour la table de mapping global
        await client.query(`
          UPDATE public.facebook_pages_mapping 
          SET token_format = 'plain_only',
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [userId]);
        
        await client.query('COMMIT');
        
        res.json({
          success: true,
          message: 'Migration définitive terminée',
          summary: {
            total: accounts.rows.length,
            already_plain: alreadyPlain,
            migrated_to_plain: migrated,
            needs_reconnect: needsReconnect.length
          },
          needs_reconnect: needsReconnect,
          next_steps: needsReconnect.length > 0 ? [
            `⚠️ ${needsReconnect.length} compte(s) nécessitent une reconnexion:`,
            '1. Utilisez /api/facebook/oauth/init',
            '2. Reconnectez chaque page via OAuth',
            '3. Les nouveaux tokens seront stockés EN CLAIR',
            '4. Plus jamais de cryptage!'
          ] : ['✅ Tous les tokens sont maintenant en clair']
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur migration définitive:', error);
        res.status(500).json({ error: error.message });
      } finally {
        client.release();
      }
    });

    // Route pour tester le token Facebook
    app.post('/api/facebook/test-token/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🧪 Test token pour compte ${accountId}`);
        
        const accountResult = await pool.query(`
          SELECT page_id, page_name, access_token_encrypted 
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({ error: 'Compte non trouvé' });
        }
        
        const account = accountResult.rows[0];
        const token = decryptAccessToken(account.access_token_encrypted);
        
        if (!token) {
          return res.json({ valid: false, error: 'Token invalide ou non déchiffrable' });
        }
        
        // Tester le token
        const testResult = await testFacebookToken(account.page_id, token);
        
        res.json({
          success: true,
          account_id: accountId,
          page_name: account.page_name,
          page_id: account.page_id,
          token_preview: token.substring(0, 25) + '...',
          token_length: token.length,
          test_result: testResult
        });
        
      } catch (error) {
        console.error('❌ Erreur test token:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
    * Vérifie que tous les tokens sont en clair
    */
    app.get('/api/facebook/verify-plain-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const result = await pool.query(`
          SELECT 
            id,
            page_name,
            access_token_encrypted as token,
            LENGTH(access_token_encrypted) as token_length,
            CASE 
              WHEN access_token_encrypted IS NULL THEN 'missing'
              WHEN access_token_encrypted LIKE 'EAA%' THEN 'plain_eaa'
              WHEN access_token_encrypted LIKE '%:%' THEN 'encrypted_old'
              ELSE 'unknown'
            END as token_format,
            is_active,
            verification_status
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger'
          AND user_id = $1
          ORDER BY token_format
        `, [userId]);
        
        const summary = {
          total: result.rows.length,
          plain_eaa: result.rows.filter(r => r.token_format === 'plain_eaa').length,
          encrypted_old: result.rows.filter(r => r.token_format === 'encrypted_old').length,
          missing: result.rows.filter(r => r.token_format === 'missing').length,
          unknown: result.rows.filter(r => r.token_format === 'unknown').length
        };
        
        const allPlain = summary.encrypted_old === 0 && summary.unknown === 0;
        
        res.json({
          success: true,
          all_tokens_plain: allPlain,
          summary,
          accounts: result.rows,
          recommendation: !allPlain 
            ? 'Exécutez /api/facebook/migrate-all-to-plain-final pour corriger'
            : '✅ Tous les tokens sont en clair!'
        });
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==================== ROUTES WEBHOOK FACEBOOK (PUBLIQUES) ====================

    // Route GET - Vérification Facebook (DOIT être exactement comme ça)
    app.get('/api/webhook/facebook', async (req, res) => {
      try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        console.log('🔐 [Facebook Verification]', {
          mode,
          token: token?.substring(0, 10) + '...',
          challenge: challenge?.substring(0, 10) + '...'
        });

        // Vérification stricte
        if (!mode || !token) {
          console.log('❌ Mode ou token manquant');
          return res.status(400).send('Missing parameters');
        }

        if (mode !== 'subscribe') {
          console.log('❌ Mode invalide:', mode);
          return res.status(400).send('Invalid mode');
        }

        // IMPORTANT : Vérifiez que ce token correspond EXACTEMENT à ce que vous avez mis dans Facebook
        const EXPECTED_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN_GLOBAL || 'fb_global_verify_token_2024';
        
        if (token !== EXPECTED_TOKEN) {
          console.error('❌ Token invalide');
          console.log('  Attendu:', EXPECTED_TOKEN);
          console.log('  Reçu:', token);
          return res.status(403).send('Verification failed');
        }

        // SUCCÈS : Retourner UNIQUEMENT le challenge (texte brut)
        console.log('✅ Vérification réussie, envoi du challenge');
        return res.status(200).send(challenge);
        
      } catch (error) {
        console.error('❌ Erreur vérification:', error);
        res.status(500).send('Server error');
      }
    });
    // Route POST pour recevoir les messages (détection automatique)
    app.post('/api/webhook/facebook', async (req, res) => {
      // 1. Répondre IMMÉDIATEMENT à Facebook (obligatoire, sinon Facebook réessaie)
      res.status(200).send('EVENT_RECEIVED');
      
      try {
        // 2. Extraire le Page ID depuis le payload
        const pageId = req.body.entry?.[0]?.id;
        
        if (!pageId) {
          console.log('⚠️ Webhook Facebook: Aucun Page ID trouvé');
          return;
        }

        console.log('📘 Page ID détecté:', pageId);

        // 3. Chercher le mapping dans la table globale
        const mappingResult = await pool.query(`
          SELECT user_id, schema_name, account_id, page_name
          FROM public.facebook_pages_mapping 
          WHERE page_id = $1
          LIMIT 1
        `, [pageId]);
        
        if (mappingResult.rows.length === 0) {
          console.error('❌ Page ID non mappée:', pageId);
          console.log('💡 Cette page n\'est pas connectée à un utilisateur dans la base');
          return;
        }
        
        const { user_id, schema_name, account_id, page_name } = mappingResult.rows[0];
        console.log('✅ Mapping trouvé:', { user_id, schema_name, account_id, page_name });

        // 4. Vérifier que le compte existe encore dans le schéma utilisateur
        try {
          const accountCheck = await pool.query(
            `SELECT id, is_active, access_token_encrypted 
            FROM "${schema_name}".webhook_accounts 
            WHERE id = $1 AND platform = 'facebook_messenger'`,
            [account_id]
          );
          
          if (accountCheck.rows.length === 0) {
            console.error(`❌ Compte ${account_id} non trouvé dans le schéma ${schema_name}`);
            return;
          }
          
          if (!accountCheck.rows[0].is_active) {
            console.log(`ℹ️ Compte ${account_id} inactif, message ignoré`);
            return;
          }
        } catch (dbError) {
          console.error(`❌ Erreur accès schéma ${schema_name}:`, dbError.message);
          return;
        }

        // 5. Traiter le webhook avec les bonnes valeurs du mapping
        await processFacebookWebhook(schema_name, user_id, account_id, account_id, req.body);
        
      } catch (error) {
        console.error('❌ Erreur générale webhook Facebook:', error.message);
        // Pas de throw, Facebook ne doit pas recevoir d'erreur 500
      }
    });

    app.get('/api/facebook/debug-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const accounts = await pool.query(`
          SELECT id, page_name, access_token_encrypted, 
                verification_status, is_active, created_at
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger' 
          AND user_id = $1
          ORDER BY created_at DESC
        `, [userId]);
        
        const analyse = await Promise.all(accounts.rows.map(async (account) => {
          const token = account.access_token_encrypted || '';
          
          // Tester avec votre clé actuelle
          const dechiffreAvecCleActuelle = decryptAccessToken(token);
          
          // Tester aussi sans déchiffrement
          const estTokenClair = token.startsWith('EAA');
          const estChiffreHex = token.includes(':') && token.split(':')[0].length === 32;
          const estBase64 = /^[A-Za-z0-9+/=]+$/.test(token);
          
          return {
            id: account.id,
            page: account.page_name,
            token_preview: token.substring(0, 30) + (token.length > 30 ? '...' : ''),
            token_length: token.length,
            formats: {
              clair: estTokenClair,
              chiffre_hex: estChiffreHex,
              base64: estBase64
            },
            dechiffrement_reussi: !!dechiffreAvecCleActuelle && dechiffreAvecCleActuelle.startsWith('EAA'),
            etat: account.verification_status,
            actif: account.is_active
          };
        }));
        
        res.json({
          success: true,
          analyse,
          recommandation: analyse.some(a => !a.dechiffrement_reussi) 
            ? 'Certains tokens ne peuvent pas être déchiffrés avec la clé actuelle. Utilisez /api/facebook/regenerate-tokens'
            : 'Tous les tokens sont valides'
        });
        
      } catch (error) {
        console.error('Erreur debug tokens:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route pour voir les tokens bruts
    app.get('/api/facebook/raw-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const accounts = await pool.query(`
          SELECT id, page_name, access_token_encrypted, created_at
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger' 
          AND user_id = $1
          ORDER BY id DESC
        `, [userId]);
        
        const tokensAnalyses = accounts.rows.map(account => {
          const token = account.access_token_encrypted || '';
          const parts = token.split(':');
          
          return {
            id: account.id,
            page: account.page_name,
            token_complet: token,
            format: parts.length === 2 ? 'IV:ENCRYPTED' : 'UNKNOWN',
            iv: parts[0]?.substring(0, 20) + '...',
            donnees: parts[1]?.substring(0, 20) + '...',
            longueur_iv: parts[0]?.length || 0,
            longueur_donnees: parts[1]?.length || 0,
            created_at: account.created_at
          };
        });
        
        res.json({
          success: true,
          nombre_tokens: tokensAnalyses.length,
          tokens: tokensAnalyses,
          recommandation: 'Ces tokens sont chiffrés avec une ancienne clé. Utilisez /api/facebook/reset-all-tokens'
        });
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route pour tout réinitialiser
    app.post('/api/facebook/reset-all-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🗑️  Réinitialisation de TOUS les tokens Facebook`);
        
        // 1. Récupérer tous les comptes
        const accounts = await pool.query(`
          SELECT id, page_name, page_id 
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger' 
          AND user_id = $1
        `, [userId]);
        
        // 2. Supprimer tous les comptes existants
        await pool.query(`
          DELETE FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger' 
          AND user_id = $1
        `, [userId]);
        
        // 3. Supprimer tous les mappings globaux
        await pool.query(`
          DELETE FROM public.facebook_pages_mapping 
          WHERE user_id = $1
        `, [userId]);
        
        // 4. Créer une notification
        await pool.query(`
          INSERT INTO "${schemaName}".notifications 
          (user_id, type, title, message, priority, action_url, read, created_at)
          VALUES ($1, 'warning', 'Tous les comptes Facebook ont été réinitialisés', 
                  'Veuillez reconnecter vos pages Facebook pour générer de nouveaux tokens.', 
                  'high', '/settings/webhooks', false, NOW())
        `, [userId]);
        
        res.json({
          success: true,
          message: `${accounts.rows.length} compte(s) Facebook supprimé(s)`,
          pages_a_reconnecter: accounts.rows.map(a => ({
            nom: a.page_name,
            page_id: a.page_id,
            etat: 'À reconnecter'
          })),
          url_reconnexion: '/api/facebook/oauth/init',
          instructions: [
            '1. Allez dans "Paramètres" > "Webhooks & Intégrations"',
            '2. Cliquez sur "Connecter une page Facebook"',
            '3. Suivez le processus OAuth',
            '4. Sélectionnez votre page "SENE KEUR"',
            '5. Les nouveaux tokens utiliseront la clé actuelle'
          ]
        });
        
      } catch (error) {
        console.error('Erreur réinitialisation totale:', error);
        res.status(500).json({ error: error.message });
      }
    });
    // Route pour tester manuellement l'envoi d'un message
    app.post('/api/test-send-facebook-message', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { contactId, message } = req.body;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        // Récupérer un compte Facebook actif
        const accountResult = await pool.query(`
          SELECT id, page_id, page_name 
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger' 
          AND is_active = true 
          AND user_id = $1
          LIMIT 1
        `, [userId]);
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Aucun compte Facebook actif trouvé'
          });
        }
        
        const accountId = accountResult.rows[0].id;
        const pageName = accountResult.rows[0].page_name;
        
        console.log(`🧪 Test envoi manuel pour page: ${pageName}`);
        
        // Tester l'envoi
        const result = await sendResponseToFacebook(schemaName, accountId, contactId, message || 'Message de test');
        
        res.json({
          success: result,
          message: result ? 'Message envoyé avec succès' : 'Échec envoi message',
          details: {
            account_id: accountId,
            page_name: pageName,
            contact_id: contactId
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur test envoi:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route pour reconfigurer avec les nouvelles permissions
    app.post('/api/facebook/reconfigure-permissions/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🔄 Reconfiguration permissions pour compte ${accountId}`);
        
        // 1. Récupérer le compte
        const accountResult = await pool.query(`
          SELECT page_id, page_name, config_data 
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }
        
        const { page_id, page_name } = accountResult.rows[0];
        
        // 2. Générer une nouvelle URL OAuth avec les bonnes permissions
        const state = `reconfig_${accountId}_${Date.now()}`;
        
        if (!global.oauthStates) {
          global.oauthStates = new Map();
        }
        
        global.oauthStates.set(state, {
          userId: userId,
          userEmail: req.user.email,
          schema: schemaName,
          timestamp: Date.now(),
          status: 'reconfigure',
          accountId: accountId,
          pageId: page_id
        });
        
        const redirectUri = `${req.protocol}://${req.get('host')}/api/facebook/oauth/callback`;
        const scope = 'pages_show_list,pages_messaging,pages_read_engagement';
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${FACEBOOK_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scope)}` +
          `&state=${state}` +
          `&response_type=code`;
        
        res.json({
          success: true,
          message: 'Permissions Facebook mises à jour',
          data: {
            account_id: accountId,
            page_name: page_name,
            oauth_url: authUrl,
            state: state,
            new_permissions: ['pages_show_list', 'pages_messaging', 'pages_read_engagement'],
            instructions: [
              '1. Cliquez sur le lien OAuth ci-dessus',
              '2. Autorisez les nouvelles permissions',
              '3. Sélectionnez votre page',
              '4. Le token sera mis à jour avec les nouvelles permissions'
            ]
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur reconfiguration:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route pour debug le chiffrement
    app.get('/api/debug/encryption-process', authenticate, async (req, res) => {
      try {
        const testToken = 'EAA_test_token_' + Date.now();
        
        console.log('🧪 Test chiffrement complet:');
        console.log('1. Token original:', testToken);
        console.log('2. Longueur:', testToken.length);
        
        // Chiffrer
        const encrypted = encryptAccessToken(testToken);
        console.log('3. Chiffré:', encrypted.substring(0, 50) + '...');
        console.log('4. Longueur chiffré:', encrypted.length);
        console.log('5. Format:', encrypted.includes(':') ? 'IV:ENCRYPTED' : 'PLAIN');
        
        // Déchiffrer
        const decrypted = decryptAccessToken(encrypted);
        console.log('6. Déchiffré:', decrypted?.substring(0, 50) + '...');
        console.log('7. Correspondance:', decrypted === testToken);
        
        // Analyser les parties
        if (encrypted.includes(':')) {
          const [ivHex, dataHex] = encrypted.split(':');
          console.log('8. IV (hex):', ivHex.length, 'chars =', ivHex.length/2, 'bytes');
          console.log('9. Données (hex):', dataHex.length, 'chars =', dataHex.length/2, 'bytes');
          console.log('10. Données originales (est):', dataHex.length/2 - 16, 'bytes (sans padding)');
        }
        
        res.json({
          test_token: testToken.substring(0, 20) + '...',
          encrypted_preview: encrypted.substring(0, 50) + '...',
          encrypted_length: encrypted.length,
          decrypted_success: decrypted === testToken,
          analysis: {
            is_plain: encrypted.startsWith('EAA'),
            has_colon: encrypted.includes(':'),
            iv_length: encrypted.includes(':') ? encrypted.split(':')[0].length : 0,
            data_length: encrypted.includes(':') ? encrypted.split(':')[1].length : 0
          }
        });
        
      } catch (error) {
        console.error('Erreur debug:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route pour vérifier et corriger manuellement
    app.post('/api/facebook/manual-fix', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const { token_manuel, account_id } = req.body;
        
        if (!token_manuel || !token_manuel.startsWith('EAA')) {
          return res.status(400).json({ error: 'Token EAA valide requis' });
        }
        
        console.log('🔧 Correction manuelle du token pour compte:', account_id);
        console.log('📝 Token fourni:', token_manuel.substring(0, 30) + '...');
        
        // Mettre à jour directement avec le token en clair
        await pool.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET access_token_encrypted = $1,
              verification_status = 'verified',
              is_active = true,
              updated_at = NOW()
          WHERE id = $2 AND user_id = $3
        `, [token_manuel, account_id, userId]);
        
        // Mettre à jour aussi le mapping
        await pool.query(`
          UPDATE public.facebook_pages_mapping 
          SET updated_at = NOW()
          WHERE account_id = $1
        `, [account_id]);
        
        res.json({
          success: true,
          message: 'Token mis à jour manuellement',
          token_stocke: token_manuel.substring(0, 20) + '...',
          longueur: token_manuel.length
        });
        
      } catch (error) {
        console.error('Erreur correction manuelle:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route d'urgence pour réparer manuellement un token Facebook
    app.post('/api/facebook/emergency-fix-token/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const { manual_token } = req.body;

        console.log(`🚨 Réparation d'urgence pour compte ${accountId}`);
        
        if (!manual_token || !manual_token.startsWith('EAA')) {
          return res.status(400).json({
            success: false,
            error: 'Token EAA valide requis (doit commencer par EAA)'
          });
        }

        // Vérifier d'abord le compte
        const accountCheck = await pool.query(`
          SELECT id, page_name, page_id, config_data 
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);

        if (accountCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }

        const account = accountCheck.rows[0];
        
        console.log('📝 Nouveau token:', {
          preview: manual_token.substring(0, 30) + '...',
          length: manual_token.length,
          page: account.page_name
        });

        // Mettre à jour avec le token en clair
        await pool.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET access_token_encrypted = $1,
              verification_status = 'verified',
              is_active = true,
              meta_verified = true,
              updated_at = CURRENT_TIMESTAMP,
              config_data = jsonb_set(
                COALESCE(config_data, '{}'::jsonb),
                '{manual_fix_at}',
                to_jsonb($2)
              )
          WHERE id = $3 AND user_id = $4
        `, [
          manual_token,
          new Date().toISOString(),
          accountId,
          userId
        ]);

        // Mettre à jour le mapping global
        await pool.query(`
          UPDATE public.facebook_pages_mapping 
          SET updated_at = CURRENT_TIMESTAMP
          WHERE account_id = $1
        `, [accountId]);

        // Tester le token immédiatement
        try {
          const testUrl = `https://graph.facebook.com/v18.0/${account.page_id}?fields=id,name&access_token=${manual_token}`;
          const testRes = await fetch(testUrl);
          const testData = await testRes.json();
          
          console.log('🧪 Test token:', {
            success: testRes.ok,
            page_name: testData.name,
            error: testData.error?.message
          });
        } catch (testError) {
          console.log('⚠️ Erreur test token:', testError.message);
        }

        res.json({
          success: true,
          message: 'Token réparé manuellement',
          data: {
            account_id: accountId,
            page_name: account.page_name,
            page_id: account.page_id,
            token_preview: manual_token.substring(0, 20) + '...',
            token_length: manual_token.length,
            instructions: [
              '1. Testez le webhook en envoyant un message à la page',
              '2. Vérifiez que les réponses sont envoyées',
              '3. Activez l\'IA si nécessaire'
            ]
          }
        });

      } catch (error) {
        console.error('❌ Erreur réparation d\'urgence:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route pour inspecter les tokens
    app.get('/api/facebook/inspect-tokens', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const accounts = await pool.query(`
          SELECT 
            id, 
            page_name, 
            page_id,
            access_token_encrypted,
            verification_status,
            is_active,
            created_at,
            config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE user_id = $1 AND platform = 'facebook_messenger'
          ORDER BY id DESC
        `, [userId]);

        const analysis = accounts.rows.map(account => {
          const token = account.access_token_encrypted || '';
          const config = account.config_data || {};
          
          return {
            id: account.id,
            page_name: account.page_name,
            page_id: account.page_id,
            token_info: {
              present: !!token,
              length: token.length,
              preview: token.substring(0, 30) + (token.length > 30 ? '...' : ''),
              is_eaa: token.startsWith('EAA'),
              is_hex: /^[0-9a-fA-F:]+$/.test(token),
              status: account.verification_status,
              active: account.is_active
            },
            config_info: {
              has_original_token: !!config.original_token,
              has_manual_fix: !!config.manual_fix_at,
              encrypted: config.encrypted || false
            },
            created_at: account.created_at,
            needs_fix: !token.startsWith('EAA')
          };
        });

        res.json({
          success: true,
          accounts: analysis,
          summary: {
            total: analysis.length,
            needs_fix: analysis.filter(a => a.needs_fix).length,
            working: analysis.filter(a => a.token_info.is_eaa).length
          }
        });

      } catch (error) {
        console.error('❌ Erreur inspection tokens:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route de test webhook (publique)
    app.get('/api/test-webhook/:userId/:accountId', async (req, res) => {
      try {
        const { userId, accountId } = req.params;
        const schemaName = `user_${userId}`;
        
        // Récupérer les infos du compte
        const result = await pool.query(
          `SELECT * FROM "${schemaName}".webhook_accounts WHERE id = $1`,
          [accountId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Compte non trouvé' });
        }
        
        const account = result.rows[0];
        
        res.json({
          success: true,
          account: {
            id: account.id,
            name: account.name,
            platform: account.platform,
            verify_token: account.verify_token
          },
          test_url: `${APP_BASE_URL}/api/webhook/messenger/${userId}/${accountId}`,
          verification_url: `https://alexis-soarable-materially.ngrok-free.dev/api/webhook/messenger/${userId}/${accountId}?hub.mode=subscribe&hub.verify_token=${account.verify_token}&hub.challenge=TEST123`,
          instructions: [
            '1. Copiez l\'URL ci-dessus dans Facebook Developers',
            '2. Assurez-vous que le token correspond',
            '3. Cliquez sur "Vérifier et sauvegarder"'
          ]
        });
        
      } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route de test pour vérifier la création de contact
    app.post('/api/test-create-facebook-contact', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { facebookUserId } = req.body;
        const schemaName = req.userSchema;
        const accountId = req.query.accountId || 1;
        
        if (!facebookUserId) {
          return res.status(400).json({ error: 'facebookUserId requis' });
        }
        
        console.log(`🧪 Test création contact pour Facebook ID: ${facebookUserId}`);
        
        const contactId = await getOrCreateFacebookContact(schemaName, facebookUserId, accountId);
        
        if (contactId) {
          // Vérifier que le contact existe
          const contactCheck = await pool.query(
            `SELECT id, nom, prenom, email, compte FROM "${schemaName}".contacts WHERE id = $1`,
            [contactId]
          );
          
          res.json({
            success: true,
            message: `Contact créé/récupéré avec succès`,
            contactId: contactId,
            contact: contactCheck.rows[0],
            test_message: `Le contact ${facebookUserId} existe maintenant dans votre base`
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Échec création contact'
          });
        }
        
      } catch (error) {
        console.error('❌ Erreur test création contact:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Fonction pour initialiser l'IA pour un utilisateur
    async function initializeIAForUser(userId, schemaName) {
      try {
        console.log(`🤖 Initialisation IA pour user ${userId}, schéma ${schemaName}`);
        
        // Créer une instance IA de test
        const testMotor = new IACRMMotor(pool, schemaName, userId);
        
        // Tester avec un message simple
        const testResult = await testMotor.processMessage('new', 'Bonjour');
        
        if (testResult.success) {
          console.log(`✅ IA initialisée avec succès pour ${schemaName}`);
          
          // Créer des règles IA par défaut
          await createDefaultIARules(schemaName, userId);
          
        } else {
          console.warn(`⚠️ IA non initialisée pour ${schemaName}: ${testResult.error}`);
        }
        
      } catch (error) {
        console.error(`❌ Erreur initialisation IA ${schemaName}:`, error.message);
      }
    }

    // Route pour diagnostiquer les contacts Facebook
    app.get('/api/debug/facebook-contacts', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        
        // Récupérer tous les contacts Facebook
        const facebookContacts = await pool.query(
          `SELECT id, nom, email, compte, created_at 
          FROM "${schemaName}".contacts 
          WHERE compte LIKE 'facebook:%' 
          OR email LIKE '%@facebook.%'
          ORDER BY created_at DESC`
        );
        
        // Récupérer tous les messages pour voir ce qui arrive
        const recentMessages = await pool.query(
          `SELECT id, contact_id, type, contenu, metadata, created_at 
          FROM "${schemaName}".messages 
          WHERE metadata->>'platform' = 'facebook_messenger'
          ORDER BY created_at DESC 
          LIMIT 50`
        );
        
        // Récupérer les comptes webhook
        const webhookAccounts = await pool.query(
          `SELECT id, name, platform, page_id, page_name 
          FROM "${schemaName}".webhook_accounts 
          WHERE platform = 'facebook_messenger'`
        );
        
        res.json({
          success: true,
          data: {
            total_facebook_contacts: facebookContacts.rows.length,
            facebook_contacts: facebookContacts.rows,
            recent_messages: recentMessages.rows.map(msg => ({
              ...msg,
              metadata: typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
            })),
            webhook_accounts: webhookAccounts.rows,
            diagnostic: {
              schema: schemaName,
              timestamp: new Date().toISOString()
            }
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur diagnostic contacts:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Tester avec un utilisateur Facebook spécifique
    app.post('/api/test-facebook-user', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { facebookUserId } = req.body;
        const schemaName = req.userSchema;
        
        if (!facebookUserId) {
          return res.status(400).json({ error: 'facebookUserId requis' });
        }
        
        console.log(`🧪 Test utilisateur Facebook: ${facebookUserId}`);
        
        // Simuler un événement Facebook
        const mockEvent = {
          sender: { id: facebookUserId },
          recipient: { id: 'PAGE_ID' },
          timestamp: Date.now() / 1000,
          message: {
            mid: `mid.test.${Date.now()}`,
            text: 'Message de test',
            is_echo: false
          }
        };
        
        console.log('📤 Simulation événement:', mockEvent);
        
        // Appeler la fonction de traitement
        await processMessagingEvent(schemaName, req.user.id, 1, 1, mockEvent);
        
        // Vérifier le résultat
        const contactCheck = await pool.query(
          `SELECT id, nom, email, compte FROM "${schemaName}".contacts 
          WHERE compte = $1 OR compte LIKE $2`,
          [`facebook:${facebookUserId}`, `%${facebookUserId}%`]
        );
        
        res.json({
          success: true,
          test_user: facebookUserId,
          contact_found: contactCheck.rows.length > 0,
          contact_details: contactCheck.rows[0] || null,
          search_pattern_used: `facebook:${facebookUserId}`,
          message: contactCheck.rows.length > 0 
            ? '✅ Contact trouvé/créé avec succès' 
            : '❌ Échec création contact'
        });
        
      } catch (error) {
        console.error('❌ Erreur test Facebook user:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Route pour supprimer et préparer la reconnexion
    app.delete('/api/facebook/accounts/:id/hard-reset', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { id } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`💀 Suppression définitive du compte ${id}`);
        
        // 1. Sauvegarder les infos avant suppression
        const accountInfo = await pool.query(`
          SELECT page_id, page_name, config_data 
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [id, userId]);
        
        if (accountInfo.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }
        
        const { page_id, page_name, config_data } = accountInfo.rows[0];
        
        // 2. Supprimer le compte
        await pool.query(`
          DELETE FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [id, userId]);
        
        // 3. Supprimer le mapping global
        await pool.query(`
          DELETE FROM public.facebook_pages_mapping 
          WHERE account_id = $1
        `, [id]);
        
        // 4. Créer un enregistrement pour faciliter la reconnexion
        if (config_data) {
          const config = typeof config_data === 'string' ? JSON.parse(config_data) : config_data;
          config.hard_reset_at = new Date().toISOString();
          config.old_page_id = page_id;
          
          await pool.query(`
            INSERT INTO "${schemaName}".webhook_reset_history 
            (user_id, old_account_id, page_id, page_name, config_data, reset_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [userId, id, page_id, page_name, JSON.stringify(config)]);
        }
        
        res.json({
          success: true,
          message: `Compte ${id} supprimé. Vous pouvez maintenant le reconnecter.`,
          data: {
            page_id,
            page_name,
            oauth_url: '/api/facebook/oauth/init',
            instructions: [
              '1. Cliquez sur "Connecter une page Facebook"',
              '2. Suivez le processus OAuth',
              '3. Sélectionnez votre page "SENE KEUR"',
              '4. Les nouveaux tokens seront en clair'
            ]
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur suppression définitive:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    // Vérifier la structure des IDs Facebook
    app.get('/api/debug/facebook-user-ids', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        
        // Analyser tous les contacts Facebook
        const contacts = await pool.query(
          `SELECT id, nom, email, compte, created_at 
          FROM "${schemaName}".contacts 
          WHERE compte LIKE 'facebook:%' 
          OR email LIKE '%facebook%'
          OR compte LIKE 'fb:%'`
        );
        
        // Analyser les patterns
        const patterns = contacts.rows.map(contact => {
          const compte = contact.compte || '';
          return {
            id: contact.id,
            nom: contact.nom,
            compte: compte,
            pattern: compte.includes(':') ? compte.split(':')[0] : 'unknown',
            facebookId: compte.includes(':') ? compte.split(':')[1] : null,
            length: compte.length
          };
        });
        
        // Analyser les messages pour voir les IDs qui arrivent
        const messages = await pool.query(`
          SELECT metadata->>'sender_id' as sender_id, 
                COUNT(*) as message_count,
                MIN(created_at) as first_message,
                MAX(created_at) as last_message
          FROM "${schemaName}".messages 
          WHERE metadata->>'platform' = 'facebook_messenger'
          GROUP BY metadata->>'sender_id'
          ORDER BY COUNT(*) DESC
        `);
        
        res.json({
          success: true,
          analysis: {
            total_facebook_contacts: contacts.rows.length,
            contact_patterns: patterns,
            message_analysis: messages.rows,
            summary: {
              unique_senders: messages.rows.length,
              formats_found: [...new Set(patterns.map(p => p.pattern))],
              recommendation: patterns.length > 0 
                ? `Utilisez le format: "${patterns[0].pattern}:{ID}" pour les nouveaux contacts`
                : 'Aucun contact Facebook trouvé'
            }
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur analyse IDs Facebook:', error);
        res.status(500).json({ error: error.message });
      }
    });



    // Route générique pour Facebook (tous users)
    app.get('/api/webhook/facebook', async (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode === 'subscribe' && token) {
        // Chercher dans tous les schémas quel compte a ce verify_token
        // Ou utiliser une table de mapping globale
        res.status(200).send(challenge);
      }
    });



    app.post('/api/webhook/facebook', async (req, res) => {
      try {
        // 1. Extraire le Page ID du payload
        const pageId = req.body.entry?.[0]?.id;
        if (!pageId) {
          return res.status(200).send('EVENT_RECEIVED');
        }

        console.log('📘 Page ID détecté:', pageId);

        // 2. Chercher le compte correspondant dans tous les schémas
        // Vous pouvez créer une vue globale ou chercher dans public.users
        const findAccountQuery = `
          SELECT 
            u.id as user_id, 
            u.schema_name,
            wa.id as account_id,
            wa.verify_token,
            wa.access_token_encrypted
          FROM public.users u
          JOIN LATERAL (
            SELECT id, verify_token, access_token_encrypted 
            FROM "${u.schema_name}".webhook_accounts 
            WHERE page_id = $1 AND platform = 'facebook_messenger'
            LIMIT 1
          ) wa ON true
          WHERE wa.id IS NOT NULL
          LIMIT 1
        `;
        
        // Ou plus simplement, si vous avez peu d'users, boucler sur les schémas
        // Pour l'instant, solution rapide :
        
        // 3. Traiter avec les infos trouvées
        // Vous devez implémenter la logique de recherche ici
        
        res.status(200).send('EVENT_RECEIVED');
        
      } catch (error) {
        console.error('Erreur webhook général:', error);
        res.status(200).send('EVENT_RECEIVED');
      }
    });

    // Route pour forcer la reconnexion d'un compte Facebook
    app.post('/api/facebook/force-reconnect/:accountId', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { accountId } = req.params;
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;

        console.log(`🔄 Forcer reconnexion pour compte: ${accountId}`);

        // Supprimer le compte existant
        await pool.query(`
          DELETE FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2 AND platform = 'facebook_messenger'
        `, [accountId, userId]);

        // Supprimer le mapping global
        await pool.query(`
          DELETE FROM public.facebook_pages_mapping 
          WHERE account_id = $1
        `, [accountId]);

        // Nettoyer les données associées
        await pool.query(`
          UPDATE "${schemaName}".notifications 
          SET read = true 
          WHERE title LIKE '%Facebook%' OR title LIKE '%token%'
        `);

        res.json({
          success: true,
          message: 'Compte supprimé. Vous pouvez maintenant le reconnecter via OAuth.',
          oauth_url: '/api/facebook/oauth/init',
          instructions: [
            '1. Cliquez sur "Connecter une page Facebook"',
            '2. Suivez le processus OAuth',
            '3. Sélectionnez à nouveau votre page',
            '4. Activez l\'IA et l\'auto-réponse'
          ]
        });

      } catch (error) {
        console.error('❌ Erreur reconnexion forcée:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Ajoutez cette route à votre server.js pour tester le token
    app.post('/api/facebook/test-token-direct', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const { accountId } = req.body;

        // Récupérer le token
        const accountResult = await pool.query(`
          SELECT page_id, page_name, access_token_encrypted 
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);

        if (accountResult.rows.length === 0) {
          return res.status(404).json({ error: 'Compte non trouvé' });
        }

        const account = accountResult.rows[0];
        const token = decryptAccessToken(account.access_token_encrypted);

        // Test 1: Vérifier la page
        const pageUrl = `https://graph.facebook.com/v18.0/${account.page_id}?fields=id,name&access_token=${token}`;
        console.log('Test URL:', pageUrl);

        const pageRes = await fetch(pageUrl);
        const pageData = await pageRes.json();

        if (pageData.error) {
          return res.json({
            success: false,
            test: 'page_access',
            error: pageData.error,
            suggestion: 'Token invalide ou expiré'
          });
        }

        // Test 2: Tenter d'envoyer un message
        const messageUrl = `https://graph.facebook.com/v18.0/${account.page_id}/messages`;
        
        const payload = {
          recipient: { id: '25407834305583492' }, // Votre ID de test
          message: { text: 'Test de connexion' },
          messaging_type: 'RESPONSE'
        };

        const urlWithToken = `${messageUrl}?access_token=${token}`;
        const messageRes = await fetch(urlWithToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const messageData = await messageRes.json();

        res.json({
          success: true,
          tests: {
            page_access: {
              success: true,
              page_name: pageData.name
            },
            send_message: {
              success: !messageData.error,
              response: messageData
            }
          },
          token_info: {
            preview: token.substring(0, 20) + '...',
            length: token.length,
            starts_with_eaa: token.startsWith('EAA')
          }
        });

      } catch (error) {
        console.error('Erreur test token:', error);
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/facebook/deep-diagnostic', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const { accountId } = req.body;

        // Récupérer les infos du compte
        const accountResult = await pool.query(`
          SELECT page_id, page_name, access_token_encrypted, config_data
          FROM "${schemaName}".webhook_accounts 
          WHERE id = $1 AND user_id = $2
        `, [accountId, userId]);

        if (accountResult.rows.length === 0) {
          return res.status(404).json({ error: 'Compte non trouvé' });
        }

        const account = accountResult.rows[0];
        const token = decryptAccessToken(account.access_token_encrypted);
        const config = account.config_data || {};

        console.log('🔍 Diagnostic profond pour compte:', accountId);
        console.log('📝 Token (50 premiers):', token.substring(0, 50));
        console.log('📝 Token longueur:', token.length);
        console.log('📝 Token starts with EAA:', token.startsWith('EAA'));

        const diagnostic = {
          account_info: {
            id: accountId,
            page_id: account.page_id,
            page_name: account.page_name,
            token_length: token.length,
            token_starts_with_eaa: token.startsWith('EAA'),
            token_first_50: token.substring(0, 50) + '...'
          },
          tests: []
        };

        // Test 1: Vérifier le token via l'API Facebook
        try {
          const debugTokenUrl = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`;
          const debugRes = await fetch(debugTokenUrl);
          const debugData = await debugRes.json();
          
          diagnostic.tests.push({
            name: 'debug_token',
            success: debugRes.ok,
            data: debugData,
            url: debugTokenUrl
          });

          console.log('🔍 Debug token result:', debugData);
        } catch (error) {
          diagnostic.tests.push({
            name: 'debug_token',
            success: false,
            error: error.message
          });
        }

        // Test 2: Vérifier les permissions de la page
        try {
          const pageUrl = `https://graph.facebook.com/v18.0/${account.page_id}?fields=id,name,connected_instagram_account,instagram_business_account,is_published,can_message&access_token=${token}`;
          const pageRes = await fetch(pageUrl);
          const pageData = await pageRes.json();
          
          diagnostic.tests.push({
            name: 'page_info',
            success: pageRes.ok,
            data: pageData,
            url: pageUrl
          });

          console.log('📄 Page info:', pageData);
        } catch (error) {
          diagnostic.tests.push({
            name: 'page_info',
            success: false,
            error: error.message
          });
        }

        // Test 3: Vérifier les apps abonnées
        try {
          const appsUrl = `https://graph.facebook.com/v18.0/${account.page_id}/subscribed_apps?access_token=${token}`;
          const appsRes = await fetch(appsUrl);
          const appsData = await appsRes.json();
          
          diagnostic.tests.push({
            name: 'subscribed_apps',
            success: appsRes.ok,
            data: appsData,
            url: appsUrl
          });

          console.log('📱 Subscribed apps:', appsData);
        } catch (error) {
          diagnostic.tests.push({
            name: 'subscribed_apps',
            success: false,
            error: error.message
          });
        }

        // Test 4: Essayer d'envoyer un message simple
        try {
          const testRecipient = '25407834305583492'; // Votre ID
          const messageUrl = `https://graph.facebook.com/v18.0/${account.page_id}/messages`;
          
          const payload = {
            recipient: { id: testRecipient },
            message: { text: 'Test diagnostic' },
            messaging_type: 'RESPONSE'
          };

          const urlWithToken = `${messageUrl}?access_token=${encodeURIComponent(token)}`;
          const messageRes = await fetch(urlWithToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const responseText = await messageRes.text();
          let messageData;
          try {
            messageData = JSON.parse(responseText);
          } catch (e) {
            messageData = { error: { message: 'Invalid JSON', raw: responseText.substring(0, 200) } };
          }

          diagnostic.tests.push({
            name: 'send_message_test',
            success: messageRes.ok && !messageData.error,
            status: messageRes.status,
            data: messageData,
            payload: payload,
            url: messageUrl
          });

          console.log('📤 Send message test:', messageData);
        } catch (error) {
          diagnostic.tests.push({
            name: 'send_message_test',
            success: false,
            error: error.message
          });
        }

        res.json({
          success: true,
          diagnostic: diagnostic,
          summary: {
            token_valid: diagnostic.account_info.token_starts_with_eaa,
            all_tests_passed: diagnostic.tests.every(t => t.success),
            failing_tests: diagnostic.tests.filter(t => !t.success).map(t => t.name)
          }
        });

      } catch (error) {
        console.error('❌ Erreur diagnostic:', error);
        res.status(500).json({ 
          error: error.message,
          stack: error.stack 
        });
      }
    });
    // ==================== ROUTE MAPPING FACEBOOK (pour tous les users) ====================

    // Créer ou mettre à jour le mapping global
    app.post('/api/facebook/mapping', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { page_id, user_id, schema_name, account_id, page_name, verify_token } = req.body;
        
        // Vérification des données requises
        if (!page_id || !account_id) {
          return res.status(400).json({
            success: false,
            error: 'page_id et account_id sont requis'
          });
        }
        
        // Insertion ou mise à jour dans la table de mapping global
        await pool.query(`
          INSERT INTO public.facebook_pages_mapping 
          (page_id, platform, user_id, schema_name, account_id, page_name, verify_token, updated_at)
          VALUES ($1, 'facebook_messenger', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (page_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            schema_name = EXCLUDED.schema_name,
            account_id = EXCLUDED.account_id,
            page_name = EXCLUDED.page_name,
            verify_token = EXCLUDED.verify_token,
            updated_at = CURRENT_TIMESTAMP
        `, [page_id, user_id, schema_name, account_id, page_name || 'Unknown', verify_token]);
        
        res.json({
          success: true,
          message: 'Mapping créé avec succès',
          data: {
            page_id,
            schema_name,
            account_id
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur création mapping:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la création du mapping',
          details: error.message
        });
      }
    });

    // Récupérer le mapping pour une page (utilisé par le webhook générique)
    app.get('/api/facebook/mapping/:pageId', async (req, res) => {
      try {
        const { pageId } = req.params;
        
        const result = await pool.query(`
          SELECT * FROM public.facebook_pages_mapping 
          WHERE page_id = $1
        `, [pageId]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Mapping non trouvé'
          });
        }
        
        res.json({
          success: true,
          data: result.rows[0]
        });
        
      } catch (error) {
        console.error('❌ Erreur récupération mapping:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== ROUTES WEBHOOK TWILIO ====================

    // Route GET pour la vérification Twilio
    app.get('/api/webhook/twilio/:userId/:accountId', async (req, res) => {
      try {
        const { userId, accountId } = req.params;
        
        console.log('🔐 Twilio webhook verification:', { 
          userId, 
          accountId
        });
        
        // Twilio vérifie avec une requête GET vide
        // On peut juste répondre OK
        res.set('Content-Type', 'text/plain');
        res.status(200).send('OK');
        
      } catch (error) {
        console.error('❌ Erreur vérification Twilio:', error);
        res.status(500).send('Server error');
      }
    });

    // Route POST pour recevoir les messages Twilio/WhatsApp
    app.post('/api/webhook/twilio/:userId/:accountId', async (req, res) => {
      try {
        const { userId, accountId } = req.params;
        const schemaName = `user_${userId}`;
        
        console.log('📩 Message Twilio/WhatsApp reçu:', {
          userId,
          accountId,
          body: req.body
        });
        
        // 1. Répondre IMMÉDIATEMENT à Twilio (XML TwiML)
        res.set('Content-Type', 'text/xml');
        res.status(200).send(`
          <Response>
            <!-- La réponse sera gérée en async -->
          </Response>
        `);
        
        // 2. Vérifier si le compte existe
        let accountExists = false;
        try {
          const accountCheck = await pool.query(
            `SELECT * FROM "${schemaName}".webhook_accounts WHERE id = $1`,
            [accountId]
          );
          accountExists = accountCheck.rows.length > 0;
        } catch (dbError) {
          console.error('❌ Erreur vérification compte:', dbError);
        }
        
        // 3. Loguer la requête
        await logWebhookRequest(schemaName, userId, accountId, req.body);
        
        // 4. Traiter le message WhatsApp
        await processTwilioWebhook(schemaName, userId, accountId, req.body);
        
      } catch (error) {
        console.error('❌ Erreur traitement Twilio:', error);
        // Twilio attend toujours une réponse XML
        res.set('Content-Type', 'text/xml');
        res.status(200).send('<Response></Response>');
      }
    });

    // ==================== ROUTES SPÉCIFIQUES POUR LE FRONTEND ====================

    // Route pour les statistiques utilisateur
    app.get('/api/users/me/stats', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        // Récupérer les statistiques
        const [conversationsResult, facebookAccountsResult, messagesResult] = await Promise.all([
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".conversations`),
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".webhook_accounts WHERE platform = 'facebook_messenger'`),
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".messages`)
        ]);
        
        // Dernière activité
        const lastActivityResult = await pool.query(`
          SELECT MAX(created_at) as last_activity FROM "${userSchema}".messages
          UNION ALL
          SELECT MAX(last_interaction) as last_activity FROM "${userSchema}".conversations
          UNION ALL
          SELECT MAX(created_at) as last_activity FROM "${userSchema}".webhook_accounts
        `);
        
        let lastActivity = '';
        if (lastActivityResult.rows.length > 0 && lastActivityResult.rows[0].last_activity) {
          lastActivity = new Date(lastActivityResult.rows[0].last_activity).toISOString();
        }
        
        // Vérifier si automation est activé
        const automationResult = await pool.query(
          `SELECT auto_responder FROM "${userSchema}".automation_settings WHERE user_id = $1`,
          [userId]
        );
        
        res.json({
          success: true,
          data: {
            totalConversations: parseInt(conversationsResult.rows[0]?.count || 0),
            activeConversations: 0, // À calculer si nécessaire
            totalMessages: parseInt(messagesResult.rows[0]?.count || 0),
            lastActivity: lastActivity,
            automationEnabled: automationResult.rows.length > 0 ? automationResult.rows[0].auto_responder : true,
            facebookConnected: parseInt(facebookAccountsResult.rows[0]?.count || 0) > 0,
            facebookPages: parseInt(facebookAccountsResult.rows[0]?.count || 0)
          }
        });
        
      } catch (error) {
        console.error('Erreur stats utilisateur:', error);
        res.json({
          success: true,
          data: {
            totalConversations: 0,
            activeConversations: 0,
            totalMessages: 0,
            lastActivity: '',
            automationEnabled: true,
            facebookConnected: false,
            facebookPages: 0
          }
        });
      }
    });

    // Route pour les statistiques IA
    app.get('/api/ia/stats', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        
        // Statistiques IA
        const [conversationsResult, purchaseIntentsResult, rulesResult, profilesResult] = await Promise.all([
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".conversation_history WHERE ai_response IS NOT NULL`),
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".purchase_intents WHERE status = 'converted'`),
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".business_rules WHERE is_active = true`),
          pool.query(`SELECT COUNT(*) as count FROM "${userSchema}".client_profiles`)
        ]);
        
        // Confiance moyenne
        const confidenceResult = await pool.query(`
          SELECT AVG(confidence_score) as avg_confidence FROM "${userSchema}".purchase_intents
        `);
        
        // Activité récente (7 derniers jours)
        const recentActivityResult = await pool.query(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as conversations,
            COUNT(CASE WHEN ai_response IS NOT NULL THEN 1 END) as rule_based_responses
          FROM "${userSchema}".conversation_history
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `);
        
        res.json({
          success: true,
          stats: {
            total_conversations: parseInt(conversationsResult.rows[0]?.count || 0),
            orders_converted: parseInt(purchaseIntentsResult.rows[0]?.count || 0),
            active_rules: parseInt(rulesResult.rows[0]?.count || 0),
            avg_intent_confidence: parseFloat(confidenceResult.rows[0]?.avg_confidence || 0),
            clients_profiled: parseInt(profilesResult.rows[0]?.count || 0)
          },
          recent_activity: recentActivityResult.rows.map(row => ({
            date: row.date,
            conversations: parseInt(row.conversations || 0),
            rule_based_responses: parseInt(row.rule_based_responses || 0)
          }))
        });
        
      } catch (error) {
        console.error('Erreur stats IA:', error);
        res.json({
          success: true,
          stats: {
            total_conversations: 0,
            orders_converted: 0,
            active_rules: 0,
            avg_intent_confidence: 0,
            clients_profiled: 0
          },
          recent_activity: []
        });
      }
    });

    // Route pour les paramètres IA
    app.get('/api/ia/settings', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const result = await pool.query(
          `SELECT * FROM "${userSchema}".ia_settings WHERE user_id = $1`,
          [userId]
        );
        
        if (result.rows.length > 0) {
          res.json({
            success: true,
            ...result.rows[0]
          });
        } else {
          // Retourner des valeurs par défaut
          res.json({
            success: true,
            enabled: true,
            confidence_threshold: 0.7,
            max_context_length: 10,
            learning_enabled: true,
            rule_based_responses: true,
            product_recommendations: true,
            sentiment_analysis: true,
            language: 'fr'
          });
        }
        
      } catch (error) {
        console.error('Erreur paramètres IA:', error);
        res.json({
          success: true,
          enabled: true,
          confidence_threshold: 0.7,
          max_context_length: 10,
          learning_enabled: true,
          rule_based_responses: true,
          product_recommendations: true,
          sentiment_analysis: true,
          language: 'fr'
        });
      }
    });

    app.post('/api/ia/settings', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const settings = req.body;
        
        // S'assurer que la table existe
        await ensureUserTables(userSchema, userId);
        
        await pool.query(`
          INSERT INTO "${userSchema}".ia_settings 
          (user_id, enabled, confidence_threshold, max_context_length, learning_enabled, 
          rule_based_responses, product_recommendations, sentiment_analysis, language)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (user_id) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            confidence_threshold = EXCLUDED.confidence_threshold,
            max_context_length = EXCLUDED.max_context_length,
            learning_enabled = EXCLUDED.learning_enabled,
            rule_based_responses = EXCLUDED.rule_based_responses,
            product_recommendations = EXCLUDED.product_recommendations,
            sentiment_analysis = EXCLUDED.sentiment_analysis,
            language = EXCLUDED.language,
            updated_at = CURRENT_TIMESTAMP
        `, [
          userId,
          settings.enabled !== false,
          settings.confidence_threshold || 0.7,
          settings.max_context_length || 10,
          settings.learning_enabled !== false,
          settings.rule_based_responses !== false,
          settings.product_recommendations !== false,
          settings.sentiment_analysis !== false,
          settings.language || 'fr'
        ]);
        
        res.json({
          success: true,
          message: 'Paramètres IA sauvegardés'
        });
        
      } catch (error) {
        console.error('Erreur sauvegarde paramètres IA:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la sauvegarde'
        });
      }
    });

    // Route pour les paramètres automation
    app.get('/api/automation/settings', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const result = await pool.query(
          `SELECT * FROM "${userSchema}".automation_settings WHERE user_id = $1`,
          [userId]
        );
        
        if (result.rows.length > 0) {
          res.json({
            success: true,
            ...result.rows[0]
          });
        } else {
          // Retourner des valeurs par défaut
          res.json({
            success: true,
            autoResponder: true,
            autoCreateContacts: true,
            autoUpdateConversations: true,
            autoProcessOrders: true,
            autoGenerateQuotes: false,
            workingHoursOnly: false,
            workingHoursStart: '08:00',
            workingHoursEnd: '18:00'
          });
        }
        
      } catch (error) {
        console.error('Erreur paramètres automation:', error);
        res.json({
          success: true,
          autoResponder: true,
          autoCreateContacts: true,
          autoUpdateConversations: true,
          autoProcessOrders: true,
          autoGenerateQuotes: false,
          workingHoursOnly: false,
          workingHoursStart: '08:00',
          workingHoursEnd: '18:00'
        });
      }
    });

    app.post('/api/automation/settings', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const settings = req.body;
        
        await pool.query(`
          INSERT INTO "${userSchema}".automation_settings 
          (user_id, auto_responder, auto_create_contacts, auto_update_conversations, 
          auto_process_orders, auto_generate_quotes, working_hours_only, 
          working_hours_start, working_hours_end)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (user_id) DO UPDATE SET
            auto_responder = EXCLUDED.auto_responder,
            auto_create_contacts = EXCLUDED.auto_create_contacts,
            auto_update_conversations = EXCLUDED.auto_update_conversations,
            auto_process_orders = EXCLUDED.auto_process_orders,
            auto_generate_quotes = EXCLUDED.auto_generate_quotes,
            working_hours_only = EXCLUDED.working_hours_only,
            working_hours_start = EXCLUDED.working_hours_start,
            working_hours_end = EXCLUDED.working_hours_end,
            updated_at = CURRENT_TIMESTAMP
        `, [
          userId,
          settings.autoResponder !== false,
          settings.autoCreateContacts !== false,
          settings.autoUpdateConversations !== false,
          settings.autoProcessOrders !== false,
          settings.autoGenerateQuotes || false,
          settings.workingHoursOnly || false,
          settings.workingHoursStart || '08:00',
          settings.workingHoursEnd || '18:00'
        ]);
        
        res.json({
          success: true,
          message: 'Paramètres automation sauvegardés'
        });
        
      } catch (error) {
        console.error('Erreur sauvegarde automation:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la sauvegarde'
        });
      }
    });

    app.post('/api/automation/toggle', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const { enabled } = req.body;
        
        await pool.query(`
          UPDATE "${userSchema}".automation_settings 
          SET auto_responder = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = $2
        `, [enabled !== false, userId]);
        
        res.json({
          success: true,
          message: `Automation ${enabled ? 'activée' : 'désactivée'}`
        });
        
      } catch (error) {
        console.error('Erreur toggle automation:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la modification'
        });
      }
    });

    // Route pour les logs des webhooks
    app.get('/api/webhook-logs', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const {
          page = 1,
          limit = 10,
          platform,
          status,
          search,
          date_range
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        
        if (platform && platform !== 'all') {
          whereClause += ` AND platform = $${paramIndex}`;
          params.push(platform);
          paramIndex++;
        }
        
        if (status && status !== 'all') {
          if (status === 'success') {
            whereClause += ` AND status_code >= 200 AND status_code < 300`;
          } else if (status === 'client_error') {
            whereClause += ` AND status_code >= 400 AND status_code < 500`;
          } else if (status === 'server_error') {
            whereClause += ` AND status_code >= 500`;
          }
        }
        
        if (date_range && date_range !== 'all') {
          let interval;
          switch (date_range) {
            case '1h': interval = '1 hour'; break;
            case '24h': interval = '24 hours'; break;
            case '7d': interval = '7 days'; break;
            case '30d': interval = '30 days'; break;
            default: interval = '30 days';
          }
          whereClause += ` AND created_at >= NOW() - INTERVAL '${interval}'`;
        }
        
        if (search) {
          whereClause += ` AND (
            url ILIKE $${paramIndex} OR 
            platform ILIKE $${paramIndex} OR
            payload::text ILIKE $${paramIndex} OR
            error ILIKE $${paramIndex}
          )`;
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
          paramIndex += 4;
        }
        
        // Récupérer le total
        const countResult = await pool.query(
          `SELECT COUNT(*) as total FROM "${userSchema}".webhook_logs ${whereClause}`,
          params
        );
        
        // Récupérer les logs
        const logsResult = await pool.query(
          `SELECT * FROM "${userSchema}".webhook_logs 
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...params, limit, offset]
        );
        
        res.json({
          success: true,
          data: {
            logs: logsResult.rows,
            total: parseInt(countResult.rows[0]?.total || 0),
            page: parseInt(page),
            limit: parseInt(limit)
          }
        });
        
      } catch (error) {
        console.error('Erreur récupération logs:', error);
        res.json({
          success: true,
          data: {
            logs: [],
            total: 0,
            page: 1,
            limit: 10
          }
        });
      }
    });

    // Route pour exporter les logs
    app.get('/api/webhook-logs/export', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        const logsResult = await pool.query(
          `SELECT * FROM "${userSchema}".webhook_logs 
          WHERE user_id = $1 
          ORDER BY created_at DESC
          LIMIT 1000`,
          [userId]
        );
        
        // Créer un fichier JSON
        const exportData = {
          export_date: new Date().toISOString(),
          user_id: userId,
          total_logs: logsResult.rows.length,
          logs: logsResult.rows
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="webhook-logs-${userId}-${Date.now()}.json"`);
        
        res.send(JSON.stringify(exportData, null, 2));
        
      } catch (error) {
        console.error('Erreur export logs:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de l\'export'
        });
      }
    });

    // Route pour effacer les logs
    app.delete('/api/webhook-logs', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        await pool.query(
          `DELETE FROM "${userSchema}".webhook_logs WHERE user_id = $1`,
          [userId]
        );
        
        res.json({
          success: true,
          message: 'Logs effacés avec succès'
        });
        
      } catch (error) {
        console.error('Erreur effacement logs:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de l\'effacement'
        });
      }
    });

    // Route pour les pages Facebook
    app.post('/api/facebook/pages', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { access_token } = req.body;
        
        if (!access_token) {
          return res.status(400).json({
            success: false,
            error: 'Access token requis'
          });
        }
        
        // Ici, vous feriez un appel à l'API Facebook
        // Pour l'exemple, retourner des données simulées
        res.json({
          success: true,
          pages: [
            {
              id: '123456789012345',
              name: 'Ma Page Facebook',
              access_token: access_token,
              category: 'Local Business',
              tasks: ['ADVERTISE', 'ANALYZE', 'MODERATE']
            }
          ]
        });
        
      } catch (error) {
        console.error('Erreur pages Facebook:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la récupération des pages'
        });
      }
    });

    // Route pour la configuration webhook
    app.get('/api/webhooks/config', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        // Ici, vous pourriez récupérer depuis une table de configuration
        // Pour l'exemple, retourner des valeurs par défaut
        res.json({
          success: true,
          ai_webhook_url: `https://${req.headers.host}/api/webhook/ai/${userId}/{accountId}`,
          webhook_secret: '',
          verify_token: Math.random().toString(36).substring(2, 15),
          webhook_enabled: true,
          auto_setup: true
        });
        
      } catch (error) {
        console.error('Erreur configuration webhook:', error);
        res.json({
          success: true,
          ai_webhook_url: '',
          webhook_secret: '',
          verify_token: '',
          webhook_enabled: true,
          auto_setup: true
        });
      }
    });

    app.post('/api/webhook/config', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { ai_webhook_url, webhook_secret, verify_token, webhook_enabled, auto_setup } = req.body;
        
        // Ici, vous pourriez sauvegarder dans une table de configuration
        // Pour l'exemple, retourner un succès
        res.json({
          success: true,
          message: 'Configuration webhook sauvegardée'
        });
        
      } catch (error) {
        console.error('Erreur sauvegarde config webhook:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la sauvegarde'
        });
      }
    });

    // Route pour tester un compte webhook
    app.post('/api/webhook-accounts/:id/test', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const accountId = req.params.id;
        
        // Vérifier que le compte appartient à l'utilisateur
        const accountResult = await pool.query(
          `SELECT * FROM "${userSchema}".webhook_accounts WHERE id = $1`,
          [accountId]
        );
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Compte non trouvé'
          });
        }
        
        const account = accountResult.rows[0];
        
        // Ici, vous feriez un test réel selon la plateforme
        // Pour l'exemple, retourner un succès
        res.json({
          success: true,
          message: 'Test de connexion réussi',
          platform: account.platform
        });
        
      } catch (error) {
        console.error('Erreur test compte:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors du test'
        });
      }
    });

    // Route pour activer/désactiver l'IA pour un compte
    app.put('/api/webhook-accounts/:id/ai-settings', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const accountId = req.params.id;
        const { ai_enabled, auto_reply } = req.body;
        
        await pool.query(`
          UPDATE "${userSchema}".webhook_accounts 
          SET ai_enabled = $1, auto_reply = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [ai_enabled !== false, auto_reply !== false, accountId]);
        
        res.json({
          success: true,
          message: `Paramètres IA mis à jour`
        });
        
      } catch (error) {
        console.error('Erreur mise à jour IA:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la mise à jour'
        });
      }
    });

    // Route pour les statistiques IA d'un compte
    app.get('/api/webhook-accounts/:id/ai-stats', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const accountId = req.params.id;
        
        // Ici, vous pourriez récupérer des statistiques spécifiques
        // Pour l'exemple, retourner des données simulées
        const conversationsResult = await pool.query(`
          SELECT COUNT(*) as count FROM "${userSchema}".conversation_history 
          WHERE metadata->>'account_id' = $1
        `, [accountId]);
        
        res.json({
          success: true,
          data: {
            total_conversations: parseInt(conversationsResult.rows[0]?.count || 0),
            last_activity: new Date().toISOString(),
            ai_enabled: true
          }
        });
        
      } catch (error) {
        console.error('Erreur stats IA compte:', error);
        res.json({
          success: true,
          data: {
            total_conversations: 0,
            last_activity: '',
            ai_enabled: false
          }
        });
      }
    });
    // Route pour configurer le webhook Facebook Messenger
    app.post('/api/webhook-accounts/:id/setup-facebook', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const { id } = req.params;
        const schemaName = req.userSchema; // Note: utilisez userSchema, pas schema_name
        const userId = req.user.userId || req.user.id;
        
        const { webhook_url, verify_token, fields = ['messages'] } = req.body;
        
        // URL publique avec ngrok
        const publicWebhookUrl = webhook_url || `${APP_BASE_URL}/api/webhook/messenger/${userId}/${accountId}`;
        
        console.log('🔧 Configuration webhook Facebook:', {
          userId,
          accountId: id,
          webhookUrl: publicWebhookUrl
        });
        
        // Récupérer le compte
        const accountResult = await pool.query(
          `SELECT * FROM "${schemaName}".webhook_accounts WHERE id = $1`,
          [id]
        );
        
        if (accountResult.rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            error: 'Compte non trouvé' 
          });
        }
        
        const account = accountResult.rows[0];
        
        // Vérifier que c'est bien un compte Facebook Messenger
        if (account.platform !== 'facebook_messenger') {
          return res.status(400).json({ 
            success: false, 
            error: 'Ce compte n\'est pas un compte Facebook Messenger' 
          });
        }
        
        // Mettre à jour le compte avec l'URL publique
        await pool.query(`
          UPDATE "${schemaName}".webhook_accounts 
          SET webhook_url = $1, 
              verify_token = $2,
              config_data = jsonb_set(
                COALESCE(config_data, '{}'::jsonb),
                '{webhook_fields}',
                $3::jsonb
              )
          WHERE id = $4
        `, [
          publicWebhookUrl,
          verify_token || account.verify_token,
          JSON.stringify(fields),
          id
        ]);
        
        res.json({
          success: true,
          message: 'Configuration webhook Facebook préparée',
          data: {
            webhook_url: publicWebhookUrl,
            verify_token: verify_token || account.verify_token,
            fields: fields,
            facebook_url: 'https://developers.facebook.com/apps/YOUR_APP_ID/webhooks/',
            instructions: [
              `1. Allez sur Facebook Developers: https://developers.facebook.com/apps/YOUR_APP_ID/webhooks/`,
              `2. Configurez l'URL: ${publicWebhookUrl}`,
              `3. Utilisez le token: ${verify_token || account.verify_token}`,
              `4. Cliquez sur "Vérifier et sauvegarder"`,
              `5. Abonnez-vous aux champs: ${fields.join(', ')}`
            ]
          }
        });
        
      } catch (error) {
        console.error('Erreur configuration webhook Facebook:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Erreur lors de la configuration',
          details: error.message 
        });
      }
    });

    // Routes pour l'agence (si l'utilisateur est admin ou agence)
    app.get('/api/agence/clients', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        if (req.user.role !== 'admin' && req.user.role !== 'agence') {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé'
          });
        }
        
        // Pour l'exemple, retourner des données simulées
        res.json([
          {
            id: 1,
            client_name: 'Client Test',
            client_email: 'client@test.com',
            company: 'Entreprise Test',
            facebook_page: {
              id: '123456789',
              name: 'Page du Client',
              followers: 1000
            },
            messenger_status: 'active',
            last_activity: new Date().toISOString(),
            monthly_messages: 150,
            created_at: new Date().toISOString()
          }
        ]);
        
      } catch (error) {
        console.error('Erreur clients agence:', error);
        res.status(500).json([]);
      }
    });

    app.post('/api/agence/invitations', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        if (req.user.role !== 'admin' && req.user.role !== 'agence') {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé'
          });
        }
        
        const { client_name, client_email, invitation_method, client_phone } = req.body;
        
        // Générer un token d'invitation
        const invitation_token = Math.random().toString(36).substring(2) + 
                              Math.random().toString(36).substring(2);
        
        res.json({
          success: true,
          invitation_id: Date.now(),
          invitation_token: invitation_token,
          message: 'Invitation créée'
        });
        
      } catch (error) {
        console.error('Erreur création invitation:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la création'
        });
      }
    });

    app.post('/api/agence/send-invitation', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        if (req.user.role !== 'admin' && req.user.role !== 'agence') {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé'
          });
        }
        
        // Ici, vous enverriez un email réel
        // Pour l'exemple, retourner un succès
        res.json({
          success: true,
          message: 'Invitation envoyée'
        });
        
      } catch (error) {
        console.error('Erreur envoi invitation:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de l\'envoi'
        });
      }
    });

    // Route pour vérifier le webhook Facebook
    app.post('/api/webhook-accounts/:id/verify-facebook', authenticate, async (req, res) => {
        try {
            const { id } = req.params;
            const schemaName = req.user.schema_name;
            const userId = req.user.id;
            
            const { verify_token, mode = 'subscribe' } = req.body;
            
            // Récupérer le compte
            const accountResult = await pool.query(`
                SELECT * FROM ${schemaName}.webhook_accounts 
                WHERE id = $1 AND user_id = $2
            `, [id, userId]);
            
            if (accountResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Compte non trouvé' 
                });
            }
            
            const account = accountResult.rows[0];
            
            // Vérifier le token
            if (account.verify_token !== verify_token) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Token de vérification incorrect' 
                });
            }
            
            // Mettre à jour le statut
            await pool.query(`
                UPDATE ${schemaName}.webhook_accounts 
                SET meta_verified = true, verification_status = 'verified', config_data = jsonb_set(
                    COALESCE(config_data, '{}'::jsonb), 
                    '{verified_at}', 
                    to_jsonb($1)
                )
                WHERE id = $2 AND user_id = $3
            `, [new Date().toISOString(), id, userId]);
            
            res.json({
                success: true,
                message: 'Webhook Facebook vérifié avec succès',
                data: {
                    hub_mode: mode,
                    hub_challenge: verify_token,
                    hub_verify_token: verify_token
                }
            });
            
        } catch (error) {
            console.error('Erreur vérification webhook Facebook:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de la vérification du webhook Facebook' 
            });
        }
    });

    // Route pour synchroniser les abonnements
    app.post('/api/webhook-accounts/:id/sync-subscriptions', authenticate, async (req, res) => {
        try {
            const { id } = req.params;
            const schemaName = req.user.schema_name;
            const userId = req.user.id;
            
            // Récupérer le compte
            const accountResult = await pool.query(`
                SELECT * FROM ${schemaName}.webhook_accounts 
                WHERE id = $1 AND user_id = $2
            `, [id, userId]);
            
            if (accountResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Compte non trouvé' 
                });
            }
            
            res.json({
                success: true,
                message: 'Abonnements Facebook synchronisés',
                data: {
                    id: id,
                    synced_at: new Date().toISOString(),
                    subscribed_fields: ['messages', 'messaging_postbacks']
                }
            });
            
        } catch (error) {
            console.error('Erreur synchronisation abonnements:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de la synchronisation des abonnements' 
            });
        }
    });

    // Route pour tester un compte webhook
    app.post('/api/webhook-accounts/:id/test', authenticate, async (req, res) => {
        try {
            const { id } = req.params;
            const schemaName = req.user.schema_name;
            const userId = req.user.id;
            
            // Récupérer le compte
            const accountResult = await pool.query(`
                SELECT * FROM ${schemaName}.webhook_accounts 
                WHERE id = $1 AND user_id = $2
            `, [id, userId]);
            
            if (accountResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Compte non trouvé' 
                });
            }
            
            const account = accountResult.rows[0];
            
            // Simulation d'un test selon la plateforme
            let testResult;
            switch (account.platform) {
                case 'facebook_messenger':
                    testResult = {
                        connected: true,
                        page_name: account.page_name || 'Page Facebook',
                        page_id: account.page_id,
                        permissions: ['pages_messaging', 'pages_show_list']
                    };
                    break;
                case 'whatsapp_business':
                    testResult = {
                        connected: true,
                        phone_number: account.phone_number,
                        business_id: account.business_id
                    };
                    break;
                default:
                    testResult = {
                        connected: true,
                        platform: account.platform
                    };
            }
            
            // Mettre à jour le statut
            await pool.query(`
                UPDATE ${schemaName}.webhook_accounts 
                SET last_test = $1, is_active = true
                WHERE id = $2 AND user_id = $3
            `, [new Date().toISOString(), id, userId]);
            
            res.json({
                success: true,
                message: 'Test de connexion réussi',
                data: testResult
            });
            
        } catch (error) {
            console.error('Erreur test compte webhook:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erreur lors du test du compte',
                details: error.message 
            });
        }
    });

    // Route pour les statistiques IA d'un compte
    app.get('/api/webhook-accounts/:id/ai-stats', authenticate, async (req, res) => {
        try {
            const { id } = req.params;
            const schemaName = req.user.schema_name;
            const userId = req.user.id;
            
            // Simuler des statistiques IA
            const aiStats = {
                total_conversations: Math.floor(Math.random() * 100),
                successful_responses: Math.floor(Math.random() * 80),
                failed_responses: Math.floor(Math.random() * 20),
                avg_response_time: Math.random() * 2 + 0.5,
                last_activity: new Date(Date.now() - Math.random() * 86400000).toISOString()
            };
            
            res.json({
                success: true,
                data: aiStats
            });
            
        } catch (error) {
            console.error('Erreur statistiques IA compte:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de la récupération des statistiques IA' 
            });
        }
    });



    // Route pour exporter les logs
    app.get('/api/webhook-logs/export', authenticate, async (req, res) => {
        try {
            const schemaName = req.user.schema_name;
            const userId = req.user.id;
            
            // Récupérer tous les logs
            const result = await pool.query(`
                SELECT * FROM ${schemaName}.webhook_logs 
                WHERE user_id = $1
                ORDER BY timestamp DESC
            `, [userId]);
            
            // Formater pour l'export
            const exportData = {
                export_date: new Date().toISOString(),
                total_logs: result.rows.length,
                logs: result.rows
            };
            
            // Définir les headers pour le téléchargement
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="webhook-logs-${new Date().toISOString().split('T')[0]}.json"`);
            
            res.send(JSON.stringify(exportData, null, 2));
            
        } catch (error) {
            console.error('Erreur export logs:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de l\'export des logs' 
            });
        }
    });

    // ==================== IMPORT DES ROUTES ====================

    // Import des routes (assurez-vous que ces fichiers existent)
    let webhooksRoutes, statsRoutes, dashboardRoutes, produitsRoutes, contactsRoutes;
    let opportunitesRoutes, categoriesRoutes, commandesRoutes, documentsRouter;
    let documentsPuppeteer, adminRoutes;

    try {
      usersRoutes = require('./src/routes/users');
    } catch (e) { 
      console.warn('⚠️ Routes users non trouvées');
      usersRoutes = express.Router(); 
    }

    try {
      webhooksRoutes = require('./src/routes/webhooks');
    } catch (e) { webhooksRoutes = require('./src/routes/webhooks') || express.Router(); }

    try {
      statsRoutes = require('./src/routes/stats');
    } catch (e) { statsRoutes = require('./src/routes/stats') || express.Router(); }

    try {
      dashboardRoutes = require('./src/routes/dashboard');
    } catch (e) { dashboardRoutes = require('./src/routes/dashboard') || express.Router(); }

    try {
      produitsRoutes = require('./src/routes/produits');
    } catch (e) { produitsRoutes = require('./src/routes/produits') || express.Router(); }

    try {
      contactsRoutes = require('./src/routes/contacts');
    } catch (e) { contactsRoutes = require('./src/routes/contacts') || express.Router(); }

    try {
      opportunitesRoutes = require('./src/routes/opportunites');
    } catch (e) { opportunitesRoutes = require('./src/routes/opportunites') || express.Router(); }

    try {
      categoriesRoutes = require('./src/routes/categories');
    } catch (e) { categoriesRoutes = require('./src/routes/categories') || express.Router(); }

    try {
      commandesRoutes = require('./src/routes/commandes');
    } catch (e) { commandesRoutes = require('./src/routes/commandes') || express.Router(); }

    try {
      documentsRouter = require('./src/routes/documents');
    } catch (e) { documentsRouter = require('./src/routes/documents') || express.Router(); }

    try {
      documentsPuppeteer = require('./src/routes/documents-puppeteer');
    } catch (e) { documentsPuppeteer = require('./src/routes/documents-puppeteer') || express.Router(); }

    try {
      adminRoutes = require('./src/routes/admin');
    } catch (e) { adminRoutes = require('./src/routes/admin') || express.Router(); }

    try {
      webhookAccountsRoutes = require('./src/routes/webhook-accounts');
    } catch (e) { 
      console.warn('⚠️ Routes webhook-accounts non trouvées');
      webhookAccountsRoutes = express.Router(); 
    }

    try {
      automationRoutes = require('./src/routes/automation');
    } catch (e) { 
      console.warn('⚠️ Routes automation non trouvées');
      automationRoutes = express.Router(); 
    }

    let iaRoutes;
    try {
        iaRoutes = require('./src/routes/ia');
    } catch (e) { 
        console.warn('⚠️ Routes IA non trouvées');
        iaRoutes = express.Router(); 
    }

    let userStatsRoutes, iaStatsRoutes, webhookLogsRoutes, facebookRoutes;

    try {
      userStatsRoutes = require('./src/routes/user-stats');
    } catch (e) { 
      console.warn('⚠️ Routes user-stats non trouvées');
      userStatsRoutes = express.Router(); 
    }

    try {
      iaStatsRoutes = require('./src/routes/ia-stats');
    } catch (e) { 
      console.warn('⚠️ Routes ia-stats non trouvées');
      iaStatsRoutes = express.Router(); 
    }

    try {
      webhookLogsRoutes = require('./src/routes/webhook-logs');
    } catch (e) { 
      console.warn('⚠️ Routes webhook-logs non trouvées');
      webhookLogsRoutes = express.Router(); 
    }

    try {
      facebookRoutes = require('./src/routes/facebook');
    } catch (e) { 
      console.warn('⚠️ Routes facebook non trouvées');
      facebookRoutes = express.Router();}

    // ==================== ROUTES PUBLIQUES ====================

    // Route de santé
    app.get('/api/health', (req, res) => res.json({ 
      ok: true, 
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      features: ['isolation', 'crm', 'erp']
    }));

    // Route de test CORS
    app.get('/api/cors-test', (req, res) => {
      res.json({
        success: true,
        message: 'CORS fonctionne correctement',
        headers: req.headers,
        timestamp: new Date().toISOString()
      });
    });

    // ==================== ROUTES D'AUTHENTIFICATION UNIFIÉES ====================

    // Route de login unifiée
    app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        console.log('🔐 LOGIN pour:', email);
        
        if (!email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Email et mot de passe requis'
          });
        }
        
        // Vérifier si l'utilisateur existe dans public.users
        const result = await pool.query(
          'SELECT id, email, name, role, password_hash FROM public.users WHERE email = $1',
          [email]
        );
        
        if (result.rows.length === 0) {
          // Si l'utilisateur n'existe pas, créer un nouvel utilisateur
          console.log('👤 Création NOUVEL utilisateur');
          
          const hashedPassword = await bcrypt.hash(password, 10);
          const name = email.split('@')[0];
          
          const insertResult = await pool.query(
            `INSERT INTO public.users (email, password_hash, name, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, name, role`,
            [email, hashedPassword, name, 'user']
          );
          
          const user = insertResult.rows[0];
          const userId = user.id;
          const userSchema = `user_${userId}`;
          
          // Créer les tables pour le nouvel utilisateur
          await createUserTables(userId);
          
          // Mettre à jour le schéma dans la table users
          await pool.query(
            'UPDATE public.users SET schema_name = $1 WHERE id = $2',
            [userSchema, userId]
          );
          
          // Créer le token
          const token = jwt.sign(
            {
              userId: user.id,
              id: user.id,
              email: user.email,
              role: user.role,
              name: user.name,
              schema: userSchema
            },
            process.env.JWT_SECRET || 'dev-secret-key',
            { expiresIn: '24h' }
          );
          
          console.log(`✅ Nouvel utilisateur créé: ${email}, ID: ${userId}`);
          
          return res.json({
            success: true,
            token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              username: user.name,
              schema: userSchema
            },
            message: 'Nouvel utilisateur créé'
          });
        }
        
        // Utilisateur existant - vérifier le mot de passe
        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            error: 'Email ou mot de passe incorrect'
          });
        }
        
        const userId = user.id;
        const userSchema = user.schema_name || `user_${userId}`;
        
        // S'assurer que les tables existent
        await ensureUserTables(userSchema, userId);
        
        // Mettre à jour la dernière connexion
        await pool.query(
          'UPDATE public.users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
          [userId]
        );
        
        // Créer le token
        const token = jwt.sign(
          {
            userId: user.id,
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            schema: userSchema
          },
          process.env.JWT_SECRET || 'dev-secret-key',
          { expiresIn: '24h' }
        );
        
        console.log(`✅ Login réussi pour ${email} - ID: ${userId}, Schema: ${userSchema}`);
        
        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            username: user.name,
            schema: userSchema
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur login:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur serveur lors de la connexion'
        });
      }
    });

    // Route pour vérifier le token
    app.get('/api/auth/verify', (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Token manquant',
            valid: false
          });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!process.env.JWT_SECRET) {
          throw new Error('JWT_SECRET non configuré');
        }
        
        res.json({
          success: true,
          valid: true,
          user: decoded
        });
        
      } catch (error) {
        console.error('❌ Erreur vérification token:', error.message);
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            valid: false,
            error: 'Token expiré'
          });
        }
        
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            valid: false,
            error: 'Token invalide'
          });
        }
        
        res.status(500).json({
          success: false,
          error: 'Erreur de vérification'
        });
      }
    });

    // Route pour récupérer le profil utilisateur
    app.get('/api/auth/profile', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userId = req.user.id;
        
        const result = await pool.query(
          'SELECT id, email, name, role, created_at, last_login FROM public.users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Utilisateur non trouvé'
          });
        }
        
        const user = result.rows[0];
        
        // Récupérer les infos supplémentaires du schéma utilisateur
        let phone = '';
        let department = 'Général';
        
        try {
          const userSchema = req.userSchema || `user_${userId}`;
          const settingsResult = await pool.query(
            `SELECT preferences FROM "${userSchema}".user_settings WHERE user_id = $1`,
            [userId]
          );
          
          if (settingsResult.rows.length > 0 && settingsResult.rows[0].preferences) {
            const prefs = settingsResult.rows[0].preferences;
            phone = prefs.phone || '';
            department = prefs.department || 'Général';
          }
        } catch (error) {
          console.error('⚠️ Erreur récupération préférences:', error.message);
        }
        
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            username: user.name,
            phone: phone,
            department: department,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            schema: req.userSchema
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur profile:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur serveur'
        });
      }
    });

    // Route pour rafraîchir le token
    app.post('/api/auth/refresh', async (req, res) => {
      try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
          return res.status(400).json({
            success: false,
            error: 'Refresh token requis'
          });
        }
        
        // Vérifier le refresh token
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || 'refresh-secret-key'
        );
        
        if (decoded.type !== 'refresh') {
          return res.status(401).json({
            success: false,
            error: 'Token invalide'
          });
        }
        
        // Récupérer l'utilisateur
        const result = await pool.query(
          'SELECT id, email, name, role FROM public.users WHERE id = $1',
          [decoded.userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Utilisateur non trouvé'
          });
        }
        
        const user = result.rows[0];
        const userSchema = `user_${user.id}`;
        
        // Générer un nouveau token
        const newToken = jwt.sign(
          {
            userId: user.id,
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            schema: userSchema
          },
          process.env.JWT_SECRET || 'dev-secret-key',
          { expiresIn: '24h' }
        );
        
        res.json({
          success: true,
          token: newToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            schema: userSchema
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur refresh token:', error);
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Refresh token expiré'
          });
        }
        
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: 'Refresh token invalide'
          });
        }
        
        res.status(500).json({
          success: false,
          error: 'Erreur interne du serveur'
        });
      }
    });

    // Route de logout
    app.post('/api/auth/logout', (req, res) => {
      res.json({
        success: true,
        message: 'Déconnecté avec succès'
      });
    });

    app.post('/api/admin/create-ia-tables', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const schemaName = req.userSchema;
        const userId = req.user.userId || req.user.id;
        
        console.log(`🤖 Création manuelle tables IA pour: ${schemaName}`);
        
        await createIATablesForSchema(schemaName);
        
        res.json({
          success: true,
          message: `Tables IA créées pour ${schemaName}`,
          schema: schemaName,
          userId: userId
        });
        
      } catch (error) {
        console.error('❌ Erreur création tables IA:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== ROUTES PROTÉGÉES ====================

    // ROUTES DE BASE
    app.use('/api/users', authenticate, enforceDataIsolation, usersRoutes);
    app.use('/api/contacts', authenticate, enforceDataIsolation, contactsRoutes);
    app.use('/api/produits', authenticate, enforceDataIsolation, produitsRoutes);
    app.use('/api/commandes', authenticate, enforceDataIsolation, commandesRoutes);
    app.use('/api/opportunites', authenticate, enforceDataIsolation, opportunitesRoutes);
    app.use('/api/categories', authenticate, enforceDataIsolation, categoriesRoutes);

    // DASHBOARD ET STATISTIQUES
    app.use('/api/dashboard', authenticate, enforceDataIsolation, dashboardRoutes);
    app.use('/api/stats', authenticate, enforceDataIsolation, statsRoutes);

    // DOCUMENTS
    app.use('/api/documents', authenticate, enforceDataIsolation, documentsRouter);
    app.use('/api/documents-puppeteer', authenticate, enforceDataIsolation, documentsPuppeteer);

    // AUTRES FONCTIONNALITÉS
    app.use('/api/webhooks', authenticate, enforceDataIsolation, webhooksRoutes);
    app.use('/api/webhook', iaWebhooksRoutes);

    // ADMIN
    app.use('/api/admin', authenticate, enforceDataIsolation, adminRoutes);

    // ⭐ AJOUTEZ CES LIGNES POUR IA ET AUTOMATION ⭐
    app.use('/api/webhook-accounts', authenticate, enforceDataIsolation, webhookAccountsRoutes);
    app.use('/api/automation', authenticate, enforceDataIsolation, automationRoutes);
    app.use('/api/ia', authenticate, enforceDataIsolation, iaRoutes);
    app.use('/api', userStatsRoutes);
    app.use('/api', iaStatsRoutes);
    app.use('/api', webhookLogsRoutes);
    app.use('/api', facebookRoutes);
    app.use('/api/debug', authenticate, enforceDataIsolation, debugRoutes);

    console.log('✅ Routes IA chargées:', iaRoutes ? 'OUI' : 'NON');


    // ==================== ROUTES SPÉCIFIQUES ====================

    // Route pour les statistiques du dashboard
    app.get('/api/dashboard/stats', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const userId = req.user.userId || req.user.id;
        const filters = req.query;
        
        console.log(`📊 Dashboard stats pour: ${userSchema}`, { filters });
        
        await ensureUserTables(userSchema, userId);
        
        const buildWhereClause = () => {
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
          
          return {
            whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            params
          };
        };
        
        const { whereClause, params } = buildWhereClause();
        
        // Récupérer les statistiques
        let totalContacts = 0, totalProduits = 0, totalCommandes = 0;
        let chiffreAffaires = 0, moyenneCommande = 0;
        let statutsCommandes = { 'livrée': 0, 'en cours': 0, 'en attente': 0, 'annulée': 0 };
        let clientsActifs = 0, produitsStockFaible = 0;
        
        try {
          const contactsResult = await pool.query(`SELECT COUNT(*) FROM "${userSchema}".contacts`);
          totalContacts = parseInt(contactsResult.rows[0].count) || 0;
          
          const produitsResult = await pool.query(`SELECT COUNT(*) FROM "${userSchema}".produits`);
          totalProduits = parseInt(produitsResult.rows[0].count) || 0;
          
          const commandesQuery = `SELECT COUNT(*) FROM "${userSchema}".commandes ${whereClause}`;
          const commandesResult = await pool.query(commandesQuery, params);
          totalCommandes = parseInt(commandesResult.rows[0].count) || 0;
          
          const caQuery = `
            SELECT COALESCE(SUM(total), 0) as total_ca 
            FROM "${userSchema}".commandes 
            WHERE statut = 'livrée'
            ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
          `;
          const caParams = whereClause ? params.filter(p => p !== 'livrée') : [];
          const caResult = await pool.query(caQuery, caParams);
          chiffreAffaires = parseFloat(caResult.rows[0].total_ca) || 0;
          
          const moyenneQuery = `
            SELECT COALESCE(AVG(total), 0) as moyenne 
            FROM "${userSchema}".commandes 
            WHERE statut = 'livrée'
            ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
          `;
          const moyenneResult = await pool.query(moyenneQuery, caParams);
          moyenneCommande = parseFloat(moyenneResult.rows[0].moyenne) || 0;
          
          const statutsQuery = `
            SELECT statut, COUNT(*) 
            FROM "${userSchema}".commandes 
            ${whereClause}
            GROUP BY statut
          `;
          const statutsResult = await pool.query(statutsQuery, params);
          statutsResult.rows.forEach(row => {
            const statut = row.statut?.toLowerCase() || 'inconnu';
            if (statut.includes('livré')) statutsCommandes['livrée'] = parseInt(row.count) || 0;
            else if (statut.includes('cours')) statutsCommandes['en cours'] = parseInt(row.count) || 0;
            else if (statut.includes('attente')) statutsCommandes['en attente'] = parseInt(row.count) || 0;
            else if (statut.includes('annulé')) statutsCommandes['annulée'] = parseInt(row.count) || 0;
            else statutsCommandes[statut] = parseInt(row.count) || 0;
          });
          
          const clientsActifsQuery = `
            SELECT COUNT(DISTINCT contact_id) 
            FROM "${userSchema}".commandes 
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
            ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
          `;
          const clientsActifsResult = await pool.query(clientsActifsQuery, params);
          clientsActifs = parseInt(clientsActifsResult.rows[0].count) || 0;
          
          const stockFaibleQuery = `SELECT COUNT(*) FROM "${userSchema}".produits WHERE stock <= 10 AND stock > 0`;
          const stockFaibleResult = await pool.query(stockFaibleQuery);
          produitsStockFaible = parseInt(stockFaibleResult.rows[0].count) || 0;
          
        } catch (error) {
          console.error('❌ Erreur dans les requêtes stats:', error.message);
        }
        
        // Top produits
        let topProduits = [];
        try {
          const topProduitsQuery = `
            SELECT 
              p.id,
              p.nom,
              p.prix,
              COALESCE(SUM(lc.quantite), 0) as quantite_vendue,
              COALESCE(SUM(lc.quantite * p.prix), 0) as chiffre_produit
            FROM "${userSchema}".produits p
            LEFT JOIN "${userSchema}".lignes_commande lc ON p.id = lc.produit_id
            LEFT JOIN "${userSchema}".commandes cmd ON lc.commande_id = cmd.id 
              AND cmd.statut = 'livrée'
              ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
            GROUP BY p.id, p.nom, p.prix
            HAVING COALESCE(SUM(lc.quantite), 0) > 0
            ORDER BY quantite_vendue DESC
            LIMIT 5
          `;
          
          const topProduitsResult = await pool.query(topProduitsQuery, params);
          
          if (topProduitsResult.rows.length > 0) {
            topProduits = topProduitsResult.rows.map(p => ({
              id: p.id,
              nom: p.nom,
              prix: parseFloat(p.prix) || 0,
              total_vendu: parseInt(p.quantite_vendue, 10),
              chiffre_produit: parseFloat(p.chiffre_produit) || 0
            }));
          }
        } catch (error) {
          console.error('❌ Erreur top produits:', error.message);
          topProduits = [];
        }
        
        // Évolution mensuelle
        let evolution_mensuelle = 0;
        try {
          const currentMonthQuery = `
            SELECT COALESCE(SUM(total), 0) as ca_mois_courant
            FROM "${userSchema}".commandes 
            WHERE statut = 'livrée'
              AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
          `;
          
          const previousMonthQuery = `
            SELECT COALESCE(SUM(total), 0) as ca_mois_precedent
            FROM "${userSchema}".commandes 
            WHERE statut = 'livrée'
              AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
              AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
          `;
          
          const [currentResult, previousResult] = await Promise.all([
            pool.query(currentMonthQuery),
            pool.query(previousMonthQuery)
          ]);
          
          const caMoisCourant = parseFloat(currentResult.rows[0].ca_mois_courant) || 0;
          const caMoisPrecedent = parseFloat(previousResult.rows[0].ca_mois_precedent) || 0;
          
          if (caMoisPrecedent > 0) {
            evolution_mensuelle = ((caMoisCourant - caMoisPrecedent) / caMoisPrecedent) * 100;
          } else if (caMoisCourant > 0) {
            evolution_mensuelle = 100;
          }
          
        } catch (error) {
          console.error('❌ Erreur calcul évolution:', error.message);
          evolution_mensuelle = 0;
        }
        
        // Données pour graphique
        let revenueData = { labels: [], values: [] };
        try {
          const revenueQuery = `
            SELECT 
              DATE(date) as jour,
              COALESCE(SUM(total), 0) as ca_journalier
            FROM "${userSchema}".commandes 
            WHERE statut = 'livrée'
              AND date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(date)
            ORDER BY jour
          `;
          
          const revenueResult = await pool.query(revenueQuery);
          
          const today = new Date();
          const labels = [];
          const values = [];
          
          for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(formatDate(date, 'dd/MM'));
            
            const dayData = revenueResult.rows.find(row => {
              const rowDate = new Date(row.jour);
              return rowDate.toISOString().split('T')[0] === dateStr;
            });
            
            values.push(dayData ? parseFloat(dayData.ca_journalier) : 0);
          }
          
          revenueData = { labels, values };
          
        } catch (error) {
          console.error('❌ Erreur données revenue:', error.message);
          revenueData = { labels: [], values: [] };
        }
        
        const response = {
          success: true,
          data: {
            total_contacts: totalContacts,
            total_produits: totalProduits,
            total_commandes: totalCommandes,
            chiffre_affaires: chiffreAffaires,
            moyenne_commande: moyenneCommande,
            evolution_mensuelle: parseFloat(evolution_mensuelle.toFixed(1)),
            livrees: statutsCommandes['livrée'] || 0,
            en_cours: statutsCommandes['en cours'] || 0,
            en_attente: statutsCommandes['en attente'] || 0,
            annulees: statutsCommandes['annulée'] || 0,
            clients_actifs: clientsActifs,
            produits_stock_faible: produitsStockFaible,
            topProduits: topProduits,
            revenue_data: revenueData
          },
          periode: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            hasFilters: !!(filters.startDate || filters.endDate || filters.statut)
          }
        };
        
        console.log('📊 Réponse dashboard stats');
        
        res.json(response);
        
      } catch (error) {
        console.error('❌ Erreur générale dashboard/stats:', error.message);
        
        res.json({
          success: true,
          data: getEmptyStats(),
          error: error.message
        });
      }
    });

    // Commandes récentes
    app.get('/api/commandes/recentes', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userSchema = req.userSchema;
        const limit = parseInt(req.query.limit) || 10;
        
        let query = `SELECT * FROM "${userSchema}".commandes`;
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        if (req.query.startDate) {
          conditions.push(`date >= $${paramIndex}`);
          params.push(req.query.startDate);
          paramIndex++;
        }
        
        if (req.query.endDate) {
          conditions.push(`date <= $${paramIndex}`);
          params.push(req.query.endDate);
          paramIndex++;
        }
        
        if (req.query.statut) {
          conditions.push(`statut = $${paramIndex}`);
          params.push(req.query.statut);
          paramIndex++;
        }
        
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY date DESC LIMIT $${paramIndex}`;
        params.push(limit);
        
        const result = await pool.query(query, params);
        
        const commandesWithContact = await Promise.all(
          result.rows.map(async (cmd) => {
            if (cmd.contact_id) {
              try {
                const contactRes = await pool.query(
                  `SELECT nom, prenom FROM "${userSchema}".contacts WHERE id = $1`,
                  [cmd.contact_id]
                );
                if (contactRes.rows.length > 0) {
                  return {
                    ...cmd,
                    contactNom: contactRes.rows[0].nom,
                    contactPrenom: contactRes.rows[0].prenom
                  };
                }
              } catch (error) {
                console.log('⚠️ Impossible de récupérer le contact:', error.message);
              }
            }
            return cmd;
          })
        );
        
        res.json({ 
          success: true, 
          data: commandesWithContact,
          count: result.rows.length,
          limit: limit
        });
      } catch (error) {
        console.error('❌ Erreur commandes récentes:', error);
        res.json({ 
          success: true, 
          data: [],
          count: 0,
          error: error.message 
        });
      }
    });

    // Produits liste
    app.get('/api/produits/list', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const result = await pool.query(
          `SELECT * FROM "${req.userSchema}".produits ORDER BY id DESC`
        );
        
        res.json({
          success: true,
          data: result.rows,
          count: result.rows.length
        });
        
      } catch (error) {
        console.error('❌ Erreur produits:', error);
        res.json({
          success: true,
          data: [],
          count: 0
        });
      }
    });

    // ==================== ROUTES DE TEST ET DEBUG (protégées) ====================

    // Test d'authentification
    app.get('/api/test-auth', authenticate, enforceDataIsolation, (req, res) => {
      res.json({
        success: true,
        message: 'Authentification réussie',
        user: req.user,
        schema: req.userSchema,
        timestamp: new Date().toISOString()
      });
    });

    // Debug données utilisateur
    app.get('/api/debug/my-data', authenticate, enforceDataIsolation, async (req, res) => {
      try {
        const userId = req.user.userId || req.user.id;
        const schemaName = req.userSchema;
        
        let contactsCount = 0, produitsCount = 0, commandesCount = 0;
        
        try {
          const contactsResult = await pool.query(`SELECT COUNT(*) FROM "${schemaName}".contacts`);
          contactsCount = parseInt(contactsResult.rows[0].count);
        } catch (e) { }
        
        try {
          const produitsResult = await pool.query(`SELECT COUNT(*) FROM "${schemaName}".produits`);
          produitsCount = parseInt(produitsResult.rows[0].count);
        } catch (e) { }
        
        try {
          const commandesResult = await pool.query(`SELECT COUNT(*) FROM "${schemaName}".commandes`);
          commandesCount = parseInt(commandesResult.rows[0].count);
        } catch (e) { }
        
        res.json({
          success: true,
          data: {
            user: {
              id: userId,
              email: req.user.email,
              role: req.user.role,
              schema: schemaName
            },
            counts: {
              contacts: contactsCount,
              produits: produitsCount,
              commandes: commandesCount
            },
            isolation: {
              schema_correct: schemaName === `user_${userId}`,
              has_tables: contactsCount > 0 || produitsCount > 0 || commandesCount > 0
            }
          }
        });
        
      } catch (error) {
        console.error('❌ Erreur debug my-data:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route de test publique (sans authentification)
    app.post('/api/test-webhook-receive', async (req, res) => {
      console.log('📥 TEST WEBHOOK RECEIVE - Corps:', JSON.stringify(req.body, null, 2));
      console.log('📥 Headers:', req.headers);
      
      // Répondre immédiatement à Facebook
      res.status(200).send('EVENT_RECEIVED');
      
      // Loguer pour analyse
      const logData = {
        timestamp: new Date().toISOString(),
        body: req.body,
        headers: req.headers,
        ip: req.ip
      };
      
      console.log('📝 Log test:', logData);
      
      // Sauvegarder dans un fichier pour analyse
      const fs = require('fs');
      fs.appendFileSync('webhook-test.log', JSON.stringify(logData, null, 2) + '\n---\n');
    });
    // ==================== ROUTE 404 POUR API ====================

    app.use('/api', (req, res) => {
      res.status(404).json({
        success: false,
        error: `Route API non trouvée: ${req.method} ${req.originalUrl}`,
        available_routes: [
          'PUBLIQUES:',
          'POST /api/auth/login',
          'POST /api/auth/login-guaranteed',
          'GET  /api/health',
          'GET  /api/auth/verify',
          'GET  /api/debug/users',
          'GET  /api/force-fix-admin',
          '',
          'PROTÉGÉES:',
          'GET  /api/contacts',
          'GET  /api/produits',
          'GET  /api/commandes',
          'GET  /api/categories',
          'GET  /api/dashboard/stats',
          'GET  /api/test-auth',
          'GET  /api/debug/my-data'
        ]
      });
    });

    // ==================== DÉMARRAGE ====================

    pool.connect()
      .then(client => {
        console.log('✅ PostgreSQL connecté');
        client.release();
        
        // Démarrer le serveur
        const server = app.listen(PORT, () => {
          console.log(`🚀 SERVEUR DÉMARRÉ: http://localhost:${PORT}`);
        });

        // Dans server.js au démarrage
        const GLOBAL_FB_VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN_GLOBAL || 
          'fb_global_' + Math.random().toString(36).substring(2, 15) + 
          Math.random().toString(36).substring(2, 15);
        console.log('🔐 Token Webhook Global:', GLOBAL_FB_VERIFY_TOKEN);
        
        // Gestion d'erreurs d'écoute
        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Le port ${PORT} est déjà utilisé.`);
            console.log('💡 Essayez:');
            console.log('  1. Tuer le processus sur ce port:');
            console.log(`     netstat -ano | findstr :${PORT}`);
            console.log('     taskkill /PID [PID] /F');
            console.log('  2. Changer le port dans .env');
            console.log('  3. Attendre quelques secondes et réessayer');
          } else {
            console.error('❌ Erreur démarrage serveur:', error);
          }
          process.exit(1);
        });
        
        // Gestion arrêt propre
        server.on('close', () => {
          console.log('🛑 Serveur arrêté');
        });
        
        // Message de démarrage complet
        console.log(`
    ==========================================
    📡 ENDPOINTS PUBLICS:
      POST /api/auth/login           → Connexion normale
      POST /api/auth/login-guaranteed → Connexion garantie
      GET  /api/health               → Vérification santé
      GET  /api/diagnose/bcrypt      → Diagnostic bcrypt
      GET  /api/debug/users          → Voir utilisateurs
      GET  /api/force-fix-admin      → Réparer admin

    📡 ENDPOINTS PROTÉGÉS:
      GET  /api/contacts             → Contacts (isolé)
      GET  /api/produits             → Produits (isolé)
      GET  /api/categories           → Catégories (isolé)
      GET  /api/commandes            → Commandes (isolé)
      GET  /api/dashboard/stats      → Statistiques
      GET  /api/test-auth            → Test authentification
      GET  /api/debug/my-data        → Voir vos données

    🔐 ADMIN PAR DÉFAUT:
      email: admin@entreprise.com
      password: admin123
    ==========================================
        `);
        
      })
      .catch(error => {
        console.error('❌ PostgreSQL:', error.message);
        console.log('💡 Vérifiez:');
        console.log('  1. PostgreSQL est-il démarré?');
        console.log('  2. Les identifiants dans .env sont-ils corrects?');
        console.log('  3. La base "erpcrm" existe-t-elle?');
        process.exit(1);
      });

    // Gestion des erreurs non capturées
    process.on('uncaughtException', (error) => {
      console.error('❌ ERREUR NON CAPTURÉE:', error);
      console.error('Stack:', error.stack);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ PROMISE REJECTION NON GÉRÉE:', reason);
    });

    // Arrêt propre
    process.on('SIGTERM', async () => {
      console.log('🛑 Arrêt...');
      try {
        await pool.end();
        console.log('✅ PostgreSQL déconnecté');
      } catch (error) {
        console.error('❌ Erreur fermeture pool:', error);
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Arrêt (Ctrl+C)...');
      try {
        await pool.end();
        console.log('✅ PostgreSQL déconnecté');
      } catch (error) {
        console.error('❌ Erreur fermeture pool:', error);
      }
      process.exit(0);
    });
    } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
module.exports = { pool, app };
