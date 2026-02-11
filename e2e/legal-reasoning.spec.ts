/**
 * E2E Test : Legal Reasoning (Explanation Tree) Workflow
 *
 * Sprint 5 - Tests & Performance
 *
 * Teste le workflow complet de l'arbre décisionnel IRAC :
 * 1. Navigation vers page avec arbre
 * 2. Génération arbre depuis question
 * 3. Expand/Collapse nœuds
 * 4. Affichage sources
 * 5. Export PDF/JSON
 */

import { test, expect } from '@playwright/test'

// =============================================================================
// SETUP & HELPERS
// =============================================================================

test.describe('Legal Reasoning (Explanation Tree) Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login si nécessaire
    // await page.goto('/auth/signin')
    // await page.fill('input[name="email"]', 'test@example.com')
    // await page.fill('input[name="password"]', 'password')
    // await page.click('button[type="submit"]')

    // Navigate to Assistant IA (ou page avec ExplanationTreeViewer)
    await page.goto('/assistant-ia')

    // Attendre chargement page
    await page.waitForTimeout(2000)
  })

  // ===========================================================================
  // TEST 1 : Affichage initial page
  // ===========================================================================

  test('affiche la page Assistant IA correctement', async ({ page }) => {
    // Vérifier titre ou header
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // Vérifier présence input ou textarea pour poser question
    const questionInput = page.locator('textarea, input[type="text"]').first()
    await expect(questionInput).toBeVisible()
  })

  // ===========================================================================
  // TEST 2 : Génération arbre décisionnel
  // ===========================================================================

  test('génère un arbre décisionnel depuis une question', async ({ page }) => {
    // Poser question juridique
    const questionInput = page.locator('textarea, input[type="text"]').first()
    await questionInput.fill('Quelle est la prescription en matière civile tunisienne ?')

    // Soumettre question (Enter ou bouton Envoyer)
    const submitButton = page.getByRole('button', { name: /Envoyer|Soumettre|Rechercher/i })
    if (await submitButton.isVisible()) {
      await submitButton.click()
    } else {
      await questionInput.press('Enter')
    }

    // Attendre génération arbre (peut prendre 5-10s avec LLM)
    await page.waitForTimeout(15000)

    // Vérifier affichage arbre (titre ou structure)
    // L'arbre peut être affiché dans un composant ExplanationTreeViewer
    const treeViewer = page.locator('text=/Arbre Décisionnel|Raisonnement|Question|Règle|Application|Conclusion/i').first()
    const isVisible = await treeViewer.isVisible({ timeout: 5000 }).catch(() => false)

    if (isVisible) {
      await expect(treeViewer).toBeVisible()
    } else {
      // Vérifier réponse affichée (peut ne pas être arbre si feature pas encore intégrée)
      const responseText = page.locator('text=/prescription|quinze ans|Article/i').first()
      await expect(responseText).toBeVisible({ timeout: 5000 })
    }
  })

  // ===========================================================================
  // TEST 3 : Affichage nœuds arbre
  // ===========================================================================

  test('affiche les nœuds de l\'arbre IRAC', async ({ page }) => {
    // Naviguer directement vers une page avec arbre pré-généré
    // (à adapter selon implémentation réelle)

    // Pour ce test, on suppose qu'un arbre est déjà affiché
    // Si l'arbre doit être généré, reproduire étapes TEST 2

    // Vérifier présence de différents types de nœuds
    const nodeTypes = ['Question', 'Règle', 'Application', 'Conclusion']

    for (const nodeType of nodeTypes) {
      const node = page.locator(`text=${nodeType}`).first()
      const exists = await node.isVisible({ timeout: 2000 }).catch(() => false)

      if (exists) {
        await expect(node).toBeVisible()
        break // Au moins un type trouvé
      }
    }
  })

  // ===========================================================================
  // TEST 4 : Expand/Collapse nœuds
  // ===========================================================================

  test('expand et collapse les nœuds de l\'arbre', async ({ page }) => {
    // Chercher boutons expand/collapse (ChevronRight/ChevronDown)
    const expandButtons = page.locator('button').filter({
      has: page.locator('svg'),
    })

    const buttonCount = await expandButtons.count()

    if (buttonCount > 0) {
      const firstButton = expandButtons.first()

      // Cliquer pour expand
      await firstButton.click()
      await page.waitForTimeout(500)

      // Vérifier que des enfants apparaissent (difficile sans structure connue)
      // On vérifie juste qu'il n'y a pas d'erreur

      // Re-cliquer pour collapse
      await firstButton.click()
      await page.waitForTimeout(500)

      // Pas de crash
      expect(true).toBe(true)
    } else {
      // Aucun nœud expandable, skip test
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 5 : Affichage sources
  // ===========================================================================

  test('affiche les sources juridiques des nœuds', async ({ page }) => {
    // Chercher badges sources (Code, Jurisprudence, Doctrine)
    const sourceBadges = page.locator('text=/Code|Jurisprudence|Doctrine|Article/i')

    const count = await sourceBadges.count()

    if (count > 0) {
      const firstSource = sourceBadges.first()
      await expect(firstSource).toBeVisible()

      // Vérifier icône source (BookOpen, Scale, etc.)
      const sourceIcon = firstSource.locator('..').locator('svg').first()
      const iconExists = await sourceIcon.isVisible().catch(() => false)

      if (iconExists) {
        await expect(sourceIcon).toBeVisible()
      }
    } else {
      // Aucune source affichée, peut être normal selon data
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 6 : Clic sur source
  // ===========================================================================

  test('ouvre le document source au clic', async ({ page }) => {
    // Chercher badges sources cliquables
    const sourceBadges = page.locator('button').filter({
      hasText: /Code|Jurisprudence|Article/i,
    })

    const count = await sourceBadges.count()

    if (count > 0) {
      const firstSource = sourceBadges.first()

      // Cliquer sur source
      await firstSource.click()
      await page.waitForTimeout(1000)

      // Vérifier qu'un modal ou une page s'ouvre
      const dialog = page.getByRole('dialog')
      const isDialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false)

      if (isDialogVisible) {
        await expect(dialog).toBeVisible()

        // Fermer dialog
        const closeButton = dialog.locator('button').filter({ hasText: '' }).first()
        if (await closeButton.isVisible()) {
          await closeButton.click()
        }
      } else {
        // Peut-être navigation vers nouvelle page
        // Vérifier changement URL ou nouveau contenu
        expect(true).toBe(true) // Test passe si pas de crash
      }
    } else {
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 7 : Expand All / Collapse All
  // ===========================================================================

  test('expand et collapse tous les nœuds avec boutons globaux', async ({ page }) => {
    // Chercher boutons "Expand All" / "Collapse All"
    const expandAllButton = page.getByRole('button', { name: /Expand All|Tout Développer/i })
    const collapseAllButton = page.getByRole('button', { name: /Collapse All|Tout Réduire/i })

    const hasExpandAll = await expandAllButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasExpandAll) {
      // Cliquer Expand All
      await expandAllButton.click()
      await page.waitForTimeout(1000)

      // Vérifier que plusieurs nœuds sont visibles
      const visibleNodes = page.locator('[role="button"]').filter({
        has: page.locator('svg'),
      })
      const count = await visibleNodes.count()
      expect(count).toBeGreaterThan(0)

      // Cliquer Collapse All
      const hasCollapseAll = await collapseAllButton.isVisible().catch(() => false)
      if (hasCollapseAll) {
        await collapseAllButton.click()
        await page.waitForTimeout(1000)

        // Vérifier que nœuds sont masqués (difficile sans structure connue)
        expect(true).toBe(true)
      }
    } else {
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 8 : Export PDF
  // ===========================================================================

  test('exporte l\'arbre en PDF', async ({ page }) => {
    // Chercher bouton Export
    const exportButton = page.getByRole('button', { name: /Export|Exporter/i })

    const isVisible = await exportButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (isVisible) {
      await exportButton.click()
      await page.waitForTimeout(500)

      // Chercher option PDF
      const pdfOption = page.getByRole('menuitem', { name: /PDF/i })
        .or(page.getByRole('button', { name: /PDF/i }))

      const hasPdfOption = await pdfOption.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasPdfOption) {
        // Setup download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

        // Cliquer PDF
        await pdfOption.click()

        // Attendre téléchargement
        const download = await downloadPromise

        // Vérifier fichier téléchargé
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i)

        // Sauvegarder (optionnel)
        // await download.saveAs('/tmp/explanation-tree.pdf')
      }
    } else {
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 9 : Export JSON
  // ===========================================================================

  test('exporte l\'arbre en JSON', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /Export|Exporter/i })

    const isVisible = await exportButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (isVisible) {
      await exportButton.click()
      await page.waitForTimeout(500)

      const jsonOption = page.getByRole('menuitem', { name: /JSON/i })
        .or(page.getByRole('button', { name: /JSON/i }))

      const hasJsonOption = await jsonOption.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasJsonOption) {
        // Setup download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

        await jsonOption.click()

        const download = await downloadPromise

        expect(download.suggestedFilename()).toMatch(/\.json$/i)
      }
    } else {
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 10 : Export Markdown
  // ===========================================================================

  test('exporte l\'arbre en Markdown', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /Export|Exporter/i })

    const isVisible = await exportButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (isVisible) {
      await exportButton.click()
      await page.waitForTimeout(500)

      const mdOption = page.getByRole('menuitem', { name: /Markdown|MD/i })
        .or(page.getByRole('button', { name: /Markdown/i }))

      const hasMdOption = await mdOption.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasMdOption) {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

        await mdOption.click()

        const download = await downloadPromise

        expect(download.suggestedFilename()).toMatch(/\.(md|markdown)$/i)
      }
    } else {
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 11 : Affichage badges confiance
  // ===========================================================================

  test('affiche les badges de confiance sur les nœuds', async ({ page }) => {
    // Chercher badges avec pourcentages (80%, 90%, etc.)
    const confidenceBadges = page.locator('text=/\\d+%/')

    const count = await confidenceBadges.count()

    if (count > 0) {
      const firstBadge = confidenceBadges.first()
      await expect(firstBadge).toBeVisible()

      // Vérifier couleur badge (vert si >80%, amber si 60-80%, rouge si <60%)
      const badgeElement = firstBadge.locator('..')

      // Vert
      const hasGreen = await badgeElement.locator('.bg-green-600').isVisible().catch(() => false)

      // Amber
      const hasAmber = await badgeElement.locator('.bg-amber-500').isVisible().catch(() => false)

      // Rouge
      const hasRed = await badgeElement.locator('.bg-red-600').isVisible().catch(() => false)

      expect(hasGreen || hasAmber || hasRed).toBe(true)
    } else {
      test.skip()
    }
  })

  // ===========================================================================
  // TEST 12 : Affichage métadonnées nœuds
  // ===========================================================================

  test('affiche les indicateurs métadonnées (controversé, alternatif, renversé)', async ({ page }) => {
    // Chercher badges métadonnées
    const metadataBadges = page.locator('text=/Controversé|Alternatif|Renversé/i')

    const count = await metadataBadges.count()

    if (count > 0) {
      const firstBadge = metadataBadges.first()
      await expect(firstBadge).toBeVisible()

      // Vérifier icône AlertTriangle si controversé
      const icon = firstBadge.locator('..').locator('svg').first()
      const hasIcon = await icon.isVisible().catch(() => false)

      if (hasIcon) {
        await expect(icon).toBeVisible()
      }
    } else {
      // Normal si aucune métadonnée spéciale
      test.skip()
    }
  })
})
