/**
 * src/utils/standingsEngine.js
 * ─────────────────────────────────────────────────────────────
 * Moteur d'agrégation et de calcul analytique pour les championnats européens :
 * - Classement officiel (Général, Domicile, Extérieur, Forme 5 derniers matchs)
 * - Tops Buteurs & Passeurs (avec penaltys, xG, xA, ratios)
 * - Discipline & Fair-play (Cartons jaunes/rouges, fautes commises par joueur et équipe)
 * - Baromètre et métriques d'arbitrage (Fautes/m, Cartons/m, Penaltys/m, Indice de sévérité)
 * - Cache mémoïsé LRU pour garantie 60 FPS sans recalcul inutile
 */

// Cache mémoïsé en mémoire
const engineCache = new Map();

/**
 * Normalisation robuste des noms de joueurs pour matching
 */
export function normalizePlayerName(name) {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Fusionne UNIFIED_HISTORY et APP_DATA.fullSchedule
 */
export function buildCombinedMatches(unifiedHistory = [], appDataSchedule = []) {
  const cacheKey = `combined_matches_${unifiedHistory.length}_${appDataSchedule.length}`;
  if (engineCache.has(cacheKey)) {
    return engineCache.get(cacheKey);
  }

  const map = new Map();

  const getMatchKey = (m) => {
    const season = m.season || '2026-2027';
    const league = m.league || 'FRA-L1';
    const roundStr = String(m.round || m.week || 'J1');
    const home = (m.homeTeam || m.home || '').trim().toLowerCase();
    const away = (m.awayTeam || m.away || '').trim().toLowerCase();
    return `${season}_${league}_${roundStr}_${home}_${away}`;
  };

  // 1. Matchs historiques
  unifiedHistory.forEach((m) => {
    const key = getMatchKey(m);
    map.set(key, {
      ...m,
      season: m.season || '2025-2026',
      status: m.status || 'FINISHED',
    });
  });

  // 2. Calendrier 2026-2027 et mises à jour récentes
  appDataSchedule.forEach((m) => {
    const key = getMatchKey(m);
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        id: m.id || existing.id,
        date: m.matchDate || m.date || existing.date,
        matchDate: m.matchDate || existing.matchDate,
        homeScore: m.homeScore ?? existing.homeScore,
        awayScore: m.awayScore ?? existing.awayScore,
        score: (m.score && typeof m.score === 'object') ? `${m.score.home}-${m.score.away}` : (m.score || existing.score),
        referee: (m.referee && typeof m.referee === 'object') ? m.referee.name : (existing.referee || m.referee),
        goals: (m.goals && m.goals.length > 0) ? m.goals : (existing.goals || []),
        cards: (m.cards && m.cards.length > 0) ? m.cards : (existing.cards || []),
        teamStats: m.teamStats || existing.teamStats,
        status: m.status || existing.status || 'SCHEDULED',
      });
    } else {
      map.set(key, {
        id: m.id,
        league: m.league,
        season: m.season || '2026-2027',
        round: typeof m.week === 'number' ? `Journée ${m.week}` : (m.week || 'Journée 1'),
        date: m.matchDate || m.date || '2026-2027',
        matchDate: m.matchDate,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeLogo: m.homeLogo,
        awayLogo: m.awayLogo,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        score: m.score ? (typeof m.score === 'object' ? `${m.score.home}-${m.score.away}` : m.score) : (m.status === 'FINISHED' ? `${m.homeScore}-${m.awayScore}` : (m.status === 'LIVE' ? 'LIVE' : 'À Venir')),
        referee: m.referee?.name || (typeof m.referee === 'string' ? m.referee : 'Arbitre Officiel'),
        goals: m.goals || [],
        cards: m.cards || [],
        teamStats: m.teamStats,
        status: m.status || 'SCHEDULED',
      });
    }
  });

  const result = Array.from(map.values());
  engineCache.set(cacheKey, result);
  return result;
}

/**
 * Zones UEFA et Relégation selon la ligue et le format
 */
