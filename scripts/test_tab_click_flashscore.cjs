#!/usr/bin/env node
/**
 * scripts/test_tab_click_flashscore.cjs
 */
'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const LEAGUES = [
  { code: 'FRA-L1', url: 'https://www.flashscore.fr/football/france/ligue-1/#/CQF28KxR/classements/global/' },
  { code: 'ENG-PL', url: 'https://www.flashscore.fr/football/angleterre/premier-league/#/CfoA8Dmm/classements/global/' },
  { code: 'ESP-LL', url: 'https://www.flashscore.fr/football/espagne/laliga/#/dWdJXP6U/classements/global/' },
  { code: 'ITA-SA', url: 'https://www.flashscore.fr/football/italie/serie-a/#/CfujcOgK/classements/global/' },
  { code: 'GER-BL', url: 'https://www.flashscore.fr/football/allemagne/bundesliga/#/jg0MwVuC/classements/global/' },
];

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const allMatches = {};

  for (const lg of LEAGUES) {
    console.log(`\n========================================`);
    console.log(`Scraping interactif pour ${lg.code}...`);
    console.log(`========================================`);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
      await page.goto(lg.url, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 4000));

      // 1. Accepter cookies
      try {
        const cookie = await page.$('#onetrust-accept-btn-handler');
        if (cookie) await cookie.click();
      } catch (e) {}

      // 2. Trouver et cliquer sur l'onglet "Résultats"
      const resBtn = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        return links.find(el => el.textContent.trim().toLowerCase() === 'résultats' || el.href?.includes('/resultats'));
      });

      if (resBtn && resBtn.asElement()) {
        console.log('   🖱️ Clic sur l\'onglet Résultats...');
        await resBtn.asElement().click();
        await new Promise(r => setTimeout(r, 4000));
      }

      // Extraire matchs terminés
      const results = await page.evaluate(() => {
        const list = [];
        let curRound = 'Journée 1';
        document.querySelectorAll('.event__round, .event__match').forEach(el => {
          if (el.classList.contains('event__round')) {
            curRound = el.textContent.trim();
          } else {
            const home = el.querySelector('.event__participant--home')?.textContent?.trim();
            const away = el.querySelector('.event__participant--away')?.textContent?.trim();
            const scoreH = el.querySelector('.event__score--home')?.textContent?.trim();
            const scoreA = el.querySelector('.event__score--away')?.textContent?.trim();
            const time = el.querySelector('.event__time')?.textContent?.trim();
            if (home && away) {
              list.push({ round: curRound, home, away, scoreH, scoreA, time, status: 'FINISHED' });
            }
          }
        });
        return list;
      });

      console.log(`   ✅ ${results.length} résultats trouvés pour ${lg.code} :`, results.slice(0, 5));

      // 3. Trouver et cliquer sur l'onglet "Calendrier"
      const calBtn = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        return links.find(el => el.textContent.trim().toLowerCase() === 'calendrier' || el.href?.includes('/calendrier'));
      });

      if (calBtn && calBtn.asElement()) {
        console.log('   🖱️ Clic sur l\'onglet Calendrier...');
        await calBtn.asElement().click();
        await new Promise(r => setTimeout(r, 4000));
      }

      // Extraire matchs à venir
      const fixtures = await page.evaluate(() => {
        const list = [];
        let curRound = 'Journée 2';
        document.querySelectorAll('.event__round, .event__match').forEach(el => {
          if (el.classList.contains('event__round')) {
            curRound = el.textContent.trim();
          } else {
            const home = el.querySelector('.event__participant--home')?.textContent?.trim();
            const away = el.querySelector('.event__participant--away')?.textContent?.trim();
            const time = el.querySelector('.event__time')?.textContent?.trim();
            if (home && away) {
              list.push({ round: curRound, home, away, time, status: 'SCHEDULED' });
            }
          }
        });
        return list;
      });

      console.log(`   ✅ ${fixtures.length} matchs à venir trouvés pour ${lg.code} :`, fixtures.slice(0, 5));

      allMatches[lg.code] = { results, fixtures };

    } catch (e) {
      console.error(`   ❌ Erreur :`, e.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const outPath = path.join(__dirname, '..', 'src', 'data', 'flashscore_verified_matches.json');
  fs.writeFileSync(outPath, JSON.stringify(allMatches, null, 2), 'utf8');
  console.log(`\n💾 Sauvegarde terminée dans ${outPath}`);
}

run().catch(console.error);
