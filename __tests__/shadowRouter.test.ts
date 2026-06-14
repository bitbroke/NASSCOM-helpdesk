import { executeShadowRouter } from "../lib/shadowRouter";

describe("shadowRouter", () => {
  // ─── Exact Keyword Routing ────────────────────────────────────
  describe("exact keyword routing", () => {
    it("should route 'database connection pool exhaustion' to DB Connection Pool Exhaustion template", () => {
      const result = executeShadowRouter("Our database connection pool is experiencing exhaustion under load");
      expect(result).toContain("Connection Pool Exhaustion");
      expect(result).toContain("pg_stat_activity");
    });

    it("should route 'deadlock transaction' to Deadlock Detected template", () => {
      const result = executeShadowRouter("We have a deadlock in our transaction layer, tables are locked");
      expect(result).toContain("Deadlock Detected");
      expect(result).toContain("pg_locks");
    });

    it("should route 'index corruption' to B-Tree Index Corruption template", () => {
      const result = executeShadowRouter("B-tree index corruption detected, WAL backup needed for data loss prevention");
      expect(result).toContain("B-Tree Index Corruption");
      expect(result).toContain("REINDEX");
    });

    it("should route 'thermal throttling' to Hardware Thermal Throttling template", () => {
      const result = executeShadowRouter("Server is experiencing thermal throttling, temperature is too high");
      expect(result).toContain("Thermal Throttling");
      expect(result).toContain("Turbo Boost");
    });

    it("should route 'liquid cooling pump failure' to Pump Failure template", () => {
      const result = executeShadowRouter("AIO liquid pump failure detected, zero rpm on cooler");
      expect(result).toContain("Liquid Cooling Pump Failure");
      expect(result).toContain("Emergency Shutdown");
    });

    it("should route 'boot failure' to Fatal Boot Failure template", () => {
      const result = executeShadowRouter("Server is dead, completely offline, won't boot after BIOS flash");
      expect(result).toContain("Fatal Boot Failure");
      expect(result).toContain("CMOS");
    });

    it("should route 'kernel panic bsod' to Kernel Panic template", () => {
      const result = executeShadowRouter("Getting blue screen bsod crash with kernel panic and memory dump");
      expect(result).toContain("Kernel Panic");
      expect(result).toContain("MemTest86");
    });

    it("should route '404 ingress' to Ingress Routing Failure template", () => {
      const result = executeShadowRouter("Users hitting 404 errors, seems like ingress routing or load balancer is broken");
      expect(result).toContain("Ingress Routing Failure");
      expect(result).toContain("cert-manager");
    });

    it("should route 'dns resolve failure' to DNS Resolution template", () => {
      const result = executeShadowRouter("Cannot resolve any hostname, dns is broken, nslookup times out");
      expect(result).toContain("DNS Resolution Failure");
      expect(result).toContain("resolv.conf");
    });

    it("should route 'rogue process cpu miner' to Rogue Process template", () => {
      const result = executeShadowRouter("A rogue process is eating 99% CPU, suspect crypto miner");
      expect(result).toContain("Rogue Background Process");
      expect(result).toContain("kill -9");
    });

    it("should route 'disk storage full' to Storage Exhaustion template", () => {
      const result = executeShadowRouter("Root storage disk is full, 100% capacity, write error on volume");
      expect(result).toContain("Storage Volume Exhaustion");
      expect(result).toContain("logrotate");
    });

    it("should route 'oom killer memory leak' to OOM Killer template", () => {
      const result = executeShadowRouter("The OOM killer is executing processes, memory leak causing swap exhaustion");
      expect(result).toContain("OOM Killer");
      expect(result).toContain("dmesg");
    });
  });

  // ─── Multi-Keyword Scoring ────────────────────────────────────
  describe("multi-keyword scoring (highest overlap wins)", () => {
    it("should pick DB pool template when 'database' + 'connection' + 'pool' overlap beats single keyword", () => {
      const result = executeShadowRouter("database connection pool is slow and exhausted");
      expect(result).toContain("Connection Pool Exhaustion");
    });

    it("should prefer DNS over generic network when dns-specific keywords dominate", () => {
      const result = executeShadowRouter("dns resolve failure, nslookup returns nothing, can't reach any hostname");
      expect(result).toContain("DNS Resolution Failure");
    });
  });

  // ─── Short / Generic Input Fallback ───────────────────────────
  describe("short/generic input fallback", () => {
    it("should return 'Triage Incomplete' for very short input", () => {
      const result = executeShadowRouter("hi");
      expect(result).toContain("Triage Incomplete");
    });

    it("should return 'Triage Incomplete' for 'hello'", () => {
      const result = executeShadowRouter("hello there");
      expect(result).toContain("Triage Incomplete");
    });

    it("should return 'Triage Incomplete' for empty-ish input", () => {
      const result = executeShadowRouter("help");
      expect(result).toContain("Triage Incomplete");
    });
  });

  // ─── Universal Fallback ───────────────────────────────────────
  describe("universal fallback", () => {
    it("should return universal fallback for unrelated long prompt", () => {
      const result = executeShadowRouter("my dog ate my homework and I need to submit it tomorrow please advise");
      expect(result).toContain("Universal Triage");
      expect(result).toContain("Standard Diagnostic Protocol");
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────
  describe("edge cases", () => {
    it("should handle mixed-case keywords", () => {
      const result = executeShadowRouter("DATABASE CONNECTION POOL is EXHAUSTED on the SQL server");
      expect(result).toContain("Connection Pool Exhaustion");
    });

    it("should return a non-empty string for any valid input", () => {
      const result = executeShadowRouter("there is some unspecified server problem in production environment");
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result).toBe("string");
    });

    it("should contain markdown headers in all responses", () => {
      const result = executeShadowRouter("server disk is completely full and services are failing");
      expect(result).toContain("###");
    });

    it("should contain execution steps in actionable responses", () => {
      const result = executeShadowRouter("database deadlock detected in production transaction layer");
      expect(result).toContain("Execution Steps");
    });
  });
});
