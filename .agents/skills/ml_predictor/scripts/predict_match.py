#!/usr/bin/env python3
"""
Predictive Engine & Value Bet Finder for European Football Predictor V2.
Uses Poisson distribution and expected goals (xG) incorporating weather & odds edge.
"""

import sys
import json
import math
import argparse

def poisson_pmf(k, lambd):
    """Computes Poisson probability P(X = k) with parameter lambda."""
    if lambd <= 0:
        return 1.0 if k == 0 else 0.0
    return (math.pow(lambd, k) * math.exp(-lambd)) / math.factorial(k)

def calculate_match_probabilities(xg_home, xg_away, max_goals=6):
    """
    Generates exact score matrix (0..max_goals) and sums 1N2 probabilities.
    """
    prob_matrix = []
    prob_home = 0.0
    prob_draw = 0.0
    prob_away = 0.0
    exact_scores = []
    
    for h in range(max_goals + 1):
        row = []
        p_h = poisson_pmf(h, xg_home)
        for a in range(max_goals + 1):
            p_a = poisson_pmf(a, xg_away)
            p_exact = p_h * p_a
            row.append(p_exact)
            
            exact_scores.append({
                "score": f"{h}-{a}",
                "prob": round(p_exact * 100, 2)
            })
            
            if h > a:
                prob_home += p_exact
            elif h == a:
                prob_draw += p_exact
            else:
                prob_away += p_exact
        prob_matrix.append(row)
        
    # Sort top 5 exact scores
    exact_scores.sort(key=lambda x: x["prob"], reverse=True)
    
    return {
        "prob_home": round(prob_home * 100, 2),
        "prob_draw": round(prob_draw * 100, 2),
        "prob_away": round(prob_away * 100, 2),
        "top_exact_scores": exact_scores[:5]
    }

def detect_value_bets(prob_home, prob_draw, prob_away, odd_home, odd_draw, odd_away, edge_threshold=0.05):
    """
    Calculates Edge percentage against Betclic odds.
    Edge = (Model Probability * Bookmaker Odds) - 1.0
    """
    outcomes = [
        {"side": "1 (Home)", "prob": prob_home / 100.0, "odd": odd_home},
        {"side": "N (Draw)", "prob": prob_draw / 100.0, "odd": odd_draw},
        {"side": "2 (Away)", "prob": prob_away / 100.0, "odd": odd_away}
    ]
    
    value_bets = []
    for item in outcomes:
        if item["odd"] and item["odd"] > 1.0:
            expected_value = (item["prob"] * item["odd"]) - 1.0
            if expected_value >= edge_threshold:
                value_bets.append({
                    "side": item["side"],
                    "model_prob": f"{round(item['prob']*100, 1)}%",
                    "betclic_odd": item["odd"],
                    "edge_percentage": f"+{round(expected_value * 100, 1)}%",
                    "is_value": True
                })
                
    return value_bets

def main():
    parser = argparse.ArgumentParser(description="Predict match outcome and detect Value Bets")
    parser.add_argument("--home", type=str, default="PSG")
    parser.add_argument("--away", type=str, default="Marseille")
    parser.add_argument("--xg_home", type=float, default=2.1)
    parser.add_argument("--xg_away", type=float, default=0.9)
    parser.add_argument("--odd_home", type=float, default=1.65)
    parser.add_argument("--odd_draw", type=float, default=4.10)
    parser.add_argument("--odd_away", type=float, default=5.50)
    
    args = parser.parse_args()
    
    probs = calculate_match_probabilities(args.xg_home, args.xg_away)
    values = detect_value_bets(
        probs["prob_home"], probs["prob_draw"], probs["prob_away"],
        args.odd_home, args.odd_draw, args.odd_away
    )
    
    result = {
        "match": f"{args.home} vs {args.away}",
        "expected_goals": {"home": args.xg_home, "away": args.xg_away},
        "probabilities_1N2": {
            "1_home_win": f"{probs['prob_home']}%",
            "N_draw": f"{probs['prob_draw']}%",
            "2_away_win": f"{probs['prob_away']}%"
        },
        "top_exact_scores": probs["top_exact_scores"],
        "betclic_odds": {"1": args.odd_home, "N": args.odd_draw, "2": args.odd_away},
        "value_bets_found": values
    }
    
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
