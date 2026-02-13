/**
 * Script de debug pour analyser le HTML de legislation.tn
 */

import { chromium } from 'playwright'
import * as fs from 'fs'

async function debugLegislationHTML() {
  const url = 'http://www.legislation.tn/fr/search?q=abroge+impot'

  console.log(`🔍 Fetching: ${url}\n`)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const html = await page.content()

    // Sauvegarder le HTML pour analyse
    fs.writeFileSync('debug-legislation.html', html, 'utf-8')
    console.log('✅ HTML sauvegardé dans debug-legislation.html')

    // Analyser la structure
    const textContent = await page.evaluate(() => document.body.textContent)

    console.log('\n📊 Statistiques:')
    console.log(`   Taille HTML: ${html.length} caractères`)
    console.log(`   Contient "abroge": ${html.includes('abroge') ? 'OUI' : 'NON'}`)
    console.log(`   Contient "loi": ${html.includes('loi') ? 'OUI' : 'NON'}`)
    console.log(`   Contient "القانون": ${html.includes('القانون') ? 'OUI' : 'NON'}`)

    // Chercher des patterns de lois
    const loiMatches = html.match(/loi\s+n°?\s*\d{4}-\d+/gi) || []
    console.log(`\n📋 Lois trouvées: ${loiMatches.length}`)
    if (loiMatches.length > 0) {
      console.log('   Exemples:', loiMatches.slice(0, 5))
    }

    // Chercher des titres de résultats
    const titles = await page.evaluate(() => {
      const selectors = ['h1', 'h2', 'h3', '.result-title', '.search-result', 'article', '.document-title']
      const found: string[] = []

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)
        elements.forEach(el => {
          const text = el.textContent?.trim()
          if (text && text.length > 10 && text.length < 200) {
            found.push(`${selector}: ${text.substring(0, 100)}`)
          }
        })
      }

      return found.slice(0, 10)
    })

    console.log('\n📝 Titres trouvés:')
    titles.forEach(t => console.log(`   ${t}`))

    await browser.close()

  } catch (error) {
    console.error('❌ Erreur:', error)
    await browser.close()
  }
}

debugLegislationHTML().catch(console.error)
