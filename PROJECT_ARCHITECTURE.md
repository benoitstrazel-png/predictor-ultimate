# Architecture Technique & Guide de Référence — European Football Predictor

Ce document constitue la référence exhaustive de l'architecture logicielle, de l'orchestration des données, du moteur quantitatif prédictif et de la gouvernance qualité du projet **European Football Predictor**.

---

## 🏛️ 1. Architecture Globale du Projet

Le projet combine un entrepôt de données relationnel (SQLite 3), un pipeline ETL automatisé (Python 3.11 & Node.js), un moteur prédictif quantitatif (Dixon-Coles & LightGBM) et un cockpit décisionnel haute performance (React 18 + Vite).

### Arborescence Épurée & Organisation des Fichiers

```
Predictor Ultimate/
├── .github/workflows/          # Automatisation CI/CD (GitHub Actions)
│   ├── ci.yml                  # Validation continue du build et des composants
│   └── data_sync.yml           # Pipeline automatisé d'ingestion des matchs et cotes
├── data/                       # Entrepôt brut et jeux de données ML
│   ├── raw/                    # Données brutes horodatées par saison (2024-2025, 2025-2026, 2026-2027)
│   ├── ml_features_dataset.parquet # Feature store entraîné (54 colonnes)
│   └── ml_features_dataset.json
├── models/                     # Modèles ML sérialisés et métriques d'évaluation
│   ├── football_quant_model_v3.joblib # Modèle hybride Dixon-Coles + LightGBM multi-tâches
│   └── training_evaluation_report.json # Rapport de performance (Log Loss, RPS, Brier, ROI)
├── public/                     # Fast-Layer statique distribué (accès direct par le client)
│   ├── data/
│   │   ├── history/            # Historique des rencontres partitionné par saison et compétition
│   │   ├── matches/            # Feuilles de matchs détaillées individuelles
│   │   └── mercato/            # Base des transferts et registres des joueurs
├── scripts/                    # Scripts d'orchestration, de calcul et de modélisation
│   ├── db/                     # Initialisation et migrations des schémas SQLite
│   │   ├── init_coaches_schema.py   # Schéma dimensionnel des entraîneurs (SCD2)
│   │   ├── init_odds_schema.py      # Schéma de capture et quarantaine des cotes
│   │   ├── init_squads_schema.py    # Schéma des effectifs et contrats joueurs (SCD2)
│   │   └── init_transfers_schema.py # Schéma factuel des transferts
│   ├── ml/                     # Algorithmes quantitatifs et entraînement ML
│   │   ├── dixon_coles_model.py     # Modèle bivarié de Dixon-Coles en pur NumPy/SciPy
│   │   ├── extract_and_build_features.py # Extraction des 54 variables explicatives
│   │   ├── predict_match_v3.py      # Moteur d'inférence temps réel et explicabilité SHAP
│   │   └── train_and_evaluate_models.py # Pipeline d'entraînement et validation croisée temporelle
│   ├── pipeline/               # Pipeline ETL d'ingestion et de compilation
│   │   ├── extractors/         # Scrapers Puppeteer Stealth et connecteurs d'API
│   │   ├── transformers/       # Normalisation des entités et moteur de projection
│   │   ├── validators/         # Contrats de validation de données (Quality Gate)
│   │   ├── loaders/            # Sauvegarde atomique et gestion des snapshots
│   │   ├── run_pipeline.cjs    # CLI Orchestrator centralisé Node.js
│   │   ├── ingest_historical_and_live_matches.py # Ingestion SQLite des calendriers et résultats
│   │   ├── sync_full_squads_and_transfers.py     # Orchestrateur d'alignement des effectifs
│   │   ├── compile_unified_history_and_app_data.py # Compilation des datasets de production
│   │   ├── enrich_matches_with_ml_and_entities.py  # Enrichissement prédictif Quant ML
│   │   ├── build_comprehensive_teams_master.py   # Générateur du catalogue maître des clubs
│   │   └── rebuild_all_player_databases_2026_2027.cjs # Source de vérité des profils joueurs
│   ├── scheduler/              # Ordonnanceur des phases pré-match et post-match
│   └── server/                 # Serveur d'API locale des cotes
├── src/                        # Application Front-End React 18
│   ├── components/             # Les 7 Vues Cockpit et composants modulaires
│   │   ├── DailyBettingHub.jsx # Hub quotidien des cotes, scatter plot & filtres ligues
│   │   ├── MatchDeepDive.jsx   # Confrontation H2H, xG Flow, météo et arbitre
│   │   ├── LeagueFocusHub.jsx  # Classements en direct et statistiques des clubs
│   │   ├── MatchHistoryHub.jsx # Historique interactif avec résumés vidéo et buteurs
│   │   ├── SquadsMercatoProps.jsx # Effectifs multi-saisons, mercato SCD2 et cotes buteurs
│   │   ├── CopilotView.jsx     # Copilote analytique IA et explications SHAP
│   │   ├── BankrollTracking.jsx# Suivi de performance, ROI, calibration et backtests
│   │   ├── AiPredictorModal.jsx# Assistant RAG multimodal à la demande
│   │   └── ui/                 # Design System (TeamLogo, PlayerAvatar, ErrorBoundary)
│   ├── context/                # Context Provider (MatchContext.jsx)
│   ├── data/                   # Sources certifiées de production (app_data.json, etc.)
│   └── utils/                  # Algorithmes de calibration, résolveurs d'entités, indices RAG
├── predictor_v2.db             # Entrepôt SQLite maître (18 tables relationnelles)
└── package.json                # Dépendances et commandes d'exécution
```

