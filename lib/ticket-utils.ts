export function regexRedact(text: string): string {
  let out = text;
  out = out.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  out = out.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  // Credit card patterns
  out = out.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD]');
  // Aadhaar number (Indian 12-digit)
  out = out.replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, '[REDACTED_AADHAAR]');
  return out;
}

/**
 * Enhanced reranking with keyword overlap, error code matching, and bigram phrases.
 * Replaces the old single-factor keyword overlap approach.
 */
export function rerank(docs: any[], query: string): any[] {
  const queryLower = query.toLowerCase();
  const queryTokens = new Set(queryLower.split(/\s+/).filter(t => t.length > 3));

  // Extract error codes and technical terms
  const errorCodePattern = /\b(err_\w+|error\s*\d+|0x[0-9a-f]+|fatal|oom|tls|ssl|ldap|dns|vpn|tcp|udp|http\s*\d{3})\b/gi;
  const queryErrorCodes = new Set((query.match(errorCodePattern) || []).map(c => c.toLowerCase()));

  return docs
    .map(doc => {
      const docText: string = (doc.sanitized_query || '').toLowerCase();
      const docTokens = new Set(docText.split(/\s+/));

      // 1. Basic keyword overlap
      let overlapCount = 0;
      for (const token of queryTokens) {
        if (docTokens.has(token)) overlapCount++;
      }
      const keywordScore = queryTokens.size > 0 ? overlapCount / queryTokens.size : 0;

      // 2. Error code exact match (high weight)
      const docErrorCodes = new Set(
        ((doc.sanitized_query || '').match(errorCodePattern) || []).map((c: string) => c.toLowerCase())
      );
      let errorCodeOverlap = 0;
      for (const code of queryErrorCodes) {
        if (docErrorCodes.has(code)) errorCodeOverlap++;
      }
      const errorCodeScore = queryErrorCodes.size > 0 ? errorCodeOverlap / queryErrorCodes.size : 0;

      // 3. Bigram overlap for phrase matching
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      const docWords = docText.split(/\s+/).filter(w => w.length > 2);
      const queryBigrams = new Set<string>();
      for (let i = 0; i < queryWords.length - 1; i++) queryBigrams.add(`${queryWords[i]} ${queryWords[i + 1]}`);
      const docBigrams = new Set<string>();
      for (let i = 0; i < docWords.length - 1; i++) docBigrams.add(`${docWords[i]} ${docWords[i + 1]}`);
      let bigramOverlap = 0;
      for (const bg of queryBigrams) if (docBigrams.has(bg)) bigramOverlap++;
      const bigramScore = queryBigrams.size > 0 ? bigramOverlap / queryBigrams.size : 0;

      // Weighted combination
      const rerankScore = (doc.similarity || 0) * 0.3 
                        + keywordScore * 0.25 
                        + errorCodeScore * 0.3 
                        + bigramScore * 0.15;
      return { ...doc, rerankScore };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

export function checkGrounding(resolution: string, context: string): { isGrounded: boolean; groundingScore: number } {
  if (!context || context.length < 20) {
    return { isGrounded: false, groundingScore: 0 };
  }

  const resTokens = new Set(resolution.toLowerCase().split(/\s+/).filter(t => t.length > 3));
  const ctxTokens = new Set(context.toLowerCase().split(/\s+/).filter(t => t.length > 3));

  let overlap = 0;
  for (const token of resTokens) {
    if (ctxTokens.has(token)) overlap++;
  }

  const groundingScore = resTokens.size > 0 ? overlap / resTokens.size : 0;
  return {
    isGrounded: groundingScore > 0.2,
    groundingScore: parseFloat(groundingScore.toFixed(3))
  };
}
