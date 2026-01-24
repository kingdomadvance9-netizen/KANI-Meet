"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import twemoji from "twemoji";

// ==================== Types ====================

type Reaction = {
  id: string;
  emoji: string;
  sessionId?: string | null;
  // Physics for this specific reaction instance
  physics: ReactionPhysics;
};

type ReactionPhysics = {
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  rotation: number;
  scale: number;
  duration: number;
};

// ==================== Color Mapping ====================

const EMOJI_GLOW: Record<string, string> = {
  "❤️": "rgba(255, 60, 100, 0.9)",
  "🔥": "rgba(255, 130, 30, 0.9)",
  "😂": "rgba(255, 220, 0, 0.95)",
  "👏": "rgba(100, 200, 255, 0.85)",
  "🎉": "rgba(255, 100, 255, 0.85)",
  "😮": "rgba(100, 255, 200, 0.8)",
  "😢": "rgba(120, 180, 255, 0.8)",
  "👍": "rgba(255, 200, 100, 0.85)",
  "🎈": "rgba(255, 150, 200, 0.85)",
};

function getEmojiGlow(emoji: string): string {
  return EMOJI_GLOW[emoji] ?? "rgba(255, 255, 255, 0.6)";
}

// ==================== Utilities ====================

function emojiToSvg(emoji: string): string {
  const html = twemoji.parse(emoji, { folder: "svg", ext: ".svg" });
  const match = html.match(/src="([^"]+)"/);
  return match ? match[1] : "";
}

/**
 * Generate randomized physics for natural, varied animations
 */
function generatePhysics(): ReactionPhysics {
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
  const screenHeight =
    typeof window !== "undefined" ? window.innerHeight : 1080;

  // Randomize horizontal spawn position (centered with variance)
  const spawnVariance = Math.min(screenWidth * 0.15, 200);
  const startX = screenWidth / 2 + (Math.random() - 0.5) * spawnVariance;
  const startY = screenHeight - 80;

  // Horizontal drift (slight left/right movement as it floats)
  const driftX = (Math.random() - 0.5) * 120;

  // Vertical float distance (how high it goes)
  const driftY = -(screenHeight * 0.6 + Math.random() * screenHeight * 0.2);

  // Rotation wobble
  const rotation = (Math.random() - 0.5) * 30;

  // Scale variation (0.9 to 1.2)
  const scale = 0.9 + Math.random() * 0.3;

  // Duration variation (3s to 4.5s)
  const duration = 3 + Math.random() * 1.5;

  return { startX, startY, driftX, driftY, rotation, scale, duration };
}

// ==================== Main Component ====================

export default function FloatingReactions() {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    type ReactionDetail = { emoji: string; sessionId?: string | null };

    const handler = (e: CustomEvent<ReactionDetail>) => {
      // Append-only: add new reaction with unique ID and physics
      setReactions((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          emoji: e.detail.emoji,
          sessionId: e.detail.sessionId,
          physics: generatePhysics(),
        },
      ]);
    };

    window.addEventListener("spawn-reaction", handler as EventListener);
    return () =>
      window.removeEventListener("spawn-reaction", handler as EventListener);
  }, []);

  // Auto-remove reactions after animation completes
  const handleAnimationComplete = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 9998,
      }}
      aria-live="polite"
      aria-label="Floating reactions"
    >
      <AnimatePresence mode="popLayout">
        {reactions.map((reaction) => (
          <ReactionParticle
            key={reaction.id}
            reaction={reaction}
            onComplete={() => handleAnimationComplete(reaction.id)}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// ==================== Individual Reaction Particle ====================

function ReactionParticle({
  reaction,
  onComplete,
}: {
  reaction: Reaction;
  onComplete: () => void;
}) {
  const { emoji, physics } = reaction;
  const svg = useMemo(() => emojiToSvg(emoji), [emoji]);
  const glow = getEmojiGlow(emoji);

  const { startX, startY, driftX, driftY, rotation, scale, duration } =
    physics;

  // Calculate final position
  const finalX = startX + driftX;
  const finalY = startY + driftY;

  return (
    <motion.div
      initial={{
        x: startX,
        y: startY,
        opacity: 0,
        scale: 0.3,
        rotate: 0,
      }}
      animate={{
        x: finalX,
        y: finalY,
        opacity: [0, 1, 1, 0.8, 0],
        scale: [0.3, scale * 1.1, scale, scale * 0.95, 0.2],
        rotate: rotation,
      }}
      exit={{
        opacity: 0,
        scale: 0.1,
        transition: { duration: 0.3 },
      }}
      transition={{
        duration,
        ease: [0.16, 1, 0.3, 1], // Custom easing for smooth float
        opacity: {
          times: [0, 0.1, 0.7, 0.9, 1],
          duration,
        },
        scale: {
          times: [0, 0.15, 0.5, 0.85, 1],
          duration,
        },
      }}
      onAnimationComplete={onComplete}
      style={{
        position: "fixed",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform, opacity",
      }}
    >
      {svg ? (
        <img
          src={svg}
          alt={emoji}
          style={{
            width: 56,
            height: 56,
            filter: `drop-shadow(0 4px 20px ${glow}) drop-shadow(0 0 8px ${glow})`,
            userSelect: "none",
          }}
          draggable={false}
        />
      ) : (
        <span
          style={{
            fontSize: 56,
            lineHeight: 1,
            filter: `drop-shadow(0 4px 20px ${glow}) drop-shadow(0 0 8px ${glow})`,
            userSelect: "none",
          }}
        >
          {emoji}
        </span>
      )}
    </motion.div>
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
