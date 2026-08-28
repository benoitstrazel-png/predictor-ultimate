/**
 * src/utils/entityResolver.js
 * ─────────────────────────────────────────────────────────────
 * Moteur de résolution d'entités canoniques O(1) :
 * - Résolution des clubs (noms, alias, IDs)
 * - Résolution des arbitres officiels
 * - Suppression des fuzzy matchings fragiles (.includes())
 */

import TEAMS_MASTER from '../data/teams_master.json';
import REFEREES_MASTER from '../data/referees_master.json';

// Table de lookup O(1) pour les équipes
const teamLookup = new Map();

TEAMS_MASTER.teams.forEach(team => {
  teamLookup.set(team.team_id.toLowerCase(), team);
  teamLookup.set(team.canonical_name.toLowerCase(), team);
  teamLookup.set(team.short_name.toLowerCase(), team);
  
  if (team.aliases && Array.isArray(team.aliases)) {
    team.aliases.forEach(alias => {
      teamLookup.set(alias.trim().toLowerCase(), team);
    });
  }
});

// Table de lookup O(1) pour les arbitres
const refereeLookup = new Map();

REFEREES_MASTER.referees.forEach(ref => {
  refereeLookup.set(ref.referee_id.toLowerCase(), ref);
  refereeLookup.set(ref.full_name.toLowerCase(), ref);
  
  if (ref.aliases && Array.isArray(ref.aliases)) {
    ref.aliases.forEach(alias => {
      refereeLookup.set(alias.trim().toLowerCase(), ref);
    });
  }
});

/**
 * Résout une équipe à partir de son nom brut ou alias.
 * @param {string} inputName
 * @returns {object|null}
 */
export function resolveTeam(inputName) {
  if (!inputName || typeof inputName !== 'string') return null;
  const clean = inputName.trim().toLowerCase();
  return teamLookup.get(clean) || null;
}

/**
 * Résout un arbitre officiel à partir de son nom ou alias.
 * @param {string|object} inputRef
 * @returns {object|null}
 */
export function resolveReferee(inputRef) {
  if (!inputRef) return null;
  if (typeof inputRef === 'object' && inputRef.name) {
    inputRef = inputRef.name;
  }
  if (typeof inputRef !== 'string') return null;
  const clean = inputRef.trim().toLowerCase();
  return refereeLookup.get(clean) || null;
}

/**
 * Génère un identifiant de match déterministe et immuable.
 */
export function generateMatchId(league, season, round, homeTeam, awayTeam) {
  const h = resolveTeam(homeTeam)?.team_id || homeTeam.replace(/\s+/g, '_').toUpperCase();
  const a = resolveTeam(awayTeam)?.team_id || awayTeam.replace(/\s+/g, '_').toUpperCase();
  const s = season ? String(season).replace('/', '-') : '2025-2026';
  const r = String(round || '1').padStart(2, '0');
  return `${league}_${s}_W${r}_${h}_${a}`;
}

export default {
  resolveTeam,
  resolveReferee,
  generateMatchId,
};
