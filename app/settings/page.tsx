"use client";
import { motion } from "framer-motion";
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Zap, 
  Brain, 
  ShieldAlert, 
  Trash2, 
  Database, 
  Download, 
  Bell, 
  Palette, 
  Ghost, 
  Hash,
  ChevronRight,
  ChevronLeft,
  Monitor,
  Webhook,
  Activity,
  Bot
} from "lucide-react";
import { useSugoiStore } from "@/store/useSugoiStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Tilt3D } from "@/components/ui/Tilt3D";

export default function SettingsPage() {
  const settings = useSugoiStore((s) => s.settings);
  const updateSettings = useSugoiStore((s) => s.updateSettings);
  const resetAll = useSugoiStore((s) => s.resetAll);

  const handleClearCache = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'Purging Vector Cache...',
        success: 'Local embeddings flushed ✓',
        error: 'Failed to clear cache.',
      }
    );
  };

  const handlePurgeHistory = () => {
    const confirmed = confirm("Are you sure? This will permanently delete all ticket history from Postgres.");
    if (confirmed) {
      toast.success("Database purged. System reset to zero.");
      resetAll();
    }
  };

  const handleExportLogs = () => {
    toast.success("Telemetry logs exported as sugoi_trace.json");
  };

  return (
    <div className="min-h-screen bg-taupe/10 p-4 md:p-8 flex flex-col gap-8 max-w-6xl mx-auto">
      
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link href="/" className="flex items-center gap-2 text-[10px] font-black text-taupe hover:text-honey transition-colors uppercase tracking-[0.2em]">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm" 
               style={{ background: "linear-gradient(135deg, var(--honey), var(--honey-light))" }}>
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight text-3d">System Settings</h1>
            <p className="text-xs font-bold text-taupe uppercase tracking-widest">Global Configuration & Multi-Agent Triage</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 scene-3d">
        
        {/* 1. AI & Agent Configuration */}
        <Tilt3D maxTilt={4} containerClassName="w-full">
        <motion.section 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel border-taupe/40 rounded-3xl p-6 flex flex-col gap-6 neon-glow-subtle"
        >
          <div className="flex items-center gap-3 border-b border-taupe/10 pb-4">
            <Cpu className="w-5 h-5 text-honey" />
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">AI & Agent Configuration</h2>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-taupe uppercase tracking-widest">Active Routing Model</label>
              <select 
                value={settings.activeModel}
                onChange={(e) => updateSettings({ activeModel: e.target.value })}
                className="w-full bg-white/60 dark:bg-slate-900/60 border border-taupe/20 dark:border-taupe/30 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 outline-honey"
              >
                <option value="llama3-8b-8192">Groq Llama-3-8B (Ultra Low Latency)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Deep Context)</option>
                <option value="gpt-4o">GPT-4o (Reasoning Mode)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-taupe uppercase tracking-widest">Auto-Resolve Threshold</label>
                <span className="text-xs font-black text-honey">{settings.autoResolveThreshold}%</span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={settings.autoResolveThreshold}
                onChange={(e) => updateSettings({ autoResolveThreshold: parseInt(e.target.value) })}
                className="w-full h-2 bg-taupe/20 rounded-lg appearance-none cursor-pointer accent-honey"
              />
              <p className="text-[9px] text-taupe/60 italic font-medium leading-tight">
                If the model confidence score is above this threshold, the ticket will be closed without human intervention.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-900/40 border border-taupe/10 dark:border-taupe/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Shadow Brain Fallback</h4>
                  <p className="text-[9px] text-taupe font-bold uppercase tracking-tighter">Deterministic Offline Mode</p>
                </div>
              </div>
              <button 
                onClick={() => updateSettings({ shadowBrainEnabled: !settings.shadowBrainEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.shadowBrainEnabled ? 'bg-emerald-500' : 'bg-taupe/20'}`}
              >
                <motion.div 
                  animate={{ x: settings.shadowBrainEnabled ? 26 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-taupe uppercase tracking-widest">System Persona Prompt</label>
              <textarea 
                value={settings.personaPrompt}
                onChange={(e) => updateSettings({ personaPrompt: e.target.value })}
                className="w-full bg-white/60 dark:bg-slate-900/60 border border-taupe/20 dark:border-taupe/30 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-honey h-24 resize-none leading-relaxed"
              />
            </div>
          </div>
        </motion.section>
        </Tilt3D>

        {/* 2. Integration & Webhooks */}
        <Tilt3D maxTilt={4} containerClassName="w-full">
        <motion.section 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-panel border-taupe/40 rounded-3xl p-6 flex flex-col gap-6 neon-glow-subtle"
        >
          <div className="flex items-center gap-3 border-b border-taupe/10 pb-4">
            <Webhook className="w-5 h-5 text-honey" />
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Integrations & Webhooks</h2>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-taupe uppercase tracking-widest">Discord Webhook URL</label>
              <div className="relative">
                <input 
                  type="password"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={settings.discordWebhook}
                  onChange={(e) => updateSettings({ discordWebhook: e.target.value })}
                  className="w-full bg-white/60 dark:bg-slate-900/60 border border-taupe/20 dark:border-taupe/30 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 outline-honey pr-10"
                />
                <Bell className="absolute right-3 top-3 w-4 h-4 text-taupe/40" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-900/40 border border-taupe/10 dark:border-taupe/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">S</div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Slack Integration</h4>
                  <p className="text-[9px] text-taupe font-bold uppercase tracking-tighter">Real-time Alerting</p>
                </div>
              </div>
              <button 
                onClick={() => updateSettings({ slackEnabled: !settings.slackEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.slackEnabled ? 'bg-blue-500' : 'bg-taupe/20'}`}
              >
                <motion.div 
                  animate={{ x: settings.slackEnabled ? 26 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-2 p-3 bg-white/40 dark:bg-slate-900/40 border border-taupe/10 dark:border-taupe/20 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all font-bold text-[10px] text-taupe dark:text-taupe/90 uppercase tracking-widest">
                Jira Cloud Sync
                <ChevronRight className="w-3 h-3" />
              </button>
              <button className="flex items-center justify-center gap-2 p-3 bg-white/40 dark:bg-slate-900/40 border border-taupe/10 dark:border-taupe/20 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all font-bold text-[10px] text-taupe dark:text-taupe/90 uppercase tracking-widest">
                ServiceNow Auth
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.section>
        </Tilt3D>

        {/* 3. Appearance & Accessibility */}
        <Tilt3D maxTilt={4} containerClassName="w-full">
        <motion.section 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-panel border-taupe/40 rounded-3xl p-6 flex flex-col gap-6 neon-glow-subtle"
        >
          <div className="flex items-center gap-3 border-b border-taupe/10 pb-4">
            <Palette className="w-5 h-5 text-honey" />
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Appearance & Vibe</h2>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-taupe uppercase tracking-widest">Accent Color Palette</label>
              <div className="flex gap-3">
                {["#D4A017", "#EC4899", "#06B6D4", "#10B981", "#6366F1"].map((color) => (
                  <button 
                    key={color}
                    onClick={() => updateSettings({ accentColor: color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${settings.accentColor === color ? 'border-slate-800 dark:border-slate-200 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-900/40 border border-taupe/10 dark:border-taupe/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-honey" />
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Rich Animations</h4>
                  <p className="text-[9px] text-taupe font-bold uppercase tracking-tighter">Framer Motion & 3D Shaders</p>
                </div>
              </div>
              <button 
                onClick={() => updateSettings({ animationsEnabled: !settings.animationsEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.animationsEnabled ? 'bg-honey' : 'bg-taupe/20'}`}
              >
                <motion.div 
                  animate={{ x: settings.animationsEnabled ? 26 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-900/40 border border-taupe/10 dark:border-taupe/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4 text-honey" />
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Mascot Visibility</h4>
                  <p className="text-[9px] text-taupe font-bold uppercase tracking-tighter">Toggle Sugoi Character</p>
                </div>
              </div>
              <button 
                onClick={() => updateSettings({ mascotVisible: !settings.mascotVisible })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.mascotVisible ? 'bg-honey' : 'bg-taupe/20'}`}
              >
                <motion.div 
                  animate={{ x: settings.mascotVisible ? 26 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                />
              </button>
            </div>
          </div>
        </motion.section>
        </Tilt3D>

        {/* 4. Danger Zone */}
        <Tilt3D maxTilt={4} containerClassName="w-full">
        <motion.section 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-panel border-red-200/50 rounded-3xl p-6 flex flex-col gap-6 bg-red-50/10 neon-glow-subtle"
        >
          <div className="flex items-center gap-3 border-b border-red-100 pb-4">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Danger Zone</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-900/60 border border-red-100 dark:border-red-950/30 rounded-2xl">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Clear Vector Cache</h4>
                <p className="text-[9px] text-taupe/70 font-bold uppercase tracking-tighter">Force rebuild local embeddings</p>
              </div>
              <Button onClick={handleClearCache} variant="ghost" className="h-9 px-4 text-red-500 hover:bg-red-50 font-bold text-[10px] uppercase tracking-widest border border-red-100">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Flush Cache
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-900/60 border border-red-100 dark:border-red-950/30 rounded-2xl">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Purge Ticket History</h4>
                <p className="text-[9px] text-taupe/70 font-bold uppercase tracking-tighter">Delete all Postgres ticket records</p>
              </div>
              <Button onClick={handlePurgeHistory} variant="ghost" className="h-9 px-4 text-red-600 hover:bg-red-100 font-bold text-[10px] uppercase tracking-widest border border-red-200">
                <Database className="w-3.5 h-3.5 mr-2" /> Purge DB
              </Button>
            </div>

            <Button onClick={handleExportLogs} className="w-full h-11 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Download Telemetry Logs
            </Button>
          </div>
        </motion.section>
        </Tilt3D>

      </div>
      
      <div className="flex justify-center py-8">
        <p className="text-[10px] font-bold text-taupe/40 uppercase tracking-[0.3em]">Sugoi Core v3.2 // Build 0514-A</p>
      </div>
    </div>
  );
}
