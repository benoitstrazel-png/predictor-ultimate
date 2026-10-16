/**
 * scripts/pipeline/extractors/betclicExtractor.cjs
 * ─────────────────────────────────────────────────────────────
 * Extracteur Haute Résilience pour les Cotes et Matchs Betclic Réels
 * - 0% de données factices / Zéro mock fallback
 * - Support complet des 8 compétitions
 * - Puppeteer Stealth & Scroller Virtuel Angular CDK
 */

'use strict';
const path = require('path');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

const COMPETITIONS = [
  { code: 'EUR-CL', name: 'Ligue des Champions', flag: '🇪🇺', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/ligue-des-champions-c8' },
  { code: 'EUR-EL', name: 'Ligue Europa', flag: '🇪🇺', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/ligue-europa-c3453' },
  { code: 'EUR-ECL', name: 'Ligue Conférence', flag: '🇪🇺', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/ligue-conference-c28946' },
  { code: 'FRA-L1', name: 'Ligue 1', flag: '🇫🇷', country: 'France', url: 'https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4' },
  { code: 'ENG-PL', name: 'Premier League', flag: '🇬🇧', country: 'Angleterre', url: 'https://www.betclic.fr/football-sfootball/angl-premier-league-c3' },
  { code: 'ESP-LL', name: 'La Liga', flag: '🇪🇸', country: 'Espagne', url: 'https://www.betclic.fr/football-sfootball/espagne-laliga-c7' },
  { code: 'ITA-SA', name: 'Serie A', flag: '🇮🇹', country: 'Italie', url: 'https://www.betclic.fr/football-sfootball/italie-serie-a-c6' },
  { code: 'GER-BL', name: 'Bundesliga', flag: '🇩🇪', country: 'Allemagne', url: 'https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5' },
  { code: 'ALL-FOOT', name: 'Top Football', flag: '🌍', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/top-football-europeen-p0' }
];

async function extractBetclicMatches() {
  console.log('[Extractor:Betclic] Ingestion des cotes réelles Betclic (Zero Mock & Stealth)...');
  const extracted = [];
  const seen = new Set();

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

    for (const comp of COMPETITIONS) {
      try {
        console.log(`[Extractor:Betclic] Ingestion de ${comp.name}...`);
        await page.goto(comp.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await new Promise(r => setTimeout(r, 1000));

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
                      league: cCode,
                      competition: cCode,
                      homeTeam: home,
                      awayTeam: away,
                      dateStr: node.matchDateUtc || 'Prochainement',
                      matchDateUtc: node.matchDateUtc || '',
                      isLive: false,
                      odds: { home: hOdd, draw: dOdd, away: aOdd },
                      source: 'BETCLIC_LIVE_REAL'
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

        ngMatches.forEach(item => {
          const k = `${item.homeTeam}_vs_${item.awayTeam}`;
          if (!seen.has(k)) {
            seen.add(k);
            extracted.push(item);
          }
        });

        const harvestBatch = async () => {
          return await page.evaluate((compCode) => {
            const results = [];
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

              const rawText = card.innerText || '';
              const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

              if (!home || !away) {
                const blacklist = ['Nul', 'paris', '+', '•', 'Direct', 'Live', 'Match', 'Football'];
                const teamCandidates = lines.filter(l => {
                  if (blacklist.some(b => l.includes(b))) return false;
                  if (l.match(/^\d+,\d{2}$/)) return false;
                  if (l.match(/^\d{1,2}:\d{2}$/)) return false;
                  if (l.match(/^\d+$/)) return false;
                  if (l.includes("Aujourd'hui") || l.includes('Demain') || l.includes('Ven.') || l.includes('Sam.') || l.includes('Dim.')) return false;
                  return l.length >= 2;
                });
                if (teamCandidates.length >= 2) {
                  home = teamCandidates[0];
                  away = teamCandidates[1] !== home ? teamCandidates[1] : (teamCandidates[2] || '');
                }
              }

              let dateStr = "Prochainement";
              let isLive = false;
              lines.forEach(l => {
                if (l.includes("Aujourd'hui") || l.includes('Demain') || l.includes('Ven.') || l.includes('Sam.') || l.includes('Dim.') || l.includes('Lun.') || l.includes('Mar.') || l.includes('Mer.') || l.includes('Jeu.') || l.match(/^\d{2}\/\d{2}/)) {
                  dateStr = l;
                }
                if (l.includes("En direct") || l.includes("MT") || l.includes("'")) {
                  isLive = true;
                }
              });

              const oddsAnimated = card.querySelectorAll('bcdk-bet-button-odds-animated, .oddValue, [class*="betButton"]');
              const oddsList = [];
              oddsAnimated.forEach(el => {
                const v = parseFloat(el.innerText.trim().replace(',', '.'));
                if (!isNaN(v) && v >= 1.015 && v <= 80) oddsList.push(v);
              });

              if (home && away && home !== away && oddsList.length >= 3) {
                const invSum = (1 / oddsList[0]) + (1 / oddsList[1]) + (1 / oddsList[2]);
                if (invSum >= 1.015 && invSum <= 1.22) {
                  results.push({
                    league: compCode,
                    homeTeam: home,
                    awayTeam: away,
                    dateStr: dateStr,
                    isLive: isLive,
                    odds: {
                      home: oddsList[0],
                      draw: oddsList[1],
                      away: oddsList[2]
                    },
                    source: 'BETCLIC_LIVE_REAL'
                  });
                }
              }
            });

            return results;
          }, comp.code);
        };

        let batch = await harvestBatch();
        batch.forEach(item => {
          const k = `${item.homeTeam}_vs_${item.awayTeam}`;
          if (!seen.has(k)) {
            seen.add(k);
            extracted.push(item);
          }
        });

        // Défilement progressif robuste sur le scroller virtuel Angular
        let cardIdx = 0;
        let endOfPageTries = 0;

        while (cardIdx < 45 && endOfPageTries < 3) {
          const totalCards = await page.evaluate(() => document.querySelectorAll('a.cardEvent').length);

          if (cardIdx < totalCards) {
            await page.evaluate((idx) => {
              const cards = document.querySelectorAll('a.cardEvent');
              if (cards[idx]) cards[idx].scrollIntoView({ behavior: 'instant', block: 'center' });
            }, cardIdx);

            await new Promise(r => setTimeout(r, 450));
            batch = await harvestBatch();
            batch.forEach(item => {
              const k = `${item.homeTeam}_vs_${item.awayTeam}`;
              if (!seen.has(k)) {
                seen.add(k);
                extracted.push(item);
              }
            });
            cardIdx++;
            endOfPageTries = 0;
          } else {
            // Au bout des cartes rendues : scroll container pour déclencher le chargement des jours suivants
            await page.evaluate(() => window.scrollBy(0, 800));
            await new Promise(r => setTimeout(r, 600));
            batch = await harvestBatch();
            batch.forEach(item => {
              const k = `${item.homeTeam}_vs_${item.awayTeam}`;
              if (!seen.has(k)) {
                seen.add(k);
                extracted.push(item);
              }
            });
            const newTotal = await page.evaluate(() => document.querySelectorAll('a.cardEvent').length);
            if (newTotal > totalCards) {
              endOfPageTries = 0;
            } else {
              endOfPageTries++;
            }
          }
        }

      } catch (err) {
        console.warn(`[Extractor:Betclic] Ingestion partielle ${comp.name}: ${err.message}`);
      }
    }
  } catch (err) {
    console.warn(`[Extractor:Betclic] Erreur browser: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  console.log(`[Extractor:Betclic] Total de ${extracted.length} rencontres réelles authentifiées.`);
  return {
    competitions: COMPETITIONS.filter(c => c.code !== 'ALL-FOOT'),
    matches: extracted
  };
}

module.exports = {
  COMPETITIONS: COMPETITIONS.filter(c => c.code !== 'ALL-FOOT'),
  extractBetclicMatches
};
