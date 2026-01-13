// components/ReactionPopup.tsx
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

type Props = {
  emojis?: string[];
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  anchorClassName?: string; // for custom styling
};

const DEFAULT_EMOJIS = ["❤️", "😂", "👍", "👏", "🎉", "😮", "🔥", "😢", "🎈"];

const ReactionPopup: React.FC<Props> = ({
  emojis = DEFAULT_EMOJIS,
  onSelect,
  onClose,
  anchorClassName,
}) => {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const btnsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // focus first button when mounted
    btnsRef.current[0]?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = btnsRef.current.findIndex((b) => b === document.activeElement);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % btnsRef.current.length;
      btnsRef.current[next]?.focus();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (idx - 1 + btnsRef.current.length) % btnsRef.current.length;
      btnsRef.current[next]?.focus();
    }
    if (e.key === "Escape") {
      onClose?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`rounded-xl sm:rounded-2xl px-2 sm:px-3 py-2 sm:py-2.5 backdrop-blur-md bg-dark-2/95 border border-white/10 shadow-2xl flex flex-wrap gap-1.5 sm:gap-2 max-w-full ${
        anchorClassName || ""
      }`}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Reactions"
      ref={gridRef}
      onKeyDown={onKeyDown}
    >
      {emojis.map((emoji, i) => (
        <button
          key={emoji}
          ref={(el) => (btnsRef.current[i] = el)}
          onClick={(e) => {
            console.log("[ReactionPopup] Emoji clicked:", emoji);
            e.stopPropagation();
            onSelect(emoji);
            onClose?.();
          }}
          onMouseDown={(e) => {
            console.log("[ReactionPopup] Emoji mousedown:", emoji);
          }}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-dark-3/50 hover:bg-dark-3 flex items-center justify-center text-xl sm:text-2xl transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400/50 touch-manipulation"
          aria-label={`React ${emoji}`}
          role="menuitem"
        >
          {emoji}
        </button>
      ))}
    </motion.div>
  );
};

export default ReactionPopup;
