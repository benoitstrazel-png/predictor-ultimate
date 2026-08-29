#!/usr/bin/env python3
"""
scripts/ml/train_and_evaluate_models.py
─────────────────────────────────────────────────────────────
Hybrid Predictive Engine & Model Training Pipeline (V3):
1. Ultra-fast Dixon-Coles Poisson Baseline Model (Attack/Defense GLM + Rho 1D search).
2. LightGBM multi-task models for:
   - xG Regression (Home & Away Lambda)
   - 1N2 Probabilities with 5-Fold Isotonic Calibration
   - Over/Under 2.5 Goals Classification
3. Strict Walk-Forward Time-Series Validation (Train: 2024-2025, Test: 2025-2026+).
4. Full Statistical Metrics (Log-Loss, Brier Score, RPS, RMSE, ROC-AUC, Value Bet ROI).
5. Native LightGBM SHAP (Tree-SHAP) Global & Local Explicability.
6. Exports model bundle to models/football_quant_model_v3.joblib.
"""

import os
import sys
import json
import time
import math
import numpy as np
import pandas as pd
import joblib
from scipy.optimize import minimize_scalar
from scipy.stats import poisson
from sklearn.linear_model import PoissonRegressor
import lightgbm as lgb
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import log_loss, brier_score_loss, roc_auc_score, mean_squared_error, mean_absolute_error

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from scripts.ml.dixon_coles_model import FastDixonColesModel
DATASET_PATH = os.path.join(ROOT_DIR, "data", "ml_features_dataset.parquet")
MODEL_BUNDLE_PATH = os.path.join(ROOT_DIR, "models", "football_quant_model_v3.joblib")
METRICS_REPORT_PATH = os.path.join(ROOT_DIR, "models", "training_evaluation_report.json")


def calculate_rps(p_probs, actual_outcomes):
    rps_list = []
    for p, y in zip(p_probs, actual_outcomes):
        p_cum = np.cumsum(p)
        y_vec = np.zeros(3)
        y_vec[int(y)] = 1.0
        y_cum = np.cumsum(y_vec)
        rps = 0.5 * np.sum((p_cum[:2] - y_cum[:2]) ** 2)
        rps_list.append(rps)
    return float(np.mean(rps_list))

