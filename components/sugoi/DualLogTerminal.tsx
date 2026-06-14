"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Sparkles, Activity } from "lucide-react";

interface DualLogTerminalProps {
  thoughtProcess: string[];
  loading: boolean;
  agenticTrace?: {
    action: string;
    keywords: string[];
    tool_data: string;
  } | null;
  streamingOutput?: string;
}

const SugoiDictionary: Record<string, string> = {
  "[Analyser Agent] Initialising — PII scrub & embedding pipeline...": "Sugoi is putting on rubber gloves to scrub your PII... 🧤",
  "[Analyser Agent] Loading BERT NER (Xenova/bert-base-NER)...": "Loading NER because apparently we still use BERT... 🤖",
  "[Analyser Agent] Zero-trust NER redaction complete ✓": "Zero-trust achieved. Sugoi trusts no one, especially you.",
  "[Analyser Agent] Sanitized text ready ✓": "Text sanitized. Removed all your embarrassing typos. ✨",
  "[Analyser Agent] Generating 384d embedding (bge-small-en-v1.5)...": "Mathing out 384 dimensions. My brain hurts... 🧠",
  "[Analyser Agent] 384-dimensional vector generated ✓": "384-dimensional vector generated. Sugoi is basically a god now. 👑",
  "🏛️ [Manager Council] Convening — initiating Hybrid Search (BM25 + pgvector RRF, k=60)...": "Waking up the senior devs to look at past mistakes... ☕",
  "[Manager Council] RRF unavailable — falling back to pgvector search.": "RRF failed. Falling back to copying from StackOverflow. 📋",
  "⚖️ [Triage Decider] Running ONNX C++ inference engine...": "Running C++ to judge your life choices... ⚖️",
  "[Synthesis Layer] Cloud Mode Active: Gemini 1.5 Flash dynamically formatting DAG...": "Forcing Google's finest AI to write a markdown list. 💸",
  "⚡ [Overwatch] Anomaly detected...": "Widespread panic detected. Did someone push to prod on a Friday? 🔥",
  "[SKILL ACTIVATED: OFFLINE MODE]": "Cloud severed. Sugoi is carrying this helpdesk single-handedly. 💪",
};

function translateLog(log: string): string {
  for (const key of Object.keys(SugoiDictionary)) {
    if (log.includes(key)) return SugoiDictionary[key];
  }
  if (log.includes("[Triage Decider] ONNX classified:")) return "Sugoi has decided your fate with mathematical certainty. 🎯";
  if (log.includes("[Triage Decider] VETO")) return "Sugoi.exe has emotionally crashed. Escalating to a human. 😵";
  if (log.includes("System initialized")) return "Sugoi is waking up... ☕ Loading emergency kawaii protocols...";
  if (log.includes("Re-establishing")) return "Sugoi tripped over the ethernet cable. 🔌";
  if (log.includes("Connection severed")) return "The Wi-Fi has chosen violence today. ⚔️";
  if (log.includes("[Synthesis Layer] Resolution")) return "Resolution crafted with artisanal AI care. 🎨";
  if (log.includes("[Manager Council] Domain bids")) return "The council is arguing about who owns this ticket... 🏛️";
  if (log.includes("[Manager Council] Winning bid")) return "And the award goes to... 🏆";
  if (log.includes("[Manager Council] RRF retrieved")) return "Digging through the archives of past failures... 📚";
  return log;
}

