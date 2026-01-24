// components/ReactionPopup.tsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  emojis?: string[];
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  anchorClassName?: string;
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    // Auto-focus first emoji for keyboard accessibility
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
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.92 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        mass: 0.8,
      }}
      className={`
        relative
        rounded-2xl sm:rounded-3xl
        px-3 sm:px-4
        py-3 sm:py-3.5
        backdrop-blur-xl
        bg-gradient-to-br from-dark-2/98 via-dark-2/95 to-dark-3/98
        border border-white/[0.08]
        shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)]
        flex flex-wrap gap-2 sm:gap-2.5
        max-w-full
        ${anchorClassName || ""}
      `}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Reactions"
      ref={gridRef}
      onKeyDown={onKeyDown}
      style={{
        // Glassmorphism effect
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0 rounded-2xl sm:rounded-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03), transparent 70%)",
        }}
      />

      {emojis.map((emoji, i) => (
        <motion.button
          key={emoji}
          ref={(el) => {
            btnsRef.current[i] = el;
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(emoji);
            onClose?.();
          }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          whileHover={{
            scale: 1.15,
            rotate: [0, -5, 5, 0],
            transition: {
              scale: { duration: 0.2, ease: "easeOut" },
              rotate: { duration: 0.4, ease: "easeInOut" },
            },
          }}
          whileTap={{
            scale: 0.9,
            transition: { duration: 0.1 },
          }}
          className={`
            relative
            w-10 h-10 sm:w-12 sm:h-12
            rounded-xl sm:rounded-2xl
            flex items-center justify-center
            text-2xl sm:text-3xl
            transition-all duration-200
            focus:outline-none
            touch-manipulation
            ${
              hoveredIndex === i
                ? "bg-dark-3/80 shadow-lg"
                : "bg-dark-3/40 hover:bg-dark-3/70"
            }
          `}
          aria-label={`React with ${emoji}`}
          role="menuitem"
          style={{
            boxShadow:
              hoveredIndex === i
                ? "0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                : "0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
        >
          {/* Focus ring */}
          <div
            className={`
              absolute inset-0 rounded-xl sm:rounded-2xl
              ring-2 ring-blue-400/70 ring-offset-2 ring-offset-dark-2
              opacity-0 focus-visible:opacity-100
              transition-opacity duration-200
            `}
          />

          {/* Ripple effect on hover */}
          <AnimatePresence>
            {hoveredIndex === i && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0 rounded-xl sm:rounded-2xl bg-white/20"
                style={{ pointerEvents: "none" }}
              />
            )}
          </AnimatePresence>

          <span className="relative z-10">{emoji}</span>
        </motion.button>
      ))}
    </motion.div>
  );
};

export default ReactionPopup;
