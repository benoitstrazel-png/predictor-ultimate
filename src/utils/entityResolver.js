/**
 * src/utils/entityResolver.js
 * ─────────────────────────────────────────────────────────────
 * Moteur de résolution d'entités canoniques O(1) :
 * - Résolution ultra-robuste des clubs (accents, minuscules/majuscules, préfixes/suffixes, alias historiques, traductions françaises)
 * - Résolution des arbitres officiels
 * - Détection immuable O(1) avec support NFD (accents normalisés)
 */

import TEAMS_MASTER from '../data/teams_master.json';
import REFEREES_MASTER from '../data/referees_master.json';

/**
 * Normalise une chaîne en supprimant les accents, la ponctuation superflue et les espaces.
 * @param {string} str
 * @returns {string}
 */
export function normalizeEntityKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Table de lookup O(1) pour les équipes
const teamLookup = new Map();

function registerTeamKey(key, teamObj) {
  if (!key || typeof key !== 'string') return;
  const rawKey = key.trim().toLowerCase();
  const normKey = normalizeEntityKey(key);
  const compactKey = normKey.replace(/\s+/g, '');
  
  if (rawKey) teamLookup.set(rawKey, teamObj);
  if (normKey) teamLookup.set(normKey, teamObj);
  if (compactKey) teamLookup.set(compactKey, teamObj);
}

// Dictionnaire d'alias spécifiques supplémentaires (traductions françaises, diminutifs et formes courantes)
const MANUAL_TEAM_ALIASES = {
  // Espagne
  'deportivo': 'Deportivo A Coruña',
  'depor': 'Deportivo A Coruña',
  'la corogne': 'Deportivo A Coruña',
  'la coruna': 'Deportivo A Coruña',
  'deportivo la coruna': 'Deportivo A Coruña',
  'deportivo la corogne': 'Deportivo A Coruña',
  'rc deportivo': 'Deportivo A Coruña',
  'rc celta': 'Celta Vigo',
  'celta': 'Celta Vigo',
  'celta de vigo': 'Celta Vigo',
  'alaves': 'Deportivo Alavés',
  'alavés': 'Deportivo Alavés',
  'deportivo alaves': 'Deportivo Alavés',
  'malaga': 'Málaga',
  'betis': 'Real Betis',
  'betis seville': 'Real Betis',
  'betis séville': 'Real Betis',
  'atletico': 'Atlético Madrid',
  'atletico madrid': 'Atlético Madrid',
  'atleti': 'Atlético Madrid',
  'racing': 'Racing Santander',
  'racing santander': 'Racing Santander',
  'la real': 'Real Sociedad',
  'real sociedad': 'Real Sociedad',
  'athletic bilbao': 'Athletic Club',
  'bilbao': 'Athletic Club',
  'fc seville': 'Sevilla',
  'fc séville': 'Sevilla',
  'seville': 'Sevilla',
  
  // France
  'psg': 'Paris Saint-Germain',
  'paris sg': 'Paris Saint-Germain',
  'paris saint germain': 'Paris Saint-Germain',
  'st etienne': 'Saint-Étienne',
  'saint etienne': 'Saint-Étienne',
  'saint-etienne': 'Saint-Étienne',
  'asse': 'Saint-Étienne',
  'ol': 'Lyon',
  'om': 'Marseille',
  'le havre ac': 'Le Havre',
  'hac': 'Le Havre',
  'paris fc': 'Paris FC',
  'pfc': 'Paris FC',
  
  // Italie
  'as rome': 'Roma',
  'rome': 'Roma',
  'roma': 'Roma',
  'come': 'Como',
  'côme': 'Como',
  'venise': 'Venezia',
  'inter milan': 'Inter',
  'ac milan': 'Milan',
  'juve': 'Juventus',
  'inter': 'Inter',
  'milan': 'Milan',
  
  // Angleterre
  'man utd': 'Manchester United',
  'man city': 'Manchester City',
  'wolves': 'Wolverhampton Wanderers',
  'wolverhampton': 'Wolverhampton Wanderers',
  'coventry': 'Coventry City',
  
  // Allemagne
  'fc cologne': '1. FC Köln',
  'cologne': '1. FC Köln',
  '1 fc koln': '1. FC Köln',
  'tsg hoffenheim': 'Hoffenheim',
  'sv elversberg': 'Elversberg',
  'gladbach': 'Borussia Mönchengladbach',
  'monchengladbach': 'Borussia Mönchengladbach',
  'mönchengladbach': 'Borussia Mönchengladbach',
  'leipzig': 'RB Leipzig',
  'leverkusen': 'Bayer Leverkusen',
  'dortmund': 'Borussia Dortmund',
  'bayern': 'Bayern München',
  'bayern munich': 'Bayern München',
  'eintracht francfort': 'Eintracht Frankfurt',
  'hambourg': 'Hamburger SV',
  'hambourg sv': 'Hamburger SV',
  'mayence': 'Mainz 05',
  'fsv mayence': 'Mainz 05',
  
  // Portugal, Danemark, Turquie, Grèce
  'porto': 'FC Porto',
  'sporting': 'Sporting CP',
  'sporting lisbonne': 'Sporting CP',
  'sporting portugal': 'Sporting CP',
  'benfica': 'Benfica',
  'benfica lisbonne': 'Benfica',
  'copenhague': 'FC København',
  'panathinaikos': 'Panathinaikos',
  'galatasaray': 'Galatasaray',
  'fenerbahce': 'Fenerbahçe'
};

