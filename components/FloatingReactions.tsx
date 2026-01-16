"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import twemoji from "twemoji";

type Reaction = { id: string; emoji: string; sessionId?: string | null };

const EMOJI_COLORS: Record<string, string> = {
  "❤️": "rgba(255, 60, 100, 0.8)",
  "🔥": "rgba(255, 130, 30, 0.8)",
  "😂": "rgba(255, 220, 0, 0.85)",
  "👏": "rgba(100, 200, 255, 0.8)",
};

function emojiToSvg(e: string): string {
  const html = twemoji.parse(e, { folder: "svg", ext: ".svg" });
  const m = html.match(/src="([^\"]+)"/);
  return m ? m[1] : "";
}

function pickColor(emoji: string) {
  return EMOJI_COLORS[emoji] ?? "rgba(255,255,255,0.55)";
}

function waitForElement(sessionId?: string | null, tries = 10) {
  return new Promise<HTMLElement | null>((resolve) => {
    if (!sessionId) return resolve(null);
    let i = 0;
    const t = setInterval(() => {
      const el = document.querySelector(
        `[data-session-id="${sessionId}"]`
      ) as HTMLElement | null;
      if (el) {
        clearInterval(t);
        resolve(el);
      }
      i++;
      if (i > tries) {
        clearInterval(t);
        resolve(null);
      }
    }, 60);
  });
}

export default function FloatingReactions() {
  const [list, setList] = useState<Reaction[]>([]);

  useEffect(() => {
    type Detail = { emoji: string; sessionId?: string | null };
    const handler = (e: CustomEvent<Detail>) => {
      console.log("[FloatingReactions] spawn-reaction received", e.detail);
      setList((p) => {
        const newList = [
          ...p,
          {
            id: crypto.randomUUID(),
            emoji: e.detail.emoji,
            sessionId: e.detail.sessionId,
          },
        ];
        console.log("[FloatingReactions] Updated list:", newList);
        return newList;
      });
    };

    console.log("[FloatingReactions] Event listener attached");
    window.addEventListener("spawn-reaction", handler as EventListener);
    return () => {
      console.log("[FloatingReactions] Event listener removed");
      window.removeEventListener("spawn-reaction", handler as EventListener);
    };
  }, []);

  const remove = (id: string) => {
    console.log("[FloatingReactions] Removing reaction:", id);
    setList((p) => p.filter((r) => r.id !== id));
  };

  console.log("[FloatingReactions] Rendering with list:", list);

  // Render nothing on server
  if (typeof window === "undefined") return null;

  // Portal to document.body to avoid affecting control bar layout
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 9998,
      }}
    >
      <AnimatePresence initial={false}>
        {list.map((r) => (
          <ReactionParticle key={r.id} {...r} onDone={() => remove(r.id)} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

function ReactionParticle({
  emoji,
  sessionId,
  onDone,
}: Reaction & { onDone: () => void }) {
  const svg = useMemo(() => emojiToSvg(emoji), [emoji]);
  const glow = pickColor(emoji);

  const controls = useAnimation();
  const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 140;
  const startY = window.innerHeight - 120;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) return;

      await controls.start({
        opacity: 1,
        scale: 1.15,
        x: startX,
        y: startY - 36,
        transition: { duration: 0.38 },
      });

      // float up
      await controls.start({
        x: startX + (Math.random() - 0.5) * 80,
        y: window.innerHeight - (300 + Math.random() * 200),
        rotate: (Math.random() - 0.5) * 20,
        transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
      });

      // try to find target tile
      const el = await waitForElement(sessionId);
      if (el) {
        const rect = el.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2 - 20;
        await controls.start({
          x: targetX,
          y: targetY,
          scale: 1.5,
          transition: { type: "spring", stiffness: 80, damping: 14 },
        });
        await controls.start({
          scale: [1.5, 2.05, 1.45],
          transition: { duration: 0.45 },
        });
        await new Promise((r) => setTimeout(r, 700));
      } else {
        await controls.start({
          x: startX + (Math.random() - 0.5) * 120,
          y: window.innerHeight - (600 + Math.random() * 160),
          opacity: 0.85,
          transition: { duration: 1.1 },
        });
      }

      if (cancelled) return;

      await controls.start({
        opacity: 0,
        scale: 0.2,
        transition: { duration: 0.7 },
      });
      onDone();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [controls, sessionId, onDone]);

  return (
    <motion.img
      src={svg}
      animate={controls}
      initial={{ opacity: 0, scale: 0.25, x: startX, y: startY }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        width: 52,
        height: 52,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
        filter: `drop-shadow(0 8px 18px ${glow})`,
      }}
    />
  );
}

