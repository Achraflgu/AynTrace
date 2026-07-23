# 🚀 Test de Charge (Load / Stress Test) : 5000 Radios

## 🎯 Pourquoi Node.js au lieu de Apache JMeter ?
Vous avez mentionné **Apache JMeter** dans votre tableau. JMeter est un outil fantastique pour simuler des centaines d'utilisateurs naviguant sur des pages web. 

Cependant, pour un **POC de 5000 traceurs GPS (Radios IoT)**, j'ai choisi d'écrire un script **Node.js natif** pour les raisons suivantes :
1. **Comportement IoT Réel :** Nos traceurs doivent envoyer des coordonnées GPS aléatoires, calculer des vitesses et des niveaux de batterie à la volée. Faire cette logique dynamique (génération de fausses données) est extrêmement complexe dans JMeter, mais très simple en JavaScript.
2. **Pression Concurrente :** Node.js gère nativement des milliers de connexions simultanées grâce à sa boucle d'événements (Event Loop). Notre script peut "marteler" le backend (Stress Test) avec la même architecture que notre API.
3. **Aucune installation lourde :** Vous avez déjà Node.js installé, vous n'avez pas besoin d'installer Java et l'interface lourde de JMeter pour lancer ce test.

## ⚙️ Ce que fait ce test
Ce test simule **5000 dispositifs** qui bombardent le serveur backend avec des mises à jour de position (télémétrie) pour voir si :
- La base de données PostgreSQL tient la charge.
- Le backend Express.js ne plante pas.
- Le Websocket qui renvoie les données au Dashboard ne ralentit pas.

Il y a deux scripts dans le dossier `others/TEST/Charge/` :
- `setup_5000_devices.js` : Injecte 5000 faux traceurs dans votre base de données PostgreSQL.
- `stress_test_5000.js` : Simule ces 5000 traceurs envoyant des données en continu.

---

## 💻 Commandes pour lancer le test

Ouvrez un terminal à la racine du projet (`enterprise-guard-track`).

### 1️⃣ Préparer la Base de Données (Une seule fois)
Cette commande va insérer 5000 traceurs factices dans la base de données.
*(Assurez-vous que la BD PostgreSQL est allumée. Le backend n'est pas nécessaire pour cette étape).*
```bash
node others/TEST/Charge/setup_5000_devices.js
```

### 2️⃣ Lancer le Serveur Backend
Ouvrez un autre terminal et lancez votre backend pour qu'il soit prêt à recevoir les données :
```bash
cd server
npm start
```

### 3️⃣ Lancer l'Attaque (Stress Test)
Dans le premier terminal, lancez le script de simulation. Il va cibler `http://localhost:3001/api/track` et envoyer des données pendant 30 secondes en continu.
```bash
node others/TEST/Charge/stress_test_5000.js
```

---

## 📈 Comment lire les résultats ?

Pendant les 30 secondes, le script va afficher des lignes comme ceci pour vous montrer qu'il tourne :
`[Cycle 1] Sent 500 updates in 45ms. Success: 500, Errors: 0`

**À la toute fin du test, un grand tableau de synthèse apparaîtra automatiquement dans votre terminal.** Voici à quoi il ressemble et comment l'interpréter :

```text
==================================================
✅ STRESS TEST COMPLETED (5000 Radios POC)
==================================================
Duration:         30.0 s
Total Requests:   15000
Success Rate:     100.00% (15000 OK, 0 Errors)
Throughput:       500.00 req/sec
--------------------------------------------------
Latencies:
  Median (p50):   12 ms   <-- Le temps moyen mis par le backend pour répondre.
  p95:            25 ms   <-- 95% des requêtes sont traitées en moins de 25ms.
  p99:            45 ms   <-- Les 1% les plus lentes (pics de charge).
==================================================
```

### 🎯 Les indicateurs de réussite (Sans Dégradation) :
1. **Success Rate (Taux de Succès) à 100%** : Prouve qu'aucune requête GPS n'est perdue (le backend Express et PostgreSQL ne plantent pas).
2. **Median (p50) < 100ms** : Prouve que le système réagit instantanément.
3. **Le Dashboard Réel** : Ouvrez votre site web (`http://localhost:8080/dashboard`) pendant que le test tourne. Si la carte et la liste s'actualisent en direct sans faire crasher votre navigateur, vous avez réussi votre POC des "5000 Radios sans dégradation" !
