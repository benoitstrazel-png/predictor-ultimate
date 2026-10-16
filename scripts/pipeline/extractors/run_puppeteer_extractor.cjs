/**
 * scripts/pipeline/extractors/run_puppeteer_extractor.cjs
 * ─────────────────────────────────────────────────────────────
 * Extracteur Puppeteer Stealth Haute Résilience pour Betclic
 * - Utilise puppeteer-extra + stealth pour contourner les 403 Forbidden
 * - Défilement progressif carte par carte pour le scroller virtuel Angular CDK
 * - Extraction certifiée des cotes réelles 1N2 sur Top 5 + 3 Coupes d'Europe
 */

'use strict';

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

const COMPETITIONS = [
  { code: 'EUR-CL', name: 'Ligue des Champions', url: 'https://www.betclic.fr/football-sfootball/ligue-des-champions-c8' },
  { code: 'EUR-EL', name: 'Ligue Europa', url: 'https://www.betclic.fr/football-sfootball/ligue-europa-c3453' },
  { code: 'EUR-ECL', name: 'Ligue Conférence', url: 'https://www.betclic.fr/football-sfootball/ligue-conference-c28946' },
  { code: 'FRA-L1', name: 'Ligue 1', url: 'https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4' },
  { code: 'ENG-PL', name: 'Premier League', url: 'https://www.betclic.fr/football-sfootball/angl-premier-league-c3' },
  { code: 'ESP-LL', name: 'La Liga', url: 'https://www.betclic.fr/football-sfootball/espagne-laliga-c7' },
  { code: 'ITA-SA', name: 'Serie A', url: 'https://www.betclic.fr/football-sfootball/italie-serie-a-c6' },
  { code: 'GER-BL', name: 'Bundesliga', url: 'https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5' },
  { code: 'TOP-EU', name: 'Top Football', url: 'https://www.betclic.fr/football-sfootball/top-football-europeen-p0' }
];

function extractFromJsonNode(node, compCode, outList) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) extractFromJsonNode(item, compCode, outList);
    return;
  }

  // Detect Betclic event object (contestants + grouped_markets / markets)
  const contestants = node.contestants || node.participants || node.competitors;
  const markets = node.grouped_markets || node.markets || node.main_markets;
  if (Array.isArray(contestants) && contestants.length >= 2 && Array.isArray(markets)) {
    const home = (contestants[0]?.name || contestants[0]?.label || '').trim();
    const away = (contestants[1]?.name || contestants[1]?.label || '').trim();
    if (home && away && home !== away) {
      const odds = [];
      const scanSelections = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          obj.forEach(scanSelections);
          return;
        }
        if (typeof obj.odds === 'number' && obj.odds >= 1.015 && obj.odds <= 80.0) {
          odds.push(obj.odds);
        }
        for (const k of ['markets', 'selections', 'outcomes', 'items']) {
          if (obj[k]) scanSelections(obj[k]);
        }
      };
      scanSelections(markets);
      if (odds.length >= 3) {
        const invSum = (1 / odds[0]) + (1 / odds[1]) + (1 / odds[2]);
        if (invSum >= 1.015 && invSum <= 1.22) {
          outList.push({
            competition: compCode,
            homeTeam: home,
            awayTeam: away,
            odds: { home: odds[0], draw: odds[1], away: odds[2] }
          });
        }
      }
    }
  }

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === 'object') {
      extractFromJsonNode(val, compCode, outList);
    }
  }
}

