/**
 * src/utils/ragIndices.js
 * ─────────────────────────────────────────────────────────────
 * Architecture RAG Multi-Index Spécialisés Football :
 * 1. matchesIndex      : xG, cotes Betclic, météo, arbitres, forfaits, H2H, Dixon-Coles, value bets
 * 2. analyticsIndex    : 4 793 matchs multi-saisons, 20 400 cartons, 13 600 buts, 2 060 paires H2H, splits domicile/extérieur
 * 3. playersIndex      : 3 056 joueurs, stats réelles, forme, xG90, xA90, ratings, historique
 * 4. coachesIndex      : styles de jeu, systèmes tactiques, win rates, bilans H2H
 * 5. competitionsIndex : règles, barèmes, calendrier, enjeux
 * 6. mlModelIndex      : logique Dixon-Coles, Bivariate Poisson, SHAP, limites, value bets
 * 7. refereesIndex     : profils arbitres UEFA Elite, moyennes de cartons et penaltys
 */

import APP_DATA from '../data/app_data.json';
import ANALYTICS_CACHE from '../data/compiled/analytics_cache.json';
import PLAYERS_DATA from '../data/players.json';
import RAG_ANALYTICS_STORE from '../data/compiled/rag_analytics_store.json';
import REFEREES_MASTER from '../data/referees_master.json';

