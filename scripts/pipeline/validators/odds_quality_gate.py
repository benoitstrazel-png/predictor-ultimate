#!/usr/bin/env python3
"""
scripts/pipeline/validators/odds_quality_gate.py
─────────────────────────────────────────────────────────────
Data Quality Gate Strict pour l'ingestion des cotes Betclic :
- Validation mathematique du Taux de Retour Joueur (TRJ) et Marge Bookmaker
- Bornes de securite (1.015 <= Cote <= 80.0)
- Rejet immediat des mocks et placeholders artificiels
- Controle de derive temporelle (Drift <= 30%)
"""

import sys
import math
from typing import Dict, Any, Optional, Tuple

sys.stdout.reconfigure(encoding='utf-8')

MOCK_REPETITIVE_PATTERNS = {
    (2.10, 3.40, 3.50),
    (1.85, 3.60, 4.20),
    (1.95, 3.40, 3.80),
    (2.00, 3.00, 3.50),
    (1.50, 3.50, 5.00)
}

def calculate_margin_metrics(odd_home: float, odd_draw: Optional[float], odd_away: float) -> Tuple[float, float, float]:
    """
    Calcule l'overround (somme des probabilites implicites), la marge en % et le TRJ en %.
    """
    if odd_home <= 0 or odd_away <= 0:
        raise ValueError("Les cotes doivent etre strictement positives.")
    
    inv_sum = (1.0 / odd_home) + (1.0 / odd_away)
    if odd_draw is not None and odd_draw > 0:
        inv_sum += (1.0 / odd_draw)
        
    margin_pct = (inv_sum - 1.0) * 100.0
    payout_trj = (1.0 / inv_sum) * 100.0
    return round(inv_sum, 4), round(margin_pct, 2), round(payout_trj, 2)

def validate_odds_record(
    home_team: str,
    away_team: str,
    odd_home: float,
    odd_draw: Optional[float],
    odd_away: float,
    prev_odd_home: Optional[float] = None,
    prev_odd_away: Optional[float] = None
) -> Dict[str, Any]:
    """
    Valide un enregistrement de cotes selon les Quality Gates.
    """
    anomalies = []
    
    # 1. Verification des bornes
    for side, odd in [('Domicile', odd_home), ('Nul', odd_draw), ('Exterieur', odd_away)]:
        if odd is not None:
            if math.isnan(odd) or math.isinf(odd):
                anomalies.append(f"Cote {side} invalide (NaN ou Infini).")
            elif odd <= 1.015:
                anomalies.append(f"Cote {side} anormalement basse ({odd} <= 1.015).")
            elif odd > 80.0:
                anomalies.append(f"Cote {side} anormalement haute ({odd} > 80.0).")

    # 2. Detection de pattern mock hardcode
    trip = (round(odd_home, 2), round(odd_draw, 2) if odd_draw else None, round(odd_away, 2))
    if trip in MOCK_REPETITIVE_PATTERNS:
        anomalies.append(f"Pattern mock / placeholder artificiel identifie ({trip}).")

    # 3. Calcul de marge et verification de la fourchette Betclic (3% a 12%)
    try:
        overround, margin_pct, payout_trj = calculate_margin_metrics(odd_home, odd_draw, odd_away)
        if overround < 1.025:
            anomalies.append(f"Marge impossible ou anormalement basse chez le bookmaker ({margin_pct}% < 2.5%).")
        elif overround > 1.14:
            anomalies.append(f"Marge excessivement elevee ({margin_pct}% > 14.0%).")
    except Exception as e:
        anomalies.append(f"Erreur de calcul de marge : {e}")
        overround, margin_pct, payout_trj = 0.0, 0.0, 0.0

    # 4. Controle de volatilite / saut de cote brutal (> 30%)
    if prev_odd_home and prev_odd_home > 0:
        drift_h = abs(odd_home - prev_odd_home) / prev_odd_home
        if drift_h > 0.30:
            anomalies.append(f"Drift brutal sur la cote domicile ({drift_h*100:.1f}% > 30%).")
            
    if prev_odd_away and prev_odd_away > 0:
        drift_a = abs(odd_away - prev_odd_away) / prev_odd_away
        if drift_a > 0.30:
            anomalies.append(f"Drift brutal sur la cote exterieur ({drift_a*100:.1f}% > 30%).")

    is_valid = (len(anomalies) == 0)
    
    return {
        'home_team': home_team,
        'away_team': away_team,
        'odd_home': odd_home,
        'odd_draw': odd_draw,
        'odd_away': odd_away,
        'overround': overround,
        'margin_pct': margin_pct,
        'payout_rate_trj': payout_trj,
        'is_valid': is_valid,
        'anomalies': anomalies,
        'validation_status': 'VALID' if is_valid else 'REJECTED'
    }

if __name__ == '__main__':
    print("[QualityGate] Test de validation des cotes Betclic...")
    
    # Test 1 : Cotes reelles Ligue 1
    t1 = validate_odds_record("Strasbourg", "Lens", 3.90, 3.65, 1.93)
    print(f"Test 1 (Reel) : Statut={t1['validation_status']} | Marge={t1['margin_pct']}% | TRJ={t1['payout_rate_trj']}% | Anomalies={t1['anomalies']}")
    assert t1['is_valid'] == True
    
    # Test 2 : Dummy mock repetitif
    t2 = validate_odds_record("Alaves", "Getafe", 2.10, 3.40, 3.50)
    print(f"Test 2 (Mock 2.10/3.40/3.50) : Statut={t2['validation_status']} | Anomalies={t2['anomalies']}")
    assert t2['is_valid'] == False
    
    # Test 3 : Cote < 1.015
    t3 = validate_odds_record("PSG", "Montpellier", 1.01, 15.0, 45.0)
    print(f"Test 3 (Cote 1.01) : Statut={t3['validation_status']} | Anomalies={t3['anomalies']}")
    assert t3['is_valid'] == False

    print("[QualityGate] Tous les tests de validation unitaire ont reussi !")
