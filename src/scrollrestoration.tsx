// components/ScrollRestoration.tsx
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const scrollPositions = new Map<string, number>();

export default function ScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const path = location.pathname + location.search;
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
    if (navType === "POP" && saved !== undefined) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    } else {
      window.scrollTo(0, 0);
    }
    prevPath.current = path;
  }, [path, navType]);

  return null;
}
