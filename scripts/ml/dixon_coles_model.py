#!/usr/bin/env python3
"""
scripts/ml/dixon_coles_model.py
─────────────────────────────────────────────────────────────
Modular Dixon-Coles Bivariate Poisson Implementation.
"""

import math
import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar
from scipy.stats import poisson
from sklearn.linear_model import PoissonRegressor

class FastDixonColesModel:
    def __init__(self, xi=0.0015):
        self.xi = xi
        self.teams = []
        self.team_to_idx = {}
        self.attack_params = {}
        self.defense_params = {}
        self.home_advantage = 0.28
        self.intercept = 0.12
        self.rho = -0.06

    def _tau(self, x, y, lambda_h, lambda_a, rho):
        if x == 0 and y == 0: return max(1e-5, 1.0 - lambda_h * lambda_a * rho)
        elif x == 0 and y == 1: return max(1e-5, 1.0 + lambda_h * rho)
        elif x == 1 and y == 0: return max(1e-5, 1.0 + lambda_a * rho)
        elif x == 1 and y == 1: return max(1e-5, 1.0 - rho)
        return 1.0

    def fit(self, matches_df):
        print("   [Dixon-Coles] Ajustement vectorisé haute vitesse (GLM Poisson + Time Decay)...")
        teams_set = sorted(list(set(matches_df['home_team'].unique()).union(set(matches_df['away_team'].unique()))))
        self.teams = teams_set
        self.team_to_idx = {t: i for i, t in enumerate(self.teams)}
        n_teams = len(self.teams)

        X_rows = []
        y_vals = []
        sample_weights = []

        max_date = pd.to_datetime(matches_df['date']).max()
        days_diff = (max_date - pd.to_datetime(matches_df['date'])).dt.total_seconds() / (24 * 3600)
        w_vals = np.exp(-self.xi * days_diff.values)

        for i, row in matches_df.reset_index(drop=True).iterrows():
            h_idx = self.team_to_idx[row['home_team']]
            a_idx = self.team_to_idx[row['away_team']]
            w = w_vals[i]

            vec_h = np.zeros(1 + 2 * n_teams)
            vec_h[0] = 1.0
            vec_h[1 + h_idx] = 1.0
            vec_h[1 + n_teams + a_idx] = 1.0
            X_rows.append(vec_h)
            y_vals.append(row['target_home_goals'])
            sample_weights.append(w)

            vec_a = np.zeros(1 + 2 * n_teams)
            vec_a[0] = 0.0
            vec_a[1 + a_idx] = 1.0
            vec_a[1 + n_teams + h_idx] = 1.0
            X_rows.append(vec_a)
            y_vals.append(row['target_away_goals'])
            sample_weights.append(w)

        X_mat = np.array(X_rows)
        y_arr = np.array(y_vals)
        w_arr = np.array(sample_weights)

        glm = PoissonRegressor(alpha=0.01, max_iter=200, fit_intercept=True)
        glm.fit(X_mat, y_arr, sample_weight=w_arr)

        self.intercept = float(glm.intercept_)
        self.home_advantage = float(glm.coef_[0])
        att_coefs = glm.coef_[1:1 + n_teams]
        def_coefs = glm.coef_[1 + n_teams:]

        att_mean = np.mean(att_coefs)
        self.intercept += att_mean
        att_coefs -= att_mean

        for idx, t in enumerate(self.teams):
            self.attack_params[t] = float(att_coefs[idx])
            self.defense_params[t] = float(def_coefs[idx])

        h_idx_arr = np.array([self.team_to_idx[t] for t in matches_df['home_team']])
        a_idx_arr = np.array([self.team_to_idx[t] for t in matches_df['away_team']])
        lh_arr = np.exp(self.intercept + self.home_advantage + att_coefs[h_idx_arr] + def_coefs[a_idx_arr])
        la_arr = np.exp(self.intercept + att_coefs[a_idx_arr] + def_coefs[h_idx_arr])
        hg_arr = matches_df['target_home_goals'].values.astype(int)
        ag_arr = matches_df['target_away_goals'].values.astype(int)

        def rho_loss(r):
            loss = 0.0
            for i in range(len(hg_arr)):
                x, y = hg_arr[i], ag_arr[i]
                if x <= 1 and y <= 1:
                    t_val = self._tau(x, y, lh_arr[i], la_arr[i], r)
                    loss -= w_vals[i] * math.log(t_val)
            return loss

        res_rho = minimize_scalar(rho_loss, bounds=(-0.25, 0.25), method='bounded')
        self.rho = float(res_rho.x)

        print(f"   [Dixon-Coles] Paramètres Calibrés : Intercept={self.intercept:.3f}, Avantage Domicile={self.home_advantage:.3f}, Rho={self.rho:.3f}")
        return self

    def predict_match(self, home_team, away_team, max_goals=6):
        alpha_h = self.attack_params.get(home_team, 0.0)
        beta_a = self.defense_params.get(away_team, 0.0)
        alpha_a = self.attack_params.get(away_team, 0.0)
        beta_h = self.defense_params.get(home_team, 0.0)

        lambda_h = max(0.1, math.exp(self.intercept + self.home_advantage + alpha_h + beta_a))
        lambda_a = max(0.1, math.exp(self.intercept + alpha_a + beta_h))

        prob_matrix = np.zeros((max_goals + 1, max_goals + 1))
        for x in range(max_goals + 1):
            for y in range(max_goals + 1):
                p_base = poisson.pmf(x, lambda_h) * poisson.pmf(y, lambda_a)
                t_val = self._tau(x, y, lambda_h, lambda_a, self.rho)
                prob_matrix[x, y] = max(0.0, p_base * t_val)

        total_p = prob_matrix.sum()
        if total_p > 0:
            prob_matrix /= total_p

        p_home = float(np.sum(np.tril(prob_matrix, -1)))
        p_draw = float(np.sum(np.diag(prob_matrix)))
        p_away = float(np.sum(np.triu(prob_matrix, 1)))

        return {
            "lambda_home": lambda_h,
            "lambda_away": lambda_a,
            "prob_home": p_home,
            "prob_draw": p_draw,
            "prob_away": p_away,
            "matrix": prob_matrix
        }