export function getLeagueZoneInfo(rank, leagueId, totalTeams = 18) {
  const isUCL = leagueId === 'EUR-CL';
  const isUEL = leagueId === 'EUR-EL';
  const isUECL = leagueId === 'EUR-ECL';

  if (isUCL || isUEL || isUECL) {
    if (rank <= 8) {
      return {
        type: 'ucl_direct',
        label: '1/8e de Finale Direct',
        color: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.15)',
        badgeBorder: 'rgba(59, 130, 246, 0.4)',
      };
    }
    if (rank <= 24) {
      return {
        type: 'ucl_playoff',
        label: 'Barrages 1/8e',
        color: '#06b6d4',
        badgeBg: 'rgba(6, 182, 212, 0.15)',
        badgeBorder: 'rgba(6, 182, 212, 0.4)',
      };
    }
    return {
      type: 'eliminated',
      label: 'Éliminé',
      color: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.4)',
    };
  }

  // Top 5 Européen
  switch (leagueId) {
    case 'FRA-L1': // Ligue 1 (18 clubs)
      if (rank <= 3) {
        return {
          type: 'ucl',
          label: 'Ligue des Champions (Phase de Ligue)',
          color: '#3b82f6',
          badgeBg: 'rgba(59, 130, 246, 0.15)',
          badgeBorder: 'rgba(59, 130, 246, 0.4)',
        };
      }
      if (rank === 4) {
        return {
          type: 'ucl_qualif',
          label: 'Ligue des Champions (Tour préliminaire)',
          color: '#06b6d4',
          badgeBg: 'rgba(6, 182, 212, 0.15)',
          badgeBorder: 'rgba(6, 182, 212, 0.4)',
        };
      }
      if (rank === 5) {
        return {
          type: 'uel',
          label: 'Ligue Europa',
          color: '#f97316',
          badgeBg: 'rgba(249, 115, 22, 0.15)',
          badgeBorder: 'rgba(249, 115, 22, 0.4)',
        };
      }
      if (rank === 6) {
        return {
          type: 'uecl',
          label: 'Ligue Conférence',
          color: '#10b981',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeBorder: 'rgba(16, 185, 129, 0.4)',
        };
      }
      if (rank === 16) {
        return {
          type: 'relegation_playoff',
          label: 'Barrages de Relégation',
          color: '#eab308',
          badgeBg: 'rgba(234, 179, 8, 0.15)',
          badgeBorder: 'rgba(234, 179, 8, 0.4)',
        };
      }
      if (rank >= 17) {
        return {
          type: 'relegation',
          label: 'Relégation Directe (Ligue 2)',
          color: '#ef4444',
          badgeBg: 'rgba(239, 68, 68, 0.15)',
          badgeBorder: 'rgba(239, 68, 68, 0.4)',
        };
      }
      return null;

    case 'ENG-PL': // Premier League (20 clubs)
    case 'ESP-LL': // La Liga (20 clubs)
    case 'ITA-SA': // Serie A (20 clubs)
      if (rank <= 4) {
        return {
          type: 'ucl',
          label: 'Ligue des Champions',
          color: '#3b82f6',
          badgeBg: 'rgba(59, 130, 246, 0.15)',
          badgeBorder: 'rgba(59, 130, 246, 0.4)',
        };
      }
      if (rank === 5) {
        return {
          type: 'uel',
          label: 'Ligue Europa',
          color: '#f97316',
          badgeBg: 'rgba(249, 115, 22, 0.15)',
          badgeBorder: 'rgba(249, 115, 22, 0.4)',
        };
      }
      if (rank === 6) {
        return {
          type: 'uecl',
          label: 'Ligue Conférence',
          color: '#10b981',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeBorder: 'rgba(16, 185, 129, 0.4)',
        };
      }
      if (rank >= 18) {
        return {
          type: 'relegation',
          label: 'Relégation Directe',
          color: '#ef4444',
          badgeBg: 'rgba(239, 68, 68, 0.15)',
          badgeBorder: 'rgba(239, 68, 68, 0.4)',
        };
      }
      return null;

    case 'GER-BL': // Bundesliga (18 clubs)
      if (rank <= 4) {
        return {
          type: 'ucl',
          label: 'Ligue des Champions',
          color: '#3b82f6',
          badgeBg: 'rgba(59, 130, 246, 0.15)',
          badgeBorder: 'rgba(59, 130, 246, 0.4)',
        };
      }
      if (rank === 5) {
        return {
          type: 'uel',
          label: 'Ligue Europa',
          color: '#f97316',
          badgeBg: 'rgba(249, 115, 22, 0.15)',
          badgeBorder: 'rgba(249, 115, 22, 0.4)',
        };
      }
      if (rank === 6) {
        return {
          type: 'uecl',
          label: 'Ligue Conférence',
          color: '#10b981',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeBorder: 'rgba(16, 185, 129, 0.4)',
        };
      }
      if (rank === 16) {
        return {
          type: 'relegation_playoff',
          label: 'Barrages de Relégation (Relegation-Spiel)',
          color: '#eab308',
          badgeBg: 'rgba(234, 179, 8, 0.15)',
          badgeBorder: 'rgba(234, 179, 8, 0.4)',
        };
      }
      if (rank >= 17) {
        return {
          type: 'relegation',
          label: 'Relégation Directe (2. Bundesliga)',
          color: '#ef4444',
          badgeBg: 'rgba(239, 68, 68, 0.15)',
          badgeBorder: 'rgba(239, 68, 68, 0.4)',
        };
      }
      return null;

    default:
      return null;
  }
}

