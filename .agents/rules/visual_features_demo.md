# 🎨 Règle `visual-features-demo` — Génération d'Images & Démo d'Utilisation des Features

## 🎯 Objectif
Garantir une restitution visuelle immédiate et une prise en main instantanée à chaque ajout ou refonte de composant ou de fonctionnalité UI/UX.

---

## 📌 Directives Obligatoires pour l'Agent

Dès qu'une fonctionnalité front-end, un écran ou un composant d'interface est créé, remanié ou corrigé :

### 1. Génération Visuelle par Défaut (Mockup / Preview)
- L'agent **DOIT** générer systématiquement une illustration visuelle du rendu proposé :
  - Soit en invoquant le subagent `image-generator` pour produire des maquettes haute fidélité (Dark Mode, Cyber/Quant Bloomberg theme, accents cyan `#06b6d4` et vert émeraude `#10b981`).
  - Soit en produisant un composant de démonstration interactif ou un aperçu visuel clair (Carousel, Generative UI).
- Présenter les images avec leurs liens directs ou balises Markdown dans le compte-rendu.

### 2. Guide de Démo Express (Quelques Mots Brefs)
Chaque livraison de feature doit inclure un mini-guide de prise en main en 3 à 4 puces concrètes :
- 🎯 **Étape 1 (Déclencheur)** : Où cliquer ou quelle action déclenche la feature.
- ⚡ **Étape 2 (Interaction)** : Ce que l'utilisateur voit et peut configurer.
- 📊 **Étape 3 (Validation & Effet)** : Ce qui est calculé, validé ou scellé en base/état.
