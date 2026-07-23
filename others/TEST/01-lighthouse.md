# 🚀 Test de Performance Frontend (Google Lighthouse)

## 🎯 Pourquoi ce test ?
**Lighthouse** est un outil de Google conçu pour auditer les performances du **frontend** (le côté client du site web). 
Il vérifie :
- **Performance** : Le temps de chargement de la page (vitesse d'affichage).
- **Accessibilité (A11y)** : Si le site est utilisable par les personnes handicapées (contraste des couleurs, balises `aria`).
- **Best Practices** : La sécurité du code client et l'utilisation des normes modernes.
- **SEO** : L'optimisation pour les moteurs de recherche (balises meta, mots clés).

## 📊 Ce qu'on a analysé pour AynTrace :
Nous avons audité :
1. La Landing Page (`/`)
2. Le Dashboard (`/dashboard`)

*Nous avons implémenté le "Code Splitting" (chargement asynchrone des pages) et corrigé les tailles des boutons et les contrastes pour atteindre les 100% en SEO et ~90%+ en performance en production.*

---

## 💻 Commande pour lancer le test

Puisque Lighthouse doit être exécuté sur un code optimisé pour la production (minifié, sans les lourdeurs du mode développement), voici les étapes exactes :

1. **Construire le projet pour la production :**
   ```bash
   npm run build
   ```

2. **Lancer le serveur de prévisualisation (simule la production) :**
   ```bash
   npm run preview
   ```
   *(Cela va ouvrir le site sur `http://localhost:4173`)*

3. **Exécuter Lighthouse :**
   - Ouvrez Google Chrome.
   - Allez sur `http://localhost:4173`.
   - Ouvrez les outils de développement (Touche `F12` ou `Clic droit > Inspecter`).
   - Allez dans l'onglet **"Lighthouse"**.
   - Cliquez sur le bouton **"Analyze page load"**.
