#!/bin/bash
#
# Script simplifié de réindexation documents longs
# Usage: ./scripts/prod-reindex-simple.sh [limit] [apply]
#
# Exemples:
#   ./scripts/prod-reindex-simple.sh 5        # Dry-run sur 5 docs
#   ./scripts/prod-reindex-simple.sh 10 apply # Marque 10 docs pour réindexation
#

set -e

LIMIT=${1:-5}
APPLY=${2:-""}
SOURCE_ID="546d11c8-b3fd-4559-977b-c3572aede0e4"
VPS_HOST="root@84.247.165.187"

echo "🚀 Analyse Documents Longs - Google Drive"
echo "=========================================="
echo "📊 Limite: $LIMIT documents"
if [ "$APPLY" = "apply" ]; then
  echo "⚠️  Mode: RÉEL (marquage pour réindexation)"
else
  echo "🧪 Mode: DRY-RUN (simulation seulement)"
fi
echo ""

# Statistiques AVANT
echo "📊 AVANT:"
ssh "$VPS_HOST" "docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \"
  SELECT
    '  Failed: ' || COUNT(*) FILTER (WHERE status = 'failed') ||
    ' | Trop longs: ' || COUNT(*) FILTER (WHERE error_message LIKE '%trop long%') ||
    ' | Indexés: ' || COUNT(*) FILTER (WHERE is_indexed = true)
  FROM web_pages
  WHERE web_source_id = '$SOURCE_ID';
\""

echo ""
echo "📋 Documents à traiter:"
echo ""

# Lister les documents
ssh "$VPS_HOST" "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \"
  SELECT
    ROW_NUMBER() OVER (ORDER BY LENGTH(extracted_text) ASC) as num,
    SUBSTRING(title, 1, 40) as titre,
    ROUND(LENGTH(extracted_text) / 1024.0) as taille_kb,
    CEIL(LENGTH(extracted_text) / 45000.0) as sections,
    CEIL(LENGTH(extracted_text) / 45000.0) * 8 as chunks
  FROM web_pages
  WHERE web_source_id = '$SOURCE_ID'
  AND status = 'failed'
  AND error_message LIKE '%trop long%'
  ORDER BY LENGTH(extracted_text) ASC
  LIMIT $LIMIT;
\""

if [ "$APPLY" = "apply" ]; then
  echo ""
  echo "⚠️  Marquage des documents pour réindexation..."

  ssh "$VPS_HOST" "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \"
    WITH docs_to_update AS (
      SELECT id
      FROM web_pages
      WHERE web_source_id = '$SOURCE_ID'
      AND status = 'failed'
      AND error_message LIKE '%trop long%'
      ORDER BY LENGTH(extracted_text) ASC
      LIMIT $LIMIT
    )
    UPDATE web_pages
    SET
      error_message = 'À réindexer avec découpage automatique',
      updated_at = NOW()
    FROM docs_to_update
    WHERE web_pages.id = docs_to_update.id;

    SELECT COUNT(*) as marques FROM docs_to_update;
  \""

  echo ""
  echo "📊 APRÈS:"
  ssh "$VPS_HOST" "docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \"
    SELECT
      '  Failed: ' || COUNT(*) FILTER (WHERE status = 'failed') ||
      ' | Trop longs: ' || COUNT(*) FILTER (WHERE error_message LIKE '%trop long%') ||
      ' | À réindexer: ' || COUNT(*) FILTER (WHERE error_message LIKE '%À réindexer%') ||
      ' | Indexés: ' || COUNT(*) FILTER (WHERE is_indexed = true)
    FROM web_pages
    WHERE web_source_id = '$SOURCE_ID';
  \""

  echo ""
  echo "✅ Documents marqués !"
  echo ""
  echo "🔗 Prochaine étape:"
  echo "   Aller sur https://qadhya.tn/super-admin/web-sources/maintenance"
  echo "   Et cliquer sur 'Réindexer Documents Longs' pour traiter les docs marqués"
else
  echo ""
  echo "💡 Mode DRY-RUN: Aucune modification"
  echo ""
  echo "Pour appliquer les changements:"
  echo "  $0 $LIMIT apply"
fi

echo ""
echo "✅ Script terminé"
