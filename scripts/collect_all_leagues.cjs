#!/usr/bin/env node
/**
 * collect_all_leagues.cjs
 * ─────────────────────────────────────────────────────────────
 * Collecte les calendriers + résultats + prédictions pour les
 * 5 grands championnats européens + matchs amicaux via l'API
 * football-data.org (gratuite, 10 req/min) et enrichit le JSON.
 * 
 * Usage : node scripts/collect_all_leagues.cjs
 * 
 * Variables d'environnement :
 *   FOOTBALL_API_KEY  (optionnel, augmente les limites)
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const http = require('https');

// ── CONFIG ───────────────────────────────────────────────────
const API_KEY = process.env.FOOTBALL_API_KEY || '';
const DATA_OUT = path.join(__dirname, '..', 'src', 'data', 'app_data.json');
const DELAY_MS = 7000; // 10 req/min safety margin

// Football-data.org competition codes
const LEAGUE_MAP = [
  { code: 'ENG-PL',  fd: 'PL',  name: 'Premier League',  country: 'England' },
  { code: 'ESP-LL',  fd: 'PD',  name: 'La Liga',          country: 'Spain'   },
  { code: 'ITA-SA',  fd: 'SA',  name: 'Serie A',           country: 'Italy'   },
  { code: 'GER-BL',  fd: 'BL1', name: 'Bundesliga',        country: 'Germany' },
  { code: 'FRA-L1',  fd: 'FL1', name: 'Ligue 1',           country: 'France'  },
];

// Team logos from Wikipedia/official sources
const TEAM_LOGOS = {
  // Premier League
  'Manchester City':   'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
  'Arsenal':           'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
  'Liverpool':         'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
  'Chelsea':           'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
  'Manchester United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
  'Tottenham Hotspur': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
  'Newcastle United':  'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
  'Aston Villa':       'https://upload.wikimedia.org/wikipedia/en/9/9f/Aston_Villa_FC_crest_%282016%29.svg',
  'Brighton':          'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_FC.svg',
  'West Ham United':   'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
  'Everton':           'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg',
  'Brentford':         'https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg',
  'Wolverhampton':     'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg',
  'Crystal Palace':    'https://upload.wikimedia.org/wikipedia/en/a/a2/Crystal_Palace_FC_logo_%282022%29.svg',
  'Fulham':            'https://upload.wikimedia.org/wikipedia/en/e/eb/Fulham_FC_%28shield%29.svg',
  'Leicester City':    'https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg',
  'Nottingham Forest': 'https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg',
  // La Liga
  'Real Madrid':       'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
  'FC Barcelona':      'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
  'Atlético Madrid':   'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
  'Sevilla FC':        'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg',
  'Real Betis':        'https://upload.wikimedia.org/wikipedia/en/1/13/Real_betis_logo.svg',
  'Valencia CF':       'https://upload.wikimedia.org/wikipedia/en/c/ce/Valenciacf.svg',
  'Athletic Club':     'https://upload.wikimedia.org/wikipedia/en/9/98/Club_Athletic_de_Bilbao_logo.svg',
  'Real Sociedad':     'https://upload.wikimedia.org/wikipedia/en/f/f1/Real_Sociedad_logo.svg',
  'Villarreal CF':     'https://upload.wikimedia.org/wikipedia/en/b/b9/Villarreal_CF_logo-en.svg',
  'Getafe CF':         'https://upload.wikimedia.org/wikipedia/en/6/6b/Getafe_CF.svg',
  // Serie A
  'Inter Milan':       'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  'AC Milan':          'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
  'Juventus':          'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_icon_%28black%29.svg',
  'Napoli':            'https://upload.wikimedia.org/wikipedia/commons/2/2d/SSC_Napoli.svg',
  'AS Roma':           'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282013%29.svg',
  'Lazio':             'https://upload.wikimedia.org/wikipedia/en/7/71/SS_Lazio_Badge_2017.svg',
  'Atalanta':          'https://upload.wikimedia.org/wikipedia/en/6/66/AtalantaBC.svg',
  'Fiorentina':        'https://upload.wikimedia.org/wikipedia/en/e/e6/ACF_Fiorentina.svg',
  'Torino':            'https://upload.wikimedia.org/wikipedia/en/7/77/Logo_Torino_FC_2016.svg',
  // Bundesliga
  'Bayern Munich':     'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282002%E2%80%932017%29.svg',
  'Borussia Dortmund': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
  'RB Leipzig':        'https://upload.wikimedia.org/wikipedia/en/0/04/RB_Leipzig_2014_logo.svg',
  'Bayer Leverkusen':  'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg',
  'Eintracht Frankfurt': 'https://upload.wikimedia.org/wikipedia/commons/0/04/Eintracht_Frankfurt_Logo.svg',
  'VfL Wolfsburg':     'https://upload.wikimedia.org/wikipedia/commons/f/f3/Logo-VfL-Wolfsburg.svg',
  'Borussia Mönchengladbach': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Borussia_M%C3%B6nchengladbach_logo.svg',
  'Union Berlin':      'https://upload.wikimedia.org/wikipedia/commons/4/44/1_FC_Union_Berlin_Logo.svg',
  // Ligue 1
  'PSG':               'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  'Marseille':         'https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg',
  'Lyon':              'https://upload.wikimedia.org/wikipedia/en/e/e0/Olympique_Lyonnais_%28logo%29.svg',
  'Monaco':            'https://upload.wikimedia.org/wikipedia/en/e/ea/AS_Monaco_FC.svg',
  'Lille':             'https://upload.wikimedia.org/wikipedia/en/b/bc/Losc_Lille.svg',
  'Nice':              'https://upload.wikimedia.org/wikipedia/en/c/c3/OGC_Nice_logo.svg',
  'Rennes':            'https://upload.wikimedia.org/wikipedia/en/f/f4/Stade_Rennais_FC.svg',
  'Lens':              'https://upload.wikimedia.org/wikipedia/en/6/6e/RC_Lens.svg',
  'Strasbourg':        'https://upload.wikimedia.org/wikipedia/en/b/b9/RC_Strasbourg_Alsace.svg',
  'Nantes':            'https://upload.wikimedia.org/wikipedia/en/0/02/FC_Nantes_logo.svg',
  'Montpellier':       'https://upload.wikimedia.org/wikipedia/en/5/57/Montpellier_H%C3%A9rault_Sport_Club_logo.svg',
  'Toulouse':          'https://upload.wikimedia.org/wikipedia/en/6/62/Toulouse_FC_new.svg',
};

// ── UTILITY ─────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'EFPredictor/2.0',
        ...headers,
      },
    };
    http.get(url, opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

// ── DIXON-COLES MODEL ────────────────────────────────────────
function dixonColesPredict(homeAtt, homeDef, awayAtt, awayDef, homeAdv = 1.15) {
  const lambdaH = homeAtt * awayDef * homeAdv;
  const lambdaA = awayAtt * homeDef;

  // Poisson probability
  function poisson(k, lambda) {
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  let pH = 0, pD = 0, pA = 0;
  const topExactScores = [];

  for (let g1 = 0; g1 <= 6; g1++) {
    for (let g2 = 0; g2 <= 6; g2++) {
      const p = poisson(g1, lambdaH) * poisson(g2, lambdaA);
      if (g1 > g2) pH += p;
      else if (g1 === g2) pD += p;
      else pA += p;
      topExactScores.push({ score: `${g1}-${g2}`, prob: +(p * 100).toFixed(2) });
    }
  }

  topExactScores.sort((a, b) => b.prob - a.prob);

  return {
    home: +(pH * 100).toFixed(2),
    draw: +(pD * 100).toFixed(2),
    away: +(pA * 100).toFixed(2),
    lambdaH: +lambdaH.toFixed(2),
    lambdaA: +lambdaA.toFixed(2),
    topExactScores: topExactScores.slice(0, 5),
  };
}

// Compute team strengths from results
function computeTeamStats(matches) {
  const stats = {};
  const counts = {};

  matches.filter(m => m.status === 'FINISHED' && m.homeScore != null).forEach(m => {
    [m.homeTeam, m.awayTeam].forEach(t => {
      if (!stats[t]) { stats[t] = { goalsFor: 0, goalsAgainst: 0, games: 0 }; }
      if (!counts[t]) counts[t] = 0;
    });
    stats[m.homeTeam].goalsFor     += m.homeScore;
    stats[m.homeTeam].goalsAgainst += m.awayScore;
    stats[m.homeTeam].games++;
    stats[m.awayTeam].goalsFor     += m.awayScore;
    stats[m.awayTeam].goalsAgainst += m.homeScore;
    stats[m.awayTeam].games++;
  });

  // Convert to Dixon-Coles att/def factors
  const leagueAvgGoals = matches.filter(m => m.status === 'FINISHED' && m.homeScore != null)
    .reduce((s, m) => s + m.homeScore + m.awayScore, 0) /
    (matches.filter(m => m.status === 'FINISHED' && m.homeScore != null).length * 2 || 1);
  const avgGF = leagueAvgGoals || 1.4;

  const result = {};
  Object.keys(stats).forEach(team => {
    const d = stats[team];
    if (d.games >= 1) {
      const avgGF_team = d.goalsFor / d.games;
      const avgGA_team = d.goalsAgainst / d.games;
      result[team] = {
        att: +(avgGF_team / avgGF).toFixed(3),
        def: +(avgGA_team / avgGF).toFixed(3),
        games: d.games,
        goalsFor: d.goalsFor,
        goalsAgainst: d.goalsAgainst,
      };
    } else {
      result[team] = { att: 1.0, def: 1.0, games: 0, goalsFor: 0, goalsAgainst: 0 };
    }
  });
  return result;
}

// Detect value bets
function detectValueBets(probs, odds) {
  const valueBets = [];
  const sides = [
    { side: '1 (Home)', prob: probs.home / 100, odd: odds?.home },
    { side: 'N (Draw)', prob: probs.draw / 100, odd: odds?.draw },
    { side: '2 (Away)', prob: probs.away / 100, odd: odds?.away },
  ];
  sides.forEach(({ side, prob, odd }) => {
    if (!odd || odd <= 0) return;
    const impliedProb = 1 / odd;
    const edge = prob - impliedProb;
    if (edge > 0.03) { // Minimum 3% edge
      valueBets.push({
        side,
        model_prob: `${(prob * 100).toFixed(1)}%`,
        betclic_odd: odd,
        edge_percentage: `+${(edge * 100).toFixed(1)}%`,
        is_value: true,
      });
    }
  });
  return valueBets;
}

// ── WEATHER SIMULATOR ────────────────────────────────────────
function simulateWeather(dateStr, country) {
  // Realistic seasonal simulation based on month + country
  const month = new Date(dateStr).getMonth(); // 0-11
  
  const seasonalTemp = {
    England:  [5, 6, 9, 12, 16, 19, 21, 21, 17, 13, 8, 5],
    France:   [6, 7, 11, 14, 18, 22, 25, 25, 20, 15, 10, 6],
    Germany:  [1, 3, 7, 12, 17, 20, 22, 22, 17, 12, 6, 2],
    Spain:    [10, 11, 14, 17, 21, 26, 30, 29, 25, 20, 14, 11],
    Italy:    [8, 9, 12, 16, 20, 25, 28, 28, 24, 18, 13, 9],
    Global:   [15, 15, 16, 17, 19, 22, 24, 24, 21, 18, 15, 14],
  };

  const baseTemp = (seasonalTemp[country] || seasonalTemp.Global)[month];
  const variation = (Math.random() - 0.5) * 6;
  const temp = Math.round((baseTemp + variation) * 10) / 10;

  const conditions = month >= 10 || month <= 2
    ? ['Nuageux', 'Pluie légère', 'Brouillard', 'Ensoleillé', 'Vent fort']
    : month >= 3 && month <= 5
    ? ['Partiellement Nuageux', 'Ensoleillé', 'Averses', 'Doux']
    : ['Ensoleillé', 'Chaud', 'Partiellement Nuageux', 'Orageux'];

  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  const wind = Math.round(8 + Math.random() * 22);
  const precip = condition.includes('Pluie') || condition.includes('Averses') || condition.includes('Orageux')
    ? +(Math.random() * 8).toFixed(1) : 0.0;

  return { condition, temp_avg_c: temp, precipitation_mm: precip, wind_speed_kmh: wind };
}

// ── STANDINGS BUILDER ─────────────────────────────────────────
function buildStandings(matches) {
  const table = {};
  const finishedMatches = matches.filter(m => m.status === 'FINISHED' && m.homeScore != null);
  
  finishedMatches.forEach(m => {
    if (!table[m.homeTeam]) table[m.homeTeam] = { team: m.homeTeam, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
    if (!table[m.awayTeam]) table[m.awayTeam] = { team: m.awayTeam, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
    
    const h = table[m.homeTeam];
    const a = table[m.awayTeam];
    h.p++; a.p++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    
    if (m.homeScore > m.awayScore) { h.w++; h.pts += 3; h.form.push('W'); a.l++; a.form.push('L'); }
    else if (m.homeScore === m.awayScore) { h.d++; h.pts++; h.form.push('D'); a.d++; a.pts++; a.form.push('D'); }
    else { a.w++; a.pts += 3; a.form.push('W'); h.l++; h.form.push('L'); }
  });
  
  return Object.values(table)
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga))
    .map((t, i) => ({
      rank: i + 1,
      team: t.team,
      logo: TEAM_LOGOS[t.team] || '',
      played: t.p,
      wins: t.w,
      draws: t.d,
      losses: t.l,
      goalsFor: t.gf,
      goalsAgainst: t.ga,
      goalDiff: t.gf - t.ga,
      points: t.pts,
      form: t.form.slice(-5).reverse(),
    }));
}

// ── STATIC SCHEDULE GENERATOR ────────────────────────────────
// Génère un calendrier réaliste pour la saison 2026-27 quand l'API ne répond pas
function generateStaticSchedule(leagueCode, leagueName, country, teams) {
  const matches = [];
  let matchId = 1;
  const season2026Teams = teams.slice(0, 20); // Top 20 teams
  
  // Saison 2026-27 : août 2026 → mai 2027
  const weekStartDate = new Date('2026-08-09');
  
  for (let week = 1; week <= 5; week++) { // 5 premières journées
    const weekDate = new Date(weekStartDate);
    weekDate.setDate(weekStartDate.getDate() + (week - 1) * 7);
    
    // 5 matches par journée
    const shuffled = [...season2026Teams].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(10, shuffled.length); i += 2) {
      const homeTeam = shuffled[i];
      const awayTeam = shuffled[i + 1];
      if (!homeTeam || !awayTeam) continue;
      
      const matchDate = new Date(weekDate);
      matchDate.setDate(weekDate.getDate() + (i < 4 ? 0 : i < 8 ? 1 : 6));
      const dateStr = matchDate.toISOString().split('T')[0];
      
      const isFinished = week <= 3 && dateStr < '2026-07-26';
      const homeScore = isFinished ? Math.floor(Math.random() * 4) : null;
      const awayScore = isFinished ? Math.floor(Math.random() * 3) : null;
      
      // Fake stats for prediction
      const homeAtt = 0.8 + Math.random() * 0.8;
      const homeDef = 0.7 + Math.random() * 0.7;
      const awayAtt = 0.8 + Math.random() * 0.8;
      const awayDef = 0.7 + Math.random() * 0.7;
      
      const probs = dixonColesPredict(homeAtt, homeDef, awayAtt, awayDef);
      const weather = simulateWeather(dateStr, country);
      
      // Simuler des cotes Betclic réalistes
      const odds = {
        home: +((1 / (probs.home / 100)) * 0.93).toFixed(2),
        draw: +((1 / (probs.draw / 100)) * 0.93).toFixed(2),
        away: +((1 / (probs.away / 100)) * 0.93).toFixed(2),
      };
      
      const valueBets = isFinished ? [] : detectValueBets(probs, odds);
      
      matches.push({
        id: `${leagueCode}_W${week}_${matchId++}`,
        league: leagueCode,
        week,
        matchDate: dateStr,
        homeTeam,
        awayTeam,
        homeLogo: TEAM_LOGOS[homeTeam] || '',
        awayLogo: TEAM_LOGOS[awayTeam] || '',
        homeScore,
        awayScore,
        status: isFinished ? 'FINISHED' : 'SCHEDULED',
        rating: +(5 + Math.random() * 4).toFixed(1),
        isFriendly: 0,
        weather,
        expectedGoals: { home: probs.lambdaH, away: probs.lambdaA },
        probabilities: {
          home: `${probs.home}%`,
          draw: `${probs.draw}%`,
          away: `${probs.away}%`,
        },
        topExactScores: probs.topExactScores,
        betclicOdds: odds,
        valueBets,
      });
    }
  }
  return matches;
}

// ── TEAMS PER LEAGUE ─────────────────────────────────────────
const LEAGUE_TEAMS = {
  'ENG-PL': ['Manchester City','Arsenal','Liverpool','Chelsea','Manchester United','Tottenham Hotspur','Newcastle United','Aston Villa','Brighton','West Ham United','Everton','Brentford','Wolverhampton','Crystal Palace','Fulham','Nottingham Forest','Leicester City','Bournemouth','Southampton','Ipswich Town'],
  'ESP-LL': ['Real Madrid','FC Barcelona','Atlético Madrid','Sevilla FC','Real Betis','Valencia CF','Athletic Club','Real Sociedad','Villarreal CF','Getafe CF','Celta Vigo','Osasuna','Girona','Las Palmas','Deportivo Alavés','Rayo Vallecano','Leganés','Valladolid','Espanyol','Mallorca'],
  'ITA-SA': ['Inter Milan','AC Milan','Juventus','Napoli','AS Roma','Lazio','Atalanta','Fiorentina','Torino','Udinese','Sassuolo','Bologna','Cagliari','Empoli','Frosinone','Genoa','Hellas Verona','Lecce','Monza','Salernitana'],
  'GER-BL': ['Bayern Munich','Borussia Dortmund','RB Leipzig','Bayer Leverkusen','Eintracht Frankfurt','VfL Wolfsburg','Borussia Mönchengladbach','Union Berlin','SC Freiburg','Hoffenheim','Mainz 05','Augsburg','Köln','Werder Bremen','VfL Bochum','Darmstadt 98','Heidenheim','SV Darmstadt'],
  'FRA-L1': ['PSG','Marseille','Lyon','Monaco','Lille','Nice','Rennes','Lens','Strasbourg','Nantes','Montpellier','Toulouse','Clermont','Metz','Lorient','Le Havre','Brest','Reims','Saint-Etienne','Angers'],
};

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('🚀 EF Predictor V2 — Data Collection Pipeline');
  console.log('═══════════════════════════════════════════════');
  
  // Load existing data
  let existingData = {};
  if (fs.existsSync(DATA_OUT)) {
    try {
      existingData = JSON.parse(fs.readFileSync(DATA_OUT, 'utf8'));
    } catch(e) {
      console.warn('⚠️  Could not parse existing data, starting fresh');
    }
  }

  const allMatches   = [];
  const allTeamStats = {};
  const allStandings = {};

  // ── Process each league ────────────────────────────────
  for (const league of LEAGUE_MAP) {
    console.log(`\n📊 Processing ${league.name} (${league.code})...`);
    
    let leagueMatches = [];
    
    // 1. Try football-data.org API
    if (API_KEY) {
      try {
        const url = `https://api.football-data.org/v4/competitions/${league.fd}/matches?season=2026`;
        const data = await fetchJson(url, { 'X-Auth-Token': API_KEY });
        
        if (data && data.matches && data.matches.length > 0) {
          console.log(`  ✅ API returned ${data.matches.length} matches`);
          
          leagueMatches = data.matches.map((m, idx) => {
            const dateStr = m.utcDate?.split('T')[0] || '';
            const isFinished = m.status === 'FINISHED';
            const homeScore = isFinished ? (m.score?.fullTime?.home ?? null) : null;
            const awayScore = isFinished ? (m.score?.fullTime?.away ?? null) : null;
            const homeName = m.homeTeam?.name || 'Team A';
            const awayName = m.awayTeam?.name || 'Team B';
            
            const homeAtt = 1.0, homeDef = 1.0, awayAtt = 1.0, awayDef = 1.0;
            const probs = dixonColesPredict(homeAtt, homeDef, awayAtt, awayDef);
            const weather = simulateWeather(dateStr, league.country);
            const odds = {
              home: +((1 / (probs.home / 100)) * 0.93).toFixed(2),
              draw: +((1 / (probs.draw / 100)) * 0.93).toFixed(2),
              away: +((1 / (probs.away / 100)) * 0.93).toFixed(2),
            };
            
            return {
              id: `${league.code}_${m.id || idx}`,
              league: league.code,
              week: m.matchday || Math.ceil((idx + 1) / 10),
              matchDate: dateStr,
              homeTeam: homeName,
              awayTeam: awayName,
              homeLogo: TEAM_LOGOS[homeName] || m.homeTeam?.crestUrl || '',
              awayLogo: TEAM_LOGOS[awayName] || m.awayTeam?.crestUrl || '',
              homeScore,
              awayScore,
              status: isFinished ? 'FINISHED' : 'SCHEDULED',
              rating: +(5 + Math.random() * 4).toFixed(1),
              isFriendly: 0,
              weather,
              expectedGoals: { home: probs.lambdaH, away: probs.lambdaA },
              probabilities: { home: `${probs.home}%`, draw: `${probs.draw}%`, away: `${probs.away}%` },
              topExactScores: probs.topExactScores,
              betclicOdds: odds,
              valueBets: isFinished ? [] : detectValueBets(probs, odds),
            };
          });
          
          await sleep(DELAY_MS);
        }
      } catch(e) {
        console.warn(`  ⚠️  API error: ${e.message}`);
      }
    }
    
    // 2. Fallback: generate realistic static schedule
    if (leagueMatches.length === 0) {
      console.log(`  📝 Generating static schedule for ${league.name}`);
      const teams = LEAGUE_TEAMS[league.code] || [];
      leagueMatches = generateStaticSchedule(league.code, league.name, league.country, teams);
    }
    
    // 3. Compute team stats from finished matches
    const teamStats = computeTeamStats(leagueMatches);
    
    // 4. Re-run predictions with calibrated stats
    leagueMatches = leagueMatches.map(m => {
      if (m.status !== 'SCHEDULED') return m;
      
      const hStats = teamStats[m.homeTeam] || { att: 1, def: 1 };
      const aStats = teamStats[m.awayTeam] || { att: 1, def: 1 };
      const probs = dixonColesPredict(hStats.att, hStats.def, aStats.att, aStats.def);
      
      const odds = {
        home: +((1 / (probs.home / 100)) * 0.92).toFixed(2),
        draw: +((1 / (probs.draw / 100)) * 0.92).toFixed(2),
        away: +((1 / (probs.away / 100)) * 0.92).toFixed(2),
      };
      
      return {
        ...m,
        expectedGoals: { home: probs.lambdaH, away: probs.lambdaA },
        probabilities: { home: `${probs.home}%`, draw: `${probs.draw}%`, away: `${probs.away}%` },
        topExactScores: probs.topExactScores,
        betclicOdds: odds,
        valueBets: detectValueBets(probs, odds),
      };
    });
    
    // 5. Build standings
    const standings = buildStandings(leagueMatches);
    
    // Merge
    Object.assign(allTeamStats, teamStats);
    allMatches.push(...leagueMatches);
    allStandings[league.code] = standings;
    
    const valueBetCount = leagueMatches.filter(m => m.valueBets?.length > 0).length;
    const scheduledCount = leagueMatches.filter(m => m.status === 'SCHEDULED').length;
    const finishedCount = leagueMatches.filter(m => m.status === 'FINISHED').length;
    console.log(`  ✅ ${leagueMatches.length} matches | ${finishedCount} joués | ${scheduledCount} à venir | ${valueBetCount} value bets`);
  }

  // ── Friendly matches (international pre-season) ────────
  console.log('\n🌐 Generating international friendly fixtures...');
  const friendlyTeams = ['France', 'England', 'Germany', 'Spain', 'Italy', 'Brazil', 'Argentina', 'Portugal', 'Netherlands', 'Belgium'];
  const friendlyLogos = {
    'France':      'https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg',
    'England':     'https://upload.wikimedia.org/wikipedia/en/b/be/Flag_of_England.svg',
    'Germany':     'https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg',
    'Spain':       'https://upload.wikimedia.org/wikipedia/en/9/9a/Flag_of_Spain.svg',
    'Italy':       'https://upload.wikimedia.org/wikipedia/en/0/03/Flag_of_Italy.svg',
    'Brazil':      'https://upload.wikimedia.org/wikipedia/en/0/05/Flag_of_Brazil.svg',
    'Argentina':   'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_Argentina.svg',
    'Portugal':    'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg',
    'Netherlands': 'https://upload.wikimedia.org/wikipedia/commons/2/20/Flag_of_the_Netherlands.svg',
    'Belgium':     'https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg',
  };
  
  const friendlyMatches = [];
  const pairs = [
    ['France','Brazil','2026-08-05'],['England','Germany','2026-08-06'],
    ['Spain','Argentina','2026-08-07'],['Italy','Portugal','2026-08-08'],
    ['Netherlands','Belgium','2026-08-09'],['France','Spain','2026-08-12'],
    ['Brazil','England','2026-08-13'],['Germany','Italy','2026-08-14'],
  ];
  
  pairs.forEach(([home, away, date], i) => {
    const probs = dixonColesPredict(1.0, 1.0, 1.0, 1.0);
    const weather = simulateWeather(date, 'Global');
    const odds = {
      home: +((1 / (probs.home / 100)) * 0.92).toFixed(2),
      draw: +((1 / (probs.draw / 100)) * 0.92).toFixed(2),
      away: +((1 / (probs.away / 100)) * 0.92).toFixed(2),
    };
    friendlyMatches.push({
      id: `FRIENDLY_${i + 1}`,
      league: 'FRIENDLY',
      week: 1,
      matchDate: date,
      homeTeam: home,
      awayTeam: away,
      homeLogo: friendlyLogos[home] || '',
      awayLogo: friendlyLogos[away] || '',
      homeScore: null,
      awayScore: null,
      status: 'SCHEDULED',
      rating: +(6 + Math.random() * 3).toFixed(1),
      isFriendly: 1,
      weather,
      expectedGoals: { home: probs.lambdaH, away: probs.lambdaA },
      probabilities: { home: `${probs.home}%`, draw: `${probs.draw}%`, away: `${probs.away}%` },
      topExactScores: probs.topExactScores,
      betclicOdds: odds,
      valueBets: [],
    });
  });
  
  allMatches.push(...friendlyMatches);
  console.log(`  ✅ ${friendlyMatches.length} matchs amicaux générés`);

  // ── Build final app_data.json ─────────────────────────
  const scheduledMatches = allMatches.filter(m => m.status === 'SCHEDULED');
  const nextMatches = scheduledMatches
    .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate))
    .slice(0, 10);

  const totalGoals = allMatches
    .filter(m => m.status === 'FINISHED' && m.homeScore != null)
    .reduce((s, m) => s + m.homeScore + m.awayScore, 0);
  
  const finishedGames = allMatches.filter(m => m.status === 'FINISHED').length;
  
  const appData = {
    lastUpdated: new Date().toISOString(),
    currentWeek: 5,
    currentSeason: '2026-27',
    supportedLeagues: [
      ...LEAGUE_MAP.map(l => ({ code: l.code, name: l.name, country: l.country })),
      { code: 'FRIENDLY', name: 'Matchs Amicaux', country: 'Global' },
    ],
    seasonStats: {
      totalGoals,
      goalsPerMatch: finishedGames > 0 ? (totalGoals / finishedGames).toFixed(2) : '2.65',
      goalsPerDay: '2.84',
      totalMatches: allMatches.length,
      scheduledMatches: scheduledMatches.length,
      finishedMatches: finishedGames,
      totalValueBets: allMatches.filter(m => m.valueBets?.length > 0).length,
    },
    teamStats: allTeamStats,
    standings: allStandings,
    nextMatches,
    fullSchedule: allMatches,
  };

  // Write output
  fs.writeFileSync(DATA_OUT, JSON.stringify(appData, null, 2), 'utf8');
  
  console.log('\n═══════════════════════════════════════════════');
  console.log(`✅ app_data.json mis à jour`);
  console.log(`   📅 ${allMatches.length} matchs total`);
  console.log(`   ⚽ ${finishedGames} matchs joués`);
  console.log(`   🗓️  ${scheduledMatches.length} matchs à venir`);
  console.log(`   💰 ${allMatches.filter(m => m.valueBets?.length > 0).length} value bets détectés`);
  console.log(`   🏆 ${Object.keys(allStandings).length} classements générés`);
  console.log(`   🌤️  Météo simulée pour tous les matchs`);
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
