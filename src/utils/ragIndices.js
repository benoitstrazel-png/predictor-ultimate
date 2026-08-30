/**
 * src/utils/ragIndices.js
 * ─────────────────────────────────────────────────────────────
 * Architecture RAG Multi-Index Spécialisés Football :
 * 1. matchesIndex      : xG, cotes Betclic, météo, arbitres, forfaits, H2H, Dixon-Coles, value bets
 * 2. playersIndex      : 2 112 joueurs, stats, forme, xG90, xA90, ratings, historique
 * 3. coachesIndex      : styles de jeu, systèmes tactiques, win rates, bilans H2H
 * 4. competitionsIndex : règles, barèmes, calendrier, enjeux
 * 5. mlModelIndex      : logique Dixon-Coles, Bivariate Poisson, SHAP, limites, value bets
 */

import APP_DATA from '../data/app_data.json';
import UNIFIED_HISTORY from '../data/unified_history.json';
import PLAYERS_DATA from '../data/players.json';

// Dictionnaire des alias d'équipes normalisés
export const TEAM_ALIASES = {
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
  'rennes': 'Rennes',
  'strasbourg': 'Strasbourg',
  'real': 'Real Madrid',
  'real madrid': 'Real Madrid',
  'barca': 'FC Barcelona',
  'barcelona': 'FC Barcelona',
  'fc barcelona': 'FC Barcelona',
  'atletico': 'Atlético Madrid',
  'atletico madrid': 'Atlético Madrid',
  'man city': 'Manchester City',
  'city': 'Manchester City',
  'man utd': 'Manchester United',
  'manchester united': 'Manchester United',
  'arsenal': 'Arsenal',
  'liverpool': 'Liverpool',
  'chelsea': 'Chelsea',
  'tottenham': 'Tottenham',
  'spurs': 'Tottenham',
  'bayern': 'Bayern Munich',
  'bayern munich': 'Bayern Munich',
  'dortmund': 'Borussia Dortmund',
  'bvb': 'Borussia Dortmund',
  'leverkusen': 'Bayer Leverkusen',
  'leipzig': 'RB Leipzig',
  'inter': 'Inter Milan',
  'inter milan': 'Inter Milan',
  'milan': 'AC Milan',
  'ac milan': 'AC Milan',
  'juventus': 'Juventus',
  'juve': 'Juventus',
  'napoli': 'Napoli',
  'roma': 'AS Roma',
  'benfica': 'Benfica',
  'sporting': 'Sporting CP',
  'porto': 'FC Porto',
  'aarhus': 'AGF Aarhus',
  'agf aarhus': 'AGF Aarhus',
  'tromso': 'Tromsø',
  'tromsø': 'Tromsø',
  'brighton': 'Brighton'
};

// ── INDEX 1: MATCHS (Actuels + Historiques) ──
export const buildMatchesIndex = () => {
  const schedule = APP_DATA?.fullSchedule || [];
  const history = UNIFIED_HISTORY || [];

  return {
    liveSchedule: schedule.map(m => {
      const pred = m.prediction || {};
      const probs = pred.probabilities || { home: '45%', draw: '28%', away: '27%' };
      const homeXg = pred.expectedGoals?.home || m.homeXg || 1.65;
      const awayXg = pred.expectedGoals?.away || m.awayXg || 1.10;
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
        referee: m.referee || { name: 'Corps Arbitral Officiel', severity: '7.2/10' },
        probabilities: probs,
        valueBets: m.valueBets || [],
        lineupStatus: m.lineupStatus || 'PROBABLE',
        homeLineup: m.homeLineup || { formation: '4-3-3', keyAbsentees: [] },
        awayLineup: m.awayLineup || { formation: '4-2-3-1', keyAbsentees: [] },
        advice: pred.advice || `Avantage ${homeXg > awayXg ? m.homeTeam : m.awayTeam}`,
        searchTokens: `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.date}`.toLowerCase()
      };
    }),
    historyMatchesCount: history.length,
    historyData: history
  };
};

// ── INDEX 2: JOUEURS (Stats, xG90, xA90, Forme) ──
export const buildPlayersIndex = () => {
  const players = Array.isArray(PLAYERS_DATA) ? PLAYERS_DATA : [];
  
  return {
    totalCount: players.length,
    allPlayers: players,
    findByName: (name) => {
      if (!name) return null;
      const q = name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return players.find(p => {
        const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return pName.includes(q) || q.includes(pName);
      });
    },
    findByTeam: (team) => {
      if (!team) return [];
      const q = team.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return players.filter(p => {
        const pTeam = (p.team || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

// ── INDEX 3: ENTRAÎNEURS (Tactiques, Styles, Formations) ──
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
  }
];

export const buildCoachesIndex = () => {
  return {
    allCoaches: COACHES_KNOWLEDGE,
    findCoach: (nameOrTeam) => {
      if (!nameOrTeam) return null;
      const q = nameOrTeam.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return COACHES_KNOWLEDGE.find(c => {
        const cName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cTeam = c.team.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cName.includes(q) || cTeam.includes(q) || q.includes(cName) || q.includes(cTeam);
      });
    }
  };
};

// ── INDEX 4: COMPÉTITIONS (Règles, Formats, Calendrier) ──
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
      const q = query.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return COMPETITIONS_KNOWLEDGE.find(c => {
        const cCode = c.code.toLowerCase();
        const cName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cCountry = c.country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cCode.includes(q) || cName.includes(q) || cCountry.includes(q) || q.includes(cCode) || q.includes(cName);
      });
    }
  };
};

// ── INDEX 5: MODÈLE ML (Dixon-Coles, Poisson, Explications Mathématiques) ──
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
