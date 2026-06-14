import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { ResolutionSchema, renderRunbook } from "@/lib/resolutionSchema";

export async function runCouncilDuel(ticketText: string, category: string, embedding: number[]) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    throw new Error("Council APIs unavailable.");
  }

  const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey });
  const google = createGoogleGenerativeAI({ apiKey: geminiKey });

  // Agent A: The Diagnostician (Groq)
  const { text: diagnosis } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `You are Agent A, a senior IT Diagnostician. You MUST follow this exact protocol:
<thinking>
1. ROOT CAUSE: What is the exact technical failure reason?
2. AFFECTED SYSTEMS: Which specific systems/services are impacted?
3. DESTRUCTIVE RISK: Are there any destructive commands that would require a rollback plan?
4. CONFIDENCE: How confident are you in this diagnosis (0-100%)?
</thinking>
Issue: "${ticketText}"
Category: ${category}
Output a structured JSON diagnosis detailing the root cause and the affected system. Do NOT output a resolution.`
  });

  // Agent B: The Resolution Engineer (Gemini/Groq)
  const resolutionPrompt = `You are Agent B, the Resolution Engineer for an enterprise IT helpdesk.
You must output a technically precise resolution based on this diagnosis:
<diagnosis>
${diagnosis}
</diagnosis>
Category: ${category}
Original Issue: ${ticketText}

You must return a JSON object matching this schema structure:
{
  "root_cause": "The exact technical failure reason identified from diagnosis",
  "confidence_score": 0-100 (honestly reflect how sure you are),
  "affected_systems": ["list of specific systems/services impacted"],
  "prerequisites": ["what the user must verify before proceeding"],
  "steps": [
    {
      "action": "what the user must do in this step",
      "command": "the exact copy-pasteable CLI command (optional)",
      "expected_output": "what the user should see after executing this step",
      "is_destructive": true/false
    }
  ],
  "rollback_plan": "mandatory steps to revert if the fix fails",
  "verification": "how to confirm the fix worked after all steps are done"
}

CRITICAL RULES:
1. Every step MUST include an expected_output and is_destructive.
2. The rollback_plan is MANDATORY.
3. Commands must be exact, copy-pasteable CLI commands. No pseudocode.
4. Return the exact JSON structure specified above.`;

  const { object: resolution } = await generateObject({
    model: geminiKey ? google('gemini-1.5-flash') : groq('llama-3.3-70b-versatile'),
    schema: ResolutionSchema,
    prompt: resolutionPrompt,
    temperature: 0.3,
  });

  const runbook = renderRunbook(resolution, category);

  return {
    resolution: runbook,
    confidence_score: resolution.confidence_score,
    diagnosis
  };
}
