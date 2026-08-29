/**
 * scripts/pipeline/extractors/betclicExtractor.cjs
 * ─────────────────────────────────────────────────────────────
 * Extracteur Haute Résilience pour les Cotes et Matchs Betclic Réels
 * - 0% de données factices / Zéro mock fallback
 * - Support complet des 8 compétitions
 */

'use strict';
const path = require('path');
const puppeteer = require('puppeteer');

const COMPETITIONS = [
  { code: 'EUR-CL', name: 'Ligue des Champions', flag: '🇪🇺', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/ligue-des-champions-c8' },
  { code: 'EUR-EL', name: 'Ligue Europa', flag: '🇪🇺', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/ligue-europa-c3453' },
  { code: 'EUR-ECL', name: 'Ligue Conférence', flag: '🇪🇺', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball/ligue-conference-c28946' },
  { code: 'FRA-L1', name: 'Ligue 1', flag: '🇫🇷', country: 'France', url: 'https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4' },
  { code: 'ENG-PL', name: 'Premier League', flag: '🇬🇧', country: 'Angleterre', url: 'https://www.betclic.fr/football-sfootball/angl-premier-league-c1' },
  { code: 'ESP-LL', name: 'La Liga', flag: '🇪🇸', country: 'Espagne', url: 'https://www.betclic.fr/football-sfootball/espagne-laliga-c2' },
  { code: 'ITA-SA', name: 'Serie A', flag: '🇮🇹', country: 'Italie', url: 'https://www.betclic.fr/football-sfootball/italie-serie-a-c3' },
  { code: 'GER-BL', name: 'Bundesliga', flag: '🇩🇪', country: 'Allemagne', url: 'https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5' },
  { code: 'ALL-FOOT', name: 'Top Football', flag: '🌍', country: 'Europe', url: 'https://www.betclic.fr/football-sfootball' }
];

async function extractBetclicMatches() {
  console.log('[Extractor:Betclic] Ingestion des cotes réelles Betclic (Zero Mock)...');
  const extracted = [];
  const seen = new Set();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    for (const comp of COMPETITIONS) {
      try {
        console.log(`[Extractor:Betclic] Ingestion de ${comp.name}...`);
        await page.goto(comp.url, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(r => setTimeout(r, 1200));

        await page.evaluate(async () => {
          window.scrollBy(0, 600);
          await new Promise(r => setTimeout(r, 300));
          window.scrollBy(0, 600);
          await new Promise(r => setTimeout(r, 300));
        });

        const pageMatches = await page.evaluate((compCode) => {
          const results = [];
          const cards = document.querySelectorAll('sports-events-event, sports-event-card, [class*="matchCard"], [class*="eventCard"], .cardEvent');

          cards.forEach(card => {
            const rawText = card.innerText || '';
            const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

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

            if (oddsList.length < 3) {
              lines.forEach(l => {
                if (l.match(/^\d+,\d{2}$/)) {
                  const v = parseFloat(l.replace(',', '.'));
                  if (!isNaN(v) && v >= 1.015 && v <= 80) oddsList.push(v);
                }
              });
            }

            const blacklist = ['Nul', 'paris', '+', '•', 'Direct', 'Live', 'Match', 'Football'];
            const teamCandidates = lines.filter(l => {
              if (blacklist.some(b => l.includes(b))) return false;
              if (l.match(/^\d+,\d{2}$/)) return false;
              if (l.match(/^\d{1,2}:\d{2}$/)) return false;
              if (l.match(/^\d+$/)) return false;
              if (l.includes("Aujourd'hui") || l.includes('Demain') || l.includes('Ven.') || l.includes('Sam.') || l.includes('Dim.')) return false;
              return l.length >= 2;
            });

            if (teamCandidates.length >= 2 && oddsList.length >= 3) {
              const home = teamCandidates[0];
              const away = teamCandidates[1] !== home ? teamCandidates[1] : (teamCandidates[2] || '');
              if (home && away && home !== away) {
                // Calculation of margin
                const invSum = (1 / oddsList[0]) + (1 / oddsList[1]) + (1 / oddsList[2]);
                if (invSum >= 1.025 && invSum <= 1.15) {
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
            }
          });

          return results;
        }, comp.code);

        pageMatches.forEach(item => {
          const k = `${item.homeTeam}_vs_${item.awayTeam}`;
          if (!seen.has(k)) {
            seen.add(k);
            extracted.push(item);
          }
        });

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
