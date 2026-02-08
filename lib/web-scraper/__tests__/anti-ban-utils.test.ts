import { describe, it, expect } from 'vitest'
import { detectBan, getRandomDelay, shouldAddLongPause, selectUserAgent, getBrowserHeaders } from '../anti-ban-utils'

describe('anti-ban-utils', () => {
  describe('detectBan', () => {
    it('détecte HTTP 403', () => {
      const result = detectBan('', 403)
      expect(result.isBanned).toBe(true)
      expect(result.confidence).toBe('high')
      expect(result.reason).toBe('HTTP 403 Forbidden')
    })

    it('détecte captcha Cloudflare', () => {
      const html = '<div class="cf-captcha-container">Please verify you are human</div>'
      const result = detectBan(html, 200)
      expect(result.isBanned).toBe(true)
      expect(result.reason).toContain('Captcha')
      expect(result.confidence).toBe('high')
    })

    it('détecte captcha Google reCAPTCHA', () => {
      const html = '<div class="g-recaptcha" data-sitekey="abc"></div>'
      const result = detectBan(html, 200)
      expect(result.isBanned).toBe(true)
      expect(result.confidence).toBe('high')
    })

    it('détecte messages de blocage', () => {
      const html = '<h1>Access Denied</h1><p>You have been blocked due to suspicious activity</p>'
      const result = detectBan(html, 200)
      expect(result.isBanned).toBe(true)
      expect(result.confidence).toBe('medium')
    })

    it('détecte "too many requests"', () => {
      const html = '<html><body><h1>Too Many Requests</h1><p>Please slow down</p></body></html>'
      const result = detectBan(html, 200)
      expect(result.isBanned).toBe(true)
    })

    it('détecte redirections vers pages de blocage', () => {
      const html = '<html><body>Blocked</body></html>'
      const result = detectBan(html, 200, 'https://example.com/blocked')
      expect(result.isBanned).toBe(true)
      expect(result.confidence).toBe('medium')
    })

    it('ne détecte pas de bannissement sur page normale', () => {
      const html = `
        <html>
          <head><title>Article juridique</title></head>
          <body>
            <h1>Loi n°2023-42</h1>
            <p>Contenu juridique détaillé ici...</p>
          </body>
        </html>
      `
      const result = detectBan(html, 200)
      expect(result.isBanned).toBe(false)
    })

    it('ne bannit pas sur contenu vide mais signale confiance faible', () => {
      const html = ''
      const result = detectBan(html, 200)
      expect(result.isBanned).toBe(false)
      expect(result.confidence).toBe('low')
    })
  })

  describe('getRandomDelay', () => {
    it('génère délai dans la plage avec variance par défaut', () => {
      const delays = Array.from({ length: 100 }, () => getRandomDelay(1000))

      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(800)   // 1000 - 20%
        expect(delay).toBeLessThanOrEqual(1200)     // 1000 + 20%
      })
    })

    it('génère délai avec variance personnalisée', () => {
      const delays = Array.from({ length: 100 }, () => getRandomDelay(1000, 0.5))

      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(500)   // 1000 - 50%
        expect(delay).toBeLessThanOrEqual(1500)     // 1000 + 50%
      })
    })

    it('génère des délais variés (randomisation effective)', () => {
      const delays = Array.from({ length: 20 }, () => getRandomDelay(1000))
      const uniqueDelays = new Set(delays)

      // Au moins quelques valeurs différentes
      expect(uniqueDelays.size).toBeGreaterThan(5)
    })
  })

  describe('shouldAddLongPause', () => {
    it('respecte la probabilité approximativement', () => {
      const samples = 1000
      const probability = 0.1
      const trueCount = Array.from({ length: samples }, () => shouldAddLongPause(probability))
        .filter(Boolean).length

      // Devrait être ~100 ± marge d'erreur statistique
      expect(trueCount).toBeGreaterThan(50)
      expect(trueCount).toBeLessThan(150)
    })

    it('retourne false pour probabilité 0', () => {
      const results = Array.from({ length: 100 }, () => shouldAddLongPause(0))
      expect(results.every(r => r === false)).toBe(true)
    })

    it('retourne true pour probabilité 1', () => {
      const results = Array.from({ length: 100 }, () => shouldAddLongPause(1))
      expect(results.every(r => r === true)).toBe(true)
    })
  })

  describe('selectUserAgent', () => {
    it('retourne le bot par défaut en mode normal', () => {
      const ua = selectUserAgent(false)
      expect(ua).toBe('QadhyaBot/1.0 (+https://qadhya.tn/bot)')
    })

    it('retourne un browser en mode stealth', () => {
      const ua = selectUserAgent(true)
      expect(ua).not.toBe('QadhyaBot/1.0 (+https://qadhya.tn/bot)')
      expect(ua).toContain('Mozilla')
    })

    it('retourne le custom user agent si fourni', () => {
      const customUA = 'MyCustomBot/1.0'
      const ua = selectUserAgent(false, customUA)
      expect(ua).toBe(customUA)
    })

    it('respecte custom user agent même en mode stealth', () => {
      const customUA = 'MyCustomBot/1.0'
      const ua = selectUserAgent(true, customUA)
      expect(ua).toBe(customUA)
    })

    it('génère des user agents variés en mode stealth', () => {
      const userAgents = new Set(
        Array.from({ length: 20 }, () => selectUserAgent(true))
      )

      // Au moins 2 user agents différents (il y en a 5 dans le pool)
      expect(userAgents.size).toBeGreaterThan(1)
    })
  })

  describe('getBrowserHeaders', () => {
    it('génère headers HTTP réalistes', () => {
      const headers = getBrowserHeaders('https://example.com')

      expect(headers['Accept']).toContain('text/html')
      expect(headers['Accept-Language']).toContain('fr-FR')
      expect(headers['Accept-Encoding']).toContain('gzip')
      expect(headers['Connection']).toBe('keep-alive')
      expect(headers['Sec-Fetch-Dest']).toBe('document')
      expect(headers['Sec-Fetch-Mode']).toBe('navigate')
    })

    it('ajoute Referer si fourni', () => {
      const headers = getBrowserHeaders('https://example.com/page', 'https://google.com')

      expect(headers['Referer']).toBe('https://google.com')
      expect(headers['Sec-Fetch-Site']).toBe('same-origin')
    })

    it('ne contient pas Referer si non fourni', () => {
      const headers = getBrowserHeaders('https://example.com')

      expect(headers['Referer']).toBeUndefined()
      expect(headers['Sec-Fetch-Site']).toBe('none')
    })
  })
})
