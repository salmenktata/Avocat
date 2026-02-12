#!/bin/bash
#
# Script de réindexation documents longs en production
# Usage: ./scripts/prod-reindex-long-docs.sh [limit] [dry-run]
#
# Exemples:
#   ./scripts/prod-reindex-long-docs.sh 5 true   # Test dry-run sur 5 docs
#   ./scripts/prod-reindex-long-docs.sh 10 false # Réindexation réelle de 10 docs
#

set -e

LIMIT=${1:-5}
DRY_RUN=${2:-true}
SOURCE_ID="546d11c8-b3fd-4559-977b-c3572aede0e4"
VPS_HOST="root@84.247.165.187"

echo "🚀 Réindexation Documents Longs - Google Drive"
echo "=============================================="
echo "📊 Limite: $LIMIT documents"
echo "🧪 Dry-run: $DRY_RUN"
echo ""

# Créer le script Node.js qui sera exécuté dans le container
cat > /tmp/reindex-prod.mjs << 'EOFSCRIPT'
import { Pool } from 'pg';

const SOURCE_ID = process.env.SOURCE_ID;
const LIMIT = parseInt(process.env.LIMIT || '5');
const DRY_RUN = process.env.DRY_RUN === 'true';

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'qadhya',
  user: 'moncabinet',
  password: process.env.DB_PASSWORD,
});

async function reindexLongDocuments() {
  const client = await pool.connect();

  try {
    console.log(`\n📋 Récupération des ${LIMIT} documents les plus petits (mais >50KB)...\n`);

    const pagesResult = await client.query(
      `SELECT id, title, extracted_text, LENGTH(extracted_text) as text_length
       FROM web_pages
       WHERE web_source_id = $1
       AND status = 'failed'
       AND error_message LIKE '%trop long%'
       AND LENGTH(extracted_text) > 50000
       ORDER BY LENGTH(extracted_text) ASC
       LIMIT $2`,
      [SOURCE_ID, LIMIT]
    );

    const pages = pagesResult.rows;
    console.log(`✅ Trouvé ${pages.length} documents à traiter\n`);

    let totalSections = 0;
    let succeeded = 0;
    let failed = 0;

    for (const page of pages) {
      const sizeKB = Math.round(page.text_length / 1024);
      const estimatedSections = Math.ceil(page.text_length / 45000);

      console.log(`📄 ${page.title.substring(0, 40)}`);
      console.log(`   Taille: ${sizeKB}KB | Sections estimées: ${estimatedSections}`);

      if (DRY_RUN) {
        console.log(`   ✅ DRY RUN: ${estimatedSections} sections seraient créées`);
        totalSections += estimatedSections;
        succeeded++;
      } else {
        // En mode réel, on marquerait juste le document comme "à traiter"
        // La vraie réindexation se ferait via l'API avec embeddings
        try {
          await client.query(
            `UPDATE web_pages
             SET error_message = 'En attente de découpage automatique',
                 updated_at = NOW()
             WHERE id = $1`,
            [page.id]
          );
          console.log(`   ✅ Marqué pour réindexation`);
          totalSections += estimatedSections;
          succeeded++;
        } catch (err) {
          console.log(`   ❌ Erreur: ${err.message}`);
          failed++;
        }
      }
      console.log('');
    }

    console.log('\n📊 RÉSULTATS:');
    console.log('=============');
    console.log(`✅ Réussis: ${succeeded}/${pages.length}`);
    console.log(`❌ Échecs: ${failed}`);
    console.log(`✂️ Sections ${DRY_RUN ? 'estimées' : 'à créer'}: ${totalSections}`);
    console.log(`📦 Chunks estimés: ~${totalSections * 8}`);

    if (DRY_RUN) {
      console.log(`\n💡 Mode DRY RUN: Aucune modification effectuée`);
      console.log(`   Pour réindexation réelle: relancer avec dry-run=false`);
    } else {
      console.log(`\n⚠️  ATTENTION: Documents marqués mais pas encore réindexés`);
      console.log(`   Utiliser l'interface web pour lancer la réindexation complète`);
      console.log(`   https://qadhya.tn/super-admin/web-sources/maintenance`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

reindexLongDocuments().catch(err => {
  console.error('❌ ERREUR:', err);
  process.exit(1);
});
EOFSCRIPT

echo "📤 Copie du script sur le serveur..."
scp /tmp/reindex-prod.mjs "$VPS_HOST:/tmp/reindex-prod.mjs"

echo "🔧 Exécution dans le container..."
echo ""

ssh "$VPS_HOST" bash << EOFSSH
# Récupérer le mot de passe DB depuis .env
DB_PASSWORD=\$(grep "^DB_PASSWORD=" /opt/moncabinet/.env | cut -d= -f2 | tr -d '"')

# Copier et exécuter le script dans le container
docker cp /tmp/reindex-prod.mjs qadhya-nextjs:/tmp/reindex-prod.mjs

docker exec qadhya-nextjs bash -c "
  export SOURCE_ID='$SOURCE_ID'
  export LIMIT='$LIMIT'
  export DRY_RUN='$DRY_RUN'
  export DB_PASSWORD='\$DB_PASSWORD'
  node /tmp/reindex-prod.mjs
"

# Nettoyer
docker exec qadhya-nextjs rm -f /tmp/reindex-prod.mjs
rm -f /tmp/reindex-prod.mjs
EOFSSH

# Nettoyer local
rm -f /tmp/reindex-prod.mjs

echo ""
echo "✅ Script terminé"

# Afficher statistiques après exécution
if [ "$DRY_RUN" = "false" ]; then
  echo ""
  echo "📊 Statistiques mises à jour:"
  ssh "$VPS_HOST" "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \"
    SELECT
      COUNT(*) FILTER (WHERE status = 'failed' AND error_message LIKE '%trop long%') as docs_longs,
      COUNT(*) FILTER (WHERE error_message LIKE '%attente de découpage%') as en_attente,
      COUNT(*) FILTER (WHERE is_indexed = true) as total_indexes
    FROM web_pages
    WHERE web_source_id = '$SOURCE_ID';
  \""
fi
