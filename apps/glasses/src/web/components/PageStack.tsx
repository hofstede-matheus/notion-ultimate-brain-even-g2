import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { NavDirection } from '../providers/uiController';

interface PageStackProps {
  /** Identifies the visible screen; a change triggers the push/pop slide. */
  screenKey: string;
  /** 'forward' pushes in from the right; 'back' pops out to the right. */
  direction: NavDirection;
  children: ReactNode;
}

// iOS-style ease (fast out, gentle settle) and a subtle parallax for the
// page that stays behind — it drifts a quarter-width, not fully off-screen.
const EASE = [0.32, 0.72, 0, 1] as const;
const PARALLAX = '-25%';

const variants = {
  enter: (dir: NavDirection) => ({ x: dir === 'forward' ? '100%' : PARALLAX }),
  center: { x: '0%' },
  exit: (dir: NavDirection) => ({ x: dir === 'forward' ? PARALLAX : '100%' }),
};

/**
 * Generic iOS-style page container: swapping `screenKey` slides the incoming
 * screen in from the right while the outgoing one parallaxes left (reversed on
 * 'back'). Honors the OS "reduce motion" setting with an instant swap. Reusable
 * for any future page beyond settings.
 */
export function PageStack({ screenKey, direction, children }: PageStackProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative h-full overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={screenKey}
          custom={direction}
          variants={reduceMotion ? undefined : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0 : 0.32, ease: EASE }}
          className="absolute inset-0 overflow-y-auto px-3"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
