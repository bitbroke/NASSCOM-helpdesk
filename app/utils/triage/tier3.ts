export function getShadowTemplate(ticketText: string, guessedCategory: string) {
  const technicalKeywords = ['error', 'fail', 'login', 'server', 'network', 'database', 'app', 'crash', 'dns', 'password', 'mfa', 'permission'];
  const lowerText = ticketText.toLowerCase();
  
  // Check if the ticket contains baseline technical keywords
  const hasTechnicalContext = technicalKeywords.some(kw => lowerText.includes(kw));
  console.log(`[GARBAGE FILTER CHECK] Text: "${lowerText}", Has Tech Context: ${hasTechnicalContext}`);

  if (!hasTechnicalContext) {
    return {
      status: "ESCALATED",
      category: "Out-of-Scope",
      confidence: 0.0,
      badge: "Invalid Request",
      resolution: `
### Sugoi Analysis: Request Out of Scope
Look, I am a brilliant enterprise IT helper, not a miracle worker or a matchmaking app. Your current issue cannot be resolved by debugging a database or restarting a router. 

**System Action:** This ticket has been marked as a non-technical anomaly with **0% confidence** and successfully routed to the human garbage collection queue. Please limit submissions to enterprise infrastructure faults.
      `.trim()
    };
  }

  // If it actually is an IT ticket but just a weird one, return the actual universal IT fallback
  return {
    status: "ESCALATED",
    category: guessedCategory,
    confidence: 0.0,
    badge: "Shadow Router Fallback",
    resolution: `
### Universal Triage: Standard Diagnostic Protocol
Sugoi's Analysis: Technical context detected but unverified. Executing standard level-1 containment...

**Execution Steps:**
1. **Check Resources:** Use \`htop\` for CPU/RAM, and \`df -h\` for disk space. Alert if >90%.
2. **Container Health:** Run \`kubectl get pods -A | grep -v Running\` and investigate logs.
3. **Service Status:** Run \`systemctl status <service>\`, checking \`dmesg\` for OOMKilled events.
4. **CI/CD Pipeline:** Check recent GitHub Actions/Jenkins logs for failed artifact registry access.
5. **Cloud Audit:** Verify AWS/GCP IAM roles, security groups, and billing quotas to ensure no silent throttling.
    `.trim()
  };
}
