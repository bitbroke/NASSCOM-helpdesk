# Sugoi Bot: Project Architecture & Design Documentation
### Multi-Agent Council Architecture · Council Duel Synthesis v3.5 · Honey & Cream UX

---

## 1. Project Overview
Sugoi Bot is a **Zero-Trust Agentic IT Helpdesk** designed to automate Level-1 (L1) support triage without sacrificing security or privacy. It employs a Multi-Agent "Council" system that ensures no single model makes an unverified decision. Version 3.5 introduces the **Council Duel**—a parallel execution layer that uses multiple LLMs to cross-verify solutions.

## 2. Problems & Technical Challenges

### A. The "Council Duel" (Parallel LLM Synthesis)
**Problem**: Relying on a single LLM can lead to hallucinations or shallow technical resolutions during high-stakes IT incidents.
**Solution**: We implemented **Parallel Council Synthesis**. The system now triggers both **Gemini 2.0 Flash** and **Groq (Llama 3.3)** simultaneously. A winner-selection logic evaluates both outputs based on technical detail density and markdown formatting, ensuring the user only sees the highest-fidelity resolution. This reduces "Model Bias" and increases technical accuracy.

### B. The Configuration Gap (System Control)
**Problem**: Static AI systems often feel like "black boxes" that admins cannot tune. Judges need proof of a configurable backend.
**Solution**: We built an **Advanced Settings Dashboard**. Admins can now tune the **Auto-Resolve Threshold**, toggle the **Shadow Brain** (Deterministic Fallback), change the **Active Routing Model**, and even live-edit the **System Persona Prompt**. This moves the app from a simple tool to a configurable enterprise platform.

### C. Security & "Demo-Killers" (Stability)
**Problem**: Open APIs and long inputs are "demo-killers." A user pasting a 10MB log file or an unauthenticated user dumping the database would ruin a hackathon presentation.
**Selection**: 
1. **Local Guards**: Implemented a 1,000-character `maxLength` and synchronous loading state guards to prevent OOM crashes and duplicate API calls.
2. **Session-Locked Admin**: Secured all admin routes via **Supabase Auth session checks**.
3. **Payload Validation**: Strict server-side type checking for all API inputs.

## 3. The Multi-Agent Council

1.  **Analyser Agent (Edge)**: Uses local BERT NER to redact PII. Generates 384d embeddings.
2.  **Manager Council (Retrieval)**: Fuses BM25 and Vector search (RRF) to find historical context. It produces "Domain Bids" (e.g., "I'm 80% sure this is a Network issue based on past tickets").
3.  **Triage Decider (Inference)**: Runs the local ONNX model. It compares its result with the Manager's bids.
4.  **Council Duel (Synthesis)**: The "Battle" between Gemini and Groq to produce the ultimate Markdown runbook.

## 4. UI/UX: The Honey & Cream System

The UI is designed to be **Premium but Playful**:
*   **Frosted Glass (Glassmorphism)**: Used for all panels to create depth.
*   **Responsive Sidebar**: The dashboard now hides navigation on mobile viewports to prioritize the triage console.
*   **Mascot Visibility**: Added a setting to hide the Sugoi character for a "Strict Enterprise" mode.
*   **Custom Accents**: Dynamic CSS variables allow users to change the dashboard's glowing accent color (Honey, Sakura, Indigo).

## 5. Implementation Workflow

1.  **Data Engineering**: Cleaned and categorized 9,000+ IT tickets.
2.  **Model Training**: Trained a balanced Logistic Regression model and exported it to **ONNX**.
3.  **Frontend Assembly**: Built with Next.js 16 and Framer Motion.
4.  **Security Audit**: Ensured all PII scrubbing happens *locally* and admin routes are session-protected.

---
**Sugoi Bot v3.5** represents the pinnacle of agentic IT support: secure, multi-verified, and highly configurable.
