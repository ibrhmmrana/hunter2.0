"use client";

import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface HScrollProps {
  children: ReactNode;
  className?: string;
  slideMinWidth?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export function HScroll({ children, className = "", slideMinWidth }: HScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const defaultMinWidth = {
    mobile: 280,
    tablet: 360,
    desktop: 420,
  };

  const minWidth = {
    mobile: slideMinWidth?.mobile ?? defaultMinWidth.mobile,
    tablet: slideMinWidth?.tablet ?? defaultMinWidth.tablet,
    desktop: slideMinWidth?.desktop ?? defaultMinWidth.desktop,
  };

  const checkScroll = () => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    checkScroll();
    scrollEl.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      scrollEl.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [children]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const slideWidth = scrollRef.current.clientWidth * 0.8; // Scroll ~80% of viewport
    const scrollAmount = direction === "left" ? -slideWidth : slideWidth;

    scrollRef.current.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll("right");
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        data-hscroll-container
        className="overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Horizontal scrollable content"
      >
        <div className="flex gap-4 md:gap-6">
          {Array.isArray(children)
            ? children.map((child, index) => (
                <div
                  key={index}
                  className="snap-start flex-shrink-0"
                  style={{
                    minWidth: `${minWidth.mobile}px`,
                  }}
                  data-hscroll-slide
                >
                  {child}
                </div>
              ))
            : children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media (min-width: 768px) {
            [data-hscroll-container] [data-hscroll-slide] {
              min-width: ${minWidth.tablet}px !important;
            }
          }
          @media (min-width: 1024px) {
            [data-hscroll-container] [data-hscroll-slide] {
              min-width: ${minWidth.desktop}px !important;
            }
          }
        `
      }} />

      {/* Left Arrow */}
      {showLeftArrow && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-slate-200 hover:bg-white transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5 text-slate-700" />
        </motion.button>
      )}

      {/* Right Arrow */}
      {showRightArrow && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-slate-200 hover:bg-white transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5 text-slate-700" />
        </motion.button>
      )}
    </div>
  );
}

