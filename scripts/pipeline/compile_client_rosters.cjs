/**
 * scripts/pipeline/compile_client_rosters.cjs
 * ─────────────────────────────────────────────────────────────
 * Wrapper Node.js pour l'exécution du compilateur Fast-Layer SQLite vers JSON V2.
 */

'use strict';
const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'compile_client_rosters.py');

console.log('[Compilateur:NodeWrapper] Lancement du compilateur Fast-Layer...');
try {
  const output = execSync(`python "${SCRIPT_PATH}"`, { encoding: 'utf8' });
  console.log(output);
} catch (error) {
  console.error('[Compilateur:NodeWrapper] Erreur lors de la compilation :', error.message);
  process.exit(1);
}
