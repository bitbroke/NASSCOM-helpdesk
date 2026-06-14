import { parseLogFile } from "../lib/log-parser";

describe("log-parser", () => {
  // ─── Error Type Extraction ────────────────────────────────────
  describe("error type extraction", () => {
    it("should extract error type from standard error log line", () => {
      const log = "2026-01-15 10:30:45 ERROR: Connection refused to database primary";
      const result = parseLogFile(log);
      expect(result.errorType).toBe("Connection refused to database primary");
    });

    it("should extract error type from exception log line", () => {
      const log = "Exception: NullPointerException in module auth";
      const result = parseLogFile(log);
      expect(result.errorType).toBe("NullPointerException in module auth");
    });

    it("should extract error type from panic log line", () => {
      const log = "kernel: PANIC: corrupted item pointer in btree index";
      const result = parseLogFile(log);
      expect(result.errorType).toBe("corrupted item pointer in btree index");
    });

    it("should extract error type from fatal log line", () => {
      const log = "FATAL: too many connections for role 'postgres'";
      const result = parseLogFile(log);
      expect(result.errorType).toBe("too many connections for role 'postgres'");
    });

    it("should extract error type from uncaught exception", () => {
      const log = "Uncaught: TypeError: Cannot read properties of undefined";
      const result = parseLogFile(log);
      expect(result.errorType).toBe("TypeError: Cannot read properties of undefined");
    });

    it("should capture only the first error type when multiple exist", () => {
      const log = `ERROR: First error line
ERROR: Second error line`;
      const result = parseLogFile(log);
      expect(result.errorType).toBe("First error line");
    });
  });

  // ─── Error Code Extraction ────────────────────────────────────
  describe("error code extraction", () => {
    it("should extract HTTP error codes", () => {
      const log = "Request failed with HTTP 503 Service Unavailable";
      const result = parseLogFile(log);
      expect(result.errorCode).toBe("HTTP 503");
    });

    it("should extract hex error codes", () => {
      const log = "BSOD triggered with error 0xDEADBEEF in kernel space";
      const result = parseLogFile(log);
      expect(result.errorCode).toBe("0xDEADBEEF");
    });

    it("should extract _ERROR pattern codes", () => {
      const log = "SSL handshake failed: SSL_HANDSHAKE_ERROR during TLS negotiation";
      const result = parseLogFile(log);
      expect(result.errorCode).toBe("SSL_HANDSHAKE_ERROR");
    });

    it("should capture first error code when multiple exist", () => {
      const log = `HTTP 404 not found
0xFF00 memory violation`;
      const result = parseLogFile(log);
      expect(result.errorCode).toBe("HTTP 404");
    });
  });

  // ─── Stack Trace Extraction ───────────────────────────────────
  describe("stack trace extraction", () => {
    it("should capture stack frames starting with 'at'", () => {
      const log = `Error: Connection timeout
  at Database.connect (db.js:42)
  at Server.init (server.js:15)
  at main (index.js:8)`;
      const result = parseLogFile(log);
      expect(result.stackTrace.length).toBe(3);
      expect(result.stackTrace[0]).toContain("Database.connect");
    });

    it("should limit stack trace to 5 frames max", () => {
      const log = `Error: Stack overflow
  at fn1 (a.js:1)
  at fn2 (b.js:2)
  at fn3 (c.js:3)
  at fn4 (d.js:4)
  at fn5 (e.js:5)
  at fn6 (f.js:6)
  at fn7 (g.js:7)`;
      const result = parseLogFile(log);
      expect(result.stackTrace.length).toBe(5);
    });

    it("should trim whitespace from captured stack frames", () => {
      const log = `Error: test
    at   someFunction (file.js:10)  `;
      const result = parseLogFile(log);
      expect(result.stackTrace[0]).toBe("at   someFunction (file.js:10)");
    });
  });

  // ─── Summary Generation ───────────────────────────────────────
  describe("summary generation", () => {
    it("should include error type in summary", () => {
      const log = "ERROR: Disk write failure";
      const result = parseLogFile(log);
      expect(result.summary).toContain("Key Error: Disk write failure");
    });

    it("should include error code in summary", () => {
      const log = "Request returned HTTP 502 Bad Gateway";
      const result = parseLogFile(log);
      expect(result.summary).toContain("Code: HTTP 502");
    });

    it("should include stack frame count in summary", () => {
      const log = `ERROR: Something broke
  at fn1 (a.js:1)
  at fn2 (b.js:2)`;
      const result = parseLogFile(log);
      expect(result.summary).toContain("2 stack frames");
    });

    it("should build comprehensive summary from multi-line log", () => {
      const log = `2026-01-15 ERROR: OOM killed process nginx
HTTP 503 returned from upstream
  at handler (routes.js:55)
  at middleware (app.js:12)`;
      const result = parseLogFile(log);
      expect(result.summary).toContain("Key Error");
      expect(result.summary).toContain("Code");
      expect(result.summary).toContain("stack frames");
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────
  describe("edge cases", () => {
    it("should handle empty input gracefully", () => {
      const result = parseLogFile("");
      expect(result.errorType).toBeNull();
      expect(result.errorCode).toBeNull();
      expect(result.stackTrace).toEqual([]);
      expect(result.summary).toBe("");
    });

    it("should handle null-ish input", () => {
      const result = parseLogFile(null as any);
      expect(result.errorType).toBeNull();
      expect(result.errorCode).toBeNull();
    });

    it("should handle log with no errors (just info lines)", () => {
      const log = `2026-01-15 INFO: Server started on port 3000
2026-01-15 INFO: Database connection established
2026-01-15 INFO: Ready to accept connections`;
      const result = parseLogFile(log);
      expect(result.errorType).toBeNull();
      expect(result.errorCode).toBeNull();
      expect(result.stackTrace).toEqual([]);
    });

    it("should handle multiline log content correctly", () => {
      const log = `INFO: Starting service
WARNING: Deprecated API used
ERROR: Failed to initialize module
  at ModuleLoader.init (loader.js:233)`;
      const result = parseLogFile(log);
      expect(result.errorType).toBe("Failed to initialize module");
      expect(result.stackTrace.length).toBe(1);
    });
  });
});
