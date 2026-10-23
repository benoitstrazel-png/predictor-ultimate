#!/usr/bin/env python3
"""
scripts/db/init_versioned_predictions_schema.py
─────────────────────────────────────────────────────────────
Initialise le schéma MLOps multi-modèles et le cache RAG structuré
compatible SQLite (predictor_v2.db) et Turso / libSQL / Vercel KV.
Garantit par trigger SQL qu'aucun pronostic historique scellé (is_sealed = 1)
ne puisse jamais être écrasé rétroactivement lors d'un changement d'algorithme.
"""

import os
import sys
import hashlib
import sqlite3
import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT_DIR, "predictor_v2.db")
MODEL_V3_PATH = os.path.join(ROOT_DIR, "models", "football_quant_model_v3.joblib")


def compute_file_sha256(path: str) -> str:
    if not os.path.exists(path):
        return "builtin_deterministic"
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def init_versioned_schema(db_path: str = DB_PATH):
    print(f"📦 [MLOps:Schema] Connexion à {db_path} (compatible SQLite WAL / Turso libSQL)...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")

    ddl = """
    -- 1. Registre des Modèles (MLOps Lineage & Governance)
    CREATE TABLE IF NOT EXISTS dim_model_registry (
        model_version       TEXT PRIMARY KEY,          -- 'v1', 'v2', 'v3'
        model_name          TEXT NOT NULL,
        algorithm_family    TEXT NOT NULL,
        feature_count       INTEGER NOT NULL,
        artifact_sha256     TEXT NOT NULL,
        trained_at          TEXT NOT NULL,
        is_active_default   INTEGER NOT NULL DEFAULT 0,
        description         TEXT
    );

    -- 2. Table des Cotes Bookmakers (Opening & Closing Lines pour calcul CLV & Shin)
    CREATE TABLE IF NOT EXISTS dim_match_closing_odds (
        match_id            TEXT PRIMARY KEY,
        bookmaker_name      TEXT NOT NULL DEFAULT 'Betclic',
        odd_home            REAL,
        odd_draw            REAL,
        odd_away            REAL,
        overround_pct       REAL,
        shin_prob_home      REAL,
        shin_prob_draw      REAL,
        shin_prob_away      REAL,
        captured_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    -- 3. Table Immuable des Prédictions Multi-Modèles (Scellement Historique)
    CREATE TABLE IF NOT EXISTS fact_model_predictions (
        prediction_id       INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id            TEXT NOT NULL,
        model_version       TEXT NOT NULL,             -- 'v1' | 'v2' | 'v3'
        snapshot_type       TEXT NOT NULL DEFAULT 'CLOSING_PREMATCH', -- 'BACKFILL_SEALED' | 'H_MINUS_1' | 'CLOSING_PREMATCH'
        
        -- Probabilités 1N2 calibrées (0.0 à 100.0)
        prob_home           REAL NOT NULL CHECK(prob_home >= 0 AND prob_home <= 100),
        prob_draw           REAL NOT NULL CHECK(prob_draw >= 0 AND prob_draw <= 100),
        prob_away           REAL NOT NULL CHECK(prob_away >= 0 AND prob_away <= 100),
        predicted_outcome   TEXT NOT NULL,             -- '1' | 'N' | '2'
        
        -- Expected Goals projetés & Indice de Confiance Épistémique (0-100)
        lambda_home_xg      REAL NOT NULL,
        lambda_away_xg      REAL NOT NULL,
        confidence_score    REAL NOT NULL,
        
        -- Cotes Betclic au moment du scellement & Probabilités Vraies de Shin (De-vigged)
        odd_home_snap       REAL,
        odd_draw_snap       REAL,
        odd_away_snap       REAL,
        overround_pct       REAL,
        shin_prob_home      REAL,
        shin_prob_draw      REAL,
        shin_prob_away      REAL,
        
        -- Value Bet certifié (Edge après dé-margination de Shin)
        value_outcome       TEXT,                      -- '1' | 'N' | '2' | NULL
        value_edge_pct      REAL DEFAULT 0.0,
        kelly_stake_pct     REAL DEFAULT 0.0,
        
        -- Payloads JSON analytiques
        exact_scores_json   TEXT NOT NULL,
        ht_scores_json      TEXT,
        shap_drivers_json   TEXT,
        
        -- Verrouillage MLOps & Évaluation post-match (Hit Rate, Brier, LogLoss, ROI)
        computed_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        is_sealed           INTEGER NOT NULL DEFAULT 1,
        actual_outcome      TEXT,                      -- '1' | 'N' | '2' | NULL
        is_hit              INTEGER,                   -- 1 si predicted_outcome == actual_outcome, 0 sinon
        brier_score         REAL,
        log_loss            REAL,
        flat_stake_pnl      REAL,                      -- Profit/Perte net (1u mise sur predicted_outcome)
        value_bet_pnl       REAL,                      -- Profit/Perte net (1u mise uniquement si value_outcome != NULL)
        
        UNIQUE(match_id, model_version, snapshot_type),
        FOREIGN KEY (model_version) REFERENCES dim_model_registry(model_version)
    );

    CREATE INDEX IF NOT EXISTS idx_fmp_match_version ON fact_model_predictions(match_id, model_version);
    CREATE INDEX IF NOT EXISTS idx_fmp_version_outcome ON fact_model_predictions(model_version, actual_outcome);

    -- 4. Trigger SQLite/libSQL interdisant toute réécriture rétroactive d'une prédiction scellée
    DROP TRIGGER IF EXISTS trg_prevent_retroactive_prediction_overwrite;
    CREATE TRIGGER trg_prevent_retroactive_prediction_overwrite
    BEFORE UPDATE OF prob_home, prob_draw, prob_away, lambda_home_xg, lambda_away_xg, exact_scores_json
    ON fact_model_predictions
    WHEN OLD.is_sealed = 1
    BEGIN
        SELECT RAISE(ABORT, 'MLOps Integrity Error: Sealed historical predictions (v1/v2/v3) cannot be overwritten retroactively.');
    END;

    -- 5. Table de Cache RAG Structuré par Match (Signaux faibles, Absences, Météo/Arbitre, Citations)
    CREATE TABLE IF NOT EXISTS rag_structured_brief_cache (
        match_id            TEXT NOT NULL,
        model_version       TEXT NOT NULL DEFAULT 'v3',
        brief_json          TEXT NOT NULL,
        sources_count       INTEGER NOT NULL DEFAULT 0,
        generated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        expires_at          TEXT NOT NULL,
        PRIMARY KEY (match_id, model_version)
    );
    """
    cursor.executescript(ddl)

    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    v3_sha = compute_file_sha256(MODEL_V3_PATH)

    models_seed = [
        (
            "v1",
            "Monte-Carlo LCG + Elo Rank",
            "Stochastic Poisson Monte-Carlo (10k iter)",
            12,
            "v1_legacy_mc_lcg",
            "2025-08-01T00:00:00Z",
            0,
            "Modèle historique v1 basé sur l'écart de rang, la forme à 5 matchs et 10 000 simulations Monte-Carlo déterministes.",
        ),
        (
            "v2",
            "Dixon-Coles Bivariate Pur",
            "Maximum Likelihood Time-Decayed Bivariate Poisson",
            8,
            v3_sha,
            now_iso,
            0,
            "Modèle statistique structurel de Dixon & Coles (1997) avec paramètre de corrélation rho sur scores bas et décroissance temporelle xi=0.0025.",
        ),
        (
            "v3",
            "Hybrid Quant V3 (DC + LightGBM + Shin)",
            "Dixon-Coles Priors + Calibrated LightGBM + EWMA npxG + Shin De-Vig",
            53,
            v3_sha,
            now_iso,
            1,
            "Moteur hybride combinant les priors structurels Dixon-Coles, le gradient boosting calibré (LightGBM), la pondération dynamique EWMA xG/absences et la dé-margination de Shin.",
        ),
    ]

    cursor.executemany(
        """
        INSERT OR REPLACE INTO dim_model_registry (
            model_version, model_name, algorithm_family, feature_count,
            artifact_sha256, trained_at, is_active_default, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """,
        models_seed,
    )

    conn.commit()
    cursor.execute("SELECT model_version, model_name, is_active_default FROM dim_model_registry ORDER BY model_version;")
    rows = cursor.fetchall()
    print("✅ [MLOps:Schema] Registre multi-modèles et table immuable initialisés :")
    for r in rows:
        tag = " [DEFAULT]" if r[2] else ""
        print(f"   ├─ {r[0]} : {r[1]}{tag}")
    conn.close()


if __name__ == "__main__":
    init_versioned_schema()
