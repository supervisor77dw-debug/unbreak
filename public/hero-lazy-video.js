/**
 * Hero Video Lazy Loader V3.3 - ROBUST USER INTERACTION
 * 
 * STRATEGIE:
 * 1. Video existiert NICHT im initialen DOM
 * 2. Download startet bei ERSTER User-Interaktion (scroll/touch/pointer/key)
 * 3. Sentinel OPTIONAL für Playback-Steuerung
 * 
 * ZIEL: Video lädt zuverlässig nach Interaktion, LCP bleibt Posterbild!
 */

(function() {
  'use strict';

  const VIDEO_SRC = 'images/unbreak-one-hero.mp4';
  const VIDEO_CONTAINER_ID = 'hero-video-container';
  const IMAGE_CONTAINER_CLASS = 'hero-image-container';
  const SENTINEL_ID = 'hero-scroll-sentinel';

  let videoInjected = false;
  let videoLoading = false;

  /**
   * Injiziert Video-Element und startet Download
   */
  function injectAndLoadVideo() {
    if (videoInjected || videoLoading) {
      console.log('[Hero Video] Already injected/loading, skipping');
      return;
    }
    
    videoLoading = true;
    console.log('[Hero Video] 🎬 Injecting video element...');

    const videoContainer = document.getElementById(VIDEO_CONTAINER_ID);
    const imageContainer = document.querySelector(`.${IMAGE_CONTAINER_CLASS}`);

    if (!videoContainer) {
      console.warn('[Hero Video] ⚠️ Container not found');
      return;
    }

    // 1. Video-Element dynamisch erstellen
    const video = document.createElement('video');
    video.className = 'hero-video';
    video.autoplay = false; // Nicht autoplay - warten auf Playback-Signal
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata'; // Metadata laden für schnelleren Start
    
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

    console.log('[Hero Video] ✅ Video element injected');

    // 6. Event Listeners für Debugging
    video.addEventListener('loadstart', () => {
      console.log('[Hero Video] 📡 loadstart - Download starting...');
    }, { once: true });

    video.addEventListener('loadedmetadata', () => {
      console.log('[Hero Video] 📊 loadedmetadata - Duration:', video.duration, 's');
    }, { once: true });

    video.addEventListener('loadeddata', () => {
      console.log('[Hero Video] ✅ loadeddata - First frame ready');
      videoInjected = true;
      
      // Fade-in Video, Fade-out Bild
      videoContainer.style.display = 'block';
      videoContainer.style.transition = 'opacity 1s ease-in-out';
      
      setTimeout(() => {
        videoContainer.style.opacity = '1';
        
        // Video abspielen
        video.play().then(() => {
          console.log('[Hero Video] ▶️ Playing');
          
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
        }).catch(err => {
          console.warn('[Hero Video] ⚠️ Play failed:', err);
        });
      }, 100);
    }, { once: true });

    video.addEventListener('canplay', () => {
      console.log('[Hero Video] ✅ canplay - Ready to play');
    }, { once: true });

    video.addEventListener('error', (e) => {
      console.error('[Hero Video] ❌ Error loading video:', e);
      videoContainer.style.display = 'none';
    }, { once: true });

    // 7. Video laden starten
    console.log('[Hero Video] 🔄 Calling video.load()...');
    video.load();
  }

  /**
   * Detektiert erste User-Interaktion und triggert Video-Download
   */
  function initUserInteractionTrigger() {
    const interactionEvents = ['scroll', 'touchstart', 'pointerdown', 'mousemove', 'keydown'];
    
    const handler = (eventType) => {
      console.log(`[Hero Video] 🎯 User interaction detected: ${eventType}`);
      
      // Trigger Video-Download
      injectAndLoadVideo();
      
      // Event Listener entfernen nach erster Interaktion
      interactionEvents.forEach(event => {
        window.removeEventListener(event, handlers[event], { passive: true });
      });
    };

    // Separate Handler für jeden Event-Typ (für Debugging)
    const handlers = {};
    interactionEvents.forEach(event => {
      handlers[event] = () => handler(event);
      window.addEventListener(event, handlers[event], { passive: true, once: true });
    });

    console.log('[Hero Video] 👂 Listening for user interactions:', interactionEvents.join(', '));
  }

  /**
   * Optional: Sentinel für zusätzliche Playback-Steuerung
   */
  function initSentinelObserver() {
    const sentinel = document.getElementById(SENTINEL_ID);
    
    if (!sentinel) {
      console.log('[Hero Video] ℹ️ No sentinel found (optional)');
      return;
    }

    if (!('IntersectionObserver' in window)) {
      console.warn('[Hero Video] ⚠️ IntersectionObserver not available');
      return;
    }

    console.log('[Hero Video] 🔍 Sentinel observer initialized (optional)');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          console.log('[Hero Video] 📍 Sentinel visible');
          // Sentinel sichtbar - könnte für Playback-Steuerung genutzt werden
          // Aktuell: Video wird bereits bei User-Interaktion geladen
        }
      });
    }, {
      rootMargin: '0px',
      threshold: 0.1
    });

    observer.observe(sentinel);
  }

  /**
   * Hauptinitialisierung
   */
  function init() {
    console.log('[Hero Video] 🚀 V3.3 Lazy Loader started');
    console.log('[Hero Video] Strategy: Download on first user interaction');
    
    // 1. User-Interaktions-Trigger (primär)
    initUserInteractionTrigger();
    
    // 2. Sentinel Observer (optional)
    initSentinelObserver();
  }

  // Initialisiere nach DOM-Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

