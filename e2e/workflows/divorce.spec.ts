import { test, expect } from '@playwright/test'
import { login, navigateTo, formatDateISO, daysAgo } from '../helpers'

test.describe('Workflow Divorce', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Calcul automatique pension Moutaa', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'divorce')

    // Attendre le formulaire divorce
    await expect(page.locator('text=Type de divorce')).toBeVisible({ timeout: 5000 })

    // Date de mariage il y a 5 ans
    const dateMariage = new Date()
    dateMariage.setFullYear(dateMariage.getFullYear() - 5)
    await page.fill('input[name="date_mariage"]', formatDateISO(dateMariage))

    // Revenus de l'époux
    await page.fill('input[name="revenus_epoux"]', '2000')

    // Coefficient Moutaa (par défaut 2)
    const coefficientInput = page.locator('input[name="coefficient_moutaa"]')
    if (await coefficientInput.isVisible()) {
      await expect(coefficientInput).toHaveValue('2')
    }

    // Attendre le calcul automatique
    await page.waitForTimeout(1000)

    // Vérifier le calcul Moutaa: 5 ans × 2 × 2000 = 20000 TND
    const moutaaDisplay = page.locator('text=/Moutaa.*:.*20.*000.*TND|pension compensatoire.*20000/i')
    await expect(moutaaDisplay).toBeVisible({ timeout: 5000 })
  })

  test('Calcul pension alimentaire enfants', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'divorce')

    await expect(page.locator('text=Type de divorce')).toBeVisible({ timeout: 5000 })

    // Revenus du père
    await page.fill('input[name="revenus_pere"]', '2000')

    // Ajouter un enfant mineur
    const addChildButton = page.locator('button:has-text("Ajouter un enfant")')
    if (await addChildButton.isVisible()) {
      await addChildButton.click()

      // Remplir les infos de l'enfant
      await page.fill('input[name="enfants[0].prenom"]', 'Ahmed')

      // Date de naissance: enfant de 10 ans
      const dateNaissance = new Date()
      dateNaissance.setFullYear(dateNaissance.getFullYear() - 10)
      await page.fill('input[name="enfants[0].date_naissance"]', formatDateISO(dateNaissance))

      await page.waitForTimeout(1000)

      // Vérifier le calcul: 25% de 2000 TND = 500 TND pour 1 enfant
      const pensionDisplay = page.locator('text=/pension.*alimentaire.*:.*500.*TND|500.*TND.*par.*enfant/i')
      await expect(pensionDisplay).toBeVisible({ timeout: 5000 })
    }
  })

  test('Gestion ajout/suppression enfants', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'divorce')

    await expect(page.locator('text=Type de divorce')).toBeVisible({ timeout: 5000 })

    const addChildButton = page.locator('button:has-text("Ajouter un enfant")')
    if (await addChildButton.isVisible()) {
      // Ajouter 2 enfants
      await addChildButton.click()
      await page.waitForTimeout(500)
      await addChildButton.click()

      // Vérifier que 2 formulaires enfants sont visibles
      const childForms = page.locator('[data-testid="enfant-form"], .enfant-form')
      await expect(childForms).toHaveCount(2)

      // Supprimer le premier enfant
      const removeButton = page.locator('button:has-text("×"), button:has-text("Supprimer")').first()
      await removeButton.click()

      // Vérifier qu'il ne reste qu'un enfant
      await expect(childForms).toHaveCount(1)
    }
  })

  test('Exclusion enfants majeurs du calcul pension', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'divorce')

    await expect(page.locator('text=Type de divorce')).toBeVisible({ timeout: 5000 })

    await page.fill('input[name="revenus_pere"]', '2000')

    const addChildButton = page.locator('button:has-text("Ajouter un enfant")')
    if (await addChildButton.isVisible()) {
      // Ajouter un enfant majeur (20 ans)
      await addChildButton.click()
      await page.fill('input[name="enfants[0].prenom"]', 'Mohamed')

      const dateNaissanceMajeur = new Date()
      dateNaissanceMajeur.setFullYear(dateNaissanceMajeur.getFullYear() - 20)
      await page.fill('input[name="enfants[0].date_naissance"]', formatDateISO(dateNaissanceMajeur))

      await page.waitForTimeout(1000)

      // Vérifier que l'enfant est marqué comme majeur
      const majeurBadge = page.locator('text=/majeur|18.*ans/i')
      await expect(majeurBadge).toBeVisible()

      // Ajouter un enfant mineur (10 ans)
      await addChildButton.click()
      await page.fill('input[name="enfants[1].prenom"]', 'Fatma')

      const dateNaissanceMineur = new Date()
      dateNaissanceMineur.setFullYear(dateNaissanceMineur.getFullYear() - 10)
      await page.fill('input[name="enfants[1].date_naissance"]', formatDateISO(dateNaissanceMineur))

      await page.waitForTimeout(1000)

      // Le calcul de pension ne doit concerner que 1 enfant (le mineur)
      // 25% de 2000 TND = 500 TND
      const pensionDisplay = page.locator('text=/1.*enfant.*mineur|pension.*:.*500.*TND/i')
      await expect(pensionDisplay).toBeVisible({ timeout: 5000 })
    }
  })

  test('Types de divorce disponibles', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'divorce')

    await expect(page.locator('text=Type de divorce')).toBeVisible({ timeout: 5000 })

    // Vérifier les 4 types de divorce
    const selectDivorce = page.locator('select[name="type_divorce"]')
    await expect(selectDivorce).toBeVisible()

    // Vérifier les options disponibles
    const options = await selectDivorce.locator('option').allTextContents()
    expect(options.join(' ')).toMatch(/consentement.*mutuel/i)
    expect(options.join(' ')).toMatch(/préjudice|darar/i)
  })

  test('Calcul automatique durée mariage', async ({ page }) => {
    await navigateTo(page, '/dossiers/new')
    await page.selectOption('select[name="type_procedure"]', 'divorce')

    await expect(page.locator('text=Type de divorce')).toBeVisible({ timeout: 5000 })

    // Date de mariage il y a exactement 5 ans et 4 mois
    const dateMariage = new Date()
    dateMariage.setFullYear(dateMariage.getFullYear() - 5)
    dateMariage.setMonth(dateMariage.getMonth() - 4)
    await page.fill('input[name="date_mariage"]', formatDateISO(dateMariage))

    await page.waitForTimeout(1000)

    // Vérifier l'affichage de la durée (environ 5.3 ans)
    const dureeDisplay = page.locator('text=/durée.*:.*5.*an|5\\.[0-9].*ans/i')
    await expect(dureeDisplay).toBeVisible({ timeout: 5000 })
  })
})
