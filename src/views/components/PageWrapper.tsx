import { motion } from "motion/react";
import React from "react";
import {useIsMobile} from "../../bootstrap";


export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  const variants = {
    initial: isMobile ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: isMobile ? { opacity: 0 } : { opacity: 0, y: -10 },
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeInOut" }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
