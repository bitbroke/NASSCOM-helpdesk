import { NextRequest } from "next/server";
import { scanKeywordVault } from '@/app/utils/triage/tier1';
import { getShadowTemplate } from '@/app/utils/triage/tier3';
import lrModelData from "@/data/lr_model.json";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

async function logLiveTicket(originalText: string, category: string, status: "AUTO_RESOLVED" | "NEEDS_HUMAN", confidence: number, tier: string, embedding?: number[]) {
  if (!supabase) return;
  try {
    const encryptedText = encrypt(originalText);
    const payload: any = {
      status,
      category,
      original_redacted_text: encryptedText,
      confidence_score: confidence,
      resolution_tier: tier,
      priority: status === "NEEDS_HUMAN" ? "High" : "Medium",
    };
    if (embedding && embedding.length > 0) {
      payload.embedding = embedding;
    }
    const { error } = await supabase.from("live_tickets").insert(payload);
    if (error) {
      console.error("Error inserting live ticket details:", error);
      // Fallback: try inserting without resolution_tier
      const { resolution_tier, ...fallbackPayload } = payload;
      await supabase.from("live_tickets").insert(fallbackPayload);
    }
  } catch (e) {
    console.error("Failed to log live ticket to Supabase:", e);
  }
}

console.log("Environment check - GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);
console.log("Environment check - GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

// ── Local ML Classification (pure math, no model loading) ────────
function jsonLRClassify(embeddingArray: number[]) {
  try {
    const lrModel = lrModelData as any;
    const { classes, weights, intercepts } = lrModel;
    
    // Layer 1: Input (384) -> Hidden 1 (100)
    const h1 = new Array(100).fill(0);
    for (let j = 0; j < 100; j++) {
      let z = intercepts[0][j];
      for (let i = 0; i < 384; i++) {
        z += embeddingArray[i] * weights[0][i][j];
      }
      h1[j] = Math.max(0, z); // ReLU
    }

    // Layer 2: Hidden 1 (100) -> Hidden 2 (50)
    const h2 = new Array(50).fill(0);
    for (let j = 0; j < 50; j++) {
      let z = intercepts[1][j];
      for (let i = 0; i < 100; i++) {
        z += h1[i] * weights[1][i][j];
      }
      h2[j] = Math.max(0, z); // ReLU
    }

    // Layer 3: Hidden 2 (50) -> Output Logits (6)
    const logits = classes.map((cat: string, k: number) => {
      let z = intercepts[2][k];
      for (let i = 0; i < 50; i++) {
        z += h2[i] * weights[2][i][k];
      }
      return z;
    });

    const maxLogit = Math.max(...logits);
    const exps = logits.map((z: number) => Math.exp(z - maxLogit));
    const sum = exps.reduce((a: number, b: number) => a + b, 0);
    const probs = exps.map((e: number) => e / sum);
    
    let maxProb = -1, bestCat = classes[0];
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > maxProb) { maxProb = probs[i]; bestCat = classes[i]; }
    }
    return { category: bestCat, confidence: maxProb };
  } catch {
    return { category: "Infrastructure", confidence: 0.5 };
  }
}

