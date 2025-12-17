# i18n Implementation Documentation

## Übersicht

Die UNBREAK ONE Website unterstützt jetzt vollständige Zweisprachigkeit (Deutsch/Englisch) mit einem modernen, leichtgewichtigen i18n-System.

## Features

✅ **Language Switch** - DE/EN Toggle in der Navbar (Desktop + Mobile)
✅ **Persistenz** - Sprachwahl wird in `localStorage` gespeichert
✅ **URL Parameter** - `?lang=en` oder `?lang=de` überschreibt gespeicherte Einstellung
✅ **Browser Detection** - Automatische Spracherkennung beim ersten Besuch
✅ **Smooth Transitions** - Sanfte Überblendung beim Sprachwechsel
✅ **SEO Ready** - Dynamische Meta-Tags und `<html lang>` Attribute
✅ **Accessibility** - ARIA-Labels, Keyboard Navigation, High Contrast Support
✅ **Fallback System** - Deutsche Texte als Fallback bei fehlenden Übersetzungen

## Dateien

### Core System
- **`i18n.js`** - Haupt-i18n Engine mit Translation Loading und Content Updates
- **`language-switch.js`** - UI Component für Sprachwechsel in der Navbar
- **`i18n.css`** - Styling für Language Switch (Glassy-Design passend zur Seite)

### Übersetzungen
- **`translations/de.json`** - Deutsche Texte (Quelle)
- **`translations/en.json`** - Englische Übersetzungen

## Integration in HTML

### 1. CSS & JavaScript einbinden (im `<head>`)

```html
<link rel="stylesheet" href="i18n.css">
<script src="i18n.js"></script>
<script src="language-switch.js" defer></script>
```

### 2. Texte markieren

**Einfache Texte:**
```html
<h1 data-i18n="hero.title">UNBREAK ONE</h1>
<p data-i18n="hero.subtitle">Magnetische Halter für Gläser...</p>
```

**Alt-Texte:**
```html
<img src="..." alt="..." data-i18n-alt="product.wineGlass.imageAlt">
```

**HTML Content (für Listen, Links etc.):**
```html
<div data-i18n-html="contact.richText"></div>
```

**Aria-Labels:**
```html
<a href="..." data-i18n-aria="contact.instagramAria">📷</a>
```

**Placeholders:**
```html
<input type="text" data-i18n-placeholder="contact.namePlaceholder">
```

## Translation Keys Struktur

```
meta.*              → SEO Meta-Tags (Title, Description, OG, Twitter)
nav.*               → Navigation (home, product, contact, etc.)
hero.*              → Hero Section (title, subtitle, features, CTAs)
product.*           → Produktübersicht (wineGlass, bottle mit Subkeys)
useCases.*          → Einsatzbereiche (boat, camper, gastro, home)
gastroHero.*        → Gastro Edition Hero
tech.*              → Technik & Nachhaltigkeit
howTo.*             → Anwendung in 3 Schritten
shop.*              → Shop Sets & CTAs
contact.*           → Kontakt Section
footer.*            → Footer Links
```

## Verwendung

### Sprachwechsel per Code

```javascript
// Sprache wechseln
window.i18n.setLanguage('en');

// Aktuelle Sprache abfragen
const currentLang = window.i18n.getCurrentLanguage();

// Übersetzung abrufen
const text = window.i18n.t('hero.title');
```

### URL Parameter

```
https://unbreak-one.com?lang=en    → Englisch
https://unbreak-one.com?lang=de    → Deutsch
```

### LocalStorage

Die Sprachwahl wird automatisch gespeichert unter:
```javascript
localStorage.getItem('unbreakone_lang') // 'de' oder 'en'
```

## Events

**i18nReady** - Wird gefeuert, wenn i18n initialisiert ist:
```javascript
window.addEventListener('i18nReady', (e) => {
  console.log('i18n ready, language:', e.detail.lang);
});
```

**languageChanged** - Wird gefeuert beim Sprachwechsel:
```javascript
window.addEventListener('languageChanged', (e) => {
  console.log('Language changed to:', e.detail.lang);
});
```

## Styling Anpassungen

Der Language Switch nutzt das bestehende Design-System:
- **Glassy Effekt** mit `backdrop-filter: blur(10px)`
- **Petrol-Farbe** (`#0A6C74`) für aktiven Zustand
- **Smooth Transitions** passend zu Animationen
- **Mobile**: Fixed Position (top-right)
- **Desktop**: Integriert in Navbar

## Neue Übersetzungen hinzufügen

1. **Key in beiden JSON-Files anlegen:**
```json
// translations/de.json
{
  "newSection": {
    "title": "Neue Sektion"
  }
}

// translations/en.json
{
  "newSection": {
    "title": "New Section"
  }
}
```

2. **HTML mit data-i18n markieren:**
```html
<h2 data-i18n="newSection.title">Neue Sektion</h2>
```

3. **System aktualisiert automatisch beim Laden**

## Browser-Support

✅ Alle modernen Browser (Chrome, Firefox, Safari, Edge)
✅ Mobile Safari (iOS)
✅ Chrome Mobile (Android)
✅ IE11 nicht unterstützt (nutzt moderne ES6-Features)

## Performance

- **Lazy Loading**: Translations werden parallel geladen
- **Caching**: Browser cached JSON-Files
- **Minimal Bundle**: ~12KB (unkomprimiert)
- **No Dependencies**: Pure Vanilla JavaScript

## Wartung

### Übersetzung aktualisieren
Einfach `de.json` oder `en.json` bearbeiten - keine Code-Änderungen nötig.

### Neue Seite hinzufügen
1. i18n CSS + JS einbinden
2. Texte mit `data-i18n` markieren
3. Keys in JSON-Files hinzufügen

### Debugging
Browser Console zeigt Warnungen bei:
- Fehlenden Translation Keys
- Netzwerkfehlern beim Laden
- Fallback-Verwendung

## Legal Pages

Die rechtlichen Seiten (Impressum, Datenschutz, AGB) haben:
- ✅ Language Switch in der Navigation
- ✅ i18n für Navigationslinks
- ⚠️ **Hauptcontent bleibt Deutsch** (rechtliche Anforderung)

Für vollständige Übersetzung der Legal Pages müssten separate deutsche/englische Versionen erstellt werden (impressum-en.html etc.).

## Zusammenfassung

Das System ist:
- ✅ **Lightweight** - Keine externen Libraries
- ✅ **Robust** - Fallback-System, Error Handling
- ✅ **Accessible** - ARIA, Keyboard, High Contrast
- ✅ **SEO-Ready** - Meta-Tags, HTML lang attribute
- ✅ **Maintainable** - Klare Struktur, gut dokumentiert
- ✅ **Non-Invasive** - Keine Breaking Changes am Design

**Alle Animationen, Styles und Layout bleiben 1:1 erhalten!**
