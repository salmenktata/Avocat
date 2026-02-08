/**
 * Script de téléchargement et indexation des fichiers PDF
 * Télécharge les PDFs depuis les URLs sources, les stocke dans MinIO et les indexe
 *
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/download-and-index-files.ts
 */

import { db } from '@/lib/db/postgres'
import { uploadFile } from '@/lib/storage/minio'
import { parseFile } from '@/lib/web-scraper/file-parser-service'
import { normalizeText, detectTextLanguage } from '@/lib/web-scraper/content-extractor'
import { generateEmbeddingsBatch } from '@/lib/ai/embeddings-service'
import { chunkText } from '@/lib/ai/chunking-service'
import { isSemanticSearchEnabled } from '@/lib/ai/config'

const BUCKET = 'web-files'
const CONCURRENCY = 3
const MAX_FILES = 615

interface WebFile {
  id: string
  web_page_id: string
  web_source_id: string
  url: string
  filename: string
  file_type: string
  source_name: string
  category: string
}

async function downloadFile(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'QadhyaBot/1.0' },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.log(`   ⚠️ HTTP ${response.status} pour ${url}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.log(`   ⚠️ Erreur download: ${error}`)
    return null
  }
}

async function processFile(file: WebFile): Promise<{ downloaded: boolean; indexed: boolean; chunks: number; error?: string }> {
  console.log(`\n📄 [${file.source_name}] ${file.filename}`)

  // 1. Télécharger le fichier
  console.log(`   ⬇️ Téléchargement depuis ${file.url.substring(0, 60)}...`)
  const buffer = await downloadFile(file.url)

  if (!buffer) {
    await db.query(`UPDATE web_files SET download_error = $1 WHERE id = $2`, ['Téléchargement échoué', file.id])
    return { downloaded: false, indexed: false, chunks: 0, error: 'Téléchargement échoué' }
  }

  console.log(`   ✅ Téléchargé: ${(buffer.length / 1024).toFixed(1)} KB`)

  // 2. Stocker dans MinIO
  const minioPath = `${file.web_source_id}/${Date.now()}_${file.filename}`

  try {
    // Signature: uploadFile(file, path, metadata?, bucketName?)
    await uploadFile(buffer, minioPath, { contentType: `application/${file.file_type}` }, BUCKET)
    console.log(`   💾 Stocké dans MinIO: ${minioPath}`)
  } catch (error) {
    console.log(`   ❌ Erreur MinIO: ${error}`)
    await db.query(`UPDATE web_files SET download_error = $1 WHERE id = $2`, [`MinIO: ${error}`, file.id])
    return { downloaded: false, indexed: false, chunks: 0, error: `MinIO: ${error}` }
  }

  // Mettre à jour le fichier comme téléchargé
  await db.query(`
    UPDATE web_files
    SET is_downloaded = true, minio_path = $1, file_size = $2, downloaded_at = NOW()
    WHERE id = $3
  `, [minioPath, buffer.length, file.id])

  // 3. Parser le PDF
  console.log(`   🔍 Extraction du texte...`)
  let textContent: string
  let pageCount: number = 0

  try {
    const parsed = await parseFile(buffer, file.file_type)
    textContent = parsed.text
    pageCount = parsed.metadata?.pageCount || 0
    console.log(`   ✅ Extrait: ${textContent.length} caractères, ${pageCount} pages`)
  } catch (error) {
    console.log(`   ❌ Erreur parsing: ${error}`)
    await db.query(`UPDATE web_files SET parse_error = $1 WHERE id = $2`, [`Parse: ${error}`, file.id])
    return { downloaded: true, indexed: false, chunks: 0, error: `Parse: ${error}` }
  }

  if (!textContent || textContent.length < 50) {
    console.log(`   ⚠️ Contenu insuffisant`)
    await db.query(`UPDATE web_files SET parse_error = $1 WHERE id = $2`, ['Contenu insuffisant', file.id])
    return { downloaded: true, indexed: false, chunks: 0, error: 'Contenu insuffisant' }
  }

  // 4. Normaliser et détecter la langue
  const normalizedText = normalizeText(textContent)
  const detectedLang = detectTextLanguage(normalizedText)
  // Contrainte DB: seulement 'ar' ou 'fr' acceptés
  const language = detectedLang === 'fr' ? 'fr' : 'ar' // Défaut arabe pour les documents juridiques tunisiens
  const wordCount = normalizedText.split(/\s+/).length

  console.log(`   📝 ${wordCount} mots, langue: ${language}`)

  // 5. Créer le document dans knowledge_base
  const kbResult = await db.query<{ id: string }>(`
    INSERT INTO knowledge_base (
      title, full_text, category, source_file, language, metadata, is_indexed, file_name, file_type
    ) VALUES (
      $1, $2, $3, $4, $5, $6, true, $7, $8
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [
    file.filename.replace(/\.[^.]+$/, ''),
    normalizedText.substring(0, 50000), // Limiter la taille
    file.category || 'legislation',
    `web:${file.source_name}`,
    language,
    JSON.stringify({
      webFileId: file.id,
      webPageId: file.web_page_id,
      webSourceId: file.web_source_id,
      pageCount,
      wordCount,
      sourceUrl: file.url,
    }),
    file.filename,
    file.file_type,
  ])

  if (kbResult.rows.length === 0) {
    console.log(`   ⚠️ Document déjà existant`)
    return { downloaded: true, indexed: false, chunks: 0, error: 'Document existant' }
  }

  const kbId = kbResult.rows[0].id
  console.log(`   📚 Document KB créé: ${kbId}`)

  // 6. Chunking et embeddings
  if (!isSemanticSearchEnabled()) {
    console.log(`   ⚠️ Embeddings désactivés`)
    await db.query(`UPDATE web_files SET is_indexed = true, indexed_at = NOW(), knowledge_base_id = $1 WHERE id = $2`, [kbId, file.id])
    return { downloaded: true, indexed: true, chunks: 0 }
  }

  console.log(`   🧩 Création des chunks...`)
  const chunks = chunkText(normalizedText, { category: file.category })
  console.log(`   ✅ ${chunks.length} chunks créés`)

  // Générer les embeddings par batch
  console.log(`   🤖 Génération des embeddings...`)
  let chunksCreated = 0

  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5)
    const batchResult = await generateEmbeddingsBatch(batch.map(c => c.content))
    const embeddings = batchResult.embeddings

    for (let j = 0; j < batch.length; j++) {
      if (embeddings[j]) {
        await db.query(`
          INSERT INTO knowledge_base_chunks (
            knowledge_base_id, content, chunk_index, embedding, metadata
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          kbId,
          batch[j].content,
          i + j,
          JSON.stringify(embeddings[j]),
          JSON.stringify(batch[j].metadata),
        ])
        chunksCreated++
      }
    }
  }

  console.log(`   ✅ ${chunksCreated} chunks avec embeddings`)

  // 7. Mettre à jour le fichier
  await db.query(`
    UPDATE web_files
    SET is_indexed = true, indexed_at = NOW(), knowledge_base_id = $1,
        word_count = $2, chunks_count = $3, page_count = $4, text_content = $5
    WHERE id = $6
  `, [kbId, wordCount, chunksCreated, pageCount, normalizedText.substring(0, 10000), file.id])

  return { downloaded: true, indexed: true, chunks: chunksCreated }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║      TÉLÉCHARGEMENT ET INDEXATION DES FICHIERS PDF         ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  // Stats initiales
  const stats = await db.query<{ total: number; downloaded: number; indexed: number }>(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN is_downloaded THEN 1 END) as downloaded,
      COUNT(CASE WHEN is_indexed THEN 1 END) as indexed
    FROM web_files WHERE file_type = 'pdf'
  `)

  const s = stats.rows[0]
  console.log(`\n📊 Stats initiales: ${s.total} PDFs (${s.downloaded} téléchargés, ${s.indexed} indexés)`)

  // Récupérer les fichiers à traiter
  const files = await db.query<WebFile>(`
    SELECT wf.id, wf.web_page_id, wf.web_source_id, wf.url, wf.filename, wf.file_type,
           ws.name as source_name, ws.category
    FROM web_files wf
    JOIN web_sources ws ON wf.web_source_id = ws.id
    WHERE wf.is_downloaded = false AND wf.file_type = 'pdf'
    ORDER BY random()
    LIMIT $1
  `, [MAX_FILES])

  console.log(`\n📄 ${files.rows.length} fichiers à traiter (limite ${MAX_FILES})\n`)

  if (files.rows.length === 0) {
    console.log('✅ Tous les fichiers sont déjà téléchargés!')
    process.exit(0)
  }

  const startTime = Date.now()
  let totalDownloaded = 0
  let totalIndexed = 0
  let totalChunks = 0
  let totalErrors = 0

  // Traiter en parallèle par batch
  for (let i = 0; i < files.rows.length; i += CONCURRENCY) {
    const batch = files.rows.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(processFile))

    for (const r of results) {
      if (r.downloaded) totalDownloaded++
      if (r.indexed) totalIndexed++
      totalChunks += r.chunks
      if (r.error) totalErrors++
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  // Rapport final
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RAPPORT FINAL')
  console.log('═'.repeat(60))
  console.log(`   Durée:        ${duration}s`)
  console.log(`   Téléchargés:  ${totalDownloaded}/${files.rows.length}`)
  console.log(`   Indexés:      ${totalIndexed}`)
  console.log(`   Chunks:       ${totalChunks}`)
  console.log(`   Erreurs:      ${totalErrors}`)
  console.log(`   Vitesse:      ${(totalDownloaded / parseFloat(duration)).toFixed(2)} fichiers/s`)

  // Stats finales
  const finalStats = await db.query<{ downloaded: number; indexed: number; chunks: number }>(`
    SELECT
      COUNT(CASE WHEN is_downloaded THEN 1 END) as downloaded,
      COUNT(CASE WHEN is_indexed THEN 1 END) as indexed,
      COALESCE(SUM(chunks_count), 0) as chunks
    FROM web_files WHERE file_type = 'pdf'
  `)

  const fs = finalStats.rows[0]
  console.log(`\n📈 Total maintenant: ${fs.downloaded} téléchargés, ${fs.indexed} indexés, ${fs.chunks} chunks`)

  console.log('\n✨ Terminé!')
  process.exit(0)
}

main().catch((error) => {
  console.error('💥 Erreur fatale:', error)
  process.exit(1)
})
