// lib/reranker.ts
// ═══════════════════════════════════════════════════════════════════
// Cross-Encoder Reranker — Mathematically Precise Document Scoring
// ═══════════════════════════════════════════════════════════════════
// Uses a cross-encoder model that reads query + document TOGETHER
// (unlike bi-encoders which encode them separately). This captures
// fine-grained semantic relationships that vector search misses.
//
// Model: Xenova/ms-marco-MiniLM-L-6-v2 (runs locally, no API key)
// Fallback: keyword-based rerank() from ticket-utils.ts

import { pipeline, env } from '@xenova/transformers';
import { rerank as keywordRerank } from '@/lib/ticket-utils';

// Configure transformers for server-side usage
env.allowLocalModels = true;
env.useBrowserCache = false;

// ── Singleton Cross-Encoder Pipeline ──

let crossEncoderInstance: Promise<any> | null = null;

async function getCrossEncoder() {
  if (crossEncoderInstance === null) {
    console.log('[Reranker] Loading cross-encoder model: Xenova/ms-marco-MiniLM-L-6-v2...');
    crossEncoderInstance = pipeline(
      'text-classification' as any,
      'Xenova/ms-marco-MiniLM-L-6-v2',
      { quantized: true }
    );
  }
  return crossEncoderInstance;
}

// ── Types ──

export interface RerankDocument {
  id?: string;
  sanitized_query?: string;
  resolution?: string;
  resolution_steps?: string;
  similarity?: number;
  [key: string]: any;
}

export interface RankedDocument extends RerankDocument {
  crossEncoderScore: number;
}

// ── Main Reranking Function ──

/**
 * Rerank documents using a cross-encoder model.
 * 
 * The cross-encoder reads query+document SIMULTANEOUSLY, producing
 * a single relevance score. This is more accurate than bi-encoder
 * similarity but slower (O(n) forward passes vs O(1)).
 * 
 * @param query - The user's original query
 * @param documents - Array of candidate documents from vector search
 * @param topK - Number of top results to return (default: 3)
 * @returns Top-K documents sorted by cross-encoder relevance score
 */
export async function crossEncoderRerank(
  query: string,
  documents: RerankDocument[],
  topK: number = 3
): Promise<RankedDocument[]> {
  if (!documents || documents.length === 0) return [];
  if (documents.length <= topK) {
    // No need to rerank if we have fewer docs than topK
    return documents.map(d => ({ ...d, crossEncoderScore: d.similarity || 0 }));
  }

  try {
    const classifier = await getCrossEncoder();

    // Score each (query, document) pair
    const scored: RankedDocument[] = await Promise.all(
      documents.map(async (doc) => {
        const docText = doc.sanitized_query || doc.resolution || doc.resolution_steps || '';
        
        // Truncate to avoid exceeding model's max sequence length (512 tokens)
        const truncatedQuery = query.slice(0, 256);
        const truncatedDoc = docText.slice(0, 256);

        try {
          // Cross-encoder takes a pair {text, text_pair} and outputs a relevance score
          const result = await classifier(truncatedQuery, {
            text_pair: truncatedDoc,
            topk: 1  // Only need the top score
          });
          
          // The model outputs a score — higher means more relevant
          // Some models output [{label: 'LABEL_1', score: 0.95}]
          const score = Array.isArray(result) 
            ? (result[0]?.score || 0) 
            : (result?.score || 0);

          return { ...doc, crossEncoderScore: score };
        } catch {
          // If individual scoring fails, use the original similarity
          return { ...doc, crossEncoderScore: doc.similarity || 0 };
        }
      })
    );

    // Sort by cross-encoder score (descending) and take top-K
    scored.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);
    return scored.slice(0, topK);

  } catch (error: any) {
    console.warn('[Reranker] Cross-encoder failed, falling back to keyword rerank:', error?.message);
    
    // Fallback to the existing keyword-based reranker
    const keywordRanked = keywordRerank(documents, query);
    return keywordRanked.slice(0, topK).map(d => ({
      ...d,
      crossEncoderScore: d.rerankScore || d.similarity || 0
    }));
  }
}
