/**
 * src/utils/tacticalAnalysis.js
 * ─────────────────────────────────────────────────────────────
 * Moteur d'analyse tactique et statistique multi-axes :
 * - Calcul des 6 dimensions radar normalisées (0-100) basées sur l'historique officiel
 * - Détermination des forces et faiblesses tactiques de chaque club
 * - Calcul du flux de momentum quart d'heure par quart d'heure (0-90 min)
 * - Extraction des 5 derniers matchs réels avec différentiel Buts vs xG
 */

import UNIFIED_HISTORY from '../data/unified_history.json';
import { normalizeEntityKey } from './entityResolver';

/**
 * Récupère les derniers matchs officiels joués par une équipe
 * @param {string} teamName Nom de l'équipe
 * @param {number} [limit=5] Nombre de matchs
 * @returns {Array<object>}
 */
export function getTeamRecentMatches(teamName, limit = 5) {
  if (!teamName) return [];
  const normTarget = normalizeEntityKey(teamName);

  const teamMatches = (UNIFIED_HISTORY || [])
    .filter(m => {
      const hNorm = normalizeEntityKey(m.homeTeam || '');
      const aNorm = normalizeEntityKey(m.awayTeam || '');
      return hNorm === normTarget || aNorm === normTarget || hNorm.includes(normTarget) || normTarget.includes(hNorm) || aNorm.includes(normTarget) || normTarget.includes(aNorm);
    })
    .filter(m => m.score && m.score !== 'À Venir' && m.score !== 'SCHEDULED');

  // Trier du plus récent au plus ancien
  const sorted = [...teamMatches].sort((a, b) => {
    const dateA = a.date || '2025-01-01';
    const dateB = b.date || '2025-01-01';
    return dateB.localeCompare(dateA);
  });

  return sorted.slice(0, limit).map((m, idx) => {
    const isHome = normalizeEntityKey(m.homeTeam || '').includes(normTarget) || normTarget.includes(normalizeEntityKey(m.homeTeam || ''));
    const opponent = isHome ? m.awayTeam : m.homeTeam;
    const [hg, ag] = (m.score || '0-0').split('-').map(Number);
    const teamGoals = isHome ? hg : ag;
    const oppGoals = isHome ? ag : hg;

    let result = 'D'; // Defeat
    if (teamGoals > oppGoals) result = 'W'; // Win
    else if (teamGoals === oppGoals) result = 'D_DRAW'; // Draw

    const teamXg = isHome 
      ? (m.teamStats?.home?.xg ?? +(hg * 0.7 + 0.4).toFixed(1))
      : (m.teamStats?.away?.xg ?? +(ag * 0.7 + 0.3).toFixed(1));
    
    const diff = +(teamGoals - teamXg).toFixed(2);

    return {
      id: m.id || `REC_${idx}`,
      match: m,
      date: m.date || '2025-2026',
      round: m.round || `J.${idx + 1}`,
      league: m.league || 'ENG-PL',
      opponent,
      venue: isHome ? 'Domicile' : 'Extérieur',
      isHome,
      score: `${teamGoals} - ${oppGoals}`,
      realGoals: teamGoals,
      concededGoals: oppGoals,
      xG: teamXg,
      diff,
      status: diff >= 0 ? 'over' : 'under',
      result, // 'W', 'D_DRAW', 'D'
      referee: m.referee || 'Arbitre Officiel',
      goals: m.goals || [],
      teamStats: m.teamStats,
    };
  });
}

/**
 * Calcule les métriques Radar multi-axes d'un club (échelle 0-100)
 * @param {string} teamName 
 * @returns {{ attack: number, defense: number, possession: number, form: number, danger: number, intensity: number }}
 */
export function calculateTeamRadarMetrics(teamName) {
  const recent = getTeamRecentMatches(teamName, 10);
  
  if (recent.length === 0) {
    return {
      attack: 65,
      defense: 65,
      possession: 55,
      form: 60,
      danger: 62,
      intensity: 60
    };
  }

  const totalMatches = recent.length;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let totalXg = 0;
  let cleanSheets = 0;
  let points = 0;
  let totalPossession = 0;
  let posCount = 0;

  recent.forEach(m => {
    totalGoalsScored += m.realGoals;
    totalGoalsConceded += m.concededGoals;
    totalXg += m.xG;
    if (m.concededGoals === 0) cleanSheets++;
    if (m.result === 'W') points += 3;
    else if (m.result === 'D_DRAW') points += 1;

    const matchPos = m.isHome ? m.teamStats?.home?.possession : m.teamStats?.away?.possession;
    if (matchPos) {
      totalPossession += matchPos;
      posCount++;
    }
  });

  const avgGoals = totalGoalsScored / totalMatches;
  const avgConceded = totalGoalsConceded / totalMatches;
  const avgXg = totalXg / totalMatches;
  const avgPos = posCount > 0 ? (totalPossession / posCount) : (50 + (avgGoals - avgConceded) * 4);
  const winRate = points / (totalMatches * 3);

  // 1. Attaque (0-100) : Basé sur volume xG & Buts
  const attackScore = Math.min(98, Math.max(30, Math.round(avgXg * 32 + avgGoals * 12)));

  // 2. Défense (0-100) : Moins de buts concédés & plus de clean sheets = meilleur score
  const defScore = Math.min(98, Math.max(30, Math.round(100 - avgConceded * 25 + (cleanSheets / totalMatches) * 20)));

  // 3. Possession (0-100)
  const posScore = Math.min(98, Math.max(30, Math.round(avgPos)));

  // 4. Forme Récente (0-100) : Basé sur points pris
  const formScore = Math.min(98, Math.max(25, Math.round(winRate * 80 + 15)));

  // 5. Danger & Finition (0-100) : Surperformance / conversion
  const finishingRatio = avgXg > 0 ? (avgGoals / avgXg) : 1;
  const dangerScore = Math.min(98, Math.max(30, Math.round(attackScore * 0.5 + finishingRatio * 40)));

  // 6. Intensité & Discipline (0-100)
  const intensityScore = Math.min(98, Math.max(35, Math.round(45 + winRate * 30 + (avgPos > 52 ? 15 : 5))));

  return {
    attack: attackScore,
    defense: defScore,
    possession: posScore,
    form: formScore,
    danger: dangerScore,
    intensity: intensityScore
  };
}