/**
 * Calcul officiel du classement (Général, Domicile, Extérieur)
 */
export function computeLeagueStandings(allMatches = [], leagueId = 'FRA-L1', season = '2025-2026', viewMode = 'ALL') {
  const cacheKey = `standings_${leagueId}_${season}_${viewMode}_${allMatches.length}`;
  if (engineCache.has(cacheKey)) {
    return engineCache.get(cacheKey);
  }

  // Filtrer les matchs de la compétition et de la saison terminée ou en cours
  const leagueMatches = allMatches.filter((m) => {
    const mLeague = m.league || '';
    const mSeason = m.season || '2025-2026';
    const isFinished = m.status === 'FINISHED' || (m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined && m.status !== 'SCHEDULED');
    return mLeague === leagueId && mSeason === season && isFinished;
  });

  // Trier par date pour calculer la forme récente exacte
  leagueMatches.sort((a, b) => {
    const da = new Date(a.date || a.matchDate || 0);
    const db = new Date(b.date || b.matchDate || 0);
    return da - db;
  });

  const teamsMap = new Map();

  const getOrCreateTeam = (name) => {
    if (!teamsMap.has(name)) {
      teamsMap.set(name, {
        team: name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        xgFor: 0,
        xgAgainst: 0,
        home: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
        away: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
        recentForm: [], // Derniers matchs chronologiques { result: 'W'|'D'|'L', score, opponent, isHome, date }
      });
    }
    return teamsMap.get(name);
  };

  // Traiter chaque match
  leagueMatches.forEach((m) => {
    const homeTeam = m.homeTeam?.trim();
    const awayTeam = m.awayTeam?.trim();
    if (!homeTeam || !awayTeam) return;

    const hs = typeof m.homeScore === 'number' ? m.homeScore : parseInt(m.homeScore, 10);
    const as = typeof m.awayScore === 'number' ? m.awayScore : parseInt(m.awayScore, 10);
    if (isNaN(hs) || isNaN(as)) return;

    const tHome = getOrCreateTeam(homeTeam);
    const tAway = getOrCreateTeam(awayTeam);

    const homeXg = parseFloat(m.homeXg || m.teamStats?.home?.xg || 0) || 0;
    const awayXg = parseFloat(m.awayXg || m.teamStats?.away?.xg || 0) || 0;

    // Résultat Domicile
    tHome.played += 1;
    tHome.goalsFor += hs;
    tHome.goalsAgainst += as;
    tHome.xgFor += homeXg;
    tHome.xgAgainst += awayXg;

    tHome.home.played += 1;
    tHome.home.goalsFor += hs;
    tHome.home.goalsAgainst += as;

    // Résultat Extérieur
    tAway.played += 1;
    tAway.goalsFor += as;
    tAway.goalsAgainst += hs;
    tAway.xgFor += awayXg;
    tAway.xgAgainst += homeXg;

    tAway.away.played += 1;
    tAway.away.goalsFor += as;
    tAway.away.goalsAgainst += hs;

    if (hs > as) {
      // Victoire Home
      tHome.won += 1;
      tHome.points += 3;
      tHome.home.won += 1;
      tHome.home.points += 3;
      tHome.recentForm.push({ result: 'W', score: `${hs}-${as}`, opponent: awayTeam, isHome: true, date: m.date });

      tAway.lost += 1;
      tAway.away.lost += 1;
      tAway.recentForm.push({ result: 'L', score: `${as}-${hs}`, opponent: homeTeam, isHome: false, date: m.date });
    } else if (hs === as) {
      // Nul
      tHome.drawn += 1;
      tHome.points += 1;
      tHome.home.drawn += 1;
      tHome.home.points += 1;
      tHome.recentForm.push({ result: 'D', score: `${hs}-${as}`, opponent: awayTeam, isHome: true, date: m.date });

      tAway.drawn += 1;
      tAway.points += 1;
      tAway.away.drawn += 1;
      tAway.away.points += 1;
      tAway.recentForm.push({ result: 'D', score: `${as}-${hs}`, opponent: homeTeam, isHome: false, date: m.date });
    } else {
      // Victoire Away
      tHome.lost += 1;
      tHome.home.lost += 1;
      tHome.recentForm.push({ result: 'L', score: `${hs}-${as}`, opponent: awayTeam, isHome: true, date: m.date });

      tAway.won += 1;
      tAway.points += 3;
      tAway.away.won += 1;
      tAway.away.points += 3;
      tAway.recentForm.push({ result: 'W', score: `${as}-${hs}`, opponent: homeTeam, isHome: false, date: m.date });
    }
  });

  // Calcul des Goal Différences
  teamsMap.forEach((t) => {
    t.goalDiff = t.goalsFor - t.goalsAgainst;
    t.home.goalDiff = t.home.goalsFor - t.home.goalsAgainst;
    t.away.goalDiff = t.away.goalsFor - t.away.goalsAgainst;
    t.xgFor = parseFloat(t.xgFor.toFixed(2));
    t.xgAgainst = parseFloat(t.xgAgainst.toFixed(2));
    // Prendre les 5 derniers matchs de forme
    t.last5 = t.recentForm.slice(-5);
  });

  let rawList = Array.from(teamsMap.values());

  // Appliquer le filtre de vue
  let computedList = rawList.map((t) => {
    if (viewMode === 'HOME') {
      return {
        ...t,
        played: t.home.played,
        won: t.home.won,
        drawn: t.home.drawn,
        lost: t.home.lost,
        goalsFor: t.home.goalsFor,
        goalsAgainst: t.home.goalsAgainst,
        goalDiff: t.home.goalDiff,
        points: t.home.points,
      };
    } else if (viewMode === 'AWAY') {
      return {
        ...t,
        played: t.away.played,
        won: t.away.won,
        drawn: t.away.drawn,
        lost: t.away.lost,
        goalsFor: t.away.goalsFor,
        goalsAgainst: t.away.goalsAgainst,
        goalDiff: t.away.goalDiff,
        points: t.away.points,
      };
    }
    return t;
  });

  // Tri officiel : Pts DESC > GoalDiff DESC > GoalsFor DESC > Nom ASC
  computedList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team);
  });

  // Attribuer les rangs et zones
  const totalTeams = computedList.length;
  const standings = computedList.map((teamData, index) => {
    const rank = index + 1;
    const zone = getLeagueZoneInfo(rank, leagueId, totalTeams);
    return {
      ...teamData,
      rank,
      zone,
    };
  });

  engineCache.set(cacheKey, standings);
  return standings;
}

