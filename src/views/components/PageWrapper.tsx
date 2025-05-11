import { motion } from "framer-motion";
import React from "react";
import {useIsMobile} from "../../bootstrap";


export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  const variants = {
    initial: isMobile ? { x: "100%", opacity: 0 } : { opacity: 0, y: 10 },
    animate: { x: 0, y: 0, opacity: 1 },
    exit: isMobile ? { x: "-100%", opacity: 0 } : { opacity: 0, y: -10 },
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
