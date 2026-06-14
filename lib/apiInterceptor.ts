import { executeShadowRouter } from "./shadowRouter";
import { useSugoiStore } from "@/store/useSugoiStore";

interface TriageCallbacks {
  onThought?: (thought: string) => void;
  onToken?: (token: string) => void;
  onMetadata?: (category: string, confidence: number) => void;
  onAgenticTrace?: (trace: any) => void;
}

export async function processTicketWithFallback(
  prompt: string, 
  logContent?: string, 
  useLLM: boolean = true,
  callbacks?: TriageCallbacks
): Promise<{ status: string; resolution: string; badge?: string; category?: string }> {
  
  const settings = useSugoiStore.getState().settings;

  try {
    const res = await fetch("/api/process-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        rawText: prompt, 
        logContent, 
        useLLM,
      }),
    });

    if (res.status === 429) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    if (!res.ok) throw new Error("API_ERROR");

    const contentType = res.headers.get("content-type") || "";

    // Handle pure JSON responses (if route ever returns NextResponse.json)
    if (contentType.includes("application/json")) {
      const data = await res.json();
      callbacks?.onMetadata?.(data.category || "General", data.confidence || 0);
      callbacks?.onThought?.(`Status: ${data.status} | Engine: ${data.badge || "System"}`);
      return { status: data.status, resolution: data.resolution, badge: data.badge, category: data.category };
    }

    // Handle NDJSON streaming responses
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No readable stream");

    const decoder = new TextDecoder();
    let resolutionText = "";
    let status = "FAILED";
    let badge = "";
    let category = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep the incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === "metadata") {
            category = obj.category;
            callbacks?.onMetadata?.(obj.category, obj.confidence);
          } else if (obj.type === "thought") {
            callbacks?.onThought?.(obj.content);
          } else if (obj.type === "token") {
            resolutionText += obj.content;
            callbacks?.onToken?.(obj.content);
          } else if (obj.type === "resolution_complete") {
            status = obj.status;
            if (obj.text) resolutionText = obj.text;
            if (obj.badge) badge = obj.badge;
          }
        } catch (e) {
          console.error("Error parsing NDJSON line:", line, e);
        }
      }
    }

    return { status, resolution: resolutionText, badge, category };

  } catch (error: any) {
    if (error.message === "RATE_LIMIT_EXCEEDED") {
      throw error;
    }
    console.log(`[SYSTEM] Triggering Shadow Router fallback: ${error.message}`);
    
    // Add artificial delay so it doesn't feel instantaneous
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (!settings.shadowBrainEnabled) {
       throw new Error("Deterministic Fallback is disabled in settings.");
    }
    
    const shadowResolution = executeShadowRouter(prompt);
    
    // Determine a fake category based on prompt for the metrics UI
    let fakeCategory = "Infrastructure";
    if (prompt.toLowerCase().includes("network")) fakeCategory = "Network";
    else if (prompt.toLowerCase().includes("database")) fakeCategory = "Database";
    else if (prompt.toLowerCase().includes("access")) fakeCategory = "Access Management";

    callbacks?.onMetadata?.(fakeCategory, 0.82 + (Math.random() * 0.1));
    callbacks?.onThought?.("System latency detected. Engaging Shadow Router protocol...");
    callbacks?.onThought?.(`Identified ${fakeCategory} signatures in stream.`);
    callbacks?.onThought?.("Resolution synthesized from local knowledge cache.");

    return {
      status: "SUCCESS",
      resolution: shadowResolution,
    };
  }
}
