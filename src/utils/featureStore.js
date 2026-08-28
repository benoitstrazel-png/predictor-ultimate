/**
 * src/utils/featureStore.js
 * ─────────────────────────────────────────────────────────────
 * Feature Store Prédictif & Mémoire Long-Terme
 * Calcule les indicateurs contextuels issus des faits de jeu historiques :
 * 1. Impact Séquelles (suspensions / absences suite aux expulsions)
 * 2. Indice de Résilience (capacité de remontada après penalty ou rouge)
 * 3. Historique H2H & Sévérité Arbitre (fréquence de cartons et penaltys)
 */

import UNIFIED_HISTORY from '../data/unified_history.json';

/**
 * Calcul l'Indice de Résilience d'une équipe (capacité à revenir au score)
 */
export const calculateResilienceIndex = (teamName, historyData = UNIFIED_HISTORY) => {
  if (!teamName) return { score: 7.5, label: 'Résilience Élevée', comebackRate: '68%' };

  const teamMatches = historyData.filter(m => m.homeTeam === teamName || m.awayTeam === teamName);
  if (teamMatches.length === 0) return { score: 7.0, label: 'Moyenne Ligue', comebackRate: '50%' };

  let totalComebacks = 0;
  let matchesConcededFirst = 0;

  teamMatches.forEach(m => {
    const goals = m.goals || [];
    if (goals.length > 1) {
      const firstGoal = goals[0];
      if (firstGoal.team !== teamName) {
        matchesConcededFirst++;
        // Check if team won or drew
        const [h, a] = (m.score || '0-0').split('-').map(x => parseInt(x, 10));
        const teamScore = m.homeTeam === teamName ? h : a;
        const oppScore = m.homeTeam === teamName ? a : h;
        if (teamScore >= oppScore) {
          totalComebacks++;
        }
      }
    }
  });

  const comebackRatePct = matchesConcededFirst > 0 ? Math.round((totalComebacks / matchesConcededFirst) * 100) : 65;
  const score = +(Math.min(9.8, Math.max(4.5, (comebackRatePct / 10)))).toFixed(1);

  return {
    score,
    label: score > 7.5 ? 'Mental d\'Acier & Remontada' : score > 6.0 ? 'Résilience Solide' : 'Vulnérable sous Pression',
    comebackRate: `${comebackRatePct}%`,
    totalComebacks,
    matchesConcededFirst,
  };
};

/**
 * Calcul de l'Impact Séquelles (Suspensions & Absences suite aux expulsions passées)
 */
export const calculateSequelImpact = (teamName, historyData = UNIFIED_HISTORY) => {
  if (!teamName) return { impactScore: 'Faible (1.2/10)', suspendedPlayers: [], riskLevel: 'Normal' };

  const teamMatches = historyData.filter(m => m.homeTeam === teamName || m.awayTeam === teamName);
  const recentMatches = teamMatches.slice(-5);

  let redCardsCount = 0;
  const suspendedPlayers = [];

  recentMatches.forEach(m => {
    const cards = m.cards || [];
    cards.forEach(c => {
      if (c.team === teamName && c.type === 'Red') {
        redCardsCount++;
        suspendedPlayers.push({ player: c.player || 'Joueur Clé', match: `${m.homeTeam} vs ${m.awayTeam}` });
      }
    });
  });

  const impactScoreVal = redCardsCount * 3.5;

  return {
    impactScore: `${impactScoreVal.toFixed(1)} / 10`,
    redCardsCount,
    suspendedPlayers,
    riskLevel: redCardsCount > 0 ? '⚠️ Élevé (Suspension Active)' : '🟢 Modéré (Effectif Complet)',
  };
};

/**
 * Calcul de l'Historique Cartons H2H & Sévérité Arbitre
 */
export const calculateH2HCardRatio = (homeTeam, awayTeam, refereeName = 'Clément Turpin', historyData = UNIFIED_HISTORY) => {
  const h2hMatches = historyData.filter(m =>
    (m.homeTeam === homeTeam && m.awayTeam === awayTeam) ||
    (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
  );

  let totalYellows = 0;
  let totalReds = 0;

  h2hMatches.forEach(m => {
    (m.cards || []).forEach(c => {
      if (c.type === 'Yellow') totalYellows++;
      if (c.type === 'Red') totalReds++;
    });
  });

  const avgYellows = h2hMatches.length > 0 ? (totalYellows / h2hMatches.length).toFixed(1) : '3.8';
  const redProbability = h2hMatches.length > 0 ? `${Math.round((totalReds / h2hMatches.length) * 100)}%` : '18%';

  return {
    h2hMatchesCount: h2hMatches.length,
    avgYellowsPerMatch: avgYellows,
    redProbability,
    refereeSeverity: refereeName.includes('Turpin') || refereeName.includes('Oliver') || refereeName.includes('Gil') ? 'Élevée (Stricte)' : 'Modérée',
  };
};
