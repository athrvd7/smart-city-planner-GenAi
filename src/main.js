

import { Chart, ArcElement, Tooltip, Legend, DoughnutController, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js';
import { CityModel } from './engine/CityModel.js';
import { Renderer } from './engine/Renderer.js';
import { Renderer3D } from './engine/Renderer3D.js';
import { Metrics } from './engine/Metrics.js';
import { Simulator } from './engine/Simulator.js';
import { AIGenerator } from './ai/AIGenerator.js';
import { ReportGenerator } from './utils/ReportGenerator.js';
import { CityStorage } from './utils/CityStorage.js';
import { getSampleCity, getSampleCityList } from './utils/sampleCities.js';
import { CITY_SIZES, SCENARIOS, CITY_PRESETS } from './utils/constants.js';
import { formatNumber, showToast, debounce } from './utils/helpers.js';

// Register Chart.js components
Chart.register(ArcElement, Tooltip, Legend, DoughnutController, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

class SmartCityApp {
    constructor() {
        // Core components
        this.city = new CityModel('medium');
        this.canvas = document.getElementById('city-canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        this.renderer = new Renderer(this.canvas, this.city);
        this.renderer3D = null;
        this.metrics = new Metrics(this.city);
        this.simulator = new Simulator(this.city);
        this.aiGenerator = new AIGenerator();
        this.cityStorage = new CityStorage();

        // State
        this.currentTool = 'select';
        this.isDrawing = false;
        this.is3DMode = false;
        this.isSimulating = false;
        this.chart = null;
        this.trafficChart = null;
        this.trafficSimRunning = false;
        this.trafficSimTime = 0;
        this.trafficSimInterval = null;
        this.trafficData = {
            labels: [],
            heavy: [],
            moderate: [],
            light: []
        };
        this.apiKey = localStorage.getItem('gemini_api_key') || null;

        // Initialize
        this.init();
    }

    init() {
        this.setupCanvas();
        this.initUI();
        this.initChart();
        this.initTrafficChart();
        this.updateDashboard();
        this.loadApiKey();
        this.updateSavedCitiesList();
        this.updateCompareSelects();

        // Generate initial city
        this.city.generateLayout({
            residentialRatio: 0.35,
            commercialRatio: 0.15,
            industrialRatio: 0.1,
            greenRatio: 0.25,
            transitRatio: 0.1
        });
        this.renderer.render();
        this.updateDashboard();

        // Start animation loop
        this.animate();
    }

    setupCanvas() {
        const resize = () => {
            const container = this.canvasContainer;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.renderer.render();

            if (this.renderer3D && this.is3DMode) {
                this.renderer3D.onResize();
            }
        };

        resize();
        window.addEventListener('resize', debounce(resize, 100));
    }

    initUI() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Tool selection
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
        });

        // Zoom controls
        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            this.renderer.zoomIn();
            this.updateZoomDisplay();
        });

        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            this.renderer.zoomOut();
            this.updateZoomDisplay();
        });

        document.getElementById('btn-reset-view').addEventListener('click', () => {
            this.renderer.resetView();
            this.updateZoomDisplay();
        });

        // 3D Toggle
        document.getElementById('btn-toggle-3d').addEventListener('click', () => this.toggle3DView());

        // AI Generation
        document.getElementById('btn-generate').addEventListener('click', () => this.generateCity());

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => this.applyPreset(btn.dataset.preset));
        });

        // Sample Cities
        document.getElementById('sample-city-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadSampleCity(e.target.value);
                e.target.value = '';
            }
        });

        // Parameter sliders
        document.getElementById('population-slider').addEventListener('input', (e) => {
            document.getElementById('pop-value').textContent = formatNumber(parseInt(e.target.value));
        });

        document.getElementById('size-slider').addEventListener('input', (e) => {
            const sizes = ['Small', 'Medium', 'Large'];
            document.getElementById('size-value').textContent = sizes[parseInt(e.target.value) - 1];
        });

        document.getElementById('green-slider').addEventListener('input', (e) => {
            document.getElementById('green-value').textContent = `${e.target.value}%`;
        });

        // Scenarios
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.addEventListener('click', () => this.applyScenario(btn.dataset.scenario));
        });

        // Time simulation
        document.getElementById('time-slider').addEventListener('input', (e) => {
            document.getElementById('sim-year').textContent = e.target.value;
            this.simulator.setTargetYear(parseInt(e.target.value));
            this.updateDashboard();
        });

        document.getElementById('btn-play-sim').addEventListener('click', () => this.playSimulation());
        document.getElementById('btn-reset-sim').addEventListener('click', () => this.resetSimulation());

        // Layer toggles
        document.querySelectorAll('[data-layer]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.renderer.toggleLayer(checkbox.dataset.layer, checkbox.checked);
            });
        });

        // City save/compare
        document.getElementById('btn-save-city').addEventListener('click', () => this.saveCurrentCity());
        document.getElementById('btn-compare-cities').addEventListener('click', () => this.compareCities());

        // Update compare button state when selects change
        ['compare-city-1', 'compare-city-2'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                const city1 = document.getElementById('compare-city-1').value;
                const city2 = document.getElementById('compare-city-2').value;
                document.getElementById('btn-compare-cities').disabled = !city1 || !city2;
            });
        });

        // Export buttons
        document.getElementById('btn-export').addEventListener('click', () => this.exportCity());
        document.getElementById('btn-pdf-export').addEventListener('click', () => this.exportPDF());

        // Settings modal
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') this.closeSettings();
        });

        // API key management
        document.getElementById('toggle-api-key-visibility').addEventListener('click', () => {
            const input = document.getElementById('api-key-input');
            const btn = document.getElementById('toggle-api-key-visibility');
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });

        document.getElementById('save-api-key').addEventListener('click', () => this.saveApiKey());

        // Help
        document.getElementById('btn-help').addEventListener('click', () => this.showHelp());

        // Traffic Simulation
        document.getElementById('btn-toggle-traffic-sim').addEventListener('click', () => this.toggleTrafficSimulation());

        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onCanvasMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onCanvasMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onCanvasWheel(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    // === 3D View ===
    toggle3DView() {
        this.is3DMode = !this.is3DMode;
        const btn = document.getElementById('btn-toggle-3d');
        const canvas2D = this.canvas;
        const container3D = document.getElementById('canvas-3d');
        const viewModeLabel = document.getElementById('view-mode');

        if (this.is3DMode) {
            // Initialize 3D renderer if not already
            if (!this.renderer3D) {
                this.renderer3D = new Renderer3D(container3D, this.city);
            }

            // Switch to 3D
            canvas2D.style.display = 'none';
            container3D.classList.remove('hidden');
            this.renderer3D.activate();
            btn.classList.add('active');
            viewModeLabel.textContent = '3D';

            showToast('Switched to 3D view. Use mouse to orbit.', 'success');
        } else {
            // Switch to 2D
            if (this.renderer3D) {
                this.renderer3D.deactivate();
            }
            container3D.classList.add('hidden');
            canvas2D.style.display = 'block';
            this.renderer.render();
            btn.classList.remove('active');
            viewModeLabel.textContent = '2D';

            showToast('Switched to 2D view.', 'success');
        }
    }

    // === API Key Management ===
    loadApiKey() {
        if (this.apiKey) {
            this.aiGenerator.setApiKey(this.apiKey);
            document.getElementById('api-key-input').value = this.apiKey;
            this.updateApiStatus(true);
        }
    }

    saveApiKey() {
        const key = document.getElementById('api-key-input').value.trim();
        if (key) {
            this.apiKey = key;
            localStorage.setItem('gemini_api_key', key);
            this.aiGenerator.setApiKey(key);
            this.updateApiStatus(true);
            showToast('API key saved successfully!', 'success');
            this.closeSettings();
        } else {
            showToast('Please enter a valid API key.', 'error');
        }
    }

    updateApiStatus(hasKey) {
        const indicator = document.querySelector('.status-indicator');
        const text = document.querySelector('.status-text');

        if (hasKey && this.aiGenerator.isAIAvailable()) {
            indicator.classList.remove('demo');
            indicator.classList.add('active');
            text.textContent = 'Gemini API Connected';
        } else {
            indicator.classList.add('demo');
            indicator.classList.remove('active');
            text.textContent = 'Demo Mode (No API Key)';
        }
    }

    openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    // === City Generation ===
    async generateCity() {
        const prompt = document.getElementById('ai-prompt').value.trim();
        if (!prompt) {
            showToast('Please enter a city description.', 'warning');
            return;
        }

        const greenRatio = parseInt(document.getElementById('green-slider').value) / 100;
        const sizeIndex = parseInt(document.getElementById('size-slider').value);
        const sizes = [60, 100, 140];

        this.showLoading(true);

        try {
            const result = await this.aiGenerator.generate(prompt, { greenRatio });

            if (result.success) {
                // Resize city if needed
                const newSize = sizes[sizeIndex - 1];
                if (this.city.gridSize !== newSize) {
                    this.city = new CityModel(newSize);
                    this.renderer.setCity(this.city);
                    this.metrics = new Metrics(this.city);
                    this.simulator = new Simulator(this.city);
                    if (this.renderer3D) {
                        this.renderer3D.setCity(this.city);
                    }
                    document.getElementById('grid-size').textContent = `${newSize} × ${newSize}`;
                }

                this.city.generateLayout(result.params);
                this.renderer.render();

                if (this.is3DMode && this.renderer3D) {
                    this.renderer3D.buildCity();
                }

                this.updateDashboard();
                this.simulator.saveBaseline();

                const source = result.source === 'gemini' ? 'AI' : 'demo';
                showToast(`City generated using ${source} mode!`, 'success');
            }
        } catch (error) {
            console.error('Generation error:', error);
            showToast('Failed to generate city. Try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async applyPreset(presetId) {
        const preset = CITY_PRESETS[presetId];
        if (!preset) return;

        document.getElementById('ai-prompt').value = preset.prompt;
        document.getElementById('green-slider').value = Math.round((preset.greenRatio || 0.25) * 100);
        document.getElementById('green-value').textContent = `${Math.round((preset.greenRatio || 0.25) * 100)}%`;

        await this.generateCity();
    }

    async loadSampleCity(cityId) {
        const sample = getSampleCity(cityId);
        if (!sample) return;

        this.showLoading(true);

        try {
            // Resize if needed
            if (this.city.gridSize !== sample.gridSize) {
                this.city = new CityModel(sample.gridSize);
                this.renderer.setCity(this.city);
                this.metrics = new Metrics(this.city);
                this.simulator = new Simulator(this.city);
                if (this.renderer3D) {
                    this.renderer3D.setCity(this.city);
                }
                document.getElementById('grid-size').textContent = `${sample.gridSize} × ${sample.gridSize}`;
            }

            this.city.name = sample.name;
            this.city.generateLayout(sample.ratios);
            this.renderer.render();

            if (this.is3DMode && this.renderer3D) {
                this.renderer3D.buildCity();
            }

            this.updateDashboard();
            this.simulator.saveBaseline();

            showToast(`Loaded ${sample.name} template!`, 'success');
        } catch (error) {
            console.error('Failed to load sample city:', error);
            showToast('Failed to load city template.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // === City Storage ===
    saveCurrentCity() {
        const nameInput = document.getElementById('city-name-input');
        const name = nameInput.value.trim() || `City ${Date.now()}`;

        const saved = this.cityStorage.save(this.city, name);
        nameInput.value = '';

        this.updateSavedCitiesList();
        this.updateCompareSelects();

        showToast(`Saved "${saved.name}"!`, 'success');
    }

    updateSavedCitiesList() {
        const list = document.getElementById('saved-cities-list');
        const cities = this.cityStorage.getList();

        if (cities.length === 0) {
            list.innerHTML = '<p class="empty-state">No saved cities yet. Save a city to compare.</p>';
            return;
        }

        list.innerHTML = cities.map(city => `
      <div class="saved-city-item" data-id="${city.id}">
        <div class="saved-city-info">
          <span class="saved-city-name">${city.name}</span>
          <span class="saved-city-meta">Score: ${city.sustainabilityScore} | Pop: ${formatNumber(city.population)}</span>
        </div>
        <div class="saved-city-actions">
          <button class="btn btn-sm" onclick="app.loadSavedCity('${city.id}')">Load</button>
          <button class="btn btn-sm" onclick="app.deleteSavedCity('${city.id}')">×</button>
        </div>
      </div>
    `).join('');
    }

    updateCompareSelects() {
        const cities = this.cityStorage.getList();
        const options = '<option value="">Select City...</option>' +
            cities.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        document.getElementById('compare-city-1').innerHTML = options;
        document.getElementById('compare-city-2').innerHTML = options;
    }

    loadSavedCity(id) {
        const cityData = this.cityStorage.load(id);
        if (!cityData) return;

        // Resize if needed
        if (this.city.gridSize !== cityData.gridSize) {
            this.city = new CityModel(cityData.gridSize);
            this.renderer.setCity(this.city);
            this.metrics = new Metrics(this.city);
            if (this.renderer3D) {
                this.renderer3D.setCity(this.city);
            }
        }

        this.city.importData(cityData);
        this.renderer.render();

        if (this.is3DMode && this.renderer3D) {
            this.renderer3D.buildCity();
        }

        this.updateDashboard();
        showToast(`Loaded "${cityData.name}"!`, 'success');
    }

    deleteSavedCity(id) {
        this.cityStorage.delete(id);
        this.updateSavedCitiesList();
        this.updateCompareSelects();
        showToast('City deleted.', 'success');
    }

    compareCities() {
        const id1 = document.getElementById('compare-city-1').value;
        const id2 = document.getElementById('compare-city-2').value;

        const comparison = this.cityStorage.compare(id1, id2);
        if (!comparison) return;

        const resultsDiv = document.getElementById('comparison-results');
        const metrics = [
            { key: 'sustainabilityScore', label: 'Sustainability Score' },
            { key: 'population', label: 'Population', format: formatNumber },
            { key: 'greenCoverage', label: 'Green Coverage', suffix: '%' },
            { key: 'transitScore', label: 'Transit Score' },
            { key: 'walkability', label: 'Walkability' }
        ];

        resultsDiv.innerHTML = metrics.map(m => {
            const v1 = comparison.city1.stats[m.key] || 0;
            const v2 = comparison.city2.stats[m.key] || 0;
            const diff = comparison.differences[m.key] || 0;
            const format = m.format || (v => v);
            const suffix = m.suffix || '';

            return `
        <div class="comparison-metric">
          <span class="comparison-label">${m.label}</span>
          <div class="comparison-values">
            <span class="comparison-value">${format(v1)}${suffix}</span>
            <span class="comparison-diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}">${diff > 0 ? '+' : ''}${format(diff)}${suffix}</span>
            <span class="comparison-value">${format(v2)}${suffix}</span>
          </div>
        </div>
      `;
        }).join('');
    }

    // === PDF Export ===
    async exportPDF() {
        showToast('Generating PDF report...', 'success');

        try {
            const reportGen = new ReportGenerator(this.city, this.metrics);
            await reportGen.generatePDF(this.canvas);
            showToast('PDF report downloaded!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            showToast('Failed to generate PDF. Try again.', 'error');
        }
    }

    // === Simulation ===
    applyScenario(scenarioId) {
        const scenario = SCENARIOS[scenarioId];
        if (!scenario) return;

        this.simulator.applyScenario(scenario);
        this.updateDashboard();
        showToast(`Applied scenario: ${scenario.name}`, 'success');

        // Highlight active scenario
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.scenario === scenarioId) {
                btn.classList.add('active');
            }
        });
    }

    playSimulation() {
        if (this.isSimulating) {
            this.isSimulating = false;
            document.getElementById('btn-play-sim').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Play
      `;
            return;
        }

        this.isSimulating = true;
        document.getElementById('btn-play-sim').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>
      Pause
    `;

        const slider = document.getElementById('time-slider');
        const targetYear = 2050;

        const step = () => {
            if (!this.isSimulating) return;

            const currentYear = parseInt(slider.value);
            if (currentYear >= targetYear) {
                this.isSimulating = false;
                document.getElementById('btn-play-sim').innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Play
        `;
                return;
            }

            slider.value = currentYear + 1;
            document.getElementById('sim-year').textContent = slider.value;
            this.simulator.setTargetYear(parseInt(slider.value));
            this.updateDashboard();

            setTimeout(step, 500);
        };

        step();
    }

    resetSimulation() {
        this.isSimulating = false;
        this.simulator.reset();
        document.getElementById('time-slider').value = 2025;
        document.getElementById('sim-year').textContent = '2025';
        document.querySelectorAll('.scenario-btn').forEach(btn => btn.classList.remove('active'));
        this.updateDashboard();
        showToast('Simulation reset to baseline.', 'success');
    }

    // === Canvas Interactions ===
    onCanvasMouseDown(e) {
        if (this.is3DMode) return;

        if (this.currentTool === 'select') {
            this.renderer.startPan(e.offsetX, e.offsetY);
            this.canvas.style.cursor = 'grabbing';
        } else {
            this.isDrawing = true;
            this.draw(e);
        }
    }

    onCanvasMouseMove(e) {
        if (this.is3DMode) return;

        const pos = this.renderer.screenToGrid(e.offsetX, e.offsetY);
        document.getElementById('cursor-pos').textContent = `${pos.x}, ${pos.y}`;

        if (this.currentTool === 'select') {
            if (this.renderer.isPanning) {
                this.renderer.pan(e.offsetX, e.offsetY);
            }
        } else {
            this.renderer.setHover(pos.x, pos.y);
            if (this.isDrawing) {
                this.draw(e);
            }
        }
    }

    onCanvasMouseUp() {
        if (this.is3DMode) return;

        this.isDrawing = false;
        this.renderer.stopPan();
        this.canvas.style.cursor = this.currentTool === 'select' ? 'grab' : 'crosshair';

        if (this.city.hasUnsavedChanges) {
            this.updateDashboard();
            this.city.hasUnsavedChanges = false;
        }
    }

    onCanvasWheel(e) {
        if (this.is3DMode) return;

        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.renderer.setScale(this.renderer.scale * factor);
        this.updateZoomDisplay();
    }

    draw(e) {
        const pos = this.renderer.screenToGrid(e.offsetX, e.offsetY);
        if (this.city.setZone(pos.x, pos.y, this.currentTool)) {
            this.city.hasUnsavedChanges = true;
        }
    }

    // === UI Helpers ===
    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabId);
        });
    }

    selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        this.canvas.style.cursor = tool === 'select' ? 'grab' : 'crosshair';
    }

    updateZoomDisplay() {
        document.getElementById('zoom-level').textContent = `${Math.round(this.renderer.scale * 100)}%`;
    }

    showLoading(show) {
        document.getElementById('loading-overlay').classList.toggle('active', show);
    }

    // === Dashboard ===
    updateDashboard() {
        const allMetrics = this.metrics.getAll();

        // Update score ring
        const score = allMetrics.sustainabilityScore;
        const ring = document.getElementById('score-ring');
        ring.style.strokeDashoffset = 283 - (283 * score / 100);
        document.getElementById('sustainability-score').textContent = score;

        // Update metrics
        document.getElementById('carbon-footprint').textContent = allMetrics.carbonFootprint.label;
        document.getElementById('energy-efficiency').textContent = allMetrics.energyEfficiency.label;
        document.getElementById('green-coverage').textContent = allMetrics.greenCoverage.label;
        document.getElementById('transit-score').textContent = allMetrics.transitScore.value;
        document.getElementById('walkability').textContent = allMetrics.walkability.value;
        document.getElementById('air-quality').textContent = allMetrics.airQuality.status;

        // Update chart
        this.updateChart(allMetrics.zoneDistribution);
    }

    initChart() {
        const ctx = document.getElementById('zone-chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Residential', 'Commercial', 'Industrial', 'Green', 'Transit'],
                datasets: [{
                    data: [35, 15, 10, 25, 10],
                    backgroundColor: ['#3b82f6', '#f59e0b', '#6b7280', '#22c55e', '#ec4899'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            usePointStyle: true,
                            padding: 12,
                            font: { size: 11 }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    updateChart(distribution) {
        if (this.chart && distribution) {
            this.chart.data.labels = distribution.labels;
            this.chart.data.datasets[0].data = distribution.data;
            this.chart.data.datasets[0].backgroundColor = distribution.colors;
            this.chart.update();
        }
    }

    // === Traffic Simulation ===
    initTrafficChart() {
        const ctx = document.getElementById('traffic-chart').getContext('2d');

        // Create gradient fills
        const heavyGradient = ctx.createLinearGradient(0, 0, 0, 150);
        heavyGradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        heavyGradient.addColorStop(1, 'rgba(239, 68, 68, 0.05)');

        const moderateGradient = ctx.createLinearGradient(0, 0, 0, 150);
        moderateGradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
        moderateGradient.addColorStop(1, 'rgba(245, 158, 11, 0.05)');

        const lightGradient = ctx.createLinearGradient(0, 0, 0, 150);
        lightGradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
        lightGradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');

        this.trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Heavy Traffic',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: heavyGradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Moderate Traffic',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: moderateGradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Light Traffic',
                        data: [],
                        borderColor: '#22c55e',
                        backgroundColor: lightGradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(13, 17, 23, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        titleColor: '#fff',
                        bodyColor: '#94a3b8',
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        display: true,
                        min: 0,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            callback: (value) => value + '%'
                        }
                    }
                },
                animation: {
                    duration: 300
                }
            }
        });
    }

    toggleTrafficSimulation() {
        const btn = document.getElementById('btn-toggle-traffic-sim');

        if (this.trafficSimRunning) {
            // Stop simulation
            this.trafficSimRunning = false;
            clearInterval(this.trafficSimInterval);
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start Simulation
            `;
            btn.classList.remove('active');
        } else {
            // Start simulation
            this.trafficSimRunning = true;
            this.trafficSimTime = 0;
            this.trafficData = { labels: [], heavy: [], moderate: [], light: [] };

            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>
                Stop Simulation
            `;
            btn.classList.add('active');

            // Run simulation every 200ms (simulating 10 minutes of city time)
            this.trafficSimInterval = setInterval(() => {
                this.updateTrafficSimulation();
            }, 200);

            showToast('Traffic simulation started!', 'success');
        }
    }

    updateTrafficSimulation() {
        // Advance time by 10 minutes
        this.trafficSimTime += 10;

        // Calculate current hour and minute
        const totalMinutes = this.trafficSimTime % (24 * 60);
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;

        // Update time display
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        document.getElementById('traffic-time').textContent = `Time: ${timeStr}`;

        // Generate traffic data based on time of day
        const trafficValues = this.generateTrafficData(hour, minute);

        // Add data point
        this.trafficData.labels.push(timeStr);
        this.trafficData.heavy.push(trafficValues.heavy);
        this.trafficData.moderate.push(trafficValues.moderate);
        this.trafficData.light.push(trafficValues.light);

        // Keep only last 30 data points (5 hours of data)
        const maxPoints = 30;
        if (this.trafficData.labels.length > maxPoints) {
            this.trafficData.labels.shift();
            this.trafficData.heavy.shift();
            this.trafficData.moderate.shift();
            this.trafficData.light.shift();
        }

        // Update chart
        this.trafficChart.data.labels = this.trafficData.labels;
        this.trafficChart.data.datasets[0].data = this.trafficData.heavy;
        this.trafficChart.data.datasets[1].data = this.trafficData.moderate;
        this.trafficChart.data.datasets[2].data = this.trafficData.light;
        this.trafficChart.update('none');

        // Update stats display
        const latestHeavy = trafficValues.heavy;
        const latestModerate = trafficValues.moderate;
        const latestLight = trafficValues.light;
        const total = latestHeavy + latestModerate + latestLight;

        document.getElementById('traffic-heavy').textContent = `${Math.round(latestHeavy / total * 100)}%`;
        document.getElementById('traffic-moderate').textContent = `${Math.round(latestModerate / total * 100)}%`;
        document.getElementById('traffic-light').textContent = `${Math.round(latestLight / total * 100)}%`;

        // Reset at midnight
        if (this.trafficSimTime >= 24 * 60) {
            this.trafficSimTime = 0;
            this.trafficData = { labels: [], heavy: [], moderate: [], light: [] };
        }
    }

    generateTrafficData(hour, minute) {
        // Base traffic patterns for a typical city day
        // Morning rush: 7-9 AM, Evening rush: 5-7 PM
        let heavy = 10;
        let moderate = 30;
        let light = 60;

        // Random variation
        const randomFactor = () => 0.8 + Math.random() * 0.4;

        if (hour >= 0 && hour < 5) {
            // Late night - minimal traffic
            heavy = 5 * randomFactor();
            moderate = 15 * randomFactor();
            light = 80 * randomFactor();
        } else if (hour >= 5 && hour < 7) {
            // Early morning - increasing
            heavy = 15 * randomFactor();
            moderate = 35 * randomFactor();
            light = 50 * randomFactor();
        } else if (hour >= 7 && hour < 9) {
            // Morning rush hour
            heavy = 50 * randomFactor();
            moderate = 35 * randomFactor();
            light = 15 * randomFactor();
        } else if (hour >= 9 && hour < 12) {
            // Mid-morning
            heavy = 25 * randomFactor();
            moderate = 45 * randomFactor();
            light = 30 * randomFactor();
        } else if (hour >= 12 && hour < 14) {
            // Lunch time - slight increase
            heavy = 35 * randomFactor();
            moderate = 40 * randomFactor();
            light = 25 * randomFactor();
        } else if (hour >= 14 && hour < 17) {
            // Afternoon
            heavy = 30 * randomFactor();
            moderate = 40 * randomFactor();
            light = 30 * randomFactor();
        } else if (hour >= 17 && hour < 19) {
            // Evening rush hour
            heavy = 55 * randomFactor();
            moderate = 30 * randomFactor();
            light = 15 * randomFactor();
        } else if (hour >= 19 && hour < 22) {
            // Evening - decreasing
            heavy = 20 * randomFactor();
            moderate = 35 * randomFactor();
            light = 45 * randomFactor();
        } else {
            // Night
            heavy = 10 * randomFactor();
            moderate = 25 * randomFactor();
            light = 65 * randomFactor();
        }

        // Factor in city characteristics
        const roadRatio = this.city.distribution.road / (this.city.gridSize * this.city.gridSize);
        const transitRatio = this.city.distribution.transit / (this.city.gridSize * this.city.gridSize);

        // More transit = less heavy traffic
        heavy *= (1 - transitRatio * 5);
        moderate *= (1 + transitRatio * 2);

        // More roads = better flow
        light *= (1 + roadRatio * 3);
        heavy *= (1 - roadRatio * 2);

        return {
            heavy: Math.max(0, Math.min(100, heavy)),
            moderate: Math.max(0, Math.min(100, moderate)),
            light: Math.max(0, Math.min(100, light))
        };
    }


    // === Export ===
    exportCity() {
        const data = this.city.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `smart-city-${this.city.id}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('City data exported!', 'success');
    }

    showHelp() {
        showToast('Keyboard: 1-7 for tools, Ctrl+Z/Y for undo/redo, Esc for select mode', 'success');
    }

    handleKeyboard(e) {
        // Tool shortcuts
        const toolMap = {
            '1': 'select',
            '2': 'residential',
            '3': 'commercial',
            '4': 'industrial',
            '5': 'green',
            '6': 'transit',
            '7': 'road'
        };

        if (toolMap[e.key]) {
            this.selectTool(toolMap[e.key]);
        }

        // Undo/Redo
        if (e.ctrlKey && e.key === 'z') {
            this.city.undo();
            this.renderer.render();
            this.updateDashboard();
        }

        if (e.ctrlKey && e.key === 'y') {
            this.city.redo();
            this.renderer.render();
            this.updateDashboard();
        }

        if (e.key === 'Escape') {
            this.selectTool('select');
        }
    }

    animate() {
        if (!this.is3DMode) {
            this.renderer.render();
        }
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize app
const app = new SmartCityApp();
window.app = app; // Expose for inline handlers
