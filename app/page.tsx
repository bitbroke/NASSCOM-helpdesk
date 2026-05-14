"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, CheckCircle2, ShieldAlert, Trash2, Wifi, WifiOff, Sparkles, Terminal, ChevronRight, Activity, LayoutDashboard, Database, Settings, BookOpen, Clock } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { DualLogTerminal } from "@/components/sugoi/DualLogTerminal";
import { RoastQuickReplies } from "@/components/sugoi/RoastQuickReplies";
import { useSugoiStore } from "@/store/useSugoiStore";
import Link from "next/link";
import { processTicketWithFallback } from "@/lib/apiInterceptor";
import { ResolutionCard } from "@/components/sugoi/ResolutionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MascotForMood: Record<string, string> = {
  idle: "/sugoi-idle.png",
  thinking: "/sugoi-focus.png",
  judging: "/sugoi-judge.png",
  "dead-inside": "/sugoi-judge.png",
  "glowing-eyes": "/sugoi-judge.png",
  crying: "/sugoi-fail.png",
  happy: "/sugoi-win.png",
};

const GREETINGS = [
  "Welcome to the Crash Shrine, I am Sugoi to fix problems caused by confidence.",
  "Welcome to the Panic Portal, I am Sugoi to professionally google your issue.",
  "Welcome to the Reboot Realm, I am Sugoi to ask if you tried turning it off and on again.",
  "Welcome to the Lag Lounge, I am Sugoi to suffer through unstable Wi-Fi with you.",
  "Welcome to the Bug Dungeon, I am Sugoi to debug your code and your life choices.",
  "Welcome to the Glitch Garden, I am Sugoi to water your bugs until they become features.",
  "Welcome to Ticket-sama’s Palace, I am Sugoi to answer tickets marked ‘URGENT’ for no reason.",
  "Welcome to the Error Dojo, I am Sugoi to restore peace, stability, and missing files.",
  "Welcome to the Blue Screen Café, I am Sugoi to serve hot fixes and emotional support.",
  "Welcome to the Chaos Cluster, I am Sugoi to survive your deployment decisions.",
  "Welcome to the Wi-Fi Wasteland, I am Sugoi to reconnect humanity one router at a time.",
  "Welcome to the Ctrl+Alt+Del Temple, I am Sugoi to resurrect frozen laptops.",
  "Welcome to the Escalation Abyss, I am Sugoi to explain why the printer is spiritually broken.",
  "Welcome to the Productivity Graveyard, I am Sugoi to fight the ancient curse called ‘Excel corruption.’",
  "Welcome to DevOops Headquarters, I am Sugoi to protect production from interns.",
  "Welcome to Cache-sama’s Domain, I am Sugoi to blame everything on cached data.",
  "Welcome to the Forbidden Server Room, I am Sugoi to touch cables dramatically until things work.",
  "Welcome to the Technical Support Arc, I am Sugoi to carry your team harder than the backend server.",
  "Welcome to the Digital Disaster Dojo, I am Sugoi to fix bugs created moments before the deadline."
];

const TYPING_STATUSES = [
  "Sugoi is questioning your ticket...",
  "Searching ancient Stack Overflow scrolls...",
  "Pretending this is documented...",
  "Fighting demons inside the server...",
  "Consulting the Silicon Gods...",
  "Applying emergency kawaii protocols...",
  "Buffering emotional intelligence..."
];

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 w-full my-4">
      <hr className="flex-1 border-taupe/30" />
      <h3 className="text-[10px] font-bold text-taupe uppercase tracking-widest">
        {title}
      </h3>
      <hr className="flex-1 border-taupe/30" />
    </div>
  );
}

