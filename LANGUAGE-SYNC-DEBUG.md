# Language Sync Debug Guide

## Problem
Console zeigt: `message_validation_failed` mit 4 Errors  
→ iframe sendet Messages die nicht validiert werden können

## Fix Deployed
**Commit:** `4881b1e` - Better logging for validation failures  
**Deploy:** ~30 Sekunden warten

## Test-Schritte

### 1. Seite neu laden (Hard Refresh)
```
URL: https://unbreak-one.vercel.app/configurator.html
Aktion: Ctrl + Shift + R
```

### 2. Console öffnen (TOP context!)
```
F12 → Console Tab
Dropdown oben links: "top" wählen (NICHT "configurator-iframe")
```

### 3. Validation Errors detailliert ansehen
Die Console sollte jetzt zeigen:
```javascript
⚠️ [BRIDGE] Message validation failed: {
    event: "...",              // <- Welches Event?
    errors: ["...", "..."],    // <- Was fehlt?
    payload: {...},            // <- Was wurde gesendet?
    rawData: {...}            // <- Original Message
}
```

### 4. Bitte kopiere die KOMPLETTE Fehlermeldung
```
Rechtsklick auf die Warning → "Copy object"
Oder: Screenshot der aufgeklappten Fehlermeldung
```

### 5. Sprache manuell testen (Optional)
```javascript
// In Console (TOP context):
// Prüfe ob Language Sync Funktion existiert
window.iframeBridge?.setLanguage('en')

// Erwartung: iframe wechselt zu Englisch
// Falls nicht: Kopiere alle Console Ausgaben
```

## Was ich brauche

Bitte sende mir:

1. **Screenshot oder Copy** der kompletten Validation Error Message:
   ```javascript
   {
       event: "???",
       errors: ["???", "???", "???", "???"],
       payload: {...},
       rawData: {...}
   }
   ```

2. **Welche Messages kommen vom iframe?**
   - Filtere Console nach `[BRIDGE]`
   - Kopiere alle `Message validation failed` Einträge

3. **Test Language Switch:**
   - Klick DE → EN oben rechts
   - Was passiert?
   - iframe ändert Sprache? Ja/Nein
   - Console Errors?

## Mögliche Ursachen

### A) iframe sendet falsches Event-Format
```javascript
// iframe sendet:
{ type: "configUpdated", ... }

// Erwartet:
{ event: "UNBREAK_CONFIG_CHANGED", ... }
```

### B) Payload fehlt Pflichtfelder
```javascript
// Fehlt z.B.:
errors: ["payload.locale is required", "payload.variant missing", ...]
```

### C) iframe verwendet altes Message-Format
```javascript
// Legacy format ohne schemaVersion/timestamp
```

## Quick-Fix Optionen

Basierend auf den Errors kann ich:

**Option 1:** Legacy Converter erweitern
- Mehr alte Formate unterstützen
- Automatische Konvertierung

**Option 2:** Validation lockern
- Optional fields statt required
- Mehr Event types erlauben

**Option 3:** iframe Messages anpassen
- iframe-Code updaten (falls wir Zugriff haben)
- Richtiges Schema verwenden

---

**Warte auf deine Console-Ausgabe mit den 4 Errors!**

Dann kann ich gezielt fixen was fehlt.
