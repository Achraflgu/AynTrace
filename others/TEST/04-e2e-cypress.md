# 🤖 Test End-to-End (E2E) : Cypress

**Cypress** est un outil de test de bout en bout (E2E) de nouvelle génération conçu pour les applications web modernes. Contrairement aux tests unitaires, les tests E2E simulent le comportement réel d'un utilisateur naviguant sur votre application (clics, frappes au clavier, attente de chargement).

---

## 🎯 Objectif du Test
Valider les parcours critiques (Critical Paths) de la plateforme **AynTrace** :
1. L'authentification réussie d'un administrateur.
2. Le chargement correct du Dashboard (Statistiques, Map).
3. La navigation vers le module "Gestion de la Flotte" et la vérification de la présence des devices.

---

## 🛠️ Installation & Configuration

Si Cypress n'est pas encore installé dans votre projet, exécutez cette commande à la racine de votre Frontend :

```bash
npm install cypress --save-dev
```

Initialisez Cypress en l'ouvrant une première fois (cela créera le dossier `cypress/`) :
```bash
npx cypress open
```
*Sélectionnez "E2E Testing" dans l'interface qui s'ouvre, puis choisissez votre navigateur.*

---

## 💻 Le Scénario de Test (Login & Dashboard)

Créez un fichier `cypress/e2e/ayntrace_critical_path.cy.ts` (ou `.js`) et copiez-y le code suivant :

```javascript
describe('AynTrace - Parcours Utilisateur Critique', () => {
  const FRONTEND_URL = 'http://localhost:8080'; // Ajustez si votre port est différent

  beforeEach(() => {
    // Intercepter l'appel API de login pour s'assurer que le backend répond
    cy.intercept('POST', '**/api/auth/login').as('loginRequest');
  });

  it('1. Devrait afficher la page de connexion', () => {
    cy.visit(`${FRONTEND_URL}/login`);
    cy.get('h1').should('contain', 'AynTrace'); // Vérifie le titre
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });

  it('2. Devrait connecter l\'Administrateur et afficher le Dashboard', () => {
    cy.visit(`${FRONTEND_URL}/login`);
    
    // Remplissage du formulaire
    cy.get('input[type="email"]').type('admin@ayntrace.com'); // Mettez un vrai email de test
    cy.get('input[type="password"]').type('password123'); // Mettez le mot de passe
    
    // Soumission
    cy.get('button[type="submit"]').click();

    // Attente de la réponse du backend
    cy.wait('@loginRequest').its('response.statusCode').should('eq', 200);

    // Vérification de la redirection
    cy.url().should('include', '/dashboard');
    
    // Vérification de l'affichage des KPIs
    cy.contains('Total Devices').should('be.visible');
  });

  it('3. Devrait afficher la carte GPS (Map)', () => {
    // Cypress garde le localStorage si on ne le clear pas, ou on peut se relogguer
    // Ici on suppose qu'on est sur le dashboard
    cy.get('.leaflet-container', { timeout: 10000 }).should('be.visible');
  });

  it('4. Devrait naviguer vers la gestion des flottes', () => {
    cy.get('nav').contains('Flotte').click(); // Ajustez le texte du menu
    cy.url().should('include', '/devices');
    cy.get('table').should('be.visible'); // Le tableau des devices
  });
});
```

---

## 🏃‍♂️ Comment lancer le test

Vous avez deux options pour exécuter les tests :

### Option 1 : Mode Graphique (Interactif)
Idéal pour voir l'automatisation en direct et déboguer.
```bash
npx cypress open
```
*Cliquez ensuite sur votre fichier de test `ayntrace_critical_path` dans l'interface.*

### Option 2 : Mode Terminal (Headless / CI)
Idéal pour un rapport final propre (PFE) ou pour l'intégration continue.
```bash
npx cypress run
```

---

## 📊 Résultats Attendus pour le Rapport PFE

Dans votre chapitre sur les tests, vous pourrez insérer une capture d'écran du terminal ou de l'interface Cypress montrant **les ✅ coches vertes** devant chaque étape :
- ✅ Affichage page de connexion
- ✅ Authentification réussie
- ✅ Chargement des KPIs et de la Map
- ✅ Navigation inter-modules fonctionnelle

Cela prouve au jury que l'interface critique de la plateforme est stable et que les liaisons Frontend/Backend/Base de données sont opérationnelles (Integration / E2E).
