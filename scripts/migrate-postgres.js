const { Pool } = require('pg');
require('dotenv').config();

async function migratePostgreSQL() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || 'erpcrm'
  });

  try {
    console.log('🚀 Démarrage des migrations PostgreSQL...');
    
    // Créer la table utilisateurs globale
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        schema_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ Table users créée');

    // Créer la table de mapping Facebook
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.facebook_pages_mapping (
        id SERIAL PRIMARY KEY,
        page_id VARCHAR(100) UNIQUE NOT NULL,
        platform VARCHAR(50) DEFAULT 'facebook_messenger',
        user_id INTEGER NOT NULL,
        schema_name VARCHAR(100) NOT NULL,
        account_id INTEGER NOT NULL,
        page_name VARCHAR(200),
        verify_token VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_facebook_mapping_page (page_id),
        INDEX idx_facebook_mapping_user (user_id)
      )
    `);
    console.log('✅ Table facebook_pages_mapping créée');

    // Créer l'utilisateur admin par défaut si nécessaire
    const adminExists = await pool.query(
      "SELECT id FROM public.users WHERE email = 'admin@entreprise.com'"
    );

    if (adminExists.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await pool.query(
        `INSERT INTO public.users (email, password_hash, name, role) 
         VALUES ($1, $2, $3, $4)`,
        ['admin@entreprise.com', hashedPassword, 'Administrateur', 'admin']
      );
      console.log('✅ Utilisateur admin créé: admin@entreprise.com / admin123');
    }

    console.log('🎉 Migrations PostgreSQL terminées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors des migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePostgreSQL();