#!/usr/bin/env python3
"""
scripts/ml/predict_match_v3.py
─────────────────────────────────────────────────────────────
Real-time Inference Engine with SHAP Explicability (Football Quant Engine V3):
Loads calibrated hybrid model bundle (Dixon-Coles + LightGBM multi-task)
and predicts on-demand match outcomes with SHAP local factor attributions.
"""

import os
import sys
import json
import math
import argparse
import numpy as np
import pandas as pd
import joblib
from scipy.stats import poisson

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from scripts.ml.dixon_coles_model import FastDixonColesModel
MODEL_BUNDLE_PATH = os.path.join(ROOT_DIR, "models", "football_quant_model_v3.joblib")
FEATURE_DATASET_PATH = os.path.join(ROOT_DIR, "data", "ml_features_dataset.parquet")

_CACHED_BUNDLE = None
_CACHED_HIST_DF = None
_CACHED_PLAYERS = None

def load_bundle():
    global _CACHED_BUNDLE
    if _CACHED_BUNDLE is not None:
        return _CACHED_BUNDLE
    if not os.path.exists(MODEL_BUNDLE_PATH):
        raise FileNotFoundError(f"Model bundle not found at: {MODEL_BUNDLE_PATH}. Please train the model first.")
    _CACHED_BUNDLE = joblib.load(MODEL_BUNDLE_PATH)
    return _CACHED_BUNDLE

def normalize_text(s):
    if not s: return ""
    import unicodedata
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode('utf-8')
    return s.lower().replace("-", " ").replace("_", " ").strip()

def load_players_db():
    global _CACHED_PLAYERS
    if _CACHED_PLAYERS is not None:
        return _CACHED_PLAYERS

    rosters = {}
    real_path = os.path.join(ROOT_DIR, "src", "data", "real_players.json")
    if os.path.exists(real_path):
        try:
            with open(real_path, 'r', encoding='utf-8') as f:
                raw = json.load(f)
                for club, plist in raw.items():
                    k = normalize_text(club)
                    rosters[k] = plist
        except Exception:
            pass

    flat_players = []
    flat_path = os.path.join(ROOT_DIR, "src", "data", "players.json")
    if os.path.exists(flat_path):
        try:
            with open(flat_path, 'r', encoding='utf-8') as f:
                flat_players = json.load(f)
        except Exception:
            pass

    _CACHED_PLAYERS = {"rosters": rosters, "flat": flat_players}
    return _CACHED_PLAYERS

def get_club_players(team_name):
    db = load_players_db()
    norm = normalize_text(team_name)
    rosters = db.get("rosters", {})

    if norm in rosters and len(rosters[norm]) > 0:
        return rosters[norm]

    for k, plist in rosters.items():
        if k in norm or norm in k:
            return plist

    flat = db.get("flat", [])
    matched = [p for p in flat if normalize_text(p.get("team", "")) in norm or norm in normalize_text(p.get("team", ""))]
    if matched:
        return matched

    return []

def generate_exact_score_matrix(lambda_h, lambda_a, rho=-0.05, max_goals=6):
    def tau(x, y):
        if x == 0 and y == 0: return max(1e-5, 1.0 - lambda_h * lambda_a * rho)
        elif x == 0 and y == 1: return max(1e-5, 1.0 + lambda_h * rho)
        elif x == 1 and y == 0: return max(1e-5, 1.0 + lambda_a * rho)
        elif x == 1 and y == 1: return max(1e-5, 1.0 - rho)
        return 1.0

    scores = []
    matrix = np.zeros((max_goals + 1, max_goals + 1))
    for x in range(max_goals + 1):
        for y in range(max_goals + 1):
            p_base = poisson.pmf(x, lambda_h) * poisson.pmf(y, lambda_a)
            p_adj = max(0.0, p_base * tau(x, y))
            matrix[x, y] = p_adj
            scores.append({"score": f"{x}-{y}", "prob": p_adj})

    total_p = matrix.sum()
    if total_p > 0:
        for s in scores:
            s["prob"] = round(float(s["prob"] / total_p * 100), 1)

    scores.sort(key=lambda s: s["prob"], reverse=True)
    return scores[:6]

