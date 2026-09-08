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
  { code: 'ENG-PL', name: 'Premier League', url: 'https://www.betclic.fr/football-sfootball/angl-premier-league-c1' },
  { code: 'ESP-LL', name: 'La Liga', url: 'https://www.betclic.fr/football-sfootball/espagne-laliga-c2' },
  { code: 'ITA-SA', name: 'Serie A', url: 'https://www.betclic.fr/football-sfootball/italie-serie-a-c3' },
  { code: 'GER-BL', name: 'Bundesliga', url: 'https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5' },
  { code: 'TOP-EU', name: 'Top Football', url: 'https://www.betclic.fr/football-sfootball/top-football-europeen-p0' }
];

async function runCleanScraper() {
  const allResults = [];
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    for (const comp of COMPETITIONS) {
      try {
        await page.goto(comp.url, { waitUntil: 'networkidle2', timeout: 35000 });
        await new Promise(r => setTimeout(r, 2000));

        // Helper pour récolter les cartes actuellement hydratées dans le DOM
        const harvestBatch = async () => {
          return await page.evaluate((compCode) => {
            const found = [];
            const cards = document.querySelectorAll('a.cardEvent, sports-events-event, sports-event-card');

            cards.forEach(card => {
              const aria = card.getAttribute('aria-label') || '';
              const hEl = card.querySelector('[data-qa="contestant-1-label"], .scoreboard_contestant-1 .scoreboard_contestantLabel');
              const aEl = card.querySelector('[data-qa="contestant-2-label"], .scoreboard_contestant-2 .scoreboard_contestantLabel');
              
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

              const oddsEls = card.querySelectorAll('bcdk-bet-button-odds-animated, .oddValue, [class*="betButton"] [class*="odds"]');
              const odds = [];
              oddsEls.forEach(el => {
                const v = parseFloat(el.innerText.trim().replace(',', '.'));
                if (!isNaN(v) && v >= 1.015 && v <= 80.0) odds.push(v);
              });

              if (home && away && home !== away && odds.length >= 3) {
                const invSum = (1 / odds[0]) + (1 / odds[1]) + (1 / odds[2]);
                if (invSum >= 1.025 && invSum <= 1.16) {
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
        batch.forEach(m => {
          const k = `${m.homeTeam}_vs_${m.awayTeam}`;
          if (!seen.has(k)) {
            seen.add(k);
            allResults.push(m);
          }
        });

        // Défilement progressif robuste sur le scroller virtuel Angular
        let cardIdx = 0;
        let endOfPageTries = 0;

        while (cardIdx < 45 && endOfPageTries < 3) {
          const totalCards = await page.evaluate(() => document.querySelectorAll('a.cardEvent').length);

          if (cardIdx < totalCards) {
            await page.evaluate((i) => {
              const cards = document.querySelectorAll('a.cardEvent');
              if (cards[i]) cards[i].scrollIntoView({ behavior: 'instant', block: 'center' });
            }, cardIdx);
            await new Promise(r => setTimeout(r, 450));
            batch = await harvestBatch();
            batch.forEach(m => {
              const k = `${m.homeTeam}_vs_${m.awayTeam}`;
              if (!seen.has(k)) {
                seen.add(k);
                allResults.push(m);
              }
            });
            cardIdx++;
            endOfPageTries = 0;
          } else {
            // Au bout des cartes rendues : scroll container pour déclencher le chargement des jours suivants
            await page.evaluate(() => window.scrollBy(0, 800));
            await new Promise(r => setTimeout(r, 600));
            batch = await harvestBatch();
            batch.forEach(m => {
              const k = `${m.homeTeam}_vs_${m.awayTeam}`;
              if (!seen.has(k)) {
                seen.add(k);
                allResults.push(m);
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
        // En cas d'erreur ponctuelle sur une compétition, continuer les suivantes
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(JSON.stringify(allResults));
}

runCleanScraper();
