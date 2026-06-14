/**
 * Tests for the Council Duel winner-selection logic.
 * The Council Duel races Gemini vs Groq and picks a winner based on
 * resolution length (route.ts L178). These tests verify the scoring
 * algorithm and edge cases.
 */

interface CouncilResult {
  provider: string;
  priority: string;
  resolution: string;
}

// ── Extracted scoring function (mirrors route.ts L177-L182) ──
function selectCouncilWinner(results: CouncilResult[]): CouncilResult | null {
  if (results.length === 0) return null;
  // Current implementation: sort by resolution length descending, pick first
  const winner = results.sort((a, b) => b.resolution.length - a.resolution.length)[0];
  return winner;
}

// ── Proposed improved scoring: Information Density Ratio ──
function computeInfoDensity(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;
  
  // Technical keywords that indicate actionable content
  const techPattern = /^(run|execute|check|verify|restart|reboot|ssh|sudo|curl|ping|traceroute|grep|awk|sed|cat|tail|head|kill|systemctl|kubectl|docker|npm|git|pip|apt|yum|dnf|select|insert|update|delete|alter|create|drop|reindex|vacuum|analyze|config|conf|yml|yaml|json|xml|toml|env|port|ip|dns|tcp|udp|http|https|ssl|tls|api|url|endpoint|server|database|cluster|node|pod|container|volume|disk|cpu|ram|memory|swap|pid|log|error|fatal|panic|crash|timeout|retry|cache|queue|worker|cron|daemon|service|firewall|iptables|ufw|nginx|apache|cert|key|token|auth|role|permission|ldap|vpn)$/;
  
  const uniqueTech = new Set(words.filter(w => techPattern.test(w)));
  return uniqueTech.size / words.length;
}

function selectCouncilWinnerImproved(results: CouncilResult[]): CouncilResult | null {
  if (results.length === 0) return null;
  
  const scored = results.map(r => ({
    ...r,
    densityScore: computeInfoDensity(r.resolution),
    lengthScore: Math.min(r.resolution.length / 1000, 1), // cap at 1000 chars
  }));
  
  // Weighted: 60% density, 40% length
  scored.sort((a, b) => {
    const scoreA = a.densityScore * 0.6 + a.lengthScore * 0.4;
    const scoreB = b.densityScore * 0.6 + b.lengthScore * 0.4;
    return scoreB - scoreA;
  });
  
  return scored[0];
}

describe("Council Duel Winner Selection", () => {
  // ─── Current Length-Based Scoring ──────────────────────────────
  describe("current scoring (length-based)", () => {
    it("should pick the longer resolution as the winner", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "High", resolution: "Short fix" },
        { provider: "GROQ", priority: "High", resolution: "This is a much longer and more detailed resolution with multiple steps" },
      ];
      const winner = selectCouncilWinner(results);
      expect(winner?.provider).toBe("GROQ");
    });

    it("should return the single result when only one provider responds", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "Medium", resolution: "Restart the service" },
      ];
      const winner = selectCouncilWinner(results);
      expect(winner?.provider).toBe("GEMINI");
      expect(winner?.resolution).toBe("Restart the service");
    });

    it("should return null when no results", () => {
      const winner = selectCouncilWinner([]);
      expect(winner).toBeNull();
    });

    it("should handle identical-length resolutions (first after sort wins)", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "High", resolution: "AAAA" },
        { provider: "GROQ", priority: "High", resolution: "BBBB" },
      ];
      const winner = selectCouncilWinner(results);
      // Both length 4, sort is stable → first stays first
      expect(winner).not.toBeNull();
      expect(winner?.resolution.length).toBe(4);
    });

    it("should be gameable by repetitive padding (this is the known flaw)", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "High", resolution: "Run `systemctl restart nginx` to fix the ingress." },
        { provider: "GROQ", priority: "High", resolution: "Step 1: Check. Step 2: Check. Step 3: Check. Step 4: Check. Step 5: Check. Step 6: Check. Step 7: Check. Step 8: Check again. Step 9: Keep checking." },
      ];
      const winner = selectCouncilWinner(results);
      // GROQ wins on length despite being less useful
      expect(winner?.provider).toBe("GROQ");
    });
  });

  // ─── Improved Density-Based Scoring ───────────────────────────
  describe("improved scoring (info density)", () => {
    it("should prefer technically dense resolutions over verbose padding", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "High", resolution: "Run systemctl restart nginx then check kubectl get pods and verify dns with nslookup and traceroute" },
        { provider: "GROQ", priority: "High", resolution: "Step 1: Check the thing. Step 2: Look at it. Step 3: Check again. Step 4: Look more. Step 5: Keep looking at the thing. Step 6: Still checking." },
      ];
      const winner = selectCouncilWinnerImproved(results);
      expect(winner?.provider).toBe("GEMINI");
    });

    it("should still work with single result", () => {
      const results: CouncilResult[] = [
        { provider: "GROQ", priority: "Medium", resolution: "Restart the database server and run vacuum analyze" },
      ];
      const winner = selectCouncilWinnerImproved(results);
      expect(winner?.provider).toBe("GROQ");
    });

    it("should return null for empty array", () => {
      const winner = selectCouncilWinnerImproved([]);
      expect(winner).toBeNull();
    });
  });

  // ─── Information Density Ratio ────────────────────────────────
  describe("computeInfoDensity", () => {
    it("should return 0 for empty text", () => {
      expect(computeInfoDensity("")).toBe(0);
    });

    it("should return high density for purely technical text", () => {
      const density = computeInfoDensity("run systemctl restart nginx check kubectl dns port server");
      expect(density).toBeGreaterThan(0.5);
    });

    it("should return low density for non-technical filler", () => {
      const density = computeInfoDensity("Please look into this matter and let me know what you think about the situation regarding the ongoing issues");
      expect(density).toBeLessThan(0.1);
    });

    it("should handle duplicate keywords (uses Set for unique count)", () => {
      const density1 = computeInfoDensity("run run run run run server");
      const density2 = computeInfoDensity("run server restart check dns");
      // density2 has more unique tech keywords
      expect(density2).toBeGreaterThan(density1);
    });
  });

  // ─── Resolution Validation ────────────────────────────────────
  describe("resolution quality checks", () => {
    it("should ensure winning resolution is non-empty", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "High", resolution: "Valid resolution" },
        { provider: "GROQ", priority: "High", resolution: "" },
      ];
      const winner = selectCouncilWinner(results);
      expect(winner?.resolution.length).toBeGreaterThan(0);
    });

    it("should ensure winning resolution is not just whitespace", () => {
      const results: CouncilResult[] = [
        { provider: "GEMINI", priority: "High", resolution: "   " },
        { provider: "GROQ", priority: "High", resolution: "Actual fix" },
      ];
      const winner = selectCouncilWinner(results);
      // "   " has length 3, "Actual fix" has length 10 → GROQ wins
      expect(winner?.provider).toBe("GROQ");
      expect(winner?.resolution.trim().length).toBeGreaterThan(0);
    });
  });
});