export function DualLogTerminal({ thoughtProcess, loading, agenticTrace, streamingOutput }: DualLogTerminalProps) {
  const [showNerdLogs, setShowNerdLogs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thoughtProcess]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative z-10">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[10px] font-black tracking-[0.25em] uppercase flex items-center gap-2" style={{ color: "var(--color-taupe)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          System Telemetry
        </h3>
        <motion.button
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNerdLogs(!showNerdLogs)}
          className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full transition-all cursor-pointer shadow-sm"
          style={{
            background: showNerdLogs ? "#a89a80" : "var(--glass-bg)",
            color: showNerdLogs ? "white" : "#a89a80",
            border: `1px solid ${showNerdLogs ? "#a89a80" : "rgba(168, 154, 128, 0.3)"}`,
          }}
        >
          {showNerdLogs ? <><Sparkles className="w-3 h-3" /> Cute Mode</> : <><Terminal className="w-3 h-3" /> Nerd Logs</>}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {showNerdLogs ? (
          <motion.div key="nerd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            ref={scrollRef} className="flex-1 rounded-2xl p-5 font-mono text-[11px] overflow-y-auto custom-scrollbar relative scanline border border-taupe/40 shadow-inner"
            style={{ background: "rgba(26, 26, 46, 0.95)", color: "#e2e8f0" }}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
              <div className="text-[9px] font-bold text-emerald-500/80 flex items-center gap-2 uppercase tracking-widest">
                <Terminal className="w-3 h-3" /> Agentic_Stream_v4.log
              </div>
              <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                SYS_SECURE_GATEWAY
              </div>
            </div>

            {agenticTrace && (
              <div className="mb-6 space-y-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                    <Activity className="w-12 h-12 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Supervisor Intent</span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <p className="flex justify-between"><span className="text-white/40 italic">Determined Action:</span> <span className="text-amber-400 font-bold">{agenticTrace.action}</span></p>
                    <p className="flex justify-between"><span className="text-white/40 italic">Extracted Entities:</span> <span className="text-cyan-400">[{agenticTrace.keywords?.join(", ")}]</span></p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 text-slate-300 border border-emerald-900/30 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-cyan-400 rounded-full" />
                    <span className="text-[10px] font-black text-cyan-100 uppercase tracking-widest">Tool Execution Log</span>
                  </div>
                  <p className="text-[10px] leading-relaxed font-mono text-cyan-200/80 bg-black/40 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap">
                    {agenticTrace.tool_data}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-[9px] font-black text-emerald-400/40 pl-1 uppercase tracking-widest">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                  Sync status: 200_OK_VERIFIED
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              {thoughtProcess.length === 0 && !loading && !agenticTrace && !streamingOutput && (
                <div className="text-white/10 italic font-light">-- system_idle: awaiting_input_stream --</div>
              )}
              
              {thoughtProcess.map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }} className="flex gap-3 items-start opacity-60 hover:opacity-100 transition-opacity">
                  <span className="text-white/20 text-[9px] mt-0.5 min-w-[15px] font-bold">[{String(i + 1).padStart(2, "0")}]</span>
                  <span className="text-white/80">{step}</span>
                </motion.div>
              ))}

              {streamingOutput && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 bg-black/40 border border-white/10 rounded-lg text-emerald-400 font-mono text-[10px] whitespace-pre-wrap">
                  {streamingOutput}
                  <span className="animate-pulse ml-1 inline-block w-1.5 h-3 bg-emerald-500"/>
                </motion.div>
              )}
            </div>
            {loading && !streamingOutput && (
              <div className="mt-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                <div className="w-2 h-0.5 bg-white/10 animate-pulse delay-75" />
                <div className="w-3 h-0.5 bg-white/5 animate-pulse delay-150" />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="cute" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            ref={scrollRef} className="flex-1 glass-inner rounded-2xl p-5 overflow-y-auto custom-scrollbar">
            {thoughtProcess.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12" style={{ color: "var(--text-muted)" }}>
                <div className="text-4xl mb-3 opacity-40">💤</div>
                <p className="text-sm font-medium">Sugoi is idle. Waiting for you to break something.</p>
              </div>
            )}
            {thoughtProcess.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }} className="mb-3.5 flex items-start gap-3">
                <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px]"
                  style={{ background: "linear-gradient(135deg, var(--honey), var(--amber-glow))", color: "white" }}>
                  ✨
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-[13px] leading-relaxed font-medium glass-inner"
                  style={{ color: "var(--soft-black)" }}>
                  {translateLog(step)}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px]"
                  style={{ background: "linear-gradient(135deg, var(--honey), var(--amber-glow))", color: "white" }}>✨</div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm glass-inner">
                  <span className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--honey)", animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--honey-light)", animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--amber-glow)", animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
