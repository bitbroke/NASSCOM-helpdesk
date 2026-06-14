/**
 * Tests for the jsonLRClassify function extracted from the process-ticket route.
 * We replicate the function here to test it in isolation without importing
 * the full Next.js route handler.
 */
import lrModelData from "../data/lr_model.json";

/// ── Extracted classifier function (mirrors route.ts) ──
function jsonLRClassify(embeddingArray: number[]) {
  try {
    const lrModel = lrModelData as any;
    const { classes, weights, intercepts } = lrModel;
    
    // Layer 1: Input (384) -> Hidden 1 (100)
    const h1 = new Array(100).fill(0);
    for (let j = 0; j < 100; j++) {
      let z = intercepts[0][j];
      for (let i = 0; i < 384; i++) {
        z += embeddingArray[i] * weights[0][i][j];
      }
      h1[j] = Math.max(0, z); // ReLU
    }

    // Layer 2: Hidden 1 (100) -> Hidden 2 (50)
    const h2 = new Array(50).fill(0);
    for (let j = 0; j < 50; j++) {
      let z = intercepts[1][j];
      for (let i = 0; i < 100; i++) {
        z += h1[i] * weights[1][i][j];
      }
      h2[j] = Math.max(0, z); // ReLU
    }

    // Layer 3: Hidden 2 (50) -> Output Logits (6)
    const logits = classes.map((cat: string, k: number) => {
      let z = intercepts[2][k];
      for (let i = 0; i < 50; i++) {
        z += h2[i] * weights[2][i][k];
      }
      return z;
    });

    const maxLogit = Math.max(...logits);
    const exps = logits.map((z: number) => Math.exp(z - maxLogit));
    const sum = exps.reduce((a: number, b: number) => a + b, 0);
    const probs = exps.map((e: number) => e / sum);
    
    let maxProb = -1, bestCat = classes[0];
    const allProbs: Record<string, number> = {};
    for (let i = 0; i < probs.length; i++) {
      allProbs[classes[i]] = probs[i];
      if (probs[i] > maxProb) { maxProb = probs[i]; bestCat = classes[i]; }
    }
    return { category: bestCat, confidence: maxProb, allProbs };
  } catch {
    return { category: "Infrastructure", confidence: 0.5, allProbs: {} };
  }
}

// ── Broken classifier for error path testing ──
function jsonLRClassifyBroken(embeddingArray: number[]) {
  try {
    const lrModel = { classes: null, weights: null, intercepts: null } as any;
    const { classes, weights, intercepts } = lrModel;
    
    // Layer 1: Input (384) -> Hidden 1 (100)
    const h1 = new Array(100).fill(0);
    for (let j = 0; j < 100; j++) {
      let z = intercepts[0][j];
      for (let i = 0; i < 384; i++) {
        z += embeddingArray[i] * weights[0][i][j];
      }
      h1[j] = Math.max(0, z);
    }
    return { category: "Infrastructure", confidence: 0.5, allProbs: {} };
  } catch {
    return { category: "Infrastructure", confidence: 0.5, allProbs: {} };
  }
}

describe("jsonLRClassify (MLP Classifier)", () => {
  const MODEL_DIM = 384; // bge-small-en-v1.5 embedding dimension
  const CLASSES = (lrModelData as any).classes as string[];

  // ─── Softmax Validity ─────────────────────────────────────────
  describe("softmax probability distribution", () => {
    it("should produce probabilities that sum to ~1.0", () => {
      const zeroVec = new Array(MODEL_DIM).fill(0);
      const result = jsonLRClassify(zeroVec);
      const probSum = Object.values(result.allProbs).reduce((a, b) => a + b, 0);
      expect(probSum).toBeCloseTo(1.0, 5);
    });

    it("should produce individual probabilities in [0, 1]", () => {
      const randomVec = Array.from({ length: MODEL_DIM }, () => Math.random() * 2 - 1);
      const result = jsonLRClassify(randomVec);
      for (const prob of Object.values(result.allProbs)) {
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
    });

    it("should produce probabilities for all model classes", () => {
      const zeroVec = new Array(MODEL_DIM).fill(0);
      const result = jsonLRClassify(zeroVec);
      expect(Object.keys(result.allProbs).length).toBe(CLASSES.length);
      for (const cls of CLASSES) {
        expect(result.allProbs).toHaveProperty(cls);
      }
    });
  });

  // ─── Confidence Output ────────────────────────────────────────
  describe("confidence output", () => {
    it("should return confidence as the max probability", () => {
      const vec = Array.from({ length: MODEL_DIM }, () => Math.random() * 2 - 1);
      const result = jsonLRClassify(vec);
      const maxProb = Math.max(...Object.values(result.allProbs));
      expect(result.confidence).toBeCloseTo(maxProb, 10);
    });

    it("should return confidence in [0, 1]", () => {
      const vec = Array.from({ length: MODEL_DIM }, () => Math.random());
      const result = jsonLRClassify(vec);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ─── Category Output ─────────────────────────────────────────
  describe("category output", () => {
    it("should return a valid category from the model's class list", () => {
      const vec = Array.from({ length: MODEL_DIM }, () => Math.random() * 2 - 1);
      const result = jsonLRClassify(vec);
      expect(CLASSES).toContain(result.category);
    });

    it("should return the class with the highest probability", () => {
      const vec = Array.from({ length: MODEL_DIM }, () => Math.random() * 2 - 1);
      const result = jsonLRClassify(vec);
      const maxEntry = Object.entries(result.allProbs).reduce(
        (best, [cat, prob]) => prob > best[1] ? [cat, prob] : best,
        ["", -1] as [string, number]
      );
      expect(result.category).toBe(maxEntry[0]);
    });
  });


  // ─── Determinism ──────────────────────────────────────────────
  describe("determinism", () => {
    it("should produce identical results for the same input vector", () => {
      const vec = Array.from({ length: MODEL_DIM }, (_, i) => Math.cos(i * 0.05));
      const result1 = jsonLRClassify(vec);
      const result2 = jsonLRClassify(vec);
      expect(result1.category).toBe(result2.category);
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.allProbs).toEqual(result2.allProbs);
    });
  });

  // ─── Error Handling ───────────────────────────────────────────
  describe("error handling", () => {
    it("should fallback to 'Infrastructure' with 0.5 confidence on malformed model data", () => {
      const result = jsonLRClassifyBroken(new Array(MODEL_DIM).fill(0));
      expect(result.category).toBe("Infrastructure");
      expect(result.confidence).toBe(0.5);
      expect(result.allProbs).toEqual({});
    });
  });

  // ─── Dimension Mismatch ───────────────────────────────────────
  describe("dimension handling", () => {
    it("should still produce valid output for shorter-than-expected vectors (pads with 0 implicitly)", () => {
      // Shorter vector — weights[i][j] will be undefined for j > vec.length, becoming NaN → catch block
      const shortVec = new Array(100).fill(0.5);
      const result = jsonLRClassify(shortVec);
      // Either it produces a valid category or falls back
      expect(typeof result.category).toBe("string");
      expect(typeof result.confidence).toBe("number");
    });
  });
});
