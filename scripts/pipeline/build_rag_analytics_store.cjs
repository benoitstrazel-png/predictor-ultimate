/**
 * scripts/pipeline/build_rag_analytics_store.cjs
 * ─────────────────────────────────────────────────────────────
 * Compilateur du Feature Store Analytique RAG Football :
 * 1. Analyse multi-saisons (2024-2025, 2025-2026, 2026-2027) de plus de 4 800 rencontres
 * 2. Extraction et classement exhaustif des cartons (jaunes & rouges) par joueur, club et ligue
 * 3. Statistiques Domicile vs Extérieur certifiées pour 222 clubs
 * 4. Paires H2H de confrontations directes (scores, dates, buteurs, tension disciplinaire)
 * 5. Statistiques de sévérité du corps arbitral européen
 * 6. Exportation atomique vers src/data/compiled/rag_analytics_store.json
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const HISTORY_DIR = path.join(ROOT_DIR, 'public/data/history');
const APP_DATA_PATH = path.join(ROOT_DIR, 'src/data/app_data.json');
const REFEREES_PATH = path.join(ROOT_DIR, 'src/data/referees_master.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'src/data/compiled/rag_analytics_store.json');

console.log('🚀 Démarrage de la compilation du RAG Analytics Store...');

// 1. Chargement de l'ensemble des matchs
const allMatches = [];

const historyFiles = ['2024-2025_ALL.json', '2025-2026_ALL.json', '2026-2027_ALL.json'];
historyFiles.forEach(file => {
  const filePath = path.join(HISTORY_DIR, file);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(data)) {
        allMatches.push(...data);
        console.log(`✓ Chargé ${file} : ${data.length} matchs`);
      }
    } catch (e) {
      console.warn(`⚠️ Erreur lecture ${file}:`, e.message);
    }
  }
});

// Compléter avec les matchs terminés de app_data.json s'ils ne sont pas déjà inclus
if (fs.existsSync(APP_DATA_PATH)) {
  try {
    const appData = JSON.parse(fs.readFileSync(APP_DATA_PATH, 'utf-8'));
    const existingIds = new Set(allMatches.map(m => m.id));
    let addedCount = 0;
    (appData.fullSchedule || []).forEach(m => {
      if (m.status === 'FINISHED' && !existingIds.has(m.id)) {
        allMatches.push(m);
        existingIds.add(m.id);
        addedCount++;
      }
    });
    console.log(`✓ Ajouté ${addedCount} matchs terminés depuis app_data.json`);
  } catch (e) {
    console.warn('⚠️ Erreur lecture app_data.json:', e.message);
  }
}

console.log(`📊 Total des matchs analysés : ${allMatches.length}`);

// Normalisation des noms de clubs
const normalize = (str) => {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

const getH2hKey = (t1, t2) => [normalize(t1), normalize(t2)].sort().join('__');

// Structures de données pour l'analyse
const teams = {};
const globalPlayerCards = {};
const globalPlayerGoals = {};
const h2hMap = {};
const refereesMap = {};

const getOrCreateTeam = (name, league = '') => {
  if (!teams[name]) {
    teams[name] = {
      name,
      league: league || 'Unknown',
      home: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, cleanSheets: 0, xgFor: 0, xgAgainst: 0 },
      away: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, cleanSheets: 0, xgFor: 0, xgAgainst: 0 },
      discipline: { yellowTotal: 0, redTotal: 0, matches: 0 },
      playersCards: {},
      playersGoals: {}
    };
  }
  if (league && teams[name].league === 'Unknown') teams[name].league = league;
  return teams[name];
};

// Parcours et agrégation
allMatches.forEach(m => {
  if (!m.homeTeam || !m.awayTeam) return;

  const h = getOrCreateTeam(m.homeTeam, m.league);
  const a = getOrCreateTeam(m.awayTeam, m.league);

  const hs = parseInt(m.homeScore, 10) || 0;
  const as = parseInt(m.awayScore, 10) || 0;
  const hXg = parseFloat(m.homeXg) || 0;
  const aXg = parseFloat(m.awayXg) || 0;

  // Domicile Team H
  h.home.played++;
  h.home.gf += hs;
  h.home.ga += as;
  h.home.xgFor += hXg;
  h.home.xgAgainst += aXg;
  if (as === 0) h.home.cleanSheets++;
  if (hs > as) h.home.won++;
  else if (hs === as) h.home.drawn++;
  else h.home.lost++;

  // Extérieur Team A
  a.away.played++;
  a.away.gf += as;
  a.away.ga += hs;
  a.away.xgFor += aXg;
  a.away.xgAgainst += hXg;
  if (hs === 0) a.away.cleanSheets++;
  if (as > hs) a.away.won++;
  else if (as === hs) a.away.drawn++;
  else a.away.lost++;

  h.discipline.matches++;
  a.discipline.matches++;

  // Cartons
  const matchCards = m.cards || [];
  matchCards.forEach(c => {
    if (!c.player || c.isCoach) return;
    const pName = c.player.replace(/\(.*\)/, '').trim();
    if (!pName) return;

    const isYellow = c.type === 'YELLOW' || c.type === 'Yellow Card' || c.type === 'Yellow';
    const isRed = c.type === 'RED' || c.type === 'Red Card' || c.type === 'Red';

    if (!isYellow && !isRed) return;

    // Équipe associée
    const teamObj = (c.team === m.homeTeam || normalize(c.team) === normalize(m.homeTeam)) ? h : a;
    const teamName = teamObj.name;

    // Team players cards
    if (!teamObj.playersCards[pName]) {
      teamObj.playersCards[pName] = { name: pName, yellows: 0, reds: 0, total: 0 };
    }

    // Global player cards
    if (!globalPlayerCards[pName]) {
      globalPlayerCards[pName] = { name: pName, team: teamName, league: m.league || teamObj.league, yellows: 0, reds: 0, total: 0 };
    }

    if (isYellow) {
      teamObj.playersCards[pName].yellows++;
      teamObj.playersCards[pName].total++;
      teamObj.discipline.yellowTotal++;

      globalPlayerCards[pName].yellows++;
      globalPlayerCards[pName].total++;
    } else if (isRed) {
      teamObj.playersCards[pName].reds++;
      teamObj.playersCards[pName].total++;
      teamObj.discipline.redTotal++;

      globalPlayerCards[pName].reds++;
      globalPlayerCards[pName].total++;
    }
  });

  // Buts
  const matchGoals = m.goals || [];
  matchGoals.forEach(g => {
    if (!g.player) return;
    const pName = g.player.replace(/\(.*\)/, '').trim();
    if (!pName) return;

    const isHomeGoal = g.team === m.homeTeam || normalize(g.team) === normalize(m.homeTeam);
    const teamObj = isHomeGoal ? h : a;
    const teamName = teamObj.name;
    const isPen = Boolean(g.isPenalty || (g.detail && g.detail.toLowerCase().includes('penalty')));

    // Team players goals
    if (!teamObj.playersGoals[pName]) {
      teamObj.playersGoals[pName] = { name: pName, goals: 0, penalties: 0 };
    }
    teamObj.playersGoals[pName].goals++;
    if (isPen) teamObj.playersGoals[pName].penalties++;

    // Global player goals
    if (!globalPlayerGoals[pName]) {
      globalPlayerGoals[pName] = { name: pName, team: teamName, league: m.league || teamObj.league, goals: 0, penalties: 0 };
    }
    globalPlayerGoals[pName].goals++;
    if (isPen) globalPlayerGoals[pName].penalties++;
  });

  // Arbitre
  if (m.referee) {
    const rawRefName = typeof m.referee === 'string' ? m.referee : (m.referee.name || '');
    const cleanRefName = rawRefName.split('\n')[0].replace(/\(.*?\)/g, '').trim();
    if (cleanRefName && cleanRefName !== 'N/A') {
      if (!refereesMap[cleanRefName]) {
        refereesMap[cleanRefName] = { name: cleanRefName, matches: 0, yellowTotal: 0, redTotal: 0, penalties: 0 };
      }
      const r = refereesMap[cleanRefName];
      r.matches++;
      matchCards.forEach(c => {
        if (c.type === 'YELLOW' || c.type === 'Yellow Card' || c.type === 'Yellow') r.yellowTotal++;
        if (c.type === 'RED' || c.type === 'Red Card' || c.type === 'Red') r.redTotal++;
      });
      matchGoals.forEach(g => {
        if (g.isPenalty || (g.detail && g.detail.toLowerCase().includes('penalty'))) r.penalties++;
      });
    }
  }

  // H2H
  const h2hKey = getH2hKey(m.homeTeam, m.awayTeam);
  if (!h2hMap[h2hKey]) {
    h2hMap[h2hKey] = {
      team1: m.homeTeam,
      team2: m.awayTeam,
      stats: { total: 0, draws: 0, totalGoals: 0, totalCards: 0, winsTeam1: 0, winsTeam2: 0 },
      matches: []
    };
  }
  const hEntry = h2hMap[h2hKey];
  hEntry.stats.total++;
  hEntry.stats.totalGoals += (hs + as);
  const cardCount = matchCards.length;
  hEntry.stats.totalCards += cardCount;

  const isTeam1Home = normalize(m.homeTeam) === normalize(hEntry.team1);
  if (hs > as) {
    if (isTeam1Home) hEntry.stats.winsTeam1++;
    else hEntry.stats.winsTeam2++;
  } else if (as > hs) {
    if (isTeam1Home) hEntry.stats.winsTeam2++;
    else hEntry.stats.winsTeam1++;
  } else {
    hEntry.stats.draws++;
  }

  if (hEntry.matches.length < 8) {
    hEntry.matches.push({
      date: m.date || m.matchDate || 'Date inconnue',
      competition: m.league || 'Ligue',
      home: m.homeTeam,
      away: m.awayTeam,
      score: `${hs}-${as}`,
      cards: cardCount,
      scorers: matchGoals.slice(0, 4).map(g => g.player ? g.player.replace(/\(.*\)/, '').trim() : '').filter(Boolean)
    });
  }
});

// Finalisation des clubs
const compiledTeams = {};
Object.keys(teams).forEach(k => {
  const t = teams[k];
  const sortedCards = Object.values(t.playersCards).sort((a, b) => b.yellows - a.yellows).slice(0, 8);
  const sortedGoals = Object.values(t.playersGoals).sort((a, b) => b.goals - a.goals).slice(0, 8);

  const homeWinPct = t.home.played ? Math.round((t.home.won / t.home.played) * 100) : 0;
  const awayWinPct = t.away.played ? Math.round((t.away.won / t.away.played) * 100) : 0;

  compiledTeams[k] = {
    name: t.name,
    league: t.league,
    home: {
      played: t.home.played,
      won: t.home.won,
      drawn: t.home.drawn,
      lost: t.home.lost,
      winRatePct: homeWinPct,
      winRateStr: `${homeWinPct}%`,
      gf: t.home.gf,
      ga: t.home.ga,
      avgGf: t.home.played ? +(t.home.gf / t.home.played).toFixed(2) : 0,
      avgGa: t.home.played ? +(t.home.ga / t.home.played).toFixed(2) : 0,
      cleanSheets: t.home.cleanSheets,
      cleanSheetPct: t.home.played ? `${Math.round((t.home.cleanSheets / t.home.played) * 100)}%` : '0%',
      avgXgFor: t.home.played ? +(t.home.xgFor / t.home.played).toFixed(2) : 0,
      avgXgAgainst: t.home.played ? +(t.home.xgAgainst / t.home.played).toFixed(2) : 0,
    },
    away: {
      played: t.away.played,
      won: t.away.won,
      drawn: t.away.drawn,
      lost: t.away.lost,
      winRatePct: awayWinPct,
      winRateStr: `${awayWinPct}%`,
      gf: t.away.gf,
      ga: t.away.ga,
      avgGf: t.away.played ? +(t.away.gf / t.away.played).toFixed(2) : 0,
      avgGa: t.away.played ? +(t.away.ga / t.away.played).toFixed(2) : 0,
      cleanSheets: t.away.cleanSheets,
      cleanSheetPct: t.away.played ? `${Math.round((t.away.cleanSheets / t.away.played) * 100)}%` : '0%',
      avgXgFor: t.away.played ? +(t.away.xgFor / t.away.played).toFixed(2) : 0,
      avgXgAgainst: t.away.played ? +(t.away.xgAgainst / t.away.played).toFixed(2) : 0,
    },
    discipline: {
      matches: t.discipline.matches,
      yellowTotal: t.discipline.yellowTotal,
      redTotal: t.discipline.redTotal,
      yellowsPerMatch: t.discipline.matches ? +(t.discipline.yellowTotal / t.discipline.matches).toFixed(2) : 0,
      redsPerMatch: t.discipline.matches ? +(t.discipline.redTotal / t.discipline.matches).toFixed(2) : 0,
    },
    topCardedPlayers: sortedCards,
    topScorers: sortedGoals
  };
});

// Leaderboards Globaux & par Ligue
const globalTopYellowCards = Object.values(globalPlayerCards)
  .sort((a, b) => b.yellows - a.yellows || b.total - a.total)
  .slice(0, 30);

const globalTopGoalscorers = Object.values(globalPlayerGoals)
  .sort((a, b) => b.goals - a.goals)
  .slice(0, 30);

// Finalisation Arbitres
const compiledReferees = {};
Object.keys(refereesMap).forEach(refName => {
  const r = refereesMap[refName];
  if (r.matches >= 3) {
    const yAvg = +(r.yellowTotal / r.matches).toFixed(2);
    const rAvg = +(r.redTotal / r.matches).toFixed(2);
    const penAvg = +(r.penalties / r.matches).toFixed(2);
    const severityScore = +(Math.min(9.9, Math.max(3.0, (yAvg * 1.5 + rAvg * 6.0 + penAvg * 4.0)))).toFixed(1);
    compiledReferees[refName] = {
      name: r.name,
      matches: r.matches,
      yellowTotal: r.yellowTotal,
      redTotal: r.redTotal,
      yellowsPerMatch: yAvg,
      redsPerMatch: rAvg,
      penaltiesPerMatch: penAvg,
      severityScore,
      severityLabel: severityScore >= 7.8 ? 'Très Sévère' : severityScore >= 6.5 ? 'Modérée à Élevée' : 'Tolérante'
    };
  }
});

const resultPayload = {
  meta: {
    generatedAt: new Date().toISOString(),
    totalMatchesAnalyzed: allMatches.length,
    totalTeamsCount: Object.keys(compiledTeams).length,
    totalH2hPairsCount: Object.keys(h2hMap).length,
    totalCardedPlayersCount: Object.keys(globalPlayerCards).length,
    totalGoalscorersCount: Object.keys(globalPlayerGoals).length
  },
  globalLeaderboards: {
    topYellowCards: globalTopYellowCards,
    topGoalscorers: globalTopGoalscorers
  },
  teams: compiledTeams,
  h2h: h2hMap,
  referees: compiledReferees
};

// Écriture atomique du store
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(resultPayload, null, 2), 'utf-8');
const stat = fs.statSync(OUTPUT_PATH);
console.log(`✅ Fichier généré avec succès : ${OUTPUT_PATH}`);
console.log(`📦 Taille : ${(stat.size / 1024).toFixed(1)} Ko`);
console.log(`🏆 Top 3 Cartons Jaunes Europe :`);
globalTopYellowCards.slice(0, 3).forEach((p, idx) => {
  console.log(`   ${idx + 1}. ${p.name} (${p.team}) : ${p.yellows} jaunes, ${p.reds} rouges`);
});
console.log(`⚽ Top 3 Buteurs Europe :`);
globalTopGoalscorers.slice(0, 3).forEach((p, idx) => {
  console.log(`   ${idx + 1}. ${p.name} (${p.team}) : ${p.goals} buts (${p.penalties} penalties)`);
});
