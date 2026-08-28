#!/usr/bin/env node
/**
 * audit_complete_ecosystem.cjs
 * ─────────────────────────────────────────────────────────────
 * Agent QA - Contrôle d'Intégrité & d'Harmonie à Grande Échelle.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const APP_DATA_FILE = path.join(ROOT, 'src', 'data', 'app_data.json');
const UNIFIED_HIST_FILE = path.join(ROOT, 'src', 'data', 'unified_history.json');
const PLAYERS_FILE = path.join(ROOT, 'src', 'data', 'players.json');
const REAL_PLAYERS_FILE = path.join(ROOT, 'src', 'data', 'real_players.json');

const errors = [];
const warnings = [];
const metrics = {};

console.log('🤖 Agent QA Data Quality — Audit d\'Intégrité Global en Cours...');

if (fs.existsSync(APP_DATA_FILE)) {
  const appData = JSON.parse(fs.readFileSync(APP_DATA_FILE, 'utf8'));
  const matches = appData.fullSchedule || [];
  metrics.totalMatches = matches.length;

  matches.forEach((m, idx) => {
    if (!m.id) errors.push({ category: 'MATCH_ID', message: `Match #${idx} sans ID` });
    if (!m.homeTeam || !m.awayTeam) errors.push({ category: 'MATCH_TEAMS', message: `Match ID ${m.id} sans équipe` });
  });

  metrics.scheduledMatches = matches.filter(m => m.status === 'SCHEDULED').length;
  metrics.finishedMatches = matches.filter(m => m.status === 'FINISHED').length;
}

if (fs.existsSync(UNIFIED_HIST_FILE)) {
  const history = JSON.parse(fs.readFileSync(UNIFIED_HIST_FILE, 'utf8'));
  metrics.totalHistoryMatches = history.length;
}

if (fs.existsSync(PLAYERS_FILE)) {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  metrics.totalPlayers = players.length;
}

if (fs.existsSync(REAL_PLAYERS_FILE)) {
  const realPlayers = JSON.parse(fs.readFileSync(REAL_PLAYERS_FILE, 'utf8'));
  metrics.totalTeamsWithRoster = Object.keys(realPlayers).length;
}

const healthScore = Math.max(0, 100 - (errors.length * 15) - (warnings.length * 2));
const report = {
  timestamp: new Date().toISOString(),
  healthScore,
  status: errors.length === 0 ? 'EXCELLENT' : 'CRITICAL_ERRORS',
  metrics,
  errorsCount: errors.length,
  warningsCount: warnings.length,
  errors,
  warnings,
};

console.log(`\n====================================================`);
console.log(`📊 RAPPORT DE QUALITÉ DES DONNÉES - SCORE : ${healthScore}/100`);
console.log(`====================================================`);
console.log(` Status : ${report.status}`);
console.log(` Erreurs critiques : ${errors.length}`);
console.log(` Avertissements : ${warnings.length}`);
console.log(` Matchs Totaux : ${metrics.totalMatches}`);
console.log(` Matchs Historique : ${metrics.totalHistoryMatches}`);
console.log(` Joueurs Modélisés : ${metrics.totalPlayers}`);
console.log(` Clubs avec Roster : ${metrics.totalTeamsWithRoster}`);
console.log(`====================================================\n`);

fs.writeFileSync(path.join(ROOT, 'data_quality_report.json'), JSON.stringify(report, null, 2), 'utf8');
