import React from 'react';
import { motion } from 'framer-motion';

const variants = {
  success: 'bg-green-500/20 text-green-400 border-green-500/50',
  error: 'bg-red-500/20 text-red-400 border-red-500/50',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  default: 'bg-dark-700 text-gray-300 border-dark-600',
};

export const Badge = ({ children, variant = 'default', className = '', animate = true }) => {
  const Component = animate ? motion.span : 'span';
  const animationProps = animate ? {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.2 }
  } : {};

  return (
    <Component
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1 rounded-full
        text-xs font-semibold
        border
        ${variants[variant]}
        ${className}
      `}
      {...animationProps}
    >
      {children}
    </Component>
  );
};
