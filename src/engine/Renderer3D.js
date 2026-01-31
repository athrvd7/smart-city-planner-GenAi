/* ========================================
   Smart City Planner - 3D Renderer (Three.js)
   ======================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ZONE_TYPES } from '../utils/constants.js';

export class Renderer3D {
    constructor(container, cityModel) {
        this.container = container;
        this.city = cityModel;
        this.isActive = false;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // City objects
        this.buildings = [];
        this.ground = null;
        this.lights = [];

        // Animation
        this.animationFrame = null;

        // Building height multipliers by zone type
        this.heightMultipliers = {
            empty: 0,
            residential: 2,
            commercial: 4,
            industrial: 1.5,
            green: 0.2,
            transit: 1,
            road: 0
        };

        // Zone colors for 3D
        this.zoneColors = {
            empty: 0x1f2937,
            residential: 0x3b82f6,
            commercial: 0xf59e0b,
            industrial: 0x6b7280,
            green: 0x22c55e,
            transit: 0xec4899,
            road: 0x374151
        };
    }

    /**
     * Initialize Three.js scene
     */
    init() {
        if (this.scene) return; // Already initialized

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e17);
        this.scene.fog = new THREE.Fog(0x0a0e17, 50, 200);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(60, 60, 60);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 150;
        this.controls.maxPolarAngle = Math.PI / 2.2;

        // Lighting
        this.setupLighting();

        // Ground plane
        this.createGround();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Setup lighting
     */
    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404080, 0.5);
        this.scene.add(ambient);
        this.lights.push(ambient);

        // Main directional light (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 500;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.bias = -0.0001;
        this.scene.add(sun);
        this.lights.push(sun);

        // Fill light
        const fill = new THREE.DirectionalLight(0x00d4aa, 0.3);
        fill.position.set(-30, 40, -30);
        this.scene.add(fill);
        this.lights.push(fill);

        // Hemisphere light for sky/ground
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362d1e, 0.4);
        this.scene.add(hemi);
        this.lights.push(hemi);
    }

    /**
     * Create ground plane
     */
    createGround() {
        const size = this.city.gridSize;
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1a2332,
            roughness: 0.9,
            metalness: 0.1
        });

        this.ground = new THREE.Mesh(geometry, material);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.set(0, -0.1, 0);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Grid helper
        const gridHelper = new THREE.GridHelper(size, size, 0x00d4aa, 0x1a2332);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    /**
     * Build 3D city from model
     */
    buildCity() {
        // Remove existing buildings
        this.buildings.forEach(b => {
            this.scene.remove(b);
            b.geometry.dispose();
            b.material.dispose();
        });
        this.buildings = [];

        const gridSize = this.city.gridSize;
        const offset = gridSize / 2;

        // Create buildings for each zone
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const zone = this.city.grid[y][x];
                if (zone.type === 'empty' || zone.type === 'road') continue;

                const building = this.createBuilding(x, y, zone.type);
                if (building) {
                    // Position relative to center
                    building.position.x = x - offset + 0.5;
                    building.position.z = y - offset + 0.5;
                    this.scene.add(building);
                    this.buildings.push(building);
                }
            }
        }

        // Create roads
        this.createRoads(offset);
    }

    /**
     * Create a building mesh
     */
    createBuilding(x, y, type) {
        const heightMult = this.heightMultipliers[type] || 1;
        const baseHeight = 0.5 + Math.random() * 0.5;
        const height = baseHeight * heightMult;

        if (height < 0.1) return null;

        let geometry, material, mesh;

        if (type === 'green') {
            // Trees/parks - use spheres
            geometry = new THREE.SphereGeometry(0.4, 8, 8);
            material = new THREE.MeshStandardMaterial({
                color: this.zoneColors[type],
                roughness: 0.8,
                metalness: 0.1
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.4;
            mesh.castShadow = true;
        } else if (type === 'transit') {
            // Transit hubs - octahedron
            geometry = new THREE.OctahedronGeometry(0.4, 0);
            material = new THREE.MeshStandardMaterial({
                color: this.zoneColors[type],
                roughness: 0.3,
                metalness: 0.5,
                emissive: this.zoneColors[type],
                emissiveIntensity: 0.3
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = height / 2 + 0.5;
            mesh.castShadow = true;
        } else {
            // Regular buildings - boxes with slight variation
            const w = 0.7 + Math.random() * 0.2;
            const d = 0.7 + Math.random() * 0.2;
            geometry = new THREE.BoxGeometry(w, height, d);

            // Create gradient-like material
            material = new THREE.MeshStandardMaterial({
                color: this.zoneColors[type],
                roughness: 0.5,
                metalness: 0.2
            });

            mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = height / 2;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }

        // Store zone info
        mesh.userData = { x, y, type };

        return mesh;
    }

    /**
     * Create road network as flat strips
     */
    createRoads(offset) {
        const gridSize = this.city.gridSize;
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x374151,
            roughness: 0.9
        });

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (this.city.grid[y][x].type === 'road') {
                    const geometry = new THREE.BoxGeometry(0.95, 0.05, 0.95);
                    const road = new THREE.Mesh(geometry, roadMaterial);
                    road.position.set(x - offset + 0.5, 0.025, y - offset + 0.5);
                    road.receiveShadow = true;
                    this.scene.add(road);
                    this.buildings.push(road);
                }
            }
        }
    }

    /**
     * Activate 3D view
     */
    activate() {
        if (!this.scene) {
            this.init();
        }

        // Append canvas to container
        this.container.appendChild(this.renderer.domElement);

        // Build the city
        this.buildCity();

        // Start animation loop
        this.isActive = true;
        this.animate();
    }

    /**
     * Deactivate 3D view
     */
    deactivate() {
        this.isActive = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Remove canvas
        if (this.renderer && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isActive) return;

        this.animationFrame = requestAnimationFrame(() => this.animate());

        // Update controls
        this.controls.update();

        // Animate transit hubs (pulsing glow)
        const time = Date.now() * 0.001;
        this.buildings.forEach(b => {
            if (b.userData && b.userData.type === 'transit') {
                const scale = 1 + 0.1 * Math.sin(time * 3);
                b.scale.setScalar(scale);
            }
        });

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     */
    onResize() {
        if (!this.isActive) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Update city model reference
     */
    setCity(cityModel) {
        this.city = cityModel;
        if (this.isActive) {
            this.buildCity();
        }
    }

    /**
     * Reset camera to default position
     */
    resetCamera() {
        this.camera.position.set(60, 60, 60);
        this.camera.lookAt(0, 0, 0);
        this.controls.reset();
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.deactivate();

        if (this.scene) {
            // Dispose geometries and materials
            this.buildings.forEach(b => {
                if (b.geometry) b.geometry.dispose();
                if (b.material) b.material.dispose();
            });

            if (this.ground) {
                this.ground.geometry.dispose();
                this.ground.material.dispose();
            }

            // Dispose renderer
            if (this.renderer) {
                this.renderer.dispose();
            }
        }
    }
}
