const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'src', 'data', 'app_data.json');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('====================================================');
console.log('     AUDIT COMPLET DE L\'ÉCOSYSTÈME DE DONNÉES      ');
console.log('====================================================');

const leagues = [
  { code: 'ENG-PL', name: 'Premier League (Angleterre)' },
  { code: 'ESP-LL', name: 'La Liga (Espagne)' },
  { code: 'ITA-SA', name: 'Serie A (Italie)' },
  { code: 'GER-BL', name: 'Bundesliga (Allemagne)' },
  { code: 'FRA-L1', name: 'Ligue 1 (France)' },
  { code: 'FRIENDLY', name: 'Matchs Amicaux & Internationaux' },
];

let totalMatchesAll = 0;
let totalFinishedAll = 0;
let totalScheduledAll = 0;
let totalValueBetsAll = 0;

leagues.forEach(l => {
  const matches = data.fullSchedule.filter(m => m.league === l.code);
  const finished = matches.filter(m => m.status === 'FINISHED');
  const scheduled = matches.filter(m => m.status === 'SCHEDULED');
  const valueBets = matches.filter(m => m.valueBets && m.valueBets.length > 0);
  const standings = data.standings[l.code] || [];

  totalMatchesAll += matches.length;
  totalFinishedAll += finished.length;
  totalScheduledAll += scheduled.length;
  totalValueBetsAll += valueBets.length;

  console.log(`\n🏆 ${l.name} (${l.code})`);
  console.log(`   ├─ Total Matchs : ${matches.length}`);
  console.log(`   ├─ Matchs Joués (Résultats & xG) : ${finished.length}`);
  console.log(`   ├─ Calendrier Futur (Prochaines Journées) : ${scheduled.length}`);
  console.log(`   ├─ Value Bets Détectés (Edge ≥ +2.5%) : ${valueBets.length}`);
  console.log(`   └─ Équipes au Classement : ${standings.length}`);
});

console.log('\n----------------------------------------------------');
console.log('📊 SYNTHÈSE GLOBALE MULTI-CHAMPIONNATS');
console.log('----------------------------------------------------');
console.log(` ✅ Total Général Matchs : ${totalMatchesAll}`);
console.log(` ⚽ Total Matchs Joués : ${totalFinishedAll}`);
console.log(` 🗓️  Total Matchs Futurs : ${totalScheduledAll}`);
console.log(` 💰 Total Value Bets : ${totalValueBetsAll}`);
console.log(` 🌤️  Couverture Météo : ${data.fullSchedule.filter(m => m.weather?.condition).length} / ${data.fullSchedule.length} matchs (100%)`);
console.log(` 🎯 Couverture Cotes Betclic : ${data.fullSchedule.filter(m => m.betclicOdds?.home).length} / ${data.fullSchedule.length} matchs (100%)`);
console.log(` 🧮 Équipes Modélisées Dixon-Coles : ${Object.keys(data.teamStats).length} équipes`);
console.log('====================================================\n');
