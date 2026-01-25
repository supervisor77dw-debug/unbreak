/**
 * UNBREAK ONE - Landing Page JavaScript
 * Handles navigation, smooth scrolling, and interactive elements
 */

// ===================================
// SMOOTH SCROLLING FOR NAVIGATION LINKS
// ===================================
document.addEventListener('DOMContentLoaded', function () {

    // Get all anchor links that start with #
    const navLinks = document.querySelectorAll('a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');

            // Skip if link is just "#" or doesn't exist
            if (targetId === '#' || targetId.length <= 1) return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Close mobile menu if open
                const navLinksMenu = document.getElementById('navLinks');
                if (navLinksMenu.classList.contains('active')) {
                    navLinksMenu.classList.remove('active');
                }

                // Smooth scroll to target
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ===================================
    // MOBILE MENU TOGGLE
    // ===================================
    const burgerMenu = document.getElementById('burgerMenu');
    const navLinksMenu = document.getElementById('navLinks');

    if (burgerMenu && navLinksMenu) {
        burgerMenu.addEventListener('click', function () {
            navLinksMenu.classList.toggle('active');

            // Animate burger menu (optional enhancement)
            this.classList.toggle('active');
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function (e) {
            const isClickInsideNav = navLinksMenu.contains(e.target);
            const isClickOnBurger = burgerMenu.contains(e.target);

            if (!isClickInsideNav && !isClickOnBurger && navLinksMenu.classList.contains('active')) {
                navLinksMenu.classList.remove('active');
                burgerMenu.classList.remove('active');
            }
        });
    }

    // ===================================
    // STICKY HEADER SHADOW ON SCROLL
    // ===================================
    const header = document.querySelector('header');

    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // ===================================
    // CARD HOVER EFFECTS (Enhancement)
    // ===================================
    const cards = document.querySelectorAll('.card, .bereich-card, .set-card, .step-card');

    cards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.style.transition = 'all 0.3s ease';
        });
    });

    // ===================================
    // LAZY IMAGE LOADING (Optional Enhancement)
    // ===================================
    // Add loading="lazy" attribute to images for better performance
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }
    });

    // ===================================
    // HERO VIDEO LAZY LOADER (LCP-optimiert)
    // ===================================
    const heroVideo = document.querySelector('#hero-video');
    const videoContainer = document.querySelector('.hero-video-container');
    const imageContainer = document.querySelector('.hero-image-container');
    
    if (heroVideo && videoContainer && imageContainer) {
        let videoLoaded = false;
        
        // Funktion: Video lazy-loaden
        function loadHeroVideo() {
            if (videoLoaded) return;
            videoLoaded = true;
            
            const videoSource = heroVideo.querySelector('source[data-src]');
            if (!videoSource) return;
            
            const videoSrc = videoSource.getAttribute('data-src');
            videoSource.src = videoSrc;
            videoSource.removeAttribute('data-src');
            
            heroVideo.load();
            
            // Nach erfolgreichem Laden: Video anzeigen, Bild ausblenden
            heroVideo.addEventListener('loadeddata', () => {
                videoContainer.style.display = 'block';
                videoContainer.style.opacity = '0';
                
                // Fade-in Video
                setTimeout(() => {
                    videoContainer.style.transition = 'opacity 1s ease-in-out';
                    videoContainer.style.opacity = '1';
                    
                    // Bild nach Fade-in entfernen
                    setTimeout(() => {
                        imageContainer.style.display = 'none';
                    }, 1000);
                }, 100);
                
                // Autoplay starten
                heroVideo.play().catch(err => {
                    console.log('[Hero Video] Autoplay verhindert:', err);
                });
            }, { once: true });
            
            // Error Handling
            heroVideo.addEventListener('error', () => {
                console.warn('[Hero Video] Fehler beim Laden - bleibe bei statischem Bild');
                videoContainer.style.display = 'none';
            }, { once: true });
        }
        
        // Strategie 1: IntersectionObserver (bevorzugt)
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadHeroVideo();
                        observer.disconnect();
                    }
                });
            }, {
                rootMargin: '200px' // Video etwas früher laden
            });
            
            observer.observe(heroVideo);
        } else {
            // Fallback: requestIdleCallback
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => loadHeroVideo(), { timeout: 2000 });
            } else {
                // Letzter Fallback: Delay
                setTimeout(() => loadHeroVideo(), 1500);
            }
        }
    }

    // ===================================
    // CONSOLE INFO (Development Helper)
    // ===================================
    console.log('%c🚀 UNBREAK ONE Landing Page geladen!', 'color: #0A6C74; font-size: 16px; font-weight: bold;');
    console.log('%c📝 Hinweis: Ersetzen Sie die Bildplatzhalter im /images Ordner durch Ihre echten Produktbilder.', 'color: #084F55; font-size: 12px;');
    console.log('%c🛒 Hinweis: Aktualisieren Sie alle Shopify-Links (markiert mit TODO-Kommentaren im HTML).', 'color: #084F55; font-size: 12px;');
});

// ===================================
// INTERSECTION OBSERVER (Optional: Fade-in animations)
// ===================================
// Uncomment this section if you want fade-in animations on scroll

/*
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe all sections
const sections = document.querySelectorAll('section');
sections.forEach(section => {
  section.style.opacity = '0';
  section.style.transform = 'translateY(20px)';
  section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(section);
});
*/
