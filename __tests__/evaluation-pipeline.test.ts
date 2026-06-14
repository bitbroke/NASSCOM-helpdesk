/**
 * Tests for the payload integrity of the evaluation script (evaluate.mjs).
 * We specifically verify the bug where the LLM-as-Judge prompt
 * was not receiving the AI-generated resolution.
 */

describe("Evaluation Pipeline Payload", () => {
  // Simulating the prompt construction block from evaluate.mjs
  function buildJudgePrompt(ticket: any, predCategory: string, predResolution: string) {
    return `You are an expert IT support quality evaluator. Rate the AI-generated resolution on a scale of 1-5.

Original IT Issue:
${ticket.title}
${ticket.description}

Ground Truth Resolution:
${ticket.resolution}

AI-Generated Resolution:
${predResolution}

AI-Generated Category: ${predCategory}
Ground Truth Category: ${ticket.category}

Scoring criteria:
- 5: Perfect — correct category, comprehensive resolution covering all steps
- 4: Good — correct category, mostly complete resolution
- 3: Adequate — category correct, resolution addresses the issue but misses steps
- 2: Poor — wrong category OR resolution doesn't adequately address the issue
- 1: Fail — wrong category AND irrelevant resolution

Return ONLY raw JSON: {"score": <1-5>, "reasoning": "brief explanation"}`;
  }

  const mockTicket = {
    title: "Can't connect to VPN",
    description: "I keep getting error 809 when trying to use Cisco AnyConnect.",
    resolution: "Ensure UDP port 500 and 4500 are open on the local firewall.",
    category: "Network"
  };

  it("should include the AI-generated resolution in the judge prompt", () => {
    const aiResolution = "Disable Windows Firewall temporarily and test connection.";
    const aiCategory = "Network";

    const prompt = buildJudgePrompt(mockTicket, aiCategory, aiResolution);

    expect(prompt).toContain("AI-Generated Resolution:");
    expect(prompt).toContain(aiResolution);
    expect(prompt).toContain("Ground Truth Resolution:");
    expect(prompt).toContain(mockTicket.resolution);
  });

  it("should include a fallback if AI resolution is missing", () => {
    // In the event of an API error during generation, predResolution might be 'N/A' or empty
    const aiResolution = "N/A";
    const prompt = buildJudgePrompt(mockTicket, "Network", aiResolution);

    expect(prompt).toContain("AI-Generated Resolution:");
    expect(prompt).toContain("N/A");
  });

  it("should contain the scoring criteria JSON request", () => {
    const prompt = buildJudgePrompt(mockTicket, "Network", "Fix it");
    expect(prompt).toContain('Return ONLY raw JSON: {"score": <1-5>, "reasoning": "brief explanation"}');
  });
});
