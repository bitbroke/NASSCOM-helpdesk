# Sugoi Bot: Zero-Trust Agentic IT Helpdesk
### Comprehensive Solution Architecture & Design Documentation
**Version 4.0 · Council Duel Synthesis · Honey & Cream UX**

---

## 1. Executive Summary
Sugoi Bot is a high-fidelity, multi-agent IT triage system designed to handle Level-1 support tickets autonomously. It features a "Zero-Trust" architecture where PII is redacted locally at the edge, and technical resolutions are cross-verified by a "Council" of LLMs (Gemini & Llama) before being presented to the user.

---

## 2. Proposed Solution Architecture
The architecture is divided into three primary layers: the **Ingress Edge**, the **Inference Council**, and the **Persistence Layer**.

### Component Diagram
```mermaid
graph TD
    User((User/IT Staff)) -->|Submits Ticket| Ingress[Next.js 15 Frontend]
    
    subgraph Edge_Layer [Ingress Edge Layer]
        Ingress --> NER[Local NER Agent: PII Redaction]
        NER --> Embed[Vector Embedding Agent: MiniLM]
        Embed --> LR[Triage Decider: Logistic Regression]
    end

    subgraph Council_Layer [Multi-Agent Council]
        LR -->|Scrubbed Query| Supervisor[Supervisor Agent: Groq Llama 3]
        Supervisor -->|Route: Search| RAG[Hybrid Search: BM25 + Vector]
        Supervisor -->|Route: Diag| Tools[Diagnostic Toolset]
        
        RAG & Tools --> Duel{Council Duel}
        Duel -->|Parallel| Gem[Gemini 1.5 Flash]
        Duel -->|Parallel| Llama[Llama 3.3 Versatile]
        
        Gem & Llama --> Winner[Winner Selection Logic]
    end

    subgraph Persistence [Persistence Layer]
        Winner --> DB[(Supabase PostgreSQL)]
        DB -->|Historical Context| RAG
        DB -->|Audit Logs| Dash[Admin Dashboard]
    end

    Winner -->|Final Runbook| Ingress
```

---

## 3. Low-Level Design (LLD)

### A. Local ML Pipeline (Edge)
- **PII Redaction**: Uses `Xenova/bert-base-NER` running in-browser/serverless via Transformers.js.
- **Classification Engine**: A deterministic implementation of Logistic Regression. Weights and intercepts are stored in JSON, allowing classification to happen without external API calls, ensuring high speed and low cost.
- **Confidence Scaling**: Employs Temperature Scaling ($T=0.7$) on logits to produce realistic probability distributions.

### B. The Council Duel (Synthesis)
- **Concurrency**: Triggered via `Promise.all` for minimal latency.
- **Evaluation**: The "Winner" is determined by a scoring function that weights:
    1. **Technical Density**: Number of markdown code blocks and lists.
    2. **Length**: Completeness of the resolution.
    3. **Persona Adherence**: Correct formatting of the "Sugoi Analysis" section.

### C. Shadow Router (Deterministic Fallback)
- If all LLM APIs (Google/Groq) fail or rate-limit, the system falls back to a **Keyword Scoring Matrix**.
- **The Vault**: A collection of 20+ expert-verified markdown templates indexed by technical keywords (e.g., `OOM`, `Deadlock`, `B-Tree`).

---

## 4. Data Engineering Approach

### Pipeline Workflow
1. **Extraction**: Raw IT ticket data (9,000+ rows) sourced from Kaggle.
2. **Sanitization**: Automated removal of noise (email headers, signatures) and normalization of categories (Network, Database, Hardware).
3. **Embedding Generation**: Pre-computed 384-dimensional vectors using `all-MiniLM-L6-v2`.
4. **Vector Loading**: Bulk UPSERT into Supabase `historical_tickets` table using `pgvector`.

---

## 5. Data Model (Entity Relationship Diagram)

