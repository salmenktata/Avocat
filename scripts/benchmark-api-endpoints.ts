/**
 * Script de Benchmarks API Endpoints
 *
 * Sprint 5 - Performance & Lazy Loading
 *
 * Teste les performances des 3 API endpoints créés en Sprint 4 :
 * - /api/client/legal-reasoning
 * - /api/client/kb/search
 * - /api/client/jurisprudence/timeline
 *
 * Usage :
 *   npm run benchmark:api
 *   BENCHMARK_RUNS=10 npm run benchmark:api
 */

import { performance } from 'perf_hooks'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.BENCHMARK_BASE_URL || 'http://localhost:7002'
const RUNS = parseInt(process.env.BENCHMARK_RUNS || '5', 10)
const AUTH_TOKEN = process.env.BENCHMARK_AUTH_TOKEN // JWT token si nécessaire

// Cibles de performance
const PERFORMANCE_TARGETS = {
  'legal-reasoning': 5000, // 5s max (appel LLM inclus)
  'kb-search': 500, // 500ms max
  'timeline': 1000, // 1s max
}

// =============================================================================
// TYPES
// =============================================================================

interface BenchmarkResult {
  endpoint: string
  method: string
  runs: number
  durations: number[]
  min: number
  max: number
  mean: number
  median: number
  p95: number
  p99: number
  target: number
  passed: boolean
  errors: number
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateStats(durations: number[]): {
  min: number
  max: number
  mean: number
  median: number
  p95: number
  p99: number
} {
  const sorted = [...durations].sort((a, b) => a - b)
  const len = sorted.length

  return {
    min: sorted[0],
    max: sorted[len - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / len,
    median: sorted[Math.floor(len / 2)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
  }
}

async function benchmarkEndpoint(
  endpoint: string,
  method: 'GET' | 'POST',
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmarking ${method} ${endpoint} (${RUNS} runs)...`)

  const durations: number[] = []
  let errors = 0

  // Build URL
  let url = `${BASE_URL}${endpoint}`
  if (queryParams) {
    const params = new URLSearchParams(queryParams)
    url += `?${params.toString()}`
  }

  // Warmup (1 run)
  console.log('  🔥 Warmup...')
  await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    // Ignore warmup errors
  })

  // Actual runs
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`\r  ⏱️  Run ${i + 1}/${RUNS}...`)

    const start = performance.now()

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      const end = performance.now()
      const duration = end - start

      if (!response.ok) {
        errors++
        console.warn(`\n  ⚠️  Run ${i + 1} failed: ${response.status} ${response.statusText}`)
      } else {
        durations.push(duration)
      }
    } catch (error) {
      errors++
      console.error(`\n  ❌ Run ${i + 1} error:`, error)
    }
  }

  process.stdout.write('\r  ✅ Completed!\n')

  // Calculate stats
  const stats = calculateStats(durations)

  // Determine target
  const targetKey = endpoint.split('/').pop() as keyof typeof PERFORMANCE_TARGETS
  const target = PERFORMANCE_TARGETS[targetKey] || 1000

  return {
    endpoint,
    method,
    runs: RUNS,
    durations,
    ...stats,
    target,
    passed: stats.p95 <= target,
    errors,
  }
}

function printResults(results: BenchmarkResult[]) {
  console.log('\n\n' + '='.repeat(80))
  console.log('📊 BENCHMARK RESULTS')
  console.log('='.repeat(80))

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m'
    const resetColor = '\x1b[0m'

    console.log(`\n${statusColor}${status}${resetColor} ${result.method} ${result.endpoint}`)
    console.log(`  Runs:       ${result.runs} (${result.errors} errors)`)
    console.log(`  Min:        ${result.min.toFixed(2)}ms`)
    console.log(`  Max:        ${result.max.toFixed(2)}ms`)
    console.log(`  Mean:       ${result.mean.toFixed(2)}ms`)
    console.log(`  Median:     ${result.median.toFixed(2)}ms`)
    console.log(`  P95:        ${result.p95.toFixed(2)}ms`)
    console.log(`  P99:        ${result.p99.toFixed(2)}ms`)
    console.log(`  Target:     ${result.target}ms`)
    console.log(`  Status:     ${result.passed ? 'Under target' : 'Exceeds target'}`)
  })

  console.log('\n' + '='.repeat(80))

  // Summary
  const passed = results.filter((r) => r.passed).length
  const total = results.length
  const passRate = ((passed / total) * 100).toFixed(0)

  console.log(`\n📈 SUMMARY: ${passed}/${total} endpoints passed (${passRate}%)`)

  if (passed === total) {
    console.log('🎉 All endpoints meet performance targets!')
  } else {
    console.log('⚠️  Some endpoints need optimization.')
  }

  console.log('\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🚀 Starting API Benchmark Suite')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log(`   Runs per endpoint: ${RUNS}`)
  console.log(`   Auth: ${AUTH_TOKEN ? 'Enabled' : 'Disabled'}`)

  const results: BenchmarkResult[] = []

  // Benchmark 1: Legal Reasoning
  results.push(
    await benchmarkEndpoint('/api/client/legal-reasoning', 'POST', {
      question: 'Quelle est la prescription en matière civile ?',
      maxDepth: 2,
      language: 'fr',
    })
  )

  // Benchmark 2: KB Search (POST)
  results.push(
    await benchmarkEndpoint('/api/client/kb/search', 'POST', {
      query: 'prescription civile',
      filters: { category: 'codes' },
      limit: 20,
    })
  )

  // Benchmark 3: KB Search (GET)
  results.push(
    await benchmarkEndpoint('/api/client/kb/search', 'GET', undefined, {
      q: 'prescription',
      limit: '20',
    })
  )

  // Benchmark 4: Timeline (POST)
  results.push(
    await benchmarkEndpoint('/api/client/jurisprudence/timeline', 'POST', {
      filters: { domain: 'civil' },
      limit: 100,
      includeStats: true,
    })
  )

  // Benchmark 5: Timeline (GET)
  results.push(
    await benchmarkEndpoint('/api/client/jurisprudence/timeline', 'GET', undefined, {
      domain: 'civil',
      limit: '100',
    })
  )

  // Print results
  printResults(results)

  // Exit with error code if some failed
  const allPassed = results.every((r) => r.passed)
  process.exit(allPassed ? 0 : 1)
}

// Run
main().catch((error) => {
  console.error('❌ Benchmark suite failed:', error)
  process.exit(1)
})
