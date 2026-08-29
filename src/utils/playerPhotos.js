/**
 * src/utils/playerPhotos.js
 * ─────────────────────────────────────────────────────────────
 * Registre et Résolveur Ultra-Robuste de Photos Joueurs :
 * 1. Priorité aux photos certifiées du Squad Transfermarkt (squads/*.json)
 * 2. Lookup dans le Master Registry (players_master_registry.json)
 * 3. Dictionnaire plat / aliases player_photos.json
 * 4. Fallback vers avatar de rôle local ou initiales vectorielles
 */

import playerPhotosData from '../data/player_photos.json';
import PLAYERS_REGISTRY from '../data/compiled/players_master_registry.json';
import { getClubSquad } from '../data/squads_index';
import { resolveTeam, normalizeEntityKey } from './entityResolver';

const normalize = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const isValidPhoto = (url) => {
  if (!url || typeof url !== 'string') return false;
  // Accepter les chemins locaux webp/png ainsi que les URLs valides
  return url.length > 3 && !url.includes('images.fotmob.com') && !url.includes('api-sports.io');
};

/**
 * Retourne l'URL de la photo du joueur avec recherche multi-niveaux.
 * @param {string} clubName
 * @param {string} playerName
 * @param {object} [playerObj]
 * @returns {string}
 */
export const getPlayerPhoto = (clubName, playerName, playerObj = null) => {
  // 0. Si l'objet joueur a déjà une photo valide
  if (playerObj) {
    if (isValidPhoto(playerObj.photo)) return playerObj.photo;
    if (isValidPhoto(playerObj.photoUrl)) return playerObj.photoUrl;
  }

  if (!playerName || typeof playerName !== 'string') {
    return '/assets/players/defaults/m_default.webp';
  }

  const normTarget = normalize(playerName);
  const nameTokens = playerName.toLowerCase().split(' ').filter(t => t.length > 2);

  // 1. Chercher dans le squad du club (Transfermarkt local certifié)
  if (clubName) {
    try {
      const squad = getClubSquad(clubName);
      if (squad && squad.players && squad.players.length > 0) {
        // Match exact ou normalisé
        const directPlayer = squad.players.find(p => normalize(p.name) === normTarget);
        if (directPlayer && isValidPhoto(directPlayer.photo)) {
          return directPlayer.photo;
        }

        // Match par jetons (Nom de famille / Prénom)
        if (nameTokens.length > 0) {
          const fuzzyPlayer = squad.players.find(p => {
            const pNorm = normalize(p.name);
            return nameTokens.every(t => pNorm.includes(normalize(t)));
          }) || squad.players.find(p => {
            const pNorm = normalize(p.name);
            return nameTokens.some(t => pNorm.includes(normalize(t)));
          });

          if (fuzzyPlayer && isValidPhoto(fuzzyPlayer.photo)) {
            return fuzzyPlayer.photo;
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 2. Chercher dans le Master Registry
  if (PLAYERS_REGISTRY) {
    for (const p of Object.values(PLAYERS_REGISTRY)) {
      if (
        normalize(p.name) === normTarget ||
        normalize(p.displayName) === normTarget ||
        normalize(p.shortName) === normTarget
      ) {
        if (isValidPhoto(p.photoUrl)) return p.photoUrl;
      }
    }

    if (nameTokens.length > 0) {
      for (const p of Object.values(PLAYERS_REGISTRY)) {
        const pNorm = normalize(p.name);
        if (nameTokens.every(t => pNorm.includes(normalize(t)))) {
          if (isValidPhoto(p.photoUrl)) return p.photoUrl;
        }
      }
    }
  }

  // 3. Chercher dans player_photos.json
  if (isValidPhoto(playerPhotosData[playerName])) {
    return playerPhotosData[playerName];
  }

  const matchedKey = Object.keys(playerPhotosData).find(k => normalize(k) === normTarget);
  if (matchedKey && isValidPhoto(playerPhotosData[matchedKey])) {
    return playerPhotosData[matchedKey];
  }

  // 4. Match au sein de playerPhotosData pour le club
  const resolved = resolveTeam(clubName);
  const targetClubKey = resolved?.canonical_name || clubName;
  const clubEntry = playerPhotosData[targetClubKey] || playerPhotosData[clubName];
  if (Array.isArray(clubEntry)) {
    const exact = clubEntry.find(p => normalize(p.name) === normTarget);
    if (exact && isValidPhoto(exact.photo)) return exact.photo;
  }

  // 5. Fallback par défaut selon rôle si disponible ou initials avatar
  const role = playerObj?.role || playerObj?.position || 'M';
  const roleCode = String(role).charAt(0).toLowerCase();
  const roleDefault = `/assets/players/defaults/${roleCode === 'g' ? 'g' : roleCode === 'd' ? 'd' : roleCode === 'a' ? 'a' : 'm'}_default.webp`;

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=0D1220&color=C9A96E&bold=true`;
};

export default getPlayerPhoto;
