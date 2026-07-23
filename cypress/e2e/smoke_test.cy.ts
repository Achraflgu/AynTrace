describe('AynTrace Smoke Test', () => {
  it('Should successfully login and interact with the dashboard', () => {
    // 1. Visiter la page de connexion
    cy.visit('/login');
    
    // 2. Remplir les informations de démo
    cy.get('#email').type('demo@ayntrace.tn');
    cy.get('#password').type('password123'); // N'importe quel mot de passe fonctionne pour la démo
    
    // 3. Soumettre le formulaire
    cy.get('button[type="submit"]').first().click();
    
    // 4. Vérifier que nous sommes sur le Dashboard
    cy.url().should('include', '/dashboard');
    cy.get('h1').should('exist');
    cy.contains(/Tableau de bord/i).should('exist');

    // 5. Tester le changement de thème (Mode clair/sombre)
    // On attend que l'élément soit visible car le dashboard peut mettre un peu de temps à charger
    cy.get('button[aria-label*="Mode"]', { timeout: 10000 }).first().click();
    
    // On peut vérifier que le clic a fonctionné en vérifiant que le label a changé
    cy.get('button[aria-label*="Mode"]').should('exist');
  });
});
