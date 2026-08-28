# Project Context & Architecture — European Football Predictor V2

Plateforme analytique et prédictive de haut niveau conçue pour piloter des stratégies de paris sportifs sur les 5 grands championnats européens (Premier League, La Liga, Serie A, Bundesliga, Ligue 1) ainsi que les 3 compétitions continentales UEFA (Ligue des Champions, Ligue Europa, Ligue Conférence).

---

## 🏛️ 1. Architecture Technique Globale

```
├── .agents/skills/              # Antigravity Skills (ML, Orquestration, QA Data)
├── scripts/
│   └── pipeline/                # Pipeline ETL Modulaire & Haute Fiabilité
│       ├── extractors/          # Ingestion multi-sources (Betclic, Football APIs)
│       ├── transformers/        # Modélisation Dixon-Coles, xG & Value Bets
│       ├── validators/          # Data Quality & assertions contractuelles
│       ├── loaders/             # Persistance atomique & snapshots horodatés
│       └── run_pipeline.cjs     # CLI Orchestrator centralisé
├── src/
│   ├── components/              # Cockpit UI (Daily Betting Hub, H2H, Copilot RAG, etc.)
│   ├── data/
│   │   ├── app_data.json        # Bundle production validé et certifié (100/100 QA)
│   │   ├── snapshots/           # Historique des versions et traçabilité
│   │   └── unified_history.json # 3 500+ rencontres et événements détaillés
│   └── utils/                   # Feature Store, RAG Engine & Visualisations
└── data_quality_report.json     # Rapport d'audit de qualité automatisé
```

---

## ⚙️ 2. Pipeline ETL & Data Quality Contract

Le pipeline d'ingestion suit un cycle d'exécution en 4 étapes garantissant 0% de données corrompues :

1. **Extraction (`scripts/pipeline/extractors/`)** :
   - Puppeteer Stealth scraper pour les cotes réelles et rencontres du jour Betclic.
   - Connecteur certifié pour les 8 championnats & coupes européennes.
2. **Transformation (`scripts/pipeline/transformers/`)** :
   - Modélisation de Poisson & Dixon-Coles pour les probabilités exactes (1N2, xG).
   - Détection des Value Bets par comparaison de l'edge prédictif face au bookmaker.
   - Modélisation de discipline (sévérité arbitre FIFA & risque cartons).
3. **Validation Contractuelle (`scripts/pipeline/validators/`)** :
   - Vérification de type stricte (0 champ `league: undefined`).
   - Bornes des cotes : `1.01 < Cote < 100` sans NaN ni Infinity.
   - Somme des probabilités : comprise entre 98% et 102%.
   - Génération du rapport formel `data_quality_report.json`.
4. **Chargement Atomique (`scripts/pipeline/loaders/`)** :
   - Snapshot horodaté dans `src/data/snapshots/` pour traçabilité et rollback.
   - Écriture atomique sécurisée sur `src/data/app_data.json`.

---

## 🏆 3. Compétitions Supportées (8 Ligues)

| Code | Nom de la Compétition | Flag | Zone |
| :--- | :--- | :---: | :--- |
| `EUR-CL` | **Ligue des Champions** | 🇪🇺 | Europe |
| `EUR-EL` | **Ligue Europa** | 🇪🇺 | Europe |
| `EUR-ECL` | **Ligue Conférence** | 🇪🇺 | Europe |
| `FRA-L1` | **Ligue 1 McDonald's** | 🇫🇷 | France |
| `ENG-PL` | **Premier League** | 🇬🇧 | Angleterre |
| `ESP-LL` | **La Liga** | 🇪🇸 | Espagne |
| `ITA-SA` | **Serie A** | 🇮🇹 | Italie |
| `GER-BL` | **Bundesliga** | 🇩🇪 | Allemagne |

---

## 🚀 4. Commandes Opérationnelles

```bash
# Lancement de la synchronisation live et du pipeline complet
npm run data:pipeline

# Synchronisation rapide des cotes Betclic & fixtures
npm run data:sync

# Audit et validation d'intégrité Data Quality
npm run data:validate

# Lancement du serveur de développement
npm run dev

# Build de production
npm run build
```
