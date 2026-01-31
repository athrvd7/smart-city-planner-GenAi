/* ========================================
   Smart City Planner - Canvas Renderer
   ======================================== */

import { ZONE_TYPES, LAYER_COLORS, ANIMATION } from '../utils/constants.js';
import { clamp, hexToRgba, lerpColor, mapRange } from '../utils/helpers.js';

export class Renderer {
    constructor(canvas, cityModel) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.city = cityModel;

        // View state
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.cellSize = 10;

        // Layer visibility
        this.layers = {
            zones: true,
            roads: true,
            traffic: false,
            population: false,
            energy: false,
            transit: false
        };

        // Animation state
        this.animationFrame = null;
        this.particles = [];
        this.time = 0;

        // Hover state
        this.hoverCell = null;

        // Initialize particles for traffic animation
        this.initParticles();

        // Resize handling
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Resize canvas to fit container
     */
    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Calculate cell size to fit the grid
        const maxCellWidth = this.canvas.width / this.city.gridSize;
        const maxCellHeight = this.canvas.height / this.city.gridSize;
        this.cellSize = Math.min(maxCellWidth, maxCellHeight) * 0.9;

        // Center the grid
        const gridWidth = this.city.gridSize * this.cellSize;
        const gridHeight = this.city.gridSize * this.cellSize;
        this.offsetX = (this.canvas.width - gridWidth) / 2;
        this.offsetY = (this.canvas.height - gridHeight) / 2;

