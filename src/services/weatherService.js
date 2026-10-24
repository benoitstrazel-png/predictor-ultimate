/**
 * src/services/weatherService.js
 * ─────────────────────────────────────────────────────────────
 * Service Météo Live connecté à l'API Open-Meteo :
 * - Coordonnées GPS certifiées des stades via src/data/stadiums_master.json
 * - Traduction des codes météo WMO en français avec icônes adaptées
 * - Analyse d'impact tactique sur la pelouse et le style de jeu
 * - Cache mémoire réactif + persistance sessionStorage (TTL 30 min)
 */

import STADIA_MASTER from '../data/stadiums_master.json';

export const STADIA_COORDINATES = STADIA_MASTER;

export const WMO_FR_CONDITIONS = {
  0: { label: "Ciel Dégagé", icon: "Sun", impact: "Excellentes conditions de jeu · Terrain sec et rapide" },
  1: { label: "Ensoleillé / Voilé", icon: "SunMedium", impact: "Conditions idéales pour le jeu au sol" },
  2: { label: "Partiellement Nuageux", icon: "CloudSun", impact: "Température équilibrée · Visibilité parfaite" },
  3: { label: "Couvert", icon: "Cloud", impact: "Lumière diffuse · Pas de contrainte thermique" },
  45: { label: "Brouillard", icon: "CloudFog", impact: "Visibilité réduite · Favorise les tirs spontanés" },
  48: { label: "Brouillard Givrant", icon: "CloudFog", impact: "Pelouse très ferme · Rebonds imprévisibles" },
  51: { label: "Bruine Légère", icon: "CloudDrizzle", impact: "Pelouse légèrement humidifiée · Passes plus rapides" },
  53: { label: "Bruine Modérée", icon: "CloudDrizzle", impact: "Surface glissante · Tirs rasants favorisés" },
  55: { label: "Bruine Dense", icon: "CloudRain", impact: "Ballon fusant · Vigilance pour les gardiens" },
  61: { label: "Pluie Faible", icon: "CloudRain", impact: "Pelouse rapide · Accélération des transitions" },
  63: { label: "Pluie Modérée", icon: "CloudRain", impact: "Pelouse grasse et glissante · Tirs de loin privilégiés" },
  65: { label: "Forte Pluie", icon: "CloudLightning", impact: "Risque de flaques · Passes courtes plus difficiles" },
  71: { label: "Neige Légère", icon: "Snowflake", impact: "Température négative · Appuis délicats" },
  73: { label: "Neige Modérée", icon: "Snowflake", impact: "Rebonds amortis · Jeu physique privilégié" },
  75: { label: "Forte Neige", icon: "Snowflake", impact: "Conditions extrêmes" },
  80: { label: "Averses Faibles", icon: "CloudRain", impact: "Alternance sec/humide · Rythme haché" },
  81: { label: "Averses Modérées", icon: "CloudRain", impact: "Pelouse détrempée · Tirs flottants" },
  82: { label: "Averses Violentes", icon: "CloudLightning", impact: "Pelouse très lourde · Importance des duels" },
  95: { label: "Orage", icon: "Zap", impact: "Conditions orageuses · Forte intensité électrique" },
};

