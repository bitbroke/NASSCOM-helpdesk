import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline, env } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, '..', 'data', 'merged_tickets.csv');
const FALLBACK_CSV = path.join(__dirname, '..', 'data', 'english_tickets.csv');
const REPORT_FILE = path.join(__dirname, '..', 'data', 'evaluation_report.md');

env.allowLocalModels = true;
env.useBrowserCache = false;

// ─── Config ──────────────────────────────────────
const SAMPLE_SIZE = 120; 

// The same mapping used in train_lr.py
const categoryMapping = {
  // Direct mappings (merged_tickets.csv already has these)
  'Application': 'Application',
  'Infrastructure': 'Infrastructure',
  'Security': 'Security',
  'Database': 'Database',
  'Network': 'Network',
  'Access Management': 'Access Management',
  // Legacy mappings from english_tickets.csv
  'Technical Support': 'Application',
  'IT Support': 'Infrastructure',
  'Service Outages and Maintenance': 'Network',
  'Human Resources': 'Access Management',
  'Product Support': 'Application',
};

const VALID_CATEGORIES = ['Application', 'Infrastructure', 'Security', 'Database', 'Network', 'Access Management'];

// ─── CSV Parser ──────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let currentRow = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(current);
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      currentRow.push(current);
      rows.push(currentRow);
      currentRow = [];
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch;
    }
  }
  if (current || currentRow.length > 0) {
    currentRow.push(current);
    rows.push(currentRow);
  }
  return rows;
}

// ─── F1 Score Calculation ────────────────────────
function computeMetrics(predictions, groundTruths, categories) {
  const confusion = {};
  for (const cat of categories) {
    confusion[cat] = { tp: 0, fp: 0, fn: 0 };
  }

  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const truth = groundTruths[i];
    if (pred === truth) {
      correct++;
      confusion[truth].tp++;
    } else {
      if (confusion[pred]) confusion[pred].fp++;
      if (confusion[truth]) confusion[truth].fn++;
    }
  }

  const accuracy = predictions.length ? correct / predictions.length : 0;

  const perClass = {};
  let macroF1 = 0;
  let weightedF1 = 0;
  let totalSupport = predictions.length;

  for (const cat of categories) {
    const { tp, fp, fn } = confusion[cat];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const support = tp + fn;
    perClass[cat] = { precision, recall, f1, support };
    macroF1 += f1;
    weightedF1 += f1 * support;
  }

  macroF1 /= categories.length;
  weightedF1 = totalSupport > 0 ? weightedF1 / totalSupport : 0;

  return { accuracy, macroF1, weightedF1, perClass };
}

