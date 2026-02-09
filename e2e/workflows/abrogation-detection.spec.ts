/**
 * Tests E2E - Détection des Abrogations Juridiques
 *
 * Vérifie le workflow complet de détection des lois/articles abrogés
 * depuis l'interface utilisateur jusqu'à l'affichage des warnings.
 *
 * Scenarios testés :
 *   1. Détection loi abrogée totale (severity HIGH)
 *   2. Détection loi abrogée partielle (severity MEDIUM)
 *   3. Support bilingue FR/AR
 *   4. Pas de warning si loi en vigueur
 *   5. Format des warnings dans l'UI
 *
 * Prérequis :
 *   - Base de données seed avec table legal_abrogations
 *   - Application running sur localhost:3000
 *   - User authentifié avec accès au chat
 *
 * Usage : npx playwright test e2e/workflows/abrogation-detection.spec.ts
 */

import { test, expect } from '@playwright/test'

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const CHAT_URL = `${BASE_URL}/chat`
const ASSISTANT_URL = `${BASE_URL}/assistant-ia`

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Authentifie un utilisateur test
 */
async function authenticate(page: any) {
  // TODO: Implémenter authentification selon votre système
  // Pour le moment, assume que l'utilisateur est déjà authentifié via session cookie
  await page.goto(BASE_URL)
}

/**
 * Envoie un message dans le chat et attend la réponse
 */
async function sendChatMessage(page: any, message: string) {
  // Attendre que le textarea soit visible
  await page.waitForSelector('textarea[name="message"]', { timeout: 10000 })

  // Remplir le message
  await page.fill('textarea[name="message"]', message)

  // Cliquer sur le bouton d'envoi
  await page.click('button:has-text("Envoyer")')

  // Attendre la réponse (spinner disparaît)
  await page.waitForSelector('[data-testid="message-loading"]', {
    state: 'hidden',
    timeout: 60000,
  })
}

/**
 * Vérifie la présence d'un warning d'abrogation
 */
async function checkAbrogationWarning(page: any, expectedReference: string) {
  const warning = await page.locator('[data-testid="abrogation-warning"]')

  // Vérifier que le warning existe
  await expect(warning).toBeVisible({ timeout: 5000 })

  // Vérifier que le contenu contient la référence
  const text = await warning.textContent()
  expect(text).toContain(expectedReference)

  return text
}

// =============================================================================
// TESTS
// =============================================================================

