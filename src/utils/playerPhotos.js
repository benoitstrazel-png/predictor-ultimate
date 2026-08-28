/**
 * src/utils/playerPhotos.js
 * ─────────────────────────────────────────────────────────────
 * Registre et Résolveur de Photos Joueurs avec Fallback Déterministe
 */

import playerPhotosData from '../data/player_photos.json';
import { resolveTeam } from './entityResolver';

const normalize = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Retourne l'URL de la photo du joueur ou un avatar déterministe.
 * @param {string} clubName
 * @param {string} playerName
 * @returns {string}
 */
export const getPlayerPhoto = (clubName, playerName) => {
  if (!playerName || typeof playerName !== 'string') {
    return 'https://ui-avatars.com/api/?name=Player&background=0D1220&color=C9A96E&bold=true';
  }

  const normTarget = normalize(playerName);

  // 1. Direct key match in flat dictionary
  if (playerPhotosData[playerName]) {
    return playerPhotosData[playerName];
  }

  // 2. Direct normalized key match in flat dictionary
  const matchedKey = Object.keys(playerPhotosData).find(k => normalize(k) === normTarget);
  if (matchedKey && typeof playerPhotosData[matchedKey] === 'string') {
    return playerPhotosData[matchedKey];
  }

  // 3. Match within club list if nested structure
  const resolved = resolveTeam(clubName);
  const targetClubKey = resolved?.canonical_name || clubName;
  const clubEntry = playerPhotosData[targetClubKey] || playerPhotosData[clubName];
  if (Array.isArray(clubEntry)) {
    const exact = clubEntry.find(p => normalize(p.name) === normTarget);
    if (exact?.photo) return exact.photo;
  }

  // 4. Token-based fuzzy match across flat dictionary
  const tokens = playerName.split(' ').filter(t => t.length > 2);
  if (tokens.length > 0) {
    const fuzzyKey = Object.keys(playerPhotosData).find(k => {
      const kNorm = normalize(k);
      return tokens.every(t => kNorm.includes(normalize(t)));
    });
    if (fuzzyKey && typeof playerPhotosData[fuzzyKey] === 'string') {
      return playerPhotosData[fuzzyKey];
    }
  }

  // 5. Fallback vector avatar with player initials
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=0D1220&color=C9A96E&bold=true`;
};

export default getPlayerPhoto;
