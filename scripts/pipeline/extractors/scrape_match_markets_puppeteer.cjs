/**
 * scripts/pipeline/extractors/scrape_match_markets_puppeteer.cjs
 * ─────────────────────────────────────────────────────────────
 * Extracteur Puppeteer Haute Précision pour TOUS les Marchés Betclic Réels
 * - Supporte la navigation par onglets : Résultats, Le Top, Buts, Score exact, Joueurs/SuperSub, Mi-temps, Stats
 * - Extraction granulaire de chaque <sports-markets-single-market>
 * - Zéro donnée synthétique / 100% Cotes Betclic certifiées
 */

'use strict';
const path = require('path');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

async function scrapeSingleMatchMarkets(page, matchUrl) {
  console.log(`[Scraper:Betclic] Ingestion des marchés pour: ${matchUrl}`);
  await page.goto(matchUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await new Promise(r => setTimeout(r, 3000));

  // Accepter les cookies Didomi
  await page.evaluate(() => {
    const btn = document.querySelector('#didomi-notice-agree-button, button[aria-label*="Accepter"]');
    if (btn) btn.click();
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // Attendre l'apparition des blocs de marchés
  await page.waitForSelector('sports-markets-single-market, [class*="marketElement"]', { timeout: 8000 }).catch(() => {});

  const allHarvestedMarkets = [];
  const seenMarketKeys = new Set();

  const harvestCurrentView = async (currentTabLabel = 'Général') => {
    const markets = await page.evaluate((tabLabel) => {
      const out = [];
      const marketEls = document.querySelectorAll('sports-markets-single-market, [class*="marketElement"]');
      marketEls.forEach(mEl => {
        const text = mEl.innerText.trim();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return;

        let title = lines[0];
        let subTitle = '';
        let startIndex = 1;

        if (title.toUpperCase() === 'EARLYWIN' || title.toUpperCase() === 'TRAWIN' || title.includes("SuperSub") || title === 'Bons plans') {
          subTitle = title;
          title = lines[1] || title;
          startIndex = 2;
        }

        const isSuperSub = text.toLowerCase().includes('supersub') || text.toLowerCase().includes('son remplaçant');

        // Extraction des paires (Sélection, Cote)
        const selections = [];
        let lastLabel = null;

        for (let i = startIndex; i < lines.length; i++) {
          const l = lines[i];
          // Accepter les cotes entières ("2", "4", "17") ou décimales ("1,97", "2.40")
          const isOdd = /^\d+([,\.]\d{1,2})?$/.test(l);
          if (isOdd && lastLabel) {
            const oddVal = parseFloat(l.replace(',', '.'));
            if (!isNaN(oddVal) && oddVal >= 1.01 && oddVal <= 500) {
              selections.push({
                name: lastLabel,
                odds: oddVal
              });
              lastLabel = null;
            }
          } else {
            // Ignorer les libellés purement parasites (ex: "Choisir", "+ de détails")
            if (l !== 'Choisir' && !l.includes('détails')) {
              lastLabel = l;
            }
          }
        }

        if (title && selections.length > 0) {
          out.push({
            marketTitle: title,
            subTitle: subTitle,
            tabContext: tabLabel,
            isSuperSub: isSuperSub,
            selections: selections
          });
        }
      });
      return out;
    }, currentTabLabel);

    markets.forEach(m => {
      const key = `${m.marketTitle}_${m.selections.length}`;
      if (!seenMarketKeys.has(key)) {
        seenMarketKeys.add(key);
        allHarvestedMarkets.push(m);
      }
    });
  };

  // 1. Récolter la vue initiale
  await harvestCurrentView('Résultats');

  // 2. Parcourir les onglets clés en cliquant dessus
  const targetTabs = ['Résultats', 'Le Top', 'Buts', 'Score exact', 'Joueurs', 'SuperSub', 'Mi-temps', 'Stats'];
  for (const target of targetTabs) {
    try {
      const clicked = await page.evaluate((targetName) => {
        const buttons = Array.from(document.querySelectorAll('[role="tab"], .market-tabs button, .categories-item, button'));
        for (const b of buttons) {
          if (b.innerText.trim().toLowerCase().includes(targetName.toLowerCase())) {
            b.click();
            return true;
          }
        }
        return false;
      }, target);

      if (clicked) {
        await new Promise(r => setTimeout(r, 1200));
        await harvestCurrentView(target);
      }
    } catch (_) {}
  }

  // 3. Extraction complémentaire dans ng-state
  const ngMarkets = await page.evaluate(() => {
    const ngScript = document.getElementById('ng-state');
    if (!ngScript) return [];
    let state;
    try { state = JSON.parse(ngScript.textContent); } catch (_) { return []; }
    const out = [];

    const walk = (node, parentTitle = '') => {
      if (!node || typeof node !== 'object') return;
      const currentTitle = node.title || node.marketName || node.name || parentTitle;
      if (Array.isArray(node.selections) && node.selections.length > 0) {
        const sels = [];
        node.selections.forEach(s => {
          const o = parseFloat(s.odds);
          if (s.name && !isNaN(o) && o >= 1.01) {
            sels.push({ name: s.name, odds: o });
          }
        });
        if (sels.length > 0 && currentTitle) {
          out.push({
            marketTitle: currentTitle,
            subTitle: parentTitle !== currentTitle ? parentTitle : '',
            tabContext: 'ng-state',
            isSuperSub: (currentTitle + parentTitle).toLowerCase().includes('remplaçant') || (currentTitle + parentTitle).toLowerCase().includes('supersub'),
            selections: sels
          });
        }
      }
      for (const k of Object.keys(node)) {
        walk(node[k], currentTitle);
      }
    };
    walk(state);
    return out;
  }).catch(() => []);

  ngMarkets.forEach(m => {
    const key = `${m.marketTitle}_${m.selections.length}`;
    if (!seenMarketKeys.has(key)) {
      seenMarketKeys.add(key);
      allHarvestedMarkets.push(m);
    }
  });

  return allHarvestedMarkets;
}

async function scrapeMatches(matchUrls) {
  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1366,900'
      ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' });

    const results = {};
    for (const url of matchUrls) {
      try {
        const markets = await scrapeSingleMatchMarkets(page, url);
        results[url] = markets;
        console.log(`[Scraper:Betclic] ✓ ${markets.length} marchés récoltés pour ${url}`);
      } catch (err) {
        console.error(`[Scraper:Betclic] Erreur sur ${url}:`, err.message);
        results[url] = [];
      }
    }
    return results;
  } finally {
    if (browser) await browser.close();
  }
}

// CLI direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const targetUrls = args.length > 0 ? args : [
    'https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4/monaco-lille-m1249796892393472'
  ];

  scrapeMatches(targetUrls).then(res => {
    const outPath = path.join(__dirname, 'last_scraped_markets_raw.json');
    require('fs').writeFileSync(outPath, JSON.stringify(res, null, 2), 'utf-8');
    console.log(`[Scraper:Betclic] Sauvegardé dans ${outPath}`);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { scrapeMatches, scrapeSingleMatchMarkets };
