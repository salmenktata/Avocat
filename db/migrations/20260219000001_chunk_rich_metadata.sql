-- Migration: Rich chunk metadata indexes + RAG eval results table
-- Sprint 1 - Fondations données, chunking, métriques

-- Index fonctionnel pour recherche par numéro d'article dans les métadonnées chunks
CREATE INDEX IF NOT EXISTS idx_kb_chunks_article_number
ON knowledge_base_chunks ((metadata->>'article_number'))
WHERE metadata->>'article_number' IS NOT NULL;

-- Table résultats d'évaluation RAG
CREATE TABLE IF NOT EXISTS rag_eval_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question TEXT NOT NULL,
  language TEXT DEFAULT 'ar',
  domain TEXT,
  difficulty TEXT,
  gold_chunk_ids TEXT[],
  retrieved_chunk_ids TEXT[],
  recall_at_1 FLOAT,
  recall_at_3 FLOAT,
  recall_at_5 FLOAT,
  recall_at_10 FLOAT,
  precision_at_5 FLOAT,
  mrr FLOAT,
  faithfulness_score FLOAT,
  citation_accuracy FLOAT,
  expected_answer TEXT,
  actual_answer TEXT,
  sources_returned JSONB,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_eval_run ON rag_eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_rag_eval_question ON rag_eval_results(question_id);

-- Index fonctionnel pour recherche par catégorie dans les métadonnées chunks
CREATE INDEX IF NOT EXISTS idx_kb_chunks_category
ON knowledge_base_chunks ((metadata->>'category'))
WHERE metadata->>'category' IS NOT NULL;
