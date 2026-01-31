/* ========================================
   Smart City Planner - City Storage Manager
   ======================================== */

import { generateId } from './helpers.js';

const STORAGE_KEY = 'smart_city_saved_cities';
const MAX_STORED_CITIES = 10;

export class CityStorage {
    constructor() {
        this.cities = this.loadAll();
    }

    /**
     * Load all saved cities from localStorage
     * @returns {Array}
     */
    loadAll() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load cities:', error);
            return [];
        }
    }

    /**
     * Save all cities to localStorage
     */
    saveAll() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cities));
            return true;
        } catch (error) {
            console.error('Failed to save cities:', error);
            return false;
        }
    }

    /**
     * Save a city
     * @param {CityModel} city 
     * @param {string} name 
     * @returns {Object} Saved city metadata
     */
    save(city, name = null) {
        const savedCity = {
            id: city.id || generateId(),
            name: name || city.name || `City ${this.cities.length + 1}`,
            savedAt: new Date().toISOString(),
            gridSize: city.gridSize,
            size: city.size,
            stats: { ...city.stats },
            distribution: { ...city.distribution },
            grid: city.grid
        };

        // Check if already exists (update)
        const existingIndex = this.cities.findIndex(c => c.id === savedCity.id);
        if (existingIndex >= 0) {
            this.cities[existingIndex] = savedCity;
        } else {
            // Add new city (limit to max)
            if (this.cities.length >= MAX_STORED_CITIES) {
                this.cities.shift(); // Remove oldest
            }
            this.cities.push(savedCity);
        }

        this.saveAll();
        return savedCity;
    }

    /**
     * Load a city by ID
     * @param {string} id 
     * @returns {Object|null}
     */
    load(id) {
        return this.cities.find(c => c.id === id) || null;
    }

    /**
     * Delete a city by ID
     * @param {string} id 
     * @returns {boolean}
     */
    delete(id) {
        const index = this.cities.findIndex(c => c.id === id);
        if (index >= 0) {
            this.cities.splice(index, 1);
            this.saveAll();
            return true;
        }
        return false;
    }

    /**
     * Get list of saved cities (metadata only)
     * @returns {Array}
     */
    getList() {
        return this.cities.map(c => ({
            id: c.id,
            name: c.name,
            savedAt: c.savedAt,
            gridSize: c.gridSize,
            sustainabilityScore: c.stats?.sustainabilityScore || 0,
            population: c.stats?.population || 0
        }));
    }

    /**
     * Clear all saved cities
     */
    clearAll() {
        this.cities = [];
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Compare two cities
     * @param {string} id1 
     * @param {string} id2 
     * @returns {Object}
     */
    compare(id1, id2) {
        const city1 = this.load(id1);
        const city2 = this.load(id2);

        if (!city1 || !city2) return null;

        return {
            city1: {
                name: city1.name,
                stats: city1.stats,
                distribution: city1.distribution
            },
            city2: {
                name: city2.name,
                stats: city2.stats,
                distribution: city2.distribution
            },
            differences: {
                sustainabilityScore: city2.stats.sustainabilityScore - city1.stats.sustainabilityScore,
                population: city2.stats.population - city1.stats.population,
                greenCoverage: city2.stats.greenCoverage - city1.stats.greenCoverage,
                transitScore: city2.stats.transitScore - city1.stats.transitScore,
                walkability: city2.stats.walkability - city1.stats.walkability,
                carbonFootprint: city2.stats.carbonFootprint - city1.stats.carbonFootprint
            }
        };
    }
}