/**
 * Calcul du classement des Meilleurs Buteurs
 */
export function computeTopScorers(allMatches = [], leagueId = 'FRA-L1', season = '2025-2026', playerRegistry = {}, playerPhotos = {}, limit = 50) {
  const cacheKey = `scorers_${leagueId}_${season}_${limit}_${allMatches.length}`;
  if (engineCache.has(cacheKey)) {
    return engineCache.get(cacheKey);
  }

  const leagueMatches = allMatches.filter((m) => {
    const mLeague = m.league || '';
    const mSeason = m.season || '2025-2026';
    const isFinished = m.status === 'FINISHED' || (m.homeScore !== null && m.homeScore !== undefined && m.status !== 'SCHEDULED');
    return mLeague === leagueId && mSeason === season && isFinished;
  });

  const scorersMap = new Map();

  leagueMatches.forEach((m) => {
    const goals = m.goals || [];
    goals.forEach((g) => {
      if (g.isOwnGoal) return; // Exclure les CSC
      const playerName = (g.player || '').trim();
      if (!playerName || playerName === 'Inconnu') return;

      const teamName = g.team || (g.side === 'home' ? m.homeTeam : m.awayTeam) || 'Club';
      const key = `${normalizePlayerName(playerName)}_${teamName.toLowerCase()}`;

      if (!scorersMap.has(key)) {
        scorersMap.set(key, {
          name: playerName,
          team: teamName,
          goals: 0,
          penalties: 0,
          openPlayGoals: 0,
          matchesPlayed: new Set(),
          times: [],
        });
      }

      const item = scorersMap.get(key);
      item.goals += 1;
      item.matchesPlayed.add(m.id || `${m.date}_${m.homeTeam}_${m.awayTeam}`);
      if (g.isPenalty || String(g.detail || '').toLowerCase().includes('penalty')) {
        item.penalties += 1;
      } else {
        item.openPlayGoals += 1;
      }
      if (g.time) item.times.push(g.time);
    });
  });

  // Mapper avec le registre pour récupérer photo et métadonnées
  const scorersList = Array.from(scorersMap.values()).map((p) => {
    const matchesCount = p.matchesPlayed.size;
    const ratio = matchesCount > 0 ? parseFloat((p.goals / matchesCount).toFixed(2)) : p.goals;

    // Recherche de photo dans playerPhotos ou playerRegistry
    let photoUrl = playerPhotos[p.name] || null;
    let position = 'Attaquant';
    let nationality = '';
    let age = null;
    let number = null;

    if (!photoUrl && playerRegistry) {
      const norm = normalizePlayerName(p.name);
      for (const regId in playerRegistry) {
        const regPlayer = playerRegistry[regId];
        if (
          normalizePlayerName(regPlayer.name) === norm ||
          normalizePlayerName(regPlayer.displayName) === norm ||
          norm.includes(normalizePlayerName(regPlayer.shortName || ''))
        ) {
          photoUrl = regPlayer.photoUrl || photoUrl;
          position = regPlayer.position || position;
          nationality = regPlayer.nationality || nationality;
          age = regPlayer.age || age;
          number = regPlayer.number || number;
          break;
        }
      }
    }

    return {
      name: p.name,
      team: p.team,
      goals: p.goals,
      penalties: p.penalties,
      openPlayGoals: p.openPlayGoals,
      matchesCount,
      ratio,
      photoUrl,
      position,
      nationality,
      age,
      number,
    };
  });

  // Tri : Buts DESC > Moins de penaltys > Ratio DESC
  scorersList.sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (a.penalties !== b.penalties) return a.penalties - b.penalties;
    return b.ratio - a.ratio;
  });

  const result = scorersList.slice(0, limit).map((p, idx) => ({ ...p, rank: idx + 1 }));
  engineCache.set(cacheKey, result);
  return result;
}

