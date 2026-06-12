# Sugoi Bot: Zero-Trust IT Helpdesk
### Multi-Agent Council Architecture · Council Duel Synthesis v3.5 · Premium GSAP UX

An advanced, privacy-first IT Helpdesk system engineered for enterprise environments, wrapped in a **Honey & Cream** gamified persona called **Sugoi** — your sarcastic but brilliant Japanese tech-helper.

---

## 🍯 How to Use This Website

1.  **Describe Your Issue**: Type your technical problem (max 1,000 chars).
2.  **Submit**: Click "Summon Incident". Watch the **Action Stream** show real-time agent negotiation.
3.  **Council Duel**: Watch as Gemini and Groq "duel" to create the best step-by-step diagnostic runbook.
4.  **Tune the System**: Visit **Settings** to change models, adjust auto-resolve thresholds, or toggle "Shadow Brain" offline mode.

---

## 🧠 Problems Faced & Solutions Implemented

### 🚀 Architectural Problems
*   **Problem: Single-Model Bias**: Relying on one LLM for resolutions can be risky.
    *   **Solution**: Implemented the **Council Duel**. We trigger Gemini and Groq in parallel and select the winner based on technical detail density.
*   **Problem: Administrative Blindness**: Admins couldn't see or change how the "Council" made decisions.
    *   **Solution**: Built a **High-Fidelity Settings Dashboard**. Admins now have granular control over confidence thresholds, active models, and persona prompts.

### 🧠 Machine Learning Problems
*   **Problem: Input Overload**: Pasting 10,000 characters of logs would crash the local BERT model.
    *   **Solution**: Implemented a hard 1,000-character **Local character guard** and strict API payload validation.
*   **Problem: PII Leakage**: Standard LLMs can leak sensitive data (IPs, emails).
    *   **Solution**: Integrated a **Local BERT NER** model that runs entirely on the edge to redact PII *before* it ever touches a cloud API.

### 💻 Frontend Problems
*   **Problem: Small-Screen Chaos**: On tablets or smaller windows, the 3-column layout would overflow.
    *   **Solution**: Implemented a **Responsive Sidebar** that hides on smaller screens, and a flexible grid that scales based on viewport width.

### ⚙️ Backend Problems
*   **Problem: Unauthorized Data Access**: The admin ticket list was initially public.
    *   **Solution**: Secured all Admin routes with **Supabase Server-Side Sessions**. Only authenticated users can access triage telemetry.

---

## ✨ Features

*   🍯 **Council Duel**: Parallel Gemini + Groq synthesis.
*   ⚙️ **Advanced Configuration**: Live-tuning of AI thresholds & personas.
*   🔐 **Zero-Trust PII Redaction**: Local BERT-based scrubbing.
*   🏛️ **Council Orchestration**: Multi-agent consensus logic.
*   🔍 **Hybrid RRF Search**: BM25 + pgvector fusion.
*   🎭 **Interactive Sugoi Persona**: Mood-based mascot animations.
*   📱 **Responsive Design**: Optimized for desktop and mobile viewports.

---

## 🚀 Tech Stack

*   **Next.js 16**, **Tailwind v4**, **GSAP**, **Framer Motion**.
*   **ONNX Runtime Web**, **Xenova Transformers**.
*   **Supabase (pgvector Auth)**, **Upstash Redis**.
*   **Gemini 2.0 Flash**, **Groq Llama 3.3**.
