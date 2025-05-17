import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  none = "",
}

export type StatusType = "idle" | "loading" | "success" | "error";

interface StatusButtonProps {
  color: ButtonColor;
  label?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  showLabel?: boolean;
  className?: string;
  status?: StatusType;
  onResetStatus?: () => void;
}

export default function StatusButton({
                                       color,
                                       label,
                                       icon,
                                       onClick,
                                       showLabel = true,
                                       className,
                                       status,
                                       onResetStatus,
                                     }: StatusButtonProps) {
  const [internalStatus, setInternalStatus] = useState<StatusType>("idle");
  const [buttonSize, setButtonSize] = useState<{ width: number; height: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (buttonRef.current && !buttonSize) {
      const { width, height } = buttonRef.current.getBoundingClientRect();
      setButtonSize({ width, height });
    }
  }, [buttonRef, buttonSize]);

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
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={internalStatus === "loading"}
      className={`
      px-4 py-1
        relative rounded-full font-medium transition flex items-center justify-center whitespace-nowrap
        ${colorClasses[color]} ${className || ""} ${
        internalStatus === "loading" ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      style={
        buttonSize
          ? { width: `${buttonSize.width}px`, height: `${buttonSize.height}px` }
          : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {internalStatus === "idle" ? (
          <motion.div
            key="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center"
          >
            {icon ? icon : showLabel && label && <span>{label}</span>}
          </motion.div>
        ) : (
          <motion.div
            key={internalStatus}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center"
          >
            {iconMap[internalStatus]}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

export type { StatusButtonProps as ButtonProps };
