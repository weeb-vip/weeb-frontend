import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastProps } from './Toast';
import MobileToast from './MobileToast';
import { useIsMobile } from '../../bootstrap';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [mobileQueue, setMobileQueue] = useState<ToastProps[]>([]);
  const isMobile = useIsMobile();

  const showToast = useCallback((toastData: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Date.now().toString() + Math.random().toString(36);
    const newToast: ToastProps = {
      ...toastData,
      id,
      onClose: removeToast,
    };

    if (isMobile) {
      // On mobile, queue toasts and show them one at a time
      setMobileQueue(prev => [...prev, newToast]);

      // If no toast is currently showing, start showing this one
      setToasts(prev => {
        if (prev.length === 0) {
          return [newToast];
        }
        return prev; // Keep current toast, new one is queued
      });
    } else {
      // On desktop, show all toasts simultaneously
      setToasts(prev => [...prev, newToast]);
    }
  }, [isMobile]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));

    if (isMobile) {
      // Remove from queue as well
      setMobileQueue(prev => {
        const updatedQueue = prev.filter(toast => toast.id !== id);

        // If there are more toasts in queue, show the next one
        if (updatedQueue.length > 0) {
          const nextToast = updatedQueue[0];
          setToasts([nextToast]);
        }

        return updatedQueue;
      });
    }
  }, [isMobile]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      
      {/* Mobile Toast - Sticky header style */}
      {isMobile && toasts.map(toast => (
        <div key={toast.id} className="relative">
          <MobileToast {...toast} />
          {/* Queue indicator - show if there are more toasts waiting */}
          {mobileQueue.length > 1 && (
            <div className="fixed top-[8.5rem] right-4 z-40">
              <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg">
                +{mobileQueue.length - 1} more
              </div>
            </div>
          )}
        </div>
      ))}
      
      {/* Desktop Toast Container - Fixed positioning for desktop */}
      {!isMobile && (
        <div className="fixed top-28 right-6 z-30 flex flex-col items-end pointer-events-none">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast {...toast} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};