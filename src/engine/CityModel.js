/* ========================================
   Smart City Planner - City Model
   ======================================== */

import { ZONE_TYPES, CITY_SIZES } from '../utils/constants.js';
import { create2DArray, generateId, deepClone, calculateSustainabilityScore } from '../utils/helpers.js';

export class CityModel {
    constructor(size = 'medium') {
        this.id = generateId();
        this.name = 'New City';

        // Handle both string size keys ('small', 'medium', 'large') and numeric grid sizes
        if (typeof size === 'number') {
            // Direct grid size passed
            this.size = size <= 60 ? 'small' : size <= 100 ? 'medium' : 'large';
            this.gridSize = size;
            this.targetPopulation = size <= 60 ? 100000 : size <= 100 ? 500000 : 2000000;
        } else {
            // String size key passed
            this.size = size;
            const sizeConfig = CITY_SIZES[size] || CITY_SIZES.medium;
            this.gridSize = sizeConfig.grid;
            this.targetPopulation = sizeConfig.population;
        }

        // Initialize grid with empty zones
        this.grid = create2DArray(this.gridSize, this.gridSize, () => ({
            type: 'empty',
            id: generateId()
        }));

        // City statistics
        this.stats = {
            population: 0,
            energyConsumption: 0,
            carbonFootprint: 0,
            greenCoverage: 0,
            transitScore: 50,
            walkability: 50,
            airQuality: 70,
            energyEfficiency: 60,
            sustainabilityScore: 50
        };

        // Zone distribution
        this.distribution = {
            empty: this.gridSize * this.gridSize,
            residential: 0,
            commercial: 0,
            industrial: 0,
            green: 0,
            transit: 0,
            road: 0
        };

        // Road network
        this.roads = [];

        // Transit network
        this.transitLines = [];

        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;

        this.saveState();
    }

    /**
     * Set a zone at the specified position
     * @param {number} x 
     * @param {number} y 
     * @param {string} type 
     */
    setZone(x, y, type) {
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
        if (!ZONE_TYPES[type]) return;

        const oldType = this.grid[y][x].type;
        if (oldType === type) return;

        // Update distribution
        this.distribution[oldType]--;
        this.distribution[type]++;

        // Update grid
        this.grid[y][x] = {
            type,
            id: generateId()
        };

        // Recalculate stats
        this.calculateStats();
    }

