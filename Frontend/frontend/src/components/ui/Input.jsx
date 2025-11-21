import React from 'react';

export const Input = ({ 
  label, 
  error, 
  icon: Icon,
  className = '',
  ...props 
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          className={`
            w-full
            ${Icon ? 'pl-10' : 'pl-4'}
            pr-4 py-3
            bg-dark-800 
            border border-dark-600
            rounded-xl
            text-white
            placeholder-gray-500
            focus:outline-none
            focus:ring-2
            focus:ring-primary-500
            focus:border-transparent
            transition-all duration-200
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};

export const TextArea = ({ 
  label, 
  error, 
  className = '',
  rows = 4,
  ...props 
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`
          w-full
          px-4 py-3
          bg-dark-800 
          border border-dark-600
          rounded-xl
          text-white
          placeholder-gray-500
          focus:outline-none
          focus:ring-2
          focus:ring-primary-500
          focus:border-transparent
          transition-all duration-200
          resize-none
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};
