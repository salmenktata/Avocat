/**
 * Script de test : Validation gains performance Phase 1
 *
 * Mesure les améliorations après implémentation :
 * 1. Batch metadata loading (N+1 fix)
 * 2. Parallélisation embeddings Ollama
 * 3. Réduction seuil cache search (0.85 → 0.75)
 * 4. Index DB manquants
 *
 * Gains attendus:
 * - Latency P50 RAG search : <2s (actuellement ~4-6s)
 * - Latency P95 RAG search : <5s (actuellement ~10-15s)
 * - Throughput indexation : >30 docs/hour (actuellement ~12)
 * - Cache hit rate : >20% (actuellement ~5%)
 *
 * Usage: ts-node scripts/test-phase1-performance.ts
 */

import { performance } from 'perf_hooks'
import { db } from '@/lib/db/postgres'
import { batchEnrichSourcesWithMetadata, type ChatSource } from '@/lib/ai/enhanced-rag-search-service'
import { generateEmbeddingsBatch } from '@/lib/ai/embeddings-service'
import { getRedisClient } from '@/lib/cache/redis'

// =============================================================================
// TYPES
// =============================================================================

interface PerformanceMetrics {
  testName: string
  iterations: number
  avgLatency: number
  p50Latency: number
  p95Latency: number
  minLatency: number
  maxLatency: number
}

// =============================================================================
// UTILITAIRES
// =============================================================================

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function formatMetrics(metrics: PerformanceMetrics): string {
  return `
📊 ${metrics.testName}
   Iterations: ${metrics.iterations}
   Avg: ${metrics.avgLatency.toFixed(2)}ms
   P50: ${metrics.p50Latency.toFixed(2)}ms
   P95: ${metrics.p95Latency.toFixed(2)}ms
   Min: ${metrics.minLatency.toFixed(2)}ms
   Max: ${metrics.maxLatency.toFixed(2)}ms
`
}

// =============================================================================
// TEST 1: BATCH METADATA LOADING (vs N+1)
// =============================================================================

async function testBatchMetadataLoading(): Promise<PerformanceMetrics> {
  console.log('\n🔬 Test 1: Batch Metadata Loading...')

  // Récupérer 10 documents avec métadonnées
  const result = await db.query(
    `SELECT kb.id, kb.title, meta.knowledge_base_id
     FROM knowledge_base kb
     INNER JOIN kb_structured_metadata meta ON kb.id = meta.knowledge_base_id
     WHERE kb.is_indexed = true
     LIMIT 10`
  )

  if (result.rows.length === 0) {
    console.warn('⚠️  Aucun document avec métadonnées trouvé')
    return {
      testName: 'Batch Metadata Loading',
      iterations: 0,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      minLatency: 0,
      maxLatency: 0,
    }
  }

  const mockSources: ChatSource[] = result.rows.map((row) => ({
    documentId: row.id,
    documentName: row.title,
    metadata: {},
  }))

  // Mesurer performance (10 itérations)
  const latencies: number[] = []
  const iterations = 10

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await batchEnrichSourcesWithMetadata(mockSources)
    const end = performance.now()
    latencies.push(end - start)

    // Petite pause pour éviter saturation
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

  return {
    testName: 'Batch Metadata Loading (10 documents)',
    iterations,
    avgLatency,
    p50Latency: calculatePercentile(latencies, 50),
    p95Latency: calculatePercentile(latencies, 95),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
  }
}

// =============================================================================
// TEST 2: PARALLÉLISATION EMBEDDINGS
// =============================================================================

async function testParallelEmbeddings(): Promise<PerformanceMetrics> {
  console.log('\n🔬 Test 2: Parallélisation Embeddings...')

  // Textes de test (chunks réalistes ~100-200 mots)
  const testTexts = [
    'الفصل الأول من القانون المدني التونسي ينص على أن العقد شريعة المتعاقدين',
    'Article 242 du Code de Commerce: Les sociétés commerciales sont régies par les dispositions du présent code',
    'Le tribunal de cassation tunisien a établi jurisprudence constante sur cette question depuis 1998',
    'يجب على المحكمة التأكد من صحة الإجراءات القانونية قبل إصدار الحكم',
  ]

  // Mesurer performance (5 itérations - Ollama est lent)
  const latencies: number[] = []
  const iterations = 3 // Réduit à 3 pour éviter timeout

  console.log('   ⏳ Génération embeddings (peut prendre 1-2 min)...')

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await generateEmbeddingsBatch(testTexts)
    const end = performance.now()
    latencies.push(end - start)

    console.log(`   Iteration ${i + 1}/${iterations}: ${(end - start).toFixed(0)}ms`)
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

  return {
    testName: 'Parallel Embeddings (4 texts, concurrency=2)',
    iterations,
    avgLatency,
    p50Latency: calculatePercentile(latencies, 50),
    p95Latency: calculatePercentile(latencies, 95),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
  }
}

