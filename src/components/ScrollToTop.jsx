// src/components/ScrollToTop.jsx (FINAL — Targets the real scrolling element)
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // Disable browser native restoration (prevents interference)
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Primary: Scroll the <main> element (your flex-grow container)
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }

    // Fallback: Also try window and documentElement (covers standard cases)
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    console.log('[ScrollToTop] Scrolled to top for:', pathname);
  }, [pathname]);

  return null;
}