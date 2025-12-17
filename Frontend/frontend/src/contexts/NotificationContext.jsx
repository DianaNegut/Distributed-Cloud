import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info',
      duration: 5000,
      ...notification
    };
    
    setNotifications(prev => [...prev, newNotification]);

    if (newNotification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const notify = {
    success: (message, options = {}) => addNotification({ ...options, type: 'success', message }),
    error: (message, options = {}) => addNotification({ ...options, type: 'error', message }),
    warning: (message, options = {}) => addNotification({ ...options, type: 'warning', message }),
    info: (message, options = {}) => addNotification({ ...options, type: 'info', message })
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, notify }}>
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
};

const NotificationContainer = ({ notifications, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      <AnimatePresence>
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={() => onClose(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const Notification = ({ notification, onClose }) => {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const colors = {
    success: 'from-green-600 to-green-500',
    error: 'from-red-600 to-red-500',
    warning: 'from-yellow-600 to-yellow-500',
    info: 'from-blue-600 to-blue-500'
  };

  const Icon = icons[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`bg-gradient-to-r ${colors[notification.type]} rounded-xl shadow-xl p-4 flex items-start gap-3 max-w-md`}
    >
      <Icon className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
      
      <div className="flex-1 min-w-0">
        {notification.title && (
          <h4 className="text-white font-semibold mb-1">{notification.title}</h4>
        )}
        <p className="text-white text-sm">{notification.message}</p>
      </div>

      <button
        onClick={onClose}
        className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export default NotificationProvider;

