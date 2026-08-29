/**
 * src/services/weatherService.js
 * ─────────────────────────────────────────────────────────────
 * Service Météo Live connecté à l'API Open-Meteo :
 * - Coordonnées GPS certifiées des stades des 5 grands championnats européens
 * - Traduction des codes météo WMO en français avec icônes adaptées
 * - Analyse d'impact tactique sur la pelouse et le style de jeu
 * - Cache mémoire réactif pour éviter les requêtes redondantes
 */

export const STADIA_COORDINATES = {
  // ── Ligue 1 (France) ──
  "PSG": { lat: 48.8414, lon: 2.2530, city: "Paris", stadium: "Parc des Princes" },
  "Paris Saint-Germain": { lat: 48.8414, lon: 2.2530, city: "Paris", stadium: "Parc des Princes" },
  "Marseille": { lat: 43.2698, lon: 5.3959, city: "Marseille", stadium: "Orange Vélodrome" },
  "Olympique de Marseille": { lat: 43.2698, lon: 5.3959, city: "Marseille", stadium: "Orange Vélodrome" },
  "Lyon": { lat: 45.7653, lon: 4.9820, city: "Décines-Charpieu", stadium: "Groupama Stadium" },
  "Olympique Lyonnais": { lat: 45.7653, lon: 4.9820, city: "Décines-Charpieu", stadium: "Groupama Stadium" },
  "Monaco": { lat: 43.7276, lon: 7.4156, city: "Monaco", stadium: "Stade Louis II" },
  "AS Monaco": { lat: 43.7276, lon: 7.4156, city: "Monaco", stadium: "Stade Louis II" },
  "Lille": { lat: 50.6119, lon: 3.1305, city: "Villeneuve-d'Ascq", stadium: "Decathlon Arena" },
  "LOSC Lille": { lat: 50.6119, lon: 3.1305, city: "Villeneuve-d'Ascq", stadium: "Decathlon Arena" },
  "Nice": { lat: 43.6702, lon: 7.1925, city: "Nice", stadium: "Allianz Riviera" },
  "OGC Nice": { lat: 43.6702, lon: 7.1925, city: "Nice", stadium: "Allianz Riviera" },
  "Rennes": { lat: 48.1075, lon: -1.7029, city: "Rennes", stadium: "Roazhon Park" },
  "Stade Rennais": { lat: 48.1075, lon: -1.7029, city: "Rennes", stadium: "Roazhon Park" },
  "Lens": { lat: 50.4328, lon: 2.8149, city: "Lens", stadium: "Stade Bollaert-Delelis" },
  "RC Lens": { lat: 50.4328, lon: 2.8149, city: "Lens", stadium: "Stade Bollaert-Delelis" },
  "Strasbourg": { lat: 48.5599, lon: 7.7543, city: "Strasbourg", stadium: "Stade de la Meinau" },
  "RC Strasbourg": { lat: 48.5599, lon: 7.7543, city: "Strasbourg", stadium: "Stade de la Meinau" },
  "Nantes": { lat: 47.2560, lon: -1.5247, city: "Nantes", stadium: "Stade de la Beaujoire" },
  "FC Nantes": { lat: 47.2560, lon: -1.5247, city: "Nantes", stadium: "Stade de la Beaujoire" },
  "Montpellier": { lat: 43.6225, lon: 3.8122, city: "Montpellier", stadium: "Stade de la Mosson" },
  "Montpellier HSC": { lat: 43.6225, lon: 3.8122, city: "Montpellier", stadium: "Stade de la Mosson" },
  "Toulouse": { lat: 43.5831, lon: 1.4341, city: "Toulouse", stadium: "Stadium de Toulouse" },
  "Toulouse FC": { lat: 43.5831, lon: 1.4341, city: "Toulouse", stadium: "Stadium de Toulouse" },
  "Brest": { lat: 48.4036, lon: -4.4608, city: "Brest", stadium: "Stade Francis-Le Blé" },
  "Stade Brestois 29": { lat: 48.4036, lon: -4.4608, city: "Brest", stadium: "Stade Francis-Le Blé" },
  "Reims": { lat: 49.2467, lon: 4.0253, city: "Reims", stadium: "Stade Auguste-Delaune" },
  "Stade de Reims": { lat: 49.2467, lon: 4.0253, city: "Reims", stadium: "Stade Auguste-Delaune" },
  "Saint-Etienne": { lat: 45.4608, lon: 4.3902, city: "Saint-Étienne", stadium: "Stade Geoffroy-Guichard" },
  "AS Saint-Étienne": { lat: 45.4608, lon: 4.3902, city: "Saint-Étienne", stadium: "Stade Geoffroy-Guichard" },
  "Angers": { lat: 47.4600, lon: -0.5306, city: "Angers", stadium: "Stade Raymond Kopa" },
  "Angers SCO": { lat: 47.4600, lon: -0.5306, city: "Angers", stadium: "Stade Raymond Kopa" },
  "Le Havre": { lat: 49.4986, lon: 0.1697, city: "Le Havre", stadium: "Stade Océane" },
  "Le Havre AC": { lat: 49.4986, lon: 0.1697, city: "Le Havre", stadium: "Stade Océane" },
  "Auxerre": { lat: 47.7867, lon: 3.5886, city: "Auxerre", stadium: "Stade de l'Abbé-Deschamps" },
  "AJ Auxerre": { lat: 47.7867, lon: 3.5886, city: "Auxerre", stadium: "Stade de l'Abbé-Deschamps" },

  // ── Premier League (England) ──
  "Liverpool": { lat: 53.4308, lon: -2.9608, city: "Liverpool", stadium: "Anfield" },
  "Nottingham Forest": { lat: 52.9400, lon: -1.1328, city: "Nottingham", stadium: "City Ground" },
  "Manchester City": { lat: 53.4831, lon: -2.2004, city: "Manchester", stadium: "Etihad Stadium" },
  "Arsenal": { lat: 51.5549, lon: -0.1084, city: "Londres", stadium: "Emirates Stadium" },
  "Chelsea": { lat: 51.4817, lon: -0.1910, city: "Londres", stadium: "Stamford Bridge" },
  "Manchester United": { lat: 53.4631, lon: -2.2913, city: "Manchester", stadium: "Old Trafford" },
  "Tottenham": { lat: 51.6043, lon: -0.0664, city: "Londres", stadium: "Tottenham Hotspur Stadium" },
  "Tottenham Hotspur": { lat: 51.6043, lon: -0.0664, city: "Londres", stadium: "Tottenham Hotspur Stadium" },
  "Newcastle": { lat: 54.9756, lon: -1.6217, city: "Newcastle", stadium: "St James' Park" },
  "Newcastle United": { lat: 54.9756, lon: -1.6217, city: "Newcastle", stadium: "St James' Park" },
  "Aston Villa": { lat: 52.5092, lon: -1.8847, city: "Birmingham", stadium: "Villa Park" },
  "Brighton": { lat: 50.8618, lon: -0.0837, city: "Brighton", stadium: "Amex Stadium" },
  "Brighton & Hove Albion": { lat: 50.8618, lon: -0.0837, city: "Brighton", stadium: "Amex Stadium" },
  "West Ham": { lat: 51.5387, lon: -0.0166, city: "Londres", stadium: "London Stadium" },
  "West Ham United": { lat: 51.5387, lon: -0.0166, city: "Londres", stadium: "London Stadium" },
  "Everton": { lat: 53.4389, lon: -2.9664, city: "Liverpool", stadium: "Goodison Park" },
  "Brentford": { lat: 51.4908, lon: -0.2886, city: "Londres", stadium: "Gtech Community Stadium" },
  "Wolves": { lat: 52.5902, lon: -2.1304, city: "Wolverhampton", stadium: "Molineux Stadium" },
  "Wolverhampton": { lat: 52.5902, lon: -2.1304, city: "Wolverhampton", stadium: "Molineux Stadium" },
  "Wolverhampton Wanderers": { lat: 52.5902, lon: -2.1304, city: "Wolverhampton", stadium: "Molineux Stadium" },
  "Crystal Palace": { lat: 51.3983, lon: -0.0856, city: "Londres", stadium: "Selhurst Park" },
  "Fulham": { lat: 51.4749, lon: -0.2217, city: "Londres", stadium: "Craven Cottage" },
  "Leicester": { lat: 52.6203, lon: -1.1422, city: "Leicester", stadium: "King Power Stadium" },
  "Leicester City": { lat: 52.6203, lon: -1.1422, city: "Leicester", stadium: "King Power Stadium" },
  "Bournemouth": { lat: 50.7352, lon: -1.8383, city: "Bournemouth", stadium: "Vitality Stadium" },
  "AFC Bournemouth": { lat: 50.7352, lon: -1.8383, city: "Bournemouth", stadium: "Vitality Stadium" },
  "Southampton": { lat: 50.9058, lon: -1.3911, city: "Southampton", stadium: "St Mary's Stadium" },
  "Ipswich": { lat: 52.0548, lon: 1.1448, city: "Ipswich", stadium: "Portman Road" },
  "Ipswich Town": { lat: 52.0548, lon: 1.1448, city: "Ipswich", stadium: "Portman Road" },

  // ── La Liga (Spain) ──
  "Real Madrid": { lat: 40.4531, lon: -3.6883, city: "Madrid", stadium: "Santiago Bernabéu" },
  "Barcelona": { lat: 41.3809, lon: 2.1228, city: "Barcelone", stadium: "Camp Nou / Montjuïc" },
  "FC Barcelona": { lat: 41.3809, lon: 2.1228, city: "Barcelone", stadium: "Camp Nou / Montjuïc" },
  "Atletico Madrid": { lat: 40.4362, lon: -3.5995, city: "Madrid", stadium: "Cívitas Metropolitano" },
  "Atlético Madrid": { lat: 40.4362, lon: -3.5995, city: "Madrid", stadium: "Cívitas Metropolitano" },
  "Sevilla": { lat: 37.3840, lon: -5.9705, city: "Séville", stadium: "Ramón Sánchez-Pizjuán" },
  "Sevilla FC": { lat: 37.3840, lon: -5.9705, city: "Séville", stadium: "Ramón Sánchez-Pizjuán" },
  "Real Betis": { lat: 37.3565, lon: -5.9817, city: "Séville", stadium: "Benito Villamarín" },
  "Betis": { lat: 37.3565, lon: -5.9817, city: "Séville", stadium: "Benito Villamarín" },
  "Valencia": { lat: 39.4746, lon: -0.3582, city: "Valence", stadium: "Mestalla" },
  "Valencia CF": { lat: 39.4746, lon: -0.3582, city: "Valence", stadium: "Mestalla" },
  "Athletic Club": { lat: 43.2642, lon: -2.9494, city: "Bilbao", stadium: "San Mamés" },
  "Athletic Bilbao": { lat: 43.2642, lon: -2.9494, city: "Bilbao", stadium: "San Mamés" },
  "Real Sociedad": { lat: 43.3014, lon: -1.9736, city: "Saint-Sébastien", stadium: "Reale Arena" },
  "Villarreal": { lat: 39.9442, lon: -0.1036, city: "Villarreal", stadium: "Estadio de la Cerámica" },
  "Villarreal CF": { lat: 39.9442, lon: -0.1036, city: "Villarreal", stadium: "Estadio de la Cerámica" },
  "Girona": { lat: 41.9614, lon: 2.8184, city: "Gérone", stadium: "Montilivi" },

  // ── Serie A (Italy) ──
  "Inter": { lat: 45.4781, lon: 9.1240, city: "Milan", stadium: "San Siro" },
  "Inter Milan": { lat: 45.4781, lon: 9.1240, city: "Milan", stadium: "San Siro" },
  "AC Milan": { lat: 45.4781, lon: 9.1240, city: "Milan", stadium: "San Siro" },
  "Milan": { lat: 45.4781, lon: 9.1240, city: "Milan", stadium: "San Siro" },
  "Juventus": { lat: 45.1096, lon: 7.6413, city: "Turin", stadium: "Allianz Stadium" },
  "Napoli": { lat: 40.8279, lon: 14.1930, city: "Naples", stadium: "Stadio Diego Armando Maradona" },
  "Roma": { lat: 41.9341, lon: 12.4547, city: "Rome", stadium: "Stadio Olimpico" },
  "AS Roma": { lat: 41.9341, lon: 12.4547, city: "Rome", stadium: "Stadio Olimpico" },
  "Lazio": { lat: 41.9341, lon: 12.4547, city: "Rome", stadium: "Stadio Olimpico" },
  "Atalanta": { lat: 45.7092, lon: 9.6808, city: "Bergame", stadium: "Gewiss Stadium" },

  // ── Bundesliga (Germany) ──
  "Bayern Munich": { lat: 48.2188, lon: 11.6247, city: "Munich", stadium: "Allianz Arena" },
  "Bayern": { lat: 48.2188, lon: 11.6247, city: "Munich", stadium: "Allianz Arena" },
  "Dortmund": { lat: 51.4926, lon: 7.4518, city: "Dortmund", stadium: "Signal Iduna Park" },
  "Borussia Dortmund": { lat: 51.4926, lon: 7.4518, city: "Dortmund", stadium: "Signal Iduna Park" },
  "Bayer Leverkusen": { lat: 51.0383, lon: 6.9831, city: "Leverkusen", stadium: "BayArena" },
  "Leverkusen": { lat: 51.0383, lon: 6.9831, city: "Leverkusen", stadium: "BayArena" },
  "RB Leipzig": { lat: 51.3458, lon: 12.3483, city: "Leipzig", stadium: "Red Bull Arena" },
  "Leipzig": { lat: 51.3458, lon: 12.3483, city: "Leipzig", stadium: "Red Bull Arena" },
  "Eintracht Frankfurt": { lat: 50.0686, lon: 8.6455, city: "Francfort", stadium: "Deutsche Bank Park" },
  "Stuttgart": { lat: 48.7922, lon: 9.2322, city: "Stuttgart", stadium: "MHPArena" },
};

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

