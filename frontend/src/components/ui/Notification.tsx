'use client';

import { useState, useEffect } from 'react';

interface NotificationProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // in milliseconds
  onClose?: () => void;
}

export function Notification({ 
  message, 
  type = 'info', 
  duration = 3000, 
  onClose 
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  // Auto-hide notification after duration
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);
  
  // Type-based styling
  const typeStyles = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };
  
  const notificationClasses = `
    fixed top-4 right-4
    px-4 py-3
    rounded-lg
    text-white
    shadow-lg
    flex items-center
    justify-between
    z-50
    transition-opacity duration-300
    ${typeStyles[type]}
    ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
  `;
  
  return (
    <div className={notificationClasses}>
      <span>{message}</span>
      <button 
        className="ml-4 text-white hover:text-gray-200"
        onClick={() => {
          setIsVisible(false);
          if (onClose) onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}