// src/config/init-ai-db.js - Version simplifiée
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'erpcrm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'Jenoubliepas0987654321',
  max: 10,
  idleTimeoutMillis: 30000,
});

async function initializeAIDatabase() {
  console.log('🔄 Initialisation des tables IA...');
  
  try {
    // Lire le fichier SQL
    const schemaPath = path.join(__dirname, 'db-schema-ai.js');
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Extraire le SQL du module.exports
    const sqlMatch = schemaContent.match(/module\.exports = `([\s\S]*?)`;/);
    if (!sqlMatch) {
      throw new Error('Format SQL incorrect dans db-schema-ai.js');
    }
    
    const sql = sqlMatch[1];
    
    // Exécuter chaque instruction SQL séparément
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      
      try {
        await pool.query(statement);
        console.log(`✓ Exécuté: ${statement.substring(0, 80)}...`);
      } catch (error) {
        console.log(`⚠️  Ignoré erreur (${error.code}): ${statement.substring(0, 60)}...`);
        // Continuer malgré les erreurs (comme les INDEX qui existent déjà)
      }
    }
    
    // Vérifier les tables créées
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND (table_name LIKE 'ai_%' OR table_name LIKE 'workflow_%' OR table_name LIKE 'customer_%')
      ORDER BY table_name
    `);
    
    console.log('\n✅ Tables IA disponibles :');
    tables.rows.forEach(table => console.log(`   • ${table.table_name}`));
    
    // Ajouter des données de test
    await seedTestData();
    
  } catch (error) {
    console.error('❌ Erreur initialisation IA:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

async function seedTestData() {
  console.log('\n🌱 Ajout de données de test...');
  
  try {
    // Utiliser une nouvelle connexion
    const seedPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'erpcrm',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'Jenoubliepas0987654321',
    });
    
    // Ajouter quelques scénarios d'entraînement
    await seedPool.query(`
      INSERT INTO ai_training_scenarios 
        (user_id, user_schema, input, expected_response, category, tags)
      VALUES 
        (1, 'user_1', 'Bonjour', 'Bonjour ! Comment puis-je vous aider aujourd''hui ?', 'salutation', '["greeting", "welcome"]'),
        (1, 'user_1', 'Créer un contact', 'Je vais vous aider à créer un nouveau contact. Quel est le prénom ?', 'contact', '["create", "contact"]'),
        (1, 'user_1', 'Ajouter un produit', 'Je vais vous guider pour ajouter un produit. Quel est le nom du produit ?', 'product', '["create", "product"]')
      ON CONFLICT DO NOTHING;
    `);
    
    // Ajouter un workflow exemple
    await seedPool.query(`
      INSERT INTO ai_workflows 
        (user_id, user_schema, name, description, trigger_type, active)
      VALUES 
        (1, 'user_1', 'Suivi commande', 'Envoi automatique de notifications après commande', 'manual', true),
        (1, 'user_1', 'Alerte stock', 'Notification quand stock faible', 'automatic', true)
      ON CONFLICT DO NOTHING;
    `);
    
    // Ajouter quelques conversations test
    await seedPool.query(`
      INSERT INTO customer_conversations 
        (user_id, user_schema, platform, customer_name, last_message, status)
      VALUES 
        (1, 'user_1', 'whatsapp', 'Jean Dupont', 'Bonjour, je souhaite commander', 'répondu'),
        (1, 'user_1', 'messenger', 'Marie Martin', 'Quel est le prix du produit A ?', 'en attente'),
        (1, 'user_1', 'chat', 'Pierre Dubois', 'Comment créer un compte ?', 'nouveau')
      ON CONFLICT DO NOTHING;
    `);
    
    // Ajouter quelques interactions IA
    await seedPool.query(`
      INSERT INTO ai_interactions 
        (user_id, user_schema, input_text, intent_action, intent_confidence, response_text)
      VALUES 
        (1, 'user_1', 'Bonjour', 'get_help', 0.95, 'Bonjour ! Je suis votre assistant IA.'),
        (1, 'user_1', 'Créer un contact', 'create_contact', 0.92, 'Je vais vous aider à créer un contact.'),
        (1, 'user_1', 'Voir mes statistiques', 'analyze_sales', 0.88, 'Voici vos statistiques...')
      ON CONFLICT DO NOTHING;
    `);
    
    await seedPool.end();
    console.log('✅ Données de test ajoutées');
    
  } catch (error) {
    console.log('⚠️  Impossible d\'ajouter des données de test:', error.message);
  }
}

// Exécuter si lancé directement
if (require.main === module) {
  initializeAIDatabase()
    .then(() => {
      console.log('\n🎉 Initialisation IA terminée avec succès !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Échec initialisation IA:', error);
      process.exit(1);
    });
}

module.exports = { initializeAIDatabase };