def generate_half_time_exact_score_matrix(lambda_h, lambda_a, rho=-0.05, max_goals=4):
    ht_lambda_h = round(float(max(0.10, lambda_h * 0.43)), 2)
    ht_lambda_a = round(float(max(0.08, lambda_a * 0.43)), 2)

    def tau(x, y):
        if x == 0 and y == 0: return max(1e-5, 1.0 - ht_lambda_h * ht_lambda_a * rho)
        elif x == 0 and y == 1: return max(1e-5, 1.0 + ht_lambda_h * rho)
        elif x == 1 and y == 0: return max(1e-5, 1.0 + ht_lambda_a * rho)
        elif x == 1 and y == 1: return max(1e-5, 1.0 - rho)
        return 1.0

    scores = []
    matrix = np.zeros((max_goals + 1, max_goals + 1))
    for x in range(max_goals + 1):
        for y in range(max_goals + 1):
            p_base = poisson.pmf(x, ht_lambda_h) * poisson.pmf(y, ht_lambda_a)
            p_adj = max(0.0, p_base * tau(x, y))
            matrix[x, y] = p_adj
            scores.append({"score": f"{x}-{y}", "prob": p_adj})

    total_p = matrix.sum()
    if total_p > 0:
        for s in scores:
            s["prob"] = round(float(s["prob"] / total_p * 100), 1)

    scores.sort(key=lambda s: s["prob"], reverse=True)
    return scores[:5]

def predict_team_scorers_and_assists(team_name, lambda_team, is_home=True):
    players = get_club_players(team_name)
    if not players:
        def_players = [
            {"name": f"Buteur ({team_name})", "pos": "Attaquant", "position": "FW", "rating": 7.8, "goals": 10, "assists": 4},
            {"name": f"Ailier ({team_name})", "pos": "Attaquant", "position": "FW", "rating": 7.5, "goals": 7, "assists": 6},
            {"name": f"Meneur de Jeu ({team_name})", "pos": "Milieu", "position": "MF", "rating": 7.6, "goals": 4, "assists": 8},
            {"name": f"Ailier Droit ({team_name})", "pos": "Attaquant", "position": "FW", "rating": 7.3, "goals": 5, "assists": 5},
            {"name": f"Milieu Relayeur ({team_name})", "pos": "Milieu", "position": "MF", "rating": 7.2, "goals": 3, "assists": 4},
        ]
        players = def_players

    outfield = []
    seen_names = set()
    for p in players:
        p_name = p.get("name") or p.get("Player") or "Joueur"
        if p_name in seen_names:
            continue
        seen_names.add(p_name)

        raw_pos = str(p.get("position") or p.get("pos") or "MF").upper().strip()
        if raw_pos in ["G", "GK", "GARDIEN"]:
            continue
        
        is_fw = (raw_pos == "A") or any(k in raw_pos for k in ["FW", "ATT", "AILIER", "BU", "AG", "AD", "AVANT", "ST", "CF"])
        is_mf = (raw_pos == "M") or any(k in raw_pos for k in ["MF", "MIL", "MC", "MDC", "MOC", "MD", "MG"])
        is_df = (raw_pos == "D") or any(k in raw_pos for k in ["DF", "DEF", "DC", "DD", "DG", "LAT", "CB", "LB", "RB"])

        pos_weight_goal = 1.0 if is_fw else (0.35 if is_mf else 0.08)
        pos_weight_ast = 0.80 if is_fw else (1.0 if is_mf else 0.20)

        goals = float(p.get("goals", p.get("Gls", 0)) or 0)
        assists = float(p.get("assists", p.get("Ast", 0)) or 0)
        xg90 = float(p.get("xG90", p.get("xG", 0.25 if is_fw else (0.12 if is_mf else 0.04))) or 0.15)
        xa90 = float(p.get("xA90", p.get("xAG", 0.20 if is_mf else (0.15 if is_fw else 0.05))) or 0.10)
        rating = float(p.get("rating", 7.0) or 7.0)

        w_goal = pos_weight_goal * (1.0 + goals * 0.20 + xg90 * 2.0 + (rating - 7.0) * 0.15)
        w_ast = pos_weight_ast * (1.0 + assists * 0.25 + xa90 * 2.2 + (rating - 7.0) * 0.15)

        photo_url = p.get("photoUrl", "")
        pos_code = "FW" if is_fw else ("MF" if is_mf else "DF")

        outfield.append({
            "name": p_name,
            "pos": pos_code,
            "photoUrl": photo_url,
            "w_goal": max(0.05, w_goal),
            "w_ast": max(0.05, w_ast),
            "goals": int(goals),
            "assists": int(assists),
            "xg90": round(xg90, 2),
            "xa90": round(xa90, 2)
        })

    tot_w_goal = sum(o["w_goal"] for o in outfield) or 1.0
    tot_w_ast = sum(o["w_ast"] for o in outfield) or 1.0

    scorers = []
    assisters = []

    for o in outfield:
        exp_g = lambda_team * (o["w_goal"] / tot_w_goal)
        p_goal = min(0.85, 1.0 - math.exp(-exp_g))
        odd_g = max(1.20, round(1.0 / (p_goal * 0.90), 2)) if p_goal > 0 else 9.0

        scorers.append({
            "name": o["name"],
            "team": team_name,
            "position": o["pos"],
            "photoUrl": o["photoUrl"],
            "goalProb": f"{round(p_goal * 100, 1)}%",
            "goalProbVal": round(p_goal * 100, 1),
            "oddScorer": odd_g,
            "xGMatch": round(exp_g, 2),
            "seasonGoals": o["goals"]
        })

        exp_a = (lambda_team * 0.70) * (o["w_ast"] / tot_w_ast)
        p_ast = min(0.70, 1.0 - math.exp(-exp_a))
        odd_a = max(1.40, round(1.0 / (p_ast * 0.90), 2)) if p_ast > 0 else 12.0

        assisters.append({
            "name": o["name"],
            "team": team_name,
            "position": o["pos"],
            "photoUrl": o["photoUrl"],
            "assistProb": f"{round(p_ast * 100, 1)}%",
            "assistProbVal": round(p_ast * 100, 1),
            "oddAssist": odd_a,
            "xAMatch": round(exp_a, 2),
            "seasonAssists": o["assists"]
        })

    scorers.sort(key=lambda s: s["goalProbVal"], reverse=True)
    assisters.sort(key=lambda a: a["assistProbVal"], reverse=True)

    return scorers[:4], assisters[:3]

