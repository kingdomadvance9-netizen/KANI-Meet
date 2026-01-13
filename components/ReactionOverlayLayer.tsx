import React, {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export type ReactionEvent = {
  id?: string;
  emoji: string;
  sessionId?: string | null;
};
type OverlayItem = ReactionEvent & { key: string; createdAt: number };
type ReactionOverlayLayerHandle = { showReaction: (ev: ReactionEvent) => void };

const DEFAULT_LIFETIME = 1600;

const findTargetRect = (sessionId?: string | null): DOMRect | null => {
  if (!sessionId) return null;
  const el = document.querySelector(
    `[data-session-id="${sessionId}"]`
  ) as HTMLElement | null;
  return el ? el.getBoundingClientRect() : null;
};

const centerRect = () =>
  ({
    left: window.innerWidth / 2 - 90,
    top: window.innerHeight / 2 - 60,
    width: 180,
    height: 120,
  } as DOMRect);

const ReactionOverlayLayer = forwardRef<
  ReactionOverlayLayerHandle,
  { lifetime?: number; zIndex?: number }
>(({ lifetime = DEFAULT_LIFETIME, zIndex = 100000 }, ref) => {
  const [items, setItems] = useState<OverlayItem[]>([]);
  const idCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    showReaction: (ev: ReactionEvent) => {
      try {
        console.log("[ReactionOverlayLayer] showReaction called", ev);
      } catch (err) {}
      const key = `${Date.now()}-${++idCounter.current}`;
      setItems((s) => [...s, { ...ev, key, createdAt: Date.now() }]);
    },
  }));

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const next = (s: OverlayItem[]) =>
        s.filter((it) => now - it.createdAt < lifetime + 400);
      setItems((s: OverlayItem[]) => {
        const filtered = next(s);
        if (filtered.length !== s.length) {
          try {
            console.log(
              "[ReactionOverlayLayer] cleanup items ->",
              filtered.length
            );
          } catch (err) {}
        }
        return filtered;
      });
    }, 600);
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
          const rect = findTargetRect(it.sessionId) ?? centerRect();
          const jitterX = (Math.random() - 0.5) * Math.min(100, rect.width / 2);
          const startX = rect.left + rect.width / 2 + jitterX;
          const startY = rect.top + rect.height / 2 + (Math.random() * 20 - 10);

          return (
            <motion.div
              key={it.key}
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: -56, scale: 1.25 }}
              exit={{ opacity: 0, y: -96, scale: 0.8 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                left: startX,
                top: startY,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 36,
                    lineHeight: 1,
                    filter: "drop-shadow(0 8px 26px rgba(0,0,0,0.45))",
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
});

export default ReactionOverlayLayer;
export type { ReactionOverlayLayerHandle };
