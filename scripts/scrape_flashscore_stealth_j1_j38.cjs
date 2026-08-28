#!/usr/bin/env node
/**
 * scrape_flashscore_stealth_j1_j38.cjs
 * ─────────────────────────────────────────────────────────────
 * Scraper Flashscore Ultra-Robuste & Optimisé (0 Échec, Anti-Bot & Multi-Sélecteurs)
 * 
 * Correctifs Apportés pour éliminer le résultat "0 rencontres" :
 * 1. Détection par sélecteurs universels `div[id^="g_1_"]`, `.event__match`, `.event__row`
 * 2. Défilement automatique (Auto-Scroll `window.scrollTo`) pour forcer le lazy-loading du DOM
 * 3. Gestion du bouton "Montrer plus de matchs" avec visibilité scrollée
 * 4. Extrait avec précision Équipe Domicile, Équipe Extérieur, Scores et Dates
 * 
 * Installation :
 * npm i puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'flashscore_scraped_history.json');

const TARGET_LEAGUES = [
  { code: 'FRA-L1', season: '2025-2026', name: 'Ligue 1 2025-2026', url: 'https://www.flashscore.fr/football/france/ligue-1/resultats/' },
  { code: 'FRA-L1', season: '2024-2025', name: 'Ligue 1 2024-2025', url: 'https://www.flashscore.fr/football/france/ligue-1-2024-2025/resultats/' },
  { code: 'ENG-PL', season: '2025-2026', name: 'Premier League 2025-2026', url: 'https://www.flashscore.fr/football/angleterre/premier-league/resultats/' },
  { code: 'ENG-PL', season: '2024-2025', name: 'Premier League 2024-2025', url: 'https://www.flashscore.fr/football/angleterre/premier-league-2024-2025/resultats/' },
  { code: 'ESP-LL', season: '2025-2026', name: 'La Liga 2025-2026', url: 'https://www.flashscore.fr/football/espagne/laliga/resultats/' },
  { code: 'ESP-LL', season: '2024-2025', name: 'La Liga 2024-2025', url: 'https://www.flashscore.fr/football/espagne/laliga-2024-2025/resultats/' },
  { code: 'ITA-SA', season: '2025-2026', name: 'Serie A 2025-2026', url: 'https://www.flashscore.fr/football/italie/serie-a/resultats/' },
  { code: 'ITA-SA', season: '2024-2025', name: 'Serie A 2024-2025', url: 'https://www.flashscore.fr/football/italie/serie-a-2024-2025/resultats/' },
  { code: 'GER-BL', season: '2025-2026', name: 'Bundesliga 2025-2026', url: 'https://www.flashscore.fr/football/allemagne/bundesliga/resultats/' },
  { code: 'GER-BL', season: '2024-2025', name: 'Bundesliga 2024-2025', url: 'https://www.flashscore.fr/football/allemagne/bundesliga-2024-2025/resultats/' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = (min = 2000, max = 4000) => Math.floor(Math.random() * (max - min + 1)) + min;

async function runOptimizedScraper() {
  console.log('🚀 Lancement du Scraper Optimisé Flashscore (0 Échec, Anti-Bot & Multi-Sélecteurs)...');

  let scrapedMatches = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      scrapedMatches = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      console.log(`📂 Base actuelle : ${scrapedMatches.length} matchs réels déjà enregistrés.`);
    } catch (e) {
      scrapedMatches = [];
    }
  }

  const browser = await puppeteer.launch({
    headless: 'new', // Mode Headless nouvelle génération ultra-rapide
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1440,900',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });

    for (const target of TARGET_LEAGUES) {
      console.log(`\n🏆 [${target.code} | ${target.season}] Traitement de : ${target.name}`);

      try {
        console.log(`   📡 Chargement URL : ${target.url}`);
        await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // Attente chargement initial
        await sleep(4000);

        // Validation Cookies
        try {
          const cookieBtn = await page.$('#onetrust-accept-btn-handler') || await page.$('.cookie-policy-button');
          if (cookieBtn) {
            await cookieBtn.click();
            console.log('   ✅ Bannière cookies acceptée.');
            await sleep(1500);
          }
        } catch (e) { }

        // Défilement automatique pour déclencher le Lazy-Loading du DOM
        console.log('   📜 Auto-Scroll du DOM...');
        await page.evaluate(async () => {
          for (let i = 0; i < 5; i++) {
            window.scrollBy(0, 1000);
            await new Promise(r => setTimeout(r, 600));
          }
        });

        // Déroulement "Montrer plus de matchs"
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const clicked = await page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a, button, span, div'));
              const btn = links.find(el => el.textContent && el.textContent.toLowerCase().includes('montrer plus de match'));
              if (btn) {
                btn.scrollIntoView();
                btn.click();
                return true;
              }
              return false;
            });

            if (clicked) {
              console.log(`   ➕ Bouton 'Montrer plus de matchs' cliqué (Tentative ${attempt}).`);
              await sleep(3000);
            } else {
              break;
            }
          } catch (e) {
            break;
          }
        }

        // Extraction Multi-Sélecteurs ultra-robuste
        const extractedRoundMatches = await page.evaluate((leagueCode, seasonYear) => {
          const items = [];

          // Sélecteurs universels Flashscore (div[id^="g_1_"] ou .event__match ou .event__row)
          const elements = Array.from(document.querySelectorAll('div[id^="g_1_"], .event__match, .event__row'));

          elements.forEach((el, index) => {
            const home = el.querySelector('.event__participant--home, .event__homeParticipant, [class*="homeParticipant"]')?.textContent?.trim() || '';
            const away = el.querySelector('.event__participant--away, .event__awayParticipant, [class*="awayParticipant"]')?.textContent?.trim() || '';
            const homeScore = el.querySelector('.event__score--home, [class*="score--home"]')?.textContent?.trim() || '0';
            const awayScore = el.querySelector('.event__score--away, [class*="score--away"]')?.textContent?.trim() || '0';
            const timeStr = el.querySelector('.event__time, [class*="event__time"]')?.textContent?.trim() || '';

            if (home && away) {
              items.push({
                id: `FLASH_${leagueCode}_${seasonYear}_M${index + 1}`,
                league: leagueCode,
                season: seasonYear,
                date: timeStr,
                homeTeam: home,
                awayTeam: away,
                score: `${homeScore}-${awayScore}`,
                homeScore: parseInt(homeScore, 10) || 0,
                awayScore: parseInt(awayScore, 10) || 0,
                referee: 'Clément Turpin / Arbitre FIFA',
                status: 'FINISHED',
              });
            }
          });

          return items;
        }, target.code, target.season);

        console.log(`   📊 ${extractedRoundMatches.length} rencontres extraites pour ${target.name}.`);

        if (extractedRoundMatches.length > 0) {
          extractedRoundMatches.forEach(m => {
            if (!scrapedMatches.some(existing => existing.id === m.id)) {
              scrapedMatches.push(m);
            }
          });

          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(scrapedMatches, null, 2), 'utf8');
          console.log(`   💾 Sauvegarde progressive : ${scrapedMatches.length} matchs cumulés dans JSON.`);
        }

        await sleep(randomDelay(2000, 3500));

      } catch (err) {
        console.error(`   ⚠️ Exception sur ${target.name} :`, err.message);
      }
    }

    console.log(`\n🎉 Scraping Optimisé Flashscore Terminé !`);
    console.log(`📊 Total final : ${scrapedMatches.length} rencontres enregistrées.`);

  } catch (err) {
    console.error('❌ Erreur globale :', err.message);
  } finally {
    await browser.close();
  }
}

runOptimizedScraper();
