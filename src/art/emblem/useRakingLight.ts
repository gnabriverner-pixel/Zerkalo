import { useEffect, useRef } from 'react';

interface UseRakingLightOptions {
  enabled?: boolean;
  maxOffsetPx?: number;
}

export function useRakingLight<T extends HTMLElement = HTMLDivElement>(
  options: UseRakingLightOptions = {}
) {
  const elementRef = useRef<T>(null);
  const { enabled = true, maxOffsetPx = 12 } = options;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      if (elementRef.current) {
        elementRef.current.style.setProperty('--zk-lx', '0px');
        elementRef.current.style.setProperty('--zk-ly', '0px');
      }
      return;
    }

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const el = elementRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalized coordinates (-1 to 1)
      const nx = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2 || 1)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2 || 1)));

      targetX = nx * maxOffsetPx;
      targetY = ny * maxOffsetPx;

      if (!rafId) {
        rafId = requestAnimationFrame(updateLight);
      }
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!rafId) {
        rafId = requestAnimationFrame(updateLight);
      }
    };

    const updateLight = () => {
      // Smooth lerp (0.1)
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      if (elementRef.current) {
        elementRef.current.style.setProperty('--zk-lx', `${currentX.toFixed(2)}px`);
        elementRef.current.style.setProperty('--zk-ly', `${currentY.toFixed(2)}px`);
      }

      const diff = Math.abs(targetX - currentX) + Math.abs(targetY - currentY);
      if (diff > 0.05) {
        rafId = requestAnimationFrame(updateLight);
      } else {
        rafId = null;
      }
    };

    const el = elementRef.current;
    if (el) {
      el.addEventListener('pointermove', handlePointerMove);
      el.addEventListener('pointerleave', handlePointerLeave);
    }

    return () => {
      if (el) {
        el.removeEventListener('pointermove', handlePointerMove);
        el.removeEventListener('pointerleave', handlePointerLeave);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, maxOffsetPx]);

  return elementRef;
}
