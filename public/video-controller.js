/* ===================================
   VIDEO CONTROLLER
   Advanced Video Management with Lazy Loading & Performance Optimization
   =================================== */

(function() {
  'use strict';

  // ===================================
  // CONFIGURATION
  // ===================================
  const CONFIG = {
    lazyLoadThreshold: '200px', // Load video when 200px from viewport
    playbackQuality: 'auto',
    enableAutoplay: true,
    enableLazyLoad: true,
  };

  // ===================================
  // LAZY LOADING WITH INTERSECTION OBSERVER
  // ===================================
  class VideoLazyLoader {
    constructor() {
      this.videos = document.querySelectorAll('.lazy-video');
      this.observer = null;
      this.init();
    }

    init() {
      if (!CONFIG.enableLazyLoad) {
        this.loadAllVideos();
        return;
      }

      // Check if IntersectionObserver is supported
      if ('IntersectionObserver' in window) {
        this.setupObserver();
      } else {
        // Fallback for older browsers
        this.loadAllVideos();
      }
    }

    setupObserver() {
      const options = {
        root: null,
        rootMargin: CONFIG.lazyLoadThreshold,
        threshold: 0.1
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadVideo(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, options);

      this.videos.forEach(video => {
        this.observer.observe(video);
      });
    }

    loadVideo(video) {
      const src = video.dataset.src;
      
      if (!src) return;

      // Set loading state
      video.classList.add('loading');

      // Load source tags
      const sources = video.querySelectorAll('source[data-src]');
      sources.forEach(source => {
        source.src = source.dataset.src;
      });

      // Set video src
      video.src = src;

      // Load the video
      video.load();

      // Remove loading state when ready
      video.addEventListener('loadeddata', () => {
        video.classList.remove('loading');
        video.classList.add('loaded');
      }, { once: true });

      console.log(`[VIDEO] Lazy loaded: ${src}`);
    }

    loadAllVideos() {
      this.videos.forEach(video => this.loadVideo(video));
    }
  }

  // ===================================
  // VIDEO PLAY CONTROLLER WITH MODAL
  // ===================================
  class VideoPlayController {
    constructor() {
      this.videos = document.querySelectorAll('.proof-video');
      this.modal = null;
      this.currentVideo = null;
      this.scrollPosition = 0;
      this.init();
      this.createModal();
    }

    createModal() {
      // Create modal HTML
      const modalHTML = `
        <div class="video-modal" id="videoModal">
          <div class="video-modal-hint">Drücke ESC zum Schließen</div>
          <button class="video-modal-close" aria-label="Schließen">&times;</button>
          <div class="video-modal-content">
            <video 
              id="modalVideo"
              controls
              autoplay
              loop
              playsinline>
            </video>
            <div class="video-modal-title" id="modalTitle"></div>
          </div>
        </div>
      `;

      // Insert modal into body
      document.body.insertAdjacentHTML('beforeend', modalHTML);

      this.modal = document.getElementById('videoModal');
      const closeBtn = this.modal.querySelector('.video-modal-close');
      const modalVideo = document.getElementById('modalVideo');

      // Close button handler
      closeBtn.addEventListener('click', () => this.closeModal());

      // ESC key handler
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal.classList.contains('active')) {
          this.closeModal();
        }
      });

      // Click outside video to close
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });

      // Video ended handler
      modalVideo.addEventListener('ended', () => {
        // Loop is enabled, but if user wants to close on end
        // this.closeModal();
      });
    }

    init() {
      this.videos.forEach(video => {
        const container = video.closest('.proof-video-container');
        const playOverlay = container?.querySelector('.video-play-overlay');
        const playButton = container?.querySelector('.video-play-btn');
        const videoLabel = container?.querySelector('.video-label span');

        if (!container || !playOverlay || !playButton) return;

        // Play button click handler - Open Modal
        playButton.addEventListener('click', (e) => {
          e.preventDefault();
          const videoSrc = video.querySelector('source')?.src || video.src;
          const title = videoLabel?.textContent || 'Video';
          this.openModal(videoSrc, title);
        });

        // Video click handler - Open Modal
        video.addEventListener('click', (e) => {
          e.preventDefault();
          const videoSrc = video.querySelector('source')?.src || video.src;
          const title = videoLabel?.textContent || 'Video';
          this.openModal(videoSrc, title);
        });
      });
    }

    openModal(videoSrc, title) {
      const modalVideo = document.getElementById('modalVideo');
      const modalTitle = document.getElementById('modalTitle');

      // Save current scroll position
      this.scrollPosition = window.pageYOffset;

      // Set video source
      modalVideo.src = videoSrc;

      // Set title
      modalTitle.textContent = title;

      // Show modal
      this.modal.classList.add('active');
      document.body.classList.add('video-modal-open');

      // Play video
      modalVideo.play().catch(err => {
        console.error('[VIDEO MODAL] Play failed:', err);
      });

      console.log('[VIDEO MODAL] Opened:', title);
    }

    closeModal() {
      const modalVideo = document.getElementById('modalVideo');

      // Pause and reset video
      modalVideo.pause();
      modalVideo.currentTime = 0;
      modalVideo.src = '';

      // Hide modal
      this.modal.classList.remove('active');
      document.body.classList.remove('video-modal-open');

      // Restore scroll position
      window.scrollTo(0, this.scrollPosition);

      console.log('[VIDEO MODAL] Closed');
    }

    togglePlayback(video, overlay) {
      if (video.paused) {
        video.play()
          .then(() => {
            overlay.classList.add('hidden');
            console.log('[VIDEO] Playing');
          })
          .catch(err => {
            console.error('[VIDEO] Play failed:', err);
          });
      } else {
        video.pause();
        overlay.classList.remove('hidden');
        console.log('[VIDEO] Paused');
      }
    }

    setupViewportPause(video) {
      if (!('IntersectionObserver' in window)) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && !video.paused) {
            video.pause();
            console.log('[VIDEO] Paused (out of viewport)');
          }
        });
      }, {
        threshold: 0.25
      });

      observer.observe(video);
    }
  }

  // ===================================
  // HERO VIDEO CONTROLLER
  // ===================================
  class HeroVideoController {
    constructor() {
      this.video = document.querySelector('.hero-video');
      this.init();
    }

    init() {
      if (!this.video) return;

      // Ensure video plays on mobile
      this.video.addEventListener('canplaythrough', () => {
        this.video.play().catch(err => {
          console.warn('[HERO VIDEO] Autoplay prevented:', err);
        });
      }, { once: true });

      // Handle loading errors
      this.video.addEventListener('error', (e) => {
        console.error('[HERO VIDEO] Load error:', e);
        this.handleVideoError();
      });

      // Performance: Reduce quality on slow connections
      this.adjustQualityForConnection();
    }

    handleVideoError() {
      const container = this.video.closest('.hero-video-container');
      if (!container) return;

      // Show poster image on error
      const poster = this.video.getAttribute('poster');
      if (poster) {
        container.style.backgroundImage = `url(${poster})`;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
        this.video.style.display = 'none';
      }
    }

    adjustQualityForConnection() {
      // Check connection speed (if API available)
      if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          console.log('[HERO VIDEO] Slow connection detected, using poster only');
          this.video.pause();
          this.video.style.display = 'none';
          this.handleVideoError();
        }
      }
    }
  }

  // ===================================
  // PERFORMANCE MONITORING
  // ===================================
  class VideoPerformanceMonitor {
    constructor() {
      this.metrics = {
        loaded: 0,
        errors: 0,
        totalLoadTime: 0
      };
    }

    trackLoad(video) {
      const startTime = performance.now();

      video.addEventListener('loadeddata', () => {
        const loadTime = performance.now() - startTime;
        this.metrics.loaded++;
        this.metrics.totalLoadTime += loadTime;
        
        console.log(`[PERF] Video loaded in ${loadTime.toFixed(2)}ms`);
      }, { once: true });

      video.addEventListener('error', () => {
        this.metrics.errors++;
        console.warn('[PERF] Video load error');
      }, { once: true });
    }

    getReport() {
      const avgLoadTime = this.metrics.loaded > 0 
        ? this.metrics.totalLoadTime / this.metrics.loaded 
        : 0;

      return {
        ...this.metrics,
        avgLoadTime: avgLoadTime.toFixed(2) + 'ms'
      };
    }
  }

  // ===================================
  // ACCESSIBILITY ENHANCEMENTS
  // ===================================
  class VideoAccessibility {
    constructor() {
      this.videos = document.querySelectorAll('video');
      this.init();
    }

    init() {
      this.videos.forEach(video => {
        // Add keyboard controls
        video.setAttribute('tabindex', '0');
        
        video.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (video.paused) {
              video.play();
            } else {
              video.pause();
            }
          }
        });

        // Respect prefers-reduced-motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          video.pause();
          video.removeAttribute('autoplay');
        }
      });
    }
  }

  // ===================================
  // INITIALIZATION
  // ===================================
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeControllers);
    } else {
      initializeControllers();
    }
  }

  function initializeControllers() {
    console.log('[VIDEO] Initializing video controllers...');

    // Initialize all controllers
    const lazyLoader = new VideoLazyLoader();
    const playController = new VideoPlayController();
    const heroController = new HeroVideoController();
    const accessibility = new VideoAccessibility();
    const perfMonitor = new VideoPerformanceMonitor();

    // Track performance for all videos
    document.querySelectorAll('video').forEach(video => {
      perfMonitor.trackLoad(video);
    });

    // Log performance report after 5 seconds
    setTimeout(() => {
      console.log('[VIDEO] Performance Report:', perfMonitor.getReport());
    }, 5000);

    console.log('[VIDEO] Controllers initialized successfully');
  }

  // Start initialization
  init();

  // Expose controllers globally for debugging
  window.VideoControllers = {
    VideoLazyLoader,
    VideoPlayController,
    HeroVideoController,
    VideoPerformanceMonitor,
    VideoAccessibility
  };

})();
