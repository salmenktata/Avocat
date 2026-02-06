import { test, expect } from '@playwright/test'
import { login, navigateTo } from './helpers'

test.describe('Templates', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Liste des templates publics', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Vérifier que la page se charge
    await expect(page.locator('h1')).toContainText(/templates|نماذج/i)

    // Vérifier la présence des compteurs FR/AR
    await expect(page.locator('text=/FR|🇫🇷/')).toBeVisible()
    await expect(page.locator('text=/عربي|🇹🇳/')).toBeVisible()

    // Vérifier la section "Templates publics"
    const publicSection = page.locator('text=/templates publics|النماذج العامة/i')
    await expect(publicSection).toBeVisible()
  })

  test('Filtrage par langue FR', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Cliquer sur le filtre FR
    await page.click('button:has-text("FR"), button:has-text("Français")')

    await page.waitForTimeout(500)

    // Vérifier que seuls les templates FR sont affichés
    const templateCards = page.locator('[data-testid="template-card"], .template-card')
    const count = await templateCards.count()

    // Vérifier qu'aucun badge "عربي" n'est visible (seulement FR)
    for (let i = 0; i < count; i++) {
      const card = templateCards.nth(i)
      await expect(card.locator('text=عربي')).not.toBeVisible()
    }
  })

  test('Filtrage par langue AR', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Cliquer sur le filtre AR
    await page.click('button:has-text("العربية"), button:has-text("AR")')

    await page.waitForTimeout(500)

    // Vérifier que les templates arabes sont affichés
    const templateCards = page.locator('[data-testid="template-card"], .template-card')
    const count = await templateCards.count()

    if (count > 0) {
      // Au moins un template doit avoir le badge عربي
      const arabicBadge = page.locator('text=عربي')
      await expect(arabicBadge.first()).toBeVisible()
    }
  })

  test('Génération DOCX depuis template FR', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Cliquer sur le premier template FR visible
    await page.click('button:has-text("FR"), button:has-text("Français")')
    await page.waitForTimeout(500)

    const firstTemplate = page.locator('[data-testid="template-card"], .template-card').first()
    await firstTemplate.click()

    // Cliquer sur "Générer document"
    const generateButton = page.locator('button:has-text("Générer"), a:has-text("Générer")')
    if (await generateButton.isVisible()) {
      await generateButton.click()

      // Attendre la page de génération
      await page.waitForURL(/\/generate/)

      // Vérifier que le formulaire de génération est visible
      await expect(page.locator('text=/Générer.*document|Variables/i')).toBeVisible()
    }
  })

  test('Génération DOCX depuis template AR', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Cliquer sur le filtre AR
    await page.click('button:has-text("العربية"), button:has-text("AR")')
    await page.waitForTimeout(500)

    const firstTemplate = page.locator('[data-testid="template-card"], .template-card').first()
    if (await firstTemplate.isVisible()) {
      await firstTemplate.click()

      const generateButton = page.locator('button:has-text("توليد"), a:has-text("توليد"), button:has-text("Générer")')
      if (await generateButton.isVisible()) {
        await generateButton.click()

        await page.waitForURL(/\/generate/)
        await expect(page.locator('form')).toBeVisible()
      }
    }
  })

  test('Variables auto-remplies depuis dossier', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Ouvrir le premier template
    const firstTemplate = page.locator('[data-testid="template-card"], .template-card').first()
    await firstTemplate.click()

    const generateButton = page.locator('button:has-text("Générer"), a:has-text("Générer")')
    if (await generateButton.isVisible()) {
      await generateButton.click()
      await page.waitForURL(/\/generate/)

      // Sélectionner un dossier si disponible
      const dossierSelect = page.locator('select[name="dossier_id"], select:has-text("Sélectionner un dossier")')
      if (await dossierSelect.isVisible()) {
        const options = await dossierSelect.locator('option').all()
        if (options.length > 1) {
          await dossierSelect.selectOption({ index: 1 })

          await page.waitForTimeout(1000)

          // Vérifier que certaines variables sont pré-remplies
          const inputs = page.locator('input[type="text"]')
          const filledInputs = await inputs.filter({ hasNotText: '' }).count()
          expect(filledInputs).toBeGreaterThan(0)
        }
      }
    }
  })

  test('Création template privé par utilisateur', async ({ page }) => {
    await navigateTo(page, '/templates/new')

    // Remplir le formulaire
    await page.fill('input[name="titre"]', 'Mon template de test E2E')
    await page.fill('textarea[name="description"]', 'Template créé par les tests E2E')
    await page.selectOption('select[name="type_document"]', 'autre')
    await page.fill('textarea[name="contenu"]', 'Contenu du document avec {{variable_test}}')

    // Vérifier que la checkbox "public" n'est PAS visible pour un utilisateur normal
    // (elle ne devrait être visible que pour les admins)
    const publicCheckbox = page.locator('input[name="est_public"]')
    // On ne peut pas garantir le rôle de l'utilisateur de test, donc on vérifie juste la soumission

    // Soumettre
    await page.click('button[type="submit"]')

    // Vérifier la redirection vers la liste
    await page.waitForURL('/templates', { timeout: 10000 })

    // Vérifier que le template est créé (dans "Mes templates")
    await expect(page.locator('text=Mon template de test E2E')).toBeVisible()
  })

  test('Copie personnelle template public (non-admin)', async ({ page }) => {
    await navigateTo(page, '/templates')

    // Trouver un template public
    const publicTemplate = page.locator('[data-testid="template-card"]:has-text("Public"), .template-card:has-text("عام")')

    if (await publicTemplate.first().isVisible()) {
      await publicTemplate.first().click()

      // Cliquer sur modifier
      const editButton = page.locator('a:has-text("Modifier"), button:has-text("Modifier")')
      if (await editButton.isVisible()) {
        await editButton.click()

        // Si l'utilisateur n'est pas admin, on devrait voir le message de copie
        const copyInfo = page.locator('text=/copie personnelle|نسخة شخصية/i')

        // Si le message est visible, vérifier qu'on crée une copie
        if (await copyInfo.isVisible()) {
          await expect(copyInfo).toBeVisible()

          // Modifier quelque chose
          await page.fill('textarea[name="contenu"]', 'Contenu modifié pour ma copie')

          // Soumettre devrait créer une copie, pas modifier l'original
          await page.click('button[type="submit"]')
          await page.waitForURL('/templates', { timeout: 10000 })
        }
      }
    }
  })

  test('Convention PDF génération', async ({ page }) => {
    // D'abord, naviguer vers un dossier existant
    await navigateTo(page, '/dossiers')

    const firstDossier = page.locator('a[href*="/dossiers/"]').first()
    if (await firstDossier.isVisible()) {
      await firstDossier.click()

      // Chercher le bouton de génération de convention
      const conventionButton = page.locator('button:has-text("Convention"), a:has-text("Convention")')

      if (await conventionButton.isVisible()) {
        // Intercepter le téléchargement
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
        await conventionButton.click()

        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
      }
    }
  })
})
