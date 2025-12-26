/**
 * UNBREAK ONE - Motion & Animations
 * GSAP-powered entrance & scroll reveals (Progressive Enhancement)
 */

(function() {
  'use strict';
  
  // ===================================
  // REDUCED MOTION DETECTION
  // ===================================
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // ===================================
  // WAIT FOR GSAP & DOM
  // ===================================
  function initMotion() {
    // Check if GSAP is loaded
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not loaded - animations disabled');
      return;
    }
    
    // Register ScrollTrigger if available
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }
    
    // If reduced motion, disable all animations
    if (prefersReducedMotion) {
      console.log('Reduced motion preferred - minimal animations');
      gsap.config({ 
        nullTargetWarn: false,
        duration: 0.01 
      });
      return; // Exit early - no animations
    }
    
    // Run animations
    heroEntrance();
    scrollReveals();
    headerScrollEffect();
    setupModal();
  }
  
  // ===================================
  // HERO ENTRANCE ANIMATION
  // ===================================
  function heroEntrance() {
    const hero = document.querySelector('.hero-content');
    if (!hero) return;
    
    const h1 = hero.querySelector('h1');
    const subtitle = hero.querySelector('p');
    const features = hero.querySelectorAll('ul li');
    const buttons = hero.querySelectorAll('.btn');
    const badge = hero.querySelector('.badge-mig');
    
    // Set initial states
    gsap.set([h1, subtitle, features, buttons, badge], {
      opacity: 0,
      y: 30
    });
    
    // Create timeline
    const tl = gsap.timeline({ 
      defaults: { 
        ease: 'power3.out',
        duration: 0.8
      }
    });
    
    tl.to(badge, { opacity: 1, y: 0, duration: 0.6 }, 0.2)
      .to(h1, { opacity: 1, y: 0 }, 0.4)
      .to(subtitle, { opacity: 1, y: 0, duration: 0.7 }, 0.6)
      .to(features, { 
        opacity: 1, 
        y: 0,
        stagger: 0.12,
        duration: 0.6
      }, 0.8)
      .to(buttons, { 
        opacity: 1, 
        y: 0,
        stagger: 0.15,
        duration: 0.6
      }, 1.0);
  }
  
  // ===================================
  // SCROLL-TRIGGERED REVEALS
  // ===================================
  function scrollReveals() {
    if (typeof ScrollTrigger === 'undefined') return;
    
    // Reveal all sections except hero
    const sections = document.querySelectorAll('section:not(.hero)');
    
    sections.forEach((section) => {
      // Check if section has content
      if (!section.children.length) return;
      
      gsap.from(section, {
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
          end: 'top 60%',
          toggleActions: 'play none none none',
          once: true
        },
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power2.out'
      });
    });
    
    // Reveal product cards with stagger
    const productCards = document.querySelectorAll('.product-card');
    if (productCards.length > 0) {
      gsap.from(productCards, {
        scrollTrigger: {
          trigger: productCards[0],
          start: 'top 85%',
          once: true
        },
        opacity: 0,
        y: 30,
        stagger: 0.15,
        duration: 0.7,
        ease: 'power2.out'
      });
    }
  }
  
  // ===================================
  // HEADER SCROLL EFFECT
  // ===================================
  function headerScrollEffect() {
    const header = document.querySelector('header');
    if (!header) return;
    
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      
      if (currentScroll > 100) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      
      lastScroll = currentScroll;
    }, { passive: true });
  }
  
  // ===================================
  // MODAL OVERLAY (CONFIGURATOR)
  // ===================================
  function setupModal() {
    const modalOverlay = document.getElementById('configurator-modal');
    const modalClose = document.querySelector('.modal-close');
    const modalIframe = document.querySelector('.modal-iframe');
    const ctaButtons = document.querySelectorAll('a[href="configurator.html"]');
    
    // BUG B FIX: Direct Vercel URL (no homepage header)
    const CONFIGURATOR_URL = 'https://unbreak-3-d-konfigurator.vercel.app/';
    
    if (!modalOverlay || !modalClose || !modalIframe) return;
    
    // Open modal
    function openModal(e) {
      e.preventDefault();
      
      // Set iframe src to direct Vercel URL
      modalIframe.src = CONFIGURATOR_URL;
      
      // Show modal
      modalOverlay.classList.add('active');
      document.body.classList.add('modal-open');
      
      // Focus trap
      modalClose.focus();
    }
    
    // Close modal
    function closeModal() {
      modalOverlay.classList.remove('active');
      document.body.classList.remove('modal-open');
      
      // Clear iframe (stop any videos/animations)
      setTimeout(() => {
        modalIframe.src = '';
      }, 300);
    }
    
    // Event listeners
    ctaButtons.forEach(btn => {
      btn.addEventListener('click', openModal);
    });
    
    modalClose.addEventListener('click', closeModal);
    
    // Close on backdrop click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
      }
    });
  }
  
  // ===================================
  // INITIALIZE ON DOM READY
  // ===================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMotion);
  } else {
    initMotion();
  }
  
})();
