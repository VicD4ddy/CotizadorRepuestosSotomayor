import { useState, useEffect } from 'react';

/**
 * Hook para detección responsive de media queries.
 * Usado para condicionar renderizado mobile vs desktop.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/** Shortcut: true cuando la pantalla es < 1024px (móvil/tablet) */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

