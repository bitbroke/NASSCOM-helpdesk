import { create } from 'zustand';

// ─── Mood Types ────────────────────────────────────────────
export type Mood = 'idle' | 'judging' | 'dead-inside' | 'glowing-eyes' | 'crying' | 'happy' | 'thinking';

// ─── ML Telemetry Slice ────────────────────────────────────
interface MLTelemetry {
  logs: string[];
  confidenceScore: number | null;
  predictedCategory: string | null;
  isProcessing: boolean;
}

// ─── Sugoi Persona Slice ───────────────────────────────────
interface SugoiPersona {
  mood: Mood;
  dialogueQueue: string[];
  currentDialogue: string | null;
  typingStatus: string | null;
}

// ─── Gamification Slice ────────────────────────────────────
interface Gamification {
  enemyHealth: number;
  power: number;
  comboCounter: number;
  damageLog: string[];
  particleBurst: boolean;
  chaosLevel: number;
  achievements: { id: string; title: string; icon: string }[];
}

// ─── Settings Slice ────────────────────────────────────────
interface SugoiSettings {
  activeModel: string;
  autoResolveThreshold: number;
  shadowBrainEnabled: boolean;
  personaPrompt: string;
  discordWebhook: string;
  slackEnabled: boolean;
  accentColor: string;
  animationsEnabled: boolean;
  mascotVisible: boolean;
}

// ─── Combined State ────────────────────────────────────────
interface SugoiState {
  // ML Telemetry
  ml: MLTelemetry;
  // Persona
  persona: SugoiPersona;
  // Gamification
  game: Gamification;
  // Settings
  settings: SugoiSettings;

  // ─── UI State ────────────────────────────────────────────
  showTelemetry: boolean;
  setShowTelemetry: (v: boolean) => void;

  // ─── Convenience accessors (backward compat) ─────────────
  mood: Mood;
  power: number;
  enemyHealth: number;

  // ─── Actions ─────────────────────────────────────────────
  setMood: (mood: Mood) => void;
  setPower: (power: number) => void;
  damageEnemy: (amount: number) => void;
  resetRPG: () => void;

  // ─── ML Actions ──────────────────────────────────────────
  pushLog: (log: string) => void;
  setLogs: (logs: string[]) => void;
  setConfidence: (score: number | null) => void;
  setPredictedCategory: (cat: string | null) => void;
  setProcessing: (v: boolean) => void;

  // ─── Gamification Actions ────────────────────────────────
  incrementCombo: () => void;
  triggerParticleBurst: () => void;
  pushDamageLog: (msg: string) => void;
  setChaosLevel: (level: number) => void;
  addAchievement: (achievement: { id: string; title: string; icon: string }) => void;
  setTypingStatus: (status: string | null) => void;

  // ─── Settings Actions ───────────────────────────────────
  updateSettings: (changes: Partial<SugoiSettings>) => void;

  // ─── Full Reset ──────────────────────────────────────────
  resetAll: () => void;
}

const initialML: MLTelemetry = {
  logs: [],
  confidenceScore: null,
  predictedCategory: null,
  isProcessing: false,
};

const initialPersona: SugoiPersona = {
  mood: 'idle',
  dialogueQueue: [],
  currentDialogue: null,
  typingStatus: null,
};

const initialGame: Gamification = {
  enemyHealth: 100,
  power: 0,
  comboCounter: 0,
  damageLog: [],
  particleBurst: false,
  chaosLevel: 42, // Start with some chaos
  achievements: [],
};

const initialSettings: SugoiSettings = {
  activeModel: 'llama3-8b-8192',
  autoResolveThreshold: 50,
  shadowBrainEnabled: true,
  personaPrompt: "You are Sugoi, a sassy elite IT architect. Keep your tone sharp, professional, and slightly sassy.",
  discordWebhook: "",
  slackEnabled: false,
  accentColor: "#D4A017", // Honey Yellow
  animationsEnabled: true,
  mascotVisible: true,
};

export const useSugoiStore = create<SugoiState>((set, get) => ({
  ml: { ...initialML },
  persona: { ...initialPersona },
  game: { ...initialGame },
  settings: { ...initialSettings },
  showTelemetry: false,
  setShowTelemetry: (v) => set({ showTelemetry: v }),

  // Backward-compatible getters
  get mood() { return get().persona.mood; },
  get power() { return get().game.power; },
  get enemyHealth() { return get().game.enemyHealth; },

  // Persona
  setMood: (mood) => set((s) => ({ persona: { ...s.persona, mood } })),

  // Game
  setPower: (power) => set((s) => ({ game: { ...s.game, power } })),
  damageEnemy: (amount) => set((s) => ({
    game: {
      ...s.game,
      enemyHealth: Math.max(0, s.game.enemyHealth - amount),
      comboCounter: s.game.comboCounter + 1,
      particleBurst: true,
    }
  })),
  resetRPG: () => set({ game: { ...initialGame }, persona: { ...initialPersona } }),

  // ML
  pushLog: (log) => set((s) => ({ ml: { ...s.ml, logs: [...s.ml.logs, log] } })),
  setLogs: (logs) => set((s) => ({ ml: { ...s.ml, logs } })),
  setConfidence: (score) => set((s) => ({ ml: { ...s.ml, confidenceScore: score } })),
  setPredictedCategory: (cat) => set((s) => ({ ml: { ...s.ml, predictedCategory: cat } })),
  setProcessing: (v) => set((s) => ({ ml: { ...s.ml, isProcessing: v } })),

  // Gamification
  incrementCombo: () => set((s) => ({ game: { ...s.game, comboCounter: s.game.comboCounter + 1 } })),
  triggerParticleBurst: () => {
    set((s) => ({ game: { ...s.game, particleBurst: true } }));
    setTimeout(() => set((s) => ({ game: { ...s.game, particleBurst: false } })), 800);
  },
  pushDamageLog: (msg) => set((s) => ({ game: { ...s.game, damageLog: [...s.game.damageLog, msg] } })),
  setChaosLevel: (level) => set((s) => ({ game: { ...s.game, chaosLevel: Math.min(100, Math.max(0, level)) } })),
  addAchievement: (achievement) => set((s) => {
    if (s.game.achievements.find(a => a.id === achievement.id)) return s;
    return { game: { ...s.game, achievements: [...s.game.achievements, achievement] } };
  }),
  setTypingStatus: (status) => set((s) => ({ persona: { ...s.persona, typingStatus: status } })),

  // Settings
  updateSettings: (changes) => set((s) => ({ settings: { ...s.settings, ...changes } })),

  // Full Reset
  resetAll: () => set({
    ml: { ...initialML },
    persona: { ...initialPersona },
    game: { ...initialGame },
    settings: { ...initialSettings },
    showTelemetry: false,
  }),
}));
