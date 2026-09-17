#!/usr/bin/env node
/**
 * scripts/pipeline/run_pipeline.cjs
 * ─────────────────────────────────────────────────────────────
 * Master Orchestrator — Pipeline ETL & Data Quality European Football Predictor V2
 * 
 * Commandes :
 *   node scripts/pipeline/run_pipeline.cjs --full
 *   node scripts/pipeline/run_pipeline.cjs --sync
 *   node scripts/pipeline/run_pipeline.cjs --validate
 */

'use strict';
const path = require('path');
const { execSync } = require('child_process');
const { validateDataset } = require('./validators/dataValidator.cjs');

async function main() {
  const args = process.argv.slice(2);
  const isValidateOnly = args.includes('--validate');
  const isDryRun = args.includes('--dry-run');

  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       EUROPEAN FOOTBALL PREDICTOR V2 — MASTER DATA PIPELINE (ETL)         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  const startTime = Date.now();

  try {
    const APP_DATA_FILE = path.join(__dirname, '..', '..', 'src', 'data', 'app_data.json');

    // 1. Validation Only Mode
    if (isValidateOnly) {
      const currentData = require(APP_DATA_FILE);
      const valResult = validateDataset(currentData);
      if (!valResult.isValid) {
        process.exit(1);
      }
      return;
    }

    const runPy = (cmd, desc) => {
      console.log(`\n▶ ${desc}...`);
      execSync(`python ${cmd}`, { stdio: 'inherit', cwd: path.join(__dirname, '..', '..') });
    };

    // 2. Step 1: Extraction des Cotes Betclic Réelles
    runPy('scripts/pipeline/extractors/betclic_collector.py', 'ÉTAPE 1/4 : INGESTION & COTES RÉELLES (Betclic Collector)');

    // 3. Step 2: Effectifs & Transferts Multi-Saisons
    runPy('scripts/pipeline/sync_full_squads_and_transfers.py', 'ÉTAPE 2/4 : SYNCHRONISATION EFFECTIFS & MERCATO (SCD2)');

    // 4. Step 3: Compilation Base SQLite & Calendrier 2026-2027
    runPy('scripts/pipeline/compile_unified_history_and_app_data.py', 'ÉTAPE 3/4 : COMPILATION UNIFIÉE & ARCHIVES PARTITIONNÉES');

    // 5. Step 4: Modélisation ML Quantitatif (LightGBM 54 features + Dixon-Coles)
    runPy('scripts/pipeline/enrich_matches_with_ml_and_entities.py', 'ÉTAPE 4/4 : INFERENCE QUANT ML & DÉTECTION VALUE BETS');

    // 6. Validation Contractuelle
    console.log('\n▶ CONTRÔLE FINAL : VALIDATION CONTRACTUELLE & DATA QUALITY');
    delete require.cache[require.resolve(APP_DATA_FILE)];
    const finalData = require(APP_DATA_FILE);
    const validationResult = validateDataset(finalData);

    if (!validationResult.isValid) {
      throw new Error('Échec des contrôles de qualité de données. Pipeline non conforme.');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`✅ PIPELINE TERMINÉ AVEC SUCCÈS en ${duration}s !`);
    console.log(`   🏆 Score Data Quality : ${validationResult.qualityScore}/100`);
    console.log(`   📊 Rencontres Prêtes  : ${finalData.fullSchedule.length}`);
    console.log(`   🌐 Compétitions       : ${finalData.supportedLeagues.length} actives (Top 5 + 3 Coupes d'Europe)`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ ERREUR CRITIQUE DANS LE PIPELINE :', err.message);
    process.exit(1);
  }
}

main();
