-- ═══════════════════════════════════════════════════════════════════════════
-- Migration consolidée depuis /migrations/ vers /db/migrations/
-- Source originale: 20260209_create_api_keys_table.sql
-- Consolidé le: 2026-02-16
-- Phase 2 - Stabilisation DB & RAG
-- ═══════════════════════════════════════════════════════════════════════════

-- Migration: Gestion sécurisée des clés API
-- Date: 2026-02-09
-- Description: Stocker les clés API de manière chiffrée pour éviter de les perdre

-- Table des clés API
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  provider VARCHAR(50) NOT NULL UNIQUE,
  label TEXT NOT NULL,
  
  -- Clé chiffrée
  api_key_encrypted TEXT NOT NULL,
  
  -- Métadonnées
  project_id TEXT,
  base_url TEXT,
  model_default TEXT,
  
  -- Quotas
  tier VARCHAR(20) DEFAULT 'free',
  monthly_quota INTEGER,
  daily_quota INTEGER,
  rpm_limit INTEGER,
  
  -- État
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (provider IN ('gemini', 'deepseek', 'groq', 'anthropic', 'openai', 'ollama')),
  CHECK (tier IN ('free', 'paid', 'enterprise'))
);

CREATE INDEX idx_api_keys_provider ON api_keys(provider);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
