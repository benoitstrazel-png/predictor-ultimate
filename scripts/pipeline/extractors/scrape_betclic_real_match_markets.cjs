/**
 * scripts/pipeline/extractors/scrape_betclic_real_match_markets.cjs
 * ─────────────────────────────────────────────────────────────
 * Extracteur Direct & Certifié des Marchés Détaillés Betclic.
 * - Scraping direct des pages de match via Puppeteer Stealth
 * - Extraction de l'état hydraté ng-state (Universal SSR)
 * - Récupération au centime près des cotes officielles :
 *     * 1N2, Double Chance, EarlyWin, DNB, Écarts
 *     * Buteur ou son remplaçant (SuperSub 90' officiel)
 *     * Buteur temps régulier, Joueur décisif (but/passe), Premier buteur, Doublé
 *     * Over/Under buts, Les 2 équipes marquent, Score exact
 * - Groupement automatique des joueurs par équipe via splitCardGroups
 * - Résolution des photos de joueurs depuis real_players.json
 * - Mise à jour directe de betclic_markets_cache.json et app_data.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

const ROOT_DIR = path.resolve(__dirname, '../../../');
const APP_DATA_PATH = path.join(ROOT_DIR, 'src', 'data', 'app_data.json');
const MARKETS_CACHE_PATH = path.join(ROOT_DIR, 'src', 'data', 'betclic_markets_cache.json');
const REAL_PLAYERS_PATH = path.join(ROOT_DIR, 'src', 'data', 'real_players.json');

const COMPETITIONS = [
  { code: 'ENG-PL', name: 'Premier League', url: 'https://www.betclic.fr/football-sfootball/angl-premier-league-c3' },
  { code: 'FRA-L1', name: 'Ligue 1', url: 'https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4' },
  { code: 'ESP-LL', name: 'La Liga', url: 'https://www.betclic.fr/football-sfootball/espagne-laliga-c7' },
  { code: 'ITA-SA', name: 'Serie A', url: 'https://www.betclic.fr/football-sfootball/italie-serie-a-c6' },
  { code: 'GER-BL', name: 'Bundesliga', url: 'https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5' },
  { code: 'EUR-CL', name: 'Ligue des Champions', url: 'https://www.betclic.fr/football-sfootball/ligue-des-champions-c8' },
  { code: 'EUR-EL', name: 'Ligue Europa', url: 'https://www.betclic.fr/football-sfootball/ligue-europa-c3453' },
  { code: 'EUR-ECL', name: 'Ligue Conférence', url: 'https://www.betclic.fr/football-sfootball/ligue-conference-c28946' },
];

function cleanTeamStr(raw) {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\'\’\-\.\,\(\)\/\\\_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bst\b/g, 'saint')
    .replace(/^(fc|cf|sc|rc|ac|as|sk|fk)\s+/g, '')
    .replace(/\s+(fc|cf|sc|rc|ac|as|sk|fk|tc)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadRealPlayersDb() {
  if (fs.existsSync(REAL_PLAYERS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(REAL_PLAYERS_PATH, 'utf8'));
    } catch (_) {}
  }
  return {};
}

function findPhotoForPlayer(playerName, teamName, playersDb) {
  if (!playerName || !teamName || !playersDb[teamName]) return '';
  const cleanP = cleanTeamStr(playerName);
  const pList = playersDb[teamName];
  for (const p of pList) {
    const cName = cleanTeamStr(p.name || '');
    if (cName === cleanP || cName.includes(cleanP) || cleanP.includes(cName)) {
      return p.photoUrl || '';
    }
  }
  return '';
}

function parseBetclicMatchData(matchPayload, ourMatch, realPlayersDb) {
  if (!matchPayload) return null;

  const contestants = matchPayload.contestants || [];
  const bHomeName = contestants[0]?.name || ourMatch.homeTeam;
  const bAwayName = contestants[1]?.name || ourMatch.awayTeam;
  const homeContestantId = contestants[0]?.id;
  const awayContestantId = contestants[1]?.id;

  const ourHome = ourMatch.homeTeam;
  const ourAway = ourMatch.awayTeam;
  const matchId = ourMatch.id;

  const subCategories = matchPayload.subCategories || [];
  const allMarkets = [];
  for (const sc of subCategories) {
    for (const mk of (sc.markets || [])) {
      allMarkets.push(mk);
    }
  }

  // 1. Extraction des cotes 1N2
  let betclic1N2 = null;
  const r1n2Market = allMarkets.find(m => m.name && m.name.includes('Résultat du match (t. rég)'));
  if (r1n2Market && Array.isArray(r1n2Market.mainSelections) && r1n2Market.mainSelections.length >= 3) {
    const hOdd = parseFloat(r1n2Market.mainSelections[0]?.odds);
    const dOdd = parseFloat(r1n2Market.mainSelections[1]?.odds);
    const aOdd = parseFloat(r1n2Market.mainSelections[2]?.odds);
    if (!isNaN(hOdd) && !isNaN(dOdd) && !isNaN(aOdd)) {
      betclic1N2 = { home: hOdd, draw: dOdd, away: aOdd };
    }
  }

  // 2. Sections de marchés structurés
  const sections = {
    RESULTS: { label: "Résultats", markets: [] },
    TOP: { label: "Le Top", markets: [] },
    GOALS: { label: "Buts", markets: [] },
    EXACT_SCORE: { label: "Score exact", markets: [] },
    PLAYERS: { label: "Buteurs & Joueurs", markets: [] },
    HALFTIME: { label: "Mi-temps", markets: [] },
    STATS: { label: "Stats équipes & joueurs", markets: [] },
    SPECIALS: { label: "⚡ Spéciaux & Fast", markets: [] }
  };

  // Helper pour extraire toutes les sélections d'un marché Betclic
  const extractMarketSelections = (mk) => {
    const selections = [];

    // Cas splitCardGroups (séparation par équipe officielle)
    if (Array.isArray(mk.splitCardGroups) && mk.splitCardGroups.length > 0) {
      for (const group of mk.splitCardGroups) {
        const groupTeamRaw = group.name || '';
        const teamAssigned = cleanTeamStr(groupTeamRaw).includes(cleanTeamStr(bHomeName)) || cleanTeamStr(groupTeamRaw).includes(cleanTeamStr(ourHome))
          ? ourHome
          : ourAway;

        for (const s of (group.selections || [])) {
          if (s.name && typeof s.odds === 'number') {
            const photo = findPhotoForPlayer(s.name, teamAssigned, realPlayersDb);
            selections.push({
              key: `${teamAssigned === ourHome ? 'H' : 'A'}_${cleanTeamStr(s.name).replace(/\s+/g, '_')}`,
              label: s.name.trim(),
              odds: s.odds,
              team: teamAssigned,
              photoUrl: photo,
              isLive: s.isLive
            });
          }
        }
      }
    }

    // Cas mainSelections (1N2, 2 buts d'avance, etc.)
    if (selections.length === 0 && Array.isArray(mk.mainSelections) && mk.mainSelections.length > 0) {
      for (const s of mk.mainSelections) {
        if (s.name && typeof s.odds === 'number') {
          let teamAssigned = null;
          if (cleanTeamStr(s.name).includes(cleanTeamStr(bHomeName)) || cleanTeamStr(s.name).includes(cleanTeamStr(ourHome))) {
            teamAssigned = ourHome;
          } else if (cleanTeamStr(s.name).includes(cleanTeamStr(bAwayName)) || cleanTeamStr(s.name).includes(cleanTeamStr(ourAway))) {
            teamAssigned = ourAway;
          }
          selections.push({
            key: `MAIN_${cleanTeamStr(s.name).replace(/\s+/g, '_')}`,
            label: s.name.trim(),
            odds: s.odds,
            team: teamAssigned,
            isLive: s.isLive
          });
        }
      }
    }

    // Cas selectionMatrix (Scores exacts, Écarts, etc.)
    if (selections.length === 0 && Array.isArray(mk.selectionMatrix) && mk.selectionMatrix.length > 0) {
      for (const row of mk.selectionMatrix) {
        for (const item of (row.selections || [])) {
          const s = item?.selectionOneof?.selection || item?.selection;
          if (s && s.name && typeof s.odds === 'number') {
            selections.push({
              key: `MAT_${cleanTeamStr(s.name).replace(/\s+/g, '_')}`,
              label: s.name.trim(),
              odds: s.odds,
              isLive: s.isLive
            });
          }
        }
      }
    }

    return selections;
  };

  for (const mk of allMarkets) {
    const rawName = mk.name || '';
    const sels = extractMarketSelections(mk);
    if (sels.length === 0) continue;

    const isSuperSub = Boolean(mk.isSuperSub || rawName.includes('SuperSub') || rawName.includes('son remplaçant'));

    const structuredMarket = {
      marketId: `${matchId}_${mk.id}`,
      marketName: rawName,
      category: '',
      isLive: Boolean(mk.isLive),
      isSuperSub: isSuperSub,
      description: isSuperSub ? "Si votre joueur démarre et sort en cours de match, son remplaçant prend le relais !" : null,
      selections: sels
    };

    // Classification dans l'une des 8 sections Betclic
    if (rawName.includes('Buteur') || rawName.includes('décisif') || rawName.includes('Passeur') || rawName.includes('Passe')) {
      structuredMarket.category = 'PLAYERS';
      sections.PLAYERS.markets.push(structuredMarket);
    } else if (rawName.includes('Résultat du match') || rawName.includes('Double chance') || rawName.includes('remboursé si match nul') || rawName.includes('2 buts d\'avance') || rawName.includes('Écart')) {
      structuredMarket.category = 'RESULTS';
      sections.RESULTS.markets.push(structuredMarket);
    } else if (rawName.includes('Score exact')) {
      structuredMarket.category = 'EXACT_SCORE';
      sections.EXACT_SCORE.markets.push(structuredMarket);
    } else if (rawName.includes('Nombre total de buts') || rawName.includes('Les 2 équipes marquent') || rawName.includes('Total de buts')) {
      structuredMarket.category = 'GOALS';
      sections.GOALS.markets.push(structuredMarket);
    } else if (rawName.includes('1ère mi-temps') || rawName.includes('2ème mi-temps') || rawName.includes('Mi-temps')) {
      structuredMarket.category = 'HALFTIME';
      sections.HALFTIME.markets.push(structuredMarket);
    } else if (rawName.includes('Tirs') || rawName.includes('Corners') || rawName.includes('Cartons') || rawName.includes('Fautes')) {
      structuredMarket.category = 'STATS';
      sections.STATS.markets.push(structuredMarket);
    } else if (rawName.includes('EarlyWin') || rawName.includes('Extra gains') || rawName.includes('Fast')) {
      structuredMarket.category = 'SPECIALS';
      sections.SPECIALS.markets.push(structuredMarket);
    } else {
      structuredMarket.category = 'TOP';
      sections.TOP.markets.push(structuredMarket);
    }
  }

  // Si SuperSub est présent dans PLAYERS, le mettre également en avant dans TOP
  const mainSuperSub = sections.PLAYERS.markets.find(m => m.isSuperSub);
  if (mainSuperSub && !sections.TOP.markets.some(m => m.marketName === mainSuperSub.marketName)) {
    sections.TOP.markets.unshift(mainSuperSub);
  }

  return {
    matchId,
    betclicOdds: betclic1N2,
    sections,
    marketsCount: Object.values(sections).reduce((acc, s) => acc + s.markets.length, 0),
    totalSelections: Object.values(sections).reduce((acc, s) => acc + s.markets.reduce((mAcc, m) => mAcc + m.selections.length, 0), 0)
  };
}

async function scrapeCompetitionMatches(compUrl, appData, marketsCache, realPlayersDb) {
  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    console.log(`[Scraper] Exploration de la compétition: ${compUrl}...`);
    await page.goto(compUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // Collecte de tous les liens de match
    const matchLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/football-sfootball/"]'));
      const results = [];
      const seen = new Set();
      for (const a of links) {
        if (a.href.match(/\/football-sfootball\/.*-m\d+/)) {
          if (!seen.has(a.href)) {
            seen.add(a.href);
            results.push(a.href);
          }
        }
      }
      return results;
    });

    console.log(`[Scraper] ${matchLinks.length} matchs trouvés sur Betclic.`);

    const schedule = appData.fullSchedule || [];
    let updatedCount = 0;

    for (const matchUrl of matchLinks) {
      try {
        console.log(`[Scraper] Récupération du match: ${matchUrl}...`);
        await page.goto(matchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        const rawMatch = await page.evaluate(() => {
          const el = document.getElementById('ng-state');
          if (!el) return null;
          try {
            const state = JSON.parse(el.textContent);
            for (const k of Object.keys(state)) {
              if (state[k]?.response?.payload?.match) {
                return state[k].response.payload.match;
              }
            }
          } catch (_) {}
          return null;
        });

        if (!rawMatch) {
          console.log(`  [Pass] Aucun payload match trouvé pour ${matchUrl}`);
          continue;
        }

        const bHome = rawMatch.contestants?.[0]?.name || '';
        const bAway = rawMatch.contestants?.[1]?.name || '';
        if (!bHome || !bAway) continue;

        const cleanBH = cleanTeamStr(bHome);
        const cleanBA = cleanTeamStr(bAway);

        // Correspondance avec notre calendrier fullSchedule
        const targetMatch = schedule.find(m => {
          const mh = cleanTeamStr(m.homeTeam);
          const ma = cleanTeamStr(m.awayTeam);
          return (mh === cleanBH && ma === cleanBA) ||
                 (cleanBH.includes(mh) && cleanBA.includes(ma)) ||
                 (mh.includes(cleanBH) && ma.includes(cleanBA));
        });

        if (!targetMatch) {
          console.log(`  [Non répertorié] ${bHome} vs ${bAway} non trouvé dans fullSchedule`);
          continue;
        }

        console.log(`  [Match Associé] ${targetMatch.id}: ${targetMatch.homeTeam} vs ${targetMatch.awayTeam}`);

        const parsed = parseBetclicMatchData(rawMatch, targetMatch, realPlayersDb);
        if (!parsed) continue;

        // 1. Mettre à jour le cache des marchés détaillés
        marketsCache[targetMatch.id] = {
          sections: parsed.sections,
          lastSync: new Date().toISOString(),
          source: 'betclic_direct_ng_state'
        };

        // 2. Mettre à jour les cotes 1N2 et statut dans app_data.json
        if (parsed.betclicOdds) {
          targetMatch.betclicOdds = parsed.betclicOdds;
          targetMatch.oddsStatus = 'ACTIVE';
          targetMatch.lastOddsRefresh = new Date().toISOString();
        }

        console.log(`  ✓ ${parsed.marketsCount} marchés, ${parsed.totalSelections} sélections certifiées enregistrées !`);
        updatedCount++;
      } catch (err) {
        console.warn(`  [Erreur match] ${matchUrl}: ${err.message}`);
      }
    }

    await browser.close();
    return updatedCount;
  } catch (err) {
    console.error(`[Scraper Erreur globale] ${err.message}`);
    if (browser) await browser.close();
    return 0;
  }
}

async function main() {
  console.log('=== LANCEMENT DU SCRAPER DIRECT DE MARCHÉS BETCLIC ===');
  const realPlayersDb = loadRealPlayersDb();

  let appData = { fullSchedule: [] };
  if (fs.existsSync(APP_DATA_PATH)) {
    appData = JSON.parse(fs.readFileSync(APP_DATA_PATH, 'utf8'));
  }

  let marketsCache = {};
  if (fs.existsSync(MARKETS_CACHE_PATH)) {
    try {
      marketsCache = JSON.parse(fs.readFileSync(MARKETS_CACHE_PATH, 'utf8'));
    } catch (_) {}
  }

  const targetArg = process.argv[2] || 'ALL';
  let compsToScrape = [];
  if (targetArg === 'ALL') {
    compsToScrape = COMPETITIONS;
  } else {
    const c = COMPETITIONS.find(x => x.code === targetArg);
    compsToScrape = c ? [c] : [COMPETITIONS[0]];
  }

  let totalUpdated = 0;
  for (const comp of compsToScrape) {
    console.log(`\nCompétition ciblée: ${comp.name} (${comp.code})`);
    const count = await scrapeCompetitionMatches(comp.url, appData, marketsCache, realPlayersDb);
    totalUpdated += count;
  }

  console.log(`\nSauvegarde des résultats (${totalUpdated} rencontres au total enrichies)...`);
  fs.writeFileSync(MARKETS_CACHE_PATH, JSON.stringify(marketsCache, null, 2), 'utf8');
  fs.writeFileSync(APP_DATA_PATH, JSON.stringify(appData), 'utf8');

  console.log('=== EXTRACTION TERMINÉE AVEC SUCCÈS ===');
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
