/**
 * Script de diagnostic pour identifier le problème de suppression des sources web
 *
 * Usage:
 *   npx tsx scripts/diagnose-delete-issue.ts
 */

import { db } from '@/lib/db/postgres'

async function main() {
  console.log('🔍 Diagnostic Suppression Sources Web')
  console.log('======================================\n')

  try {
    // 1. Vérifier les contraintes FK sur web_sources
    console.log('1️⃣  Contraintes Foreign Key sur web_sources:')
    console.log('─────────────────────────────────────────────')

    const fkQuery = `
      SELECT
        tc.table_name AS referencing_table,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'web_sources'
      ORDER BY tc.table_name
    `

    const fkResult = await db.query(fkQuery)

    if (fkResult.rows.length === 0) {
      console.log('✅ Aucune contrainte FK trouvée (ce qui est étrange)')
    } else {
      fkResult.rows.forEach(row => {
        const deleteAction = row.delete_rule === 'CASCADE' ? '✅ CASCADE' : '⚠️  ' + row.delete_rule
        console.log(`   ${row.referencing_table}.${row.column_name}`)
        console.log(`     → ON DELETE ${deleteAction}`)
      })
    }
    console.log()

    // 2. Vérifier les jobs en cours (crawl)
    console.log('2️⃣  Jobs de crawl en cours:')
    console.log('─────────────────────────────')

    const runningCrawlJobs = await db.query(`
      SELECT
        id,
        web_source_id,
        job_type,
        status,
        started_at,
        NOW() - started_at AS duration
      FROM web_crawl_jobs
      WHERE status IN ('queued', 'running')
      ORDER BY started_at DESC
      LIMIT 10
    `)

    if (runningCrawlJobs.rows.length === 0) {
      console.log('✅ Aucun job de crawl en cours')
    } else {
      console.log(`⚠️  ${runningCrawlJobs.rows.length} job(s) de crawl en cours:`)
      runningCrawlJobs.rows.forEach(job => {
        console.log(`   - Job ${job.id} (source: ${job.web_source_id})`)
        console.log(`     Type: ${job.job_type}, Status: ${job.status}`)
        console.log(`     Durée: ${job.duration}`)
      })
    }
    console.log()

    // 3. Vérifier les jobs d'indexation en cours
    console.log('3️⃣  Jobs d\'indexation en cours:')
    console.log('──────────────────────────────────')

    const runningIndexJobs = await db.query(`
      SELECT
        id,
        job_type,
        status,
        source_type,
        source_metadata->>'sourceId' AS source_id,
        created_at,
        started_at,
        NOW() - started_at AS duration
      FROM indexing_jobs
      WHERE status IN ('queued', 'running')
        AND source_type = 'web_page'
      ORDER BY created_at DESC
      LIMIT 10
    `)

    if (runningIndexJobs.rows.length === 0) {
      console.log('✅ Aucun job d\'indexation en cours')
    } else {
      console.log(`⚠️  ${runningIndexJobs.rows.length} job(s) d'indexation en cours:`)
      runningIndexJobs.rows.forEach(job => {
        console.log(`   - Job ${job.id} (source: ${job.source_id || 'N/A'})`)
        console.log(`     Type: ${job.job_type}, Status: ${job.status}`)
        console.log(`     Durée: ${job.duration}`)
      })
    }
    console.log()

    // 4. Lister toutes les sources web
    console.log('4️⃣  Liste des sources web:')
    console.log('────────────────────────────')

    const sources = await db.query(`
      SELECT
        id,
        name,
        base_url,
        category,
        is_active,
        (SELECT COUNT(*) FROM web_pages WHERE web_source_id = ws.id) AS pages_count,
        (SELECT COUNT(*) FROM knowledge_base WHERE metadata->>'sourceId' = ws.id::text) AS kb_count
      FROM web_sources ws
      ORDER BY name
    `)

    sources.rows.forEach(source => {
      console.log(`   ${source.is_active ? '🟢' : '🔴'} ${source.name} (${source.id})`)
      console.log(`     URL: ${source.base_url}`)
      console.log(`     Pages: ${source.pages_count}, KB: ${source.kb_count}`)
      console.log()
    })

    // 5. Vérifier les permissions
    console.log('5️⃣  Permissions utilisateur actuel:')
    console.log('──────────────────────────────────────')

    const permsResult = await db.query(`
      SELECT
        current_user,
        has_table_privilege(current_user, 'web_sources', 'DELETE') AS can_delete_sources,
        has_table_privilege(current_user, 'web_pages', 'DELETE') AS can_delete_pages,
        has_table_privilege(current_user, 'knowledge_base', 'DELETE') AS can_delete_kb
    `)

    const perms = permsResult.rows[0]
    console.log(`   User: ${perms.current_user}`)
    console.log(`   DELETE sur web_sources: ${perms.can_delete_sources ? '✅' : '❌'}`)
    console.log(`   DELETE sur web_pages: ${perms.can_delete_pages ? '✅' : '❌'}`)
    console.log(`   DELETE sur knowledge_base: ${perms.can_delete_kb ? '✅' : '❌'}`)
    console.log()

    // 6. Vérifier s'il y a des erreurs dans les logs
    console.log('6️⃣  Dernières erreurs dans crawl_logs:')
    console.log('────────────────────────────────────────')

    const errorLogs = await db.query(`
      SELECT
        web_source_id,
        severity,
        message,
        created_at
      FROM web_crawl_logs
      WHERE severity = 'error'
      ORDER BY created_at DESC
      LIMIT 5
    `)

    if (errorLogs.rows.length === 0) {
      console.log('✅ Aucune erreur récente')
    } else {
      errorLogs.rows.forEach(log => {
        console.log(`   [${log.created_at}] Source: ${log.web_source_id}`)
        console.log(`   ${log.message}`)
        console.log()
      })
    }

    console.log()
    console.log('✅ Diagnostic terminé')
    console.log()
    console.log('💡 Recommandations:')
    console.log('   1. Si des jobs sont en cours, attendez leur fin avant suppression')
    console.log('   2. Vérifiez les permissions de l\'utilisateur authentifié dans l\'app')
    console.log('   3. Consultez les logs Next.js pour voir l\'erreur exacte')
    console.log('   4. Testez avec: npx tsx scripts/test-delete-web-source.ts <sourceId> --dry-run')

  } catch (error) {
    console.error()
    console.error('❌ Erreur lors du diagnostic:')
    console.error(error)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
