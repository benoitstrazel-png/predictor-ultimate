# Predictor Ultimate — Règles & Directives Générales des Agents

## 📌 Règle 1 : Maintenance Automatique des Skills (`skills-sync`)

Dès qu'un agent Antigravity crée, modifie ou supprime un skill sous `.agents/skills/` :
1. **Mise à Jour de la Documentation** :
   - L'agent **DOIT** mettre à jour la Table des Matières et ajouter/adapter la section détaillée dans :
     - `.agents/SKILLS_GUIDE.md`
     - `SKILLS_GUIDE.md` (racine du projet, maintenu strictement synchronisé).
2. **Validation par Script** :
   - L'agent **DOIT** obligatoirement exécuter le script de validation avant de terminer son tour :
     ```bash
     python .agents/scripts/verify_skills_documentation.py
     ```
   - Si le script retourne un statut `FAILED` (code sortie != 0), l'agent doit corriger immédiatement les manques documentaires.
3. **Ergonomie Side-Panel** :
   - Suivre les conventions définies dans `.agents/rules/skills_documentation.md` (TOC cliquable, badges, repli `<details>` pour les gros JSON, syntaxe d'invocation en 4 formes).

---

## 📌 Règle 2 : Génération Visuelle & Démo d'Utilisation des Features (`visual-features-demo`)

Dès qu'un agent conçoit, modifie ou livre une fonctionnalité UI/UX ou un composant d'interface :
1. **Génération d'Images par Défaut** :
   - L'agent **DOIT** obligatoirement produire des exemples visuels ou mockups (via le subagent `image-generator` ou un artefact visuel interactif) avant ou lors de la présentation de la feature.
2. **Démo d'Utilisation Express (Quelques Mots Brefs)** :
   - Accompagner systématiquement chaque feature d'une démonstration rapide en 3 à 4 étapes concrètes :
     - 🎯 *Action / Clic initial* (point d'entrée).
     - ⚡ *Interaction* (paramètres ajustables, sélecteurs, calculs).
     - 📊 *Validation & Résultat* (effet en base, scellement de ticket, feedback UI).
   - Suivre les conventions définies dans [`.agents/rules/visual_features_demo.md`](file:///c:/Users/benoi/Documents/Predictor Ultimate/.agents/rules/visual_features_demo.md).
