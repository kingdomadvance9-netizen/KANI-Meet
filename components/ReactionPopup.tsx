// components/ReactionPopup.tsx
import React from "react";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`
    rounded-2xl px-3 py-2 
    backdrop-blur-sm bg-[rgba(30,30,30,0.9)]
    shadow-xl 
    flex flex-wrap gap-2        /* <-- wrap icons safely */
    max-w-full                  /* <-- prevent overflow */
    ${anchorClassName || ""}
  `}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Reactions"
    >
      {emojis.map((e) => (
        <button
          key={e}
          onClick={() => {
            onSelect(e);
            onClose?.();
          }}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
        >
          {e}
        </button>
      ))}
    </motion.div>
  );
};

export default ReactionPopup;
