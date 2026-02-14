#!/bin/bash
# Script simple de test des clés API production (sans dépendances TypeScript)
# Exécute directement dans le container avec curl

set -eo pipefail

echo "🔍 Test Clés API Production (via Container Docker)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test Groq
echo "Test 1/6: Groq..."
GROQ_KEY=$(docker exec qadhya-nextjs printenv GROQ_API_KEY || echo "")
if [ -z "$GROQ_KEY" ]; then
  echo "❌ GROQ_API_KEY manquante"
else
  GROQ_RESULT=$(curl -s -w "\n%{http_code}" -X POST https://api.groq.com/openai/v1/chat/completions \
    -H "Authorization: Bearer $GROQ_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"test"}],"max_tokens":5}' \
    2>&1 || echo "error\n000")

  HTTP_CODE=$(echo "$GROQ_RESULT" | tail -1)
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Groq: FONCTIONNEL"
  else
    echo "❌ Groq: HTTP $HTTP_CODE"
  fi
fi
echo ""

# Test Gemini
echo "Test 2/6: Gemini..."
GEMINI_KEY=$(docker exec qadhya-nextjs printenv GOOGLE_API_KEY || echo "")
if [ -z "$GEMINI_KEY" ]; then
  echo "❌ GOOGLE_API_KEY manquante"
else
  GEMINI_RESULT=$(curl -s -w "\n%{http_code}" -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_KEY" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
    2>&1 || echo "error\n000")

  HTTP_CODE=$(echo "$GEMINI_RESULT" | tail -1)
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Gemini: FONCTIONNEL"
  else
    echo "❌ Gemini: HTTP $HTTP_CODE"
  fi
fi
echo ""

# Test OpenAI
echo "Test 3/6: OpenAI..."
OPENAI_KEY=$(docker exec qadhya-nextjs printenv OPENAI_API_KEY || echo "")
if [ -z "$OPENAI_KEY" ]; then
  echo "❌ OPENAI_API_KEY manquante"
else
  OPENAI_RESULT=$(curl -s -w "\n%{http_code}" -X POST https://api.openai.com/v1/embeddings \
    -H "Authorization: Bearer $OPENAI_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"text-embedding-3-small","input":"test"}' \
    2>&1 || echo "error\n000")

  HTTP_CODE=$(echo "$OPENAI_RESULT" | tail -1)
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ OpenAI: FONCTIONNEL"
  else
    echo "❌ OpenAI: HTTP $HTTP_CODE"
  fi
fi
echo ""

# Test DeepSeek
echo "Test 4/6: DeepSeek..."
DEEPSEEK_KEY=$(docker exec qadhya-nextjs printenv DEEPSEEK_API_KEY || echo "")
if [ -z "$DEEPSEEK_KEY" ]; then
  echo "❌ DEEPSEEK_API_KEY manquante"
else
  DEEPSEEK_RESULT=$(curl -s -w "\n%{http_code}" -X POST https://api.deepseek.com/v1/chat/completions \
    -H "Authorization: Bearer $DEEPSEEK_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}],"max_tokens":5}' \
    2>&1 || echo "error\n000")

  HTTP_CODE=$(echo "$DEEPSEEK_RESULT" | tail -1)
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ DeepSeek: FONCTIONNEL"
  else
    echo "❌ DeepSeek: HTTP $HTTP_CODE"
  fi
fi
echo ""

# Test Anthropic
echo "Test 5/6: Anthropic..."
ANTHROPIC_KEY=$(docker exec qadhya-nextjs printenv ANTHROPIC_API_KEY || echo "")
if [ -z "$ANTHROPIC_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY manquante"
else
  ANTHROPIC_RESULT=$(curl -s -w "\n%{http_code}" -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "Content-Type: application/json" \
    -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"test"}]}' \
    2>&1 || echo "error\n000")

  HTTP_CODE=$(echo "$ANTHROPIC_RESULT" | tail -1)
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Anthropic: FONCTIONNEL"
  else
    echo "❌ Anthropic: HTTP $HTTP_CODE"
  fi
fi
echo ""

# Test Ollama
echo "Test 6/6: Ollama..."
OLLAMA_BASE_URL=$(docker exec qadhya-nextjs printenv OLLAMA_BASE_URL || echo "http://host.docker.internal:11434")
OLLAMA_RESULT=$(docker exec qadhya-nextjs curl -s -w "\n%{http_code}" -X POST "$OLLAMA_BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:8b","prompt":"test","stream":false}' \
  2>&1 || echo "error\n000")

HTTP_CODE=$(echo "$OLLAMA_RESULT" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Ollama: FONCTIONNEL"
else
  echo "⚠️  Ollama: Non disponible (acceptable en production)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Vérification terminée"
