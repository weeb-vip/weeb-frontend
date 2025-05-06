// FoxgirlLoader.tsx
import { motion } from "framer-motion";

export default function FoxgirlLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-48 w-48">
      <motion.div
        animate={{
          x: [0, 5, -5, 0],
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
        }}
        className="relative"
      >
        <FoxgirlSVG />
      </motion.div>
      <span className="text-sm mt-2 text-gray-600">Loading...</span>
    </div>
  );
}

function FoxgirlSVG() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Replace this with better art if you want! */}
      <circle cx="48" cy="48" r="45" stroke="#FFA500" strokeWidth="4" fill="#FFDAB9" />
      <text x="48%" y="50%" textAnchor="middle" dy=".3em" fontSize="14" fill="#000">
        🦊
      </text>
    </svg>
  );
}
