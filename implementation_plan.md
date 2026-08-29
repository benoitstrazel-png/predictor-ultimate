# Plan d'Implémentation — Résolution du Transfert Emegha (Strasbourg ➔ Chelsea) & Synchronisation Globale des Effectifs SCD2

Ce plan détaille la cause racine de l'affichage d'Emanuel Emegha à Strasbourg en 2026-2027, l'identification de tous les joueurs dans une situation similaire, et la mise en œuvre d'un moteur de réconciliation automatisé entre les transferts et les effectifs.

---

## 1. Diagnostic de la Cause Racine

1. **Origine des données de l'UI (`getClubSquad`) :**
   - L'explorateur d'effectif (`SquadsMercatoProps.jsx`) interroge `src/data/squads/strasbourg.json` pour la saison `2026-2027`.
   - Dans ce fichier, `Emanuel Emegha` est resté enregistré avec le statut `"ACTIVE"`, `joined_date: "2024-07-01"` et `contract_until: "2028-06-30"`.
   - À l'inverse, dans `src/data/squads/chelsea.json`, Emegha est absent de la saison `2026-2027`.

2. **Désynchronisation entre la table des transferts et la table des contrats SCD2 :**
   - Le pipeline `ingest_master_squads.py` ingère directement les fichiers `src/data/squads/*.json`. Comme le fichier source de Strasbourg contenait Emegha en 2026-2027, la table `dim_player_contracts_scd2` a créé un contrat actif à Strasbourg (`is_current = 1`).
   - Le transfert estival 2026 (synergie BlueCo Strasbourg ➔ Chelsea, ~34 M€) n'a pas automatiquement clôturé le contrat strasbourgeois (`valid_to = 2026-07-01`, `is_current = 0`) ni créé le contrat actif chez les Blues.

3. **Recensement des autres cas similaires dans la base :**
   - L'audit exhaustif révèle **149 joueurs** en situation de doublon ou désynchronisés entre leur ancien et leur nouveau club sur la saison `2026-2027` (exemples : *Luka Modrić*, *Georges Mikautadze*, *Adrien Rabiot*, *Julian Alvarez*, *Andrey Santos*, *Mika Godts*, *Eberechi Eze*, *Piero Hincapié*, *Lucas Digne*).

---

## 2. Solution Architecturale & Actions Proposées

### A. Registre Maître des Mouvements & Transferts
Ajout et consolidation de l'ensemble des transferts 2024-2027 dans `fct_player_transfers` (notamment Emegha Strasbourg ➔ Chelsea, Andrey Santos, etc.).

### B. Moteur Automatisé de Synchronisation (`scripts/pipeline/sync_transfers_and_deduplicate_rosters.py`)
Ce script assurera :
1. **Mise à jour des fichiers `src/data/squads/*.json` :**
   - Retrait/clôture du joueur dans le club de départ pour 2026-2027 (ou passage en `status: "TRANSFERRED"`, `left_date: "2026-07-01"`).
   - Insertion du joueur dans le club d'arrivée (`chelsea.json`) pour 2026-2027 avec `status: "NEW_SIGNING"`, `joined_date: "2026-07-01"`.
2. **Dédoublonnage strict de la saison 2026-2027 :**
   - Garantie mathématique : **1 joueur = 1 seul club actif (`is_current = 1`)** sur la saison 2026-2027.
3. **Mise à jour de `dim_player_contracts_scd2` dans SQLite :**
   - Clôture du contrat précédent (`valid_to = transfer_date`, `is_current = 0`).
   - Création du nouveau contrat actif (`valid_from = transfer_date`, `is_current = 1`).

### C. Intégration dans le Pipeline & Fast-Layer
1. Mise à jour de `compile_client_rosters.py` et `dataValidator.cjs`.
2. Ajout d'une assertion dans le validateur interdisant tout joueur actif dans plus d'un club simultanément pour une même saison.

---

## 3. Plan de Vérification

1. Exécution du script de réconciliation :
   ```bash
   python scripts/pipeline/sync_transfers_and_deduplicate_rosters.py
   ```
2. Recompilation Fast-Layer :
   ```bash
   node scripts/pipeline/compile_client_rosters.cjs
   ```
3. Validation Data Quality (zéro doublon actif, Emegha à Chelsea et absent de l'effectif actif de Strasbourg) :
   ```bash
   npm run data:validate
   python data_integrity_check.py
   ```
4. Build de production Vite :
   ```bash
   npm run build
   ```