TEAMS_MASTER.teams.forEach(team => {
  registerTeamKey(team.team_id, team);
  registerTeamKey(team.canonical_name, team);
  registerTeamKey(team.short_name, team);
  if (team.slug) registerTeamKey(team.slug, team);
  
  if (team.aliases && Array.isArray(team.aliases)) {
    team.aliases.forEach(alias => {
      registerTeamKey(alias, team);
    });
  }
});

// Enregistrement des alias manuels
Object.entries(MANUAL_TEAM_ALIASES).forEach(([alias, target]) => {
  const normTarget = normalizeEntityKey(target);
  const teamObj = TEAMS_MASTER.teams.find(t => 
    normalizeEntityKey(t.canonical_name) === normTarget ||
    normalizeEntityKey(t.short_name) === normTarget ||
    t.team_id === target ||
    t.slug === target
  );
  if (teamObj) {
    registerTeamKey(alias, teamObj);
  }
});

// Table de lookup O(1) pour les arbitres
const refereeLookup = new Map();

REFEREES_MASTER.referees.forEach(ref => {
  const rawId = ref.referee_id.toLowerCase();
  const rawName = ref.full_name.toLowerCase();
  const normName = normalizeEntityKey(ref.full_name);
  
  refereeLookup.set(rawId, ref);
  refereeLookup.set(rawName, ref);
  refereeLookup.set(normName, ref);
  
  if (ref.aliases && Array.isArray(ref.aliases)) {
    ref.aliases.forEach(alias => {
      refereeLookup.set(alias.trim().toLowerCase(), ref);
      refereeLookup.set(normalizeEntityKey(alias), ref);
    });
  }
});

/**
 * Résout une équipe à partir de son nom brut ou alias avec support complet des accents et variantes.
 * @param {string} inputName
 * @returns {object|null}
 */
export function resolveTeam(inputName) {
  if (!inputName || typeof inputName !== 'string') return null;
  
  const raw = inputName.trim().toLowerCase();
  if (teamLookup.has(raw)) return teamLookup.get(raw);
  
  const norm = normalizeEntityKey(inputName);
  if (teamLookup.has(norm)) return teamLookup.get(norm);
  
  const compact = norm.replace(/\s+/g, '');
  if (teamLookup.has(compact)) return teamLookup.get(compact);
  
  return null;
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
  
  const raw = inputRef.trim().toLowerCase();
  if (refereeLookup.has(raw)) return refereeLookup.get(raw);
  
  const norm = normalizeEntityKey(inputRef);
  if (refereeLookup.has(norm)) return refereeLookup.get(norm);
  
  return null;
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
  normalizeEntityKey,
};
