import React from 'react';
import { motion, Variants } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  delay?: number;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  animate = true,
  delay = 0
}) => {
  if (!animate) {
    return (
      <div className={`bg-light-surface rounded-lg shadow-md p-6 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={`bg-light-surface rounded-lg shadow-md p-6 ${className}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
};

export default Card;