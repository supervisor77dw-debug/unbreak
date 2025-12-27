# 3D-Konfigurator Integration - UNBREAK ONE

## Status: ✅ Grundstruktur erstellt, 🔄 3D-Modell fehlt noch

### Was wurde implementiert:

1. **configurator.html**
   - Vollständige Seite im Homepage-Design
   - Header/Footer von der Hauptseite übernommen
   - Responsive Layout (Desktop & Mobile)
   - Mehrsprachigkeit (DE/EN) via i18n-System

2. **configurator/configurator.css**
   - Komplettes Styling für den Konfigurator
   - Viewer-Container: 70vh (Desktop), 60vh (Mobile)
   - Controls-Panel mit allen UI-Elementen
   - Glassy Design passend zur Homepage

3. **configurator/configurator.js**
   - Three.js Integration (via CDN)
   - Platzhalter 3D-Szene mit Beleuchtung
   - Event-Handler für alle Controls
   - Kamera-Animationen für Views
   - Material-Updates (Farbe, Finish)

4. **Navigation**
   - "Konfigurator" Link in Hauptnavigation (index.html)
   - Übersetzungen in translations/de.json & en.json

5. **Verzeichnisstruktur**
   ```
   configurator/
   ├── configurator.css
   └── configurator.js
   
   public/assets/models/
   └── (hier GLB-Dateien platzieren)
   ```

---

## 🚨 TO DO: 3D-Modell integrieren

### Schritt 1: GLB-Datei bereitstellen

Kopieren Sie Ihr 3D-Modell nach:
```
public/assets/models/wine-holder.glb
```

### Schritt 2: GLTFLoader aktivieren

In `configurator/configurator.js` ersetzen Sie die Platzhalter-Funktion:

```javascript
// Ersetze loadPlaceholderModel() durch:
loadModel() {
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        'public/assets/models/wine-holder.glb',
        (gltf) => {
            this.model = gltf.scene;
            
            // Setup Shadows
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // Add to scene
            this.scene.add(this.model);
            
            // Apply initial material
            this.updateMaterial();
            
            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');
        },
        (progress) => {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            console.log('Loading:', percent + '%');
        },
        (error) => {
            console.error('Error loading model:', error);
            alert('Fehler beim Laden des 3D-Modells');
        }
    );
}
```

Dann in `constructor()` ersetzen:
```javascript
// this.loadPlaceholderModel(); // Alte Zeile löschen
this.loadModel(); // Neue Zeile
```

### Schritt 3: Material-Namen anpassen

Falls Ihr Modell benannte Materialien hat (z.B. "MainBody", "Base"), passen Sie `updateMaterial()` an:

```javascript
updateMaterial() {
    if (!this.model) return;

    const color = new THREE.Color(this.currentColor);
    const metalness = this.currentFinish === 'glossy' ? 0.8 : 0.2;
    const roughness = this.currentFinish === 'glossy' ? 0.2 : 0.8;

    this.model.traverse((child) => {
        if (child.isMesh) {
            // Option 1: Alle Meshes ändern
            child.material.color = color;
            child.material.metalness = metalness;
            child.material.roughness = roughness;
            
            // Option 2: Nur bestimmte Meshes (z.B. Body, nicht Logo)
            // if (child.name === 'MainBody' || child.name === 'Base') {
            //     child.material.color = color;
            //     child.material.metalness = metalness;
            //     child.material.roughness = roughness;
            // }
            
            child.material.needsUpdate = true;
        }
    });
}
```

### Schritt 4: Kamera-Positionen optimieren

Testen Sie die Views und passen Sie Positionen in `setCameraView()` an:

```javascript
const positions = {
    front: { x: 0, y: 1, z: 3 },    // Vorderansicht
    side: { x: 3, y: 1, z: 0 },     // Seitenansicht
    top: { x: 0, y: 3, z: 0.1 },    // Draufsicht
    reset: { x: 1.5, y: 1.5, z: 3 } // Diagonale Standardansicht
};
```

### Schritt 5: Gravur-System (Optional)

