/**
 * UNBREAK ONE - Advanced Animations & Interactions
 * Volle WOW-Effekte mit Performance-Optimierung
 */

// ============================================
// 1. SCROLL REVEAL SYSTEM
// ============================================

class ScrollReveal {
    constructor(options = {}) {
        this.options = {
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px',
            ...options
        };

        this.observer = null;
        this.init();
    }

    init() {
        // Intersection Observer Setup
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            this.options
        );

        // Beobachte alle Elemente mit data-scroll-reveal
        const elements = document.querySelectorAll('[data-scroll-reveal]');
        elements.forEach(el => this.observer.observe(el));
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');

                // Optional: Observer entfernen nach Reveal (Performance)
                if (!entry.target.hasAttribute('data-scroll-repeat')) {
                    this.observer.unobserve(entry.target);
                }
            } else if (entry.target.hasAttribute('data-scroll-repeat')) {
                entry.target.classList.remove('revealed');
            }
        });
    }
}

// ============================================
// 2. PARALLAX EFFECT
// ============================================

class ParallaxEffect {
    constructor() {
        this.elements = document.querySelectorAll('.parallax');
        this.ticking = false;
        this.init();
    }

    init() {
        if (this.elements.length === 0) return;

        window.addEventListener('scroll', () => {
            if (!this.ticking) {
                window.requestAnimationFrame(() => {
                    this.update();
                    this.ticking = false;
                });
                this.ticking = true;
            }
        }, { passive: true });
    }

    update() {
        const scrollY = window.pageYOffset;

        this.elements.forEach(el => {
            const speed = el.dataset.parallaxSpeed || 0.5;
            const yPos = -(scrollY * speed);
            el.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });
    }
}

// ============================================
// 3. SCROLL PROGRESS INDICATOR
// ============================================

class ScrollProgress {
    constructor() {
        this.progressBar = this.createProgressBar();
        this.init();
    }

    createProgressBar() {
        const bar = document.createElement('div');
        bar.className = 'scroll-progress';
        document.body.appendChild(bar);
        return bar;
    }

    init() {
        window.addEventListener('scroll', () => {
            this.update();
        }, { passive: true });
    }

    update() {
        const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = (window.pageYOffset / windowHeight) * 100;
        this.progressBar.style.width = `${scrolled}%`;
    }
}

// ============================================
// 4. MAGNETIC BUTTON EFFECT
// ============================================

class MagneticButtons {
    constructor() {
        this.buttons = document.querySelectorAll('.btn-magnetic');
        this.init();
    }

    init() {
        this.buttons.forEach(button => {
            button.addEventListener('mousemove', (e) => this.handleMouseMove(e, button));
            button.addEventListener('mouseleave', () => this.handleMouseLeave(button));
        });
    }

    handleMouseMove(e, button) {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        const strength = 0.3;
        button.style.transform = `translate(${x * strength}px, ${y * strength}px) scale(1.05)`;
    }

    handleMouseLeave(button) {
        button.style.transform = 'translate(0, 0) scale(1)';
    }
}

// ============================================
// 5. 3D TILT CARD EFFECT
// ============================================

class TiltCards {
    constructor() {
        this.cards = document.querySelectorAll('.tilt-card');
        this.init();
    }

    init() {
        this.cards.forEach(card => {
            card.addEventListener('mousemove', (e) => this.handleTilt(e, card));
            card.addEventListener('mouseleave', () => this.resetTilt(card));
        });
    }

    handleTilt(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    }

    resetTilt(card) {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    }
}

// ============================================
// 6. ENHANCED SMOOTH SCROLL
// ============================================

class SmoothScroll {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));

                if (target) {
                    window.scrollTo({
                        top: target.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
}

// ============================================
// 7. HEADER BLUR ON SCROLL
// ============================================

class HeaderBlur {
    constructor() {
        this.header = document.querySelector('header');
        this.init();
    }

    init() {
        if (!this.header) return;

        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 50) {
                this.header.classList.add('scrolled', 'glass-enhanced');
            } else {
                this.header.classList.remove('scrolled', 'glass-enhanced');
            }
        }, { passive: true });
    }
}

// ============================================
// 8. COUNTER ANIMATION
// ============================================

class CounterAnimation {
    constructor() {
        this.counters = document.querySelectorAll('.counter');
        this.init();
    }

    init() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        this.counters.forEach(counter => observer.observe(counter));
    }

    animateCounter(element) {
        const target = parseInt(element.dataset.count);
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                element.textContent = Math.floor(current);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        };

        updateCounter();
    }
}

// ============================================
// 9. LAZY IMAGE LOADING
// ============================================

class LazyImageLoader {
    constructor() {
        this.images = document.querySelectorAll('img[data-src]');
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                });
            });

            this.images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback für alte Browser
            this.images.forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }
}

// ============================================
// 10. PERFORMANCE MONITOR
// ============================================

class PerformanceMonitor {
    constructor() {
        this.checkPerformance();
    }

    checkPerformance() {
        // Reduziere Animationen auf Geräten mit schwacher Performance
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
            document.documentElement.classList.add('low-performance');
            console.log('Low performance mode activated');
        }

        // Respektiere Benutzer-Präferenzen
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.classList.add('reduce-motion');
            console.log('Reduced motion mode activated');
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Initializing UNBREAK ONE Advanced Animations...');

    // Performance Check zuerst
    new PerformanceMonitor();

    // Initialisiere alle Effekte
    new ScrollReveal();
    new ParallaxEffect();
    new ScrollProgress();
    new MagneticButtons();
    new TiltCards();
    new SmoothScroll();
    new HeaderBlur();
    new CounterAnimation();
    new LazyImageLoader();

    console.log('✨ All WOW-effects loaded successfully!');

    // Trigger initial reveal for elements already in viewport
    window.dispatchEvent(new Event('scroll'));
});

// Optional: Stagger Animation Helper
function staggerAnimation(elements, delay = 100) {
    elements.forEach((el, index) => {
        el.style.transitionDelay = `${index * delay}ms`;
    });
}

// Export für externe Verwendung
window.UNBREAKAnimations = {
    ScrollReveal,
    ParallaxEffect,
    MagneticButtons,
    TiltCards,
    staggerAnimation
};
