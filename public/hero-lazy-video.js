/**
 * Hero Video Lazy Loader - KOMPLETT DYNAMISCH
 * Video-Element existiert NICHT im initialen DOM
 * Wird erst bei Sichtbarkeit per IntersectionObserver injiziert
 * 
 * WARUM: Verhindert dass Browser das Video/Poster früh lädt und als LCP erkennt
 */

(function() {
  'use strict';

  const VIDEO_SRC = 'images/unbreak-one-hero.mp4';
  const VIDEO_CONTAINER_ID = 'hero-video-container';
  const IMAGE_CONTAINER_CLASS = 'hero-image-container';

  function initHeroVideoLazyLoad() {
    const videoContainer = document.getElementById(VIDEO_CONTAINER_ID);
    const imageContainer = document.querySelector(`.${IMAGE_CONTAINER_CLASS}`);
    const heroSection = document.getElementById('hero');
    
    if (!videoContainer || !heroSection) {
      console.warn('[Hero Video] Container nicht gefunden');
      return;
    }

    let videoInjected = false;

    function injectAndPlayVideo() {
      if (videoInjected) return;
      videoInjected = true;

      console.log('[Hero Video] Injiziere Video-Element...');

      // 1. Video-Element dynamisch erstellen
      const video = document.createElement('video');
      video.className = 'hero-video';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'none';
      
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
        console.log('[Hero Video] Video geladen, fade-in...');
        
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
        console.warn('[Hero Video] Fehler beim Laden - bleibe bei statischem Bild');
        videoContainer.style.display = 'none';
      }, { once: true });

      // 8. Video laden und abspielen
      video.load();
    }

    // Strategie 1: IntersectionObserver (bevorzugt)
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            console.log('[Hero Video] Hero ist sichtbar, lade Video...');
            injectAndPlayVideo();
            observer.disconnect();
          }
        });
      }, {
        rootMargin: '200px' // Video etwas früher laden
      });

      observer.observe(heroSection);
    } else {
      // Fallback: requestIdleCallback
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          console.log('[Hero Video] Fallback: requestIdleCallback');
          injectAndPlayVideo();
        }, { timeout: 2000 });
      } else {
        // Letzter Fallback: Delay
        setTimeout(() => {
          console.log('[Hero Video] Fallback: setTimeout');
          injectAndPlayVideo();
        }, 1500);
      }
    }
  }

  // Initialisiere nach DOM-Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroVideoLazyLoad);
  } else {
    initHeroVideoLazyLoad();
  }
})();
