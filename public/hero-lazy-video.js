/**
 * Hero Video Lazy Loader V3 - SENTINEL + USER INTERACTION
 * 
 * STRATEGIE:
 * 1. Video existiert NICHT im initialen DOM
 * 2. Sentinel-Element direkt nach Hero Section
 * 3. Injection NUR wenn:
 *    a) User hat gescrollt/touched/bewegt Maus (echte Interaktion)
 *    b) Sentinel wird sichtbar (User scrollt nach unten)
 * 4. IntersectionObserver: rootMargin 0px, threshold 0.1
 * 
 * ZIEL: KEIN Video-Request vor dem ersten User-Scroll!
 */

(function() {
  'use strict';

  const VIDEO_SRC = 'images/unbreak-one-hero.mp4';
  const VIDEO_CONTAINER_ID = 'hero-video-container';
  const IMAGE_CONTAINER_CLASS = 'hero-image-container';
  const SENTINEL_ID = 'hero-scroll-sentinel';

  let userHasInteracted = false;
  let videoInjected = false;

  /**
   * Detektiert echte User-Interaktion (nicht programmatisch)
   */
  function detectUserInteraction() {
    const events = ['scroll', 'touchstart', 'mousemove', 'keydown'];
    
    const handler = () => {
      userHasInteracted = true;
      console.log('[Hero Video] ✓ User-Interaktion detektiert');
      
      // Event Listener entfernen nach erster Interaktion
      events.forEach(event => {
        window.removeEventListener(event, handler, { passive: true });
      });
    };

    events.forEach(event => {
      window.removeEventListener(event, handler, { passive: true });
      window.addEventListener(event, handler, { passive: true, once: true });
    });
  }

  /**
   * Injiziert Video-Element dynamisch in den DOM
   */
  function injectAndPlayVideo() {
    if (videoInjected) return;
    videoInjected = true;

    console.log('[Hero Video] 🎬 Video-Injection gestartet...');

    const videoContainer = document.getElementById(VIDEO_CONTAINER_ID);
    const imageContainer = document.querySelector(`.${IMAGE_CONTAINER_CLASS}`);

    if (!videoContainer) {
      console.warn('[Hero Video] ⚠️ Container nicht gefunden');
      return;
    }

    // 1. Video-Element dynamisch erstellen
    const video = document.createElement('video');
    video.className = 'hero-video';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'none'; // WICHTIG: Kein Pre-Loading!
    
    // 2. Source-Element erstellen
    const source = document.createElement('source');
    source.src = VIDEO_SRC;
    source.type = 'video/mp4';
    
    video.appendChild(source);

    // 3. Overlay erstellen
    const overlay = document.createElement('div');
    overlay.className = 'hero-video-overlay';

    // 4. Styling für Video
    video.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      min-width: 100%;
      min-height: 100%;
      width: auto;
      height: auto;
      transform: translate(-50%, -50%);
      object-fit: cover;
      will-change: transform;
    `;

    // 5. In Container einfügen
    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);

    // 6. Fade-in nach Laden
    video.addEventListener('loadeddata', () => {
      console.log('[Hero Video] ✓ Video geladen, fade-in...');
      
      videoContainer.style.display = 'block';
      videoContainer.style.transition = 'opacity 1s ease-in-out';
      
      setTimeout(() => {
        videoContainer.style.opacity = '1';
        
        // Bild-Container nach Fade-in ausblenden
        setTimeout(() => {
          if (imageContainer) {
            imageContainer.style.transition = 'opacity 0.5s ease-out';
            imageContainer.style.opacity = '0';
            
            setTimeout(() => {
              imageContainer.style.display = 'none';
            }, 500);
          }
        }, 1000);
      }, 100);
    }, { once: true });

    // 7. Error Handling
    video.addEventListener('error', () => {
      console.warn('[Hero Video] ⚠️ Fehler beim Laden - bleibe bei statischem Bild');
      videoContainer.style.display = 'none';
    }, { once: true });

    // 8. Video laden und abspielen
    video.load();
  }

  /**
   * Initialisiert Sentinel-basiertes Video Loading
   */
  function initSentinelObserver() {
    const sentinel = document.getElementById(SENTINEL_ID);
    
    if (!sentinel) {
      console.warn('[Hero Video] ⚠️ Sentinel nicht gefunden');
      return;
    }

    if (!('IntersectionObserver' in window)) {
      console.warn('[Hero Video] ⚠️ IntersectionObserver nicht verfügbar');
      return;
    }

    console.log('[Hero Video] 🔍 Sentinel-Observer initialisiert');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && userHasInteracted) {
          console.log('[Hero Video] 🎯 Sentinel sichtbar + User hat interagiert → Lade Video');
          injectAndPlayVideo();
          observer.disconnect();
        } else if (entry.isIntersecting && !userHasInteracted) {
          console.log('[Hero Video] ⏸️ Sentinel sichtbar, aber keine User-Interaktion → warte');
        }
      });
    }, {
      rootMargin: '0px',    // KEIN Vorladen
      threshold: 0.1        // Trigger bei 10% Sichtbarkeit
    });

    observer.observe(sentinel);

    // Zusätzlicher Check: Falls User später scrollt
    const recheckInterval = setInterval(() => {
      if (userHasInteracted && !videoInjected) {
        console.log('[Hero Video] 🔄 Recheck: User hat interagiert → prüfe Sentinel');
        // Observer wird Video laden wenn Sentinel sichtbar
      }
      
      if (videoInjected) {
        clearInterval(recheckInterval);
      }
    }, 500);
  }

  /**
   * Hauptinitialisierung
   */
  function init() {
    console.log('[Hero Video] 🚀 V3 Lazy Loader gestartet');
    
    // 1. User-Interaktions-Detektion starten
    detectUserInteraction();
    
    // 2. Sentinel Observer starten
    initSentinelObserver();
  }

  // Initialisiere nach DOM-Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