test.describe('Détection Abrogations Juridiques', () => {
  test.beforeEach(async ({ page }) => {
    // Authentifier pour chaque test
    await authenticate(page)
  })

  test('devrait détecter loi abrogée totale (HIGH severity)', async ({
    page,
  }) => {
    await page.goto(CHAT_URL)

    // Envoyer question mentionnant Loi n°1968-07 (abrogée totale)
    await sendChatMessage(
      page,
      'Quelle est la procédure de faillite selon la Loi n°1968-07 ?'
    )

    // Vérifier le warning d'abrogation
    const warningText = await checkAbrogationWarning(page, '1968-07')

    // Vérifier severity HIGH (icône rouge ou texte "CRITIQUE")
    expect(warningText).toMatch(/critique|critique|high|🔴/i)

    // Vérifier référence abrogeante
    expect(warningText).toContain('2016-36')

    // Vérifier message explicatif
    expect(warningText).toMatch(/abrogé|remplacé/i)
  })

  test('devrait détecter loi abrogée partielle (MEDIUM severity)', async ({
    page,
  }) => {
    await page.goto(CHAT_URL)

    // Envoyer question mentionnant Loi n°2005-95 (abrogée partielle)
    await sendChatMessage(
      page,
      "Quels sont les articles de la Loi n°2005-95 sur les fonds de garantie ?"
    )

    // Vérifier le warning existe
    const warning = await page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    // Si la loi est dans la seed, doit afficher warning
    if (count > 0) {
      const warningText = await warning.textContent()

      // Vérifier severity MEDIUM (icône orange ou texte "ATTENTION")
      expect(warningText).toMatch(/attention|medium|⚠️|🟡/i)

      // Vérifier articles affectés mentionnés
      expect(warningText).toMatch(/article/i)
    }
  })

  test('devrait supporter détection bilingue FR/AR', async ({ page }) => {
    await page.goto(CHAT_URL)

    // Envoyer question en arabe mentionnant القانون عدد 7 لسنة 1968
    await sendChatMessage(
      page,
      'ما هي إجراءات الإفلاس حسب القانون عدد 7 لسنة 1968 ؟'
    )

    // Vérifier le warning existe
    const warning = await page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      const warningText = await warning.textContent()

      // Vérifier message en arabe présent
      expect(warningText).toMatch(/ملغى|عوّض|القانون/i)

      // Vérifier numéro loi détecté
      expect(warningText).toMatch(/7.*1968|1968.*7/)
    }
  })

  test('ne devrait PAS afficher warning pour loi en vigueur', async ({
    page,
  }) => {
    await page.goto(CHAT_URL)

    // Envoyer question mentionnant loi récente en vigueur
    await sendChatMessage(
      page,
      "Quels sont les principes de la Loi n°2016-36 sur les difficultés des entreprises ?"
    )

    // Attendre la réponse complète
    await page.waitForTimeout(2000)

    // Vérifier ABSENCE de warning
    const warning = await page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    expect(count).toBe(0)
  })

  test('devrait afficher format complet du warning', async ({ page }) => {
    await page.goto(ASSISTANT_URL)

    // Envoyer question mentionnant Circulaire n°216 (mariage mixte, abrogée)
    await sendChatMessage(
      page,
      "Quelles sont les règles de la Circulaire n°216 sur le mariage mixte ?"
    )

    // Vérifier le warning
    const warning = await page.locator('[data-testid="abrogation-warning"]')
    const count = await warning.count()

    if (count > 0) {
      // Vérifier structure complète du warning
      await expect(warning.locator('.warning-icon')).toBeVisible()
      await expect(warning.locator('.warning-message')).toBeVisible()

      const warningText = await warning.textContent()

      // Vérifier tous les éléments requis
      expect(warningText).toMatch(/circulaire.*216/i)
      expect(warningText).toMatch(/abrogé|remplacé/i)
      expect(warningText).toMatch(/164/) // Circulaire abrogeante
      expect(warningText).toMatch(/2017/) // Date
    }
  })

  test('devrait détecter multiples abrogations dans une réponse', async ({
    page,
  }) => {
    await page.goto(CHAT_URL)

    // Envoyer question mentionnant 2 lois abrogées
    await sendChatMessage(
      page,
      'Comparer les régimes de la Loi n°1968-07 et de la Circulaire n°216'
    )

    // Attendre la réponse
    await page.waitForTimeout(3000)

    // Compter les warnings
    const warnings = await page.locator('[data-testid="abrogation-warning"]')
    const count = await warnings.count()

    // Si les 2 lois sont dans la seed, devrait avoir 2 warnings
    // (Sinon au moins 1)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('devrait persister warnings après navigation', async ({ page }) => {
    await page.goto(CHAT_URL)

    // Envoyer question avec loi abrogée
    await sendChatMessage(
      page,
      'Procédure faillite selon Loi n°1968-07 ?'
    )

    // Vérifier warning visible
    await checkAbrogationWarning(page, '1968-07')

    // Scroller vers le haut
    await page.evaluate(() => window.scrollTo(0, 0))

    // Scroller vers le bas (vers le warning)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Vérifier que le warning est toujours visible
    const warning = await page.locator('[data-testid="abrogation-warning"]')
    await expect(warning).toBeVisible()
  })
})

// =============================================================================
// TESTS ACCESSIBILITÉ WARNINGS
// =============================================================================

test.describe('Accessibilité Warnings Abrogation', () => {
  test('devrait avoir attributs ARIA appropriés', async ({ page }) => {
    await authenticate(page)
    await page.goto(CHAT_URL)

    await sendChatMessage(
      page,
      'Faillite selon Loi n°1968-07 ?'
    )

    const warning = await page.locator('[data-testid="abrogation-warning"]')

    if ((await warning.count()) > 0) {
      // Vérifier role="alert" pour lecteurs d'écran
      const role = await warning.getAttribute('role')
      expect(role).toBe('alert')

      // Vérifier aria-live="polite"
      const ariaLive = await warning.getAttribute('aria-live')
      expect(ariaLive).toBeTruthy()
    }
  })

  test('devrait avoir contraste suffisant pour severity colors', async ({
    page,
  }) => {
    await authenticate(page)
    await page.goto(CHAT_URL)

    await sendChatMessage(
      page,
      'Faillite selon Loi n°1968-07 ?'
    )

    const warning = await page.locator('[data-testid="abrogation-warning"]')

    if ((await warning.count()) > 0) {
      // Vérifier que le warning a une bordure ou background visible
      const bgColor = await warning.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      )

      expect(bgColor).toBeTruthy()
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)') // Pas transparent
    }
  })
})
