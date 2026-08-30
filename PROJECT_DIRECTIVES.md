# Directives Projet - Ligue 1 Dashboard

## Saison Actuelle
**Saison 2025-2026 de Ligue 1**

## Clubs en Ligue 1 2025-2026
⚠️ **IMPORTANT**: Les clubs suivants ne sont PAS en Ligue 1 cette saison :
- ❌ **Stade de Reims** (relégué)
- ❌ **AS Saint-Étienne** (relégué)

Ne jamais chercher ou scraper des données pour ces clubs dans le contexte de la Ligue 1 2025-2026.

## Clubs Présents (18 équipes)
1. Paris Saint-Germain (PSG)
2. Olympique de Marseille (Marseille)
3. AS Monaco (Monaco)
4. LOSC Lille (Lille)
5. Olympique Lyonnais (Lyon)
6. RC Lens (Lens)
7. Stade Rennais FC (Rennes)
8. OGC Nice (Nice)
9. RC Strasbourg Alsace (Strasbourg)
10. Toulouse FC (Toulouse)
11. Stade Brestois 29 (Brest)
12. FC Nantes (Nantes)
13. Montpellier HSC (Montpellier)
14. Angers SCO (Angers)
15. FC Lorient (Lorient)
16. Le Havre AC (Le Havre)
17. AJ Auxerre (Auxerre)
18. Paris FC (Paris FC)

## Sources de Données
- **Photos joueurs**: ligue1.com
- **Statistiques**: Données scrapées de Flashscore
- **Effectifs**: `src/data/real_players.json`

## Notes Techniques
- Les noms de joueurs de Marseille dans player_photos.json doivent être matchés avec real_players.json
- Certains sites retournent seulement les prénoms - utiliser le matching intelligent avec les effectifs

## Règle Globale : Mise à jour automatique des Workflows / Fichiers YAML
À chaque modification impactant la structure de données, l'ajout/modification d'une feature, d'une source, d'un pipeline ou d'un modèle :
1. Identifier les fichiers YAML concernés (ex: [.github/workflows/data_sync.yml](file:///c:/Users/benoi/Documents/Predictor%20Ultimate/.github/workflows/data_sync.yml), [.github/workflows/ci.yml](file:///c:/Users/benoi/Documents/Predictor%20Ultimate/.github/workflows/ci.yml)).
2. Mettre à jour automatiquement le fichier YAML (nouveaux jobs/steps/scripts, arguments CLI, chemins d'artefacts, variables, triggers).
3. Valider la syntaxe et la cohérence YAML (indentation, clés uniques, absence d'orphelins).
4. Fournir la version mise à jour du YAML et expliquer brièvement les modifications.

