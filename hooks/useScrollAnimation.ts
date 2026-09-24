'use client';

import { useEffect, useRef } from 'react';

export interface ScrollAnimationOptions {
  threshold?: number; // default: 0.1
  staggerDelay?: number; // default: 100ms (range: 80-120ms)
  duration?: number; // default: 500ms (range: 400-600ms)
  translateY?: number; // default: 24px (range: 20-30px)
}

/**
 * Reveals all [data-animate] children immediately (no animation).
 * Used for reduced-motion, fallback, and error recovery.
 */
function revealAll(container: HTMLElement | null): void {
  if (!container) return;
  const children = container.querySelectorAll<HTMLElement>('[data-animate]');
  children.forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.willChange = 'auto';
  });
}

/**
 * Wraps animation logic in a try/catch to prevent runtime errors from
 * breaking the page. On failure, reveals all content immediately.
 */
function safeAnimate(
  container: HTMLElement | null,
  options: ScrollAnimationOptions
): void {
  if (!container) return;
  try {
    animateChildren(container, options);
  } catch {
    // On any error, make content visible immediately
    revealAll(container);
  }
}

/**
 * Applies staggered fade-in + translateY animation to all [data-animate]
 * children within the container. Uses only GPU-composited properties
 * (transform, opacity) for performance.
 */
function animateChildren(
  container: HTMLElement,
  options: ScrollAnimationOptions
): void {
  const {
    staggerDelay = 100,
    duration = 500,
    translateY = 24,
  } = options;

  const children = container.querySelectorAll<HTMLElement>('[data-animate]');

  children.forEach((el, index) => {
    // Apply will-change hint before animation starts
    el.style.willChange = 'transform, opacity';

    // Set initial hidden state
    el.style.opacity = '0';
    el.style.transform = `translateY(${translateY}px)`;

    // Configure transition
    const delay = index * staggerDelay;
    el.style.transition = `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`;

    // Trigger animation on next frame to ensure initial styles are applied
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });

    // Remove will-change after animation completes to free GPU memory
    const totalTime = delay + duration;
    setTimeout(() => {
      el.style.willChange = 'auto';
    }, totalTime + 50); // small buffer after animation ends
  });
}

/**
 * Custom React hook that manages IntersectionObserver-based scroll animations.
 *
 * Returns a ref to attach to the container element. Children with the
 * `data-animate` attribute will be animated with a staggered fade-in +
 * translateY effect when the container first enters the viewport.
 *
 * Respects `prefers-reduced-motion` by revealing content immediately.
 * Fires only once per element (single-fire behavior).
 * Includes error boundary that reveals content on failure.
 */
export function useScrollAnimation(options: ScrollAnimationOptions = {}) {
  const containerRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion || hasAnimated.current) {
      revealAll(container);
      return;
    }

    // Check for IntersectionObserver support (graceful degradation)
    if (typeof IntersectionObserver === 'undefined') {
      revealAll(container);
      return;
    }

    // Set initial hidden state for children before observer fires
    const children = container.querySelectorAll<HTMLElement>('[data-animate]');
    children.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = `translateY(${options.translateY ?? 24}px)`;
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          safeAnimate(container, options);
          observer.disconnect();
        }
      },
      { threshold: options.threshold ?? 0.1 }
    );

    observer.observe(container);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return containerRef;
}
