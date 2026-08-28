#!/usr/bin/env node
/**
 * populate_5league_players.cjs
 * ─────────────────────────────────────────────────────────────
 * Peuple les rosters et joueurs vedettes des 5 championnats européens :
 * 🇬🇧 Premier League, 🇪🇸 La Liga, 🇮🇹 Serie A, 🇩🇪 Bundesliga, 🇫🇷 Ligue 1.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, '..', 'src', 'data', 'players.json');
const REAL_PLAYERS_FILE = path.join(__dirname, '..', 'src', 'data', 'real_players.json');

console.log('⚡ Peuplemenent des Joueurs Internationales des 5 Championnats...');

const TOP_PLAYERS_5_LEAGUES = [
  // 🇬🇧 Premier League
  { name: 'Erling Haaland', team: 'Manchester City', league: 'ENG-PL', pos: 'Buteur', rating: 9.2, xG90: 0.94, xA90: 0.18, oddScorer: 1.65, oddAssist: 4.50, confidence: '94%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Erling_Haaland_2023.jpg' },
  { name: 'Bukayo Saka', team: 'Arsenal', league: 'ENG-PL', pos: 'Ailier D.', rating: 8.8, xG90: 0.48, xA90: 0.52, oddScorer: 2.30, oddAssist: 2.10, confidence: '91%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Bukayo_Saka_2021.jpg' },
  { name: 'Mohamed Salah', team: 'Liverpool', league: 'ENG-PL', pos: 'Ailier D.', rating: 9.0, xG90: 0.72, xA90: 0.45, oddScorer: 1.85, oddAssist: 2.45, confidence: '92%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Mohamed_Salah_2018.jpg' },
  { name: 'Cole Palmer', team: 'Chelsea', league: 'ENG-PL', pos: 'Milieu Off.', rating: 8.9, xG90: 0.65, xA90: 0.48, oddScorer: 2.10, oddAssist: 2.25, confidence: '89%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Cole_Palmer_2023.jpg/440px-Cole_Palmer_2023.jpg' },
  { name: 'Phil Foden', team: 'Manchester City', league: 'ENG-PL', pos: 'Milieu Off.', rating: 8.7, xG90: 0.54, xA90: 0.42, oddScorer: 2.40, oddAssist: 2.50, confidence: '87%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Phil_Foden_2021.jpg' },
  { name: 'Declan Rice', team: 'Arsenal', league: 'ENG-PL', pos: 'Milieu Def.', rating: 8.5, xG90: 0.18, xA90: 0.32, oddScorer: 5.50, oddAssist: 3.20, confidence: '82%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Declan_Rice_2021.jpg' },

  // 🇪🇸 La Liga
  { name: 'Kylian Mbappé', team: 'Real Madrid', league: 'ESP-LL', pos: 'Attaquant', rating: 9.4, xG90: 0.88, xA90: 0.35, oddScorer: 1.72, oddAssist: 3.10, confidence: '95%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Kylian_Mbapp%C3%A9_2018.jpg' },
  { name: 'Vinícius Júnior', team: 'Real Madrid', league: 'ESP-LL', pos: 'Ailier G.', rating: 9.2, xG90: 0.68, xA90: 0.52, oddScorer: 2.05, oddAssist: 2.20, confidence: '93%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Vinicius_Junior_2018.jpg' },
  { name: 'Jude Bellingham', team: 'Real Madrid', league: 'ESP-LL', pos: 'Milieu Off.', rating: 9.1, xG90: 0.58, xA90: 0.44, oddScorer: 2.25, oddAssist: 2.60, confidence: '91%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Jude_Bellingham_2022.jpg' },
  { name: 'Lamine Yamal', team: 'FC Barcelona', league: 'ESP-LL', pos: 'Ailier D.', rating: 9.1, xG90: 0.42, xA90: 0.64, oddScorer: 2.60, oddAssist: 1.95, confidence: '94%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lamine_Yamal_Euro_2024.jpg/440px-Lamine_Yamal_Euro_2024.jpg' },
  { name: 'Robert Lewandowski', team: 'FC Barcelona', league: 'ESP-LL', pos: 'Buteur', rating: 8.9, xG90: 0.82, xA90: 0.22, oddScorer: 1.80, oddAssist: 4.20, confidence: '90%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Robert_Lewandowski_2018.jpg' },
  { name: 'Raphinha', team: 'FC Barcelona', league: 'ESP-LL', pos: 'Ailier G.', rating: 8.8, xG90: 0.52, xA90: 0.55, oddScorer: 2.45, oddAssist: 2.15, confidence: '88%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Raphinha_2022.jpg' },

  // 🇮🇹 Serie A
  { name: 'Lautaro Martínez', team: 'Inter Milan', league: 'ITA-SA', pos: 'Buteur', rating: 9.0, xG90: 0.76, xA90: 0.28, oddScorer: 1.90, oddAssist: 3.80, confidence: '91%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Lautaro_Martinez_2021.jpg/440px-Lautaro_Martinez_2021.jpg' },
  { name: 'Marcus Thuram', team: 'Inter Milan', league: 'ITA-SA', pos: 'Attaquant', rating: 8.6, xG90: 0.58, xA90: 0.38, oddScorer: 2.20, oddAssist: 3.20, confidence: '86%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Marcus_Thuram_2022.jpg/440px-Marcus_Thuram_2022.jpg' },
  { name: 'Dušan Vlahović', team: 'Juventus', league: 'ITA-SA', pos: 'Buteur', rating: 8.5, xG90: 0.71, xA90: 0.18, oddScorer: 2.05, oddAssist: 4.80, confidence: '85%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Dusan_Vlahovic.jpg/440px-Dusan_Vlahovic.jpg' },
  { name: 'Rafael Leão', team: 'AC Milan', league: 'ITA-SA', pos: 'Ailier G.', rating: 8.7, xG90: 0.48, xA90: 0.56, oddScorer: 2.50, oddAssist: 2.10, confidence: '88%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Rafael_Leao_2021.jpg/440px-Rafael_Leao_2021.jpg' },
  { name: 'Christian Pulisic', team: 'AC Milan', league: 'ITA-SA', pos: 'Milieu Off.', rating: 8.6, xG90: 0.45, xA90: 0.42, oddScorer: 2.70, oddAssist: 2.60, confidence: '86%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Christian_Pulisic_2021.jpg/440px-Christian_Pulisic_2021.jpg' },

  // 🇩🇪 Bundesliga
  { name: 'Harry Kane', team: 'Bayern Munich', league: 'GER-BL', pos: 'Buteur', rating: 9.3, xG90: 0.92, xA90: 0.36, oddScorer: 1.62, oddAssist: 3.10, confidence: '95%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Harry_Kane_2018.jpg' },
  { name: 'Jamal Musiala', team: 'Bayern Munich', league: 'GER-BL', pos: 'Milieu Off.', rating: 9.0, xG90: 0.55, xA90: 0.48, oddScorer: 2.30, oddAssist: 2.25, confidence: '92%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Jamal_Musiala_2022.jpg/440px-Jamal_Musiala_2022.jpg' },
  { name: 'Florian Wirtz', team: 'Bayer Leverkusen', league: 'GER-BL', pos: 'Milieu Off.', rating: 9.2, xG90: 0.48, xA90: 0.68, oddScorer: 2.45, oddAssist: 1.85, confidence: '94%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Florian_Wirtz_2022.jpg/440px-Florian_Wirtz_2022.jpg' },
  { name: 'Victor Boniface', team: 'Bayer Leverkusen', league: 'GER-BL', pos: 'Buteur', rating: 8.6, xG90: 0.74, xA90: 0.28, oddScorer: 2.10, oddAssist: 3.90, confidence: '87%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Victor_Boniface.jpg/440px-Victor_Boniface.jpg' },
  { name: 'Serhou Guirassy', team: 'Borussia Dortmund', league: 'GER-BL', pos: 'Buteur', rating: 8.7, xG90: 0.78, xA90: 0.20, oddScorer: 1.95, oddAssist: 4.40, confidence: '89%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Serhou_Guirassy.jpg/440px-Serhou_Guirassy.jpg' },

  // 🇫🇷 Ligue 1
  { name: 'Bradley Barcola', team: 'PSG', league: 'FRA-L1', pos: 'Ailier G.', rating: 8.8, xG90: 0.62, xA90: 0.38, oddScorer: 2.15, oddAssist: 3.40, confidence: '88%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Bradley_Barcola_2023.jpg/440px-Bradley_Barcola_2023.jpg' },
  { name: 'Ousmane Dembélé', team: 'PSG', league: 'FRA-L1', pos: 'Ailier D.', rating: 8.9, xG90: 0.45, xA90: 0.58, oddScorer: 2.45, oddAssist: 2.20, confidence: '90%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Ousmane_Dembele_2018.jpg' },
  { name: 'Gonçalo Ramos', team: 'PSG', league: 'FRA-L1', pos: 'Buteur', rating: 8.4, xG90: 0.78, xA90: 0.15, oddScorer: 1.85, oddAssist: 4.50, confidence: '82%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Goncalo_Ramos_2022.jpg/440px-Goncalo_Ramos_2022.jpg' },
  { name: 'Mason Greenwood', team: 'Marseille', league: 'FRA-L1', pos: 'Attaquant', rating: 8.6, xG90: 0.65, xA90: 0.28, oddScorer: 2.25, oddAssist: 3.80, confidence: '86%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Mason_Greenwood.jpg/440px-Mason_Greenwood.jpg' },
  { name: 'Elye Wahi', team: 'Marseille', league: 'FRA-L1', pos: 'Buteur', rating: 8.1, xG90: 0.54, xA90: 0.18, oddScorer: 2.60, oddAssist: 5.00, confidence: '79%', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Elye_Wahi.jpg/440px-Elye_Wahi.jpg' },
];

fs.writeFileSync(PLAYERS_FILE, JSON.stringify(TOP_PLAYERS_5_LEAGUES, null, 2), 'utf8');

// Also update real_players.json per club
const realPlayersMap = {};
TOP_PLAYERS_5_LEAGUES.forEach(p => {
  if (!realPlayersMap[p.team]) realPlayersMap[p.team] = [];
  realPlayersMap[p.team].push({
    name: p.name,
    position: p.pos.charAt(0),
    rating: p.rating,
    mj: 24,
    goals: Math.round(p.xG90 * 18),
    assists: Math.round(p.xA90 * 14),
    photoUrl: p.photoUrl,
  });
});

fs.writeFileSync(REAL_PLAYERS_FILE, JSON.stringify(realPlayersMap, null, 2), 'utf8');

console.log(`✅ ${TOP_PLAYERS_5_LEAGUES.length} superstars des 5 championnats peuplées avec leurs photos officielles.`);
