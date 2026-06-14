import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// Resolution Schema — Constrains LLM Output for Technical Correctness
// ═══════════════════════════════════════════════════════════════════
// Every LLM resolution must conform to this schema. If the model
// tries to skip critical fields (rollback, expected_output), the
// generation fails and falls back to the Shadow Router.

export const ResolutionStepSchema = z.object({
  action: z.string().describe("What the user must do in this step"),
  command: z.string().optional().describe("The exact CLI command, if applicable"),
  expected_output: z.string().describe("What the user should see after executing this step"),
  is_destructive: z.boolean().describe("Whether this step modifies state or deletes data"),
});

export const ResolutionSchema = z.object({
  root_cause: z.string().describe("The exact technical failure reason identified from diagnosis"),
  confidence_score: z.number().min(0).max(100).describe("Model's self-assessed confidence 0-100"),
  affected_systems: z.array(z.string()).describe("List of specific systems/services impacted"),
  prerequisites: z.array(z.string()).describe("What the user must verify before proceeding"),
  steps: z.array(ResolutionStepSchema).min(1).describe("Ordered resolution steps with verification"),
  rollback_plan: z.string().describe("Mandatory steps to revert if the fix fails"),
  verification: z.string().describe("How to confirm the fix worked after all steps are done"),
});

export type Resolution = z.infer<typeof ResolutionSchema>;
export type ResolutionStep = z.infer<typeof ResolutionStepSchema>;

// ═══════════════════════════════════════════════════════════════════
// renderRunbook — Deterministic Markdown from Typed Resolution
// ═══════════════════════════════════════════════════════════════════
// Converts a validated Resolution object into the markdown runbook
// format the frontend expects. No LLM formatting drift possible
// since every field is templated server-side.

export function renderRunbook(res: Resolution, category?: string): string {
  const lines: string[] = [];

  lines.push(`### Sugoi's Technical Runbook`);
  lines.push("");

  // Root Cause
  lines.push(`**Root Cause Analysis:**`);
  lines.push(`> ${res.root_cause}`);
  lines.push("");

  // Affected Systems
  if (res.affected_systems.length > 0) {
    lines.push(`**Affected Systems:** ${res.affected_systems.join(", ")}`);
    lines.push("");
  }

  // Confidence
  lines.push(`**Confidence:** ${res.confidence_score}%`);
  lines.push("");

  // Prerequisites
  if (res.prerequisites.length > 0) {
    lines.push(`**Prerequisites (verify before proceeding):**`);
    for (const prereq of res.prerequisites) {
      lines.push(`- [ ] ${prereq}`);
    }
    lines.push("");
  }

  // Execution Steps
  lines.push(`**Execution Steps:**`);
  lines.push("");
  for (let i = 0; i < res.steps.length; i++) {
    const step = res.steps[i];
    const destructiveTag = step.is_destructive ? " **[DESTRUCTIVE]**" : "";
    lines.push(`**Step ${i + 1}.** ${step.action}${destructiveTag}`);
    
    if (step.command) {
      lines.push("```bash");
      lines.push(step.command);
      lines.push("```");
    }
    
    lines.push(`*Expected output:* ${step.expected_output}`);
    lines.push("");
  }

  // Rollback Plan
  lines.push(`**Rollback Plan:**`);
  lines.push(`> ${res.rollback_plan}`);
  lines.push("");

  // Verification
  lines.push(`**Verification:**`);
  lines.push(`> ${res.verification}`);

  return lines.join("\n");
}

// ── Helpers ──

function getCategoryEmoji(category: string): string {
  return "";
}
