// Use native fetch

async function testTicket(prompt, useLLM = true) {
  const res = await fetch('http://localhost:3000/api/process-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText: prompt, useLocalEmbeddings: true, useLLM })
  });
  return res.json();
}

async function runTests() {
  console.log("=== PHASE 2: PII Scrubbing ===");
  const piiRes = await testTicket("My name is Sarah Connor, my IP address is 192.168.1.100, and my email is sarah.connor@skynet.com. The database is crashing.");
  console.log("Sanitized:", piiRes.sanitizedText);
  console.log("Expected [REDACTED_NAME], [REDACTED_IP], [REDACTED_EMAIL]\n");

  console.log("=== PHASE 3: Cloud Mode ===");
  const cloudRes = await testTicket("The production PostgreSQL database is throwing deadlock errors when I try to run the monthly payroll query.");
  console.log("Resolution:", cloudRes.resolution?.substring(0, 100) + '...');
  console.log("Status:", cloudRes.status);
  console.log("Confidence:", cloudRes.confidence);
  console.log("Category:", cloudRes.category);
  console.log("Thought Process:", cloudRes.thoughtProcess.slice(-3));
  console.log();

  console.log("=== PHASE 4: Triage Veto ===");
  const vetoRes = await testTicket("The coffee machine in the breakroom is leaking water all over the floor and the lights are flickering.");
  console.log("Status:", vetoRes.status);
  console.log("Category:", vetoRes.category);
  console.log("Confidence:", vetoRes.confidence);
  console.log("Thought Process:", vetoRes.thoughtProcess.slice(-3));
  console.log();

  console.log("=== PHASE 5: Air-Gapped Mode ===");
  const offlineRes = await testTicket("GlobalProtect VPN keeps disconnecting every 5 minutes.", false);
  console.log("Resolution:", offlineRes.resolution?.substring(0, 100) + '...');
  console.log();

  console.log("=== PHASE 6: Overwatch ===");
  for (let i = 0; i < 3; i++) {
    const res = await testTicket("The main API Gateway is returning 502 Bad Gateway errors across the board.");
    console.log(`Submission ${i+1} Status:`, res.status);
    console.log("Thought Process:", res.thoughtProcess.slice(-2));
  }
}

runTests().catch(console.error);
