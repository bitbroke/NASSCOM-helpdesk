"use client";

import { motion, TargetAndTransition } from "framer-motion";
import { useSugoiStore, Mood } from "@/store/useSugoiStore";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { animate } from "animejs";

const MascotImages: Record<Mood, string> = {
  idle: "/sugoi-idle.png",
  thinking: "/sugoi-focus.png",
  judging: "/sugoi-judge.png",
  "dead-inside": "/sugoi-judge.png",
  "glowing-eyes": "/sugoi-judge.png",
  crying: "/sugoi-fail.png",
  happy: "/sugoi-win.png",
};

const floatVariants: Record<Mood, TargetAndTransition> = {
  idle: { y: [-8, 8, -8], transition: { duration: 5, repeat: Infinity, ease: "easeInOut" } },
  thinking: { y: [-4, 4, -4], rotate: [-0.5, 0.5, -0.5], transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } },
  judging: { x: [-3, 3, -3, 3, 0], transition: { duration: 0.5 } },
  "dead-inside": { y: [0, 2, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
  "glowing-eyes": { y: [-6, 6, -6], scale: [1, 1.02, 1], transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } },
  crying: { y: [-3, 3, -3], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } },
  happy: { y: [-10, 10, -10], rotate: [-1, 1, -1], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
};

export function SugoiMascot({ size = "hero" }: { size?: "nav" | "hero" | "workspace" }) {
  const mood = useSugoiStore((state) => state.persona.mood);
  const glowRef = useRef<HTMLDivElement>(null);

  // Anime.js ambient glow pulse
  useEffect(() => {
    let anim: any;
    if (glowRef.current) {
      anim = animate(glowRef.current, {
        opacity: 0.6,
        scale: 1.15,
        duration: 2500,
        loop: true,
        direction: "alternate",
        easing: "easeInOutSine",
      });
    }
    return () => {
      if (anim) anim.cancel();
    };
  }, []);

  if (size === "nav") {
    return (
      <motion.div animate={floatVariants[mood]} className="shrink-0 w-11 h-11 rounded-full overflow-hidden"
        style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
        <Image src={MascotImages[mood]} alt="Sugoi" width={44} height={44}
          className="w-full h-full object-cover" priority />
      </motion.div>
    );
  }

  if (size === "workspace") {
    return (
      <div className="relative">
        {/* Ambient glow ring */}
        <div ref={glowRef} className="absolute inset-0 scale-[1.3] pointer-events-none rounded-full opacity-30"
          style={{ background: "radial-gradient(ellipse at center, rgba(212,160,23,0.2) 0%, transparent 65%)", filter: "blur(30px)" }} />
        <motion.div animate={floatVariants[mood]} className="shrink-0 relative z-10">
          <Image src={MascotImages[mood]} alt="Sugoi" width={160} height={160}
            className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.08)]" priority />
        </motion.div>
      </div>
    );
  }

  // HERO — large
  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
      className="relative"
    >
      <div ref={glowRef} className="absolute inset-0 scale-125 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(212,160,23,0.12) 0%, transparent 65%)", filter: "blur(50px)" }} />
      <motion.div animate={floatVariants[mood]}>
        <Image src={MascotImages[mood]} alt="Sugoi Bot" width={480} height={480}
          className="relative z-10 object-contain" priority />
      </motion.div>
    </motion.div>
  );
}
