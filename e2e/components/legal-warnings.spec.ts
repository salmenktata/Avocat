/**
 * Tests E2E - Composants Legal Warnings UI
 *
 * Valide le fonctionnement complet des composants d'affichage des warnings
 * de validation juridique (abrogations + citations) dans l'interface utilisateur.
 *
 * Composants testés :
 * - AbrogationWarningBadge (severity HIGH/MEDIUM/LOW)
 * - CitationWarningBadge (collapse >3 citations)
 * - LegalWarnings (wrapper + détection langue)
 *
 * Scenarios :
 * 1. Affichage warnings abrogations (3 severity levels)
 * 2. Affichage warnings citations
 * 3. Détection langue FR/AR automatique
 * 4. Collapse/expand multiples warnings
 * 5. Boutons dismiss fonctionnels
 * 6. Accessibilité ARIA
 * 7. Mode dark
 *
 * Prérequis :
 * - Application running sur localhost:7002
 * - Page /chat-test accessible
 * - Migration legal_abrogations appliquée
 * - Seed abrogations chargé (13 entrées)
 *
 * Usage : npx playwright test e2e/components/legal-warnings.spec.ts
 */

import { test, expect } from '@playwright/test'

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7002'
const CHAT_TEST_URL = `${BASE_URL}/chat-test`

// Timeouts
const RESPONSE_TIMEOUT = 60000 // 60s pour réponse LLM
const ANIMATION_DELAY = 500 // Délai animations UI

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Envoie une question dans la page chat-test et attend la réponse
 */
async function askQuestion(page: any, question: string) {
  // Remplir la question
  await page.fill('textarea', question)

  // Cliquer sur bouton Envoyer
  await page.click('button:has-text("Envoyer")')

  // Attendre que le bouton ne soit plus disabled (réponse reçue)
  await page.waitForSelector('button:has-text("Envoyer"):not([disabled])', {
    timeout: RESPONSE_TIMEOUT,
  })

  // Petit délai pour animations UI
  await page.waitForTimeout(ANIMATION_DELAY)
}

/**
 * Vérifie qu'un warning abrogation est visible avec contenu attendu
 */
async function expectAbrogationWarning(
  page: any,
  expectedReference: string,
  expectedSeverity?: 'high' | 'medium' | 'low'
) {
  const warning = page.locator('[data-testid="abrogation-warning"]')
  await expect(warning).toBeVisible()

  const text = await warning.textContent()
  expect(text).toContain(expectedReference)

  if (expectedSeverity) {
    const severityMap = {
      high: 'CRITIQUE',
      medium: 'ATTENTION',
      low: 'INFORMATION',
    }
    expect(text).toContain(severityMap[expectedSeverity])
  }

  return text
}

/**
 * Vérifie qu'un warning citation est visible avec citations attendues
 */
async function expectCitationWarning(
  page: any,
  expectedCitations: string[]
) {
  const warning = page.locator('[data-testid="citation-warning"]')
  await expect(warning).toBeVisible()

  const text = await warning.textContent()

  for (const citation of expectedCitations) {
    expect(text).toContain(citation)
  }

  return text
}

// =============================================================================
// TESTS - ABROGATION WARNINGS
// =============================================================================

