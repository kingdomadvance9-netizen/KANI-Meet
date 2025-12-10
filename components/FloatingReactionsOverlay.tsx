"use client";

import { useEffect, useState } from "react";

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

export default function FloatingReactionsOverlay() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const emoji = event.detail;
      const id = Date.now();

      setReactions((prev) => [
        ...prev,
        {
          id,
          emoji,
          x: Math.random() * 70 + 15, // 15%–85% width
        },
      ]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2200);
    };

    window.addEventListener("spawn-reaction", handler as EventListener);

    return () => {
      window.removeEventListener("spawn-reaction", handler as EventListener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {reactions.map((reaction) => (
        <span
          key={reaction.id}
          className="absolute text-4xl animate-float-reaction"
          style={{
            left: `${reaction.x}%`,
            bottom: "0px",
          }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
