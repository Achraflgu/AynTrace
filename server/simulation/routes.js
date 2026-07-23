// Predefined routes in Tunisia for realistic device simulation
// Each route is an array of [lng, lat] coordinates

export const routes = {
    // Tunis Centre to La Marsa (coastal route)
    'tunis-marsa': [
        [10.1815, 36.8065],  // Tunis Centre
        [10.1830, 36.8090],
        [10.1860, 36.8120],
        [10.1900, 36.8150],
        [10.1950, 36.8180],
        [10.2010, 36.8210],
        [10.2080, 36.8250],
        [10.2150, 36.8290],
        [10.2230, 36.8330],
        [10.2310, 36.8370],
        [10.2400, 36.8420],
        [10.2500, 36.8480],
        [10.2600, 36.8540],
        [10.2710, 36.8610],
        [10.2820, 36.8680],
        [10.2930, 36.8750],
        [10.3050, 36.8810],
        [10.3150, 36.8850],
        [10.3246, 36.8889]   // La Marsa
    ],

    // Tunis to Ariana loop
    'tunis-ariana': [
        [10.1815, 36.8065],  // Tunis Centre
        [10.1780, 36.8100],
        [10.1750, 36.8140],
        [10.1720, 36.8190],
        [10.1690, 36.8240],
        [10.1660, 36.8300],
        [10.1640, 36.8360],
        [10.1620, 36.8420],
        [10.1610, 36.8480],
        [10.1600, 36.8540],  // Ariana
        [10.1620, 36.8590],
        [10.1660, 36.8630],
        [10.1710, 36.8660],
        [10.1770, 36.8680],
        [10.1840, 36.8690],
        [10.1910, 36.8680],
        [10.1970, 36.8650],
        [10.2010, 36.8600],
        [10.2030, 36.8540],
        [10.2020, 36.8480],
        [10.1980, 36.8420],
        [10.1930, 36.8360],
        [10.1880, 36.8300],
        [10.1850, 36.8240],
        [10.1830, 36.8180],
        [10.1820, 36.8120],
        [10.1815, 36.8065]   // Back to Tunis
    ],

    // Industrial zone delivery route
    'industrial-loop': [
        [10.2100, 36.8400],  // Zone Industrielle
        [10.2150, 36.8420],
        [10.2210, 36.8450],
        [10.2280, 36.8480],
        [10.2350, 36.8510],
        [10.2420, 36.8530],
        [10.2480, 36.8540],
        [10.2530, 36.8530],
        [10.2570, 36.8500],
        [10.2590, 36.8460],
        [10.2580, 36.8410],
        [10.2550, 36.8370],
        [10.2500, 36.8340],
        [10.2440, 36.8320],
        [10.2370, 36.8310],
        [10.2300, 36.8320],
        [10.2230, 36.8340],
        [10.2160, 36.8370],
        [10.2100, 36.8400]   // Back to start
    ],

    // La Goulette port route
    'goulette-port': [
        [10.3050, 36.8180],  // Port de La Goulette
        [10.3000, 36.8200],
        [10.2940, 36.8230],
        [10.2870, 36.8260],
        [10.2800, 36.8280],
        [10.2720, 36.8300],
        [10.2640, 36.8310],
        [10.2560, 36.8300],
        [10.2490, 36.8270],
        [10.2430, 36.8230],
        [10.2390, 36.8180],
        [10.2370, 36.8130],
        [10.2380, 36.8080],
        [10.2420, 36.8040],
        [10.2480, 36.8010],
        [10.2560, 36.8000],
        [10.2650, 36.8010],
        [10.2740, 36.8040],
        [10.2830, 36.8080],
        [10.2910, 36.8120],
        [10.2980, 36.8160],
        [10.3050, 36.8180]   // Back to port
    ]
};

// Address templates for each route
export const routeAddresses = {
    'tunis-marsa': [
        'Avenue Habib Bourguiba, Tunis',
        'Rue de Marseille, Tunis',
        'Boulevard du 9 Avril, Tunis',
        'Le Belvédère, Tunis',
        'Cité Jardins, La Marsa',
        'Avenue de la République, La Marsa',
        'Plage de La Marsa'
    ],
    'tunis-ariana': [
        'Avenue de la Liberté, Tunis',
        'Cité El Khadra, Ariana',
        'Centre Urbain Nord, Ariana',
        'Ennasr 2, Ariana',
        'Lac 1, Tunis'
    ],
    'industrial-loop': [
        'Zone Industrielle, Ben Arous',
        'Route de Fouchana',
        'Zone Franche, Ben Arous',
        'Mégrine, Ben Arous'
    ],
    'goulette-port': [
        'Port de La Goulette',
        'Avenue Franklin Roosevelt, La Goulette',
        'Le Kram',
        'Carthage Byrsa'
    ]
};
