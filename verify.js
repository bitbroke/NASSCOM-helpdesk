// End-to-end verification script for SUGOI Helpdesk Triage
// Supporting NDJSON streaming

async function testTicket(prompt, useLLM = true) {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/process-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: prompt, useLocalEmbeddings: true, useLLM })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = {
      status: '',
      category: '',
      confidence: 0,
      resolution: '',
      thoughtProcess: []
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'metadata') {
            result.category = obj.category;
            result.confidence = obj.confidence;
          } else if (obj.type === 'thought') {
            result.thoughtProcess.push(obj.content);
          } else if (obj.type === 'resolution_complete') {
            result.status = obj.status;
            result.resolution = obj.text;
            if (obj.badge) result.badge = obj.badge;
          }
        } catch (e) {
          console.error("Parse error on line:", line, e);
        }
      }
    }
    return result;
  } catch (error) {
    console.error("Request failed:", error.message);
    return { status: 'ERROR', error: error.message };
  }
}

async function runTests() {
  console.log("=== PHASE 2: PII Scrubbing ===");
  const piiRes = await testTicket("My name is Sarah Connor, my IP address is 192.168.1.100, and my email is sarah.connor@skynet.com. The database is crashing.");
  console.log("Status:", piiRes.status);
  console.log("Category:", piiRes.category);
  console.log("Confidence:", piiRes.confidence);
  console.log("Thought Process:", piiRes.thoughtProcess);
  console.log();

  console.log("=== PHASE 3: Cloud Mode ===");
  const cloudRes = await testTicket("The production PostgreSQL database is throwing deadlock errors when I try to run the monthly payroll query.");
  console.log("Resolution snippet:", cloudRes.resolution?.substring(0, 200) + '...');
  console.log("Status:", cloudRes.status);
  console.log("Confidence:", cloudRes.confidence);
  console.log("Category:", cloudRes.category);
  console.log("Thought Process:", cloudRes.thoughtProcess);
  console.log();

  console.log("=== PHASE 4: Triage Veto ===");
  const vetoRes = await testTicket("The coffee machine in the breakroom is leaking water all over the floor and the lights are flickering.");
  console.log("Status:", vetoRes.status);
  console.log("Category:", vetoRes.category);
  console.log("Confidence:", vetoRes.confidence);
  console.log("Thought Process:", vetoRes.thoughtProcess);
  console.log();

  console.log("=== PHASE 5: Air-Gapped Mode ===");
  const offlineRes = await testTicket("GlobalProtect VPN keeps disconnecting every 5 minutes.", false);
  console.log("Resolution snippet:", offlineRes.resolution?.substring(0, 200) + '...');
  console.log("Status:", offlineRes.status);
  console.log("Thought Process:", offlineRes.thoughtProcess);
  console.log();

  console.log("=== PHASE 6: Overwatch ===");
  for (let i = 0; i < 2; i++) {
    const res = await testTicket("The main API Gateway is returning 502 Bad Gateway errors across the board.");
    console.log(`Submission ${i+1} Status:`, res.status);
    console.log("Thought Process:", res.thoughtProcess);
  }
}

runTests().catch(console.error);
