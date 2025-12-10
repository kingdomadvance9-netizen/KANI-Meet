"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import twemoji from "twemoji";

// ---------------- UTILITIES ----------------

type Reaction = {
  id: string;
  emoji: string;
  sessionId: string;
};

const EMOJI_COLORS: Record<string, string> = {
  "❤️": "rgba(255, 60, 100, 0.7)",
  "🔥": "rgba(255, 130, 30, 0.7)",
  "😂": "rgba(255, 220, 0, 0.7)",
  "👏": "rgba(100, 200, 255, 0.7)",
};

function emojiToSvg(e: string): string {
  const html = twemoji.parse(e, { folder: "svg", ext: ".svg" });
  return html.match(/src="([^"]+)"/)?.[1] ?? "";
}

function pickColor(emoji: string) {
  return (
    EMOJI_COLORS[emoji] ??
    "rgba(255,255,255,0.55)" // default white glow
  );
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// 🔍 NEW: Wait for participant tile to exist (fixes global targeting)
async function waitForElement(sessionId: string, tries = 14) {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(
      `[data-session-id="${sessionId}"]`
    ) as HTMLElement | null;

    if (el) return el;

    await new Promise((res) => setTimeout(res, 70)); // wait 70ms
  }
  return null;
}

// ---------------- ROOT COMPONENT ----------------

export default function FloatingReactions() {
  const [list, setList] = useState<Reaction[]>([]);

  useEffect(() => {
    type Detail = { emoji: string; sessionId: string };

    const handler = (e: CustomEvent<Detail>) => {
      setList((p) => [...p, { id: crypto.randomUUID(), ...e.detail }]);
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

// ---------------- PARTICLE ----------------

function ReactionParticle({
  emoji,
  sessionId,
  onDone,
}: Reaction & { onDone: () => void }) {
  const svg = useMemo(() => emojiToSvg(emoji), [emoji]);
  const glow = pickColor(emoji);

  const controls = useAnimation();
  const trailControls = useAnimation();
  const shockControls = useAnimation();

  const startX = window.innerWidth / 2 + randomRange(-120, 120);
  const startY = window.innerHeight - 120;

  const swirlFactor = randomRange(-180, 180);
  const wobbleIntensity = randomRange(6, 14);
  const curveOffset = randomRange(-120, 120);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) return;

      // ---------------- 1) Spawn Swirl ----------------
      await controls.start({
        opacity: 1,
        scale: 1.4,
        rotateZ: swirlFactor,
        x: startX + randomRange(-40, 40),
        y: startY - 60,
        transition: {
          duration: 0.4,
          ease: [0.3, 1.3, 0.5, 1],
        },
      });

      // ---------------- Trail ----------------
      trailControls.start({
        opacity: [0.4, 0.1, 0.25],
        scale: [0.6, 1.8, 0.8],
        transition: {
          repeat: Infinity,
          duration: 0.9,
        },
      });

      // ---------------- 2) Float Up ----------------
      await controls.start({
        x: startX + curveOffset,
        y: window.innerHeight - randomRange(450, 520),
        rotateZ: swirlFactor * 0.5,
        rotateX: wobbleIntensity,
        rotateY: -wobbleIntensity,
        transition: {
          duration: 1.4,
          ease: [0.22, 1, 0.36, 1],
        },
      });

      // ---------------- 3) Try Target Participant ----------------
      const el = await waitForElement(sessionId); // 🔥 GLOBAL FIX

      if (el) {
        const rect = el.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2 - 20;

        // Move to target
        await controls.start({
          x: targetX,
          y: targetY,
          scale: 1.6,
          rotateX: 0,
          rotateY: 0,
          rotateZ: swirlFactor * 0.1,
          transition: {
            type: "spring",
            stiffness: 90,
            damping: 14,
          },
        });

        // Shockwave
        shockControls.start({
          opacity: [0.4, 0],
          scale: [1, 3],
          transition: { duration: 0.6 },
        });

        // Burst
        await controls.start({
          scale: [1.6, 2.1, 1.5],
          transition: { duration: 0.45 },
        });

        await new Promise((res) => setTimeout(res, 900));
      } else {
        // Fallback drifting
        await controls.start({
          x: startX + randomRange(-60, 60),
          y: window.innerHeight - randomRange(650, 720),
          opacity: 0.85,
          rotateZ: swirlFactor * 0.7,
          transition: { duration: 1.3, ease: "easeOut" },
        });
      }

      if (cancelled) return;

      // ---------------- 4) Fade out ----------------
      await controls.start({
        opacity: 0,
        scale: 0.2,
        rotateZ: swirlFactor * 3,
        transition: { duration: 0.8, ease: "easeInOut" },
      });

      onDone();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [controls, sessionId, onDone]);

  return (
    <>
      {/* Shockwave */}
      <motion.div
        animate={shockControls}
        initial={{ opacity: 0, scale: 0.2 }}
        style={{
          position: "fixed",
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: glow,
          filter: "blur(20px)",
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
          zIndex: 9997,
        }}
      />

      {/* Glow Trail */}
      <motion.div
        animate={trailControls}
        initial={{ opacity: 0 }}
        style={{
          position: "fixed",
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: glow,
          filter: "blur(25px)",
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
          zIndex: 9998,
        }}
      />

      {/* Main Emoji */}
      <motion.img
        src={svg}
        animate={controls}
        initial={{ opacity: 0, scale: 0.3, x: startX, y: startY }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          width: 54,
          height: 54,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 9999,
          filter: `drop-shadow(0 0 12px ${glow})`,
        }}
      />
    </>
  );
}





{/*

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

  
  */}