export default function SubmissionPortal() {
  const [issueText, setIssueText] = useState("");
  const [logText, setLogText] = useState("");
  const [isAirGapped, setIsAirGapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [thoughtProcess, setThoughtProcess] = useState<string[]>([]);
  const [finalResolution, setFinalResolution] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [predictedCategory, setPredictedCategory] = useState<string | null>(null);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [currentTyping, setCurrentTyping] = useState<string | null>(null);
  const [agenticTrace, setAgenticTrace] = useState<any>(null);

  const persona = useSugoiStore((s) => s.persona);
  const game = useSugoiStore((s) => s.game);
  const setMood = useSugoiStore((s) => s.setMood);
  const setPower = useSugoiStore((s) => s.setPower);
  const damageEnemy = useSugoiStore((s) => s.damageEnemy);
  const resetRPG = useSugoiStore((s) => s.resetRPG);
  const setChaosLevel = useSugoiStore((s) => s.setChaosLevel);
  const addAchievement = useSugoiStore((s) => s.addAchievement);
  const settings = useSugoiStore((s) => s.settings);

  const mood = persona.mood;

  const [activeTab, setActiveTab] = useState<"stream" | "resolution">("stream");

  useEffect(() => {
    setWelcomeMsg(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }, []);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setCurrentTyping(TYPING_STATUSES[Math.floor(Math.random() * TYPING_STATUSES.length)]);
      }, 2000);
      setCurrentTyping(TYPING_STATUSES[0]);
      return () => clearInterval(interval);
    } else {
      setCurrentTyping(null);
    }
  }, [loading]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 8, y: (e.clientY / window.innerHeight - 0.5) * 4 });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--honey', settings.accentColor);
    // Approximate a lighter version for gradients
    const hex = settings.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--honey-light', `rgba(${r}, ${g}, ${b}, 0.6)`);
  }, [settings.accentColor]);

  const animationProps = settings.animationsEnabled ? {} : { animate: false, initial: false, exit: false };

  function clearForm() {
    setIssueText(""); setLogText(""); setTicketStatus(null);
    setThoughtProcess([]); setFinalResolution(null);
    setConfidenceScore(null); setPredictedCategory(null); resetRPG();
    setMood("idle"); setActiveTab("stream"); setAgenticTrace(null);
  }

  async function submitTicket() {
    if (loading || !issueText.trim()) return;
    setLoading(true); setTicketStatus(null); setThoughtProcess([]);
    setFinalResolution(null); setConfidenceScore(null); setPredictedCategory(null);
    setAgenticTrace(null);
    resetRPG(); setMood("thinking"); setActiveTab("stream");
    setThoughtProcess(["System initialized. Opening secure pipeline..."]);

    try {
      if (issueText.length > 50) {
        addAchievement({ id: "desc_pro", title: "Explained Problem Clearly", icon: "💎" });
      }
      if (logText.trim().length > 0) {
        addAchievement({ id: "log_master", title: "Actually Attached Logs", icon: "🏆" });
      }

      setChaosLevel(game.chaosLevel + 15);
      const data = await processTicketWithFallback(issueText, logText, !isAirGapped);
      setChaosLevel(game.chaosLevel - 10);
      setAgenticTrace({
        action: data.supervisor_action,
        keywords: data.keywords,
        tool_data: data.tool_data
      });
      setThoughtProcess(data.thoughtProcess || []);
      setPredictedCategory(data.category || null);
      
      if (data.status === "SUCCESS") {
        setTicketStatus("AUTO_RESOLVED");
        setFinalResolution(data.resolution);
        setConfidenceScore(data.confidenceScore);
        
        if (data.confidenceScore) {
          setPower(Math.floor(data.confidenceScore * 100));
          damageEnemy(Math.floor(data.confidenceScore * 100));
        }
        
        setMood("happy");
        setTimeout(() => setActiveTab("resolution"), 600);
      } else {
        setTicketStatus("ESCALATED");
        setFinalResolution("Complexity exceeds autonomous limits. Routed to L2 human expert.");
        setConfidenceScore(data.confidenceScore);
        setMood("crying");
      }
    } catch (err: any) {
      setTicketStatus("ESCALATED");
      setFinalResolution(`Error: ${err.message || "Unknown error occurred"}`);
      setMood("crying");
      toast.error("Process failed. Escalating...");
    } finally {
      setLoading(false);
    }
  }

  const confPercent = confidenceScore !== null ? Math.round(confidenceScore * 100) : null;
  const circumference = 2 * Math.PI * 40;
  const dashOffset = confPercent !== null ? circumference - (confPercent / 100) * circumference : circumference;
  const confColor = confPercent !== null ? (confPercent >= 65 ? "#16a34a" : confPercent >= 45 ? "#ca8a04" : "#dc2626") : "var(--honey)";

  return (
    <div className="min-h-screen w-full flex bg-taupe/10" style={{ color: "var(--charcoal)" }}>
      <Toaster position="top-right" toastOptions={{ style: { background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", color: "var(--charcoal)", border: "1px solid rgba(212,160,23,0.2)", borderRadius: "16px", fontSize: "13px", fontWeight: "600" } }} />

      {/* ═══ SIDEBAR ═══ */}
      <aside className="hidden md:flex w-[68px] shrink-0 h-screen sticky top-0 flex-col items-center py-5 gap-1.5 z-50" style={{ borderRight: "1px solid rgba(212,160,23,0.08)" }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5 font-black text-white text-sm" style={{ background: "linear-gradient(135deg, var(--honey), var(--honey-light))" }}>S</div>
        {[
          { icon: LayoutDashboard, id: "dashboard", active: true, href: "/" },
          { icon: Database, id: "admin", active: false, href: "/admin" },
          { icon: Settings, id: "settings", active: false, href: "/settings" },
        ].map((item) => (
          <Link key={item.id} href={item.href}>
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 ${item.active ? "sidebar-icon-active" : "hover:bg-white/60"}`}
              style={!item.active ? { color: "var(--text-muted)" } : {}}>
              <item.icon className="w-[18px] h-[18px]" />
            </motion.div>
          </Link>
        ))}
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className={`w-2 h-2 rounded-full ${isAirGapped ? "bg-red-400" : "bg-green-400"}`} style={{ boxShadow: isAirGapped ? "0 0 8px rgba(248,113,113,0.6)" : "0 0 8px rgba(74,222,128,0.6)" }} />
          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{isAirGapped ? "OFF" : "ON"}</span>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 min-h-screen flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 flex items-center justify-between px-6 z-30" style={{ borderBottom: "1px solid rgba(212,160,23,0.06)" }}>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold font-display" style={{ color: "var(--charcoal)" }}>Triage Console</h1>
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(212,160,23,0.08)", color: "var(--honey)" }}>v3.2</span>
          </div>
          <button onClick={() => setIsAirGapped(!isAirGapped)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer glass-inner hover:bg-white/60"
            style={{ color: isAirGapped ? "#dc2626" : "#16a34a", border: `1px solid ${isAirGapped ? "rgba(220,38,38,0.15)" : "rgba(34,197,94,0.15)"}` }}>
            {isAirGapped ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {isAirGapped ? "Offline" : "Cloud"}
          </button>
        </header>

        <div className="flex-1 relative overflow-y-auto">
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[50%] rounded-full animate-blob" style={{ background: "radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
          </div>

          <div className="relative z-10 h-full flex gap-4 p-4">

            {/* ═══ LEFT: CHARACTER + INPUT (compact) ═══ */}
            {settings.mascotVisible && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} {...animationProps}
                className="w-[240px] shrink-0 flex flex-col gap-3">

              {/* Character */}
              <div className="glass-panel border-taupe/40 rounded-3xl p-3 flex flex-col items-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 transition-all duration-1000" style={{
                  background: mood === "happy" ? "radial-gradient(circle at 50% 60%, rgba(34,197,94,0.3), transparent 70%)" :
                    mood === "crying" ? "radial-gradient(circle at 50% 60%, rgba(239,68,68,0.3), transparent 70%)" :
                    mood === "thinking" ? "radial-gradient(circle at 50% 60%, rgba(59,130,246,0.3), transparent 70%)" :
                    "radial-gradient(circle at 50% 60%, rgba(212,160,23,0.2), transparent 70%)"
                }} />
                <motion.div animate={{ y: loading ? [0, -6, 0] : [0, -3, 0], rotate: mousePos.x * 0.3 }}
                  transition={{ y: { duration: loading ? 1.5 : 3, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 0.3 } }}
                  className="relative z-10 w-32 h-32">
                  <img src={MascotForMood[mood] || "/sugoi-idle.png"} alt="Sugoi" className="w-full h-full object-contain drop-shadow-lg transition-all duration-500" />
                </motion.div>
                <div className="flex items-center gap-2 mt-1 relative z-10">
                  <h3 className="text-sm font-bold font-display text-gradient-honey">Sugoi</h3>
                  <div className={`w-1.5 h-1.5 rounded-full ${loading ? "animate-pulse" : ""}`}
                    style={{ background: mood === "happy" ? "#22c55e" : mood === "crying" ? "#ef4444" : "var(--honey)" }} />
                </div>
              </div>

              {/* Dialogue */}
              <motion.div key={mood} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="glass-panel border-taupe/40 rounded-2xl p-3 relative bg-white/40">
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 glass-panel border-taupe/40 bg-white/40" />
                <p className="text-[11px] leading-relaxed font-bold text-center italic" style={{ color: "var(--soft-black)" }}>
                  {loading ? currentTyping : (finalResolution ? "Redemption Arc complete. (ᵕ—ᴗ—)" : (issueText ? "Analyzing your life choices... (☉_☉)" : welcomeMsg))}
                </p>
              </motion.div>

                <div className="glass-panel border-taupe/40 rounded-2xl p-3">
                  <SectionHeader title="Quick Issues" />
                  <RoastQuickReplies onSelect={(t) => setIssueText(t)} />
                </div>
              </motion.div>
            )}

            {/* ═══ CENTER: INPUT + OUTPUT ═══ */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1 flex flex-col min-w-0 gap-6">

              {/* MAIN DESCRIBE ISSUE INPUT (Prominent Center) */}
              <div className="glass-panel border-taupe/60 rounded-3xl p-5 shadow-[0_12px_40px_-12px_rgba(168,154,128,0.25)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Terminal className="w-24 h-24" />
                </div>
                
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-taupe uppercase tracking-[0.2em] flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-brand-orange" /> Describe your IT Issue
                    </label>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-taupe/40 uppercase tracking-widest">Pipeline v3.2</span>
                      <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-brand-orange animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-taupe/20" />
                        <div className="w-1 h-1 rounded-full bg-taupe/20" />
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-taupe/20 to-brand-orange/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition duration-700" />
                    <div className="relative bg-white/80 border-2 border-taupe/20 rounded-2xl p-4 focus-within:border-brand-orange/40 transition-all shadow-sm">
                      <textarea 
                        className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-taupe/30 resize-none text-lg font-bold leading-relaxed h-[110px] custom-scrollbar"
                        placeholder="e.g., 'VPN keeps disconnecting with TLS handshake timeout...' or 'DB cluster at 100% CPU...'"
                        value={issueText} onChange={(e) => setIssueText(e.target.value)}
                        maxLength={1000}
                      />
                      
                      <div className="flex items-center justify-between mt-3 pt-4 border-t border-taupe/10">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px] bg-taupe/5 border-taupe/10 text-taupe/70 font-bold px-2">LOCAL INFERENCE</Badge>
                          <Badge variant="outline" className="text-[10px] bg-emerald-50/50 border-emerald-100 text-emerald-600 font-bold px-2">SCRUBBING ACTIVE</Badge>
                        </div>
                        
                        <div className="flex gap-3">
                          <Button 
                            onClick={clearForm}
                            variant="ghost" className="h-10 px-4 text-taupe/60 hover:text-red-500 hover:bg-red-50 transition-colors font-bold text-xs uppercase tracking-wider"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear
                          </Button>
                          <Button 
                            onClick={submitTicket}
                            disabled={loading || !issueText.trim()}
                            className={`h-11 px-8 ${loading ? 'glitch-bg' : ''} bg-brand-orange hover:bg-orange-500 text-gray-900 font-black shadow-lg shadow-brand-orange/20 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]`}
                          >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} 
                            {loading ? "EMERGENCY PROTOCOLS..." : "SUMMON INCIDENT"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div className="glass-panel border-taupe/40 rounded-2xl flex flex-col overflow-hidden flex-1 min-h-0">
                <div className="flex p-1.5 shrink-0" style={{ borderBottom: "1px solid rgba(212,160,23,0.06)" }}>
                  <button onClick={() => setActiveTab("stream")}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "stream" ? "bg-white shadow-sm" : "hover:bg-white/40"}`}
                    style={{ color: activeTab === "stream" ? "var(--charcoal)" : "var(--text-muted)" }}>
                    <Terminal className="w-3 h-3" /> Action Stream
                  </button>
                  <button onClick={() => setActiveTab("resolution")}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "resolution" ? "bg-white shadow-sm" : "hover:bg-white/40"}`}
                    style={{ color: activeTab === "resolution" ? "var(--charcoal)" : "var(--text-muted)" }}>
                    <BookOpen className="w-3 h-3" /> Solution
                    {finalResolution && ticketStatus === "AUTO_RESOLVED" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />}
                  </button>
                </div>
                <div className="flex-1 relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    {activeTab === "stream" ? (
                      <motion.div key="stream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar">
                        <DualLogTerminal thoughtProcess={thoughtProcess} loading={loading} agenticTrace={agenticTrace} />
                      </motion.div>
                    ) : (
                      <motion.div key="resolution" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 p-5 overflow-y-auto custom-scrollbar">
                        {finalResolution ? (
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 mb-2 pb-3" style={{ borderBottom: "1px solid rgba(212,160,23,0.1)" }}>
                              {ticketStatus === "AUTO_RESOLVED" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <ShieldAlert className="w-4 h-4 text-red-500" />}
                              <span className="text-xs font-bold" style={{ color: ticketStatus === "AUTO_RESOLVED" ? "#16a34a" : "#dc2626" }}>
                                {ticketStatus === "AUTO_RESOLVED" ? "Auto-Resolved" : "Escalated to Human"}
                              </span>
                              {predictedCategory && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold tracking-wide uppercase text-[9px] ml-auto">
                                  {predictedCategory}
                                </Badge>
                              )}
                            </div>
                            <ResolutionCard resolutionText={finalResolution} />
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                            <BookOpen className="w-8 h-8 mb-3 opacity-15" style={{ color: "var(--honey)" }} />
                            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>No solution yet</p>
                            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Submit a ticket to see Sugoi&apos;s solution here.</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* ═══ RIGHT: METRICS (compact) ═══ */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="w-[180px] shrink-0 flex flex-col gap-3">

              {/* Confidence Ring */}
              <div className="glass-panel border-taupe/40 rounded-2xl p-4 flex flex-col items-center relative">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(212,160,23,0.1)" strokeWidth="5" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={confColor} strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: "20px" }}>
                  <span className="text-xl font-black font-display" style={{ color: confColor }}>{confPercent !== null ? `${confPercent}%` : "--"}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: "var(--text-muted)" }}>Confidence</span>
              </div>

              {/* Category */}
              <div className="glass-panel border-taupe/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <Activity className="w-5 h-5 text-amber-500 mb-2" />
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold tracking-wide uppercase text-[10px]">
                  {predictedCategory || "Infrastructure"}
                </Badge>
                <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">Category</span>
              </div>

              {/* RPG BATTLE UI */}
              <div className="glass-panel border-taupe/40 rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-taupe uppercase tracking-widest">Sugoi HP</span>
                  <span className="text-[9px] font-black text-emerald-600">LVL 99</span>
                </div>
                <div className="w-full h-2 bg-taupe/10 rounded-full overflow-hidden">
                  <motion.div animate={{ width: "100%" }} className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] font-black text-taupe uppercase tracking-widest">Bug Health</span>
                  <span className="text-[9px] font-black text-red-500">BOSS BATTLE</span>
                </div>
                <div className="w-full h-2 bg-taupe/10 rounded-full overflow-hidden">
                  <motion.div animate={{ width: `${game.enemyHealth}%` }} className="h-full bg-gradient-to-r from-red-500 to-red-700" />
                </div>
              </div>

              {/* Chaos Meter */}
              <div className="glass-panel border-taupe/40 rounded-2xl p-3 flex flex-col items-center">
                <span className="text-[8px] font-black text-taupe uppercase tracking-[0.2em] mb-2">Chaos Probability</span>
                <div className="relative w-full h-8 bg-taupe/5 rounded-lg border border-taupe/20 overflow-hidden flex items-center justify-center">
                  <motion.div 
                    animate={{ width: `${game.chaosLevel}%` }} 
                    className="absolute inset-0 bg-gradient-to-r from-brand-orange/10 to-brand-orange/40" 
                  />
                  <span className="relative z-10 text-xs font-black text-taupe">{game.chaosLevel}%</span>
                </div>
              </div>

              {/* Achievements */}
              {game.achievements.length > 0 && (
                <div className="glass-panel border-taupe/40 rounded-2xl p-3">
                  <SectionHeader title="Achievements" />
                  <div className="flex flex-wrap gap-2">
                    {game.achievements.map((a) => (
                      <div key={a.id} title={a.title} className="w-8 h-8 rounded-lg bg-white/60 border border-taupe/20 flex items-center justify-center text-sm shadow-sm hover:scale-110 transition-transform">
                        {a.icon}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pipeline */}
              <div className="glass-panel border-taupe/40 rounded-2xl p-3 space-y-2">
                <SectionHeader title="Pipeline" />
                {[
                  { label: "PII Scrub", done: thoughtProcess.length > 2 },
                  { label: "Embedding", done: thoughtProcess.length > 4 },
                  { label: "RAG Search", done: thoughtProcess.length > 6 },
                  { label: "ONNX Triage", done: thoughtProcess.length > 8 },
                  { label: "Synthesis", done: !!finalResolution },
                ].map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm ${!step.done ? "opacity-60" : ""}`}>
                    {step.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className={`font-medium ${step.done ? "text-slate-700" : "text-slate-500"}`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}