_TEAM_STATS_CACHE = None

def get_team_rolling_stats():
    global _TEAM_STATS_CACHE
    if _TEAM_STATS_CACHE is not None:
        return _TEAM_STATS_CACHE
    
    _TEAM_STATS_CACHE = {}
    if os.path.exists(FEATURE_DATASET_PATH):
        try:
            df = pd.read_parquet(FEATURE_DATASET_PATH)
            for _, row in df.iterrows():
                ht = row.get('home_team')
                if ht:
                    _TEAM_STATS_CACHE[ht] = {
                        "h_pts": float(row.get("feat_h_rolling_pts", 1.8)),
                        "h_xg_for": float(row.get("feat_h_rolling_xg_for", 1.9)),
                        "h_xg_against": float(row.get("feat_h_rolling_xg_against", 1.0)),
                        "h_xg_diff": float(row.get("feat_h_rolling_xg_diff", 0.9)),
                    }
                at = row.get('away_team')
                if at:
                    if at not in _TEAM_STATS_CACHE:
                        _TEAM_STATS_CACHE[at] = {}
                    _TEAM_STATS_CACHE[at].update({
                        "a_pts": float(row.get("feat_a_rolling_pts", 1.2)),
                        "a_xg_for": float(row.get("feat_a_rolling_xg_for", 1.3)),
                        "a_xg_against": float(row.get("feat_a_rolling_xg_against", 1.4)),
                        "a_xg_diff": float(row.get("feat_a_rolling_xg_diff", -0.1)),
                    })
        except Exception:
            pass
    return _TEAM_STATS_CACHE