{
  /*

  Lighter version
  
  "use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import twemoji from "twemoji";

// ------------------- Types -------------------

type Reaction = {
  id: string;
  emoji: string;
  sessionId: string;
};

// ------------------- Utilities -------------------

function emojiToSvg(emoji: string): string {
  const html = twemoji.parse(emoji, { folder: "svg", ext: ".svg" });
  const m = html.match(/src="([^"]+)"/);
  return m ? m[1] : "";
}

// ------------------- Floating Reactions Root -------------------

export default function FloatingReactions() {
  const [list, setList] = useState<Reaction[]>([]);

  useEffect(() => {
    type ReactionDetail = { emoji: string; sessionId: string };

    const handler = (e: CustomEvent<ReactionDetail>) => {
      const { emoji, sessionId } = e.detail;
      setList((p) => [...p, { id: crypto.randomUUID(), emoji, sessionId }]);
    };

    window.addEventListener("spawn-reaction", handler as EventListener);
    return () =>
      window.removeEventListener("spawn-reaction", handler as EventListener);
  }, []);

  const remove = (id: string) =>
    setList((p) => p.filter((r) => r.id !== id));

  return (
    <AnimatePresence initial={false}>
      {list.map((r) => (
        <ReactionParticle key={r.id} {...r} onDone={() => remove(r.id)} />
      ))}
    </AnimatePresence>
  );
}

// ------------------- Single Emoji Particle -------------------

function ReactionParticle({
  emoji,
  sessionId,
  onDone,
}: Reaction & { onDone: () => void }) {
  const svg = useMemo(() => emojiToSvg(emoji), [emoji]);
  const controls = useAnimation();

  // Starting positions
  const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
  const startY = window.innerHeight - 140;

  // Random animation flavor
  const swayIntensity = Math.random() * 60 + 20;
  const swirlRotation = (Math.random() - 0.5) * 45;
  const floatHeight = window.innerHeight - 380 - Math.random() * 60;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) return;

      // ------------------- Step 1: Gentle Float + Sway -------------------

      const midX = startX + (Math.random() > 0.5 ? swayIntensity : -swayIntensity);

      await controls.start({
        opacity: 1,
        scale: 1.2,
        x: midX,
        y: floatHeight,
        rotate: swirlRotation,
        transition: {
          duration: 1.2,
          ease: [0.22, 1, 0.36, 1], // smooth easeOutExpo-like curve
        },
      });

      if (cancelled) return;

      // ------------------- Step 2: Find tile OR follow drift path -------------------

      const el = document.querySelector(
        `[data-session-id="${sessionId}"]`
      ) as HTMLElement | null;

      if (el) {
        const rect = el.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2 - 35;

        // Fly smoothly to tile with spring arc
        await controls.start({
          x: targetX,
          y: targetY,
          scale: 1.35,
          rotate: swirlRotation * 0.3,
          transition: {
            type: "spring",
            mass: 1,
            stiffness: 60,
            damping: 14,
          },
        });

        if (cancelled) return;

        // Little "pop glow"
        await controls.start({
          scale: 1.45,
          opacity: 1,
          transition: { duration: 0.22 },
        });

        await controls.start({
          scale: 1.2,
          transition: { duration: 0.3 },
        });

        // Hold on tile
        await new Promise((res) => setTimeout(res, 1300));
      } else {
        // Natural upward drift path
        await controls.start({
          x: startX + (Math.random() - 0.5) * 60,
          y: floatHeight - 180,
          rotate: swirlRotation * 0.6,
          opacity: 0.85,
          transition: {
            duration: 1.2,
            ease: [0.22, 1, 0.36, 1],
          },
        });

        await new Promise((res) => setTimeout(res, 300));
      }

      if (cancelled) return;

      // ------------------- Step 3: Fade Out -------------------

      await controls.start({
        opacity: 0,
        scale: 0.3,
        rotate: swirlRotation * 1.5,
        transition: {
          duration: 0.9,
          ease: [0.4, 0, 0.2, 1], // smooth fade curve
        },
      });

      onDone();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [controls, sessionId, onDone, startX, floatHeight, swirlRotation, swayIntensity]);

  return (
    <motion.img
      src={svg}
      animate={controls}
      initial={{
        opacity: 0,
        scale: 0.2,
        x: startX,
        y: startY,
      }}
      exit={{ opacity: 0, scale: 0.2, transition: { duration: 0.3 } }}
      style={{
        position: "fixed",
        width: 52,
        height: 52,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform, opacity, scale",
      }}
    />
  );
}

  
  */
}
