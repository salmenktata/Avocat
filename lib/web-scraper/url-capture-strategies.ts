/**
 * Stratégies de capture d'URLs dynamiques via interaction JavaScript
 *
 * Ce module fournit différentes stratégies pour détecter les URLs
 * qui sont générées dynamiquement par des interactions JavaScript :
 * - DOM : Parser les liens présents dans le DOM
 * - History : Espionner pushState/replaceState pour les SPAs
 * - XHR : Intercepter les requêtes réseau (XHR/Fetch)
 * - Hybrid : Combinaison des 3 stratégies
 */

import type { Page } from 'playwright'

/**
 * Filtre les URLs pour ne garder que celles du même domaine
 */
function filterSameDomain(urls: string[], baseUrl: string): string[] {
  try {
    const baseDomain = new URL(baseUrl).hostname
    return urls.filter((url) => {
      try {
        const urlDomain = new URL(url).hostname
        return urlDomain === baseDomain
      } catch {
        // URL relative ou invalide → ignorer
        return false
      }
    })
  } catch {
    return []
  }
}

/**
 * Déduplique les URLs
 */
function deduplicate(urls: string[]): string[] {
  return Array.from(new Set(urls))
}

/**
 * Stratégie 1 : Capturer les URLs présentes dans le DOM
 *
 * Parse tous les liens <a href="..."> de la page et filtre
 * pour ne garder que ceux du même domaine.
 */
export async function captureDomUrls(
  page: Page,
  baseUrl: string
): Promise<string[]> {
  try {
    const urls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      return links
        .map((link) => link.href)
        .filter((href) => href && href.startsWith('http'))
    })

    return deduplicate(filterSameDomain(urls, baseUrl))
  } catch (error) {
    console.warn('[CaptureDom] Erreur capture DOM:', error)
    return []
  }
}

/**
 * Stratégie 2 : Capturer les URLs via History API
 *
 * Espionne les appels à pushState/replaceState pour détecter
 * les changements d'URL dans les SPAs (React, Vue, Livewire, etc.).
 *
 * @param durationMs - Durée pendant laquelle écouter les changements (ms)
 */
export async function captureHistoryUrls(
  page: Page,
  durationMs: number
): Promise<string[]> {
  const capturedUrls: string[] = []

  try {
    // Injecter un espion dans la page
    await page.evaluate(() => {
      ;(window as any).__capturedHistoryUrls = []

      const originalPushState = history.pushState
      const originalReplaceState = history.replaceState

      history.pushState = function (...args: any[]) {
        const url = args[2]
        if (url) {
          ;(window as any).__capturedHistoryUrls.push(url)
        }
        return originalPushState.apply(history, args as any)
      }

      history.replaceState = function (...args: any[]) {
        const url = args[2]
        if (url) {
          ;(window as any).__capturedHistoryUrls.push(url)
        }
        return originalReplaceState.apply(history, args as any)
      }
    })

    // Attendre la durée spécifiée
    await page.waitForTimeout(durationMs)

    // Récupérer les URLs capturées
    const urls = await page.evaluate(() => {
      const captured = (window as any).__capturedHistoryUrls || []
      return captured.map((url: string) => {
        // Convertir URL relative en absolue
        if (url.startsWith('/')) {
          return window.location.origin + url
        }
        return url
      })
    })

    capturedUrls.push(...urls)
  } catch (error) {
    console.warn('[CaptureHistory] Erreur capture History API:', error)
  }

  return deduplicate(capturedUrls)
}

/**
 * Stratégie 3 : Capturer les URLs via requêtes réseau
 *
 * Intercepte les requêtes XHR/Fetch pour détecter les URLs
 * chargées dynamiquement (utile pour AJAX, WebDev, etc.).
 *
 * @param durationMs - Durée pendant laquelle écouter les requêtes (ms)
 */
export async function captureXhrUrls(
  page: Page,
  durationMs: number
): Promise<string[]> {
  const capturedUrls: string[] = []

  try {
    // Écouter les requêtes réseau
    const requestHandler = (request: any) => {
      const url = request.url()
      const resourceType = request.resourceType()

      // Ne capturer que les requêtes de type document/xhr/fetch
      if (['document', 'xhr', 'fetch'].includes(resourceType)) {
        capturedUrls.push(url)
      }
    }

    page.on('request', requestHandler)

    // Attendre la durée spécifiée
    await page.waitForTimeout(durationMs)

    // Arrêter l'écoute
    page.off('request', requestHandler)
  } catch (error) {
    console.warn('[CaptureXhr] Erreur capture XHR:', error)
  }

  return deduplicate(capturedUrls)
}

/**
 * Stratégie 4 : Capture hybride (DOM + History + XHR)
 *
 * Combine les 3 stratégies pour une découverte maximale.
 * C'est la stratégie recommandée pour la plupart des sites dynamiques.
 *
 * @param durationMs - Durée d'observation pour History et XHR (ms)
 */
export async function captureHybridUrls(
  page: Page,
  baseUrl: string,
  durationMs: number
): Promise<string[]> {
  try {
    // Lancer les 3 stratégies en parallèle
    const [domUrls, historyUrls, xhrUrls] = await Promise.all([
      captureDomUrls(page, baseUrl),
      captureHistoryUrls(page, durationMs),
      captureXhrUrls(page, durationMs),
    ])

    // Fusionner et dédupliquer
    const allUrls = [...domUrls, ...historyUrls, ...xhrUrls]
    const sameDomainUrls = filterSameDomain(allUrls, baseUrl)

    return deduplicate(sameDomainUrls)
  } catch (error) {
    console.warn('[CaptureHybrid] Erreur capture hybride:', error)
    return []
  }
}
