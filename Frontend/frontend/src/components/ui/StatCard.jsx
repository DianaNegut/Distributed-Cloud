import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatCard = ({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  trend,
  trendValue,
  color = 'primary',
  delay = 0 
}) => {
  const colors = {
    primary: 'from-primary-600 to-primary-500',
    success: 'from-green-600 to-green-500',
    warning: 'from-yellow-600 to-yellow-500',
    danger: 'from-red-600 to-red-500',
    info: 'from-blue-600 to-blue-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-6 border border-dark-700 shadow-xl"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium mb-2">{title}</p>
          <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
          
          {subtitle && (
            <p className="text-gray-500 text-xs mb-2">{subtitle}</p>
          )}
          
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${
              trend === 'up' ? 'text-green-400' : 'text-red-400'
            }`}>
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-medium">{trendValue}</span>
            </div>
          )}
        </div>
        
        <div className={`w-14 h-14 bg-gradient-to-br ${colors[color]} rounded-xl flex items-center justify-center shadow-lg`}>
          {Icon && <Icon className="w-7 h-7 text-white" />}
        </div>
      </div>
    </motion.div>
  );
};