// Cache mémoire des requêtes météo pour éviter les appels en boucle
const weatherCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCachedWeather(cacheKey) {
  if (weatherCache.has(cacheKey)) {
    const entry = weatherCache.get(cacheKey);
    if (Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(`weather_${cacheKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          weatherCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch (_) {}
  }
  return null;
}

function setCachedWeather(cacheKey, data) {
  const entry = { data, ts: Date.now() };
  weatherCache.set(cacheKey, entry);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(`weather_${cacheKey}`, JSON.stringify(entry));
    } catch (_) {}
  }
}

/**
 * Résout les coordonnées géographiques du club hôte
 */
export function getTeamStadiumCoords(teamName) {
  if (!teamName) return { lat: 53.4308, lon: -2.9608, city: "Liverpool", stadium: "Anfield", country: "Angleterre" };
  const clean = teamName.trim();
  
  if (STADIA_COORDINATES[clean]) return STADIA_COORDINATES[clean];

  // Recherche insensible à la casse ou partielle
  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(STADIA_COORDINATES)) {
    if (key.toLowerCase() === lower || key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return val;
    }
  }

  // Fallback explicite sans coordonnées GPS masquées
  return { lat: null, lon: null, city: clean, stadium: `Stade de ${clean}`, isUnknown: true };
}

/**
 * Récupère la météo en direct ou prévisionnelle pour un match
 * @param {string} homeTeam Nom du club hôte
 * @param {string} [matchDate] Date du match (YYYY-MM-DD)
 * @returns {Promise<object>}
 */
export async function fetchLiveMatchWeather(homeTeam, matchDate) {
  const stadiumInfo = getTeamStadiumCoords(homeTeam);
  const now = new Date();
  const targetDateStr = matchDate && matchDate.includes('-') 
    ? matchDate.split('T')[0] 
    : now.toISOString().split('T')[0];
  
  // Si le stade est inconnu et sans coordonnées valides, renvoyer une estimation climatique sans tromper sur la localisation
  if (stadiumInfo.isUnknown || stadiumInfo.lat === null || stadiumInfo.lon === null) {
    return {
      isLive: false,
      isUnknownCoords: true,
      city: stadiumInfo.city,
      stadium: stadiumInfo.stadium,
      condition: "Climat Tempéré Estimé",
      conditionKey: "CloudSun",
      pitchImpact: "Conditions de jeu standards estimées · Coordonnées GPS non référencées",
      weatherCode: 2,
      temp_avg_c: 16.0,
      precipitation_mm: 0.0,
      wind_speed_kmh: 12,
      updatedAt: "Estimation"
    };
  }

  const targetDate = new Date(targetDateStr);
  const diffDays = Math.round((targetDate - now) / (1000 * 60 * 60 * 24));
  const cacheKey = `${stadiumInfo.lat}_${stadiumInfo.lon}_${targetDateStr}`;

  const cached = getCachedWeather(cacheKey);
  if (cached) return cached;

  let url;
  if (diffDays < -5) {
    // Match passé : Archive API Open-Meteo
    url = `https://archive-api.open-meteo.com/v1/archive?latitude=${stadiumInfo.lat}&longitude=${stadiumInfo.lon}&start_date=${targetDateStr}&end_date=${targetDateStr}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`;
  } else if (diffDays > 14) {
    // Match trop lointain dans le futur : Climatologie saisonnière estimée sans crash HTTP 400
    const mMonth = targetDate.getMonth(); // 0-11
    const seasonTemp = [11, 0, 1].includes(mMonth) ? 8.0 : (mMonth >= 5 && mMonth <= 8 ? 24.0 : 16.5);
    const projResult = {
      isLive: false,
      city: stadiumInfo.city,
      stadium: stadiumInfo.stadium,
      condition: "Prévision Saisonnière",
      conditionKey: "Sun",
      pitchImpact: "Pelouse optimale · Climat tempéré",
      weatherCode: 0,
      temp_avg_c: seasonTemp,
      precipitation_mm: 0.0,
      wind_speed_kmh: 12,
      updatedAt: `Projection J+${diffDays}`
    };
    setCachedWeather(cacheKey, projResult);
    return projResult;
  } else {
    // Fenêtre active Live / Forecast [-5 jours, +14 jours]
    url = `https://api.open-meteo.com/v1/forecast?latitude=${stadiumInfo.lat}&longitude=${stadiumInfo.lon}&current=temperature_2m,precipitation,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${targetDateStr}&end_date=${targetDateStr}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.reason || 'Open-Meteo API Error');

    const current = data.current || {};
    const daily = data.daily || {};

    const code = current.weathercode !== undefined ? current.weathercode : (daily.weathercode?.[0] ?? 2);
    const condMeta = WMO_FR_CONDITIONS[code] || WMO_FR_CONDITIONS[2];

    const temp = current.temperature_2m !== undefined 
      ? Math.round(current.temperature_2m * 10) / 10 
      : Math.round(((daily.temperature_2m_max?.[0] || 18) + (daily.temperature_2m_min?.[0] || 12)) / 2 * 10) / 10;

    const precip = current.precipitation !== undefined 
      ? Math.round(current.precipitation * 10) / 10 
      : Math.round((daily.precipitation_sum?.[0] || 0) * 10) / 10;

    const wind = current.windspeed_10m !== undefined 
      ? Math.round(current.windspeed_10m) 
      : Math.round(daily.windspeed_10m_max?.[0] || 12);

    const result = {
      isLive: diffDays >= -1 && diffDays <= 1,
      city: stadiumInfo.city,
      stadium: stadiumInfo.stadium,
      condition: condMeta.label,
      conditionKey: condMeta.icon,
      pitchImpact: condMeta.impact,
      weatherCode: code,
      temp_avg_c: temp,
      precipitation_mm: precip,
      wind_speed_kmh: wind,
      updatedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setCachedWeather(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[WeatherService] Fallback actif (${stadiumInfo.city}) :`, err.message);
    const fallbackResult = {
      isLive: false,
      city: stadiumInfo.city,
      stadium: stadiumInfo.stadium,
      condition: "Partiellement Nuageux",
      conditionKey: "CloudSun",
      pitchImpact: "Pelouse standard · Bonnes conditions de jeu",
      weatherCode: 2,
      temp_avg_c: 18.0,
      precipitation_mm: 0.0,
      wind_speed_kmh: 12,
      updatedAt: "Hors-ligne"
    };
    return fallbackResult;
  }
}
