#!/usr/bin/env node
/**
 * scripts/extract_flashscore_fixtures.cjs
 * ─────────────────────────────────────────────────────────────
 * Extraie l'ensemble des rencontres (Résultats + Calendriers)
 * pour les 5 tournois officiels 2026-2027 spécifiés par l'utilisateur.
 */

'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const LEAGUES = [
  { code: 'FRA-L1', id: 'CQF28KxR', url: 'https://www.flashscore.fr/football/france/ligue-1/#/CQF28KxR/' },
  { code: 'ENG-PL', id: 'CfoA8Dmm', url: 'https://www.flashscore.fr/football/angleterre/premier-league/#/CfoA8Dmm/' },
  { code: 'ESP-LL', id: 'dWdJXP6U', url: 'https://www.flashscore.fr/football/espagne/laliga/#/dWdJXP6U/' },
  { code: 'ITA-SA', id: 'CfujcOgK', url: 'https://www.flashscore.fr/football/italie/serie-a/#/CfujcOgK/' },
  { code: 'GER-BL', id: 'jg0MwVuC', url: 'https://www.flashscore.fr/football/allemagne/bundesliga/#/jg0MwVuC/' },
];

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const allData = {};

  for (const lg of LEAGUES) {
    console.log(`\n========================================`);
    console.log(`Extraction pour ${lg.code} (${lg.id})...`);
    console.log(`========================================`);
    allData[lg.code] = { results: [], fixtures: [] };

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
      // 1. Extraire les RÉSULTATS
      const resUrl = `${lg.url}resultats/`;
      console.log(`Navigation vers résultats : ${resUrl}`);
      await page.goto(resUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 4000));

      // Cliquer "Afficher plus de matchs" si présent
      try {
        const showMoreBtn = await page.$('.event__more');
        if (showMoreBtn) {
          await showMoreBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {}

      const results = await page.evaluate(() => {
        const matches = [];
        let currentRound = 'Journée 1';
        const rows = document.querySelectorAll('.event__round, .event__match');
        rows.forEach(el => {
          if (el.classList.contains('event__round')) {
            currentRound = el.textContent.trim();
          } else {
            const home = el.querySelector('.event__participant--home')?.textContent?.trim();
            const away = el.querySelector('.event__participant--away')?.textContent?.trim();
            const scoreH = el.querySelector('.event__score--home')?.textContent?.trim();
            const scoreA = el.querySelector('.event__score--away')?.textContent?.trim();
            const time = el.querySelector('.event__time')?.textContent?.trim();
            if (home && away) {
              matches.push({
                round: currentRound,
                home,
                away,
                homeScore: scoreH !== undefined && scoreH !== '' ? parseInt(scoreH, 10) : null,
                awayScore: scoreA !== undefined && scoreA !== '' ? parseInt(scoreA, 10) : null,
                time,
                status: 'FINISHED'
              });
            }
          }
        });
        return matches;
      });

      console.log(`   ✅ ${results.length} résultats terminés extraits pour ${lg.code}`);
      allData[lg.code].results = results;

      // 2. Extraire le CALENDRIER (Matchs à venir)
      const calUrl = `${lg.url}calendrier/`;
      console.log(`Navigation vers calendrier : ${calUrl}`);
      await page.goto(calUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 4000));

      // Cliquer "Afficher plus de matchs" si présent
      for (let i = 0; i < 5; i++) {
        try {
          const showMoreBtn = await page.$('.event__more');
          if (showMoreBtn) {
            await showMoreBtn.click();
            await new Promise(r => setTimeout(r, 1500));
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }

      const fixtures = await page.evaluate(() => {
        const matches = [];
        let currentRound = 'Journée 2';
        const rows = document.querySelectorAll('.event__round, .event__match');
        rows.forEach(el => {
          if (el.classList.contains('event__round')) {
            currentRound = el.textContent.trim();
          } else {
            const home = el.querySelector('.event__participant--home')?.textContent?.trim();
            const away = el.querySelector('.event__participant--away')?.textContent?.trim();
            const time = el.querySelector('.event__time')?.textContent?.trim();
            if (home && away) {
              matches.push({
                round: currentRound,
                home,
                away,
                time,
                status: 'SCHEDULED'
              });
            }
          }
        });
        return matches;
      });

      console.log(`   ✅ ${fixtures.length} matchs à venir extraits pour ${lg.code}`);
      allData[lg.code].fixtures = fixtures;

    } catch (err) {
      console.error(`   ❌ Erreur sur ${lg.code} :`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const outPath = path.join(__dirname, '..', 'src', 'data', 'flashscore_2026_2027_fixtures_dump.json');
  fs.writeFileSync(outPath, JSON.stringify(allData, null, 2), 'utf8');
  console.log(`\n🎉 Extraction terminée ! Fichier enregistré dans ${outPath}`);
}

run().catch(console.error);
