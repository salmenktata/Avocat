#!/usr/bin/env tsx
/**
 * Script de génération des embeddings manquants avec OpenAI
 *
 * Génère les embeddings OpenAI pour tous les chunks qui n'en ont pas.
 * Beaucoup plus rapide qu'Ollama (API vs local).
 *
 * Usage :
 *   npx tsx scripts/generate-missing-embeddings-openai.ts [--batch-size=50] [--category=<category>]
 */

import { db } from '@/lib/db/db';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

interface ChunkToEmbed {
  id: string;
  knowledge_base_id: string;
  chunk_index: number;
  content: string;
  kb_title: string;
  kb_category: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Génère un embedding OpenAI pour un texte
 */
async function generateOpenAIEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Erreur génération embedding:', error);
    return null;
  }
}

/**
 * Récupère les chunks sans embeddings
 */
async function getChunksWithoutEmbeddings(category?: string): Promise<ChunkToEmbed[]> {
  console.log('🔍 Récupération des chunks sans embeddings...\n');

  let query = sql`
    SELECT
      kbc.id,
      kbc.knowledge_base_id,
      kbc.chunk_index,
      kbc.content,
      kb.title as kb_title,
      kb.category as kb_category
    FROM knowledge_base_chunks kbc
    INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE kb.is_active = true
    AND kb.is_indexed = true
    AND kbc.embedding IS NULL
  `;

  if (category) {
    query = sql`${query} AND kb.category = ${category}`;
  }

  query = sql`${query} ORDER BY kb.category, kb.title, kbc.chunk_index`;

  const results = await db.execute(query);
  return results.rows as any as ChunkToEmbed[];
}

/**
 * Met à jour un chunk avec son embedding
 */
async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  // Stocker dans embedding_openai (colonne 1536-dim)
  await db.execute(sql`
    UPDATE knowledge_base_chunks
    SET embedding_openai = ${JSON.stringify(embedding)}::vector(1536)
    WHERE id = ${chunkId}
  `);
}

/**
 * Traite un batch de chunks
 */
async function processBatch(
  chunks: ChunkToEmbed[],
  batchIndex: number,
  totalBatches: number
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Batch ${batchIndex}/${totalBatches} (${chunks.length} chunks)`);
  console.log('='.repeat(80));

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      // Générer l'embedding
      const embedding = await generateOpenAIEmbedding(chunk.content);

      if (!embedding) {
        console.log(`   ❌ [${i + 1}/${chunks.length}] Échec génération embedding`);
        failed++;
        continue;
      }

      // Mettre à jour en DB
      await updateChunkEmbedding(chunk.id, embedding);

      success++;

      // Log progression tous les 10 chunks
      if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
        console.log(`   ✅ [${i + 1}/${chunks.length}] ${chunk.kb_category} | ${chunk.kb_title.substring(0, 40)}`);
      }

      // Petit délai pour éviter rate limiting (OpenAI: 3000 RPM tier 1)
      await new Promise(resolve => setTimeout(resolve, 20)); // 50 req/s max

    } catch (error) {
      console.error(`   ❌ [${i + 1}/${chunks.length}] Erreur:`, error);
      failed++;
    }
  }

  return { success, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;
  const categoryArg = args.find(arg => arg.startsWith('--category='));
  const category = categoryArg ? categoryArg.split('=')[1] : undefined;
  const dryRun = args.includes('--dry-run');

  console.log('🚀 Génération des embeddings manquants avec OpenAI\n');
  console.log(`Configuration:`);
  console.log(`   - Batch size: ${batchSize}`);
  console.log(`   - Catégorie: ${category || 'toutes'}`);
  console.log(`   - Mode: ${dryRun ? 'DRY RUN (simulation)' : 'PRODUCTION'}`);
  console.log(`   - Modèle: text-embedding-3-small (1536-dim)`);
  console.log(`   - Rate limit: ~50 req/s (avec délai 20ms)\n`);

  // Vérifier la clé API
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquante dans .env');
    process.exit(1);
  }

  try {
    // Récupérer les chunks sans embeddings
    const chunks = await getChunksWithoutEmbeddings(category);

    if (chunks.length === 0) {
      console.log('✅ Aucun chunk sans embedding trouvé !\n');
      process.exit(0);
    }

    console.log(`📋 ${chunks.length} chunks sans embeddings trouvés\n`);

    // Statistiques par catégorie
    const byCategory = new Map<string, number>();
    chunks.forEach(chunk => {
      byCategory.set(chunk.kb_category, (byCategory.get(chunk.kb_category) || 0) + 1);
    });

    console.log('📊 Répartition par catégorie:');
    Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count} chunks`);
      });

    if (dryRun) {
      console.log('\n✅ DRY RUN terminé - Aucun embedding généré\n');
      process.exit(0);
    }

    // Estimation coût
    const estimatedCost = (chunks.length * 0.00002).toFixed(2); // $0.00002 per 1K tokens (estimé 1K tokens/chunk)
    const estimatedTime = Math.ceil(chunks.length / 50); // 50 req/s
    console.log(`\n💰 Coût estimé: ~$${estimatedCost}`);
    console.log(`⏱️  Temps estimé: ~${estimatedTime}s (${Math.ceil(estimatedTime / 60)}min)\n`);

    // Traiter par batch
    const totalBatches = Math.ceil(chunks.length / batchSize);
    let totalSuccess = 0;
    let totalFailed = 0;

    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
      const batchIndex = Math.floor(i / batchSize) + 1;

      const { success, failed } = await processBatch(batch, batchIndex, totalBatches);
      totalSuccess += success;
      totalFailed += failed;

      // Afficher progression
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const processed = i + batch.length;
      const progress = ((processed / chunks.length) * 100).toFixed(1);
      const rate = Math.round(processed / elapsed);

      console.log(`\n📈 Progression: ${processed}/${chunks.length} (${progress}%)`);
      console.log(`   Succès: ${totalSuccess} | Échecs: ${totalFailed}`);
      console.log(`   Vitesse: ${rate} chunks/s | Temps écoulé: ${elapsed}s\n`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    // Rapport final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RAPPORT FINAL');
    console.log('='.repeat(80) + '\n');
    console.log(`✅ Succès: ${totalSuccess}/${chunks.length} (${((totalSuccess / chunks.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Échecs: ${totalFailed}/${chunks.length} (${((totalFailed / chunks.length) * 100).toFixed(1)}%)`);
    console.log(`⏱️  Temps total: ${totalTime}s (${Math.ceil(totalTime / 60)}min)`);
    console.log(`⚡ Vitesse moyenne: ${Math.round(chunks.length / totalTime)} chunks/s\n`);

    // Vérification finale
    const remainingChunks = await getChunksWithoutEmbeddings(category);
    console.log(`📊 Chunks restants sans embeddings: ${remainingChunks.length}\n`);

    if (remainingChunks.length === 0) {
      console.log('🎉 Tous les embeddings ont été générés avec succès !\n');
    } else {
      console.log('⚠️  Il reste des chunks sans embeddings. Relancer le script si nécessaire.\n');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