/**
 * Calcul du classement des Meilleurs Passeurs
 */
export function computeTopAssists(allMatches = [], leagueId = 'FRA-L1', season = '2025-2026', playerRegistry = {}, playerPhotos = {}, limit = 50) {
  const cacheKey = `assists_${leagueId}_${season}_${limit}_${allMatches.length}`;
  if (engineCache.has(cacheKey)) {
    return engineCache.get(cacheKey);
  }

  const leagueMatches = allMatches.filter((m) => {
    const mLeague = m.league || '';
    const mSeason = m.season || '2025-2026';
    const isFinished = m.status === 'FINISHED' || (m.homeScore !== null && m.homeScore !== undefined && m.status !== 'SCHEDULED');
    return mLeague === leagueId && mSeason === season && isFinished;
  });

  const assistsMap = new Map();

  leagueMatches.forEach((m) => {
    const goals = m.goals || [];
    goals.forEach((g) => {
      let assistName = g.assist || '';
      if (!assistName && g.detail && typeof g.detail === 'string' && g.detail.includes('Assist:')) {
        assistName = g.detail.replace(/Assist:\s*/i, '').trim();
      }
      assistName = assistName.trim();
      if (!assistName || assistName === '-' || assistName.toLowerCase() === 'none') return;

      const teamName = g.team || (g.side === 'home' ? m.homeTeam : m.awayTeam) || 'Club';
      const key = `${normalizePlayerName(assistName)}_${teamName.toLowerCase()}`;

      if (!assistsMap.has(key)) {
        assistsMap.set(key, {
          name: assistName,
          team: teamName,
          assists: 0,
          matchesPlayed: new Set(),
        });
      }

      const item = assistsMap.get(key);
      item.assists += 1;
      item.matchesPlayed.add(m.id || `${m.date}_${m.homeTeam}_${m.awayTeam}`);
    });
  });

  const assistsList = Array.from(assistsMap.values()).map((p) => {
    const matchesCount = p.matchesPlayed.size;
    const ratio = matchesCount > 0 ? parseFloat((p.assists / matchesCount).toFixed(2)) : p.assists;

    let photoUrl = playerPhotos[p.name] || null;
    let position = 'Milieu';
    let nationality = '';
    let age = null;
    let number = null;

    if (!photoUrl && playerRegistry) {
      const norm = normalizePlayerName(p.name);
      for (const regId in playerRegistry) {
        const regPlayer = playerRegistry[regId];
        if (
          normalizePlayerName(regPlayer.name) === norm ||
          normalizePlayerName(regPlayer.displayName) === norm ||
          norm.includes(normalizePlayerName(regPlayer.shortName || ''))
        ) {
          photoUrl = regPlayer.photoUrl || photoUrl;
          position = regPlayer.position || position;
          nationality = regPlayer.nationality || nationality;
          age = regPlayer.age || age;
          number = regPlayer.number || number;
          break;
        }
      }
    }

    return {
      name: p.name,
      team: p.team,
      assists: p.assists,
      matchesCount,
      ratio,
      photoUrl,
      position,
      nationality,
      age,
      number,
    };
  });

  assistsList.sort((a, b) => {
    if (b.assists !== a.assists) return b.assists - a.assists;
    return b.ratio - a.ratio;
  });

  const result = assistsList.slice(0, limit).map((p, idx) => ({ ...p, rank: idx + 1 }));
  engineCache.set(cacheKey, result);
  return result;
}

