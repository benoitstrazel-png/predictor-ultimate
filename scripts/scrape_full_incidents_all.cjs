const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const TARGETS = [
  { mid: 'INhYSVse', matchId: 'FOT_5802918', home: 'Lille', away: 'PSG' },
  { mid: 'C0b6Sk9l', matchId: 'FOT_5795429', home: 'Crystal Palace', away: 'Manchester City' },
  { mid: 'xrtCcyAe', matchId: 'FOT_5881143', home: 'Bayern Munich', away: 'Stuttgart' },
  { mid: 'fciFyZo2', matchId: 'FOT_5749650', home: 'AC Milan', away: 'Venezia' },
  { mid: 'CrPiFJSq', matchId: 'FOT_5868037', home: 'Racing Santander', away: 'Elche' },
  { mid: '6ots82LG', matchId: 'FOT_5868031', home: 'Alavés', away: 'Villarreal' }
];

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const allIncidents = {};

  for (const t of TARGETS) {
    console.log(`\n🔍 Extraction complète des faits de match pour ${t.home} vs ${t.away}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    try {
      await page.goto(`https://www.flashscore.com/match/${t.mid}/#/match-summary/match-summary`, { waitUntil: 'networkidle2', timeout: 35000 });
      try {
        const cookie = await page.$('#onetrust-accept-btn-handler');
        if (cookie) await cookie.click();
      } catch(e) {}

      await new Promise(r => setTimeout(r, 2000));

      const parsed = await page.evaluate((homeTeam, awayTeam) => {
        const rows = document.querySelectorAll('.smv__incident, [class*="incidentRow"]');
        const incidents = [];

        rows.forEach(r => {
          const timeBox = r.querySelector('.smv__timeBox, [class*="timeBox"], .time');
          const minStr = timeBox ? timeBox.innerText.replace("'", "").trim() : '0';
          let minute = 0;
          let addedTime = 0;
          if (minStr.includes('+')) {
            const p = minStr.split('+');
            minute = parseInt(p[0], 10) || 0;
            addedTime = parseInt(p[1], 10) || 0;
          } else {
            minute = parseInt(minStr, 10) || 0;
          }

          // Home or Away
          const isHome = r.classList.contains('smv__homeIncident') || r.closest('.smv__home') !== null || r.querySelector('.smv__home') !== null;
          
          // Player elements
          const playerNames = Array.from(r.querySelectorAll('.smv__playerName, [class*="playerName"], .participantName')).map(el => el.innerText.trim());
          const subText = r.querySelector('.smv__subIncident, [class*="subIncident"]')?.innerText.trim() || '';

          // Icons
          const isGoal = !!r.querySelector('.smv__football, svg[class*="ball"], [class*="goal"]');
          const isCard = !!r.querySelector('.smv__card, [class*="card"], [class*="warning"]');
          const isSub = !!r.querySelector('.smv__substitution, [class*="substitution"]') || playerNames.length >= 2;

          if (isGoal) {
            let assist = null;
            if (subText.includes('(') && subText.includes(')')) {
              assist = subText.replace(/[()]/g, '').trim();
            }
            incidents.push({
              type: 'GOAL',
              minute,
              addedTime,
              isHome,
              team: isHome ? homeTeam : awayTeam,
              player: playerNames[0] || 'Buteur',
              assist,
              detail: assist ? `Assist: ${assist}` : 'Tir cadré'
            });
          } else if (isCard) {
            const cardType = r.innerHTML.includes('redCard') ? 'RED' : 'YELLOW';
            incidents.push({
              type: cardType === 'RED' ? 'RED_CARD' : 'YELLOW_CARD',
              cardType,
              minute,
              addedTime,
              isHome,
              team: isHome ? homeTeam : awayTeam,
              player: playerNames[0] || 'Joueur',
              reason: subText.replace(/[()]/g, '') || 'Faute de jeu',
              detail: `Carton ${cardType}`
            });
          } else if (isSub) {
            incidents.push({
              type: 'SUBSTITUTION',
              minute,
              addedTime,
              isHome,
              team: isHome ? homeTeam : awayTeam,
              playerIn: playerNames[0] || 'Entrant',
              playerOut: playerNames[1] || 'Sortant',
              detail: `Entrée: ${playerNames[0]} / Sortie: ${playerNames[1]}`
            });
          }
        });

        return incidents;
      }, t.home, t.away);

      allIncidents[t.matchId] = parsed;
      console.log(`   ✅ Extraits : ${parsed.length} faits de match (Buts avec passes, Cartons, Remplacements)`);
    } catch(err) {
      console.warn(`   ⚠️ Erreur :`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'scraped_incidents_full_28aug.json'), JSON.stringify(allIncidents, null, 2), 'utf8');
}

run().catch(console.error);