---

## ⚙️ 2. Orchestration de la Donnée (ETL & Pipelines)

### Le Cycle d'Exécution en 4 Étapes

Le flux de données suit un cycle strict garantissant une corruption zéro et une fraîcheur continue :

1. **Phase d'Extraction (`scripts/pipeline/extractors/`)** :
   - **Betclic Scraper (`betclic_collector.py` + Puppeteer Stealth)** : Récupération des cotes réelles 1N2, double chance, Over/Under 2.5 et buteurs. Utilise l'émulation Chrome furtive et un défilement dynamique pour contourner la virtualisation du DOM de Betclic.
   - **Fixtures & Résultats Officiels (`ingest_historical_and_live_matches.py`)** : Collecte des calendriers officiels, scores finaux et à la mi-temps, buteurs, passeurs, cartons et compositions auprès de Football-Data.org et Flashscore.
   - **Transfermarkt Ingestion (`build_transfers_database.py`)** : Scraping des mouvements du mercato 2026, montants des indemnités, dates d'effet et postes détaillés.

2. **Phase de Transformation (`scripts/pipeline/transformers/`)** :
   - **Normalisation des Entités (`sportsDataNormalizer.py`)** : Alignement strict des noms de clubs entre toutes les sources via le catalogue maître `teams_master.json` et `build_comprehensive_teams_master.py`.
   - **Projection Prédictive (`enrich_matches_with_ml_and_entities.py`)** : Calcul des paramètres d'Expected Goals ($\lambda_{home}, \lambda_{away}$), des probabilités 1N2 et des matrices de scores exacts via le modèle Quant ML.
   - **Association Contextuelle** : Liaison des données météo géolocalisées du stade hôte et attribution du corps arbitral certifié UEFA Elite avec ses statistiques de sévérité.

3. **Phase de Validation Contractuelle (`scripts/pipeline/validators/`)** :
   - **Data Quality Gate (`dataValidator.cjs` + `odds_quality_gate.py`)** :
     - Vérification de typage : 0 valeur `undefined`, `NaN` ou `Infinity`.
     - Bornes de cotes : $1.01 \le 	ext{Cote} \le 100.0$.
     - Somme des probabilités : $98\% \le P_{home} + P_{draw} + P_{away} \le 102\%$.
     - Cohérence temporelle : Dates ISO 8601 valides et horodatages UTC.
     - Taux de complétion : Génération du certificat formel `data_quality_report.json` avec note contractuelle minimale de 100/100.

