#!/usr/bin/env tsx
/**
 * Test de recherche KB pour query légitime défense
 * Analyse pourquoi aucun document n'est trouvé
 */

import 'dotenv/config'
import { searchKnowledgeBase } from '@/lib/ai/knowledge-base-service'

const QUERY = `وقع شجار ليلي أمام نادٍ، انتهى بإصابة خطيرة ثم وفاة لاحقًا، والمتهم يؤكد أنه كان يدافع عن نفسه بعد أن تعرض لاعتداء جماعي. توجد تسجيلات كاميرا من زوايا مختلفة: أحدها يظهر الضحية يهاجم أولًا، وآخر يظهر المتهم يوجّه ضربة بعد تراجع الخطر، وشاهد رئيسي يغيّر أقواله لاحقًا مدعيًا أنه تعرض للتهديد. الملف يتطلب تحديد لحظة الخطر "الحال" وهل الرد كان متناسبًا أم تجاوز حدود الدفاع الشرعي، مع اعتماد تقارير الطب الشرعي لتقدير آلية الإصابة، ومقارنة زمن التسجيلات، وتحليل تناقض الأقوال، إضافة إلى بحث مسألة التأثير على الشهود وبطلان بعض الإجراءات إن كانت المعاينات ناقصة.`

async function testSearch() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║     TEST RECHERCHE KB - LÉGITIME DÉFENSE                       ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()

  console.log('📝 Query (arabe) :')
  console.log(QUERY.substring(0, 200) + '...')
  console.log()

  try {
    console.log('🔍 Recherche dans la KB...')
    console.log()

    const results = await searchKnowledgeBase(QUERY, {
      maxResults: 15,
      includeMetadata: true,
    })

    console.log(`✅ ${results.length} résultats trouvés`)
    console.log()

    if (results.length === 0) {
      console.log('❌ AUCUN RÉSULTAT TROUVÉ')
      console.log()
      console.log('🔍 Causes possibles :')
      console.log('  1. Pas de documents sur la légitime défense dans la KB')
      console.log('  2. Seuil de similarité trop élevé (défaut: 0.30 pour arabe)')
      console.log('  3. Embeddings ne capturent pas bien le contexte juridique')
      console.log('  4. Documents pas encore indexés (cron désactivé)')
      console.log()
      console.log('💡 Recommandations :')
      console.log('  - Vérifier les documents disponibles dans KB')
      console.log('  - Tester avec une query plus simple (ex: "الدفاع الشرعي")')
      console.log('  - Réduire le seuil de similarité temporairement')
      return
    }

    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║                      RÉSULTATS DÉTAILLÉS                       ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log()

    results.forEach((result, index) => {
      console.log(`▓▓▓ Résultat ${index + 1}/${results.length} ▓▓▓`)
      console.log(`Score: ${(result.similarity * 100).toFixed(1)}%`)
      console.log(`Source: ${result.metadata?.source || 'N/A'}`)
      console.log(`Catégorie: ${result.metadata?.category || 'N/A'}`)
      console.log(`Titre: ${result.metadata?.title?.substring(0, 100) || 'N/A'}`)
      console.log()
      console.log(`Contenu (150 premiers caractères):`)
      console.log(result.content.substring(0, 150) + '...')
      console.log()
      console.log('─'.repeat(70))
      console.log()
    })

    // Analyse des scores
    const scores = results.map(r => r.similarity)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const maxScore = Math.max(...scores)
    const minScore = Math.min(...scores)

    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║                     ANALYSE DES SCORES                         ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log()
    console.log(`Score maximum: ${(maxScore * 100).toFixed(1)}%`)
    console.log(`Score minimum: ${(minScore * 100).toFixed(1)}%`)
    console.log(`Score moyen: ${(avgScore * 100).toFixed(1)}%`)
    console.log()

    // Seuils de pertinence
    const excellent = results.filter(r => r.similarity >= 0.70).length
    const bon = results.filter(r => r.similarity >= 0.50 && r.similarity < 0.70).length
    const moyen = results.filter(r => r.similarity >= 0.30 && r.similarity < 0.50).length
    const faible = results.filter(r => r.similarity < 0.30).length

    console.log('Distribution par qualité :')
    console.log(`  Excellent (≥70%) : ${excellent}`)
    console.log(`  Bon (50-69%)     : ${bon}`)
    console.log(`  Moyen (30-49%)   : ${moyen}`)
    console.log(`  Faible (<30%)    : ${faible}`)
    console.log()

    if (maxScore < 0.30) {
      console.log('⚠️  TOUS LES SCORES < 30% (seuil par défaut)')
      console.log('    → Aucun résultat ne sera retourné à l\'utilisateur')
      console.log()
    }

    // Catégories trouvées
    const categories = new Set(results.map(r => r.metadata?.category).filter(Boolean))
    console.log(`Catégories trouvées: ${Array.from(categories).join(', ') || 'Aucune'}`)
    console.log()

  } catch (error) {
    console.error('❌ ERREUR:', error)
    if (error instanceof Error) {
      console.error('Message:', error.message)
      console.error('Stack:', error.stack)
    }
  }
}

// Exécuter le test
testSearch()
  .then(() => {
    console.log('✅ Test terminé')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
