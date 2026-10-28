import { useReducedMotion, Variants } from 'framer-motion';

export const smoothTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

export function useEntrance(): Variants {
  const reducedMotion = useReducedMotion();
  return {
    hidden: { opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: reducedMotion ? { duration: 0 } : smoothTransition },
  };
}
