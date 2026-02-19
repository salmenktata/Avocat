/**
 * Migration des URLs IORT vers le format stable year/textType/issueNumber
 * Utilise exactement les mêmes fonctions hashUrl/generateIortUrl que le code principal.
 *
 * Usage: npx tsx scripts/migrate-iort-urls.ts [--dry-run]
 */
import { db } from '@/lib/db/postgres'
import { hashUrl } from '@/lib/web-scraper/content-extractor'
import { generateIortUrl } from '@/lib/web-scraper/iort-scraper-utils'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`[Migration IORT URLs] ${dryRun ? 'DRY RUN' : 'LIVE'} mode`)

  const pages = await db.query(
    `SELECT id, url, url_hash, title, structured_data
     FROM web_pages
     WHERE structured_data->>'source' = 'iort'`
  )

  console.log(`[Migration] ${pages.rows.length} pages IORT trouvées`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of pages.rows) {
    try {
      const sd = row.structured_data as {
        year?: number
        textType?: string
        issueNumber?: string | null
      }

      if (!sd.year || !sd.textType) {
        console.warn(`[Migration] Page ${row.id} sans year/textType, skip`)
        skipped++
        continue
      }

      const newUrl = generateIortUrl(
        Number(sd.year),
        sd.issueNumber || null,
        sd.textType,
        row.title as string,
      )
      const newUrlHash = hashUrl(newUrl)

      if (newUrlHash === row.url_hash) {
        skipped++
        continue
      }

      // Vérifier qu'il n'y a pas de conflit
      const conflict = await db.query(
        'SELECT id FROM web_pages WHERE url_hash = $1 AND id != $2',
        [newUrlHash, row.id],
      )

      if (conflict.rows.length > 0) {
        console.warn(`[Migration] Conflit URL pour page ${row.id} → ${newUrl} (déjà prise par ${conflict.rows[0].id})`)
        errors++
        continue
      }

      if (!dryRun) {
        await db.query(
          `UPDATE web_pages SET url = $2, url_hash = $3, canonical_url = $2, updated_at = NOW() WHERE id = $1`,
          [row.id, newUrl, newUrlHash],
        )
      }

      console.log(`[Migration] ${dryRun ? 'WOULD UPDATE' : 'Updated'}: ${row.url} → ${newUrl}`)
      updated++
    } catch (err) {
      console.error(`[Migration] Erreur page ${row.id}:`, err instanceof Error ? err.message : err)
      errors++
    }
  }

  console.log(`\n[Migration IORT URLs] Terminé: ${updated} mises à jour, ${skipped} inchangées, ${errors} erreurs`)

  const { closePool } = await import('@/lib/db/postgres')
  await closePool()
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