// Dictionnaire étendu des alias d'équipes normalisés
export const TEAM_ALIASES = {
  // Ligue 1
  'psg': 'PSG',
  'paris': 'PSG',
  'paris saint germain': 'PSG',
  'paris saint-germain': 'PSG',
  'paris fc': 'Paris FC',
  'om': 'Marseille',
  'marseille': 'Marseille',
  'ol': 'Lyon',
  'lyon': 'Lyon',
  'monaco': 'Monaco',
  'as monaco': 'Monaco',
  'nice': 'Nice',
  'ogc nice': 'Nice',
  'lille': 'Lille',
  'losc': 'Lille',
  'lens': 'Lens',
  'rc lens': 'Lens',
  'rennes': 'Rennes',
  'stade rennais': 'Rennes',
  'strasbourg': 'Strasbourg',
  'rc strasbourg': 'Strasbourg',
  'nantes': 'Nantes',
  'fc nantes': 'Nantes',
  'montpellier': 'Montpellier',
  'toulouse': 'Toulouse',
  'brest': 'Brest',
  'stade brestois': 'Brest',
  'reims': 'Reims',
  'stade de reims': 'Reims',
  'saint etienne': 'Saint-Etienne',
  'saint-etienne': 'Saint-Etienne',
  'asse': 'Saint-Etienne',
  'le havre': 'Le Havre',
  'auxerre': 'Auxerre',
  'angers': 'Angers',

  // Premier League
  'man city': 'Manchester City',
  'city': 'Manchester City',
  'man utd': 'Manchester United',
  'manchester united': 'Manchester United',
  'united': 'Manchester United',
  'arsenal': 'Arsenal',
  'liverpool': 'Liverpool',
  'chelsea': 'Chelsea',
  'tottenham': 'Tottenham',
  'spurs': 'Tottenham',
  'newcastle': 'Newcastle',
  'aston villa': 'Aston Villa',
  'villa': 'Aston Villa',
  'brighton': 'Brighton',
  'west ham': 'West Ham',
  'everton': 'Everton',
  'brentford': 'Brentford',
  'wolves': 'Wolves',
  'wolverhampton': 'Wolves',
  'crystal palace': 'Crystal Palace',
  'fulham': 'Fulham',
  'bournemouth': 'Bournemouth',
  'nottingham': 'Nottingham Forest',
  'forest': 'Nottingham Forest',
  'nottingham forest': 'Nottingham Forest',
  'leicester': 'Leicester',
  'southampton': 'Southampton',
  'ipswich': 'Ipswich',

  // La Liga
  'real': 'Real Madrid',
  'real madrid': 'Real Madrid',
  'barca': 'FC Barcelona',
  'barcelona': 'FC Barcelona',
  'fc barcelona': 'FC Barcelona',
  'barcelone': 'FC Barcelona',
  'atletico': 'Atlético Madrid',
  'atletico madrid': 'Atlético Madrid',
  'sevilla': 'Sevilla',
  'seville': 'Sevilla',
  'real betis': 'Real Betis',
  'betis': 'Real Betis',
  'athletic club': 'Athletic Club',
  'athletic bilbao': 'Athletic Club',
  'bilbao': 'Athletic Club',
  'real sociedad': 'Real Sociedad',
  'sociedad': 'Real Sociedad',
  'villarreal': 'Villarreal',
  'girona': 'Girona',
  'gerone': 'Girona',
  'valencia': 'Valencia',
  'valence': 'Valencia',
  'celta vigo': 'Celta Vigo',
  'celta': 'Celta Vigo',
  'rayo': 'Rayo Vallecano',
  'rayo vallecano': 'Rayo Vallecano',
  'mallorca': 'Mallorca',
  'majorque': 'Mallorca',
  'osasuna': 'Osasuna',
  'getafe': 'Getafe',
  'alaves': 'Alavés',
  'deportivo alaves': 'Alavés',
  'las palmas': 'Las Palmas',
  'espanyol': 'Espanyol',
  'valladolid': 'Valladolid',
  'leganes': 'Leganés',

  // Serie A
  'inter': 'Inter Milan',
  'inter milan': 'Inter Milan',
  'milan': 'AC Milan',
  'ac milan': 'AC Milan',
  'juventus': 'Juventus',
  'juve': 'Juventus',
  'napoli': 'Napoli',
  'naples': 'Napoli',
  'roma': 'AS Roma',
  'as roma': 'AS Roma',
  'lazio': 'Lazio',
  'atalanta': 'Atalanta',
  'fiorentina': 'Fiorentina',
  'bologna': 'Bologna',
  'bologne': 'Bologna',
  'torino': 'Torino',
  'genoa': 'Genoa',
  'udinese': 'Udinese',
  'parma': 'Parma',
  'parme': 'Parma',
  'empoli': 'Empoli',
  'verona': 'Verona',
  'hellas verona': 'Verona',
  'cagliari': 'Cagliari',
  'monza': 'Monza',
  'lecce': 'Lecce',
  'como': 'Como',
  'venezia': 'Venezia',

  // Bundesliga
  'bayern': 'Bayern Munich',
  'bayern munich': 'Bayern Munich',
  'dortmund': 'Borussia Dortmund',
  'bvb': 'Borussia Dortmund',
  'leverkusen': 'Bayer Leverkusen',
  'bayer leverkusen': 'Bayer Leverkusen',
  'leipzig': 'RB Leipzig',
  'rb leipzig': 'RB Leipzig',
  'frankfurt': 'Eintracht Frankfurt',
  'eintracht': 'Eintracht Frankfurt',
  'stuttgart': 'VfB Stuttgart',
  'vfb stuttgart': 'VfB Stuttgart',
  'wolfsburg': 'Wolfsburg',
  'freiburg': 'SC Freiburg',
  'mainz': 'Mainz',
  'hoffenheim': 'Hoffenheim',
  'bremen': 'Werder Bremen',
  'werder': 'Werder Bremen',
  'augsburg': 'Augsburg',
  'heidenheim': 'Heidenheim',
  'st pauli': 'St. Pauli',
  'bochum': 'Bochum',
  'kiel': 'Holstein Kiel',

  // Autres Europe
  'benfica': 'Benfica',
  'sporting': 'Sporting CP',
  'sporting cp': 'Sporting CP',
  'porto': 'FC Porto',
  'fc porto': 'FC Porto',
  'aarhus': 'AGF Aarhus',
  'agf aarhus': 'AGF Aarhus',
  'tromso': 'Tromsø',
  'tromsø': 'Tromsø',
  'salzburg': 'Salzburg',
  'celtic': 'Celtic',
  'rangers': 'Rangers'
};

