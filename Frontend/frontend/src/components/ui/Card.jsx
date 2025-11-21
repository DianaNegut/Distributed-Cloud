import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', hover = true, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : {}}
      className={`bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl shadow-xl border border-dark-700 backdrop-blur-lg ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-b border-dark-700 ${className}`}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '', icon: Icon }) => {
  return (
    <h3 className={`text-xl font-bold text-white flex items-center gap-3 ${className}`}>
      {Icon && <Icon className="w-6 h-6 text-primary-400" />}
      {children}
    </h3>
  );
};

export const CardContent = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-t border-dark-700 ${className}`}>
      {children}
    </div>
  );
};
