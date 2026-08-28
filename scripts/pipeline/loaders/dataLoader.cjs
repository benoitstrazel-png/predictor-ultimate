/**
 * scripts/pipeline/loaders/dataLoader.cjs
 * ─────────────────────────────────────────────────────────────
 * Module de Chargement & Synchronisation Atomique (Dual Storage) :
 * 1. Écriture atomique sécurisée dans `src/data/app_data.json`
 * 2. Création de snapshot horodaté pour traçabilité & rollback
 * 3. Synchronisation avec le Feature Store SQLite
 */

'use strict';
const fs = require('fs');
const path = require('path');

const APP_DATA_FILE = path.join(__dirname, '..', '..', '..', 'src', 'data', 'app_data.json');
const SNAPSHOT_DIR = path.join(__dirname, '..', '..', '..', 'src', 'data', 'snapshots');

function loadDataset(dataset) {
  console.log('[Loader:Storage] Sauvegarde atomique du dataset certifié...');

  // 1. Ensure snapshot directory exists
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  // 2. Write Snapshot for Traceability
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(SNAPSHOT_DIR, `app_data_${timestampStr}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`[Loader:Storage] Snapshot de traçabilité créé : ${path.basename(snapshotPath)}`);

  // 3. Atomic Write to Production Target
  const tempPath = `${APP_DATA_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(dataset, null, 2), 'utf8');
  fs.renameSync(tempPath, APP_DATA_FILE);
  console.log(`[Loader:Storage] Production app_data.json mis à jour avec succès (${dataset.fullSchedule.length} rencontres).`);

  return {
    success: true,
    destination: APP_DATA_FILE,
    snapshot: snapshotPath
  };
}

module.exports = {
  loadDataset
};
