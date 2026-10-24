---
name: brainstorming
description: >-
  Expert Prompt Engineering & Routine Grill-Me. Déclenché dès que le mot-clé, tag ou mention
  `@brainstorming` (ou `@skill:brainstorming`) apparaît dans un prompt utilisateur, ou quand l'utilisateur
  demande de challenger, enrichir et structurer une idée de prompt via une routine 'Grill Me'
  suivie d'un choix d'action à 3 options (Exécuter, Sauvegarder en draft, ou Oublier).
---

# 🧠 Skill `brainstorming` — Prompt Engineering & Routine Grill-Me

## 🎯 Vue d'Ensemble & Objectif

La skill `brainstorming` transforme toute idée brute, intention vague ou prompt initial en une **spécification de prompt de haute précision**, conforme aux meilleures pratiques du Prompt Engineering avancée (rôles chirurgicaux, contexte enrichi, chaînes de contraintes négatives, format de sortie déterministe).

Simultanément, elle active une routine **Grill-Me** pour débusquer les angles morts et se conclut par un **menu décisionnel en 3 options** donnant le contrôle total à l'utilisateur.

---

## ⚡ Déclencheurs & Activation

Cette skill doit s'activer automatiquement dès qu'une des conditions suivantes est remplie :
1. **Tag explicite** : Le mot-clé `@brainstorming` ou `@skill:brainstorming` figure dans le prompt de l'utilisateur.
2. **Intention de conception de prompt** : L'utilisateur demande de l'aide pour *rédiger*, *optimiser*, *affiner*, *challenger* ou *brainstormer* un prompt avant de l'exécuter.

---

## 🔄 Protocole d'Exécution en 3 Étapes

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          FLUX DE LA SKILL                              │
│                                                                        │
│   Prompt Brut + @brainstorming                                         │
│                │                                                       │
│                ▼                                                       │
│   [ÉTAPE 1] Reformulation & Enrichissement (Prompt Professionnel)      │
│                │                                                       │
│                ▼                                                       │
│   [ÉTAPE 2] Routine Grill-Me (Questions ciblées sur les angles morts) │
│                │                                                       │
│                ▼                                                       │
│   [ÉTAPE 3] Menu d'Action Final : [1] Exécuter | [2] Sauvegarder | [3] Oublier │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 1 : Reformulation & Enrichissement Approfondi

Analyse la demande brute et retravaille-la immédiatement en un prompt complet et modulaire selon l'architecture de référence ci-dessous :

1. **Rôle & Persona (`[RÔLE]`)** :
   - Définis un rôle d'expert ultra-spécifique (ex. : Senior Tech Lead, Architecte Sécurité Cloud, Prompt Engineer Principal).
   - Précise la posture intellectuelle (analytique, pragmatique, critique, pédagogique).

2. **Contexte & Enjeux (`[CONTEXTE & OBJECTIF]`)** :
   - Explicite le cas d'usage, le public cible et la finalité métier ou technique.
   - Clarifie le "Pourquoi" pour calibrer le niveau de détail attendu.

3. **Workflow & Tâches Séquentielles (`[INSTRUCTIONS / ÉTAPES]`)** :
   - Découpe la mission en étapes claires et numérotées (Chain-of-Thought).
   - Privilégie des verbes d'action impératifs et univoques.

4. **Garde-fous & Contraintes Négatives (`[CONTRAINTES & INTERDICTIONS]`)** :
   - Établis ce que le modèle **ne doit PAS faire** (ex. : pas de suppositions non fondées, pas de pseudo-code incomplet, pas de prose verbeuse inutile).
   - Fixe les limites techniques (outils autorisés, périmètre des fichiers).

5. **Format de Sortie Déterministe (`[FORMAT DE SORTIE]`)** :
   - Précise la structure exacte attendue (Markdown avec titres précis, schéma JSON validé, blocs de code annotés, tableau synthétique).

> **Présentation de la sortie :** Encadre le prompt retravaillé dans un bloc Markdown clair prêt à être copié ou exécuté.

---

### Étape 2 : Routine `Grill-Me` (Affinement & Détection des Angles Morts)

Simultanément à la proposition de prompt enrichi, exécute la routine **Grill-Me** :
- Pose **3 à 5 questions courtes, percutantes et chirurgicales** pour faire émerger les décisions non tranchées.
- Catégories de questions obligatoires à couvrir :
  * **Cas limites & scénarios d'échec** : *« Comment le système doit-il réagir si les données d'entrée sont corrompues ou manquantes ? »*
  * **Arbitrages de compromis** : *« Privilégie-t-on une exhaustivité maximale (quitte à rallonger la réponse) ou une concision synthétique ? »*
  * **Public cible & niveau d'abstraction** : *« Le livrable s'adresse-t-il à un développeur chevronné ou à un profil métier non technique ? »*
  * **Critères d'acceptation stricts** : *« Quel est l'indicateur clé qui te fera dire que le résultat produit est parfait ? »*

