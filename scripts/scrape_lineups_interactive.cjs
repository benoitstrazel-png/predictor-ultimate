#!/usr/bin/env node
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const MATCHES = [
  { mid: 'INhYSVse', matchId: 'FOT_5802918', comp: 'FRA-L1', home: 'Lille', away: 'PSG' },
  { mid: 'C0b6Sk9l', matchId: 'FOT_5795429', comp: 'ENG-PL', home: 'Crystal Palace', away: 'Manchester City' },
  { mid: 'xrtCcyAe', matchId: 'FOT_5881143', comp: 'GER-BL', home: 'Bayern Munich', away: 'Stuttgart' },
  { mid: 'fciFyZo2', matchId: 'FOT_5749650', comp: 'ITA-SA', home: 'AC Milan', away: 'Venezia' },
  { mid: 'CrPiFJSq', matchId: 'FOT_5868037', comp: 'ESP-LL', home: 'Racing Santander', away: 'Elche' },
  { mid: '6ots82LG', matchId: 'FOT_5868031', comp: 'ESP-LL', home: 'Alavés', away: 'Villarreal' }
];

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const lineupsByMatch = {};

  for (const m of MATCHES) {
    console.log(`\n🔍 Lineups pour ${m.home} vs ${m.away} (${m.mid})...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    try {
      await page.goto(`https://www.flashscore.com/match/${m.mid}/#/match-summary`, { waitUntil: 'networkidle2', timeout: 35000 });
      try {
        const cookie = await page.$('#onetrust-accept-btn-handler');
        if (cookie) await cookie.click();
      } catch(e) {}

      await new Promise(r => setTimeout(r, 1500));

      // Click LINEUPS tab
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, div, span'));
        const tab = tabs.find(el => {
          const t = el.innerText ? el.innerText.trim().toUpperCase() : '';
          return (t === 'LINEUPS' || t === 'LINE-UPS' || t === 'COMPOSITIONS' || t === 'COMPOS') && el.offsetParent !== null;
        });
        if (tab) tab.click();
      });

      await new Promise(r => setTimeout(r, 3000));

      const parsed = await page.evaluate(() => {
        const homeXI = [];
        const awayXI = [];
        const homeBench = [];
        const awayBench = [];

        const formBoxes = document.querySelectorAll('[class*="formation"], [class*="lineupHeader"], .wcl-headerSection_');
        let hForm = '4-3-3';
        let aForm = '4-2-3-1';
        if (formBoxes.length >= 2) {
          hForm = formBoxes[0].innerText.replace(/[^0-9-]/g, '') || '4-3-3';
          aForm = formBoxes[1].innerText.replace(/[^0-9-]/g, '') || '4-2-3-1';
        }

        const participants = document.querySelectorAll('.wcl-participant_v7u5b, .lf__participantNew, [class*="participantRow"], .smv__incident');
        participants.forEach((p, idx) => {
          const nameEl = p.querySelector('.wcl-name_ZggyJ, [class*="participantName"], .name');
          const numEl = p.querySelector('.wcl-jerseyNumber_, [class*="jerseyNumber"], .jersey');
          if (nameEl) {
            const name = nameEl.innerText.trim();
            const num = numEl ? parseInt(numEl.innerText.trim(), 10) || (idx + 1) : (idx + 1);
            const isGK = p.innerHTML.includes('(G)') || p.innerHTML.includes('Gardien') || idx === 0;
            const obj = { name, num, role: isGK ? 'G' : 'M' };
            if (homeXI.length < 11) homeXI.push(obj);
            else if (awayXI.length < 11) awayXI.push(obj);
            else if (homeBench.length < 9) homeBench.push(obj);
            else awayBench.push(obj);
          }
        });

        return { homeXI, awayXI, homeBench, awayBench, hForm, aForm, textSample: document.body.innerText.slice(0, 800) };
      });

      lineupsByMatch[m.matchId] = parsed;
      console.log(`   ✅ Extraits : Home=${parsed.homeXI.length}, Away=${parsed.awayXI.length}, Formations=${parsed.hForm} vs ${parsed.aForm}`);
    } catch(err) {
      console.warn(`   ⚠️ Erreur :`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'scraped_lineups_28aug.json'), JSON.stringify(lineupsByMatch, null, 2), 'utf8');
}

run().catch(console.error);