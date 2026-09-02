const puppeteer = require('puppeteer');

const COMPETITIONS = [
  { code: 'ENG-PL', name: 'Premier League', url: 'https://www.betclic.fr/football-sfootball/angl-premier-league-c3' },
  { code: 'ESP-LL', name: 'La Liga', url: 'https://www.betclic.fr/football-sfootball/espagne-laliga-c7' },
  { code: 'ITA-SA', name: 'Serie A', url: 'https://www.betclic.fr/football-sfootball/italie-serie-a-c6' },
  { code: 'GER-BL', name: 'Bundesliga', url: 'https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5' },
  { code: 'FRA-L1', name: 'Ligue 1', url: 'https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4' },
  { code: 'TOP-EU', name: 'Top Football', url: 'https://www.betclic.fr/football-sfootball/top-football-europeen-p0' },
  { code: 'ALL-FOOT', name: 'Football Home', url: 'https://www.betclic.fr/football-sfootball' }
];

async function runCleanScraper() {
  const allResults = [];
  const seen = new Set();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 1200 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    for (const comp of COMPETITIONS) {
      try {
        await page.goto(comp.url, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1200));

        // Scroll step by step and collect at every step
        for (let s = 0; s < 12; s++) {
          const batch = await page.evaluate((compCode) => {
            const res = [];
            const cards = document.querySelectorAll('a.cardEvent, sports-events-event, sports-event-card, [class*="matchCard"], [class*="eventCard"], [class*="cardEvent"]');

            cards.forEach(card => {
              // Exact scoreboard selectors first
              const hEl = card.querySelector('.scoreboard_contestant-1 .scoreboard_contestantLabel, [class*="contestant-1"] [class*="contestantLabel"]');
              const aEl = card.querySelector('.scoreboard_contestant-2 .scoreboard_contestantLabel, [class*="contestant-2"] [class*="contestantLabel"]');
              
              let home = hEl ? hEl.innerText.trim() : '';
              let away = aEl ? aEl.innerText.trim() : '';

              const oddsEls = card.querySelectorAll('bcdk-bet-button-odds-animated, .oddValue, [class*="betButton"] [class*="odds"]');
              const odds = [];
              oddsEls.forEach(el => {
                const v = parseFloat(el.innerText.trim().replace(',', '.'));
                if (!isNaN(v) && v >= 1.015 && v <= 80) odds.push(v);
              });

              // Fallback team extraction if selector is missing
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

              if (home && away && home !== away && odds.length >= 3) {
                const invSum = (1 / odds[0]) + (1 / odds[1]) + (1 / odds[2]);
                if (invSum >= 1.025 && invSum <= 1.15) {
                  res.push({
                    competition: compCode,
                    homeTeam: home,
                    awayTeam: away,
                    odds: { home: odds[0], draw: odds[1], away: odds[2] }
                  });
                }
              }
            });

            return res;
          }, comp.code);

          batch.forEach(m => {
            const k = `${m.homeTeam}_vs_${m.awayTeam}`;
            if (!seen.has(k)) {
              seen.add(k);
              allResults.push(m);
            }
          });

          await page.evaluate(() => window.scrollBy(0, 600));
          await new Promise(r => setTimeout(r, 250));
        }

      } catch (err) {
        // Continue
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(JSON.stringify(allResults));
}

runCleanScraper();