    /**
     * Fill a rectangular area with a zone type
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {string} type 
     */
    fillArea(x1, y1, x2, y2, type) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                this.setZone(x, y, type);
            }
        }

        this.saveState();
    }

    /**
     * Get zone at position
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null}
     */
    getZone(x, y) {
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return null;
        return this.grid[y][x];
    }

    /**
     * Calculate all city statistics
     */
    calculateStats() {
        const totalCells = this.gridSize * this.gridSize;
        const builtCells = totalCells - this.distribution.empty;

        // Population
        this.stats.population = Object.entries(this.distribution).reduce((sum, [type, count]) => {
            return sum + (ZONE_TYPES[type]?.population || 0) * count;
        }, 0);

        // Energy consumption
        this.stats.energyConsumption = Object.entries(this.distribution).reduce((sum, [type, count]) => {
            return sum + (ZONE_TYPES[type]?.energy || 0) * count;
        }, 0);

        // Green coverage (percentage)
        this.stats.greenCoverage = builtCells > 0
            ? Math.round((this.distribution.green / builtCells) * 100)
            : 0;

        // Transit score
        const transitRatio = builtCells > 0 ? this.distribution.transit / builtCells : 0;
        const residentialRatio = builtCells > 0 ? this.distribution.residential / builtCells : 0;
        this.stats.transitScore = Math.round(50 + transitRatio * 200 - residentialRatio * 30);
        this.stats.transitScore = Math.min(100, Math.max(0, this.stats.transitScore));

        // Walkability
        const greenBonus = this.stats.greenCoverage * 0.5;
        const transitBonus = transitRatio * 50;
        const industrialPenalty = builtCells > 0 ? (this.distribution.industrial / builtCells) * 30 : 0;
        this.stats.walkability = Math.round(50 + greenBonus + transitBonus - industrialPenalty);
        this.stats.walkability = Math.min(100, Math.max(0, this.stats.walkability));

        // Air quality
        const greenAirBonus = this.stats.greenCoverage * 0.8;
        const industrialAirPenalty = builtCells > 0 ? (this.distribution.industrial / builtCells) * 50 : 0;
        const transitAirBonus = transitRatio * 20;
        this.stats.airQuality = Math.round(60 + greenAirBonus + transitAirBonus - industrialAirPenalty);
        this.stats.airQuality = Math.min(100, Math.max(0, this.stats.airQuality));

        // Energy efficiency
        const renewableBonus = this.stats.greenCoverage * 0.3;
        const industrialEnergyPenalty = builtCells > 0 ? (this.distribution.industrial / builtCells) * 20 : 0;
        this.stats.energyEfficiency = Math.round(60 + renewableBonus - industrialEnergyPenalty);
        this.stats.energyEfficiency = Math.min(100, Math.max(0, this.stats.energyEfficiency));

        // Carbon footprint (relative, negative is good)
        const industrialCarbon = this.distribution.industrial * 10;
        const commercialCarbon = this.distribution.commercial * 5;
        const greenOffset = this.distribution.green * 8;
        const transitOffset = this.distribution.transit * 4;
        const netCarbon = industrialCarbon + commercialCarbon - greenOffset - transitOffset;
        const maxCarbon = builtCells * 5;
        this.stats.carbonFootprint = maxCarbon > 0
            ? Math.round((netCarbon / maxCarbon) * 100)
            : 0;

        // Overall sustainability score
        this.stats.sustainabilityScore = calculateSustainabilityScore(this.distribution);
    }

    /**
     * Generate city layout from AI or preset
     * @param {Object} params 
     */
    generateLayout(params) {
        const {
            residentialRatio = 0.35,
            commercialRatio = 0.15,
            industrialRatio = 0.1,
            greenRatio = 0.25,
            transitRatio = 0.08,
            roadRatio = 0.07
        } = params;

        // Clear the grid
        this.clear();

        const totalCells = this.gridSize * this.gridSize;
        const center = Math.floor(this.gridSize / 2);

        // Create main roads (grid pattern)
        this.generateRoadNetwork();

        // Define city zones based on distance from center
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.grid[y][x].type !== 'empty') continue;

                const distFromCenter = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
                const maxDist = center * 1.4;
                const normalizedDist = distFromCenter / maxDist;

                // Randomize zone placement based on ratios and distance
                const rand = Math.random();
                let zoneType = 'empty';

                if (normalizedDist > 0.9) {
                    // Outer ring: industrial and green
                    if (rand < 0.4) zoneType = 'green';
                    else if (rand < 0.6) zoneType = 'industrial';
                } else if (normalizedDist > 0.6) {
                    // Middle ring: residential
                    if (rand < residentialRatio * 1.5) zoneType = 'residential';
                    else if (rand < residentialRatio * 1.5 + greenRatio) zoneType = 'green';
                } else if (normalizedDist > 0.3) {
                    // Inner ring: mixed
                    if (rand < residentialRatio) zoneType = 'residential';
                    else if (rand < residentialRatio + commercialRatio) zoneType = 'commercial';
                    else if (rand < residentialRatio + commercialRatio + greenRatio * 0.5) zoneType = 'green';
                } else {
                    // Core: commercial and transit
                    if (rand < commercialRatio * 2) zoneType = 'commercial';
                    else if (rand < commercialRatio * 2 + transitRatio * 2) zoneType = 'transit';
                    else if (rand < commercialRatio * 2 + transitRatio * 2 + greenRatio * 0.3) zoneType = 'green';
                }

                if (zoneType !== 'empty') {
                    this.setZone(x, y, zoneType);
                }
            }
        }

        // Add transit hubs at strategic locations
        this.addTransitHubs();

        // Calculate final stats
        this.calculateStats();
        this.saveState();
    }

    /**
     * Generate road network
     */
    generateRoadNetwork() {
        const spacing = Math.floor(this.gridSize / 8);

        // Horizontal roads
        for (let y = spacing; y < this.gridSize; y += spacing) {
            for (let x = 0; x < this.gridSize; x++) {
                this.setZone(x, y, 'road');
            }
        }

        // Vertical roads
        for (let x = spacing; x < this.gridSize; x += spacing) {
            for (let y = 0; y < this.gridSize; y++) {
                this.setZone(x, y, 'road');
            }
        }

        // Diagonal boulevard from corner to corner
        const center = Math.floor(this.gridSize / 2);
        for (let i = -2; i <= 2; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                const offset = Math.round(j - center);
                if (center + offset + i >= 0 && center + offset + i < this.gridSize) {
                    this.setZone(j, center + offset + i, 'road');
                }
            }
        }
    }

    /**
     * Add transit hubs at intersections
     */
    addTransitHubs() {
        const spacing = Math.floor(this.gridSize / 4);

        for (let y = spacing; y < this.gridSize; y += spacing) {
            for (let x = spacing; x < this.gridSize; x += spacing) {
                // Create a 2x2 transit hub
                this.setZone(x, y, 'transit');
                this.setZone(x + 1, y, 'transit');
                this.setZone(x, y + 1, 'transit');
                this.setZone(x + 1, y + 1, 'transit');
            }
        }
    }

    /**
     * Clear the entire grid
     */
    clear() {
        this.grid = create2DArray(this.gridSize, this.gridSize, () => ({
            type: 'empty',
            id: generateId()
        }));

        this.distribution = {
            empty: this.gridSize * this.gridSize,
            residential: 0,
            commercial: 0,
            industrial: 0,
            green: 0,
            transit: 0,
            road: 0
        };

        this.calculateStats();
    }

    /**
     * Save current state to history
     */
    saveState() {
        // Remove any future states if we're not at the end
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add current state
        this.history.push({
            grid: deepClone(this.grid),
            distribution: { ...this.distribution },
            stats: { ...this.stats }
        });

        this.historyIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex <= 0) return false;

        this.historyIndex--;
        const state = this.history[this.historyIndex];

        this.grid = deepClone(state.grid);
        this.distribution = { ...state.distribution };
        this.stats = { ...state.stats };

        return true;
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) return false;

        this.historyIndex++;
        const state = this.history[this.historyIndex];

        this.grid = deepClone(state.grid);
        this.distribution = { ...state.distribution };
        this.stats = { ...state.stats };

        return true;
    }

    /**
     * Export city data as object
     * @returns {Object}
     */
    exportData() {
        return {
            id: this.id,
            name: this.name,
            size: this.size,
            gridSize: this.gridSize,
            grid: this.grid,
            stats: this.stats,
            distribution: this.distribution,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Export city data as JSON string
     * @returns {string}
     */
    export() {
        return JSON.stringify(this.exportData(), null, 2);
    }

    /**
     * Import city data from object
     * @param {Object} data 
     */
    importData(data) {
        try {
            this.id = data.id || generateId();
            this.name = data.name || 'Imported City';
            this.size = data.size || 'medium';
            this.gridSize = data.gridSize || CITY_SIZES[this.size].grid;
            this.grid = data.grid;
            this.distribution = data.distribution;
            this.calculateStats();
            this.saveState();
            return true;
        } catch (e) {
            console.error('Failed to import city:', e);
            return false;
        }
    }

    /**
     * Import city data from JSON string
     * @param {string} json 
     */
    import(json) {
        try {
            const data = JSON.parse(json);
            return this.importData(data);
        } catch (e) {
            console.error('Failed to import city:', e);
            return false;
        }
    }
}
