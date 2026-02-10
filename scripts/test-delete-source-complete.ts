#!/usr/bin/env node
/**
 * Script de test : Suppression complète d'une source web
 *
 * Teste la fonction deleteWebSourceComplete qui supprime :
 * - Documents Knowledge Base (avec chunks et embeddings)
 * - Fichiers MinIO
 * - Pages web (et métadonnées, versions, classifications)
 * - Jobs et logs de crawl
 * - La source web elle-même
 *
 * Usage:
 *   npm run test:delete-source -- <source-id>
 *   npm run test:delete-source -- <source-id> --preview-only
 *   npm run test:delete-source -- <source-id> --confirm
 */

import { getDeletePreview, deleteWebSourceComplete } from '@/lib/web-scraper/delete-service'

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

async function main() {
  const args = process.argv.slice(2)
  const sourceId = args[0]
  const previewOnly = args.includes('--preview-only')
  const confirm = args.includes('--confirm')

  if (!sourceId) {
    log('red', '❌ Erreur: ID de source requis')
    console.log('')
    console.log('Usage:')
    console.log('  npm run test:delete-source -- <source-id>')
    console.log('  npm run test:delete-source -- <source-id> --preview-only')
    console.log('  npm run test:delete-source -- <source-id> --confirm')
    console.log('')
    console.log('Options:')
    console.log('  --preview-only   Affiche ce qui serait supprimé sans supprimer')
    console.log('  --confirm        Supprime sans demander confirmation')
    process.exit(1)
  }

  log('cyan', '\n╔═══════════════════════════════════════════════════════════════╗')
  log('cyan', '║   TEST SUPPRESSION COMPLÈTE SOURCE WEB                         ║')
  log('cyan', '╚═══════════════════════════════════════════════════════════════╝\n')

  try {
    // =========================================================================
    // ÉTAPE 1 : Récupérer l'aperçu
    // =========================================================================

    log('blue', '📊 Récupération aperçu de suppression...\n')

    const preview = await getDeletePreview(sourceId)

    console.log(`${COLORS.bright}Source:${COLORS.reset}`)
    console.log(`  Nom: ${preview.sourceName}`)
    console.log(`  URL: ${preview.sourceUrl}`)
    console.log(`  ID:  ${sourceId}\n`)

    console.log(`${COLORS.bright}Ce qui sera supprimé:${COLORS.reset}`)
    console.log(`  📚 Documents Knowledge Base:    ${preview.stats.knowledgeBaseDocs}`)
    console.log(`  📄 Chunks KB (avec embeddings): ${preview.stats.knowledgeBaseChunks}`)
    console.log(`  🌐 Pages web:                   ${preview.stats.webPages}`)
    console.log(`  📁 Fichiers web:                ${preview.stats.webFiles}`)
    console.log(`  🔄 Jobs de crawl:               ${preview.stats.crawlJobs}`)
    console.log(`  📋 Logs de crawl:               ${preview.stats.crawlLogs}`)
    console.log(`  💾 Fichiers MinIO:              ${preview.stats.minioFiles}`)
    console.log(`  📏 Taille estimée:              ${preview.estimatedSize}\n`)

    // Mode preview-only : s'arrêter ici
    if (previewOnly) {
      log('green', '✅ Aperçu complété (mode --preview-only)')
      log('yellow', '💡 Pour supprimer réellement, retirez --preview-only')
      process.exit(0)
    }

    // =========================================================================
    // ÉTAPE 2 : Demander confirmation (sauf si --confirm)
    // =========================================================================

    if (!confirm) {
      log('yellow', '⚠️  ATTENTION: Cette opération est IRRÉVERSIBLE!')
      log('yellow', '⚠️  Toutes les données ci-dessus seront DÉFINITIVEMENT supprimées\n')

      const readline = await import('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const answer = await new Promise<string>((resolve) => {
        rl.question('Voulez-vous continuer? (tapez "OUI" en majuscules pour confirmer): ', resolve)
      })

      rl.close()

      if (answer !== 'OUI') {
        log('yellow', '\n❌ Suppression annulée par l\'utilisateur')
        process.exit(0)
      }
    }

    // =========================================================================
    // ÉTAPE 3 : Effectuer la suppression
    // =========================================================================

    log('blue', '\n🗑️  Suppression en cours...\n')

    const startTime = Date.now()
    const result = await deleteWebSourceComplete(sourceId)
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    // =========================================================================
    // ÉTAPE 4 : Afficher les résultats
    // =========================================================================

    console.log(`\n${COLORS.bright}Résultats de la suppression:${COLORS.reset}`)
    console.log(`  Durée: ${duration}s\n`)

    console.log(`${COLORS.bright}Statistiques:${COLORS.reset}`)
    console.log(`  📚 Documents KB supprimés:      ${result.stats.knowledgeBaseDocs}`)
    console.log(`  📄 Chunks KB supprimés:         ${result.stats.knowledgeBaseChunks}`)
    console.log(`  🌐 Pages web supprimées:        ${result.stats.webPages}`)
    console.log(`  📁 Fichiers web supprimés:      ${result.stats.webFiles}`)
    console.log(`  🔄 Jobs supprimés:              ${result.stats.crawlJobs}`)
    console.log(`  📋 Logs supprimés:              ${result.stats.crawlLogs}`)
    console.log(`  💾 Fichiers MinIO supprimés:   ${result.stats.minioFiles}\n`)

    if (result.errors.length > 0) {
      log('yellow', `⚠️  Erreurs rencontrées (${result.errors.length}):`)
      result.errors.forEach((error) => {
        console.log(`  - ${error}`)
      })
      console.log('')
    }

    if (result.success && result.sourceDeleted) {
      log('green', '✅ Source supprimée avec succès!')
      if (result.errors.length > 0) {
        log('yellow', '⚠️  Mais avec quelques erreurs (voir ci-dessus)')
      }
    } else if (!result.sourceDeleted) {
      log('red', '❌ Source non trouvée')
    } else {
      log('red', '❌ Échec de la suppression')
    }
  } catch (error) {
    log('red', `\n❌ Erreur: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
