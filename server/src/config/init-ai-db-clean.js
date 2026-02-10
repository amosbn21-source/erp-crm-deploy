// src/config/init-ai-db-clean.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'erpcrm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'Jenoubliepas0987654321',
});

async function cleanAndInitialize() {
  console.log('🧹 Nettoyage des anciennes tables IA...');
  
  try {
    // Liste des tables à supprimer
    const tablesToDrop = [
      'ai_models',
      'ai_feedbacks',
      'ai_interactions',
      'ai_training_scenarios',
      'ai_workflows',
      'workflow_executions',
      'customer_conversations',
      'ai_analytics',
      'ai_interaction_logs',
      'ai_suggestions',
      'ai_conversation_tests'
    ];
    
    for (const table of tablesToDrop) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✓ Table ${table} supprimée`);
      } catch (error) {
        console.log(`⚠️  ${table}: ${error.message}`);
      }
    }
    
    console.log('\n🔄 Création des nouvelles tables...');
    
    // Version SIMPLIFIÉE sans problèmes
    const simpleSchema = `
      -- Table pour les interactions IA
      CREATE TABLE ai_interactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_schema VARCHAR(100) NOT NULL,
        session_id VARCHAR(255),
        input_text TEXT NOT NULL,
        intent_action VARCHAR(100),
        intent_confidence DECIMAL(5,4),
        response_text TEXT,
        context_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Table pour les scénarios d'entraînement IA
      CREATE TABLE ai_training_scenarios (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_schema VARCHAR(100) NOT NULL,
        input TEXT NOT NULL,
        expected_response TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Table pour les workflows d'automatisation
      CREATE TABLE ai_workflows (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_schema VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(100) DEFAULT 'manual',
        nodes JSONB DEFAULT '[]',
        connections JSONB DEFAULT '[]',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Table pour l'exécution des workflows
      CREATE TABLE workflow_executions (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES ai_workflows(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        input_data JSONB DEFAULT '{}',
        output_data JSONB DEFAULT '{}',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
      
      -- Table pour les conversations clients
      CREATE TABLE customer_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_schema VARCHAR(100) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        customer_name VARCHAR(255),
        last_message TEXT,
        status VARCHAR(50) DEFAULT 'new',
        last_activity TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Table pour les analytics IA
      CREATE TABLE ai_analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_schema VARCHAR(100) NOT NULL,
        session_id VARCHAR(255),
        intent_detected VARCHAR(255),
        confidence_score DECIMAL(5,4),
        action_taken VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    // Exécuter le schéma simple
    await pool.query(simpleSchema);
    
    // Créer quelques INDEX simples
    await pool.query(`
      CREATE INDEX idx_ai_interactions_user ON ai_interactions(user_id);
      CREATE INDEX idx_ai_interactions_time ON ai_interactions(created_at);
      CREATE INDEX idx_ai_workflows_user ON ai_workflows(user_id);
      CREATE INDEX idx_workflow_exec_status ON workflow_executions(status);
      CREATE INDEX idx_conversations_platform ON customer_conversations(platform);
    `);
    
    // Vérifier les tables créées
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name LIKE 'ai_%' 
      OR table_name LIKE 'workflow_%' 
      OR table_name LIKE 'customer_%'
      ORDER BY table_name
    `);
    
    console.log('\n✅ Tables créées :');
    tables.rows.forEach(table => console.log(`   • ${table.table_name}`));
    
    // Ajouter des données de test
    await seedTestData();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

async function seedTestData() {
  console.log('\n🌱 Ajout de données de test...');
  
  const testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'erpcrm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'Jenoubliepas0987654321',
  });
  
  try {
    // Données pour ai_training_scenarios
    await testPool.query(`
      INSERT INTO ai_training_scenarios 
        (user_id, user_schema, input, expected_response, category, tags)
      VALUES 
        (1, 'user_1', 'Bonjour', 'Bonjour ! Comment puis-je vous aider aujourd''hui ?', 'salutation', '["greeting", "welcome"]'),
        (1, 'user_1', 'Créer un contact', 'Je vais vous aider à créer un nouveau contact. Quel est le prénom ?', 'contact', '["create", "contact"]'),
        (1, 'user_1', 'Ajouter un produit', 'Je vais vous guider pour ajouter un produit. Quel est le nom du produit ?', 'product', '["create", "product"]'),
        (1, 'user_1', 'Voir mes statistiques', 'Voici vos statistiques récentes...', 'analytics', '["stats", "report"]'),
        (1, 'user_1', 'Supprimer un client', 'Quel client souhaitez-vous supprimer ?', 'contact', '["delete", "remove"]')
      ON CONFLICT DO NOTHING;
    `);
    
    // Données pour ai_workflows
    await testPool.query(`
      INSERT INTO ai_workflows 
        (user_id, user_schema, name, description, trigger_type, active)
      VALUES 
        (1, 'user_1', 'Suivi commande', 'Envoi automatique de notifications après commande', 'manual', true),
        (1, 'user_1', 'Alerte stock faible', 'Notification quand stock < 10 unités', 'automatic', true),
        (1, 'user_1', 'Bienvenue nouveaux clients', 'Message de bienvenue automatique', 'automatic', false),
        (1, 'user_1', 'Rappel de paiement', 'Rappel automatique 3 jours avant échéance', 'scheduled', true)
      ON CONFLICT DO NOTHING;
    `);
    
    // Données pour customer_conversations
    await testPool.query(`
      INSERT INTO customer_conversations 
        (user_id, user_schema, platform, customer_name, last_message, status)
      VALUES 
        (1, 'user_1', 'whatsapp', 'Jean Dupont', 'Bonjour, je souhaite commander un produit', 'répondu'),
        (1, 'user_1', 'messenger', 'Marie Martin', 'Quel est le prix du produit A ?', 'en attente'),
        (1, 'user_1', 'chat', 'Pierre Dubois', 'Comment créer un compte client ?', 'nouveau'),
        (1, 'user_1', 'whatsapp', 'Sophie Bernard', 'Ma commande est-elle expédiée ?', 'en cours'),
        (1, 'user_1', 'email', 'Thomas Leroy', 'Demande de devis pour 50 unités', 'traité')
      ON CONFLICT DO NOTHING;
    `);
    
    // Données pour ai_interactions
    await testPool.query(`
      INSERT INTO ai_interactions 
        (user_id, user_schema, input_text, intent_action, intent_confidence, response_text)
      VALUES 
        (1, 'user_1', 'Bonjour assistant', 'get_help', 0.95, 'Bonjour ! Je suis votre assistant IA.'),
        (1, 'user_1', 'Créer un nouveau contact', 'create_contact', 0.92, 'Je vais vous aider à créer un contact.'),
        (1, 'user_1', 'Quelles sont mes ventes ?', 'analyze_sales', 0.88, 'Voici vos statistiques de ventes...'),
        (1, 'user_1', 'Comment ajouter un produit ?', 'create_product', 0.85, 'Pour ajouter un produit, suivez ces étapes...'),
        (1, 'user_1', 'Montre-moi les workflows', 'workflow_suggestion', 0.80, 'Voici vos workflows disponibles...')
      ON CONFLICT DO NOTHING;
    `);
    
    // Données pour ai_analytics
    await testPool.query(`
      INSERT INTO ai_analytics 
        (user_id, user_schema, intent_detected, confidence_score, action_taken)
      VALUES 
        (1, 'user_1', 'create_contact', 0.92, 'started_dialog'),
        (1, 'user_1', 'analyze_sales', 0.88, 'generated_report'),
        (1, 'user_1', 'get_help', 0.95, 'provided_assistance')
      ON CONFLICT DO NOTHING;
    `);
    
    console.log('✅ Données de test ajoutées avec succès !');
    
  } catch (error) {
    console.error('⚠️  Erreur données test:', error.message);
  } finally {
    await testPool.end();
  }
}

// Exécution
if (require.main === module) {
  cleanAndInitialize()
    .then(() => {
      console.log('\n🎉 Base de données IA nettoyée et initialisée !');
      console.log('\n📊 Tables prêtes pour AIManagementPage.jsx :');
      console.log('   • ai_interactions - Interactions avec l\'IA');
      console.log('   • ai_training_scenarios - Scénarios d\'entraînement');
      console.log('   • ai_workflows - Workflows d\'automatisation');
      console.log('   • customer_conversations - Conversations clients');
      console.log('   • ai_analytics - Statistiques IA');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Échec:', error);
      process.exit(1);
    });
}

module.exports = { cleanAndInitialize };