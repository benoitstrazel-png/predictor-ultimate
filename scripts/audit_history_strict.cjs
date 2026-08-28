const fs = require('fs');
const path = require('path');

const history = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'unified_history.json'), 'utf8'));

console.log('=== AUDIT UNIFIED HISTORY (307 MATCHS) ===');
const leagueCounts = {};
history.forEach(m => {
  leagueCounts[m.league] = (leagueCounts[m.league] || 0) + 1;
});

console.log('Répartition par Ligue dans unified_history.json :');
console.log(leagueCounts);

// Check sample match league assignments vs team name
const misassignments = [];
const LIGUE1_TEAMS = ['PSG', 'Marseille', 'Lyon', 'Monaco', 'Lille', 'Nice', 'Rennes', 'Lens', 'Strasbourg', 'Nantes', 'Montpellier', 'Toulouse', 'Brest', 'Reims', 'Saint-Etienne', 'Angers', 'Le Havre', 'Auxerre', 'Paris FC'];

history.forEach((m, idx) => {
  const isL1Home = LIGUE1_TEAMS.includes(m.homeTeam);
  const isL1Away = LIGUE1_TEAMS.includes(m.awayTeam);
  if ((isL1Home || isL1Away) && m.league !== 'FRA-L1') {
    misassignments.push({ idx, home: m.homeTeam, away: m.awayTeam, assignedLeague: m.league, expected: 'FRA-L1' });
  }
});

console.log(`\nAnomalies de Ligue Détectées dans l'historique : ${misassignments.length}`);
if (misassignments.length > 0) {
  console.log('Exemples d\'erreurs d\'assignation :');
  console.log(misassignments.slice(0, 10));
}
