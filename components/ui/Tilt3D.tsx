"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Tilt3DProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  maxTilt?: number;
}

export function Tilt3D({ children, className, containerClassName, maxTilt = 10 }: Tilt3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Motion values to track normalized mouse coordinates (0.0 to 1.0)
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  // Smooth springs to slide values dynamically with inertia
  const springX = useSpring(x, { stiffness: 150, damping: 25 });
  const springY = useSpring(y, { stiffness: 150, damping: 25 });

  // Map spring coordinates to rotation degrees
  const rotateX = useTransform(springY, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(springX, [0, 1], [-maxTilt, maxTilt]);

  // Sheen overlay gradient coordinates
  const sheenX = useTransform(springX, [0, 1], ["0%", "100%"]);
  const sheenY = useTransform(springY, [0, 1], ["0%", "100%"]);

  // Dynamic shadow depth based on tilt
  const shadowX = useTransform(springX, [0, 1], [-8, 8]);
  const shadowY = useTransform(springY, [0, 1], [-8, 8]);

  // Edge glow position
  const glowX = useTransform(springX, [0, 1], ["0%", "100%"]);
  const glowY = useTransform(springY, [0, 1], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set(mouseX / width);
    y.set(mouseY / height);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`perspective-[1000px] ${containerClassName || ""}`}
      style={{ perspective: "1000px" }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative group transition-shadow duration-300 ${className}`}
      >
        {/* 3D depth extrusion side face (bottom edge) */}
        <motion.div
          className="absolute inset-x-0 -bottom-[3px] h-[6px] rounded-b-[inherit] pointer-events-none z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: "linear-gradient(to bottom, rgba(168,154,128,0.15), rgba(168,154,128,0.05))",
            transform: "translateZ(-2px) rotateX(8deg)",
            transformOrigin: "top center",
          }}
        />

        {/* Dynamic edge glow that follows cursor position */}
        <motion.div
          className="absolute -inset-[1px] rounded-[inherit] pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle 180px at ${glowX} ${glowY}, rgba(212,160,23,0.15), transparent 70%)`,
            borderRadius: "inherit",
          }}
        />

        {/* Dynamic gloss sheen layer */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[inherit] z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 250px at ${sheenX} ${sheenY}, rgba(255,255,255,0.12), transparent)`,
          }}
        />

        {/* Reflection plane beneath the card */}
        <motion.div
          className="absolute inset-x-2 -bottom-3 h-[40%] rounded-[inherit] pointer-events-none z-[-1] opacity-0 group-hover:opacity-[0.04] transition-all duration-500"
          style={{
            background: "linear-gradient(to bottom, var(--glass-bg), transparent)",
            filter: "blur(8px)",
            transform: "translateZ(-5px) scaleY(-0.3) translateY(100%)",
            transformOrigin: "top center",
          }}
        />

        {/* Depth-separated shadow layers */}
        <motion.div
          className="absolute inset-0 rounded-[inherit] pointer-events-none z-[-2] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            boxShadow: `${shadowX}px ${shadowY}px 30px -10px rgba(0,0,0,0.08), 0 20px 60px -20px rgba(212,160,23,0.1)`,
            transform: "translateZ(-8px)",
          }}
        />

        {children}
      </motion.div>
    </div>
  );
}
