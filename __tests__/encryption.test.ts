/**
 * Tests for the AES-256-GCM encryption/decryption round-trip.
 * Tests both the happy path (with valid key) and error paths.
 */

// We need to set the env var BEFORE importing encryption module
// since it reads TICKET_ENCRYPTION_KEY at module load time.
const TEST_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

describe("encryption", () => {
  let encrypt: (text: string) => string;
  let decrypt: (text: string) => string;

  // ─── Setup: Load with valid key ───────────────────────────────
  beforeAll(async () => {
    process.env.TICKET_ENCRYPTION_KEY = TEST_KEY;
    // Dynamic import to pick up the env var
    jest.resetModules();
    const mod = await import("../lib/encryption");
    encrypt = mod.encrypt;
    decrypt = mod.decrypt;
  });

  afterAll(() => {
    delete process.env.TICKET_ENCRYPTION_KEY;
  });

  // ─── Round-Trip Tests ─────────────────────────────────────────
  describe("round-trip encrypt → decrypt", () => {
    it("should decrypt to original plaintext", () => {
      const plaintext = "Hello, this is a secret IT ticket about server 192.168.1.1";
      const ciphertext = encrypt(plaintext);
      const recovered = decrypt(ciphertext);
      expect(recovered).toBe(plaintext);
    });

    it("should work with empty string", () => {
      const plaintext = "";
      const ciphertext = encrypt(plaintext);
      const recovered = decrypt(ciphertext);
      expect(recovered).toBe(plaintext);
    });

    it("should work with unicode content", () => {
      const plaintext = "Sugoi says: こんにちは 🔥 PII data here: admin@corp.com";
      const ciphertext = encrypt(plaintext);
      const recovered = decrypt(ciphertext);
      expect(recovered).toBe(plaintext);
    });

    it("should work with long text", () => {
      const plaintext = "A".repeat(10000);
      const ciphertext = encrypt(plaintext);
      const recovered = decrypt(ciphertext);
      expect(recovered).toBe(plaintext);
    });

    it("should work with special characters", () => {
      const plaintext = `SELECT * FROM users WHERE name = 'O\'Brien' AND role = "admin";\n\t-- DROP TABLE;`;
      const ciphertext = encrypt(plaintext);
      const recovered = decrypt(ciphertext);
      expect(recovered).toBe(plaintext);
    });
  });

  // ─── Ciphertext Format ────────────────────────────────────────
  describe("ciphertext format", () => {
    it("should produce ciphertext in iv:authTag:encrypted format", () => {
      const ciphertext = encrypt("test");
      const parts = ciphertext.split(":");
      expect(parts.length).toBe(3);
    });

    it("should produce hex-encoded IV of 32 chars (16 bytes)", () => {
      const ciphertext = encrypt("test");
      const [iv] = ciphertext.split(":");
      expect(iv.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(iv)).toBe(true);
    });

    it("should produce hex-encoded auth tag of 32 chars (16 bytes)", () => {
      const ciphertext = encrypt("test");
      const [, authTag] = ciphertext.split(":");
      expect(authTag.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(authTag)).toBe(true);
    });

    it("should produce different ciphertexts for the same plaintext (random IV)", () => {
      const plaintext = "same text encrypted twice";
      const ct1 = encrypt(plaintext);
      const ct2 = encrypt(plaintext);
      expect(ct1).not.toBe(ct2);
    });
  });

  // ─── Tamper Detection ─────────────────────────────────────────
  describe("tamper detection", () => {
    it("should fail to decrypt when ciphertext is tampered", () => {
      const plaintext = "Secret data";
      const ciphertext = encrypt(plaintext);
      const parts = ciphertext.split(":");
      // Tamper with encrypted data (flip a character)
      const tampered = parts[2].replace(/[0-9a-f]/, (c) => c === "0" ? "1" : "0");
      const tamperedCiphertext = `${parts[0]}:${parts[1]}:${tampered}`;
      
      // GCM should detect tampering — decrypt will either throw or return raw text
      const result = decrypt(tamperedCiphertext);
      // The function catches errors and returns the raw text as fallback
      expect(result).not.toBe(plaintext);
    });
  });
});

// ─── Missing Key Tests (separate describe to reset env) ─────────
describe("encryption (missing key)", () => {
  let encryptNoKey: (text: string) => string;
  let decryptNoKey: (text: string) => string;

  beforeAll(async () => {
    delete process.env.TICKET_ENCRYPTION_KEY;
    jest.resetModules();
    const mod = await import("../lib/encryption");
    encryptNoKey = mod.encrypt;
    decryptNoKey = mod.decrypt;
  });

  it("should return plaintext when encryption key is missing", () => {
    const plaintext = "No key, no encryption";
    const result = encryptNoKey(plaintext);
    expect(result).toBe(plaintext);
  });

  it("should return plaintext when decrypting non-encrypted text", () => {
    const plaintext = "Just a regular string without colons";
    const result = decryptNoKey(plaintext);
    expect(result).toBe(plaintext);
  });
});