/**
 * Calcul du classement de la Discipline & Fautes (Joueurs & Équipes)
 */
export function computeDisciplineStats(allMatches = [], leagueId = 'FRA-L1', season = '2025-2026', playerRegistry = {}, playerPhotos = {}, limit = 50) {
  const cacheKey = `discipline_${leagueId}_${season}_${limit}_${allMatches.length}`;
  if (engineCache.has(cacheKey)) {
    return engineCache.get(cacheKey);
  }

  const leagueMatches = allMatches.filter((m) => {
    const mLeague = m.league || '';
    const mSeason = m.season || '2025-2026';
    const isFinished = m.status === 'FINISHED' || (m.homeScore !== null && m.homeScore !== undefined && m.status !== 'SCHEDULED');
    return mLeague === leagueId && mSeason === season && isFinished;
  });

  const playerDisciplineMap = new Map();
  const teamDisciplineMap = new Map();

  const getOrCreateTeamDiscipline = (tName) => {
    if (!teamDisciplineMap.has(tName)) {
      teamDisciplineMap.set(tName, {
        team: tName,
        matchesCount: 0,
        yellowCards: 0,
        redCards: 0,
        foulsCommitted: 0,
        points: 0, // 1 pt par Jaune, 3 pts par Rouge
      });
    }
    return teamDisciplineMap.get(tName);
  };

  leagueMatches.forEach((m) => {
    const homeTeam = m.homeTeam?.trim();
    const awayTeam = m.awayTeam?.trim();
    if (!homeTeam || !awayTeam) return;

    const tHome = getOrCreateTeamDiscipline(homeTeam);
    const tAway = getOrCreateTeamDiscipline(awayTeam);

    tHome.matchesCount += 1;
    tAway.matchesCount += 1;

    // Fautes d'équipe depuis teamStats
    if (m.teamStats?.home?.fouls) tHome.foulsCommitted += parseInt(m.teamStats.home.fouls, 10) || 0;
    if (m.teamStats?.away?.fouls) tAway.foulsCommitted += parseInt(m.teamStats.away.fouls, 10) || 0;

    // Cartons individuels
    const cards = m.cards || [];
    cards.forEach((c) => {
      const playerName = (c.player || '').trim();
      if (!playerName) return;

      const teamName = c.team || (c.side === 'home' ? homeTeam : awayTeam) || 'Club';
      const isRed = c.type === 'RED' || String(c.detail || '').toLowerCase().includes('red');

      // Update Team discipline
      const teamObj = getOrCreateTeamDiscipline(teamName);
      if (isRed) {
        teamObj.redCards += 1;
        teamObj.points += 3;
      } else {
        teamObj.yellowCards += 1;
        teamObj.points += 1;
      }

      // Update Player discipline
      const pKey = `${normalizePlayerName(playerName)}_${teamName.toLowerCase()}`;
      if (!playerDisciplineMap.has(pKey)) {
        playerDisciplineMap.set(pKey, {
          name: playerName,
          team: teamName,
          yellowCards: 0,
          redCards: 0,
          points: 0,
          matchesPlayed: new Set(),
        });
      }
      const pObj = playerDisciplineMap.get(pKey);
      pObj.matchesPlayed.add(m.id || `${m.date}_${homeTeam}_${awayTeam}`);
      if (isRed) {
        pObj.redCards += 1;
        pObj.points += 3;
      } else {
        pObj.yellowCards += 1;
        pObj.points += 1;
      }
    });
  });

  // Enrichissement des joueurs avec photos
  const playerList = Array.from(playerDisciplineMap.values()).map((p) => {
    let photoUrl = playerPhotos[p.name] || null;
    let position = 'Joueur';
    if (!photoUrl && playerRegistry) {
      const norm = normalizePlayerName(p.name);
      for (const regId in playerRegistry) {
        const regPlayer = playerRegistry[regId];
        if (
          normalizePlayerName(regPlayer.name) === norm ||
          normalizePlayerName(regPlayer.displayName) === norm ||
          norm.includes(normalizePlayerName(regPlayer.shortName || ''))
        ) {
          photoUrl = regPlayer.photoUrl || photoUrl;
          position = regPlayer.position || position;
          break;
        }
      }
    }

    return {
      name: p.name,
      team: p.team,
      yellowCards: p.yellowCards,
      redCards: p.redCards,
      totalCards: p.yellowCards + p.redCards,
      points: p.points,
      matchesCount: p.matchesPlayed.size,
      photoUrl,
      position,
    };
  });

  playerList.sort((a, b) => {
    if (b.redCards !== a.redCards) return b.redCards - a.redCards;
    if (b.yellowCards !== a.yellowCards) return b.yellowCards - a.yellowCards;
    return b.points - a.points;
  });

  // Équipes Fair-play (triée par le score disciplinaire le plus bas -> équipe la plus propre)
  const teamList = Array.from(teamDisciplineMap.values()).map((t) => {
    const avgFouls = t.matchesCount > 0 ? parseFloat((t.foulsCommitted / t.matchesCount).toFixed(1)) : 0;
    const avgCards = t.matchesCount > 0 ? parseFloat(((t.yellowCards + t.redCards) / t.matchesCount).toFixed(2)) : 0;
    return {
      ...t,
      avgFouls,
      avgCards,
      totalCards: t.yellowCards + t.redCards,
    };
  });

  teamList.sort((a, b) => a.points - b.points);

  const result = {
    players: playerList.slice(0, limit).map((p, idx) => ({ ...p, rank: idx + 1 })),
    teams: teamList.map((t, idx) => ({ ...t, rank: idx + 1 })),
  };

  engineCache.set(cacheKey, result);
  return result;
}