        this.render();
    }

    /**
     * Initialize traffic particles
     */
    initParticles() {
        this.particles = [];
        const count = ANIMATION.trafficParticleCount;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.city.gridSize,
                y: Math.random() * this.city.gridSize,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: 2 + Math.random() * 2,
                speed: 0.5 + Math.random() * 1.5
            });
        }
    }

    /**
     * Update particle positions for traffic animation
     */
    updateParticles() {
        const roadCells = [];

        // Find all road cells
        for (let y = 0; y < this.city.gridSize; y++) {
            for (let x = 0; x < this.city.gridSize; x++) {
                if (this.city.grid[y][x].type === 'road') {
                    roadCells.push({ x, y });
                }
            }
        }

        if (roadCells.length === 0) return;

        this.particles.forEach(p => {
            // Move particle
            p.x += p.vx * p.speed;
            p.y += p.vy * p.speed;

            // Wrap around
            if (p.x < 0) p.x = this.city.gridSize;
            if (p.x > this.city.gridSize) p.x = 0;
            if (p.y < 0) p.y = this.city.gridSize;
            if (p.y > this.city.gridSize) p.y = 0;

            // Check if on a road
            const cellX = Math.floor(p.x);
            const cellY = Math.floor(p.y);
            const cell = this.city.getZone(cellX, cellY);

            if (cell && cell.type !== 'road') {
                // Snap to nearest road
                const nearest = roadCells.reduce((min, road) => {
                    const dist = Math.abs(road.x - p.x) + Math.abs(road.y - p.y);
                    return dist < min.dist ? { road, dist } : min;
                }, { road: null, dist: Infinity });

                if (nearest.road) {
                    p.x = nearest.road.x + 0.5;
                    p.y = nearest.road.y + 0.5;

                    // Random new direction
                    if (Math.random() < 0.5) {
                        p.vx = Math.random() < 0.5 ? 0.5 : -0.5;
                        p.vy = 0;
                    } else {
                        p.vx = 0;
                        p.vy = Math.random() < 0.5 ? 0.5 : -0.5;
                    }
                }
            }
        });
    }

    /**
     * Set layer visibility
     * @param {string} layer 
     * @param {boolean} visible 
     */
    setLayer(layer, visible) {
        this.layers[layer] = visible;
        this.render();
    }

    /**
     * Set zoom level
     * @param {number} scale 
     */
    setZoom(scale) {
        this.scale = clamp(scale, 0.5, 3);
        this.render();
    }

    /**
     * Zoom in
     */
    zoomIn() {
        this.setZoom(this.scale + 0.2);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        this.setZoom(this.scale - 0.2);
    }

    /**
     * Reset view to default
     */
    resetView() {
        this.scale = 1;
        this.resize();
    }

    /**
     * Set zoom scale directly
     * @param {number} newScale 
     */
    setScale(newScale) {
        this.scale = clamp(newScale, 0.5, 3);
        this.render();
    }

    /**
     * Toggle layer visibility
     * @param {string} layer 
     * @param {boolean} visible 
     */
    toggleLayer(layer, visible) {
        if (this.layers.hasOwnProperty(layer)) {
            this.layers[layer] = visible;
            this.render();
        }
    }

    /**
     * Start panning
     * @param {number} x 
     * @param {number} y 
     */
    startPan(x, y) {
        this.isPanning = true;
        this.panStartX = x;
        this.panStartY = y;
        this.panOffsetStartX = this.offsetX;
        this.panOffsetStartY = this.offsetY;
    }

    /**
     * Pan the view
     * @param {number} x 
     * @param {number} y 
     */
    pan(x, y) {
        if (!this.isPanning) return;
        this.offsetX = this.panOffsetStartX + (x - this.panStartX);
        this.offsetY = this.panOffsetStartY + (y - this.panStartY);
        this.render();
    }

    /**
     * Stop panning
     */
    stopPan() {
        this.isPanning = false;
    }

    /**
     * Convert screen coordinates to grid coordinates
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {{x: number, y: number}}
     */
    screenToGrid(screenX, screenY) {
        const x = Math.floor((screenX - this.offsetX) / (this.cellSize * this.scale));
        const y = Math.floor((screenY - this.offsetY) / (this.cellSize * this.scale));
        return { x, y };
    }

    /**
     * Convert grid coordinates to screen coordinates
     * @param {number} gridX 
     * @param {number} gridY 
     * @returns {{x: number, y: number}}
     */
    gridToScreen(gridX, gridY) {
        const x = this.offsetX + gridX * this.cellSize * this.scale;
        const y = this.offsetY + gridY * this.cellSize * this.scale;
        return { x, y };
    }

    /**
     * Set hover cell
     * @param {number} x 
     * @param {number} y 
     */
    setHover(x, y) {
        this.hoverCell = (x >= 0 && x < this.city.gridSize && y >= 0 && y < this.city.gridSize)
            ? { x, y }
            : null;
    }

    /**
     * Main render function
     */
    render() {
        const ctx = this.ctx;
        const scale = this.scale;
        const cellSize = this.cellSize * scale;

        // Clear canvas
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid background
        this.drawGridBackground(cellSize);

        // Draw zones
        if (this.layers.zones) {
            this.drawZones(cellSize);
        }

        // Draw population heatmap
        if (this.layers.population) {
            this.drawPopulationHeatmap(cellSize);
        }

        // Draw energy grid
        if (this.layers.energy) {
            this.drawEnergyGrid(cellSize);
        }

        // Draw transit routes
        if (this.layers.transit) {
            this.drawTransitRoutes(cellSize);
        }

        // Draw traffic particles
        if (this.layers.traffic) {
            this.drawTrafficParticles(cellSize);
        }

        // Draw hover highlight
        if (this.hoverCell) {
            this.drawHoverHighlight(cellSize);
        }

        // Draw grid lines
        this.drawGridLines(cellSize);
    }

    /**
     * Draw grid background
     */
    drawGridBackground(cellSize) {
        const ctx = this.ctx;
        const gridWidth = this.city.gridSize * cellSize;
        const gridHeight = this.city.gridSize * cellSize;

        // Draw subtle gradient background for the grid area
        const gradient = ctx.createRadialGradient(
            this.offsetX + gridWidth / 2,
            this.offsetY + gridHeight / 2,
            0,
            this.offsetX + gridWidth / 2,
            this.offsetY + gridHeight / 2,
            gridWidth / 2
        );
        gradient.addColorStop(0, 'rgba(0, 212, 170, 0.03)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0.02)');

        ctx.fillStyle = gradient;
        ctx.fillRect(this.offsetX, this.offsetY, gridWidth, gridHeight);
    }

    /**
     * Draw all zones
     */
    drawZones(cellSize) {
        const ctx = this.ctx;

        for (let y = 0; y < this.city.gridSize; y++) {
            for (let x = 0; x < this.city.gridSize; x++) {
                const zone = this.city.grid[y][x];
                if (zone.type === 'empty') continue;

                const screenX = this.offsetX + x * cellSize;
                const screenY = this.offsetY + y * cellSize;
                const zoneData = ZONE_TYPES[zone.type];

                // Draw zone
                ctx.fillStyle = zoneData.color;
                ctx.fillRect(screenX + 1, screenY + 1, cellSize - 2, cellSize - 2);

                // Add subtle gradient overlay
                const gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + cellSize);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
                ctx.fillStyle = gradient;
                ctx.fillRect(screenX + 1, screenY + 1, cellSize - 2, cellSize - 2);
            }
        }
    }

    /**
     * Draw population density heatmap
     */
    drawPopulationHeatmap(cellSize) {
        const ctx = this.ctx;

        for (let y = 0; y < this.city.gridSize; y++) {
            for (let x = 0; x < this.city.gridSize; x++) {
                const zone = this.city.grid[y][x];
                const zoneData = ZONE_TYPES[zone.type];
                if (!zoneData || zoneData.population === 0) continue;

                const screenX = this.offsetX + x * cellSize;
                const screenY = this.offsetY + y * cellSize;

                // Calculate density (0-1)
                const density = zoneData.population / 1000;

                // Interpolate color based on density
                let color;
                if (density < 0.3) {
                    color = lerpColor(LAYER_COLORS.population.low, LAYER_COLORS.population.medium, density / 0.3);
                } else {
                    color = lerpColor(LAYER_COLORS.population.medium, LAYER_COLORS.population.high, (density - 0.3) / 0.7);
                }

                ctx.fillStyle = hexToRgba(color, 0.5);
                ctx.fillRect(screenX, screenY, cellSize, cellSize);
            }
        }
    }

    /**
     * Draw energy grid overlay
     */
    drawEnergyGrid(cellSize) {
        const ctx = this.ctx;
        const spacing = Math.floor(this.city.gridSize / 8);

        ctx.strokeStyle = LAYER_COLORS.energy.primary;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        // Draw power lines
        for (let i = spacing; i < this.city.gridSize; i += spacing) {
            // Horizontal
            ctx.beginPath();
            ctx.moveTo(this.offsetX, this.offsetY + i * cellSize);
            ctx.lineTo(this.offsetX + this.city.gridSize * cellSize, this.offsetY + i * cellSize);
            ctx.stroke();

            // Vertical
            ctx.beginPath();
            ctx.moveTo(this.offsetX + i * cellSize, this.offsetY);
            ctx.lineTo(this.offsetX + i * cellSize, this.offsetY + this.city.gridSize * cellSize);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Draw power nodes at intersections
        ctx.fillStyle = LAYER_COLORS.energy.node;
        for (let y = spacing; y < this.city.gridSize; y += spacing) {
            for (let x = spacing; x < this.city.gridSize; x += spacing) {
                const screenX = this.offsetX + x * cellSize;
                const screenY = this.offsetY + y * cellSize;

                const pulse = 0.5 + 0.5 * Math.sin(this.time * ANIMATION.pulseSpeed + x + y);
                const radius = 6 + pulse * 4;

                ctx.beginPath();
                ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Draw transit routes with minimal, clean design using MST
     */
    drawTransitRoutes(cellSize) {
        const ctx = this.ctx;

        // Find all transit hubs
        const transitHubs = [];
        for (let y = 0; y < this.city.gridSize; y++) {
            for (let x = 0; x < this.city.gridSize; x++) {
                if (this.city.grid[y][x].type === 'transit') {
                    transitHubs.push({ x, y });
                }
            }
        }

        if (transitHubs.length < 2) return;

        // Build Minimum Spanning Tree using Kruskal's algorithm
        const edges = [];
        for (let i = 0; i < transitHubs.length; i++) {
            for (let j = i + 1; j < transitHubs.length; j++) {
                const hub1 = transitHubs[i];
                const hub2 = transitHubs[j];
                const dist = Math.sqrt(Math.pow(hub1.x - hub2.x, 2) + Math.pow(hub1.y - hub2.y, 2));
                edges.push({ i, j, dist, hub1, hub2 });
            }
        }

        edges.sort((a, b) => a.dist - b.dist);

        // Union-Find for MST
        const parent = transitHubs.map((_, idx) => idx);
        const find = (x) => {
            if (parent[x] !== x) parent[x] = find(parent[x]);
            return parent[x];
        };
        const union = (x, y) => {
            const px = find(x), py = find(y);
            if (px !== py) { parent[px] = py; return true; }
            return false;
        };

        // Select MST edges
        const mstEdges = [];
        for (const edge of edges) {
            if (union(edge.i, edge.j)) {
                mstEdges.push(edge);
                if (mstEdges.length === transitHubs.length - 1) break;
            }
        }

        // Draw clean route lines
        ctx.lineCap = 'round';

        mstEdges.forEach((edge, idx) => {
            const screen1 = this.gridToScreen(edge.hub1.x + 0.5, edge.hub1.y + 0.5);
            const screen2 = this.gridToScreen(edge.hub2.x + 0.5, edge.hub2.y + 0.5);

            // Simple clean line
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(screen1.x, screen1.y);
            ctx.lineTo(screen2.x, screen2.y);
            ctx.stroke();

            // Single animated train dot
            const phase = ((this.time * 0.015) + (idx * 0.3)) % 1;
            const trainX = screen1.x + (screen2.x - screen1.x) * phase;
            const trainY = screen1.y + (screen2.y - screen1.y) * phase;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(trainX, trainY, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw minimal station markers
        transitHubs.forEach(hub => {
            const screen = this.gridToScreen(hub.x + 0.5, hub.y + 0.5);

            // Outer ring
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
            ctx.stroke();

            // Inner dot
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Draw traffic particles
     */
    drawTrafficParticles(cellSize) {
        const ctx = this.ctx;

        this.particles.forEach(p => {
            const screenX = this.offsetX + p.x * cellSize;
            const screenY = this.offsetY + p.y * cellSize;

            // Color based on speed
            const speedRatio = p.speed / 2;
            let color;
            if (speedRatio > 0.7) {
                color = LAYER_COLORS.traffic.high;
            } else if (speedRatio > 0.4) {
                color = LAYER_COLORS.traffic.medium;
            } else {
                color = LAYER_COLORS.traffic.low;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Draw trail
            ctx.strokeStyle = hexToRgba(color, 0.3);
            ctx.lineWidth = p.size * 0.5;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(screenX - p.vx * p.speed * 10, screenY - p.vy * p.speed * 10);
            ctx.stroke();
        });
    }

    /**
     * Draw hover highlight
     */
    drawHoverHighlight(cellSize) {
        const ctx = this.ctx;
        const { x, y } = this.hoverCell;
        const screenX = this.offsetX + x * cellSize;
        const screenY = this.offsetY + y * cellSize;

        ctx.strokeStyle = '#00d4aa';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, cellSize, cellSize);

        // Add glow effect
        ctx.shadowColor = '#00d4aa';
        ctx.shadowBlur = 10;
        ctx.strokeRect(screenX, screenY, cellSize, cellSize);
        ctx.shadowBlur = 0;
    }

    /**
     * Draw grid lines
     */
    drawGridLines(cellSize) {
        const ctx = this.ctx;
        const gridWidth = this.city.gridSize * cellSize;
        const gridHeight = this.city.gridSize * cellSize;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // Only draw major grid lines at larger scales
        const step = this.scale < 0.7 ? 5 : 1;

        for (let i = 0; i <= this.city.gridSize; i += step) {
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(this.offsetX + i * cellSize, this.offsetY);
            ctx.lineTo(this.offsetX + i * cellSize, this.offsetY + gridHeight);
            ctx.stroke();

            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(this.offsetX, this.offsetY + i * cellSize);
            ctx.lineTo(this.offsetX + gridWidth, this.offsetY + i * cellSize);
            ctx.stroke();
        }

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.offsetX, this.offsetY, gridWidth, gridHeight);
    }

    /**
     * Start animation loop
     */
    startAnimation() {
        const animate = () => {
            this.time++;

            if (this.layers.traffic) {
                this.updateParticles();
            }

            this.render();
            this.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Update city model reference
     * @param {CityModel} cityModel 
     */
    setCity(cityModel) {
        this.city = cityModel;
        this.initParticles();
        this.resize();
    }
}
