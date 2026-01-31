/* ========================================
   Smart City Planner - Sample Cities Data
   Historical city templates based on real-world examples
   ======================================== */

export const SAMPLE_CITIES = {
    copenhagen: {
        name: 'Copenhagen Model',
        description: 'Based on Copenhagen, Denmark - a world leader in sustainable urban planning',
        population: 650000,
        gridSize: 80,
        ratios: {
            residentialRatio: 0.30,
            commercialRatio: 0.12,
            industrialRatio: 0.05,
            greenRatio: 0.35,
            transitRatio: 0.12,
            roadRatio: 0.06
        },
        features: [
            '35% green coverage with connected parks',
            'Extensive cycling infrastructure',
            'District heating network',
            'Harbor front regeneration'
        ]
    },

    singapore: {
        name: 'Singapore Model',
        description: 'Based on Singapore - high-density, transit-oriented smart city',
        population: 5900000,
        gridSize: 120,
        ratios: {
            residentialRatio: 0.35,
            commercialRatio: 0.20,
            industrialRatio: 0.10,
            greenRatio: 0.18,
            transitRatio: 0.12,
            roadRatio: 0.05
        },
        features: [
            'Integrated transit network (MRT)',
            'High-rise residential clusters',
            'Smart traffic management',
            'Gardens and skyparks'
        ]
    },

    curitiba: {
        name: 'Curitiba Model',
        description: 'Based on Curitiba, Brazil - pioneer of Bus Rapid Transit',
        population: 1900000,
        gridSize: 100,
        ratios: {
            residentialRatio: 0.38,
            commercialRatio: 0.15,
            industrialRatio: 0.08,
            greenRatio: 0.22,
            transitRatio: 0.12,
            roadRatio: 0.05
        },
        features: [
            'Bus Rapid Transit (BRT) corridors',
            'Linear parks along waterways',
            'Mixed-use development zones',
            'Pedestrian-only downtown'
        ]
    },

    amsterdam: {
        name: 'Amsterdam Model',
        description: 'Based on Amsterdam, Netherlands - bicycle-friendly canal city',
        population: 870000,
        gridSize: 80,
        ratios: {
            residentialRatio: 0.32,
            commercialRatio: 0.15,
            industrialRatio: 0.06,
            greenRatio: 0.25,
            transitRatio: 0.15,
            roadRatio: 0.07
        },
        features: [
            'World-class cycling infrastructure',
            'Dense tram and metro network',
            'Historic canal integration',
            'Car-free zones'
        ]
    },

    portland: {
        name: 'Portland Model',
        description: 'Based on Portland, Oregon - urban growth boundary pioneer',
        population: 650000,
        gridSize: 80,
        ratios: {
            residentialRatio: 0.35,
            commercialRatio: 0.12,
            industrialRatio: 0.08,
            greenRatio: 0.28,
            transitRatio: 0.10,
            roadRatio: 0.07
        },
        features: [
            'Urban growth boundary',
            'Light rail transit (MAX)',
            'Urban forest cover',
            'Neighborhood-scale planning'
        ]
    },

    masdar: {
        name: 'Masdar City Model',
        description: 'Based on Masdar City, UAE - zero-carbon sustainable city',
        population: 50000,
        gridSize: 50,
        ratios: {
            residentialRatio: 0.25,
            commercialRatio: 0.20,
            industrialRatio: 0.02,
            greenRatio: 0.30,
            transitRatio: 0.18,
            roadRatio: 0.05
        },
        features: [
            '100% renewable energy target',
            'Personal Rapid Transit pods',
            'Zero-waste systems',
            'Passive cooling design'
        ]
    },

    barcelona: {
        name: 'Barcelona Superblocks',
        description: 'Based on Barcelona\'s superblock (superilles) model',
        population: 1600000,
        gridSize: 100,
        ratios: {
            residentialRatio: 0.35,
            commercialRatio: 0.18,
            industrialRatio: 0.05,
            greenRatio: 0.22,
            transitRatio: 0.15,
            roadRatio: 0.05
        },
        features: [
            'Superblock grid pattern',
            'Interior plazas and parks',
            'Reduced through-traffic',
            'Ground-floor retail mix'
        ]
    },

    tokyo: {
        name: 'Tokyo TOD Model',
        description: 'Based on Tokyo, Japan - transit-oriented mega-city',
        population: 14000000,
        gridSize: 120,
        ratios: {
            residentialRatio: 0.35,
            commercialRatio: 0.22,
            industrialRatio: 0.08,
            greenRatio: 0.12,
            transitRatio: 0.18,
            roadRatio: 0.05
        },
        features: [
            'Dense rail network integration',
            'Mixed-use station districts',
            'Efficient land use',
            'Advanced smart city tech'
        ]
    }
};

/**
 * Get all sample cities as list
 * @returns {Array}
 */
export function getSampleCityList() {
    return Object.entries(SAMPLE_CITIES).map(([id, city]) => ({
        id,
        name: city.name,
        description: city.description,
        population: city.population
    }));
}

/**
 * Get sample city data by ID
 * @param {string} id 
 * @returns {Object|null}
 */
export function getSampleCity(id) {
    return SAMPLE_CITIES[id] || null;
}