```mermaid
erDiagram
    HISTORICAL_TICKETS {
        uuid id PK
        text category
        text sanitized_query
        text resolution_steps
        vector embedding
        tsvector fts_vector
    }
    LIVE_TICKETS {
        uuid id PK
        timestamptz created_at
        text status "AUTO_RESOLVED | NEEDS_HUMAN"
        text category
        text priority
        text original_redacted_text
        float8 confidence_score
        vector embedding
    }
    AGENTIC_SKILLS {
        uuid id PK
        text category UK
        text applicability_logic
        text execution_steps
        text termination_criteria
    }
    MASTER_INCIDENTS {
        uuid id PK
        text category
        text incident_summary
        text remediation_runbook
        int related_ticket_count
    }
```

---

## 6. Data Flow Diagram (DFD)

```mermaid
flowchart LR
    A[Raw Input] --> B(Local NER)
    B --> C{PII Found?}
    C -->|Yes| D[Redact String]
    C -->|No| E[Pass Through]
    D & E --> F(Vector Embedding)
    F --> G[Supabase RRF Search]
    G --> H[Council Synthesis]
    H --> I[Final Resolution]
    I --> J[(Encrypted DB Storage)]
```

---

## 7. Sequence Diagram: Ticket Triage Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (Next.js)
    participant E as Edge (Local ML)
    participant C as Council (LLMs)
    participant D as Database (Supabase)

    U->>F: Submit "DB is slow"
    F->>E: Process PII & Embed
    E-->>F: Redacted Text + Category
    F->>D: Search similar tickets (RRF)
    D-->>F: Context (Top 5 matches)
    F->>C: Council Duel (Gemini vs Llama)
    Note over C: Parallel Synthesis
    C-->>F: Selected Best Runbook
    F->>D: Log Triage (Encrypted)
    F->>U: Display "Sugoi's Analysis"
```

---

## 8. State Transition Diagram: Ticket Lifecycle

```mermaid
stateDiagram-v2
    [*] --> INCOMING: User Submits
    INCOMING --> ANALYSING: Local NER & Embedding
    ANALYSING --> CLASSIFIED: LR Model Output
    
    state CLASSIFIED {
        [*] --> THRESHOLD_CHECK
        THRESHOLD_CHECK --> AUTO_TRIAGE: Confidence > 0.8
        THRESHOLD_CHECK --> HUMAN_NEEDED: Confidence < 0.8
    }

    AUTO_TRIAGE --> COUNCIL_DUEL: LLMs Available
    AUTO_TRIAGE --> SHADOW_ROUTING: APIs Offline
    
    COUNCIL_DUEL --> RESOLVED: Success
    SHADOW_ROUTING --> RESOLVED: Success
    
    HUMAN_NEEDED --> ESCALATED: Sent to Dashboard
    RESOLVED --> [*]
    ESCALATED --> [*]
```

---

## 9. List of Data Sources
1. **Primary Dataset**: Kaggle IT Support Ticket dataset (augmented with synthetic anomalies).
2. **Procedural Memory**: Custom-built `agentic_skills` table (Deterministic IT Runbooks).
3. **Keyword Vault**: Hardcoded technical pattern matrix for shadow routing.

---

## 10. Open-Source Tools & Libraries
- **Framework**: Next.js 15 (App Router), TypeScript.
- **ML Inference**: Transformers.js (Hugging Face), ONNX Runtime.
- **Vector Database**: Supabase + pgvector extension.
- **LLM APIs**: Google Gemini 1.5 Flash, Groq (Llama 3.3 70B).
- **Styling/Animations**: GSAP (GreenSock), Tailwind CSS, Framer Motion.
- **Utilities**: Upstash Redis (Rate limiting), Zod (Validation), Lucide React.

---
**Sugoi Bot v4.0** remains the most robust, secure, and visually stunning helpdesk solution for the modern enterprise.
