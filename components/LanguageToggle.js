/**
 * UNBREAK ONE - Language Toggle Component
 * React component for DE/EN language switching
 * 
 * Usage:
 * <LanguageToggle />
 */

import { useTranslation } from '../lib/i18n/useTranslation';
import { useEffect, useState } from 'react';

export default function LanguageToggle() {
  const { locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or return a placeholder
  }

  const handleLanguageSwitch = (lang) => {
    if (lang === locale) return; // Already active
    
    // Add transition class for smooth UX
    document.body.classList.add('i18n-changing');
    
    setLocale(lang);
    
    // Remove transition class after animation
    setTimeout(() => {
      document.body.classList.remove('i18n-changing');
    }, 150);
  };

  return (
    <div className="language-toggle">
      <button
        onClick={() => handleLanguageSwitch('de')}
        className={locale === 'de' ? 'active' : ''}
        aria-label="Deutsch"
        data-lang="de"
      >
        DE
      </button>
      <span className="separator" aria-hidden="true"></span>
      <button
        onClick={() => handleLanguageSwitch('en')}
        className={locale === 'en' ? 'active' : ''}
        aria-label="English"
        data-lang="en"
      >
        EN
      </button>

      <style jsx>{`
        .language-toggle {
          display: flex;
          align-items: center;
          gap: 0;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 4px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .language-toggle button {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .language-toggle button:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .language-toggle button.active {
          background: rgba(255, 255, 255, 0.25);
          color: white;
          font-weight: 700;
        }

        .language-toggle button:focus {
          outline: 2px solid rgba(255, 255, 255, 0.5);
          outline-offset: 2px;
        }

        .separator {
          width: 1px;
          height: 16px;
          background: rgba(255, 255, 255, 0.3);
        }

        /* Responsive: Compact on mobile */
        @media (max-width: 768px) {
          .language-toggle {
            padding: 3px;
          }

          .language-toggle button {
            padding: 5px 10px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}
