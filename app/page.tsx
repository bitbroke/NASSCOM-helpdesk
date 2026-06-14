"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, CheckCircle2, ShieldAlert, Trash2, Wifi, WifiOff, Sparkles, Terminal, ChevronRight, Activity, LayoutDashboard, Database, Settings, BookOpen, Clock, LogOut, User as UserIcon, Sun, Moon } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { DualLogTerminal } from "@/components/sugoi/DualLogTerminal";
import { RoastQuickReplies } from "@/components/sugoi/RoastQuickReplies";
import { useSugoiStore } from "@/store/useSugoiStore";
import Link from "next/link";
import { processTicketWithFallback } from "@/lib/apiInterceptor";
import { ResolutionCard } from "@/components/sugoi/ResolutionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthModal } from "@/components/sugoi/AuthModal";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { VantaTrunk } from "@/components/sugoi/VantaTrunk";
import { FloatingGrid3D } from "@/components/sugoi/FloatingGrid3D";
import { GlowOrb } from "@/components/sugoi/GlowOrb";
import { AvatarWrapper } from "@/components/sugoi/AvatarWrapper";

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
  const [ticketBadge, setTicketBadge] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.dispatchEvent(new CustomEvent("sugoi-theme-toggle", { detail: { theme: nextTheme } }));
  };

  const toggleAirGapped = () => {
    const nextVal = !isAirGapped;
    setIsAirGapped(nextVal);
    window.dispatchEvent(new CustomEvent("sugoi-airgap-toggle", { detail: { airGapped: nextVal } }));
  };
  const [thoughtProcess, setThoughtProcess] = useState<string[]>([]);
  const [finalResolution, setFinalResolution] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [predictedCategory, setPredictedCategory] = useState<string | null>(null);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [currentTyping, setCurrentTyping] = useState<string | null>(null);
  const [streamingOutput, setStreamingOutput] = useState("");
  const [agenticTrace, setAgenticTrace] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authRedirectPath, setAuthRedirectPath] = useState('/');
  const [user, setUser] = useState<User | null>(null);
  const [lastSubmittedIssue, setLastSubmittedIssue] = useState("");
  const [repeatSubmitCount, setRepeatSubmitCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  const persona = useSugoiStore((s) => s.persona);
  const game = useSugoiStore((s) => s.game);
  const setMood = useSugoiStore((s) => s.setMood);
  const setPower = useSugoiStore((s) => s.setPower);
  const damageEnemy = useSugoiStore((s) => s.damageEnemy);
  const resetRPG = useSugoiStore((s) => s.resetRPG);
  const setChaosLevel = useSugoiStore((s) => s.setChaosLevel);
  const addAchievement = useSugoiStore((s) => s.addAchievement);
  const setProcessing = useSugoiStore((s) => s.setProcessing);
  const settings = useSugoiStore((s) => s.settings);

  const mood = persona.mood;

  const [activeTab, setActiveTab] = useState<"stream" | "resolution">("stream");

  useEffect(() => {
    setWelcomeMsg(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

    if (!supabase) return;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        // Only trigger modal if no user is signed in
        setTimeout(() => {
          setIsAuthModalOpen(true);
        }, 1500);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
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

  // Removed animationProps helper to avoid type spread issues

  function clearForm() {
    setIssueText(""); setLogText(""); setTicketStatus(null);
    setThoughtProcess([]); setFinalResolution(null);
    setThoughtProcess([]); setFinalResolution(null);
    setConfidenceScore(null); setPredictedCategory(null); resetRPG();
    setMood("idle"); setActiveTab("stream"); setAgenticTrace(null); setTicketBadge(null);
    setStreamingOutput("");
    setLastSubmittedIssue("");
    setRepeatSubmitCount(0);
    window.dispatchEvent(new CustomEvent("sugoi-repeat-submit", { detail: { count: 0 } }));
    window.dispatchEvent(new CustomEvent("sugoi-clear-form"));
  }

  async function submitTicket() {
    if (loading || !issueText.trim()) return;
    const trimmed = issueText.trim();
    if (trimmed === lastSubmittedIssue) {
      const newCount = repeatSubmitCount + 1;
      setRepeatSubmitCount(newCount);
      window.dispatchEvent(new CustomEvent("sugoi-repeat-submit", { detail: { count: newCount } }));
    } else {
      setLastSubmittedIssue(trimmed);
      setRepeatSubmitCount(0);
      window.dispatchEvent(new CustomEvent("sugoi-repeat-submit", { detail: { count: 0 } }));
    }

    setProcessing(true);
    setLoading(true); setTicketStatus(null); setThoughtProcess([]); setTicketBadge(null);
    setFinalResolution(null); setConfidenceScore(null); setPredictedCategory(null);
    setAgenticTrace(null); setStreamingOutput("");
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
      const data = await processTicketWithFallback(issueText, logText, !isAirGapped, {
        onThought: (t) => {
          setThoughtProcess(prev => [...prev, t]);
        },
        onToken: (tok) => {
          setStreamingOutput(prev => prev + tok);
        },
        onMetadata: (cat, conf) => {
          setPredictedCategory(cat);
          setConfidenceScore(conf);
          setPower(Math.floor(conf * 100));
          damageEnemy(Math.floor(conf * 100));
        }
      });
      setChaosLevel(game.chaosLevel - 10);
      
      // Mock the agentic trace since we integrated tool calling inside the API Route
      // and we display it live in thoughtProcess!
      setAgenticTrace({
        action: "DIAGNOSE_AND_RESOLVE",
        keywords: [data.category || "General"],
        tool_data: "See system telemetry for live tools."
      });

      if (data.status === "SUCCESS" || data.status === "AUTO_RESOLVED" || data.status === "VAULT_RESOLVED") {
        setTicketStatus("AUTO_RESOLVED");
        setTicketBadge(data.badge || "System Resolved");
        setFinalResolution(data.resolution);
        
        // Tier 0 & 1 (Instant Match): success arm-waving animation
        if (data.status === "VAULT_RESOLVED" || data.badge?.includes("Tier 1") || data.badge?.includes("Tier 0")) {
          setMood("happy");
        } else {
          setMood("happy");
        }
        setTimeout(() => setActiveTab("resolution"), 600);
      } else if (data.status === "NEEDS_HUMAN") {
        setTicketStatus("NEEDS_HUMAN");
        setTicketBadge(data.badge || "Review Recommended");
        setFinalResolution(data.resolution);
        setMood("thinking");
        setTimeout(() => setActiveTab("resolution"), 600);
      } else {
        // Tier 3 (Shadow Fallback / Out-of-Scope Garbage Filter)
        setTicketStatus("ESCALATED");
        setTicketBadge(data.badge || "Human Intervention Required");
        setFinalResolution(data.resolution || "Complexity exceeds autonomous limits. Routed to L2 human expert.");
        
        if (data.badge === "Invalid Request") {
          setMood("teased"); // Trigger teased/bored expression for prompt injection/out-of-scope garbage
        } else {
          setMood("crying"); // Shivering/distressed expression for standard escalation
        }
      }
    } catch (err: any) {
      if (err.message === "RATE_LIMIT_EXCEEDED") {
        setTicketStatus("ESCALATED");
        setTicketBadge("Rate Limited");
        setFinalResolution("Please wait. You have exceeded the rate limit of 5 requests per minute. Take a break and let Sugoi rest for a bit before trying again.");
        setMood("teased");
        toast.error("Rate limit exceeded. Too many requests.");
      } else {
        setTicketStatus("ESCALATED");
        setFinalResolution(`Error: ${err.message || "Unknown error occurred"}`);
        setMood("crying");
        toast.error("Process failed. Escalating...");
      }
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  }

  const confPercent = confidenceScore !== null ? Math.round(confidenceScore * 100) : null;
  const circumference = 2 * Math.PI * 40;
  const dashOffset = confPercent !== null ? circumference - (confPercent / 100) * circumference : circumference;
  const confColor = confPercent !== null ? (confPercent >= 65 ? "#16a34a" : confPercent >= 45 ? "#ca8a04" : "#dc2626") : "var(--honey)";

  return (
    <div className="min-h-screen w-full flex bg-taupe/10" style={{ color: "var(--charcoal)" }}>
      <Toaster position="top-right" toastOptions={{ style: { background: "var(--glass-bg)", backdropFilter: "blur(20px)", color: "var(--charcoal)", border: "1px solid var(--glass-border)", borderRadius: "16px", fontSize: "13px", fontWeight: "600" } }} />

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 min-h-screen flex flex-col overflow-hidden">
        <div id="main-scroll-container" className="flex-1 relative overflow-y-auto">
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[50%] rounded-full animate-blob" style={{ background: "radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />

            {/* Three.js Perspective Floor Grid */}
            <FloatingGrid3D />

            {/* Ambient Glow Orbs */}
            <GlowOrb color="rgba(212, 160, 23, 0.25)" size={200} className="top-[10%] right-[5%]" delay={0} depth={-30} />
            <GlowOrb color="rgba(245, 166, 35, 0.15)" size={150} className="bottom-[20%] left-[10%]" delay={2} depth={-20} />
            <GlowOrb color="rgba(251, 191, 36, 0.12)" size={100} className="top-[50%] left-[60%]" delay={4} depth={-15} intensity={0.7} />
          </div>

          <div className="relative z-10 flex flex-col gap-6 p-6">

            {/* ═══ TALL HERO HEADER (covers 100% height of screen) ═══ */}
            <div className="w-full min-h-screen lg:h-screen rounded-b-[32px] rounded-t-none p-8 md:p-12 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 text-slate-800 dark:text-slate-100">
              {/* Profile and Theme Controls at absolute top-right */}
              <div className="absolute top-6 right-6 flex items-center gap-4 z-30 glass-panel shadow-md px-4 py-2 rounded-full border border-taupe/20 dark:border-slate-800/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
                {/* Theme Toggle Button */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer bg-white/40 dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 transition-all border border-taupe/20 dark:border-slate-800/40"
                  title="Toggle Theme"
                >
                  {theme === "light" ? (
                    <Moon className="w-4 h-4 text-slate-700" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
                  )}
                </button>

                <button onClick={toggleAirGapped} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer bg-white/40 dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  style={{ color: isAirGapped ? "#dc2626" : "#16a34a", border: `1px solid ${isAirGapped ? "rgba(220,38,38,0.15)" : "rgba(34,197,94,0.15)"}` }}>
                  {isAirGapped ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                  {isAirGapped ? "Offline" : "Cloud"}
                </button>

                {user ? (
                  <div className="flex items-center gap-3 pl-4 border-l border-taupe/10 dark:border-slate-800/40">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-none">
                        {user.user_metadata.full_name || user.email?.split('@')[0]}
                      </span>
                      <button
                        onClick={() => supabase?.auth.signOut()}
                        className="text-[8px] font-bold text-taupe hover:text-red-500 transition-colors uppercase tracking-widest mt-0.5"
                      >
                        Sign Out
                      </button>
                    </div>
                    {user.user_metadata.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="w-8 h-8 rounded-full border border-brand-orange/20 shadow-sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center border border-brand-orange/20">
                        <UserIcon className="w-4 h-4 text-brand-orange" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pl-4 border-l border-taupe/10 dark:border-slate-800/40">
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    >
                      <UserIcon className="w-3 h-3" />
                      Sign In
                    </button>
                  </div>
                )}
              </div>

              {/* Decorative Background Orbs for Hero */}
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-amber-400/5 dark:bg-amber-500/10 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-[-30%] right-[-10%] w-[40%] h-[50%] rounded-full bg-amber-400/5 dark:bg-amber-500/10 blur-[90px] pointer-events-none" />

              {/* Horizontal Action Box on Left Side of Header - positioned absolutely at the top-left to be more at the top */}
              <div className="absolute top-6 left-11 z-30 glass-panel shadow-lg p-2.5 flex gap-4 items-center rounded-2xl w-fit border border-amber-500/20 dark:border-amber-400/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 dark:from-amber-400/5 dark:to-orange-400/5 backdrop-blur-xl hover:border-amber-500/35 transition-colors">
                {[
                  { icon: LayoutDashboard, id: "dashboard", active: true, href: "/" },
                  { icon: Database, id: "admin", active: false, href: "/admin" },
                  { icon: Settings, id: "settings", active: false, href: "/settings" },
                ].map((item) => {
                  const activeClasses = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5";
                  const inactiveClasses = "text-slate-500 dark:text-slate-400 hover:bg-amber-500/10 hover:text-amber-500 dark:hover:text-amber-400 hover:scale-105 border border-transparent";
                  if (item.id === "admin") {
                    return (
                      <motion.div key={item.id}
                        whileHover={{ rotateY: 180, rotateZ: 5, scale: 1.1 }} whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (!supabase) {
                            toast.error("Auth is disabled (missing Supabase configuration).");
                            return;
                          }
                          const { data: { session } } = await supabase.auth.getSession();
                          if (session) {
                            router.push('/admin');
                          } else {
                            setAuthRedirectPath('/admin');
                            setIsAuthModalOpen(true);
                          }
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 ${item.active ? activeClasses : inactiveClasses}`}
                      >
                        <item.icon className="w-[18px] h-[18px]" />
                      </motion.div>
                    );
                  }
                  return (
                    <Link key={item.id} href={item.href}>
                      <motion.div whileHover={{ rotateY: 180, rotateZ: 5, scale: 1.1 }} whileTap={{ scale: 0.95 }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 ${item.active ? activeClasses : inactiveClasses}`}
                      >
                        <item.icon className="w-[18px] h-[18px]" />
                      </motion.div>
                    </Link>
                  );
                })}
                <div className="w-[1px] h-6 bg-amber-500/20 dark:bg-amber-400/20" />
                <div className="flex flex-col items-center gap-0.5 px-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isAirGapped ? "bg-red-400" : "bg-green-400"}`} style={{ boxShadow: isAirGapped ? "0 0 8px rgba(248,113,113,0.6)" : "0 0 8px rgba(74,222,128,0.6)" }} />
                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{isAirGapped ? "OFF" : "ON"}</span>
                </div>
              </div>

              {/* Unified Left Content Box (covers 70% of the header height, connected to top screen) - transparent background */}
              <div className="flex flex-col justify-between pt-24 pb-8 pr-8 pl-12 h-fit lg:h-[70%] min-h-[480px] w-full max-w-lg z-10 self-start -mt-8 md:-mt-12">
                {/* Tagline/Headline content - positioned at the BOTTOM */}
                <div className="flex flex-col gap-4 text-left mt-auto">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 w-fit">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">Zero-Trust Helpdesk Triage</span>
                  </div>
                  <h2 className="text-3xl md:text-8xl font-bold font-ultra tracking-normal leading-tight text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    Sugoi Support.
                  </h2>
                    <h2  className="text-3xl md:text-5xl font-bold font-ultra tracking-normal leading-tight  text-amber-500 dark:text-amber-400 whitespace-nowrap">Your Tech Assistant
                  </h2>
                  <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                    A high-performance enterprise triage portal combining secure local AI inference, automated PII scrubbing, RAG search engines, and real-time incident resolution.
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Active Node Inference Enabled</span>
                  </div>
                </div>
              </div>



              {/* Right Side: Vanta Animation & VRM Anchor */}
              <div className="relative w-full lg:w-[50%] h-[400px] lg:h-[70%] flex items-center justify-center lg:justify-end overflow-visible z-10">
                {/* Vanta 1: Perfect Semicircle covering 100% screen height (h-screen) with width adjusted accordingly */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[140vh] w-[70vh] overflow-hidden z-0 rounded-l-full bg-transparent flex items-center justify-center">
                  <VantaTrunk theme={theme} accentColor={settings.accentColor} className="absolute left-0 top-0 w-[140vh] h-full border-0 shadow-none rounded-none bg-transparent" />
                </div>
              </div>
            </div>

            {/* Main Content Layout Grid (Sidebar, Input, Metrics) */}
            <div className="relative z-10 h-full flex gap-4 scene-3d">

              {/* ═══ STICKY SIDEBAR (Stays fixed next to input/solution box when scrolled) ═══ */}
              {settings.mascotVisible && (
                <motion.div
                  initial={settings.animationsEnabled ? { opacity: 0, x: -20 } : undefined}
                  animate={settings.animationsEnabled ? { opacity: 1, x: 0 } : undefined}
                  exit={settings.animationsEnabled ? { opacity: 0, x: -20 } : undefined}
                  transition={{ duration: 0.5 }}
                  className="w-[340px] shrink-0 flex flex-col gap-3 sticky top-[30px] z-30 self-start"
                >
                  {/* Character */}
                  <div className="w-full flex-1 min-h-[290px] flex items-center justify-center relative mb-2">
                    <div
                      id="sidebar-mascot-container"
                      className="absolute z-10 w-[480px] h-full left-[-100px] flex items-center justify-center"
                    >
                      <AvatarWrapper />
                    </div>
                  </div>

                  {/* Dialogue */}
                  <motion.div key={mood}
                    initial={settings.animationsEnabled ? { opacity: 0, y: 6 } : undefined}
                    animate={settings.animationsEnabled ? { opacity: 1, y: 0 } : undefined}
                    className="glass-panel border-taupe/40 rounded-2xl p-3 relative bg-white/40 h-[58px] flex items-center justify-center">
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 glass-panel border-taupe/40 bg-white/40" />
                    <p className="text-[11px] leading-relaxed font-bold text-center italic" style={{ color: "var(--soft-black)" }}>
                      {loading ? currentTyping : (finalResolution ? "Redemption Arc complete. (ᵕ—ᴗ—)" : (issueText ? "Analyzing your life choices... (☉_☉)" : welcomeMsg))}
                    </p>
                  </motion.div>

                  <Tilt3D containerClassName="w-full">
                    <div className="glass-panel border-taupe/40 rounded-2xl p-3" style={{ transformStyle: "preserve-3d" }}>
                      <div style={{ transform: "translateZ(30px)" }}>
                        <SectionHeader title="Quick Issues" />
                      </div>
                      <div style={{ transform: "translateZ(20px)" }}>
                        <RoastQuickReplies onSelect={(t) => setIssueText(t)} />
                      </div>
                    </div>
                  </Tilt3D>
                </motion.div>
              )}

              {/* ═══ LEFT: CHARACTER + INPUT (compact) (Moved to root level outside scroll container) ═══ */}

              {/* ═══ CENTER: INPUT + OUTPUT ═══ */}
              <motion.div
                initial={settings.animationsEnabled ? { opacity: 0, y: 20 } : undefined}
                animate={settings.animationsEnabled ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex-1 flex flex-col min-w-0 gap-6">

                {/* MAIN DESCRIBE ISSUE INPUT (Prominent Center) */}
                <div id="describe-issue-card" className="glass-panel border-taupe/60 rounded-3xl p-5 shadow-[0_12px_40px_-12px_rgba(168,154,128,0.25)] relative overflow-hidden">
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
                      <div className="relative bg-white/80 dark:bg-slate-950/80 border-2 border-taupe/20 dark:border-taupe/30 rounded-2xl p-4 focus-within:border-brand-orange/40 transition-all shadow-sm">
                        <textarea
                          id="describe-issue-input"
                          className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-taupe/30 dark:placeholder-taupe/50 resize-none text-lg font-bold leading-relaxed h-[110px] custom-scrollbar"
                          placeholder="e.g., 'VPN keeps disconnecting with TLS handshake timeout...' or 'DB cluster at 100% CPU...'"
                          value={issueText} onChange={(e) => setIssueText(e.target.value)}
                          maxLength={1000}
                        />

                        <div className="flex items-center justify-between mt-3 pt-4 border-t border-taupe/10">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-[10px] bg-taupe/5 dark:bg-slate-900/50 border-taupe/10 dark:border-taupe/30 text-taupe/70 dark:text-taupe/80 font-bold px-2">LOCAL INFERENCE</Badge>
                            <Badge variant="outline" className="text-[10px] bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold px-2">SCRUBBING ACTIVE</Badge>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              onClick={clearForm}
                              variant="ghost" className="h-10 px-4 text-taupe/60 dark:text-taupe/80 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-bold text-xs uppercase tracking-wider"
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
                <div className="flex-1 flex flex-col min-h-0 glass-panel border-taupe/40 rounded-2xl overflow-hidden h-[400px] max-h-[400px]">
                  <div className="flex p-1.5 shrink-0" style={{ borderBottom: "1px solid rgba(212,160,23,0.06)" }}>
                    <button onClick={() => { setActiveTab("stream"); window.dispatchEvent(new CustomEvent("sugoi-tab-change", { detail: { tab: "stream" } })); }}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "stream" ? "bg-white dark:bg-white/10 shadow-sm" : "hover:bg-white/40 dark:hover:bg-white/5"}`}
                      style={{ color: activeTab === "stream" ? "var(--charcoal)" : "var(--text-muted)" }}>
                      <Terminal className="w-3 h-3" /> Action Stream
                    </button>
                    <button onClick={() => { setActiveTab("resolution"); window.dispatchEvent(new CustomEvent("sugoi-tab-change", { detail: { tab: "resolution" } })); }}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "resolution" ? "bg-white dark:bg-white/10 shadow-sm" : "hover:bg-white/40 dark:hover:bg-white/5"}`}
                      style={{ color: activeTab === "resolution" ? "var(--charcoal)" : "var(--text-muted)" }}>
                      <BookOpen className="w-3 h-3" /> Solution
                      {finalResolution && ticketStatus === "AUTO_RESOLVED" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />}
                    </button>
                  </div>
                  <div className="flex-1 relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {activeTab === "stream" ? (
                        <motion.div key="stream"
                          initial={settings.animationsEnabled ? { opacity: 0 } : undefined}
                          animate={settings.animationsEnabled ? { opacity: 1 } : undefined}
                          exit={settings.animationsEnabled ? { opacity: 0 } : undefined}
                          className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar">
                          <DualLogTerminal thoughtProcess={thoughtProcess} loading={loading} agenticTrace={agenticTrace} streamingOutput={streamingOutput} />
                        </motion.div>
                      ) : (
                        <motion.div key="resolution"
                          initial={settings.animationsEnabled ? { opacity: 0, y: 8 } : undefined}
                          animate={settings.animationsEnabled ? { opacity: 1, y: 0 } : undefined}
                          exit={settings.animationsEnabled ? { opacity: 0 } : undefined}
                          className="absolute inset-0 p-5 overflow-y-auto custom-scrollbar">
                          {finalResolution ? (
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center gap-2 mb-2 pb-3" style={{ borderBottom: "1px solid rgba(212,160,23,0.1)" }}>
                                {ticketStatus === "AUTO_RESOLVED" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : ticketStatus === "NEEDS_HUMAN" ? <ShieldAlert className="w-4 h-4 text-amber-500" /> : <ShieldAlert className="w-4 h-4 text-red-500" />}
                                <span className="text-xs font-bold" style={{ color: ticketStatus === "AUTO_RESOLVED" ? "#16a34a" : ticketStatus === "NEEDS_HUMAN" ? "#d97706" : "#dc2626" }}>
                                  {ticketStatus === "AUTO_RESOLVED" ? "Auto-Resolved" : ticketStatus === "NEEDS_HUMAN" ? "Review Recommended" : "Escalated to Human"}
                                </span>
                                {ticketBadge && (
                                  <Badge variant="outline" className={`font-bold tracking-wide uppercase text-[9px] ml-auto ${ticketStatus === 'AUTO_RESOLVED' ? 'bg-green-50 text-green-700 border-green-200' : ticketStatus === 'NEEDS_HUMAN' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {ticketBadge}
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
              <motion.div
                initial={settings.animationsEnabled ? { opacity: 0, x: 20 } : undefined}
                animate={settings.animationsEnabled ? { opacity: 1, x: 0 } : undefined}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-[180px] shrink-0 flex flex-col gap-3">

                {/* Confidence Ring */}
                <Tilt3D containerClassName="w-full">
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
                </Tilt3D>

                {/* Category */}
                <Tilt3D containerClassName="w-full">
                  <div className="glass-panel border-taupe/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <Activity className="w-5 h-5 text-amber-500 mb-2" />
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold tracking-wide uppercase text-[10px]">
                      {predictedCategory || "Infrastructure"}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">Category</span>
                  </div>
                </Tilt3D>

                {/* RPG BATTLE UI */}
                <Tilt3D containerClassName="w-full">
                  <div className="glass-panel border-taupe/40 rounded-2xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-taupe uppercase tracking-widest">Sugoi HP</span>
                      <span className="text-[9px] font-black text-emerald-600">LVL 99</span>
                    </div>
                    <div className="w-full h-2 bg-taupe/10 rounded-full overflow-hidden">
                      <motion.div animate={settings.animationsEnabled ? { width: "100%" } : undefined} className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-black text-taupe uppercase tracking-widest">Bug Health</span>
                      <span className="text-[9px] font-black text-red-500">BOSS BATTLE</span>
                    </div>
                    <div className="w-full h-2 bg-taupe/10 rounded-full overflow-hidden">
                      <motion.div animate={settings.animationsEnabled ? { width: `${game.enemyHealth}%` } : undefined} className="h-full bg-gradient-to-r from-red-500 to-red-700" />
                    </div>
                  </div>
                </Tilt3D>

                {/* Chaos Meter */}
                <Tilt3D containerClassName="w-full">
                  <div className="glass-panel border-taupe/40 rounded-2xl p-3 flex flex-col items-center">
                    <span className="text-[8px] font-black text-taupe uppercase tracking-[0.2em] mb-2">Chaos Probability</span>
                    <div className="relative w-full h-8 bg-taupe/5 rounded-lg border border-taupe/20 overflow-hidden flex items-center justify-center">
                      <motion.div
                        animate={settings.animationsEnabled ? { width: `${game.chaosLevel}%` } : undefined}
                        className="absolute inset-0 bg-gradient-to-r from-brand-orange/10 to-brand-orange/40"
                      />
                      <span className="relative z-10 text-xs font-black text-taupe">{game.chaosLevel}%</span>
                    </div>
                  </div>
                </Tilt3D>



                {/* Pipeline */}
                <Tilt3D containerClassName="w-full">
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
                </Tilt3D>
              </motion.div>

            </div>
          </div>
        </div>
      </main>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthRedirectPath('/'); // Reset to default
        }}
        redirectPath={authRedirectPath}
      />
    </div>
  );
}
