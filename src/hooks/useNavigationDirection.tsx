import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type NavigationDirection = 'forward' | 'backward';

interface NavigationDirectionContextType {
  direction: NavigationDirection;
}

const NavigationDirectionContext = createContext<NavigationDirectionContextType>({
  direction: 'forward',
});

export const useNavigationDirection = () => {
  return useContext(NavigationDirectionContext);
};

interface NavigationDirectionProviderProps {
  children: React.ReactNode;
}

export const NavigationDirectionProvider: React.FC<NavigationDirectionProviderProps> = ({
  children,
}) => {
  const location = useLocation();
  const [direction, setDirection] = useState<NavigationDirection>('forward');
  const historyStack = useRef<string[]>([]);
  const isPopState = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      isPopState.current = true;
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    if (isPopState.current) {
      // This is a back/forward browser navigation
      setDirection('backward');
      isPopState.current = false;
      
      // Remove pages from history if going back
      const currentIndex = historyStack.current.indexOf(currentPath);
      if (currentIndex !== -1) {
        historyStack.current = historyStack.current.slice(0, currentIndex + 1);
      }
    } else {
      // This is a programmatic navigation (forward)
      setDirection('forward');
      
      // Add to history stack only if it's not already the last item
      if (historyStack.current[historyStack.current.length - 1] !== currentPath) {
        historyStack.current.push(currentPath);
        
        // Keep stack manageable
        if (historyStack.current.length > 20) {
          historyStack.current = historyStack.current.slice(-20);
        }
      }
    }
  }, [location]);

  return (
    <NavigationDirectionContext.Provider value={{ direction }}>
      {children}
    </NavigationDirectionContext.Provider>
  );
};