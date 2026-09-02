/**
 * src/utils/playerPhotos.js
 * ─────────────────────────────────────────────────────────────
 * Registre et Résolveur Ultra-Robuste de Photos Joueurs :
 * 1. Priorité aux photos certifiées du Squad Transfermarkt (squads/*.json)
 * 2. Lookup direct et intelligent dans player_photos.json
 * 3. Lookup dans le Master Registry (players_master_registry.json)
 * 4. Fallback vers avatar de rôle local ou initiales vectorielles
 */

import playerPhotosData from '../data/player_photos.json';
import PLAYERS_REGISTRY from '../data/compiled/players_master_registry.json';
import { getClubSquad } from '../data/squads_index';
import { resolveTeam } from './entityResolver';

export const normalize = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const areNamesMatching = (name1, name2) => {
  if (!name1 || !name2) return false;
  const s1 = normalize(name1);
  const s2 = normalize(name2);
  if (s1 === s2) return true;

  const parts1 = s1.split(' ').filter(x => x.length > 0);
  const parts2 = s2.split(' ').filter(x => x.length > 0);
  if (parts1.length === 0 || parts2.length === 0) return false;

  const last1 = parts1[parts1.length - 1];
  const last2 = parts2[parts2.length - 1];
  const first1 = parts1[0];
  const first2 = parts2[0];

  // Correspondance par nom de famille si initiales concordent
  if (last1 === last2) {
    if (parts1.length === 1 || parts2.length === 1 || first1[0] === first2[0]) {
      return true;
    }
  }

  // Inversion Prénom / Nom
  if (first1 === last2 && (parts1.length === 1 || parts2.length === 1 || last1[0] === first2[0])) {
    return true;
  }
  if (last1 === first2 && (parts1.length === 1 || parts2.length === 1 || first1[0] === last2[0])) {
    return true;
  }

  // Sous-chaîne significative
  if (s1.length > 5 && s2.length > 5) {
    if (s1.includes(s2) || s2.includes(s1)) return true;
  }

  return false;
};

export const isValidPhoto = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('/defaults/')) return false;
  if (url.includes('images.fotmob.com')) return false;
  return url.length > 4;
};

/**
 * Retourne l'URL de la photo du joueur avec recherche multi-niveaux.
 * @param {string} clubName
 * @param {string} playerName
 * @param {object} [playerObj]
 * @returns {string}
 */
export const getPlayerPhoto = (clubName, playerName, playerObj = null) => {
  // 0. Si l'objet joueur a déjà une photo valide non-default
  if (playerObj) {
    if (isValidPhoto(playerObj.photo)) return playerObj.photo;
    if (isValidPhoto(playerObj.photoUrl)) return playerObj.photoUrl;
  }

  if (!playerName || typeof playerName !== 'string') {
    return '/assets/players/defaults/m_default.webp';
  }

  const cleanName = playerName.replace(/\(.*\)/g, '').trim();

  // 1. Chercher dans le squad du club (Transfermarkt local certifié)
  if (clubName) {
    try {
      const squad = getClubSquad(clubName);
      if (squad && squad.players && squad.players.length > 0) {
        const match = squad.players.find(p => areNamesMatching(p.name, cleanName));
        if (match && isValidPhoto(match.photo)) {
          return match.photo;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 2. Chercher dans player_photos.json (Dictionnaire plat)
  if (isValidPhoto(playerPhotosData[cleanName])) {
    return playerPhotosData[cleanName];
  }
  for (const [key, photoPath] of Object.entries(playerPhotosData)) {
    if (isValidPhoto(photoPath) && areNamesMatching(key, cleanName)) {
      return photoPath;
    }
  }

  // 3. Chercher dans le Master Registry
  if (PLAYERS_REGISTRY) {
    for (const p of Object.values(PLAYERS_REGISTRY)) {
      if (
        areNamesMatching(p.name, cleanName) ||
        areNamesMatching(p.displayName, cleanName) ||
        areNamesMatching(p.shortName, cleanName)
      ) {
        if (isValidPhoto(p.photoUrl)) return p.photoUrl;
      }
    }
  }

  // 4. Match au sein de playerPhotosData pour le club (si tableau d'objets)
  if (clubName) {
    const resolved = resolveTeam(clubName);
    const targetClubKey = resolved?.canonical_name || clubName;
    const clubEntry = playerPhotosData[targetClubKey] || playerPhotosData[clubName];
    if (Array.isArray(clubEntry)) {
      const exact = clubEntry.find(p => areNamesMatching(p.name, cleanName));
      if (exact && isValidPhoto(exact.photo)) return exact.photo;
    }
  }

  // 5. Fallback par défaut selon rôle si disponible
  const role = playerObj?.role_category || playerObj?.role || playerObj?.position || 'M';
  const roleCode = String(role).charAt(0).toLowerCase();
  const safeRole = ['g', 'd', 'm', 'a'].includes(roleCode) ? roleCode : 'm';
  return `/assets/players/defaults/${safeRole}_default.webp`;
};

export default getPlayerPhoto;
