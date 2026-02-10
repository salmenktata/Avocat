#!/usr/bin/env tsx

/**
 * Script pour découvrir TOUS les codes juridiques sur 9anoun.tn/kb/codes
 * en cliquant le bouton "charger plus" (Livewire) jusqu'à épuisement.
 *
 * Usage:
 *   npx tsx scripts/discover-9anoun-codes.ts
 *   npx tsx scripts/discover-9anoun-codes.ts --json     # Sortie JSON
 *   npx tsx scripts/discover-9anoun-codes.ts --sql       # Génère le SQL seed_urls
 *
 * Prérequis:
 *   - Playwright installé (npx playwright install chromium)
 */

import { chromium, Page } from 'playwright';

const CODES_BASE_URL = 'https://9anoun.tn/kb/codes';
const SOURCE_ID = 'd322dc11-2dd5-4f8a-a731-6bd4f0337695'; // المجلات القانونية

interface CodeInfo {
  slug: string;
  url: string;
  title: string;
}

async function clickLoadMoreUntilDone(page: Page): Promise<number> {
  let clickCount = 0;
  const maxClicks = 20; // Sécurité : max 20 clics

  while (clickCount < maxClicks) {
    // Chercher le bouton "تحميل المزيد من العناصر" (charger plus)
    const loadMoreButton = await page.$(
      'button:has-text("تحميل المزيد"), button:has-text("المزيد من العناصر"), [wire\\:click*="loadMore"], button:has-text("charger plus"), button:has-text("Load more")'
    );

    if (!loadMoreButton) {
      // Essai avec un sélecteur Livewire plus générique
      const livewireButton = await page.$('button[wire\\:click]');
      if (!livewireButton) break;

      const buttonText = await livewireButton.textContent();
      // Vérifier que c'est bien un bouton "load more" et pas autre chose
      if (!buttonText?.includes('المزيد') && !buttonText?.includes('تحميل') && !buttonText?.includes('more')) {
        break;
      }
    }

    const button = loadMoreButton || await page.$('button[wire\\:click]');
    if (!button) break;

    const isVisible = await button.isVisible();
    if (!isVisible) break;

    try {
      await button.click();
      clickCount++;
      console.log(`   🔄 Clic "charger plus" #${clickCount}...`);

      // Attendre que Livewire mette à jour le DOM
      await page.waitForTimeout(2000);

      // Attendre que les nouveaux éléments apparaissent
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    } catch {
      console.log(`   ⚠️ Bouton disparu après ${clickCount} clics`);
      break;
    }
  }

  return clickCount;
}

async function extractCodeLinks(page: Page): Promise<CodeInfo[]> {
  const links = await page.$$eval('a[href*="/kb/codes/"]', (anchors) =>
    anchors
      .map((a) => {
        const href = (a as HTMLAnchorElement).href;
        const title = a.textContent?.trim() || '';

        // Ignorer le lien racine /kb/codes
        if (href.endsWith('/kb/codes') || href.endsWith('/kb/codes/')) return null;

        const match = href.match(/\/kb\/codes\/([^/?#]+)/);
        if (!match) return null;

        return {
          slug: match[1],
          url: href.split('?')[0].split('#')[0],
          title,
        };
      })
      .filter(Boolean) as Array<{ slug: string; url: string; title: string }>
  );

  // Dédupliquer par slug
  const unique = Array.from(new Map(links.map((l) => [l.slug, l])).values());
  return unique;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const sqlOutput = args.includes('--sql');

  if (!jsonOutput && !sqlOutput) {
    console.log('\n📚 Découverte des codes juridiques sur 9anoun.tn\n');
    console.log('━'.repeat(60) + '\n');
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'QadhyaBot/1.0 (+https://qadhya.tn/bot)',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    if (!jsonOutput && !sqlOutput) {
      console.log('🌐 Navigation vers', CODES_BASE_URL, '...');
    }

    await page.goto(CODES_BASE_URL, {
      waitUntil: 'load', // 'load' pas 'networkidle' (Livewire WebSocket bloque networkidle)
      timeout: 60000,
    });

    // Attendre le rendu initial de Livewire
    await page.waitForTimeout(5000);

    // Compter les codes visibles initialement
    const initialCodes = await extractCodeLinks(page);
    if (!jsonOutput && !sqlOutput) {
      console.log(`📋 ${initialCodes.length} codes visibles initialement\n`);
    }

    // Cliquer "charger plus" en boucle
    if (!jsonOutput && !sqlOutput) {
      console.log('🔄 Chargement de tous les codes...\n');
    }
    const clicks = await clickLoadMoreUntilDone(page);

    // Scroll complet pour s'assurer que tout est chargé
    await page.evaluate(async () => {
      const step = 500;
      const height = document.body.scrollHeight;
      for (let i = 0; i < height; i += step) {
        window.scrollTo(0, i);
        await new Promise((r) => setTimeout(r, 100));
      }
    });
    await page.waitForTimeout(2000);

    // Extraire tous les codes
    const allCodes = await extractCodeLinks(page);

    if (jsonOutput) {
      console.log(JSON.stringify(allCodes, null, 2));
    } else if (sqlOutput) {
      // Générer le SQL pour UPDATE seed_urls
      const seedUrls = allCodes.map((c) => c.url);
      console.log(`-- ${allCodes.length} codes découverts`);
      console.log(`-- Généré le ${new Date().toISOString()}\n`);
      console.log(`UPDATE web_sources SET`);
      console.log(`  seed_urls = '${JSON.stringify(seedUrls)}'::jsonb`);
      console.log(`WHERE id = '${SOURCE_ID}';`);
    } else {
      console.log(`\n${'━'.repeat(60)}\n`);
      console.log(`✅ ${allCodes.length} codes découverts (après ${clicks} clics "charger plus")\n`);

      // Afficher la liste
      allCodes.forEach((code, i) => {
        console.log(`  ${String(i + 1).padStart(2)}. ${code.slug}`);
        console.log(`      ${code.title}`);
      });

      console.log(`\n${'━'.repeat(60)}\n`);
      console.log('🎯 Prochaines étapes:\n');
      console.log('  1. Générer le SQL seed_urls:');
      console.log('     npx tsx scripts/discover-9anoun-codes.ts --sql > seed_urls.sql\n');
      console.log('  2. Exécuter sur prod (via tunnel SSH 5434):');
      console.log('     psql -h localhost -p 5434 -U moncabinet -d qadhya -f seed_urls.sql\n');
      console.log('  3. Relancer le crawl via UI admin ou API\n');

      // Comparer avec les codes déjà crawlés
      console.log('📊 Slugs découverts:');
      console.log(JSON.stringify(allCodes.map((c) => c.slug), null, 2));
    }

    // Screenshot pour debug
    if (!jsonOutput && !sqlOutput) {
      await page.screenshot({ path: './9anoun-codes-all.png', fullPage: true });
      console.log('\n📸 Screenshot sauvegardé: 9anoun-codes-all.png');
    }
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    await page.screenshot({ path: './9anoun-codes-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