async function runCleanScraper() {
  const allResults = [];
  const seen = new Set();
  let currentCompCode = 'TOP-EU';

  const registerMatch = (m) => {
    if (!m || !m.homeTeam || !m.awayTeam || m.homeTeam === m.awayTeam) return;
    const k = `${m.homeTeam}_vs_${m.awayTeam}`;
    if (!seen.has(k)) {
      seen.add(k);
      allResults.push(m);
    }
  };

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

    // Intercept Betclic background JSON API responses (offer.cdn.begmedia.com)
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const ct = (response.headers()['content-type'] || '').toLowerCase();
        if (ct.includes('json') && (url.includes('begmedia.com') || url.includes('betclic') || url.includes('matches') || url.includes('events'))) {
          const json = await response.json().catch(() => null);
          if (json) {
            const apiMatches = [];
            extractFromJsonNode(json, currentCompCode, apiMatches);
            apiMatches.forEach(registerMatch);
          }
        }
      } catch (_) {}
    });

    for (const comp of COMPETITIONS) {
      currentCompCode = comp.code;
      try {
        await page.goto(comp.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await new Promise(r => setTimeout(r, 800));

        // Dismiss Didomi cookie consent modal if present
        await page.evaluate(() => {
          const btn = document.querySelector('#didomi-notice-agree-button, button[aria-label*="Accepter"], button[aria-label*="Continuer"]');
          if (btn) btn.click();
        }).catch(() => {});

        // 1. Extraction ultra-rapide et exhaustive du state SSR ng-state
        const ngMatches = await page.evaluate((cCode) => {
          const ngScript = document.getElementById('ng-state');
          if (!ngScript) return [];
          let state;
          try { state = JSON.parse(ngScript.textContent); } catch (_) { return []; }
          const out = [];
          const seenIds = new Set();
          const walk = (node) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) {
              node.forEach(walk);
              return;
            }
            if (node.matchId && Array.isArray(node.contestants) && node.contestants.length >= 2) {
              const home = (node.contestants[0]?.name || '').trim();
              const away = (node.contestants[1]?.name || '').trim();
              let selections = null;
              if (node.market && Array.isArray(node.market.mainSelections) && node.market.mainSelections.length >= 3) {
                selections = node.market.mainSelections;
              } else if (Array.isArray(node.markets)) {
                for (const m of node.markets) {
                  if (m && Array.isArray(m.mainSelections) && m.mainSelections.length >= 3) {
                    selections = m.mainSelections;
                    break;
                  }
                }
              }
              if (home && away && home !== away && selections && selections.length >= 3 && !seenIds.has(node.matchId)) {
                const hOdd = parseFloat(selections[0]?.odds);
                const dOdd = parseFloat(selections[1]?.odds);
                const aOdd = parseFloat(selections[2]?.odds);
                if (hOdd >= 1.015 && dOdd >= 1.015 && aOdd >= 1.015) {
                  const invSum = (1 / hOdd) + (1 / dOdd) + (1 / aOdd);
                  if (invSum >= 1.015 && invSum <= 1.25) {
                    seenIds.add(node.matchId);
                    out.push({
                      competition: cCode,
                      homeTeam: home,
                      awayTeam: away,
                      dateStr: node.matchDateUtc || '',
                      matchDateUtc: node.matchDateUtc || '',
                      odds: { home: hOdd, draw: dOdd, away: aOdd }
                    });
                  }
                }
              }
            }
            for (const k of Object.keys(node)) {
              walk(node[k]);
            }
          };
          walk(state);
          return out;
        }, comp.code).catch(() => []);

        ngMatches.forEach(registerMatch);

        // Helper pour récolter les cartes actuellement hydratées dans le DOM (complément de secours)
        const harvestBatch = async () => {
          return await page.evaluate((compCode) => {
            const found = [];
            const cards = document.querySelectorAll('a.cardEvent, sports-events-event, sports-event-card, [class*="cardEvent"]');

            cards.forEach(card => {
              const aria = card.getAttribute('aria-label') || '';
              const hEl = card.querySelector('[data-qa="contestant-1-label"], .scoreboard_contestant-1 .scoreboard_contestantLabel, .scoreboard_contestant-1');
              const aEl = card.querySelector('[data-qa="contestant-2-label"], .scoreboard_contestant-2 .scoreboard_contestantLabel, .scoreboard_contestant-2');
              
              let home = hEl ? hEl.innerText.trim() : '';
              let away = aEl ? aEl.innerText.trim() : '';

              if (!home || !away) {
                if (aria.includes(' - ')) {
                  const parts = aria.split(' - ');
                  home = parts[0].trim();
                  away = parts[1].trim();
                }
              }

              // Fallback text parsing si nécessaire
              if (!home || !away) {
                const rawText = card.innerText || '';
                const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
                const blacklist = ['Nul', 'paris', '+', '•', 'Direct', 'Live', 'Match', 'Football', 'McDonald', 'LaLiga', 'Premier League', 'Serie A', 'Bundesliga'];
                const candidates = lines.filter(l => {
                  if (blacklist.some(b => l.includes(b))) return false;
                  if (l.match(/^\d+,\d{2}$/)) return false;
                  if (l.match(/^\d{1,2}:\d{2}$/)) return false;
                  if (l.match(/^\d+$/)) return false;
                  if (l.includes("Aujourd'hui") || l.includes('Demain') || l.includes('Ven.') || l.includes('Sam.') || l.includes('Dim.') || l.includes('Jeu.') || l.includes('Mer.') || l.includes('Mar.') || l.includes('Lun.')) return false;
                  return l.length >= 2;
                });
                if (candidates.length >= 2) {
                  home = candidates[0];
                  away = candidates[1] !== home ? candidates[1] : (candidates[2] || '');
                }
              }

              const oddsEls = card.querySelectorAll('bcdk-bet-button-odds-animated, .oddValue, [class*="betButton"] [class*="odds"], .btn_label');
              const odds = [];
              oddsEls.forEach(el => {
                const v = parseFloat(el.innerText.trim().replace(',', '.'));
                if (!isNaN(v) && v >= 1.015 && v <= 80.0) odds.push(v);
              });

              if (home && away && home !== away && odds.length >= 3) {
                const invSum = (1 / odds[0]) + (1 / odds[1]) + (1 / odds[2]);
                if (invSum >= 1.015 && invSum <= 1.22) {
                  found.push({
                    competition: compCode,
                    homeTeam: home,
                    awayTeam: away,
                    odds: { home: odds[0], draw: odds[1], away: odds[2] }
                  });
                }
              }
            });

            return found;
          }, comp.code);
        };

        // Première passe
        let batch = await harvestBatch();
        batch.forEach(registerMatch);

        // Défilement progressif robuste sur le scroller virtuel Angular
        let cardIdx = 0;
        let endOfPageTries = 0;

        while (cardIdx < 50 && endOfPageTries < 3) {
          const totalCards = await page.evaluate(() => document.querySelectorAll('a.cardEvent, sports-events-event, sports-event-card').length);

          if (cardIdx < totalCards) {
            await page.evaluate((i) => {
              const cards = document.querySelectorAll('a.cardEvent, sports-events-event, sports-event-card');
              if (cards[i]) cards[i].scrollIntoView({ behavior: 'instant', block: 'center' });
            }, cardIdx);
            await new Promise(r => setTimeout(r, 350));
            batch = await harvestBatch();
            batch.forEach(registerMatch);
            cardIdx += 4;
            endOfPageTries = 0;
          } else {
            await page.evaluate(() => {
              const vp = document.querySelector('cdk-virtual-scroll-viewport');
              if (vp) vp.scrollBy(0, 800);
              window.scrollBy(0, 800);
            });
            await new Promise(r => setTimeout(r, 550));
            batch = await harvestBatch();
            batch.forEach(registerMatch);
            const newTotal = await page.evaluate(() => document.querySelectorAll('a.cardEvent, sports-events-event, sports-event-card').length);
            if (newTotal > totalCards) {
              endOfPageTries = 0;
            } else {
              endOfPageTries++;
            }
          }
        }

      } catch (err) {
        // En cas d'erreur ponctuelle sur une compétition, continuer les suivantes
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(JSON.stringify(allResults));
}

runCleanScraper();
