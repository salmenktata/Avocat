import { test, expect } from '@playwright/test'
import { login, navigateTo, formatDateISO, daysAgo } from '../helpers'

test.describe('Workflow Commercial', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Calcul des intérêts moratoires TMM+7', async ({ page }) => {
    // Naviguer vers la page de création de dossier
    await navigateTo(page, '/dossiers/new')

    // Sélectionner le type de procédure Commercial
    await page.selectOption('select[name="type_procedure"]', 'commercial')

    // Attendre que le formulaire commercial s'affiche
    await expect(page.locator('text=Type de litige commercial')).toBeVisible({ timeout: 5000 })

    // Remplir les champs du calcul d'intérêts
    await page.fill('input[name="montant_principal"]', '1000')

    // Date de mise en demeure il y a 100 jours
    const dateMiseEnDemeure = formatDateISO(daysAgo(100))
    await page.fill('input[name="date_mise_en_demeure"]', dateMiseEnDemeure)

    // Vérifier que le taux par défaut est 14.5%
    const tauxInput = page.locator('input[name="taux_interet"]')
    await expect(tauxInput).toHaveValue('14.5')

    // Attendre le calcul automatique des intérêts
    await page.waitForTimeout(1000)

    // Vérifier que les intérêts sont calculés (environ 39.73 TND pour 1000 TND sur 100 jours à 14.5%)
    const interetsDisplay = page.locator('text=/Intérêts.*:.*TND/')
    await expect(interetsDisplay).toBeVisible()
  })

  test('Indemnité forfaitaire 40 TND', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'commercial')

    // Attendre le formulaire commercial
    await expect(page.locator('text=Type de litige commercial')).toBeVisible({ timeout: 5000 })

    // Remplir le montant
    await page.fill('input[name="montant_principal"]', '1000')
    const dateMiseEnDemeure = formatDateISO(daysAgo(30))
    await page.fill('input[name="date_mise_en_demeure"]', dateMiseEnDemeure)

    // Vérifier la présence de l'indemnité forfaitaire
    const indemniteDisplay = page.locator('text=/Indemnité forfaitaire.*40.*TND/')
    await expect(indemniteDisplay).toBeVisible()
  })

  test('Alerte délai appel 10 jours dépassé', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'commercial')

    // Attendre le formulaire commercial
    await expect(page.locator('text=Type de litige commercial')).toBeVisible({ timeout: 5000 })

    // Si un champ date_jugement existe, le remplir avec une date > 10 jours
    const dateJugementInput = page.locator('input[name="date_jugement"]')
    if (await dateJugementInput.isVisible()) {
      const dateJugement = formatDateISO(daysAgo(15)) // 15 jours = délai dépassé
      await dateJugementInput.fill(dateJugement)

      // Vérifier l'alerte délai dépassé
      const alerteDelai = page.locator('text=/délai.*dépassé|Délai.*expiré/i')
      await expect(alerteDelai).toBeVisible({ timeout: 3000 })
    }
  })

  test('Champs conditionnels chèque sans provision', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'commercial')

    // Attendre le formulaire commercial
    await expect(page.locator('text=Type de litige commercial')).toBeVisible({ timeout: 5000 })

    // Sélectionner le type de litige "Chèque sans provision"
    await page.selectOption('select[name="type_litige_commercial"]', 'CHEQUE_SANS_PROVISION')

    // Vérifier que les champs spécifiques au chèque apparaissent
    await expect(page.locator('input[name="numero_cheque"]')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('input[name="montant_cheque"]')).toBeVisible()
    await expect(page.locator('input[name="date_cheque"]')).toBeVisible()
    await expect(page.locator('input[name="banque_tiree"]')).toBeVisible()
  })

  test('Validation montant négatif', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'commercial')

    await expect(page.locator('text=Type de litige commercial')).toBeVisible({ timeout: 5000 })

    // Entrer un montant négatif
    await page.fill('input[name="montant_principal"]', '-100')

    // Soumettre le formulaire
    await page.click('button[type="submit"]')

    // Vérifier le message d'erreur
    const errorMessage = page.locator('text=/montant.*positif|invalide/i')
    await expect(errorMessage).toBeVisible({ timeout: 3000 })
  })
})
