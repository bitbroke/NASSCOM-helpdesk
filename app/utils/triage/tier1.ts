export interface VaultTemplate {
  keywords: { [word: string]: number };
  phrases: string[];
  category: string;
  solution: string;
  confidence_override: number;
}

const KEYWORD_VAULT: { [id: string]: VaultTemplate } = {
  "AM-001": {
    phrases: ["cannot login", "password reset", "locked out"],
    keywords: { "mfa": 1.5, "login": 1.0, "password": 1.0 },
    category: "Access Management",
    solution: "### Access Portal Reset\n1. Navigate to the Identity Gateway...\n2. Clear browser cookies.",
    confidence_override: 1.0
  },
  "NET-001": {
    phrases: ["vpn connection failed", "vpn is down", "cannot connect to vpn"],
    keywords: { "vpn": 2.0, "connection": 1.0, "failed": 1.0 },
    category: "Network",
    solution: "### Network Triage: VPN Connectivity\n1. Disconnect and kill the background VPN daemon.\n2. Run `ipconfig /flushdns` (Windows) or `resolvectl flush-caches` (Linux).\n3. Re-authenticate through the primary SSO portal.",
    confidence_override: 1.0
  },
  "INF-001": {
    phrases: ["oom killed", "out of memory"],
    keywords: { "oom": 2.0, "memory": 1.0, "killed": 1.0 },
    category: "Infrastructure",
    solution: "### Infrastructure Triage: The OOM Killer Cometh\n1. Run `dmesg -T | grep -i oom-killer` to identify the murdered process.\n2. Ensure Kubernetes memory limits (`resources.limits.memory`) are strictly set.\n3. Cycle the dependent services.",
    confidence_override: 1.0
  }
};

export function scanKeywordVault(text: string): VaultTemplate | null {
  const cleanText = text.toLowerCase();

  for (const template of Object.values(KEYWORD_VAULT)) {
    if (template.phrases.some(phrase => cleanText.includes(phrase))) {
      return template;
    }

    let accumulatedScore = 0;
    for (const [word, weight] of Object.entries(template.keywords)) {
      if (cleanText.includes(word)) accumulatedScore += weight;
    }

    if (accumulatedScore >= 2.5) {
      return template;
    }
  }
  return null;
}
