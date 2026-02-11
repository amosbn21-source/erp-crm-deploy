-- Table publique des utilisateurs
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    schema_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Table de mapping Facebook (pour les webhooks)
CREATE TABLE IF NOT EXISTS public.facebook_pages_mapping (
    page_id VARCHAR(100) PRIMARY KEY,
    platform VARCHAR(50) DEFAULT 'facebook_messenger',
    user_id INTEGER,
    schema_name VARCHAR(100),
    account_id INTEGER,
    page_name VARCHAR(200),
    verify_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_mapping_page_id ON public.facebook_pages_mapping(page_id);