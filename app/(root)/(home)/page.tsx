"use client";
import { useEffect, useRef, useState } from "react";
import MeetingTypeList from "@/components/MeetingTypeList";

const slides = [
  { title: "Upcoming Meeting at: 12:30 PM", bg: "bg-hero" },
  { title: "", bg: "bg-hero-courageous" },
  { title: "", bg: "bg-hero-wisdom" },
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

  // autoplay
  useEffect(() => {
    const auto = () => {
      if (!isPaused.current) {
        setIndex((i) => (i + 1) % slides.length);
      }
    };
    autoplayRef.current = window.setInterval(auto, 5000);
    return () => {
      if (autoplayRef.current) window.clearInterval(autoplayRef.current);
    };
  }, []);

  // touch handling
  const startX = useRef(0);
  const endX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) =>
    (startX.current = e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) =>
    (endX.current = e.touches[0].clientX);
  const onTouchEnd = () => {
    const dist = startX.current - endX.current;
    if (dist > 40) setIndex((i) => (i + 1) % slides.length); // swipe left
    if (dist < -40) setIndex((i) => (i - 1 + slides.length) % slides.length); // swipe right
  };

  // helpers
  const next = () => setIndex((i) => (i + 1) % slides.length);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);

  return (
    <section className="flex size-full flex-col text-white gap-5 !mt-0 !pt-0">
      {/* ===== MOBILE (full-bleed) ===== */}
      <div
        // mobile-only wrapper: remove rounded corners and extend to edges
        className="md:hidden relative overflow-hidden w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => (isPaused.current = true)}
        onMouseLeave={() => (isPaused.current = false)}
      >
        <div
          className="flex h-[300px] transition-transform duration-500"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <article
              key={i}
              className={`min-w-full h-[300px] bg-center bg-cover ${s.bg} flex flex-col justify-between px-5 py-8`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
            >
              <h2 className="glassmorphism max-w-[280px] rounded py-2 text-center text-base font-normal">
                {/*{s.title}*/}
              </h2>
              <div>
                <h1 className="text-3xl font-extrabold">{/*{time}*/}</h1>
                <p className="text-sm font-medium text-sky-1">{/*{date}*/}</p>
              </div>
            </article>
          ))}
        </div>

        {/* controls */}
        <button
          aria-label="Previous"
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/30 px-3 py-2 rounded-full"
        >
          ‹
        </button>
        <button
          aria-label="Next"
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/30 px-3 py-2 rounded-full"
        >
          ›
        </button>

        {/* dots */}
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

      {/* ===== DESKTOP (centered container with rounding) ===== */}
      <div
        // desktop wrapper: visible from md and up
        className="hidden md:block w-full"
        onMouseEnter={() => (isPaused.current = true)}
        onMouseLeave={() => (isPaused.current = false)}
      >
        <div className=" relative mx-auto max-w-[1200px] rounded-[20px] overflow-hidden h-[320px]">
          <div
            className="flex h-full transition-transform duration-500"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <article
                key={i}
                className={`min-w-full h-full bg-center bg-cover ${s.bg} flex flex-col justify-between p-11`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slides.length}`}
              >
                <h2 className=" max-w-[360px] rounded py-2 text-center text-base font-normal">
                  {/*{s.title}*/}
                </h2>
                <div>
                  <h1 className="text-4xl lg:text-6xl font-extrabold">
                    {/*{time}*/}
                  </h1>
                  <p className="text-lg font-medium text-sky-1 lg:text-2xl">
                    {/*{date}*/}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* controls */}
          <button
            aria-label="Previous"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 
             bg-white/30 px-3 py-2 rounded-full hidden lg:flex"
          >
            ‹
          </button>

          <button
            aria-label="Next"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 
             bg-white/30 px-3 py-2 rounded-full hidden lg:flex"
          >
            ›
          </button>

          {/* dots (desktop) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden lg:flex gap-2">
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
      </div>

      {/* meeting cards/controls */}
      <MeetingTypeList />
    </section>
  );
}
