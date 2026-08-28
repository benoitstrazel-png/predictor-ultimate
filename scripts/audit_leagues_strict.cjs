const fs = require('fs');
const path = require('path');

const appData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'app_data.json'), 'utf8'));

console.log('=== AUDIT STRICT DÉS-ASSIGNATION PAR LEAGUE ===');
const teamsByLeague = {};
appData.fullSchedule.forEach(m => {
  if (!teamsByLeague[m.league]) teamsByLeague[m.league] = new Set();
  teamsByLeague[m.league].add(m.homeTeam);
  teamsByLeague[m.league].add(m.awayTeam);
});

Object.keys(teamsByLeague).forEach(lg => {
  console.log(`\nCompétition ${lg} (${teamsByLeague[lg].size} équipes):`);
  console.log(Array.from(teamsByLeague[lg]).sort().join(', '));
});