// ─── Main Evaluation ─────────────────────────────
async function evaluate() {
  if (!fs.existsSync(CSV_FILE)) {
    if (fs.existsSync(FALLBACK_CSV)) {
      console.log('⚠ merged_tickets.csv not found. Falling back to english_tickets.csv');
    } else {
      console.error('❌ Dataset not found.');
      process.exit(1);
    }
  }

  console.log('📊 Starting Offline Evaluation Pipeline (No APIs)...');

  // Load dataset
  const csvText = fs.readFileSync(fs.existsSync(CSV_FILE) ? CSV_FILE : FALLBACK_CSV, 'utf-8');
  const rows = parseCSV(csvText);
  
  // Header: Subject(0), Body(1), Answer(2), Type(3), Queue(4), Priority(5), Language(6)
  const headers = rows[0];
  const qIdx = headers.indexOf('Queue');
  const subjIdx = headers.indexOf('Subject');
  const bodyIdx = headers.indexOf('Body');

  const allTickets = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[qIdx]) continue;
    const mapped = categoryMapping[r[qIdx]];
    if (mapped) {
      allTickets.push({
        title: r[subjIdx] || '',
        description: r[bodyIdx] || '',
        category: mapped
      });
    }
  }
  console.log(`   Mapped ${allTickets.length} relevant IT tickets from CSV.`);

  // Stratified sample
  const byCategory = {};
  for (const t of allTickets) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }
  const perCatSample = Math.max(1, Math.floor(SAMPLE_SIZE / VALID_CATEGORIES.length));
  const sample = [];
  for (const cat of VALID_CATEGORIES) {
    const catTickets = byCategory[cat] || [];
    const shuffled = catTickets.sort(() => 0.5 - Math.random());
    sample.push(...shuffled.slice(0, perCatSample));
  }
  console.log(`   Evaluation sample: ${sample.length} tickets (stratified)\n`);

  // Load models
  console.log('🔤 Loading embedding model (bge-small-en-v1.5) and Custom LR Classifier...');
  const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  
  let lrModel = null;
  const lrModelPath = path.join(__dirname, '..', 'data', 'lr_model.json');
  if (fs.existsSync(lrModelPath)) {
    lrModel = JSON.parse(fs.readFileSync(lrModelPath, 'utf-8'));
    console.log('   Custom ML weights (Logistic Regression) loaded ✓\n');
  } else {
    console.warn('   ⚠ Custom ML weights not found. Run `python scripts/train_lr.py` first.');
    process.exit(1);
  }

  const predictions = [];
  const groundTruths = [];

  for (let i = 0; i < sample.length; i++) {
    const ticket = sample[i];
    const text = `${ticket.title}\n${ticket.description}`;
    process.stdout.write(`\r   Processing ${i + 1}/${sample.length}...`);

    let predCategory = 'Unknown';
    try {
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      const embeddingArray = Array.from(output.data);
      
      const { classes, weights, intercepts } = lrModel;
      
      // Layer 1: Input (384) -> Hidden 1 (100)
      const h1 = new Array(100).fill(0);
      for (let j = 0; j < 100; j++) {
        let z = intercepts[0][j];
        for (let idx = 0; idx < 384; idx++) {
          z += embeddingArray[idx] * weights[0][idx][j];
        }
        h1[j] = Math.max(0, z); // ReLU
      }

      // Layer 2: Hidden 1 (100) -> Hidden 2 (50)
      const h2 = new Array(50).fill(0);
      for (let j = 0; j < 50; j++) {
        let z = intercepts[1][j];
        for (let idx = 0; idx < 100; idx++) {
          z += h1[idx] * weights[1][idx][j];
        }
        h2[j] = Math.max(0, z); // ReLU
      }

      // Layer 3: Hidden 2 (50) -> Output Logits (6)
      const logits = classes.map((cat, k) => {
        let z = intercepts[2][k];
        for (let idx = 0; idx < 50; idx++) {
          z += h2[idx] * weights[2][idx][k];
        }
        return z;
      });

      const maxLogit = Math.max(...logits);
      const exps = logits.map((z) => Math.exp(z - maxLogit));
      const sumExps = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map((e) => e / sumExps);
      
      let maxProb = -1;
      for (let j = 0; j < probs.length; j++) {
        if (probs[j] > maxProb) {
          maxProb = probs[j];
          predCategory = classes[j];
        }
      }
    } catch (err) {
      console.warn(`\n   ⚠ Custom ML classification error: ${err.message}`);
    }

    predictions.push(predCategory);
    groundTruths.push(ticket.category);
  }

  console.log('\n');

  // Compute metrics
  const metrics = computeMetrics(predictions, groundTruths, VALID_CATEGORIES);

  // Generate Report
  console.log('📝 Generating evaluation report...\n');

  let report = `# Evaluation Report — Offline Model Classification\n\n`;
  report += `**Date**: ${new Date().toISOString().split('T')[0]}\n`;
  report += `**Classifier**: Local Multi-Layer Perceptron (MLP) (\`lr_model.json\`)\n`;
  report += `**Dataset**: \`merged_tickets.csv\`\n`;
  report += `**Evaluation Sample**: ${sample.length} tickets (stratified from ${allTickets.length} total)\n`;
  report += `*Note: Evaluated against the 6 custom mapped classes from training.*\n\n`;

  report += `---\n\n## Summary Metrics\n\n`;
  report += `| Metric | Score |\n|---|---|\n`;
  report += `| **Overall Accuracy** | ${(metrics.accuracy * 100).toFixed(1)}% |\n`;
  report += `| **Macro F1 Score** | ${(metrics.macroF1 * 100).toFixed(1)}% |\n`;
  report += `| **Weighted F1 Score** | ${(metrics.weightedF1 * 100).toFixed(1)}% |\n\n`;

  report += `## Per-Category Classification Report\n\n`;
  report += `| Category | Precision | Recall | F1 Score | Support |\n|---|---|---|---|---|\n`;
  for (const cat of VALID_CATEGORIES) {
    const m = metrics.perClass[cat];
    report += `| ${cat} | ${(m.precision * 100).toFixed(1)}% | ${(m.recall * 100).toFixed(1)}% | ${(m.f1 * 100).toFixed(1)}% | ${m.support} |\n`;
  }
  
  fs.writeFileSync(REPORT_FILE, report, 'utf-8');
  console.log(`✅ Evaluation complete! Report saved → ${REPORT_FILE}`);
  console.log(`\n📊 Quick Summary:`);
  console.log(`   Accuracy:           ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`   Macro F1:           ${(metrics.macroF1 * 100).toFixed(1)}%`);
}

evaluate().catch(err => console.error(err));
