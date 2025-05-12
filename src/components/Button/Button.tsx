import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faExclamationCircle,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "motion/react";

export enum ButtonColor {
  blue = "blue",
  red = "red",
  transparent = "transparent",
  none = "none",
}

export type StatusType = "idle" | "loading" | "success" | "error";

interface StatusButtonProps {
  color: ButtonColor;
  label?: string;
  icon?: React.ReactNode; // ← NEW
  onClick: () => void;
  showLabel?: boolean;
  className?: string;
  status?: StatusType;
  onResetStatus?: () => void;
}


export default function StatusButton({
                                       color,
                                       label,
                                       onClick,
                                       showLabel = true,
                                       className,
                                       status,
                                       onResetStatus,
  icon,
                                     }: StatusButtonProps) {
  const [internalStatus, setInternalStatus] = useState<StatusType>("idle");

  useEffect(() => {
    if (!status) return;
    setInternalStatus(status);
    if (status !== "idle") {
      const timeout = setTimeout(() => {
        setInternalStatus("idle");
        onResetStatus?.();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [status, onResetStatus]);

  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    red: "bg-red-600 hover:bg-red-700 text-white",
    transparent:
      "bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-300",
    none: "",
  };

  const iconMap: Record<StatusType, React.ReactNode> = {
    loading: <FontAwesomeIcon icon={faSpinner} spin />,
    success: <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />,
    error: <FontAwesomeIcon icon={faExclamationCircle} className="text-red-500" />,
    idle: null,
  };

  return (
    <div className="relative flex items-center">
      <AnimatePresence mode="wait" initial={false}>
        {status && internalStatus !== "idle" && (
          <motion.div
            key={internalStatus}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0"
          >
            {iconMap[internalStatus]}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onClick}
        disabled={internalStatus === "loading"}
        className={`ml-5 mr-5 px-4 py-1 rounded-full font-medium transition flex items-center justify-center
          ${colorClasses[color]} ${className || ""} ${
          internalStatus === "loading" ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {icon ? icon : showLabel && label && <span>{label}</span>}
      </button>
    </div>
  );
}


export type { StatusButtonProps as ButtonProps };
