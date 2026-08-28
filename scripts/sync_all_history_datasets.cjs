#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const unifiedPath = path.join(__dirname, '..', 'src', 'data', 'unified_history.json');
const detailedPath = path.join(__dirname, '..', 'src', 'data', 'matches_history_detailed.json');
const legacyPath = path.join(__dirname, '..', 'src', 'data', 'matches_legacy.json');

const unified = JSON.parse(fs.readFileSync(unifiedPath, 'utf8'));
console.log('Read unified matches:', unified.length);

// Generate detailed format
const detailedList = unified.map((m, idx) => {
  const [hg, ag] = (m.score || '0-0').split('-').map(Number);
  const events = [];

  (m.goals || []).forEach(g => {
    events.push({
      time: g.time ? `${g.time}'` : "45'",
      type: 'Goal',
      team: g.team || m.homeTeam,
      player: g.player,
      detail: g.detail || ''
    });
  });

  return {
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    score: m.score,
    homeScore: hg,
    awayScore: ag,
    referee: m.referee || 'François Letexier (FRA)',
    league: m.league,
    season: m.season,
    round: m.round,
    date: m.date,
    events: events,
    url: 'https://www.flashscore.fr/match/' + (m.id || idx) + '/#/resume'
  };
});

fs.writeFileSync(detailedPath, JSON.stringify(detailedList, null, 2), 'utf8');
console.log('Wrote matches_history_detailed.json with', detailedList.length, 'matches');

// Generate legacy format for backwards compatibility
const legacyList = unified.map(m => {
  const [hg, ag] = (m.score || '0-0').split('-').map(Number);
  let res = 'D';
  if (hg > ag) res = 'H';
  else if (ag > hg) res = 'A';

  return {
    division: m.league,
    league: m.league,
    season: m.season,
    round: m.round,
    date: m.date,
    home_team: m.homeTeam,
    away_team: m.awayTeam,
    full_time_home_goals: hg,
    full_time_away_goals: ag,
    full_time_result: res,
    score: m.score,
    goals: m.goals || []
  };
});

fs.writeFileSync(legacyPath, JSON.stringify(legacyList, null, 2), 'utf8');
console.log('Wrote matches_legacy.json with', legacyList.length, 'matches');
