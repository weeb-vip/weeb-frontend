import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type NavigationDirection = 'forward' | 'backward' | 'replace';

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
  const locationHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Initialize with the first page
    if (!initializedRef.current) {
      initializedRef.current = true;
      locationHistoryRef.current = [currentPath];
      historyIndexRef.current = 0;
      setDirection('forward');
      return;
    }

    const history = locationHistoryRef.current;
    const currentIndex = historyIndexRef.current;
    
    // Check if we're going back to a previous page in our history
    const previousIndex = history.indexOf(currentPath);
    
    if (previousIndex !== -1 && previousIndex < currentIndex) {
      // This is a backward navigation
      setDirection('backward');
      historyIndexRef.current = previousIndex;
    } else if (history[currentIndex] === currentPath) {
      // Same page, likely a replace or initial load
      setDirection('replace');
    } else {
      // This is a forward navigation
      setDirection('forward');
      
      // Add new page to history, removing any forward history
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(currentPath);
      locationHistoryRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      
      // Keep history manageable (limit to last 15 pages)
      if (locationHistoryRef.current.length > 15) {
        locationHistoryRef.current = locationHistoryRef.current.slice(-15);
        historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
      }
    }
  }, [location]);

  // Listen to browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      // This will trigger a location change, which will be handled by the effect above
      // The popstate event itself indicates browser back/forward navigation
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <NavigationDirectionContext.Provider value={{ direction }}>
      {children}
    </NavigationDirectionContext.Provider>
  );
};