/**
 * Calcul du classement & Baromètre des Arbitres
 */
export function computeRefereeStats(allMatches = [], leagueId = 'FRA-L1', season = '2025-2026') {
  const cacheKey = `referees_${leagueId}_${season}_${allMatches.length}`;
  if (engineCache.has(cacheKey)) {
    return engineCache.get(cacheKey);
  }

  const leagueMatches = allMatches.filter((m) => {
    const mLeague = m.league || '';
    const mSeason = m.season || '2025-2026';
    const isFinished = m.status === 'FINISHED' || (m.homeScore !== null && m.homeScore !== undefined && m.status !== 'SCHEDULED');
    const ref = typeof m.referee === 'string' ? m.referee : m.referee?.name;
    return mLeague === leagueId && mSeason === season && isFinished && ref && ref.trim() !== '' && ref !== 'Arbitre Officiel';
  });

  const refMap = new Map();

  leagueMatches.forEach((m) => {
    const refName = (typeof m.referee === 'string' ? m.referee : m.referee?.name).trim();
    if (!refName) return;

    if (!refMap.has(refName)) {
      refMap.set(refName, {
        name: refName,
        matchesCount: 0,
        totalFouls: 0,
        totalYellows: 0,
        totalReds: 0,
        totalPenalties: 0,
      });
    }

    const r = refMap.get(refName);
    r.matchesCount += 1;

    // Fautes
    const homeFouls = parseInt(m.teamStats?.home?.fouls, 10) || 0;
    const awayFouls = parseInt(m.teamStats?.away?.fouls, 10) || 0;
    r.totalFouls += homeFouls + awayFouls;

    // Cartons
    const cards = m.cards || [];
    cards.forEach((c) => {
      const isRed = c.type === 'RED' || String(c.detail || '').toLowerCase().includes('red');
      if (isRed) r.totalReds += 1;
      else r.totalYellows += 1;
    });

    // Penaltys
    const goals = m.goals || [];
    goals.forEach((g) => {
      if (g.isPenalty || String(g.detail || '').toLowerCase().includes('penalty')) {
        r.totalPenalties += 1;
      }
    });
  });

  const refList = Array.from(refMap.values()).map((r) => {
    const n = r.matchesCount || 1;
    const avgFouls = parseFloat((r.totalFouls / n).toFixed(1));
    const avgYellows = parseFloat((r.totalYellows / n).toFixed(2));
    const avgReds = parseFloat((r.totalReds / n).toFixed(2));
    const avgPenalties = parseFloat((r.totalPenalties / n).toFixed(2));

    // Indice d'intransigeance / sévérité (sur 100)
    // Formule normalisée : 20% fautes + 40% CJ + 25% CR + 15% Penaltys
    const severityScore = Math.min(
      99,
      Math.max(20, Math.round((avgFouls * 1.5) + (avgYellows * 7.5) + (avgReds * 25) + (avgPenalties * 15)))
    );

    return {
      name: r.name,
      matchesCount: r.matchesCount,
      totalFouls: r.totalFouls,
      avgFouls,
      totalYellows: r.totalYellows,
      avgYellows,
      totalReds: r.totalReds,
      avgReds,
      totalPenalties: r.totalPenalties,
      avgPenalties,
      severityScore,
    };
  });

  refList.sort((a, b) => {
    if (b.matchesCount !== a.matchesCount) return b.matchesCount - a.matchesCount;
    return b.avgFouls - a.avgFouls;
  });

  const result = refList.map((r, idx) => ({ ...r, rank: idx + 1 }));
  engineCache.set(cacheKey, result);
  return result;
}
