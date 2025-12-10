// components/ReactionOverlayLayer.tsx
import React, {
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export type ReactionEvent = {
  id?: string; // optional unique id
  emoji: string;
  sessionId?: string | null; // if null/undefined -> global center
};

type OverlayItem = ReactionEvent & { key: string; createdAt: number; };

type ReactionOverlayLayerHandle = {
  showReaction: (ev: ReactionEvent) => void;
};

const DEFAULT_LIFETIME = 1800; // ms

const findTargetRect = (sessionId?: string | null): DOMRect | null => {
  if (!sessionId) return null;
  const el = document.querySelector(`[data-session-id="${sessionId}"]`) as HTMLElement | null;
  if (!el) return null;
  return el.getBoundingClientRect();
};

const getViewportCenterRect = () => {
  return {
    left: window.innerWidth / 2 - 120,
    top: window.innerHeight / 2 - 80,
    width: 240,
    height: 160,
  } as DOMRect;
};

const ReactionOverlayLayer = forwardRef<ReactionOverlayLayerHandle, { lifetime?: number; zIndex?: number }>(
  ({ lifetime = DEFAULT_LIFETIME, zIndex = 9999 }, ref) => {
    const [items, setItems] = useState<OverlayItem[]>([]);
    const idCounter = useRef(0);

    useImperativeHandle(ref, () => ({
      showReaction: (ev: ReactionEvent) => {
        const key = `${Date.now()}-${++idCounter.current}`;
        setItems((s) => [...s, { ...ev, key, createdAt: Date.now() }]);
      },
    }), []);

    // auto cleanup
    useEffect(() => {
      const t = setInterval(() => {
        const now = Date.now();
        setItems((s) => s.filter(item => now - item.createdAt < lifetime + 500));
      }, 1000);
      return () => clearInterval(t);
    }, [lifetime]);

    if (typeof document === "undefined") return null;

    return createPortal(
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex,
        }}
      >
        <AnimatePresence>
          {items.map((it) => {
            // compute target position: if sessionId exists, target rect near participant tile center
            let rect = findTargetRect(it.sessionId) ?? (getViewportCenterRect() as any);

            // random jitter so multiple emojis don't overlap exactly
            const jitterX = (Math.random() - 0.5) * Math.min(120, rect.width / 2);
            const startX = rect.left + rect.width / 2 + jitterX;
            const startY = rect.top + rect.height / 2 + (Math.random() * 20 - 10);

            const floatId = it.key;

            return (
              <motion.div
                key={floatId}
                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: -48, scale: 1.2 }}
                exit={{ opacity: 0, y: -80, scale: 0.8 }}
                transition={{ duration: 0.95, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: startX,
                  top: startY,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    style={{
                      fontSize: 34,
                      lineHeight: 1,
                      filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
                      transformOrigin: "center",
                    }}
                  >
                    {it.emoji}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>,
      document.body
    );
  }
);

export default ReactionOverlayLayer;
export type { ReactionOverlayLayerHandle };