*(Note : Si des questions à choix multiples fermées se prêtent à une interaction guidée, l'agent peut également exploiter l'outil `ask_question` s'il est disponible).*

---

### Étape 3 : Menu d'Action Final (Choix Décisionnel)

Conclus **systématiquement et obligatoirement** ton intervention par le bloc interactif suivant :

```markdown
---

### 🚦 Choix Final — Quelle suite souhaitez-vous donner ?

Indiquez simplement votre choix :
- **[1] Exécuter** : Lancer immédiatement le prompt retravaillé dans cette session.
- **[2] Mettre de côté** : Sauvegarder ce prompt optimisé dans un fichier de draft (`.agents/drafts/`) pour plus tard.
- **[3] Oublier** : Abandonner cette session de brainstorming et repartir sur une base neutre.
```

---

## 🛠️ Comportement selon la Décision Utilisateur

Dès que l'utilisateur répond (par `1`, `2`, `3` ou une phrase équivalente) :

### Si Choix `[1]` (Exécuter) :
1. Adopte immédiatement la posture et le rôle définis dans le prompt retravaillé.
2. Incorpore les réponses apportées aux questions de la routine Grill-Me (si l'utilisateur y a répondu).
3. Exécute l'intégralité de la tâche demandée avec le niveau d'excellence requis.

### Si Choix `[2]` (Mettre de côté / Sauvegarder) :
1. Crée le dossier `.agents/drafts/` (ou `docs/drafts/` selon le projet) s'il n'existe pas.
2. Écris le prompt enrichi directement via `write_file` ou via le script utilitaire :
   ```bash
   python .agents/skills/brainstorming/scripts/save_draft.py --name "nom_du_prompt" --content "Contenu enrichi..."
   ```
3. Le fichier généré respecte la nomenclature `.agents/drafts/draft_<timestamp>_<slug>.md` et comprend :
   - Métadonnées YAML (Date, tags, version, statut `draft`).
   - Le prompt optimisé intégral.
   - Les questions de cadrage Grill-Me et leurs réponses.
4. Confirme la sauvegarde en fournissant à l'utilisateur le lien cliquable conforme :
   `[draft_<slug>.md](file:///c:/Users/benoi/Documents/Predictor Ultimate/.agents/drafts/draft_<slug>.md)`
5. Rappelle la commande pour le réutiliser : `@brainstorming exécute le draft <nom>`.

### Si Choix `[3]` (Oublier / Abandonner) :
1. Confirme l'abandon avec courtoisie en une phrase concise (ex. : *"Session de brainstorming abandonnée. Aucun fichier n'a été créé ni modifié. À disposition pour votre prochaine idée !"*).
2. Ne laisse aucun déchet ou fichier temporaire dans le workspace.
3. Repasse en mode d'attente standard.

---

## 📖 Exemple Complet d'Interaction

### Entrée Utilisateur :
> `@brainstorming Fais-moi un script de backup de base de données.`

### Réponse Attendue de l'Agent Antigravity :
```markdown
# 🧠 Session Brainstorming & Prompt Engineering

## 1. 🎯 Prompt Reformulé & Enrichi

```markdown
RÔLE :
Tu es un Ingénieur DevOps & SRE Senior spécialisé en haute disponibilité et sauvegarde de bases de données.

CONTEXTE :
Automatiser la sauvegarde sécurisée, résiliente et conforme d'une base de données de production avec rotation des archives et alertes en cas d'incident.

TÂCHES :
1. Rédige un script de backup robuste (PowerShell ou Bash) intégrant :
   - Export cohérent (dump consistant avec verrouillage minimal).
   - Compression à chaud (gzip / zstd).
   - Horodatage ISO 8601 dans la nomenclature de fichier.
   - Chiffrement symétrique optionnel (AES-256 via GPG / OpenSSL).
2. Implémente une politique de rétention (Purge automatique des sauvegardes > N jours).
3. Intègre un mécanisme de notification d'état (succès / échec vers webhook Slack ou log système).

CONTRAINTES & GARDE-FOUS :
- Ne jamais stocker de mots de passe en clair dans le script (utiliser des variables d'environnement ou un gestionnaire de secrets).
- Tester systématiquement le code retour ($LASTEXITCODE / $?) après chaque opération critique.
- Bloquer l'exécution si l'espace disque résiduel est inférieur à 20%.

FORMAT DE SORTIE ATTENDU :
- Script commenté prêt à l'emploi.
- Guide d'installation rapide des prérequis.
- Commande crontab / Task Scheduler recommandée.
```

## 2. 🥊 Routine Grill-Me (Affinement & Détection des Angles Morts)

Pour affûter ce prompt avant exécution, clarifions ces 4 points critiques :
1. **Type de SGBD** : La sauvegarde cible-t-elle PostgreSQL, MySQL/MariaDB, MongoDB ou SQLite ?
2. **Environnement d'exécution** : Le script tournera-t-il sous Linux (Bash) ou sous Windows (PowerShell) ?
3. **Destination du stockage** : Les backups sont-ils conservés localement sur le serveur, transférés sur un partage NFS/SMB, ou expédiés sur un bucket Cloud (S3, GCS, Azure Blob) ?
4. **Volume estimé** : Quel est l'ordre de grandeur de la base (< 1 Go, ~50 Go, > 1 To) pour calibrer la méthode de dump (logique vs physique) ?

---

### 🚦 Choix Final — Quelle suite souhaitez-vous donner ?

Indiquez simplement votre choix :
- **[1] Exécuter** : Lancer immédiatement la génération du script avec les options par défaut ou en précisant vos réponses aux questions ci-dessus.
- **[2] Mettre de côté** : Sauvegarder ce prompt optimisé dans `.agents/drafts/` pour une utilisation ultérieure.
- **[3] Oublier** : Abandonner cette session de brainstorming.
```