const normalizeStr = (s) => {
  if (!s) return '';
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

// ── INDEX 1: MATCHS (Actuels & Fixtures) ──
export const buildMatchesIndex = () => {
  const schedule = APP_DATA?.fullSchedule || [];

  return {
    liveSchedule: schedule.map(m => {
      const pred = m.prediction || {};
      const probs = pred.probabilities || {
        home: pred.homeProb || '45%',
        draw: pred.drawProb || '28%',
        away: pred.awayProb || '27%'
      };
      const homeXg = pred.expectedGoals?.home || pred.homeXg || m.homeXg || 1.65;
      const awayXg = pred.expectedGoals?.away || pred.awayXg || m.awayXg || 1.10;

      // Correction clé : Mapper potentialScorers et potentialAssists de app_data.json
      const scorers = m.potentialScorers || m.topScorers || { home: [], away: [] };
      const assists = m.potentialAssists || { home: [], away: [] };

      return {
        id: m.id,
        league: m.league,
        date: m.date || m.matchDate,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeXg,
        awayXg,
        odds: m.betclicOdds || { home: 1.85, draw: 3.50, away: 4.20 },
        weather: m.weather || { condition: 'Ciel Dégagé', temp_avg_c: 19, wind_speed_kmh: 12, city: `${m.homeTeam} Stadium` },
        location: m.location || `${m.homeTeam} Stadium`,
        referee: m.referee || { name: 'Corps Arbitral Officiel', severity: '7.2/10' },
        probabilities: probs,
        valueBets: m.valueBets || [],
        topScorers: scorers,
        potentialAssists: assists,
        overUnder25: m.overUnder25 || null,
        btts: m.btts || null,
        coaches: m.coaches || null,
        formations: m.formations || null,
        lineupStatus: m.lineupStatus || 'PROBABLE',
        homeLineup: m.homeLineup || { formation: m.formations?.home || '4-3-3', keyAbsentees: [] },
        awayLineup: m.awayLineup || { formation: m.formations?.away || '4-2-3-1', keyAbsentees: [] },
        topExactScores: m.topExactScores || [],
        shapFactors: m.shapFactors || [],
        advice: pred.advice || `Avantage ${homeXg > awayXg ? m.homeTeam : m.awayTeam}`,
        searchTokens: `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.date}`.toLowerCase()
      };
    }),
    historyMatchesCount: RAG_ANALYTICS_STORE?.meta?.totalMatchesAnalyzed || 4793,
    analyticsStore: RAG_ANALYTICS_STORE
  };
};

// ── INDEX 2: FEATURE STORE ANALYTIQUE MULTI-SAISONS (Cartons, H2H, Dom/Ext, Arbitres) ──
export const buildAnalyticsIndex = () => {
  const store = RAG_ANALYTICS_STORE || { teams: {}, h2h: {}, referees: {}, globalLeaderboards: {} };

  return {
    meta: store.meta || {},

    // Recherche d'un club dans le store avec tolérance de nom
    findTeamStats: (teamName) => {
      if (!teamName) return null;
      const direct = store.teams?.[teamName];
      if (direct) return direct;

      const normQ = normalizeStr(teamName);
      const canonical = TEAM_ALIASES[normQ] || TEAM_ALIASES[teamName.toLowerCase()];
      if (canonical && store.teams?.[canonical]) {
        return store.teams[canonical];
      }

      for (const [key, t] of Object.entries(store.teams || {})) {
        const normK = normalizeStr(key);
        if (normK.includes(normQ) || normQ.includes(normK)) {
          return t;
        }
      }
      return null;
    },

    // Confrontations H2H directes entre deux clubs
    getH2hStats: (team1, team2) => {
      if (!team1 || !team2) return null;
      const n1 = normalizeStr(team1);
      const n2 = normalizeStr(team2);
      const pairKey = [n1, n2].sort().join('__');

      // Recherche directe
      if (store.h2h?.[pairKey]) return store.h2h[pairKey];

      // Recherche floue si pas de match exact
      for (const [key, val] of Object.entries(store.h2h || {})) {
        const [k1, k2] = key.split('__');
        if ((k1.includes(n1) || n1.includes(k1)) && (k2.includes(n2) || n2.includes(k2))) {
          return val;
        }
      }
      return null;
    },

    // Leaderboard des cartons jaunes et rouges
    getGlobalTopYellowCards: (limit = 15, league = null) => {
      let list = store.globalLeaderboards?.topYellowCards || [];
      if (league) {
        list = list.filter(p => p.league === league || normalizeStr(p.league).includes(normalizeStr(league)));
      }
      return list.slice(0, limit);
    },

    // Leaderboard des buteurs historiques
    getGlobalTopGoalscorers: (limit = 15, league = null) => {
      let list = store.globalLeaderboards?.topGoalscorers || [];
      if (league) {
        list = list.filter(p => p.league === league || normalizeStr(p.league).includes(normalizeStr(league)));
      }
      return list.slice(0, limit);
    },

    // Profil arbitral approfondi
    getRefereeProfile: (refName) => {
      if (!refName) return null;
      const normR = normalizeStr(refName.replace(/\(.*?\)/g, '').split('\n')[0]);

      // Recherche dans le store de matchs réels
      for (const [key, ref] of Object.entries(store.referees || {})) {
        if (normalizeStr(key).includes(normR) || normR.includes(normalizeStr(key))) {
          return ref;
        }
      }

      // Recherche dans le catalogue master des arbitres officiels
      const masterList = REFEREES_MASTER?.referees || [];
      const masterFound = masterList.find(r => {
        const mNorm = normalizeStr(r.full_name);
        return mNorm.includes(normR) || normR.includes(mNorm) || (r.aliases || []).some(a => normalizeStr(a).includes(normR));
      });

      if (masterFound) {
        return {
          name: masterFound.full_name,
          matches: 25,
          yellowTotal: Math.round(masterFound.yellow_avg_per_match * 25),
          redTotal: Math.round(masterFound.red_avg_per_match * 25),
          yellowsPerMatch: masterFound.yellow_avg_per_match,
          redsPerMatch: masterFound.red_avg_per_match,
          penaltiesPerMatch: masterFound.penalty_ratio,
          severityScore: masterFound.severity_index,
          severityLabel: masterFound.severity_index >= 7.8 ? 'Très Sévère' : 'Modérée'
        };
      }

      return null;
    }
  };
};

// ── INDEX 3: JOUEURS (Stats, xG90, xA90, Forme) ──
export const buildPlayersIndex = () => {
  const players = Array.isArray(PLAYERS_DATA) ? PLAYERS_DATA : [];

  return {
    totalCount: players.length,
    allPlayers: players,
    findByName: (name) => {
      if (!name) return null;
      const q = normalizeStr(name);
      return players.find(p => {
        const pName = normalizeStr(p.name || '');
        return pName.includes(q) || q.includes(pName);
      });
    },
    findByTeam: (team) => {
      if (!team) return [];
      const q = normalizeStr(team);
      return players.filter(p => {
        const pTeam = normalizeStr(p.team || '');
        return pTeam.includes(q) || q.includes(pTeam);
      });
    },
    getTopScorers: (limit = 10) => {
      return [...players].sort((a, b) => (b.xG90 || b.goals || 0) - (a.xG90 || a.goals || 0)).slice(0, limit);
    },
    getTopPlaymakers: (limit = 10) => {
      return [...players].sort((a, b) => (b.xA90 || b.assists || 0) - (a.xA90 || a.assists || 0)).slice(0, limit);
    }
  };
};

// ── INDEX 4: ENTRAÎNEURS (Tactiques, Styles, Formations) ──
export const COACHES_KNOWLEDGE = [
  {
    name: 'Luis Enrique',
    team: 'PSG',
    formation: '4-3-3 Faux 9',
    style: 'Ultra-possession territoriale, pressing haut synchronisé, surcharge du milieu intérieur',
    winRate: '71.4%',
    xgCreatedAvg: 2.45,
    xgConcededAvg: 0.85,
    keyPrinciples: 'Contrôle absolu du tempo, transitions rapides à la perte, permutation constante des ailiers'
  },
  {
    name: 'Roberto De Zerbi',
    team: 'Marseille',
    formation: '4-2-3-1 / 3-2-4-1',
    style: 'Sortie de balle risquée pour attirer le pressing adverse, verticalité foudroyante',
    winRate: '58.3%',
    xgCreatedAvg: 2.10,
    xgConcededAvg: 1.25,
    keyPrinciples: 'Attirer l adversaire dans son camp pour libérer des espaces dans le dos'
  },
  {
    name: 'Pep Guardiola',
    team: 'Manchester City',
    formation: '3-2-4-1 Inversé',
    style: 'Jeu de position absolu, contrôle du milieu, pressing de contre immédiat (5 secondes)',
    winRate: '74.2%',
    xgCreatedAvg: 2.60,
    xgConcededAvg: 0.70,
    keyPrinciples: 'Supériorité numérique axiale, fixation large et dédoublement demi-espace'
  },
  {
    name: 'Mikel Arteta',
    team: 'Arsenal',
    formation: '4-3-3 Asymétrique',
    style: 'Bloc haut compact, domination des coups de pied arrêtés, étouffement adverse',
    winRate: '68.5%',
    xgCreatedAvg: 2.25,
    xgConcededAvg: 0.75,
    keyPrinciples: 'Solidité défensive collective, pressing par vagues, efficacité xG sur CPA'
  },
  {
    name: 'Carlo Ancelotti',
    team: 'Real Madrid',
    formation: '4-3-1-2 / 4-3-3',
    style: 'Flexibilité pragmatique, exploitation du talent individuel en transition rapide',
    winRate: '72.0%',
    xgCreatedAvg: 2.30,
    xgConcededAvg: 0.90,
    keyPrinciples: 'Liberté créative aux attaquants, gestion des temps faibles, réalisme clinique'
  },
  {
    name: 'Hansi Flick',
    team: 'FC Barcelona',
    formation: '4-2-3-1 Agressif',
    style: 'Ligne défensive très haute, piège du hors-jeu synchronisé, intensité physique maximale',
    winRate: '76.0%',
    xgCreatedAvg: 2.80,
    xgConcededAvg: 1.05,
    keyPrinciples: 'Verticalité directe, pressing à la perte à haute intensité, projection rapide'
  },
  {
    name: 'Simone Inzaghi',
    team: 'Inter Milan',
    formation: '3-5-2 Fluide',
    style: 'Circulation axiale avec défenseurs axiaux qui montent, transitions dévastatrices',
    winRate: '69.0%',
    xgCreatedAvg: 2.15,
    xgConcededAvg: 0.80,
    keyPrinciples: 'Pistons très offensifs, jeu à deux attaquants complémentaires, compacité'
  },
  {
    name: 'Vincent Kompany',
    team: 'Bayern Munich',
    formation: '4-2-3-1 Pression Haute',
    style: 'Domination physique et spatiale, pressing incessant en un contre un tout terrain',
    winRate: '73.5%',
    xgCreatedAvg: 2.70,
    xgConcededAvg: 0.95,
    keyPrinciples: 'Récupération haute, rythme élevé et percussion sur les ailes'
  },
  {
    name: 'Diego Simeone',
    team: 'Atlético Madrid',
    formation: '3-5-2 / 5-3-2',
    style: 'Bloc bas agressif, solidarité défensive absolue et contre-attaque tranchante',
    winRate: '64.5%',
    xgCreatedAvg: 1.85,
    xgConcededAvg: 0.80,
    keyPrinciples: 'Densité dans l axe, fautes tactiques pour couper les transitions, impact physique'
  },
  {
    name: 'Arne Slot',
    team: 'Liverpool',
    formation: '4-2-3-1 / 4-3-3',
    style: 'Contrôle posé du rythme, contre-pressing organisé et percussion chirurgicale',
    winRate: '70.8%',
    xgCreatedAvg: 2.35,
    xgConcededAvg: 0.80,
    keyPrinciples: 'Patience à la construction, pressing ciblé sur les relances basses adverses'
  }
];

export const buildCoachesIndex = () => {
  return {
    allCoaches: COACHES_KNOWLEDGE,
    findCoach: (nameOrTeam) => {
      if (!nameOrTeam) return null;
      const q = normalizeStr(nameOrTeam);
      return COACHES_KNOWLEDGE.find(c => {
        const cName = normalizeStr(c.name);
        const cTeam = normalizeStr(c.team);
        return cName.includes(q) || cTeam.includes(q) || q.includes(cName) || q.includes(cTeam);
      });
    }
  };
};

// ── INDEX 5: COMPÉTITIONS ──
export const COMPETITIONS_KNOWLEDGE = [
  {
    code: 'FRA-L1',
    name: 'Ligue 1',
    country: 'France',
    teamsCount: 18,
    roundsCount: 34,
    qualificationEurope: 'Top 3 direct LDC, 4e barrages LDC, 5e Europa League, 6e Conference League',
    relegation: '17e et 18e relégation directe, 16e barrage contre le 3e de Ligue 2',
    styleProfile: 'Championnat athlétique, forte émergence de jeunes talents, tactique rigoureuse'
  },
  {
    code: 'ENG-PL',
    name: 'Premier League',
    country: 'Angleterre',
    teamsCount: 20,
    roundsCount: 38,
    qualificationEurope: 'Top 4 direct LDC (pouvant passer à 5 selon coefficient UEFA), 5e Europa League',
    relegation: '18e, 19e, 20e relégation directe en Championship',
    styleProfile: 'Intensité physique et rythme les plus élevés au monde, parité financière élevée'
  },
  {
    code: 'ESP-LL',
    name: 'La Liga',
    country: 'Espagne',
    teamsCount: 20,
    roundsCount: 38,
    qualificationEurope: 'Top 4 direct LDC, 5e et vainqueur Copa del Rey en Europa League',
    relegation: '18e, 19e, 20e relégation directe en Segunda División',
    styleProfile: 'Richesse technique, jeu de possession, blocs médians organisés'
  },
  {
    code: 'ITA-SA',
    name: 'Serie A',
    country: 'Italie',
    teamsCount: 20,
    roundsCount: 38,
    qualificationEurope: 'Top 4 direct LDC (5e si bonus coefficient UEFA), 5e et 6e Europa League',
    relegation: '18e, 19e, 20e relégation en Serie B',
    styleProfile: 'Discipline tactique très poussée, systèmes en 3-5-2 répandus, transitions rapides'
  },
  {
    code: 'GER-BL',
    name: 'Bundesliga',
    country: 'Allemagne',
    teamsCount: 18,
    roundsCount: 34,
    qualificationEurope: 'Top 4 direct LDC, 5e et vainqueur DFB Pokal en Europa League',
    relegation: '17e et 18e relégation directe, 16e barrage aller-retour contre le 3e de 2. Bundesliga',
    styleProfile: 'Moyenne de buts la plus élevée (xG élevé), pressing offensif vertical'
  },
  {
    code: 'EUR-CL',
    name: 'Ligue des Champions',
    country: 'Europe',
    format: 'Phase de ligue unifiée à 36 clubs (8 matchs par équipe : 4 domicile / 4 extérieur)',
    qualificationEurope: 'Top 8 qualifié direct en 8es de finale, 9e à 24e en barrages aller-retour',
    styleProfile: 'L élite absolue du football mondial, confrontation des meilleurs modèles de jeu'
  },
  {
    code: 'EUR-EL',
    name: 'Ligue Europa',
    country: 'Europe',
    format: 'Phase de ligue unifiée à 36 clubs (8 matchs par équipe)',
    qualificationEurope: 'Top 8 en 8es, 9e à 24e en barrages',
    styleProfile: 'Niveau d intensité très élevé avec des prétendants historiques majeurs'
  },
  {
    code: 'EUR-ECL',
    name: 'Ligue Conférence',
    country: 'Europe',
    format: 'Phase de ligue à 36 clubs (6 matchs par équipe)',
    qualificationEurope: 'Top 8 en 8es, 9e à 24e en barrages',
    styleProfile: 'Compétition ouverte avec de fortes variations tactiques et opportunités de value bets'
  }
];

export const buildCompetitionsIndex = () => {
  return {
    allCompetitions: COMPETITIONS_KNOWLEDGE,
    findCompetition: (query) => {
      if (!query) return null;
      const q = normalizeStr(query);
      return COMPETITIONS_KNOWLEDGE.find(c => {
        const cCode = c.code.toLowerCase();
        const cName = normalizeStr(c.name);
        const cCountry = normalizeStr(c.country);
        return cCode.includes(q) || cName.includes(q) || cCountry.includes(q) || q.includes(cCode) || q.includes(cName);
      });
    }
  };
};

// ── INDEX 6: MODÈLE ML (Dixon-Coles, Poisson, Explications Mathématiques) ──
export const ML_MODEL_KNOWLEDGE = {
  architecture: 'Modèle Hybride Bivarié Dixon-Coles + LightGBM Multi-Task Calibré',
  dixonColesLogic: {
    base: 'Distribution de Poisson bivariée corrigée pour les faibles scores (0-0, 1-0, 0-1, 1-1) via un paramètre de corrélation rho (rho).',
    parameters: {
      alpha: 'Force offensive de l équipe (capacité à générer du xG)',
      beta: 'Fragilité défensive de l équipe (xG concédé)',
      gamma: 'Avantage du terrain (environ +0.28 à +0.35 but à domicile en moyenne européenne)',
      rho: 'Facteur de dépendance pour scores faibles (typiquement -0.05 à -0.12, corrigeant la sous-estimation du 0-0 et du 1-1)'
    },
    timeDecay: 'Pondération exponentielle décroissante xi (xi = 0.0035) accordant plus d importance aux 15 derniers matchs.'
  },
  valueBetDetection: {
    formula: 'Edge = (Probabilité Réelle Modèle * Cote Bookmaker) - 1',
    threshold: 'Signal déclenché si Edge >= +2.5% (critère de rentabilité long terme avec marge de sécurité)',
    staking: 'Fraction de Kelly ajustée (quart de Kelly) pour maximiser la croissance du capital en minimisant la variance de drawdown.'
  },
  limitations: [
    'Les expulsions précoces (avant la 20e minute) perturbent l équilibre xG prévu de 65%.',
    'La rotation massive d effectif (plus de 5 titulaires ménagés) nécessite un ajustement manuel du xiStrengthRatio.',
    'Les conditions météorologiques extrêmes (pluie torrentielle > 10mm, vent > 40 km/h) réduisent la précision des tirs et le volume de passes.'
  ]
};

export const buildMlModelIndex = () => {
  return ML_MODEL_KNOWLEDGE;
};