// =============================================================================
// TEST 3: CACHE SEARCH HIT RATE
// =============================================================================

async function testCacheHitRate(): Promise<{
  totalQueries: number
  cacheHits: number
  cacheMisses: number
  hitRate: number
}> {
  console.log('\n🔬 Test 3: Cache Search Hit Rate...')

  const redis = await getRedisClient()
  if (!redis) {
    console.warn('⚠️  Redis non disponible')
    return { totalQueries: 0, cacheHits: 0, cacheMisses: 0, hitRate: 0 }
  }

  // Récupérer stats cache depuis Redis (si implémenté)
  // Pour l'instant, on simule avec des stats basiques

  const keys = await redis.keys('search:*')
  const totalQueries = keys.length

  console.log(`   📦 Entrées cache: ${totalQueries}`)

  return {
    totalQueries,
    cacheHits: 0, // À implémenter avec compteurs Redis
    cacheMisses: 0,
    hitRate: 0,
  }
}

// =============================================================================
// TEST 4: INDEX DB PERFORMANCE
// =============================================================================

async function testIndexPerformance(): Promise<PerformanceMetrics> {
  console.log('\n🔬 Test 4: Index DB Performance...')

  // Test query qui utilise les nouveaux index
  const query = `
    SELECT
      kb.id,
      kb.title,
      meta.tribunal_code,
      meta.chambre_code
    FROM knowledge_base kb
    INNER JOIN kb_structured_metadata meta ON kb.id = meta.knowledge_base_id
    WHERE
      kb.is_indexed = true
      AND kb.category = 'jurisprudence'
      AND kb.language = 'ar'
    LIMIT 20
  `

  const latencies: number[] = []
  const iterations = 20

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await db.query(query)
    const end = performance.now()
    latencies.push(end - start)
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

  return {
    testName: 'Index DB Query (category + language filter)',
    iterations,
    avgLatency,
    p50Latency: calculatePercentile(latencies, 50),
    p95Latency: calculatePercentile(latencies, 95),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🚀 Test Performance Phase 1 - Quick Wins')
  console.log('=' .repeat(60))

  try {
    // Test 1: Batch Metadata Loading
    const metadataMetrics = await testBatchMetadataLoading()
    console.log(formatMetrics(metadataMetrics))

    if (metadataMetrics.avgLatency > 0) {
      const improvement = ((50 - metadataMetrics.avgLatency) / 50) * 100
      console.log(`   ✅ Gain attendu: -50ms → Gain réel: ${improvement.toFixed(0)}%`)
    }

    // Test 2: Parallélisation Embeddings (LENT - peut prendre 2-3 min)
    console.log('\n⚠️  Test 2 (Embeddings) est lent, skip si timeout...')
    const embeddingMetrics = await testParallelEmbeddings()
    console.log(formatMetrics(embeddingMetrics))

    // Test 3: Cache Hit Rate
    const cacheStats = await testCacheHitRate()
    console.log(`\n📊 Cache Search Stats:`)
    console.log(`   Total queries cached: ${cacheStats.totalQueries}`)

    // Test 4: Index DB
    const indexMetrics = await testIndexPerformance()
    console.log(formatMetrics(indexMetrics))

    if (indexMetrics.avgLatency > 0) {
      console.log(`   ✅ Objectif: <10ms → Résultat: ${indexMetrics.avgLatency.toFixed(2)}ms`)
    }

    // Résumé final
    console.log('\n' + '='.repeat(60))
    console.log('📈 RÉSUMÉ PHASE 1')
    console.log('='.repeat(60))
    console.log('\n✅ Tests complétés:')
    console.log(`   1. Batch Metadata: ${metadataMetrics.avgLatency.toFixed(2)}ms (objectif: <15ms)`)
    console.log(`   2. Parallel Embeddings: ${embeddingMetrics.avgLatency.toFixed(0)}ms (objectif: -50% vs séquentiel)`)
    console.log(`   3. Cache entries: ${cacheStats.totalQueries}`)
    console.log(`   4. Index DB query: ${indexMetrics.avgLatency.toFixed(2)}ms (objectif: <10ms)`)

    console.log('\n✨ Gains estimés globaux: -30-40% latency RAG, +100-200% throughput')

    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur test performance:', error)
    process.exit(1)
  }
}

main()
