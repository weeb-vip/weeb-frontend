import { motion } from "motion/react";
import React from "react";
import {useIsMobile} from "../../bootstrap";
import { useNavigationDirection } from "../../hooks/useNavigationDirection";

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { direction } = useNavigationDirection();

  const variants = React.useMemo(() => {
    if (!isMobile) {
      // Desktop: simple fade animation
      return {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      };
    }

    // Mobile: slide animations based on navigation direction
    if (direction === 'backward') {
      // Coming from left (back navigation)  
      return {
        initial: { x: "-100%", opacity: 1 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 1 },
      };
    } else {
      // Going forward - slide from right
      return {
        initial: { x: "100%", opacity: 1 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 1 },
      };
    }
  }, [isMobile, direction]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ 
        duration: isMobile ? 0.2 : 0.3, 
        ease: [0.23, 1, 0.32, 1], // More aggressive easing for mobile
        type: "tween"
      }}
      variants={variants}
      data-page-wrapper
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: 'inherit', // Ensure background color is inherited
      }}
    >
      {children}
    </motion.div>
  );
}