Für Text-Gravur mit Three.js:

```javascript
// In loadModel(), nach this.scene.add(this.model):
this.textMesh = null; // Referenz für Text-Mesh

// Neue Funktion:
updateEngraving() {
    // Remove old text
    if (this.textMesh) {
        this.scene.remove(this.textMesh);
    }
    
    if (!this.engravingEnabled || !this.engravingText) return;
    
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        const textGeometry = new THREE.TextGeometry(this.engravingText, {
            font: font,
            size: 0.2,
            height: 0.02,
            curveSegments: 12,
            bevelEnabled: false
        });
        
        const textMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            metalness: 0.5,
            roughness: 0.5
        });
        
        this.textMesh = new THREE.Mesh(textGeometry, textMaterial);
        this.textMesh.position.set(-0.5, 0.5, 0.31); // Position anpassen
        this.scene.add(this.textMesh);
    });
}
```

Dann in Event Listener aufrufen:
```javascript
engravingText.addEventListener('input', (e) => {
    this.engravingText = e.target.value;
    this.updateEngraving();
});
```

---

## Lokale Three.js Installation (Optional)

Für Offline-Nutzung oder bessere Performance:

```bash
npm install three
# oder
yarn add three
```

Dann in configurator.html ersetzen:
```html
<!-- Statt CDN: -->
<script type="module">
    import * as THREE from './node_modules/three/build/three.module.js';
    import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
    import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
    
    window.THREE = THREE;
    window.GLTFLoader = GLTFLoader;
    window.OrbitControls = OrbitControls;
</script>
```

---

## Warenkorb-Integration

Im `addToCartBtn` Event Listener ersetzen Sie die Alert-Logik durch Ihre Shop-Integration:

```javascript
addToCartBtn.addEventListener('click', () => {
    const config = {
        productId: 'wine-holder-custom',
        color: this.currentColor,
        finish: this.currentFinish,
        engraving: this.engravingEnabled ? this.engravingText : null,
        price: 49.99 // + Aufpreis für Gravur
    };
    
    // Beispiel: Shopify API
    fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: [{
                id: config.productId,
                quantity: 1,
                properties: {
                    'Farbe': config.color,
                    'Oberfläche': config.finish,
                    'Gravur': config.engraving || 'Keine'
                }
            }]
        })
    });
});
```

---

## Testing

1. Starten Sie einen lokalen Server:
   ```bash
   python -m http.server 8000
   ```

2. Öffnen Sie: `http://localhost:8000/configurator.html`

3. Testen Sie:
   - [ ] 3D-Modell lädt korrekt
   - [ ] Farben ändern sich
   - [ ] Finish (glänzend/matt) funktioniert
   - [ ] Kamera-Views wechseln smooth
   - [ ] Mobile Ansicht funktioniert
   - [ ] Gravur-Eingabe aktiviert/deaktiviert
   - [ ] Sprachswitch DE/EN funktioniert

---

## Bekannte Limitationen

1. **SSR/SSG**: Three.js läuft nur im Browser (kein Server-Side Rendering)
2. **Performance**: Große GLB-Dateien können langsam laden → Komprimierung empfohlen
3. **Browser-Support**: IE11 wird nicht unterstützt (moderne Browser only)

---

## Nächste Schritte

1. ✅ Grundstruktur (erledigt)
2. 🔄 GLB-Modell einbinden
3. 🔄 Material-Namen aus Blender/3D-Software übernehmen
4. 🔄 Kamera-Positionen optimieren
5. 🔄 Gravur-System (optional)
6. 🔄 Shop-Integration
7. 🔄 Screenshot-Funktion für Vorschau
8. 🔄 Preisberechnung dynamisch

---

## Support

Falls Probleme auftreten:
- Konsole öffnen (F12) für Fehler-Logs
- Three.js Dokumentation: https://threejs.org/docs/
- GLTFLoader Beispiele: https://threejs.org/examples/?q=gltf

Bei Fragen zum Code: siehe Kommentare in `configurator.js`
