"use client";
import { useEffect, useRef, useState } from "react";
import MeetingTypeList from "@/components/MeetingTypeList";

const slides = [
  { 
    title: "Upcoming Meeting at: 12:30 PM", 
    desktopBg: "bg-hero", 
    mobileBg: "bg-hero" 
  },
  // Add more slides if needed:
  // { title: "", desktopBg: "bg-hero-courageous", mobileBg: "bg-hero-mobile-2" },
  // { title: "", desktopBg: "bg-hero-wisdom", mobileBg: "bg-hero-mobile-3" },
];

export default function HomeBanner() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Nairobi",
  });
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "Africa/Nairobi",
  }).format(now);

  const [index, setIndex] = useState(0);
  const autoplayRef = useRef<number | null>(null);
  const isPaused = useRef(false);

  useEffect(() => {
    const auto = () => {
      if (!isPaused.current) {
        setIndex((i) => (i + 1) % slides.length);
      }
    };
    autoplayRef.current = window.setInterval(auto, 5000);
    return () => {
  if (autoplayRef.current !== null) {
    clearInterval(autoplayRef.current);
  }
};

  }, []);

  // Touch swipe
  const startX = useRef(0);
  const endX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) =>
    (startX.current = e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) =>
    (endX.current = e.touches[0].clientX);
  const onTouchEnd = () => {
    const dist = startX.current - endX.current;
    if (dist > 40) setIndex((i) => (i + 1) % slides.length);
    if (dist < -40) setIndex((i) => (i - 1 + slides.length) % slides.length);
  };

  const next = () => setIndex((i) => (i + 1) % slides.length);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);

  return (
    <section className="flex size-full flex-col text-white gap-5 !mt-0 !pt-0">
      
      {/* ===== MOBILE (1080x1080 images) ===== */}
      <div
        className="md:hidden relative overflow-hidden w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-[300px] transition-transform duration-500"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <article
              key={i}
              className={`min-w-full h-[300px] bg-center bg-cover 
                          ${s.mobileBg}     /* <= MOBILE IMAGE HERE */
                          md:${s.desktopBg}  /* <= desktop override (ignored on mobile) */
                          flex flex-col justify-between px-5 py-8`}
            >
            </article>
          ))}
        </div>

        {/* Controls */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/30 px-3 py-2 rounded-full"
        >
          ‹
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/30 px-3 py-2 rounded-full"
        >
          ›
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${
                index === i ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ===== DESKTOP (unchanged) ===== */}
      <div className="hidden md:block w-full">
        <div className="relative mx-auto max-w-[1200px] rounded-[20px] overflow-hidden h-[320px]">
          <div
            className="flex h-full transition-transform duration-500"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <article
                key={i}
                className={`min-w-full h-full bg-center bg-cover ${s.desktopBg} flex flex-col justify-between p-11`}
              ></article>
            ))}
          </div>

          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 px-3 py-2 rounded-full hidden lg:flex"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 px-3 py-2 rounded-full hidden lg:flex"
          >
            ›
          </button>
        </div>
      </div>

      <MeetingTypeList />
    </section>
  );
}
