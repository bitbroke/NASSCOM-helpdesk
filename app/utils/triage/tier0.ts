import PipelineSingleton from '@/lib/ml';

export interface LRModel {
  weights: number[][]; // [num_classes][384_dimensions]
  intercepts: number[]; // [num_classes]
  classes: string[];
}

export async function runLocalClassifier(ticketText: string, modelJson: any) {
  // 1. Generate the embedding (mandatory step shared with your RAG layer)
  const embedder = await PipelineSingleton.getEmbedding();
  const output = await (embedder as any)(ticketText, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data) as number[];

  const { classes, weights, intercepts } = modelJson;

  // Layer 1: Input (384) -> Hidden 1 (100)
  const h1 = new Array(100).fill(0);
  for (let j = 0; j < 100; j++) {
    let z = intercepts[0][j];
    for (let i = 0; i < 384; i++) {
      z += embedding[i] * weights[0][i][j];
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

  // Apply Softmax
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map((l: number) => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a: number, b: number) => a + b, 0);
  const probabilities = expLogits.map((e: number) => e / sumExp);

  const maxProb = Math.max(...probabilities);
  const bestClassIdx = probabilities.indexOf(maxProb);

  return {
    category: classes[bestClassIdx],
    confidence: maxProb,
    embedding
  };
}