def predict_single_match(home_team, away_team, odd_home=None, odd_draw=None, odd_away=None,
                         weather_temp=18.0, weather_rain=0.0, weather_wind=12.0,
                         referee_name="Clément Turpin", home_formation="4-3-3", away_formation="4-2-3-1",
                         h_absentees=0, a_absentees=0, rest_days_h=7, rest_days_a=7,
                         compute_shap=True):
    bundle = load_bundle()
    dc_model = bundle["dixon_coles"]
    clf_1n2 = bundle["lgb_1n2_classifier"]
    base_lgb = bundle.get("base_lgb_1n2", clf_1n2)
    reg_h = bundle["lgb_xg_home_regressor"]
    reg_a = bundle["lgb_xg_away_regressor"]
    clf_over25 = bundle["lgb_over25_classifier"]
    feature_names = bundle["feature_names"]

    # 1. Base Dixon-Coles prior
    dc_pred = dc_model.predict_match(home_team, away_team)

    # 2. Build feature vector
    feat_dict = {f: 0.0 for f in feature_names}
    
    # Weather
    feat_dict["feat_weather_temp_norm"] = (weather_temp - 15.0) / 8.0
    feat_dict["feat_weather_wind_norm"] = (weather_wind - 12.0) / 7.0
    feat_dict["feat_weather_precip_log"] = math.log(1.0 + weather_rain)
    feat_dict["feat_weather_is_freezing"] = 1.0 if weather_temp <= 0.0 else 0.0
    feat_dict["feat_weather_is_heavy_rain"] = 1.0 if weather_rain >= 4.0 else 0.0
    feat_dict["feat_weather_is_high_wind"] = 1.0 if weather_wind >= 30.0 else 0.0
    feat_dict["feat_weather_friction_index"] = 0.45 * feat_dict["feat_weather_is_heavy_rain"] + 0.35 * feat_dict["feat_weather_is_high_wind"] + 0.20 * feat_dict["feat_weather_is_freezing"]

    # Referee
    is_strict = any(n in referee_name for n in ["Turpin", "Oliver", "Gil", "Kovacs", "Letexier"])
    feat_dict["feat_ref_severity_index"] = 0.8 if is_strict else 0.0
    feat_dict["feat_ref_z_yellow"] = 0.7 if is_strict else 0.0

    # Tactics & Effectif
    feat_dict["feat_h_rotation_rate"] = 0.15
    feat_dict["feat_a_rotation_rate"] = 0.15
    feat_dict["feat_h_absentees_count"] = float(h_absentees)
    feat_dict["feat_a_absentees_count"] = float(a_absentees)
    feat_dict["feat_absentees_delta"] = float(h_absentees - a_absentees)

    # Rest
    feat_dict["feat_h_rest_days"] = float(rest_days_h)
    feat_dict["feat_a_rest_days"] = float(rest_days_a)
    feat_dict["feat_rest_delta"] = float(rest_days_h - rest_days_a)

    # Priors DC
    feat_dict["feat_dc_home_xg"] = dc_pred["lambda_home"]
    feat_dict["feat_dc_away_xg"] = dc_pred["lambda_away"]
    feat_dict["feat_dc_prob_home"] = dc_pred["prob_home"]
    feat_dict["feat_dc_prob_draw"] = dc_pred["prob_draw"]
    feat_dict["feat_dc_prob_away"] = dc_pred["prob_away"]

    # Fast cache lookup for team rolling stats
    team_stats = get_team_rolling_stats()
    h_s = team_stats.get(home_team, {})
    a_s = team_stats.get(away_team, {})

    h_pts = h_s.get("h_pts", 1.8)
    h_xg_f = h_s.get("h_xg_for", 1.9)
    h_xg_a = h_s.get("h_xg_against", 1.0)
    h_xg_d = h_s.get("h_xg_diff", 0.9)

    a_pts = a_s.get("a_pts", 1.2)
    a_xg_f = a_s.get("a_xg_for", 1.3)
    a_xg_a = a_s.get("a_xg_against", 1.4)
    a_xg_d = a_s.get("a_xg_diff", -0.1)

    feat_dict["feat_h_rolling_pts"] = h_pts
    feat_dict["feat_h_rolling_xg_for"] = h_xg_f
    feat_dict["feat_h_rolling_xg_against"] = h_xg_a
    feat_dict["feat_h_rolling_xg_diff"] = h_xg_d

    feat_dict["feat_a_rolling_pts"] = a_pts
    feat_dict["feat_a_rolling_xg_for"] = a_xg_f
    feat_dict["feat_a_rolling_xg_against"] = a_xg_a
    feat_dict["feat_a_rolling_xg_diff"] = a_xg_d

    feat_dict["feat_rolling_pts_delta"] = h_pts - a_pts
    feat_dict["feat_rolling_xg_diff_delta"] = h_xg_d - a_xg_d

    X = np.array([[feat_dict[f] for f in feature_names]])

    # 3. Model Predictions
    probs_1n2 = clf_1n2.predict_proba(X)[0]
    p_h = round(float(probs_1n2[0] * 100), 1)
    p_d = round(float(probs_1n2[1] * 100), 1)
    p_a = round(float(probs_1n2[2] * 100), 1)

    lambda_h = round(float(max(0.2, reg_h.predict(X)[0])), 2)
    lambda_a = round(float(max(0.1, reg_a.predict(X)[0])), 2)

    p_over25 = round(float(clf_over25.predict_proba(X)[0, 1] * 100), 1)
    p_under25 = round(100.0 - p_over25, 1)

    top_ft_scores = generate_exact_score_matrix(lambda_h, lambda_a, rho=dc_model.rho)
    top_ht_scores = generate_half_time_exact_score_matrix(lambda_h, lambda_a, rho=dc_model.rho)

    home_scorers, home_assists = predict_team_scorers_and_assists(home_team, lambda_h, is_home=True)
    away_scorers, away_assists = predict_team_scorers_and_assists(away_team, lambda_a, is_home=False)

    # 4. Strict Certified Value Bet Evaluation (Edge >= 2.0%)
    value_bets = []
    if odd_home and float(odd_home) > 1.0:
        edge_h = (probs_1n2[0] * float(odd_home) - 1.0) * 100
        if edge_h >= 2.0:
            value_bets.append({
                "market": "1N2",
                "selection": "1",
                "selection_label": f"Victoire {home_team} (1)",
                "side": f"1 (Victoire {home_team})",
                "team": home_team,
                "model_prob": f"{p_h}%",
                "model_probability": f"{p_h}%",
                "odd": float(odd_home),
                "bookmaker_odds": float(odd_home),
                "betclic_odd": float(odd_home),
                "edge": f"+{round(edge_h, 1)}%",
                "edge_percentage": f"+{round(edge_h, 1)}%",
                "stake_recommendation": f"{round(1.0 + edge_h * 0.25, 1)}%",
                "is_value": True
            })
    if odd_draw and float(odd_draw) > 1.0:
        edge_d = (probs_1n2[1] * float(odd_draw) - 1.0) * 100
        if edge_d >= 2.0:
            value_bets.append({
                "market": "1N2",
                "selection": "N",
                "selection_label": "Match Nul (N)",
                "side": "N (Match Nul)",
                "team": "Match Nul",
                "model_prob": f"{p_d}%",
                "model_probability": f"{p_d}%",
                "odd": float(odd_draw),
                "bookmaker_odds": float(odd_draw),
                "betclic_odd": float(odd_draw),
                "edge": f"+{round(edge_d, 1)}%",
                "edge_percentage": f"+{round(edge_d, 1)}%",
                "stake_recommendation": f"{round(1.0 + edge_d * 0.25, 1)}%",
                "is_value": True
            })
    if odd_away and float(odd_away) > 1.0:
        edge_a = (probs_1n2[2] * float(odd_away) - 1.0) * 100
        if edge_a >= 2.0:
            value_bets.append({
                "market": "1N2",
                "selection": "2",
                "selection_label": f"Victoire {away_team} (2)",
                "side": f"2 (Victoire {away_team})",
                "team": away_team,
                "model_prob": f"{p_a}%",
                "model_probability": f"{p_a}%",
                "odd": float(odd_away),
                "bookmaker_odds": float(odd_away),
                "betclic_odd": float(odd_away),
                "edge": f"+{round(edge_a, 1)}%",
                "edge_percentage": f"+{round(edge_a, 1)}%",
                "stake_recommendation": f"{round(1.0 + edge_a * 0.25, 1)}%",
                "is_value": True
            })

    # 5. Tree-SHAP Factor Attributions
    b_lgb = base_lgb.estimator if hasattr(base_lgb, 'estimator') else base_lgb
    booster = b_lgb.booster_ if hasattr(b_lgb, 'booster_') else None
    
    factor_explanations = []
    FEATURE_LABELS = {
        "feat_dc_prob_home": "Poids Fondamental Historique (Dixon-Coles)",
        "feat_dc_prob_away": "Poids Fondamental Adversaire",
        "feat_rolling_xg_diff_delta": "Dynamique Récente (Différentiel xG sur 5 matchs)",
        "feat_rolling_pts_delta": "Forme Récente en Points",
        "feat_absentees_delta": "Impact des Absences et Forfaits Clés",
        "feat_ref_severity_index": "Indice de Sévérité de l'Arbitre",
        "feat_weather_friction_index": "Conditions Météorologiques & Friction Terrain",
        "feat_rest_delta": "Fraîcheur Physique & Jours de Repos",
        "feat_tactical_formation_edge": "Confrontation des Schémas Tactiques",
        "feat_h_rolling_xg_for": "Potentiel Offensif Récent (Home)",
        "feat_a_rolling_xg_for": "Potentiel Offensif Récent (Away)"
    }

    if booster and compute_shap:
        raw_shap = booster.predict(X, pred_contrib=True)
        n_f = len(feature_names)
        win_class = 0 if p_h >= p_a else 2
        
        if raw_shap.shape[1] == (n_f + 1) * 3:
            reshaped = raw_shap.reshape(-1, 3, n_f + 1)
            class_shap = reshaped[0, win_class, :n_f]
        else:
            class_shap = raw_shap[0, :n_f]

        top_idx = np.argsort(np.abs(class_shap))[::-1][:6]
        for idx in top_idx:
            fname = feature_names[idx]
            val = class_shap[idx]
            impact_pct = round(float(val * 100), 1)
            if abs(impact_pct) >= 0.3:
                label = FEATURE_LABELS.get(fname, fname)
                sign = "+" if impact_pct > 0 else ""
                factor_explanations.append({
                    "factor": label,
                    "impact": f"{sign}{impact_pct}%",
                    "direction": "FAVORABLE" if impact_pct > 0 else "DEFAVORABLE"
                })

    return {
        "match": f"{home_team} vs {away_team}",
        "probabilities_1n2": {
            "1_home_win": f"{p_h}%",
            "N_draw": f"{p_d}%",
            "2_away_win": f"{p_a}%"
        },
        "expected_goals": {
            "home_xg": lambda_h,
            "away_xg": lambda_a,
            "total_xg": round(lambda_h + lambda_a, 2)
        },
        "over_under_2_5": {
            "over_2_5_prob": f"{p_over25}%",
            "under_2_5_prob": f"{p_under25}%",
            "prediction": "Over 2.5" if p_over25 > 50 else "Under 2.5"
        },
        "top_exact_scores": top_ft_scores,
        "top_half_time_scores": top_ht_scores,
        "potential_scorers": {
            "home": home_scorers,
            "away": away_scorers
        },
        "potential_assists": {
            "home": home_assists,
            "away": away_assists
        },
        "value_bets_detected": value_bets,
        "xai_shap_factors": factor_explanations
    }

def main():
    parser = argparse.ArgumentParser(description="Predict match outcome with Football Quant Engine V3")
    parser.add_argument("--home", type=str, default="PSG")
    parser.add_argument("--away", type=str, default="Marseille")
    parser.add_argument("--odd_home", type=float, default=1.65)
    parser.add_argument("--odd_draw", type=float, default=4.10)
    parser.add_argument("--odd_away", type=float, default=5.50)
    parser.add_argument("--temp", type=float, default=22.0)
    parser.add_argument("--rain", type=float, default=0.0)
    parser.add_argument("--wind", type=float, default=12.0)
    parser.add_argument("--referee", type=str, default="Clément Turpin")
    parser.add_argument("--h_absent", type=int, default=1)
    parser.add_argument("--a_absent", type=int, default=0)

    args = parser.parse_args()

    result = predict_single_match(
        home_team=args.home,
        away_team=args.away,
        odd_home=args.odd_home,
        odd_draw=args.odd_draw,
        odd_away=args.odd_away,
        weather_temp=args.temp,
        weather_rain=args.rain,
        weather_wind=args.wind,
        referee_name=args.referee,
        h_absentees=args.h_absent,
        a_absentees=args.a_absent
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