4. **Phase de Chargement & Distribution (`scripts/pipeline/loaders/`)** :
   - **SQLite Persistence** : Écriture atomique dans `predictor_v2.db` avec gestion des clés étrangères.
   - **Fast-Layer Distribution (`public/data/history/`)** : Découpage de l'historique massif en fichiers JSON légers par saison et compétition (ex: `2026-2027_FRA-L1.json`) pour éviter de faire télécharger un fichier de 50 Mo au navigateur client.
   - **Production Bundle** : Écriture atomique sécurisée sur `src/data/app_data.json` via un fichier temporaire `.tmp` puis renommage atomique.

### Automatisation CI/CD (GitHub Actions)

Le workflow `.github/workflows/data_sync.yml` pilote la synchronisation automatique :
- **Vendredis, Samedis et Dimanches** : Toutes les 2 heures entre 12h00 UTC et 23h00 UTC (couverture des journées de championnat européen).
- **Mardis, Mercredis et Jeudis** : À 12h, 17h, 19h, 21h et 23h UTC (couverture des soirées de Coupes d'Europe UEFA).
- **Quotidien** : Audit et contrôle matinal à 06h00 UTC.

---

## 📊 3. Modélisation de l'Entrepôt de Données (`predictor_v2.db`)

L'entrepôt repose sur 18 tables relationnelles combinant des dimensions à évolution lente (SCD Type 2) et des tables de faits d'événements :

| Table | Rôle & Type | Description |
| :--- | :--- | :--- |
| `dim_teams` | Dimension | 126 clubs recensés sur les 8 compétitions européennes avec IDs canoniques et logos Fotmob. |
| `dim_players` | Dimension | 3 056 joueurs officiels avec postes, nationalités et photos HD. |
| `dim_player_contracts_scd2` | Dimension SCD 2 | 8 508 périodes contractuelles avec dates `effective_from`, `effective_to` et indicateur `is_current`. |
| `dim_player_aliases` | Dimension | 8 990 alias textuels pour réconcilier les graphies (ex: accents, inversion nom/prénom). |
| `dim_coaches` | Dimension | 462 entraîneurs avec styles tactiques, formations de prédilection et ratios de victoires. |
| `dim_coach_contracts_scd2` | Dimension SCD 2 | 561 mandats d'entraîneurs avec traçabilité temporelle exacte des prises de fonction et départs. |
| `fact_matches` | Table de Faits | 6 714 rencontres sur 3 saisons avec scores MT/FT, dates, arbitres et statuts. |
| `fact_match_events` | Table de Faits | 77 176 événements détaillés (buts, passeurs, cartons jaunes/rouges, remplacements, minutes). |
| `fact_match_team_stats` | Table de Faits | 9 556 enregistrements de statistiques d'équipes (tirs cadrés, possession, fautes, corners). |
| `fct_match_lineups` | Table de Faits | 206 121 titularisations avec numéros de maillots, positions sur le terrain et minutes jouées. |
| `fct_player_transfers` | Table de Faits | 4 102 transferts et prêts réels du mercato 2026 avec montants et clubs cédants/acquéreurs. |
| `fact_odds_snapshots` | Table de Faits | Historique horodaté des cotes capturées en direct pour mesurer l'évolution du marché. |
| `sys_odds_quarantine` | Table Système | Enregistrements de cotes rejetées lors des contrôles de qualité pour audit a posteriori. |

---

## 🧮 4. Moteur Mathématique & Calcul des Indicateurs

### 1. Modèle Bivarié de Dixon-Coles (Probabilités 1N2)

Le modèle dérive les probabilités du match à partir de deux variables aléatoires de Poisson corrélées représentant les buts marqués par l'équipe à domicile ($X$) et l'équipe à l'extérieur ($Y$) :

$$X \sim 	ext{Poisson}(\lambda_{home}), \quad Y \sim 	ext{Poisson}(\lambda_{away})$$

Les paramètres d'intensité $\lambda_{home}$ et $\lambda_{away}$ sont modélisés selon les forces d'attaque ($lpha$) et de défense ($eta$) des deux clubs, avec avantage du terrain ($\gamma$) :

$$\lambda_{home} = \exp(lpha_{home} + eta_{away} + \gamma)$$
$$\lambda_{away} = \exp(lpha_{away} + eta_{home})$$

Pour corriger la sous-estimation chronique des scores faibles ($0-0, 1-0, 0-1, 1-1$), le facteur de dépendance $	au(x, y)$ de Dixon-Coles est appliqué avec le paramètre de corrélation estimé $ho pprox -0.05$ :

$$	au(x, y) = egin{cases}
1 - \lambda_{home} \lambda_{away} ho & 	ext{si } x = 0, y = 0 \
1 + \lambda_{away} ho & 	ext{si } x = 1, y = 0 \
1 + \lambda_{home} ho & 	ext{si } x = 0, y = 1 \
1 - ho & 	ext{si } x = 1, y = 1 \
1 & 	ext{dans tous les autres cas}
\end{cases}$$

La probabilité conjointe exacte de tout score $(x, y)$ est :

$$P(X=x, Y=y) = 	au(x, y) rac{\lambda_{home}^x e^{-\lambda_{home}}}{x!} rac{\lambda_{away}^y e^{-\lambda_{away}}}{y!}$$

Les probabilités 1N2 sont alors obtenues par sommation :

$$P_{home} = \sum_{x > y} P(X=x, Y=y), \quad P_{draw} = \sum_{x = y} P(X=x, Y=y), \quad P_{away} = \sum_{x < y} P(X=x, Y=y)$$

### 2. Dégagement de la Marge Bookmaker (Overround)

Pour comparer équitablement nos probabilités aux cotes de Betclic, la marge commerciale du bookmaker est extraite :

$$	ext{Marge } M = \left( rac{1}{	ext{Cote}_{1}} + rac{1}{	ext{Cote}_{N}} + rac{1}{	ext{Cote}_{2}} ight) - 1$$

Les probabilités implicites débiaisées sont calculées par :

$$P_{	ext{impliquée}, i} = rac{1 / 	ext{Cote}_i}{1 + M}$$

### 3. Détection des Value Bets & Critère de Kelly

Un pari est formellement qualifié de **Value Bet** dès que l'avantage prédictif (Edge) dépasse le seuil de significativité :

$$	ext{Edge } \% = rac{P_{modèle} - P_{impliquée}}{P_{impliquée}} 	imes 100 \ge +2.0\%$$

La recommandation de mise est dimensionnée selon une fraction prudente du critère de Kelly pour protéger le capital contre les séries de variance :

$$	ext{Mise Recommandée } \% = 1.0\% + (	ext{Edge} 	imes 0.25)$$

### 4. Modélisation de l'Arbitrage & Risque Disciplinaire

Chaque arbitre officiel est caractérisé par son historique UEFA Elite :
- **Moyenne de cartons jaunes par match** ($J_{avg}$)
- **Total de cartons rouges accordés** ($R_{tot}$)
- **Ratio de penaltys par rencontre** ($Pen_{ratio}$)
- **Indice de Sévérité** calculé sur une échelle de 0 à 10 :

$$	ext{Indice Sévérité} = \min\left(10, \; rac{J_{avg} 	imes 1.2 + R_{tot} 	imes 0.4 + Pen_{ratio} 	imes 5.0}{1.0}ight)$$

Le risque de carton rouge du match combine la sévérité de l'arbitre, la rivalité historique des clubs et l'intensité tactique.

### 5. Attributions Locales SHAP (Modèle Quant V3)

Le modèle hybride LightGBM utilise 54 variables explicatives et décompose l'impact de chaque facteur par valeurs de Shapley :
1. `feat_dc_prob_home` / `feat_dc_prob_away` : Probabilités de base issues de Dixon-Coles (importance relative ~27%).
2. `feat_dc_home_xg` / `feat_dc_away_xg` : Expected Goals modélisés.
3. `feat_rolling_def_solid_h` : Solidité défensive glissante sur 5 rencontres.
4. `feat_rolling_off_eff_h` : Efficacité offensive glissante.
5. `feat_rolling_pts_delta` : Dynamique de points récents entre les deux équipes.
6. `feat_ref_severity_index` : Impact de la rigidité de l'arbitre sur l'issue de la rencontre.
7. `feat_weather_friction_index` : Impact combiné pluie/froid/vent sur le volume de jeu.

---

## 🚩 5. Flags de Suspicion & Éléments Potentiellement Obsolètes

Lors de l'audit approfondi, plusieurs aspects techniques ont été identifiés comme points d'attention ou opportunités d'amélioration architecturale :

### 🚩 Flag 1 : Données Météo Statiques dans `predictionEngine.cjs`
- **Constat** : Le fichier `predictionEngine.cjs` utilise un dictionnaire en dur `STADIUM_WEATHER` pour 38 stades (ex: Inter Turku à 18.2°C, Parc des Princes à 22.0°C).
- **Risque** : Ces températures et conditions sont fixes et ne reflètent pas les conditions météorologiques réelles le jour du match.
- **Recommandation** : Brancher directement l'appel API à Open-Meteo Geocoding en temps réel comme le fait déjà le service côté front `src/services/weatherService.js`.

### 🚩 Flag 2 : Dualité entre le Moteur JS et le Moteur ML Python
- **Constat** : Il existe deux moteurs de calcul de probabilités dans le code :
  1. `scripts/pipeline/transformers/predictionEngine.cjs` (formule simplifiée basée sur les cotes de départ).
  2. `scripts/ml/predict_match_v3.py` + `scripts/pipeline/enrich_matches_with_ml_and_entities.py` (modèle quantitatif complet 54 features avec LightGBM et SHAP).
- **Statut** : C'est le pipeline Python (`enrich_matches_with_ml_and_entities.py`) qui enrichit `app_data.json` lors des exécutions CI/CD (`data_sync.yml`).
- **Recommandation** : À terme, faire converger l'orchestrateur Node.js pour qu'il invoque directement l'inférence Python afin d'éviter toute disparité de calcul.

### 🚩 Flag 3 : Poids du Bundle Client `app_data.json` (12.6 Mo)
- **Constat** : `app_data.json` stocke l'intégralité du calendrier des 8 compétitions pour la saison 2026-2027 (2 148 matchs), incluant matrices de scores, probabilités et métadonnées. Ce fichier est importé statiquement et compilé dans le bundle JavaScript Vite (chunk de ~13 Mo minifié).
- **Risque** : Temps de chargement initial accru sur les connexions mobiles lentes.
- **Recommandation** : Adopter pour `app_data.json` la même stratégie que pour l'historique (`public/data/history/`) : ne charger au démarrage que les matchs des 7 prochains jours (environ 40 à 60 matchs, soit ~250 Ko), et charger les journées futures à la demande via `fetch('/data/...')`.

### 🚩 Flag 4 : Vigilance sur les Clubs Relégués (Directives Projet)
- **Constat** : Les directives stipulent expressément que l'AS Saint-Étienne et le Stade de Reims ne font pas partie de la Ligue 1 pour la saison 2025-2026. L'audit a permis de purger la référence obsolète `'Saint-Étienne': 1063` qui subsistait dans `predictionEngine.cjs` et d'ajouter le Paris FC.
- **Recommandation** : Maintenir le test automatisé n°3 de `data_integrity_check.py` dans le CI pour bloquer toute régression.

### 🚩 Flag 5 : Exploitation de la Table `dim_match_closing_odds`
- **Constat** : La table SQLite `dim_match_closing_odds` ne compte actuellement que 175 enregistrements.
- **Opportunité** : Enregistrer automatiquement la cote de clôture exacte 5 minutes avant le coup d'envoi de chaque match permettrait d'analyser la *Closing Line Value* (CLV) et de mesurer objectivement l'alpha généré par le modèle face au marché des paris.
