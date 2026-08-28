# Project Context & Architecture — European Football Predictor V2

Plateforme analytique, prédictive et décisionnelle de haut niveau conçue pour l'analyse probabiliste et le value betting sur les 5 grands championnats européens (Premier League, La Liga, Serie A, Bundesliga, Ligue 1) ainsi que les 3 compétitions continentales UEFA (Ligue des Champions, Ligue Europa, Ligue Conférence).

---

## 🏛️ 1. Architecture Modulaire du Projet

```
├── .agents/skills/              # Antigravity Skills (ML Predictor, Orchestrator, QA Monitors)
├── scripts/
│   └── pipeline/                # Pipeline ETL Modulaire Certifié (100/100 QA)
│       ├── extractors/          # Ingestion multi-sources (Betclic Live Scraper, Open CDN)
│       ├── transformers/        # Modélisation Dixon-Coles, xG, Value Bets & Météo Stades
│       ├── validators/          # Data Quality Contracts (550 assertions contractuelles)
│       ├── loaders/             # Persistance atomique & Snapshots versionnés
│       └── run_pipeline.cjs     # CLI Orchestrator centralisé
├── src/
│   ├── components/              # 6 Vues Cockpit Spécialisées
│   │   ├── DailyBettingHub.jsx  # Matrice Scatter Plot Value Bets & Filtres 8 Ligues
│   │   ├── MatchDeepDive.jsx    # Timeline H2H, xG Flow, Météo terrain & Arbitrage
│   │   ├── MatchHistoryHub.jsx  # Hub Multimédia & Résumés Vidéo HD
│   │   ├── SquadsMercatoProps.jsx# Tracker Transferts 2026 SCD2, Paris Buteurs & Rosters
│   │   ├── CopilotView.jsx      # AI Predictor Copilot & Feature Store
│   │   ├── BankrollTracking.jsx # Courbes ROI, Suivi Dérive & Calibration Dixon-Coles
│   │   ├── AiPredictorModal.jsx # Assistant RAG On-Demand Multi-Matchs en temps réel
│   │   └── ui/                  # Design System (TeamLogo API-Sports CDN, ErrorBoundary)
│   ├── data/
│   │   ├── app_data.json        # Dataset certifié de production (77+ matchs réels)
│   │   ├── players.json         # 2 112 joueurs & cotes buteurs / passeurs
│   │   ├── real_players.json    # Rosters officiels des 96 clubs
│   │   ├── unified_history.json # Historique H2H et événements de matchs
│   │   └── snapshots/           # Historique d'audit et traçabilité rollback
│   └── utils/
│       ├── logos.js             # Registre officiel CDN API-Sports (HTTP 200 garanti)
│       └── featureStore.js      # Extraction des signaux et métriques avancées
└── data_quality_report.json     # Rapport formel de Data Quality automatisé
```

---

## ⚙️ 2. Pipeline ETL & Data Quality Contract (Analytics Engineering)

Le pipeline d'ingestion suit un cycle d'exécution en 4 étapes garantissant 0% de données corrompues et une fraîcheur maximale :

1. **Extraction (`scripts/pipeline/extractors/`)** :
   - Puppeteer Stealth scraper pour les cotes réelles et rencontres du jour Betclic.
   - Filtrage lexical strict éliminant les scores en direct (`0-0`, `MT`) des noms d'équipes.
   - Auto-scroll dynamique pour contourner la virtualisation du DOM Betclic.
2. **Transformation & Modélisation (`scripts/pipeline/transformers/`)** :
   - Modélisation bivariée Dixon-Coles & Poisson pour les probabilités exactes ($P_{home}, P_{draw}, P_{away}$) et les Expected Goals ($xG$).
   - Calcul de l'Edge sur le bookmaker : $\text{Edge } \% = \frac{P_{model} - P_{implied}}{P_{implied}} \times 100$.
   - Météo géolocalisée par stade hôte (Veritas Stadion, Victoria Stadium, Estádio da Luz, etc.).
   - Corps arbitral accrédité FIFA / UEFA Elite avec métriques de discipline réelles.
3. **Validation Contractuelle (`scripts/pipeline/validators/`)** :
   - Vérification de type stricte (0 champ `undefined` ou `NaN`).
   - Bornes des cotes : $1.01 < \text{Cote} < 100$.
   - Somme des probabilités : $98\% \le \sum P \le 102\%$.
   - Score de qualité contractuel minimum : **100/100**.
4. **Persistance Atomique (`scripts/pipeline/loaders/`)** :
   - Snapshot horodaté dans `src/data/snapshots/` pour traçabilité et rollback.
   - Écriture atomique sécurisée sur `src/data/app_data.json`.

---

## 🎲 3. Spécificité Betting & Modélisation des Cotes

- **Dégagement de la Marge Bookmaker (Overround)** :
  L'overround est calculé sur chaque marché 1N2 : $O = \sum \frac{1}{\text{cote}_i} - 1 \approx 5\% - 7\%$.
  La probabilité implicite réelle $P_{implied}$ est débiaisée avant le calcul d'Edge.
- **Détection des Value Bets** :
  Un pari est qualifié de *Value Bet* dès que $\text{Edge} \ge +1.5\%$.
  La mise recommandée est calculée selon le critère fractionnaire de Kelly : $\text{Mise } \% = 1.5\% + (\text{Edge} \times 0.35)$.

---

## 🌐 4. Compétitions Supportées (8 Ligues)

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

## 🚀 5. Commandes Opérationnelles

```bash
# Ingestion et calcul prédictif complet
npm run data:pipeline

# Synchronisation rapide des cotes & matchs Betclic
npm run data:sync

# Exécution du contrat de validation Data Quality
npm run data:validate

# Lancement du serveur de développement (HMR)
npm run dev

# Compilation du build de production
npm run build
```
