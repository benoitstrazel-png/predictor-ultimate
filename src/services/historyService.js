/**
 * src/services/historyService.js
 * Service pour charger a la demande les archives et details de match
 */

const memoryCache = new Map();

export async function fetchHistoryMatches(season = '2026-2027', league = 'FRA-L1') {
  const s = (!season || season === 'ALL') ? '2026-2027' : season;
  const l = (!league || league === 'ALL') ? 'ALL' : league;
  const cacheKey = 'hist_' + s + '_' + l;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  const url = l === 'ALL' ? '/data/history/' + s + '_ALL.json' : '/data/history/' + s + '_' + l + '.json';

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (l !== 'ALL') {
        const fallbackRes = await fetch('/data/history/' + s + '_ALL.json');
        if (fallbackRes.ok) {
          const allMatches = await fallbackRes.json();
          const filtered = allMatches.filter(m => m.league === l);
          memoryCache.set(cacheKey, filtered);
          return filtered;
        }
      }
      return [];
    }
    const data = await res.json();
    memoryCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('historyService: Erreur de chargement', err.message);
    return [];
  }
}

export async function fetchMatchDetails(matchId) {
  if (!matchId) return null;
  const cacheKey = 'match_detail_' + matchId;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    const res = await fetch('/data/matches/' + matchId + '.json');
    if (res.ok) {
      const data = await res.json();
      memoryCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn('historyService: Details non disponibles pour ' + matchId);
  }
  return null;
}

export async function fetchTransfers() {
  const cacheKey = 'mercato_transfers';
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }
  try {
    const res = await fetch('/data/mercato/transfers.json');
    if (res.ok) {
      const data = await res.json();
      memoryCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn('historyService: Erreur de chargement des transferts', err.message);
  }
  return [];
}

