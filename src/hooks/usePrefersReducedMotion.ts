import { useEffect, useState } from 'react';

/**
 * Returns true if the user has requested reduced motion via OS preferences.
 * Uses window.matchMedia directly so it does not rely on motion/react mocks in testing.
 */
export function usePrefersReducedMotion(): boolean {
  const [shouldReduce, setShouldReduce] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldReduce(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setShouldReduce(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    } else if ('addListener' in mediaQuery) {
      (mediaQuery as any).addListener(onChange);
      return () => (mediaQuery as any).removeListener(onChange);
    }
  }, []);

  return shouldReduce;
}
