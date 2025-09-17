// components/ScrollRestoration.tsx
import { useEffect, useLayoutEffect, useRef } from "react";

const scrollPositions = new Map<string, number>();

export default function ScrollRestoration() {
  // Since we're not using React Router, we'll use window location
  const path = window.location.pathname + window.location.search;
  const navType = 'PUSH'; // Default navigation type
  const prevPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    return () => {
      if (prevPath.current) {
        scrollPositions.set(prevPath.current, window.scrollY);
      }
    };
  }, [path]);

  useEffect(() => {
    const saved = scrollPositions.get(path);
    // Always scroll to top for Astro routing
    window.scrollTo(0, 0);
    prevPath.current = path;
  }, [path, navType]);

  return null;
}