/**
 * Résout les coordonnées géographiques du club hôte
 */
export function getTeamStadiumCoords(teamName) {
  if (!teamName) return { lat: 53.4308, lon: -2.9608, city: "Liverpool", stadium: "Anfield" };
  const clean = teamName.trim();
  
  if (STADIA_COORDINATES[clean]) return STADIA_COORDINATES[clean];

  // Recherche insensible à la casse ou partielle
  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(STADIA_COORDINATES)) {
    if (key.toLowerCase() === lower || key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return val;
    }
  }

  // Fallback par défaut (Paris / Europe)
  return { lat: 48.8566, lon: 2.3522, city: clean, stadium: `Stade de ${clean}` };
}

/**
 * Récupère la météo en direct ou prévisionnelle pour un match
 * @param {string} homeTeam Nom du club hôte
 * @param {string} [matchDate] Date du match (YYYY-MM-DD)
 * @returns {Promise<object>}
 */
export async function fetchLiveMatchWeather(homeTeam, matchDate) {
  const stadiumInfo = getTeamStadiumCoords(homeTeam);
  const targetDate = matchDate && matchDate.includes('-') ? matchDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const cacheKey = `${stadiumInfo.lat}_${stadiumInfo.lon}_${targetDate}`;

  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey);
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${stadiumInfo.lat}&longitude=${stadiumInfo.lon}&current=temperature_2m,precipitation,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${targetDate}&end_date=${targetDate}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

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
      isLive: true,
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

    weatherCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Fallback météo Open-Meteo:', err.message);
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