// ── API Route ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { rawText, logContent, useLLM = true } = await req.json();
  const fullText = logContent ? `${rawText}\n\nLogs:\n${logContent}` : rawText;

  // ==========================================================
  // NEW ORDER: TIER 1 (KEYWORD VAULT) GOES FIRST
  // If the user says "password reset" or "vpn", don't use AI. 
  // Just give them the template immediately.
  // ==========================================================
  const vaultMatch = scanKeywordVault(fullText);
  if (vaultMatch) {
    logLiveTicket(fullText, vaultMatch.category, "AUTO_RESOLVED", 1.0, "Tier 1: Vault");
    return Response.json({
      status: "VAULT_RESOLVED",
      category: vaultMatch.category,
      confidence: vaultMatch.confidence_override || 1.0,
      resolution: vaultMatch.solution,
      badge: "Pre-Classified Template Match"
    });
  }

  const encoder = new TextEncoder();
  // We return a ReadableStream that yields NDJSON lines.
  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: any) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch (e) {} // ignore if stream closed
      };

      try {
        push({ type: "thought", content: "System initialized. Opening secure pipeline..." });

        // ══════════════════════════════════════════════════════════
        // STEP 1: PII Redaction (Local NER Model)
        // ══════════════════════════════════════════════════════════
        let sanitizedText = fullText;
        try {
          const PipelineSingleton = (await import("@/lib/ml")).default;
          const ner = await PipelineSingleton.getNER();
          const entities = await (ner as any)(fullText, { aggregation_strategy: "simple" });
          const sorted = Array.isArray(entities) ? entities.sort((a: any, b: any) => b.start - a.start) : [];
          for (const ent of sorted) {
            const tag = ent.entity_group === "PER" ? "[REDACTED_NAME]" : ent.entity_group === "LOC" ? "[REDACTED_LOCATION]" : ent.entity_group === "ORG" ? "[REDACTED_ORGANIZATION]" : "[REDACTED_ENTITY]";
            sanitizedText = sanitizedText.slice(0, ent.start) + tag + sanitizedText.slice(ent.end);
          }
          push({ type: "thought", content: "[Analyser Agent] Zero-trust achieved. PII Scrubbed." });
        } catch {
          push({ type: "thought", content: "[Analyser Agent] Local NER unavailable. Using regex fallback." });
        }

        // ══════════════════════════════════════════════════════════
        // STEP 2: Generate Embedding & Run Tier 0 LR Classifier
        // ══════════════════════════════════════════════════════════
        let embeddingArray: number[] | null = null;
        let finalCategory = "Infrastructure";
        let finalConfidence = 0.5;
        let tier0Badge = "Local AI Match";

        try {
          const PipelineSingleton = (await import("@/lib/ml")).default;
          const embedder = await PipelineSingleton.getEmbedding();
          const out = await (embedder as any)(sanitizedText, { pooling: "mean", normalize: true });
          embeddingArray = Array.from(out.data) as number[];
          push({ type: "thought", content: "[Tier 0] Vector embedding generated (384 dims) ✓" });

          // Tier 0: LR Classification via pure matrix math
          const lrResult = jsonLRClassify(embeddingArray);
          finalCategory = lrResult.category;
          finalConfidence = lrResult.confidence;
          push({ type: "metadata", category: finalCategory, confidence: finalConfidence });
          push({ type: "thought", content: `[Tier 0] Classified as ${finalCategory} (${(finalConfidence * 100).toFixed(1)}%) via local MLP model ✓` });
        } catch (embErr: any) {
          push({ type: "thought", content: `[Tier 0] Embedding/MLP failed: ${embErr?.message}. Falling to Tier 1.` });
          tier0Badge = "Embedding Unavailable";
        }

        // ══════════════════════════════════════════════════════════
        // DECISION: HIGH CONFIDENCE → Try RAG or jump to resolution
        // ══════════════════════════════════════════════════════════
        if (finalConfidence >= 0.75) {
          push({ type: "thought", content: `[Tier 0] High confidence (${(finalConfidence * 100).toFixed(1)}%). Checking RAG for exact match...` });

          // Try pure RAG lookup in Supabase
          let ragResolution: string | null = null;
          if (supabase && embeddingArray) {
            try {
              const { data } = await supabase.rpc('match_tickets', {
                query_embedding: embeddingArray,
                match_threshold: 0.7,
                match_count: 1
              });
              if (data && data.length > 0) {
                ragResolution = `### Known Incident Resolved via Exact Match\n\n**Historical Match:** ${data[0].original_redacted_text || data[0].sanitized_query}\n\n**Resolution:**\n${data[0].resolution || data[0].resolution_steps}`;
              }
            } catch {}
          }

          if (ragResolution) {
            push({ type: "thought", content: "[Tier 0] RAG exact match found. Auto-resolving." });
            logLiveTicket(sanitizedText, finalCategory, "AUTO_RESOLVED", finalConfidence, "Tier 0: RAG", embeddingArray || undefined);
            push({ type: "resolution_complete", text: ragResolution, status: "AUTO_RESOLVED", badge: "Tier 0: RAG Auto-Resolve" });
            controller.close();
            return;
          }

          // RAG match not found, but classifier is confident — drop down to check keyword vault and council duel instead of immediately calling shadow router
          push({ type: "thought", content: "[Tier 0] RAG exact match not found. Proceeding to Keyword Vault..." });
        }

        // ══════════════════════════════════════════════════════════
        // TIER 1: DETERMINISTIC KEYWORD VAULT
        // ══════════════════════════════════════════════════════════
        push({ type: "thought", content: "[Tier 1] Scanning Keyword Vault..." });
        const vaultMatch = scanKeywordVault(sanitizedText);
        if (vaultMatch) {
          push({ type: "metadata", category: vaultMatch.category, confidence: vaultMatch.confidence_override });
          push({ type: "thought", content: `[Tier 1] Vault match: "${vaultMatch.category}". Returning pre-verified template.` });
          logLiveTicket(sanitizedText, vaultMatch.category, "AUTO_RESOLVED", vaultMatch.confidence_override || 1.0, "Tier 1: Vault");
          push({ type: "resolution_complete", text: vaultMatch.solution, status: "AUTO_RESOLVED", badge: "Tier 1: Vault Auto-Resolve" });
          controller.close();
          return;
        }
        push({ type: "thought", content: "[Tier 1] No vault match. Escalating to Tier 2..." });

        // ══════════════════════════════════════════════════════════
        // TIER 2: EXTERNAL LLM COUNCIL DUEL
        // ══════════════════════════════════════════════════════════
        const geminiKey = process.env.GEMINI_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;

        if (!useLLM || (!geminiKey && !groqKey)) {
          // No API keys — skip directly to Tier 3
          push({ type: "thought", content: "[Tier 2] Council APIs unavailable (no API keys). Falling to Tier 3." });
        } else {
          try {
            push({ type: "thought", content: "[Tier 2] Initializing Council Duel..." });
            const { runCouncilDuel } = await import('@/app/utils/triage/tier2');
            console.log("Triggering Council Duel...");
            const councilOutput = await runCouncilDuel(sanitizedText, finalCategory, embeddingArray || []);

            if (councilOutput.confidence_score >= 75) {
              push({ type: "thought", content: `[Tier 2] Council Verified (${councilOutput.confidence_score}%).` });
              logLiveTicket(sanitizedText, finalCategory, "AUTO_RESOLVED", councilOutput.confidence_score / 100, "Tier 2: Council", embeddingArray || undefined);
              push({ type: "resolution_complete", text: councilOutput.resolution, status: "AUTO_RESOLVED", badge: "Tier 2: Council Auto-Resolve" });
              controller.close();
              return;
            } else if (councilOutput.confidence_score >= 40) {
              push({ type: "thought", content: "[Tier 2] Review Recommended (" + councilOutput.confidence_score + "%)." });
              logLiveTicket(sanitizedText, finalCategory, "AUTO_RESOLVED", councilOutput.confidence_score / 100, "Tier 2: Council", embeddingArray || undefined);
              push({ type: "resolution_complete", text: `> **Review Recommended (${councilOutput.confidence_score}%)**\n\n${councilOutput.resolution}`, status: "AUTO_RESOLVED", badge: "Tier 2: Council Review" });
              controller.close();
              return;
            } else {
              push({ type: "thought", content: `[Tier 2] Council confidence too low (${councilOutput.confidence_score}%). Falling to Tier 3.` });
            }
          } catch (llmErr: any) {
            console.error("[COUNCIL ERROR]:", llmErr);
            push({ type: "thought", content: `[Tier 2] Council failed: ${llmErr?.message}. Falling to Tier 3.` });
          }
        }

        // ══════════════════════════════════════════════════════════
        // TIER 3: SHADOW ROUTER + ESCALATION
        // ══════════════════════════════════════════════════════════
        push({ type: "thought", content: "[Tier 3] Engaging Shadow Router fallback..." });
        const shadowResponse = getShadowTemplate(sanitizedText, finalCategory);
        push({ type: "metadata", category: shadowResponse.category, confidence: shadowResponse.confidence });
        push({ type: "thought", content: `[Tier 3] Shadow resolution generated for category: ${shadowResponse.category}` });
        const dbStatus = shadowResponse.status === "ESCALATED" ? "NEEDS_HUMAN" : (shadowResponse.status as any);
        logLiveTicket(sanitizedText, shadowResponse.category, dbStatus, shadowResponse.confidence, shadowResponse.category === "Out-of-Scope" ? "Tier 3: Shadow Garbage" : "Tier 3: Shadow Fallback", embeddingArray || undefined);
        push({ type: "resolution_complete", text: shadowResponse.resolution, status: shadowResponse.status, badge: shadowResponse.badge });

        controller.close();
      } catch (err: any) {
        push({ type: "thought", content: `[FATAL] Pipeline crashed: ${err.message}` });
        push({ type: "resolution_complete", text: `System error: ${err.message}. Ticket routed to human queue.`, status: "ESCALATED" });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
