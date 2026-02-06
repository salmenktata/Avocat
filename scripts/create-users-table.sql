-- Créer table users pour l'authentification
-- Inclut toutes les colonnes nécessaires pour:
-- - Authentification de base
-- - Vérification email
-- - Réinitialisation mot de passe
-- - Gestion rôles et statuts

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  nom VARCHAR(255),
  prenom VARCHAR(255),

  -- Vérification email
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP,

  -- Statut et rôle
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  is_approved BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),

  -- Tracking connexion
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token)
  WHERE email_verified = FALSE AND email_verification_token IS NOT NULL;

-- Table pour tokens de réinitialisation de mot de passe
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Afficher confirmation
SELECT 'Tables users et password_reset_tokens créées avec succès' AS status;
