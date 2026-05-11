import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

// Configure transformers to not use local downloaded models if they conflict
// and to allow remote fetching on first initialization.
env.allowLocalModels = true;
env.useBrowserCache = false; 
env.cacheDir = '/tmp';

class PipelineSingleton {
  static nerTask = 'token-classification';
  static nerModel = 'Xenova/bert-base-NER';
  static nerInstance: Promise<any> | null = null;

  static embedTask = 'feature-extraction';
  static embedModel = 'Xenova/bge-small-en-v1.5';
  static embedInstance: Promise<any> | null = null;

  // ── ONNX Classifier Singleton ──────────────────────────────────
  // Loads public/models/classifier.onnx via onnxruntime-node.
  // Cached after first load. Falls back gracefully if unavailable.
  static onnxSession: any | null = null;
  static onnxClasses: string[] | null = null;
  static onnxSessionPromise: Promise<any> | null = null;

  static async getNER() {
    if (this.nerInstance === null) {
      this.nerInstance = pipeline(this.nerTask as any, this.nerModel, { quantized: true });
    }
    return this.nerInstance;
  }

  static async getEmbedding() {
    if (this.embedInstance === null) {
      this.embedInstance = pipeline(this.embedTask as any, this.embedModel, { quantized: true });
    }
    return this.embedInstance;
  }

  static async getONNXSession(): Promise<{ session: any; classes: string[] } | null> {
    // Return cached session if already loaded
    if (this.onnxSession && this.onnxClasses) {
      return { session: this.onnxSession, classes: this.onnxClasses };
    }

    // Deduplicate concurrent load requests
    if (this.onnxSessionPromise) {
      return this.onnxSessionPromise;
    }

    this.onnxSessionPromise = (async () => {
      try {
        // Dynamically import to avoid bundling issues on Vercel
        const ort = await import('onnxruntime-web');
        
        // Configure WASM paths for Node environment
        const wasmDir = path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
        const { pathToFileURL } = await import('url');
        ort.env.wasm.wasmPaths = pathToFileURL(wasmDir).href + '/';
        ort.env.wasm.numThreads = 1;

        const modelPath = path.join(process.cwd(), 'public', 'models', 'classifier_v2.onnx');
        const classMapPath = path.join(process.cwd(), 'public', 'models', 'class_map.json');

        if (!fs.existsSync(modelPath)) {
          console.warn('[ONNX] classifier.onnx not found at', modelPath);
          return null;
        }

        const session = await ort.InferenceSession.create(modelPath);
        const classMapRaw = fs.readFileSync(classMapPath, 'utf-8');
        const classMap = JSON.parse(classMapRaw);
        const classes: string[] = classMap.classes;

        // Cache for future requests
        this.onnxSession = session;
        this.onnxClasses = classes;

        console.log('[ONNX] Session loaded. Classes:', classes.join(', '));
        return { session, classes };
      } catch (err: any) {
        console.warn('[ONNX] Failed to load ONNX session:', err?.message || err);
        this.onnxSessionPromise = null; // Allow retry on next request
        return { error: err?.message || String(err) };
      }
    })();

    const res = await this.onnxSessionPromise;
    if (res?.error) {
      this.onnxSessionPromise = null;
      throw new Error(res.error);
    }
    return res;
  }

  /**
   * Run inference on a 384-dimensional embedding using the ONNX session.
   * Returns { category, confidence } or null if ONNX is unavailable.
   */
  static async runONNXClassifier(
    embeddingArray: number[]
  ): Promise<{ category: string; confidence: number; allProbs: Record<string, number> } | null> {
    const result = await this.getONNXSession();
    if (!result) return null;

    const { session, classes } = result;
    try {
      const ort = await import('onnxruntime-web');
      const inputTensor = new ort.Tensor(
        'float32',
        new Float32Array(embeddingArray),
        [1, embeddingArray.length]
      );

      // The skl2onnx export uses 'float_input' as the input name
      const feeds = { float_input: inputTensor };
      const outputMap = await session.run(feeds);

      // The probability output tensor is typically 'probabilities' or 'output_probability'
      let probs: number[] = [];
      const probTensor = outputMap['probabilities'] || outputMap['output_probability'] || outputMap[Object.keys(outputMap).find(k => k.includes('prob')) ?? ''];
      
      if (probTensor) {
        // Linear models might output a single flat tensor
        if (probTensor.data instanceof Float32Array || probTensor.data instanceof Float64Array) {
           probs = Array.from(probTensor.data);
        } else if (Array.isArray(probTensor.data) || probTensor.data[0]) {
           // Tree models might output a Sequence of Maps or similar
           // We extract the array of values from the map
           const map = probTensor.data[0] || probTensor.data;
           if (typeof map === 'object' && map !== null) {
              // Extract values matching the classes array order
              probs = classes.map(c => map[c] ?? 0);
           }
        }
      }

      if (probs.length === 0) {
        console.warn('[ONNX] No probabilities output found in model. Available outputs:', Object.keys(outputMap));
        return null;
      }

      let maxProb = -1;
      let bestIdx = 0;
      for (let i = 0; i < probs.length; i++) {
        if (probs[i] > maxProb) { maxProb = probs[i]; bestIdx = i; }
      }

      const allProbs: Record<string, number> = {};
      classes.forEach((cat, i) => { allProbs[cat] = probs[i] ?? 0; });

      return { category: classes[bestIdx], confidence: maxProb, allProbs };
    } catch (err: any) {
      console.warn('[ONNX] Inference error:', err?.message || err);
      throw err;
    }
  }
}

export default PipelineSingleton;