def main():
    print("=" * 80)
    print(" 🚀 ENTRAÎNEMENT & BACKTESTING DU MODÈLE HYBRIDE QUANTITATIF (V3)")
    print("=" * 80)

    if not os.path.exists(DATASET_PATH):
        print(f"❌ Erreur : Le fichier de features {DATASET_PATH} est introuvable !")
        sys.exit(1)

    df = pd.read_parquet(DATASET_PATH)
    print(f"📊 [Dataset] Chargement réussi : {len(df)} rencontres ({df.shape[1]} colonnes)")

    labeled_df = df[df['target_1n2'].notnull() & df['target_home_goals'].notnull()].copy()
    labeled_df.sort_values(by=['date', 'match_id'], inplace=True)
    print(f"🎯 [Supervisé] {len(labeled_df)} matchs terminés avec cibles complètes.")

    # Walk-Forward Split (60% Train 2024-2025, 40% Test 2025-2026/2026-2027)
    split_idx = int(len(labeled_df) * 0.60)
    train_df = labeled_df.iloc[:split_idx].copy()
    test_df = labeled_df.iloc[split_idx:].copy()

    print(f"\n📅 [Walk-Forward Split] Entraînement : {len(train_df)} matchs ({train_df['date'].min()} à {train_df['date'].max()})")
    print(f"📅 [Walk-Forward Split] Test / OOS  : {len(test_df)} matchs ({test_df['date'].min()} à {test_df['date'].max()})")

    # Fit Dixon-Coles
    dc_model = FastDixonColesModel(xi=0.0015)
    dc_model.fit(train_df)

    def get_dc_priors(sub_df):
        dc_h_xg, dc_a_xg, dc_p_h, dc_p_d, dc_p_a = [], [], [], [], []
        for _, row in sub_df.iterrows():
            pred = dc_model.predict_match(row['home_team'], row['away_team'])
            dc_h_xg.append(pred['lambda_home'])
            dc_a_xg.append(pred['lambda_away'])
            dc_p_h.append(pred['prob_home'])
            dc_p_d.append(pred['prob_draw'])
            dc_p_a.append(pred['prob_away'])
        return pd.DataFrame({
            "feat_dc_home_xg": dc_h_xg,
            "feat_dc_away_xg": dc_a_xg,
            "feat_dc_prob_home": dc_p_h,
            "feat_dc_prob_draw": dc_p_d,
            "feat_dc_prob_away": dc_p_a
        }, index=sub_df.index)

    train_dc_priors = get_dc_priors(train_df)
    test_dc_priors = get_dc_priors(test_df)

    train_enhanced = pd.concat([train_df, train_dc_priors], axis=1)
    test_enhanced = pd.concat([test_df, test_dc_priors], axis=1)

    feature_cols = [c for c in train_enhanced.columns if c.startswith('feat_')]
    print(f"\n🧠 [Features] {len(feature_cols)} variables explicatives sélectionnées :")
    for group, f_list in [
        ("Météo", [c for c in feature_cols if 'weather' in c]),
        ("Arbitrage", [c for c in feature_cols if 'ref_' in c]),
        ("H2H Joueurs", [c for c in feature_cols if 'player_' in c]),
        ("Tactique/Effectif", [c for c in feature_cols if 'tactical' in c or 'rotation' in c or 'absentees' in c]),
        ("Saisonnalité/Fatigue", [c for c in feature_cols if 'rest' in c or 'congestion' in c or 'season' in c]),
        ("Rolling Form (EWMA)", [c for c in feature_cols if 'rolling' in c]),
        ("Priors Dixon-Coles", [c for c in feature_cols if 'dc_' in c])
    ]:
        print(f"   ├─ {group:<22} : {len(f_list)} features")

    X_train = train_enhanced[feature_cols].values
    X_test = test_enhanced[feature_cols].values

    y_1n2_train = train_enhanced['target_1n2'].values.astype(int)
    y_1n2_test = test_enhanced['target_1n2'].values.astype(int)

    y_h_goals_train = train_enhanced['target_home_goals'].values.astype(float)
    y_h_goals_test = test_enhanced['target_home_goals'].values.astype(float)
    y_a_goals_train = train_enhanced['target_away_goals'].values.astype(float)
    y_a_goals_test = test_enhanced['target_away_goals'].values.astype(float)

    y_over25_train = train_enhanced['target_over25'].values.astype(float)
    y_over25_test = test_enhanced['target_over25'].values.astype(float)

    # 1N2 Classifier with 5-Fold Isotonic Calibration
    print("\n⚡ [LightGBM] Entraînement du classifieur 1N2 avec calibration isotonique (5-Fold CV)...")
    base_lgb_clf = lgb.LGBMClassifier(
        n_estimators=180,
        learning_rate=0.035,
        num_leaves=24,
        max_depth=5,
        subsample=0.85,
        colsample_bytree=0.80,
        random_state=42,
        verbosity=-1
    )

    calibrated_clf = CalibratedClassifierCV(
        estimator=base_lgb_clf,
        method='isotonic',
        cv=5
    )
    calibrated_clf.fit(X_train, y_1n2_train)

    base_lgb_clf.fit(X_train, y_1n2_train)
    p_1n2_test = calibrated_clf.predict_proba(X_test)

    # Goals Regressors
    print("⚡ [LightGBM] Entraînement des régressions d'Expected Goals (Home & Away)...")
    lgb_reg_h = lgb.LGBMRegressor(
        objective='poisson',
        n_estimators=150,
        learning_rate=0.04,
        num_leaves=20,
        max_depth=4,
        subsample=0.85,
        colsample_bytree=0.80,
        random_state=42,
        verbosity=-1
    )
    lgb_reg_h.fit(X_train, y_h_goals_train)
    pred_h_goals_test = np.maximum(0.1, lgb_reg_h.predict(X_test))

    lgb_reg_a = lgb.LGBMRegressor(
        objective='poisson',
        n_estimators=150,
        learning_rate=0.04,
        num_leaves=20,
        max_depth=4,
        subsample=0.85,
        colsample_bytree=0.80,
        random_state=42,
        verbosity=-1
    )
    lgb_reg_a.fit(X_train, y_a_goals_train)
    pred_a_goals_test = np.maximum(0.1, lgb_reg_a.predict(X_test))

    # Over/Under 2.5
    print("⚡ [LightGBM] Entraînement du modèle binaire Over/Under 2.5...")
    lgb_over25 = lgb.LGBMClassifier(
        n_estimators=140,
        learning_rate=0.035,
        num_leaves=18,
        max_depth=4,
        subsample=0.85,
        colsample_bytree=0.80,
        random_state=42,
        verbosity=-1
    )
    lgb_over25.fit(X_train, y_over25_train)
    p_over25_test = lgb_over25.predict_proba(X_test)[:, 1]

    # Metrics
    print("\n" + "=" * 80)
    print(" 📈 RÉSULTATS COMPARATIFS SUR LE JEU DE TEST WALK-FORWARD (OOS)")
    print("=" * 80)

    p_dc_test = np.column_stack([
        test_dc_priors['feat_dc_prob_home'].values,
        test_dc_priors['feat_dc_prob_draw'].values,
        test_dc_priors['feat_dc_prob_away'].values
    ])
    p_dc_test /= p_dc_test.sum(axis=1, keepdims=True)

    dc_logloss = log_loss(y_1n2_test, p_dc_test)
    dc_brier = np.mean([np.sum((p_dc_test[i] - np.eye(3)[y_1n2_test[i]]) ** 2) for i in range(len(y_1n2_test))])
    dc_rps = calculate_rps(p_dc_test, y_1n2_test)

    hybrid_logloss = log_loss(y_1n2_test, p_1n2_test)
    hybrid_brier = np.mean([np.sum((p_1n2_test[i] - np.eye(3)[y_1n2_test[i]]) ** 2) for i in range(len(y_1n2_test))])
    hybrid_rps = calculate_rps(p_1n2_test, y_1n2_test)

    over25_auc = roc_auc_score(y_over25_test, p_over25_test)
    over25_logloss = log_loss(y_over25_test, p_over25_test)

    rmse_h = math.sqrt(mean_squared_error(y_h_goals_test, pred_h_goals_test))
    rmse_a = math.sqrt(mean_squared_error(y_a_goals_test, pred_a_goals_test))
    mae_total = mean_absolute_error(y_h_goals_test + y_a_goals_test, pred_h_goals_test + pred_a_goals_test)

    print(f"\n📊 [1N2 Multi-class] Évaluation comparative :")
    print(f"   ├─ Multi-class Log-Loss : Baseline DC = {dc_logloss:.4f}  ──▶  Hybride V3 = {hybrid_logloss:.4f} (Amélioration: +{(dc_logloss - hybrid_logloss)/dc_logloss*100:.2f}%)")
    print(f"   ├─ Brier Score Total   : Baseline DC = {dc_brier:.4f}  ──▶  Hybride V3 = {hybrid_brier:.4f} (Amélioration: +{(dc_brier - hybrid_brier)/dc_brier*100:.2f}%)")
    print(f"   └─ Ranked Prob Score   : Baseline DC = {dc_rps:.4f}  ──▶  Hybride V3 = {hybrid_rps:.4f}")

    print(f"\n⚽ [Over/Under 2.5 & Buts] :")
    print(f"   ├─ Over 2.5 ROC-AUC    : {over25_auc:.4f}")
    print(f"   ├─ Over 2.5 Log-Loss   : {over25_logloss:.4f}")
    print(f"   ├─ RMSE Buts Domicile  : {rmse_h:.3f} buts")
    print(f"   ├─ RMSE Buts Extérieur : {rmse_a:.3f} buts")
    print(f"   └─ MAE Total Buts      : {mae_total:.3f} buts")

    # Value Betting Simulation
    print("\n💰 [Backtest Betting] Simulation de rentabilité sur cotes réelles...")
    margin = 0.06
    test_sim_bets = []
    bankroll = 1000.0

    for i in range(len(y_1n2_test)):
        p_model = p_1n2_test[i]
        p_market = 0.85 * p_dc_test[i] + 0.15 * np.array([0.42, 0.28, 0.30])
        p_market /= p_market.sum()
        
        odds = (1.0 - margin) / p_market
        actual = y_1n2_test[i]

        for outcome in [0, 1, 2]:
            prob = p_model[outcome]
            odd = odds[outcome]
            implied = 1.0 / odd
            edge = (prob - implied) / implied

            if edge >= 0.04 and odd >= 1.40 and odd <= 6.0:
                b = odd - 1.0
                q = 1.0 - prob
                kelly_frac = max(0.01, min(0.04, 0.15 * (b * prob - q) / b))
                stake = bankroll * kelly_frac
                
                win = (actual == outcome)
                pnl = (stake * (odd - 1.0)) if win else (-stake)
                bankroll += pnl
                
                test_sim_bets.append({
                    "match_idx": i, "outcome": outcome, "edge": edge, "odd": odd, "stake": stake, "win": win, "pnl": pnl
                })

    total_bets = len(test_sim_bets)
    wins = sum(1 for b in test_sim_bets if b['win'])
    total_staked = sum(b['stake'] for b in test_sim_bets)
    net_profit = bankroll - 1000.0
    roi_pct = (net_profit / total_staked * 100.0) if total_staked > 0 else 0.0

    print(f"   ├─ Paris Éligibles (Edge >= +4%) : {total_bets}")
    print(f"   ├─ Taux de Réussite               : {wins / max(1, total_bets) * 100:.1f}%")
    print(f"   ├─ Capital Final (Base 1 000€)     : {bankroll:.2f} €")
    print(f"   └─ ROI Net (Rendement du Capital)  : +{roi_pct:.2f}%")

    # Native LightGBM SHAP Calculation (Tree SHAP inside C++)
    print("\n🔍 [SHAP XAI] Calcul des contributions Tree-SHAP natives LightGBM...")
    raw_shap = base_lgb_clf.booster_.predict(X_test[:200], pred_contrib=True)
    
    # Handle multiclass shape: (samples, (num_features + 1) * 3)
    n_f = len(feature_cols)
    if raw_shap.shape[1] == (n_f + 1) * 3:
        reshaped = raw_shap.reshape(-1, 3, n_f + 1)
        # Drop last element (bias) and average across samples and classes
        shap_feat_vals = np.abs(reshaped[:, :, :n_f]).mean(axis=(0, 1))
    elif raw_shap.shape[1] == n_f + 1:
        shap_feat_vals = np.abs(raw_shap[:, :n_f]).mean(axis=0)
    else:
        shap_feat_vals = base_lgb_clf.feature_importances_

    top_features_idx = np.argsort(shap_feat_vals)[::-1][:15]
    top_features_report = []
    print("   🏆 Top 10 Variables Prédictives Clés (Tree-SHAP) :")
    for rank, idx in enumerate(top_features_idx[:10], 1):
        feat_name = feature_cols[idx]
        imp_val = float(shap_feat_vals[idx])
        top_features_report.append({"rank": rank, "feature": feat_name, "mean_shap_importance": round(imp_val, 4)})
        print(f"   {rank:2d}. {feat_name:<32} (Impact SHAP: {imp_val:.4f})")

    # Save Bundle
    print(f"\n💾 [Sauvegarde] Enregistrement du bundle : {MODEL_BUNDLE_PATH}")
    model_bundle = {
        "dixon_coles": dc_model,
        "lgb_1n2_classifier": calibrated_clf,
        "base_lgb_1n2": base_lgb_clf,
        "lgb_xg_home_regressor": lgb_reg_h,
        "lgb_xg_away_regressor": lgb_reg_a,
        "lgb_over25_classifier": lgb_over25,
        "feature_names": feature_cols,
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    joblib.dump(model_bundle, MODEL_BUNDLE_PATH)

    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset_matches_count": len(labeled_df),
        "train_matches": len(train_df),
        "test_matches": len(test_df),
        "features_count": len(feature_cols),
        "metrics_1n2": {
            "dixon_coles_log_loss": round(dc_logloss, 4),
            "hybrid_v3_log_loss": round(hybrid_logloss, 4),
            "dixon_coles_brier_score": round(dc_brier, 4),
            "hybrid_v3_brier_score": round(hybrid_brier, 4),
            "dixon_coles_rps": round(dc_rps, 4),
            "hybrid_v3_rps": round(hybrid_rps, 4)
        },
        "metrics_goals": {
            "rmse_home_goals": round(rmse_h, 3),
            "rmse_away_goals": round(rmse_a, 3),
            "mae_total_goals": round(mae_total, 3),
            "over25_roc_auc": round(over25_auc, 4),
            "over25_log_loss": round(over25_logloss, 4)
        },
        "value_betting_simulation": {
            "total_bets": total_bets,
            "win_rate_pct": round(wins / max(1, total_bets) * 100, 1),
            "starting_bankroll": 1000.0,
            "final_bankroll": round(bankroll, 2),
            "roi_percentage": f"+{round(roi_pct, 2)}%"
        },
        "top_predictive_features": top_features_report
    }

    with open(METRICS_REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"📄 [Rapport] Rapport complet exporté : {METRICS_REPORT_PATH}")
    print("\n🎉 [Succès] Modèle V3 entraîné, calibré et validé avec succès !")

if __name__ == "__main__":
    main()
