/**
 * src/utils/logos.js
 * ─────────────────────────────────────────────────────────────
 * Registre Officiel des Logos Haute Définition Locaux & Hybrides (SVG & WebP 512x512)
 * 100% Autonome, Zéro Erreur CORS, Résolution O(1) Instantanée.
 */

import { resolveTeam, normalizeEntityKey } from './entityResolver';

/**
 * Retourne l'URL du logo officiel résolu en priorité locale (/assets/teams/...).
 * @param {string} teamName
 * @returns {string}
 */
export const getTeamLogo = (teamName) => {
  if (!teamName || typeof teamName !== 'string') return '';
  const cleanName = teamName.trim();

  // 1. Résolution via le dictionnaire canonique TEAMS_MASTER
  const resolved = resolveTeam(cleanName);
  if (resolved?.local_logo) {
    return resolved.local_logo;
  }
  if (resolved?.team_id) {
    const fileId = resolved.team_id.toLowerCase();
    return `/assets/teams/${fileId}.webp`;
  }
  if (resolved?.slug) {
    return `/assets/teams/${resolved.slug}.webp`;
  }
  if (resolved?.logo) {
    return resolved.logo;
  }

  // 2. Fallback déterministe slug
  const slug = normalizeEntityKey(cleanName).replace(/\s+/g, '_');
  return `/assets/teams/${slug}.webp`;
};

/**
 * Retourne les métadonnées de style (couleurs officielles) du club.
 * @param {string} teamName
 * @returns {{ primary: string, secondary: string }}
 */
export const getTeamColors = (teamName) => {
  if (!teamName || typeof teamName !== 'string') {
    return { primary: '#002F6C', secondary: '#EAB308' };
  }
  const resolved = resolveTeam(teamName.trim());
  return {
    primary: resolved?.primary_color || '#002F6C',
    secondary: resolved?.secondary_color || '#FFFFFF'
  };
};

export default getTeamLogo;