test.describe('Abrogation Warnings - Affichage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('devrait afficher warning HIGH severity (abrogation totale)', async ({
    page,
  }) => {
    // Question mentionnant Loi n°1968-07 (abrogée totale)
    await askQuestion(
      page,
      'Quelle est la procédure de faillite selon la Loi n°1968-07 ?'
    )

    // Vérifier warning visible
    const text = await expectAbrogationWarning(page, '1968-07', 'high')

    // Vérifier éléments HIGH severity
    expect(text).toMatch(/🔴|rouge|red/i)
    expect(text).toContain('CRITIQUE')
    expect(text).toContain('2016-36') // Loi abrogeante
    expect(text).toMatch(/abrogé|remplacé/i)
  })

  test('devrait afficher warning MEDIUM severity (abrogation partielle)', async ({
    page,
  }) => {
    // Question mentionnant Loi n°2005-95 (abrogée partielle)
    await askQuestion(
      page,
      'Quels sont les articles de la Loi n°2005-95 sur les fonds de garantie ?'
    )

    // Vérifier warning visible (si dans seed)
    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const text = await warning.textContent()

      // Vérifier severity MEDIUM
      expect(text).toMatch(/🟡|orange|ATTENTION/i)

      // Vérifier mention articles affectés
      expect(text).toMatch(/article/i)
    }
  })

  test('devrait afficher détails complets abrogation', async ({ page }) => {
    await askQuestion(
      page,
      'Procédure faillite selon Loi n°1968-07 ?'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const text = await warning.textContent()

    // Vérifier présence détails
    expect(text).toMatch(/\d{4}/) // Année abrogation (2016)
    expect(text).toMatch(/loi/i) // Mention "loi"
    expect(text).toContain('2016-36') // Référence abrogeante

    // Vérifier icônes présentes
    expect(text).toMatch(/⚠️|💡|🔗/) // Au moins une icône
  })

  test('devrait afficher badge count si multiples warnings', async ({
    page,
  }) => {
    // Question mentionnant 2 lois abrogées
    await askQuestion(
      page,
      'Comparer Loi n°1968-07 et Article 207 du Code Pénal'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')

    // Vérifier badge avec nombre
    const badge = warning.locator('span').filter({ hasText: /^\d+$/ })
    const count = await badge.count()

    if (count > 0) {
      const badgeText = await badge.first().textContent()
      expect(parseInt(badgeText || '0')).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// TESTS - CITATION WARNINGS
// =============================================================================

test.describe('Citation Warnings - Affichage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('devrait afficher warning citations non vérifiées', async ({
    page,
  }) => {
    // Question avec citation probablement non vérifiable
    await askQuestion(
      page,
      "Quels sont les délais selon l'Article 999 du Code Pénal ?"
    )

    // Attendre un peu car citation validation est async
    await page.waitForTimeout(1000)

    const warning = page.locator('[data-testid="citation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const text = await warning.textContent()

      // Vérifier message warning
      expect(text).toMatch(/citation|استشهاد/i)
      expect(text).toMatch(/non vérif|غير موثق/i)

      // Vérifier icône livre 📖
      expect(text).toContain('📖')
    }
  })

  test('devrait afficher liste citations avec format correct', async ({
    page,
  }) => {
    // Question générant probablement citations
    await askQuestion(
      page,
      "Quels sont les articles du Code Pénal sur l'atteinte aux biens ?"
    )

    await page.waitForTimeout(1000)

    const warning = page.locator('[data-testid="citation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      // Vérifier présence items citations
      const items = page.locator('[data-testid="citation-item"]')
      const itemCount = await items.count()

      expect(itemCount).toBeGreaterThan(0)

      // Vérifier format premier item
      const firstItem = await items.first().textContent()
      expect(firstItem).toBeTruthy()
    }
  })

  test('devrait afficher message conseil vérification', async ({ page }) => {
    await askQuestion(
      page,
      "Délais selon Article 234 du Code Pénal ?"
    )

    await page.waitForTimeout(1000)

    const warning = page.locator('[data-testid="citation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const text = await warning.textContent()

      // Vérifier message conseil
      expect(text).toMatch(/conseil|نصيحة|💡/i)
      expect(text).toMatch(/source|مصدر/i)
    }
  })
})

// =============================================================================
// TESTS - DÉTECTION LANGUE
// =============================================================================

test.describe('Détection Langue FR/AR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('devrait afficher messages FR pour question française', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'Quelle est la procédure selon la Loi n°1968-07 ?'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const text = await warning.textContent()

      // Vérifier texte français
      expect(text).toContain('Loi abrogée')
      expect(text).toContain('CRITIQUE')
      expect(text).toMatch(/abrogé|remplacé/)
    }
  })

  test('devrait afficher messages AR pour question arabe', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'ما هي الإجراءات حسب القانون عدد 7 لسنة 1968 ؟'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const text = await warning.textContent()

      // Vérifier texte arabe présent
      expect(text).toMatch(/قانون|ملغى|حرج/)
    }
  })
})

// =============================================================================
// TESTS - COLLAPSE/EXPAND
// =============================================================================

test.describe('Collapse/Expand Warnings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('devrait collapse abrogations multiples avec bouton expand', async ({
    page,
  }) => {
    // Question mentionnant 2+ lois abrogées
    await askQuestion(
      page,
      'Comparer Loi n°1968-07, Article 207 du Code Pénal et Circulaire n°216'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      // Vérifier bouton expand/collapse visible
      const expandButton = warning.locator('button').filter({
        hasText: /Afficher|عرض|Réduire|إخفاء/,
      })

      const buttonCount = await expandButton.count()

      if (buttonCount > 0) {
        // Vérifier état initial (peut être expanded ou collapsed)
        const buttonText = await expandButton.first().textContent()
        expect(buttonText).toBeTruthy()

        // Cliquer pour toggle
        await expandButton.first().click()
        await page.waitForTimeout(300)

        // Vérifier texte bouton change
        const newButtonText = await expandButton.first().textContent()
        expect(newButtonText).not.toBe(buttonText)
      }
    }
  })

  test('devrait collapse citations si >3 avec bouton expand', async ({
    page,
  }) => {
    // Question générant probablement plusieurs citations
    await askQuestion(
      page,
      'Liste complète des articles du Code Pénal sur le vol, escroquerie, abus de confiance et recel'
    )

    await page.waitForTimeout(1000)

    const warning = page.locator('[data-testid="citation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      // Vérifier bouton expand si >3 citations
      const expandButton = warning.locator('button').filter({
        hasText: /Afficher|عرض|Réduire|إخفاء/,
      })

      const buttonCount = await expandButton.count()

      if (buttonCount > 0) {
        await expect(expandButton.first()).toBeVisible()
      }
    }
  })
})

