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
const { extractBetclicMatches } = require('./extractors/betclicExtractor.cjs');
const { transformMatches } = require('./transformers/predictionEngine.cjs');
const { validateDataset } = require('./validators/dataValidator.cjs');
const { loadDataset } = require('./loaders/dataLoader.cjs');

async function main() {
  const args = process.argv.slice(2);
  const isValidateOnly = args.includes('--validate');
  const isDryRun = args.includes('--dry-run');

  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       EUROPEAN FOOTBALL PREDICTOR V2 — MASTER DATA PIPELINE (ETL)         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  const startTime = Date.now();

  try {
    // 1. Validation Only Mode
    if (isValidateOnly) {
      const APP_DATA_FILE = path.join(__dirname, '..', '..', 'src', 'data', 'app_data.json');
      const currentData = require(APP_DATA_FILE);
      const valResult = validateDataset(currentData);
      if (!valResult.isValid) {
        process.exit(1);
      }
      return;
    }

    // 2. Step 1: Extraction
    console.log('\n▶ ÉTAPE 1/4 : INGESTION & EXTRACTION (Betclic + Sources Officielles)');
    const rawData = await extractBetclicMatches();

    // 3. Step 2: Transformation & ML
    console.log('\n▶ ÉTAPE 2/4 : TRANSFORMATION & MODÉLISATION PRÉDICTIVE (Dixon-Coles)');
    const transformed = transformMatches(rawData);

    // 4. Step 3: Data Quality & Certification
    console.log('\n▶ ÉTAPE 3/4 : VALIDATION CONTRACTUELLE & DATA QUALITY');
    const validationResult = validateDataset(transformed);

    if (!validationResult.isValid) {
      throw new Error('Échec des contrôles de qualité de données. Chargement annulé.');
    }

    // 5. Step 4: Loading & Storage
    if (!isDryRun) {
      console.log('\n▶ ÉTAPE 4/4 : PERSISTANCE ATOMIQUE & SNAPSHOT');
      loadDataset(transformed);
    } else {
      console.log('\n▶ [DRY RUN] Sauvegarde ignorée.');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`✅ PIPELINE TERMINÉ AVEC SUCCÈS en ${duration}s !`);
    console.log(`   🏆 Score Data Quality : ${validationResult.qualityScore}/100`);
    console.log(`   📊 Rencontres Prêtes  : ${transformed.fullSchedule.length}`);
    console.log(`   🌐 Compétitions       : ${transformed.supportedLeagues.length} actives (Top 5 + 3 Coupes d'Europe)`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ ERREUR CRITIQUE DANS LE PIPELINE :', err.message);
    process.exit(1);
  }
}

main();
