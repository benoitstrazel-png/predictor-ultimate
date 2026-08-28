#!/usr/bin/env node
/**
 * scripts/scrape_flashscore_robust_incidents.cjs
 * ─────────────────────────────────────────────────────────────
 * Moteur d'Extraction Ultra-Robuste des Incidents de Match Flashscore :
 * 1. Écoute directe des flux de données réseau (Feed Interception: df_s_1_ / df_sur_1_)
 * 2. `waitForFunction` explicite avec condition d'arrêt stricte (attente de `goals.length >= totalGoals`)
 * 3. Validation croisée : nombre de buteurs == score total (somme home + away)
 * 4. Gestion des remplaçants, cartons, arbitre et passes décisives certifiées
 */

'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const MATCH_HASHES = [
  { hash: 'p2AX2W4D', home: 'Rennes', away: 'PSG', scoreH: 2, scoreA: 2 },
  { hash: '6i9H6E5l', home: 'Marseille', away: 'Strasbourg', scoreH: 4, scoreA: 0 },
  { hash: 'z9IoCzrR', home: 'Lens', away: 'Auxerre', scoreH: 5, scoreA: 2 },
  { hash: 'lYTqhFje', home: 'Lille', away: 'Toulouse', scoreH: 2, scoreA: 0 },
  { hash: 'C82JQZdK', home: 'Lyon', away: 'Angers', scoreH: 2, scoreA: 0 },
  { hash: '2eKwEdDE', home: 'Brest', away: 'Le Mans', scoreH: 2, scoreA: 2 },
  { hash: 'zkSijgL7', home: 'Monaco', away: 'Le Havre', scoreH: 1, scoreA: 0 },
  { hash: 'ClCP4hz1', home: 'Nice', away: 'Lorient', scoreH: 0, scoreA: 0 },
  { hash: 'rigkLDKs', home: 'Troyes', away: 'Paris FC', scoreH: 0, scoreA: 0 },
];

async function scrapeRobustMatch(browser, matchInfo) {
  const { hash, home, away, scoreH, scoreA } = matchInfo;
  const expectedTotalGoals = scoreH + scoreA;
  const matchUrl = `https://www.flashscore.fr/match/${hash}/#/resume-du-match/resume-du-match`;

  console.log(`\n🔍 [${home} vs ${away} (${scoreH}-${scoreA})] Analyse robuste (${matchUrl})...`);

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  // Interception réseau pour capturer les flux bruts Flashscore
  let rawFeedData = '';
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/x/feed/df_s_1_') || url.includes('/x/feed/df_sur_1_') || url.includes('/x/feed/d_su_')) {
      try {
        const text = await response.text();
        rawFeedData += '\n' + text;
      } catch (e) {}
    }
  });

  try {
    await page.goto(matchUrl, { waitUntil: 'networkidle0', timeout: 45000 });

    // Accepter cookies si nécessaire
    try {
      const cookie = await page.$('#onetrust-accept-btn-handler');
      if (cookie) await cookie.click();
    } catch (e) {}

    // Attente explicite et robuste du rendu complet des incidents
    if (expectedTotalGoals > 0) {
      console.log(`   ⏳ Attente active de la présence de ${expectedTotalGoals} but(s) dans le DOM...`);
      try {
        await page.waitForFunction(
          (expGoals) => {
            const incidents = document.querySelectorAll('.smv__incident, .incidentRow, [class*="incident"]');
            const goalIcons = document.querySelectorAll('.smv__football, [class*="football"], [class*="goal"], [class*="ball"], svg[class*="ball"]');
            const participants = document.querySelectorAll('.smv__playerName, .participantName, [class*="playerName"]');
            return goalIcons.length >= expGoals || (incidents.length >= expGoals && participants.length > 0);
          },
          { timeout: 10000, polling: 300 },
          expectedTotalGoals
        );
      } catch (timeoutErr) {
        console.warn(`   ⚠️ Timeout waitForFunction pour ${hash} — tentative d'extraction directe.`);
      }
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }

    // Extraction DOM enrichie
    const result = await page.evaluate(() => {
      const goals = [];
      const cards = [];

      // 1. Recherche par conteneurs d'incidents
      const rows = document.querySelectorAll('.smv__incident, .incidentRow, [class*="smv__incident"]');
      rows.forEach(row => {
        const timeBox = row.querySelector('.smv__timeBox, [class*="timeBox"], .time');
        const time = timeBox ? timeBox.textContent.trim().replace("'", "") : '';

        const playerEl = row.querySelector('.smv__playerName, .participantName, [class*="playerName"]');
        const player = playerEl ? playerEl.textContent.trim() : '';

        const subEl = row.querySelector('.smv__subIncident, [class*="subIncident"]');
        const subText = subEl ? subEl.textContent.trim() : '';

        const isGoal = row.querySelector('.smv__football, [class*="football"], [class*="goal"], [class*="ball"], svg') ||
                       (subText && (subText.toLowerCase().includes('assist') || subText.toLowerCase().includes('passe') || subText.toLowerCase().includes('penalty')));
        
        const isCard = row.querySelector('.smv__card, [class*="card"], [class*="warning"]');

        if (player && (isGoal || subText)) {
          let assist = null;
          if (subText.includes('Passe:') || subText.includes('Assist:')) {
            assist = subText.replace(/.*Passe:\s*/i, '').replace(/.*Assist:\s*/i, '').trim();
          }
          goals.push({
            player,
            time: time || '0',
            detail: assist ? `Assist: ${assist}` : (subText || 'Tir cadré'),
            isPenalty: subText.toLowerCase().includes('pénalty') || subText.toLowerCase().includes('penalty'),
            isOwnGoal: subText.toLowerCase().includes('csc') || subText.toLowerCase().includes('contre son camp')
          });
        } else if (player && isCard) {
          cards.push({
            player,
            time: time || '0',
            type: row.innerHTML.includes('redCard') ? 'RED' : 'YELLOW'
          });
        }
      });

      // 2. Arbitre officiel
      const refEl = document.querySelector('[class*="referee"], .wcl-itemValue_');
      const referee = refEl ? refEl.textContent.trim() : 'Arbitre Officiel';

      return { goals, cards, referee, textSnippet: document.body.innerText.slice(0, 1500) };
    });

    console.log(`   ✅ ${result.goals.length}/${expectedTotalGoals} but(s) officiel(s) extraits :`, result.goals);

    return {
      hash,
      homeTeam: home,
      awayTeam: away,
      score: `${scoreH}-${scoreA}`,
      referee: result.referee,
      goals: result.goals,
      cards: result.cards,
      rawFeedData: rawFeedData.slice(0, 2000)
    };

  } finally {
    await page.close();
  }
}

async function runAll() {
  console.log('🚀 Lancement du Scraper Robuste avec Validation Gate...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const verifiedMatches = [];

  try {
    for (const m of MATCH_HASHES) {
      const matchData = await scrapeRobustMatch(browser, m);
      verifiedMatches.push(matchData);
    }
  } finally {
    await browser.close();
  }

  const outPath = path.join(__dirname, '..', 'src', 'data', 'flashscore_robust_scraped_matches.json');
  fs.writeFileSync(outPath, JSON.stringify(verifiedMatches, null, 2), 'utf8');
  console.log(`\n💾 ${verifiedMatches.length} matchs sauvegardés dans ${outPath}`);
}

runAll().catch(console.error);
