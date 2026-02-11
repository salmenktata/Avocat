/**
 * Script de Mesure Bundle Size
 *
 * Sprint 5 - Performance & Lazy Loading
 *
 * Compare la taille du bundle avant/après lazy loading.
 *
 * Usage :
 *   npm run build
 *   npm run measure:bundle
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BUILD_DIR = join(process.cwd(), '.next')
const STATIC_DIR = join(BUILD_DIR, 'static')

// Composants lazy loaded à tracker
const LAZY_COMPONENTS = [
  'TimelineViewer',
  'DocumentExplorer',
  'Recharts', // Si utilisé
]

// =============================================================================
// TYPES
// =============================================================================

interface BundleInfo {
  path: string
  size: number
  sizeKB: number
  sizeMB: number
}

interface BundleSummary {
  totalSize: number
  totalSizeKB: number
  totalSizeMB: number
  files: BundleInfo[]
  lazyChunks: BundleInfo[]
}

// =============================================================================
// HELPERS
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function getAllFiles(dir: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath))
    } else if (stat.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

function analyzeBundles(): BundleSummary {
  const files: BundleInfo[] = []
  const lazyChunks: BundleInfo[] = []

  // Get all JS files in .next/static
  const jsFiles = getAllFiles(STATIC_DIR).filter(
    (f) => f.endsWith('.js') && !f.includes('.map')
  )

  for (const file of jsFiles) {
    const stat = statSync(file)
    const info: BundleInfo = {
      path: file.replace(process.cwd(), ''),
      size: stat.size,
      sizeKB: stat.size / 1024,
      sizeMB: stat.size / (1024 * 1024),
    }

    files.push(info)

    // Check if lazy chunk
    const fileName = file.split('/').pop() || ''
    const isLazy = LAZY_COMPONENTS.some(
      (comp) =>
        fileName.toLowerCase().includes(comp.toLowerCase()) ||
        fileName.includes('-lazy')
    )

    if (isLazy) {
      lazyChunks.push(info)
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return {
    totalSize,
    totalSizeKB: totalSize / 1024,
    totalSizeMB: totalSize / (1024 * 1024),
    files: files.sort((a, b) => b.size - a.size),
    lazyChunks,
  }
}

function printSummary(summary: BundleSummary) {
  console.log('\n' + '='.repeat(80))
  console.log('📦 BUNDLE SIZE ANALYSIS')
  console.log('='.repeat(80))

  console.log(`\n📊 Total Bundle Size: ${formatBytes(summary.totalSize)}`)
  console.log(`   Files: ${summary.files.length}`)

  // Top 10 largest files
  console.log('\n📈 Top 10 Largest Files:')
  summary.files.slice(0, 10).forEach((file, idx) => {
    console.log(`   ${idx + 1}. ${formatBytes(file.size).padStart(12)} - ${file.path}`)
  })

  // Lazy chunks
  if (summary.lazyChunks.length > 0) {
    console.log('\n🔄 Lazy Loaded Chunks:')
    const lazyTotalSize = summary.lazyChunks.reduce((sum, f) => sum + f.size, 0)
    console.log(`   Total: ${formatBytes(lazyTotalSize)}`)
    console.log(`   Files: ${summary.lazyChunks.length}`)

    summary.lazyChunks.forEach((chunk) => {
      console.log(`   - ${formatBytes(chunk.size).padStart(12)} - ${chunk.path}`)
    })

    // Estimated gain
    const percentGain = ((lazyTotalSize / summary.totalSize) * 100).toFixed(2)
    console.log(`\n   💡 Estimated Initial Bundle Reduction: ${percentGain}%`)
    console.log(`      (${formatBytes(lazyTotalSize)} removed from initial load)`)
  } else {
    console.log('\n⚠️  No lazy loaded chunks detected.')
    console.log('   Make sure to import components with TimelineViewerLazy/DocumentExplorerLazy')
  }

  // Page bundles
  const pageDir = join(BUILD_DIR, 'server', 'app')
  if (existsSync(pageDir)) {
    console.log('\n📄 Page Bundles:')

    const pages = [
      '(dashboard)/client/knowledge-base',
      '(dashboard)/client/jurisprudence-timeline',
    ]

    pages.forEach((page) => {
      const pagePath = join(pageDir, page, 'page.js')
      if (existsSync(pagePath)) {
        const stat = statSync(pagePath)
        console.log(`   ${formatBytes(stat.size).padStart(12)} - ${page}`)
      }
    })
  }

  console.log('\n' + '='.repeat(80))
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('🚀 Starting Bundle Size Measurement')

  // Check if build exists
  if (!existsSync(BUILD_DIR)) {
    console.error('❌ Build directory not found. Run `npm run build` first.')
    process.exit(1)
  }

  // Analyze bundles
  const summary = analyzeBundles()

  // Print results
  printSummary(summary)

  // Recommendations
  console.log('\n💡 Recommendations:')

  if (summary.lazyChunks.length === 0) {
    console.log('   1. Use TimelineViewerLazy and DocumentExplorerLazy in your pages')
    console.log('   2. Convert large components to lazy loaded versions')
  } else {
    console.log('   ✅ Lazy loading is active!')
  }

  const largeBundles = summary.files.filter((f) => f.sizeMB > 0.5)
  if (largeBundles.length > 0) {
    console.log(`   ⚠️  ${largeBundles.length} files exceed 500KB - consider code splitting`)
  }

  console.log('\n')
}

// Run
main()
