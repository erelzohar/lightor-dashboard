import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * LT-512: the heading's words slide in from behind a cut (danielpetho's
 * vertical-cut-reveal, from 21st.dev), adapted for the dashboard.
 *
 * What changed from the original: words only. Its character split breaks a
 * right-to-left word into separate boxes, so Hebrew and Arabic lose their
 * joining, and the plans heading needs nothing else.
 */
interface VerticalCutRevealProps {
  children: string;
  staggerDuration?: number;
  className?: string;
}

export const VerticalCutReveal: React.FC<VerticalCutRevealProps> = ({ children, staggerDuration = 0.15, className }) => {
  const words = children.split(' ');
  return (
    <span className={cn('flex flex-wrap', className)}>
      <span className="sr-only">{children}</span>
      {words.map((word, index) => (
        <span key={index} aria-hidden="true" className="inline-flex overflow-hidden whitespace-pre-wrap pb-0.5">
          <motion.span
            className="inline-block"
            initial={{ y: '-110%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 40, delay: index * staggerDuration }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 && <span> </span>}
        </span>
      ))}
    </span>
  );
};
