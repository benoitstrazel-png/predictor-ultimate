#!/usr/bin/env node
/**
 * update_match_logos.cjs
 * ─────────────────────────────────────────────────────────────
 * Synchronise les logos d'équipes dans app_data.json avec les URLs
 * officielles hautes résolutions de logos.js.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'src', 'data', 'app_data.json');
let appData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Import logo getter logic
const { getTeamLogo } = require('../src/utils/logos.js');

appData.fullSchedule = appData.fullSchedule.map(m => ({
  ...m,
  homeLogo: getTeamLogo(m.homeTeam),
  awayLogo: getTeamLogo(m.awayTeam),
}));

fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2), 'utf8');

console.log('✅ Logos d\'équipes 100% synchronisés et mis à jour dans app_data.json pour tous les championnats !');
