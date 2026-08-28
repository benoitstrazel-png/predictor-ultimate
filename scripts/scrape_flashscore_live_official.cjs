#!/usr/bin/env node
/**
 * scripts/scrape_flashscore_live_official.cjs
 * ─────────────────────────────────────────────────────────────
 * Scrape les classements et calendriers officiels réels 2026-2027
 * depuis les URLs Flashscore fournies par l'utilisateur.
 */

'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const URLS = {
  'FRA-L1': 'https://www.flashscore.fr/football/france/ligue-1/#/CQF28KxR/classements/global/',
  'ENG-PL': 'https://www.flashscore.fr/football/angleterre/premier-league/#/CfoA8Dmm/classements/global/',
  'ESP-LL': 'https://www.flashscore.fr/football/espagne/laliga/#/dWdJXP6U/classements/global/',
  'ITA-SA': 'https://www.flashscore.fr/football/italie/serie-a/#/CfujcOgK/classements/global/',
  'GER-BL': 'https://www.flashscore.fr/football/allemagne/bundesliga/#/jg0MwVuC/classements/global/'
};

async function scrapeAll() {
  console.log('🚀 Lancement du navigateur Stealth Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const results = {};

  try {
    for (const [leagueCode, url] of Object.entries(URLS)) {
      console.log(`\n🔍 Scraping de ${leagueCode} : ${url}`);
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        // Accepter les cookies si modal présent
        try {
          const cookieBtn = await page.$('#onetrust-accept-btn-handler');
          if (cookieBtn) await cookieBtn.click();
        } catch (e) {}

        // Extraire les noms des équipes dans le classement
        const teams = await page.evaluate(() => {
          const rows = document.querySelectorAll('.ui-table__row, .tableCellParticipant__name, a[href*="/equipe/"]');
          const extracted = new Set();
          rows.forEach(r => {
            const text = r.textContent.trim();
            if (text && text.length > 2 && !text.match(/^\d+$/) && !text.includes('Classement') && !text.includes('Football')) {
              extracted.add(text);
            }
          });
          return Array.from(extracted);
        });

        console.log(`   ✅ ${teams.length} équipes extraites pour ${leagueCode} :`, teams.slice(0, 10));
        results[leagueCode] = { teams, url };

        // Aller sur l'onglet Résultats pour extraire les vrais matchs joués
        const resultsUrl = url.replace('/classements/global/', '/resultats/').replace('#/CQF28KxR/classements/global/', 'resultats/');
        console.log(`   📅 Navigation vers les résultats : ${resultsUrl}`);
        await page.goto(resultsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        const matches = await page.evaluate(() => {
          const matchRows = document.querySelectorAll('.event__match, .event__match--scheduled, .event__match--static');
          const list = [];
          matchRows.forEach(m => {
            const home = m.querySelector('.event__participant--home')?.textContent?.trim();
            const away = m.querySelector('.event__participant--away')?.textContent?.trim();
            const scoreH = m.querySelector('.event__score--home')?.textContent?.trim();
            const scoreA = m.querySelector('.event__score--away')?.textContent?.trim();
            const time = m.querySelector('.event__time')?.textContent?.trim();
            if (home && away) {
              list.push({ home, away, scoreH, scoreA, time });
            }
          });
          return list;
        });

        console.log(`   ⚽ ${matches.length} rencontres extraites pour ${leagueCode} !`);
        results[leagueCode].matches = matches;

      } catch (err) {
        console.error(`   ❌ Erreur sur ${leagueCode} :`, err.message);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'flashscore_live_dump.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n💾 Dump live enregistré dans ${outPath}`);
}

scrapeAll().catch(console.error);
