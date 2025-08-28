import { motion } from "motion/react";
import React from "react";
import {useIsMobile} from "../../bootstrap";
import { useNavigationDirection } from "../../hooks/useNavigationDirection";

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { direction } = useNavigationDirection();

  const getVariants = () => {
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
        initial: { x: "-100%", opacity: 0.8 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0.8 },
      };
    } else {
      // Going forward or replace - slide from right
      return {
        initial: { x: "100%", opacity: 0.8 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 0.8 },
      };
    }
  };

  const variants = getVariants();

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ 
        duration: isMobile ? 0.25 : 0.3, 
        ease: [0.4, 0, 0.2, 1], // Custom easing for smoother transitions
        opacity: { duration: isMobile ? 0.15 : 0.2 } // Faster opacity transition to reduce flashing
      }}
      variants={variants}
      data-page-wrapper
      style={{
        // Ensure proper stacking and prevent layout shifts
        position: 'relative',
        zIndex: 1,
        minHeight: '100%',
        width: '100%',
      }}
    >
      {children}
    </motion.div>
  );
}