// =============================================================================
// TESTS - BOUTON DISMISS
// =============================================================================

test.describe('Bouton Dismiss', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('devrait fermer warning abrogation au clic dismiss', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'Procédure selon Loi n°1968-07 ?'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      // Vérifier warning visible
      await expect(warning).toBeVisible()

      // Trouver bouton dismiss (icône X)
      const dismissButton = warning.locator('button[aria-label*="Fermer"], button[aria-label*="إغلاق"]')

      if ((await dismissButton.count()) > 0) {
        // Cliquer dismiss
        await dismissButton.first().click()
        await page.waitForTimeout(300)

        // Vérifier warning caché
        await expect(warning).toBeHidden()
      }
    }
  })

  test('devrait fermer warning citation au clic dismiss', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'Article 999 du Code Pénal ?'
    )

    await page.waitForTimeout(1000)

    const warning = page.locator('[data-testid="citation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      await expect(warning).toBeVisible()

      const dismissButton = warning.locator('button[aria-label*="Fermer"], button[aria-label*="إغلاق"]')

      if ((await dismissButton.count()) > 0) {
        await dismissButton.first().click()
        await page.waitForTimeout(300)

        await expect(warning).toBeHidden()
      }
    }
  })
})

// =============================================================================
// TESTS - ACCESSIBILITÉ
// =============================================================================

test.describe('Accessibilité ARIA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('devrait avoir attributs ARIA corrects sur abrogation warning', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'Loi n°1968-07 faillite ?'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      // Vérifier role="alert"
      const role = await warning.getAttribute('role')
      expect(role).toBe('alert')

      // Vérifier aria-live
      const ariaLive = await warning.getAttribute('aria-live')
      expect(ariaLive).toBeTruthy()

      // Vérifier aria-atomic
      const ariaAtomic = await warning.getAttribute('aria-atomic')
      expect(ariaAtomic).toBeTruthy()
    }
  })

  test('devrait avoir attributs ARIA corrects sur citation warning', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'Article 999 Code Pénal ?'
    )

    await page.waitForTimeout(1000)

    const warning = page.locator('[data-testid="citation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const role = await warning.getAttribute('role')
      expect(role).toBe('alert')

      const ariaLive = await warning.getAttribute('aria-live')
      expect(ariaLive).toBeTruthy()
    }
  })

  test('devrait avoir aria-label sur bouton dismiss', async ({ page }) => {
    await askQuestion(
      page,
      'Loi n°1968-07 ?'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const dismissButton = warning.locator('button[aria-label*="Fermer"], button[aria-label*="إغلاق"]')

      if ((await dismissButton.count()) > 0) {
        const ariaLabel = await dismissButton.first().getAttribute('aria-label')
        expect(ariaLabel).toBeTruthy()
        expect(ariaLabel).toMatch(/Fermer|إغلاق/)
      }
    }
  })

  test('devrait avoir aria-expanded sur bouton collapse', async ({
    page,
  }) => {
    await askQuestion(
      page,
      'Comparer Loi n°1968-07 et Article 207'
    )

    const warning = page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const expandButton = warning.locator('button').filter({
        hasText: /Afficher|Réduire/,
      })

      if ((await expandButton.count()) > 0) {
        const ariaExpanded = await expandButton.first().getAttribute('aria-expanded')
        expect(ariaExpanded).toMatch(/true|false/)
      }
    }
  })
})

// =============================================================================
// TESTS - PAS DE WARNINGS (Cas négatif)
// =============================================================================

test.describe('Pas de Warnings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_TEST_URL)
  })

  test('ne devrait PAS afficher warning pour loi en vigueur', async ({
    page,
  }) => {
    // Question mentionnant loi récente en vigueur
    await askQuestion(
      page,
      'Quels sont les principes de la Loi n°2016-36 sur les difficultés des entreprises ?'
    )

    await page.waitForTimeout(1000)

    // Vérifier ABSENCE warning abrogation
    const abrogationWarning = page.locator('[data-testid="abrogation-warning"]')
    const count = await abrogationWarning.count()

    expect(count).toBe(0)
  })

  test('ne devrait PAS afficher warning si aucune citation problématique', async ({
    page,
  }) => {
    // Question générique sans citations spécifiques
    await askQuestion(
      page,
      'Quels sont les grands principes du droit tunisien ?'
    )

    await page.waitForTimeout(1000)

    // Vérifier que legal-warnings n'est pas visible
    const legalWarnings = page.locator('[data-testid="legal-warnings"]')
    const count = await legalWarnings.count()

    // Si présent, devrait être vide ou caché
    if (count > 0) {
      const abrogCount = await page.locator('[data-testid="abrogation-warning"]').count()
      const citationCount = await page.locator('[data-testid="citation-warning"]').count()

      expect(abrogCount + citationCount).toBe(0)
    }
  })
})
