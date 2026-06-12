"use client";

import React from "react";
import { motion } from "framer-motion";
import { useSugoiStore } from "@/store/useSugoiStore";

interface GlowOrbProps {
  /** CSS color string */
  color?: string;
  /** Size in pixels */
  size?: number;
  /** Inline styles for positioning */
  style?: React.CSSProperties;
  /** CSS class for positioning */
  className?: string;
  /** Depth layer (translateZ value) */
  depth?: number;
  /** Animation delay in seconds */
  delay?: number;
  /** Pulse intensity multiplier */
  intensity?: number;
}

export function GlowOrb({
  color = "rgba(212, 160, 23, 0.3)",
  size = 120,
  style,
  className = "",
  depth = -20,
  delay = 0,
  intensity = 1,
}: GlowOrbProps) {
  const animationsEnabled = useSugoiStore((s) => s.settings.animationsEnabled);

  const orbStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    filter: `blur(${size * 0.25}px)`,
    transform: `translateZ(${depth}px)`,
    pointerEvents: "none" as const,
    willChange: "transform, opacity",
    ...style,
  };

  if (!animationsEnabled) {
    return (
      <div
        className={`absolute ${className}`}
        style={{ ...orbStyle, opacity: 0.4 * intensity }}
      />
    );
  }

  return (
    <motion.div
      className={`absolute ${className}`}
      style={orbStyle}
      animate={{
        scale: [1, 1.15 * intensity, 1, 0.95, 1],
        opacity: [0.3 * intensity, 0.55 * intensity, 0.35 * intensity, 0.5 * intensity, 0.3 * intensity],
        y: [0, -8, 0, 6, 0],
        x: [0, 4, 0, -3, 0],
      }}
      transition={{
        duration: 8 + delay,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay,
      }}
    />
  );
}
