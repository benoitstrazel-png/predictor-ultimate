#!/usr/bin/env node
/**
 * scripts/scrape_flashscore_match_incidents.cjs
 * ─────────────────────────────────────────────────────────────
 * Moteur d'extraction des VRAIS buteurs, passeurs, cartons et arbitres
 * depuis les fiches de match officielles Flashscore.
 */

'use strict';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const LIGUE_1_URL = 'https://www.flashscore.fr/football/france/ligue-1/#/CQF28KxR/resultats/';

async function extractLigue1Incidents() {
  console.log('🚀 Démarrage du scraper d\'incidents Flashscore...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    console.log(`🌐 Accès à la page résultats : ${LIGUE_1_URL}`);
    await page.goto(LIGUE_1_URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 4000));

    // Accepter cookies
    try {
      const cookie = await page.$('#onetrust-accept-btn-handler');
      if (cookie) await cookie.click();
    } catch (e) {}

    // Récupérer les IDs de tous les matchs
    const matchIds = await page.evaluate(() => {
      const rows = document.querySelectorAll('[id^="g_1_"], .event__match');
      const list = [];
      rows.forEach(r => {
        const idAttr = r.id || r.getAttribute('id');
        if (idAttr && idAttr.startsWith('g_1_')) {
          const matchHash = idAttr.replace('g_1_', '');
          const home = r.querySelector('.event__participant--home')?.textContent?.trim();
          const away = r.querySelector('.event__participant--away')?.textContent?.trim();
          const scoreH = r.querySelector('.event__score--home')?.textContent?.trim();
          const scoreA = r.querySelector('.event__score--away')?.textContent?.trim();
          list.push({ hash: matchHash, home, away, score: `${scoreH}-${scoreA}` });
        }
      });
      return list;
    });

    console.log(`📋 ${matchIds.length} fiches de matchs détectées :`, matchIds);

    const detailedMatches = [];

    // Pour chaque match, ouvrir la page de résumé détaillée
    for (const m of matchIds) {
      const matchUrl = `https://www.flashscore.fr/match/${m.hash}/#/resume-du-match/resume-du-match`;
      console.log(`\n🔍 Extraction des détails pour ${m.home} vs ${m.away} (${matchUrl})...`);
      
      const matchPage = await browser.newPage();
      try {
        await matchPage.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        const matchData = await matchPage.evaluate(() => {
          const goals = [];
          const cards = [];

          // Sélecteurs des événements de match
          const incidents = document.querySelectorAll('.smv__incident, .incidentRow, [class*="incident"]');
          incidents.forEach(inc => {
            const timeEl = inc.querySelector('.smv__timeBox, [class*="timeBox"], .time');
            const time = timeEl ? timeEl.textContent.trim().replace("'", "") : '';
            
            // Détection de but (icône ballon ou classe goal)
            const isGoal = inc.querySelector('.smv__football, [class*="football"], [class*="goal"], [class*="ball"]');
            const isCard = inc.querySelector('.smv__card, [class*="card"]');

            const participant = inc.querySelector('.smv__playerName, .participantName, [class*="playerName"]')?.textContent?.trim();
            const subText = inc.querySelector('.smv__subIncident, [class*="subIncident"]')?.textContent?.trim();

            if (isGoal || (participant && (subText?.includes('Passe') || inc.textContent.includes('But')))) {
              let assist = null;
              if (subText && (subText.includes('Passe') || subText.includes('Assist'))) {
                assist = subText.replace(/.*Passe:\s*/i, '').replace(/.*Assist:\s*/i, '').trim();
              }
              goals.push({
                player: participant || 'Buteur',
                time: time || '0',
                detail: assist ? `Assist: ${assist}` : (subText || 'Tir cadré'),
                isPenalty: subText?.toLowerCase().includes('pénalty') || subText?.toLowerCase().includes('penalty'),
                isOwnGoal: subText?.toLowerCase().includes('csc') || subText?.toLowerCase().includes('contre son camp')
              });
            } else if (isCard) {
              cards.push({
                player: participant || 'Joueur averti',
                time: time || '0',
                type: inc.innerHTML.includes('redCard') ? 'RED' : 'YELLOW'
              });
            }
          });

          // Arbitre officiel
          const refEl = document.querySelector('[class*="referee"], .wcl-itemValue_');
          const referee = refEl ? refEl.textContent.trim() : null;

          return { goals, cards, referee, rawText: document.body.innerText.slice(0, 1000) };
        });

        console.log(`   ⚽ Buteurs extraits :`, matchData.goals);
        detailedMatches.push({
          hash: m.hash,
          homeTeam: m.home,
          awayTeam: m.away,
          score: m.score,
          referee: matchData.referee || 'Arbitre Officiel',
          goals: matchData.goals,
          cards: matchData.cards
        });

      } catch (err) {
        console.error(`   ❌ Erreur sur le match ${m.hash} :`, err.message);
      } finally {
        await matchPage.close();
      }
    }

    const outPath = path.join(__dirname, '..', 'src', 'data', 'flashscore_scraped_incidents.json');
    fs.writeFileSync(outPath, JSON.stringify(detailedMatches, null, 2), 'utf8');
    console.log(`\n💾 ${detailedMatches.length} fiches détaillées enregistrées dans ${outPath}`);

  } finally {
    await browser.close();
  }
}

extractLigue1Incidents().catch(console.error);
