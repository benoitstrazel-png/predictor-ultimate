/**
 * scripts/pipeline/transformers/dateParser.cjs
 * ─────────────────────────────────────────────────────────────
 * Parser temporel universel garantissant :
 * 1. Conversion des dates brutes/relatives en timestamps ISO 8601 UTC stricts
 * 2. Génération d'une chaîne lisible standardisée en fuseau Europe/Paris (CET/CEST)
 * 3. Validation de non-régression contre les 'Invalid Date' (NaN)
 */

'use strict';

/**
 * Normalise toute date d'entrée vers UTC et format d'affichage Paris.
 * @param {string|number|Date} rawDate
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ isoUtc: string, displayParis: string, timestamp: number, isLive: boolean }}
 */
function parseMatchDateToUTC(rawDate, referenceDate = new Date()) {
  if (!rawDate) {
    const iso = referenceDate.toISOString();
    return {
      isoUtc: iso,
      displayParis: 'Date non définie',
      timestamp: referenceDate.getTime(),
      isLive: false
    };
  }

  // Si c'est déjà un timestamp numérique
  if (typeof rawDate === 'number' && !isNaN(rawDate)) {
    const d = new Date(rawDate);
    return {
      isoUtc: d.toISOString(),
      displayParis: formatDateParis(d),
      timestamp: d.getTime(),
      isLive: false
    };
  }

  const str = String(rawDate).trim();
  const currentYear = referenceDate.getFullYear();

  // 1. Détection des statuts 'En Cours'
  if (str.toLowerCase().includes('en cours') || str.includes("MT") || (str.includes("'") && !str.includes('-'))) {
    return {
      isoUtc: referenceDate.toISOString(),
      displayParis: str,
      timestamp: referenceDate.getTime(),
      isLive: true
    };
  }

  // 2. Si c'est déjà un format ISO 8601 complet (ex: 2026-08-22T21:00:00Z)
  if (str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return {
        isoUtc: d.toISOString(),
        displayParis: formatDateParis(d),
        timestamp: d.getTime(),
        isLive: false
      };
    }
  }

  let matchDate = new Date(referenceDate);
  let hours = 20;
  let minutes = 45;

  // Extraction des heures et minutes (ex: "21:00", "17:30")
  const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  }

  // 3. Gestion des formats relatifs bookmaker
  if (str.toLowerCase().includes("aujourd'hui")) {
    // Conserve le jour de référence
  } else if (str.toLowerCase().includes("demain")) {
    matchDate.setDate(matchDate.getDate() + 1);
  } else if (str.match(/(\d{1,2})\/(\d{1,2})/)) {
    // Format "Sam. 22/08 21:00" ou "22/08"
    const dm = str.match(/(\d{1,2})\/(\d{1,2})/);
    const day = parseInt(dm[1], 10);
    const month = parseInt(dm[2], 10) - 1;
    matchDate = new Date(currentYear, month, day);
  } else if (str.match(/^(\d{4})-(\d{2})-(\d{2})/)) {
    // Format "2026-08-22"
    const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    matchDate = new Date(parseInt(parts[1], 10), parseInt(parts[2], 10) - 1, parseInt(parts[3], 10));
  }

  // Construction de l'heure locale en Europe/Paris (CEST = UTC+2 en août / CET = UTC+1 en hiver)
  const isSummerTime = matchDate.getMonth() >= 2 && matchDate.getMonth() <= 9;
  const tzOffsetHours = isSummerTime ? 2 : 1;

  // Création du timestamp UTC strict
  const utcDate = new Date(Date.UTC(
    matchDate.getFullYear(),
    matchDate.getMonth(),
    matchDate.getDate(),
    hours - tzOffsetHours,
    minutes,
    0
  ));

  return {
    isoUtc: utcDate.toISOString(),
    displayParis: formatDateParis(utcDate),
    timestamp: utcDate.getTime(),
    isLive: false
  };
}

function formatDateParis(dateObj) {
  try {
    return dateObj.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace('à ', '');
  } catch (e) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
  }
}

module.exports = { parseMatchDateToUTC, formatDateParis };
