// lib/crag.ts
// ═══════════════════════════════════════════════════════════════════
// Corrective RAG (CRAG) — Context Relevance Validator
// ═══════════════════════════════════════════════════════════════════
// Before letting the LLM generate a resolution using retrieved context,
// this evaluator checks: "Do these historical tickets actually contain
// the technical solution to the user's query?"
//
// If NOT → Drop the context entirely and fall back to clean generation
// (Shadow Router templates) rather than letting the LLM hallucinate
// from irrelevant context.
//
// This is a fast, cheap LLM call: temperature=0, max ~100 tokens.

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// ── CRAG Result Schema ──

const CRAGResultSchema = z.object({
  is_relevant: z.boolean().describe(
    "true if the retrieved tickets contain the exact or closely related technical solution to the user query"
  ),
  reasoning: z.string().describe(
    "Brief explanation of why the context is or is not relevant"
  ),
});

export interface CRAGResult {
  isRelevant: boolean;
  reasoning: string;
}

// ── Main Evaluator ──

/**
 * Evaluate whether retrieved historical tickets are relevant to the user's query.
 * 
 * Uses a fast LLM call (Groq Llama) with structured output to make a
 * binary YES/NO decision on context relevance.
 * 
 * @param query - The user's original sanitized query
 * @param retrievedContext - The few-shot context string built from retrieved tickets
 * @param groqApiKey - Groq API key for the evaluator LLM
 * @returns CRAGResult with isRelevant boolean and reasoning
 */
export async function evaluateContextRelevance(
  query: string,
  retrievedContext: string,
  groqApiKey: string
): Promise<CRAGResult> {
  // If no context was retrieved, it's trivially irrelevant
  if (!retrievedContext || retrievedContext.trim().length < 30) {
    return {
      isRelevant: false,
      reasoning: "No meaningful context was retrieved from the knowledge base.",
    };
  }

  try {
    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqApiKey,
    });

    const { object } = await generateObject({
      model: groq('llama-3.3-70b-versatile'),
      schema: CRAGResultSchema,
      prompt: `You are a strict technical relevance evaluator for an IT helpdesk system.

Your ONLY job is to determine if the retrieved historical tickets below contain technical information that is DIRECTLY applicable to solving the user's query.

== USER QUERY ==
${query.slice(0, 500)}

== RETRIEVED HISTORICAL TICKETS ==
${retrievedContext.slice(0, 1500)}

Rules:
- Answer is_relevant=true ONLY if the historical tickets describe the SAME or a very closely related technical problem AND contain actionable resolution steps.
- Answer is_relevant=false if the tickets are only superficially similar (e.g., same category but different root cause), or if the resolutions would not apply to this specific query.
- Be strict. It is better to reject marginally relevant context than to let the system hallucinate from vaguely related tickets.`,
      temperature: 0,
    });

    return {
      isRelevant: object.is_relevant,
      reasoning: object.reasoning,
    };
  } catch (error: any) {
    // If the evaluator itself fails (rate limit, timeout, etc.),
    // default to allowing the context through. Better to risk
    // slightly less relevant context than to block the entire pipeline.
    console.warn('[CRAG] Evaluator failed, defaulting to isRelevant=true:', error?.message);
    return {
      isRelevant: true,
      reasoning: `Evaluator error: ${error?.message || 'unknown'}. Defaulting to allow context.`,
    };
  }
}
