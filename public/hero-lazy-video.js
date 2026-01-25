/**
 * Hero Video Lazy Loader
 * Verzögert das Laden des Hero-Videos um LCP-Performance zu verbessern
 */

(function() {
  'use strict';

  function initHeroVideo() {
    const videoElement = document.querySelector('.hero-video');
    const videoContainer = document.querySelector('.hero-video-container');
    if (!videoElement || !videoContainer) return;

    const videoSource = videoElement.querySelector('source');
    if (!videoSource) return;

    // Video-Quelle ist initial leer, um Download zu verhindern
    const videoSrc = videoSource.getAttribute('data-src');
    if (!videoSrc) return;

    // Strategie 1: Nach IntersectionObserver (Hero sichtbar)
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            loadVideo();
            observer.disconnect();
          }
        });
      }, {
        rootMargin: '50px' // Lade etwas früher
      });

      observer.observe(videoElement);
    } else {
      // Fallback: Nach requestIdleCallback
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => loadVideo(), { timeout: 2000 });
      } else {
        // Letzter Fallback: Nach 1s delay
        setTimeout(() => loadVideo(), 1000);
      }
    }

    function loadVideo() {
      videoSource.src = videoSrc;
      videoElement.load();
      
      // Fade-in nach erfolgreicher Ladung
      videoElement.addEventListener('loadeddata', () => {
        videoContainer.classList.add('loaded');
      }, { once: true });
      
      videoElement.play().catch(err => {
        console.log('Video autoplay prevented:', err);
      });
    }
  }

  // Initialisiere nach DOM-Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroVideo);
  } else {
    initHeroVideo();
  }
})();
