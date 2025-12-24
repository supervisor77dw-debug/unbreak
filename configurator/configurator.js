/**
 * UNBREAK ONE - 3D Configurator
 * Integration mit Vercel-Deployment
 * Live: https://unbreak-3-d-konfigurator.vercel.app/
 */

document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.getElementById('configurator-iframe');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingSpinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');
    const loadingProgress = document.getElementById('loading-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const reloadButton = document.getElementById('reload-button');
    
    let timeoutTimer = null;
    let isReady = false;
    
    console.log('Configurator loaded, waiting for UNBREAK_CONFIG_READY...');
    
    // Function to hide loading overlay with animation
    const hideLoading = () => {
        if (loadingOverlay && !isReady) {
            isReady = true;
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.transform = 'scale(0.98)';
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                console.log('✓ Configurator ready');
            }, 400);
            if (timeoutTimer) clearTimeout(timeoutTimer);
        }
    };
    
    // Function to show error
    const showError = (msg) => {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (loadingText) loadingText.style.display = 'none';
        if (loadingProgress) loadingProgress.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'block';
        if (errorMessage) errorMessage.textContent = msg;
        console.error('✗ Configurator error:', msg);
        if (timeoutTimer) clearTimeout(timeoutTimer);
    };
    
    // Function to update progress
    const updateProgress = (percent) => {
        if (loadingProgress) loadingProgress.style.display = 'flex';
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressPercent) progressPercent.textContent = percent + '%';
    };
    
    // 15 second timeout fallback
    timeoutTimer = setTimeout(() => {
        if (!isReady) {
            showError('Konfigurator lädt länger als erwartet. Bitte versuchen Sie es erneut.');
        }
    }, 15000);
    
    // Reload button handler
    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            console.log('Reloading configurator...');
            // Reset state
            isReady = false;
            if (errorContainer) errorContainer.style.display = 'none';
            if (loadingSpinner) loadingSpinner.style.display = 'block';
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = 'Konfigurator wird geladen...';
            }
            if (loadingProgress) loadingProgress.style.display = 'none';
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '1';
                loadingOverlay.style.transform = 'scale(1)';
                loadingOverlay.classList.remove('hidden');
            }
            // Reload iframe
            if (iframe) {
                iframe.src = iframe.src;
            }
            // Restart timeout
            if (timeoutTimer) clearTimeout(timeoutTimer);
            timeoutTimer = setTimeout(() => {
                if (!isReady) {
                    showError('Konfigurator lädt länger als erwartet. Bitte versuchen Sie es erneut.');
                }
            }, 15000);
        });
    }
    
    // PostMessage Handler for UNBREAK_CONFIG Messages
    window.addEventListener('message', (event) => {
        // Verify origin (accept both Vercel URLs)
        const allowedOrigins = [
            'https://unbreak-3-d-konfigurator.vercel.app',
            'http://localhost:5173',
            'http://localhost:3000'
        ];
        
        if (!allowedOrigins.includes(event.origin)) {
            console.log('Message from unknown origin:', event.origin);
            return;
        }
        
        const data = event.data;
        
        // Handle UNBREAK_CONFIG Messages
        switch(data.type) {
            case 'UNBREAK_CONFIG_READY':
                console.log('✓ UNBREAK_CONFIG_READY received');
                hideLoading();
                break;
                
            case 'UNBREAK_CONFIG_LOADING':
                console.log('⏳ UNBREAK_CONFIG_LOADING:', data.progress || 'no progress');
                if (data.progress !== undefined) {
                    updateProgress(Math.round(data.progress));
                }
                if (data.message && loadingText) {
                    loadingText.textContent = data.message;
                }
                break;
                
            case 'UNBREAK_CONFIG_ERROR':
                console.log('✗ UNBREAK_CONFIG_ERROR:', data.message);
                showError(data.message || 'Fehler beim Laden des Konfigurators');
                break;
            
            // Legacy support
            case 'addToCart':
                handleAddToCart(data.config);
                break;
            case 'configChanged':
                console.log('Config updated:', data.config);
                break;
            case 'loaded':
                hideLoading();
                break;
        }
    });
});

