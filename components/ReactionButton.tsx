// components/ReactionButton.tsx
"use client";

import React, { useState, useRef } from "react";
import ReactionPopup from "./ReactionPopup";
import { AnimatePresence } from "framer-motion";

type Props = {
  onReact?: (event: { emoji: string; sessionId?: string | null }) => void;
  className?: string;
};

const ReactionButton: React.FC<Props> = ({
  onReact,
  className
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = (emoji: string) => {
    onReact?.({ emoji, sessionId: null });
    setOpen(false);
  };

  // close popup when clicking outside
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className || ""}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.04)] text-white shadow-sm"
        title="Reactions"
      >
        <span style={{ fontSize: 18 }}>😊</span>
      </button>

      <AnimatePresence>
        {open && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              right: 0
            }}
          >
            <ReactionPopup
              onSelect={handleSelect}
              onClose={() => setOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReactionButton;
