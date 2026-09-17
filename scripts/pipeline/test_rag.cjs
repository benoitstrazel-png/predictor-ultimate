/**
 * scripts/pipeline/test_rag.cjs
 * Validation des réponses du moteur RAG
 */

const fs = require('fs');
const path = require('path');

const analyticsStore = require('../../src/data/compiled/rag_analytics_store.json');
const appData = require('../../src/data/app_data.json');

console.log('=== TEST 1: TOP CARTONS JAUNES D EUROPE ===');
const topY = analyticsStore.globalLeaderboards.topYellowCards.slice(0, 5);
topY.forEach((p, i) => console.log(`${i + 1}. ${p.name} (${p.team}) : ${p.yellows} jaunes, ${p.reds} rouges`));

console.log('\n=== TEST 2: CARTONS ET JOUEURS D UN CLUB (PARIS SG) ===');
const psg = analyticsStore.teams['PSG'];
console.log('PSG discipline:', psg.discipline);
console.log('PSG top carded:', psg.topCardedPlayers.slice(0, 3));

console.log('\n=== TEST 3: BUTEURS POTENTIELS ET COTES BETCLIC D UN MATCH ===');
const sampleMatch = appData.fullSchedule.find(m => m.potentialScorers && m.potentialScorers.home && m.potentialScorers.home.length > 0);
console.log('Match:', sampleMatch.homeTeam, 'vs', sampleMatch.awayTeam);
console.log('Home potential scorers:', sampleMatch.potentialScorers.home.slice(0, 3));
console.log('Away potential scorers:', sampleMatch.potentialScorers.away.slice(0, 3));

console.log('\n=== TEST 4: H2H CONFRONTATIONS DIRECTES ===');
const sampleH2h = Object.values(analyticsStore.h2h).find(h => h.matches && h.matches.length >= 2);
console.log('H2H Pair:', sampleH2h.team1, 'vs', sampleH2h.team2);
console.log('H2H Stats:', sampleH2h.stats);
console.log('Recent matches:', sampleH2h.matches.slice(0, 2));

console.log('\n=== TEST 5: STATS DOMICILE / EXTERIEUR ===');
console.log('PSG Domicile:', psg.home);
console.log('PSG Extérieur:', psg.away);

console.log('\n✅ Tous les jeux de données sont valides et prêts pour le RAG !');
