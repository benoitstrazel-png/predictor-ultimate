# Règle Antigravity : Maintenance de la Documentation des Skills (`skills-documentation`)

## Déclencheur & Périmètre
Cette règle s'applique à tous les agents et développeurs manipulant le dossier `.agents/skills/`, créant un nouveau skill, modifiant un script existant, ou mettant à jour la documentation technique `SKILLS_GUIDE.md`.

---

## 1. Principes d'Ergonomie pour Panneau Latéral (Side-Panel / Split Editor)

Toute documentation générée ou mise à jour doit être directement lisible dans un éditeur scindé (largeur réduite 400px - 700px) :
- **Table des Matières Cliquable** : Présente en haut de document avec des ancres Markdown relatives (`#1-skill-nom`) pour navigation instantanée.
- **Largeur de Ligne Contrôlée** : Éviter les tableaux ultra-larges à défilement horizontal. Préférer des tableaux synthétiques (2 à 4 colonnes max) ou des listes à puces.
- **Blocs Rétractables `<details><summary>`** : Systématiquement envelopper les longs payloads JSON d'exemples d'entrée/sortie sous des balises déroulantes HTML.
- **Badges Visuels & Rôles Clairs** : Marquer chaque skill par sa catégorie (`[DATA]`, `[ML]`, `[QA]`, `[FRONTEND]`) et son agent responsable.

---

## 2. Contenu Obligatoire par Fiche de Skill

Chaque section de skill dans `SKILLS_GUIDE.md` doit obligatoirement comporter :
1. **Nom exact & Alias** : Identifiant YAML du skill (ex: `data_collector`).
2. **Syntaxe d'Invocation Déclinée en 4 Formes** :
   - Mention chat interactive : `@skill:<nom>`
   - Prompt naturel : Mot-clé déclencheur pour le chargement progressif.
   - Délégation sous-agent : Exemple de structure d'appel `invoke_subagent` / `send_message`.
   - Exécution CLI : Ligne de commande exacte exécutable depuis la racine.
3. **Tableau des Paramètres / Arguments** :
   - Nom de l'option (`--home`, `--team`, etc.)
   - Type (`string`, `float`, `int`, `bool`)
   - Requis / Optionnel & Valeur par défaut
   - Brève explication
4. **Exemple Concret Testé** :
   - Commande d'exécution réelle.
   - Payload de sortie JSON ou log réel formaté.
5. **Stratégie d'Erreur & Fallback** :
   - Conduite à tenir en cas d'échec (timeout réseau, données manquantes).

---

## 3. Protocole de Mise à Jour par l'Agent `skills-doc-agent`

Lorsque des modifications surviennent dans `.agents/skills/` :
1. **Scan Découverte** : Parcourir `.agents/skills/*/SKILL.md` et recenser les scripts sous `scripts/`.
2. **Validation d'Exécution** : Exécuter un test à blanc (`--help` ou test unitaire rapide) pour valider la pérennité des options CLI documentées.
3. **Mise à Jour Synchronisée** : Reporter les nouveaux flags ou sorties JSON dans `SKILLS_GUIDE.md`.
4. **Conservation des Commentaires** : Préserver l'historique et la structure sans écraser les sections manuelles spécifiques.