function handleAddToCart(config) {
    console.log('Add to cart:', config);
    
    // TODO: Integration mit Shop-System
    alert('Produkt wurde zum Warenkorb hinzugefügt!\n\n' + JSON.stringify(config, null, 2));
}
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.currentColor = '#0A6C74';
        this.currentFinish = 'glossy';
        this.engravingEnabled = false;
        this.engravingText = '';

        this.init();
        this.setupEventListeners();
    }

    init() {
        const container = document.getElementById('canvas-container');
        const canvas = document.getElementById('configurator-canvas');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x667eea);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Lights
        this.setupLights();

        // Load Model (Platzhalter - wird durch echtes Modell ersetzt)
        this.loadPlaceholderModel();

        // Window Resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Animation Loop
        this.animate();
    }

    setupLights() {
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional Light (Sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Hemisphere Light
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(hemisphereLight);

        // Point Lights (für Highlights)
        const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 50);
        pointLight1.position.set(-5, 5, -5);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 50);
        pointLight2.position.set(5, 5, 5);
        this.scene.add(pointLight2);
    }

    loadPlaceholderModel() {
        // Platzhalter: Erstelle ein einfaches Objekt als Demo
        // WICHTIG: Ersetzen durch GLTFLoader für echtes Modell
        
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 2, 32);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.currentColor),
            metalness: 0.7,
            roughness: 0.2
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.model.receiveShadow = true;
        this.scene.add(this.model);

        // Ground Plane
        const groundGeometry = new THREE.PlaneGeometry(10, 10);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Hide loading overlay
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 1000);
    }

    // Echte Modell-Ladung (auskommentiert bis GLB vorhanden)
    /*
    loadModel() {
        const loader = new THREE.GLTFLoader();
        
        loader.load(
            'public/assets/models/wine-holder.glb',
            (gltf) => {
                this.model = gltf.scene;
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.scene.add(this.model);
                this.updateMaterial();
                
                // Hide loading
                document.getElementById('loading-overlay').classList.add('hidden');
            },
            (progress) => {
                console.log('Loading:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading model:', error);
            }
        );
    }
    */

    updateMaterial() {
        if (!this.model) return;

        const color = new THREE.Color(this.currentColor);
        const metalness = this.currentFinish === 'glossy' ? 0.8 : 0.2;
        const roughness = this.currentFinish === 'glossy' ? 0.2 : 0.8;

        this.model.traverse((child) => {
            if (child.isMesh) {
                child.material.color = color;
                child.material.metalness = metalness;
                child.material.roughness = roughness;
                child.material.needsUpdate = true;
            }
        });
    }

    setCameraView(view) {
        const positions = {
            front: { x: 0, y: 2, z: 5 },
            side: { x: 5, y: 2, z: 0 },
            top: { x: 0, y: 5, z: 0.1 },
            reset: { x: 0, y: 2, z: 5 }
        };

        const pos = positions[view] || positions.reset;
        
        // Smooth camera transition
        const duration = 1000;
        const start = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };
        
        const startTime = Date.now();
        
        const animateCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            this.camera.position.x = start.x + (pos.x - start.x) * eased;
            this.camera.position.y = start.y + (pos.y - start.y) * eased;
            this.camera.position.z = start.z + (pos.z - start.z) * eased;
            
            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        };
        
        animateCamera();
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    setupEventListeners() {
        // Color Selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = btn.dataset.color;
                this.updateMaterial();
            });
        });

        // Finish Selection
        document.querySelectorAll('.finish-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.finish-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFinish = btn.dataset.finish;
                this.updateMaterial();
            });
        });

        // Engraving Toggle
        const engravingToggle = document.getElementById('engravingToggle');
        const engravingText = document.getElementById('engravingText');
        
        if (engravingToggle && engravingText) {
            engravingToggle.addEventListener('change', (e) => {
                this.engravingEnabled = e.target.checked;
                engravingText.disabled = !e.target.checked;
                if (!e.target.checked) {
                    engravingText.value = '';
                    this.engravingText = '';
                }
            });

            engravingText.addEventListener('input', (e) => {
                this.engravingText = e.target.value;
                // TODO: Update 3D text mesh
            });
        }

        // View Buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setCameraView(btn.dataset.view);
            });
        });

        // Add to Cart
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                const config = {
                    color: this.currentColor,
                    finish: this.currentFinish,
                    engraving: this.engravingEnabled ? this.engravingText : null
                };
                
                console.log('Add to cart:', config);
                
                // TODO: Integration mit Warenkorb-System
                alert('Produkt wurde zum Warenkorb hinzugefügt!\n\n' + JSON.stringify(config, null, 2));
            });
        }
    }

    onWindowResize() {
        const container = document.getElementById('canvas-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize configurator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js is not loaded!');
        return;
    }

    // Initialize configurator
    const configurator = new Configurator3D();
});
