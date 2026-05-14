"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSugoiStore } from "@/store/useSugoiStore";
import { Swords, Shield, Zap } from "lucide-react";

interface RPGCombatLogProps {
  confidenceScore: number | null;
  loading: boolean;
}

export function RPGCombatLog({ confidenceScore, loading }: RPGCombatLogProps) {
  const enemyHealth = useSugoiStore((s) => s.game.enemyHealth);
  const power = useSugoiStore((s) => s.game.power);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-4 rounded-2xl font-mono text-sm w-full relative overflow-hidden">
      {/* Enemy */}
      <div className="flex justify-between items-center mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--accent-red)" }}>
          <Swords className="w-3.5 h-3.5" /> Critical Bug Lv.99
        </span>
        <span className="text-[10px] font-mono font-bold" style={{ color: "var(--accent-red)" }}>HP {enemyHealth}/100</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden mb-4" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.15)" }}>
        <motion.div className="hp-bar-enemy h-full rounded-full" initial={{ width: "100%" }}
          animate={{ width: `${enemyHealth}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} />
      </div>

      {/* Sugoi */}
      <div className="flex justify-between items-center mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--accent-purple)" }}>
          <Shield className="w-3.5 h-3.5" /> Sugoi (L1 Architect)
        </span>
        <span className="text-[10px] font-mono font-bold" style={{ color: "var(--accent-purple)" }}>PWR {power}%</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden mb-4" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.15)" }}>
        <motion.div className="hp-bar-sugoi h-full rounded-full" initial={{ width: "0%" }}
          animate={{ width: `${power}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} />
      </div>

      {/* Combat Log */}
      <div className="rounded-xl p-2.5 overflow-y-auto text-[11px] max-h-16"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 animate-pulse" style={{ color: "var(--accent-amber)" }} />
              Sugoi is charging WASM INFERENCE...
            </motion.div>
          )}
          {confidenceScore !== null && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="font-bold" style={{ color: "var(--accent-purple)" }}>
              <div className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Sugoi used PATCH UPDATE! It&apos;s super effective!</div>
              <div className="mt-1 opacity-80">&gt; Critical bug took {Math.floor(confidenceScore * 100)} damage!</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
