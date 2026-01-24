"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactionPopup from "./ReactionPopup";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  onReact?: (event: { emoji: string; sessionId?: string | null }) => void;
  className?: string;
  sessionId?: string | null; // optional context when reacting to a specific tile
};

const ReactionButton: React.FC<Props> = ({
  onReact,
  className,
  sessionId = null,
}) => {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleSelect = (emoji: string) => {
    console.log("[ReactionButton] handleSelect called with emoji:", emoji);
    console.log("[ReactionButton] Calling onReact with:", { emoji, sessionId });
    onReact?.({ emoji, sessionId });
    setOpen(false);
    setPopupPosition(null);
    // return focus back to trigger for accessibility
    buttonRef.current?.focus();
  };

  // Update popup position when open changes
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    } else {
      setPopupPosition(null);
    }
  }, [open]);

  // close popup when clicking outside or pressing Escape
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;

      // Check if click is inside the container (button)
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // Check if click is inside the popup (rendered via portal)
      const popupElements = document.querySelectorAll(
        '[role="menu"][aria-label="Reactions"]'
      );
      for (const popup of Array.from(popupElements)) {
        if (popup.contains(target)) {
          return;
        }
      }

      // Click is outside, close the popup
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      // Use capture phase to ensure we see the event before other handlers
      document.addEventListener("mousedown", onDoc, true);
      document.addEventListener("keydown", onKey);
    }

    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((s) => !s);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      // focusing handled by popup internally
    }
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Reaction Button */}
      <motion.button
        ref={buttonRef}
        onClick={(e) => {
          console.log("[ReactionButton] button clicked, current open:", open);
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        onKeyDown={onKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open reactions menu"
        title="Reactions"
        whileHover={{
          scale: 1.05,
          transition: { duration: 0.2, ease: "easeOut" },
        }}
        whileTap={{
          scale: 0.95,
          transition: { duration: 0.1 },
        }}
        className={cn(
          "relative p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-300 touch-manipulation",
          "focus:outline-none focus:ring-2 focus:ring-blue-400/70 focus:ring-offset-2 focus:ring-offset-dark-1",
          open
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4 hover:shadow-md"
        )}
        style={{
          boxShadow: open
            ? "0 4px 20px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)"
            : "0 2px 8px rgba(0, 0, 0, 0.2)",
        }}
      >
        {/* Ripple effect on click */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-lg sm:rounded-xl bg-blue-400/40"
              style={{ pointerEvents: "none" }}
            />
          )}
        </AnimatePresence>

        <motion.span
          className="text-lg sm:text-xl relative z-10"
          aria-hidden
          animate={open ? { rotate: [0, -10, 10, 0] } : { rotate: 0 }}
          transition={{ duration: 0.4 }}
        >
          😊
        </motion.span>
      </motion.button>

      {/* Reaction Popup - Rendered via Portal */}
      {open &&
        popupPosition &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: popupPosition.top,
              left: popupPosition.left,
              transform: "translate(-50%, -100%) translateY(-8px)",
              zIndex: 9999,
            }}
            className="pointer-events-auto"
          >
            <ReactionPopup
              onSelect={handleSelect}
              onClose={() => setOpen(false)}
              anchorClassName="min-w-[280px] sm:min-w-[320px]"
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default ReactionButton;
