import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { renderRunbook } from "@/lib/resolutionSchema";

// Clean and parse JSON helper
function cleanAndParseJSON(text: string) {
  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  clean = clean.trim();
  
  const startIdx = clean.indexOf("{");
  const endIdx = clean.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    clean = clean.substring(startIdx, endIdx + 1);
  }
  
  return JSON.parse(clean);
}

// Fallback generateText helper
async function generateTextWithFallback(options: {
  prompt: string;
  temperature?: number;
}) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    throw new Error("Council APIs unavailable (no API keys configured).");
  }

  const google = createGoogleGenerativeAI({ apiKey: geminiKey });
  const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey });

  if (geminiKey) {
    try {
      console.log("Attempting generation with Gemini...");
      const { text } = await generateText({
        model: google('gemini-2.5-flash', {
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ]
        }),
        prompt: options.prompt,
        temperature: options.temperature ?? 0.3,
      });
      return text;
    } catch (err: any) {
      console.warn("Gemini generation failed, trying Groq fallback. Error:", err.message);
      if (!groqKey) {
        throw err;
      }
    }
  }

  if (groqKey) {
    console.log("Attempting generation with Groq...");
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: options.prompt,
      temperature: options.temperature ?? 0.3,
    });
    return text;
  }

  throw new Error("No API key available to execute request.");
}

export async function runCouncilDuel(ticketText: string, category: string, embedding: number[]) {
  // Agent A: Triage and Diagnostician Agent
  const diagnosisPrompt = `You are Agent A, the senior IT Triage & Diagnostician Agent.
Analyze the user's issue and classify it.
You MUST respond with a raw JSON object matching this schema:
{
  "classification": "OUT_OF_SCOPE" | "UNSOLVABLE_TECHNICAL" | "SOLVABLE_TECHNICAL",
  "category": "Access Management" | "Network" | "Infrastructure" | "Hardware" | "Software" | "Out-of-Scope",
  "root_cause": "exact technical failure reason, or empty if out of scope",
  "confidence_score": 0-100,
  "explanation": "brief explanation of why this classification was chosen"
}
Do NOT wrap the output in markdown code blocks. Output ONLY raw JSON.

Issue: "${ticketText}"
Guessed Category: ${category}`;

  const diagnosisText = await generateTextWithFallback({
    prompt: diagnosisPrompt,
    temperature: 0.2
  });

  const diagnosis = cleanAndParseJSON(diagnosisText);

  if (diagnosis.classification === "OUT_OF_SCOPE") {
    return {
      classification: "OUT_OF_SCOPE" as const,
      category: "Out-of-Scope",
      resolution: `### Out of Scope Request\n\nYour request has been classified as non-technical / out of scope.\n\n**Reason:** ${diagnosis.explanation}`,
      confidence_score: diagnosis.confidence_score ?? 0,
      diagnosis: diagnosisText
    };
  }

  if (diagnosis.classification === "UNSOLVABLE_TECHNICAL") {
    return {
      classification: "UNSOLVABLE_TECHNICAL" as const,
      category: diagnosis.category || category,
      resolution: `### Ticket Escalated\n\nThis technical issue has been escalated to human review in the admin panel.\n\n**Reason:** ${diagnosis.explanation}\n\n**Root Cause:** ${diagnosis.root_cause || "Not fully determined"}`,
      confidence_score: diagnosis.confidence_score ?? 0,
      diagnosis: diagnosisText
    };
  }

  // Agent B: The Resolution Engineer
  const resolutionPrompt = `You are Agent B, the Resolution Engineer for an enterprise IT helpdesk.
You must output a technically precise resolution based on this diagnosis:
<diagnosis>
Root Cause: ${diagnosis.root_cause}
Affected Systems: ${diagnosis.category}
Explanation: ${diagnosis.explanation}
</diagnosis>
Category: ${diagnosis.category || category}
Original Issue: ${ticketText}

You must return a JSON object matching this schema:
{
  "root_cause": "The exact technical failure reason identified from diagnosis",
  "confidence_score": 0-100,
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

Do NOT wrap the output in markdown code blocks. Output ONLY raw JSON.`;

  const resolutionText = await generateTextWithFallback({
    prompt: resolutionPrompt,
    temperature: 0.3
  });

  const resolution = cleanAndParseJSON(resolutionText);

  const runbook = renderRunbook(resolution, diagnosis.category || category);

  return {
    classification: "SOLVABLE_TECHNICAL" as const,
    category: diagnosis.category || category,
    resolution: runbook,
    confidence_score: resolution.confidence_score ?? 50,
    diagnosis: diagnosisText
  };
}
