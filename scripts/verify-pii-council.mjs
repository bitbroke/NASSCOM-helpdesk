import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { pipeline, env } from '@xenova/transformers';

dotenv.config({ path: '.env.local' });
env.allowLocalModels = true;
env.useBrowserCache = false;

// ── PII Mock Functions (Mirroring route.ts logic) ──
function regexRedact(text) {
  let out = text;
  out = out.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  out = out.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  out = out.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD]');
  return out;
}

const sampleTickets = [
  {
    desc: "Network packet loss",
    text: "User John Smith (john.smith@enterprise.com) reports that the VPN router at IP 10.50.2.1 is dropping packets. His phone is 555-123-4567. Please check iptables config.",
    category: "Network"
  },
  {
    desc: "Database connection",
    text: "DB connection timeout on server 192.168.100.5. Developer jane.doe@corp.com needs access. SSN in logs: 000-11-2222.",
    category: "Database"
  },
  {
    desc: "Application crash",
    text: "Payment app crashed. User email: angry.customer@gmail.com. Credit card 4444-5555-6666-7777 was charged but receipt failed to send. Error code HTTP 500.",
    category: "Application"
  }
];

async function run() {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error("❌ GROQ_API_KEY not set in .env.local");
    process.exit(1);
  }

  const groq = new Groq({ apiKey: groqKey });
  console.log("🔍 Starting PII-Council Verification Wrapper...\n");

  let ner;
  try {
    console.log("Loading BERT NER Pipeline...");
    ner = await pipeline('token-classification', 'Xenova/bert-base-NER', { quantized: true });
    console.log("✅ Pipeline loaded.\n");
  } catch (err) {
    console.error("❌ Failed to load NER pipeline:", err.message);
    process.exit(1);
  }

  let passed = 0;

  for (let i = 0; i < sampleTickets.length; i++) {
    const t = sampleTickets[i];
    console.log(`\n--- Test Case ${i + 1}: ${t.desc} ---`);
    console.log(`Raw Text: ${t.text}`);

    // 1. Regex Redaction
    let sanitized = regexRedact(t.text);

    // 2. NER Redaction (simulating route.ts)
    const entities = await ner(t.text, { aggregation_strategy: "simple" });
    const sorted = Array.isArray(entities) ? entities.sort((a, b) => b.start - a.start) : [];
    for (const ent of sorted) {
      const tag = ent.entity_group === "PER" ? "[REDACTED_NAME]" 
                : ent.entity_group === "LOC" ? "[REDACTED_LOCATION]" 
                : ent.entity_group === "ORG" ? "[REDACTED_ORGANIZATION]" 
                : "[REDACTED_ENTITY]";
      
      // Basic bounds check so we don't mess up string replacement if indices are weird
      if (ent.start >= 0 && ent.end <= sanitized.length) {
          sanitized = sanitized.slice(0, ent.start) + tag + sanitized.slice(ent.end);
      }
    }

    console.log(`Sanitized: ${sanitized}`);

    // 3. Prompt Construction
    const toolData = `[DIAGNOSTICS] Standard state`;
    const prompt = `You are Sugoi, a technical architect. Issue: "${sanitized}". Diagnostics: ${toolData}. Category: ${t.category}. Return JSON: {"priority":"...","resolution":"..."}`;

    // 4. Council Call (Groq)
    try {
      console.log(`Sending to Council (Groq)...`);
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      const resp = JSON.parse(responseText);
      
      console.log(`Resolution received: ${resp.resolution}`);

      // Verification checks
      const hasRedactedTags = responseText.includes("[REDACTED_");
      const isActionable = resp.resolution && resp.resolution.length > 20;

      if (isActionable) {
        console.log(`✅ Pass: Resolution is actionable (${resp.resolution.length} chars)`);
        passed++;
      } else {
        console.log(`❌ Fail: Resolution is missing or too short`);
      }

      if (hasRedactedTags) {
        console.log(`ℹ️ Info: LLM successfully incorporated redacted tags in output.`);
      }

    } catch (err) {
      console.error(`❌ Fail: LLM Call or JSON Parse error: ${err.message}`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`Final Result: ${passed}/${sampleTickets.length} Passed`);
  console.log(`==================================================`);
  process.exit(passed === sampleTickets.length ? 0 : 1);
}

run();
