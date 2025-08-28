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
  const isMobile = useIsMobile();

  const showToast = useCallback((toastData: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Date.now().toString() + Math.random().toString(36);
    const newToast: ToastProps = {
      ...toastData,
      id,
      onClose: removeToast,
    };
    
    // On mobile, only show one toast at a time
    if (isMobile) {
      setToasts([newToast]);
    } else {
      setToasts(prev => [...prev, newToast]);
    }
  }, [isMobile]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      
      {/* Mobile Toast - Sticky header style */}
      {isMobile && toasts.map(toast => (
        <MobileToast key={toast.id} {...toast} />
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