# Sugoi Bot: Zero-Trust IT Helpdesk
### Multi-Agent Council Architecture · v5.0 Rigorous Synthesis · Anti-Hallucination Engine

An advanced, privacy-first IT Helpdesk system engineered for enterprise environments, wrapped in a **Honey & Cream** gamified persona called **Sugoi** — your sarcastic but brilliant Japanese tech-helper. Version 5.0 introduces the **Anti-Hallucination Engine** with Zod-constrained outputs, CRAG, and Cross-Encoder reranking.

---

## How to Use This Website

1.  **Describe Your Issue**: Type your technical problem (max 1,000 chars).
2.  **Submit**: Click "Summon Incident". Watch the **Action Stream** show real-time agent negotiation.
3.  **Structured Resolution**: Get a mathematically verified runbook with root cause, execution steps (each with expected outputs), rollback plan, and verification steps.
4.  **Confidence Score**: Each resolution includes a confidence score. Low-confidence tickets (< 40%) are auto-escalated for human review.
5.  **Tune the System**: Visit **Settings** to change models, adjust auto-resolve thresholds, or toggle "Shadow Brain" offline mode.

---

## Problems Faced & Solutions Implemented

### Architectural Problems
*   **Problem: Single-Model Bias**: Relying on one LLM for resolutions can be risky.
    *   **Solution**: Implemented the **Council Duel**. We trigger Gemini and Groq in parallel and select the winner based on technical detail density.
*   **Problem: Administrative Blindness**: Admins couldn't see or change how the "Council" made decisions.
    *   **Solution**: Built a **High-Fidelity Settings Dashboard**. Admins now have granular control over confidence thresholds, active models, and persona prompts.

### Machine Learning Problems
*   **Problem: Input Overload**: Pasting 10,000 characters of logs would crash the local BERT model.
    *   **Solution**: Implemented a hard 1,000-character **Local character guard** and strict API payload validation.
*   **Problem: PII Leakage**: Standard LLMs can leak sensitive data (IPs, emails).
    *   **Solution**: Integrated a **Local BERT NER** model that runs entirely on the edge to redact PII *before* it ever touches a cloud API.

### Anti-Hallucination Problems (v5.0)
*   **Problem: LLM Free-Writing Drift**: The model would generate confident-sounding but technically incorrect resolutions.
    *   **Solution**: Implemented **Zod Schema Enforcement** via `generateObject`. Every resolution must include `root_cause`, `steps` (each with `expected_output`), `rollback_plan`, and `verification`. Schema validation failure falls back to the deterministic Shadow Router.
*   **Problem: Irrelevant RAG Context**: Vector search returned "kind of similar" tickets that led the LLM to generate logically sound but technically wrong answers.
    *   **Solution**: Implemented **Cross-Encoder Reranking** (ms-marco-MiniLM) + **Corrective RAG (CRAG)**. The reranker scores 10 candidates and keeps only the top 3 proven matches. CRAG then validates whether those 3 actually solve the problem — if not, the context is dropped entirely.
*   **Problem: Overconfident Wrong Answers**: The model would give 95% confidence on incorrect diagnoses.
    *   **Solution**: Implemented **Confidence Gating**. If the model's self-assessed confidence is below 40%, the ticket is auto-escalated to human review instead of presenting a potentially wrong answer.
*   **Problem: Limited Training Data and Classifier Boundary Overlaps**: The original dataset lacked diversity and a simple linear Logistic Regression model struggled to separate overlapping technical categories.
    *   **Solution**: Merged the dataset with the **Kaggle GitHub Helpdesk Tickets (`tobiasbueck/helpdesk-github-tickets`)** dataset and upgraded the classifier to a **Multi-Layer Perceptron (MLP) Neural Network** with hidden layers `(100, 50)`. The edge ML classifier is locally trained on 26,000+ balanced tickets and exports weights to JSON/ONNX, enabling a native 3-layer forward pass on Vercel Serverless/Edge Functions with zero external ML APIs.

### Frontend Problems
*   **Problem: Small-Screen Chaos**: On tablets or smaller windows, the 3-column layout would overflow.
    *   **Solution**: Implemented a **Responsive Sidebar** that hides on smaller screens, and a flexible grid that scales based on viewport width.

### Backend Problems
*   **Problem: Unauthorized Data Access**: The admin ticket list was initially public.
    *   **Solution**: Secured all Admin routes with **Supabase Server-Side Sessions**. Only authenticated users can access triage telemetry.

---

## Features

*   **Council Duel**: Parallel Gemini + Groq synthesis.
*   **Anti-Hallucination Engine**: Zod schema enforcement + CRAG + Cross-Encoder reranking.
*   **Structured Resolutions**: Every answer includes root cause, expected outputs, rollback plan.
*   **Confidence Gating**: Low-confidence tickets auto-escalate to humans.
*   **Advanced Configuration**: Live-tuning of AI thresholds & personas.
*   **Zero-Trust PII Redaction**: Local BERT-based scrubbing.
*   **Council Orchestration**: Multi-agent consensus logic.
*   **Hybrid RRF Search + Reranking**: BM25 + pgvector + Cross-Encoder fusion.
*   **Corrective RAG (CRAG)**: Context relevance validation before generation.
*   **Interactive Sugoi Persona**: Mood-based mascot animations.
*   **Responsive Design**: Optimized for desktop and mobile viewports.
*   **Merged Dataset**: GitHub tickets + traditional helpdesk data for broader coverage.

---

## Tech Stack

*   **Next.js 16**, **Tailwind v4**, **GSAP**, **Framer Motion**.
*   **ONNX Runtime Web**, **Xenova Transformers**.
*   **Supabase (pgvector Auth)**, **Upstash Redis**.
*   **Gemini 2.0 Flash**, **Groq Llama 3.3**.
*   **Zod** (Schema Enforcement), **DSPy** (Prompt Optimization).
*   **Cross-Encoder Reranker** (ms-marco-MiniLM), **CRAG Evaluator**.
*   **kagglehub** (Dataset Management), **sentence-transformers**.
