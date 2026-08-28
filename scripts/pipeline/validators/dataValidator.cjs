/**
 * scripts/pipeline/validators/dataValidator.cjs
 * ─────────────────────────────────────────────────────────────
 * Validateur Strict de Qualité de Données (Data Quality Contract) :
 * - Schéma et types
 * - Cohérence des cotes (Bornes > 1.01, pas de NaN)
 * - Somme des probabilités (98% - 102%)
 * - Intégrité des tags de championnats (Zero undefined)
 * - Génération du rapport formel d'audit `data_quality_report.json`
 */

'use strict';
const fs = require('fs');
const path = require('path');

const REPORT_FILE = path.join(__dirname, '..', '..', '..', 'data_quality_report.json');

function validateDataset(dataset) {
  console.log('[Validator:DataQuality] Lancement des contrôles d\'intégrité et de conformité...');
  const anomalies = [];
  let checksPassed = 0;
  let totalChecks = 0;

  const assert = (condition, description, fatal = false) => {
    totalChecks++;
    if (!condition) {
      anomalies.push({ description, fatal });
      if (fatal) {
        throw new Error(`[FATAL DATA QUALITY ERROR] ${description}`);
      }
    } else {
      checksPassed++;
    }
  };

  // 1. Structural Checks
  assert(dataset && typeof dataset === 'object', 'Le dataset est un objet valide', true);
  assert(Array.isArray(dataset.supportedLeagues) && dataset.supportedLeagues.length >= 8, '8 championnats/compétitions supportés présents', true);
  assert(Array.isArray(dataset.fullSchedule) && dataset.fullSchedule.length > 0, 'fullSchedule contient des rencontres', true);

  // 2. Schedule & Fixture Integrity
  const leaguesPresent = new Set();
  dataset.fullSchedule.forEach((m, idx) => {
    const matchRef = `Match #${idx + 1} (${m.homeTeam} vs ${m.awayTeam})`;

    // League Check
    assert(typeof m.league === 'string' && m.league.length > 0, `${matchRef} : champ 'league' valide et non-undefined`, true);
    leaguesPresent.add(m.league);

    // Teams Check
    assert(m.homeTeam && m.awayTeam && m.homeTeam !== m.awayTeam, `${matchRef} : équipes distinctes et valides`);

    // Odds Check
    assert(m.betclicOdds && typeof m.betclicOdds === 'object', `${matchRef} : objet betclicOdds présent`);
    if (m.betclicOdds) {
      assert(m.betclicOdds.home > 1.0 && m.betclicOdds.home < 100, `${matchRef} : Cote Domicile valide (${m.betclicOdds.home})`);
      assert(m.betclicOdds.draw > 1.0 && m.betclicOdds.draw < 100, `${matchRef} : Cote Nul valide (${m.betclicOdds.draw})`);
      assert(m.betclicOdds.away > 1.0 && m.betclicOdds.away < 100, `${matchRef} : Cote Extérieur valide (${m.betclicOdds.away})`);
    }

    // Probability & ML Prediction Check
    if (m.prediction) {
      const sumProb = (m.prediction.home || 0) + (m.prediction.draw || 0) + (m.prediction.away || 0);
      assert(sumProb >= 98 && sumProb <= 102, `${matchRef} : Somme probabilités cohérente (${sumProb}%)`);
    }

    // Lineup & Squad Impact Validation Check
    assert(m.lineupStatus === 'OFFICIAL' || m.lineupStatus === 'PROBABLE', `${matchRef} : Statut compo valide (${m.lineupStatus})`);
    if (m.homeLineup && m.homeLineup.aggregatedSquadImpact) {
      assert(m.homeLineup.aggregatedSquadImpact.xiStrengthRatio >= 0.5 && m.homeLineup.aggregatedSquadImpact.xiStrengthRatio <= 1.05, `${matchRef} : Ratio force Domicile valide`);
    }
    if (m.awayLineup && m.awayLineup.aggregatedSquadImpact) {
      assert(m.awayLineup.aggregatedSquadImpact.xiStrengthRatio >= 0.5 && m.awayLineup.aggregatedSquadImpact.xiStrengthRatio <= 1.05, `${matchRef} : Ratio force Extérieur valide`);
    }
  });

  // 3. European Competitions Coverage Check
  const REQUIRED_LEAGUES = ['EUR-CL', 'EUR-EL', 'EUR-ECL', 'FRA-L1', 'ENG-PL', 'ESP-LL', 'ITA-SA', 'GER-BL'];
  REQUIRED_LEAGUES.forEach(code => {
    assert(leaguesPresent.has(code), `Couverture active pour la compétition ${code}`);
  });

  const qualityScore = Math.round((checksPassed / totalChecks) * 100);
  const isValid = anomalies.filter(a => a.fatal).length === 0 && qualityScore >= 95;

  const report = {
    timestamp: new Date().toISOString(),
    qualityScore: `${qualityScore}/100`,
    status: isValid ? 'CERTIFIED_GOLD' : 'NEEDS_REMEDIATION',
    totalChecks,
    checksPassed,
    anomaliesCount: anomalies.length,
    anomalies,
    summary: {
      totalMatches: dataset.fullSchedule.length,
      leaguesCount: leaguesPresent.size,
      leaguesActive: Array.from(leaguesPresent)
    }
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[Validator:DataQuality] Score de Qualité : ${qualityScore}/100 (${checksPassed}/${totalChecks} contrôles réussis).`);
  console.log(`[Validator:DataQuality] Rapport sauvegardé dans ${REPORT_FILE}`);

  return {
    isValid,
    qualityScore,
    report
  };
}

module.exports = {
  validateDataset
};
