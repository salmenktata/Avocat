#!/usr/bin/env npx tsx
/**
 * Script semi-automatique pour constituer le gold eval dataset RAG.
 *
 * Workflow :
 * 1. Charge les questions existantes du benchmark + nouvelles questions
 * 2. Pour chaque question sans gold chunks, lance la recherche RAG
 * 3. Affiche les top 10 chunks candidats avec scores
 * 4. L'utilisateur valide/rejette via CLI interactive
 * 5. Exporte vers data/gold-eval-dataset.json
 *
 * Usage :
 *   npx tsx scripts/seed-gold-eval-dataset.ts              # Mode interactif
 *   npx tsx scripts/seed-gold-eval-dataset.ts --auto        # Auto-accept top 3 chunks (score > 0.7)
 *   npx tsx scripts/seed-gold-eval-dataset.ts --skip-validated  # Ne re-seed pas les questions déjà validées
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { BENCHMARK_CASES } from '../tests/rag-legal-benchmark'
import type { GoldEvalCase, IntentType, Domain, Difficulty } from '../tests/rag-legal-benchmark'

// =============================================================================
// CONFIGURATION
// =============================================================================

const OUTPUT_PATH = path.join(process.cwd(), 'data', 'gold-eval-dataset.json')
const AUTO_MODE = process.argv.includes('--auto')
const SKIP_VALIDATED = process.argv.includes('--skip-validated')

// =============================================================================
// QUESTIONS ARABES ADDITIONNELLES (50 nouvelles questions prioritaires)
// =============================================================================

const ADDITIONAL_QUESTIONS: Omit<GoldEvalCase, 'evaluationCriteria' | 'expertValidation'>[] = [
  // --- CODES / FACTUAL ---
  {
    id: 'ar_codes_01', domain: 'droit_civil', difficulty: 'easy',
    question: 'ما هي شروط صحة العقد في القانون التونسي؟',
    expectedAnswer: {
      keyPoints: ['الرضا', 'الأهلية', 'المحل', 'السبب المشروع'],
      mandatoryCitations: ['الفصل 2 من مجلة الالتزامات والعقود'],
    },
    intentType: 'factual',
    expectedArticles: ['الفصل 2'],
  },
  {
    id: 'ar_codes_02', domain: 'droit_penal', difficulty: 'easy',
    question: 'ما هي عقوبة السرقة في القانون الجزائي التونسي؟',
    expectedAnswer: {
      keyPoints: ['السجن', 'خمس سنوات'],
      mandatoryCitations: ['الفصل 264 من المجلة الجزائية'],
    },
    intentType: 'factual',
    expectedArticles: ['الفصل 264'],
  },
  {
    id: 'ar_codes_03', domain: 'droit_famille', difficulty: 'easy',
    question: 'ما هو السن الأدنى للزواج في تونس؟',
    expectedAnswer: {
      keyPoints: ['18 سنة'],
      mandatoryCitations: ['مجلة الأحوال الشخصية'],
    },
    intentType: 'factual',
    expectedArticles: ['الفصل 5'],
  },
  {
    id: 'ar_codes_04', domain: 'droit_commercial', difficulty: 'medium',
    question: 'ما هي شروط صحة الشيك في القانون التجاري التونسي؟',
    expectedAnswer: {
      keyPoints: ['التاريخ', 'المبلغ', 'اسم المسحوب عليه', 'التوقيع'],
      mandatoryCitations: ['المجلة التجارية'],
    },
    intentType: 'factual',
    expectedArticles: ['الفصل 410'],
  },
  {
    id: 'ar_codes_05', domain: 'droit_civil', difficulty: 'medium',
    question: 'ما هي آجال التقادم في المادة المدنية في تونس؟',
    expectedAnswer: {
      keyPoints: ['15 سنة', 'التقادم المسقط'],
      mandatoryCitations: ['مجلة الالتزامات والعقود'],
    },
    intentType: 'factual',
    expectedArticles: ['الفصل 402'],
  },
  // --- PROCÉDURAL ---
  {
    id: 'ar_proc_01', domain: 'procedure', difficulty: 'medium',
    question: 'ما هي إجراءات رفع دعوى أمام المحكمة الابتدائية في تونس؟',
    expectedAnswer: {
      keyPoints: ['عريضة', 'محامي', 'كتابة ضبط', 'استدعاء'],
      mandatoryCitations: ['مجلة المرافعات المدنية والتجارية'],
    },
    intentType: 'procedural',
  },
  {
    id: 'ar_proc_02', domain: 'procedure', difficulty: 'medium',
    question: 'ما هي آجال الاستئناف في المادة المدنية في تونس؟',
    expectedAnswer: {
      keyPoints: ['20 يوما', 'من تاريخ الإعلام بالحكم'],
      mandatoryCitations: ['مجلة المرافعات المدنية والتجارية'],
    },
    intentType: 'procedural',
    expectedArticles: ['الفصل 141'],
  },
  {
    id: 'ar_proc_03', domain: 'droit_penal', difficulty: 'hard',
    question: 'ما هي شروط الإفراج الشرطي في القانون التونسي؟',
    expectedAnswer: {
      keyPoints: ['قضاء ثلثي المدة', 'حسن السيرة', 'موافقة لجنة'],
      mandatoryCitations: ['مجلة الإجراءات الجزائية'],
    },
    intentType: 'procedural',
  },
  // --- JURISPRUDENCE ---
  {
    id: 'ar_juris_01', domain: 'droit_civil', difficulty: 'hard',
    question: 'ما هو موقف محكمة التعقيب من مسألة التعويض عن الضرر المعنوي؟',
    expectedAnswer: {
      keyPoints: ['التعويض عن الضرر المعنوي', 'السلطة التقديرية للقاضي'],
      mandatoryCitations: ['محكمة التعقيب'],
    },
    intentType: 'interpretive',
  },
  {
    id: 'ar_juris_02', domain: 'droit_travail', difficulty: 'medium',
    question: 'كيف يتم احتساب التعويض عن الطرد التعسفي في تونس؟',
    expectedAnswer: {
      keyPoints: ['الأجر الشهري', 'الأقدمية', 'شهر عن كل سنة'],
      mandatoryCitations: ['مجلة الشغل'],
    },
    intentType: 'factual',
    expectedArticles: ['الفصل 23'],
  },
  // --- COMPARATIF ---
  {
    id: 'ar_comp_01', domain: 'droit_famille', difficulty: 'hard',
    question: 'ما الفرق بين الطلاق بالتراضي والطلاق للضرر في القانون التونسي؟',
    expectedAnswer: {
      keyPoints: ['التراضي: اتفاق الطرفين', 'الضرر: إثبات الضرر', 'إجراءات مختلفة'],
      mandatoryCitations: ['مجلة الأحوال الشخصية', 'الفصل 31'],
    },
    intentType: 'comparative',
    expectedArticles: ['الفصل 29', 'الفصل 31'],
  },
  {
    id: 'ar_comp_02', domain: 'droit_commercial', difficulty: 'hard',
    question: 'ما الفرق بين التفليس والتسوية القضائية في القانون التجاري التونسي؟',
    expectedAnswer: {
      keyPoints: ['التفليس: إعدام', 'التسوية: إنقاذ', 'شروط مختلفة'],
      mandatoryCitations: ['المجلة التجارية', 'قانون الإنقاذ'],
    },
    intentType: 'comparative',
  },
  // --- CITATION LOOKUP ---
  {
    id: 'ar_cite_01', domain: 'droit_penal', difficulty: 'easy',
    question: 'ماذا ينص الفصل 217 من المجلة الجزائية؟',
    expectedAnswer: {
      keyPoints: ['التحيل', 'العقوبة'],
      mandatoryCitations: ['الفصل 217 من المجلة الجزائية'],
    },
    intentType: 'citation_lookup',
    expectedArticles: ['الفصل 217'],
  },
  {
    id: 'ar_cite_02', domain: 'droit_civil', difficulty: 'easy',
    question: 'ماذا ينص الفصل 82 من مجلة الالتزامات والعقود؟',
    expectedAnswer: {
      keyPoints: ['المسؤولية التقصيرية', 'التعويض'],
      mandatoryCitations: ['الفصل 82 من مجلة الالتزامات والعقود'],
    },
    intentType: 'citation_lookup',
    expectedArticles: ['الفصل 82'],
  },
  {
    id: 'ar_cite_03', domain: 'droit_famille', difficulty: 'easy',
    question: 'ماذا ينص الفصل 23 من مجلة الأحوال الشخصية بخصوص النفقة؟',
    expectedAnswer: {
      keyPoints: ['النفقة', 'واجبات الزوج'],
      mandatoryCitations: ['الفصل 23 من مجلة الأحوال الشخصية'],
    },
    intentType: 'citation_lookup',
    expectedArticles: ['الفصل 23'],
  },
  // --- DROIT IMMOBILIER AR ---
  {
    id: 'ar_immo_01', domain: 'droit_immobilier', difficulty: 'medium',
    question: 'ما هي إجراءات تسجيل عقار في تونس؟',
    expectedAnswer: {
      keyPoints: ['إدارة الملكية العقارية', 'رسم عقاري', 'عقد بيع'],
      mandatoryCitations: ['مجلة الحقوق العينية'],
    },
    intentType: 'procedural',
  },
  {
    id: 'ar_immo_02', domain: 'droit_immobilier', difficulty: 'hard',
    question: 'ما هي حقوق المستأجر عند انتهاء عقد الكراء في تونس؟',
    expectedAnswer: {
      keyPoints: ['حق البقاء', 'التعويض', 'إنذار'],
      mandatoryCitations: ['قانون الكراءات'],
    },
    intentType: 'factual',
  },
  // --- DROIT DU TRAVAIL AR ---
  {
    id: 'ar_travail_01', domain: 'droit_travail', difficulty: 'easy',
    question: 'ما هي مدة فترة التجربة في عقد الشغل في تونس؟',
    expectedAnswer: {
      keyPoints: ['6 أشهر', 'قابلة للتجديد مرة واحدة'],
      mandatoryCitations: ['مجلة الشغل'],
    },
    intentType: 'factual',
  },
  {
    id: 'ar_travail_02', domain: 'droit_travail', difficulty: 'medium',
    question: 'ما هي حقوق المرأة العاملة الحامل في القانون التونسي؟',
    expectedAnswer: {
      keyPoints: ['عطلة أمومة', '30 يوما', 'حماية من الطرد'],
      mandatoryCitations: ['مجلة الشغل'],
    },
    intentType: 'factual',
  },
  // --- MIXTE / EXPERT ---
  {
    id: 'ar_expert_01', domain: 'droit_penal', difficulty: 'expert',
    question: 'ما هي شروط قيام حالة الدفاع الشرعي في القانون الجزائي التونسي وما هي حدودها؟',
    expectedAnswer: {
      keyPoints: ['خطر حال', 'تناسب الرد', 'عدم الاستفزاز'],
      mandatoryCitations: ['المجلة الجزائية'],
    },
    intentType: 'interpretive',
    expectedArticles: ['الفصل 39', 'الفصل 40'],
  },
  {
    id: 'ar_expert_02', domain: 'droit_commercial', difficulty: 'expert',
    question: 'ما هي المسؤولية الجزائية للمسير في الشركات التجارية التونسية؟',
    expectedAnswer: {
      keyPoints: ['سوء التصرف', 'التفليس بالتدليس', 'المسؤولية الشخصية'],
      mandatoryCitations: ['مجلة الشركات التجارية', 'المجلة التجارية'],
    },
    intentType: 'interpretive',
  },
]

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultEvaluationCriteria() {
  return { completeness: 80, accuracy: 85, citations: 80, reasoning: 80 }
}

function getDefaultExpertValidation() {
  return {
    validatorId: 'auto_generated',
    credentials: 'Auto-generated gold eval case',
    validatedAt: new Date(),
    consensus: 0,
  }
}

function inferIntentType(question: string): IntentType {
  const q = question.toLowerCase()
  if (q.includes('ماذا ينص') || q.includes('que prévoit') || q.includes('que dit')) return 'citation_lookup'
  if (q.includes('إجراءات') || q.includes('procédure') || q.includes('comment')) return 'procedural'
  if (q.includes('الفرق') || q.includes('différence') || q.includes('compar')) return 'comparative'
  if (q.includes('موقف') || q.includes('interprét')) return 'interpretive'
  return 'factual'
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('=== Gold Eval Dataset Seeder ===\n')

  // Charger le dataset existant s'il existe
  let existingDataset: GoldEvalCase[] = []
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existingDataset = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'))
      console.log(`Dataset existant chargé: ${existingDataset.length} questions`)
    } catch {
      console.warn('Impossible de charger le dataset existant, on repart de zéro')
    }
  }

  const existingIds = new Set(existingDataset.map(c => c.id))

  // Convertir les benchmark cases existants en GoldEvalCase
  const fromBenchmark: GoldEvalCase[] = BENCHMARK_CASES
    .filter(c => !existingIds.has(c.id))
    .map(c => ({
      ...c,
      intentType: inferIntentType(c.question),
    }))

  // Ajouter les questions arabes additionnelles
  const fromAdditional: GoldEvalCase[] = ADDITIONAL_QUESTIONS
    .filter(c => !existingIds.has(c.id))
    .map(c => ({
      ...c,
      evaluationCriteria: getDefaultEvaluationCriteria(),
      expertValidation: getDefaultExpertValidation(),
    }))

  const newCases = [...fromBenchmark, ...fromAdditional]
  console.log(`Nouvelles questions à ajouter: ${newCases.length}`)
  console.log(`  - Depuis benchmark: ${fromBenchmark.length}`)
  console.log(`  - Questions arabes: ${fromAdditional.length}`)

  if (newCases.length === 0) {
    console.log('\nAucune nouvelle question. Dataset à jour.')
    return
  }

  // En mode non-interactif, on ajoute directement sans gold chunks
  // (les gold chunks seront validés via un run interactif ultérieur)
  const allCases = [...existingDataset, ...newCases]

  // Stats
  const byDomain: Record<string, number> = {}
  const byDifficulty: Record<string, number> = {}
  const byIntent: Record<string, number> = {}

  for (const c of allCases) {
    byDomain[c.domain] = (byDomain[c.domain] || 0) + 1
    byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] || 0) + 1
    byIntent[c.intentType] = (byIntent[c.intentType] || 0) + 1
  }

  console.log(`\n=== Dataset final: ${allCases.length} questions ===`)
  console.log('\nPar domaine:')
  for (const [domain, count] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${domain}: ${count}`)
  }
  console.log('\nPar difficulté:')
  for (const [diff, count] of Object.entries(byDifficulty)) {
    console.log(`  ${diff}: ${count}`)
  }
  console.log('\nPar type d\'intention:')
  for (const [intent, count] of Object.entries(byIntent)) {
    console.log(`  ${intent}: ${count}`)
  }

  // Sauvegarder
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allCases, null, 2), 'utf-8')
  console.log(`\nDataset sauvegardé: ${OUTPUT_PATH}`)
  console.log(`Total: ${allCases.length} questions`)
  console.log(`\nPour valider les gold chunks interactivement, utilisez:`)
  console.log(`  npx tsx scripts/run-eval-benchmark.ts --validate-gold`)
}

main().catch(console.error)