/**
 * Génère les forces et faiblesses tactiques dynamiques d'une équipe
 * @param {string} teamName 
 * @param {boolean} isHome 
 * @returns {{ strengths: Array<string>, weaknesses: Array<string> }}
 */
export function getTeamTacticalProfile(teamName, isHome = true) {
  const radar = calculateTeamRadarMetrics(teamName);
  const recent = getTeamRecentMatches(teamName, 8);

  const strengths = [];
  const weaknesses = [];

  if (radar.attack >= 75) {
    strengths.push("Création d'occasions de haute qualité (xG élevé)");
    strengths.push("Efficacité et percussion dans le dernier tiers");
  } else if (radar.attack >= 60) {
    strengths.push("Attaque placée structurée et occupation des couloirs");
  } else {
    weaknesses.push("Difficulté à convertir les phases d'attaque placée");
  }

  if (radar.defense >= 75) {
    strengths.push("Solidité du bloc défensif & sécurité sur coups de pied arrêtés");
  } else if (radar.defense <= 55) {
    weaknesses.push("Vulnérabilité sur les transitions rapides et dans le dos des axiaux");
  }

  if (radar.possession >= 58) {
    strengths.push("Contrôle du tempo et maîtrise territoriale");
  } else if (radar.possession <= 44) {
    weaknesses.push("Faible maîtrise du ballon sous pression adverse");
    strengths.push("Transitions offensives directes et jeu en contre");
  }

  if (isHome) {
    strengths.push("Impact et intensité accrus à domicile devant son public");
  } else {
    if (radar.form < 60) {
      weaknesses.push("Fragilité relative lors des déplacements à l'extérieur");
    }
  }

  if (strengths.length < 2) strengths.push("Organisation tactique disciplinée et combativité");
  if (weaknesses.length < 2) weaknesses.push("Risque de déconcentration en fin de rencontre (75'-90')");

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 2)
  };
}

/**
 * Calcule la courbe de flux xG / Momentum projetée (0-90 min)
 * @param {string} homeTeam 
 * @param {string} awayTeam 
 * @param {object} [realMatch] 
 * @returns {Array<{ minute: string, home: number, away: number }>}
 */
export function generateXgFlowTimeline(homeTeam, awayTeam, realMatch = null) {
  // 1. Si le match a des événements réels / buts enregistrés
  const goals = realMatch?.goals || [];
  if (goals.length > 0) {
    let homeCum = 0;
    let awayCum = 0;
    const intervals = [0, 10, 20, 30, 45, 60, 75, 90];
    
    return intervals.map(min => {
      const hGoalsUpTo = goals.filter(g => (g.team === homeTeam || !g.team) && (parseInt(g.time) || 45) <= min).length;
      const aGoalsUpTo = goals.filter(g => g.team === awayTeam && (parseInt(g.time) || 45) <= min).length;
      
      const homeVal = +(hGoalsUpTo * 0.65 + (min / 90) * 0.8).toFixed(2);
      const awayVal = +(aGoalsUpTo * 0.65 + (min / 90) * 0.5).toFixed(2);
      return { minute: `${min}'`, home: homeVal, away: awayVal };
    });
  }

  // 2. Modèle de Momentum Prédictif par quart d'heure
  const homeMetrics = calculateTeamRadarMetrics(homeTeam);
  const awayMetrics = calculateTeamRadarMetrics(awayTeam);

  const homePower = homeMetrics.attack / 50.0;
  const awayPower = awayMetrics.attack / 50.0;

  const points = [
    { minute: "0'", home: 0, away: 0 },
    { minute: "15'", home: +(0.15 * homePower).toFixed(2), away: +(0.08 * awayPower).toFixed(2) },
    { minute: "30'", home: +(0.42 * homePower).toFixed(2), away: +(0.22 * awayPower).toFixed(2) },
    { minute: "45'", home: +(0.85 * homePower).toFixed(2), away: +(0.45 * awayPower).toFixed(2) },
    { minute: "60'", home: +(1.15 * homePower).toFixed(2), away: +(0.62 * awayPower).toFixed(2) },
    { minute: "75'", home: +(1.48 * homePower).toFixed(2), away: +(0.82 * awayPower).toFixed(2) },
    { minute: "90'", home: +(1.88 * homePower).toFixed(2), away: +(1.05 * awayPower).toFixed(2) }
  ];

  return points;
}
