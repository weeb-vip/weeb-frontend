import React, { useEffect, useRef, useState } from "react";
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
  onClick?: () => void;
  showLabel?: boolean;
  className?: string;
  status?: StatusType;
  onResetStatus?: () => void;

  /** NEW: explicitly disable the button (also disabled while loading) */
  disabled?: boolean;
  /** NEW: forward native type so this can be a submit button in forms */
  type?: "button" | "submit" | "reset";
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
                                       disabled = false,
                                       type = "button",
                                     }: StatusButtonProps) {
  const [internalStatus, setInternalStatus] = useState<StatusType>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const isDisabled = disabled || internalStatus === "loading";

  // Freeze hover styles when disabled and keep base tone
  const colorClasses = {
    blue: isDisabled
      ? "bg-blue-600 text-white disabled:opacity-60"
      : "bg-blue-600 hover:bg-blue-700 text-white",
    red: isDisabled
      ? "bg-red-600 text-white disabled:opacity-60"
      : "bg-red-600 hover:bg-red-700 text-white",
    transparent: isDisabled
      ? "bg-transparent text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 disabled:opacity-60"
      : "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600",
    none: "",
  };

  const iconMap: Record<StatusType, React.ReactNode> = {
    loading: <FontAwesomeIcon icon={faSpinner} spin />,
    success: <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />,
    error: <FontAwesomeIcon icon={faExclamationCircle} className="text-red-500" />,
    idle: null,
  };

  const handleClick = () => {
    if (isDisabled) return; // hard guard: ignore clicks while disabled/loading
    onClick?.();
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={internalStatus === "loading"}
      className={`
        px-4 py-2 relative rounded-full font-medium transition-colors duration-300
        flex items-center justify-center whitespace-nowrap w-fit
        ${colorClasses[color]}
        ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}
        disabled:pointer-events-none
        ${className || ""}
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={internalStatus}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
        >
          {internalStatus === "idle"
            ? icon || (showLabel && label && <span>{label}</span>)
            : iconMap[internalStatus]}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

export type { StatusButtonProps as ButtonProps };
