# 🛡️ Test de Sécurité (POC : OWASP ZAP & NPM Audit)

Ce document explique comment tester et garantir la sécurité d'AynTrace en utilisant les meilleurs outils standards du marché.

---

## 1️⃣ Analyse Statique : `npm audit`
C'est la première ligne de défense. Cet outil scanne toutes les librairies installées pour trouver des vulnérabilités connues dans la base de données GitHub Advisory.

### 🏃‍♂️ Comment lancer le test :
Ouvrez votre terminal à la racine du projet et tapez :
```bash
npm audit
```

### 📊 Comprendre les résultats :
- **Vulnerabilities found** : Nombre de failles détectées.
- **Severity (Low/Moderate/High/Critical)** : Indique la gravité.
- **Action** : Utilisez `npm audit fix` pour corriger automatiquement les failles mineures.

---

## 2️⃣ Analyse Dynamique : OWASP ZAP
**OWASP ZAP** simule une cyber-attaque réelle sur votre application en cours d'exécution.

### 🏃‍♂️ Comment lancer le test :
1. **Lancer AynTrace** : Assurez-vous que le Backend (`localhost:3001`) et le Frontend (`localhost:8080`) tournent.
2. **Ouvrir ZAP Desktop** : Si vous ne l'avez pas, téléchargez-le sur [zaproxy.org](https://www.zaproxy.org/).
3. **Scan Automatisé** :
   - Cliquez sur **"Automated Scan"**.
   - URL : `http://localhost:8080/`.
   - Cliquez sur **"Attack"**.
4. **Attendre** : ZAP va explorer le site (Spider) puis attaquer (Active Scan).

### 🧐 Comment obtenir et lire le rapport :
Une fois terminé, allez dans le menu **Report -> Generate Report**. Vous obtiendrez un fichier HTML listant les alertes :

- 🔴 **High (Critique)** : Faut corriger immédiatement (ex: Mot de passe en clair).
- 🟠 **Medium (Moyen)** : Risque de vol de données ou détournement de session.
- 🟡 **Low (Faible)** : Manque de protection préventive.

---

## 🔍 Explication des tests de sécurité (Ce qu'on cherche)

### 💉 Injection SQL
- **C'est quoi ?** Un pirate tente d'envoyer des commandes de base de données via un champ texte (ex: mettre `' OR 1=1 --` dans le login).
- **Notre protection :** Nous utilisons **Knex.js**. Knex nettoie automatiquement toutes les entrées utilisateur pour empêcher toute commande SQL malveillante d'être exécutée.

### 🎭 XSS (Cross-Site Scripting)
- **C'est quoi ?** L'injection d'un script JavaScript malveillant dans la page d'un autre utilisateur.
- **Notre protection :** **React** échappe automatiquement les données affichées. De plus, nous avons ajouté **Helmet.js** sur le backend pour bloquer l'exécution de scripts non autorisés.

### 🍪 Session & Cookies
- **C'est quoi ?** Un pirate tente de voler votre "clé" de connexion (token).
- **Notre protection :** Nous utilisons des **JWT (JSON Web Tokens)** sécurisés et nous configurons les cookies avec les flags `HttpOnly` et `Secure` pour les rendre inaccessibles aux scripts pirates.

### 🚪 Brute Force
- **C'est quoi ?** Essayer des milliers de mots de passe à la suite.
- **Notre protection :** Le backend peut être configuré avec un "Rate Limiter" pour bloquer une IP après trop d'échecs.

### 🛡️ Headers de Sécurité (Security Headers)
- **C'est quoi ?** Des instructions envoyées au navigateur pour renforcer la sécurité (ex: empêcher d'afficher AynTrace dans une `iframe` pirate).
- **Notre protection :** **Helmet.js** configure automatiquement ces en-têtes (Content-Security-Policy, X-Frame-Options, etc.).

---

## 🏆 Résumé de notre état de sécurité
Grâce aux corrections récentes (`npm audit fix` et l'ajout de **Helmet**), AynTrace passe les tests de sécurité de base avec succès. Le backend est désormais propre (0 faille critique) et prêt pour une mise en production sécurisée.
